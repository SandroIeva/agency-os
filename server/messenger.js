// What a messenger button DOES, with no idea which messenger asked.
//
// Telegram and Slack disagree about almost everything on the surface: HTML
// versus Block Kit, inline_keyboard versus blocks, editMessageText versus
// chat.update. They agree completely about the part that matters — which
// columns a card can be pushed into, who is allowed to push it, who may be
// handed it, and what the card says. That part lives here, once.
//
// The alternative was a copy per provider, and this codebase has already paid
// for that mistake: the dashboard and the settings dialog each held their own
// idea of what a task icon looked like, and they quietly disagreed for months.
//
// Everything here takes `db` as its first argument: a supabase-js client made
// with the SERVICE KEY. That is the reason two of these functions exist at all.

// The columns a task can be pushed into from a chat. "todo" is missing on
// purpose: nothing that arrives as a notification needs a button to put it back
// where it already was. These are the board's own keys (DEFAULT_COLUMNS in
// src/App.jsx) and the values the column_key text field actually holds.
export const MOVE_COLUMNS = ["progress", "review", "done"];

export const COLUMN_LABELS = {
  de: { progress: "In Arbeit", review: "Review", done: "Erledigt" },
  en: { progress: "In progress", review: "Review", done: "Done" },
};

export const PRIORITY_LABELS = {
  de: { high: "Hoch", medium: "Mittel", low: "Niedrig" },
  en: { high: "High", medium: "Medium", low: "Low" },
};

export const DETAIL_MAX = 600;
export const CHECKLIST_MAX = 8;

// ── The two gates the database would normally apply, and here does not ───────
// A service-key client writes past RLS, and enforce_read_only opens with
// "if auth.uid() is null then return new", which is the case for every write
// made from a server. Left out, a chat button is a door around both the
// permission model and the paywall.

// Membership of the task's workspace, or of the one project it belongs to: a
// project invite grants access without workspace membership.
export const mayTouchTask = async (db, userId, task) => {
  if (!userId || !task) return false;
  if (task.org_id) {
    const { data } = await db.from("org_members").select("id")
      .eq("org_id", task.org_id).eq("user_id", userId).maybeSingle();
    if (data) return true;
  }
  if (task.project_id) {
    const { data } = await db.from("project_members").select("id")
      .eq("project_id", task.project_id).eq("user_id", userId).maybeSingle();
    if (data) return true;
  }
  return false;
};

export const orgIsReadOnly = async (db, orgId) => {
  if (!orgId) return false;
  const { data } = await db.rpc("org_is_read_only", { p_org: orgId });
  return !!data;
};

