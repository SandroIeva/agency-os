// ─────────────────────────────────────────────
// i7OS — Central AI System Prompt
// ─────────────────────────────────────────────
// The system prompt every LLM provider receives. Provider-agnostic: Claude, GPT
// and Gemini all get the same context, assembled from the user's current state.
//
// Two surfaces read this file and they are NOT the same conversation:
//   "voice" — the sphere on the dashboard. Spoken aloud, heard once, no scroll
//             back. Written for the ear.
//   "chat"  — the typed dialog. Read on screen, re-readable, can hold structure.
// `surface` picks the register. Everything else is shared.
//
// ── Why this file is written the way it is ───────────────────────────────────
// The knowledge below is a MAP, not marketing copy. An earlier version opened
// with a finished sentence ("a unified workspace for creative agencies that
// combines project management, file management…") and the model did the obvious
// thing: it read that sentence out whenever anybody asked what the app is. The
// answer was a brochure, and it described an app that had not existed for
// months. Facts a model has to assemble into an answer cannot be recited;
// sentences can. So: no sentence in here is answer-shaped.

// ── Base identity ────────────────────────────
// Two registers, one voice. The rules that differ are the ones about LENGTH and
// SHAPE, because a bulleted list is useful on screen and unlistenable aloud.
const identity = (surface) => {
  const spoken = surface === "voice";
  return `You are the assistant inside i7OS, a workspace built for creative agencies and the people who run them: designers, strategists, art directors, project leads.

Who you are: a sharp creative director who happens to know the software inside out. Calm, direct, curious about what the person is actually trying to make. You have opinions and you offer them.

How you talk:
${spoken
  ? `- You are being SPOKEN ALOUD. Write for the ear: full sentences, no bullet points, no numbered lists, no headings, no markdown, no parentheses, no URLs, no file paths.
- Two to four sentences. Say the useful thing first. If there is more, offer it ("I can go through that if you want") instead of delivering it unasked.
- Never spell out a menu path aloud. Say where something lives the way a colleague would: "that's under Brand, in Strategie" and not "Brand → Strategie → Brand Vision".`
  : `- Short by default: a few sentences. Go longer only when the question genuinely needs it, and then use structure.
- Plain formatting. No headings for a two-line answer.`}
- This is a CONVERSATION, not a series of unrelated answers. You can see what was said earlier in this exchange, so use it: refer back, build on it, do not re-introduce yourself or restate what you both already know.
- Never recite. You know a lot about this app, but a description is not an answer. Work out what THIS person is asking and answer that.
- When a question is broad, do not empty the whole bucket. Name the two or three things that fit their situation, then ask what they want to go into.
- No filler. Never open with "Great question", "Sure thing", "I'd be happy to". Start with the answer.
- No emojis. Ever.
- No em dashes in what you write. Use a comma, or write two sentences.
- Say "i7OS", closed up. Never "i7 OS".
- When you do not know something, say so in one clause and move on. Do not invent features, menu paths or button names.`;
};

