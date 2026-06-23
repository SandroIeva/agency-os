import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

// ── Public Brand landing page ───────────────────────────────────────────────
// Reached via ?b=<token> (a published share) or ?b=preview (the signed-in user's
// own brand, for previewing the design). Layout: top bar (org logo + actions),
// a dark sidebar navigating the brand sections, and a scrollable content panel
// on the right. Read-only, shareable without an account.

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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
    taglines: Array.isArray(row.taglines) ? row.taglines.filter(Boolean) : [],
    tone: (row.voice_tone && typeof row.voice_tone === "object" && !Array.isArray(row.voice_tone)
      && (row.voice_tone.intro || (row.voice_tone.moments || []).length || (row.voice_tone.attributes || []).length)) ? row.voice_tone : null,
    toneList: Array.isArray(row.tone_of_voice) ? row.tone_of_voice.map(v => typeof v === "string" ? v : (v?.label || v?.name || "")).filter(Boolean) : [],
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
    { key: "voice", label: "Voice & Tone", has: show("voice") && !!(brand.tone || brand.toneList.length) },
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        {brand.taglines.map((t, i) => (
          <div key={i} style={{ borderRadius: 16, border: "1px solid #ececf0", padding: "22px 26px", fontSize: 24, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.25, fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>“{t}”</div>
        ))}
      </div>
    );
    if (current === "voice") {
      const tone = brand.tone;
      if (!tone) return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {brand.toneList.map((t, i) => <span key={i} style={{ fontSize: 15, fontWeight: 600, color: "#333", background: "#f3f3f6", padding: "10px 16px", borderRadius: 999 }}>{t}</span>)}
        </div>
      );
      return (
        <div>
          {tone.intro && (
            <div style={{ marginBottom: 34, maxWidth: 760 }}>
              {tone.intro.body && <p style={{ fontSize: 17, lineHeight: 1.7, color: "#3a3a44" }}>{tone.intro.body}</p>}
              {Array.isArray(tone.intro.questions) && tone.intro.questions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                  {tone.intro.questions.map((q, i) => <span key={i} style={{ fontSize: 14, fontWeight: 500, color: "#333", background: "#f3f3f6", padding: "8px 14px", borderRadius: 999 }}>{q}</span>)}
                </div>
              )}
              {tone.intro.closing && <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#6a6a74", marginTop: 16 }}>{tone.intro.closing}</p>}
            </div>
          )}
          {Array.isArray(tone.attributes) && tone.attributes.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              {labelEyebrow("Attribute")}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
                {tone.attributes.map((a, i) => (
                  <div key={i} style={{ borderRadius: 16, border: "1px solid #ececf0", padding: "18px 20px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5 }}>{a.label || a.name}</div>
                    {a.description && <div style={{ fontSize: 13.5, color: "#6a6a74", lineHeight: 1.55 }}>{a.description}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(tone.moments) && tone.moments.length > 0 && (
            <div>
              {labelEyebrow("Momente")}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
                {tone.moments.map((m, i) => (
                  <div key={i} style={{ borderRadius: 18, border: "1px solid #ececf0", padding: 22 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{m.title}</div>
                    {m.desc && <p style={{ fontSize: 13.5, color: "#5a5a66", lineHeight: 1.55, marginBottom: 14 }}>{m.desc}</p>}
                    {Array.isArray(m.traits) && m.traits.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
                        {m.traits.map((tr, j) => (
                          <div key={j}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8a8a94", marginBottom: 4 }}><span>{tr.label}</span><span>{tr.value}</span></div>
                            <div style={{ height: 6, borderRadius: 999, background: "#eee" }}><div style={{ height: "100%", width: `${Math.max(0, Math.min(100, tr.value))}%`, borderRadius: 999, background: accent }} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(m.channels) && m.channels.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {m.channels.map((c, j) => <span key={j} style={{ fontSize: 12, color: "#555", background: "#f3f3f6", padding: "5px 10px", borderRadius: 999 }}>{c}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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

  const navItem = (num, key, label) => {
    const on = current === key;
    return (
      <div key={key} onClick={() => setActive(key)} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "7px 0", cursor: "pointer" }}>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.32)", width: 26, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{num}</span>
        <span style={{ fontSize: 13.5, color: on ? "#fff" : "rgba(255,255,255,0.62)", fontWeight: on ? 600 : 400, transition: "color 0.15s" }}>{label}</span>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: FONT, color: "#15151c", background: "#eef0f2", position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: "#fff", borderBottom: "1px solid #e7e8ec" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {primaryLogo && <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f3f6", overflow: "hidden" }}><img src={primaryLogo.url} alt="" style={{ maxWidth: "76%", maxHeight: "76%", objectFit: "contain" }} /></div>}
          <span style={{ fontSize: 15, fontWeight: 700, color: "#15151c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={copyLink} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 999, border: "1px solid #e6e6ea", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT, color: "#333" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            {linkCopied ? "Link kopiert!" : "Teilen"}
          </button>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 14, padding: 14 }}>
        {/* Sidebar */}
        <aside style={{ width: 232, flexShrink: 0, background: "#14161b", borderRadius: 16, padding: "22px 18px", display: "flex", flexDirection: "column", overflowY: "auto" }} className="no-scrollbar">
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 18 }}>The Brand</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {NAV.map((n, i) => navItem(`${i + 1}.0`, n.key, n.label))}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "16px 0" }} />
          <div onClick={() => setActive("downloads")} style={{ cursor: "pointer", fontSize: 13.5, fontWeight: current === "downloads" ? 600 : 500, color: current === "downloads" ? "#fff" : "rgba(255,255,255,0.7)" }}>Download Assets</div>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flexShrink: 0, padding: "20px 28px", borderBottom: "1px solid #eeeef1" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{sectionTitle}</div>
          </div>
          <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 28px 20px" }}>
            {renderSection()}
          </div>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderTop: "1px solid #eeeef1", fontSize: 12.5, color: "#a0a0aa" }}>
            <span>{brand.claim || "Brand Guidelines"}</span>
            <span>erstellt mit i7&nbsp;OS</span>
          </div>
        </main>
      </div>
    </div>
  );
}
