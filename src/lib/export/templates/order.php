<?php
/**
 * order.php — order endpoint of a COD Studio static export ("PHP" mode).
 *
 * Requirements: PHP 8.1+ (syntax kept 7.3-compatible), ext-json, ext-mbstring; ext-curl + ext-openssl
 * for Google Sheets / Telegram; ext-intl optional (better text normalization).
 *
 * POST (same origin, JSON ≤ 16 KB) → the same OrderResponse JSON as the COD Studio API:
 *   {ok:true, orderId, total, currency}  |  {ok:false, error: invalid|duplicate|rate_limited|unavailable|server, fields?, orderId?}
 *
 *   1. payload checks (same rules as OrderPayload), honeypot → decoy success, timing & user-agent flags
 *   2. file-based rate limits (per IP — IPv6 per /64 —, per phone) and idempotent replays; a page-wide
 *      surge never refuses clean orders, it marks them for review (and refuses only risky ones)
 *   3. totals recomputed from the price table below — what the browser sends is never trusted
 *   4. the order is appended to cod-private/data/orders.jsonl (your private backup) and, when Google
 *      Sheets is configured, queued for it
 *   5. after the answer: Google Sheets (service account) + optional Telegram message; failed pushes
 *      stay queued and are retried on the next orders (or GET order.php?sync=1)
 *
 * Counters, replay records and phone markers live in a fixed set of shard files (data/rl, data/idem,
 * data/phones — 256 each, pruned on write), so the number of files never grows with the number of
 * visitors (shared hosting counts inodes).
 *
 * Secrets live in cod-private/config.php, OUTSIDE the web root (see README.md). This file contains
 * no secret: only the public page data generated at export time.
 * GET order.php?check=1 → setup self-test (booleans only).
 */
declare(strict_types=1);

/*
 * Absolute path of the private folder (config.php, lib/, data/). Empty = auto: the "cod-private"
 * folder next to the web root (e.g. /home/u123/domains/shop.ma/cod-private next to public_html).
 */
const COD_PRIVATE_DIR = '';

/* Generated at export time — prices, packs, variants and form rules of the exported page. */
const COD_SPEC_JSON = <<<'JSON'
{"v":0}
JSON;

const COD_MAX_BODY = 16384;
const COD_DUPLICATE_WINDOW = 43200;
const COD_REVIEW_SCORE = 50;
const COD_BOT_UA = '/bot|crawl|spider|curl|wget|python|httpclient|okhttp|java\/|go-http|axios|node-fetch|headless|phantom|selenium|puppeteer|playwright/i';
/* Page-wide surge: past this many orders in 10 min, clean orders are still taken (flagged "surge", marked
 * for review) and only orders that already look automated are refused — a flood can never lock real
 * shoppers out. */
const COD_SURGE_ORDERS = 200;
const COD_SURGE_SCORE = 50;
const COD_SURGE_REFUSE_SCORE = 30;
/* Live entries kept per shard file (the earliest-expiring go first beyond that). */
const COD_SHARD_MAX = 4096;
/* Folder names web servers serve: a private folder below one of them is refused (subdomain roots on
 * Hostinger sit inside the main site's public_html). */
const COD_WEB_ROOT_DIRS = ['public_html', 'private_html', 'htdocs', 'httpdocs', 'httpsdocs', 'html', 'wwwroot'];
/* Cloudflare's published edge ranges (https://www.cloudflare.com/ips/) — the proxies trusted by default
 * for 'trusted_ip_header' => 'HTTP_CF_CONNECTING_IP'. */
const COD_CLOUDFLARE_IPS = [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
    '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
    '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
    '2a06:98c0::/29', '2c0f:f248::/32',
];
const COD_DENY_HTACCESS = "# Private folder of order.php — never served over HTTP\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n";

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

cod_main();

/* ------------------------------------------------------------------ */
/* entry                                                               */
/* ------------------------------------------------------------------ */

function cod_main(): void
{
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $spec = json_decode(COD_SPEC_JSON, true);
    if (!is_array($spec) || ($spec['v'] ?? 0) !== 1) {
        cod_respond(500, ['ok' => false, 'error' => 'server']);
        return;
    }
    if ($method === 'OPTIONS') {
        cod_respond(204, null, ['Allow' => 'GET, POST, OPTIONS']);
        return;
    }
    if ($method === 'GET') {
        if (isset($_GET['check'])) {
            cod_respond(200, cod_self_test());
        } elseif (isset($_GET['sync'])) {
            cod_manual_sync();
        } else {
            cod_respond(405, ['ok' => false, 'error' => 'invalid'], ['Allow' => 'GET, POST, OPTIONS']);
        }
        return;
    }
    if ($method !== 'POST') {
        cod_respond(405, ['ok' => false, 'error' => 'invalid'], ['Allow' => 'GET, POST, OPTIONS']);
        return;
    }

    try {
        $result = cod_handle_order($spec);
    } catch (Throwable $e) {
        cod_log('order: ' . get_class($e) . ': ' . $e->getMessage());
        $result = ['status' => 500, 'body' => ['ok' => false, 'error' => 'server']];
    }
    cod_respond($result['status'], $result['body'], $result['headers'] ?? []);

    // after the answer: push queued orders to Google Sheets and notify Telegram
    if (!empty($result['after'])) {
        cod_finish_response();
        try {
            $env = cod_env();
            if ($env) {
                if (!empty($result['order'])) {
                    cod_telegram($env, $result['order']);
                }
                cod_sync($env, 25);
            }
        } catch (Throwable $e) {
            cod_log('after: ' . get_class($e) . ': ' . $e->getMessage());
        }
    }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

/** @param array<string, mixed>|null $body */
function cod_respond(int $status, ?array $body, array $headers = []): void
{
    $json = $body === null ? '' : (string)json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!headers_sent()) {
        http_response_code($status);
        header_remove('X-Powered-By');
        if ($body !== null) {
            header('Content-Type: application/json; charset=utf-8');
        }
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('X-Robots-Tag: noindex, nofollow');
        header('Content-Length: ' . strlen($json));
        foreach ($headers as $name => $value) {
            header($name . ': ' . $value);
        }
    }
    echo $json;
}

/** Let the shopper go while Sheets / Telegram run (FPM, LiteSpeed, or a closed connection). */
function cod_finish_response(): void
{
    ignore_user_abort(true);
    @set_time_limit(60);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
        return;
    }
    if (function_exists('litespeed_finish_request')) {
        litespeed_finish_request();
        return;
    }
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    flush();
}

function cod_header(string $name): ?string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$key]) && is_string($_SERVER[$key]) ? $_SERVER[$key] : null;
}

