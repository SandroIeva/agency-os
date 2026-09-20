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
| API-Aufruf je Berechtigung | `instagram_business_manage_comments` hat einen. Für die übrigen sechs: Audience → Analytics einmal öffnen |
| Bildschirmaufnahmen | offen, Drehbücher unten |
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

Nur die Berechtigungen, die der Code tatsächlich anfragt. **Sieben**:
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

- **Oberfläche auf Englisch.** i7OS ist zweisprachig, also vor der Aufnahme
  `appLanguage` auf `en` stellen. Kein Sonderaufwand, nur nicht vergessen.
- Mindestens 1080p, und der Bildschirm **höchstens 1440 Punkte breit**.
- **Kein Ton.** Was erklärt werden muss, wird eingeblendet.
- Die Maus muss sichtbar sein und bedienen; Tastaturkürzel zeigen nichts.
- Zu sehen sein muss: wie jemand verbindet, wie Metas Zustimmungsfenster aussieht,
  und was danach im Produkt damit passiert.

## Die API-Aufrufe

Meta verlangt **mindestens einen erfolgreichen Aufruf pro Berechtigung, und zwar
innerhalb von 30 Tagen vor der Einreichung**. Die Spalte in der Konsole wird
täglich zusammengerechnet, ein frischer Aufruf taucht also erst am nächsten Tag
auf.

**Audience → Analytics** einmal zu öffnen erzeugt **sechs** der sieben Aufrufe.
Nachgelesen im Code, nicht angenommen:

| Aufruf beim Öffnen von Analytics | deckt ab |
|---|---|
| `/{ig-id}` mit Profilfeldern | `instagram_business_basic` |
| `/{ig-id}/insights` | `instagram_business_manage_insights` |
| `/{ig-id}/content_publishing_limit` | `instagram_business_content_publish` |
| `/me` mit id, username | `threads_basic` |
| `/{th-id}/threads_insights` (Kennzahlen und Herkunft) | `threads_manage_insights` |
| `/{th-id}/threads_publishing_limit` | `threads_content_publish` |

⚠ **`instagram_business_manage_comments` braucht eine neue Verbindung.** Ein
Instagram-Token behält die Rechte, mit denen es ausgestellt wurde. Vor der
Einreichung also Instagram einmal trennen und neu verbinden und danach
Analytics öffnen, damit `/{media-id}/comments` einen Aufruf hat.

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

## Der Text für die Prüfer

Englisch, in das Feld "How will you use this permission?" je Berechtigung.
Meta will wissen: was die App tut, wer sie nutzt, und warum die Berechtigung
dafür nötig ist.

> i7OS is a brand operating system for creative agencies. An agency connects
> the social accounts it manages, sees how its posts perform, and publishes
> from the same place it plans and creates them.
>
> - `instagram_business_basic`: to show which Instagram account is connected
>   (name, picture, follower count) so the user knows whose numbers and posts
>   they are looking at.
> - `instagram_business_manage_insights`: to show reach, impressions and
>   engagement of the connected account in our Analytics view.
> - `instagram_business_content_publish`: to publish the image, carousel or
>   reel the user created in i7OS, and to read the 24-hour publishing limit so
>   we can tell them before a post is refused.
> - `instagram_business_manage_comments`: to show the comments on the account's
>   own posts next to the numbers, so the agency can see the reaction without
>   leaving i7OS.
> - `threads_basic`, `threads_manage_insights`, `threads_content_publish`: the
>   same three things for Threads, including text-only posts, which Instagram
>   does not accept.
>
> Every connection is made by the account owner through the consent screen, is
> stored per workspace, and can be removed in Settings → Account or from the
> Meta side at any time.

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
