<?php
/**
 * i7OS Media Relay
 * ----------------
 * Instagram und Threads nehmen keine Bytes entgegen, sie holen sich eine Datei
 * selbst über eine URL. Diese Datei ist dieser Zwischenspeicher: der Browser
 * lädt ein Video hier in Stücken hoch, i7OS gibt Meta die entstandene URL, und
 * einen Tag später ist die Datei wieder weg.
 *
 * Ein Upload wird nur angenommen, wenn er ein Ticket vorzeigt, das i7OS mit dem
 * gemeinsamen Geheimnis unterschrieben hat. Ohne dieses Geheimnis kann niemand
 * hier etwas ablegen.
 *
 * EINRICHTUNG
 *  1. Diese beiden Dateien in einen Ordner "i7media" im Web-Stammverzeichnis
 *     legen: upload.php und php.ini
 *  2. Unten in $SECRET dieselbe Zeichenkette eintragen, die in Vercel unter
 *     MEDIA_HOST_SECRET steht.
 *  3. Fertig. https://deine-domain/i7media/upload.php?check=1 sagt, ob es
 *     steht. Der Unterordner "files" legt sich selbst an.
 */

// ── Das Geheimnis, dasselbe wie in Vercel unter MEDIA_HOST_SECRET ───────────
$SECRET = 'HIER-DAS-GEHEIMNIS-EINTRAGEN';

// ── Grenzen ────────────────────────────────────────────────────────────────
$MAX_BYTES  = 1073741824;   // 1 GB je Datei, mehr nimmt auch Meta nicht
$MAX_PART   = 8388608;      // 8 MB je Stück (i7OS schickt 4 MB)
$KEEP_HOURS = 24;           // danach wird aufgeräumt
$EXT        = ['mp4', 'mov', 'm4v', 'jpg', 'jpeg', 'png', 'webp', 'gif'];
$ORIGINS    = ['https://app.i7os.com', 'http://localhost:5173', 'http://localhost:3000'];

$DIR  = __DIR__ . '/files';
$BASE = 'https://' . ($_SERVER['HTTP_HOST'] ?? '')
      . rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/') . '/files';

// ── Antworten ──────────────────────────────────────────────────────────────
function out($code, $data) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data);
    exit;
}
function fail($code, $why) { out($code, ['error' => $why]); }

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: content-type');
    header('Access-Control-Max-Age: 86400');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

// Der Ablageordner legt sich selbst an, samt der Regel, die dafuer sorgt, dass
// dort NIE etwas ausgefuehrt wird, was jemand hineinlegt. Sonst muesste eine
// .htaccess in einen Ordner hochgeladen werden, den es noch nicht gibt.
if (!is_dir($DIR)) {
    @mkdir($DIR, 0755, true);
    @file_put_contents($DIR . '/.htaccess', implode("\n", [
        'php_flag engine off',
        'RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8',
        'RemoveType .php .phtml .php3 .php4 .php5 .php7 .php8',
        'AddType text/plain .php .phtml',
        'Options -Indexes',
        '<IfModule mod_headers.c>',
        '  Header set X-Robots-Tag "noindex, nofollow"',
        '</IfModule>',
        '',
    ]));
}

// Aufräumen bei jeder Anfrage: was Meta abgeholt hat, wird hier nicht gebraucht.
// Eine verwaiste Datei kostet sonst für immer Platz.
foreach (glob($DIR . '/*') ?: [] as $f) {
    if (is_file($f) && filemtime($f) < time() - $KEEP_HOURS * 3600) @unlink($f);
}

// ── Selbstauskunft, ohne Geheimnis aufrufbar und ohne es zu verraten ───────
if (isset($_GET['check'])) {
    out(200, [
        'ok'                  => true,
        'relay'               => 'i7os-media',
        'version'             => 1,
        'php'                 => PHP_VERSION,
        'post_max_size'       => ini_get('post_max_size'),
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'max_execution_time'  => ini_get('max_execution_time'),
        'memory_limit'        => ini_get('memory_limit'),
        'dir_writable'        => is_dir($DIR) && is_writable($DIR),
        'secret_set'          => (strlen($SECRET) >= 16 && strpos($SECRET, 'HIER-DAS') !== 0),
        'stored'              => count(glob($DIR . '/*') ?: []),
        'guarded'             => is_file($DIR . '/.htaccess'),
        'base'                => $BASE,
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'post_only');
if (strlen($SECRET) < 16 || strpos($SECRET, 'HIER-DAS') === 0) fail(500, 'secret_missing');

// ── Das Ticket ─────────────────────────────────────────────────────────────
// i7OS unterschreibt Name, Endung und Ablaufzeit. Alles andere wird abgewiesen,
// und die Endung stammt aus einer Liste, damit hier nie ein Skript landet.
$id   = preg_replace('/[^a-f0-9]/', '', (string)($_GET['id'] ?? ''));
$ext  = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', (string)($_GET['ext'] ?? '')));
$exp  = (int)($_GET['exp'] ?? 0);
$tok  = (string)($_GET['token'] ?? '');

if (strlen($id) !== 32)           fail(400, 'bad_id');
if (!in_array($ext, $EXT, true))  fail(400, 'bad_ext');
if ($exp < time())                fail(403, 'expired');
if (!hash_equals(hash_hmac('sha256', $id . '|' . $ext . '|' . $exp, $SECRET), $tok)) fail(403, 'bad_token');

$target = $DIR . '/' . $id . '.' . $ext;
$tmp    = $DIR . '/' . $id . '.part';

// ── Wegräumen, sobald Meta die Datei geholt hat ────────────────────────────
if (isset($_GET['drop'])) {
    @unlink($target); @unlink($tmp);
    out(200, ['ok' => true, 'dropped' => true]);
}

// ── Ein Stück ──────────────────────────────────────────────────────────────
$part = max(0, (int)($_GET['part'] ?? 0));
$last = (($_GET['last'] ?? '') === '1');

$body = file_get_contents('php://input');
$n    = $body === false ? 0 : strlen($body);
if ($n <= 0)          fail(400, 'empty_part');
if ($n > $MAX_PART)   fail(413, 'part_too_big');

if ($part === 0) { @unlink($tmp); @unlink($target); }
elseif (!is_file($tmp)) fail(409, 'no_start');

if ((is_file($tmp) ? filesize($tmp) : 0) + $n > $MAX_BYTES) fail(413, 'file_too_big');
if (file_put_contents($tmp, $body, FILE_APPEND | LOCK_EX) === false) fail(500, 'write_failed');

if (!$last) out(200, ['ok' => true, 'part' => $part, 'bytes' => filesize($tmp)]);

if (!rename($tmp, $target)) fail(500, 'rename_failed');
out(200, ['ok' => true, 'url' => $BASE . '/' . $id . '.' . $ext, 'bytes' => filesize($target)]);