/** host[:port] without the default port of the scheme. */
function cod_host_key(string $host, string $scheme): string
{
    $host = strtolower(trim($host));
    if (($scheme === 'https' && substr($host, -4) === ':443') || ($scheme === 'http' && substr($host, -3) === ':80')) {
        $host = (string)preg_replace('/:\d+$/', '', $host);
    }
    return $host;
}

/** Same-origin only: the page and this file live on the same site. Returns [ok, noOrigin]. */
function cod_origin_check(): array
{
    $origin = cod_header('Origin');
    $site = cod_header('Sec-Fetch-Site');
    if ($origin === null) {
        return [$site === null || $site === 'same-origin' || $site === 'none', true];
    }
    $p = parse_url($origin);
    if (!is_array($p) || !isset($p['host'], $p['scheme']) || !in_array($p['scheme'], ['http', 'https'], true)) {
        return [false, false];
    }
    $from = cod_host_key($p['host'] . (isset($p['port']) ? ':' . $p['port'] : ''), $p['scheme']);
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || cod_header('X-Forwarded-Proto') === 'https';
    $self = cod_host_key((string)($_SERVER['HTTP_HOST'] ?? ''), $https ? 'https' : 'http');
    $selfBare = (string)preg_replace('/:\d+$/', '', $self);
    return [$from === $self || $from === $selfBare, false];
}

/** Canonical text form of an IP (IPv4-mapped IPv6 unwrapped to IPv4), or null when not an IP. */
function cod_ip_plain(string $ip): ?string
{
    $bin = filter_var($ip, FILTER_VALIDATE_IP) ? @inet_pton($ip) : false;
    if (!is_string($bin)) {
        return null;
    }
    if (strlen($bin) === 16 && substr($bin, 0, 12) === str_repeat("\0", 10) . "\xff\xff") {
        $bin = substr($bin, 12);
    }
    $text = @inet_ntop($bin);
    return is_string($text) ? $text : null;
}

/** Is $ip inside one of the CIDR ranges ("203.0.113.0/24", "2606:4700::/32", or a single address)? */
function cod_ip_in(string $ip, array $cidrs): bool
{
    $plain = cod_ip_plain($ip);
    $bin = $plain === null ? false : @inet_pton($plain);
    if (!is_string($bin)) {
        return false;
    }
    foreach ($cidrs as $cidr) {
        $parts = explode('/', trim((string)$cidr), 2);
        $netPlain = cod_ip_plain($parts[0]);
        $net = $netPlain === null ? false : @inet_pton($netPlain);
        if (!is_string($net) || strlen($net) !== strlen($bin)) {
            continue;
        }
        $max = strlen($net) * 8;
        if (isset($parts[1]) && !preg_match('/^\d{1,3}$/', $parts[1])) {
            continue;
        }
        $bits = isset($parts[1]) ? (int)$parts[1] : $max;
        if ($bits > $max) {
            continue;
        }
        $bytes = intdiv($bits, 8);
        if (substr($bin, 0, $bytes) !== substr($net, 0, $bytes)) {
            continue;
        }
        $rest = $bits % 8;
        if ($rest === 0) {
            return true;
        }
        $mask = (0xff << (8 - $rest)) & 0xff;
        if ((ord($bin[$bytes]) & $mask) === (ord($net[$bytes]) & $mask)) {
            return true;
        }
    }
    return false;
}

