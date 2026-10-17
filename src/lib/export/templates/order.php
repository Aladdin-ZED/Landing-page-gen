<?php
/**
 * order.php — order endpoint of a COD Studio static export ("PHP" mode).
 *
 * Requirements: PHP 8.1+ (syntax kept 7.3-compatible), ext-json, ext-mbstring; ext-curl + ext-openssl
 * for Google Sheets / Telegram; ext-intl optional (better text normalization).
 *
 * POST (same origin, JSON ≤ 24 KB) → the same OrderResponse JSON as the COD Studio API:
 *   {ok:true, orderId, total, currency}  |  {ok:false, error: invalid|duplicate|rate_limited|unavailable|server, fields?, orderId?}
 *
 *   1. payload checks (same rules as the app's parseOrderPayload: v1 payloads — no "v", "variants" —
 *      and v2 payloads — "v": 2, units with item / options / typed fields, extras, bump item),
 *      honeypot → decoy success, timing & user-agent flags
 *   2. file-based rate limits (per IP — IPv6 per /64 —, per phone) and idempotent replays; a page-wide
 *      surge never refuses clean orders, it marks them for review (and refuses only risky ones)
 *   3. the selection validated and priced exactly like the app (docs/OFFERS.md §G.2, §C.3): item
 *      choosers, options and combinations, line rules, typed fields, order extras, bump; integer
 *      cents from the page data below — what the browser sends is never trusted
 *   4. the order is appended to cod-private/data/orders.jsonl (your private backup) and, when Google
 *      Sheets is configured, queued for it
 *   5. after the answer: Google Sheets (service account) + optional Telegram message; failed pushes
 *      stay queued and are retried on the next orders (or GET order.php?sync=1). "Variante" is the
 *      warehouse order text (codes, [OFFERT] / [AJOUT], « typed values », "|| Commande : …"); the
 *      columns "SKU", "Articles", "Livraison", "Prix pack" are filled when you add those headers after
 *      column M (other columns you add are never touched)
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

/* Generated at export time — items, options, offers, prices (cents) and form rules of the exported page. */
const COD_SPEC_JSON = <<<'JSON'
{"v":0}
JSON;

const COD_MAX_BODY = 24576;
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
/* Order texts are capped (Sheets cells); ids and item ids of payloads (= the app's contract). */
const COD_TEXT_MAX = 1000;
const COD_ID_RE = '/^[A-Za-z0-9_-]{2,40}$/';
const COD_ITEM_RE = '/^[a-z0-9][a-z0-9-]{1,23}$/';
/* JavaScript's \s (and String.prototype.trim) as a PCRE class: text is cleaned exactly like the app. */
const COD_JS_SPACE = '[\t\n\x{000B}\f\r \x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]';

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// COD_TEST: the parity test (scripts/qa/php-parity.ts) loads the functions without serving a request
if (!defined('COD_TEST')) {
    cod_main();
}

/* ------------------------------------------------------------------ */
/* entry                                                               */
/* ------------------------------------------------------------------ */

