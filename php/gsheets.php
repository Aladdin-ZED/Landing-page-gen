<?php
/**
 * gsheets.php — zero-dependency Google Sheets client for the standalone order.php of exported pages.
 *
 * Requirements: PHP 8.1+ (syntax kept 7.3-compatible), ext-openssl, ext-curl, ext-json; ext-mbstring optional.
 * Mirrors src/lib/sheets in the Node app: same "Commandes" tab layout and formatting, same text
 * cleaning (formula-injection safe), same French status labels, byte-identical service-account JWTs.
 *
 * Typical use from order.php:
 *   require __DIR__ . '/gsheets.php';
 *   $sa    = gs_load_service_account('/home/user/private/service-account.json'); // OUTSIDE the web root
 *   $cache = '/home/user/private/gs-token.json';                                // OUTSIDE the web root
 *   $tab   = gs_ensure_tab($sa, $cache, $spreadsheetId)['title'];               // once (idempotent; cache it)
 *   gs_append_rows($sa, $cache, $spreadsheetId, $tab, [gs_order_row($order)]);
 *
 * Every failure throws GsException ($e->status = HTTP status, 0 for network; $e->reason = Google status).
 */
declare(strict_types=1);

const GS_TAB = 'Commandes';
const GS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const GS_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Column order is a contract with call centers and with the Node app (src/lib/sheets/orders-sheet.ts). */
const GS_COLUMNS = [
    ['N° commande', 120], ['Date', 130], ['Statut', 140], ['Client', 180], ['Téléphone', 130],
    ['Ville', 120], ['Adresse', 260], ['Produit', 220], ['Variante', 140], ['Qté', 56],
    ['Total', 110], ['Note', 220], ['Source', 130],
];

/** status id => [French label, background, text colour, emphasis] (same as src/lib/orders/contract.ts) */
const GS_STATUSES = [
    'new'       => ['Nouvelle', '#E8F0FE', '#1A4FA0', ''],
    'confirmed' => ['Confirmée', '#E6F4EA', '#1D6B3A', ''],
    'no_answer' => ['Injoignable', '#FEF7E0', '#8A5A00', ''],
    'callback'  => ['Reportée', '#F3E8FD', '#5B3A8C', ''],
    'shipped'   => ['Expédiée', '#E0F2F1', '#1E6B63', ''],
    'delivered' => ['Livrée', '#CEEAD6', '#0F5A2A', 'bold'],
    'returned'  => ['Retournée', '#FCE8E6', '#9B2C22', ''],
    'cancelled' => ['Annulée', '#F1F3F4', '#80868B', 'strikethrough'],
    'fake'      => ['Fausse commande', '#F6D6D3', '#8C1D18', 'bold'],
];

class GsException extends RuntimeException
{
    /** @var int HTTP status (0 = network / local error) */
    public $status;
    /** @var string Google error status or local reason code */
    public $reason;

    public function __construct(int $status, string $reason, string $message)
    {
        parent::__construct("$status $reason: $message", $status);
        $this->status = $status;
        $this->reason = $reason;
    }
}

/* ------------------------------------------------------------------ */
/* service account & token                                             */
/* ------------------------------------------------------------------ */

/**
 * Service-account key from a JSON file path, a JSON string, or the base64 JSON (GOOGLE_SA_JSON_B64 form).
 * Returns ['client_email' => …, 'private_key' => …, 'private_key_id' => …?].
 */
function gs_load_service_account(string $source): array
{
    $source = trim($source);
    if ($source !== '' && $source[0] !== '{' && strlen($source) < 4096 && is_file($source)) {
        $source = (string)file_get_contents($source);
    } elseif ($source !== '' && $source[0] !== '{') {
        $source = (string)base64_decode($source, true);
    }
    $sa = json_decode($source, true);
    if (!is_array($sa)
        || !isset($sa['client_email'], $sa['private_key'])
        || !is_string($sa['client_email']) || filter_var($sa['client_email'], FILTER_VALIDATE_EMAIL) === false
        || !is_string($sa['private_key']) || strpos($sa['private_key'], 'PRIVATE KEY') === false) {
        throw new GsException(0, 'invalid_key', 'service-account key is missing or malformed');
    }
    $out = ['client_email' => $sa['client_email'], 'private_key' => $sa['private_key']];
    if (!empty($sa['private_key_id']) && is_string($sa['private_key_id'])) {
        $out['private_key_id'] = $sa['private_key_id'];
    }
    return $out;
}

