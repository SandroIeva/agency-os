# Meta App Review — was i7OS einreicht, und in welcher Reihenfolge

Stand: 2026-09-20 · Quelle: https://developers.facebook.com/documentation/resp-plat-initiatives/appreview/tutorial

Die App ist seit dem 12.09.2026 im **Live-Modus**. Das ist nicht dasselbe wie
Advanced Access. Jede Berechtigung hat ihren eigenen Zugriffsgrad, und solange
dort **"Ready for testing"** steht, wirkt sie nur für Konten mit einer Rolle in
der App (Admin, Developer, Tester). Kunden, die keine Tester sind, können erst
verbinden, wenn die Berechtigung Advanced Access hat, und dafür braucht es App
Review.

## Stand am 20.09.2026

| Schritt | Stand |
|---|---|
| Business Verification | **erledigt** (Angabe des Owners, 20.09.2026) |
| App-Icon 1024 × 1024 | **erledigt**: `public/i7os-app-icon-1024.png`, aus `logo-dark.svg` gerendert, weiß auf `#15151c`, keine Meta-Marken |
| Datenschutz, Meta-Abschnitte und `#data-deletion` | **erledigt**, live auf i7os.com/privacy |
| API-Aufruf je Berechtigung | **erledigt.** Instagram und Threads wurden am 21.09. neu verbunden, beide Tokens tragen alle vier Rechte (in `instagram_connections.scopes` bzw. `threads_connections.scopes` nachgelesen). Die Konsole meldet `threads_read_replies` als **Completed** |
| Bildschirmaufnahmen | offen, Drehbücher unten. Jede braucht den OAuth-Ablauf vorne drin, sagt der Dialog ausdrücklich |
| Prüfer-Zugang | offen: Konto anlegen, Workspace muss in `INSTAGRAM_DIRECT_ORGS` stehen |
| Allowed usage, Data handling, Data protection | offen, in der Konsole auszufüllen |

### `public_profile` steht auf 0 und muss auch dort bleiben

`public_profile` gehört zum **Facebook Login** und wird jeder App automatisch
gegeben. Sie lässt sich nicht entfernen, und sie braucht kein App Review.

Die Null ist richtig und kein Fehler: i7OS benutzt keinen Facebook Login. Im
ganzen Code steht kein einziger Aufruf an `graph.facebook.com` und nirgends
`public_profile`. Instagram und Threads laufen über **Instagram Login** und
**Threads Login** mit eigenen Tokens (`graph.instagram.com`,
`graph.threads.net`), und die kennen diese Berechtigung gar nicht.

Also: nicht einreichen, nicht erwähnen, nichts dafür bauen. Sie mitzunehmen
hieße, Facebook Login einzubauen, und das wäre ein weiteres Produkt mit eigener
Prüfung, ohne dass i7OS etwas davon hätte. Eine Berechtigung, die nicht
eingereicht wird, braucht auch keinen Aufruf.

## Was eingereicht wird

Nur die Berechtigungen, die der Code tatsächlich anfragt. **Acht**:
`threads_read_replies` kam am 20.09.2026 dazu, als die Threads-Antworten in
dieselbe Kommentar-Ansicht kamen wie die Instagram-Kommentare. Jetzt und nicht
später, weil ein Token die Berechtigungen behält, mit denen es ausgestellt
wurde: nachträglich ergänzt müsste jede bestehende Verbindung neu verbunden
werden. `threads_manage_replies` (antworten, verbergen) wird **nicht**
angefragt, i7OS zeigt die Antworten nur.
Davor waren es sieben:
`threads_manage_insights` kam dazu, als die Threads-Zahlen in Audience gebaut
wurden, und `instagram_business_manage_comments`, als Analytics die
Instagram-Kommentare direkt über Meta las. `threads_profile_discovery` ist
**nicht mehr dabei**: Sie diente nur dem Benchmark, und der wurde am 17.09.2026
entfernt. Nicht einreichen, der Code fragt sie nicht mehr an.

