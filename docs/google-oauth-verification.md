# Google OAuth Verification — Einreich-Checkliste (i7 OS)

Ziel: die App aus dem **Testmodus** in den **verifizierten Produktivbetrieb** bringen,
damit beliebige Nutzer sich anmelden können — **ohne** „nicht verifiziert"-Warnung
und **ohne** den 7-Tage-Token-Ablauf des Testmodus.

## Gute Ausgangslage
Eure Scopes sind **„sensibel", aber nicht „restricted"**:
- `…/auth/userinfo.email`, `…/auth/userinfo.profile`, `openid` → Basis, unkritisch
- `…/auth/drive.file` → **sensibel**
- `…/auth/calendar.events` → **sensibel**

→ Ihr braucht die normale **OAuth-Verifizierung**, aber **NICHT** das jährliche,
kostenpflichtige **CASA-Sicherheits-Audit** (das fällt nur bei *restricted* Scopes
wie vollem Drive oder Gmail an). Spart Zeit & Geld.

---

## A. Voraussetzungen, die VOR dem Einreichen stehen müssen

### 1. Domain-Inhaberschaft
- [ ] `i7os.com` in der **Google Search Console** verifiziert (mit demselben Google-Konto, das das Cloud-Projekt besitzt).
- [ ] Im OAuth-Consent-Screen unter **Branding → Autorisierte Domains** ist `i7os.com` eingetragen.

### 2. Branding (OAuth-Zustimmungsbildschirm)
- [ ] **App-Name:** i7 OS
- [ ] **App-Logo** (quadratisch, hochgeladen)
- [ ] **Startseite:** `https://app.i7os.com` (oder `https://i7os.com`)
- [ ] **Datenschutzerklärung-URL** (auf `i7os.com`, öffentlich erreichbar)
- [ ] **Nutzungsbedingungen-URL** (auf `i7os.com`)
- [ ] **Support-E-Mail** + Entwickler-Kontakt

### 3. Startseite (Homepage)
- [ ] Öffentlich erreichbar, beschreibt **was die App macht**.
- [ ] Verlinkt sichtbar die **Datenschutzerklärung**.
- [ ] Repräsentiert die App akkurat (keine Platzhalter).

### 4. Datenschutzerklärung — Pflichtinhalte
- [ ] Erklärt, **welche Google-Nutzerdaten** abgerufen werden (Profil/E-Mail, Drive-Dateien, Kalendertermine).
- [ ] Erklärt **wofür**, **wie gespeichert** und **mit wem geteilt**.
- [ ] Enthält die **„Limited Use"-Zusage**: dass die Nutzung der Google-Daten den
      *Google API Services User Data Policy (inkl. Limited Use)* entspricht.
- [ ] Liegt auf **derselben Domain** wie die Startseite.

---

## B. Scope-Begründungen (Textvorlage zum Anpassen)

Für jeden sensiblen Scope verlangt Google eine Begründung. Entwürfe:

**`drive.file`**
> i7 OS lets users attach their own files (images/videos) from Google Drive to their
> workspace via the Google Picker, and save generated assets back to Drive. We use
> the per-file `drive.file` scope so the app can only access the specific files the
> user explicitly selects — never their entire Drive.

**`calendar.events`**
> i7 OS shows the user's upcoming events inside the workspace and lets them create
> and update meeting events. `calendar.events` is the minimal scope needed to read
> and write the events the user works with; we do not access other calendars or
> calendar settings.

Grundsatz, den Google hören will: **minimale Scopes, nur was die Funktion braucht.**

---

## C. Demo-Video (YouTube, darf „nicht gelistet" sein)

Pflicht bei sensiblen Scopes. Muss zeigen:
- [ ] Den **OAuth-Zustimmungsbildschirm** der **Produktiv**-App (echter Flow).
- [ ] In der **Adressleiste die OAuth-Client-ID** während des Consent (Google
      gleicht ab, dass das Video zu eurem Client gehört).
- [ ] Wie **jeder** sensible Scope genutzt wird:
  - **Drive:** „Hinzufügen → Aus Google Drive" → Datei wählen → erscheint als Asset.
  - **Kalender:** Termine ansehen + einen Termin anlegen/ändern.
- [ ] Sprache am besten **Englisch** (Untertitel/Erzählung).

---

## D. Einreichen

1. Google Auth Platform → **„Überprüfungscenter"** (Verification Center).
2. Veröffentlichungsstatus auf **„In Produktion"** setzen → Verifizierung anstoßen.
3. Begründungen + Video-Link + (falls gefragt) Domains/Justifications eintragen.
4. Absenden.

**Dauer:** sensible Scopes typischerweise **einige Tage bis Wochen**. Während der
Prüfung bleibt die App für Testnutzer nutzbar; ihr könnt normal weiterentwickeln.

---

## E. Supabase-spezifischer Hinweis (wichtig)

Der Consent-Screen zeigt aktuell die Supabase-Domain
`oidbemeetiawiahpweyg.supabase.co` (weil das Login dort durchläuft).
- Für die Verifizierung zählen vor allem **eure** verifizierten Domains
  (Startseite/Datenschutz auf `i7os.com`) — das geht meist auch mit der
  supabase.co-Redirect-URL durch.
- Wer es **vollständig gebrandet** will (überall `i7os.com`): **Supabase Custom
  Domain** (kostenpflichtiges Add-on) → Auth läuft auf z. B. `auth.i7os.com`.
  ⚠️ Danach **Redirect-URI in Google + Supabase anpassen** und neu testen.
  Am besten **vor** der Einreichung entscheiden, damit das Video die finale Domain zeigt.

---

## Schnellüberblick
- [ ] i7os.com in Search Console verifiziert
- [ ] Branding komplett (Name, Logo, Startseite, Support)
- [ ] Datenschutz + AGB live auf i7os.com (inkl. Limited-Use-Zusage)
- [ ] Startseite live & aussagekräftig
- [ ] Scope-Begründungen geschrieben
- [ ] Demo-Video (Consent + Drive + Kalender) auf YouTube
- [ ] (optional) Custom Domain entschieden
- [ ] Im Überprüfungscenter eingereicht
