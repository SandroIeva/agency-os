import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

// ── Public Brand landing page ───────────────────────────────────────────────
// Reached via ?b=<token> (a published share) or ?b=preview (the signed-in user's
// own brand, for previewing the design). Renders the brand — logo, colours,
// typography, imagery, strategy, personas — in a clean, shareable page that
// freelancers/partners can open without an account. Section visibility comes
// from the share's `sections`; in preview everything with data is shown.

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// Map a brand_profile row → the flat object the page renders.
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
    vision: row.vision && typeof row.vision === "object" ? row.vision : null,
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
  const [sections, setSections] = useState(null); // null = show all (preview)
  const [copied, setCopied] = useState(null);

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

  // Load the brand's web font + Inter for the page chrome.
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
  const show = (key) => hasSectionConfig ? !!sections[key] : true; // no config → show everything with data
  const copyHex = (hex) => { try { navigator.clipboard.writeText(hex); } catch {} setCopied(hex); setTimeout(() => setCopied(c => c === hex ? null : c), 1300); };

  if (brand === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#888", background: "#fff" }}>Lädt…</div>;
  }
  if (!brand) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: FONT, background: "#fff", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>Brand nicht gefunden</div>
        <div style={{ fontSize: 14, color: "#777" }}>Dieser Link ist ungültig oder wurde zurückgezogen.</div>
      </div>
    );
  }

  const accent = brand.accent;
  const primaryLogo = brand.logos.find(l => l.key === "primary") || brand.logos[0];
  const hasColors = brand.colors.length > 0;
  const hasType = !!brand.typography;
  const hasImagery = brand.imagery.length > 0;
  const hasPersonas = brand.personas.length > 0;
  const hasStrategy = !!(brand.claim || brand.description || brand.values.length || brand.taglines.length || (brand.vision && Object.keys(brand.vision).length));

  const sectionLabel = (txt) => (
    <div style={{ fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 600, color: "#9a9aa5", marginBottom: 22 }}>{txt}</div>
  );
  const Section = ({ label, children, alt }) => (
    <section style={{ padding: "72px 24px", background: alt ? "#fafafb" : "#fff", borderTop: "1px solid #efeff2" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {sectionLabel(label)}
        {children}
      </div>
    </section>
  );

  return (
    <div style={{ fontFamily: FONT, color: "#15151c", background: "#fff", position: "fixed", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {/* Hero */}
      <header style={{ position: "relative", overflow: "hidden", padding: "96px 24px 80px", textAlign: "center",
        background: `radial-gradient(1200px 500px at 50% -10%, ${accent}22, transparent 70%), #fff` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {primaryLogo && (
            <div style={{ width: 104, height: 104, borderRadius: 26, margin: "0 auto 28px", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", boxShadow: "0 14px 50px rgba(0,0,0,0.10)", border: "1px solid #efeff2" }}>
              <img src={primaryLogo.url} alt={brand.name} style={{ maxWidth: "68%", maxHeight: "68%", objectFit: "contain" }} />
            </div>
          )}
          <h1 style={{ fontSize: 48, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1, margin: 0, fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>{brand.name}</h1>
          {brand.claim && <p style={{ fontSize: 20, color: "#5a5a66", marginTop: 16, fontWeight: 500 }}>{brand.claim}</p>}
          {primaryLogo && (
            <button onClick={() => download(primaryLogo.url, `${brand.name || "logo"}.png`)}
              style={{ marginTop: 30, display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 999, border: "none", cursor: "pointer", background: accent, color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: FONT, boxShadow: `0 10px 30px ${accent}40` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Logo herunterladen
            </button>
          )}
        </div>
      </header>

      {/* Logos */}
      {show("logo") && brand.logos.length > 0 && (
        <Section label="Logo" alt>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
            {brand.logos.map((l, i) => (
              <div key={i} style={{ borderRadius: 18, border: "1px solid #ececf0", overflow: "hidden", background: "#fff" }}>
                <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: i % 2 ? "#16161c" : "#fff" }}>
                  <img src={l.url} alt={l.label || "Logo"} style={{ maxWidth: "75%", maxHeight: "75%", objectFit: "contain" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderTop: "1px solid #ececf0" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#444" }}>{l.label || l.key || "Logo"}</span>
                  <button onClick={() => download(l.url, `${(l.label || l.key || "logo")}.png`)} title="Herunterladen"
                    style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #ececf0", background: "#fff", cursor: "pointer", color: "#666", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Colours */}
      {show("colors") && hasColors && (
        <Section label="Farben">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
            {brand.colors.map((c, i) => (
              <div key={i} onClick={() => copyHex(c.hex)} title="Hex kopieren" style={{ cursor: "pointer", borderRadius: 16, overflow: "hidden", border: "1px solid #ececf0" }}>
                <div style={{ height: 110, background: c.hex }} />
                <div style={{ padding: "11px 13px" }}>
                  {c.label && <div style={{ fontSize: 12, color: "#9a9aa5", marginBottom: 2 }}>{c.label}</div>}
                  <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{copied === c.hex ? "Kopiert!" : c.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Typography */}
      {show("typography") && hasType && (
        <Section label="Typografie" alt>
          <div style={{ borderRadius: 20, border: "1px solid #ececf0", background: "#fff", padding: "34px 32px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{fontFamily || "Schrift"}</div>
              {brand.typography.kind === "google" ? (
                <a href={`https://fonts.google.com/specimen/${encodeURIComponent((fontFamily || "").replace(/ /g, "+"))}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 13, fontWeight: 600, color: accent, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Auf Google Fonts ansehen →
                </a>
              ) : brand.typography.url ? (
                <button onClick={() => download(brand.typography.url, `${fontFamily || "font"}`)} style={{ fontSize: 13, fontWeight: 600, color: accent, background: "transparent", border: "none", cursor: "pointer" }}>Schrift herunterladen ↓</button>
              ) : null}
            </div>
            <div style={{ fontFamily: fontFamily ? `'${fontFamily}', ${FONT}` : FONT }}>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1, lineHeight: 1.1 }}>Aa Bb Cc</div>
              <div style={{ fontSize: 22, color: "#3a3a44", marginTop: 14 }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</div>
              {Array.isArray(brand.typography.weights) && brand.typography.weights.length > 0 && (
                <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 6 }}>
                  {brand.typography.weights.map(w => (
                    <div key={w} style={{ fontSize: 20, fontWeight: w }}>{w} — The quick brown fox jumps over the lazy dog</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Strategy */}
      {show("strategy") && hasStrategy && (
        <Section label="Brand Strategy">
          {brand.claim && <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5, maxWidth: 760 }}>{brand.claim}</div>}
          {brand.description && <p style={{ fontSize: 17, lineHeight: 1.65, color: "#4a4a56", marginTop: 18, maxWidth: 760 }}>{brand.description}</p>}
          {brand.taglines.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
              {brand.taglines.map((t, i) => <span key={i} style={{ fontSize: 14, fontWeight: 500, color: "#333", background: "#f1f1f4", padding: "8px 14px", borderRadius: 999 }}>{t}</span>)}
            </div>
          )}
          {brand.values.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginTop: 30 }}>
              {brand.values.map((v, i) => (
                <div key={i} style={{ borderRadius: 16, border: "1px solid #ececf0", padding: "20px 22px", background: "#fff" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{typeof v === "string" ? v : v.name}</div>
                  {v && v.reason && <div style={{ fontSize: 14, color: "#6a6a74", lineHeight: 1.55 }}>{v.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Imagery */}
      {show("imagery") && hasImagery && (
        <Section label="Bildsprache" alt>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {brand.imagery.map((img, i) => (
              <div key={img.id || i} style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #ececf0", aspectRatio: "4 / 3", background: "#f3f3f6" }}>
                <img src={img.url} alt={img.name || "Bild"} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Personas */}
      {show("personas") && hasPersonas && (
        <Section label="Personas">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
            {brand.personas.map((p, i) => (
              <div key={p.id || i} style={{ borderRadius: 18, border: "1px solid #ececf0", padding: "24px 24px", background: "#fff" }}>
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
                    {p.goals.slice(0, 4).map((g, j) => <div key={j} style={{ fontSize: 13.5, color: "#444", lineHeight: 1.5, marginBottom: 4, paddingLeft: 14, position: "relative" }}><span style={{ position: "absolute", left: 0, color: accent }}>›</span>{g}</div>)}
                  </div>
                )}
                {Array.isArray(p.pains) && p.pains.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#9a9aa5", fontWeight: 600, marginBottom: 7 }}>Pains</div>
                    {p.pains.slice(0, 4).map((g, j) => <div key={j} style={{ fontSize: 13.5, color: "#444", lineHeight: 1.5, marginBottom: 4, paddingLeft: 14, position: "relative" }}><span style={{ position: "absolute", left: 0, color: accent }}>›</span>{g}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Footer */}
      <footer style={{ padding: "40px 24px 56px", textAlign: "center", color: "#a0a0aa", fontSize: 13, borderTop: "1px solid #efeff2" }}>
        {brand.name} · Brand Guidelines · erstellt mit i7&nbsp;OS
      </footer>
    </div>
  );
}
