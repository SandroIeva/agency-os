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