/** The proxies allowed to set trusted_ip_header: config 'trusted_proxies', else Cloudflare's for its header. */
function cod_trusted_proxies(array $config, string $header): array
{
    $list = $config['trusted_proxies'] ?? [];
    if (is_string($list)) {
        $list = preg_split('/[\s,]+/', $list, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }
    $list = is_array($list) ? array_values(array_filter($list, 'is_string')) : [];
    if (!$list && $header === 'HTTP_CF_CONNECTING_IP') {
        return COD_CLOUDFLARE_IPS;
    }
    return $list;
}

/**
 * The visitor's IP. A forwarding header is only as trustworthy as the machine that sent it: the
 * origin server stays reachable directly (shared IP, temporary domain, old DNS), where anyone can
 * write any value into CF-Connecting-IP or X-Forwarded-For. So the header counts only when
 * REMOTE_ADDR is one of the trusted proxies, and then the right-most hop that is not a trusted proxy
 * wins (proxies append on the right; the left-most entries are whatever the client sent).
 */
function cod_client_ip(array $config): string
{
    $remote = cod_ip_plain((string)($_SERVER['REMOTE_ADDR'] ?? '')) ?? '0.0.0.0';
    $header = (string)($config['trusted_ip_header'] ?? '');
    if ($header === '' || !preg_match('/^HTTP_[A-Z0-9_]{2,40}$/', $header) || empty($_SERVER[$header]) || !is_string($_SERVER[$header])) {
        return $remote;
    }
    $proxies = cod_trusted_proxies($config, $header);
    if (!$proxies || !cod_ip_in($remote, $proxies)) {
        return $remote;
    }
    $hops = array_slice(explode(',', $_SERVER[$header]), -20);
    for ($i = count($hops) - 1; $i >= 0; $i--) {
        $ip = cod_ip_plain(trim($hops[$i]));
        if ($ip === null) {
            return $remote;
        }
        if (!cod_ip_in($ip, $proxies)) {
            return $ip;
        }
    }
    return $remote;
}

/**
 * Rate-limit identity of an address: IPv4 as is, IPv6 by its /64 — one connection usually owns a whole
 * /64, so rotating addresses inside it must not mint fresh buckets.
 */
function cod_ip_key(string $ip): string
{
    $plain = cod_ip_plain($ip);
    $bin = $plain === null ? false : @inet_pton($plain);
    if (!is_string($bin)) {
        return $ip;
    }
    if (strlen($bin) === 16) {
        return (string)inet_ntop(substr($bin, 0, 8) . str_repeat("\0", 8)) . '/64';
    }
    return (string)$plain;
}

/* ------------------------------------------------------------------ */
/* private folder & config                                             */
/* ------------------------------------------------------------------ */

/** The part of $path above its first web-root folder (".../shop.ma" for ".../shop.ma/public_html/promo"), or null. */
function cod_outside_web_roots(string $path): ?string
{
    $parts = preg_split('~[\\\\/]~', $path) ?: [];
    foreach ($parts as $i => $part) {
        if ($i > 0 && in_array(strtolower($part), COD_WEB_ROOT_DIRS, true)) {
            return implode(DIRECTORY_SEPARATOR, array_slice($parts, 0, $i));
        }
    }
    return null;
}

/**
 * The private folder holding config.php → ['dir' => path or null, 'issue' => null | 'not_found' | 'in_web_root'].
 * Resolved once per request. Never a folder a web server could serve: inside this site's document root,
 * or below any folder named like a web root — a Hostinger subdomain's root is public_html/<sub>, so the
 * folder "one level above" it is still served by the main site.
 */
function cod_private_lookup(): array
{
    static $found = null;
    if ($found !== null) {
        return $found;
    }
    $found = ['dir' => null, 'issue' => 'not_found']; // also what a re-entrant call sees
    $candidates = [];
    if (COD_PRIVATE_DIR !== '') {
        $candidates[] = COD_PRIVATE_DIR;
    }
    $env = getenv('COD_PRIVATE_DIR');
    if (is_string($env) && $env !== '') {
        $candidates[] = $env;
    }
    $docroot = !empty($_SERVER['DOCUMENT_ROOT']) ? realpath((string)$_SERVER['DOCUMENT_ROOT']) : false;
    if ($docroot !== false) {
        $candidates[] = dirname($docroot) . DIRECTORY_SEPARATOR . 'cod-private';
        // subdomain / nested root (…/shop.ma/public_html/promo): next to the outermost web-root folder
        $outer = cod_outside_web_roots($docroot);
        if ($outer !== null && $outer !== '') {
            $candidates[] = $outer . DIRECTORY_SEPARATOR . 'cod-private';
        }
    }
    $candidates[] = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'cod-private';
    $root = $docroot !== false ? rtrim($docroot, '/\\') . DIRECTORY_SEPARATOR : null;
    foreach (array_unique($candidates) as $candidate) {
        $dir = realpath($candidate);
        if ($dir === false || !is_file($dir . DIRECTORY_SEPARATOR . 'config.php')) {
            continue;
        }
        if (($root !== null && strpos($dir . DIRECTORY_SEPARATOR, $root) === 0) || cod_outside_web_roots($dir) !== null) {
            // refused, and shielded meanwhile (its own .htaccess may have been lost on upload). error_log, not
            // cod_log(): cod_log() looks for this very folder.
            if (!is_file($dir . DIRECTORY_SEPARATOR . '.htaccess')) {
                @file_put_contents($dir . DIRECTORY_SEPARATOR . '.htaccess', COD_DENY_HTACCESS);
            }
            error_log('[cod-order] the private folder can be served over HTTP — move it next to public_html (see README): ' . $dir);
            $found['issue'] = 'in_web_root';
            continue;
        }
        $found = ['dir' => $dir, 'issue' => null];
        break;
    }
    return $found;
}

/** The private folder (outside every web root) holding config.php — null when not found or unsafe. */
function cod_private_dir(): ?string
{
    return cod_private_lookup()['dir'];
}

/** ['dir' => private dir, 'data' => data dir, 'config' => array] or null when not set up. */
function cod_env(): ?array
{
    static $env = false;
    if ($env !== false) {
        return $env;
    }
    $env = null;
    $dir = cod_private_dir();
    if ($dir === null) {
        return null;
    }
    $config = require $dir . DIRECTORY_SEPARATOR . 'config.php';
    if (!is_array($config) || !is_string($config['secret'] ?? null) || strlen($config['secret']) < 32) {
        cod_log('config.php must return an array with a "secret" of at least 32 characters');
        return null;
    }
    $data = $dir . DIRECTORY_SEPARATOR . 'data';
    foreach (['', '/rl', '/idem', '/phones', '/pending'] as $sub) {
        $path = $data . $sub;
        if (!is_dir($path) && !@mkdir($path, 0700, true) && !is_dir($path)) {
            cod_log('cannot create ' . $path);
            return null;
        }
    }
    // belt and braces should the folder ever be served: the ZIP's .htaccess is easily lost on upload
    // (dotfiles hidden by Finder / FTP clients)
    foreach ([$dir, $data] as $path) {
        if (!is_file($path . '/.htaccess')) {
            @file_put_contents($path . '/.htaccess', COD_DENY_HTACCESS);
        }
    }
    $env = ['dir' => $dir, 'data' => $data, 'config' => $config];
    return $env;
}

function cod_log(string $message): void
{
    $dir = cod_private_dir();
    $line = '[' . gmdate('c') . '] ' . str_replace(["\r", "\n"], ' ', $message);
    if ($dir !== null && is_dir($dir . '/data')) {
        @file_put_contents($dir . '/data/error.log', $line . "\n", FILE_APPEND | LOCK_EX);
    } else {
        error_log('[cod-order] ' . $line);
    }
}

/** Setup check — booleans and a reason code only (no paths, no secrets). */
function cod_self_test(): array
{
    $env = cod_env();
    $config = $env ? $env['config'] : [];
    $private = cod_private_lookup();
    return [
        'ok' => $env !== null,
        'php' => PHP_VERSION_ID >= 80100,
        'privateFolder' => $private['dir'] !== null,
        // 'in_web_root': the folder was found where a web server can serve it — move it (README)
        'privateFolderIssue' => $private['issue'],
        'config' => $env !== null,
        'writable' => $env !== null && is_writable($env['data']),
        'curl' => function_exists('curl_init'),
        'sheets' => $env !== null && !empty($config['spreadsheet_id']) && !empty($config['service_account']),
        'telegram' => $env !== null && !empty($config['telegram_bot_token']) && !empty($config['telegram_chat_id']),
    ];
}

/* ------------------------------------------------------------------ */
/* small file stores                                                   */
/* ------------------------------------------------------------------ */

/** Read-modify-write a JSON file under an exclusive lock. $fn receives the current value (or null). */
function cod_locked_json(string $file, callable $fn)
{
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        throw new RuntimeException('cannot open ' . basename($file));
    }
    try {
        flock($fh, LOCK_EX);
        $raw = stream_get_contents($fh);
        $current = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
        list($next, $result) = $fn($current);
        if ($next !== null) {
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, (string)json_encode($next, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            fflush($fh);
        }
        return $result;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/**
 * Bounded key-value store ('rl', 'idem', 'phones'): 256 shard files per store, chosen by the first byte
 * of the key's HMAC; each is a JSON map of live entries ('x' = expiry), pruned on every write. The file
 * count stays fixed however many visitors (or forged addresses) show up.
 * $fn(?array $entry, int $now) returns [new entry with 'x' | null = leave as is, result].
 */
function cod_store(array $env, string $store, string $key, callable $fn)
{
    list($file, $slot) = cod_store_slot($env, $store, $key);
    $now = time();
    return cod_locked_json($file, function ($map) use ($slot, $now, $fn) {
        $map = is_array($map) ? $map : [];
        $live = [];
        foreach ($map as $k => $entry) {
            if (is_array($entry) && (int)($entry['x'] ?? 0) > $now) {
                $live[(string)$k] = $entry;
            }
        }
        list($next, $result) = $fn($live[$slot] ?? null, $now);
        if ($next === null) {
            return [count($live) !== count($map) ? $live : null, $result];
        }
        $live[$slot] = $next;
        if (count($live) > COD_SHARD_MAX) {
            uasort($live, function ($a, $b) {
                return (int)$a['x'] <=> (int)$b['x'];
            });
            $live = array_slice($live, -COD_SHARD_MAX, null, true);
        }
        return [$live, $result];
    });
}

/** Fixed-window counter. Returns 0 when allowed, else the seconds until the window resets. */
function cod_rate(array $env, string $bucket, int $limit, int $window): int
{
    return (int)cod_store($env, 'rl', $bucket, function ($s, int $now) use ($limit, $window) {
        if (!is_array($s)) {
            $s = ['n' => 0, 'x' => $now + $window];
        }
        $s['n'] = (int)($s['n'] ?? 0) + 1;
        return [$s, $s['n'] > $limit ? max(1, (int)$s['x'] - $now) : 0];
    });
}

/** [shard file, slot in it] of a key. */
function cod_store_slot(array $env, string $store, string $key): array
{
    $id = hash_hmac('sha256', $store . '|' . $key, $env['config']['secret']);
    return [$env['data'] . '/' . $store . '/' . substr($id, 0, 2) . '.json', substr($id, 2, 30)];
}

/** Stored entry of a store, or null (read only). */
function cod_store_get(array $env, string $store, string $key): ?array
{
    if (!is_file(cod_store_slot($env, $store, $key)[0])) {
        return null;
    }
    $entry = cod_store($env, $store, $key, function ($e) {
        return [null, $e];
    });
    return is_array($entry) ? $entry : null;
}

/** Store $data under $key for $ttl seconds. */
function cod_store_put(array $env, string $store, string $key, array $data, int $ttl): void
{
    cod_store($env, $store, $key, function ($e, int $now) use ($data, $ttl) {
        return [array_merge($data, ['x' => $now + $ttl]), null];
    });
}

/**
 * Occasional clean-up of the one-file-per-key records older versions of order.php left in rl/, idem/
 * and phones/ (shard files prune themselves). Streams the folder under a small time budget.
 */
function cod_housekeeping(array $env): void
{
    if (random_int(1, 40) !== 1) {
        return;
    }
    $deadline = microtime(true) + 0.2;
    $limits = ['/rl' => 2 * 86400, '/idem' => 3 * 86400, '/phones' => 2 * 86400];
    foreach ($limits as $sub => $age) {
        $dh = @opendir($env['data'] . $sub);
        if ($dh === false) {
            continue;
        }
        $cutoff = time() - $age;
        while (($name = readdir($dh)) !== false) {
            if (microtime(true) > $deadline) {
                closedir($dh);
                return;
            }
            if (preg_match('/^[a-f0-9]{64}\.json$/', $name)) {
                $file = $env['data'] . $sub . '/' . $name;
                if (@filemtime($file) < $cutoff) {
                    @unlink($file);
                }
            }
        }
        closedir($dh);
    }
}

/* ------------------------------------------------------------------ */
/* text & validation                                                   */
/* ------------------------------------------------------------------ */

function cod_len(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : (int)preg_match_all('/./us', $s);
}

function cod_cut(string $s, int $max): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $max, 'UTF-8');
    }
    return preg_match('/^.{0,' . $max . '}/us', $s, $m) ? $m[0] : '';
}