// ── Who a task can be handed to ─────────────────────────────────────────────
// Sorted by name, so the row a button sits in does not move between the moment
// the list is drawn and the moment somebody presses it.
export const handoverCandidates = async (db, task, exceptUserId) => {
  let ids = [];
  if (task.org_id) {
    const { data } = await db.from("org_members").select("user_id").eq("org_id", task.org_id);
    ids = (data || []).map(r => r.user_id);
  } else if (task.project_id) {
    const { data } = await db.from("project_members").select("user_id").eq("project_id", task.project_id);
    ids = (data || []).map(r => r.user_id);
  }
  ids = [...new Set(ids)].filter(id => id && id !== exceptUserId);
  if (!ids.length) return [];
  const { data: profiles } = await db.from("profiles").select("id, display_name, email").in("id", ids);
  return (profiles || [])
    .map(p => ({ id: p.id, name: p.display_name || (p.email || "").split("@")[0] || "?" }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 20); // a keyboard, not a directory
};

// Telegram caps callback_data at 64 bytes and two uuids do not fit. The target
// travels as the first 8 characters of its id and is resolved against the LIVE
// list on the way back, which re-checks membership for free: somebody removed
// from the workspace since the buttons were drawn is simply not there. Eight
// hex characters collide once in four billion, and a collision is refused
// rather than guessed at. Slack is roomier but uses the same scheme, because
// the resolve-against-live-list behaviour is the point, not the byte count.
export const ID_HINT = 8;
export const resolveHint = (candidates, hint) => {
  const hits = candidates.filter(c => c.id.slice(0, ID_HINT) === hint);
  return hits.length === 1 ? hits[0] : null;
};

export const displayName = async (db, userId) => {
  const { data } = await db.from("profiles").select("display_name, email").eq("id", userId).maybeSingle();
  return data?.display_name || (data?.email || "").split("@")[0] || "?";
};

// ── What the card says ──────────────────────────────────────────────────────
// Returned as data, not as a formatted string: one messenger renders it as
// HTML, the other as Block Kit. Fetched fresh on every send AND on every button
// press, so a message that gets rewritten shows the checklist as it stands now.
// The line over the title. The workspace alone was not enough: somebody with
// one workspace and six clients reads "i7OS" and learns nothing, while the
// project is the thing that says which pile of work this belongs to. Both, in
// the order you would say them out loud.
export const headLine = (workspace, project) => [workspace, project].filter(Boolean).join(" · ");

export const taskFacts = async (db, taskId, lang) => {
  const de = lang !== "en";
  const { data: task } = await db.from("tasks")
    .select("description, priority, due_date, project_name").eq("id", taskId).maybeSingle();
  if (!task) return null;
  const project = task.project_name || "";

  const d = String(task.description || "").trim();
  const description = d ? (d.length > DETAIL_MAX ? d.slice(0, DETAIL_MAX).trimEnd() + "…" : d) : "";

  const facts = [];
  const prio = PRIORITY_LABELS[de ? "de" : "en"][task.priority];
  if (prio) facts.push(`${de ? "Priorität" : "Priority"}: ${prio}`);
  if (task.due_date) {
    // The app writes a date-only field through new Date("YYYY-MM-DD"), which
    // parses as UTC midnight, and every stored due_date is 00:00 UTC. Reading
    // it back in UTC is therefore exact, and needs neither a timezone nor Intl,
    // which the edge runtimes do not always carry in full.
    const t = new Date(task.due_date);
    const dd = String(t.getUTCDate()).padStart(2, "0");
    const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
    const yy = t.getUTCFullYear();
    facts.push(`${de ? "Frist" : "Due"}: ${de ? `${dd}.${mm}.${yy}` : `${yy}-${mm}-${dd}`}`);
  }

  const { data: rows } = await db.from("task_checklist_items")
    .select("text, checked").eq("task_id", taskId).order("position", { ascending: true });
  const items = rows || [];
  const checklist = items.length ? {
    label: de ? "Checkliste" : "Checklist",
    done: items.filter(i => i.checked).length,
    total: items.length,
    shown: items.slice(0, CHECKLIST_MAX).map(i => ({ text: i.text || "", checked: !!i.checked })),
    more: Math.max(0, items.length - CHECKLIST_MAX),
    moreLabel: (n) => (de ? `und ${n} weitere` : `and ${n} more`),
  } : null;

  return { project, description, facts, checklist };
};

// ── The two things a button actually writes ─────────────────────────────────

// Whoever asked for a task hears that it is finished, once, on the move INTO
// done, and never from their own hand. Written as data so the reader gets it in
// THEIR language. The insert trips the notifications trigger, so it reaches
// every messenger they have connected.
export const moveTaskTo = async (db, task, target, byUserId) => {
  const { error } = await db.from("tasks")
    .update({ column_key: target, updated_at: new Date().toISOString() }).eq("id", task.id);
  if (error) return { ok: false };
  if (target === "done" && task.creator_id && task.creator_id !== byUserId) {
    const actor = await displayName(db, byUserId);
    await db.from("notifications").insert({
      user_id: task.creator_id,
      org_id: task.org_id,
      type: "task_completed",
      title: "Aufgabe erledigt",
      body: `${actor} hat "${task.title || ""}" erledigt`,
      metadata: { task_id: task.id, actor, subject: task.title || "" },
    });
  }
  return { ok: true };
};

export const handTaskTo = async (db, task, target, byUserId) => {
  const { error } = await db.from("tasks")
    .update({ assignee_id: target.id, updated_at: new Date().toISOString() }).eq("id", task.id);
  if (error) return { ok: false };
  const actor = await displayName(db, byUserId);
  await db.from("notifications").insert({
    user_id: target.id,
    org_id: task.org_id,
    type: "task_assigned",
    title: "Aufgabe weitergegeben",
    body: `${actor} hat dir "${task.title || ""}" weitergegeben`,
    metadata: { task_id: task.id, actor, subject: task.title || "" },
  });
  return { ok: true };
};

// ── Making a task from a line of text ───────────────────────────────────────

// The first line is the title, the rest is the description. That is how people
// already write a task into a chat, so it needs no syntax to learn.
export const splitDraft = (text) => {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const title = (lines.shift() || "").trim().slice(0, 200);
  const description = lines.join("\n").trim() || null;
  return { title, description };
};

// Where a task could go. Workspaces the person belongs to, and within one
// workspace the projects they are a MEMBER of: the board hides tasks whose
// project you are not in, so offering the others would create invisible work.
export const workspacesFor = async (db, userId) => {
  // Without this, a caller that forgot to select user_id asks for
  // "user_id = undefined", gets nothing back, and the bot tells a member of
  // four workspaces that they are in none. Which is exactly what happened.
  if (!userId) return [];
  const { data } = await db.from("org_members").select("org_id").eq("user_id", userId);
  const ids = [...new Set((data || []).map(r => r.org_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data: orgs } = await db.from("organizations").select("id, name").in("id", ids);
  return (orgs || []).map(o => ({ id: o.id, name: o.name || "?" }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const projectsFor = async (db, userId, orgId) => {
  if (!userId || !orgId) return [];
  const { data: mine } = await db.from("project_members").select("project_id").eq("user_id", userId);
  const ids = [...new Set((mine || []).map(r => r.project_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data: rows } = await db.from("projects").select("id, name").eq("org_id", orgId).in("id", ids);
  return (rows || []).map(r => ({ id: r.id, name: r.name || "?" }))
    .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
};

// The write. Both gates again, because a service-key insert goes past RLS and
// past enforce_read_only, which returns early when auth.uid() is null. There is
// no per-plan limit on the NUMBER of tasks — plan_limits caps storage, seats,
// workspaces, projects and scans, and nothing else — so read-only is the whole
// of the paywall here.
export const createTask = async (db, { userId, orgId, projectName, title, description,
                                       priority, dueDate, assigneeId }) => {
  if (!userId || !orgId || !title) return { ok: false, reason: "incomplete" };
  const { data: member } = await db.from("org_members").select("id")
    .eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  if (!member) return { ok: false, reason: "denied" };
  if (await orgIsReadOnly(db, orgId)) return { ok: false, reason: "read_only" };

  const { data, error } = await db.from("tasks").insert({
    title,
    description: description || null,
    org_id: orgId,
    project_name: projectName || null,
    column_key: "todo",
    priority: priority || "medium",
    due_date: dueDate || null,
    creator_id: userId,
    assignee_id: assigneeId || userId,
  }).select("id, title").maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  return { ok: true, task: data };
};

// ── The questions a new task still needs answering ──────────────────────────
// Every answer rides in the button's own callback_data and nothing is stored:
//   n:<org8>:<proj8>:<prio>:<due>:<asg8>
// The number of segments IS the step, so the flow has no memory to keep, keep
// clean, or expire. Telegram allows 64 bytes and the longest form is 32.
// A dash means "deliberately none", so it is never confused with "not asked".
export const DRAFT_STEPS = ["project", "priority", "due", "assignee"];
export const draftStep = (parts) => DRAFT_STEPS[Math.max(0, parts.length - 2)] || null;
export const draftDone = (parts) => parts.length >= 6;

export const PRIORITY_CODES = { h: "high", m: "medium", l: "low" };

// Relative, because nobody types a date into a chat. Computed from today in the
// person's own time zone where the runtime can do it, and from UTC where it
// cannot: an edge runtime does not always carry the full Intl data, and a due
// date that is silently wrong is worse than one that is occasionally a day off
// for somebody awake after midnight.
export const DUE_CODES = ["0", "t", "m", "f", "w"];
export const dueDateFor = (code, timezone, now = new Date()) => {
  if (!code || code === "0" || code === "-") return null;
  let y = now.getUTCFullYear(), mo = now.getUTCMonth(), d = now.getUTCDate();
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      }).format(now).split("-").map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        y = parts[0]; mo = parts[1] - 1; d = parts[2];
      }
    } catch (_) { /* no tz data in this runtime; UTC it is */ }
  }
  const at = new Date(Date.UTC(y, mo, d));
  if (code === "m") at.setUTCDate(at.getUTCDate() + 1);
  if (code === "w") at.setUTCDate(at.getUTCDate() + 7);
  if (code === "f") {
    // The coming Friday. Today, when today is a Friday.
    const ahead = (5 - at.getUTCDay() + 7) % 7;
    at.setUTCDate(at.getUTCDate() + ahead);
  }
  // Midnight UTC, which is exactly how the app's own date field stores it.
  return at.toISOString();
};

export const timezoneOf = async (db, userId) => {
  const { data } = await db.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  return data?.timezone || null;
};

// ── Adding a description afterwards ─────────────────────────────────────────
// The four questions are taps, and a description is typing, so it comes last
// and is optional: the task already exists by then, and an answer nobody gives
// costs nothing.
//
// The link between the question and the answer is a LINK. Telegram hands back
// the message being replied to, but only one level deep, so the bot's question
// has to carry the task itself. It carries it as a text_link on the title,
// which is a useful link in its own right, and the id is read back out of the
// entity rather than out of anything we had to store.
export const TASK_LINK_RE = /[?&]task=([0-9a-f-]{36})/i;
// Which task, and which question. Two of the bot's questions are answered the
// same way, by replying, so the link that carries the task carries the question
// too: list=1 means the reply is a checklist rather than a description.
export const replyTarget = (replied) => {
  const entities = replied?.entities || replied?.caption_entities || [];
  for (const e of entities) {
    const m = e?.url && TASK_LINK_RE.exec(e.url);
    if (!m) continue;
    const kind = /[?&]list=1/.test(e.url) ? "checklist"
      : /[?&]note=1/.test(e.url) ? "comment" : "description";
    return { taskId: m[1], kind, checklist: kind === "checklist" };
  }
  return null;
};
export const taskIdFromReply = (replied) => replyTarget(replied)?.taskId || null;

export const describeTask = async (db, userId, taskId, text) => {
  const description = String(text || "").trim();
  if (!description) return { ok: false, reason: "incomplete" };
  const { data: task } = await db.from("tasks")
    .select("id, title, org_id, project_id").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, reason: "gone" };
  // The same two gates as every other write from a server.
  if (!(await mayTouchTask(db, userId, task))) return { ok: false, reason: "denied" };
  if (await orgIsReadOnly(db, task.org_id)) return { ok: false, reason: "read_only" };
  const { error } = await db.from("tasks")
    .update({ description, updated_at: new Date().toISOString() }).eq("id", taskId);
  if (error) return { ok: false, reason: "failed" };
  return { ok: true, task };
};

// The same four questions, asked of a state OBJECT rather than of Telegram's
// positional callback_data. Slack has room for a proper payload in a button, so
// it carries one. A test pins the two orders together, because the rule is the
// rule and only the transport differs.
export const nextQuestion = (st) => {
  if (st?.p === undefined) return "project";
  if (!st?.r) return "priority";
  if (!st?.u) return "due";
  if (!st?.a) return "assignee";
  return null;
};

// ── Checklists ──────────────────────────────────────────────────────────────
// One line, one item. Numbering, dashes and bullets are stripped, because
// people type them without thinking and nobody wants "1. 1. Preise prüfen".
export const CHECKLIST_LINES_MAX = 30;
export const splitChecklist = (text) => String(text || "")
  .replace(/\r/g, "")
  .split("\n")
  .map(l => l.replace(/^\s*(?:[-*•]|\[[ xX]?\]|\d+[.)])\s*/, "").trim())
  .filter(Boolean)
  .slice(0, CHECKLIST_LINES_MAX)
  .map(t => t.slice(0, 300));

export const addChecklist = async (db, userId, taskId, text) => {
  const items = splitChecklist(text);
  if (!items.length) return { ok: true, added: 0 };
  const { data: task } = await db.from("tasks")
    .select("id, org_id, project_id").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, reason: "gone" };
  // The same two gates as every other write from a server.
  if (!(await mayTouchTask(db, userId, task))) return { ok: false, reason: "denied" };
  if (await orgIsReadOnly(db, task.org_id)) return { ok: false, reason: "read_only" };
  // Appended, not replacing: a task may already have items, and position is
  // what the board orders by.
  const { data: existing } = await db.from("task_checklist_items")
    .select("position").eq("task_id", taskId).order("position", { ascending: false }).limit(1);
  const from = (existing?.[0]?.position ?? -1) + 1;
  const { error } = await db.from("task_checklist_items").insert(
    items.map((t, i) => ({ task_id: taskId, text: t, checked: false, position: from + i })));
  if (error) return { ok: false, reason: "failed" };
  return { ok: true, added: items.length };
};

