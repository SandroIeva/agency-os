# Google Cloud Setup — sauberes Projekt für Login, Drive & Kalender

Ziel: **ein** Google-Cloud-Projekt, in dem OAuth-Client (Login), Drive-Zugriff
(inkl. Picker) und Kalender zusammenliegen. Nur so greift die `drive.file`-
Freigabe des Pickers (sonst gibt der Drive-Download `404 File not found`).

> **Goldene Regel:** OAuth-Client, API-Key (`VITE_GOOGLE_API_KEY`) und App-ID
> (`VITE_GOOGLE_APP_ID`, = Projektnummer) **müssen aus demselben Projekt** sein.

---

## 1. Neues Projekt anlegen
1. Google Cloud Console → Projektauswahl oben → **„Neues Projekt"**.
2. Name z. B. `i7os-prod`. Anlegen, dann oben als aktives Projekt auswählen.
3. **Projektnummer notieren**: Console → „Startseite/Dashboard" → Projektinfo →
   **Projektnummer** (lange Zahl, NICHT die Projekt-ID). → wird `VITE_GOOGLE_APP_ID`.

## 2. APIs aktivieren
„APIs & Dienste" → „Bibliothek" → je aktivieren:
- **Google Drive API** (Drive-Zugriff)
- **Google Picker API** (der Datei-Auswähler — eigene API, leicht zu vergessen!)
- **Google Calendar API** (Kalender)
- *(optional)* **People API** — nur falls Profildaten via API gebraucht werden;
  für reinen Login nicht nötig.

## 3. OAuth-Zustimmungsbildschirm (Consent Screen)
„APIs & Dienste" → „OAuth-Zustimmungsbildschirm":
1. Nutzertyp **Extern**.
2. App-Name, Support-E-Mail, Entwickler-Kontakt ausfüllen.
3. **Autorisierte Domains:** `i7os.com`.
4. **Scopes** hinzufügen (müssen zu den im Code angefragten passen):
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   - `.../auth/drive.file`        ← Drive (per-Datei, NICHT der breite `drive`-Scope)
   - `.../auth/calendar.events`   ← Kalender
5. **Veröffentlichungsstatus:**
   - Zum Testen: auf **„Testing"** lassen und **eure E-Mail-Adressen als
     Testnutzer** eintragen → kein „nicht verifiziert"-Warnscreen.
   - Für Produktion: `drive.file` + `calendar.events` sind **sensible Scopes** →
     Google verlangt eine **App-Verifizierung** (Review), bevor beliebige Nutzer
     ohne Warnung zugreifen. Das rechtzeitig einplanen.

## 4. OAuth-Client-ID erstellen (für den Login)
„APIs & Dienste" → „Anmeldedaten" → „Anmeldedaten erstellen" → **OAuth-Client-ID**:
- Typ: **Webanwendung**.
- **Autorisierte JavaScript-Quellen:**
  - `https://app.i7os.com`
  - `http://localhost:5173` (Vite-Dev)
  - `http://localhost:3000` (Testumgebung)
- **Autorisierte Weiterleitungs-URIs** (das ist die **Supabase**-Callback-URL,
  NICHT die App):
  - `https://oidbemeetiawiahpweyg.supabase.co/auth/v1/callback`
- Anlegen → **Client-ID** und **Client-Secret** notieren (gehen zu Supabase, s. u.).

## 5. API-Key erstellen (für den Picker)
„Anmeldedaten" → „Anmeldedaten erstellen" → **API-Schlüssel**:
- Den Schlüssel **einschränken**:
  - „API-Einschränkungen" → nur **Google Picker API** (+ ggf. Google Drive API).
  - „Anwendungseinschränkungen" → **HTTP-Verweis-URLs**: `https://app.i7os.com/*`,
    `http://localhost:5173/*` (Vite-Dev) und `http://localhost:3000/*` (Testumgebung).
- → dieser Schlüssel wird `VITE_GOOGLE_API_KEY`.

## 6. Supabase auf den neuen Client umstellen
Supabase-Dashboard (Projekt `oidbemeetiawiahpweyg`) → **Authentication → Providers
→ Google**:
- **Client ID** und **Client Secret** aus Schritt 4 eintragen, speichern.
- (Die Scopes selbst fragt die App im Code an — siehe `signInWithOAuth`
  in `src/App.jsx` mit `drive.file calendar.events` — hier nichts zu tun.)

## 7. Vercel-Umgebungsvariablen setzen
Vercel → Projekt → Settings → **Environment Variables** (Scope **Production**,
am besten auch Preview/Development):
- `VITE_GOOGLE_API_KEY` = API-Key aus Schritt 5
- `VITE_GOOGLE_APP_ID`  = **Projektnummer** aus Schritt 1
→ danach **neu deployen** (Vite backt `VITE_*` zur Buildzeit ein — ohne Redeploy
greift die Änderung nicht).

## 8. Einmalig: neu anmelden
Bestehende Sessions tragen noch ein Token vom **alten** OAuth-Client. Nach der
Umstellung **abmelden und neu mit Google anmelden**, damit:
- das Token zum neuen Projekt/Client gehört, und
- Drive (`drive.file`) + Kalender frisch zugestimmt werden.
Erst dann hängt sich die Picker-Freigabe korrekt an → Drive-Download liefert die
Datei statt `404`.

---

## Schnelle Checkliste
- [ ] Neues Projekt, **Projektnummer** notiert
- [ ] Drive API, **Picker API**, Calendar API aktiviert
- [ ] Consent Screen: Scopes (email, profile, openid, drive.file, calendar.events) + Testnutzer
- [ ] OAuth-Client (Web) mit Supabase-Callback-URI → Client ID/Secret
- [ ] API-Key (Picker) eingeschränkt auf `app.i7os.com`
- [ ] Supabase: neue Client ID/Secret eingetragen
- [ ] Vercel: `VITE_GOOGLE_API_KEY` + `VITE_GOOGLE_APP_ID` gesetzt → Redeploy
- [ ] Ab- und neu angemeldet, Drive-Import + Kalender getestet

## Schneller Funktionstest danach
1. App neu laden (Cmd+Shift+R), mit Google **neu** einloggen.
2. **Kalender** öffnen → Termine laden? → Login/Calendar OK.
3. **Dateien → Assets → Hinzufügen → Aus Google Drive** → Bild **und** Video
   wählen → erscheinen als Asset? → Drive + Picker OK.