| Berechtigung | wofür | wird ausgelöst durch |
|---|---|---|
| `instagram_business_basic` | Konto lesen | Analytics-Panel, Profil |
| `instagram_business_content_publish` | veröffentlichen | Analytics-Panel, 24-h-Kontingent · Composer |
| `instagram_business_manage_insights` | Zahlen lesen | Analytics-Panel, Kennzahlen |
| `instagram_business_manage_comments` | Kommentare lesen | Analytics → Letzte Kommentare |
| `threads_basic` | Konto lesen | Analytics-Panel, Profil |
| `threads_content_publish` | veröffentlichen | Analytics-Panel, 24-h-Kontingent · Composer |
| `threads_manage_insights` | Zahlen lesen | Analytics-Panel, Kennzahlen und Follower-Herkunft |
| `threads_read_replies` | Antworten lesen | Analytics → Letzte Kommentare |

## Die sechs Schritte, in dieser Reihenfolge

1. **Business Verification.** Braucht ein angemeldetes Unternehmen. Das ist der
   Blocker und der längste Weg; alles andere wartet darauf.
2. **App settings.** Icon **1024 × 1024**, ohne Meta-Marken, dazu Datenschutz-URL,
   Zweck, Kategorie, Kontakt.
   ✅ `public/i7os-app-icon-1024.png` ist die Datei: 1024 × 1024, das Wortzeichen
   weiß auf `#15151c`, aus `public/logo-dark.svg` gerendert und auf die echten
   Konturen zentriert. (`i7OS-Logo.png` mit 396 × 244 und der Bot-Avatar mit
   640 × 640 sind beide zu klein.)
   Datenschutz, AGB und Impressum liegen unter i7os.com und haben echten Inhalt.
3. **Allowed usage certification.**
4. **Data handling validation.**
5. **Data protection compliance.**
6. **Reviewer instructions** samt Zugangsdaten.

## Die Bildschirmaufnahmen

Eine pro Berechtigung, und eine fehlende Aufnahme ist ein benannter
Ablehnungsgrund. Metas Vorgaben, soweit sie uns betreffen:

Quelle: https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/

- **Kein Ton, und zwar wörtlich:** *"Deaktiviere das Audio. Unsere Reviewer
  werden es nicht anhören."* Nicht optional, sondern ungehört. Eine nur
  gesprochene Erklärung kommt nirgendwo an.
- **Erklärt wird trotzdem, nur schriftlich.** Meta verlangt **Annotations**,
  also Text im Bild, und Untertitel oder Tooltips *"falls deine App nicht auf
  Englisch verfügbar ist oder falls Teile deiner App nicht selbsterklärend
  sind"*. Daher kommt der Widerspruch, den man beim Lesen zu finden glaubt:
  erklären ja, sprechen nein. Zwei bis vier kurze Einblendungen je Clip an den
  entscheidenden Stellen reichen.
- **Oberfläche auf Englisch.** i7OS ist zweisprachig, also vor der Aufnahme
  `appLanguage` auf `en` stellen. Das erspart auch die meisten Untertitel.
- Mindestens 1080p, und der Bildschirm **höchstens 1440 Punkte breit**.
- **Mauszeiger vergrößern**, nicht nur sichtbar lassen: *"Erhöhe die
  Cursorgröße deiner Maus, damit wir sie leichter sehen können."*
  Tastaturkürzel zeigen nichts und bedienen deshalb nicht.
- Zu sehen sein muss der **vollständige Login- und OAuth-Ablauf**, von
  abgemeldet bis verbunden, und danach, was im Produkt damit passiert.

## Die API-Aufrufe

Meta verlangt **mindestens einen erfolgreichen Aufruf pro Berechtigung, und zwar
innerhalb von 30 Tagen vor der Einreichung**. Die Spalte in der Konsole wird
täglich zusammengerechnet, ein frischer Aufruf taucht also erst am nächsten Tag
auf.

**Audience → Analytics** einmal zu öffnen erzeugt **sechs** der acht Aufrufe.
Die beiden übrigen, die Kommentare und die Antworten, entstehen in der Ansicht
**Letzte Kommentare** auf derselben Seite.
Nachgelesen im Code, nicht angenommen:

| Aufruf beim Öffnen von Analytics | deckt ab |
|---|---|
| `/{ig-id}` mit Profilfeldern | `instagram_business_basic` |
| `/{ig-id}/insights` | `instagram_business_manage_insights` |
| `/{ig-id}/content_publishing_limit` | `instagram_business_content_publish` |
| `/me` mit id, username | `threads_basic` |
| `/{th-id}/threads_insights` (Kennzahlen und Herkunft) | `threads_manage_insights` |
| `/{th-id}/threads_publishing_limit` | `threads_content_publish` |

