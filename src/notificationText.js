// What a notification SAYS, in the reader's language.
//
// A notification row used to store finished German prose, written at the moment
// something happened. That prose then went everywhere: the bell in the app, and
// a Telegram chat belonging to someone who may well have the product in
// English. "Neue Aufgabe zugewiesen" under English buttons is where that showed.
//
// So the row stores DATA now — the type, plus who did it and what to — and each
// surface renders it for whoever is reading. This file is that renderer, shared
// by the browser bundle AND by api/telegram.js on the edge runtime. Keep it
// dependency-free for exactly that reason, the way src/entitlements.js is.
//
// Rows written before this carry no actor, and types missing from the table
// below have nothing to render from. Both fall back to the title and body the
// row was written with, so nothing that already exists changes or breaks.

export const NOTIF_TEXT = {
  task_assigned: {
    title: (de) => (de ? "Aufgabe zugewiesen" : "Task assigned"),
    body: (de, m) => (de
      ? `${m.actor} hat dir "${m.subject}" zugewiesen`
      : `${m.actor} assigned you "${m.subject}"`),
  },
  task_completed: {
    title: (de) => (de ? "Aufgabe erledigt" : "Task done"),
    body: (de, m) => (de
      ? `${m.actor} hat "${m.subject}" erledigt`
      : `${m.actor} completed "${m.subject}"`),
  },
  comment_added: {
    title: (de) => (de ? "Neuer Kommentar" : "New comment"),
    body: (de, m) => (de
      ? `${m.actor} hat "${m.subject}" kommentiert`
      : `${m.actor} commented on "${m.subject}"`),
  },
  comment_mention: {
    title: (de) => (de ? "Du wurdest erwähnt" : "You were mentioned"),
    body: (de, m) => (de
      ? `${m.actor} hat dich in "${m.subject}" erwähnt`
      : `${m.actor} mentioned you in "${m.subject}"`),
  },
  project_added: {
    title: (de) => (de ? "Zu einem Projekt hinzugefügt" : "Added to a project"),
    body: (de, m) => (de
      ? `${m.actor} hat dich zum Projekt "${m.subject}" hinzugefügt`
      : `${m.actor} added you to the project "${m.subject}"`),
  },
  // The body is the message somebody typed. Translating that would be absurd,
  // so only the line above it is rendered and the body is left alone.
  // No actor: nobody DID this, the workspace crossed 90% of its storage.
  // `ready` says which metadata the text needs instead.
  storage_warning: {
    noActor: true,
    ready: (m) => typeof m.pct === "number",
    title: (de) => (de ? "Speicher fast voll" : "Storage almost full"),
    body: (de, m) => (de
      ? `Dein Workspace nutzt ${m.pct}% des Speichers. Upgrade, um weiter Dateien hochladen zu können.`
      : `Your workspace uses ${m.pct}% of its storage. Upgrade to keep uploading files.`),
  },
  chat_message: {
    subjectless: true,
    title: (de, m) => (de ? `Neue Nachricht von ${m.actor}` : `New message from ${m.actor}`),
    body: null,
  },
};

export const notifLines = (n, de) => {
  const stored = { title: n?.title || "", body: n?.body || "" };
  const spec = NOTIF_TEXT[n?.type];
  const m = n?.metadata || {};
  if (!spec) return stored;
  if (spec.noActor) {
    if (spec.ready && !spec.ready(m)) return stored;
    return { title: spec.title(de, m), body: spec.body ? spec.body(de, m) : stored.body };
  }
  if (!m.actor) return stored;
  if (!spec.subjectless && !m.subject) return stored;
  return {
    title: spec.title(de, m),
    body: spec.body ? spec.body(de, m) : stored.body,
  };
};
