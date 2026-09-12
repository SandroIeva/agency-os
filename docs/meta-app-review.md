# Meta App Review — was i7OS einreicht, und in welcher Reihenfolge

Stand: 2026-09-12 · Quelle: https://developers.facebook.com/documentation/resp-plat-initiatives/appreview/tutorial

Die App ist seit dem 12.09.2026 im **Live-Modus**. Das ist nicht dasselbe wie
Advanced Access. Jede Berechtigung hat ihren eigenen Zugriffsgrad, und solange
dort **"Ready for testing"** steht, wirkt sie nur für Konten mit einer Rolle in
der App (Admin, Developer, Tester). Kunden, die keine Tester sind, können erst
verbinden, wenn die Berechtigung Advanced Access hat, und dafür braucht es App
Review.

## Was eingereicht wird

Nur die Berechtigungen, die der Code tatsächlich anfragt. **Sieben**, nicht fünf:
`threads_manage_insights` kam dazu, als die Threads-Zahlen in Audience gebaut
wurden, und `threads_profile_discovery`, als der Benchmark für Threads von
SocialCrawl auf Meta umgestellt wurde. SocialCrawl rechnet pro Aufruf ab, Meta
liefert öffentliche Threads-Profile kostenlos; für LinkedIn, TikTok, X,
Pinterest und YouTube bleibt es bei SocialCrawl, weil Meta dazu nichts sagt.

Ein Token behält die Berechtigungen, mit denen es ausgestellt wurde. Der Scope
wurde erweitert, also muss jede **vor** dieser Änderung angelegte Threads-
Verbindung einmal neu verbunden werden. Heute betrifft das nur @i7os.app; nach
der Freigabe wäre es jeder Kunde, weshalb Erweiterungen vor die Einreichung
gehören und nicht dahinter. "Requesting future
permissions" ist ein benannter Ablehnungsgrund, und in der Konsole stehen bei
Threads noch `threads_keyword_search` und `threads_manage_insights` herum, die
wir nicht benutzen.

| Berechtigung | wofür | wird ausgelöst durch |
|---|---|---|
| `instagram_business_basic` | Konto lesen | Analytics-Panel, Profil |
| `instagram_business_content_publish` | veröffentlichen | Analytics-Panel, 24-h-Kontingent · Composer |
| `instagram_business_manage_insights` | Zahlen lesen | Analytics-Panel, Kennzahlen |
| `threads_basic` | Konto lesen | Analytics-Panel, Profil |
| `threads_content_publish` | veröffentlichen | Analytics-Panel, 24-h-Kontingent · Composer |
| `threads_manage_insights` | Zahlen lesen | Analytics-Panel, Kennzahlen und Follower-Herkunft |
| `threads_profile_discovery` | fremde öffentliche Profile | Audience → Benchmark, Plattform Threads |

## Die sechs Schritte, in dieser Reihenfolge

1. **Business Verification.** Braucht ein angemeldetes Unternehmen. Das ist der
   Blocker und der längste Weg; alles andere wartet darauf.
2. **App settings.** Icon **1024 × 1024**, ohne Meta-Marken, dazu Datenschutz-URL,
   Zweck, Kategorie, Kontakt.
   ⚠ `public/i7OS-Logo.png` ist **396 × 244** und damit unbrauchbar dafür.
   `public/i7os-bot-avatar.png` ist 640 × 640, ebenfalls zu klein. Es braucht eine
   neue Datei.
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

Das ist der Grund, warum das Analytics-Panel alle fünf Berechtigungen berührt:
einmal **Audience → Analytics** öffnen erzeugt je einen echten Aufruf. Die
Einstellungen-Seite tut das ausdrücklich **nicht**, sie liest nur unsere eigene
Datenbank.

Also: kurz vor der Einreichung einmal öffnen, nicht Wochen vorher.

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

⚠ Die Datenschutzerklärung nennt Meta, Instagram und Threads bisher an keiner
Stelle. Das ist für das Review zu wenig, unabhängig von der Löschung.

## Der Prüfer muss hineinkommen

"Inaccessible app" und "fake test accounts" sind zwei der benannten
Ablehnungsgründe, und ein Prüfer, der nicht hineinkommt, lässt die **gesamte**
Einreichung durchfallen, nicht nur eine Berechtigung.

Gebraucht wird ein echtes Konto bei uns, dessen Workspace in
`INSTAGRAM_DIRECT_ORGS` steht (Threads fällt auf dieselbe Liste zurück). Ohne
diesen Eintrag sieht der Prüfer die Verbinden-Zeile gar nicht.
