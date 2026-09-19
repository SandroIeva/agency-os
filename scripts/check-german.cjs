// German text a user can see while the app is set to English.
//
// Rule 5 says every visible string follows appLanguage, and it has been
// broken often enough that asking by eye no longer works: the owner found
// Timeline, Kanban and the task dialog still German after several rounds of
// "all translated". This walks the real syntax tree and lists every string
// that LOOKS German and is not under a language test.
//
// "Under a language test" means an ancestor decides by language: a
// conditional or `&&` whose test names `de`, `isDe`, `appLanguage`, `lang`
// or `language`; a property called `de` / `labelDe` / `titleDe` (the
// `{ de, en }` table shape); or an argument to t(). Strings the user never
// sees are skipped: imports, object keys, className/style, console calls,
// supabase filters, keys of the translations table.
//
// Heuristic by design, so it is a LIST to read, not a gate: it prints and
// exits 0. Run: node scripts/check-german.cjs src/App.jsx [--by-fn]
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const file = process.argv[2] || "src/App.jsx";
const byFn = process.argv.includes("--by-fn");
const src = fs.readFileSync(file, "utf8");
const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"], errorRecovery: true });

const WORDS = new Set(("und oder nicht noch kein keine keinen neuer neue neues neuen hinzufügen bearbeiten " +
  "speichern abbrechen löschen schließen erstellen anlegen suchen zurück weiter fertig alle alles heute " +
  "woche monat jahr hoch mittel niedrig frist beschreibung checkliste punkt mitglieder mitglied projekte " +
  "projekt aufgabe aufgaben termin termine datei dateien ordner wird wurde werden ist sind hier jetzt bitte " +
  "dein deine deinen ihr ihre uns wir kann konnte konnten leer titel datum zeit fällig erledigt offen " +
  "gestern morgen minuten stunden tage tagen woche wochen ansehen öffnen hochladen herunterladen teilen " +
  "kopieren einfügen entfernen ausgewählt auswählen mehr weniger zeigen anzeigen verbergen ausblenden " +
  "einblenden benutzer nutzer einstellungen fehler erfolgreich gespeichert gelöscht lädt laden wird " +
  "vorschau hinzu für mit von zum zur beim über unter ohne eine einen einem einer dem den des das der " +
  "sich auch nur schon wenn dann damit etwas nichts niemand jemand status priorität kommentar kommentare " +
  "antworten senden gesendet nachricht nachrichten verlauf bereich bereiche übersicht zugewiesen " +
  "verantwortlich zuständig beginn ende start dauer fortschritt ziel ziele notiz notizen erinnerung " +
  "kalender ereignis veranstaltung ganztägig wiederholen täglich wöchentlich monatlich " +
  "verbindung unterbrochen fast geschafft fehlgeschlagen aktiviert aktivieren aktiviere erhalte " +
  "tippe klicke klick scrolle wähle öffne geht gehts sende senden gesendet bestätigen bestätigt " +
  "ja nein vielleicht immer nie gerade gleich sofort später bald neu alt groß klein erste letzte " +
  "nächste vorherige heute seite seiten liste karte karten spalte spalten zeile zeilen feld felder " +
  "wert werte eintrag einträge gruppe gruppen team teams person personen kunde kunden marke marken " +
  "bild bilder foto fotos video videos dokument dokumente vorlage vorlagen entwurf entwürfe " +
  "hochgeladen heruntergeladen verschieben umbenennen duplizieren favoriten zuletzt geändert " +
  "erstellt aktualisiert aktualisieren verbinden verbunden trennen getrennt anmelden abmelden " +
  "einloggen ausloggen registrieren passwort konto profil sprache darstellung dunkel hell " +
  "benachrichtigung benachrichtigungen einladung einladungen einladen mitglied beitreten " +
  "willkommen hallo tschüss danke gerne leider fehlt fehlen gefunden verfügbar möglich " +
  "unbekannt unbekannter ungültig ungültige gültig speicher voll upgraden kostenlos " +
  "ansicht ansichten raster ordnen sortieren filtern filter nach alphabetisch datum größe typ " +
  "keine kein nichts alles jeder jede jedes ganzer ganze ganzes eigene eigenen " +
  "zeig zeige zeigt gib gibt mach macht wird werden würde könnte sollte muss müssen darf").split(/\s+/));
