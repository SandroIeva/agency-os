# TikTok, direkt

Stand: 2026-09-15 · Verbinden steht, Posten wartet auf die Freigabe

Der vierte direkte Kanal nach Instagram, Threads und Pinterest. Eigener Client,
eigene Scopes, eigene Prüfung, deshalb `api/tiktok.js` und nicht ein Modus in
einer vorhandenen Datei.

## Was steht

| Sache | Zustand |
|---|---|
| `tiktok_connections` | angelegt, RLS an, null Richtlinien, nur über den Dienstschlüssel |
| `api/tiktok.js` | Edge, zählt nicht gegen die 12 Node-Funktionen (Stand 11) |
| `/tiktok/callback` | in `vercel.json`, und `tiktok` steht in `RESERVED_SLUGS` |
| Verbinden und Trennen | in den Einstellungen, neben Instagram und Threads |
| Domainbestätigung | `app.i7os.com` und `i7os.com`, je Umgebung ein eigener Schlüssel |
| Composer | TikTok steht als Kanal drin, mit den Einstellungen, die TikTok vorschreibt |
| Analytics | eigene Pille, Beiträge in der Top-Liste, Anteil an den Kacheln, wartet auf die Scopes |
| Posten | gebaut, aber nicht benutzbar, siehe unten |