function gs_b64url(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

/** RS256 JWT for the OAuth JWT-bearer grant (identical bytes to the Node implementation). */
function gs_sign_jwt(array $sa, ?int $now = null): string
{
    $now = $now ?? time();
    $header = ['alg' => 'RS256', 'typ' => 'JWT'];
    if (!empty($sa['private_key_id'])) {
        $header['kid'] = $sa['private_key_id'];
    }
    $claims = [
        'iss'   => $sa['client_email'],
        'scope' => GS_SCOPE,
        'aud'   => GS_TOKEN_URL,
        'iat'   => $now,
        'exp'   => $now + 3600,
    ];
    $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
    $input = gs_b64url((string)json_encode($header, $flags)) . '.' . gs_b64url((string)json_encode($claims, $flags));
    $key = openssl_pkey_get_private($sa['private_key']);
    $sig = '';
    if ($key === false || !openssl_sign($input, $sig, $key, OPENSSL_ALGO_SHA256)) {
        throw new GsException(0, 'jwt', 'JWT signing failed: ' . (string)openssl_error_string());
    }
    return $input . '.' . gs_b64url($sig);
}

/**
 * Low-level HTTPS request. Returns [status, decoded JSON body (array), Retry-After seconds or 0].
 * Status 0 = network error / timeout.
 */
function gs_http(string $method, string $url, array $headers, ?string $body, int $timeout = 15): array
{
    $retryAfter = 0;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADERFUNCTION => function ($ch, string $line) use (&$retryAfter): int {
            if (stripos($line, 'retry-after:') === 0) {
                $retryAfter = max(0, (int)trim(substr($line, 12)));
            }
            return strlen($line);
        },
    ]);
    if (defined('CURLOPT_PROTOCOLS')) {
        curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
    }
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $raw = curl_exec($ch);
    $code = $raw === false ? 0 : (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if (PHP_VERSION_ID < 80000) {
        curl_close($ch); // no-op (and deprecated) since PHP 8
    }
    $json = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
    return [$code, is_array($json) ? $json : [], $retryAfter];
}

/** OAuth access token, cached in a private file (shared hosting has no memory between requests). */
function gs_token(array $sa, string $cacheFile, bool $force = false): string
{
    if (!$force && is_file($cacheFile)) {
        $c = json_decode((string)@file_get_contents($cacheFile), true);
        if (is_array($c) && ($c['email'] ?? '') === $sa['client_email'] && (int)($c['exp'] ?? 0) - 300 > time()
            && is_string($c['token'] ?? null)) {
            return $c['token'];
        }
    }
    $body = http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion'  => gs_sign_jwt($sa),
    ]);
    list($code, $j) = gs_http('POST', GS_TOKEN_URL, ['Content-Type: application/x-www-form-urlencoded'], $body, 10);
    if ($code !== 200 || empty($j['access_token']) || !is_string($j['access_token'])) {
        throw new GsException($code, (string)($j['error'] ?? 'token_error'), (string)($j['error_description'] ?? 'token request failed'));
    }
    $ttl = isset($j['expires_in']) ? (int)$j['expires_in'] : 3600;
    $payload = json_encode(['token' => $j['access_token'], 'exp' => time() + $ttl, 'email' => $sa['client_email']]);
    if (@file_put_contents($cacheFile, (string)$payload, LOCK_EX) !== false) {
        @chmod($cacheFile, 0600);
    }
    return $j['access_token'];
}

/**
 * Sheets API call (path appended to /v4/spreadsheets). 401 → token refreshed once;
 * 408/429/5xx/network → truncated exponential backoff (honours Retry-After). Returns decoded JSON.
 */