// ── App knowledge ────────────────────────────
// Facts, listed. Deliberately not prose: see the note at the top of the file.
const APP_KNOWLEDGE = `
i7OS, in one line for your own orientation (do NOT read this out): a workspace where an agency's thinking, making and planning live in the same place, so a brand's strategy, its assets, the work in progress and the schedule are not in four different tools.

It is not a project management tool with extras. Roughly: it is a place to DEFINE a brand, a place to MAKE things, a place to KEEP them, a place to PLAN, and a place to MEASURE what went out.

DEFINE. The Brand section, five pillars. Each is named here as
"German label / English label", because the interface itself switches: USE THE
ONE THAT MATCHES THE LANGUAGE YOU ARE ANSWERING IN, and never mix them. An
English answer that calls a section "Strategie" sends somebody looking for a
word that is not on their screen.
- Strategie / Strategy: Brand Vision (today, 3-year, 5-year, aspiration), Taglines, Personas, Competitors.
- Identität / Identity: Brand Core (claim, description, value propositions, key messages, purpose, vision, mission), Brand Story, Voice & Tone, Brand Avatar.
- Designsystem / Design System: Logo variants, Farben / Colours (primary, secondary, accents), Typografie / Typography, Bildsprache / Imagery (reference images and prompts).
- Audience (the same word in both): connected social channels, the People in the audience, and Analytics.
- Creations (the same word in both): the brand's own Moodboards, Whiteboards and Artboards.
Inside the Brand section itself the fifth tab is Dateien / Files rather than
Creations, and it shows the workspace's files scoped to this brand.
A brand can be filled in by hand or imported: from a website URL, a brand book PDF, a Figma file, or a ZIP of brand assets. Colours, fonts, logos and tone get extracted.
Every project can carry its OWN brand workspace, so an agency holds one per client rather than one per company.

MAKE. Under Erstellen / Create:
- Artwork: an Artboard. A design surface with text, shapes, images, gradients, shadows, blur, layers, alignment, corner radii, and a version history that names what changed. Designs can be imported from Figma and stay editable. Exports as PNG.
- Brainstorm: an infinite whiteboard. Sticky notes, shapes, pen, arrows, images, stickers, comments with @-mentions, and a mind-map mode. Several people can work on one board at the same time.
- Dokument: a rich text document with comments and @-mentions, in folders.
- Social Media Post: a composer that writes and schedules a post to a connected channel, in the right format for it.
Images can also be GENERATED, by asking the sphere out loud ("make me an image of…"), and the result can be saved into the workspace.

KEEP. The Files Manager (Dateien / Files):
- Media: every file in the workspace, uploaded or generated, in folders.
- Docs: the documents.
- Browse: saved links, in folders, each with the page's own title and icon.
Moodboards can pull images straight from a connected Pinterest board.

PLAN:
- Aufgaben (Tasks), Kanban Board, Timeline (sprints), Kalender (with Google Calendar sync), Notizen.
- Projects: each with its own members, tasks, files and optionally its own brand.

TALK. Messenger: team chat, one-to-one and in groups, with file attachments. Notifications can also reach people in Telegram or Slack, where they can act on them without opening the app.

MEASURE. Analytics under Brand → Audience: reach and performance of the connected social channels, and a strategy analysis that reads the channels and reports strengths, gaps and recommendations.

Getting around: the Plus button at the bottom centre opens the main menu, two columns, categories on the left and their entries on the right. The Grid button goes back to the dashboard. The Mic button opens the typed dialog. On the dashboard, swipe up for the overview and down for tasks. Files dropped onto the dashboard start a spoken conversation about where they should go. Dark and light mode both exist.

Each workspace is a company or a team. A person can be in several. Members have roles: Mitglied, Branddesigner, Projektmanager, each with its own permissions.`;

// ── Capabilities ─────────────────────────────
// Honest, and current. The old version told the model it could not create
// anything and that those features were "planned for future updates", so it
// declined things the app had shipped.
const CAPABILITIES = `
What you can do in this conversation:
- Think with the person: brand strategy, positioning, naming, copy, concepts, art direction, critique of an idea they describe.
- Write things: taglines, brand stories, value propositions, post copy, briefs, outlines.
- Explain any part of i7OS and say where something lives.
- Answer general questions on marketing, design, and running creative work.

What happens elsewhere, not by you:
- You do not create, edit or delete tasks, events, files or documents yourself. Say where the person can do it, in one sentence, rather than apologising for a limitation.
- Spoken commands ARE handled, but by the app and not by you: "open calendar", "open projects", "dark mode", and "make me an image of…" all act directly. Do not claim credit for those and do not pretend you cannot do them.
- You cannot browse the web or see the screen. If a question needs either, say what you would need.`;

// ── Context-aware additions ──────────────────
// Keys are the app's real `currentView` values. A key that names no view is a
// line the model never sees.
const VIEW_CONTEXTS = {
  dashboard:   "They are on the dashboard: the sphere, their tasks, notifications, and the main menu behind the Plus button.",
  brand:       "They are in the Brand section, working on the brand itself.",
  touchpoints: "They are in Audience: connected channels, the people in the audience, and analytics.",
  creations:   "They are in Creations, among the moodboards, whiteboards and artboards of this brand.",
  assets:      "They are in the Files Manager, among the workspace's media, documents and saved links.",
  projects:    "They are in Projects.",
  kanban:      "They are on a Kanban board.",
  timeline:    "They are in the Timeline, planning sprints.",
  calendar:    "They are in the Calendar, which can sync with Google Calendar.",
  notes:       "They are in Notes.",
  whiteboard:  "They are on a whiteboard, an infinite canvas for sketching an idea out.",
  chat:        "They are in Messenger, talking to their team.",
  createpost:  "They are composing a post for a social channel.",
  settings:    "They are in Settings: profile, workspace, members, connected accounts, appearance, AI models.",
};