Umgebungsvariablen: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`. Die Freigabeliste
`TIKTOK_DIRECT_ORGS` fällt auf `INSTAGRAM_DIRECT_ORGS` zurück, so wie Threads es
auch tut. Es ist derselbe Workspace.

## Warum das Posten noch nicht geht

Zwei Sätze aus TikToks eigener Dokumentation, und sie schließen die Frage ab.

Aus **Add a Sandbox**:

> Sandbox mode does not offer access to Content Posting API for public videos
> or Data Portability API.

Aus **Content Posting API, Get Started**:

> Your app must be approved for the `video.publish` scope.

Das Produkt hinzuzufügen und Direct Post einzuschalten genügt also nicht. Der
Scope braucht eine Freigabe auf App-Ebene, und eine Sandbox bekommt sie nicht.
Dasselbe Muster wie Metas Advanced Access: jetzt bauen, bei der Prüfung
einschalten.

Dazu kommt, auch nach der Freigabe relevant: solange die App nicht auditiert
ist, sind veröffentlichte Beiträge auf privat beschränkt.

## Was eine Sandbox hergibt: genau einen Scope

Gemessen, nicht angenommen. Von vier gewünschten Berechtigungen wird in der
Sandbox genau eine gewährt:

| Scope | wofür | Sandbox |
|---|---|---|
| `user.info.basic` | wer es ist | **ja** |
| `user.info.stats` | Follower und Kontosummen, für Analytics | nein |
| `video.list` | Beiträge mit ihren Zahlen, für Top Posts | nein |
| `video.publish` | der Direktpost, für den Composer | nein |

Jede Kombination, die irgendeine der unteren drei enthält, wird von der
Zustimmungsseite abgewiesen, und zwar mit `scope` als einzigem Grund. `basic`
allein verbindet jedes Mal. Es liegt nicht daran, welcher Zusatz-Scope es ist,
und auch nicht am Komma dazwischen, beides wurde probiert.

Die Display-API-Scopes sitzen also hinter derselben Tür wie das Veröffentlichen,
obwohl sie nicht zur Content Posting API gehören.

**Umschalten nach der Freigabe:** `SCOPES` in `api/tiktok.js` auf `SCOPES_FULL`
setzen, das steht direkt darüber. Dann verbindet jeder einmal neu, weil ein
Token die Scopes behält, mit denen es ausgestellt wurde. Analytics und Composer
sind bereits gegen den vollen Satz gebaut und zeigen ohne ihn nur einen Hinweis.

## Die fünf Messungen, damit sie niemand wiederholt

Die Zustimmungsseite lehnte ab und nannte als Grund immer nur `scope`.

1. `basic` + `publish` → abgelehnt.
2. Eine Sonde auf die Authorize-Adresse → nutzlos. TikTok schickt **jede**
   Anfrage zuerst zur Anmeldung und prüft den Scope erst danach. Deshalb sagt
   der Fehler so wenig und kommt so spät. Die Sonde steht noch in der Datei, mit
   dem Vermerk, was sie nicht kann.
3. `basic` allein → verbindet auf Anhieb. Die ganze Strecke funktioniert.
4. Direct Post am Produkt eingeschaltet, `basic` + `publish` → wieder
   abgelehnt. Der Schalter ist nicht das Tor.
5. `basic` + `upload`, und dasselbe noch einmal mit literalem Komma statt
   `%2C` → abgelehnt.

Die Kommatheorie entstand aus der Beobachtung "ein Scope geht, zwei gehen nie"
und war falsch. Die Variable war die ganze Zeit der Video-Scope.

**Die Lehre ist nicht der Kommafehler.** Messung 4 trug die Antwort schon, und
danach gingen drei weitere Versuche auf eine Vermutung hinaus, statt in die
Dokumentation zu sehen, die der Besitzer am Ende selbst heraussuchen musste.

## Zwei Dinge, die TikTok anders macht als Meta

**Das Zugangstoken lebt 24 Stunden**, das Refresh-Token ein Jahr. Jeder Aufruf
geht durch `usableToken` und erneuert, sobald weniger als eine Stunde bleibt.
Scheitert das, wird der Grund in die Zeile geschrieben, damit die Einstellungen
"neu verbinden" sagen können, statt beim nächsten Posten stumm zu scheitern.

**Video und Foto laufen gegenläufig.**

- Ein Video wird HOCHGELADEN. `publish-init` gibt eine Upload-Adresse zurück,
  und der Browser legt die Bytes selbst dort ab. Nichts Großes geht durch die
  Edge-Funktion, denn genau das ist bei Instagram schon in die Zeitgrenze
  gelaufen.
- Fotos werden GEZOGEN. TikTok holt sie selbst, und zwar nur von einer Domain,
  die im Portal bestätigt ist. Unsere Medien liegen auf Supabase-Storage, das
  ist keine. Der Weg dorthin ist `api/img-proxy`: der liegt auf `app.i7os.com`,
  und diese Domain ist bestätigt. Dafür war die Bestätigungsdatei gut, über die
  Anmeldung hinaus.

Ein einzelnes Standbild gibt es im Feed nicht. Es ist immer der Foto-Container,
bis zu 35 Bilder, also ist ein Bild ein Karussell aus einem. Musik kommt per
Vorgabe dazu, weil still auf TikTok der Ausnahmefall ist.

## Der Composer

Steht. TikTok ist der dritte direkte Anbieter neben Instagram und Threads, und
der Ablauf läuft sichtbar durch: verbinden, Medium wählen, einstellen,
veröffentlichen.

TikTok verlangt, dass der Composer vor jedem Beitrag `creator_info` abfragt und
das Ergebnis auch anzeigt: die für dieses Konto erlaubten Sichtbarkeiten, und
ob Kommentare, Duette und Stitches zugelassen sind. Das ist keine Kür, es wird
in der Prüfung kontrolliert. Der Composer zeigt genau die Antwort und nichts
sonst: ein Schalter für etwas, das TikTok abgeschaltet hat, wäre eine Lüge mit
einem Kästchen dran.

Solange `creator_info` nicht geantwortet hat, wird die Anfrage **hier**
abgelehnt statt bei TikTok. Eine geratene Sichtbarkeit wäre ein Beitrag unter
einer Einstellung, die niemand gewählt hat.

**Kein Mock.** Der Vorschlag lag auf dem Tisch, den Publish-Aufruf im
Entwicklungsmodus mit einer Erfolgsantwort abzufangen. Eine Attrappe, die
Erfolg meldet, ist genau die Art Code, die versehentlich in Produktion landet
und dann einen Beitrag als veröffentlicht meldet, den es nie gab. Der Ablauf
ist stattdessen bis zum letzten Klick sichtbar, und dort steht ehrlich, dass
TikTok noch nicht freigegeben hat.

## Die Reihenfolge von hier

1. App für die Prüfung einreichen, damit `video.publish` freigegeben wird. Das
   ist der einzige Blocker, und er liegt nicht im Code.
2. Nach der Freigabe `SCOPES` um `video.publish` erweitern und einmal neu
   verbinden. Ein Token behält die Scopes, mit denen es ausgestellt wurde, also
   reicht das Erweitern der Liste allein nicht.
3. Dann erst kann das Posten überhaupt zum ersten Mal gegen die echte
   Schnittstelle laufen. Bis dahin ist keine einzige Zeile davon erprobt, und
   das gehört zur Erwartung: Video-Upload, Foto-Karussell und die Abfrage der
   Sichtbarkeiten sind nach der Dokumentation gebaut, nicht nach einem Lauf.