/** Trim, NFC, drop control & bidi-override characters, collapse whitespace (= cleanInput in the app). */
function cod_clean($v, int $max): string
{
    $s = is_string($v) ? $v : (is_int($v) || is_float($v) ? (string)$v : '');
    if (!preg_match('//u', $s)) {
        return '';
    }
    if (class_exists('Normalizer')) {
        $n = Normalizer::normalize($s, Normalizer::FORM_C);
        $s = is_string($n) ? $n : $s;
    }
    $s = (string)preg_replace('/[\x{0000}-\x{001F}\x{007F}-\x{009F}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u', ' ', $s);
    $s = trim((string)preg_replace('/\s+/u', ' ', $s));
    return cod_cut($s, $max);
}

/** Customer name: ≥ 2 letters of any script, no digits or symbols. */
function cod_valid_name(string $raw): ?string
{
    $name = cod_clean($raw, 80);
    if (!preg_match('/^[\p{L}\p{M}][\p{L}\p{M} \'’.\-]*$/u', $name)) {
        return null;
    }
    return preg_match_all('/\p{L}/u', $name) >= 2 ? $name : null;
}

/** Shopper phone → ['national' => "0612345678", 'e164' => "+212612345678"] (same rules as the page). */
function cod_phone(string $raw, array $rule): ?array
{
    $digits = ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9', '＋' => '+'];
    $s = strtr($raw, $digits);
    $s = (string)preg_replace('/[\s\-.()\/_\x{061C}\x{200B}-\x{200F}\x{2010}-\x{2015}\x{2212}\x{202A}-\x{202E}\x{2060}\x{2066}-\x{2069}]/u', '', $s);
    if (!preg_match('/^\+?[0-9]{6,20}$/', $s)) {
        return null;
    }
    $cc = (string)preg_replace('/\D/', '', (string)($rule['prefix'] ?? ''));
    $national = (string)($rule['national'] ?? '');
    if ($cc === '' || $national === '') {
        return null;
    }
    $re = '~^(?:' . $national . ')$~';
    $d = $s[0] === '+' ? '00' . substr($s, 1) : $s;
    $candidates = [];
    $rest = null;
    if (strpos($d, '00' . $cc) === 0) {
        $rest = substr($d, 2 + strlen($cc));
    } elseif (strpos($d, '00') === 0) {
        return null;
    } else {
        $candidates[] = $d;
        $candidates[] = '0' . $d;
        if (strpos($d, $cc) === 0) {
            $rest = substr($d, strlen($cc));
        }
    }
    if ($rest !== null) {
        $r = (string)preg_replace('/^0/', '', $rest);
        $candidates[] = '0' . $r;
        $candidates[] = $r;
    }
    foreach ($candidates as $n) {
        if (@preg_match($re, $n) !== 1) {
            continue;
        }
        $significant = ($n[0] === '0' && $cc !== '39') ? substr($n, 1) : $n;
        $e164 = '+' . $cc . $significant;
        if (preg_match('/^\+[1-9][0-9]{7,14}$/', $e164)) {
            return ['national' => $n, 'e164' => $e164];
        }
    }
    return null;
}

/** City key like the app's findCity(): accents, Arabic letter variants, case and punctuation ignored. */
function cod_fold(string $s): string
{
    if (class_exists('Normalizer')) {
        $n = Normalizer::normalize($s, Normalizer::FORM_KD);
        $s = is_string($n) ? $n : $s;
    }
    $s = (string)preg_replace('/[\x{0300}-\x{036F}\x{064B}-\x{065F}\x{0670}]/u', '', $s);
    $s = strtr($s, ['أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ٱ' => 'ا', 'ى' => 'ي', 'ة' => 'ه']);
    $s = function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
    return (string)preg_replace('/[\s\'’`\-_.]+/u', '', $s);
}