// The app's language, said plainly. `appLanguage` is the interface setting, and
// an answer that ignores it is an English paragraph in a German product.
// Naming a section is the one place this leaks: the app's own labels differ
// per language, and quoting the German ones into an English answer is what
// happened, so the rule is repeated where it bites.
const LANGUAGE_RULE = {
  de: "\nThe interface is set to GERMAN. Answer in German, in the informal du, and use the German name of every section, tab and button. If the person clearly speaks or writes another language, follow them into it.",
  en: "\nThe interface is set to ENGLISH. Answer in English, and use the English name of every section, tab and button: never leave a German label in an English sentence. If the person clearly speaks or writes another language, follow them into it.",
};

// ── What the open view is holding ────────────
// VIEW_CONTEXTS says WHICH view somebody is in. This says what is IN it, and
// the view itself is what publishes it, as plain label/value pairs. Keeping
// this file ignorant of what a post composer is means a second view can join
// without touching it.
//
// Values are truncated hard. A caption can run to a few thousand characters,
// and the point here is to tell the model what it is looking at, not to move
// the document into the prompt.
const VIEW_DATA_CAP = 600;
const renderViewData = (data) => {
  if (!data || typeof data !== "object") return "";
  const lines = [];
  for (const [label, raw] of Object.entries(data)) {
    if (raw === null || raw === undefined || raw === "") continue;
    let v = String(raw).replace(/\s+/g, " ").trim();
    if (!v) continue;
    if (v.length > VIEW_DATA_CAP) v = v.slice(0, VIEW_DATA_CAP) + " […]";
    lines.push(`- ${label}: ${v}`);
  }
  if (!lines.length) return "";
  return `\nWhat is on their screen right now:\n${lines.join("\n")}\n`;
};

// Said when the open view offers nothing to do. Without it the model offers to
// "add that to the description", which it then cannot do.
const NO_ACTIONS_RULE = "\nYou can SEE these fields but you cannot fill them in. When you write something for a field, give the finished text plainly so it can be copied, and do not claim to have inserted it.";

// ── Actions: the model asking the app to do something ────────────────────────
// The one channel by which a reply becomes a change on screen. The markers, the
// instructions the model is given, and the parser that reads them back all live
// here together on purpose: the protocol has two ends, and two ends written in
// two files drift the first time one of them is edited.
//
// A sentinel block rather than provider tool-calling, because api/chat-multi
// speaks to Claude, OpenAI and Gemini through one shape, and their tool APIs
// are three different shapes. Neither reply path streams, so the whole text is
// in hand before anything is shown or spoken and the block can be cut out
// cleanly.
const ACTION_OPEN = "[[i7os:";
const ACTION_CLOSE = "[[/i7os]]";
export const viewActionPattern = () =>
  /\[\[i7os:([A-Za-z][A-Za-z0-9_]{0,40})\]\]([\s\S]*?)\[\[\/i7os\]\]/g;

// At most this many characters of payload, and at most this many blocks. A
// reply that asks for fifty changes is a runaway, not an instruction.
export const ACTION_PAYLOAD_CAP = 10000;
export const ACTION_CALL_CAP = 3;

/**
 * Pull action blocks out of a model reply.
 * @returns {{clean: string, calls: {name: string, value: string}[]}}
 */
