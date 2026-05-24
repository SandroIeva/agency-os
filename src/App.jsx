import { useState, useRef, useEffect, useCallback, useMemo, Component } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabase";
import { buildSystemPrompt } from "./systemPrompt";
import { getTranslation } from "./translations";

// Error Boundary to prevent black screen — shows error info in production
export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary]", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: "#111117", color: "#ff6b6b", padding: 40, fontFamily: "monospace", height: "100vh", overflow: "auto" }}>
          <h2 style={{ color: "#fff", marginBottom: 16 }}>Agency OS — Runtime Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}>
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 24, padding: "10px 20px", background: "#333", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const COLORS = {
  bg: "#111117",
  text: "#ffffffCC",
  textDim: "#ffffff40",
  accent: "#ffffff",
  ringInactive: "#ffffff18",
  ringActive: "#ffffff",
};

const MENU_ITEMS_DEF = [
  { id: "chat", labelKey: "menu.chat", sub: [] },
  { id: "plan", labelKey: "menu.plan", sub: [{ id: "kanban", labelKey: "sub.kanban" }, { id: "timeline", labelKey: "sub.timeline" }, { id: "tasks", labelKey: "sub.tasks" }, { id: "calendar", labelKey: "sub.calendar" }] },
  { id: "brand", labelKey: "menu.brand", sub: [{ id: "assets", labelKey: "sub.assets" }, { id: "identity", labelKey: "sub.identity" }, { id: "knowledge", labelKey: "sub.intelligence" }, { id: "personas", labelKey: "sub.personas" }, { id: "competitor", labelKey: "sub.analyze" }, { id: "guidelines", labelKey: "sub.guidelines" }] },
  { id: "docs", labelKey: "menu.projects", sub: [] },
  { id: "files", labelKey: "menu.files", sub: [{ id: "images", labelKey: "sub.images" }, { id: "videos", labelKey: "sub.videos" }, { id: "all", labelKey: "sub.docs" }, { id: "fonts", labelKey: "sub.fonts" }, { id: "links", labelKey: "sub.links" }] },
  { id: "agents", labelKey: "menu.agents", sub: [{ id: "dev", labelKey: "sub.dev" }, { id: "design", labelKey: "sub.design" }, { id: "strategy", labelKey: "sub.strategy" }, { id: "finance", labelKey: "sub.finance" }, { id: "marketing", labelKey: "sub.marketing" }, { id: "sales", labelKey: "sub.sales" }] },
];

const PLUS_MENU_ITEMS_DEF = [
  { id: "create", labelKey: "plus.create", sub: [{ id: "project", labelKey: "plus.project" }, { id: "brief", labelKey: "plus.brief" }, { id: "document", labelKey: "plus.document" }] },
  { id: "task", labelKey: "plus.task", sub: [{ id: "todo", labelKey: "plus.todo" }, { id: "reminder", labelKey: "plus.reminder" }, { id: "note", labelKey: "plus.note" }] },
  { id: "ideate", labelKey: "plus.ideate", sub: [{ id: "brainstorm", labelKey: "plus.brainstorm" }, { id: "moodboard", labelKey: "plus.moodboard" }, { id: "concept", labelKey: "plus.concept" }] },
];

const FONT = "'Geist', -apple-system, sans-serif";
const VAPID_PUBLIC_KEY = "BJJ_TXEs7qnwTKLnYO5_pvuuzr6oB59d4xpSCssTZCkfujAaQYlCwxptfnUPXxhSnikKcG4rPH1FuU4CTYh4gvg";

// OS visual slots — user-customizable icons (key → metadata)
const OS_VISUAL_SLOTS = [
  { key: "calendar_event", label: "Kalender-Termin", description: "Symbol für normale Calendar-Events", defaultEmoji: "📅", defaultBg: "#4A6FA5" },
  { key: "calendar_meet", label: "Google Meet", description: "Symbol für Meet/Video-Termine", defaultEmoji: "📹", defaultBg: "#2D7A6A" },
  { key: "reminder", label: "Erinnerung", description: "Symbol für Reminder", defaultEmoji: "⏰", defaultBg: "#D4A85A" },
  { key: "task_high", label: "Task — High Priority", description: "Symbol für Tasks mit hoher Priorität", defaultEmoji: "⚡", defaultBg: "#C4624A" },
  { key: "task_default", label: "Task — Standard", description: "Symbol für Standard-Tasks ohne Logo", defaultEmoji: "◎", defaultBg: "#5A7AB5" },
  { key: "note", label: "Notiz", description: "Symbol für Notizen", defaultEmoji: "📝", defaultBg: "#7E6FB5" },
  { key: "chat_message", label: "Chat-Nachricht", description: "Symbol für Chat-Notifications", defaultEmoji: "💬", defaultBg: "#5BA889" },
];

// Curated background color palette for OS visual slots
const OS_VISUAL_BG_PALETTE = [
  "#4A6FA5", "#2D7A6A", "#D4A85A", "#C4624A", "#5A7AB5", "#7E6FB5",
  "#5BA889", "#D67885", "#7A9560", "#C68460", "#7A7570", "#1a1a2e",
];

const EMOJI_GROUPS = {
  smileys: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","🫨","🫠","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"],
  gestures: ["👋","🤚","✋","🖖","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","🫵","🫱","🫲","🫳","🫴","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦","💋"],
  hearts: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💖","💗","💓","💞","💕","💟","💘","💝","💌","💋"],
  objects: ["🎉","🎊","✨","⭐","🌟","💫","💥","🔥","☀️","🌈","☁️","⚡","❄️","💧","💦","☕","🍕","🍔","🍟","🌮","🍿","🍰","🎂","🍩","🍪","🍫","🍦","🍺","🍷","🥂","🍾","🎁","🎈","🎀","🎵","🎶","💡","🔔","📌","📍","✏️","📝","📎","🔗","✅","❌","⚠️","ℹ️","💯","🆗","🆕","🚀","⏰","📅","💰"],
};

const smoothSpring = { type: "spring", stiffness: 120, damping: 20, mass: 0.8 };
const softSpring = { type: "spring", stiffness: 80, damping: 18, mass: 1 };
const gentleTween = { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] };

// Sound engine using Web Audio API
function createSoundEngine() {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  const playTone = (freq, duration, vol = 0.06, type = "sine", detune = 0) => {
    try {
      const c = getCtx();
      if (c.state === "suspended") c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 3000;
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(vol, c.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration);
    } catch (e) { /* silently fail */ }
  };

  return {
    menuOpen() {
      playTone(392, 0.18, 0.05, "sine");
      setTimeout(() => playTone(523, 0.14, 0.045, "sine"), 70);
      setTimeout(() => playTone(784, 0.1, 0.035, "sine"), 140);
    },
    menuClose() {
      playTone(784, 0.08, 0.03, "sine");
      setTimeout(() => playTone(523, 0.12, 0.035, "sine"), 60);
      setTimeout(() => playTone(392, 0.16, 0.03, "sine"), 120);
    },
    scroll() {
      playTone(520 + Math.random() * 80, 0.08, 0.025, "sine");
    },
    subOpen() {
      playTone(440, 0.12, 0.04, "sine");
      setTimeout(() => playTone(660, 0.1, 0.03, "sine"), 40);
      setTimeout(() => playTone(880, 0.08, 0.025, "sine"), 80);
    },
    subSelect() {
      playTone(880, 0.08, 0.04, "sine");
      setTimeout(() => playTone(1100, 0.12, 0.05, "sine", 5), 50);
    },
    hover() {
      playTone(1200, 0.05, 0.015, "sine");
    },
  };
}

const sounds = createSoundEngine();

function DotGrid({ darkMode = true }) {
  const dots = [];
  for (let r = 0; r < 28; r++)
    for (let c = 0; c < 42; c++)
      dots.push(<circle key={`${r}-${c}`} cx={c * 32 + 16} cy={r * 32 + 16} r={1.2} fill={darkMode ? "#ffffff" : "#000000"} opacity={0.06} />);
  return <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>{dots}</svg>;
}

function AnimatedBlob() {
  return (
    <motion.div
      animate={{
        scale: [1, 1.08, 0.95, 1.04, 1],
        x: [0, 12, -8, 5, 0],
        y: [0, -8, 6, -4, 0],
        rotate: [0, 8, -5, 3, 0],
      }}
      transition={{
        duration: 12,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      }}
      style={{
        position: "absolute", bottom: -140, right: -140, width: 420, height: 320,
        borderRadius: "50%", filter: "blur(80px)", opacity: 0.22, pointerEvents: "none",
        background: "conic-gradient(from 180deg, #00B894, #6C5CE7, #E84393, #00B894)",
      }}
    />
  );
}

function SegmentedRing({ count, activeIndex, radius = 95, stroke = 2, gap = 5, darkMode = true }) {
  const cx = radius + stroke + 4;
  const cy = radius + stroke + 4;
  const size = (radius + stroke + 4) * 2;
  const circumference = 2 * Math.PI * radius;
  const gapAngle = (gap / circumference) * 360;
  const segAngle = (360 - gapAngle * count) / count;

  return (
    <svg width={size} height={size} style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)", pointerEvents: "none",
    }}>
      {Array.from({ length: count }).map((_, i) => {
        const startAngle = i * (segAngle + gapAngle) - 90;
        const endAngle = startAngle + segAngle;
        const isActive = i === activeIndex;
        const sr = (startAngle * Math.PI) / 180;
        const er = (endAngle * Math.PI) / 180;
        return (
          <motion.path key={i}
            d={`M ${cx + radius * Math.cos(sr)} ${cy + radius * Math.sin(sr)} A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(er)} ${cy + radius * Math.sin(er)}`}
            fill="none"
            strokeLinecap="round"
            animate={{
              stroke: isActive ? (darkMode ? "#ffffff" : "#555560") : (darkMode ? "#ffffff18" : "#44444820"),
              strokeWidth: isActive ? stroke + 1.5 : stroke,
            }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        );
      })}
    </svg>
  );
}

function AISphere({ darkMode = true }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.THREE) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready || !window.THREE) return;
    const T = window.THREE;

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      // Smooth noise for soft gradients
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f); // smoothstep
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        // Flowing noise pattern across the surface — larger scale = softer gradients
        vec3 pos = vPosition * 0.055;
        float t = time * 0.18;

        float n1 = fbm(pos + vec3(t, 0.0, 0.0));
        float n2 = fbm(pos + vec3(0.0, t * 0.7, t * 0.25));
        float n3 = fbm(pos * 0.9 + vec3(-t * 0.4, t * 0.35, 0.0));

        // Blend colors — adjusted per theme
        vec3 rose = vec3(${darkMode ? "0.82, 0.28, 0.48" : "0.95, 0.35, 0.55"});
        vec3 purple = vec3(${darkMode ? "0.52, 0.25, 0.72" : "0.62, 0.32, 0.88"});
        vec3 deepblue = vec3(${darkMode ? "0.2, 0.35, 0.78" : "0.3, 0.5, 0.95"});
        vec3 teal = vec3(${darkMode ? "0.3, 0.6, 0.68" : "0.2, 0.75, 0.82"});
        vec3 mauve = vec3(${darkMode ? "0.72, 0.3, 0.6" : "0.85, 0.38, 0.72"});

        vec3 color = mix(rose, purple, smoothstep(0.28, 0.72, n1));
        color = mix(color, deepblue, smoothstep(0.32, 0.68, n2));
        color = mix(color, teal, smoothstep(0.38, 0.72, n3));
        color = mix(color, mauve, smoothstep(0.5, 0.72, n1 * n2));

        // Soft 3D lighting
        vec3 lightDir = normalize(vec3(0.8, 1.2, 1.5));
        vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));

        float diffuse = max(dot(vNormal, lightDir), 0.0);
        diffuse = diffuse * 0.6 + 0.4; // soft fill, never fully dark

        // Soft specular — subtle, not shiny
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(vNormal, halfDir), 0.0), 24.0) * 0.2;

        // Rim glow
        float rim = 1.0 - max(dot(vNormal, viewDir), 0.0);
        rim = smoothstep(0.4, 1.0, rim) * 0.35;

        // Combine
        vec3 final = color * diffuse + vec3(1.0) * spec + color * rim * 0.5;

        // Slight vignette at edges for depth
        float edge = smoothstep(0.0, 0.5, dot(vNormal, viewDir));
        final *= ${darkMode ? "0.4" : "0.55"} + edge * ${darkMode ? "0.6" : "0.5"};

        gl_FragColor = vec4(final, 1.0);
      }
    `;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(35, 1, 1, 500);
    camera.position.set(0, 0, 38);

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(96, 96);
    renderer.setPixelRatio(2);
    renderer.setClearColor(0x000000, 0);
    el.innerHTML = "";
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "48px";
    renderer.domElement.style.height = "48px";

    const uniforms = { time: { value: 0.0 } };

    const geo = new T.SphereGeometry(12, 128, 128);
    const mat = new T.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });
    const mesh = new T.Mesh(geo, mat);
    scene.add(mesh);

    const start = Date.now();
    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      uniforms.time.value = (Date.now() - start) * 0.001;
      mesh.rotation.y += 0.008;
      mesh.rotation.x += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(raf); renderer.dispose(); };
  }, [ready, darkMode]);

  return (
    <motion.div
      ref={containerRef}
      whileHover={{ scale: 1.12 }}
      transition={smoothSpring}
      style={{ width: 48, height: 48, cursor: "pointer", borderRadius: "50%", overflow: "hidden" }}
    />
  );
}

// Real microphone-driven waveform equalizer
function WaveformEqualizer({ onAudioData, darkMode = true }) {
  const barsRef = useRef([]);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const barCount = 32;

  useEffect(() => {
    let active = true;

    const startMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateBars = () => {
          if (!active) return;
          analyser.getByteFrequencyData(dataArray);

          barsRef.current.forEach((bar, i) => {
            if (!bar) return;
            // Map bar index to frequency bin
            const binIndex = Math.floor((i / barCount) * dataArray.length);
            const value = dataArray[binIndex] || 0;
            const height = 6 + (value / 255) * 70;
            const opacity = 0.3 + (value / 255) * 0.7;
            bar.style.height = `${height}px`;
            bar.style.opacity = opacity;
          });

          rafRef.current = requestAnimationFrame(updateBars);
        };
        updateBars();
      } catch (e) {
        // Mic not available (artifact preview) — show lively simulated animation
        const idleAnim = () => {
          if (!active) return;
          const t = Date.now() * 0.004;
          barsRef.current.forEach((bar, i) => {
            if (!bar) return;
            const wave1 = Math.sin(t + i * 0.35) * 0.5 + 0.5;
            const wave2 = Math.sin(t * 1.8 + i * 0.2) * 0.5 + 0.5;
            const wave3 = Math.sin(t * 0.7 + i * 0.55) * 0.5 + 0.5;
            const combined = wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25;
            const h = 6 + combined * 55;
            bar.style.height = `${h}px`;
            bar.style.opacity = 0.3 + combined * 0.6;
          });
          rafRef.current = requestAnimationFrame(idleAnim);
        };
        idleAnim();
      }
    };
    startMic();

    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 80 }}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          ref={el => barsRef.current[i] = el}
          style={{
            width: 3, height: 8, borderRadius: 2,
            background: darkMode
              ? `linear-gradient(180deg, rgba(180,130,255,0.9), rgba(100,80,200,0.4))`
              : `linear-gradient(180deg, rgba(108,92,231,1), rgba(80,60,180,0.7))`,
            opacity: 0.3,
            transition: "height 0.06s ease-out, opacity 0.06s ease-out",
          }}
        />
      ))}
    </div>
  );
}

// AI Speaking Sphere — the sphere animates in the center while "responding"
function AISpeakingSphere({ darkMode = true }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.THREE) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready || !window.THREE) return;
    const T = window.THREE;

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vPosition;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1); p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                       mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                       mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 pos = vPosition * 0.055;
        float t = time * 0.18;
        float n1 = fbm(pos + vec3(t, 0.0, 0.0));
        float n2 = fbm(pos + vec3(0.0, t*0.7, t*0.25));
        float n3 = fbm(pos*0.9 + vec3(-t*0.4, t*0.35, 0.0));
        vec3 rose = vec3(${darkMode ? "0.82, 0.28, 0.48" : "0.95, 0.35, 0.55"});
        vec3 purple = vec3(${darkMode ? "0.52, 0.25, 0.72" : "0.62, 0.32, 0.88"});
        vec3 deepblue = vec3(${darkMode ? "0.2, 0.35, 0.78" : "0.3, 0.5, 0.95"});
        vec3 teal = vec3(${darkMode ? "0.3, 0.6, 0.68" : "0.2, 0.75, 0.82"});
        vec3 mauve = vec3(${darkMode ? "0.72, 0.3, 0.6" : "0.85, 0.38, 0.72"});
        vec3 color = mix(rose, purple, smoothstep(0.28, 0.72, n1));
        color = mix(color, deepblue, smoothstep(0.32, 0.68, n2));
        color = mix(color, teal, smoothstep(0.38, 0.72, n3));
        color = mix(color, mauve, smoothstep(0.5, 0.72, n1*n2));
        vec3 lightDir = normalize(vec3(0.8, 1.2, 1.5));
        vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
        float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.6 + 0.4;
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(vNormal, halfDir), 0.0), 24.0) * 0.2;
        float rim = smoothstep(0.4, 1.0, 1.0 - max(dot(vNormal, viewDir), 0.0)) * 0.35;
        vec3 final = color * diffuse + vec3(1.0) * spec + color * rim * 0.5;
        float edge = smoothstep(0.0, 0.5, dot(vNormal, viewDir));
        final *= ${darkMode ? "0.4" : "0.55"} + edge * ${darkMode ? "0.6" : "0.5"};
        gl_FragColor = vec4(final, 1.0);
      }
    `;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(35, 1, 1, 500);
    camera.position.set(0, 0, 38);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(300, 300);
    renderer.setPixelRatio(2);
    renderer.setClearColor(0x000000, 0);
    el.innerHTML = "";
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "200px";
    renderer.domElement.style.height = "200px";

    const uniforms = { time: { value: 0.0 } };
    const geo = new T.SphereGeometry(12, 128, 128);
    const mat = new T.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    const mesh = new T.Mesh(geo, mat);
    scene.add(mesh);

    const start = Date.now();
    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      uniforms.time.value = (Date.now() - start) * 0.001;
      mesh.rotation.y += 0.012;
      mesh.rotation.x += 0.004;
      renderer.render(scene, camera);
    };
    animate();
    return () => { cancelAnimationFrame(raf); renderer.dispose(); };
  }, [ready, darkMode]);

  return <div ref={containerRef} style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden" }} />;
}

// Kanban board data
const priColors = { high: "#EF4444", medium: "#F59E0B", low: "#999999" };
const ASSIGNEE_COLORS = ["#8B7AFF", "#E84393", "#00B894", "#F59E0B", "#5B8DEF", "#E88D67", "#6C5CE7", "#FD79A8"];

// Hardcoded fallback columns — always visible even if Supabase fails
const DEFAULT_COLUMNS = [
  { id: "col-todo", key: "todo", labelKey: "kanban.todo", color: "#8E94A3", position: 0 },
  { id: "col-progress", key: "progress", labelKey: "kanban.inProgress", color: "#F59E0B", position: 1 },
  { id: "col-review", key: "review", labelKey: "kanban.review", color: "#8B7AFF", position: 2 },
  { id: "col-done", key: "done", labelKey: "kanban.done", color: "#00B894", position: 3 },
];

function KanbanBoard({ onBack, session, theme, darkMode, t, openTaskId, triggerNewTask, onNewTaskTriggered, userOrg, orgMembers, createNotification, myProjectNames = new Set() }) {
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState({});
  const [filter, setFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", column_key: "todo", project_name: "", assignee_id: null, due_date: "" });
  const [dragOverCol, setDragOverCol] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [taskComments, setTaskComments] = useState([]);
  const [taskAttachments, setTaskAttachments] = useState([]);
  const [taskChecklist, setTaskChecklist] = useState([]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [showAttachInput, setShowAttachInput] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [showProjectEditor, setShowProjectEditor] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm, setProjectForm] = useState({ name: "", logo_url: "", color: "#8B7AFF" });
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const projectLogoInputRef = useRef(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const descRef = useRef(null);
  const dragItem = useRef(null);

  // Always use these columns
  const colEntries = DEFAULT_COLUMNS;

  // Ensure team_member profile exists, then load all data
  useEffect(() => {
    if (!session?.user) return;
    const init = async () => {
      setLoading(true);
      const u = session.user;

      // 1. Ensure profile exists
      const { data: existing } = await supabase.from("team_members").select("id").eq("user_id", u.id).single();
      if (!existing) {
        const name = u.user_metadata?.full_name || u.email?.split("@")[0] || "User";
        await supabase.from("team_members").insert({
          user_id: u.id,
          display_name: name,
          avatar_url: u.user_metadata?.avatar_url || null,
          initials: name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
          avatar_color: ASSIGNEE_COLORS[Math.floor(Math.random() * ASSIGNEE_COLORS.length)],
        });
      }

      // 2. Load tasks — org-scoped if user has an org, otherwise personal
      const orgId = userOrg?.id;
      const taskQuery = orgId
        ? supabase.from("tasks").select("*, creator:profiles!tasks_creator_profile_fkey(display_name, avatar_url, initials), assignee:profiles!tasks_assignee_profile_fkey(display_name, avatar_url, initials)").eq("org_id", orgId).order("position")
        : supabase.from("tasks").select("*, creator:profiles!tasks_creator_profile_fkey(display_name, avatar_url, initials), assignee:profiles!tasks_assignee_profile_fkey(display_name, avatar_url, initials)").eq("creator_id", u.id).order("position");
      const { data: taskData, error: taskError } = await taskQuery;
      if (taskError) {
        // Fallback without joins if FK doesn't exist
        const fallbackQuery = orgId
          ? supabase.from("tasks").select("*").eq("org_id", orgId).order("position")
          : supabase.from("tasks").select("*").eq("creator_id", u.id).order("position");
        const { data: fb } = await fallbackQuery;
        setTasks(fb || []);
      } else {
        setTasks(taskData || []);
      }

      // 3. Build team members map — load all org profiles from DB
      const memberMap = {};
      if (orgId) {
        const { data: allMembers } = await supabase
          .from("org_members")
          .select("user_id, role, profiles:profiles!org_members_profile_fkey(display_name, avatar_url, email, initials)")
          .eq("org_id", orgId);
        (allMembers || []).forEach(m => {
          if (m.profiles) {
            memberMap[m.user_id] = {
              user_id: m.user_id,
              display_name: m.profiles.display_name,
              avatar_url: m.profiles.avatar_url,
              initials: m.profiles.initials,
              email: m.profiles.email,
              avatar_color: ASSIGNEE_COLORS[Math.abs((m.user_id || "").charCodeAt(0)) % ASSIGNEE_COLORS.length],
            };
          }
        });
      }
      // Always ensure current user is in map
      if (!memberMap[u.id]) {
        const uName = u.user_metadata?.full_name || u.email?.split("@")[0] || "User";
        memberMap[u.id] = {
          user_id: u.id, display_name: uName,
          avatar_url: u.user_metadata?.avatar_url || null,
          initials: uName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
          avatar_color: ASSIGNEE_COLORS[0],
        };
      }
      setTeamMembers(memberMap);

      // 4. Load projects — and auto-create entries for project_names that exist on tasks but not in projects table
      if (orgId) {
        const { data: prj } = await supabase.from("projects").select("*").eq("org_id", orgId).order("created_at");
        const existingProjects = prj || [];
        const existingNames = new Set(existingProjects.map(p => p.name));
        // Find project_names from tasks that don't have a projects row yet
        const allTasks = taskData || [];
        const missingNames = [...new Set(allTasks.map(t => t.project_name).filter(n => n && !existingNames.has(n)))];
        if (missingNames.length > 0) {
          // Use upsert with onConflict to prevent duplicates
          const inserts = missingNames.map(name => ({ name, org_id: orgId, owner_id: u.id, color: "#8B7AFF" }));
          const { data: created } = await supabase.from("projects").upsert(inserts, { onConflict: "name,org_id", ignoreDuplicates: true }).select();
          // Re-fetch to get clean list
          const { data: freshProjects } = await supabase.from("projects").select("*").eq("org_id", orgId).order("created_at");
          setProjects(freshProjects || []);
        } else {
          setProjects(existingProjects);
        }
      }

      setLoading(false);
    };
    init();
  }, [session, userOrg?.id, orgMembers]);

  // Auto-open task edit form when navigating from startview card
  useEffect(() => {
    if (!openTaskId || loading || tasks.length === 0) return;
    const task = tasks.find(tk => tk.id === openTaskId);
    if (task) {
      setEditingTask(task);
      setEditingTitle(false);
      setEditingDesc(false);
      setTaskForm({
        title: task.title || "",
        description: task.description || "",
        priority: task.priority || "medium",
        column_key: task.column_key || "todo",
        project_name: task.project_name || "",
        assignee_id: task.assignee_id || session?.user?.id || null,
        due_date: task.due_date ? task.due_date.slice(0, 10) : "",
      });
      setShowNewTask(true);
      loadTaskExtras(task.id);
    }
  }, [openTaskId, loading, tasks]);

  // Auto-open new task form when triggered from To-Do submenu
  useEffect(() => {
    if (triggerNewTask && !loading) {
      openNewTask("todo");
    }
  }, [triggerNewTask, loading]);

  // Load comments + attachments for a task
  const loadTaskExtras = async (taskId) => {
    const [{ data: cmts }, { data: atts }, { data: chk }] = await Promise.all([
      supabase.from("task_comments").select("*, profile:profiles!task_comments_user_id_fkey_profiles(display_name, avatar_url, initials)").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_checklist_items").select("*").eq("task_id", taskId).order("position", { ascending: true }),
    ]);
    setTaskComments(cmts || []);
    setTaskAttachments(atts || []);
    setTaskChecklist(chk || []);
  };

  const addComment = async () => {
    if (!commentText.trim() || !editingTask) return;
    const { data, error } = await supabase.from("task_comments").insert({
      task_id: editingTask.id, user_id: session.user.id, text: commentText.trim(),
    }).select("*, profile:profiles!task_comments_user_id_fkey_profiles(display_name, avatar_url, initials)").single();
    if (data) {
      setTaskComments(prev => [...prev, data]);
      // Notify task assignee about the comment (if it's someone else)
      if (editingTask.assignee_id && editingTask.assignee_id !== session.user.id) {
        const myName = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Jemand";
        createNotification?.({
          userId: editingTask.assignee_id,
          type: "comment_added",
          title: "Neuer Kommentar",
          body: `${myName} hat "${editingTask.title}" kommentiert`,
          metadata: { task_id: editingTask.id, comment_id: data.id },
        });
      }
    }
    setCommentText("");
  };

  const deleteComment = async (id) => {
    setTaskComments(prev => prev.filter(c => c.id !== id));
    await supabase.from("task_comments").delete().eq("id", id);
  };

  const addAttachment = async () => {
    if (!attachmentUrl.trim() || !editingTask) return;
    const name = attachmentName.trim() || new URL(attachmentUrl.trim()).hostname;
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(attachmentUrl.trim());
    const { data } = await supabase.from("task_attachments").insert({
      task_id: editingTask.id, user_id: session.user.id,
      name, url: attachmentUrl.trim(), type: isImage ? "image" : "link",
    }).select().single();
    if (data) setTaskAttachments(prev => [...prev, data]);
    setAttachmentUrl(""); setAttachmentName(""); setShowAttachInput(false);
  };

  const deleteAttachment = async (id) => {
    setTaskAttachments(prev => prev.filter(a => a.id !== id));
    await supabase.from("task_attachments").delete().eq("id", id);
  };

  // Checklist CRUD
  const addChecklistItem = async () => {
    const text = newChecklistText.trim();
    if (!text) return;
    // New-task mode: no editingTask yet — store locally; createTask will bulk-insert
    if (!editingTask) {
      setTaskChecklist(prev => [...prev, { _localId: Date.now() + Math.random(), text, checked: false }]);
      setNewChecklistText("");
      return;
    }
    // Edit-task mode: persist immediately
    const pos = taskChecklist.length;
    const { data } = await supabase.from("task_checklist_items").insert({
      task_id: editingTask.id, text, position: pos,
    }).select().single();
    if (data) setTaskChecklist(prev => [...prev, data]);
    setNewChecklistText("");
  };

  const toggleChecklistItem = async (id, currentVal) => {
    setTaskChecklist(prev => prev.map(i => i.id === id ? { ...i, checked: !currentVal } : i));
    await supabase.from("task_checklist_items").update({ checked: !currentVal }).eq("id", id);
  };

  const updateChecklistItem = async (id, newText) => {
    if (!newText.trim()) return;
    setTaskChecklist(prev => prev.map(i => i.id === id ? { ...i, text: newText.trim() } : i));
    await supabase.from("task_checklist_items").update({ text: newText.trim() }).eq("id", id);
    setEditingChecklistId(null);
    setEditingChecklistText("");
  };

  const deleteChecklistItem = async (id) => {
    setTaskChecklist(prev => prev.filter(i => i.id !== id));
    await supabase.from("task_checklist_items").delete().eq("id", id);
  };

  // Speech-to-text dictation for description
  const startDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Spracherkennung wird in diesem Browser nicht unterstützt. Bitte verwende Chrome."); return; }
    if (isRecording) { stopDictation(); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = taskForm.description || "";
    let needsSpace = finalTranscript.length > 0 && !finalTranscript.endsWith(" ") && !finalTranscript.endsWith("\n");
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Auto-capitalize first letter of sentence
          let cleaned = t.trim();
          if (cleaned.length > 0) {
            const prevChar = finalTranscript.trim().slice(-1);
            if (!prevChar || prevChar === "." || prevChar === "!" || prevChar === "?" || prevChar === "\n") {
              cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }
          }
          // Add period at end if no punctuation
          const lastChar = cleaned.slice(-1);
          if (cleaned.length > 0 && !/[.!?,;:\n]/.test(lastChar)) cleaned += ".";
          finalTranscript += (needsSpace ? " " : "") + cleaned;
          needsSpace = true;
          setTaskForm(p => ({ ...p, description: finalTranscript }));
        } else {
          interim = t;
        }
      }
    };
    recognition.onerror = (e) => { if (e.error !== "no-speech") console.error("Speech error:", e.error); };
    recognition.onend = () => { setIsRecording(false); recognitionRef.current = null; };
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };
  const stopDictation = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsRecording(false);
  };

  // Cleanup recognition on unmount
  useEffect(() => { return () => { if (recognitionRef.current) recognitionRef.current.stop(); }; }, []);

  // Merge DB projects + task-derived names for filter, restricted to projects
  // the user is a member of.
  const projectNames = [...new Set([
    ...projects.filter(p => myProjectNames.has(p.name)).map(p => p.name),
    ...tasks.map(t => t.project_name).filter(name => name && myProjectNames.has(name)),
  ])];
  // Visibility: strictly by project membership.
  // - Tasks without a project (private) are visible to everyone
  // - Tasks with a project are visible only to project members
  const visibleTasks = tasks.filter(t => !t.project_name || myProjectNames.has(t.project_name));
  const filtered = visibleTasks.filter(t => {
    if (filter !== "all" && t.project_name !== filter) return false;
    if (memberFilter !== "all" && t.assignee_id !== memberFilter) return false;
    return true;
  });

  // Get project logo by name
  const getProjectLogo = (name) => projects.find(p => p.name === name)?.logo_url || null;

  // Upload project logo to Supabase Storage
  const handleProjectLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);

    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = `${userOrg?.id || session.user.id}/${fileName}`;
      const { error } = await supabase.storage.from("project-logos").upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("project-logos").getPublicUrl(filePath);
      setProjectForm(p => ({ ...p, logo_url: urlData.publicUrl }));
    } catch (err) {
      console.error("Logo upload failed:", err);
    } finally {
      setLogoUploading(false);
    }
  };

  // Remove uploaded logo
  const removeProjectLogo = () => {
    setProjectForm(p => ({ ...p, logo_url: "" }));
    setLogoPreview(null);
    if (projectLogoInputRef.current) projectLogoInputRef.current.value = "";
  };

  // Project CRUD
  const saveProject = async () => {
    if (!projectForm.name.trim()) return;
    if (editingProject) {
      const updates = { name: projectForm.name.trim(), logo_url: projectForm.logo_url || null, color: projectForm.color };
      await supabase.from("projects").update(updates).eq("id", editingProject.id);
      if (editingProject.name !== projectForm.name.trim()) {
        await supabase.from("tasks").update({ project_name: projectForm.name.trim() }).eq("project_name", editingProject.name).eq("org_id", userOrg?.id);
        setTasks(prev => prev.map(t => t.project_name === editingProject.name ? { ...t, project_name: projectForm.name.trim() } : t));
      }
      setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...updates } : p));
    } else {
      const { data } = await supabase.from("projects").insert({
        name: projectForm.name.trim(), logo_url: projectForm.logo_url || null,
        color: projectForm.color, owner_id: session.user.id, org_id: userOrg?.id || null,
      }).select().single();
      if (data) setProjects(prev => [...prev, data]);
    }
    setEditingProject(null);
    setProjectForm({ name: "", logo_url: "", color: "#8B7AFF" });
    setLogoPreview(null);
    setShowProjectEditor(false);
  };

  const deleteProject = async (proj) => {
    await supabase.from("projects").delete().eq("id", proj.id);
    setProjects(prev => prev.filter(p => p.id !== proj.id));
  };

  // Move task to another column
  const moveTask = async (taskId, newColumnKey) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_key: newColumnKey } : t));
    await supabase.from("tasks").update({ column_key: newColumnKey, updated_at: new Date().toISOString() }).eq("id", taskId);
  };

  // Create new task
  const createTask = async () => {
    if (!taskForm.title.trim()) return;
    const taskData = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      priority: taskForm.priority,
      column_key: taskForm.column_key,
      project_name: taskForm.project_name || null,
      creator_id: session.user.id,
      assignee_id: taskForm.assignee_id || session.user.id,
      due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
      position: tasks.filter(t => t.column_key === taskForm.column_key).length,
      org_id: userOrg?.id || null,
    };
    const { data, error } = await supabase.from("tasks").insert(taskData).select().single();
    console.log("Task create result:", { data, error, taskData });
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    if (data) {
      setTasks(prev => [...prev, data]);
      // Save pending checklist items if any
      if (taskChecklist.length > 0) {
        const items = taskChecklist.map((item, idx) => ({
          task_id: data.id, text: item.text, checked: item.checked || false, position: idx,
        }));
        await supabase.from("task_checklist_items").insert(items);
      }
      // Notify assignee if task is assigned to someone else
      if (taskData.assignee_id && taskData.assignee_id !== session.user.id) {
        const myName = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Jemand";
        createNotification?.({
          userId: taskData.assignee_id,
          type: "task_assigned",
          title: "Neue Aufgabe zugewiesen",
          body: `${myName} hat dir "${data.title}" zugewiesen`,
          metadata: { task_id: data.id },
        });
      }
      resetForm();
    }
  };

  // Update existing task
  const updateTask = async () => {
    if (!editingTask || !taskForm.title.trim()) return;
    const updates = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      priority: taskForm.priority,
      column_key: taskForm.column_key,
      project_name: taskForm.project_name || null,
      assignee_id: taskForm.assignee_id || session.user.id,
      due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updates } : t));
    await supabase.from("tasks").update(updates).eq("id", editingTask.id);
    // Notify if assignee changed to someone else
    if (updates.assignee_id && updates.assignee_id !== session.user.id && updates.assignee_id !== editingTask.assignee_id) {
      const myName = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Jemand";
      createNotification?.({
        userId: updates.assignee_id,
        type: "task_assigned",
        title: "Aufgabe zugewiesen",
        body: `${myName} hat dir "${taskForm.title}" zugewiesen`,
        metadata: { task_id: editingTask.id },
      });
    }
    resetForm();
  };

  // Delete task — shows custom confirm dialog
  const requestDelete = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    setConfirmDelete(task || { id: taskId, title: "Task" });
  };
  const confirmDeleteTask = async () => {
    if (!confirmDelete) return;
    setTasks(prev => prev.filter(t => t.id !== confirmDelete.id));
    await supabase.from("tasks").delete().eq("id", confirmDelete.id);
    if (editingTask?.id === confirmDelete.id) resetForm();
    setConfirmDelete(null);
  };

  const resetForm = () => {
    setShowNewTask(false);
    setEditingTask(null);
    setTaskForm({ title: "", description: "", priority: "medium", column_key: "todo", project_name: "", assignee_id: session?.user?.id || null, due_date: "" });
    setTaskComments([]); setTaskAttachments([]); setTaskChecklist([]); setCommentText(""); setAttachmentUrl(""); setAttachmentName(""); setShowAttachInput(false); setAssigneeDropdownOpen(false); setShowDatePicker(false);
    setEditingTitle(false); setEditingDesc(false); setNewChecklistText(""); setEditingChecklistId(null);
    stopDictation();
    // If opened via To-Do submenu, go back to dashboard on close
    if (triggerNewTask) { if (onNewTaskTriggered) onNewTaskTriggered(); onBack(); }
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setEditingTitle(false);
    setEditingDesc(false);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      column_key: task.column_key || "todo",
      project_name: task.project_name || "",
      assignee_id: task.assignee_id || session?.user?.id || null,
      due_date: task.due_date ? task.due_date.slice(0, 10) : "",
    });
    setShowNewTask(true);
    loadTaskExtras(task.id);
  };

  const openNewTask = (colKey) => {
    setEditingTask(null);
    setTaskForm({ title: "", description: "", priority: "medium", column_key: colKey || "todo", project_name: "", assignee_id: session?.user?.id || null, due_date: "" });
    setTaskComments([]); setTaskAttachments([]); setTaskChecklist([]);
    setShowNewTask(true);
  };

  // When triggered from To-Do submenu, only render the modal portals (no board UI)
  if (triggerNewTask) {
    return (<>
      {createPortal(<AnimatePresence>
        {showNewTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetForm}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 24,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 520, maxHeight: "85vh",
                background: darkMode ? "rgba(22, 22, 30, 0.97)" : "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(40px)", border: `1px solid ${theme.border}`,
                borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden",
              }}
            >
              {/* Reuse same form body — header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative" }}>
                    <select
                      value={taskForm.project_name}
                      onChange={e => setTaskForm(p => ({ ...p, project_name: e.target.value }))}
                      style={{
                        background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${theme.borderFaint}`, borderRadius: 8,
                        padding: "4px 26px 4px 8px", fontSize: 12, fontFamily: FONT,
                        color: taskForm.project_name ? theme.text : theme.textFaint, outline: "none",
                        appearance: "none", WebkitAppearance: "none", cursor: "pointer", maxWidth: 160,
                      }}
                    >
                      <option value="">Kein Projekt</option>
                      {projects.map(p => (<option key={p.id} value={p.name}>{p.name}</option>))}
                    </select>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <path d="M6 9l6 6 6-6" stroke={theme.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, fontFamily: FONT, fontWeight: 500, color: theme.textDim }}>{t("task.newTask")}</span>
                </div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={resetForm}
                  style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.textDim, fontSize: 16 }}
                >✕</motion.div>
              </div>
              {/* Body */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                  <input
                    value={taskForm.title}
                    onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                    placeholder={t("task.title")}
                    autoFocus
                    style={{
                      background: "transparent", border: "none", borderBottom: `1px solid ${theme.accent}40`,
                      padding: "4px 0", fontSize: 20, fontFamily: FONT, fontWeight: 600,
                      color: theme.text, outline: "none", caretColor: theme.accent, width: "100%",
                    }}
                  />
                  {/* Toolbar row */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {/* Assignee */}
                    <div style={{ position: "relative" }}>
                      <motion.div whileTap={{ scale: 0.95 }}
                        onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8,
                          border: `1px solid ${theme.borderFaint}`, cursor: "pointer", fontSize: 12, fontFamily: FONT, color: theme.textDim,
                          background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        }}
                      >
                        {(() => {
                          const sel = teamMembers[taskForm.assignee_id];
                          return sel ? (<>
                            {sel.avatar_url ? <img src={sel.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 16, height: 16, borderRadius: "50%" }} /> : <div style={{ width: 16, height: 16, borderRadius: "50%", background: (sel.avatar_color || "#8B7AFF") + "30", color: sel.avatar_color || "#8B7AFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontFamily: FONT, fontWeight: 600 }}>{sel.initials}</div>}
                            <span style={{ color: theme.text }}>{sel.display_name}</span>
                          </>) : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={theme.textDim} strokeWidth="1.5"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke={theme.textDim} strokeWidth="1.5" strokeLinecap="round"/></svg><span>Zuweisen</span></>;
                        })()}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke={theme.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </motion.div>
                      {assigneeDropdownOpen && (
                        <div style={{
                          position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10,
                          background: darkMode ? "rgba(30,30,40,0.98)" : "rgba(255,255,255,0.99)", border: `1px solid ${theme.border}`,
                          borderRadius: 12, padding: 6, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                        }}>
                          {Object.values(teamMembers).map(m => (
                            <div key={m.user_id}
                              onClick={() => { setTaskForm(prev => ({ ...prev, assignee_id: m.user_id })); setAssigneeDropdownOpen(false); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                background: taskForm.assignee_id === m.user_id ? theme.accent + "12" : "transparent",
                              }}
                              onMouseEnter={e => { if (taskForm.assignee_id !== m.user_id) e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"; }}
                              onMouseLeave={e => { if (taskForm.assignee_id !== m.user_id) e.currentTarget.style.background = "transparent"; }}
                            >
                              {m.avatar_url ? <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 22, height: 22, borderRadius: "50%" }} /> : <div style={{ width: 22, height: 22, borderRadius: "50%", background: (m.avatar_color || "#8B7AFF") + "30", color: m.avatar_color || "#8B7AFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: FONT, fontWeight: 600 }}>{m.initials}</div>}
                              <span style={{ fontSize: 13, fontFamily: FONT, color: theme.text, flex: 1 }}>{m.display_name}</span>
                              {taskForm.assignee_id === m.user_id && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Priority */}
                    {["high", "medium", "low"].map(p => (
                      <motion.div key={p} whileTap={{ scale: 0.95 }}
                        onClick={() => setTaskForm(prev => ({ ...prev, priority: p }))}
                        style={{
                          padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: FONT,
                          background: taskForm.priority === p ? priColors[p] + "18" : "transparent",
                          color: taskForm.priority === p ? priColors[p] : theme.textFaint,
                          border: `1px solid ${taskForm.priority === p ? priColors[p] + "35" : theme.borderFaint}`,
                        }}
                      >{p === "high" ? "Hoch" : p === "medium" ? "Mittel" : "Niedrig"}</motion.div>
                    ))}
                    {/* Date */}
                    <div style={{ position: "relative" }}>
                      <motion.div whileTap={{ scale: 0.95 }}
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8,
                          border: `1px solid ${taskForm.due_date ? "#F59E0B35" : theme.borderFaint}`, cursor: "pointer",
                          fontSize: 12, fontFamily: FONT,
                          color: taskForm.due_date ? "#F59E0B" : theme.textDim,
                          background: taskForm.due_date ? "#F59E0B12" : "transparent",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        {taskForm.due_date ? new Date(taskForm.due_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }) : "Frist setzen"}
                        {taskForm.due_date && (
                          <span onClick={e => { e.stopPropagation(); setTaskForm(prev => ({ ...prev, due_date: "" })); }} style={{ cursor: "pointer", marginLeft: 2, opacity: 0.6 }}>✕</span>
                        )}
                      </motion.div>
                      {showDatePicker && (
                        <div style={{
                          position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10,
                          background: darkMode ? "rgba(30,30,40,0.98)" : "rgba(255,255,255,0.99)", border: `1px solid ${theme.border}`,
                          borderRadius: 12, padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                        }}>
                          <input type="date"
                            value={taskForm.due_date}
                            onChange={e => { setTaskForm(prev => ({ ...prev, due_date: e.target.value })); setShowDatePicker(false); }}
                            style={{
                              background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`,
                              borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: FONT,
                              color: theme.text, outline: "none", colorScheme: darkMode ? "dark" : "light",
                            }}
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Description */}
                  <textarea
                    value={taskForm.description}
                    onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                    placeholder={t("task.description")}
                    style={{
                      background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.borderFaint}`,
                      borderRadius: 12, padding: "12px 14px", fontSize: 13, fontFamily: FONT,
                      color: theme.text, outline: "none", resize: "vertical", minHeight: 100,
                      caretColor: theme.accent, lineHeight: 1.6,
                    }}
                  />
                  {/* Checklist */}
                  <div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Checkliste {taskChecklist.length > 0 && (<span style={{ fontWeight: 400, color: theme.textFaint }}>({taskChecklist.filter(i => i.checked).length}/{taskChecklist.length})</span>)}
                    </div>
                    {taskChecklist.length > 0 && (
                      <div style={{ height: 3, borderRadius: 2, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", marginBottom: 8, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, background: "#00B894", width: `${(taskChecklist.filter(i => i.checked).length / taskChecklist.length) * 100}%`, transition: "width 0.3s ease" }} />
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
                      {taskChecklist.map((item, idx) => (
                        <div key={item._localId || idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8 }}
                          onMouseEnter={e => e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <div onClick={() => setTaskChecklist(prev => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it))}
                            style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: "pointer", border: item.checked ? "none" : `1.5px solid ${theme.textFaint}`, background: item.checked ? "#00B894" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}
                          >
                            {item.checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span style={{ flex: 1, fontSize: 13, fontFamily: FONT, color: item.checked ? theme.textFaint : theme.text, textDecoration: item.checked ? "line-through" : "none" }}>{item.text}</span>
                          <motion.div whileTap={{ scale: 0.85 }} onClick={() => setTaskChecklist(prev => prev.filter((_, i) => i !== idx))}
                            style={{ cursor: "pointer", padding: "0 2px", opacity: 0.4, fontSize: 13, color: theme.textDim }}
                          >✕</motion.div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `1.5px dashed ${theme.textFaint}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={theme.textFaint} strokeWidth="2" strokeLinecap="round"/></svg>
                      </div>
                      <input
                        value={newChecklistText}
                        onChange={e => setNewChecklistText(e.target.value)}
                        onKeyDown={e => {
                          // Ignore IME composition Enter (Asian/special keyboards)
                          if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const text = newChecklistText.trim();
                            if (!text) return;
                            setTaskChecklist(prev => [...prev, { _localId: Date.now() + Math.random(), text, checked: false }]);
                            setNewChecklistText("");
                          }
                        }}
                        placeholder="Neuer Punkt..."
                        style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid transparent", padding: "4px 0", fontSize: 13, fontFamily: FONT, color: theme.text, outline: "none", caretColor: theme.accent }}
                        onFocus={e => e.currentTarget.style.borderBottomColor = theme.accent + "40"}
                        onBlur={e => {
                          e.currentTarget.style.borderBottomColor = "transparent";
                          const text = newChecklistText.trim();
                          if (text) {
                            setTaskChecklist(prev => [...prev, { _localId: Date.now() + Math.random(), text, checked: false }]);
                            setNewChecklistText("");
                          }
                        }}
                      />
                    </div>
                  </div>
                  {/* Create button */}
                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4, paddingBottom: 8 }}>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={createTask}
                      style={{
                        padding: "10px 24px", borderRadius: 12, cursor: "pointer",
                        background: taskForm.title.trim() ? theme.accent + "25" : (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
                        border: `1px solid ${taskForm.title.trim() ? theme.accent + "40" : theme.borderFaint}`,
                        fontSize: 13, fontFamily: FONT, fontWeight: 500,
                        color: taskForm.title.trim() ? theme.accent : theme.textFaint,
                      }}
                    >{t("task.create")}</motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: 5 }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "24px 32px 0" }}>
        <motion.div
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onBack}
          style={{
            width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
            border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: theme.textDim, fontFamily: FONT,
          }}>←</motion.div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: theme.text, fontFamily: FONT, letterSpacing: -0.5 }}>Tasks</div>
          <div style={{ fontSize: 12, color: theme.textDim, fontFamily: FONT, marginTop: 2 }}>
            {loading ? "Loading..." : `${filtered.length} tasks across ${colEntries.length} columns`}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 32px", flexWrap: "wrap" }}>
        {["all", ...projectNames].map(p => {
          const logo = p !== "all" ? getProjectLogo(p) : null;
          return (
            <motion.button key={p} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setFilter(p)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, fontFamily: FONT, fontWeight: 400, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                background: filter === p ? (darkMode ? "#ffffff0F" : "rgba(0,0,0,0.06)") : "transparent",
                border: `1px solid ${filter === p ? theme.border : theme.borderFaint}`,
                color: filter === p ? theme.text : theme.textDim,
              }}
            >
              {logo && <img src={logo} alt="" style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover" }} />}
              {p === "all" ? "All projects" : p}
            </motion.button>
          );
        })}
        {/* Edit projects button */}
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
          onClick={() => { setShowProjectEditor(true); setEditingProject(null); setProjectForm({ name: "", logo_url: "", color: "#8B7AFF" }); setLogoPreview(null); }}
          style={{
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: theme.textDim,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </motion.div>

        {/* Member filter dropdown */}
        <div style={{ position: "relative" }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowMemberDropdown(prev => !prev)}
            style={{
              display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
              padding: "6px 14px 6px 10px", borderRadius: 20,
              background: memberFilter !== "all" ? (theme.accent + "15") : "transparent",
              border: `1px solid ${memberFilter !== "all" ? (theme.accent + "30") : theme.borderFaint}`,
              color: memberFilter !== "all" ? theme.accent : theme.textDim,
              fontSize: 12, fontFamily: FONT, fontWeight: 400,
            }}
          >
            {memberFilter !== "all" ? (() => {
              const m = (orgMembers || []).find(om => om.user_id === memberFilter);
              const name = m?.profiles?.display_name || "User";
              return (
                <>
                  {m?.profiles?.avatar_url ? (
                    <img src={m.profiles.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 16, height: 16, borderRadius: "50%" }} />
                  ) : (
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: theme.accent + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 600, color: theme.accent }}>
                      {(name).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {name}
                </>
              );
            })() : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Alle
              </>
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 1 }}>
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>

          {/* Dropdown */}
          <AnimatePresence>
            {showMemberDropdown && (
              <>
                <div onClick={() => setShowMemberDropdown(false)} style={{ position: "fixed", inset: 0, zIndex: 98 }} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 99,
                    minWidth: 200, maxHeight: 300, overflowY: "auto",
                    background: darkMode ? "rgba(22,22,30,0.98)" : "rgba(255,255,255,0.99)",
                    backdropFilter: "blur(40px)",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 14, padding: "6px",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
                  }}
                >
                  {/* All members option */}
                  <motion.div whileTap={{ scale: 0.97 }}
                    onClick={() => { setMemberFilter("all"); setShowMemberDropdown(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                      borderRadius: 10, cursor: "pointer",
                      background: memberFilter === "all" ? (darkMode ? "rgba(139,122,255,0.1)" : "rgba(139,122,255,0.08)") : "transparent",
                    }}
                    className={memberFilter === "all" ? "" : "hover-row"}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={theme.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="9" cy="7" r="4" stroke={theme.textDim} strokeWidth="1.8"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: memberFilter === "all" ? 600 : 400, color: theme.text }}>Alle Mitglieder</div>
                    </div>
                    {memberFilter === "all" && <div style={{ marginLeft: "auto", color: theme.accent, fontSize: 13 }}>✓</div>}
                  </motion.div>

                  {/* Divider */}
                  <div style={{ height: 1, background: theme.borderFaint, margin: "4px 8px" }} />

                  {/* Individual members */}
                  {(orgMembers || []).map(m => {
                    const p = m.profiles || {};
                    const name = p.display_name || "User";
                    const isActive = memberFilter === m.user_id;
                    const taskCount = tasks.filter(tk => tk.assignee_id === m.user_id).length;
                    return (
                      <motion.div key={m.user_id} whileTap={{ scale: 0.97 }}
                        onClick={() => { setMemberFilter(m.user_id); setShowMemberDropdown(false); }}
                        className={isActive ? "" : "hover-row"}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                          borderRadius: 10, cursor: "pointer",
                          background: isActive ? (darkMode ? "rgba(139,122,255,0.1)" : "rgba(139,122,255,0.08)") : "transparent",
                        }}
                      >
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 28, height: 28, borderRadius: "50%" }} />
                        ) : (
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 600, fontFamily: FONT, color: theme.textDim,
                          }}>{(p.initials || name.slice(0, 2)).toUpperCase()}</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: isActive ? 600 : 400, color: theme.text }}>{name}</div>
                          <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim }}>{taskCount} {taskCount === 1 ? "Task" : "Tasks"}</div>
                        </div>
                        {isActive && <div style={{ color: theme.accent, fontSize: 13 }}>✓</div>}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => openNewTask("todo")}
          style={{
            fontSize: 12, fontFamily: FONT, fontWeight: 500, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
            background: theme.accent + "15", border: `1px solid ${theme.accent}30`, color: theme.accent, marginLeft: "auto",
          }}
        >+ New task</motion.button>
      </div>

      {/* Columns — always visible */}
      <div style={{ display: "flex", gap: 14, padding: "0 32px 24px", flex: 1, overflow: "auto" }}>
        {colEntries.map(col => {
          const colTasks = filtered.filter(t => t.column_key === col.key);
          return (
            <div key={col.id}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverCol(null);
                if (dragItem.current) {
                  moveTask(dragItem.current, col.key);
                  dragItem.current = null;
                }
              }}
              style={{
                flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                background: dragOverCol === col.key ? (theme.accent + "0A") : "transparent",
                borderRadius: 16, transition: "background 0.2s",
                padding: dragOverCol === col.key ? "8px" : "0",
              }}>
              {/* Column Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "0 4px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color }} />
                <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textSub, fontWeight: 500 }}>{t(col.labelKey)}</span>
                <span style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint }}>{colTasks.length}</span>
                <motion.div
                  whileHover={{ scale: 1.15, color: theme.accent }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => openNewTask(col.key)}
                  style={{ marginLeft: "auto", cursor: "pointer", color: theme.textFaint, fontSize: 16, fontFamily: FONT, lineHeight: 1 }}
                >+</motion.div>
              </div>
              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 80, overflowY: "auto" }}>
                {loading ? (
                  <motion.div
                    animate={{ opacity: [0.15, 0.3, 0.15] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ height: 80, borderRadius: 14, background: theme.hoverBg }}
                  />
                ) : (
                  <>
                    <AnimatePresence>
                      {colTasks.map((task, i) => {
                        const member = teamMembers[task.assignee_id];
                        return (
                          <motion.div key={task.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0], delay: i * 0.03 }}
                            draggable
                            onDragStart={() => { dragItem.current = task.id; }}
                            onClick={() => openEditTask(task)}
                            style={{
                              background: darkMode ? "#1A1A24" : "#ffffff", border: `1px solid ${theme.borderFaint}`, borderRadius: 14,
                              padding: "14px 16px", cursor: "grab",
                            }}
                          >
                            {/* Top row: Creator avatar + name · date · project | priority + delete */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                                {(() => {
                                  const creator = task.creator || teamMembers[task.creator_id];
                                  return creator?.avatar_url ? (
                                    <img src={creator.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 16, height: 16, borderRadius: "50%", border: `1px solid ${theme.borderFaint}`, flexShrink: 0 }} />
                                  ) : (
                                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: theme.accent + "25", color: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontFamily: FONT, fontWeight: 600, flexShrink: 0 }}>{creator?.initials || "?"}</div>
                                  );
                                })()}
                                <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, whiteSpace: "nowrap" }}>
                                  {(task.creator?.display_name || teamMembers[task.creator_id]?.display_name || "Unknown")}
                                </span>
                                <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, opacity: 0.4 }}>·</span>
                                <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, whiteSpace: "nowrap" }}>
                                  {task.created_at ? new Date(task.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" }) + " " + new Date(task.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""}
                                </span>
                                <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, opacity: 0.4 }}>·</span>
                                <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.project_name || "General"}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                                {task.is_ai_task && <span style={{ fontSize: 9, fontFamily: FONT, fontWeight: 500, color: "#E84393", padding: "2px 6px", borderRadius: 4, background: "#E8439315", letterSpacing: 0.5 }}>AI</span>}
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: priColors[task.priority] }} />
                                <motion.div
                                  whileHover={{ scale: 1.2 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); requestDelete(task.id); }}
                                  style={{ cursor: "pointer", color: theme.textFaint, fontSize: 12, fontFamily: FONT, padding: "0 2px" }}
                                >✕</motion.div>
                              </div>
                            </div>
                            {/* Title + description */}
                            <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500, marginBottom: 4, lineHeight: 1.4 }}>{task.title}</div>
                            {task.description && <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, lineHeight: 1.5, marginBottom: 8 }}>{task.description}</div>}
                            {/* Bottom: Assignee + meta */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {(() => {
                                  const assignee = task.assignee || member;
                                  return assignee?.avatar_url ? (
                                    <img src={assignee.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${theme.borderFaint}` }} />
                                  ) : (
                                    <div style={{
                                      width: 22, height: 22, borderRadius: "50%", background: (assignee?.avatar_color || "#8B7AFF") + "25", color: assignee?.avatar_color || "#8B7AFF",
                                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: FONT, fontWeight: 600,
                                    }}>{assignee?.initials || "?"}</div>
                                  );
                                })()}
                                <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim }}>{(task.assignee?.display_name || member?.display_name || "")}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {task.time_tracked && <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint }}>⏱ {task.time_tracked}</span>}
                                {task.due_date && <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint }}>{new Date(task.due_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}</span>}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {colTasks.length === 0 && (
                      <div
                        onClick={() => openNewTask(col.key)}
                        style={{
                          flex: 1, border: `1px dashed ${dragOverCol === col.key ? theme.accent + "30" : theme.borderFaint}`,
                          borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontFamily: FONT, cursor: "pointer",
                          color: dragOverCol === col.key ? theme.accent + "60" : theme.textFaint,
                          minHeight: 80, transition: "all 0.2s",
                        }}
                      >
                        {dragOverCol === col.key ? "Hier ablegen" : "Drop here"}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New / Edit Task Modal — Portal to body so it covers everything */}
      {createPortal(<AnimatePresence>
        {showNewTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetForm}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 24,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: editingTask ? 860 : 520, maxHeight: "85vh",
                background: darkMode ? "rgba(22, 22, 30, 0.97)" : "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(40px)", border: `1px solid ${theme.border}`,
                borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden",
              }}
            >
              {/* Header bar with project selector */}
              {(() => { const isTaskOwner = !editingTask || editingTask.creator_id === session?.user?.id; return (<>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Project selector — compact, in header */}
                  {isTaskOwner ? (
                    <div style={{ position: "relative" }}>
                      <select
                        value={taskForm.project_name}
                        onChange={e => setTaskForm(p => ({ ...p, project_name: e.target.value }))}
                        style={{
                          background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                          border: `1px solid ${theme.borderFaint}`, borderRadius: 8,
                          padding: "4px 26px 4px 8px", fontSize: 12, fontFamily: FONT,
                          color: taskForm.project_name ? theme.text : theme.textFaint, outline: "none",
                          appearance: "none", WebkitAppearance: "none", cursor: "pointer",
                          maxWidth: 160,
                        }}
                      >
                        <option value="">Kein Projekt</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                        <path d="M6 9l6 6 6-6" stroke={theme.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ) : taskForm.project_name ? (
                    <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", padding: "4px 10px", borderRadius: 8 }}>
                      {taskForm.project_name}
                    </span>
                  ) : null}
                  <span style={{ fontSize: 13, fontFamily: FONT, fontWeight: 500, color: theme.textDim }}>
                    {editingTask ? t("task.editTask") : t("task.newTask")}
                  </span>
                  {editingTask && (
                    <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 6 }}>
                      {new Date(editingTask.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })} · {new Date(editingTask.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={resetForm}
                  style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.textDim, fontSize: 16 }}
                >✕</motion.div>
              </div>

              {/* Body: split layout for edit, single for new */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Left panel — main content */}
                <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Title — view mode for existing tasks, edit on click */}
                  {editingTask && !editingTitle ? (
                    <div
                      onClick={() => { if (isTaskOwner) setEditingTitle(true); }}
                      style={{
                        padding: "4px 0", fontSize: 20, fontFamily: FONT, fontWeight: 600,
                        color: theme.text, cursor: isTaskOwner ? "text" : "default", minHeight: 32,
                      }}
                    >{taskForm.title || <span style={{ color: theme.textFaint }}>{t("task.title")}</span>}</div>
                  ) : (
                    <input
                      value={taskForm.title}
                      onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                      placeholder={t("task.title")}
                      autoFocus
                      style={{
                        background: "transparent", border: "none", borderBottom: `1px solid ${theme.accent}40`,
                        padding: "4px 0", fontSize: 20, fontFamily: FONT, fontWeight: 600,
                        color: theme.text, outline: "none", caretColor: theme.accent, width: "100%",
                        transition: "border-color 0.2s",
                      }}
                      onBlur={() => { if (editingTask) setEditingTitle(false); }}
                    />
                  )}

                  {/* Toolbar row: labels, date, column, assignee chips */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {/* Assignee button */}
                    <div style={{ position: "relative" }}>
                      <motion.div whileTap={{ scale: 0.95 }}
                        onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8,
                          border: `1px solid ${theme.borderFaint}`, cursor: "pointer", fontSize: 12, fontFamily: FONT, color: theme.textDim,
                          background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        }}
                      >
                        {(() => {
                          const sel = teamMembers[taskForm.assignee_id];
                          return sel ? (<>
                            {sel.avatar_url ? <img src={sel.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 16, height: 16, borderRadius: "50%" }} /> : <div style={{ width: 16, height: 16, borderRadius: "50%", background: (sel.avatar_color || "#8B7AFF") + "30", color: sel.avatar_color || "#8B7AFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontFamily: FONT, fontWeight: 600 }}>{sel.initials}</div>}
                            <span style={{ color: theme.text }}>{sel.display_name}</span>
                          </>) : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={theme.textDim} strokeWidth="1.5"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke={theme.textDim} strokeWidth="1.5" strokeLinecap="round"/></svg><span>Zuweisen</span></>;
                        })()}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke={theme.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </motion.div>
                      {assigneeDropdownOpen && (
                        <div style={{
                          position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10,
                          background: darkMode ? "rgba(30,30,40,0.98)" : "rgba(255,255,255,0.99)", border: `1px solid ${theme.border}`,
                          borderRadius: 12, padding: 6, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                        }}>
                          {Object.values(teamMembers).map(m => (
                            <div key={m.user_id}
                              onClick={() => { setTaskForm(prev => ({ ...prev, assignee_id: m.user_id })); setAssigneeDropdownOpen(false); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                background: taskForm.assignee_id === m.user_id ? theme.accent + "12" : "transparent",
                              }}
                              onMouseEnter={e => { if (taskForm.assignee_id !== m.user_id) e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"; }}
                              onMouseLeave={e => { if (taskForm.assignee_id !== m.user_id) e.currentTarget.style.background = "transparent"; }}
                            >
                              {m.avatar_url ? <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 22, height: 22, borderRadius: "50%" }} /> : <div style={{ width: 22, height: 22, borderRadius: "50%", background: (m.avatar_color || "#8B7AFF") + "30", color: m.avatar_color || "#8B7AFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: FONT, fontWeight: 600 }}>{m.initials}</div>}
                              <span style={{ fontSize: 13, fontFamily: FONT, color: theme.text, flex: 1 }}>{m.display_name}</span>
                              {taskForm.assignee_id === m.user_id && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Priority dropdown-like */}
                    {["high", "medium", "low"].map(p => (
                      <motion.div key={p} whileTap={isTaskOwner ? { scale: 0.95 } : {}}
                        onClick={() => { if (isTaskOwner) setTaskForm(prev => ({ ...prev, priority: p })); }}
                        style={{
                          padding: "5px 10px", borderRadius: 8, cursor: isTaskOwner ? "pointer" : "default", fontSize: 11, fontFamily: FONT,
                          background: taskForm.priority === p ? priColors[p] + "18" : "transparent",
                          color: taskForm.priority === p ? priColors[p] : theme.textFaint,
                          border: `1px solid ${taskForm.priority === p ? priColors[p] + "35" : theme.borderFaint}`,
                          opacity: !isTaskOwner && taskForm.priority !== p ? 0.4 : 1,
                        }}
                      >{p === "high" ? "Hoch" : p === "medium" ? "Mittel" : "Niedrig"}</motion.div>
                    ))}

                    {/* Date chip */}
                    <div style={{ position: "relative" }}>
                      <motion.div whileTap={isTaskOwner ? { scale: 0.95 } : {}}
                        onClick={() => { if (isTaskOwner) setShowDatePicker(!showDatePicker); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8,
                          border: `1px solid ${taskForm.due_date ? "#F59E0B35" : theme.borderFaint}`, cursor: isTaskOwner ? "pointer" : "default",
                          fontSize: 12, fontFamily: FONT,
                          color: taskForm.due_date ? "#F59E0B" : theme.textDim,
                          background: taskForm.due_date ? "#F59E0B12" : "transparent",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        {taskForm.due_date ? new Date(taskForm.due_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }) : "Frist setzen"}
                        {taskForm.due_date && (
                          <span onClick={e => { e.stopPropagation(); setTaskForm(prev => ({ ...prev, due_date: "" })); }} style={{ cursor: "pointer", marginLeft: 2, opacity: 0.6 }}>✕</span>
                        )}
                      </motion.div>
                      {showDatePicker && (
                        <div style={{
                          position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10,
                          background: darkMode ? "rgba(30,30,40,0.98)" : "rgba(255,255,255,0.99)", border: `1px solid ${theme.border}`,
                          borderRadius: 12, padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                        }}>
                          <input type="date"
                            value={taskForm.due_date}
                            onChange={e => { setTaskForm(prev => ({ ...prev, due_date: e.target.value })); setShowDatePicker(false); }}
                            style={{
                              background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`,
                              borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: FONT,
                              color: theme.text, outline: "none", caretColor: theme.accent,
                              colorScheme: darkMode ? "dark" : "light",
                            }}
                            autoFocus
                          />
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Column selector — separate row */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {colEntries.map(c => {
                      const active = taskForm.column_key === c.key;
                      return (
                        <motion.div key={c.key} whileTap={isTaskOwner ? { scale: 0.95 } : {}}
                          onClick={() => { if (isTaskOwner) setTaskForm(prev => ({ ...prev, column_key: c.key })); }}
                          style={{
                            padding: "5px 10px", borderRadius: 8, cursor: isTaskOwner ? "pointer" : "default", fontSize: 11, fontFamily: FONT,
                            background: active ? c.color + "1F" : "transparent",
                            color: active ? c.color : theme.textFaint,
                            border: `1px solid ${active ? c.color + "55" : theme.borderFaint}`,
                            opacity: !isTaskOwner && !active ? 0.4 : 1,
                            transition: "background 0.15s, color 0.15s, border-color 0.15s",
                          }}
                        >{t(c.labelKey)}</motion.div>
                      );
                    })}
                  </div>

                  {/* Description */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        Beschreibung
                      </span>
                      {isTaskOwner && (
                        <motion.div
                          whileTap={{ scale: 0.9 }}
                          onClick={startDictation}
                          style={{
                            display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                            color: isRecording ? "#EF4444" : theme.accent, fontSize: 11, fontFamily: FONT,
                          }}
                        >
                          {isRecording ? (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" fill="#EF4444"/></svg> Stopp</>
                          ) : (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 17v4M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Diktieren</>
                          )}
                        </motion.div>
                      )}
                    </div>
                    <div style={{ position: "relative" }}>
                      <textarea
                        ref={descRef}
                        value={taskForm.description}
                        onChange={e => { if (isTaskOwner) setTaskForm(p => ({ ...p, description: e.target.value })); }}
                        placeholder={isTaskOwner ? "Beschreibung hinzufügen..." : "Keine Beschreibung"}
                        readOnly={!isTaskOwner}
                        spellCheck={true}
                        style={{
                          background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                          border: `1px solid ${isRecording ? "#EF444450" : theme.borderFaint}`,
                          borderRadius: 12, padding: "12px 16px", fontSize: 13, fontFamily: FONT, lineHeight: 1.6,
                          color: theme.text, outline: "none", resize: "none", caretColor: theme.accent,
                          width: "100%", height: 120, cursor: isTaskOwner ? "text" : "default",
                          transition: "border-color 0.2s ease",
                        }}
                      />
                      {isRecording && (
                        <div style={{
                          position: "absolute", bottom: 10, right: 12, display: "flex", alignItems: "center", gap: 6,
                          fontSize: 10, fontFamily: FONT, color: "#EF4444",
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%", background: "#EF4444",
                            animation: "pulse 1.2s ease-in-out infinite",
                          }} />
                          Aufnahme läuft...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Checklist */}
                  <div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Checkliste {taskChecklist.length > 0 && (<span style={{ fontWeight: 400, color: theme.textFaint }}>({taskChecklist.filter(i => i.checked).length}/{taskChecklist.length})</span>)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    {taskChecklist.length > 0 && (
                      <div style={{ height: 3, borderRadius: 2, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", marginBottom: 8, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2, background: "#00B894",
                          width: `${(taskChecklist.filter(i => i.checked).length / taskChecklist.length) * 100}%`,
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                    )}
                    {/* Checklist items */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
                      {taskChecklist.map(item => (
                        <div key={item.id} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8,
                          background: "transparent",
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          {/* Checkbox */}
                          <div
                            onClick={() => toggleChecklistItem(item.id, item.checked)}
                            style={{
                              width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: "pointer",
                              border: item.checked ? "none" : `1.5px solid ${theme.textFaint}`,
                              background: item.checked ? "#00B894" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {item.checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          {/* Text — inline edit for owner */}
                          {editingChecklistId === item.id ? (
                            <input
                              value={editingChecklistText}
                              onChange={e => setEditingChecklistText(e.target.value)}
                              onBlur={() => updateChecklistItem(item.id, editingChecklistText)}
                              onKeyDown={e => { if (e.key === "Enter") updateChecklistItem(item.id, editingChecklistText); if (e.key === "Escape") { setEditingChecklistId(null); setEditingChecklistText(""); } }}
                              autoFocus
                              style={{
                                flex: 1, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.accent}40`,
                                borderRadius: 6, padding: "3px 8px", fontSize: 13, fontFamily: FONT,
                                color: theme.text, outline: "none", caretColor: theme.accent,
                              }}
                            />
                          ) : (
                            <span
                              onClick={() => { if (isTaskOwner) { setEditingChecklistId(item.id); setEditingChecklistText(item.text); } }}
                              style={{
                                flex: 1, fontSize: 13, fontFamily: FONT, cursor: isTaskOwner ? "text" : "default",
                                color: item.checked ? theme.textFaint : theme.text,
                                textDecoration: item.checked ? "line-through" : "none",
                                transition: "all 0.2s ease",
                              }}
                            >{item.text}</span>
                          )}
                          {/* Delete button — owner only */}
                          {isTaskOwner && (
                            <motion.div whileTap={{ scale: 0.85 }}
                              onClick={() => deleteChecklistItem(item.id)}
                              style={{ cursor: "pointer", padding: "0 2px", opacity: 0.4, fontSize: 13, color: theme.textDim }}
                            >✕</motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Add new item — owner only */}
                    {isTaskOwner && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                          border: `1.5px dashed ${theme.textFaint}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={theme.textFaint} strokeWidth="2" strokeLinecap="round"/></svg>
                        </div>
                        <input
                          value={newChecklistText}
                          onChange={e => setNewChecklistText(e.target.value)}
                          onKeyDown={e => {
                            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newChecklistText.trim()) addChecklistItem();
                            }
                          }}
                          placeholder="Neuer Punkt..."
                          style={{
                            flex: 1, background: "transparent", border: "none", borderBottom: `1px solid transparent`,
                            padding: "4px 0", fontSize: 13, fontFamily: FONT,
                            color: theme.text, outline: "none", caretColor: theme.accent,
                          }}
                          onFocus={e => e.currentTarget.style.borderBottomColor = theme.accent + "40"}
                          onBlur={e => { e.currentTarget.style.borderBottomColor = "transparent"; if (newChecklistText.trim()) addChecklistItem(); }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Attachments section (only in edit mode) */}
                  {editingTask && (
                    <div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M13.5 6L5.5 14c-1.5 1.5-1.5 4 0 5.5s4 1.5 5.5 0l10-10c1-1 1-3 0-4s-3-1-4 0l-10 10c-.5.5-.5 1.5 0 2s1.5.5 2 0l8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          Anhänge {taskAttachments.length > 0 && `(${taskAttachments.length})`}
                        </span>
                        <motion.span whileTap={{ scale: 0.95 }}
                          onClick={() => setShowAttachInput(!showAttachInput)}
                          style={{ fontSize: 11, color: theme.accent, cursor: "pointer" }}
                        >+ Link hinzufügen</motion.span>
                      </div>
                      {showAttachInput && (
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                          <input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)}
                            placeholder="URL einfügen..." autoFocus
                            onKeyDown={e => { if (e.key === "Enter") addAttachment(); }}
                            style={{
                              flex: 1, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`,
                              borderRadius: 8, padding: "7px 12px", fontSize: 12, fontFamily: FONT,
                              color: theme.text, outline: "none", caretColor: theme.accent,
                            }}
                          />
                          <input value={attachmentName} onChange={e => setAttachmentName(e.target.value)}
                            placeholder="Name (optional)"
                            onKeyDown={e => { if (e.key === "Enter") addAttachment(); }}
                            style={{
                              width: 120, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`,
                              borderRadius: 8, padding: "7px 12px", fontSize: 12, fontFamily: FONT,
                              color: theme.text, outline: "none", caretColor: theme.accent,
                            }}
                          />
                          <motion.button whileTap={{ scale: 0.95 }} onClick={addAttachment}
                            style={{ padding: "7px 14px", borderRadius: 8, background: theme.accent + "20", border: `1px solid ${theme.accent}30`, color: theme.accent, fontSize: 12, fontFamily: FONT, cursor: "pointer" }}
                          >+</motion.button>
                        </div>
                      )}
                      {taskAttachments.map(a => (
                        <div key={a.id} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8,
                          background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", marginBottom: 4,
                          border: `1px solid ${theme.borderFaint}`,
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            {a.type === "image" ? <><rect x="3" y="3" width="18" height="18" rx="3" stroke={theme.textDim} strokeWidth="1.5"/><circle cx="8.5" cy="8.5" r="2" stroke={theme.textDim} strokeWidth="1.5"/><path d="M3 16l5-5 4 4 3-3 6 6" stroke={theme.textDim} strokeWidth="1.5"/></> : <><circle cx="12" cy="12" r="9" stroke={theme.textDim} strokeWidth="1.5"/><path d="M12 8v4l3 3" stroke={theme.textDim} strokeWidth="1.5" strokeLinecap="round"/></>}
                          </svg>
                          <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 12, fontFamily: FONT, color: theme.accent, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</a>
                          <motion.span whileTap={{ scale: 0.9 }} onClick={() => deleteAttachment(a.id)} style={{ cursor: "pointer", fontSize: 12, color: theme.textFaint, padding: "0 4px" }}>✕</motion.span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action buttons: Delete left, Save/Cancel right */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <div>
                      {editingTask && isTaskOwner && (
                        <motion.button whileTap={{ scale: 0.97 }}
                          onClick={() => { resetForm(); requestDelete(editingTask.id); }}
                          style={{
                            padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
                            fontSize: 13, fontFamily: FONT, color: "#EF4444",
                          }}
                        >{t("common.delete")}</motion.button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <motion.button whileTap={{ scale: 0.97 }} onClick={resetForm}
                        style={{
                          padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                          background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${theme.borderFaint}`,
                          fontSize: 13, fontFamily: FONT, color: theme.textSub,
                        }}
                      >{t("common.cancel")}</motion.button>
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={editingTask ? updateTask : createTask}
                        style={{
                          padding: "10px 24px", borderRadius: 12, cursor: "pointer",
                          background: taskForm.title.trim() ? theme.accent + "25" : (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
                          border: `1px solid ${taskForm.title.trim() ? theme.accent + "40" : theme.borderFaint}`,
                          fontSize: 13, fontFamily: FONT, fontWeight: 500,
                          color: taskForm.title.trim() ? theme.accent : theme.textFaint,
                        }}
                      >{editingTask ? t("task.save") : t("task.create")}</motion.button>
                    </div>
                  </div>
                </div>

                {/* Right panel — comments & activity (only in edit mode) */}
                {editingTask && (
                  <div style={{
                    width: 300, borderLeft: `1px solid ${theme.border}`, display: "flex", flexDirection: "column",
                    background: darkMode ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)",
                  }}>
                    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}`, fontSize: 13, fontFamily: FONT, fontWeight: 600, color: theme.text, display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12c0 5-4.5 9-9.9 9a10.5 10.5 0 01-4.2-.9L3 21l.9-3.9A9.3 9.3 0 013 12c0-5 4.5-9 9-9s9 4 9 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Kommentare {taskComments.length > 0 && <span style={{ fontSize: 11, color: theme.textFaint, fontWeight: 400 }}>({taskComments.length})</span>}
                    </div>
                    {/* Comment list */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                      {taskComments.length === 0 && (
                        <div style={{ textAlign: "center", padding: "32px 16px" }}>
                          <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>💬</div>
                          <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textFaint }}>Noch keine Kommentare</div>
                        </div>
                      )}
                      {taskComments.map(c => {
                        const prof = c.profile || teamMembers[c.user_id] || {};
                        return (
                          <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            {prof.avatar_url ? (
                              <img src={prof.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 2 }} />
                            ) : (
                              <div style={{ width: 24, height: 24, borderRadius: "50%", background: theme.accent + "25", color: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: FONT, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{prof.initials || "?"}</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: 11, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{prof.display_name || "User"}</span>
                                <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint }}>{new Date(c.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                                {c.user_id === session.user.id && (
                                  <motion.span whileTap={{ scale: 0.9 }} onClick={() => deleteComment(c.id)} style={{ fontSize: 10, color: theme.textFaint, cursor: "pointer", marginLeft: "auto" }}>✕</motion.span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textSub, lineHeight: 1.5, wordBreak: "break-word" }}>{c.text}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Comment input */}
                    <div style={{ padding: "16px 16px 24px", borderTop: `1px solid ${theme.border}` }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          placeholder="Kommentar schreiben..."
                          onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) addComment(); }}
                          style={{
                            flex: 1, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                            border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px",
                            fontSize: 12, fontFamily: FONT, color: theme.text, outline: "none", caretColor: theme.accent,
                          }}
                        />
                        <motion.button whileTap={{ scale: 0.9 }} onClick={addComment}
                          style={{
                            padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                            background: commentText.trim() ? theme.accent + "20" : "transparent",
                            border: `1px solid ${commentText.trim() ? theme.accent + "40" : theme.borderFaint}`,
                            color: commentText.trim() ? theme.accent : theme.textFaint,
                            fontSize: 12, fontFamily: FONT,
                          }}
                        >↩</motion.button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </>); })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      {/* Custom Delete Confirm Dialog — Portal to body */}
      {createPortal(<AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setConfirmDelete(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 110,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: 360, background: darkMode ? "rgba(22, 22, 30, 0.96)" : "rgba(255, 255, 255, 0.97)",
                backdropFilter: "blur(40px)", border: `1px solid ${theme.border}`,
                borderRadius: 20, padding: "28px 28px 22px", textAlign: "center",
              }}
            >
              {/* Warning icon */}
              <div style={{
                width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px",
                background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4M12 17h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#EF4444" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
              <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: theme.text, marginBottom: 8 }}>
                Task löschen?
              </div>
              <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, marginBottom: 24, lineHeight: 1.5 }}>
                „{confirmDelete.title}" wird unwiderruflich gelöscht.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer",
                    background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", border: `1px solid ${theme.borderFaint}`,
                    fontSize: 13, fontFamily: FONT, color: theme.textSub, fontWeight: 500,
                  }}
                >{t("common.cancel")}</motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={confirmDeleteTask}
                  style={{
                    flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer",
                    background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
                    fontSize: 13, fontFamily: FONT, color: "#EF4444", fontWeight: 600,
                  }}
                >{t("common.delete")}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      {/* Project Editor Modal */}
      {createPortal(<AnimatePresence>
        {showProjectEditor && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowProjectEditor(false)}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: 480, background: darkMode ? "rgba(22,22,30,0.97)" : "rgba(255,255,255,0.98)",
                backdropFilter: "blur(40px)", border: `1px solid ${theme.border}`,
                borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", gap: 20, maxHeight: "80vh", overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: theme.text }}>
                  {editingProject ? "Projekt bearbeiten" : "Projekte verwalten"}
                </div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setShowProjectEditor(false); setEditingProject(null); setLogoPreview(null); }}
                  style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.textDim, fontSize: 16 }}
                >✕</motion.div>
              </div>

              {/* Project list */}
              {!editingProject && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: 300 }}>
                  {projects.map(p => (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12,
                      border: `1px solid ${theme.borderFaint}`, background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                    }}>
                      {p.logo_url ? (
                        <img src={p.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", border: `1px solid ${theme.borderFaint}` }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: (p.color || "#8B7AFF") + "20", border: `1px solid ${(p.color || "#8B7AFF")}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                          {p.icon || "◆"}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text }}>{p.name}</div>
                      </div>
                      <motion.div whileTap={{ scale: 0.9 }}
                        onClick={() => { setEditingProject(p); setProjectForm({ name: p.name, logo_url: p.logo_url || "", color: p.color || "#8B7AFF" }); setLogoPreview(p.logo_url || null); }}
                        style={{ padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: FONT, color: theme.textDim, border: `1px solid ${theme.borderFaint}` }}
                      >Edit</motion.div>
                      <motion.div whileTap={{ scale: 0.9 }}
                        onClick={() => deleteProject(p)}
                        style={{ padding: "4px 8px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: FONT, color: "#EF4444", border: "1px solid rgba(239,68,68,0.15)" }}
                      >✕</motion.div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, fontFamily: FONT, color: theme.textFaint }}>
                      Noch keine Projekte angelegt
                    </div>
                  )}
                </div>
              )}

              {/* Add / Edit form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: editingProject ? "none" : `1px solid ${theme.borderFaint}`, paddingTop: editingProject ? 0 : 16 }}>
                <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, fontWeight: 500 }}>
                  {editingProject ? "" : "Neues Projekt"}
                </div>
                <input
                  value={projectForm.name}
                  onChange={e => setProjectForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Projektname..."
                  autoFocus
                  style={{
                    background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`,
                    borderRadius: 10, padding: "10px 14px", fontSize: 14, fontFamily: FONT,
                    color: theme.text, outline: "none", caretColor: theme.accent,
                  }}
                />
                {/* Logo upload area */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {(logoPreview || projectForm.logo_url) ? (
                    <div style={{ position: "relative" }}>
                      <img src={logoPreview || projectForm.logo_url} alt="" style={{
                        width: 56, height: 56, borderRadius: 12, objectFit: "cover",
                        border: `1px solid ${theme.borderFaint}`,
                      }} />
                      <motion.div whileTap={{ scale: 0.9 }}
                        onClick={removeProjectLogo}
                        style={{
                          position: "absolute", top: -6, right: -6, width: 18, height: 18,
                          borderRadius: "50%", background: "#EF4444", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, cursor: "pointer", border: `2px solid ${darkMode ? "#16161e" : "#fff"}`,
                        }}
                      >✕</motion.div>
                    </div>
                  ) : (
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => projectLogoInputRef.current?.click()}
                      style={{
                        width: 56, height: 56, borderRadius: 12, cursor: "pointer",
                        border: `2px dashed ${theme.border}`,
                        background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 2,
                      }}
                    >
                      {logoUploading ? (
                        <div style={{ width: 16, height: 16, border: `2px solid ${theme.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      ) : (
                        <>
                          <span style={{ fontSize: 18, color: theme.textDim }}>+</span>
                        </>
                      )}
                    </motion.div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>
                      Logo
                    </div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, marginTop: 2 }}>
                      {logoUploading ? "Wird hochgeladen..." : (logoPreview || projectForm.logo_url) ? "Bild hochgeladen" : "Bild hochladen (PNG, JPG)"}
                    </div>
                    {!(logoPreview || projectForm.logo_url) && (
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={() => projectLogoInputRef.current?.click()}
                        disabled={logoUploading}
                        style={{
                          marginTop: 6, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                          background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                          border: `1px solid ${theme.borderFaint}`,
                          fontSize: 11, fontFamily: FONT, color: theme.textSub,
                        }}
                      >Datei auswählen</motion.button>
                    )}
                  </div>
                </div>
                <input
                  ref={projectLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  style={{ display: "none" }}
                  onChange={handleProjectLogoUpload}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {editingProject && (
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={() => { setEditingProject(null); setProjectForm({ name: "", logo_url: "", color: "#8B7AFF" }); setLogoPreview(null); }}
                        style={{
                          padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                          background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${theme.borderFaint}`,
                          fontSize: 13, fontFamily: FONT, color: theme.textSub,
                        }}
                      >Zurück</motion.button>
                    )}
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={saveProject}
                    style={{
                      padding: "10px 24px", borderRadius: 12, cursor: "pointer",
                      background: projectForm.name.trim() ? theme.accent + "25" : (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
                      border: `1px solid ${projectForm.name.trim() ? theme.accent + "40" : theme.borderFaint}`,
                      fontSize: 13, fontFamily: FONT, fontWeight: 500,
                      color: projectForm.name.trim() ? theme.accent : theme.textFaint,
                    }}
                  >{editingProject ? "Speichern" : "Erstellen"}</motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </motion.div>
  );
}

// ──── Calendar View ────
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function CalendarView({ onBack, session, getProviderToken, openMeetCall, autoReLogin, ensureValidToken, theme, darkMode, t, userOrg }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState("month"); // "month" | "week" | "day"
  const [navDirection, setNavDirection] = useState(0); // -1 = prev, 1 = next, for animation
  const [navKey, setNavKey] = useState(0); // force re-render for animation
  const [googleEvents, setGoogleEvents] = useState([]);
  const [teamEvents, setTeamEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", date: "", startTime: "09:00", endTime: "10:00", description: "", allDay: false, withMeet: false, isTeamEvent: false });
  const [savingEvent, setSavingEvent] = useState(false);
  const [meetLink, setMeetLink] = useState(null);
  const [meetLoading, setMeetLoading] = useState(false);
  const [tempEventId, setTempEventId] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // German public holidays (bundesweit)
  const getGermanHolidays = (y) => {
    // Easter calculation (Anonymous Gregorian algorithm)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const eMonth = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const eDay = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(y, eMonth, eDay);
    const easterOffset = (days) => { const d = new Date(easter); d.setDate(d.getDate() + days); return d; };
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    return {
      [fmt(new Date(y, 0, 1))]: "Neujahr",
      [fmt(easterOffset(-2))]: "Karfreitag",
      [fmt(easterOffset(0))]: "Ostersonntag",
      [fmt(easterOffset(1))]: "Ostermontag",
      [fmt(new Date(y, 4, 1))]: "Tag der Arbeit",
      [fmt(easterOffset(39))]: "Christi Himmelfahrt",
      [fmt(easterOffset(49))]: "Pfingstsonntag",
      [fmt(easterOffset(50))]: "Pfingstmontag",
      [fmt(new Date(y, 9, 3))]: "Tag der Deutschen Einheit",
      [fmt(new Date(y, 11, 25))]: "1. Weihnachtstag",
      [fmt(new Date(y, 11, 26))]: "2. Weihnachtstag",
    };
  };
  const holidays = getGermanHolidays(year);

  // Get calendar grid days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();
  const calendarDays = [];
  // Previous month tail
  for (let i = startOffset - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, month: month - 1, isOtherMonth: true });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, month, isOtherMonth: false });
  }
  // Next month head
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, month: month + 1, isOtherMonth: true });
  }

  // Fetch Google Calendar events + Supabase tasks
  useEffect(() => {
    if (!session?.user) return;
    const load = async () => {
      setLoading(true);

      // Time range for current month view
      const timeMin = new Date(year, month, 1).toISOString();
      const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      // Google Calendar — use ensureValidToken for guaranteed fresh token
      const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
      if (providerToken) {
        try {
          let res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
            { headers: { Authorization: `Bearer ${providerToken}` } }
          );
          // If 401, force one more refresh attempt
          if (res.status === 401 && autoReLogin) {
            const freshToken = await autoReLogin();
            if (freshToken) {
              res = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
                { headers: { Authorization: `Bearer ${freshToken}` } }
              );
            }
          }
          if (res.ok) {
            const data = await res.json();
            setGoogleEvents((data.items || []).map(e => ({
              id: e.id,
              title: e.summary || "Kein Titel",
              start: e.start?.dateTime || e.start?.date,
              end: e.end?.dateTime || e.end?.date,
              allDay: !!e.start?.date,
              color: e.colorId ? ["#7986CB","#33B679","#8E24AA","#E67C73","#F6BF26","#F4511E","#039BE5","#616161","#3F51B5","#0B8043","#D50000"][parseInt(e.colorId)] : "#5B8DEF",
              type: "google",
              location: e.location,
              hangoutLink: e.hangoutLink,
            })));
          } else if (res.status === 401) {
            // Token expired — silently refresh via API, then retry
            if (autoReLogin) {
              const newToken = await autoReLogin();
              if (newToken) {
                const retryRes = await fetch(
                  `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
                  { headers: { Authorization: `Bearer ${newToken}` } }
                );
                if (retryRes.ok) {
                  const data = await retryRes.json();
                  setGoogleEvents((data.items || []).map(e => ({
                    id: e.id, title: e.summary || "Kein Titel",
                    start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
                    allDay: !!e.start?.date,
                    color: e.colorId ? ["#7986CB","#33B679","#8E24AA","#E67C73","#F6BF26","#F4511E","#039BE5","#616161","#3F51B5","#0B8043","#D50000"][parseInt(e.colorId)] : "#5B8DEF",
                    type: "google", location: e.location, hangoutLink: e.hangoutLink,
                  })));
                }
              }
            }
          }
        } catch (err) {
          console.error("Calendar fetch error:", err);
        }
      } else {
        // No token available — try silent refresh
        if (autoReLogin) {
          const newToken = await autoReLogin();
          if (newToken) {
            const retryRes = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
              { headers: { Authorization: `Bearer ${newToken}` } }
            );
            if (retryRes.ok) {
              const data = await retryRes.json();
              setGoogleEvents((data.items || []).map(e => ({
                id: e.id, title: e.summary || "Kein Titel",
                start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
                allDay: !!e.start?.date,
                color: e.colorId ? ["#7986CB","#33B679","#8E24AA","#E67C73","#F6BF26","#F4511E","#039BE5","#616161","#3F51B5","#0B8043","#D50000"][parseInt(e.colorId)] : "#5B8DEF",
                type: "google", location: e.location, hangoutLink: e.hangoutLink,
              })));
            }
          }
        }
      }

      // Supabase tasks with due_date
      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .eq("creator_id", session.user.id)
        .not("due_date", "is", null);
      setTasks((taskData || []).map(t => ({
        id: t.id,
        title: t.title,
        start: t.due_date,
        color: priColors[t.priority] || "#8B7AFF",
        type: "task",
        priority: t.priority,
        project: t.project_name,
      })));

      // Supabase team events
      if (userOrg?.id) {
        const timeMinLocal = new Date(year, month, 1).toISOString();
        const timeMaxLocal = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
        const { data: teamData } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("org_id", userOrg.id)
          .gte("start_time", timeMinLocal)
          .lte("start_time", timeMaxLocal)
          .order("start_time");
        setTeamEvents((teamData || []).map(e => ({
          id: e.id,
          title: e.title,
          start: e.all_day ? e.start_time.split("T")[0] : e.start_time,
          end: e.all_day ? e.end_time.split("T")[0] : e.end_time,
          allDay: e.all_day,
          color: e.color || "#8B7AFF",
          type: "team",
          description: e.description,
          location: e.location,
          creator_id: e.creator_id,
        })));
      }

      setLoading(false);
    };
    load();
  }, [session, year, month, userOrg?.id]);

  // Realtime subscription for team events
  useEffect(() => {
    if (!userOrg?.id) return;
    const channel = supabase.channel("team-calendar-" + userOrg.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter: `org_id=eq.${userOrg.id}` },
        () => {
          // Refetch team events on any change
          const fetchTeam = async () => {
            const timeMinLocal = new Date(year, month, 1).toISOString();
            const timeMaxLocal = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
            const { data: teamData } = await supabase
              .from("calendar_events")
              .select("*")
              .eq("org_id", userOrg.id)
              .gte("start_time", timeMinLocal)
              .lte("start_time", timeMaxLocal)
              .order("start_time");
            setTeamEvents((teamData || []).map(e => ({
              id: e.id, title: e.title,
              start: e.all_day ? e.start_time.split("T")[0] : e.start_time,
              end: e.all_day ? e.end_time.split("T")[0] : e.end_time,
              allDay: e.all_day, color: e.color || "#8B7AFF", type: "team",
              description: e.description, location: e.location, creator_id: e.creator_id,
            })));
          };
          fetchTeam();
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userOrg?.id, year, month]);

  // Get date key for a dayObj (for holiday lookup etc)
  const getDateKey = (dayObj) => {
    let y = year, m = dayObj.month;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(dayObj.day).padStart(2, "0")}`;
  };

  // Check if a grid index is weekend (5=Saturday, 6=Sunday in Mon-start grid)
  const isWeekend = (gridIndex) => gridIndex % 7 >= 5;

  // Get holiday name for a dayObj
  const getHoliday = (dayObj) => {
    const key = getDateKey(dayObj);
    // Check current year and adjacent years for month overflow
    return holidays[key] || getGermanHolidays(year - 1)[key] || getGermanHolidays(year + 1)[key] || null;
  };

  // Get events for a specific day
  const getEventsForDay = (dayObj) => {
    const dateStr = `${year}-${String(dayObj.month + 1).padStart(2, "0")}-${String(dayObj.day).padStart(2, "0")}`;
    // Adjust year for prev/next month overflow
    let y = year;
    let m = dayObj.month;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    const checkDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(dayObj.day).padStart(2, "0")}`;

    const dayEvents = [];
    googleEvents.forEach(e => {
      const eDate = (e.start || "").substring(0, 10);
      if (eDate === checkDate) dayEvents.push(e);
    });
    teamEvents.forEach(e => {
      const eDate = (e.start || "").substring(0, 10);
      if (eDate === checkDate) dayEvents.push(e);
    });
    tasks.forEach(t => {
      const tDate = (t.start || "").substring(0, 10);
      if (tDate === checkDate) dayEvents.push(t);
    });
    return dayEvents;
  };

  const isToday = (dayObj) => {
    return !dayObj.isOtherMonth && dayObj.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  // Navigation depends on viewMode
  const navigatePrev = () => {
    setNavDirection(-1);
    setNavKey(k => k + 1);
    if (viewMode === "month") setCurrentDate(new Date(year, month - 1, 1));
    else if (viewMode === "week") { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }
    else { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); }
  };
  const navigateNext = () => {
    setNavDirection(1);
    setNavKey(k => k + 1);
    if (viewMode === "month") setCurrentDate(new Date(year, month + 1, 1));
    else if (viewMode === "week") { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }
    else { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); }
  };
  const goToday = () => { setNavDirection(0); setNavKey(k => k + 1); setCurrentDate(new Date()); setSelectedDay(null); };

  // Week view helpers
  const getWeekDays = () => {
    const d = new Date(currentDate);
    const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Get events for a Date object
  const getEventsForDate = (date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayEvents = [];
    googleEvents.forEach(e => { if ((e.start || "").substring(0, 10) === dateStr) dayEvents.push(e); });
    teamEvents.forEach(e => { if ((e.start || "").substring(0, 10) === dateStr) dayEvents.push(e); });
    tasks.forEach(t => { if ((t.start || "").substring(0, 10) === dateStr) dayEvents.push(t); });
    return dayEvents;
  };

  // Get holiday for a Date object
  const getHolidayForDate = (date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return getGermanHolidays(date.getFullYear())[key] || null;
  };

  // Navigation label
  const getNavLabel = () => {
    if (viewMode === "month") return `${MONTH_NAMES[month]} ${year}`;
    if (viewMode === "week") {
      const days = getWeekDays();
      const s = days[0], e = days[6];
      if (s.getMonth() === e.getMonth()) return `${s.getDate()}. – ${e.getDate()}. ${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`;
      return `${s.getDate()}. ${MONTH_NAMES[s.getMonth()]} – ${e.getDate()}. ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`;
    }
    const DAYFULL = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
    return `${DAYFULL[currentDate.getDay()]}, ${currentDate.getDate()}. ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // Open new event form (pre-fill date if a day is selected)
  const openNewEvent = (dayObj) => {
    let y = year, m = dayObj ? dayObj.month : month;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    const dateStr = dayObj
      ? `${y}-${String(m + 1).padStart(2, "0")}-${String(dayObj.day).padStart(2, "0")}`
      : `${year}-${String(month + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    // Default time: round NOW up to the next 15 minutes; end = +1h. Avoids
    // creating events that start in the past (which Google rejects silently).
    const now = new Date();
    const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const baseStart = isToday
      ? new Date(now.getTime() + (15 - (now.getMinutes() % 15)) * 60000)
      : new Date(`${dateStr}T09:00:00`);
    const baseEnd = new Date(baseStart.getTime() + 60 * 60 * 1000);
    const fmt = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    setEventForm({ title: "", date: dateStr, startTime: fmt(baseStart), endTime: fmt(baseEnd), description: "", allDay: false, withMeet: false });
    setMeetLink(null);
    setTempEventId(null);
    setLinkCopied(false);
    setAttendees([]);
    setAttendeeInput("");
    setShowNewEvent(true);
  };

  // Toggle Google Meet — creates a temp event to get the link immediately
  const toggleMeet = async (enable) => {
    setEventForm(f => ({ ...f, withMeet: enable }));
    if (enable) {
      const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
      if (!providerToken) return;
      setMeetLoading(true);
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const date = eventForm.date || new Date().toISOString().split("T")[0];
        const tempBody = {
          summary: eventForm.title || "Neues Meeting",
          start: { dateTime: `${date}T${eventForm.startTime}:00`, timeZone: tz },
          end: { dateTime: `${date}T${eventForm.endTime}:00`, timeZone: tz },
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        };
        const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1", {
          method: "POST",
          headers: { Authorization: `Bearer ${providerToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(tempBody),
        });
        if (res.ok) {
          const data = await res.json();
          const link = data.hangoutLink || data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === "video")?.uri;
          setMeetLink(link || null);
          setTempEventId(data.id);
        }
      } catch (err) {
        console.error("Meet link creation error:", err);
      }
      setMeetLoading(false);
    } else {
      // Toggle off — delete temp event if exists
      if (tempEventId) {
        const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
        if (providerToken) {
          fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${tempEventId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${providerToken}` },
          }).catch(() => {});
        }
        setTempEventId(null);
      }
      setMeetLink(null);
      setLinkCopied(false);
    }
  };

  // Cancel new event — delete temp Meet event if exists
  const cancelNewEvent = async () => {
    if (tempEventId) {
      const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
      if (providerToken) {
        fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${tempEventId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${providerToken}` },
        }).catch(() => {});
      }
      setTempEventId(null);
    }
    setMeetLink(null);
    setLinkCopied(false);
    setShowNewEvent(false);
  };

  // Delete / cancel a Google Calendar event
  const deleteGoogleEvent = async (eventObj) => {
    if (!eventObj?.id) return;
    setDeletingEvent(true);
    try {
      if (eventObj.type === "team") {
        // Delete from Supabase
        await supabase.from("calendar_events").delete().eq("id", eventObj.id);
        setTeamEvents(prev => prev.filter(e => e.id !== eventObj.id));
        setConfirmDeleteEvent(null);
      } else if (eventObj.type === "google") {
        const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
        if (!providerToken) { setDeletingEvent(false); return; }
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventObj.id}?sendUpdates=all`,
          { method: "DELETE", headers: { Authorization: `Bearer ${providerToken}` } }
        );
        if (res.ok || res.status === 204) {
          setGoogleEvents(prev => prev.filter(e => e.id !== eventObj.id));
          setConfirmDeleteEvent(null);
        } else {
          const err = await res.json().catch(() => ({}));
          console.error("Delete event error:", res.status, err);
        }
      }
    } catch (err) {
      console.error("Delete event error:", err);
    }
    setDeletingEvent(false);
  };

  // Create or update Google Calendar event
  const createTeamEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date || !userOrg?.id) return;
    setSavingEvent(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let start_time, end_time;
      if (eventForm.allDay) {
        start_time = `${eventForm.date}T00:00:00`;
        const nextDay = new Date(eventForm.date);
        nextDay.setDate(nextDay.getDate() + 1);
        end_time = `${nextDay.toISOString().split("T")[0]}T00:00:00`;
      } else {
        start_time = `${eventForm.date}T${eventForm.startTime}:00`;
        end_time = `${eventForm.date}T${eventForm.endTime}:00`;
      }
      await supabase.from("calendar_events").insert({
        org_id: userOrg.id,
        creator_id: session.user.id,
        title: eventForm.title.trim(),
        description: eventForm.description || null,
        start_time,
        end_time,
        all_day: eventForm.allDay,
      });
      setShowNewEvent(false);
      setEventForm({ title: "", date: "", startTime: "09:00", endTime: "10:00", description: "", allDay: false, withMeet: false, isTeamEvent: false });
    } catch (err) {
      console.error("Create team event error:", err);
    }
    setSavingEvent(false);
  };

  const createGoogleEvent = async () => {
    if (!eventForm.title.trim()) { alert("Bitte einen Titel eingeben."); return; }
    if (!eventForm.date) { alert("Bitte ein Datum auswählen."); return; }
    // Client-side validation for timed events
    if (!eventForm.allDay) {
      const startISO = `${eventForm.date}T${eventForm.startTime}:00`;
      const endISO = `${eventForm.date}T${eventForm.endTime}:00`;
      const startMs = new Date(startISO).getTime();
      const endMs = new Date(endISO).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        alert("Ungültige Uhrzeit. Bitte Start- und Endzeit prüfen.");
        return;
      }
      if (endMs <= startMs) {
        alert("Die Endzeit muss nach der Startzeit liegen.");
        return;
      }
      // Warn (but don't block) if start is in the past
      if (startMs < Date.now() - 60_000) {
        const ok = confirm("Die Startzeit liegt in der Vergangenheit. Trotzdem erstellen?");
        if (!ok) return;
      }
    }
    const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
    if (!providerToken) { alert("Kein Google Zugriff. Bitte neu einloggen."); return; }
    setSavingEvent(true);
    try {
      const body = { summary: eventForm.title.trim(), description: eventForm.description };
      if (attendees.length > 0) {
        body.attendees = attendees.map(email => ({ email }));
      }
      if (eventForm.allDay) {
        body.start = { date: eventForm.date };
        const nextDay = new Date(eventForm.date);
        nextDay.setDate(nextDay.getDate() + 1);
        body.end = { date: nextDay.toISOString().split("T")[0] };
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        body.start = { dateTime: `${eventForm.date}T${eventForm.startTime}:00`, timeZone: tz };
        body.end = { dateTime: `${eventForm.date}T${eventForm.endTime}:00`, timeZone: tz };
      }

      let res;
      if (tempEventId) {
        // Update the temp event that was created for the Meet link
        const patchParams = new URLSearchParams({ conferenceDataVersion: "1" });
        if (attendees.length > 0) patchParams.set("sendUpdates", "all");
        res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${tempEventId}?${patchParams.toString()}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${providerToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        // Create new event (no Meet)
        if (eventForm.withMeet) {
          body.conferenceData = {
            createRequest: {
              requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          };
        }
        const conferenceParam = eventForm.withMeet ? "?conferenceDataVersion=1" : "?";
        const params = new URLSearchParams();
        if (eventForm.withMeet) params.set("conferenceDataVersion", "1");
        if (attendees.length > 0) params.set("sendUpdates", "all");
        const qs = params.toString() ? `?${params.toString()}` : "";
        res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${qs}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${providerToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (res.ok) {
        setShowNewEvent(false);
        setMeetLink(null);
        setTempEventId(null);
        setLinkCopied(false);
        // Refresh events
        const timeMin = new Date(year, month, 1).toISOString();
        const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
        const evRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
          { headers: { Authorization: `Bearer ${providerToken}` } }
        );
        if (evRes.ok) {
          const data = await evRes.json();
          setGoogleEvents((data.items || []).map(e => ({
            id: e.id, title: e.summary || "Kein Titel",
            start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
            allDay: !!e.start?.date,
            color: e.colorId ? ["#7986CB","#33B679","#8E24AA","#E67C73","#F6BF26","#F4511E","#039BE5","#616161","#3F51B5","#0B8043","#D50000"][parseInt(e.colorId)] : "#5B8DEF",
            type: "google", location: e.location, hangoutLink: e.hangoutLink,
          })));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Create event error:", res.status, err);
        if (res.status === 401 && autoReLogin) { autoReLogin(); return; }
        alert("Fehler beim Erstellen: " + (err.error?.message || "Unbekannter Fehler"));
      }
    } catch (err) {
      console.error("Create event error:", err);
      alert("Fehler beim Erstellen: " + (err.message || "Verbindungsfehler"));
    }
    setSavingEvent(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: 5 }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "24px 32px 0" }}>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onBack}
          style={{ width: 32, height: 32, borderRadius: "50%", cursor: "pointer", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: theme.textDim, fontFamily: FONT }}>←</motion.div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: theme.text, fontFamily: FONT, letterSpacing: -0.5 }}>Calendar</div>
          <div style={{ fontSize: 12, color: theme.textDim, fontFamily: FONT, marginTop: 2 }}>
            {loading ? "Loading..." : `${googleEvents.length + teamEvents.length} Events · ${tasks.length} Tasks`}
          </div>
        </div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => openNewEvent(selectedDay)}
          style={{ cursor: "pointer", fontSize: 12, fontFamily: FONT, color: theme.accent, padding: "6px 14px", borderRadius: 20, background: theme.accent + "15", border: `1px solid ${theme.accent}30`, fontWeight: 500 }}>
          + {t("cal.newEvent")}
        </motion.div>
      </div>

      {/* Navigation + View Switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 32px 8px" }}>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={navigatePrev}
          style={{ cursor: "pointer", color: theme.textDim, fontSize: 18, fontFamily: FONT, padding: "4px 8px" }}>‹</motion.div>
        <motion.div
          key={`nav-${navKey}`}
          initial={{ opacity: 0, y: navDirection * 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ fontSize: 16, fontFamily: FONT, fontWeight: 500, color: theme.text, minWidth: 200, textAlign: "center" }}
        >
          {getNavLabel()}
        </motion.div>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={navigateNext}
          style={{ cursor: "pointer", color: theme.textDim, fontSize: 18, fontFamily: FONT, padding: "4px 8px" }}>›</motion.div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={goToday}
          style={{ marginLeft: 8, cursor: "pointer", fontSize: 12, fontFamily: FONT, fontWeight: 500, color: theme.accent, padding: "6px 14px", borderRadius: 20, background: theme.accent + "15", border: `1px solid ${theme.accent}30` }}>Heute</motion.div>
        <div style={{ flex: 1 }} />
        {/* View mode switcher */}
        <div style={{ display: "flex", gap: 2, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderRadius: 10, padding: 3, border: `1px solid ${theme.borderFaint}` }}>
          {[{ key: "month", labelKey: "cal.month" }, { key: "week", labelKey: "cal.week" }, { key: "day", labelKey: "cal.day" }].map(v => (
            <motion.div key={v.key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setViewMode(v.key)}
              style={{
                cursor: "pointer", padding: "5px 14px", borderRadius: 8, fontSize: 11, fontFamily: FONT, fontWeight: 500,
                color: viewMode === v.key ? (darkMode ? "#fff" : "#1a1a2e") : theme.textDim,
                background: viewMode === v.key ? (darkMode ? "rgba(139,122,255,0.25)" : "rgba(108,92,231,0.15)") : "transparent",
                transition: "all 0.15s",
              }}
            >{t(v.labelKey)}</motion.div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, padding: "0 32px 24px", gap: 20, minHeight: 0, overflow: "hidden" }}>

        {/* ===== MONTH VIEW ===== */}
        {viewMode === "month" && (
          <motion.div
            key={`month-${navKey}`}
            initial={{ opacity: 0, x: navDirection * 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            {/* Weekday headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4, background: darkMode ? "rgba(20,18,30,0.5)" : "rgba(0,0,0,0.03)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderRadius: 10, padding: "2px 0" }}>
              {WEEKDAYS.map((d, di) => (
                <div key={d} style={{ textAlign: "center", fontSize: 13, fontFamily: FONT, color: di >= 5 ? theme.textFaint : theme.textDim, padding: "6px 0", fontWeight: 500 }}>{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, flex: 1 }}>
              {calendarDays.map((dayObj, i) => {
                const events = getEventsForDay(dayObj);
                const isSelected = selectedDay && selectedDay.day === dayObj.day && selectedDay.month === dayObj.month && !dayObj.isOtherMonth;
                const todayHighlight = isToday(dayObj);
                const weekend = isWeekend(i);
                const holiday = !dayObj.isOtherMonth ? getHoliday(dayObj) : null;
                return (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => { if (!dayObj.isOtherMonth) setSelectedDay(dayObj); }}
                    onDoubleClick={() => { if (!dayObj.isOtherMonth) { setSelectedDay(dayObj); openNewEvent(dayObj); } }}
                    style={{
                      padding: 10, borderRadius: 10, cursor: dayObj.isOtherMonth ? "default" : "pointer",
                      background: isSelected ? (darkMode ? "rgba(139,122,255,0.15)" : "rgba(108,92,231,0.1)") : todayHighlight ? (darkMode ? "rgba(139,122,255,0.08)" : "rgba(108,92,231,0.06)") : weekend ? (darkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.03)") : (darkMode ? "rgba(25,23,38,0.92)" : "rgba(255,255,255,0.85)"),
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      border: isSelected ? `1px solid ${darkMode ? "rgba(139,122,255,0.3)" : "rgba(108,92,231,0.25)"}` : todayHighlight ? `1px solid ${darkMode ? "rgba(139,122,255,0.15)" : "rgba(108,92,231,0.12)"}` : "1px solid transparent",
                      display: "flex", flexDirection: "column", minHeight: 54, transition: "all 0.15s",
                      opacity: dayObj.isOtherMonth ? 0.25 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 11, fontFamily: FONT, fontWeight: todayHighlight ? 600 : 400,
                        color: todayHighlight ? "#8B7AFF" : weekend ? theme.textDim : isSelected ? theme.text : theme.textSub,
                      }}>{dayObj.day}</span>
                      {holiday && (
                        <>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: theme.text, flexShrink: 0, marginLeft: 4 }} />
                          <span style={{ fontSize: 11, fontFamily: FONT, color: theme.text, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{holiday}</span>
                        </>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, overflow: "hidden", flex: 1 }}>
                      {events.slice(0, 3).map((e, ei) => (
                        <div key={ei} style={{
                          fontSize: 11, fontFamily: FONT, color: e.color,
                          background: e.color + "15", borderRadius: 4,
                          padding: "2px 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          borderLeft: `2px solid ${e.color}`,
                        }}>{e.title}</div>
                      ))}
                      {events.length > 3 && (
                        <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint }}>+{events.length - 3} mehr</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ===== WEEK VIEW ===== */}
        {viewMode === "week" && (
          <motion.div
            key={`week-${navKey}`}
            initial={{ opacity: 0, x: navDirection * 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            {/* Weekday headers with dates */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4, background: darkMode ? "rgba(20,18,30,0.5)" : "rgba(0,0,0,0.03)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderRadius: 10, padding: "6px 0" }}>
              {getWeekDays().map((d, di) => {
                const isTd = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                return (
                  <div key={di} style={{ textAlign: "center", fontFamily: FONT }}>
                    <div style={{ fontSize: 10, color: di >= 5 ? theme.textFaint : theme.textDim, fontWeight: 500 }}>{WEEKDAYS[di]}</div>
                    <div style={{ fontSize: 16, fontWeight: isTd ? 700 : 500, color: isTd ? "#8B7AFF" : di >= 5 ? theme.textFaint : theme.text, marginTop: 2 }}>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
            {/* Week day columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, flex: 1, overflow: "hidden" }}>
              {getWeekDays().map((d, di) => {
                const events = getEventsForDate(d);
                const hol = getHolidayForDate(d);
                const isTd = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                return (
                  <div key={di} style={{
                    padding: 10, borderRadius: 10, display: "flex", flexDirection: "column", gap: 4,
                    background: isTd ? (darkMode ? "rgba(139,122,255,0.06)" : "rgba(108,92,231,0.05)") : di >= 5 ? (darkMode ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.015)") : (darkMode ? "rgba(20,18,30,0.65)" : "rgba(255,255,255,0.7)"),
                    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                    border: isTd ? `1px solid ${darkMode ? "rgba(139,122,255,0.15)" : "rgba(108,92,231,0.12)"}` : `1px solid ${theme.borderFaint}`,
                    overflowY: "auto",
                  }}>
                    {hol && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: theme.text, flexShrink: 0 }} />
                        <span style={{ fontSize: 9, fontFamily: FONT, color: theme.text, opacity: 0.8 }}>{hol}</span>
                      </div>
                    )}
                    {events.length === 0 && !hol && (
                      <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, textAlign: "center", marginTop: 12 }}>—</div>
                    )}
                    {events.map((e, ei) => (
                      <motion.div key={ei}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: ei * 0.03 }}
                        style={{
                          padding: "6px 8px", borderRadius: 8, borderLeft: `3px solid ${e.color}`,
                          background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.borderFaint}`,
                        }}
                      >
                        <div style={{ fontSize: 11, fontFamily: FONT, fontWeight: 500, color: theme.text, marginBottom: 2 }}>{e.title}</div>
                        {e.start && !e.allDay && (
                          <div style={{ fontSize: 9, fontFamily: FONT, color: theme.textDim }}>
                            {new Date(e.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            {e.end && ` – ${new Date(e.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                          </div>
                        )}
                        {e.allDay && <div style={{ fontSize: 9, fontFamily: FONT, color: theme.textFaint }}>Ganztägig</div>}
                        {e.hangoutLink && (
                          <div onClick={(ev) => { ev.stopPropagation(); openMeetCall(e.hangoutLink, e.title); }}
                            style={{ fontSize: 9, fontFamily: FONT, color: "#00B894", cursor: "pointer", marginTop: 2 }}>🔗 Meet</div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ===== DAY VIEW (List) ===== */}
        {viewMode === "day" && (
          <motion.div
            key={`day-${navKey}`}
            initial={{ opacity: 0, x: navDirection * 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}
          >
            {(() => {
              const dayEvents = getEventsForDate(currentDate);
              const hol = getHolidayForDate(currentDate);
              const isWe = currentDate.getDay() === 0 || currentDate.getDay() === 6;
              return (
                <>
                  {/* Day header info */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    {hol && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}` }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.text }} />
                        <span style={{ fontSize: 12, fontFamily: FONT, color: theme.text }}>{hol}</span>
                      </div>
                    )}
                    {isWe && (
                      <span style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, padding: "5px 12px", borderRadius: 8, background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>Wochenende</span>
                    )}
                    <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim }}>
                      {dayEvents.length === 0 ? t("cal.noEvents") : `${dayEvents.length} ${dayEvents.length === 1 ? t("cal.event") : t("cal.events")}`}
                    </span>
                  </div>

                  {dayEvents.length === 0 && (
                    <div style={{ padding: "60px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textFaint }}>Freier Tag</div>
                    </div>
                  )}

                  {/* Event list */}
                  {dayEvents.map((e, i) => (
                    <motion.div key={e.id || i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      style={{
                        padding: "16px 20px", borderRadius: 14, marginBottom: 8,
                        background: darkMode ? "rgba(20,18,30,0.65)" : "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                        border: `1px solid ${theme.borderFaint}`, borderLeft: `4px solid ${e.color}`,
                        display: "flex", alignItems: "flex-start", gap: 16,
                      }}
                    >
                      {/* Time column */}
                      <div style={{ minWidth: 65, flexShrink: 0 }}>
                        {e.start && !e.allDay ? (
                          <>
                            <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: theme.text }}>
                              {new Date(e.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            {e.end && (
                              <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, marginTop: 2 }}>
                                {new Date(e.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, padding: "3px 8px", borderRadius: 4, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", display: "inline-block" }}>Ganztägig</div>
                        )}
                      </div>
                      {/* Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontFamily: FONT, fontWeight: 500, color: theme.text, marginBottom: 4 }}>{e.title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {e.type === "google" && (
                            <span style={{ fontSize: 10, fontFamily: FONT, color: "#5B8DEF", padding: "2px 8px", borderRadius: 4, background: "rgba(91,141,239,0.1)" }}>Google</span>
                          )}
                          {e.type === "team" && (
                            <span style={{ fontSize: 10, fontFamily: FONT, color: "#8B7AFF", padding: "2px 8px", borderRadius: 4, background: "rgba(139,122,255,0.1)" }}>Team</span>
                          )}
                          {e.type === "task" && (
                            <span style={{ fontSize: 10, fontFamily: FONT, color: "#8B7AFF", padding: "2px 8px", borderRadius: 4, background: "rgba(139,122,255,0.1)" }}>Task</span>
                          )}
                          {e.project && <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint }}>{e.project}</span>}
                          {e.location && <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint }}>📍 {e.location}</span>}
                        </div>
                        {e.hangoutLink && (
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            onClick={() => openMeetCall(e.hangoutLink, e.title)}
                            style={{ display: "inline-block", fontSize: 11, fontFamily: FONT, color: "#00B894", marginTop: 6, cursor: "pointer", padding: "3px 10px", borderRadius: 6, background: "rgba(0,184,148,0.08)", border: "1px solid rgba(0,184,148,0.15)" }}
                          >🔗 Google Meet beitreten</motion.div>
                        )}
                      </div>
                      {/* Delete button for Google events or own team events */}
                      {(e.type === "google" || (e.type === "team" && e.creator_id === session?.user?.id)) && (
                        <motion.div
                          whileHover={{ scale: 1.15, background: "rgba(232,67,67,0.15)" }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setConfirmDeleteEvent(e)}
                          style={{ cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: theme.textFaint, flexShrink: 0, transition: "all 0.15s" }}
                          title="Event absagen"
                        >✕</motion.div>
                      )}
                    </motion.div>
                  ))}
                </>
              );
            })()}
          </motion.div>
        )}

        {/* Day detail sidebar (month view only) */}
        <AnimatePresence>
          {viewMode === "month" && selectedDay && !selectedDay.isOtherMonth && (
            <motion.div
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 280 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
              style={{
                width: 280, flexShrink: 0, background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${theme.borderFaint}`, borderRadius: 16,
                display: "flex", flexDirection: "column", overflow: "hidden",
              }}
            >
              <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${theme.borderFaint}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 15, fontFamily: FONT, fontWeight: 600, color: theme.text }}>
                    {selectedDay.day}. {MONTH_NAMES[month]}
                  </div>
                <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>
                  {selectedEvents.length === 0 ? t("cal.noEvents") : `${selectedEvents.length} ${selectedEvents.length === 1 ? t("cal.event") : t("cal.events")}`}
                </div>
                {getHoliday(selectedDay) && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.text, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: FONT, color: theme.text }}>{getHoliday(selectedDay)}</span>
                  </div>
                )}
                </div>
                <motion.div
                  whileHover={{ scale: 1.15, background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedDay(null)}
                  style={{ cursor: "pointer", width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: theme.textDim, flexShrink: 0, transition: "all 0.15s" }}
                >✕</motion.div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                {selectedEvents.length === 0 && (
                  <div style={{ padding: "24px 8px", textAlign: "center", fontSize: 12, fontFamily: FONT, color: theme.textFaint }}>
                    Freier Tag ✦
                  </div>
                )}
                {selectedEvents.map((e, i) => (
                  <motion.div key={e.id || i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    style={{
                      padding: "10px 12px", borderRadius: 10, marginBottom: 6,
                      background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.borderFaint}`,
                      borderLeft: `3px solid ${e.color}`, position: "relative", group: "event",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                      <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 500, color: theme.text, marginBottom: 3, flex: 1 }}>{e.title}</div>
                      {e.type === "google" && (
                        <motion.div
                          whileHover={{ scale: 1.15, background: "rgba(232,67,67,0.15)" }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setConfirmDeleteEvent(e)}
                          style={{ cursor: "pointer", width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: theme.textFaint, flexShrink: 0, transition: "all 0.15s" }}
                          title="Event absagen"
                        >✕</motion.div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {e.start && !e.allDay && (
                        <span style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>
                          {new Date(e.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                          {e.end && ` – ${new Date(e.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      )}
                      {e.allDay && <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, padding: "1px 6px", borderRadius: 4, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>Ganztägig</span>}
                      {e.type === "google" && (
                        <span style={{ fontSize: 9, fontFamily: FONT, color: "#5B8DEF", padding: "1px 6px", borderRadius: 4, background: "rgba(91,141,239,0.1)" }}>Google</span>
                      )}
                      {e.type === "task" && (
                        <span style={{ fontSize: 9, fontFamily: FONT, color: "#8B7AFF", padding: "1px 6px", borderRadius: 4, background: "rgba(139,122,255,0.1)" }}>Task</span>
                      )}
                      {e.project && (
                        <span style={{ fontSize: 9, fontFamily: FONT, color: theme.textFaint }}>{e.project}</span>
                      )}
                    </div>
                    {e.location && (
                      <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, marginTop: 4 }}>📍 {e.location}</div>
                    )}
                    {e.hangoutLink && (
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        onClick={() => openMeetCall(e.hangoutLink, e.title)}
                        style={{ display: "inline-block", fontSize: 11, fontFamily: FONT, color: "#00B894", marginTop: 6, cursor: "pointer", padding: "3px 10px", borderRadius: 6, background: "rgba(0,184,148,0.08)", border: "1px solid rgba(0,184,148,0.15)" }}
                      >🔗 Google Meet beitreten</motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* New Event Modal — rendered via Portal */}
      {showNewEvent && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={cancelNewEvent}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0] }}
            onClick={e => e.stopPropagation()}
            style={{ width: 420, background: darkMode ? "rgba(28,26,42,0.95)" : "rgba(255,255,255,0.97)", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, borderRadius: 20, padding: "28px 28px 24px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            <div style={{ fontSize: 18, fontFamily: FONT, fontWeight: 600, color: theme.text, marginBottom: 20, letterSpacing: -0.3 }}>{t("cal.newEvent")}</div>

            {/* Title */}
            <input
              value={eventForm.title}
              onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t("cal.title")}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: theme.text, fontSize: 14, fontFamily: FONT, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
            />

            {/* Date */}
            <input
              type="date"
              value={eventForm.date}
              onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: theme.text, fontSize: 13, fontFamily: FONT, outline: "none", marginBottom: 12, boxSizing: "border-box", colorScheme: darkMode ? "dark" : "light" }}
            />

            {/* Team Event toggle */}
            {userOrg?.id && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setEventForm(f => ({ ...f, isTeamEvent: !f.isTeamEvent, withMeet: f.isTeamEvent ? f.withMeet : false }))}
                  style={{ width: 36, height: 20, borderRadius: 10, background: eventForm.isTeamEvent ? "rgba(139,122,255,0.4)" : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"), cursor: "pointer", position: "relative", transition: "background 0.2s" }}
                >
                  <motion.div animate={{ x: eventForm.isTeamEvent ? 17 : 2 }} transition={{ duration: 0.2 }}
                    style={{ width: 16, height: 16, borderRadius: "50%", background: eventForm.isTeamEvent ? "#8B7AFF" : theme.textDim, position: "absolute", top: 2 }} />
                </motion.div>
                <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textSub }}>Team Event</span>
                <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim }}>{eventForm.isTeamEvent ? "Sichtbar für alle" : "Nur Google Calendar"}</span>
              </div>
            )}

            {/* Toggles row */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 12 }}>
              {/* All day toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setEventForm(f => ({ ...f, allDay: !f.allDay }))}
                  style={{ width: 36, height: 20, borderRadius: 10, background: eventForm.allDay ? "rgba(139,122,255,0.4)" : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"), cursor: "pointer", position: "relative", transition: "background 0.2s" }}
                >
                  <motion.div animate={{ x: eventForm.allDay ? 17 : 2 }} transition={{ duration: 0.2 }}
                    style={{ width: 16, height: 16, borderRadius: "50%", background: eventForm.allDay ? "#8B7AFF" : theme.textDim, position: "absolute", top: 2 }} />
                </motion.div>
                <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textSub }}>Ganztägig</span>
              </div>

              {/* Google Meet toggle (only for Google events) */}
              {!eventForm.isTeamEvent && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  onClick={() => toggleMeet(!eventForm.withMeet)}
                  style={{ width: 36, height: 20, borderRadius: 10, background: eventForm.withMeet ? "rgba(0,184,148,0.4)" : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"), cursor: meetLoading ? "wait" : "pointer", position: "relative", transition: "background 0.2s" }}
                >
                  <motion.div animate={{ x: eventForm.withMeet ? 17 : 2 }} transition={{ duration: 0.2 }}
                    style={{ width: 16, height: 16, borderRadius: "50%", background: eventForm.withMeet ? "#00B894" : theme.textDim, position: "absolute", top: 2 }} />
                </motion.div>
                <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textSub }}>Google Meet</span>
                {meetLoading && <span style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>Erstelle Link...</span>}
              </div>
              )}
            </div>

            {/* Meet Link display */}
            {meetLink && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(0,184,148,0.08)", border: "1px solid rgba(0,184,148,0.2)", display: "flex", alignItems: "center", gap: 10 }}
              >
                <span style={{ fontSize: 14 }}>📹</span>
                <a href={meetLink} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, fontSize: 12, fontFamily: FONT, color: "#00B894", textDecoration: "none", wordBreak: "break-all" }}>
                  {meetLink}
                </a>
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => { navigator.clipboard.writeText(meetLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                  style={{ cursor: "pointer", padding: "5px 12px", borderRadius: 8, fontSize: 11, fontFamily: FONT, fontWeight: 500, color: linkCopied ? "#00B894" : theme.text, background: linkCopied ? "rgba(0,184,148,0.15)" : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"), border: `1px solid ${linkCopied ? "rgba(0,184,148,0.3)" : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)")}`, transition: "all 0.2s", whiteSpace: "nowrap" }}
                >
                  {linkCopied ? "✓ Kopiert" : "Kopieren"}
                </motion.div>
              </motion.div>
            )}

            {/* Attendees (shown when Meet is on) */}
            {eventForm.withMeet && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ marginBottom: 12 }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, marginBottom: 6 }}>Teilnehmer</div>
                {/* Attendee chips */}
                {attendees.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {attendees.map((email, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 12px", borderRadius: 20, background: darkMode ? "rgba(139,122,255,0.1)" : "rgba(108,92,231,0.08)", border: `1px solid ${darkMode ? "rgba(139,122,255,0.2)" : "rgba(108,92,231,0.15)"}`, fontSize: 12, fontFamily: FONT, color: theme.text }}
                      >
                        <span>{email}</span>
                        <motion.span
                          whileHover={{ scale: 1.2 }}
                          onClick={() => setAttendees(a => a.filter((_, idx) => idx !== i))}
                          style={{ cursor: "pointer", color: theme.textDim, fontSize: 14, lineHeight: 1 }}
                        >×</motion.span>
                      </motion.div>
                    ))}
                  </div>
                )}
                {/* Input */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={attendeeInput}
                    onChange={e => setAttendeeInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === "Enter" || e.key === ",") && attendeeInput.trim()) {
                        e.preventDefault();
                        const email = attendeeInput.trim().replace(/,$/,"");
                        if (email && email.includes("@") && !attendees.includes(email)) {
                          setAttendees(a => [...a, email]);
                        }
                        setAttendeeInput("");
                      }
                    }}
                    placeholder={t("cal.addGuest")}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: theme.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
                  />
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const email = attendeeInput.trim().replace(/,$/,"");
                      if (email && email.includes("@") && !attendees.includes(email)) {
                        setAttendees(a => [...a, email]);
                      }
                      setAttendeeInput("");
                    }}
                    style={{ cursor: "pointer", padding: "8px 14px", borderRadius: 10, fontSize: 12, fontFamily: FONT, color: "#8B7AFF", background: darkMode ? "rgba(139,122,255,0.1)" : "rgba(108,92,231,0.08)", border: `1px solid ${darkMode ? "rgba(139,122,255,0.2)" : "rgba(108,92,231,0.15)"}`, whiteSpace: "nowrap" }}
                  >
                    Hinzufügen
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Time pickers (hidden when all-day) */}
            {!eventForm.allDay && (
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, marginBottom: 4 }}>Von</div>
                  <input
                    type="time"
                    value={eventForm.startTime}
                    onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: theme.text, fontSize: 13, fontFamily: FONT, outline: "none", boxSizing: "border-box", colorScheme: darkMode ? "dark" : "light" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, marginBottom: 4 }}>Bis</div>
                  <input
                    type="time"
                    value={eventForm.endTime}
                    onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: theme.text, fontSize: 13, fontFamily: FONT, outline: "none", boxSizing: "border-box", colorScheme: darkMode ? "dark" : "light" }}
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <textarea
              value={eventForm.description}
              onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t("cal.description")}
              rows={3}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: theme.text, fontSize: 13, fontFamily: FONT, outline: "none", resize: "vertical", marginBottom: 20, boxSizing: "border-box" }}
            />

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={cancelNewEvent}
                style={{ cursor: "pointer", padding: "9px 20px", borderRadius: 10, fontSize: 13, fontFamily: FONT, color: theme.textSub, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.borderFaint}` }}>
                {t("common.cancel")}
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={eventForm.isTeamEvent ? createTeamEvent : createGoogleEvent}
                style={{ cursor: savingEvent ? "wait" : "pointer", padding: "9px 24px", borderRadius: 10, fontSize: 13, fontFamily: FONT, color: darkMode ? "#fff" : "#1a1a2e", fontWeight: 500, background: savingEvent ? (darkMode ? "rgba(139,122,255,0.15)" : "rgba(108,92,231,0.1)") : (darkMode ? "rgba(139,122,255,0.3)" : "rgba(108,92,231,0.2)"), border: `1px solid ${darkMode ? "rgba(139,122,255,0.4)" : "rgba(108,92,231,0.3)"}`, opacity: (!eventForm.title.trim() || savingEvent) ? 0.5 : 1 }}>
                {savingEvent ? t("cal.saving") : t("cal.createEvent")}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}

      {/* Delete/Cancel Event Confirmation — rendered via Portal */}
      {confirmDeleteEvent && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !deletingEvent && setConfirmDeleteEvent(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0] }}
            onClick={e => e.stopPropagation()}
            style={{ width: 380, background: darkMode ? "rgba(28,26,42,0.95)" : "rgba(255,255,255,0.97)", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`, borderRadius: 20, padding: "28px 28px 24px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            {/* Warning icon */}
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(232,67,67,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 22 }}>⚠️</div>

            <div style={{ fontSize: 17, fontFamily: FONT, fontWeight: 600, color: theme.text, marginBottom: 8, letterSpacing: -0.3 }}>{t("cal.cancelEvent")}</div>

            <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textSub, marginBottom: 6, lineHeight: 1.5 }}>
              Möchtest du dieses Event wirklich löschen?
            </div>

            {/* Event preview */}
            <div style={{ padding: "10px 14px", borderRadius: 10, background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.borderFaint}`, marginBottom: 20, borderLeft: `3px solid ${confirmDeleteEvent.color}` }}>
              <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text }}>{confirmDeleteEvent.title}</div>
              {confirmDeleteEvent.start && !confirmDeleteEvent.allDay && (
                <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 3 }}>
                  {new Date(confirmDeleteEvent.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  {confirmDeleteEvent.end && ` – ${new Date(confirmDeleteEvent.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                </div>
              )}
              {confirmDeleteEvent.allDay && (
                <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, marginTop: 3 }}>Ganztägig</div>
              )}
            </div>

            <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 16 }}>
              Alle Teilnehmer werden per E-Mail benachrichtigt.
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => !deletingEvent && setConfirmDeleteEvent(null)}
                style={{ cursor: "pointer", padding: "9px 20px", borderRadius: 10, fontSize: 13, fontFamily: FONT, color: theme.textSub, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.borderFaint}` }}>
                Behalten
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => deleteGoogleEvent(confirmDeleteEvent)}
                style={{ cursor: deletingEvent ? "wait" : "pointer", padding: "9px 24px", borderRadius: 10, fontSize: 13, fontFamily: FONT, color: "#fff", fontWeight: 500, background: deletingEvent ? "rgba(232,67,67,0.15)" : "rgba(232,67,67,0.25)", border: "1px solid rgba(232,67,67,0.4)", opacity: deletingEvent ? 0.5 : 1 }}>
                {deletingEvent ? t("cal.deleting") : t("cal.cancelEventBtn")}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}
    </motion.div>
  );
}

const FILE_TYPE_COLORS = {
  "application/pdf": "#E84393",
  "application/vnd.google-apps.document": "#5B8DEF",
  "application/vnd.google-apps.spreadsheet": "#00B894",
  "application/vnd.google-apps.presentation": "#F59E0B",
  "application/vnd.google-apps.folder": "#8B7AFF",
  "image/png": "#E88D67",
  "image/jpeg": "#E88D67",
  "image/svg+xml": "#FD79A8",
  "video/mp4": "#6C5CE7",
  "default": "#6BC5A0",
};

const STATUS_COLORS = {
  "Neu": "#ffffff40",
  "In Prüfung": "#F59E0B",
  "Freigegeben": "#00B894",
  "Kunden-Sichtbar": "#8B7AFF",
};

function formatFileSize(bytes) {
  if (!bytes) return "–";
  const n = parseInt(bytes);
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
  if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
  return (n / 1073741824).toFixed(1) + " GB";
}

function getFileExtension(name, mimeType) {
  if (name && name.includes(".")) return name.split(".").pop().toUpperCase();
  if (mimeType?.includes("document")) return "DOC";
  if (mimeType?.includes("spreadsheet")) return "SHEET";
  if (mimeType?.includes("presentation")) return "SLIDE";
  if (mimeType?.includes("folder")) return "FOLDER";
  if (mimeType?.includes("pdf")) return "PDF";
  if (mimeType?.includes("image")) return "IMG";
  if (mimeType?.includes("video")) return "VID";
  return "FILE";
}

function FilesView({ onBack, session, getProviderToken, autoReLogin, ensureValidToken, theme, darkMode, t, filesFilter = "all", setFilesFilter }) {
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch Google Drive files
  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use ensureValidToken for guaranteed fresh token
        let providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
        if (!providerToken) {
          setError(t ? t("error.noGoogleAccess") : "Kein Google Drive Zugriff.");
          setLoading(false);
          return;
        }

        let query = "trashed=false";
        if (currentFolder) {
          query += ` and '${currentFolder}' in parents`;
        } else {
          query += " and 'root' in parents";
        }

        let res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webViewLink)&orderBy=folder,name&pageSize=50`,
          { headers: { Authorization: `Bearer ${providerToken}` } }
        );

        // If 401, token was actually expired — force refresh and retry once
        if (res.status === 401 && autoReLogin) {
          console.log("[FilesView] 401 — forcing token refresh");
          const newToken = await autoReLogin();
          if (newToken) {
            res = await fetch(
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webViewLink)&orderBy=folder,name&pageSize=50`,
              { headers: { Authorization: `Bearer ${newToken}` } }
            );
          }
        }

        if (!res.ok) {
          setError(t ? t("error.loadFailed") : "Fehler beim Laden der Dateien.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setFiles(data.files || []);

        // Fetch metadata from Supabase
        const fileIds = (data.files || []).map(f => f.id);
        if (fileIds.length > 0) {
          const { data: metaData } = await supabase
            .from("file_metadata")
            .select("*")
            .in("google_file_id", fileIds);
          const metaMap = {};
          (metaData || []).forEach(m => { metaMap[m.google_file_id] = m; });
          setMetadata(metaMap);
        }
      } catch (err) {
        setError("Verbindungsfehler.");
      }
      setLoading(false);
    };
    fetchFiles();
  }, [session, currentFolder]);

  // File-type matchers for the menu sub-filters. Folders are ALWAYS kept so
  // navigation works regardless of which filter is active.
  const matchesTypeFilter = (f) => {
    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
    if (isFolder) return true;
    if (filesFilter === "all") return true;
    const mime = (f.mimeType || "").toLowerCase();
    const name = (f.name || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    if (filesFilter === "images") {
      return mime.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg","bmp","tiff","heic","avif"].includes(ext);
    }
    if (filesFilter === "videos") {
      return mime.startsWith("video/") || ["mp4","mov","avi","mkv","webm","m4v","wmv","flv","3gp","mpg","mpeg"].includes(ext);
    }
    if (filesFilter === "fonts") {
      return mime.includes("font") || ["ttf","otf","woff","woff2","eot","fon"].includes(ext);
    }
    if (filesFilter === "raw") {
      // Camera raw + uncompressed audio + lossless
      return ["raw","cr2","cr3","nef","arw","dng","orf","rw2","raf","sr2","srw","pef","wav","aiff","flac","alac"].includes(ext);
    }
    if (filesFilter === "links") {
      return mime === "application/vnd.google-apps.shortcut" || ext === "url" || ext === "webloc";
    }
    return true;
  };

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) && matchesTypeFilter(f));

  const navigateToFolder = (folder) => {
    setFolderPath(prev => [...prev, { id: currentFolder, name: folder.name }]);
    setCurrentFolder(folder.id);
    setSearch("");
  };

  const navigateBack = () => {
    if (folderPath.length > 0) {
      const prev = [...folderPath];
      const parent = prev.pop();
      setFolderPath(prev);
      setCurrentFolder(parent.id);
      setSearch("");
    }
  };

  const updateStatus = async (fileId, newStatus) => {
    const existing = metadata[fileId];
    if (existing) {
      await supabase.from("file_metadata").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("google_file_id", fileId);
    } else {
      await supabase.from("file_metadata").insert({ google_file_id: fileId, user_id: session.user.id, status: newStatus });
    }
    setMetadata(prev => ({ ...prev, [fileId]: { ...prev[fileId], google_file_id: fileId, status: newStatus } }));
  };

  const refreshFiles = () => {
    setLoading(true);
    setFiles([]);
    // Trigger re-fetch by toggling a dummy state
    setCurrentFolder(prev => prev);
    // Force useEffect by setting a new object reference
    const fetchAgain = async () => {
      setError(null);
      try {
        const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
        if (!providerToken) { setError("Kein Google Drive Zugriff."); setLoading(false); return; }
        let query = "trashed=false";
        if (currentFolder) { query += ` and '${currentFolder}' in parents`; }
        else { query += " and 'root' in parents"; }
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webViewLink)&orderBy=folder,name&pageSize=50`,
          { headers: { Authorization: `Bearer ${providerToken}` } }
        );
        if (!res.ok) { setError("Fehler beim Laden."); setLoading(false); return; }
        const data = await res.json();
        setFiles(data.files || []);
        const fileIds = (data.files || []).map(f => f.id);
        if (fileIds.length > 0) {
          const { data: metaData } = await supabase.from("file_metadata").select("*").in("google_file_id", fileIds);
          const metaMap = {};
          (metaData || []).forEach(m => { metaMap[m.google_file_id] = m; });
          setMetadata(metaMap);
        }
      } catch (err) { setError("Verbindungsfehler."); }
      setLoading(false);
    };
    fetchAgain();
  };

  const handleUpload = async (fileList) => {
    const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
    if (!providerToken) { setError("Kein Google Drive Zugriff. Bitte neu einloggen."); return; }
    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadProgress({ current: i + 1, total: fileList.length, name: file.name });
      try {
        // Build multipart upload request
        const metadataObj = { name: file.name };
        if (currentFolder) { metadataObj.parents = [currentFolder]; }

        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadataObj)], { type: "application/json" }));
        form.append("file", file);

        const res = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webViewLink",
          { method: "POST", headers: { Authorization: `Bearer ${providerToken}` }, body: form }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("Upload error:", errData);
          if (res.status === 403) {
            setError("Keine Upload-Berechtigung. Bitte neu einloggen für Drive-Zugriff.");
            break;
          }
        } else {
          const uploaded = await res.json();
          // Add to local file list
          setFiles(prev => [uploaded, ...prev]);
          // Create default metadata in Supabase
          await supabase.from("file_metadata").insert({
            google_file_id: uploaded.id,
            user_id: session.user.id,
            status: "Neu",
          }).then(() => {
            setMetadata(prev => ({ ...prev, [uploaded.id]: { google_file_id: uploaded.id, status: "Neu" } }));
          });
        }
      } catch (err) {
        console.error("Upload failed:", err);
        setError(`Upload fehlgeschlagen: ${file.name}`);
      }
    }
    setUploading(false);
    setUploadProgress(null);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateFolder = async () => {
    const providerToken = ensureValidToken ? await ensureValidToken() : (getProviderToken ? getProviderToken() : session?.provider_token);
    if (!providerToken) { setError("Kein Google Drive Zugriff."); return; }
    const folderName = prompt("Ordner Name:");
    if (!folderName) return;

    try {
      const metadataObj = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      };
      if (currentFolder) { metadataObj.parents = [currentFolder]; }

      const res = await fetch(
        "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,size,modifiedTime,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${providerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadataObj),
        }
      );
      if (res.ok) {
        const folder = await res.json();
        setFiles(prev => [folder, ...prev]);
      } else {
        setError("Ordner konnte nicht erstellt werden.");
      }
    } catch (err) {
      setError("Fehler beim Ordner erstellen.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 10, filter: "blur(4px)" }}
      transition={{ duration: 0.45, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: "20px 40px 80px",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 720, height: "100%",
        background: theme.cardBg,
        backdropFilter: "blur(40px)",
        border: `1px solid ${theme.borderFaint}`,
        borderRadius: 24, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header with folder path */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03, duration: 0.3 }}
          style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", gap: 8 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke={theme.accent} strokeWidth="1.5" fill="none" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: FONT, color: theme.textDim, overflow: "hidden" }}>
            <span onClick={() => { setCurrentFolder(null); setFolderPath([]); }} style={{ cursor: "pointer", color: theme.textSub }}>Drive</span>
            {folderPath.map((fp, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: theme.textFaint }}>/</span>
                <span onClick={() => {
                  setCurrentFolder(fp.id);
                  setFolderPath(prev => prev.slice(0, i));
                }} style={{ cursor: "pointer", color: theme.textSub }}>{fp.name}</span>
              </span>
            ))}
          </div>
        </motion.div>

        {/* Type filter chips */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3 }}
          style={{ padding: "10px 20px 0", display: "flex", gap: 6, flexWrap: "wrap" }}
        >
          {[
            { id: "all", label: "Alle" },
            { id: "images", label: "Bilder" },
            { id: "videos", label: "Videos" },
            { id: "fonts", label: "Fonts" },
            { id: "raw", label: "Raw" },
            { id: "links", label: "Links" },
          ].map(chip => {
            const active = filesFilter === chip.id;
            return (
              <motion.div key={chip.id} whileTap={{ scale: 0.96 }} whileHover={{ y: -1 }}
                onClick={() => { if (setFilesFilter) setFilesFilter(chip.id); }}
                style={{
                  padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                  fontSize: 12, fontFamily: FONT, fontWeight: 500,
                  background: active ? (darkMode ? "rgba(255,255,255,0.12)" : "#1a1a2e") : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"),
                  color: active ? "#fff" : theme.textDim,
                  border: `1px solid ${active ? "transparent" : theme.borderFaint}`,
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
              >{chip.label}</motion.div>
            );
          })}
        </motion.div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          style={{ padding: "10px 20px 8px" }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
            border: `1px solid ${theme.borderFaint}`,
            borderRadius: 14, padding: "10px 14px",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke={theme.textDim} strokeWidth="1.8" />
              <path d="M16 16l4.5 4.5" stroke={theme.textDim} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("files.search")}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 13, fontFamily: FONT, color: theme.text,
                caretColor: theme.accent,
              }}
            />
            {search && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSearch("")}
                style={{ cursor: "pointer", color: theme.textDim, fontSize: 12, fontFamily: FONT }}
              >✕</motion.div>
            )}
          </div>
        </motion.div>

        {/* File list — scrollable */}
        <div style={{
          padding: "4px 20px 12px", display: "flex", flexDirection: "column", gap: 4,
          overflowY: "auto", flex: 1, minHeight: 0,
        }}>
          {loading && (
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ padding: 40, textAlign: "center", fontSize: 13, fontFamily: FONT, color: theme.textDim }}
            >Loading files from Google Drive...</motion.div>
          )}

          {error && (
            <div style={{ padding: 32, textAlign: "center", fontSize: 13, fontFamily: FONT, color: "#E84393" }}>
              {error}
            </div>
          )}

          {!loading && !error && filtered.map((file, i) => {
            const isFolder = file.mimeType === "application/vnd.google-apps.folder";
            const color = FILE_TYPE_COLORS[file.mimeType] || FILE_TYPE_COLORS.default;
            const meta = metadata[file.id];
            const status = meta?.status || "Neu";

            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.025, duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
                className="hover-row"
                onClick={() => {
                  if (isFolder) { navigateToFolder(file); }
                  else { setSelectedFile(selectedFile?.id === file.id ? null : file); }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 14px", borderRadius: 14,
                  background: selectedFile?.id === file.id ? (theme.accent + "14") : theme.hoverBg,
                  border: `1px solid ${selectedFile?.id === file.id ? (theme.accent + "26") : theme.borderFaint}`,
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: file.thumbnailLink && !isFolder
                    ? `url(${file.thumbnailLink}) center/cover`
                    : `linear-gradient(135deg, ${color}40, ${color}15)`,
                  border: `1px solid ${color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, overflow: "hidden",
                }}>
                  {(!file.thumbnailLink || isFolder) && (
                    isFolder ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke={color} strokeWidth="1.5" fill={color + "20"} />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" fill="none" />
                        <circle cx="8.5" cy="8.5" r="2" fill={color} opacity="0.6" />
                        <path d="M3 16l5-5 4 4 3-3 6 6" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )
                  )}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                  <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    {formatFileSize(file.size)} · {getFileExtension(file.name, file.mimeType)}
                    {!isFolder && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 6, background: STATUS_COLORS[status] + "15", color: STATUS_COLORS[status], border: `1px solid ${STATUS_COLORS[status]}30` }}>{status}</span>
                    )}
                  </div>
                </div>
                {/* Arrow for folders */}
                {isFolder && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke={theme.textFaint} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </motion.div>
            );
          })}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", fontSize: 13, fontFamily: FONT, color: theme.textFaint }}>
              {files.length === 0
                ? t("files.empty")
                : (filesFilter !== "all"
                    ? `Keine ${{
                        images: "Bilder",
                        videos: "Videos",
                        fonts: "Fonts",
                        raw: "Raw-Dateien",
                        links: "Links",
                      }[filesFilter] || "Dateien"} in diesem Ordner`
                    : t("files.noResults"))}
            </div>
          )}
        </div>

        {/* File detail / status panel */}
        <AnimatePresence>
          {selectedFile && !selectedFile.mimeType?.includes("folder") && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0] }}
              style={{ borderTop: `1px solid ${theme.borderFaint}`, overflow: "hidden" }}
            >
              <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>Status:</span>
                {["Neu", "In Prüfung", "Freigegeben", "Kunden-Sichtbar"].map(s => (
                  <motion.div
                    key={s}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => updateStatus(selectedFile.id, s)}
                    style={{
                      padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                      fontSize: 11, fontFamily: FONT,
                      background: (metadata[selectedFile.id]?.status || "Neu") === s ? STATUS_COLORS[s] + "25" : theme.hoverBg,
                      color: (metadata[selectedFile.id]?.status || "Neu") === s ? STATUS_COLORS[s] : theme.textDim,
                      border: `1px solid ${(metadata[selectedFile.id]?.status || "Neu") === s ? STATUS_COLORS[s] + "40" : theme.borderFaint}`,
                    }}
                  >{s}</motion.div>
                ))}
                {selectedFile.webViewLink && (
                  <motion.a
                    href={selectedFile.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    style={{
                      marginLeft: "auto", padding: "4px 10px", borderRadius: 8,
                      fontSize: 11, fontFamily: FONT, color: theme.accent,
                      background: theme.accent + "1A", border: `1px solid ${theme.accent}33`,
                      textDecoration: "none",
                    }}
                  >In Google Drive öffnen ↗</motion.a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload progress bar */}
        <AnimatePresence>
          {uploading && uploadProgress && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ borderTop: `1px solid ${theme.borderFaint}`, overflow: "hidden" }}
            >
              <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  style={{ width: 16, height: 16, border: `2px solid ${theme.accent}4D`, borderTop: `2px solid ${theme.accent}`, borderRadius: "50%" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: FONT, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Uploading: {uploadProgress.name}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>
                    {uploadProgress.current} / {uploadProgress.total} Dateien
                  </div>
                </div>
                <div style={{
                  width: 80, height: 4, borderRadius: 2, background: theme.borderFaint,
                  overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    style={{ height: "100%", background: theme.accent, borderRadius: 2 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input for upload */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => { if (e.target.files?.length) handleUpload(Array.from(e.target.files)); }}
          style={{ display: "none" }}
        />

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          style={{
            padding: "12px 20px", borderTop: `1px solid ${theme.borderFaint}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <motion.div
              onClick={onBack}
              className="hover-back"
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "6px 14px", borderRadius: 10,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke={theme.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim }}>{t("common.back")}</span>
            </motion.div>
            {currentFolder && (
              <motion.div
                onClick={navigateBack}
                className="hover-back"
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                  padding: "6px 14px", borderRadius: 10,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke={theme.textDim} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim }}>Ordner zurück</span>
              </motion.div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, marginRight: 4 }}>
              {filtered.length} {filtered.length === 1 ? "file" : "files"}
            </div>
            {/* New Folder button */}
            <motion.div
              onClick={handleCreateFolder}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                fontSize: 12, fontFamily: FONT, fontWeight: 500, color: theme.textSub,
                background: theme.hoverBg, border: `1px solid ${theme.borderFaint}`,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke={theme.textDim} strokeWidth="1.5" fill="none" />
                <path d="M12 11v4M10 13h4" stroke={theme.textDim} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              + Neuer Ordner
            </motion.div>
            {/* Upload button */}
            <motion.div
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "6px 14px", borderRadius: 20, cursor: uploading ? "not-allowed" : "pointer",
                fontSize: 12, fontFamily: FONT, fontWeight: 500, color: uploading ? theme.textFaint : theme.accent,
                background: uploading ? theme.hoverBg : theme.accent + "15",
                border: `1px solid ${uploading ? theme.borderFaint : theme.accent + "30"}`,
                display: "flex", alignItems: "center", gap: 5,
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Upload
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

const CHAT_COLORS = ["#E88D67", "#5B8DEF", "#8B7AFF", "#6BC5A0", "#F59E0B", "#E84393", "#00B894", "#FD79A8"];

function ChatView({ onBack, initialTab = "Team", initialConvId, onConvOpened, t, session, userOrg, orgMembers, darkMode, theme, createNotification, notifications = [], markNotifRead }) {
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null); // { file, previewUrl }
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState("smileys");
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const myId = session?.user?.id;

  // ── Dictation: voice-to-text for the message input ──
  const startChatDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Spracherkennung wird in diesem Browser nicht unterstützt. Bitte Chrome oder Safari verwenden."); return; }
    if (isRecording) { stopChatDictation(); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;
    let baseText = msgInput;
    let needsSpace = baseText.length > 0 && !baseText.endsWith(" ");
    recognition.onresult = (event) => {
      let workingText = baseText;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          let cleaned = t.trim();
          if (cleaned.length > 0) {
            const prevChar = workingText.trim().slice(-1);
            if (!prevChar || prevChar === "." || prevChar === "!" || prevChar === "?") {
              cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }
          }
          workingText += (needsSpace ? " " : "") + cleaned;
          baseText = workingText;
          needsSpace = true;
        } else {
          // Show interim transcript in real-time
          workingText = baseText + (needsSpace ? " " : "") + t;
        }
        setMsgInput(workingText);
      }
    };
    recognition.onerror = (e) => { if (e.error !== "no-speech") console.error("Speech error:", e.error); };
    recognition.onend = () => { setIsRecording(false); recognitionRef.current = null; };
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const stopChatDictation = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsRecording(false);
  };

  // Cleanup on unmount
  useEffect(() => { return () => { if (recognitionRef.current) recognitionRef.current.stop(); }; }, []);

  // Compute unread chat notifications per conversation
  const unreadByConv = useMemo(() => {
    const map = {};
    (notifications || []).forEach(n => {
      if (n.type === "chat_message" && !n.read && n.metadata?.conversation_id) {
        const cid = n.metadata.conversation_id;
        if (!map[cid]) map[cid] = [];
        map[cid].push(n);
      }
    });
    return map;
  }, [notifications]);

  // Build member lookup from orgMembers
  const memberMap = useMemo(() => {
    const map = {};
    (orgMembers || []).forEach((m, i) => {
      const p = m.profiles || {};
      map[m.user_id] = {
        user_id: m.user_id,
        display_name: p.display_name || "User",
        avatar_url: p.avatar_url || null,
        initials: (p.initials || (p.display_name || "U").slice(0, 2)).toUpperCase(),
        color: CHAT_COLORS[i % CHAT_COLORS.length],
      };
    });
    return map;
  }, [orgMembers]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!myId || !userOrg?.id) return;
    const { data: convs, error: convLoadErr } = await supabase
      .from("chat_conversations")
      .select("*, chat_participants(user_id), chat_messages(id, text, sender_id, created_at)")
      .eq("org_id", userOrg.id)
      .order("created_at", { ascending: false });
    if (!convs) { setConversations([]); setLoadingConvs(false); return; }
    // Build enriched conversation list
    const enriched = convs.map(c => {
      const participants = (c.chat_participants || []).map(p => p.user_id);
      const otherIds = participants.filter(id => id !== myId);
      const other = otherIds.length > 0 ? memberMap[otherIds[0]] : null;
      const msgs = c.chat_messages || [];
      const lastMsg = msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const name = c.is_group ? (c.name || "Gruppenchat") : (other?.display_name || "Unbekannt");
      const avatar_url = !c.is_group ? other?.avatar_url : null;
      const color = !c.is_group ? (other?.color || "#8B7AFF") : "#8B7AFF";
      const initials = !c.is_group ? (other?.initials || "?") : (c.name || "G").slice(0, 2).toUpperCase();
      // Time formatting
      let timeStr = "";
      if (lastMsg) {
        const d = new Date(lastMsg.created_at);
        const now = new Date();
        const diffH = (now - d) / 3600000;
        if (diffH < 1) timeStr = Math.round(diffH * 60) + " min";
        else if (diffH < 24) timeStr = Math.round(diffH) + "h";
        else timeStr = d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
      }
      return {
        id: c.id, name, avatar_url, color, initials, is_group: c.is_group,
        lastMsg: lastMsg?.text || "", time: timeStr,
        lastMsgAt: lastMsg?.created_at || c.created_at,
        participants, otherIds,
      };
    }).sort((a, b) => new Date(b.lastMsgAt) - new Date(a.lastMsgAt));
    setConversations(enriched);
    setLoadingConvs(false);
  }, [myId, userOrg?.id, memberMap]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Auto-open conversation from notification
  useEffect(() => {
    if (initialConvId && !loadingConvs) {
      openConversation(initialConvId);
      if (onConvOpened) onConvOpened();
    }
  }, [initialConvId, loadingConvs]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", activeConvId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
    };
    load();
  }, [activeConvId]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!activeConvId) return;
    const channel = supabase.channel("chat-" + activeConvId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
          // Also refresh conversation list to update last message
          loadConversations();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvId, loadConversations]);

  // Send message
  const handleAttachmentSelect = async (file) => {
    if (!file) return;
    const previewUrl = file.type?.startsWith("image/") ? URL.createObjectURL(file) : null;
    setPendingAttachment({ file, previewUrl });
  };

  const removePendingAttachment = () => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAttachmentAndSend = async (textPart) => {
    if (!pendingAttachment) return null;
    setUploadingAttachment(true);
    try {
      const file = pendingAttachment.file;
      const ext = file.name.split(".").pop();
      const safeName = file.name.replace(/[^\w.-]/g, "_");
      const path = `${myId}/${Date.now()}_${safeName}`;
      const { data: up, error } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type });
      if (error) { console.error("Upload error:", error); alert("Upload fehlgeschlagen: " + error.message); setUploadingAttachment(false); return null; }
      const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(up.path);
      setUploadingAttachment(false);
      return { url: pub.publicUrl, name: file.name, type: file.type, size: file.size };
    } catch (e) {
      console.error("Upload exception:", e);
      setUploadingAttachment(false);
      return null;
    }
  };

  const sendMessage = async () => {
    if ((!msgInput.trim() && !pendingAttachment) || !activeConvId || !myId) return;
    const text = msgInput.trim();
    let attachment = null;
    if (pendingAttachment) {
      attachment = await uploadAttachmentAndSend(text);
      if (!attachment) return; // upload failed, keep state for retry
    }
    setMsgInput("");
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    await supabase.from("chat_messages").insert({
      conversation_id: activeConvId,
      sender_id: myId,
      text: text || null,
      attachment_url: attachment?.url || null,
      attachment_name: attachment?.name || null,
      attachment_type: attachment?.type || null,
      attachment_size: attachment?.size || null,
    });
    // Notify other participants
    if (createNotification) {
      const myName = memberMap[myId]?.display_name || "Jemand";
      const { data: parts } = await supabase.from("chat_participants").select("user_id").eq("conversation_id", activeConvId);
      const recipientIds = (parts || []).map(p => p.user_id).filter(uid => uid !== myId);
      const notifBody = text
        ? (text.length > 80 ? text.slice(0, 80) + "…" : text)
        : (attachment ? `📎 ${attachment.name}` : "Neue Nachricht");
      recipientIds.forEach(uid => {
        createNotification({
          userId: uid,
          type: "chat_message",
          title: `Neue Nachricht von ${myName}`,
          body: notifBody,
          metadata: { conversation_id: activeConvId },
        });
      });
    }
  };

  // Start new direct conversation
  const startConversation = async (otherUserId) => {
    if (!myId || !userOrg?.id) return;
    // Check if a direct conversation already exists between these two users
    const existing = conversations.find(c => !c.is_group && c.otherIds.includes(otherUserId));
    if (existing) { openConversation(existing.id); return; }
    try {
      // Create new conversation
      const { data: conv, error: convErr } = await supabase.from("chat_conversations").insert({ org_id: userOrg.id, is_group: false }).select().single();
      if (convErr || !conv) return;
      // Add both participants
      const { data: partData, error: partErr } = await supabase.from("chat_participants").insert([
        { conversation_id: conv.id, user_id: myId },
        { conversation_id: conv.id, user_id: otherUserId },
      ]).select();
      if (partErr) return;
      setShowNewChat(false);
      await loadConversations();
      openConversation(conv.id);
    } catch (err) {
      console.error("startConversation failed:", err);
    }
  };

  // Open conversation and mark its chat notifications as read
  const openConversation = useCallback((convId) => {
    setActiveConvId(convId);
    if (markNotifRead && unreadByConv[convId]) {
      unreadByConv[convId].forEach(n => markNotifRead(n.id));
    }
  }, [markNotifRead, unreadByConv]);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const filtered = conversations.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.lastMsg.toLowerCase().includes(search.toLowerCase()));
  const otherMembers = Object.values(memberMap).filter(m => m.user_id !== myId);

  // Auto-scroll when messages change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 10, filter: "blur(4px)" }}
      transition={{ duration: 0.45, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{
        position: "absolute", inset: 0, display: "flex",
        padding: "24px 24px 24px 24px",
        zIndex: 5,
      }}
    >
      <div style={{
        width: "100%", height: "100%",
        background: darkMode ? "rgba(18, 18, 26, 0.85)" : "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(40px)",
        border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        borderRadius: 20, overflow: "hidden",
        display: "flex",
      }}>

        {/* ── Left Sidebar: Conversations ── */}
        <div style={{
          width: 340, minWidth: 340, display: "flex", flexDirection: "column",
          borderRight: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
          background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
        }}>
          {/* Search */}
          <div style={{ padding: "18px 16px 8px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}`,
              borderRadius: 12, padding: "9px 12px",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke={darkMode ? "#ffffff40" : "#00000040"} strokeWidth="1.8" />
                <path d="M16 16l4.5 4.5" stroke={darkMode ? "#ffffff40" : "#00000040"} strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Suchen..."
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  fontSize: 13, fontFamily: FONT, color: theme.text, caretColor: "#8B7AFF",
                }}
              />
              {search && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSearch("")}
                  style={{ cursor: "pointer", color: theme.textDim, fontSize: 11, fontFamily: FONT }}>✕</motion.div>
              )}
            </div>
          </div>

          {/* Conversation list — shows all team members, with existing chats on top */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            padding: "4px 8px", display: "flex", flexDirection: "column", gap: 2,
          }}>
            {loadingConvs ? (
              <div style={{ padding: 32, textAlign: "center", fontSize: 13, fontFamily: FONT, color: theme.textDim }}>Laden...</div>
            ) : (() => {
              // Build unified list: existing conversations + team members without conversations
              const membersWithConv = new Set();
              filtered.forEach(c => (c.otherIds || []).forEach(id => membersWithConv.add(id)));
              const membersWithoutConv = otherMembers.filter(m =>
                !membersWithConv.has(m.user_id) &&
                (m.display_name.toLowerCase().includes(search.toLowerCase()) || !search)
              );
              const allItems = [
                ...filtered.map(c => ({ type: "conv", ...c })),
                ...membersWithoutConv.map(m => ({ type: "member", ...m })),
              ];
              if (allItems.length === 0) return (
                <div style={{ padding: 32, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.2 }}>💬</div>
                  <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim }}>Keine Ergebnisse</div>
                </div>
              );
              return allItems.map((item, i) => {
                if (item.type === "conv") {
                  const isActive = activeConvId === item.id;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 + i * 0.025, duration: 0.25 }}
                      onClick={() => openConversation(item.id)}
                      className={isActive ? "" : "hover-row"}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 12px", borderRadius: 12, cursor: "pointer",
                        background: isActive ? (darkMode ? "rgba(139, 122, 255, 0.12)" : "rgba(139, 122, 255, 0.1)") : "transparent",
                        border: `1px solid ${isActive ? "rgba(139, 122, 255, 0.2)" : "transparent"}`,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        {item.avatar_url ? (
                          <img src={item.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 42, height: 42, borderRadius: "50%" }} />
                        ) : (
                          <div style={{
                            width: 42, height: 42, borderRadius: "50%",
                            background: `linear-gradient(135deg, ${item.color}50, ${item.color}20)`,
                            border: `1px solid ${item.color}40`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 600, fontFamily: FONT, color: item.color,
                          }}>{item.initials}</div>
                        )}
                      </div>
                      {(() => {
                        const unreadN = (unreadByConv[item.id] || []).length;
                        return (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: unreadN > 0 ? 600 : 500, color: theme.text }}>{item.name}</div>
                                {unreadN > 0 && (
                                  <div style={{
                                    minWidth: 18, height: 18, borderRadius: 9, padding: "0 5px",
                                    background: "#8B7AFF", color: "#fff",
                                    fontSize: 10, fontWeight: 700, fontFamily: FONT,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}>{unreadN > 9 ? "9+" : unreadN}</div>
                                )}
                              </div>
                              <div style={{ fontSize: 10, fontFamily: FONT, color: unreadN > 0 ? "#8B7AFF" : theme.textDim, flexShrink: 0 }}>{item.time}</div>
                            </div>
                            <div style={{
                              fontSize: 12, fontFamily: FONT, color: unreadN > 0 ? theme.text : theme.textDim, marginTop: 2,
                              fontWeight: unreadN > 0 ? 500 : 400,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>{item.lastMsg || "Noch keine Nachrichten"}</div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  );
                }
                // Team member without existing conversation
                return (
                  <motion.div
                    key={"m-" + item.user_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 + i * 0.025, duration: 0.25 }}
                    onClick={() => startConversation(item.user_id)}
                    className="hover-row"
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 12px", borderRadius: 12, cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {item.avatar_url ? (
                        <img src={item.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 42, height: 42, borderRadius: "50%" }} />
                      ) : (
                        <div style={{
                          width: 42, height: 42, borderRadius: "50%",
                          background: `linear-gradient(135deg, ${item.color}50, ${item.color}20)`,
                          border: `1px solid ${item.color}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 600, fontFamily: FONT, color: item.color,
                        }}>{item.initials}</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 500, color: theme.text }}>{item.display_name}</div>
                      <div style={{
                        fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2,
                      }}>Nachricht schreiben…</div>
                    </div>
                  </motion.div>
                );
              });
            })()}
          </div>
        </div>

        {/* ── Right: Chat Window ── */}
        {activeConv ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Chat Header */}
            <div style={{
              padding: "14px 24px", borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                {activeConv.avatar_url ? (
                  <img src={activeConv.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 38, height: 38, borderRadius: "50%" }} />
                ) : (
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${activeConv.color}50, ${activeConv.color}20)`,
                    border: `1px solid ${activeConv.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 600, fontFamily: FONT, color: activeConv.color,
                  }}>{activeConv.initials}</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text }}>{activeConv.name}</div>
                <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>Direkte Nachricht</div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{
              flex: 1, minHeight: 0, overflowY: "auto",
              padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8,
            }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>👋</div>
                  <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim }}>Sag Hallo!</div>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === myId;
                const sender = memberMap[msg.sender_id] || { display_name: "Unbekannt", initials: "?", color: "#888" };
                const msgTime = new Date(msg.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.25 }}
                    style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: 10 }}
                  >
                    {!isMe && (
                      sender.avatar_url ? (
                        <img src={sender.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                          background: `linear-gradient(135deg, ${sender.color}50, ${sender.color}20)`,
                          border: `1px solid ${sender.color}30`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 600, fontFamily: FONT, color: sender.color,
                        }}>{sender.initials}</div>
                      )
                    )}
                    <div style={{ maxWidth: "65%" }}>
                      <div style={{
                        fontSize: 11, fontFamily: FONT, marginBottom: 4,
                        color: theme.textDim,
                        textAlign: isMe ? "right" : "left",
                      }}>
                        {isMe ? "Du" : sender.display_name} · {msgTime}
                      </div>
                      <div style={{
                        padding: msg.attachment_url && !msg.text ? 4 : "10px 16px",
                        borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        background: isMe
                          ? (darkMode ? "linear-gradient(135deg, rgba(139, 122, 255, 0.2), rgba(100, 80, 220, 0.15))" : "linear-gradient(135deg, rgba(139, 122, 255, 0.15), rgba(100, 80, 220, 0.1))")
                          : (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                        border: `1px solid ${isMe ? "rgba(139, 122, 255, 0.15)" : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}`,
                        fontSize: 13, fontFamily: FONT, color: theme.text, lineHeight: 1.55,
                        overflow: "hidden",
                      }}>
                        {msg.attachment_url && (
                          msg.attachment_type?.startsWith("image/") ? (
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: msg.text ? 8 : 0 }}>
                              <img src={msg.attachment_url} alt={msg.attachment_name} style={{ maxWidth: 280, maxHeight: 280, borderRadius: 10, display: "block", cursor: "pointer" }} />
                            </a>
                          ) : (
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "8px 10px", borderRadius: 10,
                                background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                                textDecoration: "none", color: theme.text,
                                marginBottom: msg.text ? 8 : 0,
                                minWidth: 200,
                              }}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(139,122,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B7AFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{msg.attachment_name}</div>
                                {msg.attachment_size && (
                                  <div style={{ fontSize: 11, color: theme.textDim }}>
                                    {msg.attachment_size < 1024 ? msg.attachment_size + " B" : msg.attachment_size < 1048576 ? (msg.attachment_size/1024).toFixed(1) + " KB" : (msg.attachment_size/1048576).toFixed(1) + " MB"}
                                  </div>
                                )}
                              </div>
                            </a>
                          )
                        )}
                        {msg.text && <div style={{ padding: msg.attachment_url ? "0 12px 6px" : 0 }}>{msg.text}</div>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Message Input */}
            <div style={{
              padding: 16, borderTop: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
            }}>
              {/* Pending attachment chip */}
              {pendingAttachment && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 10,
                    padding: 6, paddingRight: 10, borderRadius: 12,
                    background: darkMode ? "rgba(139,122,255,0.10)" : "rgba(139,122,255,0.10)",
                    border: "1px solid rgba(139,122,255,0.25)",
                  }}
                >
                  {pendingAttachment.previewUrl ? (
                    <img src={pendingAttachment.previewUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(139,122,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8B7AFF" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                  )}
                  <div style={{ minWidth: 0, maxWidth: 220 }}>
                    <div style={{ fontSize: 12, fontFamily: FONT, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{pendingAttachment.file.name}</div>
                    <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim }}>
                      {pendingAttachment.file.size < 1024 ? pendingAttachment.file.size + " B" : pendingAttachment.file.size < 1048576 ? (pendingAttachment.file.size/1024).toFixed(1) + " KB" : (pendingAttachment.file.size/1048576).toFixed(1) + " MB"}
                    </div>
                  </div>
                  <motion.div whileTap={{ scale: 0.9 }} onClick={removePendingAttachment}
                    style={{ width: 22, height: 22, borderRadius: "50%", background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.textDim, fontSize: 12 }}
                  >✕</motion.div>
                </motion.div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                style={{ display: "none" }}
                onChange={(e) => handleAttachmentSelect(e.target.files?.[0])}
              />
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                borderRadius: 16, padding: 10,
              }}>
                <motion.div
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Datei anhängen"
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0,
                    color: darkMode ? "#ffffff90" : "#1a1a2eAA",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                  animate={isRecording ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={isRecording ? { repeat: Infinity, duration: 1.2 } : { duration: 0.2 }}
                  onClick={startChatDictation}
                  title={isRecording ? "Aufnahme stoppen" : "Diktieren"}
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: isRecording ? "rgba(239, 68, 68, 0.15)" : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    border: isRecording ? "1px solid rgba(239, 68, 68, 0.35)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0,
                    color: isRecording ? "#EF4444" : (darkMode ? "#ffffff90" : "#1a1a2eAA"),
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 19v3M8 22h8"/></svg>
                </motion.div>
                <input
                  value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  placeholder={isRecording ? "Spricht..." : "Nachricht schreiben..."}
                  onKeyDown={e => { if (e.key === "Enter" && msgInput.trim()) sendMessage(); }}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    padding: "0 8px",
                    fontSize: 14, fontFamily: FONT, color: theme.text, caretColor: "#8B7AFF",
                  }}
                />
                {/* Emoji picker button — right side */}
                <div style={{ position: "relative" }}>
                  <motion.div
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                    onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                    title="Emoji"
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: emojiPickerOpen ? (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)") : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", flexShrink: 0,
                      color: darkMode ? "#ffffff90" : "#1a1a2eAA",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                      <line x1="9" y1="9" x2="9.01" y2="9"/>
                      <line x1="15" y1="9" x2="15.01" y2="9"/>
                    </svg>
                  </motion.div>
                  <AnimatePresence>
                    {emojiPickerOpen && (
                      <>
                        <div onClick={() => setEmojiPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.96 }}
                          transition={{ duration: 0.18 }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute", bottom: "calc(100% + 10px)", right: 0,
                            width: 320, height: 280,
                            background: darkMode ? "rgba(28,28,38,0.98)" : "rgba(255,255,255,0.99)",
                            border: `1px solid ${theme.border}`,
                            borderRadius: 16, overflow: "hidden",
                            boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
                            display: "flex", flexDirection: "column", zIndex: 31,
                          }}
                        >
                          <div style={{ display: "flex", borderBottom: `1px solid ${theme.borderFaint}`, padding: 4 }}>
                            {[
                              { id: "smileys", icon: "😀" },
                              { id: "gestures", icon: "👋" },
                              { id: "hearts", icon: "❤️" },
                              { id: "objects", icon: "🎉" },
                            ].map(t => (
                              <motion.div key={t.id} whileTap={{ scale: 0.92 }}
                                onClick={() => setEmojiTab(t.id)}
                                style={{
                                  flex: 1, padding: "8px 0", borderRadius: 10, cursor: "pointer",
                                  textAlign: "center", fontSize: 18,
                                  background: emojiTab === t.id ? (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                                }}
                              >{t.icon}</motion.div>
                            ))}
                          </div>
                          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2 }}>
                              {EMOJI_GROUPS[emojiTab].map((emoji, i) => (
                                <motion.div key={emoji + i} whileHover={{ scale: 1.25, background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} whileTap={{ scale: 0.9 }}
                                  onClick={() => { setMsgInput(prev => prev + emoji); }}
                                  style={{
                                    width: 34, height: 34, borderRadius: 8,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: "pointer", fontSize: 20, lineHeight: 1,
                                  }}
                                >{emoji}</motion.div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                {(() => {
                  const canSend = (msgInput.trim() || pendingAttachment) && !uploadingAttachment;
                  return (
                    <motion.div
                      whileHover={canSend ? { scale: 1.05 } : {}} whileTap={canSend ? { scale: 0.9 } : {}}
                      onClick={canSend ? sendMessage : undefined}
                      style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: canSend ? "#8B7AFF" : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: canSend ? "pointer" : "default",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {uploadingAttachment ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                        </motion.div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12h14M12 5l7 7-7 7" stroke={canSend ? "#fff" : (darkMode ? "#ffffff30" : "#00000030")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </motion.div>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12,
            color: theme.textDim, fontSize: 14, fontFamily: FONT,
          }}>
            <div style={{ fontSize: 40, opacity: 0.15 }}>💬</div>
            <div>Wähle ein Gespräch oder starte ein neues</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTES VIEW — Bento-style note grid with inline editing
// ═══════════════════════════════════════════════════════════════
const NOTE_COLORS = {
  sand:     { light: "#FFF8E7", dark: "rgba(245, 220, 130, 0.12)", accent: "#D4A85A", border: "rgba(212, 168, 90, 0.25)" },
  rose:     { light: "#FFEAEC", dark: "rgba(255, 150, 170, 0.10)", accent: "#D67885", border: "rgba(214, 120, 133, 0.25)" },
  mint:     { light: "#E3F5EC", dark: "rgba(120, 230, 180, 0.10)", accent: "#5BA889", border: "rgba(91, 168, 137, 0.25)" },
  sky:      { light: "#E5F1FB", dark: "rgba(140, 200, 255, 0.10)", accent: "#5C8FB8", border: "rgba(92, 143, 184, 0.25)" },
  lavender: { light: "#EFEAFB", dark: "rgba(180, 160, 240, 0.10)", accent: "#7E6FB5", border: "rgba(126, 111, 181, 0.25)" },
  peach:    { light: "#FCE9DD", dark: "rgba(255, 180, 130, 0.10)", accent: "#C68460", border: "rgba(198, 132, 96, 0.25)" },
  sage:     { light: "#E8EFE3", dark: "rgba(170, 200, 140, 0.10)", accent: "#7A9560", border: "rgba(122, 149, 96, 0.25)" },
  stone:    { light: "#EFEDEA", dark: "rgba(180, 175, 170, 0.10)", accent: "#7A7570", border: "rgba(122, 117, 112, 0.25)" },
};

function NotesView({ onBack, session, userOrg, theme, darkMode, t, ensureValidToken, llmKeys, llmProvider }) {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterMode, setFilterMode] = useState("all"); // all | pinned | today | week | tag:xxx
  const [sortMode, setSortMode] = useState("updated"); // updated | created | alpha | shuffle
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null); // expanded-to-edit overlay
  const [colorPickerId, setColorPickerId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);
  const [mouseOnCard, setMouseOnCard] = useState({});
  const [projects, setProjects] = useState([]);
  const [projectMenuOpenFor, setProjectMenuOpenFor] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const recognitionRef = useRef(null);
  const dictationStartContentRef = useRef("");
  const saveTimersRef = useRef({});
  const rotationMapRef = useRef({}); // stable random rotation per note id

  // Load notes
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", session.user.id)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      setNotes(data || []);
      setLoading(false);
    })();
  }, [session?.user?.id]);

  // Load projects (same source as Kanban brands)
  useEffect(() => {
    if (!userOrg?.id) return;
    supabase.from("projects").select("*").eq("org_id", userOrg.id)
      .then(({ data }) => setProjects(data || []));
  }, [userOrg?.id]);

  // Rotation disabled per user feedback — cards stay aligned
  const getRotation = () => 0;

  const createNote = async (color = "sand") => {
    const colors = Object.keys(NOTE_COLORS);
    const randomColor = color === "sand" ? colors[Math.floor(Math.random() * colors.length)] : color;
    // If user is filtering by a project, new notes inherit that project
    let inheritProject = null;
    if (filterMode.startsWith("project:")) {
      inheritProject = filterMode.slice(8);
    } else if (filterMode === "private") {
      inheritProject = null;
    }
    const { data } = await supabase.from("notes").insert({
      user_id: session.user.id,
      org_id: userOrg?.id || null,
      content: "",
      color: randomColor,
      project_name: inheritProject,
    }).select().single();
    if (data) {
      setNotes(prev => [data, ...prev]);
      setExpandedId(data.id);
    }
  };

  const setNoteProject = async (id, projectName) => {
    updateNoteLocal(id, { project_name: projectName });
    setProjectMenuOpenFor(null);
    await supabase.from("notes").update({ project_name: projectName }).eq("id", id);
  };

  // ── Dictation with optional AI grammar polish ──
  const startDictation = (noteId) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Spracherkennung wird in diesem Browser nicht unterstützt. Bitte Chrome oder Safari verwenden."); return; }
    if (isRecording) { stopDictation(); return; }

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    dictationStartContentRef.current = note.content || "";
    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = note.content || "";
    let needsSpace = finalTranscript.length > 0 && !finalTranscript.endsWith(" ") && !finalTranscript.endsWith("\n");

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          let cleaned = t.trim();
          if (cleaned.length > 0) {
            const prevChar = finalTranscript.trim().slice(-1);
            if (!prevChar || prevChar === "." || prevChar === "!" || prevChar === "?" || prevChar === "\n") {
              cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }
          }
          const lastChar = cleaned.slice(-1);
          if (cleaned.length > 0 && !/[.!?,;:\n]/.test(lastChar)) cleaned += ".";
          finalTranscript += (needsSpace ? " " : "") + cleaned;
          needsSpace = true;
          updateContent(noteId, finalTranscript);
        }
      }
    };
    recognition.onerror = (e) => { if (e.error !== "no-speech") console.error("Speech error:", e.error); };
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      // After recording stops, polish the dictated portion with AI for grammar
      polishDictation(noteId);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const stopDictation = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsRecording(false);
  };

  const polishDictation = async (noteId) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const startContent = dictationStartContentRef.current;
    const dictatedPart = (note.content || "").slice(startContent.length).trim();
    if (!dictatedPart || dictatedPart.length < 8) return; // nothing to polish

    try {
      setPolishing(true);
      // Use the user's Google OAuth token to call Gemini via /api/chat-multi
      const oauthToken = ensureValidToken ? await ensureValidToken() : null;
      const apiKey = (llmKeys && llmProvider) ? llmKeys[llmProvider] : null;
      const provider = llmProvider || "gemini";

      const response = await fetch("/api/chat-multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: dictatedPart,
          systemPrompt: "Du bist ein Text-Editor. Korrigiere Grammatik, Rechtschreibung und Zeichensetzung des folgenden diktierten Texts auf Deutsch. Behalte den Sinn und den lockeren Sprachstil bei. Gib NUR den korrigierten Text zurück, ohne Anmerkungen oder Anführungszeichen.",
          provider,
          apiKey: apiKey || undefined,
          oauthToken: (!apiKey && oauthToken) ? oauthToken : undefined,
        }),
      });
      const data = await response.json();
      const polished = data?.content?.[0]?.text?.trim();
      if (polished && polished.length > 0 && polished !== dictatedPart) {
        // Replace the dictated tail with the polished version
        const newContent = startContent + (startContent && !startContent.endsWith("\n") && !startContent.endsWith(" ") ? " " : "") + polished;
        updateContent(noteId, newContent);
      }
    } catch (e) {
      console.warn("[Notes] Polish failed:", e.message);
    } finally {
      setPolishing(false);
    }
  };

  // Cleanup recognition on unmount
  useEffect(() => { return () => { if (recognitionRef.current) recognitionRef.current.stop(); }; }, []);

  const updateNoteLocal = (id, patch) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  };

  const updateContent = (id, content) => {
    updateNoteLocal(id, { content });
    if (saveTimersRef.current[id]) clearTimeout(saveTimersRef.current[id]);
    saveTimersRef.current[id] = setTimeout(async () => {
      await supabase.from("notes").update({ content, updated_at: new Date().toISOString() }).eq("id", id);
      delete saveTimersRef.current[id];
    }, 500);
  };

  const setColor = async (id, color) => {
    updateNoteLocal(id, { color });
    setColorPickerId(null);
    await supabase.from("notes").update({ color }).eq("id", id);
  };

  const togglePin = async (id) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const newPinned = !note.pinned;
    updateNoteLocal(id, { pinned: newPinned });
    await supabase.from("notes").update({ pinned: newPinned }).eq("id", id);
  };

  const deleteNote = async (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setConfirmDelete(null);
    if (expandedId === id) setExpandedId(null);
    await supabase.from("notes").delete().eq("id", id);
  };

  // Filter + search + sort
  const visibleNotes = useMemo(() => {
    let arr = [...notes];
    const s = search.trim().toLowerCase();
    if (s) arr = arr.filter(n => n.content.toLowerCase().includes(s));

    // Filter mode
    if (filterMode === "pinned") arr = arr.filter(n => n.pinned);
    else if (filterMode === "private") arr = arr.filter(n => !n.project_name);
    else if (filterMode.startsWith("project:")) {
      const projName = filterMode.slice(8);
      arr = arr.filter(n => n.project_name === projName);
    }

    // Sort
    if (sortMode === "updated") {
      arr.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
    } else if (sortMode === "created") {
      arr.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    } else if (sortMode === "alpha") {
      arr.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        return (a.content || "").localeCompare(b.content || "");
      });
    } else if (sortMode === "shuffle") {
      arr.sort(() => Math.random() - 0.5);
    }
    return arr;
  }, [notes, search, filterMode, sortMode]);

  // Helper: first line as title, rest as body
  const splitContent = (content) => {
    const trimmed = (content || "").trimStart();
    const newlineIdx = trimmed.indexOf("\n");
    if (newlineIdx === -1) return { title: trimmed, body: "" };
    return { title: trimmed.slice(0, newlineIdx), body: trimmed.slice(newlineIdx + 1).trimStart() };
  };

  // Bento sizing
  const getSpan = (content) => {
    const len = (content || "").length;
    if (len < 30) return { col: 1, row: 1 };
    if (len < 120) return { col: 1, row: 2 };
    if (len < 300) return { col: 2, row: 2 };
    return { col: 2, row: 3 };
  };

  // Mouse-tilt handler
  const handleCardMouseMove = (e, id) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseOnCard(prev => ({ ...prev, [id]: { x, y } }));
  };
  const handleCardMouseLeave = (id) => {
    setHoveredId(null);
    setMouseOnCard(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const renderCard = (note, idx) => {
    const palette = NOTE_COLORS[note.color] || NOTE_COLORS.sand;
    const bg = darkMode ? palette.dark : palette.light;
    const border = palette.border;
    const accent = palette.accent;
    const { title, body } = splitContent(note.content);
    const showColorPicker = colorPickerId === note.id;
    const span = getSpan(note.content);
    const rotation = note.pinned ? 0 : getRotation(note.id);
    const mouse = mouseOnCard[note.id] || { x: 0, y: 0 };
    const isHovered = hoveredId === note.id;
    const tiltX = isHovered ? mouse.y * -4 : 0;
    const tiltY = isHovered ? mouse.x * 4 : 0;

    return (
      <motion.div
        key={note.id}
        layout
        layoutId={`note-${note.id}`}
        initial={{ opacity: 0, scale: 0.7, rotate: rotation * 3, y: 20 }}
        animate={{ opacity: 1, scale: 1, rotate: rotation, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, rotate: rotation + 8, y: -20, filter: "blur(4px)" }}
        transition={{
          type: "spring", stiffness: 220, damping: 22,
          delay: idx * 0.04,
        }}
        whileHover={{ scale: 1.03, zIndex: 10 }}
        onMouseMove={(e) => handleCardMouseMove(e, note.id)}
        onMouseEnter={() => setHoveredId(note.id)}
        onMouseLeave={() => handleCardMouseLeave(note.id)}
        onClick={() => setExpandedId(note.id)}
        style={{
          gridColumn: `span ${span.col}`,
          gridRow: `span ${span.row}`,
          minHeight: span.row * 90,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 18,
          padding: "16px 18px",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          boxShadow: isHovered
            ? (darkMode ? "0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px " + border : "0 18px 38px rgba(0,0,0,0.12), 0 6px 14px rgba(0,0,0,0.06)")
            : (darkMode ? "0 4px 14px rgba(0,0,0,0.2)" : "0 3px 10px rgba(0,0,0,0.05)"),
          transform: `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
          transformStyle: "preserve-3d",
          transition: "box-shadow 0.25s ease, transform 0.15s ease",
          overflow: "hidden",
        }}
      >
        {/* Pin indicator */}
        {note.pinned && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            style={{
              position: "absolute", top: 10, right: 12,
              color: darkMode ? "rgba(255,255,255,0.65)" : "rgba(26,26,46,0.65)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6v5l3 3v3h-5v6l-1 1-1-1v-6H6v-3l3-3V4z"/></svg>
          </motion.div>
        )}

        <div style={{
          fontSize: 14, fontWeight: 600, fontFamily: FONT,
          color: darkMode ? "#fff" : "#1a1a2e",
          lineHeight: 1.35,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flexShrink: 0,
        }}>
          {title || <span style={{ color: darkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.28)", fontWeight: 400, fontStyle: "italic" }}>Leere Notiz</span>}
        </div>
        {body && (
          <div style={{
            fontSize: 13, fontFamily: FONT,
            color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
            lineHeight: 1.55, flex: 1,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "hidden",
          }}>{body}</div>
        )}

        {/* Action bar — only visible on hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              style={{
                position: "absolute", bottom: 10, right: 10,
                display: "flex", gap: 4, alignItems: "center",
                padding: 4, borderRadius: 10,
                background: darkMode ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.75)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.button whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.1 }} onClick={() => togglePin(note.id)} title={note.pinned ? "Entpinnen" : "Pinnen"}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={note.pinned ? "2" : "1.6"} strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6v5l3 3v3h-5v6l-1 1-1-1v-6H6v-3l3-3V4z"/></svg>
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.1 }} onClick={() => setColorPickerId(showColorPicker ? null : note.id)} title="Farbe"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, lineHeight: 1, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: accent }} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.1 }} onClick={() => setConfirmDelete(note)} title="Löschen"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: darkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Color picker popover — inline row, doesn't overflow card */}
        <AnimatePresence>
          {showColorPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", bottom: 8, left: 8, right: 8, zIndex: 15,
                padding: "6px 8px", borderRadius: 12,
                background: darkMode ? "rgba(28,28,38,0.96)" : "rgba(255,255,255,0.96)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${theme.border}`,
                boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
                display: "flex", justifyContent: "space-between", gap: 4,
              }}
            >
              {Object.entries(NOTE_COLORS).map(([key, c]) => (
                <motion.div key={key} whileHover={{ scale: 1.25 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setColor(note.id, key)}
                  style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: c.accent,
                    cursor: "pointer",
                    border: note.color === key ? `2px solid ${darkMode ? "#fff" : "#1a1a2e"}` : "2px solid transparent",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    flexShrink: 0,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const expandedNote = expandedId ? notes.find(n => n.id === expandedId) : null;
  const expandedPalette = expandedNote ? (NOTE_COLORS[expandedNote.color] || NOTE_COLORS.sand) : null;
  const expandedBg = expandedNote ? (darkMode ? expandedPalette.dark : expandedPalette.light) : "transparent";

  // Filter chips config — project-based (mirrors Kanban brands) + Privat + Gepinnt
  const filterChips = [
    { id: "all", label: "Alle", count: notes.length },
    { id: "pinned", label: "Gepinnt", count: notes.filter(n => n.pinned).length, icon: "pin" },
    ...projects.map(p => ({
      id: "project:" + p.name,
      label: p.name,
      count: notes.filter(n => n.project_name === p.name).length,
      logo: p.logo_url,
      color: p.color,
    })),
    { id: "private", label: "Privat", count: notes.filter(n => !n.project_name).length, icon: "lock" },
  ].filter(c => c.id === "all" || c.id === "private" || c.id.startsWith("project:") || c.count > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: 5,
        background: theme.bg,
        // Fade the whole view to transparent at the bottom so the dashboard's
        // gradient blob / nav bar reads cleanly underneath without a hard edge
        WebkitMaskImage: "linear-gradient(to bottom, black 0, black calc(100% - 220px), transparent calc(100% - 40px))",
        maskImage: "linear-gradient(to bottom, black 0, black calc(100% - 220px), transparent calc(100% - 40px))",
        overflow: "hidden",
      }}
    >
      {/* Floating toolbar — minimal, only filter chips + sort + search + new */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "24px 32px 16px",
        flexWrap: "wrap",
      }}>
        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {filterChips.map(chip => {
            const active = filterMode === chip.id;
            return (
              <motion.div key={chip.id} whileTap={{ scale: 0.96 }} whileHover={{ y: -1 }}
                onClick={() => setFilterMode(chip.id)}
                style={{
                  padding: chip.logo ? "4px 12px 4px 6px" : "6px 12px", borderRadius: 999, cursor: "pointer",
                  fontSize: 12, fontFamily: FONT, fontWeight: 500,
                  background: active ? (darkMode ? "rgba(255,255,255,0.12)" : "#1a1a2e") : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"),
                  color: active ? "#fff" : theme.textDim,
                  border: `1px solid ${active ? "transparent" : theme.borderFaint}`,
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
              >
                {chip.icon === "pin" && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6v5l3 3v3h-5v6l-1 1-1-1v-6H6v-3l3-3V4z"/></svg>
                )}
                {chip.icon === "lock" && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                )}
                {chip.logo && (
                  <img src={chip.logo} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
                )}
                {chip.label}
                {chip.count > 0 && (
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{chip.count}</span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Sort dropdown — small icon */}
        <div style={{ position: "relative" }}>
          <motion.div whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }}
            onClick={() => setSortMenuOpen(!sortMenuOpen)}
            style={{
              width: 32, height: 32, borderRadius: 10, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: theme.textDim, background: sortMenuOpen ? (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)") : "transparent",
            }}
            title="Sortieren"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M6 12h12M10 18h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </motion.div>
          <AnimatePresence>
            {sortMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20,
                  minWidth: 180, padding: 6, borderRadius: 12,
                  background: darkMode ? "rgba(28,28,38,0.98)" : "rgba(255,255,255,0.99)",
                  border: `1px solid ${theme.border}`,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
                }}
              >
                {[
                  { id: "updated", label: "Zuletzt bearbeitet" },
                  { id: "created", label: "Erstellt" },
                  { id: "alpha", label: "A → Z" },
                ].map(s => (
                  <motion.div key={s.id} whileHover={{ background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                    onClick={() => { setSortMode(s.id); setSortMenuOpen(false); }}
                    style={{
                      padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                      fontSize: 13, fontFamily: FONT,
                      color: sortMode === s.id ? theme.accent : theme.text,
                      fontWeight: sortMode === s.id ? 600 : 400,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    {s.label}
                    {sortMode === s.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search — clean width expand, no shape morph */}
        <motion.div
          animate={{ width: searchOpen ? 220 : 32 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          style={{
            display: "flex", alignItems: "center",
            height: 32,
            background: searchOpen ? (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)") : "transparent",
            border: `1px solid ${searchOpen ? theme.borderFaint : "transparent"}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <motion.div whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }}
            onClick={() => { setSearchOpen(true); }}
            style={{
              width: 32, height: 32, cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: theme.textDim,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M21 21l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </motion.div>
          <AnimatePresence>
            {searchOpen && (
              <motion.input
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => { if (!search.trim()) setSearchOpen(false); }}
                placeholder="Suchen..."
                autoFocus
                style={{
                  flex: 1, height: 32, background: "transparent", border: "none", outline: "none",
                  fontSize: 13, fontFamily: FONT, color: theme.text,
                  padding: "0 10px 0 0", minWidth: 0,
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* New note button */}
        <motion.button
          whileHover={{ scale: 1.05, y: -1 }} whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          onClick={() => createNote()}
          style={{
            padding: "8px 16px", borderRadius: 12,
            background: theme.accent + "22", border: `1px solid ${theme.accent}40`,
            color: theme.accent, fontSize: 13, fontWeight: 500, fontFamily: FONT,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Neue Notiz
        </motion.button>
      </div>

      {/* Content area — extends to bottom of viewport */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "8px 32px 120px", minHeight: 0,
      }}
        onDoubleClick={(e) => {
          // Double-click on empty area → create note
          if (e.target === e.currentTarget) createNote();
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: theme.textDim, fontFamily: FONT, fontSize: 13 }}>Lädt...</div>
        ) : visibleNotes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            style={{ textAlign: "center", padding: "80px 20px" }}
          >
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              style={{ fontSize: 44, marginBottom: 20, opacity: 0.5, display: "inline-block" }}
            >📝</motion.div>
            <div style={{ fontSize: 16, fontFamily: FONT, color: theme.text, marginBottom: 6 }}>
              {search ? "Keine Treffer" : filterMode !== "all" ? "Hier ist noch leer" : "Noch keine Notizen"}
            </div>
            <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, marginBottom: 24 }}>
              {search ? "Versuche einen anderen Suchbegriff" : 'Klicke auf "Neue Notiz" — oder doppelklicke irgendwo'}
            </div>
            {!search && filterMode === "all" && (
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => createNote()}
                style={{
                  padding: "10px 22px", borderRadius: 12,
                  background: theme.accent + "22", border: `1px solid ${theme.accent}40`,
                  color: theme.accent, fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: "pointer",
                }}
              >Erste Notiz erstellen</motion.button>
            )}
          </motion.div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gridAutoRows: "90px",
            gap: 16,
            paddingBottom: 40,
          }}>
            <AnimatePresence mode="popLayout">
              {visibleNotes.map((note, idx) => renderCard(note, idx))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Expanded note editor — shared layout for smooth zoom */}
      <AnimatePresence>
        {expandedNote && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => { stopDictation(); setExpandedId(null); }}
            style={{
              position: "fixed", inset: 0, zIndex: 150,
              background: darkMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
              backdropFilter: "blur(20px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "5vh 24px",
            }}
          >
            <motion.div
              layoutId={`note-${expandedNote.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 720, maxHeight: "90vh",
                background: expandedBg,
                border: `1px solid ${expandedPalette.border}`,
                borderRadius: 24,
                padding: "28px 32px 24px",
                display: "flex", flexDirection: "column",
                boxShadow: darkMode ? "0 30px 80px rgba(0,0,0,0.6)" : "0 30px 80px rgba(0,0,0,0.18)",
                overflow: "hidden",
              }}
            >
              {/* Action bar inside expanded view */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => togglePin(expandedNote.id)}
                    title={expandedNote.pinned ? "Entpinnen" : "Pinnen"}
                    style={{
                      width: 32, height: 32, borderRadius: 10, cursor: "pointer",
                      background: expandedNote.pinned ? (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent",
                      border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={expandedNote.pinned ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6v5l3 3v3h-5v6l-1 1-1-1v-6H6v-3l3-3V4z"/></svg>
                  </motion.button>
                  {/* Project chooser */}
                  <div style={{ position: "relative" }}>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setProjectMenuOpenFor(projectMenuOpenFor === expandedNote.id ? null : expandedNote.id)}
                      title="Projekt"
                      style={{
                        height: 32, padding: "0 12px", borderRadius: 10, cursor: "pointer",
                        background: expandedNote.project_name ? expandedPalette.accent + "15" : "transparent",
                        border: `1px solid ${expandedNote.project_name ? expandedPalette.accent + "30" : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)")}`,
                        display: "flex", alignItems: "center", gap: 6,
                        fontSize: 12, fontFamily: FONT, fontWeight: 500,
                        color: expandedNote.project_name ? expandedPalette.accent : (darkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)"),
                      }}
                    >
                      {expandedNote.project_name ? (() => {
                        const p = projects.find(pj => pj.name === expandedNote.project_name);
                        return p?.logo_url ? (
                          <img src={p.logo_url} alt="" style={{ width: 16, height: 16, borderRadius: 3, objectFit: "cover" }} />
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 10h18M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        );
                      })() : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      )}
                      {expandedNote.project_name || "Privat"}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </motion.button>
                    <AnimatePresence>
                      {projectMenuOpenFor === expandedNote.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          style={{
                            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30,
                            minWidth: 180, padding: 6, borderRadius: 12,
                            background: darkMode ? "rgba(28,28,38,0.98)" : "rgba(255,255,255,0.99)",
                            border: `1px solid ${theme.border}`,
                            boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
                          }}
                        >
                          <motion.div whileHover={{ background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                            onClick={() => setNoteProject(expandedNote.id, null)}
                            style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: FONT, color: !expandedNote.project_name ? theme.accent : theme.text, fontWeight: !expandedNote.project_name ? 600 : 400 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            Privat
                            {!expandedNote.project_name && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: "auto" }}><path d="M5 13l4 4L19 7" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </motion.div>
                          {projects.map(p => (
                            <motion.div key={p.id} whileHover={{ background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                              onClick={() => setNoteProject(expandedNote.id, p.name)}
                              style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: FONT, color: expandedNote.project_name === p.name ? theme.accent : theme.text, fontWeight: expandedNote.project_name === p.name ? 600 : 400 }}
                            >
                              {p.logo_url ? (
                                <img src={p.logo_url} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: 18, height: 18, borderRadius: 4, background: (p.color || "#8B7AFF") + "30" }} />
                              )}
                              {p.name}
                              {expandedNote.project_name === p.name && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: "auto" }}><path d="M5 13l4 4L19 7" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div style={{ position: "relative" }}>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setColorPickerId(colorPickerId === expandedNote.id ? null : expandedNote.id)}
                      style={{
                        width: 32, height: 32, borderRadius: 10, cursor: "pointer",
                        background: "transparent",
                        border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: expandedPalette.accent }} />
                    </motion.button>
                    <AnimatePresence>
                      {colorPickerId === expandedNote.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                          style={{
                            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
                            padding: 8, borderRadius: 12,
                            background: darkMode ? "rgba(28,28,38,0.98)" : "rgba(255,255,255,0.99)",
                            border: `1px solid ${theme.border}`,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
                          }}
                        >
                          {Object.entries(NOTE_COLORS).map(([key, c]) => (
                            <motion.div key={key} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                              onClick={() => setColor(expandedNote.id, key)}
                              style={{
                                width: 22, height: 22, borderRadius: "50%",
                                background: c.accent, cursor: "pointer",
                                border: expandedNote.color === key ? `2px solid ${darkMode ? "#fff" : "#000"}` : "2px solid transparent",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                              }}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* Dictation button */}
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => startDictation(expandedNote.id)}
                    title={isRecording ? "Aufnahme stoppen" : "Diktieren"}
                    animate={isRecording ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                    transition={isRecording ? { repeat: Infinity, duration: 1.2 } : { duration: 0.2 }}
                    style={{
                      width: 32, height: 32, borderRadius: 10, cursor: "pointer",
                      background: isRecording ? "rgba(239, 68, 68, 0.12)" : (polishing ? expandedPalette.accent + "15" : "transparent"),
                      border: `1px solid ${isRecording ? "rgba(239, 68, 68, 0.35)" : (polishing ? expandedPalette.accent + "30" : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"))}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isRecording ? "#EF4444" : (polishing ? expandedPalette.accent : (darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)")),
                    }}
                  >
                    {polishing ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                      </motion.div>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 19v3M8 22h8"/></svg>
                    )}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setConfirmDelete(expandedNote)}
                    title="Löschen"
                    style={{
                      width: 32, height: 32, borderRadius: 10, cursor: "pointer",
                      background: "transparent",
                      border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: darkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </motion.button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}>
                    {new Date(expandedNote.updated_at).toLocaleString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => { stopDictation(); setExpandedId(null); }}
                    style={{
                      width: 32, height: 32, borderRadius: 10, cursor: "pointer",
                      background: "transparent",
                      border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: theme.textDim, fontSize: 16,
                    }}
                  >✕</motion.button>
                </div>
              </div>

              <textarea
                value={expandedNote.content}
                onChange={(e) => updateContent(expandedNote.id, e.target.value)}
                placeholder={"Titel der Notiz...\n\nDann hier weiterschreiben."}
                autoFocus
                style={{
                  flex: 1, minHeight: 200, maxHeight: "70vh",
                  background: "transparent", border: "none", outline: "none", resize: "none",
                  fontFamily: FONT, fontSize: 15, lineHeight: 1.6,
                  color: darkMode ? "#fff" : "#1a1a2e",
                  caretColor: expandedPalette.accent,
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      {createPortal(<AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(null)}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 380, padding: 28, borderRadius: 20,
                background: darkMode ? "rgba(22,22,30,0.98)" : "rgba(255,255,255,0.99)",
                border: `1px solid ${theme.border}`,
                textAlign: "center",
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: theme.text, marginBottom: 8 }}>Notiz löschen?</div>
              <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, marginBottom: 24, lineHeight: 1.5 }}>
                Diese Aktion kann nicht rückgängig gemacht werden.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer", background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", border: `1px solid ${theme.borderFaint}`, fontSize: 13, fontFamily: FONT, color: theme.textSub, fontWeight: 500 }}
                >Abbrechen</motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => deleteNote(confirmDelete.id)}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: 13, fontFamily: FONT, color: "#EF4444", fontWeight: 600 }}
                >Löschen</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </motion.div>
  );
}
// ═══════════════════════════════════════════════════════════════
// PROJECTS VIEW — Files-style grid backed by the projects table
// (same data source as the Kanban brand chips)
// ═══════════════════════════════════════════════════════════════
function ProjectsView({ onBack, session, userOrg, theme, darkMode, t, onOpenInKanban, orgMembers = [], myProjectIds = [] }) {
  const [projects, setProjects] = useState([]);
  const [taskCounts, setTaskCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id, name, ...} = existing
  const [form, setForm] = useState({ name: "", logo_url: "", color: "#8B7AFF" });
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const logoInputRef = useRef(null);
  // Member management
  const [members, setMembers] = useState([]); // [{user_id, role, profile: {...}}]
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [userName] = useState(session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "");

  const loadProjects = async () => {
    if (!userOrg?.id) { setLoading(false); return; }
    const { data: prj } = await supabase.from("projects").select("*").eq("org_id", userOrg.id).order("created_at", { ascending: false });
    setProjects(prj || []);
    // Aggregate task counts per project
    const { data: tasks } = await supabase.from("tasks").select("project_name").eq("org_id", userOrg.id);
    const counts = {};
    (tasks || []).forEach(t => { if (t.project_name) counts[t.project_name] = (counts[t.project_name] || 0) + 1; });
    setTaskCounts(counts);
    setLoading(false);
  };

  useEffect(() => { loadProjects(); /* eslint-disable-next-line */ }, [userOrg?.id]);

  // Realtime: stay in sync with Kanban edits
  useEffect(() => {
    if (!userOrg?.id) return;
    const ch = supabase
      .channel("projects-view")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `org_id=eq.${userOrg.id}` }, () => loadProjects())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `org_id=eq.${userOrg.id}` }, () => loadProjects())
      .subscribe();
    return () => supabase.removeChannel(ch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userOrg?.id]);

  const openNew = () => {
    setEditing({});
    setForm({ name: "", logo_url: "", color: "#8B7AFF" });
    setLogoPreview(null);
  };

  const openEdit = (proj) => {
    setEditing(proj);
    setForm({ name: proj.name, logo_url: proj.logo_url || "", color: proj.color || "#8B7AFF" });
    setLogoPreview(null);
    setInviteEmail("");
    loadMembers(proj.id);
  };

  const closeEditor = () => {
    setEditing(null);
    setLogoPreview(null);
    setMembers([]);
    setPendingInvites([]);
    setInviteEmail("");
    setShowAddPicker(false);
    setPickerSearch("");
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // Add an existing org member to the project directly (no email invite needed).
  // Idempotent: silently ignores the unique-constraint error if the user is
  // already a member (which happens when the picker has stale data).
  const addOrgMemberDirectly = async (userId) => {
    if (!editing?.id) return;
    const { error } = await supabase.from("project_members").upsert({
      project_id: editing.id,
      user_id: userId,
      role: "member",
    }, { onConflict: "project_id,user_id", ignoreDuplicates: true });
    if (error && !/duplicate/i.test(error.message || "")) {
      alert("Fehler beim Hinzufügen: " + error.message);
      return;
    }
    loadMembers(editing.id);
  };

  const loadMembers = async (projectId) => {
    // Step 1: load membership rows (no join — there's no FK from
    // project_members to profiles, only to auth.users)
    const { data: pm, error } = await supabase
      .from("project_members")
      .select("user_id, role, joined_at")
      .eq("project_id", projectId);
    if (error) { console.warn("[ProjectsView] loadMembers failed:", error.message); setMembers([]); return; }

    // Step 2: enrich with profile data from the org's profiles
    const ids = (pm || []).map(r => r.user_id);
    let profilesMap = {};
    if (ids.length > 0) {
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, initials, email")
        .in("id", ids);
      if (pErr) console.warn("[ProjectsView] profiles fetch failed:", pErr.message);
      (profs || []).forEach(p => { profilesMap[p.id] = p; });
    }
    setMembers((pm || []).map(m => ({ ...m, profiles: profilesMap[m.user_id] || {} })));

    // Step 3: pending invitations
    const { data: inv } = await supabase
      .from("project_invitations")
      .select("id, email, created_at, expires_at, status")
      .eq("project_id", projectId)
      .eq("status", "pending");
    setPendingInvites(inv || []);
  };

  // ── Realtime: keep member list in sync while editor is open ──
  useEffect(() => {
    if (!editing?.id) return;
    const ch = supabase
      .channel("project-members-" + editing.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: `project_id=eq.${editing.id}` }, () => loadMembers(editing.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_invitations", filter: `project_id=eq.${editing.id}` }, () => loadMembers(editing.id))
      .subscribe();
    return () => supabase.removeChannel(ch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  const currentUserRole = editing?.id ? (members.find(m => m.user_id === session?.user?.id)?.role || null) : null;
  // Fallback: if the membership list hasn't loaded yet OR the user is just the
  // project's owner_id, treat them as owner. This way the Add button shows
  // immediately even if loadMembers is slow / fails.
  const isOwner = currentUserRole === "owner" || (editing?.id && editing?.owner_id === session?.user?.id);

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@") || !editing?.id) return;
    // Check if already a member
    const alreadyMember = members.some(m => m.profiles?.email?.toLowerCase() === email);
    if (alreadyMember) { alert("Diese Person ist bereits Mitglied."); return; }
    setInviteSending(true);
    try {
      const { data: inv, error } = await supabase
        .from("project_invitations")
        .insert({ project_id: editing.id, email, invited_by: session.user.id })
        .select()
        .single();
      if (error) throw error;
      // Send email
      try {
        await fetch("/api/send-project-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            token: inv.token,
            projectName: editing.name,
            inviterName: userName,
          }),
        });
      } catch (emailErr) { console.warn("Invite email send failed:", emailErr); }
      setInviteEmail("");
      loadMembers(editing.id);
    } catch (e) {
      alert("Einladung fehlgeschlagen: " + (e.message || "Unbekannter Fehler"));
    } finally {
      setInviteSending(false);
    }
  };

  const revokeInvite = async (inviteId) => {
    await supabase.from("project_invitations").delete().eq("id", inviteId);
    if (editing?.id) loadMembers(editing.id);
  };

  const removeMember = async (userId) => {
    if (!editing?.id) return;
    if (userId === session?.user?.id) { alert("Du kannst dich nicht selbst entfernen."); return; }
    await supabase.from("project_members").delete().eq("project_id", editing.id).eq("user_id", userId);
    loadMembers(editing.id);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoPreview(URL.createObjectURL(file));
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("project-logos").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("project-logos").getPublicUrl(path);
      setForm(prev => ({ ...prev, logo_url: pub.publicUrl }));
    } catch (err) {
      console.error("Logo upload failed:", err);
      alert("Logo Upload fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
    } finally {
      setLogoUploading(false);
    }
  };

  const saveProject = async () => {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), logo_url: form.logo_url || null, color: form.color };
    if (editing?.id) {
      // Update — also propagate rename to tasks
      if (editing.name !== payload.name) {
        await supabase.from("tasks").update({ project_name: payload.name }).eq("project_name", editing.name).eq("org_id", userOrg?.id);
      }
      await supabase.from("projects").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("projects").insert({ ...payload, owner_id: session.user.id, org_id: userOrg?.id || null });
    }
    closeEditor();
    loadProjects();
  };

  const removeLogo = () => { setForm(prev => ({ ...prev, logo_url: "" })); setLogoPreview(null); };

  const deleteProject = async () => {
    if (!confirmDelete) return;
    await supabase.from("projects").delete().eq("id", confirmDelete.id);
    setConfirmDelete(null);
    loadProjects();
  };

  // Only show projects the user is a member of
  const myIdSet = new Set(myProjectIds);
  const filtered = projects
    .filter(p => myIdSet.has(p.id))
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 10, filter: "blur(4px)" }}
      transition={{ duration: 0.45, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: "20px 40px 80px", zIndex: 5,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 720, height: "100%",
        background: theme.cardBg,
        backdropFilter: "blur(40px)",
        border: `1px solid ${theme.borderFaint}`,
        borderRadius: 24, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03, duration: 0.3 }}
          style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", gap: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="3" y="6" width="18" height="14" rx="2" stroke={theme.accent} strokeWidth="1.5"/>
            <path d="M3 10h18M9 6V4h6v2" stroke={theme.accent} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text }}>Projekte</span>
          <span style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim }}>{projects.length}</span>
          <div style={{ flex: 1 }} />
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={openNew}
            style={{
              padding: "7px 14px", borderRadius: 10, cursor: "pointer",
              background: theme.accent + "22", border: `1px solid ${theme.accent}40`,
              color: theme.accent, fontSize: 12, fontWeight: 500, fontFamily: FONT,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Neues Projekt
          </motion.button>
        </motion.div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          style={{ padding: "10px 20px 8px" }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
            border: `1px solid ${theme.borderFaint}`,
            borderRadius: 14, padding: "10px 14px",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke={theme.textDim} strokeWidth="1.8" />
              <path d="M16 16l4.5 4.5" stroke={theme.textDim} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Projekt suchen..."
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 13, fontFamily: FONT, color: theme.text, caretColor: theme.accent,
              }}
            />
            {search && (
              <motion.div whileTap={{ scale: 0.9 }} onClick={() => setSearch("")}
                style={{ width: 20, height: 20, borderRadius: "50%", background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.textDim, fontSize: 11 }}
              >✕</motion.div>
            )}
          </div>
        </motion.div>

        {/* Grid */}
        <div style={{
          padding: "4px 20px 12px", overflowY: "auto", flex: 1, minHeight: 0,
        }}>
          {loading && (
            <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ padding: 40, textAlign: "center", fontSize: 13, fontFamily: FONT, color: theme.textDim }}
            >Lade Projekte...</motion.div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📁</div>
              <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, marginBottom: 16 }}>
                {search ? "Keine Treffer" : "Noch keine Projekte"}
              </div>
              {!search && (
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openNew}
                  style={{
                    padding: "9px 18px", borderRadius: 10, cursor: "pointer",
                    background: theme.accent + "22", border: `1px solid ${theme.accent}40`,
                    color: theme.accent, fontSize: 13, fontWeight: 500, fontFamily: FONT,
                  }}
                >Erstes Projekt erstellen</motion.button>
              )}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 12 }}>
              {filtered.map((proj, i) => {
                const count = taskCounts[proj.name] || 0;
                const initial = (proj.name || "?")[0].toUpperCase();
                const color = proj.color || "#8B7AFF";
                return (
                  <motion.div key={proj.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + i * 0.025, duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
                    className="hover-row"
                    onClick={() => openEdit(proj)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 14px", borderRadius: 14,
                      background: theme.hoverBg,
                      border: `1px solid ${theme.borderFaint}`,
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    {/* Logo */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: proj.logo_url ? "transparent" : `linear-gradient(135deg, ${color}40, ${color}15)`,
                      border: `1px solid ${color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, overflow: "hidden",
                    }}>
                      {proj.logo_url ? (
                        <img src={proj.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ fontSize: 18, fontFamily: FONT, fontWeight: 600, color }}>{initial}</div>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{proj.name}</div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>
                        {count} {count === 1 ? "Task" : "Tasks"}
                      </div>
                    </div>
                    {/* Color indicator */}
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Editor modal */}
      {createPortal(<AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeEditor}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: darkMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 460,
                background: darkMode ? "rgba(22,22,30,0.98)" : "rgba(255,255,255,0.99)",
                border: `1px solid ${theme.border}`,
                borderRadius: 22, overflow: "hidden",
                boxShadow: "0 30px 80px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${theme.borderFaint}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: theme.text }}>
                  {editing?.id ? "Projekt bearbeiten" : "Neues Projekt"}
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }} onClick={closeEditor}
                  style={{ width: 32, height: 32, borderRadius: 10, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.textDim, fontSize: 16 }}
                >✕</motion.div>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>Name</label>
                  <input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus placeholder="z.B. Agency OS"
                    style={{
                      width: "100%", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                      border: `1px solid ${theme.borderFaint}`, borderRadius: 12,
                      padding: "11px 14px", fontSize: 14, fontFamily: FONT,
                      color: theme.text, outline: "none", caretColor: theme.accent,
                    }}
                  />
                </div>
                {/* Logo upload */}
                <div>
                  <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>Logo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {(logoPreview || form.logo_url) ? (
                      <div style={{ position: "relative" }}>
                        <img src={logoPreview || form.logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", border: `1px solid ${theme.borderFaint}` }} />
                        <motion.div whileTap={{ scale: 0.9 }} onClick={removeLogo}
                          style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#EF4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer", border: `2px solid ${darkMode ? "#16161e" : "#fff"}` }}
                        >✕</motion.div>
                      </div>
                    ) : (
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => logoInputRef.current?.click()}
                        style={{
                          width: 64, height: 64, borderRadius: 14, cursor: "pointer",
                          border: `2px dashed ${theme.border}`,
                          background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                          display: "flex", alignItems: "center", justifyContent: "center", color: theme.textFaint,
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                      </motion.div>
                    )}
                    <div style={{ flex: 1 }}>
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                        style={{
                          padding: "7px 14px", borderRadius: 10, cursor: "pointer",
                          background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                          border: `1px solid ${theme.borderFaint}`,
                          fontSize: 12, fontFamily: FONT, color: theme.textSub,
                          opacity: logoUploading ? 0.6 : 1,
                        }}
                      >{logoUploading ? "Lädt..." : (form.logo_url ? "Ersetzen" : "Logo hochladen")}</motion.button>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, marginTop: 6 }}>PNG/JPG/SVG, quadratisch ideal</div>
                    </div>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" style={{ display: "none" }} onChange={handleLogoUpload} />
                </div>
                {/* Color */}
                <div>
                  <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>Akzentfarbe</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {["#8B7AFF","#6C5CE7","#5BA889","#D67885","#D4A85A","#5A7AB5","#7A9560","#C68460"].map(c => (
                      <motion.div key={c} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                        onClick={() => setForm(prev => ({ ...prev, color: c }))}
                        style={{
                          width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                          border: form.color === c ? `2px solid ${darkMode ? "#fff" : "#1a1a2e"}` : "2px solid transparent",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        }}
                      />
                    ))}
                    <label style={{
                      width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
                      background: "conic-gradient(from 0deg, #ff5e3a, #ffdb4d, #5bd1d7, #8b7aff, #ff5e3a)",
                      border: "2px solid transparent", marginLeft: 4,
                    }}>
                      <input type="color" value={form.color} onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                    </label>
                  </div>
                </div>

                {/* Members section — only when editing an existing project */}
                {editing?.id && (
                  <div style={{ marginTop: 4, paddingTop: 16, borderTop: `1px solid ${theme.borderFaint}` }}>
                    <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 10, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Mitglieder {members.length > 0 && <span style={{ color: theme.textFaint, fontWeight: 400 }}>· {members.length}</span>}
                    </label>

                    {/* Member list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: pendingInvites.length > 0 || isOwner ? 12 : 0 }}>
                      {members.map(m => {
                        const p = m.profiles || {};
                        const isMe = m.user_id === session?.user?.id;
                        return (
                          <div key={m.user_id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 10px", borderRadius: 10,
                            background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                          }}>
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
                            ) : (
                              <div style={{
                                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                background: (p.avatar_color || "#8B7AFF") + "30", color: p.avatar_color || "#8B7AFF",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontFamily: FONT, fontWeight: 600,
                              }}>{p.initials || "?"}</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {p.display_name || p.email || "Unbekannt"} {isMe && <span style={{ color: theme.textFaint, fontWeight: 400 }}>(Du)</span>}
                              </div>
                              <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>
                                {m.role === "owner" ? "Owner" : "Mitglied"}
                              </div>
                            </div>
                            {isOwner && !isMe && m.role !== "owner" && (
                              <motion.div whileTap={{ scale: 0.9 }} onClick={() => removeMember(m.user_id)}
                                title="Entfernen"
                                style={{ width: 24, height: 24, borderRadius: 6, cursor: "pointer", color: theme.textDim, display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pending invites */}
                    {pendingInvites.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
                          Ausstehende Einladungen
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                          {pendingInvites.map(inv => (
                            <div key={inv.id} style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "8px 10px", borderRadius: 10,
                              background: darkMode ? "rgba(139, 122, 255, 0.06)" : "rgba(139, 122, 255, 0.05)",
                              border: "1px solid rgba(139, 122, 255, 0.15)",
                            }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "rgba(139, 122, 255, 0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8B7AFF" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.email}</div>
                                <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>Eingeladen · ausstehend</div>
                              </div>
                              {isOwner && (
                                <motion.div whileTap={{ scale: 0.9 }} onClick={() => revokeInvite(inv.id)}
                                  title="Zurückziehen"
                                  style={{ width: 24, height: 24, borderRadius: 6, cursor: "pointer", color: theme.textDim, display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </motion.div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Add members — only for owners */}
                    {isOwner && (() => {
                      const memberIds = new Set(members.map(m => m.user_id));
                      const invitedEmails = new Set(pendingInvites.map(i => i.email.toLowerCase()));
                      // Available org members: not already in project + has profile
                      const available = (orgMembers || []).filter(om => {
                        const uid = om.user_id;
                        if (memberIds.has(uid)) return false;
                        if (uid === session?.user?.id) return false; // self
                        const p = om.profiles || {};
                        const email = (p.email || "").toLowerCase();
                        if (invitedEmails.has(email)) return false;
                        const name = (p.display_name || p.email || "").toLowerCase();
                        return name.includes(pickerSearch.toLowerCase());
                      });
                      const looksLikeEmail = pickerSearch.includes("@") && pickerSearch.includes(".");

                      return (
                        <div style={{ position: "relative" }}>
                          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                            onClick={() => setShowAddPicker(!showAddPicker)}
                            style={{
                              width: "100%", padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                              background: darkMode ? "rgba(139, 122, 255, 0.08)" : "rgba(139, 122, 255, 0.08)",
                              border: "1px dashed rgba(139, 122, 255, 0.35)",
                              color: "#8B7AFF",
                              fontSize: 13, fontFamily: FONT, fontWeight: 500,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            Mitglied hinzufügen
                          </motion.button>

                          <AnimatePresence>
                            {showAddPicker && (
                              <>
                                <div onClick={() => { setShowAddPicker(false); setPickerSearch(""); }}
                                  style={{ position: "fixed", inset: 0, zIndex: 250 }}
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                                  transition={{ duration: 0.18 }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, zIndex: 251,
                                    background: darkMode ? "rgba(28,28,38,0.99)" : "rgba(255,255,255,0.99)",
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: 14, overflow: "hidden",
                                    boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
                                    maxHeight: 320, display: "flex", flexDirection: "column",
                                  }}
                                >
                                  {/* Search input */}
                                  <div style={{ padding: 10, borderBottom: `1px solid ${theme.borderFaint}` }}>
                                    <input
                                      autoFocus
                                      value={pickerSearch}
                                      onChange={(e) => setPickerSearch(e.target.value)}
                                      placeholder="Name oder E-Mail-Adresse..."
                                      style={{
                                        width: "100%", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                                        border: `1px solid ${theme.borderFaint}`, borderRadius: 9,
                                        padding: "8px 12px", fontSize: 13, fontFamily: FONT,
                                        color: theme.text, outline: "none", caretColor: theme.accent,
                                      }}
                                    />
                                  </div>

                                  {/* Workspace member list */}
                                  <div style={{ flex: 1, overflowY: "auto", padding: 4 }}>
                                    {available.length > 0 ? (
                                      available.map(om => {
                                        const p = om.profiles || {};
                                        return (
                                          <motion.div key={om.user_id}
                                            whileTap={{ scale: 0.98 }}
                                            whileHover={{ background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                                            onClick={() => { addOrgMemberDirectly(om.user_id); setPickerSearch(""); setShowAddPicker(false); }}
                                            style={{
                                              display: "flex", alignItems: "center", gap: 10,
                                              padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                            }}
                                          >
                                            {p.avatar_url ? (
                                              <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
                                            ) : (
                                              <div style={{
                                                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                                background: (p.avatar_color || "#8B7AFF") + "30", color: p.avatar_color || "#8B7AFF",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 11, fontFamily: FONT, fontWeight: 600,
                                              }}>{p.initials || (p.display_name || "?")[0]}</div>
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.display_name || p.email || "Unbekannt"}</div>
                                              {p.email && p.display_name && (
                                                <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div>
                                              )}
                                            </div>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: theme.textDim, flexShrink: 0 }}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                          </motion.div>
                                        );
                                      })
                                    ) : (
                                      <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 12, fontFamily: FONT, color: theme.textDim }}>
                                        {(orgMembers || []).length <= 1
                                          ? "Keine weiteren Workspace-Mitglieder"
                                          : pickerSearch ? "Keine Treffer" : "Alle bereits hinzugefügt"}
                                      </div>
                                    )}
                                  </div>

                                  {/* Email invite footer — for external users */}
                                  {looksLikeEmail && !available.some(om => (om.profiles?.email || "").toLowerCase() === pickerSearch.toLowerCase()) && (
                                    <div style={{ borderTop: `1px solid ${theme.borderFaint}`, padding: 10 }}>
                                      <motion.div whileTap={{ scale: 0.98 }}
                                        onClick={async () => {
                                          setInviteEmail(pickerSearch);
                                          // small delay so state lands
                                          setTimeout(async () => {
                                            await sendInvite();
                                            setPickerSearch("");
                                            setShowAddPicker(false);
                                          }, 50);
                                        }}
                                        style={{
                                          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                                          borderRadius: 8, cursor: "pointer", background: "rgba(139, 122, 255, 0.08)",
                                          border: "1px solid rgba(139, 122, 255, 0.2)",
                                        }}
                                      >
                                        <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "rgba(139, 122, 255, 0.18)", color: "#8B7AFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: 13, fontFamily: FONT, color: "#8B7AFF", fontWeight: 500 }}>Per E-Mail einladen</div>
                                          <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pickerSearch}</div>
                                        </div>
                                      </motion.div>
                                    </div>
                                  )}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              {/* Actions */}
              <div style={{ padding: "12px 24px 18px", borderTop: `1px solid ${theme.borderFaint}`, display: "flex", justifyContent: "space-between", gap: 10 }}>
                {editing?.id ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setConfirmDelete(editing)}
                    style={{
                      padding: "10px 18px", borderRadius: 12, cursor: "pointer",
                      background: "transparent", border: "1px solid rgba(239, 68, 68, 0.25)",
                      color: "#EF4444", fontSize: 13, fontWeight: 500, fontFamily: FONT,
                    }}
                  >Löschen</motion.button>
                ) : <div />}
                <motion.button whileTap={{ scale: 0.97 }} onClick={saveProject}
                  disabled={!form.name.trim()}
                  style={{
                    padding: "10px 22px", borderRadius: 12, cursor: form.name.trim() ? "pointer" : "not-allowed",
                    background: form.name.trim() ? theme.accent + "22" : (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
                    border: `1px solid ${form.name.trim() ? theme.accent + "40" : theme.borderFaint}`,
                    color: form.name.trim() ? theme.accent : theme.textFaint,
                    fontSize: 13, fontWeight: 500, fontFamily: FONT,
                  }}
                >{editing?.id ? "Speichern" : "Erstellen"}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      {/* Delete confirm */}
      {createPortal(<AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(null)}
            style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 380, padding: 28, borderRadius: 20,
                background: darkMode ? "rgba(22,22,30,0.98)" : "rgba(255,255,255,0.99)",
                border: `1px solid ${theme.border}`, textAlign: "center",
              }}
            >
              <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: theme.text, marginBottom: 8 }}>Projekt löschen?</div>
              <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, marginBottom: 24, lineHeight: 1.5 }}>
                „{confirmDelete.name}" wird gelöscht. Tasks bleiben erhalten (verlieren aber die Projektzuordnung).
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer", background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", border: `1px solid ${theme.borderFaint}`, fontSize: 13, fontFamily: FONT, color: theme.textSub, fontWeight: 500 }}
                >Abbrechen</motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={deleteProject}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: 13, fontFamily: FONT, color: "#EF4444", fontWeight: 600 }}
                >Löschen</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BRAND VIEW — Smart multi-step onboarding wizard + sub-views
// ═══════════════════════════════════════════════════════════════
const BRAND_SUBVIEW_LABELS = {
  identity: "Identity",
  assets: "Assets",
  knowledge: "Intelligence",
  personas: "Personas",
  competitor: "Analyse",
  guidelines: "Guidelines",
};

const BRAND_ACCENT_PALETTE = [
  "#8B7AFF", "#E84393", "#00B894", "#F59E0B", "#5B8DEF",
  "#E88D67", "#6C5CE7", "#FD79A8", "#1a1a2e", "#FFFFFF",
];

// Predefined logo slots — user can also add custom ones
const LOGO_SLOTS = [
  { key: "primary",  label: "Primary",  hint: "Standard-Logo",       accept: "image/*" },
  { key: "svg",      label: "Vektor",   hint: "SVG für skalierbares Rendering", accept: "image/svg+xml,.svg" },
  { key: "dark",     label: "Dark Mode", hint: "Variante für dunkle Hintergründe", accept: "image/*" },
  { key: "light",    label: "Light Mode", hint: "Variante für helle Hintergründe", accept: "image/*" },
  { key: "icon",     label: "Icon",     hint: "Favicon / App-Icon",  accept: "image/*" },
];

// Items the user can flag for follow-up — drives the next phase of the brand build
const BRAND_NEXT_STEPS = [
  { key: "personas",     labelKey: "brand.nextSteps.personas",     hintKey: "brand.nextSteps.personasHint" },
  { key: "competitor",   labelKey: "brand.nextSteps.competitor",   hintKey: "brand.nextSteps.competitorHint" },
  { key: "guidelines",   labelKey: "brand.nextSteps.guidelines",   hintKey: "brand.nextSteps.guidelinesHint" },
  { key: "assets",       labelKey: "brand.nextSteps.assets",       hintKey: "brand.nextSteps.assetsHint" },
  { key: "intelligence", labelKey: "brand.nextSteps.intelligence", hintKey: "brand.nextSteps.intelligenceHint" },
  { key: "voice",        labelKey: "brand.nextSteps.voice",        hintKey: "brand.nextSteps.voiceHint" },
];

function BrandView({ onBack, session, userOrg, theme, darkMode, t, brandTab, setBrandTab }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  // Wizard
  const [step, setStep] = useState(0);
  const [stepDir, setStepDir] = useState(1);
  const [form, setForm] = useState({
    name: "", claim: "", description: "",
    website_url: "", figma_url: "",
    colors: [], logos: [], sources: [],
    color_palette: { primary: "", secondary: "", accents: [] },
    next_steps: {}, // { personas: 'have'|'help'|'skip', ... }
    logo_url: "", pdf_url: "", pdf_name: "",
  });
  const [logoUploading, setLogoUploading] = useState({});
  const [sourceUploading, setSourceUploading] = useState({});
  const [saving, setSaving] = useState(false);
  const [colorInput, setColorInput] = useState("#8B7AFF");
  const [hasSourcesIntent, setHasSourcesIntent] = useState(null); // null = not chosen, true = yes, false = starting fresh
  // Website analysis
  const [fetchingWebsite, setFetchingWebsite] = useState(false);
  const [websiteFetchError, setWebsiteFetchError] = useState(null);
  const [websiteFetchResult, setWebsiteFetchResult] = useState(null); // last fetch payload (for UI)

  // Refs for per-slot inputs
  const slotInputRefs = useRef({});
  const customSlotInputRef = useRef(null);
  const [customSlotLabel, setCustomSlotLabel] = useState("");
  const zipInputRef = useRef(null);
  const pdfBrandbookInputRef = useRef(null);
  const zipSourceInputRef = useRef(null);

  // Load
  useEffect(() => {
    if (!userOrg?.id) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("brand_profile").select("*").eq("org_id", userOrg.id).maybeSingle();
      setProfile(data);
      setForm({
        name: data?.name || userOrg?.name || "",
        claim: data?.claim || "",
        description: data?.description || "",
        website_url: data?.website_url || "",
        figma_url: data?.figma_url || "",
        colors: data?.colors || [],
        logos: data?.logos || [],
        sources: data?.sources || [],
        color_palette: data?.color_palette && Object.keys(data.color_palette).length > 0
          ? { primary: data.color_palette.primary || "", secondary: data.color_palette.secondary || "", accents: data.color_palette.accents || [] }
          : { primary: (data?.colors || [])[0] || "", secondary: (data?.colors || [])[1] || "", accents: (data?.colors || []).slice(2) },
        next_steps: data?.next_steps || {},
        logo_url: data?.logo_url || "",
        pdf_url: data?.pdf_url || "",
        pdf_name: data?.pdf_name || "",
      });
      setLoading(false);
    })();
  }, [userOrg?.id, userOrg?.name]);

  // Realtime
  useEffect(() => {
    if (!userOrg?.id) return;
    const ch = supabase
      .channel("brand-profile-" + userOrg.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "brand_profile", filter: `org_id=eq.${userOrg.id}` }, async () => {
        const { data } = await supabase.from("brand_profile").select("*").eq("org_id", userOrg.id).maybeSingle();
        if (data) setProfile(data);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userOrg?.id]);

  // ── Upload helpers ──
  const uploadFile = async (file, pathPrefix) => {
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const path = `${userOrg.id}/${pathPrefix}-${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
    return { url: pub.publicUrl, name: file.name, size: file.size, type: file.type };
  };

  const uploadLogoSlot = async (slotKey, label, file) => {
    if (!file) return;
    setLogoUploading(p => ({ ...p, [slotKey]: true }));
    try {
      const r = await uploadFile(file, `logo-${slotKey}`);
      setForm(prev => {
        const others = prev.logos.filter(l => l.key !== slotKey);
        const next = [...others, { key: slotKey, label, url: r.url, name: r.name, format: r.type || "" }];
        // First logo also becomes the primary logo_url for compatibility
        const primary = next.find(l => l.key === "primary") || next[0];
        return { ...prev, logos: next, logo_url: primary?.url || prev.logo_url };
      });
    } catch (e) {
      alert("Upload fehlgeschlagen: " + (e.message || ""));
    } finally {
      setLogoUploading(p => ({ ...p, [slotKey]: false }));
    }
  };

  const addCustomLogoSlot = async (file) => {
    const label = customSlotLabel.trim() || "Variante";
    const key = "custom-" + Date.now();
    await uploadLogoSlot(key, label, file);
    setCustomSlotLabel("");
  };

  const removeLogoSlot = (key) => {
    setForm(prev => {
      const next = prev.logos.filter(l => l.key !== key);
      const primary = next.find(l => l.key === "primary") || next[0];
      return { ...prev, logos: next, logo_url: primary?.url || "" };
    });
  };

  const uploadSource = async (type, file) => {
    if (!file) return;
    setSourceUploading(p => ({ ...p, [type]: true }));
    try {
      const r = await uploadFile(file, `source-${type}`);
      setForm(prev => {
        const others = prev.sources.filter(s => s.type !== type);
        return { ...prev, sources: [...others, { type, ...r }] };
      });
      // Legacy compat: brandbook also maps to pdf_url
      if (type === "brandbook") {
        setForm(prev => ({ ...prev, pdf_url: r.url, pdf_name: r.name }));
      }
      // Auto-analyse PDF / ZIP after upload
      if (type === "brandbook") analyseBrandPdf(r.url);
      if (type === "zip") analyseBrandZip(r.url);
    } catch (e) {
      alert("Upload fehlgeschlagen: " + (e.message || ""));
    } finally {
      setSourceUploading(p => ({ ...p, [type]: false }));
    }
  };

  // ── Analyse Brand Book PDF (server-side parsing) ──
  const analyseBrandPdf = async (fileUrl) => {
    setSourceUploading(p => ({ ...p, "brandbook-analyse": true }));
    try {
      const response = await fetch("/api/fetch-brand-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fileUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("brand.sources.fetchError"));
      setForm(prev => {
        const next = { ...prev };
        if (!next.claim?.trim() && data.claim) next.claim = data.claim;
        if (!next.description?.trim() && data.description) next.description = data.description;
        const cp = { ...(next.color_palette || { primary: "", secondary: "", accents: [] }) };
        if (!cp.primary && data.primary) cp.primary = data.primary;
        if (!cp.secondary && data.secondary) cp.secondary = data.secondary;
        if ((!cp.accents || cp.accents.length === 0) && Array.isArray(data.accents)) cp.accents = data.accents.slice(0, 4);
        next.color_palette = cp;
        next.colors = [cp.primary, cp.secondary, ...(cp.accents || [])].filter(Boolean);
        // Attach analysis to the source entry so UI can show "✓ X Farben, Y Fonts"
        next.sources = next.sources.map(s => s.type === "brandbook" ? { ...s, analysis: { colors: data.colors, fonts: data.fonts, pages: data.pages, claim: data.claim, description: data.description } } : s);
        return next;
      });
    } catch (err) {
      console.error("PDF analyse failed:", err);
    } finally {
      setSourceUploading(p => ({ ...p, "brandbook-analyse": false }));
    }
  };

  // ── Analyse Brand-Paket ZIP (server-side unzip + metadata) ──
  const analyseBrandZip = async (fileUrl) => {
    setSourceUploading(p => ({ ...p, "zip-analyse": true }));
    try {
      const response = await fetch("/api/fetch-brand-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fileUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("brand.sources.fetchError"));
      setForm(prev => {
        const next = { ...prev };
        next.sources = next.sources.map(s => s.type === "zip" ? { ...s, analysis: { logos: data.logos, fonts: data.fonts, font_families: data.font_families, pdfs: data.pdfs, total_files: data.total_files } } : s);
        return next;
      });
    } catch (err) {
      console.error("ZIP analyse failed:", err);
    } finally {
      setSourceUploading(p => ({ ...p, "zip-analyse": false }));
    }
  };

  const removeSource = (type) => {
    setForm(prev => ({ ...prev, sources: prev.sources.filter(s => s.type !== type) }));
    if (type === "brandbook") setForm(prev => ({ ...prev, pdf_url: "", pdf_name: "" }));
  };

  // ── Color helpers ──
  const addColor = (val) => {
    const c = (val || colorInput).trim();
    if (!c || form.colors.includes(c)) return;
    setForm(prev => ({ ...prev, colors: [...prev.colors, c] }));
  };
  const removeColor = (c) => setForm(prev => ({ ...prev, colors: prev.colors.filter(x => x !== c) }));

  // ── Fetch brand content from website ──
  const fetchFromWebsite = async () => {
    const raw = (form.website_url || "").trim();
    if (!raw) { setWebsiteFetchError(t("brand.sources.urlMissing")); return; }
    setFetchingWebsite(true);
    setWebsiteFetchError(null);
    setWebsiteFetchResult(null);
    try {
      const response = await fetch("/api/fetch-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("brand.sources.fetchError"));
      setWebsiteFetchResult(data);
      // Merge into form: only fill empty fields so we don't overwrite user input
      setForm(prev => {
        const next = { ...prev };
        if (!next.name?.trim() && data.name) next.name = data.name;
        if (!next.claim?.trim() && data.claim) next.claim = data.claim;
        // Description: prefer the richer "about" context if available; fall back to meta description
        if (!next.description?.trim()) {
          const desc = (data.about && data.about.length > 80) ? data.about : data.description;
          if (desc) next.description = desc;
        }
        if (!next.logo_url && data.logo_url) next.logo_url = data.logo_url;
        // Logos: add a "primary" slot if none yet
        if (data.logo_url && !(next.logos || []).some(l => l.key === "primary")) {
          next.logos = [{ key: "primary", label: "Primary", url: data.logo_url }, ...(next.logos || [])];
        }
        // Color palette: only fill empty slots
        const cp = { ...(next.color_palette || { primary: "", secondary: "", accents: [] }) };
        if (!cp.primary && data.primary) cp.primary = data.primary;
        if (!cp.secondary && data.secondary) cp.secondary = data.secondary;
        if ((!cp.accents || cp.accents.length === 0) && Array.isArray(data.accents)) cp.accents = data.accents.slice(0, 4);
        next.color_palette = cp;
        // Keep flat colors[] in sync
        next.colors = [cp.primary, cp.secondary, ...(cp.accents || [])].filter(Boolean);
        // Normalize the website URL to the final/redirected one
        if (data.url && !next.website_url.startsWith("http")) next.website_url = data.url;
        return next;
      });
    } catch (err) {
      setWebsiteFetchError(err.message || "Fehler beim Abrufen");
    } finally {
      setFetchingWebsite(false);
    }
  };

  // ── Save ──
  const saveProfile = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        org_id: userOrg.id,
        name: form.name.trim(),
        claim: form.claim.trim() || null,
        logo_url: form.logo_url || null,
        website_url: form.website_url.trim() || null,
        figma_url: form.figma_url.trim() || null,
        // Keep flat colors[] in sync with color_palette for backward compat
        colors: [form.color_palette.primary, form.color_palette.secondary, ...(form.color_palette.accents || [])].filter(Boolean),
        color_palette: {
          primary: form.color_palette.primary || null,
          secondary: form.color_palette.secondary || null,
          accents: form.color_palette.accents || [],
        },
        logos: form.logos,
        sources: form.sources,
        next_steps: form.next_steps,
        description: form.description.trim() || null,
        pdf_url: form.pdf_url || null,
        pdf_name: form.pdf_name || null,
        updated_at: new Date().toISOString(),
      };
      if (profile?.id) {
        await supabase.from("brand_profile").update(payload).eq("id", profile.id);
      } else {
        payload.created_by = session.user.id;
        const { data } = await supabase.from("brand_profile").insert(payload).select().single();
        setProfile(data);
      }
      setStep(7);
      setTimeout(() => { setEditMode(false); setStep(0); }, 1800);
    } catch (e) {
      alert("Speichern fehlgeschlagen: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const goTo = (n) => { setStepDir(n > step ? 1 : -1); setStep(n); };
  const next = () => goTo(Math.min(step + 1, 6));
  const back = () => goTo(Math.max(step - 1, 0));

  const isOnboarding = !profile || editMode;
  const totalSteps = 7;
  const stepVariants = {
    enter: (d) => ({ opacity: 0, x: d * 60, filter: "blur(6px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (d) => ({ opacity: 0, x: d * -60, filter: "blur(6px)" }),
  };

  // Quick check if user has provided ANY upstream source
  const hasAnySource = !!(form.website_url || form.figma_url || form.sources.length);

  const canAdvance = () => {
    if (step === 0) return form.name.trim().length > 0;
    return true;
  };

  // ── Render each step ──
  const renderStep = () => {
    // STEP 0 — Brand Name (full-bleed gradient hero)
    if (step === 0) {
      return (
        <motion.div key="0" custom={stepDir} variants={stepVariants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{
            // Break out of the parent padding so the gradient bleeds to the card edges
            margin: "-40px -36px -20px",
            flex: 1, alignSelf: "stretch",
            position: "relative", borderRadius: 0, overflow: "hidden",
            backgroundImage: "url('/background-blur.jpg'), radial-gradient(120% 90% at 80% 35%, #4F46E5 0%, #6C5CE7 32%, #8B7AFF 55%, #C4B5FD 72%, #ffffff 100%)",
            backgroundSize: "cover, cover",
            backgroundPosition: "center, center",
            backgroundRepeat: "no-repeat, no-repeat",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Subtle top gradient veil so progress bar area reads softly */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.05) 18%, transparent 35%)", pointerEvents: "none" }} />

          {/* Centered content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 36px 24px", position: "relative", zIndex: 1, textAlign: "center" }}>
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }}
              style={{ fontSize: 30, fontFamily: FONT, fontWeight: 600, color: "#ffffff", letterSpacing: -0.4, marginBottom: 6, lineHeight: 1.2, textShadow: "0 2px 18px rgba(0,0,0,0.18)" }}
            >{t("brand.hero.title")}</motion.div>
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, duration: 0.5 }}
              style={{ fontSize: 14, fontFamily: FONT, color: "rgba(255,255,255,0.92)", lineHeight: 1.65, maxWidth: 440, marginBottom: 32 }}
            >{t("brand.hero.subtitle")}</motion.div>

            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35, duration: 0.5 }} style={{ width: "100%", maxWidth: 320 }}>
              <div style={{
                position: "relative",
                background: "linear-gradient(135deg, #394FE0, #5A5FE4)",
                border: "none",
                borderRadius: 16,
                padding: "10px 20px 10px",
                textAlign: "left",
                boxShadow: "0 10px 30px rgba(57, 79, 224, 0.35)",
              }}>
                <label style={{ fontSize: 10, fontFamily: FONT, color: "rgba(255,255,255,0.85)", display: "block", marginTop: -1, marginLeft: -3, marginBottom: 0, fontWeight: 500, letterSpacing: 0.2, lineHeight: 1.2 }}>{t("brand.hero.brandNameLabel")}</label>
                <input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  autoFocus placeholder={t("brand.hero.brandNamePlaceholder")}
                  onKeyDown={(e) => { if (e.key === "Enter" && form.name.trim()) next(); }}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    padding: 0, margin: 0, marginTop: 1, marginLeft: -4, fontSize: 16, fontFamily: FONT, fontWeight: 500, lineHeight: 1.1,
                    color: "rgba(255,255,255,0.8)", outline: "none", caretColor: "#ffffff",
                    textTransform: "uppercase", letterSpacing: 0.4,
                  }}
                />
              </div>
            </motion.div>
          </div>

          {/* Inline Weiter button bottom-right inside the gradient */}
          <div style={{ position: "absolute", right: 24, bottom: 24, zIndex: 2 }}>
            <motion.button whileTap={{ scale: 0.97 }} onClick={next} disabled={!canAdvance()}
              style={{
                padding: "12px 22px", borderRadius: 999, cursor: canAdvance() ? "pointer" : "not-allowed",
                background: "#ffffff", border: "none",
                color: canAdvance() ? "#1a1a2e" : "#a0a0b0",
                fontSize: 13, fontWeight: 600, fontFamily: FONT,
                display: "flex", alignItems: "center", gap: 10,
                boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
                opacity: canAdvance() ? 1 : 0.7,
              }}
            >
              {t("brand.next")}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </motion.button>
          </div>
        </motion.div>
      );
    }

    // STEP 1 — What do you already have?
    if (step === 1) {
      const sourceCards = [
        {
          type: "website",
          icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>,
          label: t("brand.sources.website"),
          hint: t("brand.sources.websiteHint"),
          render: () => (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input value={form.website_url} onChange={(e) => setForm(prev => ({ ...prev, website_url: e.target.value }))}
                  placeholder="https://..."
                  onKeyDown={(e) => { if (e.key === "Enter" && form.website_url.trim() && !fetchingWebsite) fetchFromWebsite(); }}
                  style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${theme.borderFaint}`, padding: "8px 0", fontSize: 14, fontFamily: FONT, color: theme.text, outline: "none", caretColor: theme.accent }}
                />
                <motion.button whileTap={{ scale: 0.96 }} onClick={fetchFromWebsite}
                  disabled={!form.website_url.trim() || fetchingWebsite}
                  style={{
                    padding: "6px 12px", borderRadius: 999, cursor: (!form.website_url.trim() || fetchingWebsite) ? "not-allowed" : "pointer",
                    background: "transparent",
                    border: `1px solid ${fetchingWebsite ? theme.borderFaint : theme.accent}`,
                    color: fetchingWebsite ? theme.textDim : theme.accent,
                    fontSize: 11, fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap",
                    opacity: (!form.website_url.trim() && !fetchingWebsite) ? 0.4 : 1,
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {fetchingWebsite ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${theme.textDim}`, borderTopColor: "transparent" }}
                      />
                      {t("brand.loading")}
                    </>
                  ) : (
                    <>{t("brand.sources.analyse")}</>
                  )}
                </motion.button>
              </div>
              {websiteFetchError && (
                <div style={{ fontSize: 11, fontFamily: FONT, color: "#E74C3C" }}>{websiteFetchError}</div>
              )}
              {websiteFetchResult && !websiteFetchError && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: FONT, color: theme.textDim }}>
                  <span style={{ color: "#5DB89E", fontWeight: 600 }}>✓</span>
                  <span>
                    {websiteFetchResult.name ? `${websiteFetchResult.name}` : t("brand.sources.contentFound")}
                    {websiteFetchResult.colors?.length ? ` · ${websiteFetchResult.colors.length} ${t("brand.sources.colors")}` : ""}
                    {websiteFetchResult.logo_url ? " · Logo" : ""}
                    {websiteFetchResult.about ? ` · ${t("brand.sources.context")}` : ""}
                  </span>
                </div>
              )}
            </div>
          ),
          isActive: !!form.website_url,
        },
        {
          type: "figma",
          icon: <svg width="22" height="22" viewBox="-3 -3 44 63" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"><path d="M0 9.5C0 4.25 4.25 0 9.5 0H19V19H9.5C4.25 19 0 14.75 0 9.5Z"/><path d="M19 0H28.5C33.75 0 38 4.25 38 9.5C38 14.75 33.75 19 28.5 19H19V0Z"/><path d="M0 28.5C0 23.25 4.25 19 9.5 19H19V38H9.5C4.25 38 0 33.75 0 28.5Z"/><circle cx="28.5" cy="28.5" r="9.5"/><path d="M0 47.5C0 42.25 4.25 38 9.5 38H19V47.5C19 52.75 14.75 57 9.5 57C4.25 57 0 52.75 0 47.5Z"/></svg>,
          label: t("brand.sources.figma"),
          hint: t("brand.sources.figmaHint"),
          render: () => (
            <input value={form.figma_url} onChange={(e) => setForm(prev => ({ ...prev, figma_url: e.target.value }))}
              placeholder="https://figma.com/file/..."
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${theme.borderFaint}`, padding: "8px 0", fontSize: 14, fontFamily: FONT, color: theme.text, outline: "none", caretColor: theme.accent }}
            />
          ),
          isActive: !!form.figma_url,
        },
        {
          type: "brandbook",
          icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12a2 2 0 012 2v14a2 2 0 01-2 2H4z M4 4v18M16 8h2a2 2 0 012 2v10a2 2 0 01-2 2h-2"/></svg>,
          label: t("brand.sources.brandbook"),
          hint: t("brand.sources.brandbookHint"),
          render: () => {
            const existing = form.sources.find(s => s.type === "brandbook");
            if (existing) {
              const a = existing.analysis;
              const analysing = sourceUploading["brandbook-analyse"];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <a href={existing.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500, textDecoration: "none", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{existing.name}</a>
                    <motion.div whileTap={{ scale: 0.9 }} onClick={() => removeSource("brandbook")} style={{ cursor: "pointer", color: theme.textDim, fontSize: 12, padding: 4 }}>✕</motion.div>
                  </div>
                  {analysing && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: FONT, color: theme.textDim }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${theme.textDim}`, borderTopColor: "transparent" }}
                      />
                      <span>{t("brand.sources.analysingPdf")}</span>
                    </div>
                  )}
                  {!analysing && a && (
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <span style={{ color: "#5DB89E", fontWeight: 600 }}>✓</span>
                      <span>
                        {a.pages ? `${a.pages} ${t("brand.sources.pages")}` : ""}
                        {a.colors?.length ? ` · ${a.colors.length} ${t("brand.sources.colors")}` : ""}
                        {a.fonts?.length ? ` · ${a.fonts.length} ${t("brand.sources.fonts")}` : ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <motion.div whileTap={{ scale: 0.97 }} onClick={() => pdfBrandbookInputRef.current?.click()}
                style={{ fontSize: 12, fontFamily: FONT, color: theme.accent, cursor: "pointer", fontWeight: 500 }}
              >{sourceUploading.brandbook ? t("brand.loading") : t("brand.sources.choosePdf")}</motion.div>
            );
          },
          isActive: !!form.sources.find(s => s.type === "brandbook"),
        },
        {
          type: "zip",
          icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13a2 2 0 01-2 2H5a2 2 0 01-2-2V8M1 8h22M16 3l-4 5-4-5"/></svg>,
          label: t("brand.sources.zip"),
          hint: t("brand.sources.zipHint"),
          render: () => {
            const existing = form.sources.find(s => s.type === "zip");
            if (existing) {
              const a = existing.analysis;
              const analysing = sourceUploading["zip-analyse"];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <a href={existing.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500, textDecoration: "none", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{existing.name}</a>
                    <motion.div whileTap={{ scale: 0.9 }} onClick={() => removeSource("zip")} style={{ cursor: "pointer", color: theme.textDim, fontSize: 12, padding: 4 }}>✕</motion.div>
                  </div>
                  {analysing && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: FONT, color: theme.textDim }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${theme.textDim}`, borderTopColor: "transparent" }}
                      />
                      <span>{t("brand.sources.analysingZip")}</span>
                    </div>
                  )}
                  {!analysing && a && (
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <span style={{ color: "#5DB89E", fontWeight: 600 }}>✓</span>
                      <span>
                        {a.logos?.length ? `${a.logos.length} ${t("brand.sources.logos")}` : ""}
                        {a.font_families?.length ? ` · ${a.font_families.length} ${t("brand.sources.fonts")}` : ""}
                        {a.pdfs?.length ? ` · ${a.pdfs.length} ${t("brand.sources.pdfs")}` : ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <motion.div whileTap={{ scale: 0.97 }} onClick={() => zipSourceInputRef.current?.click()}
                style={{ fontSize: 12, fontFamily: FONT, color: theme.accent, cursor: "pointer", fontWeight: 500 }}
              >{sourceUploading.zip ? t("brand.loading") : t("brand.sources.chooseZip")}</motion.div>
            );
          },
          isActive: !!form.sources.find(s => s.type === "zip"),
        },
      ];

      return (
        <motion.div key="1" custom={stepDir} variants={stepVariants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 620, margin: "0 auto", width: "100%" }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontFamily: FONT, fontWeight: 600, color: theme.text, letterSpacing: -0.5, marginBottom: 10, lineHeight: 1.2 }}>
              {t("brand.sources.title")}
            </div>
            <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6 }}>
              {t("brand.sources.subtitle")}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {sourceCards.map((card, i) => (
              <motion.div key={card.type}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.05, duration: 0.3 }}
                style={{
                  padding: 16, borderRadius: 16,
                  background: card.isActive ? (darkMode ? "rgba(139,122,255,0.08)" : "rgba(139,122,255,0.06)") : (darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"),
                  border: `1px solid ${card.isActive ? "rgba(139,122,255,0.3)" : theme.borderFaint}`,
                  display: "flex", flexDirection: "column", gap: 10,
                  transition: "background 0.2s, border-color 0.2s",
                  minHeight: 140,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: card.isActive ? (theme.accent + "20") : (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                    color: card.isActive ? theme.accent : theme.textDim,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{card.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{card.label}</div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, lineHeight: 1.4, marginTop: 1 }}>{card.hint}</div>
                  </div>
                </div>
                <div style={{ marginTop: "auto" }}>{card.render()}</div>
              </motion.div>
            ))}
          </div>

          {/* "Starting fresh" hint */}
          <div style={{ textAlign: "center", fontSize: 12, fontFamily: FONT, color: theme.textFaint }}>
            {t("brand.sources.empty")}
          </div>

          {/* Hidden inputs */}
          <input ref={pdfBrandbookInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => uploadSource("brandbook", e.target.files?.[0])} />
          <input ref={zipSourceInputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" style={{ display: "none" }} onChange={(e) => uploadSource("zip", e.target.files?.[0])} />
        </motion.div>
      );
    }

    // STEP 2 — Logo Variants
    if (step === 2) {
      const customSlots = form.logos.filter(l => !LOGO_SLOTS.find(s => s.key === l.key));

      return (
        <motion.div key="2" custom={stepDir} variants={stepVariants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 620, margin: "0 auto", width: "100%" }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontFamily: FONT, fontWeight: 600, color: theme.text, letterSpacing: -0.5, marginBottom: 10, lineHeight: 1.2 }}>
              {t("brand.logos.title")}
            </div>
            <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6 }}>
              {t("brand.logos.subtitle")}
            </div>
          </div>

          {/* ZIP shortcut */}
          <motion.div whileTap={{ scale: 0.99 }} onClick={() => zipInputRef.current?.click()}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
              borderRadius: 12, cursor: "pointer",
              background: darkMode ? "rgba(139,122,255,0.06)" : "rgba(139,122,255,0.05)",
              border: "1px dashed rgba(139,122,255,0.35)",
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(139,122,255,0.18)", color: "#8B7AFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13a2 2 0 01-2 2H5a2 2 0 01-2-2V8M1 8h22M16 3l-4 5-4-5"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 600, color: theme.text }}>
                Alle Logos als ZIP hochladen
              </div>
              <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>
                Wenn du dein komplettes Logo-Paket schon gepackt hast
              </div>
            </div>
            <div style={{ fontSize: 12, fontFamily: FONT, color: theme.accent, fontWeight: 500 }}>
              {sourceUploading["logo-zip"] ? "Lädt..." : "ZIP wählen →"}
            </div>
          </motion.div>
          <input ref={zipInputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setSourceUploading(p => ({ ...p, "logo-zip": true }));
              try {
                const r = await uploadFile(f, "logo-zip");
                setForm(prev => ({ ...prev, sources: [...prev.sources.filter(s => s.type !== "logo-zip"), { type: "logo-zip", ...r }] }));
              } catch (err) { alert("Upload fehlgeschlagen: " + err.message); }
              finally { setSourceUploading(p => ({ ...p, "logo-zip": false })); }
            }}
          />

          <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", marginTop: 4 }}>
            oder einzelne Varianten
          </div>

          {/* Slot grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {LOGO_SLOTS.map(slot => {
              const existing = form.logos.find(l => l.key === slot.key);
              const uploading = logoUploading[slot.key];
              return (
                <motion.div key={slot.key}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  style={{
                    padding: 14, borderRadius: 14,
                    background: existing ? (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)") : (darkMode ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.012)"),
                    border: `1px ${existing ? "solid" : "dashed"} ${existing ? theme.borderFaint : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)")}`,
                    display: "flex", flexDirection: "column", gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{slot.label}</div>
                    <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, lineHeight: 1.4, marginTop: 1 }}>{slot.hint}</div>
                  </div>
                  {existing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {existing.url.match(/\.(svg)$/i) || existing.format?.includes("svg") ? (
                        <img src={existing.url} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, background: slot.key === "dark" ? "#1a1a2e" : (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"), padding: 6 }} />
                      ) : (
                        <img src={existing.url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", background: slot.key === "dark" ? "#1a1a2e" : "transparent" }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontFamily: FONT, color: theme.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{existing.name}</div>
                      <motion.div whileTap={{ scale: 0.9 }} onClick={() => removeLogoSlot(slot.key)} style={{ cursor: "pointer", color: theme.textDim, fontSize: 12, padding: 4 }}>✕</motion.div>
                    </div>
                  ) : (
                    <motion.div whileTap={{ scale: 0.98 }}
                      onClick={() => slotInputRefs.current[slot.key]?.click()}
                      style={{
                        padding: "16px 10px", borderRadius: 10, cursor: uploading ? "wait" : "pointer",
                        background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                        textAlign: "center", fontSize: 11, fontFamily: FONT, color: theme.textDim,
                        border: `1px dashed ${theme.borderFaint}`,
                        opacity: uploading ? 0.6 : 1,
                      }}
                    >
                      {uploading ? "Lädt..." : "+ Hochladen"}
                    </motion.div>
                  )}
                  <input ref={el => slotInputRefs.current[slot.key] = el} type="file" accept={slot.accept} style={{ display: "none" }}
                    onChange={(e) => uploadLogoSlot(slot.key, slot.label, e.target.files?.[0])}
                  />
                </motion.div>
              );
            })}

            {/* Custom slots */}
            {customSlots.map(s => (
              <motion.div key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: 14, borderRadius: 14,
                  background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
                  border: `1px solid ${theme.borderFaint}`,
                  display: "flex", flexDirection: "column", gap: 10,
                }}
              >
                <div style={{ fontSize: 12, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{s.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={s.url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontFamily: FONT, color: theme.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                  <motion.div whileTap={{ scale: 0.9 }} onClick={() => removeLogoSlot(s.key)} style={{ cursor: "pointer", color: theme.textDim, fontSize: 12, padding: 4 }}>✕</motion.div>
                </div>
              </motion.div>
            ))}

            {/* Add custom slot */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              style={{
                padding: 14, borderRadius: 14,
                border: `1px dashed ${theme.borderFaint}`,
                display: "flex", flexDirection: "column", gap: 8, justifyContent: "center",
              }}
            >
              <input value={customSlotLabel} onChange={(e) => setCustomSlotLabel(e.target.value)}
                placeholder="z.B. Mono, Stamp ..."
                style={{
                  background: "transparent", border: "none", borderBottom: `1px solid ${theme.borderFaint}`,
                  padding: "6px 0", fontSize: 12, fontFamily: FONT, color: theme.text,
                  outline: "none", caretColor: theme.accent,
                }}
              />
              <motion.div whileTap={{ scale: 0.97 }} onClick={() => customSlotInputRef.current?.click()}
                style={{
                  padding: "8px 10px", borderRadius: 8, cursor: customSlotLabel.trim() ? "pointer" : "not-allowed",
                  background: customSlotLabel.trim() ? theme.accent + "15" : "transparent",
                  textAlign: "center", fontSize: 11, fontFamily: FONT,
                  color: customSlotLabel.trim() ? theme.accent : theme.textFaint, fontWeight: 500,
                  border: `1px solid ${customSlotLabel.trim() ? theme.accent + "30" : theme.borderFaint}`,
                  opacity: customSlotLabel.trim() ? 1 : 0.5,
                }}
              >+ Variante hinzufügen</motion.div>
              <input ref={customSlotInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f && customSlotLabel.trim()) addCustomLogoSlot(f); e.target.value = ""; }}
              />
            </motion.div>
          </div>
        </motion.div>
      );
    }

    // STEP 3 — Color Palette (structured: Primary / Secondary / Accents)
    if (step === 3) {
      const setRoleColor = (role, val) => setForm(prev => ({ ...prev, color_palette: { ...prev.color_palette, [role]: val } }));
      const addAccent = (val) => {
        const c = (val || colorInput).trim();
        if (!c || form.color_palette.accents.includes(c)) return;
        setForm(prev => ({ ...prev, color_palette: { ...prev.color_palette, accents: [...prev.color_palette.accents, c] } }));
      };
      const removeAccent = (c) => setForm(prev => ({ ...prev, color_palette: { ...prev.color_palette, accents: prev.color_palette.accents.filter(x => x !== c) } }));

      const RoleSlot = ({ role, label, hint, value }) => (
        <div style={{
          padding: 16, borderRadius: 16,
          background: value ? `linear-gradient(135deg, ${value}15, transparent 70%)` : (darkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)"),
          border: `1px solid ${value ? value + "55" : theme.borderFaint}`,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <label style={{ position: "relative", display: "block", cursor: "pointer", flexShrink: 0 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: value || (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
              border: value ? "none" : `2px dashed ${theme.border}`,
              boxShadow: value ? `0 8px 22px ${value}40` : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: value ? "#ffffffAA" : theme.textFaint,
            }}>
              {!value && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>}
            </div>
            <input type="color" value={value || "#8B7AFF"} onChange={(e) => setRoleColor(role, e.target.value)}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
            />
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{label}</div>
            <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, lineHeight: 1.4, marginTop: 1 }}>{hint}</div>
            {value && (
              <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textSub, marginTop: 6, letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 8 }}>
                {value.toUpperCase()}
                <motion.span whileTap={{ scale: 0.9 }} onClick={() => setRoleColor(role, "")}
                  style={{ cursor: "pointer", color: theme.textFaint, fontSize: 11 }}
                >✕</motion.span>
              </div>
            )}
          </div>
        </div>
      );

      return (
        <motion.div key="3" custom={stepDir} variants={stepVariants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 580, margin: "0 auto", width: "100%" }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontFamily: FONT, fontWeight: 600, color: theme.text, letterSpacing: -0.5, marginBottom: 10, lineHeight: 1.2 }}>
              {t("brand.colors.title")}
            </div>
            <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6 }}>
              {t("brand.colors.subtitle")}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <RoleSlot role="primary" label={t("brand.colors.primarySlot")}
              hint={t("brand.colors.pickHint")}
              value={form.color_palette.primary}
            />
            <RoleSlot role="secondary" label={t("brand.colors.secondarySlot")}
              hint={t("brand.colors.pickHint")}
              value={form.color_palette.secondary}
            />
          </div>

          {/* Accents — optional */}
          <div style={{ paddingTop: 12, borderTop: `1px solid ${theme.borderFaint}` }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{t("brand.colors.accents")}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {form.color_palette.accents.map((c) => (
                <motion.div key={c}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px 4px 4px", borderRadius: 999, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.borderFaint}` }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: `1px solid ${theme.borderFaint}` }} />
                  <span style={{ fontSize: 11, fontFamily: FONT, color: theme.textSub, letterSpacing: 0.3 }}>{c.toUpperCase()}</span>
                  <motion.span whileTap={{ scale: 0.9 }} onClick={() => removeAccent(c)}
                    style={{ cursor: "pointer", color: theme.textFaint, fontSize: 11, marginLeft: 2 }}
                  >✕</motion.span>
                </motion.div>
              ))}
              {/* Quick add */}
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: colorInput, border: `2px solid ${theme.borderFaint}` }}>
                  <input type="color" value={colorInput} onChange={(e) => setColorInput(e.target.value)}
                    style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
                  />
                </div>
              </label>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => addAccent()}
                style={{
                  padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                  background: theme.accent + "15", border: `1px solid ${theme.accent}30`,
                  color: theme.accent, fontSize: 11, fontFamily: FONT, fontWeight: 500,
                }}
              >{t("brand.colors.addAccent")}</motion.button>
            </div>
          </div>
        </motion.div>
      );
    }

    // STEP 4 — Claim + Context (simple)
    if (step === 4) {
      return (
        <motion.div key="4" custom={stepDir} variants={stepVariants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: 560, margin: "0 auto", width: "100%" }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontFamily: FONT, fontWeight: 600, color: theme.text, letterSpacing: -0.5, marginBottom: 10, lineHeight: 1.2 }}>
              {t("brand.voice.title")}
            </div>
            <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6 }}>
              {t("brand.voice.subtitle")}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>{t("brand.voice.claimLabel")}</label>
            <input value={form.claim} onChange={(e) => setForm(prev => ({ ...prev, claim: e.target.value }))}
              placeholder={t("brand.voice.claimPlaceholder")}
              style={{
                width: "100%", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${theme.borderFaint}`, borderRadius: 12,
                padding: "14px 18px", fontSize: 16, fontFamily: FONT,
                color: theme.text, outline: "none", caretColor: theme.accent,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>{t("brand.voice.descLabel")}</label>
            <textarea value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t("brand.voice.descPlaceholder")}
              rows={7}
              style={{
                width: "100%", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${theme.borderFaint}`, borderRadius: 12,
                padding: "14px 18px", fontSize: 14, fontFamily: FONT,
                color: theme.text, outline: "none", caretColor: theme.accent, resize: "vertical", minHeight: 140, lineHeight: 1.6,
              }}
            />
          </div>
        </motion.div>
      );
    }

    // STEP 5 — Next Steps Checklist
    if (step === 5) {
      const setNextStep = (key, val) => setForm(prev => ({ ...prev, next_steps: { ...prev.next_steps, [key]: val } }));
      const STATES = [
        { id: "have",  label: t("brand.nextSteps.have"), icon: "✓",   color: "#5DB89E" },
        { id: "help",  label: t("brand.nextSteps.help"), icon: "✦", color: "#8B7AFF" },
        { id: "skip",  label: t("brand.nextSteps.skip"), icon: "—", color: null },
      ];

      return (
        <motion.div key="5" custom={stepDir} variants={stepVariants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 620, margin: "0 auto", width: "100%" }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontFamily: FONT, fontWeight: 600, color: theme.text, letterSpacing: -0.5, marginBottom: 10, lineHeight: 1.2 }}>
              {t("brand.nextSteps.title")}
            </div>
            <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6 }}>
              {t("brand.nextSteps.subtitle")}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {BRAND_NEXT_STEPS.map((item, idx) => {
              const current = form.next_steps[item.key] || null;
              return (
                <motion.div key={item.key}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                  style={{
                    padding: "14px 16px", borderRadius: 14,
                    background: current === "have" ? "rgba(93, 184, 158, 0.06)" : current === "help" ? "rgba(139, 122, 255, 0.06)" : (darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"),
                    border: `1px solid ${current === "have" ? "rgba(93, 184, 158, 0.25)" : current === "help" ? "rgba(139, 122, 255, 0.25)" : theme.borderFaint}`,
                    display: "flex", alignItems: "center", gap: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{t(item.labelKey)}</div>
                    <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>{t(item.hintKey)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: darkMode ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)", flexShrink: 0 }}>
                    {STATES.map(s => {
                      const active = current === s.id;
                      return (
                        <motion.div key={s.id} whileTap={{ scale: 0.95 }}
                          onClick={() => setNextStep(item.key, active ? null : s.id)}
                          title={s.label}
                          style={{
                            padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                            background: active ? (s.color || (darkMode ? "rgba(255,255,255,0.1)" : "#1a1a2e")) : "transparent",
                            color: active ? "#fff" : theme.textDim,
                            fontSize: 11, fontFamily: FONT, fontWeight: 500,
                            display: "flex", alignItems: "center", gap: 5,
                            transition: "background 0.15s, color 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 12 }}>{s.icon}</span>
                          <span>{s.label}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textFaint, textAlign: "center" }}>
            {t("brand.nextSteps.empty")}
          </div>
        </motion.div>
      );
    }

    // STEP 6 — Recap
    if (step === 6) {
      const primaryLogo = form.logos.find(l => l.key === "primary")?.url || form.logos[0]?.url || form.logo_url;
      const paletteColors = [form.color_palette.primary, form.color_palette.secondary, ...(form.color_palette.accents || [])].filter(Boolean);
      const nextStepsHaveCount = Object.values(form.next_steps).filter(v => v === "have").length;
      const nextStepsHelpCount = Object.values(form.next_steps).filter(v => v === "help").length;
      return (
        <motion.div key="6" custom={stepDir} variants={stepVariants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center", textAlign: "center", maxWidth: 560, margin: "0 auto" }}
        >
          <div>
            <div style={{ fontSize: 30, fontFamily: FONT, fontWeight: 600, color: theme.text, letterSpacing: -0.5, marginBottom: 10, lineHeight: 1.2 }}>
              {t("brand.recap.title")}
            </div>
            <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6 }}>
              {t("brand.recap.subtitle")}
            </div>
          </div>

          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            style={{
              width: "100%", padding: 24, borderRadius: 22,
              background: paletteColors[0] ? `linear-gradient(135deg, ${paletteColors[0]}10, transparent 60%)` : (darkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)"),
              border: `1px solid ${theme.borderFaint}`,
              display: "flex", alignItems: "center", gap: 18, textAlign: "left",
            }}
          >
            {primaryLogo ? (
              <img src={primaryLogo} alt="" style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", flexShrink: 0, border: `1px solid ${theme.borderFaint}` }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 18, background: (paletteColors[0] || theme.accent) + "22", color: paletteColors[0] || theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontFamily: FONT, fontWeight: 600, flexShrink: 0 }}>{(form.name || "?")[0]}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontFamily: FONT, fontWeight: 600, color: theme.text, letterSpacing: -0.3 }}>{form.name}</div>
              {form.claim && <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, marginTop: 4, lineHeight: 1.5 }}>{form.claim}</div>}
              {paletteColors.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
                  {paletteColors.slice(0, 8).map((c, i) => (
                    <div key={`${c}-${i}`} style={{ width: 14, height: 14, borderRadius: 5, background: c, border: `1px solid ${theme.borderFaint}` }} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {form.logos.length > 0 && <SummaryChip>✓ {form.logos.length} {t("brand.recap.logoVariants")}</SummaryChip>}
            {form.website_url && <SummaryChip>✓ {t("brand.recap.website")}</SummaryChip>}
            {form.figma_url && <SummaryChip>✓ {t("brand.recap.figma")}</SummaryChip>}
            {form.sources.length > 0 && <SummaryChip>✓ {form.sources.length} {form.sources.length === 1 ? t("brand.recap.sources") : t("brand.recap.sourcesPlural")}</SummaryChip>}
            {paletteColors.length > 0 && <SummaryChip>✓ {paletteColors.length} {t("brand.recap.colors")}</SummaryChip>}
            {form.description && <SummaryChip>✓ {t("brand.recap.description")}</SummaryChip>}
            {nextStepsHaveCount > 0 && <SummaryChip>✓ {nextStepsHaveCount} {t("brand.recap.topicsHave")}</SummaryChip>}
            {nextStepsHelpCount > 0 && <SummaryChip>✦ {nextStepsHelpCount} {t("brand.recap.topicsOpen")}</SummaryChip>}
          </div>
        </motion.div>
      );
    }

    // STEP 7 — Celebration
    if (step === 7) {
      return (
        <motion.div key="7" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center", textAlign: "center" }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            style={{
              width: 96, height: 96, borderRadius: "50%",
              background: "linear-gradient(135deg, #00B894, #00997A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 14px 40px rgba(0, 184, 148, 0.4)",
            }}
          >
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
          <div style={{ fontSize: 30, fontFamily: FONT, fontWeight: 600, color: theme.text, letterSpacing: -0.5 }}>
            Brand ist live!
          </div>
          <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6, maxWidth: 360 }}>
            Wir leiten dich gleich weiter ...
          </div>
        </motion.div>
      );
    }
  };

  // Small helper component
  function SummaryChip({ children }) {
    return (
      <div style={{ padding: "5px 12px", borderRadius: 999, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", fontSize: 11, fontFamily: FONT, color: theme.textSub }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 10, filter: "blur(4px)" }}
      transition={{ duration: 0.45, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: "20px 40px 80px", zIndex: 5,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 760, height: "100%",
        background: theme.cardBg, backdropFilter: "blur(40px)",
        border: `1px solid ${theme.borderFaint}`,
        borderRadius: 26, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontSize: 13, fontFamily: FONT, color: theme.textDim, margin: "auto" }}>Lädt...</div>
        ) : isOnboarding ? (
          <>
            {step < 6 && (
              <div style={{ padding: "20px 28px 0", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                  <motion.div
                    animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                    transition={{ duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                    style={{ height: "100%", background: "linear-gradient(90deg, #8B7AFF, #6C5CE7)", borderRadius: 2 }}
                  />
                </div>
                <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, fontWeight: 500, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                  {t("brand.step")} {step + 1} / {totalSteps}
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", padding: "40px 36px 20px" }}>
              <AnimatePresence mode="wait" custom={stepDir}>
                {renderStep()}
              </AnimatePresence>
            </div>

            {step > 0 && step < 6 && (
              <div style={{ padding: "16px 28px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${theme.borderFaint}` }}>
                {step > 0 ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={back}
                    style={{
                      padding: "12px 22px", borderRadius: 999, cursor: "pointer",
                      background: "transparent", border: `1px solid ${theme.borderFaint}`,
                      color: theme.textSub, fontSize: 13, fontWeight: 500, fontFamily: FONT,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    {t("brand.back")}
                  </motion.button>
                ) : profile ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setEditMode(false); setStep(0); }}
                    style={{
                      padding: "12px 22px", borderRadius: 999, cursor: "pointer",
                      background: "transparent", border: `1px solid ${theme.borderFaint}`,
                      color: theme.textSub, fontSize: 13, fontWeight: 500, fontFamily: FONT,
                    }}
                  >{t("brand.cancel")}</motion.button>
                ) : <div />}

                {step < 5 ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={next} disabled={!canAdvance()}
                    style={{
                      padding: "12px 22px", borderRadius: 999, cursor: canAdvance() ? "pointer" : "not-allowed",
                      background: canAdvance() ? "linear-gradient(135deg, #8B7AFF, #6C5CE7)" : (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                      border: "none",
                      color: canAdvance() ? "#fff" : theme.textFaint,
                      fontSize: 13, fontWeight: 600, fontFamily: FONT,
                      display: "flex", alignItems: "center", gap: 10,
                      boxShadow: canAdvance() ? "0 8px 22px rgba(139,122,255,0.35)" : "none",
                    }}
                  >
                    {t("brand.next")}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={saveProfile} disabled={saving}
                    style={{
                      padding: "12px 24px", borderRadius: 999, cursor: saving ? "wait" : "pointer",
                      background: "linear-gradient(135deg, #00B894, #00997A)",
                      border: "none",
                      color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: FONT,
                      display: "flex", alignItems: "center", gap: 10,
                      boxShadow: "0 8px 22px rgba(0,184,148,0.35)",
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? t("brand.saving") : t("brand.create")}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                  </motion.button>
                )}
              </div>
            )}
          </>
        ) : (
          // Post-onboarding: tabs + summary
          <>
            <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${theme.borderFaint}` }}>
              {(profile.logos?.find(l => l.key === "primary")?.url || profile.logo_url) ? (
                <img src={profile.logos?.find(l => l.key === "primary")?.url || profile.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: theme.accent + "22", color: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: FONT, fontWeight: 600, flexShrink: 0 }}>{(profile.name || "?")[0]}</div>
              )}
              <div>
                <div style={{ fontSize: 15, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{profile.name}</div>
                {profile.claim && <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>{profile.claim}</div>}
              </div>
              <div style={{ flex: 1 }} />
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setEditMode(true); setStep(0); }}
                style={{
                  padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                  background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  border: `1px solid ${theme.borderFaint}`,
                  color: theme.textSub, fontSize: 12, fontWeight: 500, fontFamily: FONT,
                }}
              >Bearbeiten</motion.button>
            </div>

            <div style={{ display: "flex", gap: 4, padding: "10px 20px 0", borderBottom: `1px solid ${theme.borderFaint}` }}>
              {Object.entries(BRAND_SUBVIEW_LABELS).map(([key, label]) => {
                const active = brandTab === key;
                return (
                  <motion.div key={key} whileTap={{ scale: 0.96 }} onClick={() => setBrandTab(key)}
                    style={{
                      padding: "8px 14px", borderRadius: "10px 10px 0 0", cursor: "pointer",
                      fontSize: 12, fontFamily: FONT, fontWeight: active ? 600 : 500,
                      color: active ? theme.text : theme.textDim,
                      borderBottom: active ? `2px solid ${theme.accent}` : "2px solid transparent",
                      marginBottom: -1,
                    }}
                  >{label}</motion.div>
                );
              })}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
              <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 22, fontFamily: FONT, fontWeight: 600, color: theme.text, marginBottom: 6, letterSpacing: -0.3 }}>
                    {BRAND_SUBVIEW_LABELS[brandTab] || "Brand"}
                  </div>
                  <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, lineHeight: 1.55 }}>
                    Dieser Bereich wird im nächsten Schritt mit Inhalten gefüllt. Aktuell siehst du dein Brand-Profil als Übersicht.
                  </div>
                </div>

                <div style={{
                  padding: 22, borderRadius: 18,
                  background: profile.colors?.[0] ? `linear-gradient(135deg, ${profile.colors[0]}10, transparent 60%)` : (darkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)"),
                  border: `1px solid ${theme.borderFaint}`,
                  display: "flex", gap: 18, alignItems: "center",
                }}>
                  {(profile.logos?.find(l => l.key === "primary")?.url || profile.logo_url) ? (
                    <img src={profile.logos?.find(l => l.key === "primary")?.url || profile.logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 14, background: (profile.colors?.[0] || theme.accent) + "22", color: profile.colors?.[0] || theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontFamily: FONT, fontWeight: 600, flexShrink: 0 }}>{(profile.name || "?")[0]}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontFamily: FONT, fontWeight: 600, color: theme.text }}>{profile.name}</div>
                    {profile.claim && <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, marginTop: 4 }}>{profile.claim}</div>}
                  </div>
                </div>

                {profile.logos?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, fontWeight: 600 }}>{t("brand.recap.logoVariants")}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {profile.logos.map(l => (
                        <div key={l.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 8, borderRadius: 12, background: l.key === "dark" ? "#1a1a2e" : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), border: `1px solid ${theme.borderFaint}` }}>
                          <img src={l.url} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 6 }} />
                          <div style={{ fontSize: 10, fontFamily: FONT, color: l.key === "dark" ? "#ffffff90" : theme.textDim, letterSpacing: 0.3 }}>{l.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const cp = profile.color_palette || {};
                  const hasPalette = cp.primary || cp.secondary || (cp.accents && cp.accents.length > 0);
                  if (hasPalette) {
                    return (
                      <div>
                        <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, fontWeight: 600 }}>{t("brand.recap.colors")}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
                          {cp.primary && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 64, height: 64, borderRadius: 14, background: cp.primary, border: `1px solid ${theme.borderFaint}`, boxShadow: `0 6px 20px ${cp.primary}40` }} />
                              <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, fontWeight: 600 }}>Primary</span>
                              <span style={{ fontSize: 9, fontFamily: FONT, color: theme.textFaint, letterSpacing: 0.3 }}>{cp.primary.toUpperCase()}</span>
                            </div>
                          )}
                          {cp.secondary && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 64, height: 64, borderRadius: 14, background: cp.secondary, border: `1px solid ${theme.borderFaint}`, boxShadow: `0 6px 20px ${cp.secondary}40` }} />
                              <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, fontWeight: 600 }}>Secondary</span>
                              <span style={{ fontSize: 9, fontFamily: FONT, color: theme.textFaint, letterSpacing: 0.3 }}>{cp.secondary.toUpperCase()}</span>
                            </div>
                          )}
                          {(cp.accents || []).map((c, i) => (
                            <div key={`${c}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 48, height: 48, borderRadius: 12, background: c, border: `1px solid ${theme.borderFaint}`, boxShadow: `0 4px 14px ${c}33`, marginTop: 8 }} />
                              <span style={{ fontSize: 9, fontFamily: FONT, color: theme.textFaint, letterSpacing: 0.3 }}>{c.toUpperCase()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (profile.colors?.length > 0) {
                    return (
                      <div>
                        <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, fontWeight: 600 }}>{t("brand.recap.colors")}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {profile.colors.map(c => (
                            <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 48, height: 48, borderRadius: 12, background: c, border: `1px solid ${theme.borderFaint}`, boxShadow: `0 4px 14px ${c}33` }} />
                              <span style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 0.3 }}>{c.toUpperCase()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {profile.next_steps && Object.keys(profile.next_steps).length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, fontWeight: 600 }}>Next Steps</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {BRAND_NEXT_STEPS.map(item => {
                        const state = profile.next_steps?.[item.key];
                        if (!state) return null;
                        const meta = state === "have" ? { icon: "✓", color: "#5DB89E", label: t("brand.nextSteps.have") }
                                  : state === "help" ? { icon: "✦", color: "#8B7AFF", label: t("brand.nextSteps.help") }
                                  : { icon: "—", color: theme.textFaint, label: t("brand.nextSteps.skip") };
                        return (
                          <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.borderFaint}` }}>
                            <span style={{ width: 22, height: 22, borderRadius: 6, background: meta.color + "22", color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{meta.icon}</span>
                            <span style={{ flex: 1, fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>{t(item.labelKey)}</span>
                            <span style={{ fontSize: 10, fontFamily: FONT, color: meta.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{meta.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {profile.description && (
                  <div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>{t("brand.recap.description")}</div>
                    <div style={{ fontSize: 14, fontFamily: FONT, color: theme.textSub, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{profile.description}</div>
                  </div>
                )}

                {/* Sources */}
                {(profile.website_url || profile.figma_url || profile.sources?.length > 0) && (
                  <div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, fontWeight: 600 }}>Quellen</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {profile.website_url && (
                        <a href={profile.website_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, textDecoration: "none", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.borderFaint}` }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>
                          <span style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>{profile.website_url}</span>
                        </a>
                      )}
                      {profile.figma_url && (
                        <a href={profile.figma_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, textDecoration: "none", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.borderFaint}` }}>
                          <svg width="16" height="16" viewBox="-3 -3 44 63" fill="none" stroke={theme.accent} strokeWidth="4" strokeLinejoin="round"><path d="M0 9.5C0 4.25 4.25 0 9.5 0H19V19H9.5C4.25 19 0 14.75 0 9.5Z"/><path d="M19 0H28.5C33.75 0 38 4.25 38 9.5C38 14.75 33.75 19 28.5 19H19V0Z"/><path d="M0 28.5C0 23.25 4.25 19 9.5 19H19V38H9.5C4.25 38 0 33.75 0 28.5Z"/><circle cx="28.5" cy="28.5" r="9.5"/><path d="M0 47.5C0 42.25 4.25 38 9.5 38H19V47.5C19 52.75 14.75 57 9.5 57C4.25 57 0 52.75 0 47.5Z"/></svg>
                          <span style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>Figma-Datei</span>
                        </a>
                      )}
                      {(profile.sources || []).map(s => (
                        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, textDecoration: "none", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.borderFaint}` }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(139,122,255,0.15)", color: "#8B7AFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                            <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.type}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
export default function CircularMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [subOpen, setSubOpen] = useState(false);
  const [subHover, setSubHover] = useState(-1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [menuSource, setMenuSource] = useState("grid");
  const [currentView, setCurrentView] = useState(() => {
    // Restore view after automatic token refresh redirect
    const saved = localStorage.getItem("agencyos-return-state");
    if (saved) {
      try {
        const state = JSON.parse(saved);
        // Only restore if it was saved less than 2 minutes ago (fresh redirect)
        if (Date.now() - state.timestamp < 120000) {
          localStorage.removeItem("agencyos-return-state");
          return state.view || "dashboard";
        }
      } catch (e) {}
      localStorage.removeItem("agencyos-return-state");
    }
    return "dashboard";
  });
  const [chatTab, setChatTab] = useState("Team");
  const [brandTab, setBrandTab] = useState("identity");
  const [filesFilter, setFilesFilter] = useState("all"); // all | images | videos | fonts | raw | links
  const [openChatConvId, setOpenChatConvId] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [triggerNewTask, setTriggerNewTask] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [pushSubExists, setPushSubExists] = useState(false);
  const [googleConnectionBroken, setGoogleConnectionBroken] = useState(false);
  const [pushSetupSending, setPushSetupSending] = useState(false);
  const [pushSetupSent, setPushSetupSent] = useState(false);
  // Push-setup overlay (shown when ?push-setup=true)
  const [pushSetupOverlay, setPushSetupOverlay] = useState(null); // null | { status, message, needsPwa }
  const [panelOpen, setPanelOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [dashboardTasks, setDashboardTasks] = useState([]);
  const [dashboardReminders, setDashboardReminders] = useState([]);
  const [dashboardProjects, setDashboardProjects] = useState([]);
  // Per-user project memberships — used to filter projects/tasks visibility
  const [myProjectIds, setMyProjectIds] = useState([]);
  // Names of projects the user is a member of — loaded directly with a join
  // so we don't depend on dashboardProjects being populated first.
  const [myProjectNamesArr, setMyProjectNamesArr] = useState([]);
  const myProjectNames = useMemo(() => new Set(myProjectNamesArr), [myProjectNamesArr]);
  // Membership state has loaded at least once (so we don't show stale "no access" UI
  // before the first fetch completes)
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  // OS visuals: per-user custom icons keyed by slot_key (e.g. calendar_event, reminder)
  const [osVisuals, setOsVisuals] = useState({});
  const [osVisualsModalOpen, setOsVisualsModalOpen] = useState(false);
  const [osVisualUploading, setOsVisualUploading] = useState(null); // slot_key being uploaded
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [calendarNotifiedIds, setCalendarNotifiedIds] = useState(new Set());
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("agencyos-dark-mode");
    return saved !== null ? JSON.parse(saved) : true; // default dark
  });
  const [appLanguage, setAppLanguage] = useState(() => localStorage.getItem("agencyos-language") || "");
  useEffect(() => { if (appLanguage) localStorage.setItem("agencyos-language", appLanguage); }, [appLanguage]);
  const t = useCallback((key, vars) => getTranslation(key, appLanguage || "de", vars), [appLanguage]);
  // Translated menu items
  const MENU_ITEMS = useMemo(() => MENU_ITEMS_DEF.map(item => ({
    ...item, label: t(item.labelKey),
    sub: item.sub.map(s => ({ ...s, label: t(s.labelKey) })),
  })), [t]);
  const PLUS_MENU_ITEMS = useMemo(() => PLUS_MENU_ITEMS_DEF.map(item => ({
    ...item, label: t(item.labelKey),
    sub: item.sub.map(s => ({ ...s, label: t(s.labelKey) })),
  })), [t]);
  // LLM provider state
  const [llmProvider, setLlmProvider] = useState(() => localStorage.getItem("agencyos-llm-provider") || "gemini");
  const [llmKeys, setLlmKeys] = useState(() => {
    try { return JSON.parse(localStorage.getItem("agencyos-llm-keys") || "{}"); } catch { return {}; }
  });
  const [llmKeyInputs, setLlmKeyInputs] = useState({ claude: "", openai: "", gemini: "" });
  const [llmKeyStatus, setLlmKeyStatus] = useState({}); // { claude: "valid"|"invalid"|"checking" }

  // Voice selection state
  const VOICE_OPTIONS = [
    { id: "6ab4c6b0f37f4243a99046478647be94", name: "Voice 01", gender: "female" },
    { id: "5dcc50822a864e9d943d9bcde0d70e10", name: "Voice 02", gender: "male" },
    { id: "860323c9e1354f6ea14079788b0bca0d", name: "Voice 03", gender: "male" },
  ];
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem("agencyos-voice-id") || VOICE_OPTIONS[0].id);
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(null); // voice id currently playing
  const voicePreviewRef = useRef(null);

  useEffect(() => { localStorage.setItem("agencyos-voice-id", selectedVoice); }, [selectedVoice]);

  // Persist LLM settings
  useEffect(() => { localStorage.setItem("agencyos-llm-provider", llmProvider); }, [llmProvider]);
  useEffect(() => { localStorage.setItem("agencyos-llm-keys", JSON.stringify(llmKeys)); }, [llmKeys]);

  const [activeMeetCall, setActiveMeetCall] = useState(null); // { link, title, windowRef }
  const meetWindowRef = useRef(null);

  // Persist dark mode preference
  useEffect(() => { localStorage.setItem("agencyos-dark-mode", JSON.stringify(darkMode)); }, [darkMode]);

  // Theme based on dark/light mode
  const theme = darkMode ? {
    bg: "#111117",
    cardBg: "rgba(22, 22, 30, 0.92)",
    text: "#ffffffCC",
    textDim: "#ffffff40",
    textFaint: "#ffffff25",
    textSub: "#ffffff60",
    border: "rgba(255,255,255,0.1)",
    borderFaint: "rgba(255,255,255,0.06)",
    hoverBg: "rgba(255,255,255,0.05)",
    overlay: "rgba(0,0,0,0.4)",
    accent: "#8B7AFF",
    accentBg: "rgba(139,122,255,0.15)",
    accentBorder: "rgba(139,122,255,0.35)",
    svgFill: "white",
    svgStroke: "#ffffff60",
    iconColor: "#717678",
  } : {
    bg: "#F5F5F7",
    cardBg: "rgba(255, 255, 255, 0.92)",
    text: "#1a1a2eEE",
    textDim: "#1a1a2eA8",
    textFaint: "#1a1a2e78",
    textSub: "#1a1a2eBB",
    border: "rgba(0,0,0,0.12)",
    borderFaint: "rgba(0,0,0,0.08)",
    hoverBg: "rgba(0,0,0,0.04)",
    overlay: "rgba(255,255,255,0.5)",
    accent: "#6C5CE7",
    accentBg: "rgba(108,92,231,0.1)",
    accentBorder: "rgba(108,92,231,0.3)",
    svgFill: "#1a1a2e",
    svgStroke: "#1a1a2e99",
    iconColor: "#444444",
  };

  // Open Meet in popup window
  const openMeetCall = useCallback((link, title) => {
    // Close existing call window if any
    if (meetWindowRef.current && !meetWindowRef.current.closed) {
      meetWindowRef.current.focus();
      return;
    }
    const w = 900, h = 600;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    const win = window.open(link, "agencyos-meet", `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`);
    meetWindowRef.current = win;
    setActiveMeetCall({ link, title: title || "Google Meet" });

    // Poll to detect when window is closed
    const check = setInterval(() => {
      if (!win || win.closed) {
        clearInterval(check);
        meetWindowRef.current = null;
        setActiveMeetCall(null);
      }
    }, 1500);
  }, []);

  // Focus existing meet window
  const focusMeetCall = useCallback(() => {
    if (meetWindowRef.current && !meetWindowRef.current.closed) {
      meetWindowRef.current.focus();
    }
  }, []);

  // End meet call
  const endMeetCall = useCallback(() => {
    if (meetWindowRef.current && !meetWindowRef.current.closed) {
      meetWindowRef.current.close();
    }
    meetWindowRef.current = null;
    setActiveMeetCall(null);
  }, []);

  // Auth state
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Organization / onboarding state
  const [userOrg, setUserOrg] = useState(null);            // current org the user belongs to
  const [userOrgs, setUserOrgs] = useState([]);             // all orgs the user belongs to
  const [userOrgRole, setUserOrgRole] = useState(null);     // role in current org
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false); // workspace switcher dropdown
  const [orgLoading, setOrgLoading] = useState(true);       // loading org check
  const [onboardingStep, setOnboardingStep] = useState(null); // null = skip, "choose" | "create" | "join"
  const [onboardingError, setOnboardingError] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);          // team members for chat etc.
  const [wsName, setWsName] = useState("");                  // workspace name input
  const [wsCreating, setWsCreating] = useState(false);       // creating workspace loading
  const [inviteCode, setInviteCode] = useState("");          // invite code input
  const [joining, setJoining] = useState(false);             // joining workspace loading
  const [pendingInvites, setPendingInvites] = useState([]);  // pending invitations for user
  const [teamInvites, setTeamInvites] = useState([]);        // pending invites sent by admin
  const [inviteEmails, setInviteEmails] = useState([]);      // email chips for invite input
  const [inviteInputVal, setInviteInputVal] = useState("");  // current text in invite input

  // Load pending invites when user goes to "join" step
  useEffect(() => {
    if (onboardingStep !== "join" || !session?.user?.email) return;
    supabase
      .from("invitations")
      .select("*, organizations(id, name, slug)")
      .eq("email", session.user.email)
      .eq("status", "pending")
      .then(({ data }) => { if (data) setPendingInvites(data); });
  }, [onboardingStep, session?.user?.email]);

  // Derive user info from session (Google profile) or fallback to localStorage
  const userName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || localStorage.getItem("agencyos-name") || "";
  const userAvatar = session?.user?.user_metadata?.avatar_url || null;
  const userEmail = session?.user?.email || "";

  // ── Check for invite token in URL (?invite=TOKEN) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    if (inviteToken) {
      setInviteCode(inviteToken);
      // Clean URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ── Auto-create profile + check org membership after login ──
  useEffect(() => {
    if (!session?.user) { setOrgLoading(false); return; }
    const uid = session.user.id;
    const meta = session.user.user_metadata || {};

    (async () => {
      try {
        // 1. Upsert profile from Google data
        const profileData = {
          id: uid,
          display_name: meta.full_name || meta.name || session.user.email?.split("@")[0] || "User",
          avatar_url: meta.avatar_url || meta.picture || null,
          email: session.user.email,
          initials: (meta.full_name || meta.name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase(),
        };
        await supabase.from("profiles").upsert(profileData, { onConflict: "id" });

        // 2. Check if user is in any org
        const { data: memberships } = await supabase
          .from("org_members")
          .select("org_id, role, organizations(id, name, slug, logo_url, brand_color)")
          .eq("user_id", uid);

        if (memberships && memberships.length > 0) {
          // Store all orgs for workspace switcher
          const allOrgs = memberships.map(m => ({ ...m.organizations, role: m.role }));
          setUserOrgs(allOrgs);
          const org = memberships[0].organizations;
          setUserOrg(org);
          setUserOrgRole(memberships[0].role);
          setOnboardingStep(null);

          // Load org members for chat etc.
          const { data: members } = await supabase
            .from("org_members")
            .select("user_id, role, profiles:profiles!org_members_profile_fkey(display_name, avatar_url, email, initials, status)")
            .eq("org_id", org.id);
          setOrgMembers(members || []);

          // Load pending invites for team management
          const { data: sentInvites } = await supabase
            .from("invitations")
            .select("*")
            .eq("org_id", org.id)
            .eq("status", "pending");
          setTeamInvites(sentInvites || []);
        } else {
          // No org — check for pending invitations
          const { data: invites } = await supabase
            .from("invitations")
            .select("*, organizations(name, slug)")
            .eq("email", session.user.email)
            .eq("status", "pending");

          // Check if user arrived via invite link
          const urlInvite = new URLSearchParams(window.location.search).get("invite") || inviteCode;
          if (urlInvite) {
            setOnboardingStep("join");
          } else if (invites && invites.length > 0) {
            setOnboardingStep("choose");
          } else {
            setOnboardingStep("choose");
          }
        }
      } catch (e) {
        console.warn("[Onboarding] Error:", e.message);
        setOnboardingStep("choose");
      } finally {
        setOrgLoading(false);
      }
    })();
  }, [session?.user?.id]);

  // ── Refresh org members helper — used by realtime + settings navigation ──
  const refreshOrgMembers = useCallback(async () => {
    if (!userOrg?.id) return;
    const { data: members } = await supabase
      .from("org_members")
      .select("user_id, role, profiles:profiles!org_members_profile_fkey(display_name, avatar_url, email, initials, status)")
      .eq("org_id", userOrg.id);
    setOrgMembers(members || []);
    const { data: invites } = await supabase.from("invitations").select("*").eq("org_id", userOrg.id).eq("status", "pending");
    setTeamInvites(invites || []);
  }, [userOrg?.id]);

  // ── Realtime subscription for org_members changes ──
  useEffect(() => {
    if (!userOrg?.id) return;
    const channel = supabase
      .channel("org-members-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "org_members", filter: `org_id=eq.${userOrg.id}` }, () => {
        refreshOrgMembers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations", filter: `org_id=eq.${userOrg.id}` }, () => {
        refreshOrgMembers();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userOrg?.id, refreshOrgMembers]);

  // ── Refresh org members when opening settings view ──
  useEffect(() => {
    if (currentView === "settings" && userOrg?.id) {
      refreshOrgMembers();
    }
  }, [currentView, userOrg?.id, refreshOrgMembers]);

  // ── Smart Google Token Management ──────────────────────────────
  // Stores the latest valid token in a ref for instant synchronous access
  const googleTokenRef = useRef(localStorage.getItem("agencyos-google-token") || null);
  const googleTokenTsRef = useRef(parseInt(localStorage.getItem("agencyos-google-token-ts") || "0"));

  // Persist token to both ref and localStorage
  const storeGoogleToken = useCallback((token) => {
    if (!token) return;
    const now = Date.now();
    googleTokenRef.current = token;
    googleTokenTsRef.current = now;
    localStorage.setItem("agencyos-google-token", token);
    localStorage.setItem("agencyos-google-token-ts", String(now));
  }, []);

  // Check if stored token is still likely valid (< 45 min old, Google tokens expire at 60 min)
  const isTokenFresh = useCallback(() => {
    return googleTokenRef.current && (Date.now() - googleTokenTsRef.current < 45 * 60 * 1000);
  }, []);

  // Synchronous getter — returns cached token (may be stale, use ensureValidToken for guaranteed fresh)
  const getProviderToken = useCallback(() => {
    return session?.provider_token || googleTokenRef.current || null;
  }, [session]);

  // Persist Google refresh_token to DB (survives logout, cookie clear, device switch)
  const persistGoogleRefreshToken = useCallback(async (token, userId) => {
    if (!token || !userId || token.length < 20) return;
    localStorage.setItem("agencyos-google-refresh-token", token);
    try {
      await supabase.from("google_oauth_tokens").upsert({
        user_id: userId,
        refresh_token: token,
        updated_at: new Date().toISOString(),
      });
      console.log("[Auth] Refresh token persisted to DB");
    } catch (e) {
      console.warn("[Auth] Failed to persist refresh token to DB:", e.message);
    }
  }, []);

  // Listen for auth state changes — persist provider_token and refresh_token
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s?.provider_token) storeGoogleToken(s.provider_token);
      if (s?.provider_refresh_token) {
        await persistGoogleRefreshToken(s.provider_refresh_token, s.user.id);
      } else if (s?.user?.id) {
        // Try to load from DB if not in current session
        const { data } = await supabase.from("google_oauth_tokens").select("refresh_token").eq("user_id", s.user.id).maybeSingle();
        if (data?.refresh_token) {
          localStorage.setItem("agencyos-google-refresh-token", data.refresh_token);
          console.log("[Auth] Refresh token loaded from DB");
        }
      }
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      console.log("[Auth]", event, s ? "session present" : "no session");

      if (s?.provider_token) storeGoogleToken(s.provider_token);
      if (s?.provider_refresh_token && s?.user?.id) {
        persistGoogleRefreshToken(s.provider_refresh_token, s.user.id);
      }

      // TOKEN_REFRESHED with a valid session — update normally
      if (event === "TOKEN_REFRESHED" && s) {
        setSession(s);
        return;
      }

      // SIGNED_OUT — only clear session if user explicitly logged out
      // If this was triggered by a failed token refresh, try to recover first
      if (event === "SIGNED_OUT" && !s) {
        // Check if we still have a stored session before giving up
        supabase.auth.getSession().then(({ data: { session: recoveredSession } }) => {
          if (recoveredSession) {
            console.log("[Auth] Recovered session after SIGNED_OUT event");
            setSession(recoveredSession);
          } else {
            // Truly signed out
            setSession(null);
          }
        }).catch(() => {
          setSession(null);
        });
        return;
      }

      // SIGNED_IN, INITIAL_SESSION, USER_UPDATED etc.
      if (s) {
        setSession(s);
      }
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [storeGoogleToken, persistGoogleRefreshToken]);

  // Auto-detect language from Google profile locale (only if user hasn't manually set one)
  useEffect(() => {
    if (session && !localStorage.getItem("agencyos-language")) {
      const locale = session.user?.user_metadata?.locale || session.user?.user_metadata?.language || "";
      const lang = locale.startsWith("de") ? "de" : "en";
      setAppLanguage(lang);
    } else if (!appLanguage) {
      setAppLanguage("de"); // fallback default
    }
  }, [session]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/generative-language.retriever https://www.googleapis.com/auth/cloud-platform",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) setAuthError(error.message);
  };

  // Silent token refresh: tries two strategies (popup strategy removed — COOP-blocked)
  // 1. Server-side refresh via /api/refresh-token (needs GOOGLE_CLIENT_ID/SECRET env vars)
  // 2. Supabase session refresh (may return provider_token if Supabase auto-refreshed Google)
  const refreshingTokenRef = useRef(false);
  const refreshPromiseRef = useRef(null);
  const refreshFailCountRef = useRef(0);
  const refreshBackoffUntilRef = useRef(0);

  const autoReLogin = useCallback(async () => {
    // Backoff: if we've failed repeatedly, pause refresh attempts
    if (Date.now() < refreshBackoffUntilRef.current) {
      return googleTokenRef.current || null;
    }
    // Dedup concurrent calls
    if (refreshingTokenRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    refreshingTokenRef.current = true;

    const onSuccess = (tok) => {
      refreshFailCountRef.current = 0;
      refreshBackoffUntilRef.current = 0;
      refreshingTokenRef.current = false;
      refreshPromiseRef.current = null;
      return tok;
    };

    const onFailure = () => {
      refreshFailCountRef.current += 1;
      // After 3 consecutive fails, pause for 30 min to stop the 500-spam loop
      if (refreshFailCountRef.current >= 3) {
        refreshBackoffUntilRef.current = Date.now() + 30 * 60 * 1000;
        console.warn("[TokenMgr] Refresh failed 3x in a row — backing off for 30 min");
      }
      refreshingTokenRef.current = false;
      refreshPromiseRef.current = null;
      return null;
    };

    const doRefresh = async () => {
      // Strategy 1: Server-side refresh with stored refresh_token
      const refreshToken = localStorage.getItem("agencyos-google-refresh-token");
      if (refreshToken && refreshToken.length > 20) {
        try {
          const res = await fetch("/api/refresh-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.access_token) {
              storeGoogleToken(data.access_token);
              return onSuccess(data.access_token);
            }
          } else if (res.status === 400 || res.status === 401) {
            // Refresh token is invalid/revoked — remove from local AND DB
            localStorage.removeItem("agencyos-google-refresh-token");
            try {
              const { data: { session: s } } = await supabase.auth.getSession();
              if (s?.user?.id) await supabase.from("google_oauth_tokens").delete().eq("user_id", s.user.id);
            } catch (e) { /* ignore */ }
            // Mark connection as broken so we can show re-auth UI
            setGoogleConnectionBroken(true);
          }
        } catch (e) {
          console.warn("Server refresh failed:", e.message);
        }
      }

      // Strategy 2: Supabase session refresh
      try {
        const { data: { session: freshSession } } = await supabase.auth.refreshSession();
        if (freshSession?.provider_token) {
          storeGoogleToken(freshSession.provider_token);
          if (freshSession.provider_refresh_token && freshSession.user?.id) {
            await persistGoogleRefreshToken(freshSession.provider_refresh_token, freshSession.user.id);
          }
          setSession(freshSession);
          setGoogleConnectionBroken(false);
          return onSuccess(freshSession.provider_token);
        }
      } catch (e) {
        console.warn("Supabase session refresh failed:", e.message);
      }

      return onFailure();
    };

    refreshPromiseRef.current = doRefresh();
    return refreshPromiseRef.current;
  }, [storeGoogleToken, persistGoogleRefreshToken]);

  // Manual re-connect: force fresh OAuth consent to get new refresh_token
  const reconnectGoogle = useCallback(async () => {
    refreshFailCountRef.current = 0;
    refreshBackoffUntilRef.current = 0;
    setGoogleConnectionBroken(false);
    // Trigger Google OAuth with prompt:consent to ensure refresh_token comes back
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/generative-language.retriever https://www.googleapis.com/auth/cloud-platform",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }, []);

  // ── ensureValidToken: async getter that guarantees a fresh token ──
  // Call this BEFORE any Google API request instead of getProviderToken()
  const ensureValidToken = useCallback(async () => {
    // 1. If cached token is still fresh (< 50 min), use it
    if (isTokenFresh()) {
      return googleTokenRef.current;
    }
    // 2. Check if current Supabase session has a provider_token
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.provider_token) {
        storeGoogleToken(s.provider_token);
        return s.provider_token;
      }
    } catch (e) { /* ignore */ }
    // 3. Token is stale or missing — refresh it
    console.log("[TokenMgr] Token stale or missing, refreshing...");
    const newToken = await autoReLogin();
    return newToken || googleTokenRef.current || null;
  }, [storeGoogleToken, isTokenFresh, autoReLogin]);

  const handleLogout = async () => {
    localStorage.removeItem("agencyos-google-token");
    await supabase.auth.signOut();
    setSession(null);
  };

  // ── Background token refresh: check every 5 min, refresh if > 45 min old ──
  // Store latest refs to avoid dependency changes crashing React
  const autoReLoginRef = useRef(autoReLogin);
  const isTokenFreshRef = useRef(isTokenFresh);
  useEffect(() => { autoReLoginRef.current = autoReLogin; }, [autoReLogin]);
  useEffect(() => { isTokenFreshRef.current = isTokenFresh; }, [isTokenFresh]);

  useEffect(() => {
    if (!session) return;
    // Immediate check on mount
    if (!isTokenFreshRef.current()) {
      console.log("[TokenMgr] Token stale on mount, refreshing...");
      autoReLoginRef.current();
    }
    // Periodic check every 10 minutes (was 3 — reduce spam)
    const interval = setInterval(() => {
      if (!isTokenFreshRef.current()) {
        console.log("[TokenMgr] Periodic refresh triggered");
        autoReLoginRef.current();
      }
      // Proactively refresh the Supabase JWT (not just getSession which returns cached)
      // This prevents the Supabase session from silently expiring → random logouts
      supabase.auth.refreshSession().then(({ data: { session: s } }) => {
        if (s) {
          if (s.provider_token) storeGoogleToken(s.provider_token);
          if (s.provider_refresh_token && s.user?.id) {
            persistGoogleRefreshToken(s.provider_refresh_token, s.user.id);
          }
          setSession(s);
        }
      }).catch((e) => { console.warn("[Auth] Periodic refresh failed:", e.message); });
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!session]);

  // ── Recover session when tab becomes visible (after sleep/standby/tab switch) ──
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        // First try to refresh the session
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        if (refreshed) {
          if (refreshed.provider_token) storeGoogleToken(refreshed.provider_token);
          if (refreshed.provider_refresh_token && refreshed.user?.id) {
            await persistGoogleRefreshToken(refreshed.provider_refresh_token, refreshed.user.id);
          }
          setSession(refreshed);
          console.log("[Auth] Session recovered on tab focus");
          return;
        }
        // Fallback: just get current session
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s) {
          setSession(s);
        } else if (!isTokenFreshRef.current()) {
          // Google token also stale — try full refresh
          autoReLoginRef.current();
        }
      } catch (e) {
        console.warn("[Auth] Visibility recovery failed:", e.message);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [storeGoogleToken]);

  // ── Fetch Kanban tasks for dashboard/startview ──
  useEffect(() => {
    if (!session?.user) return;
    const loadTasks = async () => {
      try {
        const query = userOrg?.id
          ? supabase.from("tasks").select("*").eq("org_id", userOrg.id).order("position")
          : supabase.from("tasks").select("*").eq("creator_id", session.user.id).order("position");
        const { data } = await query;
        setDashboardTasks(data || []);
        // Load reminders for dashboard
        const { data: rems } = await supabase.from("reminders").select("*").eq("user_id", session.user.id).eq("notified", false).order("remind_at", { ascending: true });
        setDashboardReminders(rems || []);
        // Also load projects for logo display
        if (userOrg?.id) {
          const { data: prj } = await supabase.from("projects").select("*").eq("org_id", userOrg.id);
          setDashboardProjects(prj || []);
        }
      } catch (e) {
        console.warn("Dashboard tasks load failed:", e.message);
      }
    };
    loadTasks();

    // Subscribe to realtime changes so dashboard stays in sync with Kanban
    const realtimeFilter = userOrg?.id ? `org_id=eq.${userOrg.id}` : `creator_id=eq.${session.user.id}`;
    const channel = supabase
      .channel("dashboard-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: realtimeFilter }, () => {
        loadTasks();
      })
      .subscribe();

    // Also subscribe to project changes (e.g. logo upload) so dashboard cards
    // pick up updated logos immediately without a page reload
    const projectsChannel = userOrg?.id ? supabase
      .channel("dashboard-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `org_id=eq.${userOrg.id}` }, async () => {
        const { data: prj } = await supabase.from("projects").select("*").eq("org_id", userOrg.id);
        setDashboardProjects(prj || []);
      })
      .subscribe() : null;

    return () => {
      supabase.removeChannel(channel);
      if (projectsChannel) supabase.removeChannel(projectsChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, userOrg?.id]);

  // ── Load this user's project memberships + subscribe to changes ──
  useEffect(() => {
    if (!session?.user?.id) {
      setMembershipLoaded(false);
      setMyProjectIds([]);
      setMyProjectNamesArr([]);
      return;
    }
    const loadMemberships = async () => {
      // Step 1: get IDs of projects the user is a member of (relies only on
      // project_members RLS — no join, no recursion risk)
      const { data: rows, error: err1 } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", session.user.id);
      if (err1) { console.warn("[Membership] load IDs failed:", err1.message); setMembershipLoaded(true); return; }
      const ids = (rows || []).map(r => r.project_id);
      setMyProjectIds(ids);

      // Step 2: fetch project names for those IDs separately
      if (ids.length > 0) {
        const { data: prjs } = await supabase.from("projects").select("id, name").in("id", ids);
        setMyProjectNamesArr((prjs || []).map(p => p.name));
      } else {
        setMyProjectNamesArr([]);
      }
      setMembershipLoaded(true);
    };
    loadMemberships();
    const ch = supabase
      .channel("my-project-memberships")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: `user_id=eq.${session.user.id}` }, () => loadMemberships())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [session?.user?.id]);

  // Re-fetch dashboard projects whenever the user returns to the dashboard.
  // Fallback in case realtime drops/lags after editing in Kanban view.
  useEffect(() => {
    if (currentView !== "dashboard" || !userOrg?.id) return;
    (async () => {
      const { data: prj } = await supabase.from("projects").select("*").eq("org_id", userOrg.id);
      setDashboardProjects(prj || []);
    })();
  }, [currentView, userOrg?.id]);

  // ── Load OS visuals (custom icons + bg color + mode per slot) ──
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data } = await supabase.from("os_visuals").select("slot_key, icon_url, bg_color, mode").eq("user_id", session.user.id);
      const map = {};
      (data || []).forEach(row => {
        map[row.slot_key] = { icon_url: row.icon_url, bg_color: row.bg_color, mode: row.mode || "icon" };
      });
      setOsVisuals(map);
    })();
  }, [session?.user?.id]);

  // Upsert helper that merges patch into existing slot row
  const upsertOsVisual = async (slotKey, patch) => {
    if (!session?.user?.id) return;
    const current = osVisuals[slotKey] || {};
    const next = { ...current, ...patch };
    setOsVisuals(prev => ({ ...prev, [slotKey]: next }));
    await supabase.from("os_visuals").upsert({
      user_id: session.user.id,
      slot_key: slotKey,
      icon_url: next.icon_url || null,
      bg_color: next.bg_color || null,
      mode: next.mode || "icon",
      updated_at: new Date().toISOString(),
    });
  };

  const uploadOsVisual = async (slotKey, file, mode = "icon") => {
    if (!file || !session?.user?.id) return;
    setOsVisualUploading(slotKey);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${session.user.id}/${slotKey}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("os-visuals").upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("os-visuals").getPublicUrl(path);
      const iconUrl = pub.publicUrl + "?t=" + Date.now(); // cache-bust
      await upsertOsVisual(slotKey, { icon_url: iconUrl, mode });
    } catch (e) {
      console.error("[OS Visuals] Upload failed:", e);
      alert("Upload fehlgeschlagen: " + (e.message || "Unbekannter Fehler"));
    } finally {
      setOsVisualUploading(null);
    }
  };

  const setOsVisualBgColor = async (slotKey, color) => {
    await upsertOsVisual(slotKey, { bg_color: color });
  };

  const setOsVisualMode = async (slotKey, mode) => {
    await upsertOsVisual(slotKey, { mode });
  };

  const resetOsVisual = async (slotKey) => {
    await supabase.from("os_visuals").delete().eq("user_id", session.user.id).eq("slot_key", slotKey);
    setOsVisuals(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
  };

  // ── Fetch upcoming Google Calendar events for startview ──
  useEffect(() => {
    if (!session?.user) return;
    const loadEvents = async () => {
      try {
        const token = await ensureValidToken();
        if (!token) return;
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const timeMin = now.toISOString();
        const timeMax = endOfDay.toISOString();
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=5`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setUpcomingEvents((data.items || []).map(e => ({
            id: e.id,
            title: e.summary || t("calendar.noTitle"),
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            hangoutLink: e.hangoutLink,
            location: e.location,
            isMeet: !!(e.hangoutLink || e.conferenceData),
          })));
        } else if (res.status === 401) {
          const freshToken = await autoReLogin();
          if (freshToken) {
            const retry = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=5`,
              { headers: { Authorization: `Bearer ${freshToken}` } }
            );
            if (retry.ok) {
              const data = await retry.json();
              setUpcomingEvents((data.items || []).map(e => ({
                id: e.id,
                title: e.summary || t("calendar.noTitle"),
                start: e.start?.dateTime || e.start?.date,
                end: e.end?.dateTime || e.end?.date,
                hangoutLink: e.hangoutLink,
                location: e.location,
                isMeet: !!(e.hangoutLink || e.conferenceData),
              })));
            }
          }
        }
      } catch (e) {
        console.warn("Calendar events load failed:", e.message);
      }
    };
    // Small delay to let token system initialize
    const timeout = setTimeout(loadEvents, 500);
    // Refresh events every 5 minutes
    const interval = setInterval(loadEvents, 5 * 60 * 1000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // ── Notifications: load, subscribe, helpers ──
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  useEffect(() => {
    if (!session?.user) return;
    const loadNotifications = async () => {
      const { data } = await supabase.from("notifications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications(data || []);
    };
    loadNotifications();

    // Realtime: listen for new notifications for this user
    const channel = supabase
      .channel("user-notifications")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${session.user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  const createNotification = useCallback(async ({ userId, type, title, body, metadata }) => {
    if (!userId || userId === session?.user?.id) return; // don't notify yourself
    await supabase.from("notifications").insert({
      user_id: userId,
      org_id: userOrg?.id || null,
      type,
      title,
      body: body || null,
      metadata: metadata || {},
    });
  }, [session?.user?.id, userOrg?.id]);

  const markNotifRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }, []);

  const markAllNotifsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", session?.user?.id).eq("read", false);
  }, [session?.user?.id]);

  // ── Calendar reminder: check every 60s for events starting within 30 min ──
  useEffect(() => {
    if (!upcomingEvents.length) return;
    const checkReminders = () => {
      const now = Date.now();
      upcomingEvents.forEach(ev => {
        if (!ev.start || calendarNotifiedIds.has(ev.id)) return;
        const startMs = new Date(ev.start).getTime();
        const diffMin = (startMs - now) / 60000;
        if (diffMin > 0 && diffMin <= 30) {
          setCalendarNotifiedIds(prev => new Set([...prev, ev.id]));
          // Add local notification (not DB, since it's for the current user)
          const mins = Math.round(diffMin);
          const notif = {
            id: "cal-" + ev.id,
            type: "calendar_reminder",
            title: ev.isMeet ? "Google Meet" : "Termin",
            body: `${ev.title} — in ${mins} Min`,
            metadata: { hangoutLink: ev.hangoutLink },
            read: false,
            created_at: new Date().toISOString(),
          };
          setNotifications(prev => [notif, ...prev.filter(n => n.id !== notif.id)]);
        }
      });
    };
    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [upcomingEvents, calendarNotifiedIds]);

  // ── Reminder checker: poll every 30s for due reminders ──
  useEffect(() => {
    if (!session?.user?.id) return;
    const checkReminders = async () => {
      const now = new Date().toISOString();
      const { data: dueReminders } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("notified", false)
        .lte("remind_at", now);
      if (dueReminders?.length) {
        // Also fetch push subscriptions for sending push
        const { data: pushSubs } = await supabase.from("push_subscriptions").select("*").eq("user_id", session.user.id);
        for (const rem of dueReminders) {
          const notif = {
            id: "rem-" + rem.id,
            type: "reminder",
            title: "Erinnerung",
            body: rem.title,
            metadata: { reminder_id: rem.id },
            read: false,
            created_at: new Date().toISOString(),
          };
          setNotifications(prev => [notif, ...prev.filter(n => n.id !== notif.id)]);
          await supabase.from("reminders").update({ notified: true }).eq("id", rem.id);
          // Send push notification to all subscribed devices
          if (pushSubs?.length) {
            for (const sub of pushSubs) {
              try {
                const res = await fetch("/api/send-push", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    title: "⏰ Erinnerung",
                    body: rem.title,
                    tag: "reminder-" + rem.id,
                  }),
                });
                if (res.status === 410) {
                  await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                }
              } catch (e) { console.warn("Push send failed:", e); }
            }
          }
          // Update dashboard reminders list
          setDashboardReminders(prev => prev.filter(r => r.id !== rem.id));
        }
      }
    };
    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // ── Check if push subscription exists ──
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from("push_subscriptions").select("id").eq("user_id", session.user.id).limit(1)
      .then(({ data }) => { if (data?.length) setPushSubExists(true); });
  }, [session?.user?.id]);

  // ── Push setup: actual subscription flow (used by overlay button) ──
  // Uses one-time setup token from email URL — works without login on the phone
  const performPushSubscribe = useCallback(async () => {
    setPushSetupOverlay({ status: "working", message: "Aktiviere Benachrichtigungen..." });
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushSetupOverlay({ status: "error", message: "Dieser Browser unterstützt keine Push-Benachrichtigungen. Nutze Chrome (Android) oder Safari (iOS 16.4+)." });
        return;
      }

      // Get the setup token from localStorage (preserved across reloads)
      const setupToken = localStorage.getItem("agencyos-push-setup-token");

      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;
      console.log("[Push] Service worker registered");

      const permission = await Notification.requestPermission();
      console.log("[Push] Permission:", permission);
      if (permission !== "granted") {
        setPushSetupOverlay({ status: "error", message: "Benachrichtigungen wurden nicht erlaubt. Bitte in den Browser- / Geräteeinstellungen aktivieren." });
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });
      const subJson = subscription.toJSON();
      console.log("[Push] Subscription obtained, endpoint:", subJson.endpoint?.slice(0, 50));

      // Save subscription — two paths:
      // 1. If we have a setup token: redeem it (no login needed)
      // 2. If user is logged in: direct upsert
      if (setupToken) {
        const { data, error } = await supabase.rpc("redeem_push_setup_token", {
          p_token: setupToken,
          p_endpoint: subJson.endpoint,
          p_p256dh: subJson.keys.p256dh,
          p_auth: subJson.keys.auth,
        });
        if (error) throw new Error("Token redemption failed: " + error.message);
        if (!data?.success) throw new Error(data?.error || "Token ungültig");
        console.log("[Push] Subscription saved via token, user_id:", data.user_id);
        localStorage.removeItem("agencyos-push-setup-token");
        localStorage.removeItem("agencyos-push-setup-pending");
      } else if (session?.user?.id) {
        const { error: dbErr } = await supabase.from("push_subscriptions").upsert({
          user_id: session.user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        }, { onConflict: "user_id,endpoint" });
        if (dbErr) throw new Error("DB save failed: " + dbErr.message);
        console.log("[Push] Subscription saved (logged-in user)");
      } else {
        throw new Error("Kein Setup-Token und nicht eingeloggt. Bitte den Link aus der E-Mail neu öffnen.");
      }

      setPushSubExists(true);

      // Immediately fire a test push so the user knows it works
      try {
        const testRes = await fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: { endpoint: subJson.endpoint, keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth } },
            title: "✓ Push aktiviert",
            body: "Du erhältst ab jetzt Erinnerungen auf diesem Gerät.",
            tag: "push-setup-ok",
          }),
        });
        console.log("[Push] Test push response:", testRes.status);
        if (!testRes.ok) {
          const errBody = await testRes.text().catch(() => "");
          throw new Error(`Test push failed (${testRes.status}): ${errBody.slice(0, 200)}`);
        }
        setPushSetupOverlay({ status: "success", message: "Du hast jetzt eine Test-Benachrichtigung erhalten. Ab sofort kommen alle Reminder auf dieses Gerät." });
      } catch (testErr) {
        setPushSetupOverlay({ status: "partial", message: "Subscription gespeichert, aber Test-Push fehlgeschlagen: " + testErr.message + ". VAPID Keys auf Vercel gesetzt?" });
      }
    } catch (e) {
      console.error("[Push] Setup error:", e);
      setPushSetupOverlay({ status: "error", message: "Setup fehlgeschlagen: " + e.message });
    }
  }, [session?.user?.id]);

  // ── Handle ?project-invite=<token> — redeem invite once user is logged in ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("project-invite");
    const storedToken = localStorage.getItem("agencyos-project-invite-token");
    const token = urlToken || storedToken;
    if (!token) return;
    if (urlToken) {
      localStorage.setItem("agencyos-project-invite-token", urlToken);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("project-invite");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
    if (!session?.user?.id) return; // wait for login
    (async () => {
      try {
        const { data, error } = await supabase.rpc("accept_project_invitation", { p_token: token });
        if (error) throw error;
        if (data?.success) {
          localStorage.removeItem("agencyos-project-invite-token");
          setNotifications(prev => [{
            id: "proj-invite-ok-" + Date.now(),
            type: "member_joined",
            title: "Projekt beigetreten",
            body: "Du bist jetzt Mitglied des Projekts.",
            read: false, created_at: new Date().toISOString(),
          }, ...prev]);
        } else {
          localStorage.removeItem("agencyos-project-invite-token");
          alert(data?.error || "Einladung konnte nicht eingelöst werden");
        }
      } catch (e) {
        console.error("Project invite accept failed:", e);
        localStorage.removeItem("agencyos-project-invite-token");
      }
    })();
  }, [session?.user?.id]);

  // ── Handle ?push-setup=true&token=... — show setup overlay (no login required) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFlag = params.get("push-setup") === "true";
    const urlToken = params.get("token");
    const storedFlag = localStorage.getItem("agencyos-push-setup-pending") === "true";
    const storedToken = localStorage.getItem("agencyos-push-setup-token");

    if (urlFlag) {
      localStorage.setItem("agencyos-push-setup-pending", "true");
      if (urlToken) localStorage.setItem("agencyos-push-setup-token", urlToken);
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (!urlFlag && !storedFlag) return;

    // Detect platform
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const supported = "serviceWorker" in navigator && "PushManager" in window;

    if (!supported) {
      setPushSetupOverlay({ status: "error", message: "Dieser Browser unterstützt keine Push-Benachrichtigungen. Nutze Chrome (Android) oder Safari (iOS 16.4+)." });
      localStorage.removeItem("agencyos-push-setup-pending");
      localStorage.removeItem("agencyos-push-setup-token");
      return;
    }

    // iOS requires PWA install first
    if (isIOS && !isStandalone) {
      setPushSetupOverlay({ status: "needsPwa", message: "" });
      return;
    }

    // Have token OR logged in → ready to activate
    const hasToken = !!(urlToken || storedToken);
    if (!hasToken && !session?.user?.id) {
      setPushSetupOverlay({ status: "error", message: "Setup-Link ist unvollständig. Bitte erneut von der App aus 'Aktivieren' klicken." });
      return;
    }

    setPushSetupOverlay({ status: "ready", message: "" });
  }, [session?.user?.id]);

  // Clear push-setup flags when overlay manually closed
  useEffect(() => {
    if (pushSetupOverlay === null) {
      // Only clear pending flag, keep token for retry if user reopens
    }
  }, [pushSetupOverlay]);

  // ── Build startview cards (tasks + events + placeholders) ──
  const startviewCards = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    // Visibility: strictly by project membership (or no project at all)
    const activeTasks = dashboardTasks
      .filter(tk => tk.column_key !== "done")
      .filter(tk => !tk.project_name || myProjectNames.has(tk.project_name))
      .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

    const colLabel = (key) => ({ todo: t("kanban.todo"), progress: t("kanban.inProgress"), in_progress: t("kanban.inProgress"), review: t("kanban.review"), done: t("kanban.done") }[key] || key);
    const getDashProjectLogo = (name) => dashboardProjects.find(p => p.name === name)?.logo_url || null;
    const taskCards = activeTasks.slice(0, 4).map(tk => {
      const projLogo = tk.project_name ? getDashProjectLogo(tk.project_name) : null;
      // Custom OS visual override for task slot if no project logo
      const slotKey = tk.priority === "high" ? "task_high" : "task_default";
      const slotDef = OS_VISUAL_SLOTS.find(s => s.key === slotKey);
      const slotData = !projLogo ? osVisuals[slotKey] : null;
      const customIcon = slotData?.icon_url || null;
      const customBg = slotData?.bg_color || null;
      const fullbleed = slotData?.mode === "fullbleed" && customIcon;
      return {
        icon: projLogo || customIcon ? null : (tk.priority === "high" ? "⚡" : "◎"),
        iconBg: customBg || slotDef?.defaultBg || (tk.priority === "high" ? "#C4624A" : "#5A7AB5"),
        logoUrl: projLogo || customIcon,
        // Project logos always fill the full circle (not affected by OS visual modes).
        // OS visual icons only fill when explicitly set to fullbleed mode.
        fullbleed: projLogo ? true : fullbleed,
        name: tk.title,
        desc: tk.project_name || colLabel(tk.column_key),
        key: tk.id,
        priority: tk.priority,
        taskId: tk.id,
        onClick: () => { setOpenTaskId(tk.id); setCurrentView("kanban"); },
      };
    });

    const eventCards = upcomingEvents.map(ev => {
      const startTime = ev.start ? new Date(ev.start) : null;
      const timeStr = startTime ? startTime.toLocaleTimeString(appLanguage === "de" ? "de-DE" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "";
      const slotKey = ev.isMeet ? "calendar_meet" : "calendar_event";
      const slotDef = OS_VISUAL_SLOTS.find(s => s.key === slotKey);
      const slotData = osVisuals[slotKey];
      const customIcon = slotData?.icon_url || null;
      const customBg = slotData?.bg_color || null;
      const fullbleed = slotData?.mode === "fullbleed" && customIcon;
      return {
        icon: customIcon ? null : (ev.isMeet ? "📹" : "📅"),
        iconBg: customBg || slotDef?.defaultBg || (ev.isMeet ? "#2D7A6A" : "#4A6FA5"),
        logoUrl: customIcon,
        fullbleed,
        name: ev.title,
        desc: timeStr + (ev.isMeet ? " · Google Meet" : ""),
        key: "ev-" + ev.id,
        onClick: ev.hangoutLink ? () => window.open(ev.hangoutLink, "_blank") : () => setCurrentView("calendar"),
      };
    });

    const now = new Date();
    const soonEvents = eventCards.filter(ec => {
      const ev = upcomingEvents.find(e => "ev-" + e.id === ec.key);
      if (!ev?.start) return false;
      return (new Date(ev.start) - now) >= 0 && (new Date(ev.start) - now) < 60 * 60 * 1000;
    });
    const laterEvents = eventCards.filter(ec => !soonEvents.includes(ec));
    const highTasks = taskCards.filter(tc => tc.priority === "high");
    const otherTasks = taskCards.filter(tc => tc.priority !== "high");
    const liveCards = [...soonEvents, ...highTasks, ...laterEvents, ...otherTasks].slice(0, 4);

    const placeholders = [
      { icon: "🎨", iconBg: "#2D7A6A", name: "Figma", desc: "Complete the Dashboard Design", key: "F" },
      { icon: "🤖", iconBg: "#C4624A", name: "Claude Code", desc: "Build the new app idea", key: "2" },
      { icon: "👤", iconBg: "#5A7AB5", name: "Reply to Tom Behrens over Gmail", desc: null, key: "G" },
      { icon: "✦", iconBg: "#4A9A8A", name: "Research with Perplexity", desc: null, key: "P" },
    ];

    const cards = [...liveCards];
    let pIdx = 0;
    while (cards.length < 4 && pIdx < placeholders.length) {
      cards.push(placeholders[pIdx]);
      pIdx++;
    }
    return cards;
  }, [dashboardTasks, dashboardProjects, upcomingEvents, t, appLanguage, osVisuals, myProjectNames, session?.user?.id]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return t("greet.stillUp");
    if (h < 12) return t("greet.morning");
    if (h < 17) return t("greet.afternoon");
    if (h < 21) return t("greet.evening");
    return t("greet.night");
  };
  const [voiceMode, setVoiceMode] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [weather, setWeather] = useState("–");
  const recognitionRef = useRef(null);

  // ── Keyboard shortcuts for startview cards (⌘+1..4) ──
  useEffect(() => {
    if (currentView !== "dashboard" || menuOpen || voiceMode || aiSpeaking) return;
    const handler = (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < startviewCards.length) {
        e.preventDefault();
        const card = startviewCards[idx];
        if (card.onClick) card.onClick();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentView, menuOpen, voiceMode, aiSpeaking, startviewCards]);

  useEffect(() => {
    // IP-based geolocation — no permission prompt, city-level accuracy
    (async () => {
      try {
        const geoRes = await fetch("https://ipapi.co/json/");
        if (!geoRes.ok) return;
        const geo = await geoRes.json();
        if (!geo.latitude || !geo.longitude) return;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current_weather=true&temperature_unit=celsius`
        );
        const data = await res.json();
        if (data?.current_weather?.temperature !== undefined) {
          setWeather(Math.round(data.current_weather.temperature));
        }
      } catch { /* keep dash */ }
    })();
  }, []);
  const audioRef = useRef(null);
  const [highlightWordIndex, setHighlightWordIndex] = useState(-1);
  const highlightTimerRef = useRef(null);
  const scrollAccum = useRef(0);
  const scrollCooldown = useRef(false);
  const panelCooldown = useRef(false);
  const containerRef = useRef(null);
  const activeItems = menuSource === "plus" ? PLUS_MENU_ITEMS : MENU_ITEMS;
  const itemCount = activeItems.length;

  // ── Local voice command detection (no LLM tokens) ──
  const detectVoiceCommand = (text) => {
    const t = text.toLowerCase().trim().replace(/[.,!?]/g, "");
    const isDE = appLanguage === "de";

    const navRules = [
      { patterns: isDE ? [
        "öffne kalender", "öffne termine", "öffne den kalender",
        "öffne meine termine", "öffne zeitplan",
      ] : [
        "open calendar", "open events", "open schedule",
        "open my calendar", "open appointments",
      ], view: "calendar" },
      { patterns: isDE ? [
        "öffne kanban", "öffne kanbanboard", "öffne board",
        "öffne projekte", "öffne aufgaben", "öffne tasks",
        "öffne meine aufgaben",
      ] : [
        "open kanban", "open board", "open projects", "open tasks",
        "open my tasks", "open todos",
      ], view: "kanban" },
      { patterns: isDE ? [
        "öffne dateien", "öffne dokumente", "öffne drive",
        "öffne ordner", "öffne meine dateien", "öffne files",
      ] : [
        "open files", "open documents", "open drive", "open folder",
        "open my files", "open my documents", "open docs",
      ], view: "files" },
      { patterns: isDE ? [
        "öffne chat", "öffne chats", "öffne nachrichten",
        "öffne den chat", "öffne messages",
      ] : [
        "open chat", "open chats", "open messages",
        "open the chat", "open communication",
      ], view: "chat" },
      { patterns: isDE ? [
        "öffne einstellungen", "öffne settings", "öffne optionen",
        "öffne die einstellungen", "öffne konfiguration",
      ] : [
        "open settings", "open preferences", "open options",
        "open the settings", "open configuration",
      ], view: "settings" },
      { patterns: isDE ? [
        "öffne dashboard", "öffne startseite", "öffne home",
        "öffne übersicht", "öffne die startseite",
      ] : [
        "open dashboard", "open home", "open start",
        "open overview", "open the dashboard",
      ], view: "dashboard" },
    ];

    const actionRules = [
      { patterns: isDE ? [
        "dark mode", "dunkelmodus", "dunkel machen", "mach dunkel",
        "dunkles design", "nachtmodus", "mach mal dunkel", "dunkler",
      ] : [
        "dark mode", "night mode", "switch to dark", "make it dark",
        "go dark", "darker", "dark theme",
      ], action: () => setDarkMode(true) },
      { patterns: isDE ? [
        "light mode", "hellmodus", "hell machen", "mach hell",
        "helles design", "tagmodus", "mach mal hell", "heller",
      ] : [
        "light mode", "bright mode", "switch to light", "make it bright",
        "go light", "lighter", "light theme",
      ], action: () => setDarkMode(false) },
    ];

    for (const rule of navRules) {
      for (const p of rule.patterns) {
        if (t.includes(p)) return { view: rule.view };
      }
    }
    for (const rule of actionRules) {
      for (const p of rule.patterns) {
        if (t.includes(p)) return { action: rule.action };
      }
    }
    return null;
  };

  // Start voice recording with Web Speech API
  const startVoice = () => {
    setMenuOpen(false);
    setSubOpen(false);
    // Close any open view so the voice UI doesn't overlay it
    if (currentView !== "dashboard") setCurrentView("dashboard");
    if (panelOpen) setPanelOpen(false);
    if (tasksOpen) setTasksOpen(false);
    setVoiceMode(true);
    setAiSpeaking(false);
    setTranscript("");
    setAiResponse("");
    setAiStatus("listening");

    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { setTranscript("Speech Recognition not supported in this browser"); return; }
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = appLanguage === "de" ? "de-DE" : "en-US";
      recognitionRef.current = recognition;

      let commandExecuted = false;
      recognition.onresult = (event) => {
        if (commandExecuted) return;
        let final = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        const currentText = final + interim;
        setTranscript(currentText);

        // Auto-detect and execute voice commands in real-time
        if (currentText.trim().length > 0) {
          const voiceNav = detectVoiceCommand(currentText);
          if (voiceNav) {
            commandExecuted = true;
            // Stop recognition immediately
            try { recognition.stop(); } catch(e) {}
            recognitionRef.current = null;
            // Use setTimeout to ensure React processes state updates
            setTimeout(() => {
              setVoiceMode(false);
              setAiSpeaking(false);
              setAiStatus("");
              setAiResponse("");
              setTranscript("");
              if (voiceNav.view) setCurrentView(voiceNav.view);
              if (voiceNav.action) voiceNav.action();
            }, 50);
          }
        }
      };
      recognition.onerror = () => {};
      recognition.start();
    } catch (e) {
      setTranscript("Mic not available in this environment");
    }
  };

  // Stop recording, send to Claude, speak response
  const stopVoice = async () => {
    // Stop recognition
    try { if (recognitionRef.current) recognitionRef.current.stop(); } catch(e) {}

    const userMessage = transcript || "Hello, what can you help me with?";

    // ── Local voice commands — no LLM tokens used ──
    const voiceNav = detectVoiceCommand(userMessage);
    if (voiceNav) {
      setVoiceMode(false);
      setAiSpeaking(false);
      setAiStatus("");
      setAiResponse("");
      setTranscript("");
      if (voiceNav.view) setCurrentView(voiceNav.view);
      if (voiceNav.action) voiceNav.action();
      return;
    }

    setVoiceMode(false);
    setAiSpeaking(true);
    setAiStatus("thinking");
    aiStoppedRef.current = false;

    try {
      // Build context-aware system prompt
      const systemPrompt = buildSystemPrompt({ currentView, userName, provider: llmProvider });
      let data;

      const activeKey = llmKeys[llmProvider];
      const googleToken = llmProvider === "gemini" && !activeKey ? getProviderToken() : null;

      if (activeKey || googleToken) {
        // User has their own key or Google OAuth token
        const response = await fetch("/api/chat-multi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            systemPrompt,
            provider: llmProvider,
            apiKey: activeKey || undefined,
            oauthToken: googleToken || undefined,
          }),
        });
        data = await response.json();

        if (!data.content?.[0]?.text && data.error) {
          // Rate limit — show friendly message
          if (data.statusCode === 429 || response.status === 429) {
            data = { content: [{ type: "text", text: t("ai.rateLimited") }] };
          }
          // Token might be expired — try refresh and retry once
          else if (googleToken && autoReLogin) {
            const freshToken = await autoReLogin();
            if (freshToken) {
              const retryRes = await fetch("/api/chat-multi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: userMessage,
                  systemPrompt,
                  provider: llmProvider,
                  oauthToken: freshToken,
                }),
              });
              data = await retryRes.json();
            }
          }
        }
      } else {
        // No provider connected
        data = { content: [{ type: "text", text: t("ai.noProvider") }] };
      }
      const aiText = data.content?.[0]?.text || t("ai.fallback");
      setAiResponse(aiText);
      setAiStatus("speaking");

      // Try Fish Audio first, fallback to browser synthesis
      if (aiStoppedRef.current) return;
      try {
        const ttsResponse = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: aiText, voiceId: selectedVoice }),
        });
        if (aiStoppedRef.current) return;
        if (ttsResponse.ok) {
          const audioBlob = await ttsResponse.blob();
          if (aiStoppedRef.current) return;
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          // Start karaoke highlight once we know the audio duration
          audio.onloadedmetadata = () => {
            if (!aiStoppedRef.current && audio.duration && isFinite(audio.duration)) {
              startKaraokeHighlight(aiText, audio.duration);
            }
          };
          audio.onended = () => {
            if (aiStoppedRef.current) return;
            stopKaraokeHighlight();
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            if (!aiStoppedRef.current) { setAiStatus("idle"); }
          };
          audio.onerror = null;
          audio.play();
        } else {
          if (!aiStoppedRef.current) speakWithBrowser(aiText);
        }
      } catch (ttsErr) {
        if (!aiStoppedRef.current) speakWithBrowser(aiText);
      }
    } catch (e) {
      setAiResponse(t("ai.error"));
      setAiStatus("speaking");
      setAiStatus("idle");
    }
  };

  const speakWithBrowser = (text) => {
    if (aiStoppedRef.current) return;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0; utterance.pitch = 1.0; utterance.volume = 0.8;
      // Use boundary events for precise karaoke sync with browser speech
      const words = text.split(/\s+/).filter(Boolean);
      let wordIdx = 0;
      setHighlightWordIndex(0);
      utterance.onboundary = (event) => {
        if (event.name === "word" && !aiStoppedRef.current) {
          wordIdx++;
          setHighlightWordIndex(wordIdx);
        }
      };
      utterance.onend = () => {
        stopKaraokeHighlight();
        if (!aiStoppedRef.current) { setAiStatus("idle"); }
      };
      window.speechSynthesis.speak(utterance);
    } else {
      // No speech — just estimate ~150 words/min
      const words = text.split(/\s+/).filter(Boolean);
      const estimatedDuration = (words.length / 150) * 60;
      startKaraokeHighlight(text, Math.max(estimatedDuration, 3));
      setTimeout(() => { if (!aiStoppedRef.current) { stopKaraokeHighlight(); setAiStatus("idle"); } }, Math.max(estimatedDuration * 1000, 3000) + 800);
    }
  };

  const aiStoppedRef = useRef(false);
  const voiceNavActiveRef = useRef(false);

  // Karaoke highlight: progressively reveal words synced to audio duration
  const startKaraokeHighlight = useCallback((text, audioDuration) => {
    if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
    setHighlightWordIndex(0);
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    // Estimate: distribute audio duration evenly across words, with slight leading offset
    const msPerWord = (audioDuration * 1000 * 0.92) / words.length;
    let currentIdx = 0;
    highlightTimerRef.current = setInterval(() => {
      currentIdx++;
      if (currentIdx >= words.length) {
        clearInterval(highlightTimerRef.current);
        highlightTimerRef.current = null;
        setHighlightWordIndex(words.length);
        return;
      }
      setHighlightWordIndex(currentIdx);
    }, msPerWord);
  }, []);

  const stopKaraokeHighlight = useCallback(() => {
    if (highlightTimerRef.current) {
      clearInterval(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    setHighlightWordIndex(-1);
  }, []);

  const stopAI = () => {
    aiStoppedRef.current = true;
    stopKaraokeHighlight();
    if (audioRef.current) {
      try {
        const audio = audioRef.current;
        audioRef.current = null;
        audio.onended = null;
        audio.onerror = null;
        audio.onpause = null;
        audio.removeAttribute('src');
        audio.load();
        audio.pause();
      } catch(e) {}
    }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e) {}
    setAiSpeaking(false); setAiStatus(""); setAiResponse(""); setTranscript("");
  };

  const handleWheel = useCallback((e) => {
    // When menu is open, always route wheel to menu navigation — regardless
    // of which view is behind it
    if (menuOpen) {
      e.preventDefault();
      if (subOpen) return;
      scrollAccum.current += e.deltaY;
      const clamped = Math.max(-60, Math.min(60, scrollAccum.current));
      scrollAccum.current = clamped;
      if (Math.abs(scrollAccum.current) >= 50) {
        const dir = scrollAccum.current > 0 ? 1 : -1;
        scrollAccum.current = 0;
        setActiveIndex(prev => ((prev + dir) % itemCount + itemCount) % itemCount);
        try { sounds.scroll(); } catch(e) {}
      }
      return;
    }

    // Let views with their own scrolling handle scroll natively
    if (currentView === "files" || currentView === "chat" || currentView === "kanban" || currentView === "calendar" || currentView === "settings" || currentView === "notes" || currentView === "projects" || currentView === "brand") {
      return;
    }

    // Prevent the container from scrolling on dashboard/menu views
    e.preventDefault();
    // Reset scrollTop to prevent drift
    if (containerRef.current) containerRef.current.scrollTop = 0;

    // Dashboard: scroll down opens panel, scroll up opens tasks
    if (currentView === "dashboard" && !menuOpen && !voiceMode && !aiSpeaking) {
      if (!panelCooldown.current) {
        // Scroll down (swipe down) → open panel overview
        if (e.deltaY < -30 && !panelOpen && !tasksOpen) {
          setPanelOpen(true);
          panelCooldown.current = true;
          setTimeout(() => { panelCooldown.current = false; }, 800);
          return;
        }
        // Scroll up (swipe up) → close panel
        if (e.deltaY > 30 && panelOpen) {
          setPanelOpen(false);
          panelCooldown.current = true;
          setTimeout(() => { panelCooldown.current = false; }, 800);
          return;
        }
        // Scroll up (swipe up) → open tasks view
        if (e.deltaY > 30 && !tasksOpen && !panelOpen) {
          setTasksOpen(true);
          panelCooldown.current = true;
          setTimeout(() => { panelCooldown.current = false; }, 800);
          return;
        }
        // Scroll down (swipe down) → close tasks view
        if (e.deltaY < -30 && tasksOpen) {
          setTasksOpen(false);
          panelCooldown.current = true;
          setTimeout(() => { panelCooldown.current = false; }, 800);
          return;
        }
      }
      return;
    }

    if (!menuOpen) return;
    if (subOpen) return;
    if (scrollCooldown.current) return;

    const clamped = Math.max(-80, Math.min(80, e.deltaY));
    scrollAccum.current += clamped;

    if (Math.abs(scrollAccum.current) >= 50) {
      const dir = scrollAccum.current > 0 ? 1 : -1;
      scrollAccum.current = 0;
      scrollCooldown.current = true;
      setTimeout(() => { scrollCooldown.current = false; }, 100);

      setActiveIndex(prev => ((prev + dir) % itemCount + itemCount) % itemCount);
      try { sounds.scroll(); } catch(e) {}
    }
  }, [currentView, menuOpen, subOpen, voiceMode, aiSpeaking, panelOpen, tasksOpen, itemCount]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) { el.addEventListener("wheel", handleWheel, { passive: false }); return () => el.removeEventListener("wheel", handleWheel); }
  }, [handleWheel]);

  const handleCenterClick = () => {
    if (!menuOpen) { setCurrentView("dashboard"); setMenuOpen(true); setSubOpen(false); setSubHover(-1); try { sounds.menuOpen(); } catch(e) {} return; }
    if (menuOpen && !subOpen) {
      // Direct navigation for items that don't need a submenu
      const item = activeItems[activeIndex];
      if (item?.id === "chat") {
        try { sounds.subSelect(); } catch(e) {}
        setMenuOpen(false); setSubHover(-1);
        setCurrentView("chat");
        return;
      }
      if (item?.id === "docs") {
        try { sounds.subSelect(); } catch(e) {}
        setMenuOpen(false); setSubHover(-1);
        setCurrentView("projects");
        return;
      }
      setSubOpen(true); setSubHover(-1); try { sounds.subOpen(); } catch(e) {} return;
    }
    if (subOpen) { setSubOpen(false); try { sounds.menuClose(); } catch(e) {} return; }
  };

  const handleSubClick = (subItem) => {
    try { sounds.subSelect(); } catch(e) {}
    setSubOpen(false);
    setMenuOpen(false);
    setSubHover(-1);

    if (subItem.id === "todo") {
      setTriggerNewTask(true);
      setCurrentView("kanban");
    } else if (subItem.id === "reminder") {
      setShowReminderModal(true);
    } else if (subItem.id === "note") {
      setCurrentView("notes");
    } else if (subItem.id === "kanban") {
      setCurrentView("kanban");
    } else if (subItem.id === "tasks") {
      // Open the dashboard's expanded task panel ("Was steht an")
      setCurrentView("dashboard");
      setPanelOpen(false);
      setTimeout(() => setTasksOpen(true), 50);
    } else if (subItem.id === "calendar") {
      setCurrentView("calendar");
    } else if (["assets", "identity", "knowledge", "personas", "competitor", "guidelines"].includes(subItem.id)) {
      setBrandTab(subItem.id);
      setCurrentView("brand");
    } else if (["images", "videos", "all", "fonts", "raw", "links"].includes(subItem.id)) {
      setFilesFilter(subItem.id);
      setCurrentView("files");
    } else if (["team", "clients", "ai", "channels", "calls", "archive"].includes(subItem.id)) {
      setCurrentView("chat");
      setChatTab(subItem.label);
    } else {
      setSelectedItem(`${activeItems[activeIndex].label} → ${subItem.label}`);
      setTimeout(() => setSelectedItem(null), 1800);
    }
  };

  const handleClose = () => { try { sounds.menuClose(); } catch(e) {} setMenuOpen(false); setSubOpen(false); setSubHover(-1); if (containerRef.current) containerRef.current.scrollTop = 0; };

  const currentItem = activeItems[activeIndex];

  return (
    <div ref={containerRef} style={{
      width: "100%", height: "100vh", background: theme.bg, position: "relative",
      overflow: "hidden", display: "flex", flexDirection: "column",
      userSelect: "none", transition: "background-color 0.4s ease",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <DotGrid darkMode={darkMode} />
      <AnimatedBlob />

      {/* AUTH LOADING */}
      <AnimatePresence>
        {authLoading && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "absolute", inset: 0, zIndex: 101,
              background: "#111117",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 13, fontFamily: FONT, color: "#ffffff40", letterSpacing: 2 }}
            >AGENCY OS</motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOGIN SCREEN */}
      <AnimatePresence>
        {!authLoading && !session && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(8px)", scale: 0.97 }}
            transition={{ duration: 0.6, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{
              position: "absolute", inset: 0, zIndex: 100,
              background: "#111117",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <DotGrid darkMode={darkMode} />
            <AnimatedBlob />
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ marginBottom: 48 }}
              >
                <svg width="76" height="48" viewBox="0 0 76 48" fill="none">
                  <path opacity="0.8" d="M4.64867 13.5494C3.95863 13.5494 3.37755 13.3133 2.90542 12.8594C2.43329 12.4054 2.19722 11.8243 2.19722 11.1343C2.19722 10.4987 2.43329 9.93579 2.90542 9.46366C3.37755 8.99152 3.95863 8.75546 4.64867 8.75546C5.3387 8.75546 5.91979 8.99152 6.39192 9.46366C6.86405 9.93579 7.10011 10.4987 7.10011 11.1343C7.10011 11.8243 6.86405 12.4054 6.39192 12.8594C5.91979 13.3133 5.3387 13.5494 4.64867 13.5494ZM2.66935 35.3037V16.6001H6.53719V35.3037H2.66935ZM11.0486 9.26391H29.3345V12.133L19.0748 35.3037H14.8075L24.7767 12.9138H11.0486V9.26391Z" fill="white" fillOpacity="0.8"/>
                  <g opacity="0.8">
                    <rect x="39.3999" y="0.5" width="36" height="22" rx="11" stroke="white"/>
                    <path d="M51.14 17.0376V17.0454C49.4759 17.0454 48.0853 16.4907 46.9681 15.3735C45.8509 14.2563 45.2962 12.8735 45.2962 11.2173C45.2962 9.56104 45.8509 8.17822 46.9603 7.07666C48.0696 5.9751 49.4603 5.42041 51.1321 5.42041C52.7962 5.42041 54.1868 5.9751 55.2962 7.07666C56.4056 8.17822 56.9603 9.55322 56.9603 11.2095C56.9603 12.8657 56.4056 14.2485 55.2962 15.3657C54.1868 16.4829 52.804 17.0376 51.14 17.0376ZM51.14 15.4438V15.4595C52.3431 15.4595 53.3275 15.0532 54.0853 14.2329C54.8431 13.4126 55.2259 12.4048 55.2259 11.2095C55.2259 10.0376 54.8431 9.04541 54.0775 8.24072C53.3118 7.43604 52.3353 7.02979 51.14 7.02979C49.9368 7.02979 48.9525 7.42822 48.1868 8.23291C47.4212 9.0376 47.0384 10.022 47.0384 11.1938C47.0384 12.3892 47.4212 13.397 48.1868 14.2173C48.9525 15.0376 49.9368 15.4438 51.14 15.4438ZM63.4675 17.0376L63.4206 17.0454C62.1706 17.0454 61.1003 16.7173 60.2018 16.0688C59.3034 15.4204 58.694 14.6157 58.3737 13.6626L60.0143 13.1704C60.2721 13.8501 60.7096 14.4126 61.3268 14.8501C61.944 15.2876 62.6706 15.5063 63.5143 15.5063C64.2565 15.5063 64.8659 15.3267 65.3425 14.9751C65.819 14.6235 66.0612 14.2173 66.0612 13.7563C66.0612 13.3813 65.9284 13.0688 65.655 12.811C65.3815 12.5532 64.9284 12.3267 64.2878 12.1235L61.4753 11.2251C59.7956 10.7017 58.9596 9.7876 58.9596 8.48291C58.9596 7.63916 59.3268 6.9126 60.0612 6.31104C60.7956 5.70947 61.7175 5.40479 62.8268 5.40479C63.9675 5.40479 64.9518 5.67041 65.78 6.20166C66.6081 6.73291 67.194 7.39697 67.5378 8.19385L65.9206 8.67822C65.655 8.15479 65.2565 7.73291 64.7175 7.4126C64.1784 7.09229 63.5534 6.93604 62.8425 6.93604C62.2253 6.93604 61.7175 7.08447 61.319 7.38135C60.9206 7.67822 60.7175 8.02979 60.7175 8.43604C60.7175 8.75635 60.8346 9.02197 61.0612 9.23291C61.2878 9.44385 61.655 9.62354 62.155 9.77197L64.905 10.647C65.8737 10.9517 66.6081 11.3267 67.1003 11.772C67.5925 12.2173 67.8425 12.8345 67.8425 13.6313C67.8425 14.5923 67.4362 15.397 66.6237 16.0532C65.8112 16.7095 64.7565 17.0376 63.4675 17.0376Z" fill="white"/>
                  </g>
                </svg>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ fontSize: 28, fontWeight: 300, color: "#ffffffCC", fontFamily: FONT, letterSpacing: -0.5, marginBottom: 6 }}
              >{t("auth.welcome")}</motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                style={{ fontSize: 14, color: "#ffffff60", fontFamily: FONT, marginBottom: 40 }}
              >{t("auth.signInPrompt")}</motion.div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
                whileHover={{ scale: 1.03, background: "#1E1E28" }}
                whileTap={{ scale: 0.97 }}
                onClick={handleGoogleLogin}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "#16161E", border: "1px solid #ffffff15", borderRadius: 16,
                  padding: "16px 32px", cursor: "pointer",
                  fontSize: 16, fontFamily: FONT, color: "#ffffffdd", fontWeight: 400,
                  letterSpacing: 0.2,
                }}
              >
                {/* Google icon */}
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                {t("auth.signInGoogle")}
              </motion.button>

              {authError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ marginTop: 20, fontSize: 13, color: "#E84393", fontFamily: FONT, textAlign: "center", maxWidth: 300 }}
                >{authError}</motion.div>
              )}

            </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                style={{ position: "absolute", bottom: 32, left: 0, right: 0, fontSize: 13, color: "#ffffff50", fontFamily: FONT, textAlign: "center", lineHeight: 1.6, zIndex: 2 }}
              ><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C9.24 2 7 4.24 7 7v3H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-2V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v3H9V7c0-1.66 1.34-3 3-3zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" fill="#ffffff50"/></svg>{t("auth.privacyNote")}</span></motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ONBOARDING SCREEN — after login, before dashboard */}
      <AnimatePresence>
        {!authLoading && session && !orgLoading && onboardingStep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(8px)", scale: 0.97 }}
            transition={{ duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{
              position: "absolute", inset: 0, zIndex: 99,
              background: "#111117",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <DotGrid darkMode={true} />
            <AnimatedBlob />
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 480, width: "100%", padding: "0 24px" }}>

              {/* ── Step: Choose ── */}
              {onboardingStep === "choose" && (<>
                <motion.div
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  style={{ fontSize: 13, fontFamily: FONT, color: "#ffffff40", marginBottom: 8 }}
                >
                  {appLanguage === "de" ? `Hallo, ${userName.split(" ")[0]}` : `Hi, ${userName.split(" ")[0]}`} 👋
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  style={{ fontSize: 26, fontWeight: 300, color: "#ffffffcc", fontFamily: FONT, letterSpacing: -0.5, marginBottom: 8, textAlign: "center" }}
                >
                  {appLanguage === "de" ? "Wie möchtest du starten?" : "How would you like to start?"}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  style={{ fontSize: 14, color: "#ffffff50", fontFamily: FONT, marginBottom: 40, textAlign: "center" }}
                >
                  {appLanguage === "de" ? "Erstelle einen neuen Workspace oder tritt einem bestehenden bei." : "Create a new workspace or join an existing one."}
                </motion.div>

                <div style={{ display: "flex", gap: 16, width: "100%" }}>
                  {/* Create workspace */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.4 }}
                    whileHover={{ scale: 1.02, borderColor: "rgba(139, 122, 255, 0.3)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOnboardingStep("create")}
                    style={{
                      flex: 1, padding: "28px 24px", borderRadius: 20, cursor: "pointer",
                      background: "rgba(139, 122, 255, 0.06)", border: "1px solid rgba(139, 122, 255, 0.15)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                      transition: "all 0.25s ease",
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: "rgba(139, 122, 255, 0.12)", border: "1px solid rgba(139, 122, 255, 0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="#8B7AFF" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#ffffffdd", fontFamily: FONT }}>
                      {appLanguage === "de" ? "Workspace erstellen" : "Create Workspace"}
                    </div>
                    <div style={{ fontSize: 12, color: "#ffffff40", fontFamily: FONT, textAlign: "center", lineHeight: 1.5 }}>
                      {appLanguage === "de" ? "Erstelle dein eigenes Team und lade Mitglieder ein" : "Set up your own team and invite members"}
                    </div>
                  </motion.div>

                  {/* Join workspace */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                    whileHover={{ scale: 1.02, borderColor: "rgba(255,255,255,0.15)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOnboardingStep("join")}
                    style={{
                      flex: 1, padding: "28px 24px", borderRadius: 20, cursor: "pointer",
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                      transition: "all 0.25s ease",
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#ffffff70" strokeWidth="1.8" strokeLinecap="round" />
                        <circle cx="8.5" cy="7" r="4" stroke="#ffffff70" strokeWidth="1.8" />
                        <path d="M20 8v6M17 11h6" stroke="#ffffff70" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#ffffffdd", fontFamily: FONT }}>
                      {appLanguage === "de" ? "Einladung annehmen" : "Join Workspace"}
                    </div>
                    <div style={{ fontSize: 12, color: "#ffffff40", fontFamily: FONT, textAlign: "center", lineHeight: 1.5 }}>
                      {appLanguage === "de" ? "Tritt einem bestehenden Team mit Einladungscode bei" : "Join an existing team with an invite code"}
                    </div>
                  </motion.div>
                </div>
              </>)}

              {/* ── Step: Create Workspace ── */}
              {onboardingStep === "create" && (<>
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    style={{ fontSize: 24, fontWeight: 300, color: "#ffffffcc", fontFamily: FONT, letterSpacing: -0.5, marginBottom: 8 }}
                  >
                    {appLanguage === "de" ? "Workspace erstellen" : "Create your Workspace"}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                    style={{ fontSize: 14, color: "#ffffff45", fontFamily: FONT, marginBottom: 32 }}
                  >
                    {appLanguage === "de" ? "Gib deinem Workspace einen Namen" : "Give your workspace a name"}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    style={{ width: "100%", maxWidth: 360 }}
                  >
                    <input
                      autoFocus
                      value={wsName}
                      onChange={e => setWsName(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key !== "Enter" || !wsName.trim() || wsCreating) return;
                        setWsCreating(true); setOnboardingError(null);
                        try {
                          const slug = wsName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
                          const { data: org, error: orgErr } = await supabase.from("organizations").insert({ name: wsName.trim(), slug: slug + "-" + Date.now().toString(36), created_by: session.user.id }).select().single();
                          if (orgErr) throw orgErr;
                          const { error: memErr } = await supabase.from("org_members").insert({ org_id: org.id, user_id: session.user.id, role: "admin" });
                          if (memErr) throw memErr;
                          setUserOrg(org); setOnboardingStep(null); setWsName("");
                        } catch (err) { console.error("[Onboarding]", err); setOnboardingError(appLanguage === "de" ? "Fehler beim Erstellen. Bitte versuche es erneut." : "Failed to create workspace. Please try again."); setWsCreating(false); }
                      }}
                      placeholder={appLanguage === "de" ? "z.B. Meine Agentur" : "e.g. My Agency"}
                      style={{
                        width: "100%", padding: "14px 18px", borderRadius: 14,
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#ffffffdd", fontSize: 15, fontFamily: FONT, outline: "none",
                        caretColor: "#8B7AFF",
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        if (!wsName.trim() || wsCreating) return;
                        setWsCreating(true); setOnboardingError(null);
                        try {
                          const slug = wsName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
                          const { data: org, error: orgErr } = await supabase.from("organizations").insert({ name: wsName.trim(), slug: slug + "-" + Date.now().toString(36), created_by: session.user.id }).select().single();
                          if (orgErr) throw orgErr;
                          const { error: memErr } = await supabase.from("org_members").insert({ org_id: org.id, user_id: session.user.id, role: "admin" });
                          if (memErr) throw memErr;
                          setUserOrg(org); setOnboardingStep(null); setWsName("");
                        } catch (err) { console.error("[Onboarding]", err); setOnboardingError(appLanguage === "de" ? "Fehler beim Erstellen. Bitte versuche es erneut." : "Failed to create workspace. Please try again."); setWsCreating(false); }
                      }}
                      disabled={!wsName.trim() || wsCreating}
                      style={{
                        width: "100%", marginTop: 16, padding: "14px 24px", borderRadius: 14,
                        background: wsName.trim() ? "#8B7AFF" : "rgba(255,255,255,0.06)",
                        border: "none", color: wsName.trim() ? "#fff" : "#ffffff30",
                        fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: wsName.trim() ? "pointer" : "default",
                        transition: "all 0.25s ease", opacity: wsCreating ? 0.6 : 1,
                      }}
                    >
                      {wsCreating
                        ? (appLanguage === "de" ? "Wird erstellt..." : "Creating...")
                        : (appLanguage === "de" ? "Workspace erstellen" : "Create Workspace")}
                    </motion.button>
                    {onboardingError && (
                      <div style={{ marginTop: 12, fontSize: 13, color: "#E84393", fontFamily: FONT, textAlign: "center" }}>{onboardingError}</div>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => { setOnboardingStep("choose"); setOnboardingError(null); setWsName(""); setWsCreating(false); }}
                      style={{
                        width: "100%", marginTop: 12, padding: "14px 24px", borderRadius: 14,
                        background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                        color: "#ffffff60", fontSize: 14, fontWeight: 500, fontFamily: FONT,
                        cursor: "pointer", transition: "all 0.25s ease",
                      }}
                    >
                      {appLanguage === "de" ? "Abbrechen" : "Cancel"}
                    </motion.button>
                  </motion.div>
              </>)}

              {/* ── Step: Join Workspace ── */}
              {onboardingStep === "join" && (<>
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    style={{ fontSize: 24, fontWeight: 300, color: "#ffffffcc", fontFamily: FONT, letterSpacing: -0.5, marginBottom: 8 }}
                  >
                    {appLanguage === "de" ? "Workspace beitreten" : "Join a Workspace"}
                  </motion.div>

                  {/* Pending invitations */}
                  {pendingInvites.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                      style={{ width: "100%", maxWidth: 360, marginTop: 20, marginBottom: 24 }}
                    >
                      <div style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff45", marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        {appLanguage === "de" ? "Offene Einladungen" : "Pending Invitations"}
                      </div>
                      {pendingInvites.map(inv => (
                        <motion.div
                          key={inv.id}
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          onClick={async () => {
                            if (joining) return;
                            setJoining(true); setOnboardingError(null);
                            try {
                              const { error: memErr } = await supabase.from("org_members").insert({ org_id: inv.org_id, user_id: session.user.id, role: inv.role || "member" });
                              if (memErr) throw memErr;
                              await supabase.from("invitations").update({ status: "accepted" }).eq("id", inv.id);
                              const { data: org } = await supabase.from("organizations").select("*").eq("id", inv.org_id).single();
                              setUserOrg(org); setOnboardingStep(null);
                            } catch (e) { setOnboardingError(appLanguage === "de" ? "Fehler beim Beitreten." : "Failed to join."); setJoining(false); }
                          }}
                          style={{
                            padding: "14px 18px", borderRadius: 14, marginBottom: 8, cursor: "pointer",
                            background: "rgba(139, 122, 255, 0.08)", border: "1px solid rgba(139, 122, 255, 0.15)",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#ffffffdd", fontFamily: FONT }}>{inv.organizations?.name}</div>
                            <div style={{ fontSize: 11, color: "#ffffff40", fontFamily: FONT, marginTop: 2 }}>
                              {appLanguage === "de" ? `Eingeladen als ${inv.role}` : `Invited as ${inv.role}`}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontFamily: FONT, color: "#8B7AFF", fontWeight: 500 }}>
                            {appLanguage === "de" ? "Beitreten →" : "Join →"}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {/* Manual code input */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    style={{ width: "100%", maxWidth: 360, marginTop: pendingInvites.length > 0 ? 0 : 24 }}
                  >
                    <div style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff45", marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
                      {appLanguage === "de" ? "Einladungscode eingeben" : "Enter Invite Code"}
                    </div>
                    <input
                      autoFocus={pendingInvites.length === 0}
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key !== "Enter" || !inviteCode.trim() || joining) return;
                        setJoining(true); setOnboardingError(null);
                        try {
                          const { data: inv, error } = await supabase.from("invitations").select("*, organizations(id, name, slug)").eq("token", inviteCode.trim()).eq("status", "pending").single();
                          if (error || !inv) { setOnboardingError(appLanguage === "de" ? "Ungültiger oder abgelaufener Code." : "Invalid or expired invite code."); setJoining(false); return; }
                          const { error: memErr } = await supabase.from("org_members").insert({ org_id: inv.org_id, user_id: session.user.id, role: inv.role || "member" });
                          if (memErr) throw memErr;
                          await supabase.from("invitations").update({ status: "accepted" }).eq("id", inv.id);
                          const { data: org } = await supabase.from("organizations").select("*").eq("id", inv.org_id).single();
                          setUserOrg(org); setOnboardingStep(null); setInviteCode("");
                        } catch (err) { setOnboardingError(appLanguage === "de" ? "Fehler beim Beitreten." : "Failed to join."); setJoining(false); }
                      }}
                      placeholder={appLanguage === "de" ? "Code einfügen..." : "Paste invite code..."}
                      style={{
                        width: "100%", padding: "14px 18px", borderRadius: 14,
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#ffffffdd", fontSize: 15, fontFamily: FONT, outline: "none",
                        caretColor: "#8B7AFF",
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        if (!inviteCode.trim() || joining) return;
                        setJoining(true); setOnboardingError(null);
                        try {
                          const { data: inv, error } = await supabase.from("invitations").select("*, organizations(id, name, slug)").eq("token", inviteCode.trim()).eq("status", "pending").single();
                          if (error || !inv) { setOnboardingError(appLanguage === "de" ? "Ungültiger oder abgelaufener Code." : "Invalid or expired invite code."); setJoining(false); return; }
                          const { error: memErr } = await supabase.from("org_members").insert({ org_id: inv.org_id, user_id: session.user.id, role: inv.role || "member" });
                          if (memErr) throw memErr;
                          await supabase.from("invitations").update({ status: "accepted" }).eq("id", inv.id);
                          const { data: org } = await supabase.from("organizations").select("*").eq("id", inv.org_id).single();
                          setUserOrg(org); setOnboardingStep(null); setInviteCode("");
                        } catch (err) { setOnboardingError(appLanguage === "de" ? "Fehler beim Beitreten." : "Failed to join."); setJoining(false); }
                      }}
                      disabled={!inviteCode.trim() || joining}
                      style={{
                        width: "100%", marginTop: 16, padding: "14px 24px", borderRadius: 14,
                        background: inviteCode.trim() ? "#8B7AFF" : "rgba(255,255,255,0.06)",
                        border: "none", color: inviteCode.trim() ? "#fff" : "#ffffff30",
                        fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: inviteCode.trim() ? "pointer" : "default",
                        transition: "all 0.25s ease", opacity: joining ? 0.6 : 1,
                      }}
                    >
                      {joining
                        ? (appLanguage === "de" ? "Wird beigetreten..." : "Joining...")
                        : (appLanguage === "de" ? "Beitreten" : "Join Workspace")}
                    </motion.button>
                    {onboardingError && (
                      <div style={{ marginTop: 12, fontSize: 13, color: "#E84393", fontFamily: FONT, textAlign: "center" }}>{onboardingError}</div>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => { setOnboardingStep("choose"); setOnboardingError(null); setInviteCode(""); setJoining(false); }}
                      style={{
                        width: "100%", marginTop: 12, padding: "14px 24px", borderRadius: 14,
                        background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                        color: "#ffffff60", fontSize: 14, fontWeight: 500, fontFamily: FONT,
                        cursor: "pointer", transition: "all 0.25s ease",
                      }}
                    >
                      {appLanguage === "de" ? "Abbrechen" : "Cancel"}
                    </motion.button>
                  </motion.div>
              </>)}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away for notification dropdown */}
      {notifOpen && <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />}

      {/* Top-right bar: Bell + Weather — only visible on dashboard */}
      <AnimatePresence>
        {!panelOpen && !tasksOpen && currentView === "dashboard" && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{
              position: "absolute", top: 16, right: 24, display: "flex", alignItems: "center",
              fontSize: 20, color: "#79787D", zIndex: 50, fontFamily: FONT, fontWeight: 400, gap: 10,
            }}
          >
            {/* Bell */}
            <div style={{ position: "relative", marginTop: 1, marginRight: -3 }}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setNotifOpen(prev => !prev)}
                style={{ position: "relative", width: 36, height: 36, borderRadius: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: notifOpen ? (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)") : "transparent",
                }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0" stroke={theme.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {unreadCount > 0 && (
                  <div style={{
                    position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8,
                    background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: FONT,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                    border: `2px solid ${darkMode ? "#111117" : "#ffffff"}`,
                  }}>{unreadCount > 9 ? "9+" : unreadCount}</div>
                )}
              </motion.div>

              {/* Notification dropdown */}
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: [0.22, 0.68, 0.35, 1.0] }}
                    style={{
                      position: "fixed", top: 70, right: 25, width: 360, maxHeight: 440,
                      background: darkMode ? "rgba(22,22,30,0.98)" : "rgba(255,255,255,0.99)",
                      backdropFilter: "blur(40px)", border: `1px solid ${theme.border}`,
                      borderRadius: 16, overflow: "hidden", boxShadow: darkMode ? "0 12px 32px rgba(0,0,0,0.25)" : "0 8px 24px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div style={{
                      padding: "14px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderBottom: `1px solid ${theme.borderFaint}`,
                    }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 600, color: theme.text }}>Notifications</div>
                      {unreadCount > 0 && (
                        <motion.div whileTap={{ scale: 0.95 }}
                          onClick={markAllNotifsRead}
                          style={{ fontSize: 11, fontFamily: FONT, color: theme.accent, cursor: "pointer" }}
                        >Alle gelesen</motion.div>
                      )}
                    </div>
                    <div style={{ overflowY: "auto", maxHeight: 380 }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, fontFamily: FONT, color: theme.textFaint }}>
                          Keine Benachrichtigungen
                        </div>
                      ) : notifications.map(n => {
                        const iconMap = {
                          task_assigned: "📋", comment_added: "💬",
                          calendar_reminder: n.metadata?.hangoutLink ? "📹" : "📅",
                          member_joined: "👤", task_updated: "✏️",
                          chat_message: "💬",
                          reminder: "⏰",
                        };
                        const timeAgo = (() => {
                          const diff = Date.now() - new Date(n.created_at).getTime();
                          const mins = Math.floor(diff / 60000);
                          if (mins < 1) return "gerade eben";
                          if (mins < 60) return `${mins} Min`;
                          const hrs = Math.floor(mins / 60);
                          if (hrs < 24) return `${hrs} Std`;
                          return `${Math.floor(hrs / 24)} T`;
                        })();
                        return (
                          <motion.div key={n.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              markNotifRead(n.id);
                              if (n.type === "chat_message") { setOpenChatConvId(n.metadata?.conversation_id || null); setCurrentView("chat"); setNotifOpen(false); }
                              else if (n.metadata?.task_id) { setOpenTaskId(n.metadata.task_id); setCurrentView("kanban"); setNotifOpen(false); }
                              else if (n.metadata?.hangoutLink) { window.open(n.metadata.hangoutLink, "_blank"); }
                              else if (n.type === "calendar_reminder") { setCurrentView("calendar"); setNotifOpen(false); }
                              else if (n.type === "reminder") { setNotifOpen(false); }
                            }}
                            style={{
                              padding: "12px 18px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12,
                              background: n.read ? "transparent" : (darkMode ? "rgba(139,122,255,0.04)" : "rgba(139,122,255,0.06)"),
                              borderBottom: `1px solid ${theme.borderFaint}`,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 13, fontFamily: FONT, color: theme.text,
                                fontWeight: n.read ? 400 : 600, lineHeight: 1.4,
                              }}>{n.title}</div>
                              {n.body && (
                                <div style={{
                                  fontSize: 12, fontFamily: FONT, color: theme.textDim,
                                  marginTop: 2, lineHeight: 1.4,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>{n.body}</div>
                              )}
                              <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, marginTop: 4 }}>{timeAgo}</div>
                            </div>
                            {!n.read && (
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: theme.accent, flexShrink: 0, marginTop: 6 }} />
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Weather */}
            {(currentView === "dashboard" || currentView === "files") && (
              <>
                {weather}°
                <svg width="24" height="19" viewBox="0 0 20 16" fill="none">
                  <path opacity="0.7" d="M9 2C11.6123 2 13.8334 3.66984 14.6572 6H15C17.7614 6 20 8.23858 20 11C20 13.7614 17.7614 16 15 16H4.5C2.01472 16 0 13.9853 0 11.5C0 9.5226 1.27576 7.84409 3.04883 7.24023C3.4223 4.2853 5.9437 2 9 2ZM15 0C17.7614 0 20 2.23858 20 5C20 5.48668 19.9285 5.95656 19.7988 6.40137C18.7997 5.07171 17.2622 4.16972 15.5088 4.02246C14.883 2.57436 13.7037 1.42135 12.2373 0.831055C13.0287 0.305544 13.9788 0 15 0Z" fill="#79787D"/>
                </svg>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification toast */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0, y: -14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{
              position: "absolute", top: 24, left: "50%", x: "-50%",
              background: darkMode ? "#ffffff0A" : "rgba(0,0,0,0.06)", backdropFilter: "blur(30px)", borderRadius: 24,
              padding: "9px 24px", fontSize: 12, color: theme.text, zIndex: 30,
              fontFamily: FONT, fontWeight: 400, letterSpacing: 1,
              border: `1px solid ${darkMode ? "#ffffff0A" : "rgba(0,0,0,0.08)"}`,
            }}
          >{selectedItem}</motion.div>
        )}
      </AnimatePresence>

      {/* Center area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>

        {menuOpen && <div onClick={handleClose} style={{ position: "absolute", inset: 0, zIndex: 0 }} />}

        {/* KANBAN VIEW */}
        <AnimatePresence>
          {currentView === "kanban" && (
            <KanbanBoard session={session} onBack={() => { setOpenTaskId(null); setTriggerNewTask(false); setCurrentView("dashboard"); }} theme={theme} darkMode={darkMode} t={t} openTaskId={openTaskId} triggerNewTask={triggerNewTask} onNewTaskTriggered={() => setTriggerNewTask(false)} userOrg={userOrg} orgMembers={orgMembers} createNotification={createNotification} myProjectNames={myProjectNames} />
          )}
        </AnimatePresence>

        {/* CALENDAR VIEW */}
        <AnimatePresence>
          {currentView === "calendar" && (
            <CalendarView session={session} getProviderToken={getProviderToken} openMeetCall={openMeetCall} autoReLogin={autoReLogin} ensureValidToken={ensureValidToken} onBack={() => setCurrentView("dashboard")} theme={theme} darkMode={darkMode} t={t} userOrg={userOrg} />
          )}
        </AnimatePresence>

        {/* NOTES VIEW */}
        <AnimatePresence>
          {currentView === "notes" && (
            <NotesView session={session} userOrg={userOrg} theme={theme} darkMode={darkMode} t={t} onBack={() => setCurrentView("dashboard")} ensureValidToken={ensureValidToken} llmKeys={llmKeys} llmProvider={llmProvider} />
          )}
        </AnimatePresence>

        {/* PROJECTS VIEW */}
        <AnimatePresence>
          {currentView === "projects" && (
            <ProjectsView session={session} userOrg={userOrg} orgMembers={orgMembers} myProjectIds={myProjectIds} theme={theme} darkMode={darkMode} t={t} onBack={() => setCurrentView("dashboard")} onOpenInKanban={(projectName) => { setCurrentView("kanban"); }} />
          )}
        </AnimatePresence>

        {/* BRAND VIEW */}
        <AnimatePresence>
          {currentView === "brand" && (
            <BrandView session={session} userOrg={userOrg} theme={theme} darkMode={darkMode} t={t} brandTab={brandTab} setBrandTab={setBrandTab} onBack={() => setCurrentView("dashboard")} />
          )}
        </AnimatePresence>

        {/* FILES VIEW */}
        <AnimatePresence>
          {currentView === "files" && (
            <FilesView session={session} getProviderToken={getProviderToken} autoReLogin={autoReLogin} ensureValidToken={ensureValidToken} theme={theme} darkMode={darkMode} t={t} filesFilter={filesFilter} setFilesFilter={setFilesFilter} onBack={() => {
              setCurrentView("dashboard");
              setMenuSource("grid");
              setActiveIndex(4);
              setMenuOpen(true);
              setSubOpen(true);
              try { sounds.menuOpen(); } catch(e) {}
            }} />
          )}
        </AnimatePresence>

        {/* CHAT VIEW */}
        <AnimatePresence>
          {currentView === "chat" && (
            <ChatView
              initialTab={chatTab}
              initialConvId={openChatConvId}
              onConvOpened={() => setOpenChatConvId(null)}
              t={t}
              session={session}
              userOrg={userOrg}
              orgMembers={orgMembers}
              darkMode={darkMode}
              theme={theme}
              createNotification={createNotification}
              notifications={notifications}
              markNotifRead={markNotifRead}
              onBack={() => {
                setCurrentView("dashboard");
                setMenuSource("grid");
                setActiveIndex(0);
                setMenuOpen(true);
                setSubOpen(true);
                try { sounds.menuOpen(); } catch(e) {}
              }}
            />
          )}
        </AnimatePresence>

        {/* START VIEW — visible when on dashboard, menu closed, not in voice mode */}
        <AnimatePresence>
          {currentView === "dashboard" && !menuOpen && !voiceMode && !aiSpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={(panelOpen || tasksOpen) ? { opacity: 0.2, scale: 0.9, filter: "blur(8px)", y: 0 } : { opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                padding: "60px 80px",
                transformOrigin: "50% 50%",
              }}
            >
              {/* Greeting */}
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 43, fontWeight: 400, color: theme.text,
                  fontFamily: FONT, letterSpacing: -0.5, lineHeight: 1.2,
                }}>{getGreeting()}, {(userName || "").split(" ")[0] || t("greet.fallbackName")}</div>
                <div style={{
                  fontSize: 43, fontWeight: 400, color: theme.textFaint,
                  fontFamily: FONT, letterSpacing: -0.5, lineHeight: 1.3,
                }}>{t("dash.subtitle")}</div>
              </div>

              {/* Tasks — real data from Kanban + Calendar, padded to always show 4 cards */}
              <div style={{
                display: "flex", flexDirection: "column", gap: 10,
                maxWidth: 720, alignSelf: "center", width: "100%",
                marginTop: "auto", marginBottom: 100,
              }}>
              {startviewCards.map((task, i) => (
                <motion.div
                  key={task.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0], delay: 0.15 + i * 0.06 }}
                  className="hover-row"
                  onClick={task.onClick}
                  style={{
                    display: "flex", alignItems: "center", gap: 18,
                    padding: "16px 24px", borderRadius: 18,
                    background: i < 2 ? theme.hoverBg : "transparent",
                    border: i < 2 ? `1px solid ${theme.borderFaint}` : "1px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {task.logoUrl ? (
                    task.fullbleed ? (
                      <img src={task.logoUrl} alt="" style={{
                        width: 50, height: 50, borderRadius: "50%",
                        objectFit: "cover", flexShrink: 0,
                      }} />
                    ) : (
                      <div style={{
                        width: 50, height: 50, borderRadius: "50%",
                        background: task.iconBg, display: "flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0, overflow: "hidden",
                      }}>
                        <img src={task.logoUrl} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
                      </div>
                    )
                  ) : (
                    <div style={{
                      width: 50, height: 50, borderRadius: "50%",
                      background: task.iconBg, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 22, flexShrink: 0,
                    }}>{task.icon}</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 19, fontFamily: FONT, color: theme.text,
                      fontWeight: 400,
                    }}>{task.name}</div>
                    {task.desc && (
                      <div style={{
                        fontSize: 15, fontFamily: FONT, color: theme.textDim,
                        marginTop: 3,
                      }}>{task.desc}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <span style={{
                      fontSize: 13, color: theme.textDim, fontFamily: FONT,
                      padding: "5px 8px", borderRadius: 6,
                      background: theme.borderFaint,
                    }}>⌘</span>
                    <span style={{
                      fontSize: 13, color: theme.textDim, fontFamily: FONT,
                      padding: "5px 8px", borderRadius: 6,
                      background: theme.borderFaint,
                    }}>{i + 1}</span>
                  </div>
                </motion.div>
              ))}
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* VOICE RECORDING VIEW */}
        <AnimatePresence>
          {voiceMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
              onClick={stopVoice}
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", zIndex: 15,
              }}
            >
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  fontSize: 13, fontFamily: FONT, color: darkMode ? "#ffffff50" : "#1a1a2e90",
                  letterSpacing: 2, marginBottom: 24, fontWeight: 400,
                }}
              >LISTENING...</motion.div>

              <WaveformEqualizer darkMode={darkMode} />

              {/* Live transcript */}
              <AnimatePresence>
                {transcript && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      fontSize: 15, fontFamily: FONT, color: darkMode ? "#ffffffAA" : "#1a1a2eCC",
                      fontWeight: 400, textAlign: "center", maxWidth: 400,
                      marginTop: 28, lineHeight: 1.5, padding: "0 20px",
                    }}
                  >{transcript}</motion.div>
                )}
              </AnimatePresence>

              <div style={{
                fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff25" : "#1a1a2e70",
                letterSpacing: 1.5, marginTop: 20,
              }}>{t("ai.clickToSend")}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI SPEAKING VIEW — sphere animates in center */}
        <AnimatePresence mode="sync">
          {aiSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={voiceNavActiveRef.current ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={voiceNavActiveRef.current ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 18, mass: 0.8 }}
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                zIndex: 15,
              }}
            >
              {/* Status label */}
              <motion.div
                animate={{ opacity: aiStatus === "thinking" ? [0.4, 0.8, 0.4] : 0.6 }}
                transition={{ duration: 1.5, repeat: aiStatus === "thinking" ? Infinity : 0, ease: "easeInOut" }}
                style={{
                  fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff40" : "#1a1a2e50",
                  letterSpacing: 2, marginBottom: 20, fontWeight: 400,
                }}
              >{aiStatus === "thinking" ? t("ai.thinking") : ""}</motion.div>

              {/* Pulsing glow behind sphere — click to stop */}
              <motion.div
                onClick={stopAI}
                animate={{
                  boxShadow: aiStatus === "speaking" ? [
                    "0 0 40px rgba(130,80,200,0.15), 0 0 80px rgba(130,80,200,0.05)",
                    "0 0 70px rgba(130,80,200,0.3), 0 0 140px rgba(130,80,200,0.12)",
                    "0 0 40px rgba(130,80,200,0.15), 0 0 80px rgba(130,80,200,0.05)",
                  ] : "0 0 30px rgba(130,80,200,0.1)",
                  scale: aiStatus === "speaking" ? [1, 1.04, 1] : 1,
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                style={{ borderRadius: "50%", cursor: "pointer" }}
              >
                <AISpeakingSphere darkMode={darkMode} />
              </motion.div>
              {(aiStatus === "speaking" || aiStatus === "idle") && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                  style={{ fontSize: 10, fontFamily: FONT, color: darkMode ? "#ffffff25" : "#1a1a2e40", letterSpacing: 2, marginTop: 20 }}>
                  {aiStatus === "speaking" ? t("ai.clickToStop") : t("ai.clickToClose")}
                </motion.div>
              )}

              {/* AI response text — karaoke-style word highlighting */}
              <AnimatePresence>
                {aiResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 0.68, 0.35, 1.0] }}
                    style={{
                      fontSize: 14, fontFamily: FONT,
                      fontWeight: 400, textAlign: "center", maxWidth: 560,
                      marginTop: 28, lineHeight: 1.7, padding: "0 20px",
                    }}
                  >
                    {aiResponse.split(/\s+/).filter(Boolean).map((word, i) => {
                      const isSpoken = highlightWordIndex >= 0 && i <= highlightWordIndex;
                      const isCurrent = highlightWordIndex >= 0 && i === highlightWordIndex;
                      return (
                        <span key={i} style={{
                          color: isSpoken
                            ? (darkMode ? "#ffffffE6" : "#1a1a2eE6")
                            : (darkMode ? "#ffffff30" : "#1a1a2e35"),
                          textShadow: isCurrent ? "0 0 12px rgba(139,122,255,0.5)" : "none",
                          transition: "color 0.2s ease, text-shadow 0.3s ease",
                        }}>{word}{" "}</span>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub items — rounded rect cards in circular arrangement */}
        <AnimatePresence>
          {menuOpen && subOpen && currentItem.sub.map((sub, i) => {
            const count = currentItem.sub.length;
            const angleStep = (2 * Math.PI) / count;
            const angle = -Math.PI / 2 + i * angleStep;
            const orbitRadius = 235;
            const px = Math.cos(angle) * orbitRadius;
            const py = Math.sin(angle) * orbitRadius;
            const isHovered = subHover === i;
            return (
              <motion.div key={sub.id}
                initial={{ opacity: 0, scale: 0.5, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.7, filter: "blur(4px)" }}
                transition={{
                  type: "spring", stiffness: 200, damping: 20, mass: 0.6,
                  delay: i * 0.03,
                  exit: { duration: 0.15, ease: "easeIn" },
                }}
                onMouseEnter={() => { setSubHover(i); try { sounds.hover(); } catch(e) {} }}
                onMouseLeave={() => setSubHover(-1)}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${px}px - 75px)`,
                  top: `calc(50% + ${py}px - 75px)`,
                  zIndex: 20, cursor: "pointer",
                }}>
                <motion.div
                  onClick={() => handleSubClick(sub)}
                  animate={{
                    background: isHovered ? (darkMode ? "rgba(255,255,255,0.95)" : "rgba(42,42,50,0.95)") : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                    borderColor: isHovered ? (darkMode ? "rgba(255,255,255,0.5)" : "rgba(42,42,50,0.4)") : (darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"),
                    scale: isHovered ? 1.05 : 1,
                  }}
                  transition={smoothSpring}
                  style={{
                    width: 150, height: 150, borderRadius: 28,
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}>
                  <motion.span
                    animate={{
                      color: isHovered ? (darkMode ? "#111117" : "#ffffff") : theme.textSub,
                    }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{
                      fontSize: 15, fontFamily: FONT, fontWeight: 500,
                      letterSpacing: 0.5, pointerEvents: "none",
                    }}
                  >{sub.label}</motion.span>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Segmented ring */}
        <AnimatePresence>
          {menuOpen && !subOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94], exit: { duration: 0.15 } }}
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 13,
              }}
            >
              <SegmentedRing count={itemCount} activeIndex={activeIndex} darkMode={darkMode} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub ring */}
        <AnimatePresence>
          {menuOpen && subOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94], exit: { duration: 0.15 } }}
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 13,
              }}
            >
              <svg width={200} height={200}>
                <circle cx={100} cy={100} r={95} fill="none" stroke={darkMode ? COLORS.ringInactive : "#44444818"} strokeWidth={1.5} />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solid backdrop: covers the underlying view with neutral theme bg
            so menu opens on a clean canvas. Fades to transparent at the
            bottom so the dashboard gradient/nav bar reads cleanly underneath.
            pointer-events:none so wheel events reach the menu container. */}
        <AnimatePresence>
          {menuOpen && currentView !== "dashboard" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                position: "absolute", inset: 0, zIndex: 10,
                background: theme.bg,
                pointerEvents: "none",
                WebkitMaskImage: "linear-gradient(to bottom, black 0, black calc(100% - 220px), transparent calc(100% - 40px))",
                maskImage: "linear-gradient(to bottom, black 0, black calc(100% - 220px), transparent calc(100% - 40px))",
              }}
            />
          )}
        </AnimatePresence>

        {/* Mask circle */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: 170, height: 170, borderRadius: "50%",
                background: darkMode ? COLORS.bg : "#2a2a32", zIndex: 11, pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>

        {/* Center label */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => { e.stopPropagation(); handleCenterClick(); }}
              style={{
                width: 180, height: 180,
                borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", zIndex: 12,
              }}
            >
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={activeIndex}
                  initial={{ opacity: 0, y: 3, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, position: "absolute" }}
                  transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0] }}
                  style={{
                    fontSize: 14, fontWeight: 500, color: darkMode ? COLORS.text : "#ffffffCC", letterSpacing: 5,
                    fontFamily: FONT,
                  }}
                >
                  {currentItem.label}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* SLIDE-UP PANEL — appears when scrolling up on dashboard */}
      <AnimatePresence>
        {currentView === "dashboard" && !menuOpen && !voiceMode && !aiSpeaking && panelOpen && (
          <motion.div
            initial={{ scale: 1.08, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.06, opacity: 0, y: 30 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, top: "18%",
              background: darkMode ? "linear-gradient(180deg, transparent 0%, #111117 6%)" : "linear-gradient(180deg, transparent 0%, #F5F5F7 6%)",
              paddingTop: 32, zIndex: 25, overflowY: "hidden",
            }}
          >
            {/* Drag handle */}
            <div onClick={() => setPanelOpen(false)} style={{ width: 36, height: 4, borderRadius: 2, background: darkMode ? "#ffffff18" : "#1a1a2e20", margin: "0 auto 24px", cursor: "pointer" }} />

            <div style={{ padding: "0 40px 120px", display: "flex", flexDirection: "column", gap: 28 }}>

              {/* Stats row */}
              <div>
                <div style={{ fontSize: 10, fontFamily: FONT, color: darkMode ? "#ffffff30" : "#1a1a2e50", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>{t("dash.overview")}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { label: t("dash.open"), value: "8", color: "#8B7AFF" },
                    { label: t("dash.inProgress"), value: "3", color: "#F59E0B" },
                    { label: t("dash.doneToday"), value: "2", color: "#00B894" },
                    { label: t("dash.messages"), value: "4", color: "#E84393" },
                  ].map((stat, i) => (
                    <motion.div key={stat.label}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                      style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: darkMode ? "#16161E" : "rgba(255,255,255,0.9)", border: darkMode ? "1px solid #ffffff0A" : "1px solid rgba(0,0,0,0.06)" }}
                    >
                      <div style={{ fontSize: 26, fontWeight: 300, fontFamily: FONT, color: stat.color, lineHeight: 1, marginBottom: 5 }}>{stat.value}</div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff40" : "#1a1a2e70" }}>{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Active projects */}
              <div>
                <div style={{ fontSize: 10, fontFamily: FONT, color: darkMode ? "#ffffff30" : "#1a1a2e50", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>{t("dash.activeProjects")}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { name: "Meridian", progress: 68, color: "#8B7AFF", tasks: `12 ${t("dash.tasks")}` },
                    { name: "Volta", progress: 34, color: "#00B894", tasks: `7 ${t("dash.tasks")}` },
                    { name: "Rebranding", progress: 90, color: "#F59E0B", tasks: `3 ${t("dash.tasks")}` },
                  ].map((proj, i) => (
                    <motion.div key={proj.name}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.06, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                      style={{ flex: 1, padding: "16px 18px", borderRadius: 14, background: darkMode ? "#16161E" : "rgba(255,255,255,0.9)", border: darkMode ? "1px solid #ffffff0A" : "1px solid rgba(0,0,0,0.06)", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontFamily: FONT, color: darkMode ? "#ffffffCC" : "#1a1a2eDD", fontWeight: 500 }}>{proj.name}</div>
                        <div style={{ fontSize: 12, fontFamily: FONT, color: proj.color }}>{proj.progress}%</div>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: darkMode ? "#ffffff0A" : "rgba(0,0,0,0.06)", marginBottom: 8 }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${proj.progress}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: [0.22, 0.68, 0.35, 1.0] }} style={{ height: "100%", borderRadius: 2, background: proj.color }} />
                      </div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff30" : "#1a1a2e55" }}>{proj.tasks}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Activity feed */}
              <div>
                <div style={{ fontSize: 10, fontFamily: FONT, color: darkMode ? "#ffffff30" : "#1a1a2e50", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>{t("dash.activity")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[
                    { icon: "◆", color: "#8B7AFF", title: t("dash.actAiAnalysis"), time: t("dash.act2min"), sub: "Meridian — 8 Insights" },
                    { icon: "✓", color: "#00B894", title: t("dash.actBrandDone"), time: t("dash.act18min"), sub: "Sandro · Meridian" },
                    { icon: "◎", color: "#F59E0B", title: t("dash.actNewMessage"), time: t("dash.act34min"), sub: "#brand-refresh" },
                    { icon: "⏱", color: darkMode ? "#ffffff50" : "#1a1a2e60", title: t("dash.actTimeTracked"), time: t("dash.act1h"), sub: t("dash.actLoggedToday") },
                  ].map((item, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.06, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", borderRadius: 12, cursor: "pointer" }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: item.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: item.color }}>{item.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontFamily: FONT, color: darkMode ? "#ffffffCC" : "#1a1a2eDD", fontWeight: 400 }}>{item.title}</div>
                        <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff40" : "#1a1a2e60", marginTop: 2 }}>{item.sub}</div>
                      </div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff25" : "#1a1a2e40" }}>{item.time}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div>
                <div style={{ fontSize: 10, fontFamily: FONT, color: darkMode ? "#ffffff30" : "#1a1a2e50", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>Quick Actions</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { label: t("dash.newTask"), icon: "＋", color: "#8B7AFF" },
                    { label: t("dash.askAi"), icon: "✦", color: "#E84393" },
                    { label: t("dash.newDoc"), icon: "◻", color: "#00B894" },
                    { label: t("dash.schedule"), icon: "◷", color: "#F59E0B" },
                  ].map((action, i) => (
                    <motion.div key={action.label}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
                      whileHover={{ scale: 1.04, background: darkMode ? "#1E1E28" : "rgba(0,0,0,0.04)" }}
                      whileTap={{ scale: 0.97 }}
                      style={{ flex: 1, padding: "14px 12px", borderRadius: 14, background: darkMode ? "#16161E" : "rgba(255,255,255,0.9)", border: darkMode ? "1px solid #ffffff0A" : "1px solid rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                    >
                      <div style={{ fontSize: 18, color: action.color }}>{action.icon}</div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff60" : "#1a1a2e80" }}>{action.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TASKS VIEW — scroll up from dashboard */}
      <AnimatePresence>
        {currentView === "dashboard" && !menuOpen && !voiceMode && !aiSpeaking && tasksOpen && (
          <motion.div
            initial={{ scale: 1.08, opacity: 0, y: -40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.06, opacity: 0, y: -30 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: "12%",
              background: darkMode ? "linear-gradient(0deg, transparent 0%, #111117 6%)" : "linear-gradient(0deg, transparent 0%, #F5F5F7 6%)",
              paddingBottom: 32, zIndex: 25, overflowY: "hidden",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, padding: "40px 40px 0", display: "flex", flexDirection: "column", gap: 24, overflowY: "hidden" }}>

              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <div>
                  <div style={{ fontSize: 10, fontFamily: FONT, color: darkMode ? "#ffffff60" : "#8A8F99", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>Deine Aufgaben</div>
                  <div style={{ fontSize: 28, fontFamily: FONT, color: darkMode ? "#ffffffCC" : "#1a1a2eDD", fontWeight: 300 }}>Was steht an</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { label: t("dash.all"), count: dashboardTasks.filter(tk => tk.column_key !== "done").length, active: true },
                  ].map(f => (
                    <div key={f.label} style={{
                      padding: "6px 14px", borderRadius: 10, cursor: "pointer",
                      background: f.active ? (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)") : (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                      border: `1px solid ${f.active ? (darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)") : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)")}`,
                      fontSize: 12, fontFamily: FONT, color: f.active ? (darkMode ? "#ffffffdd" : "#1a1a2eDD") : (darkMode ? "#ffffff50" : "#1a1a2e60"),
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {f.label}
                      <span style={{ fontSize: 10, color: f.active ? (darkMode ? "#8B7AFF" : "#6C5CE7") : (darkMode ? "#ffffff30" : "#1a1a2e40") }}>{f.count}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Task sections — real data from Kanban board */}
              {(() => {
                // Strict visibility: only tasks in user's projects + projectless tasks
                const activeTasks = dashboardTasks
                  .filter(tk => tk.column_key !== "done")
                  .filter(tk => !tk.project_name || myProjectNames.has(tk.project_name));
                const highTasks = activeTasks.filter(tk => tk.priority === "high");
                const mediumTasks = activeTasks.filter(tk => tk.priority === "medium");
                const lowTasks = activeTasks.filter(tk => tk.priority === "low" || !tk.priority);
                const iconMap = { "todo": "◻", "progress": "◎", "in_progress": "◎", "review": "◆", "done": "✓" };
                const getDashProjLogo = (name) => dashboardProjects.find(p => p.name === name)?.logo_url || null;
                const colLabel = (key) => {
                  const map = { "todo": t("kanban.todo"), "progress": t("kanban.inProgress"), "in_progress": t("kanban.inProgress"), "review": t("kanban.review"), "done": t("kanban.done") };
                  return map[key] || key;
                };

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0, overflowY: "auto" }}>

                    {/* Priority / High */}
                    {highTasks.length > 0 && (
                      <div>
                        <motion.div
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1, duration: 0.3 }}
                          style={{ fontSize: 10, fontFamily: FONT, color: "#C9437E", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C9437E" }} />
                          {t("dash.priority")}
                        </motion.div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {highTasks.map((tsk, i) => (
                            <motion.div key={tsk.id}
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.12 + i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                              className="hover-row"
                              onClick={() => { setTasksOpen(false); setCurrentView("kanban"); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "13px 16px", borderRadius: 14,
                                background: darkMode ? "rgba(232, 67, 147, 0.04)" : "rgba(232, 67, 147, 0.05)",
                                border: darkMode ? "1px solid rgba(232, 67, 147, 0.1)" : "1px solid rgba(232, 67, 147, 0.15)",
                                cursor: "pointer",
                              }}
                            >
                              {getDashProjLogo(tsk.project_name) ? (
                                <img src={getDashProjLogo(tsk.project_name)} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 22, height: 22, borderRadius: 6, border: "1.5px solid #E8439360", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <div style={{ fontSize: 9, color: "#E84393" }}>{iconMap[tsk.column_key] || "◻"}</div>
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontFamily: FONT, color: darkMode ? "#ffffffCC" : "#1a1a2eDD", fontWeight: 400 }}>{tsk.title}</div>
                                <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff60" : "#1a1a2e80", marginTop: 2 }}>{tsk.project_name || colLabel(tsk.column_key)}</div>
                              </div>
                              <div style={{ fontSize: 11, fontFamily: FONT, color: "#C9437E", flexShrink: 0, fontWeight: 500 }}>{colLabel(tsk.column_key)}</div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Medium priority */}
                    {mediumTasks.length > 0 && (
                      <div>
                        <motion.div
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2, duration: 0.3 }}
                          style={{ fontSize: 10, fontFamily: FONT, color: darkMode ? "#ffffff50" : "#8A8F99", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: darkMode ? "#ffffff50" : "#8A8F99" }} />
                          {t("dash.today")}
                        </motion.div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {mediumTasks.map((tsk, i) => (
                            <motion.div key={tsk.id}
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.22 + i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                              className="hover-row"
                              onClick={() => { setTasksOpen(false); setCurrentView("kanban"); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "13px 16px", borderRadius: 14,
                                background: darkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)",
                                border: darkMode ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)",
                                cursor: "pointer",
                              }}
                            >
                              {getDashProjLogo(tsk.project_name) ? (
                                <img src={getDashProjLogo(tsk.project_name)} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 22, height: 22, borderRadius: 6, border: darkMode ? "1.5px solid #ffffff20" : "1.5px solid #1a1a2e20", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <div style={{ fontSize: 9, color: darkMode ? "#ffffff40" : "#1a1a2e50" }}>{iconMap[tsk.column_key] || "◻"}</div>
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontFamily: FONT, color: darkMode ? "#ffffffCC" : "#1a1a2eDD", fontWeight: 400 }}>{tsk.title}</div>
                                <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff60" : "#1a1a2e80", marginTop: 2 }}>{tsk.project_name || colLabel(tsk.column_key)}</div>
                              </div>
                              <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff60" : "#8A8F99", flexShrink: 0, fontWeight: 500 }}>{colLabel(tsk.column_key)}</div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Low priority / upcoming */}
                    {lowTasks.length > 0 && (
                      <div>
                        <motion.div
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3, duration: 0.3 }}
                          style={{ fontSize: 10, fontFamily: FONT, color: "#8B7AFF80", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8B7AFF" }} />
                          {t("dash.upcoming")}
                        </motion.div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {lowTasks.map((tsk, i) => (
                            <motion.div key={tsk.id}
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.32 + i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                              className="hover-row"
                              onClick={() => { setTasksOpen(false); setCurrentView("kanban"); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "13px 16px", borderRadius: 14,
                                background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                                border: darkMode ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.04)",
                                cursor: "pointer",
                              }}
                            >
                              {getDashProjLogo(tsk.project_name) ? (
                                <img src={getDashProjLogo(tsk.project_name)} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 22, height: 22, borderRadius: 6, border: darkMode ? "1.5px solid #ffffff15" : "1.5px solid #1a1a2e15", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <div style={{ fontSize: 9, color: darkMode ? "#ffffff30" : "#1a1a2e40" }}>{iconMap[tsk.column_key] || "◻"}</div>
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontFamily: FONT, color: darkMode ? "#ffffff90" : "#1a1a2eBB", fontWeight: 400 }}>{tsk.title}</div>
                                <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff25" : "#1a1a2e40", marginTop: 2 }}>{tsk.project_name || colLabel(tsk.column_key)}</div>
                              </div>
                              <div style={{ fontSize: 11, fontFamily: FONT, color: darkMode ? "#ffffff30" : "#1a1a2e50", flexShrink: 0 }}>{colLabel(tsk.column_key)}</div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reminders section */}
                    {dashboardReminders.length > 0 && (
                      <div>
                        <motion.div
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.35, duration: 0.3 }}
                          style={{ fontSize: 10, fontFamily: FONT, color: "#5DB89E", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#5DB89E" }} />
                          Reminder
                        </motion.div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {dashboardReminders.map((rem, i) => {
                            // Reminder time = when user wants to be notified
                            // Legacy reminders had lead_minutes; new ones store remind_at = event time
                            const remindDate = new Date(rem.remind_at);
                            const dateStr = remindDate.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
                            const timeStr = remindDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
                            return (
                              <motion.div key={rem.id}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.37 + i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                                className="hover-row"
                                style={{
                                  display: "flex", alignItems: "center", gap: 14,
                                  padding: "13px 16px", borderRadius: 14,
                                  background: darkMode ? "rgba(0, 184, 148, 0.04)" : "rgba(0, 184, 148, 0.05)",
                                  border: darkMode ? "1px solid rgba(0, 184, 148, 0.1)" : "1px solid rgba(0, 184, 148, 0.12)",
                                }}
                              >
                                <div style={{
                                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                  border: "1.5px solid #5DB89E60",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#5DB89E" strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke="#5DB89E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontFamily: FONT, color: darkMode ? "#ffffffCC" : "#1a1a2eDD", fontWeight: 400 }}>{rem.title}</div>
                                </div>
                                <div style={{ fontSize: 11, fontFamily: FONT, color: "#5DB89E", flexShrink: 0, textAlign: "right" }}>
                                  <div>{dateStr}</div>
                                  <div style={{ fontSize: 10, opacity: 0.7 }}>{timeStr}</div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {activeTasks.length === 0 && dashboardReminders.length === 0 && (
                      <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
                        <div style={{ fontSize: 14, fontFamily: FONT, color: darkMode ? "#ffffff60" : "#1a1a2e80" }}>{t("dash.noTasks")}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Drag handle at bottom */}
            <div onClick={() => setTasksOpen(false)} style={{ width: 36, height: 4, borderRadius: 2, background: darkMode ? "#ffffff18" : "#1a1a2e20", margin: "24px auto 0", cursor: "pointer" }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Meet Call Indicator */}
      <AnimatePresence>
        {activeMeetCall && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 100,
              display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
              borderRadius: 30, background: "rgba(0,184,148,0.15)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(0,184,148,0.25)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {/* Pulsing dot */}
            <div style={{ position: "relative", width: 10, height: 10 }}>
              <motion.div
                animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#00B894" }}
              />
              <div style={{ position: "absolute", inset: 2, borderRadius: "50%", background: "#00B894" }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", color: "#00B894", fontWeight: 500 }}>
              {activeMeetCall.title}
            </span>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={focusMeetCall}
              style={{ cursor: "pointer", padding: "3px 10px", borderRadius: 8, fontSize: 11, fontFamily: "Inter, system-ui, sans-serif", color: "#ffffffcc", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
            >Öffnen</motion.div>
            <motion.div
              whileHover={{ scale: 1.05, background: "rgba(232,67,67,0.2)" }}
              whileTap={{ scale: 0.95 }}
              onClick={endMeetCall}
              style={{ cursor: "pointer", padding: "3px 10px", borderRadius: 8, fontSize: 11, fontFamily: "Inter, system-ui, sans-serif", color: "#E84363", background: "rgba(232,67,67,0.08)", border: "1px solid rgba(232,67,67,0.15)", transition: "all 0.15s" }}
            >Beenden</motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETTINGS VIEW */}
      <AnimatePresence>
        {currentView === "settings" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{
              position: "fixed", inset: 0, zIndex: 30,
              background: theme.bg,
              display: "flex", flexDirection: "column",
              overflowY: "auto",
            }}
          >
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 40px 0" }}>
              <motion.div
                onClick={() => setCurrentView("dashboard")}
                whileHover={{ opacity: 0.7 }}
                whileTap={{ scale: 0.95 }}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke={theme.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim }}>{t("common.back")}</span>
              </motion.div>
              <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase" }}>{t("settings.title")}</div>
              <div style={{ width: 60 }} />
            </div>

            <div style={{ maxWidth: 860, width: "100%", margin: "0 auto", padding: "32px 40px 120px" }}>

              {/* Profile card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{
                  padding: "28px 28px",
                  borderRadius: 20,
                  background: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  {userAvatar ? (
                    <img src={userAvatar} alt="" referrerPolicy="no-referrer" style={{ width: 64, height: 64, borderRadius: 18, border: `1px solid ${theme.border}` }} />
                  ) : (
                    <div style={{
                      width: 64, height: 64, borderRadius: 18,
                      background: "linear-gradient(135deg, #8B7AFF, #6C5CE7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 26, fontFamily: FONT, color: "#fff", fontWeight: 600,
                    }}>{(userName || "?")[0]}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 22, fontFamily: FONT, fontWeight: 600, color: theme.text, lineHeight: 1.3 }}>
                      {userName || "User"}
                    </div>
                    <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {userEmail}
                    </div>
                  </div>
                  {/* Workspace switcher */}
                  {userOrg && (
                    <div style={{ position: "relative" }}>
                      <motion.div
                        onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                        whileHover={{ opacity: 0.85 }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                          borderRadius: 12, cursor: "pointer",
                          background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                          border: `1px solid ${theme.borderFaint}`,
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: "linear-gradient(135deg, #8B7AFF30, #6C5CE730)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 600, fontFamily: FONT, color: "#8B7AFF",
                        }}>{(userOrg.name || "W")[0]}</div>
                        <div>
                          <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 500, color: theme.text, lineHeight: 1.2 }}>{userOrg.name}</div>
                          <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, textTransform: "capitalize" }}>{userOrgRole || "member"}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 4, transform: wsDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                          <path d="M6 9l6 6 6-6" stroke={theme.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </motion.div>
                      {/* Dropdown */}
                      <AnimatePresence>
                        {wsDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                            transition={{ duration: 0.15 }}
                            style={{
                              position: "absolute", top: "calc(100% + 6px)", right: 0,
                              minWidth: 200, borderRadius: 14, overflow: "hidden",
                              background: darkMode ? "#1e1e2a" : "#fff",
                              border: `1px solid ${theme.border}`,
                              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                              zIndex: 50,
                            }}
                          >
                            <div style={{ padding: "10px 12px 6px", fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 2, textTransform: "uppercase" }}>
                              Workspaces
                            </div>
                            {userOrgs.map((org) => (
                              <motion.div
                                key={org.id}
                                whileHover={{ background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
                                onClick={async () => {
                                  if (org.id === userOrg.id) { setWsDropdownOpen(false); return; }
                                  setUserOrg(org);
                                  setUserOrgRole(org.role);
                                  setWsDropdownOpen(false);
                                  // Reload org members
                                  const { data: members } = await supabase
                                    .from("org_members")
                                    .select("user_id, role, profiles:profiles!org_members_profile_fkey(display_name, avatar_url, email, initials, status)")
                                    .eq("org_id", org.id);
                                  setOrgMembers(members || []);
                                  const { data: invites } = await supabase.from("invitations").select("*").eq("org_id", org.id).eq("status", "pending");
                                  setTeamInvites(invites || []);
                                }}
                                style={{
                                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                                  cursor: "pointer",
                                  background: org.id === userOrg.id ? (darkMode ? "rgba(139, 122, 255, 0.08)" : "rgba(139, 122, 255, 0.06)") : "transparent",
                                }}
                              >
                                <div style={{
                                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                  background: org.id === userOrg.id ? "linear-gradient(135deg, #8B7AFF40, #6C5CE740)" : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 12, fontWeight: 600, fontFamily: FONT,
                                  color: org.id === userOrg.id ? "#8B7AFF" : theme.textDim,
                                }}>{(org.name || "W")[0]}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 500, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{org.name}</div>
                                  <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, textTransform: "capitalize" }}>{org.role}</div>
                                </div>
                                {org.id === userOrg.id && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path d="M20 6L9 17l-5-5" stroke="#8B7AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </motion.div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ── Workspace & Team Management ── */}
              {userOrg && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ marginTop: 24 }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>
                  {appLanguage === "de" ? "Workspace" : "Workspace"} — {userOrg.name}
                </div>
                <div style={{
                  borderRadius: 20, background: theme.cardBg, border: `1px solid ${theme.border}`,
                  overflow: "hidden",
                }}>
                  {/* Invite member — chip-based input */}
                  <div style={{ padding: "18px 20px", borderBottom: `1px solid ${theme.borderFaint}` }}>
                    <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500, marginBottom: 12 }}>
                      {appLanguage === "de" ? "Teammitglied einladen" : "Invite Team Member"}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{
                        flex: 1, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
                        padding: "8px 12px", borderRadius: 12, minHeight: 42,
                        background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${theme.borderFaint}`,
                      }}>
                        {inviteEmails.map((email, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            onClick={() => setInviteEmails(prev => prev.filter((_, i) => i !== idx))}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "4px 10px", borderRadius: 8,
                              background: "rgba(139, 122, 255, 0.12)", border: "1px solid rgba(139, 122, 255, 0.25)",
                              fontSize: 12, fontFamily: FONT, color: "#8B7AFF", cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            {email}
                            <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.6 }}>×</span>
                          </motion.div>
                        ))}
                        <input
                          value={inviteInputVal}
                          onChange={(e) => setInviteInputVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              const val = inviteInputVal.replace(/,/g, "").trim();
                              if (val && val.includes("@") && val.includes(".") && !inviteEmails.includes(val)) {
                                setInviteEmails(prev => [...prev, val]);
                                setInviteInputVal("");
                              }
                            }
                            if (e.key === "Backspace" && inviteInputVal === "" && inviteEmails.length > 0) {
                              setInviteEmails(prev => prev.slice(0, -1));
                            }
                          }}
                          onBlur={() => {
                            const val = inviteInputVal.replace(/,/g, "").trim();
                            if (val && val.includes("@") && val.includes(".") && !inviteEmails.includes(val)) {
                              setInviteEmails(prev => [...prev, val]);
                              setInviteInputVal("");
                            }
                          }}
                          placeholder={inviteEmails.length === 0 ? (appLanguage === "de" ? "E-Mail-Adressen eingeben..." : "Enter email addresses...") : ""}
                          style={{
                            flex: 1, minWidth: 120, padding: "4px 2px", border: "none", outline: "none",
                            background: "transparent", color: theme.text, fontSize: 13, fontFamily: FONT,
                            caretColor: "#8B7AFF",
                          }}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={async () => {
                          let emails = [...inviteEmails];
                          const remaining = inviteInputVal.replace(/,/g, "").trim();
                          if (remaining && remaining.includes("@") && remaining.includes(".") && !emails.includes(remaining)) {
                            emails.push(remaining);
                          }
                          if (emails.length === 0) return;
                          try {
                            for (const email of emails) {
                              const { data: inv, error } = await supabase.from("invitations")
                                .insert({ org_id: userOrg.id, email, invited_by: session.user.id, role: "member" })
                                .select()
                                .single();
                              if (error) throw error;
                              try {
                                await fetch("/api/send-invite", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    email,
                                    token: inv.token,
                                    orgName: userOrg.name,
                                    inviterName: userName || "A team member",
                                  }),
                                });
                              } catch (emailErr) {
                                console.warn("[Invite] Email send failed:", emailErr);
                              }
                            }
                            setInviteEmails([]);
                            setInviteInputVal("");
                            const { data: invites } = await supabase.from("invitations").select("*").eq("org_id", userOrg.id).eq("status", "pending");
                            setTeamInvites(invites || []);
                          } catch (e) {
                            console.error("[Invite]", e);
                            alert(e.message || "Failed to send invite");
                          }
                        }}
                        style={{
                          padding: "10px 20px", borderRadius: 12, marginTop: 1,
                          background: "#8B7AFF", border: "none",
                          color: "#fff", fontSize: 13, fontWeight: 500, fontFamily: FONT,
                          cursor: "pointer", opacity: inviteEmails.length === 0 && !inviteInputVal ? 0.5 : 1,
                        }}
                      >
                        {appLanguage === "de" ? "Einladen" : "Invite"}
                      </motion.button>
                    </div>
                  </div>

                  {/* Current members */}
                  <div style={{ padding: "14px 20px" }}>
                    <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textFaint, letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" }}>
                      {appLanguage === "de" ? "Mitglieder" : "Members"} ({orgMembers.length})
                    </div>
                    {orgMembers.map((m, i) => (
                      <div key={m.user_id || i} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                        borderBottom: i < orgMembers.length - 1 ? `1px solid ${theme.borderFaint}` : "none",
                      }}>
                        {m.profiles?.avatar_url ? (
                          <img src={m.profiles.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${theme.borderFaint}` }} />
                        ) : (
                          <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: "linear-gradient(135deg, #8B7AFF50, #8B7AFF20)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 600, fontFamily: FONT, color: "#8B7AFF",
                          }}>{m.profiles?.initials || "?"}</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>{m.profiles?.display_name || "Unknown"}</div>
                          <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim }}>{m.profiles?.email || ""}</div>
                        </div>
                        <div style={{
                          padding: "3px 10px", borderRadius: 8,
                          background: m.role === "admin" ? "rgba(139, 122, 255, 0.1)" : (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                          border: `1px solid ${m.role === "admin" ? "rgba(139, 122, 255, 0.2)" : theme.borderFaint}`,
                          fontSize: 11, fontFamily: FONT, color: m.role === "admin" ? "#8B7AFF" : theme.textDim,
                          fontWeight: 500,
                        }}>
                          {m.role === "admin" ? "Admin" : "Member"}
                        </div>
                      </div>
                    ))}
                    {orgMembers.length === 0 && (
                      <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, padding: "8px 0" }}>
                        {appLanguage === "de" ? "Noch keine Mitglieder" : "No members yet"}
                      </div>
                    )}
                  </div>

                  {/* Pending invites */}
                  {teamInvites.length > 0 && (
                    <div style={{ padding: "14px 20px", borderTop: `1px solid ${theme.borderFaint}` }}>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textFaint, letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" }}>
                        {appLanguage === "de" ? "Offene Einladungen" : "Pending Invites"} ({teamInvites.length})
                      </div>
                      {teamInvites.map((inv, i) => (
                        <div key={inv.id} style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
                          borderBottom: i < teamInvites.length - 1 ? `1px solid ${theme.borderFaint}` : "none",
                        }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#F59E0B" strokeWidth="1.5" />
                              <path d="M22 6l-10 7L2 6" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text }}>{inv.email}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                              <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {inv.token}
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                  navigator.clipboard.writeText(inv.token);
                                  const btn = document.getElementById(`copy-btn-${inv.id}`);
                                  if (btn) { btn.textContent = "✓"; setTimeout(() => { btn.textContent = "⧉"; }, 1500); }
                                }}
                                id={`copy-btn-${inv.id}`}
                                style={{
                                  background: "none", border: `1px solid ${theme.borderFaint}`, borderRadius: 6,
                                  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 12, color: theme.textDim, cursor: "pointer", flexShrink: 0,
                                }}
                              >⧉</motion.button>
                            </div>
                          </div>
                          <div style={{
                            padding: "3px 10px", borderRadius: 8,
                            background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.15)",
                            fontSize: 11, fontFamily: FONT, color: "#F59E0B", flexShrink: 0,
                          }}>Pending</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 32 }}>

              {/* Left column */}
              <div>

              {/* Account section */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>Account</div>
                <div style={{
                  borderRadius: 20,
                  background: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  overflow: "hidden",
                }}>
                  {/* Google connection */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px",
                    borderBottom: `1px solid ${theme.borderFaint}`,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>Google Account</div>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>{session ? "Connected" : "Not connected"}</div>
                    </div>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: session ? "#00B894" : "#E84393",
                    }} />
                  </div>

                  {/* Subscription */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" stroke={theme.svgStroke} strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>Plan</div>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>Early Access</div>
                    </div>
                    <div style={{ padding: "4px 10px", borderRadius: 20, background: theme.accentBg, border: `1px solid ${theme.accentBorder}`, fontSize: 11, fontFamily: FONT, color: theme.accent }}>Active</div>
                  </div>
                </div>
              </motion.div>

              {/* Preferences section */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ marginTop: 24 }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>{t("settings.preferences")}</div>
                <div style={{
                  borderRadius: 20,
                  background: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  overflow: "hidden",
                }}>
                  {/* Appearance */}
                  <motion.div
                    whileHover={{ backgroundColor: theme.hoverBg }}
                    onClick={() => setDarkMode(!darkMode)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "16px 20px", cursor: "pointer",
                      borderBottom: `1px solid ${theme.borderFaint}`,
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        {darkMode ? (
                          <>
                            <circle cx="12" cy="12" r="4" stroke={theme.svgStroke} strokeWidth="1.5" />
                            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={theme.svgStroke} strokeWidth="1.5" strokeLinecap="round" />
                          </>
                        ) : (
                          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={theme.svgStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>Appearance</div>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>{darkMode ? t("settings.darkMode") : t("settings.lightMode")}</div>
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); setDarkMode(!darkMode); }} style={{
                      width: 44, height: 24, borderRadius: 12, padding: 2,
                      background: darkMode ? "rgba(139,122,255,0.5)" : "rgba(0,0,0,0.15)",
                      cursor: "pointer", transition: "background 0.3s ease",
                      display: "flex", alignItems: "center",
                    }}>
                      <motion.div
                        animate={{ x: darkMode ? 20 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        style={{
                          width: 20, height: 20, borderRadius: 10,
                          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </div>
                  </motion.div>

                  {/* Language */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px",
                    borderBottom: `1px solid ${theme.borderFaint}`,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke={theme.svgStroke} strokeWidth="1.5" />
                        <path d="M3 12h18M12 3c-2.5 3-3.5 6-3.5 9s1 6 3.5 9M12 3c2.5 3 3.5 6 3.5 9s-1 6-3.5 9" stroke={theme.svgStroke} strokeWidth="1.5" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>{t("settings.language")}</div>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>{t("settings.languageSub")}</div>
                    </div>
                    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                      <select
                        value={appLanguage}
                        onChange={(e) => setAppLanguage(e.target.value)}
                        style={{
                          padding: "6px 28px 6px 12px", borderRadius: 12,
                          background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                          border: `1px solid ${theme.borderFaint}`,
                          color: theme.text, fontSize: 13, fontFamily: FONT,
                          cursor: "pointer", outline: "none",
                          appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                        }}
                      >
                        <option value="de">Deutsch</option>
                        <option value="en">English</option>
                      </select>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        style={{ position: "absolute", right: 8, pointerEvents: "none" }}>
                        <path d="M6 9l6 6 6-6" stroke={darkMode ? "#ffffff60" : "#1a1a2e60"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  {/* Notifications */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zM18 16v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" stroke={theme.svgStroke} strokeWidth="1.5" fill="none" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>{t("settings.notifications")}</div>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>{t("settings.notificationsSub")}</div>
                    </div>
                    <div style={{ padding: "4px 10px", borderRadius: 20, background: theme.accentBg, fontSize: 11, fontFamily: FONT, color: theme.accent }}>Coming soon</div>
                  </div>
                </div>
              </motion.div>

              {/* Voice section */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ marginTop: 24 }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>{t("settings.aiVoice")}</div>
                <div style={{
                  borderRadius: 20,
                  background: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  overflow: "hidden",
                }}>
                  {VOICE_OPTIONS.map((voice, idx) => {
                    const isSelected = selectedVoice === voice.id;
                    const isPlaying = voicePreviewPlaying === voice.id;
                    return (
                      <div key={voice.id} style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "14px 20px", cursor: "pointer",
                        borderBottom: idx < VOICE_OPTIONS.length - 1 ? `1px solid ${theme.borderFaint}` : "none",
                      }}
                        onClick={() => setSelectedVoice(voice.id)}
                      >
                        {/* Play preview button */}
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Stop current preview if playing
                            if (voicePreviewRef.current) {
                              voicePreviewRef.current.pause();
                              voicePreviewRef.current = null;
                            }
                            if (isPlaying) {
                              setVoicePreviewPlaying(null);
                              return;
                            }
                            setVoicePreviewPlaying(voice.id);
                            try {
                              const res = await fetch("/api/tts", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  text: "Hi, I am your AI assistant in Agency OS. How can I help you today?",
                                  voiceId: voice.id,
                                }),
                              });
                              if (res.ok) {
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const audio = new Audio(url);
                                voicePreviewRef.current = audio;
                                audio.onended = () => { setVoicePreviewPlaying(null); voicePreviewRef.current = null; };
                                audio.play();
                              } else {
                                setVoicePreviewPlaying(null);
                              }
                            } catch {
                              setVoicePreviewPlaying(null);
                            }
                          }}
                          style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: isPlaying ? (theme.accent + "20") : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                            border: isPlaying ? `1.5px solid ${theme.accent}40` : "1.5px solid transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {isPlaying ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={theme.accent}>
                              <rect x="6" y="4" width="4" height="16" rx="1" />
                              <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={theme.textDim}>
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </motion.div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>{voice.name}</div>
                          <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 1 }}>
                            {voice.gender === "male" ? "Male" : "Female"}
                          </div>
                        </div>
                        {/* Selected radio */}
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          border: `2px solid ${isSelected ? theme.accent : theme.textFaint}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.2s ease",
                        }}>
                          {isSelected && <div style={{ width: 10, height: 10, borderRadius: "50%", background: theme.accent }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              </div>{/* end left column */}

              {/* Right column */}
              <div>

              {/* AI Models section */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>{t("settings.aiModels")}</div>
                <div style={{
                  borderRadius: 20,
                  background: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  overflow: "hidden",
                }}>
                  {/* Provider cards */}
                  {[
                    { id: "gemini", name: "Gemini", sub: "Google", color: "#4285F4",
                      icon: <svg width="18" height="18" viewBox="0 0 65 65" fill="none"><path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="url(#geminiGrad)"/><defs><linearGradient id="geminiGrad" x1="0" y1="65" x2="65" y2="0"><stop stopColor="#1BA1E3"/><stop offset="0.33" stopColor="#5489D6"/><stop offset="0.66" stopColor="#9B72CB"/><stop offset="1" stopColor="#D96570"/></linearGradient></defs></svg>,
                      placeholder: "AIza..." },
                    { id: "claude", name: "Claude", sub: "Anthropic", color: "#D97757",
                      icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="#D97757"><path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z"/></svg>,
                      placeholder: "sk-ant-api03-..." },
                    { id: "openai", name: "ChatGPT", sub: "OpenAI", color: "#10A37F",
                      icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="#10A37F"><path d="M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934A4.1 4.1 0 0 0 8.423.2 4.15 4.15 0 0 0 6.305.086a4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679A4 4 0 0 0 .554 4.72a3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94A3.02 3.02 0 0 1 3.07 3.949v3.785a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.342a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a3 3 0 0 1 1.173 1.207 2.96 2.96 0 0 1-.27 3.2 3.05 3.05 0 0 1-1.36.997V8.279a.52.52 0 0 0-.276-.445m1.36-2.015-.097-.057-3.226-1.855a.53.53 0 0 0-.53 0L6.249 6.153V4.598a.04.04 0 0 1 .019-.04L9.533 2.7a3.07 3.07 0 0 1 3.257.139c.474.325.843.778 1.066 1.303.223.526.289 1.103.191 1.664zM5.503 8.575 4.139 7.8a.05.05 0 0 1-.026-.037V4.049c0-.57.166-1.127.476-1.607s.752-.864 1.275-1.105a3.08 3.08 0 0 1 3.234.41l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.758-1 1.762 1v2l-1.755 1-1.762-1z"/></svg>,
                      placeholder: "sk-..." },
                  ].map((p, idx, arr) => {
                    const isActive = llmProvider === p.id;
                    const hasKey = !!llmKeys[p.id];
                    const status = llmKeyStatus[p.id];
                    return (
                      <div key={p.id} style={{ borderBottom: idx < arr.length - 1 ? `1px solid ${theme.borderFaint}` : "none" }}>
                        {/* Provider header row */}
                        <div
                          onClick={() => setLlmProvider(p.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 20px", cursor: "pointer",
                          }}
                        >
                          <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: isActive ? p.color + "18" : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                            border: isActive ? `1.5px solid ${p.color}40` : "1.5px solid transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease",
                          }}>
                            {p.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>{p.name}</div>
                            <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 1 }}>
                              {p.id === "gemini" && session && !hasKey ? t("settings.connectedViaGoogle") : p.sub}
                            </div>
                          </div>
                          {/* Status indicators */}
                          {(hasKey || (p.id === "gemini" && session)) && (
                            <div style={{
                              width: 8, height: 8, borderRadius: "50%",
                              background: status === "invalid" ? "#E84393" : "#00B894",
                            }} />
                          )}
                          {/* Active radio */}
                          <div style={{
                            width: 20, height: 20, borderRadius: "50%",
                            border: `2px solid ${isActive ? p.color : theme.textFaint}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease",
                          }}>
                            {isActive && <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />}
                          </div>
                        </div>

                        {/* Key input (collapsible — shown when active) */}
                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0 20px 14px", display: "flex", gap: 8 }}>
                                <input
                                  type="password"
                                  value={llmKeyInputs[p.id] || ""}
                                  onChange={(e) => setLlmKeyInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  placeholder={hasKey ? t("settings.keySaved") : (p.id === "gemini" ? t("settings.geminiKeyOpt") : p.id === "claude" ? t("settings.claudeKey") : t("settings.chatgptKey"))}
                                  style={{
                                    flex: 1, padding: "10px 14px", borderRadius: 12,
                                    background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                                    border: `1px solid ${theme.borderFaint}`,
                                    color: theme.text, fontSize: 12, fontFamily: FONT,
                                    outline: "none",
                                  }}
                                  onFocus={(e) => e.target.style.borderColor = p.color + "60"}
                                  onBlur={(e) => e.target.style.borderColor = theme.borderFaint}
                                />
                                <motion.div
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={async () => {
                                    const key = llmKeyInputs[p.id];
                                    if (!key && !hasKey) return;
                                    if (key) {
                                      // Validate key with a test call
                                      setLlmKeyStatus(prev => ({ ...prev, [p.id]: "checking" }));
                                      try {
                                        const res = await fetch("/api/chat-multi", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            message: "Say OK",
                                            provider: p.id,
                                            apiKey: key,
                                            systemPrompt: "Respond with just OK",
                                          }),
                                        });
                                        if (res.ok) {
                                          setLlmKeys(prev => ({ ...prev, [p.id]: key }));
                                          setLlmKeyInputs(prev => ({ ...prev, [p.id]: "" }));
                                          setLlmKeyStatus(prev => ({ ...prev, [p.id]: "valid" }));
                                        } else {
                                          // 429 = rate limited but key format is valid — save it
                                          const errData = await res.json().catch(() => ({}));
                                          if (res.status === 429 || errData.statusCode === 429) {
                                            setLlmKeys(prev => ({ ...prev, [p.id]: key }));
                                            setLlmKeyInputs(prev => ({ ...prev, [p.id]: "" }));
                                            setLlmKeyStatus(prev => ({ ...prev, [p.id]: "valid" }));
                                          } else {
                                            setLlmKeyStatus(prev => ({ ...prev, [p.id]: "invalid" }));
                                          }
                                        }
                                      } catch {
                                        setLlmKeyStatus(prev => ({ ...prev, [p.id]: "invalid" }));
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: "10px 16px", borderRadius: 12, cursor: "pointer",
                                    background: p.color + "20", border: `1px solid ${p.color}40`,
                                    fontSize: 12, fontFamily: FONT, color: p.color, fontWeight: 500,
                                    display: "flex", alignItems: "center", whiteSpace: "nowrap",
                                  }}
                                >
                                  {status === "checking" ? "..." : "Save"}
                                </motion.div>
                                {hasKey && (
                                  <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      setLlmKeys(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                      setLlmKeyStatus(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                    }}
                                    style={{
                                      padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                                      background: "rgba(232,67,67,0.08)", border: "1px solid rgba(232,67,67,0.15)",
                                      fontSize: 12, fontFamily: FONT, color: "#E84343",
                                      display: "flex", alignItems: "center",
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#E84343" strokeWidth="2" strokeLinecap="round"/></svg>
                                  </motion.div>
                                )}
                              </div>
                              {status === "invalid" && (
                                <div style={{ padding: "0 20px 12px", fontSize: 11, fontFamily: FONT, color: "#E84393" }}>
                                  Invalid API key. Please check and try again.
                                </div>
                              )}
                              {status === "valid" && hasKey && (
                                <div style={{ padding: "0 20px 12px", fontSize: 11, fontFamily: FONT, color: "#00B894" }}>
                                  Key verified and saved.
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Integrations section */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ marginTop: 24 }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>{t("settings.integrations")}</div>
                <div style={{
                  borderRadius: 20,
                  background: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  overflow: "hidden",
                }}>
                  {/* Google Calendar & Drive */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px",
                    borderBottom: `1px solid ${theme.borderFaint}`,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>{t("settings.googleCalDrive")}</div>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>{session ? t("settings.calFilesSynced") : t("settings.signInToConnect")}</div>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: session ? "#00B894" : "#E84393" }} />
                  </div>
                  {/* Slack */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                        <path d="M3.362 10.11c0 .926-.756 1.681-1.681 1.681S0 11.036 0 10.111.756 8.43 1.68 8.43h1.682zm.846 0c0-.924.756-1.68 1.681-1.68s1.681.756 1.681 1.68v4.21c0 .924-.756 1.68-1.68 1.68a1.685 1.685 0 0 1-1.682-1.68z" fill="#E01E5A"/>
                        <path d="M5.89 3.362c-.926 0-1.682-.756-1.682-1.681S4.964 0 5.89 0s1.68.756 1.68 1.68v1.682zm0 .846c.924 0 1.68.756 1.68 1.681S6.814 7.57 5.89 7.57H1.68C.757 7.57 0 6.814 0 5.89c0-.926.756-1.682 1.68-1.682z" fill="#36C5F0"/>
                        <path d="M12.638 5.89c0-.926.755-1.682 1.68-1.682S16 4.964 16 5.889s-.756 1.681-1.68 1.681h-1.681zm-.848 0c0 .924-.755 1.68-1.68 1.68A1.685 1.685 0 0 1 8.43 5.89V1.68C8.43.757 9.186 0 10.11 0c.926 0 1.681.756 1.681 1.68z" fill="#2EB67D"/>
                        <path d="M10.11 12.638c.926 0 1.682.756 1.682 1.681S11.036 16 10.11 16s-1.681-.756-1.681-1.68v-1.682zm0-.847c-.924 0-1.68-.755-1.68-1.68s.756-1.681 1.68-1.681h4.21c.924 0 1.68.756 1.68 1.68 0 .926-.756 1.681-1.68 1.681z" fill="#ECB22E"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: theme.text, fontWeight: 500 }}>Slack</div>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>{t("settings.slackSub")}</div>
                    </div>
                    <div style={{ padding: "4px 10px", borderRadius: 20, background: theme.accentBg, fontSize: 11, fontFamily: FONT, color: theme.accent }}>{t("settings.comingSoon")}</div>
                  </div>
                </div>
              </motion.div>

              </div>{/* end right column */}
              </div>{/* end grid */}

              {/* Google Connection Status — only shown when broken so user can reconnect */}
              {googleConnectionBroken && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                  style={{ marginTop: 24 }}
                >
                  <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>
                    Google-Verbindung
                  </div>
                  <div style={{
                    borderRadius: 20,
                    background: "rgba(239, 68, 68, 0.06)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    padding: "20px 24px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20,
                      }}>⚠️</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text }}>
                          Verbindung unterbrochen
                        </div>
                        <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2, lineHeight: 1.4 }}>
                          Calendar & Drive funktionieren nicht. Bitte neu verbinden — danach läuft alles automatisch.
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={reconnectGoogle}
                        style={{
                          padding: "10px 18px", borderRadius: 12,
                          background: "#8B7AFF", border: "none",
                          color: "#fff", fontSize: 13, fontWeight: 500, fontFamily: FONT, cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >Neu verbinden</motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Push Notifications — removed; reminders now use Google Calendar sync */}
              {false && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ marginTop: 24 }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>
                  Push-Benachrichtigungen
                </div>
                <div style={{
                  borderRadius: 20, background: theme.cardBg, border: `1px solid ${theme.border}`,
                  padding: "20px 24px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: pushSubExists ? "rgba(0, 184, 148, 0.1)" : (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                      border: `1px solid ${pushSubExists ? "rgba(0, 184, 148, 0.2)" : theme.borderFaint}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={pushSubExists ? "#00B894" : theme.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13.73 21a2 2 0 01-3.46 0" stroke={pushSubExists ? "#00B894" : theme.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text }}>
                        {pushSubExists ? "Push aktiv" : "Erinnerungen aufs Handy"}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2, lineHeight: 1.4 }}>
                        {pushSubExists
                          ? "Du erhältst Reminder als Push-Notification auf deinem Gerät."
                          : "Erhalte Reminder direkt als Notification auf deinem Handy."
                        }
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={async () => {
                        if (pushSubExists) {
                          // Send a test push
                          setPushSetupSending(true);
                          try {
                            const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", session.user.id);
                            for (const sub of subs || []) {
                              await fetch("/api/send-push", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                                  title: "🔔 Test-Benachrichtigung",
                                  body: "Push funktioniert auf diesem Gerät!",
                                  tag: "test-push",
                                }),
                              });
                            }
                            setPushSetupSent(true);
                            setTimeout(() => setPushSetupSent(false), 3000);
                          } catch (e) { console.error("Test push error:", e); }
                          setPushSetupSending(false);
                          return;
                        }
                        setPushSetupSending(true);
                        try {
                          // Create a one-time setup token so the phone doesn't need to log in
                          const { data: tokenRow, error: tokenErr } = await supabase
                            .from("push_setup_tokens")
                            .insert({ user_id: session.user.id })
                            .select()
                            .single();
                          if (tokenErr) throw tokenErr;
                          await fetch("/api/send-push-setup", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: userEmail, userName, token: tokenRow.token }),
                          });
                          setPushSetupSent(true);
                          setTimeout(() => setPushSetupSent(false), 5000);
                        } catch (e) { console.error("Push setup email error:", e); }
                        setPushSetupSending(false);
                      }}
                      style={{
                        padding: "10px 20px", borderRadius: 12,
                        background: pushSubExists ? "rgba(0, 184, 148, 0.15)" : "#8B7AFF",
                        border: pushSubExists ? "1px solid rgba(0, 184, 148, 0.3)" : "none",
                        color: pushSubExists ? "#00B894" : "#fff",
                        fontSize: 13, fontWeight: 500, fontFamily: FONT,
                        cursor: "pointer",
                        opacity: pushSetupSending ? 0.6 : 1,
                      }}
                    >
                      {pushSubExists
                        ? (pushSetupSent ? "✓ Test gesendet" : pushSetupSending ? "Sende..." : "Test senden")
                        : (pushSetupSent ? "✓ E-Mail gesendet!" : pushSetupSending ? "Sende..." : "📱 Aktivieren")
                      }
                    </motion.button>
                  </div>
                  {!pushSubExists && (
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint, marginTop: 14, lineHeight: 1.5, paddingLeft: 58 }}>
                      Du erhältst eine E-Mail mit einem Link. Öffne diesen auf deinem Handy und erlaube die Benachrichtigungen.
                    </div>
                  )}
                </div>
              </motion.div>
              )}

              {/* OS Visuals — click to open icon customization modal */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ marginTop: 24 }}
              >
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>
                  OS Visuals
                </div>
                <motion.div
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}
                  onClick={() => setOsVisualsModalOpen(true)}
                  style={{
                    borderRadius: 20, background: theme.cardBg, border: `1px solid ${theme.border}`,
                    padding: "20px 24px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 14,
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: "linear-gradient(135deg, rgba(139, 122, 255, 0.18), rgba(100, 80, 220, 0.12))",
                    border: "1px solid rgba(139, 122, 255, 0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B7AFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text }}>
                      Icons anpassen
                    </div>
                    <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2, lineHeight: 1.4 }}>
                      Eigene Icons für Calendar-Events, Reminder, Tasks und mehr hochladen
                    </div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: theme.textDim }}>
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              </motion.div>

              {/* Logout */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0] }}
                style={{ marginTop: 32 }}
              >
                <motion.div
                  onClick={() => { handleLogout(); setCurrentView("dashboard"); }}
                  whileHover={{ backgroundColor: "rgba(232, 67, 67, 0.08)" }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    padding: "14px 20px", borderRadius: 16, cursor: "pointer",
                    border: "1px solid rgba(232, 67, 67, 0.15)",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="#E84343" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M16 17l5-5-5-5M21 12H9" stroke="#E84343" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 14, fontFamily: FONT, color: "#E84343", fontWeight: 500 }}>Logout</span>
                </motion.div>
              </motion.div>

              {/* Version */}
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint }}>Agency OS v0.1.0</div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div style={{
        padding: "16px 24px", display: "flex", alignItems: "center",
        position: "relative", zIndex: 20,
      }}>
        {/* Logo — left third (opens Profile) */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", paddingTop: 10 }}>
          <motion.div
            onClick={() => { if (currentView === "settings") { setCurrentView("dashboard"); } else { setCurrentView("settings"); } }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ cursor: "pointer" }}
          >
          <svg width="76" height="48" viewBox="0 0 76 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path opacity="0.8" d="M4.64867 13.5494C3.95863 13.5494 3.37755 13.3133 2.90542 12.8594C2.43329 12.4054 2.19722 11.8243 2.19722 11.1343C2.19722 10.4987 2.43329 9.93579 2.90542 9.46366C3.37755 8.99152 3.95863 8.75546 4.64867 8.75546C5.3387 8.75546 5.91979 8.99152 6.39192 9.46366C6.86405 9.93579 7.10011 10.4987 7.10011 11.1343C7.10011 11.8243 6.86405 12.4054 6.39192 12.8594C5.91979 13.3133 5.3387 13.5494 4.64867 13.5494ZM2.66935 35.3037V16.6001H6.53719V35.3037H2.66935ZM11.0486 9.26391H29.3345V12.133L19.0748 35.3037H14.8075L24.7767 12.9138H11.0486V9.26391Z" fill={darkMode ? "white" : "#1a1a2e"} fillOpacity="0.8"/>
            <g opacity="0.8">
              <rect x="39.3999" y="0.5" width="36" height="22" rx="11" stroke={darkMode ? "white" : "#1a1a2e"}/>
              <path d="M51.14 17.0376V17.0454C49.4759 17.0454 48.0853 16.4907 46.9681 15.3735C45.8509 14.2563 45.2962 12.8735 45.2962 11.2173C45.2962 9.56104 45.8509 8.17822 46.9603 7.07666C48.0696 5.9751 49.4603 5.42041 51.1321 5.42041C52.7962 5.42041 54.1868 5.9751 55.2962 7.07666C56.4056 8.17822 56.9603 9.55322 56.9603 11.2095C56.9603 12.8657 56.4056 14.2485 55.2962 15.3657C54.1868 16.4829 52.804 17.0376 51.14 17.0376ZM51.14 15.4438V15.4595C52.3431 15.4595 53.3275 15.0532 54.0853 14.2329C54.8431 13.4126 55.2259 12.4048 55.2259 11.2095C55.2259 10.0376 54.8431 9.04541 54.0775 8.24072C53.3118 7.43604 52.3353 7.02979 51.14 7.02979C49.9368 7.02979 48.9525 7.42822 48.1868 8.23291C47.4212 9.0376 47.0384 10.022 47.0384 11.1938C47.0384 12.3892 47.4212 13.397 48.1868 14.2173C48.9525 15.0376 49.9368 15.4438 51.14 15.4438ZM63.4675 17.0376L63.4206 17.0454C62.1706 17.0454 61.1003 16.7173 60.2018 16.0688C59.3034 15.4204 58.694 14.6157 58.3737 13.6626L60.0143 13.1704C60.2721 13.8501 60.7096 14.4126 61.3268 14.8501C61.944 15.2876 62.6706 15.5063 63.5143 15.5063C64.2565 15.5063 64.8659 15.3267 65.3425 14.9751C65.819 14.6235 66.0612 14.2173 66.0612 13.7563C66.0612 13.3813 65.9284 13.0688 65.655 12.811C65.3815 12.5532 64.9284 12.3267 64.2878 12.1235L61.4753 11.2251C59.7956 10.7017 58.9596 9.7876 58.9596 8.48291C58.9596 7.63916 59.3268 6.9126 60.0612 6.31104C60.7956 5.70947 61.7175 5.40479 62.8268 5.40479C63.9675 5.40479 64.9518 5.67041 65.78 6.20166C66.6081 6.73291 67.194 7.39697 67.5378 8.19385L65.9206 8.67822C65.655 8.15479 65.2565 7.73291 64.7175 7.4126C64.1784 7.09229 63.5534 6.93604 62.8425 6.93604C62.2253 6.93604 61.7175 7.08447 61.319 7.38135C60.9206 7.67822 60.7175 8.02979 60.7175 8.43604C60.7175 8.75635 60.8346 9.02197 61.0612 9.23291C61.2878 9.44385 61.655 9.62354 62.155 9.77197L64.905 10.647C65.8737 10.9517 66.6081 11.3267 67.1003 11.772C67.5925 12.2173 67.8425 12.8345 67.8425 13.6313C67.8425 14.5923 67.4362 15.397 66.6237 16.0532C65.8112 16.7095 64.7565 17.0376 63.4675 17.0376Z" fill={darkMode ? "white" : "#1a1a2e"}/>
            </g>
          </svg>
          </motion.div>
        </div>

        {/* Center buttons — true center */}
        <div style={{
          display: "flex", gap: 12, alignItems: "center",
        }}>
          {/* Icon1: Grid */}
          <motion.div
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            transition={smoothSpring}
            onClick={() => {
              if (menuOpen && menuSource === "grid") { handleClose(); return; }
              // If the (plus-)menu is open, close it before navigating
              if (menuOpen) handleClose();
              // First click in a non-dashboard view → just navigate back to dashboard
              if (currentView !== "dashboard") { setCurrentView("dashboard"); return; }
              // Already on dashboard → open the menu
              setMenuSource("grid"); setActiveIndex(0); try { sounds.menuOpen(); } catch(e) {}
              setTimeout(() => { setMenuOpen(true); setSubOpen(false); }, 300);
            }}
            style={{ cursor: "pointer" }}>
            <svg width="50" height="50" viewBox="0 0 52 52" fill="none">
              <motion.rect x="0.6" y="0.6" width="50.4" height="50.4" rx="25.2"
                animate={{ strokeOpacity: menuOpen && menuSource === "grid" ? 0.5 : 0.15 }}
                transition={gentleTween}
                strokeWidth="1.2" stroke={darkMode ? "white" : "#1a1a2e"} />
              {[[16.4,16.3],[27.4,16.3],[16.4,27.3],[27.4,27.3]].map(([x,y],i) => (
                <motion.rect key={i} x={x} y={y} width="7" height="7" rx="1.5"
                  animate={{ stroke: menuOpen && menuSource === "grid" ? (darkMode ? "#ffffff" : "#1a1a2e") : theme.iconColor }}
                  transition={gentleTween}
                  strokeWidth="2" fill="none" />
              ))}
            </svg>
          </motion.div>

          {/* Icon2: Mic */}
          <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} transition={smoothSpring} style={{ cursor: "pointer" }} onClick={startVoice}>
            <svg width="50" height="50" viewBox="0 0 52 52" fill="none">
              <rect x="0.6" y="0.6" width="50.4" height="50.4" rx="25.2" stroke={darkMode ? "white" : "#1a1a2e"} strokeOpacity="0.15" strokeWidth="1.2" />
              <path d="M26.2839 28.4991C28.0558 28.4991 29.5239 27.0309 29.5239 25.2591V18.7791C29.5239 16.9566 28.0558 15.5391 26.2839 15.5391C24.512 15.5391 23.0439 16.9566 23.0439 18.7791V25.2591C23.0439 27.0309 24.512 28.4991 26.2839 28.4991ZM32.6627 25.2591C32.1564 25.2591 31.7008 25.6134 31.5995 26.1703C31.1439 28.7016 28.967 30.6253 26.2839 30.6253C23.6008 30.6253 21.4239 28.7016 20.9683 26.1703C20.867 25.6134 20.4114 25.2591 19.9052 25.2591C19.247 25.2591 18.7408 25.8159 18.842 26.4741C19.3483 29.7141 21.9302 32.2453 25.2208 32.7009V34.9791C25.2208 35.5359 25.6764 36.0422 26.2839 36.0422C26.8914 36.0422 27.347 35.5359 27.347 34.9791V32.7009C30.6377 32.2453 33.2195 29.7141 33.7258 26.4741C33.8777 25.8159 33.3208 25.2591 32.6627 25.2591Z" fill={theme.iconColor}/>
            </svg>
          </motion.div>

          {/* Icon3: Plus */}
          <motion.div
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            transition={smoothSpring}
            onClick={() => {
              if (menuOpen && menuSource === "plus") { handleClose(); return; }
              // Open menu directly — view stays mounted behind. Menu has its
              // own dark center + blur backdrop, so no need to switch views first.
              setMenuSource("plus"); setActiveIndex(0); try { sounds.menuOpen(); } catch(e) {}
              setMenuOpen(true); setSubOpen(false);
            }}
            style={{ cursor: "pointer" }}>
            <svg width="50" height="50" viewBox="0 0 52 52" fill="none">
              <motion.rect x="0.6" y="0.6" width="50.4" height="50.4" rx="25.2" stroke={darkMode ? "white" : "#1a1a2e"}
                animate={{ strokeOpacity: menuOpen && menuSource === "plus" ? 0.5 : 0.15 }}
                transition={gentleTween}
                strokeWidth="1.2" />
              <motion.path
                d="M33.5845 24.5186V26.8564H27.3618V33.1143H24.9888V26.8564H18.7134V24.5186H24.9888V18.2432H27.3618V24.5186H33.5845Z"
                animate={{ fill: menuOpen && menuSource === "plus" ? (darkMode ? "#ffffff" : "#1a1a2e") : theme.iconColor }}
                transition={gentleTween}
              />
            </svg>
          </motion.div>
        </div>

        {/* Sphere — right third */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ cursor: "pointer" }} onClick={startVoice}>
            <AISphere darkMode={darkMode} />
          </div>
        </div>
      </div>

      <style>{`
        .hover-row {
          transition: background 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-row:hover {
          background: ${darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)"} !important;
          border-color: ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)"} !important;
          transition: background 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-color 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .hover-back {
          transition: background 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-back:hover {
          background: rgba(255,255,255,0.08);
          transition: background 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
      `}</style>

      {/* ── OS Visuals Modal (Portal) ── */}
      {createPortal(<AnimatePresence>
        {osVisualsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOsVisualsModalOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: darkMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 560, maxHeight: "85vh",
                background: darkMode ? "rgba(22,22,30,0.98)" : "rgba(255,255,255,0.99)",
                border: `1px solid ${theme.border}`,
                borderRadius: 22, overflow: "hidden",
                display: "flex", flexDirection: "column",
                boxShadow: "0 30px 80px rgba(0,0,0,0.3)",
              }}
            >
              {/* Header */}
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${theme.borderFaint}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 17, fontFamily: FONT, fontWeight: 600, color: theme.text }}>OS Visuals</div>
                  <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>Eigene Icons für System-Slots hochladen</div>
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
                  onClick={() => setOsVisualsModalOpen(false)}
                  style={{ width: 32, height: 32, borderRadius: 10, background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.textDim, fontSize: 16 }}
                >✕</motion.div>
              </div>
              {/* Slot list */}
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {OS_VISUAL_SLOTS.map(slot => {
                  const slotData = osVisuals[slot.key] || {};
                  const customIcon = slotData.icon_url;
                  const customBg = slotData.bg_color;
                  const mode = slotData.mode || "icon";
                  const fullbleed = mode === "fullbleed" && customIcon;
                  const uploading = osVisualUploading === slot.key;
                  const effectiveBg = customBg || slot.defaultBg;
                  const hasAnyOverride = !!(customIcon || customBg || mode === "fullbleed");

                  return (
                    <div key={slot.key} style={{
                      padding: "14px 16px", borderRadius: 14,
                      background: darkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)",
                      border: `1px solid ${theme.borderFaint}`,
                      display: "flex", flexDirection: "column", gap: 12,
                    }}>
                      {/* Top row: preview + label + reset */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        {/* Live preview matching dashboard rendering */}
                        <div style={{
                          width: 50, height: 50, borderRadius: "50%", flexShrink: 0,
                          background: fullbleed ? "transparent" : effectiveBg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          overflow: "hidden", fontSize: 22, color: "#fff",
                        }}>
                          {customIcon ? (
                            fullbleed ? (
                              <img src={customIcon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <img src={customIcon} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
                            )
                          ) : (
                            slot.defaultEmoji
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text }}>{slot.label}</div>
                          <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 2 }}>{slot.description}</div>
                        </div>
                        {hasAnyOverride && (
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={() => resetOsVisual(slot.key)}
                            title="Zurücksetzen"
                            style={{
                              width: 32, height: 32, borderRadius: 10, cursor: "pointer",
                              background: "transparent",
                              border: `1px solid ${theme.borderFaint}`,
                              color: theme.textDim,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                          </motion.button>
                        )}
                      </div>

                      {/* Mode toggle: Icon vs Fullbleed */}
                      <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${theme.borderFaint}` }}>
                        {[
                          { id: "icon", label: "Icon + Farbe" },
                          { id: "fullbleed", label: "Vollflächiges Bild" },
                        ].map(m => (
                          <motion.div key={m.id} whileTap={{ scale: 0.96 }}
                            onClick={() => setOsVisualMode(slot.key, m.id)}
                            style={{
                              flex: 1, padding: "6px 10px", borderRadius: 7, cursor: "pointer",
                              textAlign: "center", fontSize: 11, fontFamily: FONT, fontWeight: 500,
                              background: mode === m.id ? (darkMode ? "rgba(255,255,255,0.08)" : "#fff") : "transparent",
                              color: mode === m.id ? theme.text : theme.textDim,
                              boxShadow: mode === m.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                            }}
                          >{m.label}</motion.div>
                        ))}
                      </div>

                      {/* Upload + (Color picker when mode is icon) */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{
                          padding: "8px 14px", borderRadius: 10, cursor: uploading ? "wait" : "pointer",
                          background: customIcon ? (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)") : "#8B7AFF",
                          color: customIcon ? theme.textDim : "#fff",
                          border: customIcon ? `1px solid ${theme.borderFaint}` : "none",
                          fontSize: 12, fontFamily: FONT, fontWeight: 500,
                          opacity: uploading ? 0.6 : 1,
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          {uploading ? "Lädt..." : customIcon ? "Bild ersetzen" : (mode === "fullbleed" ? "Bild hochladen" : "Icon hochladen")}
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            style={{ display: "none" }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOsVisual(slot.key, f, mode); e.target.value = ""; }}
                          />
                        </label>

                        {/* Background color palette — only in icon mode */}
                        {mode === "icon" && (
                          <>
                            <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginLeft: 4 }}>BG:</div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {OS_VISUAL_BG_PALETTE.map(color => {
                                const active = effectiveBg.toLowerCase() === color.toLowerCase();
                                return (
                                  <motion.div key={color} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => setOsVisualBgColor(slot.key, color)}
                                    style={{
                                      width: 22, height: 22, borderRadius: "50%",
                                      background: color, cursor: "pointer",
                                      border: active ? `2px solid ${darkMode ? "#fff" : "#1a1a2e"}` : "2px solid transparent",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                                    }}
                                  />
                                );
                              })}
                              {/* Custom color input */}
                              <label style={{
                                width: 22, height: 22, borderRadius: "50%", cursor: "pointer",
                                background: `conic-gradient(from 0deg, #ff5e3a, #ffdb4d, #5bd1d7, #8b7aff, #ff5e3a)`,
                                border: "2px solid transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <input type="color" value={effectiveBg}
                                  onChange={(e) => setOsVisualBgColor(slot.key, e.target.value)}
                                  style={{ opacity: 0, width: 0, height: 0 }}
                                />
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Footer hint */}
              <div style={{ padding: "12px 24px 16px", borderTop: `1px solid ${theme.borderFaint}`, fontSize: 11, fontFamily: FONT, color: theme.textFaint, textAlign: "center" }}>
                Empfohlen: quadratische PNG/SVG · mind. 128×128 px · transparenter Hintergrund
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      {/* ── Push Setup Overlay (Portal) ── */}
      {createPortal(<AnimatePresence>
        {pushSetupOverlay && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPushSetupOverlay(null)}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 440,
                background: darkMode ? "rgba(22, 22, 30, 0.98)" : "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(40px)", border: `1px solid ${theme.border}`,
                borderRadius: 20, overflow: "hidden",
                padding: "32px 28px",
              }}
            >
              {/* Status icon */}
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px",
                background:
                  pushSetupOverlay.status === "success" ? "rgba(0, 184, 148, 0.12)" :
                  pushSetupOverlay.status === "error" || pushSetupOverlay.status === "partial" ? "rgba(239, 68, 68, 0.12)" :
                  pushSetupOverlay.status === "needsPwa" ? "rgba(139, 122, 255, 0.12)" :
                  "rgba(139, 122, 255, 0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: 32 }}>
                  {pushSetupOverlay.status === "success" ? "✓" :
                   pushSetupOverlay.status === "error" ? "⚠️" :
                   pushSetupOverlay.status === "partial" ? "⚠️" :
                   pushSetupOverlay.status === "needsPwa" ? "📱" :
                   pushSetupOverlay.status === "working" ? "⏳" : "🔔"}
                </div>
              </div>

              {/* Title */}
              <div style={{ fontSize: 18, fontFamily: FONT, fontWeight: 600, color: theme.text, textAlign: "center", marginBottom: 12 }}>
                {pushSetupOverlay.status === "ready" ? "Benachrichtigungen aktivieren" :
                 pushSetupOverlay.status === "working" ? "Aktiviere..." :
                 pushSetupOverlay.status === "success" ? "Aktiviert!" :
                 pushSetupOverlay.status === "partial" ? "Fast geschafft" :
                 pushSetupOverlay.status === "needsPwa" ? "App zum Home-Bildschirm hinzufügen" :
                 "Setup fehlgeschlagen"}
              </div>

              {/* Body */}
              {pushSetupOverlay.status === "needsPwa" ? (
                <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6, marginBottom: 20 }}>
                  Auf iPhone funktionieren Push-Benachrichtigungen nur, wenn i7 OS zum Home-Bildschirm hinzugefügt ist.
                  <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: theme.text, marginBottom: 6 }}>So geht's:</div>
                    <div style={{ marginBottom: 4 }}>1. Tippe unten auf <strong>Teilen</strong> (das Symbol mit dem Pfeil nach oben ↑)</div>
                    <div style={{ marginBottom: 4 }}>2. Scrolle und wähle <strong>"Zum Home-Bildschirm"</strong></div>
                    <div style={{ marginBottom: 4 }}>3. Tippe <strong>"Hinzufügen"</strong></div>
                    <div>4. Öffne i7 OS vom <strong>Home-Bildschirm</strong> und aktiviere die Benachrichtigungen dort</div>
                  </div>
                </div>
              ) : pushSetupOverlay.message ? (
                <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6, marginBottom: 20, textAlign: "center" }}>
                  {pushSetupOverlay.message}
                </div>
              ) : (
                <div style={{ fontSize: 13, fontFamily: FONT, color: theme.textDim, lineHeight: 1.6, marginBottom: 20, textAlign: "center" }}>
                  Klicke auf "Aktivieren" und erlaube die Benachrichtigungen. Anschließend bekommst du sofort eine Test-Benachrichtigung.
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                {pushSetupOverlay.status === "ready" && (
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={performPushSubscribe}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer",
                      background: theme.accent + "22", border: `1px solid ${theme.accent}40`,
                      fontSize: 14, fontFamily: FONT, fontWeight: 600, color: theme.accent,
                    }}
                  >🔔 Aktivieren</motion.button>
                )}
                {(pushSetupOverlay.status === "success" || pushSetupOverlay.status === "error" || pushSetupOverlay.status === "partial" || pushSetupOverlay.status === "needsPwa") && (
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={() => setPushSetupOverlay(null)}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer",
                      background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                      border: `1px solid ${theme.borderFaint}`,
                      fontSize: 14, fontFamily: FONT, fontWeight: 500, color: theme.text,
                    }}
                  >Schließen</motion.button>
                )}
                {pushSetupOverlay.status === "error" && (
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={performPushSubscribe}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer",
                      background: theme.accent + "22", border: `1px solid ${theme.accent}40`,
                      fontSize: 14, fontFamily: FONT, fontWeight: 600, color: theme.accent,
                    }}
                  >Erneut versuchen</motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      {/* ── Reminder Modal (Portal) ── */}
      {createPortal(<AnimatePresence>
        {showReminderModal && (() => {
          const ReminderModalInner = () => {
            // Smart defaults: today's date + now rounded up to next 15 min
            const _now = new Date();
            const _defaultDate = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
            const _rounded = new Date(_now.getTime() + (15 - (_now.getMinutes() % 15)) * 60000);
            const _defaultTime = `${String(_rounded.getHours()).padStart(2, "0")}:${String(_rounded.getMinutes()).padStart(2, "0")}`;
            const [remTitle, setRemTitle] = useState("");
            const [remDate, setRemDate] = useState(_defaultDate);
            const [remTime, setRemTime] = useState(_defaultTime);
            const [saving, setSaving] = useState(false);

            const handleSaveReminder = async () => {
              if (!remTitle.trim()) { alert("Bitte einen Titel eingeben."); return; }
              if (!remDate) { alert("Bitte ein Datum auswählen."); return; }
              if (!remTime) { alert("Bitte eine Uhrzeit auswählen."); return; }
              const eventTime = new Date(`${remDate}T${remTime}`);
              if (Number.isNaN(eventTime.getTime())) { alert("Ungültige Uhrzeit. Bitte prüfen."); return; }
              if (eventTime.getTime() < Date.now() - 60_000) {
                const ok = confirm("Die Erinnerungszeit liegt in der Vergangenheit. Trotzdem erstellen?");
                if (!ok) return;
              }
              setSaving(true);
              const remindAt = eventTime;

              // Try to create a Google Calendar event with a popup reminder
              // This gives the user native OS notifications on their phone — no PWA needed
              let googleEventId = null;
              let calendarError = null;
              try {
                console.log("[Reminder] Requesting fresh Google token...");
                const providerToken = await ensureValidToken();
                console.log("[Reminder] Token result:", providerToken ? `got token (${providerToken.slice(0, 20)}...)` : "NULL — refresh failed");
                if (!providerToken) {
                  calendarError = "Kein Google-Zugriff. Bitte in Settings → Google-Verbindung auf 'Neu verbinden' klicken.";
                  setGoogleConnectionBroken(true);
                } else {
                  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  const eventEnd = new Date(eventTime.getTime() + 15 * 60000);
                  const calBody = {
                    summary: "⏰ " + remTitle.trim(),
                    description: "Erinnerung aus i7 OS",
                    start: { dateTime: eventTime.toISOString(), timeZone: tz },
                    end: { dateTime: eventEnd.toISOString(), timeZone: tz },
                    reminders: {
                      useDefault: false,
                      overrides: [
                        // Popup: works with Google Calendar app on phone
                        { method: "popup", minutes: 0 },
                        // Email: guaranteed delivery via Gmail (which is on every iPhone)
                        { method: "email", minutes: 0 },
                      ],
                    },
                    transparency: "transparent",
                  };
                  console.log("[Reminder] Creating calendar event:", calBody);
                  const calRes = await fetch(
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                    {
                      method: "POST",
                      headers: { Authorization: `Bearer ${providerToken}`, "Content-Type": "application/json" },
                      body: JSON.stringify(calBody),
                    }
                  );
                  if (calRes.ok) {
                    const calData = await calRes.json();
                    googleEventId = calData.id;
                    console.log("[Reminder] Google Calendar event created:", googleEventId, calData.htmlLink);
                  } else {
                    const errBody = await calRes.text().catch(() => "");
                    calendarError = `Calendar API: ${calRes.status} ${errBody.slice(0, 100)}`;
                    console.warn("[Reminder] Calendar event creation failed:", calRes.status, errBody);
                  }
                }
              } catch (e) {
                calendarError = "Calendar sync error: " + e.message;
                console.warn("[Reminder] Calendar sync failed:", e);
              }

              const { data: newRem } = await supabase.from("reminders").insert({
                user_id: session.user.id,
                org_id: userOrg?.id || null,
                title: remTitle.trim(),
                remind_at: remindAt.toISOString(),
                lead_minutes: 0,
                google_event_id: googleEventId,
              }).select().single();
              if (newRem) setDashboardReminders(prev => [...prev, newRem].sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at)));
              setSaving(false);
              setShowReminderModal(false);
              if (calendarError && !googleEventId) {
                // Surface as in-app notification so user knows phone push won't work
                setNotifications(prev => [{
                  id: "rem-calendar-error-" + Date.now(),
                  type: "reminder",
                  title: "⚠️ Reminder ohne Handy-Notification",
                  body: "Reminder gespeichert, aber Google Calendar Sync fehlgeschlagen: " + calendarError,
                  read: false,
                  created_at: new Date().toISOString(),
                }, ...prev]);
              }
            };

            return (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowReminderModal(false)}
                style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: "100%", maxWidth: 440,
                    background: darkMode ? "rgba(22, 22, 30, 0.97)" : "rgba(255, 255, 255, 0.98)",
                    backdropFilter: "blur(40px)", border: `1px solid ${theme.border}`,
                    borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={theme.textDim} strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke={theme.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ fontSize: 14, fontFamily: FONT, fontWeight: 600, color: theme.text }}>Neue Erinnerung</span>
                    </div>
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setShowReminderModal(false)}
                      style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.textDim, fontSize: 16 }}
                    >✕</motion.div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                    {/* Title */}
                    <div>
                      <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>Woran möchtest du erinnert werden?</label>
                      <input
                        value={remTitle} onChange={e => setRemTitle(e.target.value)}
                        placeholder="z.B. Kundenpräsentation vorbereiten"
                        autoFocus
                        style={{
                          width: "100%", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                          border: `1px solid ${theme.borderFaint}`, borderRadius: 12,
                          padding: "12px 14px", fontSize: 14, fontFamily: FONT,
                          color: theme.text, outline: "none", caretColor: theme.accent,
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = theme.accent + "60"}
                        onBlur={e => e.currentTarget.style.borderColor = theme.borderFaint}
                      />
                    </div>

                    {/* Date + Time row */}
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>Datum</label>
                        <input type="date" value={remDate} onChange={e => setRemDate(e.target.value)}
                          style={{
                            width: "100%", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                            border: `1px solid ${theme.borderFaint}`, borderRadius: 12,
                            padding: "10px 14px", fontSize: 13, fontFamily: FONT,
                            color: theme.text, outline: "none", colorScheme: darkMode ? "dark" : "light",
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>Uhrzeit</label>
                        <input type="time" value={remTime} onChange={e => setRemTime(e.target.value)}
                          style={{
                            width: "100%", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                            border: `1px solid ${theme.borderFaint}`, borderRadius: 12,
                            padding: "10px 14px", fontSize: 13, fontFamily: FONT,
                            color: theme.text, outline: "none", colorScheme: darkMode ? "dark" : "light",
                          }}
                        />
                      </div>
                    </div>


                    {/* Info hint */}
                    <div style={{
                      padding: "10px 12px", borderRadius: 10,
                      background: darkMode ? "rgba(0,184,148,0.06)" : "rgba(0,184,148,0.08)",
                      border: `1px solid ${darkMode ? "rgba(0,184,148,0.15)" : "rgba(0,184,148,0.2)"}`,
                      display: "flex", alignItems: "flex-start", gap: 8,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M3 9l9-6 9 6v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#00B894" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#00B894" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, lineHeight: 1.5 }}>
                        Wird auch als Google Calendar Event angelegt — du erhältst eine native Notification auf deinem Handy zum richtigen Zeitpunkt.
                      </div>
                    </div>

                    {/* Save button */}
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={handleSaveReminder}
                      disabled={!remTitle.trim() || !remDate || !remTime || saving}
                      style={{
                        padding: "12px 0", borderRadius: 12, cursor: remTitle.trim() && remDate && remTime ? "pointer" : "not-allowed",
                        background: remTitle.trim() && remDate && remTime ? theme.accent + "20" : (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
                        border: `1px solid ${remTitle.trim() && remDate && remTime ? theme.accent + "40" : theme.borderFaint}`,
                        fontSize: 14, fontFamily: FONT, fontWeight: 600,
                        color: remTitle.trim() && remDate && remTime ? theme.accent : theme.textFaint,
                        opacity: saving ? 0.6 : 1,
                        transition: "all 0.2s ease",
                      }}
                    >{saving ? "Speichern..." : "Erinnerung erstellen"}</motion.button>
                  </div>
                </motion.div>
              </motion.div>
            );
          };
          return <ReminderModalInner />;
        })()}
      </AnimatePresence>, document.body)}
    </div>
  );
}