function gs_api(array $sa, string $cacheFile, string $method, string $path, ?array $body = null, int $maxRetries = 4): array
{
    $authRetried = false;
    $force = false;
    $payload = $body === null ? null : (string)json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    for ($n = 0; ; $n++) {
        $token = gs_token($sa, $cacheFile, $force);
        $force = false;
        list($code, $j, $retryAfter) = gs_http($method, GS_API . $path, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ], $payload);
        if ($code >= 200 && $code < 300) {
            return $j;
        }
        if ($code === 401 && !$authRetried) {
            $authRetried = true;
            $force = true;
            continue;
        }
        if (in_array($code, [0, 408, 429, 500, 502, 503, 504], true) && $n < $maxRetries) {
            $ms = $retryAfter > 0 ? min($retryAfter * 1000, 32000) : min((2 ** $n) * 1000 + random_int(0, 1000), 32000);
            usleep($ms * 1000);
            continue;
        }
        $e = isset($j['error']) && is_array($j['error']) ? $j['error'] : [];
        throw new GsException($code, (string)($e['status'] ?? ($code === 0 ? 'network' : 'UNKNOWN')), (string)($e['message'] ?? 'request failed'));
    }
}

/* ------------------------------------------------------------------ */
/* cell helpers                                                        */
/* ------------------------------------------------------------------ */

function gs_substr(string $s, int $max): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $max, 'UTF-8');
    }
    return preg_match('/^.{0,' . $max . '}/us', $s, $m) ? $m[0] : '';
}

/**
 * Neutralise formula triggers & control characters (values are written RAW, but agents export
 * sheets to CSV/Excel where a leading = + - @ — or a full-width variant — would become a formula).
 */
function gs_clean_text($v, int $max = 500): string
{
    $s = is_scalar($v) ? (string)$v : '';
    if (!preg_match('//u', $s)) {
        $s = function_exists('mb_convert_encoding') ? (string)mb_convert_encoding($s, 'UTF-8', 'UTF-8') : '';
    }
    $s = (string)preg_replace('/[\x{0000}-\x{001F}\x{007F}-\x{009F}\x{2028}\x{2029}]/u', ' ', $s);
    $s = trim((string)preg_replace('/\s+/u', ' ', $s));
    $s = (string)preg_replace('/^[=+\-@\x{FF1D}\x{FF0B}\x{FF0D}\x{FF20}\s]+/u', '', $s);
    return gs_substr($s, $max);
}

/** Google Sheets serial date (days since 1899-12-30) in the wall-clock time of $tz. */
function gs_sheets_serial(int $timestamp, string $tz = 'Africa/Casablanca'): float
{
    $dt = (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone($tz));
    return round(($timestamp + $dt->getOffset()) / 86400 + 25569, 6);
}

function gs_status_label(string $id): string
{
    return isset(GS_STATUSES[$id]) ? GS_STATUSES[$id][0] : GS_STATUSES['new'][0];
}

/** Quoted A1 range on a tab: 'My tab'!A1:C */
function gs_a1(string $tab, string $range): string
{
    return "'" . str_replace("'", "''", $tab) . "'!" . $range;
}

/**
 * One sheet row (13 cells, GS_COLUMNS order). $o keys:
 *   id, created_at (unix time), status (id, default "new"), name, phone (national digits, e.g. "0612345678"),
 *   city, address, product, variant, qty, total, note, source; optional tz.
 */
function gs_order_row(array $o): array
{
    return [
        gs_clean_text($o['id'] ?? '', 40),
        gs_sheets_serial((int)($o['created_at'] ?? time()), (string)($o['tz'] ?? 'Africa/Casablanca')),
        gs_status_label((string)($o['status'] ?? 'new')),
        gs_clean_text($o['name'] ?? '', 120),
        gs_clean_text($o['phone'] ?? '', 24),
        gs_clean_text($o['city'] ?? '', 80),
        gs_clean_text($o['address'] ?? '', 300),
        gs_clean_text($o['product'] ?? '', 250),
        gs_clean_text($o['variant'] ?? '', 200),
        max(1, (int)($o['qty'] ?? 1)),
        round((float)($o['total'] ?? 0), 2),
        gs_clean_text($o['note'] ?? '', 500),
        gs_clean_text($o['source'] ?? '', 120),
    ];
}