// German word endings, worth a point each: -ung, -keit, -heit, -lich, -ieren.
const GERMAN_ENDING = /(ungen|ung|keit|heit|lich|ieren|iert|schaft|chen)$/;
const EN_TOO = new Set(["die", "an", "am", "in", "so", "was", "will", "man", "hat", "rot", "status", "start", "ende", "mehr"]);

function germanScore(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 2) return 0;
  if (!/[A-Za-zÄÖÜäöüß]/.test(t)) return 0;
  if (/^[a-z0-9_.:\/-]+$/.test(t)) return 0;            // ids, keys, paths
  if (/^https?:|^data:|^#[0-9a-f]{3,8}$|^rgba?\(/i.test(t)) return 0;
  let score = 0;
  if (/[äöüÄÖÜß]/.test(t)) score += 2;
  for (const w of t.toLowerCase().match(/[a-zäöüß]+/g) || []) {
    if (WORDS.has(w) && !EN_TOO.has(w)) score += 1;
    else if (w.length > 5 && GERMAN_ENDING.test(w)) score += 1;
  }
  return score;
}

const LANG_IDS = /^(de|de2|deRoot|dl|isDe|isDE|appLanguage|lang|language|uiLang|langDe|german|isGerman|agentLang)$/;
function mentionsLang(node) {
  let hit = false;
  (function walk(n) {
    if (!n || hit || typeof n !== "object") return;
    if (n.type === "Identifier" && LANG_IDS.test(n.name)) { hit = true; return; }
    if (n.type === "MemberExpression" && !n.computed && n.property && LANG_IDS.test(n.property.name)) { hit = true; return; }
    if ((n.type === "StringLiteral") && (n.value === "de" || n.value === "en")) { hit = true; return; }
    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === "string") walk(v);
    }
  })(node);
  return hit;
}

const SKIP_ATTRS = /^(className|style|key|id|type|name|href|src|rel|target|role|htmlFor|viewBox|d|fill|stroke|mode|variant|as|lang|accept|autoComplete|inputMode|data-.*)$/;
const PROP_DE = /^(de|labelDe|titleDe|textDe|nameDe|descDe|hintDe|placeholderDe|bodyDe)$/;
const SKIP_CALLEES = /^(console\.\w+|require|supabase\.\w+|.*\.(from|eq|neq|in|is|select|order|like|ilike|match|not|or|filter|channel|on|rpc|storage|getItem|setItem|removeItem|querySelector|querySelectorAll|getElementById|addEventListener|removeEventListener|includes|startsWith|endsWith|indexOf|split|replace|replaceAll|test|match|join|padStart|toLocaleDateString|toLocaleTimeString|toLocaleString|localeCompare|createElement|setAttribute|getAttribute|postMessage|dispatchEvent|append|set|get|has|delete)|t|tr|getTranslation|RegExp|fetch|Intl\.\w+|new Intl\.\w+)$/;

function calleeName(c) {
  if (!c) return "";
  if (c.type === "Identifier") return c.name;
  if (c.type === "MemberExpression") return calleeName(c.object) + "." + (c.property.name || c.property.value || "");
  if (c.type === "ThisExpression") return "this";
  if (c.type === "CallExpression") return calleeName(c.callee) + "()";
  return "";
}

