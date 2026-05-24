# Datenschutzerklärung

**Stand: November 2025**

## 1. Verantwortlicher

Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:

**Sandro Ieva**
Arnimstrasse 13
23566 Lübeck
Deutschland

E-Mail: support@i7os.com

## 2. Anwendungsbereich

Diese Datenschutzerklärung gilt für die Web-Anwendung „i7 OS" (im Folgenden „Anwendung" oder „Dienst"), erreichbar unter `alpha.i7os.com` sowie deren Subdomains. Sie informiert dich darüber, welche personenbezogenen Daten wir verarbeiten, zu welchem Zweck wir das tun und welche Rechte dir zustehen.

## 3. Begriffsdefinitionen

Wir verwenden die Begriffe entsprechend Art. 4 DSGVO. „Personenbezogene Daten" sind alle Informationen, die sich auf eine identifizierte oder identifizierbare Person beziehen.

## 4. Welche Daten verarbeiten wir?

### 4.1 Account-Daten

Wenn du dich registrierst (über Google OAuth), verarbeiten wir:

- Vor- und Nachname
- E-Mail-Adresse
- Profilbild (sofern bei Google hinterlegt)
- Eindeutige User-ID (von Google bzw. unserem Auth-Provider)

### 4.2 Inhalte, die du in der Anwendung erstellst

Wir speichern Inhalte, die du selbst in der Anwendung anlegst:

- Workspace- und Projekt-Informationen
- Chat-Nachrichten und Konversationen
- Aufgaben (Tasks) und Notizen
- Brand-Profile (Name, Logos, Farben, Beschreibungen)
- Datei-Uploads (Logos, PDFs, ZIP-Archive)
- Personas, Strategie-Notizen, Channel-Verknüpfungen

### 4.3 Google-Integrations-Daten

Wenn du der Anwendung Zugriff auf dein Google-Konto gewährst, verarbeiten wir folgende Daten aus den von uns angeforderten Scopes:

- **`auth/calendar.events`**: Lesen, Erstellen, Ändern und Löschen von Terminen in deinem primären Google-Kalender — ausschließlich auf deine aktive Aktion hin
- **`auth/drive.file`**: Zugriff auf Dateien, die von dieser Anwendung erstellt oder explizit von dir freigegeben wurden — die Anwendung sieht keine anderen Dateien in deinem Drive

Wir speichern dauerhaft nur Referenzen (z. B. Datei-IDs, Termin-IDs) zu Inhalten, mit denen du in der Anwendung arbeitest, nicht die vollständigen Daten.

### 4.4 Technische Daten

Bei der Nutzung der Anwendung verarbeiten wir automatisch:

- IP-Adresse (während der Sitzung, nicht dauerhaft gespeichert)
- Zugriffszeitpunkte
- Browser- und Geräteinformationen
- Authentifizierungs-Tokens (verschlüsselt gespeichert)
- Push-Notification-Endpoints (falls aktiviert, siehe Abschnitt 9)

### 4.5 Cookies und LocalStorage

Wir verwenden technisch notwendige Cookies und Browser-LocalStorage für:

- Authentifizierung (Session-Tokens)
- Sprach- und Theme-Präferenzen
- App-State (geöffnete Views, Filter, Zoom)

Wir setzen **keine** Tracking-Cookies, keine Analyse-Cookies und keine Werbe-Cookies.

## 5. Zwecke und Rechtsgrundlagen der Verarbeitung

| Zweck | Rechtsgrundlage |
|---|---|
| Bereitstellung des Dienstes (Login, Inhalte speichern, anzeigen) | Art. 6 Abs. 1 lit. b DSGVO (Vertrag) |
| Google-Integrationen (Kalender, Drive) | Art. 6 Abs. 1 lit. a DSGVO (Einwilligung — OAuth-Zustimmung) |
| Versand transaktionaler E-Mails (Einladungen, Setup-Mails) | Art. 6 Abs. 1 lit. b DSGVO (Vertrag) |
| Transaktionale Push-Benachrichtigungen | Art. 6 Abs. 1 lit. a DSGVO (Einwilligung beim Aktivieren) |
| Sicherheit, Missbrauchsvermeidung | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) |
| Auftragsverarbeitung durch technische Dienstleister | Art. 28 DSGVO |

## 6. Empfänger und Auftragsverarbeiter

Wir nutzen folgende Dienste, die personenbezogene Daten in unserem Auftrag verarbeiten:

### 6.1 Supabase (Datenbank- und Storage-Hosting)

- **Anbieter**: Supabase, Inc., 970 Toa Payoh North #07-04 Singapore 318992
- **Verarbeitete Daten**: Alle Account- und Inhalts-Daten (siehe 4.1–4.2)
- **Region**: EU (Frankfurt, Deutschland)
- **DPA**: Auftragsverarbeitungsvertrag geschlossen
- **Datenschutz**: https://supabase.com/privacy

### 6.2 Vercel (Hosting)