// ── Comments ────────────────────────────────────────────────────────────────
// Who may: any member who may touch the task. That is what the RLS policy on
// task_comments says ("Org members can insert task comments"), and a bot that
// is stricter than the app it speaks for would be its own kind of bug.
//
// Who hears about it: everybody involved except whoever wrote it, which means
// the assignee AND the person who asked for the task. The app notifies only the
// assignee today, so a creator who delegated something never heard back on it.
export const commentOnTask = async (db, userId, taskId, text) => {
  const body = String(text || "").trim().slice(0, 4000);
  if (!body) return { ok: false, reason: "incomplete" };
  const { data: task } = await db.from("tasks")
    .select("id, title, org_id, project_id, creator_id, assignee_id").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, reason: "gone" };
  if (!(await mayTouchTask(db, userId, task))) return { ok: false, reason: "denied" };
  if (await orgIsReadOnly(db, task.org_id)) return { ok: false, reason: "read_only" };

  const { data: comment, error } = await db.from("task_comments")
    .insert({ task_id: taskId, user_id: userId, text: body })
    .select("id").maybeSingle();
  if (error) return { ok: false, reason: "failed" };

  const actor = await displayName(db, userId);
  const tell = [...new Set([task.assignee_id, task.creator_id])].filter(id => id && id !== userId);
  for (const uid of tell) {
    await db.from("notifications").insert({
      user_id: uid,
      org_id: task.org_id,
      type: "comment_added",
      title: "Neuer Kommentar",
      body: `${actor} hat "${task.title || ""}" kommentiert`,
      metadata: { task_id: taskId, comment_id: comment?.id, actor, subject: task.title || "" },
    });
  }
  return { ok: true, told: tell.length };
};

// ── Which notifications are worth a phone buzzing ───────────────────────────
// Shared, because a switch that is off in the settings panel and honoured by
// one messenger but not the other is worse than no switch. Chat messages are
// off by default on purpose: one push per chat line is unbearable after a day,
// and image_ready fires while you are already looking at the app.
//
// An unknown type is worth sending. A notification the app starts writing
// should reach people rather than be dropped until somebody remembers to add
// it here, which is why this asks for an explicit false.
export const DEFAULT_TYPES = {
  task_assigned: true,
  task_completed: true,
  comment_mention: true,
  comment_added: true,
  project_added: true,
  member_joined: true,
  storage_warning: true,
  chat_message: false,
  image_ready: false,
};
export const typeWanted = (link, type) =>
  ({ ...DEFAULT_TYPES, ...(link?.types || {}) })[type] !== false;
