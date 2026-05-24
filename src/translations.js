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
  "auth.welcome": { de: "Willkommen in deinem Workspace", en: "Welcome to Your Workspace" },
  "auth.signInPrompt": { de: "Anmelden, um auf deinen Workspace zuzugreifen", en: "Sign in to access your workspace" },
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

  // Tab-specific titles + empty states
  "brand.tab.identity.title": { de: "Identity", en: "Identity" },
  "brand.tab.identity.subtitle": { de: "Basis deiner Brand: Name, Claim, Farben und Logos.", en: "The basics of your brand: name, claim, colors and logos." },
  "brand.tab.assets.title": { de: "Assets", en: "Assets" },
  "brand.tab.assets.subtitle": { de: "Logo-Varianten, Brand Book, Quellen und alle Asset-Dateien.", en: "Logo variants, brand book, sources and all asset files." },
  "brand.tab.assets.empty": { de: "Noch keine Assets hochgeladen.", en: "No assets uploaded yet." },
  "brand.tab.knowledge.title": { de: "Intelligence", en: "Intelligence" },
  "brand.tab.knowledge.subtitle": { de: "Brand-Kontext, Kern-Botschaften und Value Props — alles, was deine Brand erzählt.", en: "Brand context, key messages and value props — everything your brand stands for." },
  "brand.tab.knowledge.context": { de: "Kontext", en: "Context" },
  "brand.tab.knowledge.headlines": { de: "Kern-Botschaften", en: "Key messages" },
  "brand.tab.knowledge.valueProps": { de: "Value Props", en: "Value props" },
  "brand.tab.knowledge.empty": { de: "Keine Intelligence-Daten. Analysiere deine Website, um Kontext zu sammeln.", en: "No intelligence data yet. Analyse your website to capture context." },
  "brand.tab.competitor.title": { de: "Analyse", en: "Analysis" },
  "brand.tab.competitor.subtitle": { de: "Positionierung, Wettbewerb und Markt-Insights.", en: "Positioning, competition and market insights." },
  "brand.tab.competitor.positioning": { de: "Positionierung", en: "Positioning" },
  "brand.tab.competitor.claim": { de: "Claim / Tagline", en: "Claim / tagline" },
  "brand.tab.competitor.keyMessages": { de: "Kern-Botschaften", en: "Key messages" },
  "brand.tab.competitor.empty": { de: "Noch keine Analyse. Analysiere deine Website für einen ersten Entwurf.", en: "No analysis yet. Analyse your website to draft a first take." },
  "brand.tab.guidelines.title": { de: "Guidelines", en: "Guidelines" },
  "brand.tab.guidelines.subtitle": { de: "Style Guide, Brand Book und Regeln zur Anwendung.", en: "Style guide, brand book and usage rules." },
  "brand.tab.guidelines.empty": { de: "Lade ein Brand Book als PDF hoch, um Guidelines zu hinterlegen.", en: "Upload a brand book PDF to add guidelines." },
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
