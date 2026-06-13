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

  // ── Linear Menu (new two-column flyout, TitleCase variants) ──
  "linearMenu.brand":         { de: "Brand",        en: "Brand" },
  "linearMenu.create":        { de: "Erstellen",    en: "Create" },
  "linearMenu.agents":        { de: "Agenten",      en: "Agents" },
  "linearMenu.projects":      { de: "Projekte",     en: "Projects" },
  "linearMenu.messenger":     { de: "Messenger",    en: "Messenger" },
  "linearMenu.plan":          { de: "Plan",         en: "Plan" },
  // Brand pillars (5 top-level areas; detail lives in tabs inside each page)
  "linearMenu.strategy":      { de: "Strategie",        en: "Strategy" },
  "linearMenu.identity":      { de: "Identität",        en: "Identity" },
  "linearMenu.designSystem":  { de: "Design System",    en: "Design System" },
  "linearMenu.touchpoints":   { de: "Touchpoints",      en: "Touchpoints" },
  "linearMenu.assets":        { de: "Files",            en: "Files" },
  // Legacy Brand sub-item labels (kept for any older references)
  "linearMenu.files":         { de: "Dateien",          en: "Files" },
  "linearMenu.brandIdentity": { de: "Markenidentität",  en: "Brand Identity" },
  "linearMenu.brandStrategy": { de: "Markenstrategie",  en: "Brand Strategy" },
  "linearMenu.channels":      { de: "Kanäle",           en: "Channels" },
  // Create sub-items
  "linearMenu.project":       { de: "Projekt",          en: "Project" },
  "linearMenu.brief":         { de: "Brief",            en: "Brief" },
  "linearMenu.document":      { de: "Dokument",         en: "Document" },
  // Plan sub-items
  "linearMenu.kanban":        { de: "Kanban",           en: "Kanban" },
  "linearMenu.timeline":      { de: "Timeline",         en: "Timeline" },
  "linearMenu.tasks":         { de: "Aufgaben",         en: "Tasks" },
  "linearMenu.calendar":      { de: "Kalender",         en: "Calendar" },
  "linearMenu.notes":         { de: "Notizen",          en: "Notes" },
  "assets.docs":              { de: "Documents",        en: "Documents" },
  // Empty-state
  "linearMenu.comingSoon":    { de: "Bald verfügbar",   en: "Coming soon" },

  // ── Assets (Brand → Assets: Moodboards / Creations / Inspirations) ──
  "assets.title":              { de: "Assets",                    en: "Assets" },
  "assets.moodboards":         { de: "Moodboards",                en: "Moodboards" },
  "assets.creations":          { de: "Creations",                 en: "Creations" },
  "assets.inspirations":       { de: "Inspirations",              en: "Inspirations" },
  "assets.creationsEmptyTitle":{ de: "Noch keine Kreationen",     en: "No creations yet" },
  "assets.creationsEmptyHint": { de: "Mit KI generierte Bilder erscheinen hier automatisch — oder lade eigene hoch.", en: "AI-generated images show up here automatically — or upload your own." },
  "assets.all":                { de: "Alle",                      en: "All" },
  "assets.images":             { de: "Bilder",                    en: "Images" },
  "assets.videos":             { de: "Videos",                    en: "Videos" },
  "assets.itemOne":            { de: "Element",                   en: "item" },
  "assets.itemMany":           { de: "Elemente",                  en: "items" },
  "assets.inspirationsTitle":  { de: "Inspirationen",             en: "Inspirations" },
  "assets.inspirationsHint":   { de: "Speichere Referenzen und Fundstücke aus dem Web hier. Bald verfügbar.", en: "Save references and finds from the web here. Coming soon." },

  // ── Touchpoints (Brand → Touchpoints) ───────
  "touchpoints.title":         { de: "Touchpoints",               en: "Touchpoints" },
  "touchpoints.connectedOne":  { de: "Kanal verbunden",           en: "channel connected" },
  "touchpoints.connectedMany": { de: "Kanäle verbunden",          en: "channels connected" },
  "touchpoints.social":        { de: "Social-Media-Kanäle",       en: "Social media channels" },
  "touchpoints.notConnected":  { de: "Nicht verbunden",           en: "Not connected" },
  "touchpoints.connected":     { de: "Verbunden",                 en: "Connected" },
  "touchpoints.open":          { de: "Öffnen",                    en: "Open" },
  "touchpoints.edit":          { de: "Bearbeiten",                en: "Edit" },
  "touchpoints.connect":       { de: "Verbinden",                 en: "Connect" },
  "touchpoints.addMore":       { de: "Kanal verbinden",           en: "Connect a channel" },
  "touchpoints.noneConnected": { de: "Noch keine Kanäle verbunden — wähle unten eine Plattform aus.", en: "No channels connected yet — pick a platform below." },
  "touchpoints.next":          { de: "Demnächst",                 en: "Coming up" },
  "touchpoints.strategyTitle": { de: "Strategie-Analyse",         en: "Strategy analysis" },
  "touchpoints.strategyHint":  { de: "Der Assistent analysiert deine Kanäle und Inhalte, leitet Stärken, Lücken und Empfehlungen ab — und heftet die wichtigsten Insights direkt auf dein Dashboard.", en: "The assistant analyses your channels and content, surfaces strengths, gaps and recommendations — and pins the key insights straight to your dashboard." },
  "touchpoints.startAnalysis": { de: "Analyse starten",           en: "Start analysis" },
  "common.soon":               { de: "BALD",                      en: "SOON" },

  // ── Moodboards (Brand → Assets) ─────────────
  "moodboard.title":           { de: "Moodboards",                en: "Moodboards" },
  "moodboard.untitled":        { de: "Neues Moodboard",           en: "New moodboard" },
  "moodboard.new":             { de: "Neues Board",               en: "New board" },
  "moodboard.create":          { de: "Erstellen",                 en: "Create" },
  "moodboard.namePlaceholder": { de: "Board-Name…",               en: "Board name…" },
  "moodboard.boardOne":        { de: "Board",                     en: "board" },
  "moodboard.boardMany":       { de: "Boards",                    en: "boards" },
  "moodboard.itemOne":         { de: "Element",                   en: "item" },
  "moodboard.itemMany":        { de: "Elemente",                  en: "items" },
  "moodboard.emptyTitle":      { de: "Noch keine Moodboards",     en: "No moodboards yet" },
  "moodboard.emptyHint":       { de: "Erstelle dein erstes Moodboard und sammle Referenzbilder, Farben und Inspirationen.", en: "Create your first moodboard to collect reference images, colors and inspiration." },
  "moodboard.boardEmptyTitle": { de: "Board ist leer",            en: "Board is empty" },
  "moodboard.boardEmptyHint":  { de: "Lade Bilder hoch oder füge eine URL ein, um Referenzen zu sammeln.", en: "Upload images or add a URL to start collecting references." },
  "moodboard.grid":            { de: "Raster",                    en: "Grid" },
  "moodboard.canvas":          { de: "Canvas",                    en: "Canvas" },
  "moodboard.upload":          { de: "Hochladen",                 en: "Upload" },
  "moodboard.add":             { de: "Hinzufügen",                en: "Add" },
  "moodboard.urlPlaceholder":  { de: "Bild- oder Website-URL einfügen…", en: "Paste an image or website URL…" },
  "moodboard.palette":         { de: "Palette",                   en: "Palette" },
  "moodboard.allTags":         { de: "Alle",                      en: "All" },
  "moodboard.details":         { de: "Details",                   en: "Details" },
  "moodboard.colors":          { de: "Farben",                    en: "Colors" },
  "moodboard.note":            { de: "Notiz",                     en: "Note" },
  "moodboard.notePlaceholder": { de: "Notiz hinzufügen…",         en: "Add a note…" },
  "moodboard.tags":            { de: "Tags",                      en: "Tags" },

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
  "sub.identity": { de: "Identity", en: "Identity" },
  "sub.designSystem": { de: "Design System", en: "Design System" },
  "sub.audience": { de: "Audience", en: "Audience" },
  // sub.channels and sub.strategy reused from Chat/Agents submenus
  // Legacy keys kept for backward compatibility:
  "sub.assets": { de: "Assets", en: "Assets" },
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
  "sub.allFiles": { de: "Alle", en: "All" },
  "sub.images": { de: "Bilder", en: "Images" },
  "sub.videos": { de: "Videos", en: "Videos" },
  "sub.documents": { de: "Dokumente", en: "Documents" },
  "sub.zips": { de: "ZIPs", en: "ZIPs" },
  // Legacy keys kept for backward compatibility
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
  "auth.welcome": { de: "Willkommen in deinem Workspace", en: "Welcome to Your Workspace" },
  "auth.signInPrompt": { de: "Melde dich an und betrete deinen Workspace", en: "Sign in and enter your workspace" },
  "auth.signInGoogle": { de: "Mit Google anmelden", en: "Sign in with Google" },
  "auth.privacyNote": { de: "Deine Daten bleiben privat und sicher", en: "Your data stays private and secure" },

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

  // ── Legal ────────────────────────────────────
  "legal.privacy": { de: "Datenschutz", en: "Privacy" },
  "legal.terms": { de: "Nutzungsbedingungen", en: "Terms" },

  // ── Brand Onboarding Wizard ──────────────────
  "brand.step": { de: "Schritt", en: "Step" },
  "brand.next": { de: "Weiter", en: "Next" },
  "brand.back": { de: "Zurück", en: "Back" },
  "brand.cancel": { de: "Abbrechen", en: "Cancel" },
  "brand.create": { de: "Brand anlegen", en: "Create brand" },
  "brand.saving": { de: "Speichert…", en: "Saving…" },
  "brand.loading": { de: "Lädt…", en: "Loading…" },

  // Step 0
  "brand.hero.title": { de: "Lass uns deine Brand definieren", en: "Let´s define your Brand" },
  "brand.hero.subtitle": { de: "Wir gehen Schritt für Schritt durch, was wir wissen sollten — du kannst überall überspringen, was du noch nicht hast.", en: "We´ll go through, step by step, everything we need to know —and you can skip anything you don´t have yet." },
  "brand.hero.brandNameLabel": { de: "Brand-Name", en: "Brand name" },
  "brand.hero.brandNamePlaceholder": { de: "z.B. Agency OS", en: "e.g. Agency OS" },

  // Step 1 — Sources
  "brand.sources.title": { de: "Was hast du schon?", en: "What do you have already?" },
  "brand.sources.subtitle": { de: "Vorhandene Quellen sparen dir später viel Zeit — wir extrahieren Farben, Texte und Style automatisch.", en: "Existing sources save you a ton of time later — we extract colors, copy and style automatically." },
  "brand.sources.empty": { de: "Du hast noch nichts? Kein Problem — überspring den nächsten Schritt mit „Weiter“.", en: "Got nothing yet? No problem — skip the next step with “Next”." },
  "brand.sources.website": { de: "Website", en: "Website" },
  "brand.sources.websiteHint": { de: "Wir ziehen später Texte, Farben und Tonalität automatisch", en: "We´ll extract copy, colors and tone of voice automatically" },
  "brand.sources.figma": { de: "Figma / Design System", en: "Figma / Design System" },
  "brand.sources.figmaHint": { de: "Link zur Figma-Datei oder Library", en: "Link to Figma file or library" },
  "brand.sources.brandbook": { de: "Brand Book (PDF)", en: "Brand Book (PDF)" },
  "brand.sources.brandbookHint": { de: "Style Guide, Identity Manual, Pitch Deck", en: "Style Guide, Identity Manual, Pitch Deck" },
  "brand.sources.zip": { de: "Brand-Paket (ZIP)", en: "Brand pack (ZIP)" },
  "brand.sources.zipHint": { de: "Logos, Schriften, Templates — alles in einem Archiv", en: "Logos, fonts, templates — all in one archive" },
  "brand.sources.choosePdf": { de: "PDF auswählen →", en: "Choose PDF →" },
  "brand.sources.chooseZip": { de: "ZIP auswählen →", en: "Choose ZIP →" },
  "brand.sources.analyse": { de: "Analysieren", en: "Analyse" },
  "brand.sources.analysingPdf": { de: "PDF wird analysiert…", en: "Analysing PDF…" },
  "brand.sources.analysingZip": { de: "ZIP wird gelesen…", en: "Reading ZIP…" },
  "brand.sources.fetchError": { de: "Fehler beim Abrufen", en: "Fetch failed" },
  "brand.sources.urlMissing": { de: "Bitte eine URL eingeben", en: "Please enter a URL" },
  "brand.sources.contentFound": { de: "Inhalte gefunden", en: "Content found" },
  "brand.sources.context": { de: "Kontext", en: "Context" },
  "brand.sources.colors": { de: "Farben", en: "colors" },
  "brand.sources.fonts": { de: "Fonts", en: "fonts" },
  "brand.sources.logos": { de: "Logos", en: "logos" },
  "brand.sources.pages": { de: "Seiten", en: "pages" },
  "brand.sources.pdfs": { de: "PDFs", en: "PDFs" },

  // Step 2 — Logos
  "brand.logos.title": { de: "Deine Logo-Varianten", en: "Your logo variants" },
  "brand.logos.subtitle": { de: "Lade die wichtigsten Logo-Versionen hoch — du kannst auch eigene Varianten hinzufügen.", en: "Upload the key logo versions — you can also add custom variants." },
  "brand.logos.primary": { de: "Primary", en: "Primary" },
  "brand.logos.dark": { de: "Dark", en: "Dark" },
  "brand.logos.light": { de: "Light", en: "Light" },
  "brand.logos.icon": { de: "Icon", en: "Icon" },
  "brand.logos.upload": { de: "Hochladen", en: "Upload" },
  "brand.logos.uploading": { de: "Lädt…", en: "Uploading…" },
  "brand.logos.replace": { de: "Ersetzen", en: "Replace" },
  "brand.logos.addCustom": { de: "Eigene Variante", en: "Add variant" },
  "brand.logos.customLabel": { de: "Label (z.B. Submark, Mono)", en: "Label (e.g. Submark, Mono)" },

  // Step 3 — Colors
  "brand.colors.title": { de: "Deine Brand-Farben", en: "Your brand colors" },
  "brand.colors.subtitle": { de: "Lege Primary und Secondary fest — Akzentfarben kannst du beliebig viele ergänzen.", en: "Set primary and secondary — add as many accent colors as you like." },
  "brand.colors.primarySlot": { de: "Primary", en: "Primary" },
  "brand.colors.secondarySlot": { de: "Secondary", en: "Secondary" },
  "brand.colors.accents": { de: "Akzentfarben", en: "Accent colors" },
  "brand.colors.addAccent": { de: "+ Farbe hinzufügen", en: "+ Add color" },
  "brand.colors.pickHint": { de: "Hex-Code eingeben oder Farbe auswählen", en: "Enter hex code or pick a color" },
  "brand.colors.empty": { de: "Noch keine Farbe gesetzt", en: "No color set yet" },

  // Step 4 — Voice
  "brand.voice.title": { de: "Wie klingt deine Brand?", en: "How does your brand sound?" },
  "brand.voice.subtitle": { de: "Ein Claim und eine kurze Beschreibung helfen uns, deinen Ton zu treffen.", en: "A claim and a short description help us nail your tone." },
  "brand.voice.claimLabel": { de: "Claim", en: "Claim" },
  "brand.voice.claimPlaceholder": { de: "z.B. Werkzeuge für die nächste Generation Agenturen", en: "e.g. Tools for the next generation of agencies" },
  "brand.voice.descLabel": { de: "Beschreibung", en: "Description" },
  "brand.voice.descPlaceholder": { de: "Was macht deine Brand besonders? Wer seid ihr, für wen, wofür?", en: "What makes your brand special? Who are you, for whom, what for?" },

  // Step 5 — Next steps checklist
  "brand.nextSteps.title": { de: "Was kommt als Nächstes?", en: "What´s next?" },
  "brand.nextSteps.subtitle": { de: "Markiere, was du schon hast und wo wir dich unterstützen sollen. Im nächsten Schritt arbeiten wir die offenen Punkte zusammen aus.", en: "Mark what you already have and where you need help. In the next step we´ll work the open ones out together." },
  "brand.nextSteps.empty": { de: "Nichts markiert? Auch okay — du kannst die Themen jederzeit später angehen.", en: "Nothing marked? That´s fine — you can pick these up anytime later." },
  "brand.nextSteps.have": { de: "Habe ich", en: "I have it" },
  "brand.nextSteps.help": { de: "Brauche Hilfe", en: "Need help" },
  "brand.nextSteps.skip": { de: "Nicht relevant", en: "Not relevant" },
  "brand.nextSteps.personas": { de: "Personas / Zielgruppe", en: "Personas / Audience" },
  "brand.nextSteps.personasHint": { de: "Wer kauft / nutzt deine Brand?", en: "Who buys / uses your brand?" },
  "brand.nextSteps.competitor": { de: "Competitor-Analyse", en: "Competitor analysis" },
  "brand.nextSteps.competitorHint": { de: "Wo steht ihr im Markt?", en: "Where do you stand in the market?" },
  "brand.nextSteps.guidelines": { de: "Brand Guidelines", en: "Brand guidelines" },
  "brand.nextSteps.guidelinesHint": { de: "Schriftarten, Bildwelt, Tonalität, Don'ts", en: "Fonts, imagery, tone of voice, don'ts" },
  "brand.nextSteps.assets": { de: "Asset-Library", en: "Asset library" },
  "brand.nextSteps.assetsHint": { de: "Templates, Vorlagen, Mockups", en: "Templates, layouts, mockups" },
  "brand.nextSteps.intelligence": { de: "Brand Intelligence", en: "Brand intelligence" },
  "brand.nextSteps.intelligenceHint": { de: "Content-Strategie, Themen, Storytelling", en: "Content strategy, topics, storytelling" },
  "brand.nextSteps.voice": { de: "Tonalität & Sprache", en: "Tone of voice & language" },
  "brand.nextSteps.voiceHint": { de: "Wie klingt deine Brand in Texten?", en: "How does your brand sound in writing?" },

  // Step 6 — Recap
  "brand.recap.title": { de: "Sieht gut aus, oder?", en: "Looks good, doesn´t it?" },
  "brand.recap.subtitle": { de: "Du kannst alles später jederzeit anpassen — auch noch fehlende Stücke ergänzen.", en: "You can adjust everything later anytime — and add missing pieces." },
  "brand.recap.logoVariants": { de: "Logo-Varianten", en: "Logo variants" },
  "brand.recap.website": { de: "Website", en: "Website" },
  "brand.recap.figma": { de: "Figma", en: "Figma" },
  "brand.recap.sources": { de: "Quelle", en: "source" },
  "brand.recap.sourcesPlural": { de: "Quellen", en: "sources" },
  "brand.recap.colors": { de: "Farben", en: "colors" },
  "brand.recap.description": { de: "Beschreibung", en: "Description" },
  "brand.recap.topicsHave": { de: "Themen vorhanden", en: "topics in place" },
  "brand.recap.topicsOpen": { de: "Themen offen", en: "topics open" },

  // Personas (auto-drafted from website)
  "brand.personas.draftName": { de: "Kern-Zielgruppe", en: "Core audience" },
  "brand.personas.draftRole": { de: "Wer kauft / nutzt deine Brand?", en: "Who buys / uses your brand?" },
  "brand.personas.title": { de: "Personas", en: "Personas" },
  "brand.personas.empty": { de: "Noch keine Persona angelegt. Sobald du eine Website analysierst, erstellen wir hier einen Draft.", en: "No persona yet. Analyse a website to get a starter draft here." },
  "brand.personas.goals": { de: "Was sie wollen", en: "What they want" },
  "brand.personas.traits": { de: "Eigenschaften", en: "Traits" },
  "brand.personas.descLabel": { de: "Beschreibung", en: "Description" },
  "brand.personas.add": { de: "Persona hinzufügen", en: "Add persona" },
  "brand.personas.delete": { de: "Persona löschen", en: "Delete persona" },
  "brand.personas.sourceWebsite": { de: "aus Website", en: "from website" },

  // Tab-specific titles + empty states (new 5-tab structure)
  "brand.tab.identity.title": { de: "Identität", en: "Identity" },
  "brand.tab.identity.subtitle": { de: "Wer ihr seid — Name, Claim, Voice und Beschreibung.", en: "Who you are — name, claim, voice and description." },
  "brand.tab.design.title": { de: "Design System", en: "Design System" },
  "brand.tab.design.subtitle": { de: "Wie ihr aussieht — Logos, Farben, Typografie, Brand Book und Asset-Library.", en: "How you look — logos, colors, typography, brand book and asset library." },
  "brand.tab.design.guidelines": { de: "Guidelines & Brand Books", en: "Guidelines & brand books" },
  "brand.tab.design.assets": { de: "Asset-Quellen", en: "Asset sources" },
  "brand.tab.design.empty": { de: "Noch nichts hinterlegt — lade Logos, ein Brand Book oder ein ZIP hoch.", en: "Nothing here yet — upload logos, a brand book or a ZIP." },
  "brand.tab.audience.title": { de: "Audience", en: "Audience" },
  "brand.tab.audience.subtitle": { de: "Mit wem ihr redet — Personas, Zielgruppen-Segmente und ICP.", en: "Who you talk to — personas, audience segments and ICP." },
  "brand.tab.channels.title": { de: "Channels", en: "Channels" },
  "brand.tab.channels.subtitle": { de: "Wo ihr stattfindet — Website, Social Media, Newsletter und Ads.", en: "Where you show up — website, social media, newsletter and ads." },
  "brand.tab.channels.empty": { de: "Noch keine Channels verknüpft. Sobald wir deine Website analysieren, suchen wir Social-Profile automatisch.", en: "No channels linked yet. When we analyse your website we'll pull social profiles automatically." },
  "brand.tab.channels.website": { de: "Website", en: "Website" },
  "brand.tab.channels.social": { de: "Social Media", en: "Social media" },
  "brand.tab.channels.newsletter": { de: "Newsletter", en: "Newsletter" },
  "brand.tab.channels.add": { de: "Channel hinzufügen", en: "Add channel" },
  "brand.tab.strategy.title": { de: "Strategie", en: "Strategy" },
  "brand.tab.strategy.subtitle": { de: "Was euch ausmacht — Positionierung, Personas, Value Props, Kern-Botschaften und Competitor-Insights.", en: "What sets you apart — positioning, personas, value props, key messages and competitor insights." },
  "brand.tab.strategy.positioning": { de: "Positionierung", en: "Positioning" },
  "brand.tab.strategy.claim": { de: "Claim / Tagline", en: "Claim / tagline" },
  "brand.tab.strategy.keyMessages": { de: "Kern-Botschaften", en: "Key messages" },
  "brand.tab.strategy.valueProps": { de: "Value Props", en: "Value props" },
  "brand.tab.strategy.context": { de: "Brand-Kontext", en: "Brand context" },
  "brand.tab.strategy.empty": { de: "Noch keine Strategie-Daten. Analysiere deine Website, um Insights zu sammeln.", en: "No strategy data yet. Analyse your website to capture insights." },
  "brand.tab.fetchedFrom": { de: "Aus Website extrahiert", en: "Extracted from website" },

  // Step 7 — Celebration
  "brand.done.title": { de: "Deine Brand ist angelegt", en: "Your brand is ready" },
  "brand.done.subtitle": { de: "Du kannst jetzt loslegen — oder direkt in den nächsten Schritt springen.", en: "You can start now — or jump into the next step." },
  "brand.done.cta": { de: "Zur Brand-Übersicht", en: "Open brand overview" },

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