/** Variant choices per unit → [groupName => optionLabel] per unit, or 'invalid' / 'unavailable'. */
function cod_variants(array $spec, int $qty, array $chosen)
{
    $groups = $spec['variants'];
    if (!$groups) {
        return [];
    }
    $units = array_fill(0, $qty, []);
    foreach ($groups as $g) {
        $available = array_values(array_filter($g['options'], function ($o) {
            return empty($o['soldOut']);
        }));
        for ($u = 0; $u < $qty; $u++) {
            $source = !empty($g['perUnit']) ? ($chosen[$u] ?? null) : ($chosen[0] ?? null);
            $wanted = is_array($source) && isset($source[$g['id']]) && is_string($source[$g['id']]) ? $source[$g['id']] : '';
            $opt = null;
            foreach ($g['options'] as $o) {
                if ($wanted !== '' && $o['id'] === $wanted) {
                    $opt = $o;
                    break;
                }
            }
            if ($opt !== null && !empty($opt['soldOut'])) {
                return 'unavailable';
            }
            if ($opt === null && $wanted === '' && count($available) === 1) {
                $opt = $available[0];
            }
            if ($opt === null) {
                return 'invalid';
            }
            $units[$u][$g['name']] = $opt['label'];
        }
    }
    return $units;
}

function cod_variant_text(array $units): string
{
    $list = [];
    foreach ($units as $unit) {
        $t = implode('/', array_filter(array_values($unit), 'strlen'));
        if ($t !== '') {
            $list[] = $t;
        }
    }
    if (!$list) {
        return '';
    }
    if (count(array_unique($list)) === 1) {
        return count($list) > 1 ? $list[0] . ' ×' . count($list) : $list[0];
    }
    $out = [];
    foreach ($list as $i => $t) {
        $out[] = ($i + 1) . ': ' . $t;
    }
    return implode(' · ', $out);
}

/** Shape checks mirroring OrderPayload (zod). Returns [payload, fieldErrors] — payload null when unusable. */
function cod_parse_payload($raw): array
{
    if (!is_array($raw)) {
        return [null, []];
    }
    $fields = [];
    $str = function (string $key, int $max, bool $required) use ($raw): ?string {
        if (!array_key_exists($key, $raw) || $raw[$key] === null) {
            return $required ? null : '';
        }
        if (!is_string($raw[$key])) {
            return null;
        }
        $v = trim($raw[$key]);
        return cod_len($v) <= $max ? $v : null;
    };
    $p = [];
    foreach ([['pageKey', '/^[a-zA-Z0-9_-]{8,80}$/'], ['idem', '/^[a-f0-9-]{36}$/'], ['eventId', '/^[a-zA-Z0-9_-]{8,64}$/']] as $rule) {
        $v = $raw[$rule[0]] ?? null;
        if (!is_string($v) || !preg_match($rule[1], $v)) {
            return [null, []];
        }
        $p[$rule[0]] = $v;
    }
    $bundle = $raw['bundleId'] ?? null;
    if (!is_string($bundle) || !preg_match('/^[a-zA-Z0-9_-]{2,40}$/', $bundle)) {
        $fields['bundleId'] = 'invalid';
        $bundle = '';
    }
    $p['bundleId'] = $bundle;

    $variants = $raw['variants'] ?? [];
    if (!is_array($variants) || count($variants) > 20) {
        return [null, []];
    }
    $p['variants'] = [];
    foreach (array_values($variants) as $unit) {
        if (!is_array($unit)) {
            return [null, []];
        }
        $clean = [];
        foreach ($unit as $k => $v) {
            if (!is_string($k) || !is_string($v) || strlen($k) > 40 || strlen($v) > 40) {
                return [null, []];
            }
            $clean[$k] = $v;
        }
        $p['variants'][] = $clean;
    }
    $bump = $raw['bump'] ?? false;
    if (!is_bool($bump)) {
        return [null, []];
    }
    $p['bump'] = $bump;

    $name = $str('name', 80, true);
    if ($name === null || cod_len($name) < 2) {
        $fields['name'] = 'invalid';
    }
    $phone = $str('phone', 24, true);
    if ($phone === null || cod_len($phone) < 6) {
        $fields['phone'] = 'invalid';
    }
    foreach ([['city', 80], ['address', 240]] as $f) {
        $v = $str($f[0], $f[1], false);
        if ($v === null) {
            $fields[$f[0]] = 'invalid';
        }
        $p[$f[0]] = (string)$v;
    }
    $note = $str('note', 300, false);
    $p['note'] = (string)$note;
    $email = $str('email', 120, false);
    if ($email === null || ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL))) {
        $fields['email'] = 'invalid';
    }
    $p['email'] = (string)$email;
    $t = $raw['t'] ?? null;
    if (!is_int($t) || $t < 0 || $t > 86400000) {
        return [null, []];
    }
    $p['t'] = $t;
    $p['name'] = (string)$name;
    $p['phone'] = (string)$phone;

    $utm = [];
    if (isset($raw['utm']) && is_array($raw['utm'])) {
        $max = ['source' => 120, 'medium' => 120, 'campaign' => 200, 'content' => 200, 'term' => 200, 'fbclid' => 500, 'ttclid' => 500, 'sccid' => 500, 'gclid' => 500];
        foreach ($max as $k => $limit) {
            if (isset($raw['utm'][$k]) && is_string($raw['utm'][$k])) {
                $utm[$k] = cod_clean($raw['utm'][$k], $limit);
            }
        }
    }
    $p['utm'] = array_filter($utm, 'strlen');
    $p['ref'] = is_string($raw['ref'] ?? null) ? cod_clean($raw['ref'], 500) : '';
    $p['locale'] = is_string($raw['locale'] ?? null) ? cod_cut($raw['locale'], 5) : '';
    return [$p, $fields];
}