function cod_main(): void
{
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $spec = json_decode(COD_SPEC_JSON, true);
    if (!is_array($spec) || ($spec['v'] ?? 0) !== 2) {
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

/** Length in UTF-16 code units (what the app's zod `.max()` counts). */
function cod_u16len(string $s): int
{
    if (function_exists('mb_convert_encoding')) {
        return intdiv(strlen((string)mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')), 2);
    }
    return cod_len($s);
}

function cod_cut(string $s, int $max): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $max, 'UTF-8');
    }
    return preg_match('/^.{0,' . $max . '}/us', $s, $m) ? $m[0] : '';
}

function cod_js_trim(string $s): string
{
    return (string)preg_replace('/^' . COD_JS_SPACE . '+|' . COD_JS_SPACE . '+$/u', '', $s);
}

/** Trim, NFC, drop control & bidi-override characters, collapse whitespace (= cleanInput in the app). */
function cod_clean($v, int $max): string
{
    return cod_cut(cod_clean_text($v), $max);
}

/** = cleanText (src/lib/page/options.ts): NFC, controls / bidi / zero-width → space, whitespace collapsed, trimmed. */
function cod_clean_text($v): string
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
    $s = (string)preg_replace('/' . COD_JS_SPACE . '+/u', ' ', $s);
    return cod_js_trim($s);
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

/* ------------------------------------------------------------------ */
/* payload (= parseOrderPayload in the app: dispatch on v, no union)   */
/* ------------------------------------------------------------------ */

function cod_is_list($v): bool
{
    return is_array($v) && ($v === [] || array_keys($v) === range(0, count($v) - 1));
}

/** A JSON object (record): an array whose keys are not 0..n-1 (an empty array counts as {}). */
function cod_is_record($v): bool
{
    return is_array($v) && ($v === [] || !cod_is_list($v));
}

/** JSON integer (2 and 2.0 alike, as in JavaScript). */
function cod_is_int($v): bool
{
    return is_int($v) || (is_float($v) && is_finite($v) && floor($v) === $v && abs($v) < 9007199254740992);
}

/**
 * One unit of a v2 payload ({ item?, o, f }) → [unit|null, issues]: `$issues` collects
 * [fieldKey|null, code] like the app's Zod issues (null = no field of its own).
 */
function cod_parse_unit($u, string $prefix, bool $withItem): array
{
    $issues = [];
    if (!cod_is_record($u)) {
        return [null, [[null, 'invalid']]];
    }
    $out = ['o' => [], 'f' => []];
    if ($withItem && array_key_exists('item', $u)) {
        if (!is_string($u['item']) || !preg_match(COD_ITEM_RE, $u['item'])) {
            $issues[] = [$prefix . '@item', 'invalid'];
        } else {
            $out['item'] = $u['item'];
        }
    } elseif (!$withItem && array_key_exists('item', $u) && (!is_string($u['item']) || !preg_match(COD_ITEM_RE, $u['item']))) {
        $issues[] = [null, 'invalid'];
    }
    foreach (['o' => 250, 'f' => 240] as $part => $max) {
        if (!array_key_exists($part, $u)) {
            continue;
        }
        if (!cod_is_record($u[$part])) {
            $issues[] = [null, 'invalid'];
            continue;
        }
        foreach ($u[$part] as $k => $v) {
            $k = (string)$k;
            if (!preg_match(COD_ID_RE, $k)) {
                $issues[] = [null, 'invalid'];
                continue;
            }
            if (!is_string($v)) {
                $issues[] = [$prefix . $k, 'invalid'];
            } elseif (cod_u16len($v) > $max) {
                $issues[] = [$prefix . $k, 'too_long'];
            } else {
                $out[$part][$k] = $v;
            }
        }
    }
    if (!$issues && (count($out['o']) > 8 || count($out['f']) > 4)) {
        $issues[] = [null, 'invalid'];
    }
    return [$issues ? null : $out, $issues];
}

/**
 * Shape checks mirroring parseOrderPayload: `v` absent → v1 (`variants`), `v === 2` → v2 (`units`,
 * `extras`, `b`, `ver`, `st`), anything else → invalid. Returns [payload, fieldErrors]: payload
 * null when anything is wrong (fieldErrors then holds the keys the form can mark, maybe none).
 */
function cod_parse_payload($raw): array
{
    if (!is_array($raw) || cod_is_list($raw)) {
        return [null, []];
    }
    $fields = [];
    $bad = false;
    $issue = function ($key, string $code) use (&$fields, &$bad) {
        $bad = true;
        if ($key !== null && !isset($fields[$key])) {
            $fields[$key] = $code;
        }
    };
    if (array_key_exists('v', $raw)) {
        if (!(cod_is_int($raw['v']) && (int)$raw['v'] === 2)) {
            return [null, []];
        }
        $version = 2;
    } else {
        $version = 1;
    }
    $p = ['v' => $version];
    foreach ([['pageKey', '/^[a-zA-Z0-9_-]{8,80}$/'], ['idem', '/^[a-f0-9-]{36}$/'], ['eventId', '/^[a-zA-Z0-9_-]{8,64}$/']] as $rule) {
        $v = $raw[$rule[0]] ?? null;
        if (!is_string($v) || !preg_match($rule[1], $v)) {
            $issue(null, 'invalid');
            $v = '';
        }
        $p[$rule[0]] = $v;
    }
    $bundle = $raw['bundleId'] ?? null;
    if (!is_string($bundle) || !preg_match('/^[a-zA-Z0-9_-]{2,40}$/', $bundle)) {
        $issue('bundleId', 'invalid');
        $bundle = '';
    }
    $p['bundleId'] = $bundle;
    $bump = array_key_exists('bump', $raw) ? $raw['bump'] : false;
    if (!is_bool($bump)) {
        $issue(null, 'invalid');
        $bump = false;
    }
    $p['bump'] = $bump;

    // text fields: trimmed, then capped (UTF-16 units, as zod counts)
    $text = function (string $key, int $max, bool $required, int $min = 0) use ($raw, $issue): string {
        if (!array_key_exists($key, $raw)) {
            if ($required) {
                $issue($key === 'note' ? null : $key, 'invalid');
            }
            return '';
        }
        $v = $raw[$key];
        if (!is_string($v)) {
            $issue($key === 'note' ? null : $key, 'invalid');
            return '';
        }
        $v = cod_js_trim($v);
        if (cod_u16len($v) > $max) {
            $issue($key === 'note' ? null : $key, 'too_long');
            return '';
        }
        if (cod_u16len($v) < $min) {
            $issue($key, 'invalid');
            return '';
        }
        return $v;
    };
    $p['name'] = $text('name', 80, true, 2);
    $p['phone'] = $text('phone', 24, true, 6);
    $p['city'] = $text('city', 80, false);
    $p['address'] = $text('address', 240, false);
    $p['note'] = $text('note', 300, false);
    $email = array_key_exists('email', $raw) ? $raw['email'] : '';
    if (!is_string($email)) {
        $issue('email', 'invalid');
        $email = '';
    }
    $email = cod_js_trim($email);
    if ($email !== '' && (cod_u16len($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
        $issue('email', 'invalid');
    }
    $p['email'] = $email;
    $t = $raw['t'] ?? null;
    if (!cod_is_int($t) || $t < 0 || $t > 86400000) {
        $issue(null, 'invalid');
        $t = 0;
    }
    $p['t'] = (int)$t;

    if ($version === 1) {
        // a v2-shaped body without `v` never parses as v1
        if (array_key_exists('units', $raw) || array_key_exists('extras', $raw)) {
            return [null, []];
        }
        $variants = array_key_exists('variants', $raw) ? $raw['variants'] : [];
        if (!cod_is_list($variants) || count($variants) > 20) {
            $issue(null, 'invalid');
            $variants = [];
        }
        $p['variants'] = [];
        foreach ($variants as $unit) {
            if (!cod_is_record($unit)) {
                $issue(null, 'invalid');
                continue;
            }
            $clean = [];
            foreach ($unit as $k => $v) {
                $k = (string)$k;
                if (!is_string($v) || cod_u16len($k) > 40 || cod_u16len($v) > 40) {
                    $issue(null, 'invalid');
                    continue;
                }
                $clean[$k] = $v;
            }
            $p['variants'][] = $clean;
        }
    } else {
        $ver = $raw['ver'] ?? null;
        if (array_key_exists('ver', $raw) && (!is_string($ver) || !preg_match('/^[A-Za-z0-9]{26}$/', $ver))) {
            $issue(null, 'invalid');
        }
        $st = $raw['st'] ?? null;
        if (!cod_is_int($st) || $st < 0 || $st > 1000000000) {
            $issue(null, 'invalid');
            $st = 0;
        }
        $p['st'] = (int)$st;
        $units = array_key_exists('units', $raw) ? $raw['units'] : [];
        if (!cod_is_list($units) || count($units) > 20) {
            $issue(null, 'invalid');
            $units = [];
        }
        $p['units'] = [];
        foreach ($units as $k => $u) {
            list($unit, $issues) = cod_parse_unit($u, 'u.' . $k . '.', true);
            foreach ($issues as $is) {
                $issue($is[0], $is[1]);
            }
            $p['units'][] = $unit ?? ['o' => [], 'f' => []];
        }
        $extras = array_key_exists('extras', $raw) ? $raw['extras'] : [];
        $p['extras'] = [];
        if (!cod_is_record($extras)) {
            $issue(null, 'invalid');
        } else {
            foreach ($extras as $k => $v) {
                $k = (string)$k;
                if (!preg_match(COD_ID_RE, $k)) {
                    $issue(null, 'invalid');
                } elseif (!is_string($v)) {
                    $issue('x.' . $k, 'invalid');
                } elseif (cod_u16len($v) > 240) {
                    $issue('x.' . $k, 'too_long');
                } else {
                    $p['extras'][$k] = $v;
                }
            }
            if (count($p['extras']) > 4) {
                $issue(null, 'invalid');
            }
        }
        if (array_key_exists('b', $raw)) {
            list($b, $issues) = cod_parse_unit($raw['b'], 'b.', false);
            foreach ($issues as $is) {
                $issue($is[0], $is[1]);
            }
            if ($b !== null) {
                $p['b'] = $b;
            }
        }
    }

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
    return [$bad ? null : $p, $fields];
}

/** v1 → v2 view (= toSelectionInput): units[u] = { o: variants[u] ?? variants[0] ?? {}, f: {} }. */
function cod_selection_input(array $p): array
{
    if ($p['v'] === 2) {
        return ['offerId' => $p['bundleId'], 'units' => $p['units'], 'extras' => $p['extras'], 'bump' => $p['bump'], 'b' => $p['b'] ?? null];
    }
    $units = [];
    for ($u = 0; $u < 20; $u++) {
        $units[] = ['o' => $p['variants'][$u] ?? ($p['variants'][0] ?? []), 'f' => []];
    }
    return ['offerId' => $p['bundleId'], 'units' => $units, 'extras' => [], 'bump' => $p['bump'], 'b' => null];
}

/* ------------------------------------------------------------------ */
/* options (= src/lib/page/options.ts)                                  */
/* ------------------------------------------------------------------ */

function cod_find(array $list, $id): ?array
{
    if (!is_string($id) || $id === '') {
        return null;
    }
    foreach ($list as $x) {
        if ($x['id'] === $id) {
            return $x;
        }
    }
    return null;
}

/** Does a line rule let this value through? (lock: only it; allow: the list; preset: everything) */
function cod_rule_allows(?array $rule, string $id): bool
{
    if ($rule === null) {
        return true;
    }
    if (array_key_exists('lock', $rule)) {
        return $rule['lock'] === $id;
    }
    if (array_key_exists('allow', $rule)) {
        return in_array($id, $rule['allow'], true);
    }
    return true;
}

function cod_rule_lock(?array $rule): ?string
{
    return $rule !== null && isset($rule['lock']) && is_string($rule['lock']) ? $rule['lock'] : null;
}

/** "d-col=o-noir|d-size=o-m" (any order) → ['d-col' => 'o-noir', …]; null when malformed or a dim repeats. */
function cod_parse_cell_key(string $key): ?array
{
    if ($key === '' || strlen($key) > 250) {
        return null;
    }
    $out = [];
    foreach (explode('|', $key) as $part) {
        if (!preg_match('/^([A-Za-z0-9_-]{2,40})=([A-Za-z0-9_-]{2,40})$/', $part, $m) || array_key_exists($m[1], $out)) {
            return null;
        }
        $out[$m[1]] = $m[2];
    }
    return $out;
}

/** Canonical key: entries sorted by dim id. */
function cod_cell_key(array $combo): string
{
    ksort($combo, SORT_STRING);
    $parts = [];
    foreach ($combo as $d => $v) {
        $parts[] = $d . '=' . $v;
    }
    return implode('|', $parts);
}

/** Every combination of a matrix, dims in order. */
function cod_all_combos(array $g): array
{
    $out = [[]];
    foreach ($g['dims'] as $d) {
        $next = [];
        foreach ($out as $c) {
            foreach ($d['values'] as $v) {
                $next[] = $c + [$d['id'] => $v['id']];
            }
        }
        $out = $next;
    }
    return $out;
}

/**
 * A complete combination (= resolveCombo): state none > out > in, delta (cents) and sku from the
 * most specific matching cell that defines them (tie → first), else Σ value deltas / item sku.
 */
function cod_resolve_combo(array $g, array $combo, array $item): ?array
{
    $values = [];
    foreach ($g['dims'] as $d) {
        $id = $combo[$d['id']] ?? null;
        $v = $id === null ? null : cod_find($d['values'], $id);
        if ($v === null) {
            return null;
        }
        $values[] = ['dim' => $d, 'value' => $v];
    }
    if (count($combo) !== count($g['dims'])) {
        return null;
    }
    $severity = ['in' => 0, 'out' => 1, 'none' => 2];
    $state = 'in';
    foreach ($values as $x) {
        if (!empty($x['value']['soldOut'])) {
            $state = 'out';
        }
    }
    $matching = [];
    foreach ($g['cells'] as $at => $cell) {
        $v = (array)$cell['v'];
        if (!$v) {
            continue;
        }
        $all = true;
        foreach ($v as $dim => $val) {
            if (($combo[$dim] ?? null) !== $val) {
                $all = false;
                break;
            }
        }
        if ($all) {
            $matching[] = ['cell' => $cell, 'size' => count($v), 'at' => $at];
        }
    }
    foreach ($matching as $m) {
        if ($severity[$m['cell']['state']] > $severity[$state]) {
            $state = $m['cell']['state'];
        }
    }
    usort($matching, function ($a, $b) {
        return $b['size'] - $a['size'] ?: $a['at'] - $b['at'];
    });
    $delta = null;
    $sku = null;
    foreach ($matching as $m) {
        if ($delta === null && array_key_exists('delta', $m['cell'])) {
            $delta = (int)$m['cell']['delta'];
        }
        if ($sku === null && isset($m['cell']['sku']) && (string)$m['cell']['sku'] !== '') {
            $sku = (string)$m['cell']['sku'];
        }
    }
    $fromCell = $delta !== null;
    if ($delta === null) {
        $delta = 0;
        foreach ($values as $x) {
            $delta += (int)$x['value']['delta'];
        }
    }
    if ($sku === null && isset($item['sku']) && (string)$item['sku'] !== '') {
        $sku = (string)$item['sku'];
    }
    return ['key' => cod_cell_key($combo), 'state' => $state, 'delta' => $delta, 'fromCell' => $fromCell, 'sku' => $sku, 'values' => $values];
}

/** Rules of a line for one matrix group, keyed by dim id. */
function cod_dim_rules(array $g, ?array $rules): array
{
    $out = [];
    foreach ($g['dims'] as $d) {
        $k = $g['id'] . '.' . $d['id'];
        if ($rules !== null && isset($rules[$k])) {
            $out[$d['id']] = $rules[$k];
        }
    }
    return $out;
}

/** The orderable combinations of a matrix under a line's rules. */
function cod_available_combos(array $g, ?array $rules, array $item): array
{
    $r = !empty($g['perUnit']) ? cod_dim_rules($g, $rules) : [];
    $out = [];
    foreach (cod_all_combos($g) as $combo) {
        foreach ($g['dims'] as $d) {
            if (!cod_rule_allows($r[$d['id']] ?? null, $combo[$d['id']])) {
                continue 2;
            }
        }
        $res = cod_resolve_combo($g, $combo, $item);
        if ($res !== null && $res['state'] === 'in') {
            $out[] = $res;
        }
    }
    return $out;
}

/** A choice group (= resolveChoice): lock = the server's value, allow = subset, a lone available option filled in. */
function cod_resolve_choice(array $g, string $wanted, ?array $rule): array
{
    $lock = cod_rule_lock($rule);
    if ($lock !== null) {
        $o = cod_find($g['options'], $lock);
        return $o === null ? ['error' => 'invalid'] : (!empty($o['soldOut']) ? ['error' => 'unavailable'] : ['value' => $lock]);
    }
    if ($wanted === '') {
        $avail = [];
        foreach ($g['options'] as $o) {
            if (cod_rule_allows(!empty($g['perUnit']) ? $rule : null, $o['id']) && empty($o['soldOut'])) {
                $avail[] = $o;
            }
        }
        return count($avail) === 1 ? ['value' => $avail[0]['id']] : ['error' => 'required'];
    }
    $o = cod_find($g['options'], $wanted);
    if ($o === null || !cod_rule_allows($rule, $o['id'])) {
        return ['error' => 'invalid'];
    }
    return !empty($o['soldOut']) ? ['error' => 'unavailable'] : ['value' => $o['id']];
}

/** A matrix value "dim=value|dim=value" + the line's dim rules → a canonical cell key (= resolveMatrix). */
function cod_resolve_matrix(array $g, array $item, string $raw, ?array $rules): array
{
    $r = !empty($g['perUnit']) ? cod_dim_rules($g, $rules) : [];
    $combo = [];
    if ($raw !== '') {
        $parsed = cod_parse_cell_key($raw);
        if ($parsed === null) {
            return ['error' => 'invalid'];
        }
        foreach ($parsed as $dim => $value) {
            $d = cod_find($g['dims'], $dim);
            if ($d === null || cod_find($d['values'], $value) === null) {
                return ['error' => 'invalid'];
            }
        }
        $combo = $parsed;
    }
    foreach ($g['dims'] as $d) {
        $lock = cod_rule_lock($r[$d['id']] ?? null);
        if ($lock !== null) {
            $combo[$d['id']] = $lock;
        } elseif (isset($combo[$d['id']]) && !cod_rule_allows($r[$d['id']] ?? null, $combo[$d['id']])) {
            return ['error' => 'invalid'];
        }
    }
    $missing = [];
    foreach ($g['dims'] as $d) {
        if (!isset($combo[$d['id']])) {
            $missing[] = $d;
        }
    }
    if ($missing) {
        $fits = [];
        foreach (cod_available_combos($g, !empty($g['perUnit']) ? $rules : null, $item) as $c) {
            $ok = true;
            foreach ($c['values'] as $x) {
                if (isset($combo[$x['dim']['id']]) && $combo[$x['dim']['id']] !== $x['value']['id']) {
                    $ok = false;
                    break;
                }
            }
            if ($ok) {
                $fits[] = $c;
            }
        }
        $fill = [];
        foreach ($missing as $d) {
            $ids = [];
            foreach ($fits as $c) {
                foreach ($c['values'] as $x) {
                    if ($x['dim']['id'] === $d['id']) {
                        $ids[$x['value']['id']] = true;
                    }
                }
            }
            if (count($ids) === 1) {
                $fill[$d['id']] = (string)array_keys($ids)[0];
            }
        }
        $combo = $combo + $fill;
    }
    foreach ($g['dims'] as $d) {
        if (!isset($combo[$d['id']])) {
            return ['error' => 'required'];
        }
    }
    $res = cod_resolve_combo($g, $combo, $item);
    if ($res === null || $res['state'] === 'none') {
        return ['error' => 'invalid'];
    }
    return $res['state'] === 'out' ? ['error' => 'unavailable'] : ['value' => $res['key']];
}

/** Eastern Arabic "٠-٩" and Persian "۰-۹" digits → "0-9". */
function cod_fold_digits(string $s): string
{
    return strtr($s, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);
}

/** A typed value (= checkField): clean → fold digits → required → "<>" → length → charset / range. */
function cod_check_field(array $g, $raw): array
{
    $value = is_string($raw) || is_int($raw) || is_float($raw) ? cod_clean_text($raw) : '';
    if ($g['input'] === 'number' || $g['charset'] === 'digits') {
        $value = cod_fold_digits($value);
    }
    if ($value === '') {
        return !empty($g['required']) ? ['error' => 'required'] : ['value' => ''];
    }
    if (preg_match('/[<>]/', $value)) {
        return ['error' => 'invalid'];
    }
    if (cod_len($value) > (int)$g['maxLength']) {
        return ['error' => 'too_long'];
    }
    if ($g['input'] === 'number') {
        if (!preg_match('/^[0-9]{1,7}$/', $value)) {
            return ['error' => 'invalid'];
        }
        $n = (int)$value;
        if ($n < (int)($g['min'] ?? 0) || $n > (int)($g['max'] ?? 1000000)) {
            return ['error' => 'invalid'];
        }
        return ['value' => $value];
    }
    $charsets = [
        'letters' => '/^[\p{L}\p{M}][\p{L}\p{M} \'’.\-]*$/u',
        'latin' => '/^[A-Za-z\x{C0}-\x{D6}\x{D8}-\x{F6}\x{F8}-\x{FF}0-9 \'’.\-&]+$/u',
        'digits' => '/^[0-9]+$/',
    ];
    if ($g['charset'] !== 'any' && (!isset($charsets[$g['charset']]) || !preg_match($charsets[$g['charset']], $value))) {
        return ['error' => 'invalid'];
    }
    return ['value' => $value];
}

/** One group of a unit / the bump / an extra against its input (= resolveGroup). */
function cod_resolve_group(array $g, ?array $item, ?array $src, ?array $rules): array
{
    $o = $src !== null && isset($src['o'][$g['id']]) && is_string($src['o'][$g['id']]) ? $src['o'][$g['id']] : '';
    if ($g['kind'] === 'choice') {
        $r = cod_resolve_choice($g, $o, !empty($g['perUnit']) && $rules !== null && isset($rules[$g['id']]) ? $rules[$g['id']] : null);
        return $r;
    }
    if ($g['kind'] === 'matrix') {
        return cod_resolve_matrix($g, (array)$item, $o, $rules);
    }
    $r = cod_check_field($g, $src !== null && array_key_exists($g['id'], $src['f']) ? $src['f'][$g['id']] : null);
    if (isset($r['error'])) {
        return $r;
    }
    return $r['value'] !== '' ? ['field' => $r['value']] : [];
}

/* ------------------------------------------------------------------ */
/* order text (= src/lib/orders/text.ts, warehouse rendering)          */
/* ------------------------------------------------------------------ */

/** One line of text, no control characters (= oneLine). */
function cod_one_line(string $s): string
{
    $s = (string)preg_replace('/[\x{0000}-\x{001F}\x{007F}-\x{009F}]/u', ' ', $s);
    return cod_js_trim((string)preg_replace('/' . COD_JS_SPACE . '+/u', ' ', $s));
}

/** Owner labels: the separators of the grammar can never appear inside one (= sanitizeLabel). */
function cod_label(string $s): string
{
    $s = cod_one_line($s);
    $s = str_replace(' + ', ' & ', $s);
    $s = str_replace('/', '-', $s);
    $s = (string)preg_replace('/\|{2,}/', '|', $s);
    $s = str_replace(' · ', ' - ', $s);
    return str_replace(['«', '»'], '"', $s);
}

/** A typed value in « » (= quoteValue). */
function cod_quote(string $s): string
{
    return '« ' . str_replace(['«', '»'], '"', cod_one_line($s)) . ' »';
}

/** Cents → "15", "15.5", "15.25" (= String(Math.round(n * 100) / 100)). */
function cod_plain(int $cents): string
{
    $sign = $cents < 0 ? '-' : '';
    $c = abs($cents);
    $s = (string)intdiv($c, 100);
    $r = $c % 100;
    if ($r !== 0) {
        $s .= '.' . rtrim(sprintf('%02d', $r), '0');
    }
    return $sign . $s;
}

/** Cents → the JSON money the app answers (349 / 349.5). */
function cod_money($cents)
{
    $c = (int)$cents;
    return $c % 100 === 0 ? intdiv($c, 100) : $c / 100;
}

/** The stored snapshot of one resolved unit (= orderUnitOf): labels, codes, sku, deltas on paid units. */
function cod_unit_snapshot(array $item, array $choice, bool $free): array
{
    $options = [];
    $fields = [];
    $sku = isset($item['sku']) && $item['sku'] !== '' ? (string)$item['sku'] : null;
    foreach ($item['groups'] as $g) {
        if ($g['kind'] === 'choice') {
            $o = cod_find($g['options'], $choice['options'][$g['id']] ?? null);
            if ($o === null) {
                continue;
            }
            $opt = ['name' => $g['label'], 'value' => $o['text']];
            if (isset($o['code'])) {
                $opt['code'] = $o['code'];
            }
            if (!$free && (int)$o['delta'] > 0) {
                $opt['delta'] = cod_money($o['delta']);
            }
            $options[] = $opt;
        } elseif ($g['kind'] === 'matrix') {
            $key = $choice['options'][$g['id']] ?? '';
            $combo = $key !== '' ? cod_parse_cell_key($key) : null;
            $res = $combo !== null ? cod_resolve_combo($g, $combo, $item) : null;
            if ($res === null) {
                continue;
            }
            $value = [];
            $code = [];
            $coded = false;
            foreach ($res['values'] as $x) {
                $value[] = $x['value']['text'];
                $code[] = $x['value']['ctext'];
                $coded = $coded || isset($x['value']['code']);
            }
            $opt = ['name' => $g['label'], 'value' => implode('/', $value)];
            if ($coded) {
                $opt['code'] = implode('/', $code);
            }
            if (!$free && $res['delta'] > 0) {
                $opt['delta'] = cod_money($res['delta']);
            }
            $options[] = $opt;
            if ($res['sku'] !== null) {
                $sku = $res['sku'];
            }
        } else {
            $v = $choice['fields'][$g['id']] ?? '';
            if ($v !== '') {
                $f = ['name' => $g['label'], 'value' => cod_one_line($v)];
                if (!$free && (int)$g['delta'] > 0) {
                    $f['delta'] = cod_money($g['delta']);
                }
                $fields[] = $f;
            }
        }
    }
    $u = ['item' => $item['id'], 'label' => (string)$item['label']];
    if (isset($item['short'])) {
        $u['short'] = $item['short'];
    }
    if ($sku !== null) {
        $u['sku'] = $sku;
    }
    if ($free) {
        $u['free'] = true;
    }
    $u['options'] = $options;
    if ($fields) {
        $u['fields'] = $fields;
    }
    return $u;
}

function cod_pieces(int $n): string
{
    return $n . ' pièce' . ($n > 1 ? 's' : '');
}

/** [count][label][ (values)][ · fields] — "" when there is nothing to say (= partBody, warehouse). */
function cod_part_body(array $u, int $n, bool $multi): string
{
    $values = [];
    foreach ($u['options'] as $o) {
        $v = (string)($o['code'] ?? $o['value']);
        if ($v !== '') {
            $values[] = $v;
        }
    }
    $fields = [];
    foreach ($u['fields'] ?? [] as $f) {
        if ($f['value'] !== '') {
            $fields[] = $f['name'] . ' ' . cod_quote($f['value']);
        }
    }
    $label = $multi ? cod_label((string)($u['short'] ?? '') !== '' ? (string)$u['short'] : (string)$u['label']) : '';
    if ($label === '' && !$values && !$fields) {
        return '';
    }
    $s = $multi || $n > 1 ? $n . ' × ' : '';
    if ($label !== '') {
        $s .= $label . ($values ? ' (' . implode('/', $values) . ')' : '');
    } else {
        $s .= implode('/', $values);
    }
    if ($fields) {
        $s .= ($label !== '' || $values ? ' · ' : '') . implode(', ', $fields);
    }
    return cod_js_trim($s);
}

function cod_marked_part(string $marker, array $u, int $n, bool $multi): string
{
    $body = cod_part_body($u, $n, $multi);
    return $marker . ' ' . ($body !== '' ? $body : cod_pieces($n));
}

/** The order text (= unitsText(…, "warehouse")): units, gift, bump, extras segment, capped at $max code points. */
function cod_units_text(array $units, bool $multi, ?string $gift, ?array $bumpUnit, array $extras, string $orderId, int $max = COD_TEXT_MAX): string
{
    $groups = [];
    foreach ($units as $u) {
        $opts = [];
        foreach ($u['options'] as $o) {
            $opts[] = [$o['name'], (string)($o['code'] ?? $o['value'])];
        }
        $flds = [];
        foreach ($u['fields'] ?? [] as $f) {
            $flds[] = [$f['name'], $f['value']];
        }
        $key = json_encode([!empty($u['free']), $u['item'], (string)($u['short'] ?? ''), $u['label'], $opts, $flds], JSON_UNESCAPED_UNICODE);
        if (isset($groups[$key])) {
            $groups[$key]['n']++;
        } else {
            $groups[$key] = ['unit' => $u, 'n' => 1];
        }
    }
    $unitParts = [];
    foreach ($groups as $g) {
        $text = !empty($g['unit']['free']) ? cod_marked_part('[OFFERT]', $g['unit'], $g['n'], $multi) : cod_part_body($g['unit'], $g['n'], $multi);
        if ($text !== '') {
            $unitParts[] = ['text' => $text, 'n' => $g['n']];
        }
    }
    $fixed = [];
    if ($gift !== null && $gift !== '') {
        $fixed[] = 'CADEAU : ' . cod_label($gift);
    }
    if ($bumpUnit !== null) {
        $fixed[] = cod_marked_part('[AJOUT]', $bumpUnit, 1, true);
    }
    $segs = [];
    foreach ($extras as $x) {
        if ($x['value'] === '') {
            continue;
        }
        $v = !empty($x['typed']) ? cod_quote($x['value']) : cod_label((string)($x['code'] ?? $x['value']));
        $segs[] = cod_label($x['name']) . ' = ' . $v . (!empty($x['delta']) ? ' (+' . cod_plain((int)$x['delta']) . ')' : '');
    }
    $segment = $segs ? ' || Commande : ' . implode('; ', $segs) : '';
    $join = function (array $parts): string {
        return implode(' + ', array_values(array_filter($parts, 'strlen')));
    };
    $kept = count($unitParts);
    $all = [];
    foreach ($unitParts as $p) {
        $all[] = $p['text'];
    }
    $text = $join(array_merge($all, $fixed)) . $segment;
    while (cod_len($text) > $max && $kept > 0) {
        $kept--;
        $dropped = 0;
        for ($i = $kept; $i < count($unitParts); $i++) {
            $dropped += $unitParts[$i]['n'];
        }
        $head = array_slice($all, 0, $kept);
        $more = ' … (+' . $dropped . ($orderId !== '' ? ', voir ' . $orderId : '') . ')';
        $text = ($head ? $join(array_merge([implode(' + ', $head) . $more], $fixed)) : $join(array_merge([trim($more)], $fixed))) . $segment;
    }
    return $text;
}

/* ------------------------------------------------------------------ */
/* selection, prices (= resolveSelection, orderTotals; integer cents)  */
/* ------------------------------------------------------------------ */

function cod_bump_offered(array $spec, string $offerId): bool
{
    $b = $spec['bump'] ?? null;
    return is_array($b) && (!isset($b['offers']) || in_array($offerId, $b['offers'], true));
}

/**
 * The units, extras and bump of an order against the offer. Returns ['units' => choices per slot,
 * 'snaps' => snapshots of the resolved units, 'extras' => id → value, 'bump' => bool,
 * 'bumpChoice' => ?, 'bumpUnit' => ?, 'errors' => [[key, code, gi, k], …]].
 */
function cod_resolve_selection(array $spec, array $offer, array $in): array
{
    $items = [];
    foreach ($spec['items'] as $it) {
        $items[$it['id']] = $it;
    }
    $errors = [];
    $units = [];
    $snaps = [];
    $firstOf = [];
    $chosenInLine = [];
    foreach ($offer['units'] as $k => $slot) {
        $u = $in['units'][$k] ?? null;
        $itemId = $slot['item'];
        if ($itemId === null) {
            $wanted = is_array($u) && isset($u['item']) && is_string($u['item']) ? $u['item'] : '';
            $available = $slot['available'] ?? [];
            $error = null;
            if ($wanted === '') {
                if (count($available) === 1) {
                    $itemId = $available[0];
                } else {
                    $error = $available ? 'required' : 'unavailable';
                }
            } elseif (!in_array($wanted, $slot['choices'] ?? [], true)) {
                $error = 'invalid';
            } elseif (!in_array($wanted, $available, true)) {
                $error = 'unavailable';
            } elseif (!empty($slot['distinct']) && isset($chosenInLine[$slot['line']][$wanted])) {
                $error = 'duplicate';
            } else {
                $itemId = $wanted;
            }
            if ($error !== null) {
                $errors[] = ['u.' . $k . '.@item', $error, -1, $k];
                $units[$k] = ['item' => $wanted, 'options' => [], 'fields' => []];
                continue;
            }
            $chosenInLine[$slot['line']][$itemId] = true;
        }
        $item = $items[$itemId];
        if (!isset($firstOf[$item['id']])) {
            $firstOf[$item['id']] = $k;
        }
        $k0 = $firstOf[$item['id']];
        $choice = ['item' => $item['id'], 'options' => [], 'fields' => []];
        $ok = true;
        foreach ($item['groups'] as $gi => $g) {
            if (empty($g['perUnit']) && $k !== $k0) {
                // shared group: one value for every unit of this item (resolved on its first unit)
                $first = $units[$k0] ?? null;
                if ($first !== null && isset($first['options'][$g['id']])) {
                    $choice['options'][$g['id']] = $first['options'][$g['id']];
                }
                if ($first !== null && isset($first['fields'][$g['id']])) {
                    $choice['fields'][$g['id']] = $first['fields'][$g['id']];
                }
                continue;
            }
            $src = !empty($g['perUnit']) ? $u : ($in['units'][$k0] ?? null);
            $key = !empty($g['perUnit']) ? 'u.' . $k . '.' . $g['id'] : 's.' . $item['id'] . '.' . $g['id'];
            $r = cod_resolve_group($g, $item, is_array($src) ? $src : null, !empty($g['perUnit']) ? $slot['rules'] : null);
            if (isset($r['error'])) {
                $ok = false;
                $errors[] = [$key, $r['error'], $gi, !empty($g['perUnit']) ? $k : -1];
                continue;
            }
            if (isset($r['value'])) {
                $choice['options'][$g['id']] = $r['value'];
            }
            if (isset($r['field'])) {
                $choice['fields'][$g['id']] = $r['field'];
            }
        }
        $units[$k] = $choice;
        if ($ok) {
            $snaps[] = cod_unit_snapshot($item, $choice, !empty($slot['free']));
        }
    }

    // order extras whose scope holds the offer (others ignored)
    $extras = [];
    foreach ($spec['extras'] as $xi => $x) {
        if ($x['scope'] !== 'all' && !in_array($offer['id'], (array)$x['scope'], true)) {
            continue;
        }
        $value = isset($in['extras'][$x['id']]) && is_string($in['extras'][$x['id']]) ? $in['extras'][$x['id']] : '';
        $r = cod_resolve_group($x, null, ['o' => [$x['id'] => $value], 'f' => [$x['id'] => $value]], null);
        if (isset($r['error'])) {
            $errors[] = ['x.' . $x['id'], $r['error'], 1000 + $xi, -1];
        } elseif (isset($r['value'])) {
            $extras[$x['id']] = $r['value'];
        } elseif (isset($r['field'])) {
            $extras[$x['id']] = $r['field'];
        }
    }

    // bump: a catalog item collects its options (perUnit ignored, no rules); they never add money
    $bump = !empty($in['bump']) && cod_bump_offered($spec, $offer['id']);
    $bumpChoice = null;
    $bumpUnit = null;
    $bumpItemId = $bump ? ($spec['bump']['item'] ?? null) : null;
    if ($bumpItemId !== null && isset($items[$bumpItemId])) {
        $bumpItem = $items[$bumpItemId];
        $bumpChoice = ['item' => $bumpItem['id'], 'options' => [], 'fields' => []];
        $ok = true;
        foreach ($bumpItem['groups'] as $gi => $g) {
            $g['perUnit'] = true;
            $r = cod_resolve_group($g, $bumpItem, $in['b'] ?? null, null);
            if (isset($r['error'])) {
                $ok = false;
                $errors[] = ['b.' . $g['id'], $r['error'], 2000 + $gi, -1];
                continue;
            }
            if (isset($r['value'])) {
                $bumpChoice['options'][$g['id']] = $r['value'];
            }
            if (isset($r['field'])) {
                $bumpChoice['fields'][$g['id']] = $r['field'];
            }
        }
        if ($ok) {
            $bumpUnit = cod_unit_snapshot($bumpItem, $bumpChoice, true);
            unset($bumpUnit['free']);
        }
    }
    return ['units' => $units, 'snaps' => $snaps, 'extras' => $extras, 'bump' => $bump, 'bumpChoice' => $bumpChoice, 'bumpUnit' => $bumpUnit, 'errors' => $errors];
}

/**
 * Surcharges of a resolved selection in cents (= selectionDeltas): options and fields per paid unit
 * (a shared field once per item), choice-line differences, order extras. Also the reason rows.
 */
function cod_deltas(array $spec, array $offer, array $sel): array
{
    $items = [];
    foreach ($spec['items'] as $it) {
        $items[$it['id']] = $it;
    }
    $total = 0;
    $reasons = [];
    $add = function (string $key, string $label, int $c) use (&$total, &$reasons) {
        if ($c <= 0) {
            return;
        }
        $total += $c;
        if (isset($reasons[$key])) {
            $reasons[$key]['count']++;
            $reasons[$key]['cents'] += $c;
        } else {
            $reasons[$key] = ['label' => $label, 'count' => 1, 'cents' => $c];
        }
    };
    $shared = [];
    foreach ($offer['units'] as $k => $slot) {
        if (!empty($slot['free'])) {
            continue;
        }
        $unit = $sel['units'][$k] ?? null;
        $id = $slot['item'] ?? ($unit['item'] ?? '');
        if ($unit === null || !isset($items[$id])) {
            continue;
        }
        $it = $items[$id];
        foreach ($it['groups'] as $g) {
            if ($g['kind'] === 'choice') {
                $o = cod_find($g['options'], $unit['options'][$g['id']] ?? null);
                if ($o !== null && (int)$o['delta'] > 0) {
                    $add('o:' . $it['id'] . ':' . $g['id'] . ':' . $o['id'], $o['label'], (int)$o['delta']);
                }
            } elseif ($g['kind'] === 'matrix') {
                $key = $unit['options'][$g['id']] ?? '';
                $combo = $key !== '' ? cod_parse_cell_key($key) : null;
                $res = $combo !== null ? cod_resolve_combo($g, $combo, $it) : null;
                if ($res === null || $res['delta'] <= 0) {
                    continue;
                }
                if ($res['fromCell']) {
                    $labels = [];
                    foreach ($res['values'] as $x) {
                        $labels[] = $x['value']['label'];
                    }
                    $add('m:' . $it['id'] . ':' . $g['id'] . ':' . $res['key'], implode('/', $labels), $res['delta']);
                } else {
                    foreach ($res['values'] as $x) {
                        if ((int)$x['value']['delta'] > 0) {
                            $add('m:' . $it['id'] . ':' . $g['id'] . ':' . $x['dim']['id'] . '=' . $x['value']['id'], $x['value']['label'], (int)$x['value']['delta']);
                        }
                    }
                }
            } elseif ((int)$g['delta'] > 0 && ($unit['fields'][$g['id']] ?? '') !== '') {
                if (!empty($g['perUnit'])) {
                    $add('f:' . $it['id'] . ':' . $g['id'], $g['name'], (int)$g['delta']);
                } elseif (!isset($shared[$it['id'] . ':' . $g['id']])) {
                    $shared[$it['id'] . ':' . $g['id']] = true;
                    $add('f:' . $it['id'] . ':' . $g['id'], $g['name'], (int)$g['delta']);
                }
            }
        }
    }
    // choice lines "difference": pricier items cost their difference (sorted chosen − sorted base)
    foreach ($offer['diff'] as $l) {
        $declared = $l['declared'];
        if (!$declared) {
            continue;
        }
        $base = !empty($l['distinct']) ? array_slice($declared, 0, (int)$l['qty']) : array_fill(0, (int)$l['qty'], $declared[0]);
        $chosen = [];
        foreach ($offer['units'] as $k => $slot) {
            if ($slot['line'] !== $l['line']) {
                continue;
            }
            $id = $sel['units'][$k]['item'] ?? '';
            if (isset($items[$id])) {
                $chosen[] = ['k' => $k, 'it' => $items[$id], 'price' => (int)$items[$id]['price']];
            }
        }
        usort($chosen, function ($a, $b) {
            return $a['price'] - $b['price'] ?: $a['k'] - $b['k'];
        });
        foreach ($chosen as $i => $c) {
            $b = $base[$i] ?? $base[count($base) - 1];
            $short = (string)($c['it']['short'] ?? $c['it']['name']);
            $add('s:' . $l['line'] . ':' . $c['it']['id'], $short, max(0, $c['price'] - $b));
        }
    }
    // order extras in scope: once per order
    foreach ($spec['extras'] as $x) {
        if ($x['scope'] !== 'all' && !in_array($offer['id'], (array)$x['scope'], true)) {
            continue;
        }
        $value = $sel['extras'][$x['id']] ?? '';
        if ($value === '') {
            continue;
        }
        $c = 0;
        if ($x['kind'] === 'choice') {
            $o = cod_find($x['options'], $value);
            $c = $o !== null ? (int)$o['delta'] : 0;
        } elseif ((int)$x['delta'] > 0) {
            $c = (int)$x['delta'];
        }
        $add('x:' . $x['id'], $x['name'], $c);
    }
    return ['total' => $total, 'reasons' => array_values($reasons)];
}

/** v2 error key → the v1 control name ("u.1.color" → "v.1.color", "s.main.color" → "v.color"). */
function cod_v1_key(string $key): ?string
{
    if (preg_match('/^u\.(\d{1,2})\.([A-Za-z0-9_-]{2,40})$/', $key, $m)) {
        return 'v.' . $m[1] . '.' . $m[2];
    }
    if (preg_match('/^s\.[a-z0-9-]+\.([A-Za-z0-9_-]{2,40})$/', $key, $m)) {
        return 'v.' . $m[1];
    }
    return null;
}

/** v1 compat record of one unit: { groupName: label, …, fieldName: value } (+ "Article"); repeated names kept apart. */
function cod_compat_record(array $spec, array $item, array $choice): array
{
    $rec = [];
    $seen = [];
    $put = function (string $name, string $value) use (&$rec, &$seen) {
        $seen[$name] = ($seen[$name] ?? 0) + 1;
        $rec[$seen[$name] > 1 ? $name . ' (' . $seen[$name] . ')' : $name] = $value;
    };
    if (!empty($spec['multi'])) {
        $put('Article', $item['name']);
    }
    foreach ($item['groups'] as $g) {
        if ($g['kind'] === 'choice') {
            $o = cod_find($g['options'], $choice['options'][$g['id']] ?? null);
            if ($o !== null) {
                $put($g['name'], $o['label']);
            }
        } elseif ($g['kind'] === 'matrix') {
            $key = $choice['options'][$g['id']] ?? '';
            $combo = $key !== '' ? cod_parse_cell_key($key) : null;
            $res = $combo !== null ? cod_resolve_combo($g, $combo, $item) : null;
            foreach ($res['values'] ?? [] as $x) {
                $put($x['dim']['name'], $x['value']['label']);
            }
        } elseif (($choice['fields'][$g['id']] ?? '') !== '') {
            $put($g['name'], $choice['fields'][$g['id']]);
        }
    }
    return $rec;
}

/** Field rules of the exported form (= validateOrder in the app), prices from the embedded data, in cents. */
function cod_validate(array $p, array $spec): array
{
    $fields = [];
    $form = $spec['form'];
    $v2 = $p['v'] === 2;
    $in = cod_selection_input($p);
    $offer = cod_find($spec['offers'], $in['offerId']);
    if ($offer === null) {
        $fields['bundleId'] = 'invalid';
    } elseif (!empty($offer['soldOut'])) {
        $fields['bundleId'] = 'unavailable';
    }
    $sel = null;
    if ($offer !== null && !isset($fields['bundleId'])) {
        $sel = cod_resolve_selection($spec, $offer, $in);
        $errs = $sel['errors'];
        if (!$v2) {
            // v1 order: group-major, like v1 resolveVariants (stable)
            $ix = array_keys($errs);
            usort($ix, function ($a, $b) use ($errs) {
                return $errs[$a][2] - $errs[$b][2] ?: ($errs[$a][3] - $errs[$b][3] ?: $a - $b);
            });
            $sorted = [];
            foreach ($ix as $i) {
                $sorted[] = $errs[$i];
            }
            $errs = $sorted;
        }
        foreach ($errs as $e) {
            if ($v2) {
                if (!isset($fields[$e[0]])) {
                    $fields[$e[0]] = $e[1];
                }
            } else {
                $key = cod_v1_key($e[0]);
                if ($key !== null) {
                    if (!isset($fields[$key])) {
                        $fields[$key] = $e[1];
                    }
                } elseif (!isset($fields['bundleId'])) {
                    $fields['bundleId'] = 'invalid';
                }
            }
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
    if ($fields || $offer === null || $sel === null || $name === null || $phone === null) {
        return [null, $fields];
    }

    $deltas = cod_deltas($spec, $offer, $sel);
    $bumpCents = $sel['bump'] ? (int)$spec['bump']['price'] : 0;
    if ($bumpCents <= 0) {
        // a bump at 0 is not recorded (= the app: items.bump only when it adds money)
        $sel['bump'] = false;
        $sel['bumpUnit'] = null;
    }
    $shipping = !empty($offer['freeDelivery']) ? 0 : (int)$spec['shippingFee'];
    $subtotal = (int)$offer['price'] + $deltas['total'] + $bumpCents;
    if ($v2 && $subtotal + $shipping !== (int)$p['st']) {
        cod_log('parity mismatch on offer ' . $offer['id'] . ': shown ' . $p['st'] . ', server ' . ($subtotal + $shipping) . ' (server total wins)');
    }

    // stored extras (= OrderItems.extras) and v1 compat records
    $extras = [];
    foreach ($spec['extras'] as $x) {
        $value = $sel['extras'][$x['id']] ?? '';
        if ($value === '') {
            continue;
        }
        if ($x['kind'] === 'choice') {
            $o = cod_find($x['options'], $value);
            if ($o !== null) {
                $e = ['name' => $x['name'], 'value' => $o['label']];
                if (isset($o['code'])) {
                    $e['code'] = $o['code'];
                }
                if ((int)$o['delta'] > 0) {
                    $e['delta'] = (int)$o['delta'];
                }
                $extras[] = $e;
            }
        } else {
            $e = ['name' => $x['name'], 'value' => $value, 'typed' => true];
            if ((int)$x['delta'] > 0) {
                $e['delta'] = (int)$x['delta'];
            }
            $extras[] = $e;
        }
    }
    $items = [];
    foreach ($spec['items'] as $it) {
        $items[$it['id']] = $it;
    }
    $anyGroups = false;
    foreach ($offer['units'] as $k => $slot) {
        $id = $sel['units'][$k]['item'] ?? ($slot['item'] ?? '');
        if (isset($items[$id]) && $items[$id]['groups']) {
            $anyGroups = true;
        }
    }
    $variants = [];
    if (!empty($spec['multi']) || $anyGroups) {
        foreach ($sel['units'] as $u) {
            $variants[] = cod_compat_record($spec, $items[$u['item']], $u);
        }
    }

    return [[
        'offer' => $offer,
        'units' => $sel['snaps'],
        'variants' => $variants,
        'extras' => $extras,
        'bump' => $sel['bump'],
        'bumpUnit' => $sel['bumpUnit'],
        'price' => (int)$offer['price'],
        'deltas' => $deltas['total'],
        'reasons' => $deltas['reasons'],
        'bumpCents' => $bumpCents,
        'shipping' => $shipping,
        'subtotal' => $subtotal,
        'total' => $subtotal + $shipping,
        'name' => $name,
        'phone' => $phone,
        'city' => $city,
        'address' => $address,
        'email' => $email,
        'note' => $note,
    ], []];
}

/** Variante text of a validated order (warehouse rendering, ≤ 1000 characters, "voir <id>" when capped). */
function cod_order_text(array $spec, array $o, string $orderId): string
{
    $extras = [];
    foreach ($o['extras'] as $x) {
        $extras[] = $x;
    }
    return cod_units_text($o['units'], !empty($spec['multi']), $o['offer']['gift'] ?? null, $o['bumpUnit'], $extras, $orderId);
}

/**
 * Optional Sheets columns (= src/lib/sheets/row.ts): "SKU" (`cell sku ?? item sku ?? short`, counted,
 * free and bump included), "Articles" (physical pieces), "Livraison" (delivery charged), "Prix pack".
 */
function cod_sheet_extras(array $spec, array $o): array
{
    $tokens = [];
    $pieces = [];
    foreach ($o['units'] as $u) {
        $pieces[] = [$u, ''];
    }
    if ($o['bump']) {
        $pieces[] = [$o['bumpUnit'], (string)$spec['bump']['title']];
    }
    foreach ($pieces as $piece) {
        list($u, $title) = $piece;
        if ($u !== null) {
            $raw = (string)($u['sku'] ?? '');
            if ($raw === '') {
                $raw = (string)($u['short'] ?? '');
            }
            if ($raw === '') {
                $raw = (string)$u['label'];
            }
            if ($raw === '') {
                $raw = (string)$spec['product'];
            }
        } else {
            $raw = $title;
        }
        $t = (string)preg_replace('/[×\s]+/u', '-', cod_sheet_text($raw, 60));
        if ($t !== '') {
            $tokens[$t] = ($tokens[$t] ?? 0) + 1;
        }
    }
    $sku = [];
    foreach ($tokens as $t => $n) {
        $sku[] = $t . '×' . $n;
    }
    return [
        'sku' => cod_sheet_text(implode(' ', $sku), 500),
        'articles' => count($pieces),
        'delivery' => cod_money($o['shipping']),
        'packPrice' => cod_money($o['price']),
    ];
}

/**
 * = cleanText in src/lib/sheets/format.ts: controls → space, whitespace collapsed, leading formula
 * triggers dropped, capped (UTF-16 units, like String.prototype.slice).
 */
function cod_sheet_text($v, int $max): string
{
    $s = is_scalar($v) ? (string)$v : '';
    $s = (string)preg_replace('/[\x{0000}-\x{001F}\x{007F}-\x{009F}\x{2028}\x{2029}]/u', ' ', $s);
    $s = cod_js_trim((string)preg_replace('/' . COD_JS_SPACE . '+/u', ' ', $s));
    $s = (string)preg_replace('/^(?:[=+\-@\x{FF1D}\x{FF0B}\x{FF0D}\x{FF20}]|' . COD_JS_SPACE . ')+/u', '', $s);
    if (cod_u16len($s) <= $max) {
        return $s;
    }
    $out = '';
    $n = 0;
    foreach (preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY) as $ch) {
        $w = strlen($ch) === 4 ? 2 : 1;
        if ($n + $w > $max) {
            // a surrogate pair cut in half by slice(): JavaScript keeps the lone high surrogate; we drop it
            break;
        }
        $out .= $ch;
        $n += $w;
    }
    return $out;
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
        $offer = cod_find($spec['offers'], $raw['bundleId'] ?? null);
        $total = cod_money($offer !== null ? $offer['from'] : $spec['leadPrice']);
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
    $offer = $o['offer'];
    $product = $spec['product'] . ' — ' . $offer['sheetLabel'] . ($o['bump'] ? ' + ' . $spec['bump']['title'] : '');
    $variantText = cod_order_text($spec, $o, $id);
    $total = cod_money($o['total']);
    $extras = [];
    foreach ($o['extras'] as $x) {
        if (isset($x['delta'])) {
            $x['delta'] = cod_money($x['delta']);
        }
        $extras[] = $x;
    }
    $reasons = [];
    foreach ($o['reasons'] as $r) {
        $reasons[] = ['label' => $r['label'], 'count' => $r['count'], 'amount' => cod_money($r['cents'])];
    }
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
        'bundle_id' => $offer['id'],
        'bundle_label' => $offer['sheetLabel'],
        'qty' => count($offer['units']),
        'variants' => $o['variants'],
        'units' => $o['units'],
        'extras' => $extras,
        'gift' => $offer['gift'],
        'variant_text' => $variantText,
        'sheet_extras' => cod_sheet_extras($spec, $o),
        'bump' => $o['bump'] ? $spec['bump']['title'] : null,
        'bump_unit' => $o['bumpUnit'],
        'price' => cod_money($o['price']),
        'deltas' => cod_money($o['deltas']),
        'reasons' => $reasons,
        'shipping' => cod_money($o['shipping']),
        'total' => $total,
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
        cod_store_put($env, 'idem', $p['idem'], ['o' => $id, 't' => $total], 3 * 86400);
        cod_store_put($env, 'phones', $phoneKey, ['o' => $id], COD_DUPLICATE_WINDOW);
    } catch (Throwable $e) {
        cod_log('markers ' . $id . ': ' . $e->getMessage());
    }

    return [
        'status' => 200,
        'body' => ['ok' => true, 'orderId' => $id, 'total' => $total, 'currency' => $currency],
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
            $cols = cod_sheet_columns($sa, $cache, $sheetId, $tab, $tabFile);
            $rows = [];
            $written = [];
            foreach ($batch as $file => $o) {
                $written[] = $file;
                if (isset($existing[$o['id']])) {
                    continue;
                }
                $row = gs_order_row([
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
                // Variante: the whole order text (≤ 1000 characters), not gs_order_row's 200
                $row[8] = cod_sheet_text((string)$o['variant_text'], COD_TEXT_MAX);
                $rows[] = cod_wide_row($row, $cols, is_array($o['sheet_extras'] ?? null) ? $o['sheet_extras'] : null);
            }
            gs_append_rows($sa, $cache, $sheetId, $tab, $rows);
            foreach ($written as $file) {
                @unlink($file);
            }
            return count($rows);
        } catch (Throwable $e) {
            if ($e instanceof GsException && ($e->status === 400 || $e->status === 404)) {
                @unlink($tabFile); // tab renamed or deleted: look it up again next time
            } else {
                cod_forget_columns($tabFile); // a failed write: read the optional headers again next time
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

/** "sku" | "articles" | "delivery" | "packPrice" → 0-based column, from the headers after column M. */
function cod_extra_columns(array $cells): array
{
    $names = ['sku' => 'sku', 'articles' => 'articles', 'livraison' => 'delivery', 'prix pack' => 'packPrice'];
    $out = [];
    foreach (array_values($cells) as $i => $v) {
        $key = is_scalar($v) ? (string)$v : '';
        $key = cod_js_trim((string)preg_replace('/' . COD_JS_SPACE . '+/u', ' ', $key));
        $key = function_exists('mb_strtolower') ? mb_strtolower($key, 'UTF-8') : strtolower($key);
        if (isset($names[$key]) && !isset($out[$names[$key]])) {
            $out[$names[$key]] = 13 + $i;
        }
    }
    return $out;
}

/** The optional columns of the tab, read once per 10 min (cached in data/sheet-tab.json). */
function cod_sheet_columns(array $sa, string $cache, string $sheetId, string $tab, string $tabFile): array
{
    $info = json_decode((string)@file_get_contents($tabFile), true);
    if (is_array($info) && isset($info['cols'], $info['cols_at']) && is_array($info['cols']) && time() - (int)$info['cols_at'] < 600) {
        return $info['cols'];
    }
    $path = '/' . rawurlencode($sheetId) . '/values/' . rawurlencode(gs_a1($tab, 'N1:AZ1'));
    $r = gs_api($sa, $cache, 'GET', $path, null, 2);
    $cols = cod_extra_columns(is_array($r['values'][0] ?? null) ? $r['values'][0] : []);
    $info = is_array($info) ? $info : ['sheet' => $sheetId, 'title' => $tab];
    $info['cols'] = (object)$cols;
    $info['cols_at'] = time();
    @file_put_contents($tabFile, (string)json_encode($info, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $cols;
}

function cod_forget_columns(string $tabFile): void
{
    $info = json_decode((string)@file_get_contents($tabFile), true);
    if (is_array($info) && isset($info['cols_at'])) {
        unset($info['cols'], $info['cols_at']);
        @file_put_contents($tabFile, (string)json_encode($info, JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
}

/** The 13 contract cells, then null after column M except the optional columns the tab has (nulls are skipped). */
function cod_wide_row(array $row, array $cols, ?array $values): array
{
    if (!$cols || $values === null) {
        return $row;
    }
    $width = max(13, max($cols) + 1);
    for ($i = count($row); $i < $width; $i++) {
        $row[$i] = null;
    }
    foreach ($cols as $name => $c) {
        if (array_key_exists($name, $values)) {
            $row[(int)$c] = $values[$name];
        }
    }
    ksort($row);
    return array_values($row);
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
