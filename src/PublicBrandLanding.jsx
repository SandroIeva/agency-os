import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

// ── Public Brand landing page ───────────────────────────────────────────────
// Reached via ?b=<token> (a published share) or ?b=preview (the signed-in user's
// own brand, for previewing the design). Layout: top bar (org logo + actions),
// a dark sidebar navigating the brand sections, and a scrollable content panel
// on the right. Read-only, shareable without an account.

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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
  const [voiceSub, setVoiceSub] = useState("intro"); // inner nav within Voice & Tone
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

  const labelEyebrow = (txt) => <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 600, color: "#9a9aa5", marginBottom: 16 }}>{txt}</div>;
  const dlBtn = (url, name, label) => (
    <button onClick={() => download(url, name)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, border: "1px solid #e6e6ea", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT, color: "#333" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      {label || "Download"}
    </button>
  );

  // ── Section content ──
  const renderSection = () => {
    if (current === "strategy") return (
      <div>
        {brand.claim && <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1, fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>{brand.claim}</div>}
        {brand.description && <p style={{ fontSize: 17, lineHeight: 1.7, color: "#4a4a56", marginTop: 18, maxWidth: 720 }}>{brand.description}</p>}
        {brand.values.length > 0 && (
          <div style={{ marginTop: 34 }}>
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
      </div>
    );
    if (current === "taglines") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
        {brand.taglines.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 22, borderRadius: 16, border: "1px solid #ececf0", padding: "22px 26px" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#d7d7de", lineHeight: 1, flexShrink: 0, width: 44, fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.25, fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>{t.tagline}</div>
              {t.desc && <div style={{ fontSize: 14, color: "#6a6a74", lineHeight: 1.6, marginTop: 8 }}>{t.desc}</div>}
            </div>
          </div>
        ))}
      </div>
    );
    if (current === "voice") {
      const tone = brand.tone;
      const moments = Array.isArray(tone.moments) ? tone.moments : [];
      const attrs = Array.isArray(tone.attributes) ? tone.attributes : [];
      const sidenote = tone.intro?.body || "";
      const navItems = [
        { id: "intro", label: de ? "Übersicht" : "Overview" },
        ...moments.map((m, i) => ({ id: `m${i}`, label: m.title })),
        ...(attrs.length ? [{ id: "attrs", label: de ? "Attribute" : "Attributes" }] : []),
      ];
      const scrollTo = (id) => { setVoiceSub(id); const el = voiceRefs.current[id]; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
      const traitBar = (val) => (
        <div style={{ height: 10, borderRadius: 999, background: darkMode ? "#2a2a30" : "#e3e3e8", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, Number(val) || 0))}%`, borderRadius: 999, background: "#15151c" }} />
        </div>
      );
      const traitCard = (m) => (
        <div style={{ borderRadius: 18, background: darkMode ? "rgba(255,255,255,0.04)" : "#f3f3f5", padding: "22px 24px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>{m.title}</div>
          {m.desc && <p style={{ fontSize: 13.5, color: "#6a6a74", lineHeight: 1.55, marginTop: -8, marginBottom: 16 }}>{m.desc}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {(m.traits || []).map((tr, j) => (
              <div key={j}>
                {traitBar(tr.value)}
                <div style={{ fontSize: 13, color: "#8a8a94", marginTop: 8 }}>{tr.label}</div>
              </div>
            ))}
          </div>
        </div>
      );
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

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header + sidenote — same 2-col grid as the cards below, so they align */}
            <div ref={el => (voiceRefs.current.intro = el)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 38, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#15151c", paddingBottom: 12, borderBottom: "1px solid #e6e6ea", marginBottom: 20 }}>{de ? "Wie wir unsere Stimme anpassen" : "How We Adapt Our Voice"}</div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.18, fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>
                  {de ? "Unsere Persönlichkeit ist, wer wir sind — unser Ton ist, wie wir in jeder Situation klingen." : "While our personality is who we are, our tone of voice is how we sound in any given situation."}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Sidenote</div>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "#6a6a74" }}>{sidenote}</p>
              </div>
            </div>

            {/* Trait cards — two columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {moments.map((m, i) => i % 2 === 0 ? <div key={i} ref={el => (voiceRefs.current[`m${i}`] = el)}>{traitCard(m)}</div> : null)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {moments.map((m, i) => i % 2 === 1 ? <div key={i} ref={el => (voiceRefs.current[`m${i}`] = el)}>{traitCard(m)}</div> : null)}
              </div>
            </div>

            {/* Attributes (do / don't), reachable via the inner nav */}
            {attrs.length > 0 && (
              <div ref={el => (voiceRefs.current.attrs = el)} style={{ marginTop: 40 }}>
                {labelEyebrow(de ? "Attribute" : "Attributes")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {attrs.map((a, i) => (
                    <div key={i} style={{ borderRadius: 18, background: darkMode ? "rgba(255,255,255,0.04)" : "#f3f3f5", padding: "20px 22px" }}>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{a.label || a.name}</div>
                      {(a.overview || a.description) && <div style={{ fontSize: 13.5, color: "#5a5a66", lineHeight: 1.6 }}>{a.overview || a.description}</div>}
                      {Array.isArray(a.shouldBe) && a.shouldBe.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: "#3f9b6a", fontWeight: 600, marginBottom: 7 }}>Sollte sein</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{a.shouldBe.map((s, j) => <span key={j} style={{ fontSize: 12, color: "#2f7d54", background: "#eaf6ee", padding: "4px 10px", borderRadius: 999 }}>{s}</span>)}</div>
                        </div>
                      )}
                      {Array.isArray(a.shouldntBe) && a.shouldntBe.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: "#b9536b", fontWeight: 600, marginBottom: 7 }}>Sollte nicht sein</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{a.shouldntBe.map((s, j) => <span key={j} style={{ fontSize: 12, color: "#a23b54", background: "#fbeef1", padding: "4px 10px", borderRadius: 999 }}>{s}</span>)}</div>
                        </div>
                      )}
                      {Array.isArray(a.tactics) && a.tactics.length > 0 && (
                        <div style={{ marginTop: 16, borderTop: "1px solid #e6e6ea", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                          {a.tactics.map((tac, j) => (
                            <div key={j}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#15151c", marginBottom: 3 }}>{tac.title}</div>
                              {tac.desc && <div style={{ fontSize: 13, color: "#6a6a74", lineHeight: 1.55 }}>{tac.desc}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    if (current === "logo") return (
      <div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ flex: "2 1 360px", minWidth: 280, borderRadius: 16, background: "#f5f5f7", display: "flex", alignItems: "center", justifyContent: "center", padding: 48, minHeight: 320 }}>
            <img src={primaryLogo.url} alt={brand.name} style={{ maxWidth: "80%", maxHeight: 220, objectFit: "contain" }} />
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 220 }}>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{brand.name}</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#5a5a66" }}>{brand.description || brand.claim || "Das primäre Logo der Marke. Nutze es mit ausreichend Abstand und auf neutralem Hintergrund."}</p>
            <div style={{ marginTop: 18 }}>{dlBtn(primaryLogo.url, `${brand.name || "logo"}.png`, "Logo herunterladen")}</div>
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
    if (current === "colors") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
        {brand.colors.map((c, i) => (
          <div key={i} onClick={() => copyHex(c.hex)} title="Hex kopieren" style={{ cursor: "pointer", borderRadius: 16, overflow: "hidden", border: "1px solid #ececf0" }}>
            <div style={{ height: 120, background: c.hex }} />
            <div style={{ padding: "12px 14px" }}>
              {c.label && <div style={{ fontSize: 12, color: "#9a9aa5", marginBottom: 2 }}>{c.label}</div>}
              <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{copied === c.hex ? "Kopiert!" : c.hex}</div>
            </div>
          </div>
        ))}
      </div>
    );
    if (current === "typography") return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{fontFamily || "Schrift"}</div>
          {brand.typography.kind === "google" ? (
            <a href={`https://fonts.google.com/specimen/${encodeURIComponent((fontFamily || "").replace(/ /g, "+"))}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: accent, textDecoration: "none" }}>Auf Google Fonts ansehen →</a>
          ) : brand.typography.url ? (
            <button onClick={() => download(brand.typography.url, fontFamily || "font")} style={{ fontSize: 13, fontWeight: 600, color: accent, background: "transparent", border: "none", cursor: "pointer" }}>Schrift herunterladen ↓</button>
          ) : null}
        </div>
        <div style={{ fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.05 }}>Aa Bb Cc</div>
          <div style={{ fontSize: 22, color: "#3a3a44", marginTop: 16 }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br/>abcdefghijklmnopqrstuvwxyz 0123456789</div>
          {Array.isArray(brand.typography.weights) && brand.typography.weights.length > 0 && (
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 8 }}>
              {brand.typography.weights.map(w => <div key={w} style={{ fontSize: 22, fontWeight: w }}>{w} — The quick brown fox jumps over the lazy dog</div>)}
            </div>
          )}
        </div>
      </div>
    );
    if (current === "imagery") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {brand.imagery.map((img, i) => (
          <div key={img.id || i} style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #ececf0", aspectRatio: "4 / 3", background: "#f3f3f6" }}>
            <img src={img.url} alt={img.name || "Bild"} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ))}
      </div>
    );
    if (current === "personas") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {brand.personas.map((p, i) => (
          <div key={p.id || i} style={{ borderRadius: 18, border: "1px solid #ececf0", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: accent + "22", color: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17 }}>
                {(p.name || "?").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: "#8a8a94" }}>{[p.role, p.age && `${p.age}`].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            {Array.isArray(p.goals) && p.goals.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#9a9aa5", fontWeight: 600, marginBottom: 7 }}>Ziele</div>
                {p.goals.slice(0, 5).map((g, j) => <div key={j} style={{ fontSize: 13.5, color: "#444", lineHeight: 1.5, marginBottom: 4, paddingLeft: 14, position: "relative" }}><span style={{ position: "absolute", left: 0, color: accent }}>›</span>{g}</div>)}
              </div>
            )}
            {Array.isArray(p.pains) && p.pains.length > 0 && (
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#9a9aa5", fontWeight: 600, marginBottom: 7 }}>Pains</div>
                {p.pains.slice(0, 5).map((g, j) => <div key={j} style={{ fontSize: 13.5, color: "#444", lineHeight: 1.5, marginBottom: 4, paddingLeft: 14, position: "relative" }}><span style={{ position: "absolute", left: 0, color: accent }}>›</span>{g}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
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
              ? <a href={`https://fonts.google.com/specimen/${encodeURIComponent((fontFamily || "").replace(/ /g, "+"))}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: accent, textDecoration: "none" }}>Google Fonts →</a>
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

  return (
    <div style={{ fontFamily: FONT, color: "#15151c", background: "#eef0f2", position: "fixed", inset: 0, display: "flex", gap: 14, padding: 14 }}>
      {/* Icon rail */}
      <aside style={{ width: 64, flexShrink: 0, background: "#fff", borderRadius: 18, border: "1px solid #e9eaee", padding: "18px 0 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <img src="/i7OS-Logo.png" alt="i7 OS" style={{ width: 34, marginBottom: 16 }} />
        {NAV.map(n => railBtn(n.key, n.label, () => setActive(n.key), current === n.key))}
        <div style={{ width: 24, height: 1, background: "#e9eaee", margin: "8px 0" }} />
        {railBtn("downloads", "Download Assets", () => setActive("downloads"), current === "downloads")}
        <div style={{ flex: 1 }} />
        {railBtn("share", linkCopied ? "Link kopiert!" : "Teilen", copyLink, false)}
      </aside>

      {/* Content */}
      <main style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 18, border: "1px solid #e9eaee", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "34px 38px 26px" }}>
          <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 600, color: "#9a9aa5", marginBottom: 8 }}>{brand.name}</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4, marginBottom: 28 }}>{sectionTitle}</div>
          {renderSection()}
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 38px", borderTop: "1px solid #eeeef1", fontSize: 12.5, color: "#a0a0aa" }}>
          <span>{brand.claim || "Brand Guidelines"}</span>
          <span>erstellt mit i7&nbsp;OS</span>
        </div>
      </main>
    </div>
  );
}