/** Field rules of the exported form (= validateOrder in the app), prices from the embedded table. */
function cod_validate(array $p, array $spec): array
{
    $fields = [];
    $form = $spec['form'];
    $bundle = null;
    foreach ($spec['bundles'] as $b) {
        if ($b['id'] === $p['bundleId']) {
            $bundle = $b;
            break;
        }
    }
    if ($bundle === null) {
        $fields['bundleId'] = 'invalid';
    }
    $units = [];
    if ($bundle !== null) {
        $v = cod_variants($spec, (int)$bundle['qty'], $p['variants']);
        if (is_string($v)) {
            $fields['bundleId'] = $v;
        } else {
            $units = $v;
        }
    }
    $name = cod_valid_name($p['name']);
    if ($name === null) {
        $fields['name'] = cod_clean($p['name'], 80) !== '' ? 'invalid' : 'required';
    }
    $phone = cod_phone($p['phone'], $spec['phone']);
    if ($phone === null) {
        $fields['phone'] = cod_clean($p['phone'], 40) !== '' ? 'invalid' : 'required';
    }
    $city = null;
    if ($form['city'] !== 'hidden') {
        $input = cod_clean($p['city'], 80);
        if ($form['city'] === 'select' && !empty($spec['cities'])) {
            if (in_array($input, $spec['cities']['values'], true)) {
                $city = $input;
            } else {
                $key = cod_fold($input);
                $city = $key !== '' && isset($spec['cities']['keys'][$key]) ? $spec['cities']['keys'][$key] : null;
            }
            if ($city === null) {
                $fields['city'] = $input !== '' ? 'invalid' : 'required';
            }
        } elseif (preg_match_all('/\p{L}/u', $input) >= 2) {
            $city = $input;
        } else {
            $fields['city'] = $input !== '' ? 'invalid' : 'required';
        }
    }
    $address = null;
    if ($form['address'] !== 'hidden') {
        $input = cod_clean($p['address'], 240);
        $required = $form['address'] === 'required' || $city === ($spec['cities']['other'] ?? 'Autre');
        if (cod_len($input) >= 4) {
            $address = $input;
        } elseif ($required) {
            $fields['address'] = $input !== '' ? 'invalid' : 'required';
        } elseif ($input !== '') {
            $address = $input;
        }
    }
    $email = null;
    if ($form['email'] !== 'hidden') {
        $input = function_exists('mb_strtolower') ? mb_strtolower(cod_clean($p['email'], 120), 'UTF-8') : strtolower(cod_clean($p['email'], 120));
        if ($input !== '') {
            $email = $input;
        } elseif ($form['email'] === 'required') {
            $fields['email'] = 'required';
        }
    }
    $note = $form['note'] === 'hidden' ? null : (cod_clean($p['note'], 300) ?: null);
    if ($fields || $bundle === null || $name === null || $phone === null) {
        return [null, $fields];
    }
    $bump = $p['bump'] && !empty($spec['bump']);
    return [[
        'bundle' => $bundle,
        'units' => $units,
        'bump' => $bump,
        'total' => (float)($bump ? $bundle['totalWithBump'] : $bundle['total']),
        'name' => $name,
        'phone' => $phone,
        'city' => $city,
        'address' => $address,
        'email' => $email,
        'note' => $note,
    ], []];
}

/** "CMD-7K3Q9X" (no ambiguous characters). */
function cod_order_id(string $prefix = 'CMD'): string
{
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    $bytes = random_bytes(6);
    $s = '';
    for ($i = 0; $i < 6; $i++) {
        $s .= $alphabet[ord($bytes[$i]) % 32];
    }
    return $prefix . '-' . $s;
}

/* ------------------------------------------------------------------ */
/* order pipeline                                                      */
/* ------------------------------------------------------------------ */

function cod_fail(int $status, string $error, array $extra = [], array $headers = []): array
{
    return ['status' => $status, 'body' => array_merge(['ok' => false, 'error' => $error], $extra), 'headers' => $headers];
}

