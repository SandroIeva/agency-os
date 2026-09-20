# Media-Relay: große Dateien für Instagram und Threads

## Warum es das gibt

Instagram und Threads nehmen **keine Bytes** entgegen. Sie bekommen eine URL
und holen sich die Datei selbst. Der normale Weg dafür ist unser
Supabase-Speicher (`brand-assets`, signierte URL), und der hat eine harte
Grenze: das Projekt läuft auf dem **kostenlosen Supabase-Plan**, dort sind
**50 MB je Objekt** Schluss, und das ist keine Einstellung, die sich anheben
lässt. Meta selbst nähme knapp ein Gigabyte.

Gemessen am 20.09.2026: ein 117-MB-Video scheiterte im Upload, die größte je
gespeicherte Datei im ganzen Projekt hat 26 MB.

Die Ausweichspur ist ein winziges PHP-Skript auf dem eigenen Webspace des
Betreibers. Alles unter 45 MB geht weiterhin nach Supabase, nur was dort nicht
mehr hineinpasst, nimmt diesen Weg. Der Normalfall hängt also an nichts Neuem.

## Wie es läuft

1. `api/media-host.js` (Edge) unterschreibt ein Ticket: `HMAC-SHA256` über
   `id|ext|exp` mit `MEDIA_HOST_SECRET`. Eine Stunde gültig, nur für Mitglieder
   des Workspaces.
2. Der **Browser** lädt die Datei in Stücken von 4 MB direkt zum PHP-Skript.
   Die Bytes gehen NICHT durch unsere Funktion: ein halbes Gigabyte durch eine
   Edge-Funktion ist ein Timeout mit Ansage, dieselbe Lehre wie bei TikToks
   Upload.
3. Das Skript hängt die Stücke aneinander und gibt die öffentliche URL zurück.
4. Diese URL bekommt Meta. `publicUrl(m)` in `api/instagram.js` und
   `api/threads.js` nimmt ein `{ url }` bereits direkt an, dort war nichts zu
   ändern.
5. Nach dem Posten ruft der Composer `mode: "drop"`, und die Datei ist weg.
   Läuft noch etwas (`pending`), bleibt sie liegen: die Datei unter einem
   laufenden Container wegzuziehen bricht ihn ab. Das Skript räumt ohnehin
   alles weg, was älter als ein Tag ist.

Die Stückelung ist der Grund, warum das auf Shared Hosting funktioniert:
`post_max_size` und `upload_max_filesize` müssen nur ein paar Megabyte
hergeben, nicht 500.

## Einrichtung

Die beiden Dateien liegen in `docs/media-relay/`.

1. `upload.php` und `php.ini` in einen Ordner `i7media` im
   Web-Stammverzeichnis legen (per FTP).
2. In `upload.php` oben `$SECRET` setzen, mindestens 32 zufällige Zeichen.
3. In Vercel zwei Umgebungsvariablen setzen:
   - `MEDIA_HOST_URL` = `https://<domain>/i7media/upload.php`
   - `MEDIA_HOST_SECRET` = dieselbe Zeichenkette wie in Schritt 2
4. Prüfen, beides ohne Geheimnis aufrufbar:
   - `https://<domain>/i7media/upload.php?check=1` meldet PHP-Version, die
     geltenden Grenzen, ob der Ordner beschreibbar ist und ob das Geheimnis
     gesetzt wurde. **Den Wert verrät es nie.**
   - `https://app.i7os.com/api/media-host?check=1` meldet dasselbe von unserer
     Seite aus, plus welche Variablen fehlen.

Der Unterordner `files` legt sich selbst an, samt `.htaccess`, die dort jede
Ausführung abschaltet.

## Sicherheit

- **Ohne Ticket kein Upload.** Ein fremder POST hat kein gültiges HMAC.
- **Die Endung stammt aus einer Liste** (`mp4, mov, m4v, jpg, jpeg, png, webp,
  gif`), der Name ist 32 Hex-Zeichen aus `crypto.randomUUID`. Damit ist weder
  ein Pfadwechsel noch eine `.php` im Ablageordner möglich.
- **Der Ordner führt nichts aus.** `php_flag engine off`, `RemoveHandler`,
  `Options -Indexes`, `X-Robots-Tag: noindex`.
- **Grenzen:** 8 MB je Stück, 1 GB je Datei, alles älter als 24 Stunden fliegt
  bei jeder Anfrage raus.
- **CORS** nur für `app.i7os.com` und die beiden lokalen Ports.

## Was das kostet

Der Webspace ist damit Teil des Produktivwegs für große Dateien. Ist er nicht
erreichbar, scheitert das Posten großer Videos, kleine Dateien und alles andere
laufen weiter. Für einen einzelnen Betreiber ist das vertretbar; sobald zahlende
Kunden große Videos posten, gehört das auf richtigen Objektspeicher (R2, S3)
oder Supabase Pro, wo die 50-MB-Grenze frei einstellbar ist.