export function parseViewActions(text) {
  if (!text || typeof text !== "string") return { clean: text || "", calls: [] };
  const calls = [];
  const clean = text
    .replace(viewActionPattern(), (_m, name, body) => {
      if (calls.length < ACTION_CALL_CAP) {
        calls.push({ name, value: body.trim().slice(0, ACTION_PAYLOAD_CAP) });
      }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { clean, calls };
}

// What the model is told it may do. Only ever the actions the OPEN view
// published, so a name it reads here is a name that exists a moment later.
const renderViewActions = (actions) => {
  const names = Object.keys(actions || {});
  if (!names.length) return "";
  const list = names.map((k) => `- ${k}: ${actions[k]}`).join("\n");
  return `
You can also DO things on this screen, not only talk about them. Available here:
${list}

To do one, put a block at the very END of your reply, on its own lines:
${ACTION_OPEN}<name>]]
the finished content, and nothing else
${ACTION_CLOSE}

Rules, and they matter because this CHANGES the person's screen:
- Only when they asked for that thing to happen. "What would you write?" is a question, not an instruction to overwrite their field.
- Only the names listed above. Anything else is dropped.
- The block is cut out before your reply is shown or spoken, so also say one short sentence outside it. Do not describe the block or repeat its content.
- Inside the block: the finished content only. No quotes around it, no markdown, no preamble.
- Never more than one block per action.`;
};

// Trim a value to a length the prompt can afford, and say when it was trimmed.
const cap = (v, n = 400) => {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + " […]" : t;
};

// The Brand editor seeds purpose/vision/mission with German sentences telling
// you what to write there. Saved unchanged they are an instruction to the user,
// not a fact about the brand, and reading one out as "your purpose" is worse
// than saying nothing. Matched on their openings, which is what they are.
const PLACEHOLDER_OPENINGS = [
  "definiere hier", "beschreibe die zukunft", "formuliere prägnant", "formuliere praegnant",
];
const real = (v) => {
  const t = String(v ?? "").trim();
  if (t.length < 2) return false;
  const low = t.toLowerCase();
  return !PLACEHOLDER_OPENINGS.some((p) => low.startsWith(p));
};

// Section content is stored as editor HTML. Strip it: the brand's words matter,
// its paragraph tags do not.
const plainText = (html) => String(html ?? "")
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
  .replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, " ").trim();

// One brand rendered as facts. Shared by the workspace brand and by every
// project brand, because a customer's brand is a brand in its own right and
// two renderers would have drifted the first time a field was added to one.
const brandFieldLines = (brand) => {
  const lines = [];
  if (brand.name) lines.push(`- Brand name: ${brand.name}`);
  if (brand.claim) lines.push(`- Claim / tagline: ${brand.claim}`);
  if (brand.description) lines.push(`- Description: ${cap(brand.description)}`);
  if (brand.website_url) lines.push(`- Website: ${brand.website_url}`);

  // Purpose, vision and mission. The editor seeds the fields with German
  // instructions telling you what to write; if those were saved unchanged
  // they are a prompt for the user, not a statement about the brand, and
  // reciting them as the brand's purpose would be worse than silence.
  const pvm = brand.pvm || {};
  if (real(pvm.purpose)) lines.push(`- Purpose: ${cap(pvm.purpose)}`);
  if (real(pvm.vision)) lines.push(`- Mission statement (vision): ${cap(pvm.vision)}`);
  if (real(pvm.mission)) lines.push(`- Mission: ${cap(pvm.mission)}`);

  // The vision over time, which is a different field from pvm.vision.
  const vis = brand.vision || {};
  if (real(vis.aspiration)) lines.push(`- Aspiration: ${cap(vis.aspiration)}`);
  if (real(vis.now)) lines.push(`- Where the brand is today: ${cap(vis.now)}`);
  if (real(vis.year3)) lines.push(`- Where it wants to be in 3 years: ${cap(vis.year3)}`);
  if (real(vis.year5)) lines.push(`- Where it wants to be in 5 years: ${cap(vis.year5)}`);

  if (Array.isArray(brand.brand_values) && brand.brand_values.length) {
    const vals = brand.brand_values.slice(0, 8)
      .map(v => (typeof v === "string" ? v : v?.name && (v.reason ? `${v.name} (${v.reason})` : v.name)))
      .filter(Boolean);
    if (vals.length) lines.push(`- Brand values: ${vals.join(" · ")}`);
  }

  const soul = brand.soul || {};
  const archetype = [soul.archetypePrimary, soul.archetypeSecondary].filter(Boolean).join(" / ");
  const soulBits = [
    archetype && `archetype ${archetype}`,
    soul.driver && `driven by ${soul.driver}`,
    soul.against && `against ${soul.against}`,
    soul.emotion && `should leave people feeling ${soul.emotion}`,
    soul.temperament && `temperament ${soul.temperament}`,
    soul.voice && `voice ${soul.voice}`,
  ].filter(Boolean);
  if (soulBits.length) lines.push(`- Brand soul: ${soulBits.join(", ")}`);

  const vt = brand.voice_tone || {};
  if (real(vt.intro)) lines.push(`- Voice and tone: ${cap(vt.intro)}`);
  if (Array.isArray(vt.attributes) && vt.attributes.length) {
    const attrs = vt.attributes.slice(0, 8)
      .map(a => (typeof a === "string" ? a : a?.name || a?.label)).filter(Boolean);
    if (attrs.length) lines.push(`- Voice attributes: ${attrs.join(" · ")}`);
  }
  if (Array.isArray(vt.moments) && vt.moments.length) {
    const moments = vt.moments.slice(0, 5)
      .map(m => (typeof m === "string" ? m : [m?.name || m?.label, m?.text || m?.description].filter(Boolean).join(": ")))
      .filter(Boolean);
    if (moments.length) lines.push(`- How it speaks in specific moments: ${moments.map(x => cap(x, 160)).join(" | ")}`);
  }

  if (Array.isArray(brand.taglines) && brand.taglines.length) {
    const tags = brand.taglines.slice(0, 8)
      .map(x => (typeof x === "string" ? x : x?.text || x?.value || x?.name)).filter(Boolean);
    if (tags.length) lines.push(`- Taglines in use or under consideration: ${tags.join(" · ")}`);
  }

  const palette = brand.color_palette || {};
  if (palette.primary || palette.secondary || (palette.accents && palette.accents.length)) {
    const colorBits = [];
    if (palette.primary) colorBits.push(`Primary ${palette.primary}`);
    if (palette.secondary) colorBits.push(`Secondary ${palette.secondary}`);
    if (palette.accents && palette.accents.length) colorBits.push(`Accents ${palette.accents.join(", ")}`);
    if (colorBits.length) lines.push(`- Brand colors: ${colorBits.join(" · ")}`);
  }

  const fonts = brand.intelligence?.fonts;
  if (fonts && (fonts.heading || fonts.body)) {
    const f = [];
    if (fonts.heading) f.push(`Headings: ${fonts.heading}`);
    if (fonts.body) f.push(`Body: ${fonts.body}`);
    lines.push(`- Typography: ${f.join(" · ")}`);
  }

  if (Array.isArray(brand.personas) && brand.personas.length > 0) {
    const personaList = brand.personas.slice(0, 4)
      .map(p => {
        const who = [p.name, p.role].filter(Boolean).join(", ");
        if (!who) return null;
        const bits = [
          p.age && `${p.age}`,
          p.location,
          p.product_expectation || p.description || p.summary,
          Array.isArray(p.goals) && p.goals.length && `wants: ${p.goals.slice(0, 2).join("; ")}`,
          Array.isArray(p.pains) && p.pains.length && `frustrated by: ${p.pains.slice(0, 2).join("; ")}`,
        ].filter(Boolean).map(x => cap(x, 160));
        return bits.length ? `${who} (${bits.join(" — ").replace(/ — /g, ", ")})` : who;
      }).filter(Boolean);
    if (personaList.length) lines.push(`- Personas:\n${personaList.map(x => `  · ${x}`).join("\n")}`);
  }

  if (Array.isArray(brand.competitors) && brand.competitors.length) {
    const comps = brand.competitors.slice(0, 5)
      .map(c => (c?.name ? (c.summary ? `${c.name}: ${cap(c.summary, 160)}` : c.name) : null))
      .filter(Boolean);
    if (comps.length) lines.push(`- Competitors on file: ${comps.join(" | ")}`);
  }

  if (brand.intelligence?.context) {
    lines.push(`- Additional brand info: ${cap(brand.intelligence.context, 800)}`);
  }

  // The free-written strategy sections. Stored as HTML per section key, so
  // the tags come out: the model is being told what the brand says, not how
  // the editor marked it up.
  const sections = brand.section_content && typeof brand.section_content === "object"
    ? brand.section_content : {};
  const written = Object.entries(sections)
    .map(([key, html]) => [key, plainText(html)])
    .filter(([, text]) => text.length > 1)
    .slice(0, 8);
  if (written.length) {
    lines.push("- Written into the brand's own sections:");
    for (const [key, text] of written) lines.push(`  · ${key}: ${cap(text, 400)}`);
  }

  return lines;
};

// ── Assemble the full prompt ─────────────────
/**
 * Build the complete system prompt for any LLM provider.
 *
 * @param {object} options
 * @param {string} options.currentView  — active view id (see VIEW_CONTEXTS)
 * @param {string} options.userName     — display name of the logged-in user
 * @param {string} options.language     — app language ("de" / "en")
 * @param {string} options.surface      — "voice" (spoken) or "chat" (typed)
 * @param {string} options.provider     — llm provider id — informational only
 * @param {object} options.viewData     — label/value pairs the open view published
 * @param {object} options.viewActions  — name/description of what the view can do
 * @param {Array}  options.projectBrands — brand rows of the workspace's project brands
 * @returns {string} the full system prompt
 */
export function buildSystemPrompt({
  currentView = "dashboard",
  userName = "",
  language = "de",
  surface = "chat",
  provider = "claude",
  workspace = null,    // { name, role } — the org the user is currently in
  brand = null,        // brand_profile row
  projects = [],       // [{ name }] — known project names
  viewData = null,     // { label: value } published by the open view itself
  viewActions = null,  // { name: description } the open view offers to perform
  projectBrands = [],  // [{ ...brand_profile row, projectName }] for is_brand projects
} = {}) {
  const parts = [identity(surface), APP_KNOWLEDGE, CAPABILITIES];

  parts.push(LANGUAGE_RULE[language] || LANGUAGE_RULE.de);

  // Add view-specific context
  const viewContext = VIEW_CONTEXTS[currentView];
  if (viewContext) {
    parts.push(`\nRight now:\n${viewContext}`);
  }
  // Straight after the view line, because it is the same subject one step finer.
  const viewDetail = renderViewData(viewData);
  if (viewDetail) parts.push(viewDetail);
  // Either it can act here, or it must say plainly that it cannot. Never both,
  // and never neither, or it invents an answer about its own reach.
  const actionRules = renderViewActions(viewActions);
  if (actionRules) parts.push(actionRules);
  else if (viewDetail) parts.push(NO_ACTIONS_RULE);

  // Add user context
  if (userName) {
    parts.push(`\nThe user's name is ${userName}.`);
  }

  // Workspace context
  if (workspace?.name) {
    parts.push(`\nThe user works inside the "${workspace.name}" workspace${workspace.role ? ` (role: ${workspace.role})` : ""}. ALWAYS spell the workspace name exactly as "${workspace.name}". Never auto-correct it to similar-sounding words (e.g. "Epics", "Apics" or "Epix"). When the user says something that sounds like the workspace name, assume they mean "${workspace.name}".`);
  }

  // Brand context. i7OS is a brand operating system, so this is not decoration:
  // an assistant that does not know the vision, the values or the voice cannot
  // do the job the product exists for. It used to carry seven fields, and the
  // owner rightly called the missing ones "die Fundamentals".
  //
  // Every jsonb shape below was read off the real table, not guessed:
  //   vision        { aspiration, now, year3, year5 }
  //   pvm           { purpose, vision, mission }
  //   soul          { archetype, driver, against, emotion, temperament, voice }
  //   voice_tone    { intro, attributes, moments }
  //   brand_values  [{ name, reason }]
  //   competitors   [{ name, founded, summary }]
  //   section_content { "<section key>": "<html>" }
  if (brand && (brand.name || brand.claim || brand.description)) {
    const lines = brandFieldLines(brand);
    if (lines.length) {
      parts.push("\nThe brand of this workspace itself. Use it, prefer it over generic advice, and when asked about it answer from it rather than from the section names:\n" + lines.join("\n"));
    }
  } else {
    // No brand yet is itself worth knowing: it changes what is worth suggesting.
    parts.push("\nNo brand has been defined in this workspace yet. If it becomes relevant, mention that the Brand section can build one from a website, a brand book PDF, a Figma file or from scratch. Do not push it into every answer.");
  }

  // Brands that belong to individual projects. A creative agency runs its
  // customers' brands here, and "what is Somega's positioning" is a question
  // about Somega, not about the agency. The workspace brand above is not an
  // answer to it.
  if (Array.isArray(projectBrands) && projectBrands.length) {
    const blocks = [];
    for (const pb of projectBrands.slice(0, 6)) {
      if (!pb || !(pb.name || pb.claim || pb.description)) continue;
      const lines = brandFieldLines(pb);
      if (!lines.length) continue;
      blocks.push(`Project brand "${pb.projectName || pb.name}":\n${lines.join("\n")}`);
    }
    if (blocks.length) {
      parts.push(
        "\nBrands defined for individual projects in this workspace. Each is a brand of its own, usually a customer's. "
        + "When somebody asks about one by name, answer from ITS fields below and not from the workspace brand above:\n\n"
        + blocks.join("\n\n"));
    }
  }

  // Projects context — useful so the assistant can talk about them by name
  if (Array.isArray(projects) && projects.length > 0) {
    const names = projects.map(p => p.name).filter(Boolean).slice(0, 12);
    if (names.length) {
      parts.push(`\nActive projects in this workspace: ${names.join(", ")}.`);
    }
  }

  return parts.join("\n");
}

// Export individual pieces for testing / inspection
export { identity, APP_KNOWLEDGE, CAPABILITIES, VIEW_CONTEXTS, LANGUAGE_RULE, renderViewData };