function cod_handle_order(array $spec): array
{
    list($sameOrigin, $noOrigin) = cod_origin_check();
    if (!$sameOrigin) {
        return cod_fail(403, 'unavailable');
    }
    $type = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? cod_header('Content-Type') ?? ''))[0]));
    if ($type !== '' && $type !== 'application/json' && $type !== 'text/plain') {
        return cod_fail(415, 'invalid');
    }
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > COD_MAX_BODY) {
        return cod_fail(413, 'invalid');
    }
    $body = (string)file_get_contents('php://input', false, null, 0, COD_MAX_BODY + 1);
    if (strlen($body) > COD_MAX_BODY) {
        return cod_fail(413, 'invalid');
    }
    $raw = json_decode($body, true);
    if (!is_array($raw) || array_values($raw) === $raw) {
        return cod_fail(400, 'invalid');
    }

    $currency = (string)$spec['currency'];
    // honeypot: bots get a success-looking answer and nothing is stored
    $website = $raw['website'] ?? '';
    if (is_string($website) && trim($website) !== '') {
        $total = (float)$spec['price'];
        foreach ($spec['bundles'] as $b) {
            if (isset($raw['bundleId']) && $b['id'] === $raw['bundleId']) {
                $total = (float)$b['total'];
            }
        }
        return ['status' => 200, 'body' => ['ok' => true, 'orderId' => cod_order_id(), 'total' => $total, 'currency' => $currency]];
    }

    list($p, $shapeErrors) = cod_parse_payload($raw);
    if ($p === null || $shapeErrors) {
        return cod_fail(422, 'invalid', $shapeErrors ? ['fields' => $shapeErrors] : []);
    }
    if (!hash_equals((string)$spec['pageKey'], $p['pageKey'])) {
        return cod_fail(404, 'unavailable');
    }

    $env = cod_env();
    if ($env === null) {
        cod_log('order refused: private folder / config.php not found (see README)');
        return cod_fail(500, 'server');
    }
    cod_housekeeping($env);
    $config = $env['config'];
    $ip = cod_client_ip($config);
    $ipHash = hash_hmac('sha256', cod_ip_key($ip), $config['secret']);

    $coarse = cod_rate($env, 'coarse:' . $ipHash, 60, 600);
    if ($coarse > 0) {
        return cod_fail(429, 'rate_limited', [], ['Retry-After' => (string)$coarse]);
    }

    // idempotency: a retried submit gets the original answer
    $prior = cod_store_get($env, 'idem', $p['idem']);
    if ($prior !== null && isset($prior['o'], $prior['t'])) {
        return ['status' => 200, 'body' => ['ok' => true, 'orderId' => (string)$prior['o'], 'total' => $prior['t'], 'currency' => $currency]];
    }

    list($o, $fields) = cod_validate($p, $spec);
    if ($o === null) {
        return cod_fail(422, 'invalid', $fields ? ['fields' => $fields] : []);
    }

    $byIp = cod_rate($env, 'ip:' . $ipHash, 8, 600);
    if ($byIp > 0) {
        return cod_fail(429, 'rate_limited', [], ['Retry-After' => (string)$byIp]);
    }

    // duplicate: same phone within 12 h → the original order number
    $phoneKey = hash_hmac('sha256', 'phone:' . $o['phone']['e164'], $config['secret']);
    $last = cod_store_get($env, 'phones', $phoneKey);
    if ($last !== null && isset($last['o'])) {
        return cod_fail(409, 'duplicate', ['orderId' => (string)$last['o']]);
    }

    // explainable risk flags (orders are kept; the sheet row is marked for review)
    $ua = cod_clean(cod_header('User-Agent') ?? '', 300);
    $flags = [];
    $score = 0;
    if ($p['t'] < 2500) {
        $flags[] = 'too_fast';
        $score += 35;
    } elseif ($p['t'] < 6000) {
        $flags[] = 'fast';
        $score += 10;
    }
    if ($ua === '') {
        $flags[] = 'no_ua';
        $score += 20;
    } elseif (preg_match(COD_BOT_UA, $ua)) {
        $flags[] = 'bot_ua';
        $score += 40;
    }
    if ($noOrigin) {
        $flags[] = 'no_origin';
        $score += 15;
    }

    // page-wide surge: never a kill switch for real shoppers — clean orders are taken and marked for
    // review, only orders that already look automated are turned away
    $surge = cod_rate($env, 'page', COD_SURGE_ORDERS, 600);
    if ($surge > 0) {
        if ($score >= COD_SURGE_REFUSE_SCORE) {
            return cod_fail(429, 'rate_limited', [], ['Retry-After' => (string)$surge]);
        }
        $flags[] = 'surge';
        $score += COD_SURGE_SCORE;
    }

    // counted last, once every other refusal is behind us: a refused attempt never uses up one of the
    // shopper's daily slots
    $byPhone = cod_rate($env, 'phone:' . $phoneKey, 4, 86400);
    if ($byPhone > 0) {
        return cod_fail(429, 'rate_limited', [], ['Retry-After' => (string)$byPhone]);
    }

    $now = time();
    $id = cod_order_id();
    $bundle = $o['bundle'];
    $product = $spec['product'] . ' — ' . $bundle['sheetLabel'] . ($o['bump'] ? ' + ' . $spec['bump']['title'] : '');
    $noteParts = array_filter([
        $score >= COD_REVIEW_SCORE ? '[À vérifier]' : '',
        (string)$o['note'],
        $o['email'] ? 'E-mail : ' . $o['email'] : '',
    ], 'strlen');
    $order = [
        'id' => $id,
        'created_at' => $now,
        'created' => gmdate('c', $now),
        'status' => 'new',
        'name' => $o['name'],
        'phone' => $o['phone']['e164'],
        'phone_national' => $o['phone']['national'],
        'city' => $o['city'],
        'address' => $o['address'],
        'note' => $o['note'],
        'email' => $o['email'],
        'product' => $product,
        'bundle_id' => $bundle['id'],
        'qty' => (int)$bundle['qty'],
        'variants' => $o['units'],
        'variant_text' => cod_variant_text($o['units']),
        'bump' => $o['bump'] ? $spec['bump']['title'] : null,
        'total' => $o['total'],
        'currency' => $currency,
        'locale' => $p['locale'] !== '' ? $p['locale'] : $spec['locale'],
        'utm' => (object)$p['utm'],
        'ref' => $p['ref'],
        'source' => cod_source($p['utm'], $p['ref']),
        'sheet_note' => implode(' · ', $noteParts),
        'risk' => min(100, $score),
        'flags' => $flags,
        'event_id' => $p['eventId'],
        'export_id' => $spec['exportId'],
        'ip_hash' => substr($ipHash, 0, 32),
    ];

    // 1. private backup log (append-only), 2. sheet queue (only when Sheets is set up: orders.jsonl
    // is the record otherwise), 3. replay + duplicate markers
    $line = json_encode($order, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($line) || @file_put_contents($env['data'] . '/orders.jsonl', $line . "\n", FILE_APPEND | LOCK_EX) === false) {
        cod_log('cannot write orders.jsonl');
        return cod_fail(500, 'server');
    }
    if (cod_sheets_on($config)) {
        $queued = array_merge($order, ['attempts' => 0, 'next_try' => 0]);
        if (@file_put_contents($env['data'] . '/pending/' . $now . '-' . $id . '.json', (string)json_encode($queued, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
            cod_log('cannot queue ' . $id . ' for Google Sheets (it is in orders.jsonl)');
        }
    }
    // the order is stored: a failing marker must not turn it into an error the shopper would retry
    try {
        cod_store_put($env, 'idem', $p['idem'], ['o' => $id, 't' => $o['total']], 3 * 86400);
        cod_store_put($env, 'phones', $phoneKey, ['o' => $id], COD_DUPLICATE_WINDOW);
    } catch (Throwable $e) {
        cod_log('markers ' . $id . ': ' . $e->getMessage());
    }

    return [
        'status' => 200,
        'body' => ['ok' => true, 'orderId' => $id, 'total' => $o['total'], 'currency' => $currency],
        'after' => true,
        'order' => $order,
    ];
}

/** "facebook (shop.ma)" — like the Source column of the app. */
function cod_source(array $utm, string $ref): string
{
    if (!empty($utm['source'])) {
        $s = implode(' · ', array_filter([$utm['source'], $utm['campaign'] ?? ''], 'strlen'));
    } elseif (!empty($utm['fbclid'])) {
        $s = 'facebook';
    } elseif (!empty($utm['ttclid'])) {
        $s = 'tiktok';
    } elseif (!empty($utm['sccid'])) {
        $s = 'snapchat';
    } elseif (!empty($utm['gclid'])) {
        $s = 'google';
    } else {
        $s = 'direct';
    }
    $host = $ref !== '' ? (string)parse_url($ref, PHP_URL_HOST) : '';
    return $s . ' (' . ($host !== '' ? $host : 'php') . ')';
}

/* ------------------------------------------------------------------ */
/* Google Sheets & Telegram                                            */
/* ------------------------------------------------------------------ */

/** Spreadsheet id from an id or a full Google Sheets link. */
function cod_sheet_id(string $value): ?string
{
    if (preg_match('~/spreadsheets/d/([A-Za-z0-9_-]{20,100})~', $value, $m)) {
        return $m[1];
    }
    return preg_match('/^[A-Za-z0-9_-]{20,100}$/', $value) ? $value : null;
}

/** Google Sheets is configured (spreadsheet + service-account key) in config.php. */
function cod_sheets_on(array $config): bool
{
    return cod_sheet_id((string)($config['spreadsheet_id'] ?? '')) !== null && (string)($config['service_account'] ?? '') !== '';
}

/**
 * Push queued orders (oldest first) in one append. Orders tried before are looked up in column A
 * first, so a push that timed out after Google wrote the rows never duplicates them.
 * Returns the number of orders written. $limit 0 = no limit.
 */
function cod_sync(array $env, int $limit): int
{
    $config = $env['config'];
    $sheetId = cod_sheet_id((string)($config['spreadsheet_id'] ?? ''));
    $account = (string)($config['service_account'] ?? '');
    if ($sheetId === null || $account === '' || !function_exists('curl_init')) {
        return 0;
    }
    $lock = @fopen($env['data'] . '/sync.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
        return 0; // another request is pushing right now
    }
    try {
        $files = (array)glob($env['data'] . '/pending/*.json');
        sort($files);
        $batch = [];
        $now = time();
        foreach ($files as $file) {
            $o = is_string($file) ? json_decode((string)@file_get_contents($file), true) : null;
            if (!is_array($o) || !isset($o['id'])) {
                continue;
            }
            if ((int)($o['next_try'] ?? 0) > $now) {
                continue;
            }
            $batch[$file] = $o;
            if ($limit > 0 && count($batch) >= $limit) {
                break;
            }
        }
        if (!$batch) {
            return 0;
        }
        require_once $env['dir'] . '/lib/gsheets.php';
        // claim: count the attempt before calling Google
        $retried = false;
        foreach ($batch as $file => $o) {
            $retried = $retried || (int)($o['attempts'] ?? 0) > 0;
            $batch[$file]['attempts'] = (int)($o['attempts'] ?? 0) + 1;
            @file_put_contents($file, (string)json_encode($batch[$file], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        }
        $tabFile = $env['data'] . '/sheet-tab.json';
        // everything that talks to Google (or reads the key) is retried with backoff when it fails:
        // a malformed key or a sheet not shared yet must not hammer the API on every order
        try {
            // a key file name is looked up in the private folder; JSON / base64 / absolute paths are used as is
            $local = $env['dir'] . DIRECTORY_SEPARATOR . $account;
            $sa = gs_load_service_account(strlen($account) < 200 && $account[0] !== '{' && is_file($local) ? $local : $account);
            $cache = $env['data'] . '/gs-token.json';
            $tabInfo = json_decode((string)@file_get_contents($tabFile), true);
            $tab = is_array($tabInfo) && ($tabInfo['sheet'] ?? '') === $sheetId && is_string($tabInfo['title'] ?? null) ? $tabInfo['title'] : null;
            if ($tab === null) {
                $wanted = cod_clean($config['sheet_tab'] ?? GS_TAB, 80);
                $tab = gs_ensure_tab($sa, $cache, $sheetId, $wanted !== '' ? $wanted : GS_TAB, (string)($config['currency'] ?? 'MAD'))['title'];
                @file_put_contents($tabFile, (string)json_encode(['sheet' => $sheetId, 'title' => $tab], JSON_UNESCAPED_UNICODE), LOCK_EX);
            }
            $existing = $retried ? gs_find_rows($sa, $cache, $sheetId, $tab) : [];
            $rows = [];
            $written = [];
            foreach ($batch as $file => $o) {
                $written[] = $file;
                if (isset($existing[$o['id']])) {
                    continue;
                }
                $rows[] = gs_order_row([
                    'id' => $o['id'],
                    'created_at' => (int)$o['created_at'],
                    'status' => 'new',
                    'name' => $o['name'],
                    'phone' => $o['phone_national'],
                    'city' => (string)$o['city'],
                    'address' => (string)$o['address'],
                    'product' => $o['product'],
                    'variant' => $o['variant_text'],
                    'qty' => $o['qty'],
                    'total' => $o['total'],
                    'note' => $o['sheet_note'],
                    'source' => $o['source'],
                    'tz' => (string)($config['timezone'] ?? 'Africa/Casablanca'),
                ]);
            }
            gs_append_rows($sa, $cache, $sheetId, $tab, $rows);
            foreach ($written as $file) {
                @unlink($file);
            }
            return count($rows);
        } catch (Throwable $e) {
            if ($e instanceof GsException && ($e->status === 400 || $e->status === 404)) {
                @unlink($tabFile); // tab renamed or deleted: look it up again next time
            }
            cod_log('sheets: ' . ($e instanceof GsException ? '' : get_class($e) . ': ') . $e->getMessage());
            foreach ($batch as $file => $o) {
                $o['next_try'] = time() + min(21600, 60 * (2 ** min(8, (int)$o['attempts'])));
                $o['error'] = cod_cut($e->getMessage(), 300);
                @file_put_contents($file, (string)json_encode($o, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
            }
            return 0;
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/** GET ?sync=1: push queued orders now. Public, so rate limited per IP; answers a count only. */
function cod_manual_sync(): void
{
    $env = cod_env();
    if ($env === null) {
        cod_respond(500, ['ok' => false, 'error' => 'server']);
        return;
    }
    try {
        $ipHash = hash_hmac('sha256', cod_ip_key(cod_client_ip($env['config'])), $env['config']['secret']);
        $wait = cod_rate($env, 'sync:' . $ipHash, 6, 600);
        if ($wait > 0) {
            cod_respond(429, ['ok' => false, 'error' => 'rate_limited'], ['Retry-After' => (string)$wait]);
            return;
        }
        cod_respond(200, ['ok' => true, 'synced' => cod_sync($env, 0)]);
    } catch (Throwable $e) {
        cod_log('sync: ' . get_class($e) . ': ' . $e->getMessage());
        cod_respond(500, ['ok' => false, 'error' => 'server']);
    }
}

/** Optional Telegram message to the merchant (bot token + chat id in config.php). */
function cod_telegram(array $env, array $o): void
{
    $config = $env['config'];
    $token = (string)($config['telegram_bot_token'] ?? '');
    $chat = (string)($config['telegram_chat_id'] ?? '');
    if (!preg_match('/^[0-9]{5,15}:[A-Za-z0-9_-]{20,80}$/', $token) || !preg_match('/^-?[0-9]{3,20}$|^@[A-Za-z0-9_]{4,64}$/', $chat) || !function_exists('curl_init')) {
        return;
    }
    $lines = ['Nouvelle commande ' . $o['id'], $o['product']];
    if ($o['variant_text'] !== '') {
        $lines[] = 'Variante : ' . $o['variant_text'];
    }
    $lines[] = 'Total : ' . $o['total'] . ' ' . $o['currency'];
    $lines[] = '';
    $lines[] = $o['name'] . ' · ' . $o['phone_national'];
    $where = implode(' — ', array_filter([(string)$o['city'], (string)$o['address']], 'strlen'));
    if ($where !== '') {
        $lines[] = $where;
    }
    if ($o['sheet_note'] !== '') {
        $lines[] = $o['sheet_note'];
    }
    $ch = curl_init('https://api.telegram.org/bot' . $token . '/sendMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['chat_id' => $chat, 'text' => cod_cut(implode("\n", $lines), 3500), 'disable_web_page_preview' => 'true']),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $res = curl_exec($ch);
    if ($res === false || (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE) !== 200) {
        cod_log('telegram: message not delivered');
    }
    if (PHP_VERSION_ID < 80000) {
        curl_close($ch);
    }
}
