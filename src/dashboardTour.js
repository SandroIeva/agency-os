// The dashboard tour: what it says, and where its spoken lines are kept.
//
// Imported by the app AND by api/tts.js, so keep it dependency-free, the same
// way src/entitlements.js is. The text lives here rather than in App.jsx
// because the server is the one that reads it out: a tour endpoint that took
// its text from the browser would be a free Fish Audio account for anybody
// with a login, and Fish bills per character.
//
// The lines are spoken ONCE, ever, per language and per wording. The file name
// carries a hash of the sentence, so editing a line here produces a new file on
// the next tour and the old recording is simply never asked for again. Nobody
// has to remember to regenerate anything.

// A public bucket, already holding product artwork. The workspace sweeps only
// touch paths that start with an org id, so `tour/` is out of their reach.
export const TOUR_BUCKET = "os-visuals";
// Selene, the app's default voice, at the app's default pace
// (VOICE_OPTIONS[0] and DEFAULT_VOICE_SPEED in App.jsx). The tour greets
// somebody before they have chosen a voice, so it speaks in the one they get.
export const TOUR_VOICE = "b347db033a6549378b48d00acb0d06cd";
export const TOUR_SPEED = 1.1;

// The name the tour's voice goes by: TOUR_VOICE is Selene in VOICE_OPTIONS
// (App.jsx). The sphere introduces itself by it, never as "your AI", and
// changing the voice above means changing this name too.
export const TOUR_VOICE_NAME = "Selene";

// In the order somebody would look around the screen, ending on the sphere:
// the one talking introduces itself last, once everything else has a place.
// `target` names the data-tour attribute on the element to light up; `null`
// means no element, the card sits in the middle. Written in the sphere's own
// voice, because it is the sphere that says them.
export const TOUR_STEPS = [
  { key: "logo", target: "logo",
    de: "Hey, ich zeige dir kurz, wo was ist. Unten links kommst du mit einem Klick auf das Logo zu den Einstellungen für Profil, Workspace und Team.",
    en: "Hey, let me quickly show you around. On the bottom left, click the logo to get to the settings for your profile, workspace and team." },
  { key: "bell", target: "bell",
    de: "Oben rechts die Glocke. Hier landet alles, was dich betrifft: Aufgaben, Erwähnungen und Kommentare.",
    en: "Top right, the bell. Everything that concerns you lands here: tasks, mentions and comments." },
  { key: "messenger", target: "messenger",
    de: "Der Messenger. Hier schreibst du mit deinem Team. Und unter Agents warten deine KI-Experten.",
    en: "The messenger. This is where you talk to your team. And under Agents, your AI experts are waiting." },
  { key: "home", target: "home",
    de: "Der Home-Button bringt dich von überall zurück zu diesem Dashboard.",
    en: "The home button brings you back to this dashboard from anywhere." },
  { key: "menu", target: "menu",
    de: "Das Menü. Von hier erreichst du alles: Brand, Erstellen, Projekte, Files und Plan.",
    en: "The menu. Everything is reachable from here: brand, create, projects, files and plan." },
  { key: "tasks", target: "tasks",
    de: "In der Mitte steht, was als Nächstes ansteht. Am Anfang sind das deine ersten Schritte, danach deine Aufgaben und Termine.",
    en: "In the middle is what's up next. At first that's your first steps, later your tasks and appointments." },
  { key: "sphere", target: "sphere",
    de: `Und zum Schluss ich. Ich bin ${TOUR_VOICE_NAME}. Klick mich an und sprich einfach los. Ich kenne deine Marke und helfe dir überall in der App. Viel Spaß!`,
    en: `And last of all, me. I'm ${TOUR_VOICE_NAME}. Click me and just start talking. I know your brand and can help you anywhere in the app. Have fun!` },
];

// FNV-1a over the UTF-16 code units. Not for security, only so that the same
// sentence maps to the same file name in the browser and on the server.
function textHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function tourClipPath(lang, step) {
  const l = lang === "de" ? "de" : "en";
  // The voice and pace are part of the name too: changing either is a new
  // recording, exactly as changing the words is.
  return `tour/${l}/${step.key}-${textHash(`${TOUR_VOICE}|${TOUR_SPEED}|${step[l]}`)}.mp3`;
}