/* ------------------------------------------------------------------ */
/* sheet operations                                                    */
/* ------------------------------------------------------------------ */

/** Append rows in ONE request. RAW = stored literally (no formulas, leading zeros kept). */
function gs_append_rows(array $sa, string $cacheFile, string $spreadsheetId, string $tab, array $rows): array
{
    if (!$rows) {
        return [];
    }
    $path = '/' . rawurlencode($spreadsheetId) . '/values/' . rawurlencode(gs_a1($tab, 'A1'))
        . ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
    return gs_api($sa, $cacheFile, 'POST', $path, ['majorDimension' => 'ROWS', 'values' => array_values($rows)]);
}

/** Backwards-compatible single-row append. */
function gs_append_order(array $sa, string $cacheFile, string $spreadsheetId, string $tab, array $row): array
{
    return gs_append_rows($sa, $cacheFile, $spreadsheetId, $tab, [$row]);
}

/** Order id => 1-based row number (column A), to avoid appending an order twice after a timeout. */
function gs_find_rows(array $sa, string $cacheFile, string $spreadsheetId, string $tab = GS_TAB): array
{
    $path = '/' . rawurlencode($spreadsheetId) . '/values/' . rawurlencode(gs_a1($tab, 'A2:A')) . '?majorDimension=COLUMNS';
    $r = gs_api($sa, $cacheFile, 'GET', $path, null, 2);
    $out = [];
    foreach (($r['values'][0] ?? []) as $i => $v) {
        $id = trim((string)$v);
        if ($id !== '' && !isset($out[$id])) {
            $out[$id] = $i + 2;
        }
    }
    return $out;
}

function gs_rgb(string $hex): array
{
    $h = ltrim($hex, '#');
    return [
        'red'   => hexdec(substr($h, 0, 2)) / 255,
        'green' => hexdec(substr($h, 2, 2)) / 255,
        'blue'  => hexdec(substr($h, 4, 2)) / 255,
    ];
}

