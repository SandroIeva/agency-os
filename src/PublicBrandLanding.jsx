import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

// ── Public Brand landing page ───────────────────────────────────────────────
// Reached via ?b=<token> (a published share) or ?b=preview (the signed-in user's
// own brand, for previewing the design). Layout: top bar (org logo + actions),
// a dark sidebar navigating the brand sections, and a scrollable content panel
// on the right. Read-only, shareable without an account.

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ── Colour helpers (hex ↔ hsl) + shade ramp — mirrors the app's Brand Colors ──
function hexToHsl(hex) {
  let h = String(hex).replace("#", ""); if (h.length === 3) h = h.split("").map(x => x + x).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let hue = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; hue /= 6; }
  return { h: hue * 360, s: s * 100, l: l * 100 };
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = n => { const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return Math.round(255 * c).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function colorShades(hex, n = 8) {
  const { h, s, l: baseL } = hexToHsl(hex);
  const ramp = Array.from({ length: n }, (_, i) => {
    const l = 12 + (84 * i) / (n - 1);
    const sat = s * (1 - Math.abs(l - 50) / 50 * 0.25);
    return { hex: hslToHex(h, sat, l), l, isBase: false };
  });
  let bi = 0, bd = Infinity;
  ramp.forEach((r, i) => { const d = Math.abs(r.l - baseL); if (d < bd) { bd = d; bi = i; } });
  ramp[bi] = { hex: String(hex).startsWith("#") ? hex : "#" + hex, l: baseL, isBase: true };
  return ramp.map(r => ({ hex: r.hex, isBase: r.isBase }));
}

// Placeholders mirroring the app's Brand Strategy defaults (shown when nothing is saved).
const DEFAULT_PVM_PUB = {
  purpose: "Definiere hier den fundamentalen Daseinsgrund deiner Marke jenseits von Profit. Beschreibe die Wirkung, die du erzielen willst — und für wen.",
  vision: "Beschreibe die Zukunft, die du erschaffen willst. Das ist dein höchstes Ziel, die langfristige Wirkung oder die ideale Welt, die du dir vorstellst.",
  mission: "Formuliere prägnant, was deine Marke tut, für wen und wie sie Wert schafft — dein praktischer Leitfaden für tägliche Entscheidungen, verknüpft mit deiner Vision.",
};
const DEFAULT_TIMELINE_PUB = [
  { year: "2018", quarter: "Q1", title: "Gründung", desc: "Die Idee zu APPICS entsteht — Social Media, das Creator fair belohnt." },
  { year: "2019", quarter: "Q2", title: "Token-Launch", desc: "Der APX-Token und die erste App-Version gehen live." },
  { year: "2022", quarter: "Q3", title: "Relaunch", desc: "Neue App-Generation mit überarbeitetem Reward-System." },
];

// Mirrors the brand editor's default Voice & Tone, shown when none is saved.
const DEFAULT_VOICE_TONE = {
  intro: {
    body: "Unsere Stimme bleibt immer gleich — der Ton ist, wie wir sie situativ ausdrücken. Über Wortwahl, Schreibstil, Typografie, Satzbau und Phrasierung passen wir die Stimme an den Kontext an. Der richtige Ton schafft emotionale Verbindung und Vertrauen durch Anpassungsfähigkeit.",
    questions: ["Was soll dieser Text bewirken?", "Für welches Szenario schreiben wir?", "Mit wem sprichst du?"],
    closing: "Wir nutzen die Customer Journey, um Momente und Ton-Leitlinien zu mappen — als Erinnerung, dass jede Interaktion einen kundenzentrierten Zweck hat.",
  },
  moments: [
    { title: "First impressions", desc: "Hier wollen wir Interesse wecken und Neugier entfachen — durch mutige, clevere Sprache, die zum genaueren Hinsehen einlädt.", traits: [{ label: "To-the-point", value: 40 }, { label: "Approachable", value: 90 }, { label: "Upfront", value: 12 }], channels: ["In-app Product Flows", "Transactional Email", "Push Notifications"] },
    { title: "Consideration", desc: "Wir haben die Aufmerksamkeit — jetzt geht es um Verständnis und Vertrauen. Wir erklären Produkte, wie sie funktionieren und welche Ergebnisse sie bringen.", traits: [{ label: "To-the-point", value: 88 }, { label: "Approachable", value: 30 }, { label: "Upfront", value: 70 }], channels: ["Product Pages", "Campaign Lander", "App Store"] },
    { title: "Education", desc: "Wir geben Nutzer:innen die Infos, die sie für Entscheidungen brauchen. Jede Interaktion vermittelt Kontrolle, Sicherheit und Vertrauen — mit Social Proof, Metaphern und Daten.", traits: [{ label: "To-the-point", value: 80 }, { label: "Approachable", value: 95 }, { label: "Upfront", value: 45 }], channels: ["Announcement Emails", "Tooltips", "New-User States", "Half Sheets"] },
    { title: "Support", desc: "Wenn etwas hakt, sind wir ruhig, klar und lösungsorientiert. Wir nehmen Sorgen ernst und führen Schritt für Schritt zur Lösung.", traits: [{ label: "To-the-point", value: 72 }, { label: "Approachable", value: 82 }, { label: "Upfront", value: 88 }], channels: ["Help Center", "Support Chat", "Status Updates", "FAQ"] },
  ],
  attributes: [
    { name: "To-the-point", overview: "Wir sind klar in dem, was wir sagen, und bleiben dabei. Wir reißen Barrieren ein, indem wir Fachjargon übersetzen, und geben unseren Kunden Sicherheit auf ihrer Reise.", shouldBe: ["Klar", "Fokussiert", "Organisiert", "Kuratiert", "Selbstbewusst", "Befähigend"], shouldntBe: ["Spärlich", "Kalt", "Langweilig", "Leblos", "Stumpf", "Vage"], tactics: [{ title: "Never bury the lead", desc: "Wir beginnen immer mit der wichtigsten Information zuerst und respektieren die begrenzte Zeit und Aufmerksamkeit unseres Publikums." }, { title: "Clarity first (style second)", desc: "Wir fokussieren die Botschaft und strukturieren Inhalte so, dass Punkt, Zweck und Absicht unmissverständlich sind. Stil überlagert nie die Botschaft." }, { title: "Guide with confidence", desc: "Wir erklären, wie Dinge funktionieren und was zu erwarten ist — klar und prägnant, damit Kunden befähigt sind, den nächsten Schritt zu gehen." }, { title: "Build familiarity", desc: "Durch Konsistenz und Wiederholung schaffen wir Vertrautheit, die die Beziehung zu unseren Kunden vertieft." }] },
    { name: "Approachable", overview: "Unser einladender, fantasievoller Stil macht uns nahbar und mühelos verständlich. Wir verstecken uns nicht hinter Jargon, Ego oder billigen Emotionen.", shouldBe: ["Selbstbewusst", "Gesprächig", "Reaktionsschnell", "Verlässlich", "Unterstützend", "Optimistisch"], shouldntBe: ["Übergriffig", "Geschwätzig", "Kindisch", "Distanziert", "Reißerisch", "Exklusiv"], tactics: [{ title: "Read the room", desc: "Wir berücksichtigen den Kontext, bevor wir schreiben — was Kunden wollen, brauchen und fühlen." }, { title: "Act as a translator", desc: "Wir machen Komplexes einfach und entmystifizieren Fachsprache, ohne überkonstruiert zu klingen." }, { title: "Be inventive", desc: "Wir fordern Konventionen heraus, wenn es unseren Kunden besser dient." }, { title: "Write inclusively", desc: "Unsere Inhalte sind für alle zugänglich — keine ausschließende oder herabsetzende Sprache." }] },
    { name: "Upfront", overview: "Wir sagen, wie es ist, und stellen uns zugleich vor, wie es sein könnte. Wir vermeiden Schönfärberei und setzen klare Erwartungen — Vertrauen entsteht durch Ehrlichkeit und Transparenz.", shouldBe: ["Offen", "Aufrichtig", "Verantwortungsvoll", "Echt", "Empathisch"], shouldntBe: ["Technokratisch", "Angstmachend", "Akademisch"], tactics: [{ title: "Tell the whole truth", desc: "Wir sind ehrlich über Produkte, Prozesse und Richtlinien — der einzige Weg, echtes Vertrauen aufzubauen." }, { title: "Balance humility & confidence", desc: "Wir lassen Begeisterung und Stärken strahlen und erkennen zugleich Grenzen offen an." }, { title: "Use friction", desc: "Wenn viel auf dem Spiel steht, verlangsamen wir und sorgen dafür, dass Kunden die Kontrolle behalten." }] },
  ],
};

function pickBrand(row) {
  if (!row) return null;
  const pal = (row.color_palette && typeof row.color_palette === "object" && !Array.isArray(row.color_palette)) ? row.color_palette : null;
  const colors = pal
    ? [
        ...(pal.primary ? [{ hex: pal.primary, label: "Primary" }] : []),
        ...(pal.secondary ? [{ hex: pal.secondary, label: "Secondary" }] : []),
        ...((pal.accents || []).map((c, i) => ({ hex: c, label: `Accent ${i + 1}` }))),
      ]
    : (Array.isArray(row.colors) ? row.colors.filter(Boolean).map(c => ({ hex: c, label: "" })) : []);
  const logos = Array.isArray(row.logos) && row.logos.length ? row.logos : (row.logo_url ? [{ key: "primary", url: row.logo_url, label: "Primary" }] : []);
  return {
    name: row.name || "",
    claim: row.claim || "",
    description: row.description || "",
    accent: (pal && pal.primary) || (Array.isArray(row.colors) && row.colors[0]) || "#1b1b1b",
    logos,
    colors,
    typography: row.typography?.primary || (row.typography && !row.typography.primary ? row.typography : null),
    typographySecondary: row.typography?.secondary || null,
    pvm: (row.pvm && (row.pvm.purpose || row.pvm.vision || row.pvm.mission)) ? row.pvm : null,
    storyTimeline: (Array.isArray(row.story_timeline) && row.story_timeline.length) ? row.story_timeline : null,
    keyMessages: Array.isArray(row.analysis?.key_messages) ? row.analysis.key_messages.filter(Boolean) : [],
    imagery: Array.isArray(row.imagery) ? row.imagery.filter(i => i?.url) : [],
    personas: Array.isArray(row.personas) ? row.personas : [],
    values: Array.isArray(row.brand_values) ? row.brand_values : [],
    taglines: (Array.isArray(row.taglines) ? row.taglines : [])
      .map(t => typeof t === "string" ? { tagline: t, desc: "" } : { tagline: t?.tagline || t?.text || "", desc: t?.desc || "" })
      .filter(t => t.tagline),
    // Voice & Tone: use the saved object if it has content, else the same default
    // the brand editor shows (so the landing mirrors the app).
    tone: (row.voice_tone && typeof row.voice_tone === "object" && !Array.isArray(row.voice_tone)
      && (row.voice_tone.intro || (row.voice_tone.moments || []).length || (row.voice_tone.attributes || []).length))
      ? row.voice_tone : DEFAULT_VOICE_TONE,
  };
}

async function download(url, filename) {
  try {
    const r = await fetch(url); const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = filename || "download"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch { window.open(url, "_blank", "noopener"); }
}

export default function PublicBrandLanding({ token }) {
  const [brand, setBrand] = useState(undefined); // undefined = loading, null = not found
  const [sections, setSections] = useState(null);
  const [active, setActive] = useState(null);
  const [copied, setCopied] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [hoverNav, setHoverNav] = useState(null); // icon-rail tooltip
  const [colorNames, setColorNames] = useState({}); // hex -> human colour name (api.color.pizza)
  const [copiedPrompt, setCopiedPrompt] = useState(null); // imagery: index whose prompt was copied
  const [openShade, setOpenShade] = useState(null); // { hex, name } while viewing a colour's shade ramp
  const [personaIdx, setPersonaIdx] = useState(null); // persona detail view
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const fn = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const [voiceSub, setVoiceSub] = useState("intro"); // inner nav within Voice & Tone
  const [voiceNavOpen, setVoiceNavOpen] = useState(false); // mobile: voice inner nav as dropdown
  const voiceRefs = React.useRef({});
  const de = typeof navigator !== "undefined" ? (navigator.language || "de").toLowerCase().startsWith("de") : true;
  const darkMode = false; // the public brand page is always light

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (token === "preview") {
          const { data } = await supabase.from("brand_profile").select("*").is("project_id", null).limit(1).maybeSingle();
          if (alive) { setBrand(pickBrand(data)); setSections(null); }
        } else {
          const { data } = await supabase.from("brand_shares").select("data, sections").eq("token", token).maybeSingle();
          if (alive) { setBrand(data?.data ? pickBrand(data.data) : null); setSections(data?.sections || null); }
        }
      } catch { if (alive) setBrand(null); }
    })();
    return () => { alive = false; };
  }, [token]);

  const fontFamily = brand?.typography?.family || brand?.typography?.name || null;
  useEffect(() => {
    const links = [];
    const add = (href) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); links.push(l); };
    add("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");
    if (brand?.typography?.kind === "google" && brand?.typography?.url) add(brand.typography.url);
    document.title = brand?.name ? `${brand.name} — Brand` : "Brand";
    return () => links.forEach(l => l.remove());
  }, [brand]);

  // Human-readable colour names (same service the hair-colour picker uses).
  useEffect(() => {
    const hexes = (brand?.colors || []).map(c => (c.hex || "").replace("#", "")).filter(Boolean);
    if (!hexes.length) return;
    fetch(`https://api.color.pizza/v1/?values=${hexes.join(",")}&list=bestOf`)
      .then(r => r.json())
      .then(j => {
        const map = {};
        (j?.colors || []).forEach((c, i) => { if (hexes[i]) map[("#" + hexes[i]).toLowerCase()] = c.name; });
        setColorNames(map);
      })
      .catch(() => {});
  }, [brand]);

  const hasSectionConfig = sections && Object.keys(sections).length > 0;
  const show = (key) => hasSectionConfig ? !!sections[key] : true;

  if (brand === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#888", background: "#f1f2f4" }}>Lädt…</div>;
  }
  if (!brand) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: FONT, background: "#f1f2f4", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>Brand nicht gefunden</div>
        <div style={{ fontSize: 14, color: "#777" }}>Dieser Link ist ungültig oder wurde zurückgezogen.</div>
      </div>
    );
  }

  const accent = brand.accent;
  // Decorative UI accents (timeline dots, arrows, bars, chips) use the app's lila
  // accent — matching the in-app brand pages — instead of the brand's primary colour.
  const uiAccent = "#8B7AFF";
  const primaryLogo = brand.logos.find(l => l.key === "primary") || brand.logos[0];

  // Available sections (only those with data + allowed by the share config).
  const NAV = [
    { key: "strategy", label: "Brand Strategy", has: show("strategy") && !!(brand.claim || brand.description || brand.values.length) },
    { key: "taglines", label: "Taglines", has: show("taglines") && brand.taglines.length > 0 },
    { key: "voice", label: "Voice & Tone", has: show("voice") && !!brand.tone },
    { key: "logo", label: "Logo", has: show("logo") && brand.logos.length > 0 },
    { key: "colors", label: "Brand Colors", has: show("colors") && brand.colors.length > 0 },
    { key: "typography", label: "Typografie", has: show("typography") && !!brand.typography },
    { key: "imagery", label: "Bildsprache", has: show("imagery") && brand.imagery.length > 0 },
    { key: "personas", label: "Personas", has: show("personas") && brand.personas.length > 0 },
  ].filter(s => s.has);

  const current = active || NAV[0]?.key || "downloads";

  const copyHex = (hex) => { try { navigator.clipboard.writeText(hex); } catch {} setCopied(hex); setTimeout(() => setCopied(c => c === hex ? null : c), 1300); };
  const copyLink = () => { try { navigator.clipboard.writeText(window.location.href); } catch {} setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1600); };
  const copyPrompt = (txt, i) => { try { navigator.clipboard.writeText(txt); } catch {} setCopiedPrompt(i); setTimeout(() => setCopiedPrompt(p => (p === i ? null : p)), 1300); };
  const go = (key) => { setActive(key); setOpenShade(null); setPersonaIdx(null); setMobileNavOpen(false); };
  const hexRgb = (hex) => { const h = (hex || "").replace("#", ""); const f = h.length === 3 ? h.split("").map(ch => ch + ch).join("") : h; const n = parseInt(f, 16); return isNaN(n) ? { r: 0, g: 0, b: 0 } : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; };

  const labelEyebrow = (txt) => <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 600, color: "#9a9aa5", marginBottom: 16 }}>{txt}</div>;
  const dlBtn = (url, name, label) => (
    <button onClick={() => download(url, name)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 18px", borderRadius: 999, border: "1px solid #e6e6ea", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT, color: "#333" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      {label || "Download"}
    </button>
  );

  // ── Section content ──
  const renderSection = () => {
    if (current === "strategy") {
      const pvmVal = (k) => (brand.pvm?.[k] || DEFAULT_PVM_PUB[k]);
      const timeline = brand.storyTimeline || DEFAULT_TIMELINE_PUB;
      const sortKey = (e) => `${e.year || "0000"}-${e.quarter || "Q0"}`;
      const sorted = [...timeline].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
      const rail = "rgba(0,0,0,0.12)";
      return (
        <div style={{ maxWidth: 880 }}>
          {brand.claim && <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1, fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>{brand.claim}</div>}
          {brand.description && <p style={{ fontSize: 17, lineHeight: 1.7, color: "#4a4a56", marginTop: 18, maxWidth: 720 }}>{brand.description}</p>}

          {/* Purpose / Vision / Mission — 3-column block like the app's Brand Core */}
          <div style={{ marginTop: 44, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "28px 36px" }}>
            {[["purpose", "Purpose"], ["vision", "Vision"], ["mission", "Mission"]].map(([k, title]) => (
              <div key={k}>
                <div style={{ height: 1, background: "rgba(0,0,0,0.16)", marginBottom: 14 }} />
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{title}</div>
                <div style={{ fontSize: 14, color: "#6a6a74", lineHeight: 1.6 }}>{pvmVal(k)}</div>
              </div>
            ))}
          </div>

          {/* Kern-Botschaften */}
          {brand.keyMessages.length > 0 && (
            <div style={{ marginTop: 44 }}>
              {labelEyebrow("Kern-Botschaften")}
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {brand.keyMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 11, alignItems: "center", fontSize: 14, lineHeight: 1.5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, background: uiAccent + "1f", color: uiAccent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </span>
                    {m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Werte */}
          {brand.values.length > 0 && (
            <div style={{ marginTop: 44 }}>
              {labelEyebrow("Werte")}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
                {brand.values.map((v, i) => (
                  <div key={i} style={{ borderRadius: 16, border: "1px solid #ececf0", padding: "20px 22px" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{typeof v === "string" ? v : v.name}</div>
                    {v && v.reason && <div style={{ fontSize: 14, color: "#6a6a74", lineHeight: 1.55 }}>{v.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brand History — vertical timeline rail like the app's Brand Story */}
          <div style={{ marginTop: 48, paddingTop: 26, borderTop: `1px solid ${rail}` }}>
            {labelEyebrow("Brand History")}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sorted.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 16 }}>
                  <div style={{ position: "relative", width: 14, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                    <div style={{ position: "absolute", top: 0, bottom: i === sorted.length - 1 ? "auto" : 0, height: i === sorted.length - 1 ? 14 : "auto", width: 2, background: rail }} />
                    <div style={{ position: "relative", marginTop: 4, width: 12, height: 12, borderRadius: "50%", background: uiAccent, boxShadow: "0 0 0 3px #fff" }} />
                  </div>
                  <div style={{ flex: 1, paddingBottom: 26, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: uiAccent, fontWeight: 600, letterSpacing: 0.2 }}>{e.year}{e.quarter ? ` · ${e.quarter}` : ""}</div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, marginTop: 3 }}>{e.title}</div>
                    {e.desc && <div style={{ fontSize: 13.5, color: "#6a6a74", lineHeight: 1.6, marginTop: 4 }}>{e.desc}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (current === "taglines") {
      const fallbackDesc = de
        ? "Beschreibe kurz, worum es bei dieser Tagline geht und welche Botschaft sie transportiert."
        : "Briefly describe what this tagline is about and the message it carries.";
      if (isMobile) {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {brand.taglines.map((t, i) => (
              <div key={i}>
                <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ height: 1, background: "#d9d9df", margin: "18px 0 20px" }} />
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.25, marginBottom: 12, fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>{t.tagline}</div>
                <div style={{ fontSize: 14.5, color: "#8a8a94", lineHeight: 1.65 }}>{t.desc || fallbackDesc}</div>
              </div>
            ))}
          </div>
        );
      }
      // Rows of three: big 01/02/03 numbers, one continuous rule, tagline + description below.
      const chunks = [];
      for (let i = 0; i < brand.taglines.length; i += 3) chunks.push(brand.taglines.slice(i, i + 3));
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 60 }}>
          {chunks.map((chunk, ci) => (
            <div key={ci}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 48 }}>
                {chunk.map((t, i) => (
                  <div key={i} style={{ fontSize: 54, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(ci * 3 + i + 1).padStart(2, "0")}</div>
                ))}
              </div>
              <div style={{ height: 1, background: "#d9d9df", margin: "24px 0 32px" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 48 }}>
                {chunk.map((t, i) => (
                  <div key={i} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.25, marginBottom: 14, fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>{t.tagline}</div>
                    <div style={{ fontSize: 14.5, color: "#8a8a94", lineHeight: 1.65 }}>{t.desc || fallbackDesc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (current === "voice") {
      // Mirrors the in-app Voice & Tone display: intro, journey-moment cards with
      // tone bars, then one section per attribute with a big title + two columns.
      const tone = brand.tone;
      const moments = Array.isArray(tone.moments) ? tone.moments : [];
      const attrs = Array.isArray(tone.attributes) ? tone.attributes : [];
      const intro = tone.intro || {};
      const vLabel = { fontSize: 13, color: "#8a8a94", marginBottom: 10 };
      const vListItem = { fontSize: 19, color: "#15151c", lineHeight: 1.55 };
      const vDivider = "rgba(0,0,0,0.10)";
      const navItems = [
        { id: "intro", label: de ? "Übersicht" : "Overview" },
        ...(moments.length ? [{ id: "moments", label: de ? "Momente" : "Moments" }] : []),
        ...attrs.map((a, i) => ({ id: `a${i}`, label: a.name || a.label })),
      ];
      const scrollTo = (id) => { setVoiceSub(id); setVoiceNavOpen(false); const el = voiceRefs.current[id]; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };

      const content = (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: isMobile ? 48 : 72 }}>
          {/* Intro — "Unser Ton" */}
          <div ref={el => (voiceRefs.current.intro = el)} style={{ maxWidth: 640 }}>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5, marginBottom: 18 }}>{de ? "Unser Ton" : "Our tone"}</div>
            {intro.body && <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5a5a66", margin: "0 0 18px" }}>{intro.body}</p>}
            {(intro.questions || []).length > 0 && (
              <>
                <p style={{ fontSize: 16, color: "#15151c", margin: "0 0 12px" }}>{de ? "Beim Hoch- oder Runterregeln der Stimme frag dich:" : "When dialing the voice up or down, ask yourself:"}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                  {(intro.questions || []).map((q, i) => <div key={i} style={{ fontSize: 16, color: "#15151c" }}>{i + 1}—{q}</div>)}
                </div>
              </>
            )}
            {intro.closing && <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5a5a66", margin: 0 }}>{intro.closing}</p>}
          </div>

          {/* Journey moments — cards with tone-level bars + touchpoints */}
          {moments.length > 0 && (
            <div ref={el => (voiceRefs.current.moments = el)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {moments.map((m, mi) => (
                <div key={mi} style={{ borderRadius: 18, background: "rgba(0,0,0,0.025)", padding: 22, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3, marginBottom: 10 }}>{m.title}</div>
                  <div style={{ fontSize: 13.5, color: "#5a5a66", lineHeight: 1.6, minHeight: isMobile ? 0 : 110 }}>{m.desc}</div>
                  <div style={{ height: 1, background: vDivider, margin: "8px 0 16px" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(m.traits || []).map((tr, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 96, flexShrink: 0, fontSize: 12.5, color: "#8a8a94" }}>{tr.label}</span>
                        <div style={{ flex: 1, height: 10, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, Number(tr.value) || 0))}%`, borderRadius: 999, background: uiAccent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {(m.channels || []).length > 0 && (
                    <>
                      <div style={{ height: 1, background: vDivider, margin: "16px 0 14px" }} />
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Touchpoints & Channels</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {(m.channels || []).map((c, j) => <div key={j} style={{ fontSize: 13, color: "#8a8a94", display: "flex", gap: 8 }}><span style={{ color: "#c2c2ca" }}>•</span>{c}</div>)}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* One section per attribute — big title, overview + should/shouldn't, tactics */}
          {attrs.map((a, ai) => (
            <div key={ai} ref={el => (voiceRefs.current[`a${ai}`] = el)}>
              <div style={{ fontSize: "clamp(30px, 4.6vw, 46px)", fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.05, marginBottom: 40 }}>{a.name || a.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48 }}>
                <div>
                  <div style={vLabel}>{de ? "Übersicht" : "Overview"}</div>
                  <p style={{ fontSize: 18, lineHeight: 1.5, color: "#15151c", margin: "0 0 32px" }}>{a.overview || a.description}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    <div>
                      <div style={vLabel}>{de ? "So sollten wir sein" : "We should be"}</div>
                      {(a.shouldBe || []).map((w, i) => <div key={i} style={vListItem}>{w}</div>)}
                    </div>
                    <div>
                      <div style={vLabel}>{de ? "So sollten wir nicht sein" : "We shouldn't be"}</div>
                      {(a.shouldntBe || []).map((w, i) => <div key={i} style={vListItem}>{w}</div>)}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={vLabel}>{de ? "Taktiken" : "Tactics"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "30px 28px", marginTop: 6 }}>
                    {(a.tactics || []).map((tc, i) => (
                      <div key={i} style={{ borderTop: `1px solid ${vDivider}`, paddingTop: 14 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{tc.title}</div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#8a8a94" }}>{tc.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );

      if (isMobile) {
        const currentLabel = (navItems.find(n => n.id === voiceSub) || navItems[0])?.label;
        return (
          <div>
            {/* Mobile: inner nav as a dropdown above the content */}
            <div style={{ position: "relative", marginBottom: 26, zIndex: 5 }}>
              <div onClick={() => setVoiceNavOpen(o => !o)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 999, border: "1px solid #e6e6ea", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {currentLabel}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: voiceNavOpen ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {voiceNavOpen && (
                <>
                  <div onClick={() => setVoiceNavOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 41, minWidth: 220, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #e9eaee", borderRadius: 14, boxShadow: "0 14px 36px rgba(0,0,0,0.14)", padding: 6 }}>
                    {navItems.map(n => (
                      <div key={n.id} onClick={() => scrollTo(n.id)}
                        style={{ padding: "10px 12px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: voiceSub === n.id ? 700 : 500, color: voiceSub === n.id ? "#15151c" : "#5a5a66", background: voiceSub === n.id ? "rgba(0,0,0,0.05)" : "transparent" }}>{n.label}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {content}
          </div>
        );
      }

      return (
        <div style={{ display: "flex", gap: 40 }}>
          {/* Inner navigation */}
          <div style={{ width: 150, flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, position: "sticky", top: 0 }}>
              {navItems.map(n => {
                const on = voiceSub === n.id;
                return <div key={n.id} onClick={() => scrollTo(n.id)} style={{ fontSize: 14, cursor: "pointer", color: on ? "#15151c" : "#9a9aa5", fontWeight: on ? 700 : 500, textDecoration: on ? "none" : "underline", textUnderlineOffset: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</div>;
              })}
            </div>
          </div>
          {content}
        </div>
      );
    }
    if (current === "logo") return (
      <div>
        <div style={{ display: "flex", gap: 56, flexWrap: "wrap", alignItems: "stretch", maxWidth: isMobile ? "100%" : "calc(100% - 150px)" }}>
          <div style={{ flex: "2 1 360px", minWidth: 280, borderRadius: 16, background: "#f5f5f7", display: "flex", alignItems: "center", justifyContent: "center", padding: 56, minHeight: isMobile ? 360 : 560 }}>
            <img src={primaryLogo.url} alt={brand.name} style={{ maxWidth: "80%", maxHeight: 390, objectFit: "contain" }} />
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 220, paddingRight: 40 }}>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{brand.name}</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#5a5a66" }}>{brand.description || brand.claim || "Das primäre Logo der Marke. Nutze es mit ausreichend Abstand und auf neutralem Hintergrund."}</p>
            <div style={{ marginTop: 32 }}>{dlBtn(primaryLogo.url, `${brand.name || "logo"}.png`, "Logo herunterladen")}</div>
          </div>
        </div>
        {brand.logos.length > 1 && (
          <div style={{ marginTop: 30 }}>
            {labelEyebrow("Varianten")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {brand.logos.map((l, i) => (
                <div key={i} style={{ borderRadius: 16, border: "1px solid #ececf0", overflow: "hidden" }}>
                  <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, background: i % 2 ? "#16161c" : "#f5f5f7" }}>
                    <img src={l.url} alt={l.label || "Logo"} style={{ maxWidth: "72%", maxHeight: "72%", objectFit: "contain" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderTop: "1px solid #ececf0" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#444" }}>{l.label || l.key || "Logo"}</span>
                    <button onClick={() => download(l.url, `${(l.label || l.key || "logo")}.png`)} title="Herunterladen" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #ececf0", background: "#fff", cursor: "pointer", color: "#666", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
    if (current === "colors") {
      const panelH = isMobile ? "clamp(280px, 44vh, 400px)" : "clamp(420px, 58vh, 560px)";
      const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
      return (
        <div style={{ display: "flex", gap: isMobile ? 28 : 56, alignItems: "flex-start", flexWrap: "wrap" }}>
          {!openShade ? (
            /* Colour panels — flush columns, vertical name top-right, RGB + hex bottom-left; click opens shades */
            <div style={{ flex: "1 1 480px", minWidth: 0, display: "flex", borderRadius: 14, overflow: "hidden" }}>
              {brand.colors.map((c, i) => {
                const { r, g, b } = hexRgb(c.hex);
                const dark = lum(r, g, b) < 150;
                const fg = dark ? "#fff" : "#15151c";
                const sub = dark ? "rgba(255,255,255,0.72)" : "#6a6a74";
                const name = colorNames[(c.hex || "").toLowerCase()] || c.label || c.hex;
                return (
                  <div key={i} onClick={() => setOpenShade({ hex: c.hex, name })} title={de ? "Abstufungen ansehen" : "View shades"}
                    style={{ flex: 1, minWidth: 0, position: "relative", background: c.hex, height: panelH, cursor: "pointer" }}>
                    <div style={{ position: "absolute", top: 26, right: 24, writingMode: "vertical-rl", fontSize: isMobile ? 17 : 24, fontWeight: 600, letterSpacing: 0.2, color: fg, whiteSpace: "nowrap", maxHeight: "60%", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                    <div style={{ position: "absolute", left: isMobile ? 14 : 24, bottom: 22, display: "flex", gap: isMobile ? 14 : 26, alignItems: "flex-end" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 12, rowGap: 2, fontSize: 12.5 }}>
                        <span style={{ color: sub }}>R</span><span style={{ color: fg }}>{r}</span>
                        <span style={{ color: sub }}>G</span><span style={{ color: fg }}>{g}</span>
                        <span style={{ color: sub }}>B</span><span style={{ color: fg }}>{b}</span>
                      </div>
                      {!isMobile && (
                        <div style={{ fontSize: 12.5 }}>
                          <div style={{ color: sub }}>Hex code</div>
                          <div style={{ color: fg, fontWeight: 500 }}>{(c.hex || "").toUpperCase()}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Shade ramp — like the app's Brand Colors: back + name, clickable shades, base marked */
            <div style={{ flex: "1 1 480px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <div onClick={() => setOpenShade(null)} title={de ? "Zurück" : "Back"} style={{ cursor: "pointer", color: "#6a6a74", display: "flex", alignItems: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, background: openShade.hex, border: "1px solid rgba(0,0,0,0.1)" }} />
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{openShade.name}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                {colorShades(openShade.hex, isMobile ? 5 : 8).map(({ hex: sh, isBase }, j) => {
                  const { r, g, b } = hexRgb(sh);
                  const txt = lum(r, g, b) > 158 ? "#1a1a2e" : "#ffffff";
                  return (
                    <div key={sh + j} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <div onClick={() => copyHex(sh)} title="Hex kopieren"
                        style={{ width: "100%", height: panelH, borderRadius: 14, background: sh, position: "relative", cursor: "pointer", animation: `pbFadeUp 0.32s cubic-bezier(0.22, 0.68, 0.35, 1) ${j * 0.045}s both` }}>
                        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 11, fontWeight: 600, color: txt, opacity: 0.9 }}>{copied === sh ? "Kopiert ✓" : sh.toUpperCase()}</div>
                      </div>
                      <div style={{ height: 8, display: "flex", alignItems: "center" }}>
                        {isBase && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#15151c" }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Sidenote */}
          <div style={isMobile ? { width: "100%" } : { width: 300, flexShrink: 0, paddingRight: 40 }}>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, marginBottom: 14 }}>{de ? "Unsere Markenfarben" : "Our brand colors"}</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#8a8a94", margin: 0 }}>
              {de
                ? "Diese Farbwelt definiert den visuellen Charakter der Marke. Je konsistenter die Farben eingesetzt werden, desto stärker werden Wiedererkennung und Vertrauen — von der ersten Anzeige bis zum Produkt."
                : "This palette defines the visual character of the brand. The more consistently the colors are used, the stronger recognition and trust become — from the first ad to the product."}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#8a8a94", marginTop: 16, marginBottom: 0 }}>
              {de
                ? "Ein Klick auf eine Farbe zeigt ihre Abstufungen — jede Abstufung lässt sich per Klick kopieren."
                : "Click a color to see its shades — each shade can be copied with a click."}
            </p>
          </div>
        </div>
      );
    }
    if (current === "typography") {
      const brandFF = fontFamily ? `'${fontFamily}', ${FONT}` : FONT;
      const weights = (Array.isArray(brand.typography.weights) && brand.typography.weights.length ? brand.typography.weights : [300, 400, 500, 600, 700]).map(Number).filter(Boolean).slice(0, 8);
      const wName = (w) => ({ 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" })[w] || `${w}`;
      const secondaryName = brand.typographySecondary?.family || brand.typographySecondary?.name || "None";
      return (
        <div style={{ display: "flex", gap: 64, alignItems: "stretch", flexWrap: "wrap" }}>
          {/* Left: big Aa + font name */}
          <div style={{ width: 250, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 480 }}>
            <div style={{ fontFamily: brandFF, fontSize: 128, fontWeight: 700, lineHeight: 1, letterSpacing: -3 }}>Aa</div>
            <div style={{ height: 1, background: "#d9d9df", margin: "28px 0 22px" }} />
            <div style={{ fontFamily: brandFF, fontSize: 36, fontWeight: 500, letterSpacing: -0.5, overflowWrap: "break-word" }}>{fontFamily || "Systemschrift"}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{de ? "Typografie für Texte." : "Typography for texts."}</div>
            {brand.typography.kind === "google" ? (
              <a href={`https://fonts.google.com/specimen/${encodeURIComponent((fontFamily || "").replace(/ /g, "+"))}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: "#8a8a94", textDecoration: "none", marginTop: 8 }}>Google Fonts →</a>
            ) : brand.typography.url ? (
              <button onClick={() => download(brand.typography.url, fontFamily || "font")} style={{ fontSize: 12.5, fontWeight: 600, color: "#8a8a94", background: "transparent", border: "none", cursor: "pointer", padding: 0, textAlign: "left", marginTop: 8, fontFamily: FONT }}>{de ? "Schrift herunterladen ↓" : "Download font ↓"}</button>
            ) : null}
            <div style={{ flex: 1 }} />
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>Secondary</span>
                <span style={{ color: "#8a8a94" }}>{secondaryName}</span>
              </div>
              <div style={{ height: 1, background: "#d9d9df" }} />
            </div>
          </div>

          {/* Middle: weights */}
          <div style={{ width: 230, flexShrink: 0 }}>
            {weights.map((w) => (
              <div key={w}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0" }}>
                  <div style={{ fontSize: 12.5, color: "#6a6a74", lineHeight: 1.4 }}>{wName(w)}<br />{w}</div>
                  <div style={{ fontFamily: brandFF, fontSize: 32, fontWeight: w, lineHeight: 1 }}>Aa</div>
                </div>
                <div style={{ height: 1, background: "#e3e3e8" }} />
              </div>
            ))}
          </div>

          {/* Right: specimen */}
          <div style={{ flex: "1 1 340px", minWidth: 300, paddingRight: 40 }}>
            <div style={{ fontFamily: brandFF, fontSize: 42, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.16, maxWidth: 580 }}>
              {brand.claim || (de ? "Design und Architektur mit einer klaren Vision." : "Design and architecture with a branded vision.")}
            </div>
            {brand.description && (
              <p style={{ fontFamily: brandFF, marginTop: 30, marginBottom: 0, fontSize: 13, lineHeight: 1.7, color: "#9a9aa5", columnCount: 2, columnGap: 34, textAlign: "justify", maxWidth: 640 }}>{brand.description}</p>
            )}
            <div style={{ fontFamily: brandFF, marginTop: 48, fontSize: 26, lineHeight: 1.45, letterSpacing: 0.2, overflowWrap: "break-word" }}>
              ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789
            </div>
          </div>
        </div>
      );
    }
    if (current === "imagery") return (
      <div style={{ display: "flex", gap: isMobile ? 28 : 56, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Image grid — larger tiles; hover reveals prompt copy + download */}
        <div style={{ flex: "1 1 480px", minWidth: 0, display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: isMobile ? 12 : 20 }}>
          {brand.imagery.map((img, i) => (
            <div key={img.id || i} className="pb-img-tile" style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "1 / 1", background: "#f3f3f6" }}>
              <img src={img.url} alt={img.name || "Bild"} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div className="pb-img-overlay" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14, background: "linear-gradient(180deg, rgba(0,0,0,0) 32%, rgba(0,0,0,0.58) 100%)" }}>
                {img.prompt && (
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 10 }}>{img.prompt}</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {img.prompt && (
                    <button onClick={() => copyPrompt(img.prompt, i)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.16)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      {copiedPrompt === i ? (de ? "Kopiert!" : "Copied!") : (de ? "Prompt kopieren" : "Copy prompt")}
                    </button>
                  )}
                  <button onClick={() => download(img.url, img.name || `imagery-${i + 1}.png`)} title={de ? "Herunterladen" : "Download"}
                    style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.16)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Sidenote */}
        <div style={isMobile ? { width: "100%" } : { width: 300, flexShrink: 0, paddingRight: 40 }}>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, marginBottom: 14 }}>{de ? `Die Bildsprache von ${brand.name}` : `The imagery of ${brand.name}`}</div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#8a8a94", margin: 0 }}>
            {de
              ? "Unsere Bildsprache macht die Marke fühlbar: Motive, Licht und Farbwelt folgen einem gemeinsamen Stil, damit jedes Bild als Teil derselben Geschichte erkennbar ist."
              : "Our imagery makes the brand tangible: subjects, light and color follow one shared style so every image reads as part of the same story."}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#8a8a94", marginTop: 16, marginBottom: 0 }}>
            {de
              ? "Fahre über ein Bild, um den zugehörigen Prompt zu kopieren oder das Bild herunterzuladen — so bleiben neue Motive konsistent zur bestehenden Welt."
              : "Hover over an image to copy its prompt or download it — keeping new visuals consistent with the existing world."}
          </p>
        </div>
      </div>
    );
    if (current === "personas") {
      const p = personaIdx != null ? brand.personas[personaIdx] : null;
      const twoCol = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 40, alignItems: "start" };
      const Field = (label, val) => val ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 14, color: "#5a5a66", lineHeight: 1.5 }}>{val}</div>
        </div>
      ) : null;
      const Arrow = (txt, j) => (
        <div key={j} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
          <span style={{ color: "#9a9aa5", marginTop: 2, flexShrink: 0 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          <span style={{ fontSize: 14, color: "#5a5a66", lineHeight: 1.5 }}>{txt}</span>
        </div>
      );
      if (p) {
        // ── Persona detail (read-only, mirrors the app's persona card) ──
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 36 : 56, maxWidth: 980 }}>
            <div onClick={() => setPersonaIdx(null)} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#8a8a94", fontSize: 13, fontWeight: 500, alignSelf: "flex-start" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {de ? "Alle Personas" : "All personas"}
            </div>

            {/* Row 1: Photo | Name + Info */}
            <div style={twoCol}>
              <div style={{ width: "100%", aspectRatio: "4/5", borderRadius: 18, overflow: "hidden", background: uiAccent + "1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 56, fontWeight: 700, color: uiAccent }}>{(p.name || "?").charAt(0).toUpperCase()}</span>}
              </div>
              <div style={{ paddingTop: isMobile ? 0 : 36 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 28 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>{p.name || "Persona"}</span>
                  {p.age && <span style={{ fontSize: 17, color: "#8a8a94", fontWeight: 500, marginTop: 2 }}>{p.age}</span>}
                </div>
                {Field(de ? "Beruf" : "Role", p.role)}
                {Field(de ? "Geschlecht" : "Gender", p.gender)}
                {Field("Consumer Behavior", p.consumer_behavior)}
                {Field("Location", p.location)}
              </div>
            </div>

            {/* Row 2: Motivations | Quote */}
            {((p.motivations || []).some(m => m.label) || p.quote) && (
              <div style={twoCol}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Motivations</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {(p.motivations || []).filter(m => m.label).map((m, j) => (
                      <div key={j}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 7 }}>{m.label}</div>
                        <div style={{ height: 6, borderRadius: 4, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                          <div style={{ width: `${m.value}%`, height: "100%", borderRadius: 4, background: uiAccent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {p.quote ? (
                  <div style={{ paddingTop: isMobile ? 0 : 38, fontSize: 20, fontStyle: "italic", color: "#8a8a94", lineHeight: 1.55 }}>&ldquo;{p.quote}&rdquo;</div>
                ) : <div />}
              </div>
            )}

            {/* Row 3: Goals | Pains */}
            <div style={twoCol}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Goals</div>
                {(p.goals || []).filter(Boolean).map((g, j) => Arrow(g, j))}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Pains</div>
                {(p.pains || []).filter(Boolean).map((g, j) => Arrow(g, j))}
              </div>
            </div>

            {/* Row 4: Product expectation */}
            {p.product_expectation && (
              <div style={{ padding: "22px 26px", borderRadius: 18, background: "rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{de ? "Produkterwartung" : "Product expectation"}</div>
                <div style={{ fontSize: 15, color: "#5a5a66", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{p.product_expectation}</div>
              </div>
            )}
          </div>
        );
      }
      // ── Overview — photo cards like the app's persona list; click opens the card ──
      return (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {brand.personas.map((pp, i) => (
            <div key={pp.id || i} className="pb-card" onClick={() => setPersonaIdx(i)}
              style={{ cursor: "pointer", borderRadius: 18, overflow: "hidden", background: "#fff", border: "1px solid #ececf0" }}>
              <div style={{ height: 340, background: uiAccent + "1a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {pp.photo_url ? <img src={pp.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 52, fontWeight: 700, color: uiAccent }}>{(pp.name || "?").charAt(0).toUpperCase()}</span>}
              </div>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{pp.name || "Persona"}{pp.age ? <span style={{ fontWeight: 500, color: "#8a8a94", fontSize: 14 }}>  ·  {pp.age}</span> : null}</div>
                {pp.role && <div style={{ fontSize: 13, color: "#8a8a94", marginTop: 3 }}>{pp.role}</div>}
                {pp.consumer_behavior && <div style={{ marginTop: 10, display: "inline-block", padding: "4px 11px", borderRadius: 8, background: "rgba(0,0,0,0.05)", color: uiAccent, fontSize: 12, fontWeight: 600 }}>{pp.consumer_behavior}</div>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    // Downloads
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
        {brand.logos.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderRadius: 14, border: "1px solid #ececf0" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>Logo — {l.label || l.key || "Primary"}</span>
            {dlBtn(l.url, `${(l.label || l.key || "logo")}.png`, "PNG")}
          </div>
        ))}
        {brand.typography && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderRadius: 14, border: "1px solid #ececf0" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>Schrift — {fontFamily}</span>
            {brand.typography.kind === "google"
              ? <a href={`https://fonts.google.com/specimen/${encodeURIComponent((fontFamily || "").replace(/ /g, "+"))}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: uiAccent, textDecoration: "none" }}>Google Fonts →</a>
              : brand.typography.url ? dlBtn(brand.typography.url, fontFamily || "font", "Font") : <span style={{ fontSize: 13, color: "#aaa" }}>—</span>}
          </div>
        )}
      </div>
    );
  };

  const sectionTitle = current === "downloads" ? "Download Assets" : (NAV.find(n => n.key === current)?.label || "");

  // ── Icon rail (left navigation) ──
  const railIcon = (key) => {
    const p = {
      strategy: <><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>,
      taglines: <><path d="M10 11H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4"/><path d="M20 11h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4"/></>,
      voice: <><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/></>,
      logo: <><path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/></>,
      colors: <><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></>,
      typography: <><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></>,
      imagery: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></>,
      personas: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
      downloads: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
      share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
    }[key];
    return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
  };

  const railBtn = (key, label, onClick, isActive) => {
    const hov = hoverNav === key;
    return (
      <div key={key} style={{ position: "relative" }} onMouseEnter={() => setHoverNav(key)} onMouseLeave={() => setHoverNav(h => (h === key ? null : h))}>
        <div onClick={onClick}
          style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            background: isActive ? "#15151c" : hov ? "rgba(0,0,0,0.05)" : "transparent",
            color: isActive ? "#fff" : hov ? "#15151c" : "#9a9aa5",
            transition: "background 0.45s cubic-bezier(0.22, 1, 0.36, 1), color 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {railIcon(key)}
        </div>
        {/* Tooltip */}
        <div style={{ position: "absolute", left: "calc(100% + 14px)", top: "50%", zIndex: 20, pointerEvents: "none",
          transform: `translateY(-50%) translateX(${hov ? 0 : -4}px)`, opacity: hov ? 1 : 0,
          transition: "opacity 0.25s ease, transform 0.25s ease",
          background: "#15151c", color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: FONT, padding: "6px 11px", borderRadius: 8, whiteSpace: "nowrap", boxShadow: "0 6px 18px rgba(0,0,0,0.18)" }}>
          {label}
        </div>
      </div>
    );
  };

  const mobileNavItems = [...NAV, { key: "downloads", label: "Download Assets" }];

  return (
    <div style={{ fontFamily: FONT, color: "#15151c", background: "#eef0f2", position: "fixed", inset: 0, display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 14, padding: isMobile ? 10 : 14 }}>
      <style>{`
        .pb-img-overlay { opacity: 0; transition: opacity 0.3s ease; }
        .pb-img-tile:hover .pb-img-overlay { opacity: 1; }
        .pb-card { transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
        .pb-card:hover { transform: translateY(-3px); }
        @keyframes pbFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        /* Scrollbar stays clear of the panel's rounded corners (inset via margins) */
        .pb-scroll { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.22) transparent; }
        .pb-scroll::-webkit-scrollbar { width: 8px; }
        .pb-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.16); border-radius: 99px; }
        .pb-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {isMobile ? (
        /* ── Mobile: top bar with logo + burger dropdown ── */
        <div style={{ position: "relative", flexShrink: 0, height: 54, background: "#fff", borderRadius: 16, border: "1px solid #e9eaee", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 0 16px", zIndex: 30 }}>
          <img src="/i7OS-Logo.png" alt="i7 OS" style={{ height: 22 }} />
          <div onClick={() => setMobileNavOpen(o => !o)} style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#15151c" }}>
            {mobileNavOpen
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>}
          </div>
          {mobileNavOpen && (
            <>
              <div onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 31, background: "#fff", borderRadius: 16, border: "1px solid #e9eaee", boxShadow: "0 18px 44px rgba(0,0,0,0.14)", padding: 8 }}>
                {mobileNavItems.map(n => (
                  <div key={n.key} onClick={() => go(n.key)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, cursor: "pointer", background: current === n.key ? "rgba(0,0,0,0.05)" : "transparent" }}>
                    <span style={{ color: current === n.key ? "#15151c" : "#9a9aa5", display: "flex" }}>{railIcon(n.key)}</span>
                    <span style={{ fontSize: 14, fontWeight: current === n.key ? 700 : 500 }}>{n.label}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: "#e9eaee", margin: "6px 4px" }} />
                <div onClick={() => { copyLink(); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, cursor: "pointer" }}>
                  <span style={{ color: "#9a9aa5", display: "flex" }}>{railIcon("share")}</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{linkCopied ? "Link kopiert!" : "Teilen"}</span>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* ── Desktop: icon rail — nav vertically centred, downloads + share pinned bottom ── */
        <aside style={{ width: 72, flexShrink: 0, background: "#fff", borderRadius: 14, border: "1px solid #e9eaee", padding: "20px 0 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <img src="/i7OS-Logo.png" alt="i7 OS" style={{ width: 36, marginLeft: 3 }} />
          <div style={{ flex: 1 }} />
          {NAV.map(n => railBtn(n.key, n.label, () => go(n.key), current === n.key))}
          <div style={{ flex: 1 }} />
          {railBtn("share", linkCopied ? "Link kopiert!" : "Teilen", copyLink, false)}
          {railBtn("downloads", "Download Assets", () => go("downloads"), current === "downloads")}
        </aside>
      )}

      {/* Content */}
      <main style={{ position: "relative", flex: 1, minWidth: 0, background: "#fff", borderRadius: 18, border: "1px solid #e9eaee", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Content scrolls beneath the frosted footer — no white gap above the line */}
        <div className="pb-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", margin: "10px 4px 0 0", padding: isMobile ? "12px 20px 76px" : "24px 38px 84px" }}>
          <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 600, color: "#9a9aa5", marginBottom: 8 }}>{brand.name}</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4, marginBottom: 28 }}>{sectionTitle}</div>
          {renderSection()}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: isMobile ? "12px 20px" : "14px 38px", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 12.5, color: "#a0a0aa",
          background: "rgba(255,255,255,0.62)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: "0 0 17px 17px" }}>
          <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand.claim || "Brand Guidelines"}</span>
          <span style={{ flexShrink: 0 }}>erstellt mit i7&nbsp;OS</span>
        </div>
      </main>
    </div>
  );
}