⚠ **Kommentare und Antworten brauchen je eine neue Verbindung.** Ein Token
behält die Rechte, mit denen es ausgestellt wurde. Vor der Einreichung also
Instagram **und** Threads einmal trennen und neu verbinden, dann die Ansicht
Letzte Kommentare öffnen: `/{media-id}/comments` und `/{th-media-id}/replies`
haben danach je einen Aufruf.

**Die beiden Zähler stehen aus einem harmlosen Grund weit auseinander**, und
das sah am 21.09. nach einem Fehler aus: 468 bei `threads_read_replies` gegen 1
bei `instagram_business_manage_comments`. Threads fragt JEDEN Beitrag der
letzten vier Wochen ab, bis zu zehn, ob jemand geantwortet hat oder nicht.
Instagram fragt nur die, unter denen wirklich etwas steht, plus den neuesten.
Ein Konto ohne Kommentare erzeugt dort also genau einen Aufruf je Öffnen. Eins
genügt auch: Meta verlangt MINDESTENS einen in den 30 Tagen davor, nicht viele.
Dazu ist der Zähler eine Tagessumme mit bis zu 24 Stunden Verzug, was die
Konsole im Einreichungsdialog selbst sagt.

Beide fragen den **neuesten Beitrag immer** ab, auch wenn nichts darunter
steht. Sonst entsteht bei einem Konto, unter dem niemand schreibt, nie ein
Aufruf, und genau daran hing `instagram_business_manage_comments` lange auf
null. Ein Konto ohne Kommentare erzeugt also genau einen Aufruf pro Öffnen der
Ansicht; mit Kommentaren sind es bis zu zehn.

⚠ Und die Voraussetzung dafür, dass Analytics überhaupt etwas aufruft: der
Bereich zeigte bis zum 14.09.2026 die Seite "Verbinde deine Kanäle", sobald
**Zernio** keinen Account hatte, und das Meta-Panel lag in dem Zweig, der dann
nicht gezeichnet wurde. Ein Workspace, der Instagram und Threads von Zernio
weggeholt hat, löste damit gar keinen Aufruf aus.

## Die Drehbücher, eine Aufnahme je Berechtigung

Vorher: Sprache auf Englisch, Fenster höchstens 1440 Punkte breit, kein Ton,
Maus sichtbar. Jede Aufnahme zeigt denselben Anfang, damit der Prüfer den Weg
sieht, und danach das, was die jeweilige Berechtigung tut.

**Gemeinsamer Anfang (einmal aufnehmen, in jede Aufnahme schneiden):**
Einstellungen → Account → Integrationen → bei Instagram bzw. Threads auf
**Connect** → Metas Zustimmungsfenster mit den angefragten Berechtigungen →
zurück in i7OS, die Zeile zeigt das verbundene Konto.

| # | Berechtigung | Was die Aufnahme danach zeigt |
|---|---|---|
| 1 | `instagram_business_basic` | Audience → Analytics: das verbundene Instagram-Konto mit Name, Bild und Followerzahl |
| 2 | `instagram_business_manage_insights` | Dieselbe Seite: Reichweite, Impressionen und die übrigen Kennzahlen, einmal den Zeitraum wechseln |
| 3 | `instagram_business_content_publish` | Composer: Bild wählen, Text schreiben, Instagram als Kanal, veröffentlichen, danach der Beitrag im Konto. Dazu das 24-Stunden-Kontingent in Analytics |
| 4 | `instagram_business_manage_comments` | Analytics → Letzte Kommentare: die Kommentare unter den eigenen Beiträgen |
| 5 | `threads_basic` | Audience → Analytics: das verbundene Threads-Konto mit Name und Followerzahl |
| 6 | `threads_manage_insights` | Dieselbe Seite: Aufrufe, Likes und die Herkunft der Follower |
| 7 | `threads_content_publish` | Composer: reinen Textbeitrag auf Threads veröffentlichen, danach der Beitrag im Konto |
| 8 | `threads_read_replies` | Analytics → Letzte Kommentare: die Antworten unter den eigenen Threads-Beiträgen, in derselben Liste wie die Instagram-Kommentare |