/** Formatting requests for a new tab, sent as ONE atomic batchUpdate (mirror of setupRequests() in Node). */
function gs_setup_requests(int $sheetId, string $title = GS_TAB, string $currency = 'MAD'): array
{
    $n = count(GS_COLUMNS);
    $ink = gs_rgb('#1F2328');
    $suffixes = ['MAD' => 'DH', 'EUR' => '€'];
    $suffix = $suffixes[$currency] ?? substr((string)preg_replace('/[^A-Z]/', '', $currency), 0, 3);
    $col = function (int $c) use ($sheetId): array {
        return ['sheetId' => $sheetId, 'startRowIndex' => 1, 'startColumnIndex' => $c, 'endColumnIndex' => $c + 1];
    };
    $requests = [
        ['addSheet' => ['properties' => [
            'sheetId' => $sheetId, 'title' => $title, 'index' => 0,
            'gridProperties' => ['rowCount' => 1000, 'columnCount' => $n, 'frozenRowCount' => 1, 'frozenColumnCount' => 1],
            'tabColorStyle' => ['rgbColor' => $ink],
        ]]],
        ['repeatCell' => [
            'range' => ['sheetId' => $sheetId, 'startRowIndex' => 0, 'endRowIndex' => 1, 'startColumnIndex' => 0, 'endColumnIndex' => $n],
            'cell' => ['userEnteredFormat' => [
                'backgroundColorStyle' => ['rgbColor' => $ink],
                'horizontalAlignment' => 'LEFT', 'verticalAlignment' => 'MIDDLE',
                'padding' => ['left' => 8, 'right' => 8, 'top' => 4, 'bottom' => 4],
                'textFormat' => ['foregroundColorStyle' => ['rgbColor' => gs_rgb('#FFFFFF')], 'fontSize' => 10, 'bold' => true],
            ]],
            'fields' => 'userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment,padding,textFormat)',
        ]],
        ['updateDimensionProperties' => [
            'range' => ['sheetId' => $sheetId, 'dimension' => 'ROWS', 'startIndex' => 0, 'endIndex' => 1],
            'properties' => ['pixelSize' => 34], 'fields' => 'pixelSize',
        ]],
        ['repeatCell' => [
            'range' => ['sheetId' => $sheetId, 'startRowIndex' => 1, 'startColumnIndex' => 0, 'endColumnIndex' => $n],
            'cell' => ['userEnteredFormat' => ['verticalAlignment' => 'MIDDLE', 'wrapStrategy' => 'CLIP', 'textFormat' => ['fontSize' => 10]]],
            'fields' => 'userEnteredFormat(verticalAlignment,wrapStrategy,textFormat.fontSize)',
        ]],
    ];
    foreach (GS_COLUMNS as $i => $c) {
        $requests[] = ['updateDimensionProperties' => [
            'range' => ['sheetId' => $sheetId, 'dimension' => 'COLUMNS', 'startIndex' => $i, 'endIndex' => $i + 1],
            'properties' => ['pixelSize' => $c[1]], 'fields' => 'pixelSize',
        ]];
    }
    $requests[] = ['repeatCell' => ['range' => $col(1),
        'cell' => ['userEnteredFormat' => ['numberFormat' => ['type' => 'DATE_TIME', 'pattern' => 'dd/mm/yyyy hh:mm']]],
        'fields' => 'userEnteredFormat.numberFormat']];
    $requests[] = ['repeatCell' => ['range' => $col(4),
        'cell' => ['userEnteredFormat' => ['numberFormat' => ['type' => 'TEXT']]],
        'fields' => 'userEnteredFormat.numberFormat']];
    $requests[] = ['repeatCell' => ['range' => $col(9),
        'cell' => ['userEnteredFormat' => ['numberFormat' => ['type' => 'NUMBER', 'pattern' => '0'], 'horizontalAlignment' => 'CENTER']],
        'fields' => 'userEnteredFormat(numberFormat,horizontalAlignment)']];
    $requests[] = ['repeatCell' => ['range' => $col(10),
        'cell' => ['userEnteredFormat' => ['numberFormat' => ['type' => 'NUMBER', 'pattern' => '#,##0.00 "' . ($suffix !== '' ? $suffix : 'DH') . '"']]],
        'fields' => 'userEnteredFormat.numberFormat']];
    $values = [];
    foreach (GS_STATUSES as $s) {
        $values[] = ['userEnteredValue' => $s[0]];
    }
    $requests[] = ['setDataValidation' => ['range' => $col(2), 'rule' => [
        'condition' => ['type' => 'ONE_OF_LIST', 'values' => $values], 'strict' => true, 'showCustomUi' => true,
    ]]];
    $i = 0;
    foreach (GS_STATUSES as $s) {
        $text = ['foregroundColor' => gs_rgb($s[2])];
        if ($s[3] !== '') {
            $text[$s[3]] = true;
        }
        $requests[] = ['addConditionalFormatRule' => ['index' => $i++, 'rule' => [
            'ranges' => [$col(2)],
            'booleanRule' => [
                'condition' => ['type' => 'TEXT_EQ', 'values' => [['userEnteredValue' => $s[0]]]],
                'format' => ['backgroundColor' => gs_rgb($s[1]), 'textFormat' => $text],
            ],
        ]]];
    }
    $requests[] = ['setBasicFilter' => ['filter' => ['range' => [
        'sheetId' => $sheetId, 'startRowIndex' => 0, 'startColumnIndex' => 0, 'endColumnIndex' => $n,
    ]]]];
    $requests[] = ['addProtectedRange' => ['protectedRange' => [
        'range' => ['sheetId' => $sheetId, 'startRowIndex' => 0, 'endRowIndex' => 1, 'startColumnIndex' => 0, 'endColumnIndex' => $n],
        'description' => 'En-têtes utilisés par la synchronisation', 'warningOnly' => true,
    ]]];
    $requests[] = ['addProtectedRange' => ['protectedRange' => [
        'range' => $col(0), 'description' => 'N° de commande utilisés par la synchronisation', 'warningOnly' => true,
    ]]];
    return $requests;
}