- **Anbieter**: Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA
- **Verarbeitete Daten**: Auslieferung der Anwendung, technische Logs
- **Rechtsgrundlage Drittlandtransfer**: EU-Standardvertragsklauseln, EU-US Data Privacy Framework
- **Datenschutz**: https://vercel.com/legal/privacy-policy

### 6.3 Resend (Transaktionale E-Mails)

- **Anbieter**: Resend, Inc., 2261 Market Street #4391, San Francisco, CA 94114, USA
- **Verarbeitete Daten**: E-Mail-Adresse, Mailinhalt (Einladungen, Setup-Mails)
- **Rechtsgrundlage Drittlandtransfer**: EU-Standardvertragsklauseln
- **Datenschutz**: https://resend.com/legal/privacy-policy

### 6.4 Google (OAuth & APIs)

- **Anbieter**: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland (für Nutzer im EWR)
- **Verarbeitete Daten**: Login-Daten, Kalender-Events, Drive-Datei-Metadaten (nur auf deine Aktion hin)
- **Rechtsgrundlage**: Deine Einwilligung beim OAuth-Flow
- **Datenschutz**: https://policies.google.com/privacy

Die Anwendung hält sich an die [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), einschließlich der Limited Use-Anforderungen.

### 6.5 KI-Anbieter (für KI-Features)

Wenn du Chat-/KI-Funktionen nutzt, werden die Inhalte deiner Anfragen an folgende Anbieter übermittelt:

- **Anthropic** (Claude): Anthropic PBC, 548 Market St, PMB 90375, San Francisco, CA 94104, USA
- **OpenAI** (GPT): OpenAI Ireland Limited, 1st Floor, The Liffey Trust Centre, 117–126 Sheriff Street Upper, Dublin 1, Irland
- **Google** (Gemini): siehe 6.4

Die KI-Anbieter verarbeiten Anfragen ausschließlich zur Bereitstellung der Antwort und (gemäß ihren API-Bedingungen) nicht zum Modell-Training.

## 7. Datenübermittlung in Drittländer

Einzelne Auftragsverarbeiter (Vercel, Resend, Anthropic, OpenAI) sind in den USA ansässig. Wir stützen diese Übermittlungen auf:

- **EU-Standardvertragsklauseln (SCC)** gemäß Beschluss (EU) 2021/914 der EU-Kommission
- **EU-US Data Privacy Framework**, sofern die Anbieter zertifiziert sind
- Zusätzliche technische und organisatorische Schutzmaßnahmen (Verschlüsselung in Transit und at Rest)

## 8. Speicherdauer

| Datenkategorie | Speicherdauer |
|---|---|
| Account-Daten | Solange dein Konto aktiv ist |
| Inhaltliche Daten (Tasks, Chats, Brand-Profile) | Solange dein Konto aktiv ist |
| Auth-Tokens | Maximal 7 Tage; werden bei Logout sofort gelöscht |
| Logs (technisch) | 30 Tage |
| Daten nach Konto-Löschung | Soft-Delete: 30 Tage Wiederherstellungsfenster, danach automatische harte Löschung |

**Auf ausdrückliche Anfrage** an `support@i7os.com` löschen wir deine Daten **sofort und unwiderruflich** (Art. 17 DSGVO – Recht auf Löschung). Eine Wiederherstellung ist danach nicht mehr möglich.

## 9. Push-Benachrichtigungen

Wenn du Push-Benachrichtigungen aktivierst, speichern wir den Push-Endpoint deines Browsers/Geräts, um dir transaktionale Nachrichten zukommen zu lassen (z. B. Erwähnungen in Chats, Reminder, Projekt-Einladungen).

**Wir senden keine Marketing-Push-Benachrichtigungen.** Du kannst Push jederzeit in deinem Browser oder in den Anwendungs-Einstellungen widerrufen.

## 10. Sicherheit

Wir treffen technische und organisatorische Maßnahmen entsprechend Art. 32 DSGVO:

- TLS/HTTPS-Verschlüsselung der gesamten Kommunikation
- Datenbank-Verschlüsselung at Rest (Supabase / AES-256)
- Row-Level Security auf Datenbankebene — jeder Nutzer sieht nur eigene oder geteilte Daten
- Zugangskontrollen und Authentifizierung über etablierte OAuth-Provider
- Minimale Berechtigungs-Scopes (`drive.file`, `calendar.events`)
- Regelmäßige Backups

## 11. Deine Rechte

Du hast jederzeit das Recht auf:

- **Auskunft** (Art. 15 DSGVO) — welche Daten über dich gespeichert sind
- **Berichtigung** (Art. 16 DSGVO) — falscher Daten
- **Löschung** (Art. 17 DSGVO) — siehe Abschnitt 8
- **Einschränkung der Verarbeitung** (Art. 18 DSGVO)
- **Datenübertragbarkeit** (Art. 20 DSGVO) — Export deiner Daten
- **Widerspruch** (Art. 21 DSGVO) — gegen Verarbeitungen auf Basis berechtigten Interesses
- **Widerruf einer Einwilligung** (Art. 7 Abs. 3 DSGVO) — z. B. Google OAuth, Push-Benachrichtigungen
- **Beschwerde** bei der zuständigen Aufsichtsbehörde (Art. 77 DSGVO) — in Deutschland: zuständig nach Bundesland; für uns: Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein

Anfragen zu deinen Rechten richte an: **support@i7os.com**. Wir antworten innerhalb von 30 Tagen.

## 12. Änderungen dieser Datenschutzerklärung

Wir können diese Datenschutzerklärung anpassen, wenn sich Funktionen oder Rechtslage ändern. Wesentliche Änderungen kommunizieren wir mit angemessener Vorlaufzeit per E-Mail oder in der Anwendung.

---

# Privacy Policy (English)

**Last updated: November 2025**

## 1. Controller

The controller within the meaning of the EU General Data Protection Regulation (GDPR) is:

**Sandro Ieva**
Arnimstrasse 13
23566 Lübeck
Germany

Email: support@i7os.com

## 2. Scope

This policy applies to the web application "i7 OS" (the "Service") at `alpha.i7os.com` and its subdomains. It explains what personal data we process, for what purpose, and which rights you have.

## 3. What data do we process?

### 3.1 Account data

When you sign up (via Google OAuth) we process your first and last name, email address, profile picture (if set on Google), and a unique user ID.

### 3.2 Content you create

Workspace and project information, chat messages, tasks, notes, brand profiles (name, logos, colors, descriptions), file uploads (logos, PDFs, ZIP archives), personas, strategy notes and channel links.

### 3.3 Google integration data

If you grant the Service access to your Google account, we use the following scopes:

- **`auth/calendar.events`**: read, create, modify and delete events in your primary Google Calendar — only on your active request
- **`auth/drive.file`**: access to files created by this Service or explicitly granted by you — the Service does not see any other files in your Drive

We persist only references (file IDs, event IDs) to content you work with, not the full content.

### 3.4 Technical data

IP address (during the session, not persisted), access timestamps, browser/device information, authentication tokens (encrypted), push notification endpoints (if enabled — see section 8).

### 3.5 Cookies and LocalStorage

We use technically necessary cookies and browser LocalStorage for authentication, language and theme preferences, and app state. **No tracking, analytics or advertising cookies.**

## 4. Purposes and legal bases

| Purpose | Legal basis |
|---|---|
| Providing the Service | Art. 6(1)(b) GDPR (contract) |
| Google integrations | Art. 6(1)(a) GDPR (consent via OAuth) |
| Transactional emails | Art. 6(1)(b) GDPR (contract) |
| Push notifications | Art. 6(1)(a) GDPR (consent) |
| Security / abuse prevention | Art. 6(1)(f) GDPR (legitimate interest) |
| Processors | Art. 28 GDPR |

## 5. Recipients / Processors

### 5.1 Supabase (database & storage)
Supabase, Inc., 970 Toa Payoh North #07-04 Singapore 318992 — EU region (Frankfurt). DPA in place. https://supabase.com/privacy

### 5.2 Vercel (hosting)
Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA. SCC + EU-US Data Privacy Framework. https://vercel.com/legal/privacy-policy

### 5.3 Resend (transactional email)
Resend, Inc., San Francisco, USA. SCC. https://resend.com/legal/privacy-policy

### 5.4 Google (OAuth & APIs)
Google Ireland Limited (for EEA users). https://policies.google.com/privacy

The Service complies with the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

### 5.5 AI providers (when AI features are used)
Anthropic (Claude) — USA · OpenAI — Ireland · Google (Gemini) — see 5.4. Requests are only used to provide responses and (per API terms) not for model training.

## 6. International transfers

We rely on EU Standard Contractual Clauses (Commission Decision (EU) 2021/914), EU-US Data Privacy Framework where applicable, and additional technical safeguards (encryption in transit and at rest).

## 7. Retention

| Category | Retention |
|---|---|
| Account data | While your account is active |
| Content data | While your account is active |
| Auth tokens | Max 7 days; deleted on logout |
| Technical logs | 30 days |
| Data after account deletion | Soft-delete: 30-day recovery window, then automatic permanent deletion |

**On explicit request** to `support@i7os.com` we will **immediately and irrevocably** delete your data (GDPR Art. 17 – Right to erasure).

## 8. Push notifications

If you enable push, we store your browser/device push endpoint to send you transactional messages (mentions, reminders, project invites). **No marketing pushes.** You can revoke push at any time.

## 9. Security

TLS/HTTPS for all communication. Database encryption at rest (Supabase / AES-256). Row-Level Security on database level. Minimal OAuth scopes. Regular backups. Per Art. 32 GDPR.

## 10. Your rights

You have the right at any time to: access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), data portability (Art. 20), objection (Art. 21), withdrawal of consent (Art. 7(3)), and to lodge a complaint with the supervisory authority (Art. 77 — for us: Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein, Germany).

Send requests to **support@i7os.com**. We respond within 30 days.

## 11. Changes

We may update this policy when features or legal requirements change. Material changes will be communicated by email or in the app with reasonable notice.