## Der Text für die Prüfer, je Berechtigung

Die Konsole fragt pro Berechtigung einzeln: *"Please provide a detailed
description of how your app uses the permission or feature requested, how it
adds value for a person using your app, and why it's necessary for app
functionality."* Also acht Texte, nicht einer.

Jeder folgt derselben Gliederung, weil Meta genau danach fragt: was die App
damit tut (mit dem Endpunkt beim Namen), was der Mensch davon hat, und warum es
ohne die Berechtigung nicht geht. Der erste und der letzte Absatz sind überall
gleich, dazwischen steht das Eigene.

**Immer als erster Absatz:**

```
i7OS is a brand operating system used by creative agencies to plan, create,
publish and review the content they produce for the accounts they manage.
```

**Immer als letzter Absatz:**

```
Every connection is made by the owner of the account through the consent
screen, is stored per workspace, and can be removed at any time in i7OS under
Settings, or from the Meta side. Data is shown only to members of the workspace
that owns the connection, is never shared with third parties, never used for
advertising, and is deleted when the connection is removed.
```

⚠ Im selben Dialog steht: *"make sure to incorporate the OAuth authorization
flow in the screencast"*. Jede der acht Aufnahmen zeigt also vorne das
Verbinden samt Zustimmungsfenster, nicht nur eine davon. Darum der gemeinsame
Anfang weiter unten.