function gs_write_header(array $sa, string $cacheFile, string $spreadsheetId, string $tab): void
{
    $headers = [];
    foreach (GS_COLUMNS as $c) {
        $headers[] = $c[0];
    }
    $path = '/' . rawurlencode($spreadsheetId) . '/values/' . rawurlencode(gs_a1($tab, 'A1:M1')) . '?valueInputOption=RAW';
    gs_api($sa, $cacheFile, 'PUT', $path, ['values' => [$headers]]);
}

/**
 * Can this header row carry our layout? Yes when empty or already ours — also after agents renamed a
 * few cells (our "N° commande" id column, or most of our labels, are still there). Mirrors headerUsable().
 */
function gs_header_usable(array $header): bool
{
    $header = array_map(function ($v): string {
        return trim(is_scalar($v) ? (string)$v : '');
    }, array_values($header));
    if (implode('', $header) === '') {
        return true;
    }
    if (($header[0] ?? '') === GS_COLUMNS[0][0]) {
        return true;
    }
    $same = 0;
    foreach (GS_COLUMNS as $i => $c) {
        if (($header[$i] ?? '') === $c[0]) {
            $same++;
        }
    }
    return $same >= (int)ceil(count(GS_COLUMNS) / 2);
}

/**
 * Make sure the orders tab exists (created + formatted when missing).
 * Returns ['sheetId' => int, 'title' => string, 'created' => bool] — append to the returned 'title':
 * when $tab is already used by another tool with its own column layout, that tab is left untouched and
 * "$tab COD" (then "$tab COD 2", "$tab COD 3") is used instead. Mirrors connectSheet() in the Node app.
 * Existing tabs are never re-formatted (re-adding conditional rules would duplicate them).
 */
function gs_ensure_tab(array $sa, string $cacheFile, string $spreadsheetId, string $tab = GS_TAB, string $currency = 'MAD'): array
{
    $meta = gs_api($sa, $cacheFile, 'GET', '/' . rawurlencode($spreadsheetId) . '?fields=' . rawurlencode('sheets(properties(sheetId,title))'));
    $ids = [];
    $byTitle = [];
    foreach (($meta['sheets'] ?? []) as $s) {
        $p = $s['properties'] ?? [];
        if (isset($p['sheetId'])) {
            $ids[] = (int)$p['sheetId'];
            if (isset($p['title']) && is_string($p['title'])) {
                $byTitle[$p['title']] = (int)$p['sheetId'];
            }
        }
    }
    $candidates = [$tab, "$tab COD", "$tab COD 2", "$tab COD 3"];
    foreach ($candidates as $title) {
        if (!isset($byTitle[$title])) {
            continue;
        }
        $path = '/' . rawurlencode($spreadsheetId) . '/values/' . rawurlencode(gs_a1($title, 'A1:M1'));
        $r = gs_api($sa, $cacheFile, 'GET', $path, null, 2);
        $header = array_map(function ($v): string {
            return trim(is_scalar($v) ? (string)$v : '');
        }, (isset($r['values'][0]) && is_array($r['values'][0])) ? array_values($r['values'][0]) : []);
        if (gs_header_usable($header)) {
            if (implode('', $header) === '') {
                gs_write_header($sa, $cacheFile, $spreadsheetId, $title);
            }
            return ['sheetId' => $byTitle[$title], 'title' => $title, 'created' => false];
        }
    }
    $title = $tab . ' ' . base_convert((string)time(), 10, 36);
    foreach ($candidates as $candidate) {
        if (!isset($byTitle[$candidate])) {
            $title = $candidate;
            break;
        }
    }
    do {
        $sheetId = random_int(1, 2000000000);
    } while (in_array($sheetId, $ids, true));
    gs_api($sa, $cacheFile, 'POST', '/' . rawurlencode($spreadsheetId) . ':batchUpdate', [
        'requests' => gs_setup_requests($sheetId, $title, $currency),
    ]);
    gs_write_header($sa, $cacheFile, $spreadsheetId, $title);
    return ['sheetId' => $sheetId, 'title' => $title, 'created' => true];
}
