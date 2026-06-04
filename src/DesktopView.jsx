import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Design tokens (from Figma variables — Agency OS / Tokens) ──────────────
// Colors
const C = {
  brandPrimary:   "#2562EB",
  brandSecondary: "#7C3AED",
  neutral100:     "#F8FAFB",
  neutral900:     "#0F1729",
  textPrimary:    "rgba(0,0,0,0.80)",
  textSecondary:  "rgba(0,0,0,0.35)",
  surface:        "#FFFFFF",
};

// Figma node: Frame 1000004716 — 972×596px in 3456px design
// Active pill (Frame 1000004717): 361×77, radius=18, bg rgba(7,13,34,0.7)
// Items: fontSize=28.17 Inter Medium, gap=35px between items
const NAV_LEFT  = ["Brand", "Create", "Agents", "Messenger", "Plan"];
const NAV_RIGHT = ["Files", "Brand Identiy", "Design System", "Brand Strategy", "Channels"];

// ─── Icon components ─────────────────────────────────────────────────────────
const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "44%", height: "44%" }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const IconMic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "44%", height: "44%" }}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: "44%", height: "44%" }}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconCloud = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: "1em", height: "1em", verticalAlign: "middle" }}>
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

// ─── Component ───────────────────────────────────────────────────────────────
export default function DesktopView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("Brand");

  return (
    <div style={s.root} onClick={() => menuOpen && setMenuOpen(false)}>
      {/* Mountain background — background-blur.jpg in /public */}
      <img src="/background-blur.jpg" alt="" style={s.bgImage} />
      <div style={s.bgOverlay} />

      {/* ── Main card (Frame 3): 2862×1802, radius=45, bg #BDC9CC + gradient) ── */}
      <div style={s.card} onClick={e => e.stopPropagation()}>

        {/* Weather — Group 2: x=2657, y=74 in card → right ~3.5%, top ~4.1% */}
        <div style={s.weather}>
          <span style={s.weatherTemp}>20°</span>
          <IconCloud />
        </div>

        {/* Greeting — Frame 5: x=259, y=194 in card */}
        <div style={s.greeting}>
          {/* fontSize=91.72 → 91.72/3456 = 2.655vw */}
          <h1 style={s.greetingTitle}>Good Morning, Sandro</h1>
          {/* opacity=0.35 in Figma */}
          <p style={s.greetingSubtitle}>What would you like to do?</p>
        </div>

        {/* ── Decorative aurora blobs (Group 4) — bottom-right corner ── */}
        <div style={{ ...s.blob, background: "rgba(197,217,223,0.60)", width: "32%", height: "38%", bottom: "-4%", right: "10%" }} />
        <div style={{ ...s.blob, background: "rgba(197,223,212,0.55)", width: "25%", height: "30%", bottom: "-2%", right: "23%" }} />
        <div style={{ ...s.blob, background: "rgba(242,218,186,0.50)", width: "22%", height: "28%", bottom: "3%",  right: "4%"  }} />
        <div style={{ ...s.blob, background: "rgba(220,197,235,0.40)", width: "18%", height: "22%", bottom: "8%",  right: "15%" }} />

        {/* ── Navigation menu — slides up above bottom bar ── */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              style={s.navCard}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.9 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Left column */}
              <div style={s.navLeft}>
                {/* Active "Brand" pill — Frame 1000004717: w=361/972=37%, h=77/596=12.9%, r=18px→1.85% */}
                {NAV_LEFT.map(item => (
                  <div
                    key={item}
                    style={item === activeItem ? s.navItemActive : s.navItem}
                    onClick={() => setActiveItem(item)}
                  >
                    {item}
                  </div>
                ))}
              </div>

              {/* Divider — Vector 26: x=492/972=50.6% of menu */}
              <div style={s.navDivider} />

              {/* Right column */}
              <div style={s.navRight}>
                {NAV_RIGHT.map(item => (
                  <div
                    key={item}
                    style={s.navItem}
                    onClick={() => setActiveItem(item)}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom bar: y=1622/1802=90% of card height ── */}
        <div style={s.bottomBar}>

          {/* Logo — i7 OS: fontSize=75.8→2.19vw, opacity=0.8 */}
          <div style={s.logo}>
            <span style={s.logoI7}>i7</span>
            <span style={s.logoBadge}>OS</span>
          </div>

          {/* Action buttons — Frame 1000004691: 3 circles, diameter=105px→3.04vw */}
          <div style={s.bottomButtons}>
            <motion.button
              style={s.circleBtn}
              whileHover={{ scale: 1.08, background: "rgba(255,255,255,0.45)" }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
            >
              <IconFolder />
            </motion.button>

            <motion.button
              style={s.circleBtn}
              whileHover={{ scale: 1.08, background: "rgba(255,255,255,0.45)" }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
            >
              <IconMic />
            </motion.button>

            {/* + button toggles menu */}
            <motion.button
              style={{ ...s.circleBtn, ...(menuOpen ? s.circleBtnActive : {}) }}
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              animate={{ rotate: menuOpen ? 45 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
            >
              <IconPlus />
            </motion.button>
          </div>

          {/* Avatar sphere — Frame 1000004688: 106×106, radius=80, dark bg + gradient */}
          <motion.div
            style={s.avatar}
            whileHover={{ scale: 1.07 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  root: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#767676",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', 'Geist', system-ui, sans-serif",
  },

  // Background: imageHash 85d79b…, opacity=0.4, saturation filter=-0.59
  bgImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.4,
    filter: "saturate(0.41)",
    pointerEvents: "none",
    userSelect: "none",
  },
  bgOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(80,80,80,0.25)",
    pointerEvents: "none",
  },

  // Frame 3: 2862×1802 → 82.8% × 80.7%, radius=45px→1.3vw
  // fills: #BDC9CC base + white gradient 20% + white solid 20%
  card: {
    position: "relative",
    width: "82.8%",
    height: "80.7%",
    borderRadius: "1.3vw",
    background: "rgb(189,201,204)",
    backgroundImage: [
      "linear-gradient(148deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)",
      "linear-gradient(0deg, rgba(255,255,255,0.18), rgba(255,255,255,0.18))",
    ].join(", "),
    overflow: "hidden",
    boxShadow: "0 12px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)",
  },

  // Weather: x=2657+84+40=approx right:3.5%, y=74/1802=4.1%
  // fontSize=36.7→36.7/3456=1.06vw, opacity=0.4
  weather: {
    position: "absolute",
    top: "4.1%",
    right: "3.5%",
    display: "flex",
    alignItems: "center",
    gap: "0.35vw",
    color: "rgba(0,0,0,0.40)",
    fontSize: "clamp(10px, 1.06vw, 22px)",
    fontWeight: 500,
    letterSpacing: "-0.01em",
  },
  weatherTemp: {
    fontVariantNumeric: "tabular-nums",
  },

  // Frame 5: x=259/2862=9.05%, y=194/1802=10.77%
  // fontSize=91.72→91.72/3456=2.655vw
  greeting: {
    position: "absolute",
    top: "10.77%",
    left: "9.05%",
    display: "flex",
    flexDirection: "column",
    gap: "0.3vw",
  },
  greetingTitle: {
    fontSize: "clamp(16px, 2.655vw, 52px)",
    fontWeight: 400,
    color: "rgba(0,0,0,0.70)",
    letterSpacing: "-0.025em",
    lineHeight: 1.15,
    margin: 0,
  },
  greetingSubtitle: {
    fontSize: "clamp(16px, 2.655vw, 52px)",
    fontWeight: 400,
    color: "rgba(0,0,0,0.35)",
    letterSpacing: "-0.025em",
    lineHeight: 1.15,
    margin: 0,
  },

  // Decorative blobs (Group 4 ellipses)
  blob: {
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(55px)",
    pointerEvents: "none",
    zIndex: 0,
  },

  // Nav card (Frame 1000004716): 972×596 in 2862×1802 card
  // Positioned just above the bottom bar (dynamic, not fixed to 51.9%)
  // radius=50→50/2862=1.75% of card width = 1.45vw
  // bg: rgba(133,133,133,0.10)
  navCard: {
    position: "absolute",
    bottom: "calc(5.5% + 8% + 0.8vw)", // above the bottom bar
    left: "50%",
    transform: "translateX(-50%)",
    width: "clamp(280px, 34vw, 680px)",  // 972/2862=34% of card
    background: "rgba(230,234,237,0.82)",
    backdropFilter: "blur(24px) saturate(1.2)",
    WebkitBackdropFilter: "blur(24px) saturate(1.2)",
    borderRadius: "clamp(12px, 1.45vw, 28px)",
    border: "1px solid rgba(255,255,255,0.50)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "row",
    zIndex: 10,
    overflow: "hidden",
    padding: "clamp(10px, 1.1vw, 20px)",
    gap: 0,
  },

  // Left nav column
  navLeft: {
    flex: "0 0 48%",
    display: "flex",
    flexDirection: "column",
    gap: "clamp(2px, 0.2vw, 4px)",
    paddingRight: "clamp(6px, 0.5vw, 10px)",
  },
  navDivider: {
    width: "1px",
    alignSelf: "stretch",
    background: "rgba(0,0,0,0.10)",
    margin: "0 clamp(6px, 0.5vw, 10px)",
    flexShrink: 0,
  },
  navRight: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "clamp(2px, 0.2vw, 4px)",
    paddingLeft: "clamp(4px, 0.3vw, 8px)",
  },

  // Regular nav item — fontSize=28.17/3456=0.815vw, Inter Medium, opacity=0.8
  navItem: {
    padding: "clamp(6px, 0.55vw, 12px) clamp(8px, 0.65vw, 14px)",
    fontSize: "clamp(11px, 0.82vw, 18px)",
    fontWeight: 500,
    color: "rgba(0,0,0,0.80)",
    borderRadius: "clamp(6px, 0.52vw, 10px)",
    cursor: "pointer",
    letterSpacing: "-0.01em",
    userSelect: "none",
    transition: "background 0.15s ease",
  },
  // Active pill — Frame 1000004717: r=18, bg rgba(7,13,34,0.7), text rgba(255,255,255,0.9)
  navItemActive: {
    padding: "clamp(6px, 0.55vw, 12px) clamp(8px, 0.65vw, 14px)",
    fontSize: "clamp(11px, 0.82vw, 18px)",
    fontWeight: 500,
    color: "rgba(255,255,255,0.90)",
    background: "rgba(7,13,34,0.70)",
    borderRadius: "clamp(6px, 0.52vw, 10px)",
    cursor: "pointer",
    letterSpacing: "-0.01em",
    userSelect: "none",
  },

  // Bottom bar: y=1622/1802=90%, height=105/1802=5.8%
  bottomBar: {
    position: "absolute",
    bottom: "5.5%",
    left: 0,
    right: 0,
    height: "8%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: "2.9%",
    paddingRight: "3%",
    zIndex: 5,
  },

  // Logo — i7 OS: fontSize=75.8→2.19vw, opacity=0.8
  logo: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.3vw",
    userSelect: "none",
  },
  logoI7: {
    fontSize: "clamp(14px, 2.19vw, 40px)",
    fontWeight: 600,
    color: "rgba(0,0,0,0.80)",
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  logoBadge: {
    fontSize: "clamp(7px, 0.65vw, 13px)",
    fontWeight: 500,
    color: "rgba(0,0,0,0.55)",
    border: "1.5px solid rgba(0,0,0,0.28)",
    borderRadius: "999px",
    padding: "0.06vw 0.38vw",
    letterSpacing: "0.03em",
    lineHeight: 1.6,
  },

  bottomButtons: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(8px, 1.0vw, 20px)",
  },

  // Circle buttons — diameter=105px→105/3456=3.04vw
  circleBtn: {
    width: "clamp(30px, 3.04vw, 56px)",
    height: "clamp(30px, 3.04vw, 56px)",
    borderRadius: "50%",
    border: "1.5px solid rgba(0,0,0,0.18)",
    background: "rgba(255,255,255,0.28)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "rgba(0,0,0,0.55)",
    padding: 0,
    outline: "none",
    flexShrink: 0,
  },
  circleBtnActive: {
    background: "rgba(7,13,34,0.70)",
    borderColor: "rgba(0,0,0,0.0)",
    color: "rgba(255,255,255,0.90)",
  },

  // Avatar — Frame 1000004688: 106×106, radius=80, dark bg + colorful sphere gradient
  avatar: {
    width: "clamp(30px, 3.07vw, 56px)",
    height: "clamp(30px, 3.07vw, 56px)",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7B8FE8 0%, #B45FE8 38%, #E86F9E 68%, #F09060 100%)",
    boxShadow: "0 3px 16px rgba(0,0,0,0.28)",
    flexShrink: 0,
    cursor: "pointer",
  },
};