function guarded(path) {
  let p = path;
  let child = path.node;
  while (p.parentPath) {
    const parent = p.parentPath.node;
    const key = p.key;
    if (parent.type === "ImportDeclaration" || parent.type === "ExportNamedDeclaration" && key === "source") return true;
    if (parent.type === "ConditionalExpression" && key !== "test" && mentionsLang(parent.test)) return true;
    if (parent.type === "LogicalExpression" && key === "right" && mentionsLang(parent.left)) return true;
    if (parent.type === "IfStatement" && key !== "test" && mentionsLang(parent.test)) return true;
    if (parent.type === "SwitchCase" && parent.test && mentionsLang(parent.test)) return true;
    if (parent.type === "ObjectProperty") {
      const k = parent.key && (parent.key.name || parent.key.value);
      if (key === "key") return true;
      if (k && PROP_DE.test(k)) return true;
    }
    if (parent.type === "JSXAttribute") {
      const n = parent.name && parent.name.name;
      if (typeof n === "string" && SKIP_ATTRS.test(n)) return true;
    }
    if (parent.type === "CallExpression" || parent.type === "NewExpression") {
      const cn = calleeName(parent.callee);
      if (key === "arguments" || p.listKey === "arguments") {
        if (SKIP_CALLEES.test(cn) || /^(console|supabase)\b/.test(cn)) return true;
      }
    }
    if (parent.type === "BinaryExpression" && /^(===|!==|==|!=)$/.test(parent.operator)) return true;
    // Notification rows store German prose only as a fallback; notifLines
    // renders them in the READER's language from type and metadata.
    if ((parent.type === "CallExpression" || parent.type === "OptionalCallExpression") && /(^|\.)createNotification$/.test(calleeName(parent.callee))) return true;
    // A table with an English twin (`DEFAULT_TAGLINES` / `DEFAULT_TAGLINES_EN`)
    // is picked by language where it is used.
    if (parent.type === "VariableDeclarator" && parent.id && parent.id.name && TOP_NAMES.has(parent.id.name + "_EN")) return true;
    if (parent.type === "SwitchCase" && key === "test") return true;
    if (parent.type === "TSLiteralType") return true;
    child = parent;
    p = p.parentPath;
  }
  return false;
}

function enclosingFn(path) {
  let p = path, name = "(module)";
  while (p) {
    const n = p.node;
    if (n.type === "FunctionDeclaration" && n.id && p.parentPath && (p.parentPath.node.type === "Program" || p.parentPath.node.type === "ExportNamedDeclaration" || p.parentPath.node.type === "ExportDefaultDeclaration")) return n.id.name;
    if (n.type === "VariableDeclarator" && n.id && n.id.name && p.parentPath && p.parentPath.parentPath && p.parentPath.parentPath.node.type === "Program") name = n.id.name;
    p = p.parentPath;
  }
  return name;
}

const TOP_NAMES = new Set();
for (const st of ast.program.body) {
  const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
  if (d && d.type === "VariableDeclaration") d.declarations.forEach(x => x.id && x.id.name && TOP_NAMES.add(x.id.name));
}
const hits = [];
function consider(path, text) {
  const s = germanScore(text);
  // Short labels carry one word: "Alle", "Heute", "Frist", "Hoch". One
  // German word is enough there; in a sentence it takes two, or an umlaut.
  const words = (text.trim().match(/[A-Za-zÄÖÜäöüß]+/g) || []).length;
  if (s < 2 && !(s >= 1 && words <= 3)) return;
  if (guarded(path)) return;
  hits.push({ line: path.node.loc.start.line, fn: enclosingFn(path), text: text.replace(/\s+/g, " ").trim().slice(0, 90) });
}
traverse(ast, {
  StringLiteral(path) { consider(path, path.node.value); },
  JSXText(path) { consider(path, path.node.value); },
  TemplateElement(path) { consider(path, path.node.value.cooked || ""); },
});

if (byFn) {
  const m = new Map();
  for (const h of hits) m.set(h.fn, (m.get(h.fn) || 0) + 1);
  [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(String(n).padStart(4), f));
} else {
  for (const h of hits) console.log(`${h.line}\t${h.fn}\t${h.text}`);
}
console.log(`\n${hits.length} German-looking strings outside a language test`);