Und der Haken darunter ("I agree that any data I receive through … will be used
in accordance with the allowed usage") gehört zu jeder Einreichung dazu.

### `instagram_business_basic`

```
After the user connects their own Instagram professional account through the
Instagram Login consent screen, i7OS reads the account's id, username, name,
profile picture and follower count and shows them at the top of our Analytics
view and beside every place the account appears, for example when choosing
which account a post goes to.

Value for the user: an agency manages several accounts, and the numbers and
posts on the screen are meaningless unless it is obvious whose they are. The
name and the picture are what make that obvious at a glance.

Why it is necessary: it is the only way to learn which account the token
belongs to. Without it we would have to ask the user to type in their own
handle and trust that it matches the account they just authorised.
```

### `instagram_business_manage_insights`

```
We call GET /{ig-user-id}/insights for the connected account and show reach,
views, total interactions, likes, comments, shares, saves and accounts engaged
in our Analytics view, over a period the user picks, together with the best
performing recent posts.

Value for the user: an agency has to report on what it publishes. Having the
numbers in the same tool as the plan and the post means the next decision is
made where the evidence already is, instead of in a separate export.

Why it is necessary: these figures exist nowhere else. Likes and comment counts
can be counted from the media list, but reach, views, saves and accounts
engaged are only available through the insights endpoint.
```

### `instagram_business_content_publish`

```
i7OS has a composer in which the user writes the caption and prepares the
picture, carousel, reel or story. When they publish, we create a media
container through POST /{ig-user-id}/media, poll its status, and publish it
with POST /{ig-user-id}/media_publish. We also read
GET /{ig-user-id}/content_publishing_limit and show the remaining 24 hour quota
in Analytics.

Value for the user: the whole point of the product is that planning, creating
and publishing happen in one place. Publishing straight from i7OS removes the
step of exporting a file, opening Instagram and retyping the caption, which is
where captions and hashtags get lost.

Why it is necessary: there is no other way to publish to Instagram
programmatically. The quota call is part of the same need: without it we can
only let a post fail, instead of telling the user beforehand that they have
reached the limit.
```

### `instagram_business_manage_comments`

```
We call GET /{ig-media-id}/comments for the connected account's own recent
posts and show the comments, and the replies under them, in a panel called
"Latest comments" in our Analytics view, in one list together with the Threads
replies. We read the comment text, its timestamp, its like count and the
author's username and profile picture.

Value for the user: an agency managing several accounts otherwise has to open
the Instagram app for each account to see whether anyone reacted. In i7OS the
reaction sits beside the numbers for the same post, so the person writing the
next post can see what the last one triggered.

Why it is necessary: the media list reports how many comments a post has, but
not what they say, and what they say is the part the user needs.

Scope of use: read only. i7OS never writes, hides or deletes a comment.
```

### `threads_basic`

```
After the user connects their own Threads account through the Threads Login
consent screen, i7OS reads the account's id, username, name, profile picture
and follower count and shows them at the top of our Analytics view and beside
every place the account appears, for example when choosing which account a post
goes to.

Value for the user: an agency manages several accounts, and the numbers and
posts on the screen are meaningless unless it is obvious whose they are.

Why it is necessary: it is the only way to learn which account the token
belongs to, and it is the prerequisite for every other Threads call, since they
all address the account by its id.
```

### `threads_manage_insights`

```
We call GET /{threads-user-id}/threads_insights and
GET /{threads-media-id}/insights and show views, likes, replies, reposts,
quotes, follower count and the countries and cities the followers come from, in
our Analytics view, over a period the user picks, together with the best
performing recent posts.

Value for the user: an agency has to report on what it publishes, and Threads
is now part of that report. Having the figures beside the Instagram ones means
both networks are read in one place.

Why it is necessary: these figures exist nowhere else. The posts list carries
no performance data at all, so without this permission the Threads part of the
view would be empty.
```

### `threads_content_publish`

```
i7OS has a composer in which the user writes the post and prepares any picture
or video. When they publish, we create a container through
POST /{threads-user-id}/threads, poll its status, and publish it with
POST /{threads-user-id}/threads_publish, building a carousel child by child
where the user made one. We also read
GET /{threads-user-id}/threads_publishing_limit and show the remaining 24 hour
quota in Analytics.

Value for the user: planning, creating and publishing happen in one place.
Threads also accepts text only posts, which Instagram does not, so for many
agencies it is the network where the written idea goes first.

Why it is necessary: there is no other way to publish to Threads
programmatically. The quota call is part of the same need: without it we can
only let a post fail, instead of warning the user beforehand.
```

### `threads_read_replies`

```
We call GET /{threads-media-id}/replies for the connected user's own recent
posts and show the replies in one list, next to the Instagram comments on the
same screen, in a panel called "Latest comments" in our Analytics view. We read
the reply text, its timestamp, the author's username and profile picture, and
whether the reply is owned by the connected user, so the list can mark the
account's own answers.

Value for the user: an agency managing several accounts otherwise has to open
the Threads app for each account to find out whether anyone reacted. In i7OS
the reaction sits directly beside the numbers for the same post.

Why it is necessary: the insights endpoint reports how many replies a post has,
but not what they say, and what they say is the part the user needs.

Scope of use: read only. i7OS never writes, hides, deletes or approves a reply,
which is why we do not request threads_manage_replies.
```

## User data deletion

Das Feld in den App-Einstellungen nimmt entweder einen Callback oder eine Seite
mit Anleitung. Wir nehmen die **Anleitung**, aus einem konkreten Grund: der
Callback wird mit dem **App**-Secret signiert, und wir halten nur die Instagram-
und die Threads-Produkt-Secrets. Ein drittes Secret nur hierfür wäre ein
Schlüssel mehr zu verwahren, für nichts.

Die Produkt-Callbacks bei Instagram und Threads bleiben davon unberührt. Sie
sind auch die, die tatsächlich eine Zeile löschen.

Die Anleitung gehört in die bestehende Datenschutzerklärung und nicht auf eine
eigene Seite, sonst laufen zwei Texte über dieselbe Sache auseinander. Der
fertige Wortlaut liegt in `docs/privacy-meta-sections.md`; eingetragen wird
dann:

```
https://www.i7os.com/privacy#data-deletion
```

✅ Erledigt seit dem 20.09.2026: Die Datenschutzerklärung nennt Meta, Instagram
und Threads, und `#data-deletion` erklärt die drei Wege, eine Verbindung und
ihre Daten löschen zu lassen (in i7OS, über Meta, per E-Mail).

## Der Prüfer muss hineinkommen

"Inaccessible app" und "fake test accounts" sind zwei der benannten
Ablehnungsgründe, und ein Prüfer, der nicht hineinkommt, lässt die **gesamte**
Einreichung durchfallen, nicht nur eine Berechtigung.

Gebraucht wird ein echtes Konto bei uns, dessen Workspace in
`INSTAGRAM_DIRECT_ORGS` steht (Threads fällt auf dieselbe Liste zurück). Ohne
diesen Eintrag sieht der Prüfer die Verbinden-Zeile gar nicht.
