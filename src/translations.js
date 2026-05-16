// ─────────────────────────────────────────────
// Agency OS — Translations (i18n)
// ─────────────────────────────────────────────
// All UI strings in German and English.
// Add new languages by adding a new key to each entry.

const translations = {
  // ── Menu Categories ──────────────────────────
  "menu.chat": { de: "CHAT", en: "CHAT" },
  "menu.plan": { de: "PLAN", en: "PLAN" },
  "menu.brand": { de: "MARKE", en: "BRAND" },
  "menu.projects": { de: "PROJEKTE", en: "PROJECTS" },
  "menu.files": { de: "DATEIEN", en: "FILES" },
  "menu.agents": { de: "AGENTEN", en: "AGENTS" },

  // ── Chat Submenu ─────────────────────────────
  "sub.team": { de: "Team", en: "Team" },
  "sub.clients": { de: "Kunden", en: "Clients" },
  "sub.ai": { de: "AI", en: "AI" },
  "sub.channels": { de: "Channels", en: "Channels" },
  "sub.calls": { de: "Anrufe", en: "Calls" },
  "sub.archive": { de: "Archiv", en: "Archive" },

  // ── Plan Submenu ─────────────────────────────
  "sub.kanban": { de: "Kanban", en: "Kanban" },
  "sub.timeline": { de: "Timeline", en: "Timeline" },
  "sub.tasks": { de: "Aufgaben", en: "Tasks" },
  "sub.calendar": { de: "Kalender", en: "Calendar" },

  // ── Brand Submenu ────────────────────────────
  "sub.assets": { de: "Assets", en: "Assets" },
  "sub.identity": { de: "Identität", en: "Identity" },
  "sub.intelligence": { de: "Insights", en: "Intelligence" },
  "sub.personas": { de: "Personas", en: "Personas" },
  "sub.analyze": { de: "Analyse", en: "Analyze" },
  "sub.guidelines": { de: "Richtlinien", en: "Guidelines" },

  // ── Projects Submenu ─────────────────────────
  "sub.notes": { de: "Notizen", en: "Notes" },
  "sub.briefs": { de: "Briefs", en: "Briefs" },
  "sub.wiki": { de: "Wiki", en: "Wiki" },
  "sub.templates": { de: "Vorlagen", en: "Templates" },
  "sub.proposals": { de: "Angebote", en: "Proposals" },
  "sub.reports": { de: "Berichte", en: "Reports" },

  // ── Files Submenu ────────────────────────────
  "sub.images": { de: "Bilder", en: "Images" },
  "sub.videos": { de: "Videos", en: "Videos" },
  "sub.docs": { de: "Docs", en: "Docs" },
  "sub.fonts": { de: "Fonts", en: "Fonts" },
  "sub.links": { de: "Links", en: "Links" },

  // ── Agents Submenu ───────────────────────────
  "sub.dev": { de: "Dev", en: "Dev" },
  "sub.design": { de: "Design", en: "Design" },
  "sub.strategy": { de: "Strategie", en: "Strategy" },
  "sub.finance": { de: "Finanzen", en: "Finance" },
  "sub.marketing": { de: "Marketing", en: "Marketing" },
  "sub.sales": { de: "Vertrieb", en: "Sales" },

  // ── Plus Menu (Create) ───────────────────────
  "plus.create": { de: "ERSTELLEN", en: "CREATE" },
  "plus.project": { de: "Projekt", en: "Project" },
  "plus.brief": { de: "Brief", en: "Brief" },
  "plus.document": { de: "Dokument", en: "Document" },

  // ── Plus Menu (Task) ─────────────────────────
  "plus.task": { de: "AUFGABE", en: "TASK" },
  "plus.todo": { de: "To-Do", en: "To-Do" },
  "plus.reminder": { de: "Erinnerung", en: "Reminder" },
  "plus.note": { de: "Notiz", en: "Note" },

  // ── Plus Menu (Ideate) ───────────────────────
  "plus.ideate": { de: "IDEATE", en: "IDEATE" },
  "plus.brainstorm": { de: "Brainstorm", en: "Brainstorm" },
  "plus.moodboard": { de: "Moodboard", en: "Moodboard" },
  "plus.concept": { de: "Konzept", en: "Concept" },

  // ── Kanban Columns ───────────────────────────
  "kanban.todo": { de: "To Do", en: "To Do" },
  "kanban.inProgress": { de: "In Arbeit", en: "In Progress" },
  "kanban.review": { de: "Review", en: "Review" },
  "kanban.done": { de: "Fertig", en: "Done" },

  // ── AI Sphere ────────────────────────────────
  "ai.thinking": { de: "DENKT...", en: "THINKING..." },
  "ai.clickToSend": { de: "KLICK ZUM SENDEN", en: "CLICK TO SEND" },
  "ai.clickToStop": { de: "KLICK ZUM STOPPEN", en: "CLICK TO STOP" },
  "ai.clickToClose": { de: "KLICK ZUM SCHLIESSEN", en: "CLICK TO CLOSE" },
  "ai.noProvider": { de: "Bitte verbinde einen AI-Anbieter in den Einstellungen.", en: "Please connect an AI provider in Settings to use the assistant." },
  "ai.rateLimited": { de: "Rate Limit erreicht. Bitte warte einen Moment.", en: "Rate limit reached. Please wait a moment and try again." },
  "ai.error": { de: "Verbindungsproblem. Bitte nochmal versuchen.", en: "I'm having trouble connecting. Try again in a moment." },
  "ai.fallback": { de: "Ich bin bereit zu helfen.", en: "I'm here to help with your creative projects." },

  // ── Greetings ─────────────────────────────────
  "greet.stillUp": { de: "Noch wach", en: "Still up" },
  "greet.morning": { de: "Guten Morgen", en: "Good Morning" },
  "greet.afternoon": { de: "Guten Tag", en: "Good Afternoon" },
  "greet.evening": { de: "Guten Abend", en: "Good Evening" },
  "greet.night": { de: "Guten Abend", en: "Good Night" },
  "greet.fallbackName": { de: "du", en: "there" },

  // ── Dashboard ────────────────────────────────
  "dash.subtitle": { de: "Was möchtest du tun?", en: "What would you like to do?" },
  "dash.newTask": { de: "Neuer Task", en: "New Task" },
  "dash.askAi": { de: "AI fragen", en: "Ask AI" },
  "dash.newDoc": { de: "Neues Dok.", en: "New Doc" },
  "dash.schedule": { de: "Termin", en: "Schedule" },
  "dash.today": { de: "Heute", en: "Today" },
  "dash.tomorrow": { de: "Morgen", en: "Tomorrow" },
  "dash.week": { de: "Woche", en: "Week" },
  "dash.overview": { de: "Übersicht", en: "Overview" },
  "dash.open": { de: "Offen", en: "Open" },
  "dash.inProgress": { de: "In Arbeit", en: "In Progress" },
  "dash.doneToday": { de: "Heute fertig", en: "Done today" },
  "dash.messages": { de: "Nachrichten", en: "Messages" },
  "dash.activeProjects": { de: "Aktive Projekte", en: "Active Projects" },
  "dash.tasks": { de: "Tasks", en: "Tasks" },
  "dash.activity": { de: "Aktivität", en: "Activity" },
  "dash.actAiAnalysis": { de: "AI hat Wettbewerbs-Analyse abgeschlossen", en: "AI completed competitor analysis" },
  "dash.actBrandDone": { de: "Brand Guidelines v1 als fertig markiert", en: "Brand guidelines v1 marked done" },
  "dash.actNewMessage": { de: "Neue Nachricht von Maria", en: "New message from Maria" },
  "dash.actTimeTracked": { de: "Zeit erfasst: Logo-Exploration", en: "Time tracked: Logo exploration" },
  "dash.act2min": { de: "vor 2 Min.", en: "2 min ago" },
  "dash.act18min": { de: "vor 18 Min.", en: "18 min ago" },
  "dash.act34min": { de: "vor 34 Min.", en: "34 min ago" },
  "dash.act1h": { de: "vor 1 Std.", en: "1h ago" },
  "dash.actLoggedToday": { de: "4h 30m heute erfasst", en: "4h 30m logged today" },
  "dash.priority": { de: "Priorität", en: "Priority" },
  "dash.upcoming": { de: "Geplant", en: "Upcoming" },
  "dash.all": { de: "Alle", en: "All" },
  "dash.noTasks": { de: "Keine offenen Aufgaben — alles erledigt!", en: "No open tasks — all done!" },
  "dash.completed": { de: "Erledigt", en: "Completed" },
  "dash.overdue": { de: "Überfällig", en: "Overdue" },
  "dash.wed": { de: "Mi", en: "Wed" },
  "dash.thu": { de: "Do", en: "Thu" },
  // Demo task texts
  "dash.demoTask1": { de: "Client-Präsentation finalisieren", en: "Finalize client presentation" },
  "dash.demoTask2": { de: "Feedback von Lena einarbeiten", en: "Incorporate Lena's feedback" },
  "dash.demoTask3": { de: "Dashboard Komponenten bauen", en: "Build dashboard components" },
  "dash.demoTask4": { de: "Meeting mit Tom vorbereiten", en: "Prepare meeting with Tom" },
  "dash.demoTask5": { de: "Social Media Assets exportieren", en: "Export social media assets" },
  "dash.demoTask6": { de: "Wireframes für Onboarding Flow", en: "Wireframes for onboarding flow" },
  "dash.demoTask7": { de: "Design Review vorbereiten", en: "Prepare design review" },
  "dash.demoTask8": { de: "Competitor Analysis abschließen", en: "Complete competitor analysis" },

  // ── Settings ─────────────────────────────────
  "settings.title": { de: "Einstellungen", en: "Settings" },
  "settings.profile": { de: "Profil", en: "Profile" },
  "settings.account": { de: "Account", en: "Account" },
  "settings.preferences": { de: "Darstellung", en: "Preferences" },
  "settings.darkMode": { de: "Dark Mode", en: "Dark Mode" },
  "settings.lightMode": { de: "Light Mode", en: "Light Mode" },
  "settings.language": { de: "Sprache", en: "Language" },
  "settings.languageSub": { de: "App & Sprache", en: "App & Voice" },
  "settings.notifications": { de: "Benachrichtigungen", en: "Notifications" },
  "settings.notificationsSub": { de: "Push & E-Mail", en: "Push & Email" },
  "settings.aiVoice": { de: "AI Stimme", en: "AI Voice" },
  "settings.aiModels": { de: "AI Modelle", en: "AI Models" },
  "settings.integrations": { de: "Integrationen", en: "Integrations" },
  "settings.connectedViaGoogle": { de: "Verbunden via Google", en: "Connected via Google" },
  "settings.googleCalDrive": { de: "Google Kalender & Drive", en: "Google Calendar & Drive" },
  "settings.calFilesSynced": { de: "Kalender & Dateien synchronisiert", en: "Calendar & files synced" },
  "settings.signInToConnect": { de: "Anmelden zum Verbinden", en: "Sign in to connect" },
  "settings.keySaved": { de: "Key gespeichert — neuen eingeben zum Ersetzen", en: "Key saved — enter new to replace" },
  "settings.geminiKeyOpt": { de: "Gemini API Key (optional)", en: "Gemini API Key (optional)" },
  "settings.claudeKey": { de: "Claude API Key", en: "Claude API Key" },
  "settings.chatgptKey": { de: "ChatGPT API Key", en: "ChatGPT API Key" },
  "settings.save": { de: "Speichern", en: "Save" },
  "settings.slackSub": { de: "Team-Kommunikation", en: "Team messaging" },
  "settings.comingSoon": { de: "Demnächst", en: "Coming soon" },

  // ── Auth ─────────────────────────────────────
  "auth.signInPrompt": { de: "Anmelden, um auf deinen Workspace zuzugreifen", en: "Sign in to access your workspace" },
  "auth.signInGoogle": { de: "Mit Google anmelden", en: "Sign in with Google" },

  // ── Calendar ─────────────────────────────────
  "cal.month": { de: "Monat", en: "Month" },
  "cal.week": { de: "Woche", en: "Week" },
  "cal.day": { de: "Tag", en: "Day" },
  "cal.newEvent": { de: "Neuer Termin", en: "New Event" },
  "cal.noEvents": { de: "Keine Termine", en: "No events" },
  "cal.event": { de: "Termin", en: "event" },
  "cal.events": { de: "Termine", en: "events" },
  "cal.cancelEvent": { de: "Event absagen?", en: "Cancel event?" },
  "cal.cancelEventBtn": { de: "Event absagen", en: "Cancel event" },
  "cal.deleting": { de: "Löschen...", en: "Deleting..." },
  "cal.title": { de: "Titel", en: "Title" },
  "cal.description": { de: "Beschreibung (optional)", en: "Description (optional)" },
  "cal.addGuest": { de: "E-Mail eingeben + Enter", en: "Enter email + Enter" },
  "cal.addBtn": { de: "Hinzufügen", en: "Add" },
  "cal.createEvent": { de: "Termin erstellen", en: "Create event" },
  "cal.saving": { de: "Speichern...", en: "Saving..." },
  "cal.cancel": { de: "Abbrechen", en: "Cancel" },
  "cal.creatingLink": { de: "Erstelle Link...", en: "Creating link..." },
  "cal.allDay": { de: "Ganztägig", en: "All day" },
  "cal.withMeet": { de: "Mit Google Meet", en: "With Google Meet" },
  "cal.guests": { de: "Gäste", en: "Guests" },

  // ── Tasks / Kanban ───────────────────────────
  "task.newTask": { de: "Neuer Task", en: "New Task" },
  "task.editTask": { de: "Task bearbeiten", en: "Edit Task" },
  "task.title": { de: "Task Titel...", en: "Task title..." },
  "task.description": { de: "Beschreibung (optional)...", en: "Description (optional)..." },
  "task.projectName": { de: "Projekt Name (z.B. Meridian)...", en: "Project name (e.g. Meridian)..." },
  "task.create": { de: "Task erstellen", en: "Create task" },
  "task.save": { de: "Speichern", en: "Save" },
  "task.delete": { de: "Löschen", en: "Delete" },
  "task.cancel": { de: "Abbrechen", en: "Cancel" },
  "task.confirmDelete": { de: "wird unwiderruflich gelöscht.", en: "will be permanently deleted." },
  "task.noMembers": { de: "Keine Team-Mitglieder gefunden", en: "No team members found" },

  // ── Files ────────────────────────────────────
  "files.search": { de: "Dateien durchsuchen...", en: "Search files..." },
  "files.empty": { de: "Dieser Ordner ist leer", en: "This folder is empty" },
  "files.noResults": { de: "Keine Dateien gefunden", en: "No files found" },
  "files.back": { de: "Zurück", en: "Back" },
  "files.newFolder": { de: "Neuer Ordner", en: "New Folder" },
  "files.upload": { de: "Upload", en: "Upload" },
  "files.loading": { de: "Dateien werden geladen...", en: "Loading files from Google Drive..." },
  "files.statusNew": { de: "Neu", en: "New" },
  "files.statusReview": { de: "In Prüfung", en: "In Review" },
  "files.statusApproved": { de: "Freigegeben", en: "Approved" },
  "files.statusClient": { de: "Kunden-Sichtbar", en: "Client Visible" },

  // ── Chat ─────────────────────────────────────
  "chat.search": { de: "Unterhaltungen suchen...", en: "Search conversations..." },
  "chat.message": { de: "Nachricht an {name}...", en: "Message {name}..." },
  "chat.tabs.all": { de: "Alle", en: "All" },
  "chat.tabs.team": { de: "Team", en: "Team" },
  "chat.tabs.clients": { de: "Kunden", en: "Clients" },
  "chat.tabs.channels": { de: "Channels", en: "Channels" },

  // ── Common ───────────────────────────────────
  "common.loading": { de: "Laden...", en: "Loading..." },
  "common.save": { de: "Speichern", en: "Save" },
  "common.cancel": { de: "Abbrechen", en: "Cancel" },
  "common.delete": { de: "Löschen", en: "Delete" },
  "common.back": { de: "Zurück", en: "Back" },
  "common.search": { de: "Suchen...", en: "Search..." },

  // ── Errors ───────────────────────────────────
  "error.noGoogleAccess": { de: "Kein Google Zugriff. Bitte neu einloggen.", en: "No Google access. Please sign in again." },
  "error.createFailed": { de: "Fehler beim Erstellen", en: "Error creating" },
  "error.loadFailed": { de: "Fehler beim Laden der Dateien.", en: "Error loading files." },
  "error.connectionError": { de: "Verbindungsfehler.", en: "Connection error." },
  "error.uploadPermission": { de: "Keine Upload-Berechtigung. Bitte neu einloggen.", en: "No upload permission. Please sign in again." },
  "error.folderCreate": { de: "Fehler beim Ordner erstellen.", en: "Error creating folder." },
  "error.invalidKey": { de: "Ungültiger API Key. Bitte prüfen.", en: "Invalid API key. Please check and try again." },
  "error.unknown": { de: "Unbekannter Fehler", en: "Unknown error" },
};

/**
 * Get a translation by key.
 * @param {string} key — dot-notation key (e.g. "menu.chat")
 * @param {string} lang — language code ("de" or "en")
 * @param {object} vars — optional interpolation variables (e.g. { name: "Max" })
 * @returns {string}
 */
export function getTranslation(key, lang = "de", vars = {}) {
  const entry = translations[key];
  if (!entry) return key; // fallback: return key itself
  let text = entry[lang] || entry.en || key;
  // Interpolate variables like {name}
  if (vars && Object.keys(vars).length > 0) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

export default translations;
