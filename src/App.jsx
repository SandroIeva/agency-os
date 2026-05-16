import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabase";

const COLORS = {
  bg: "#111117",
  text: "#ffffffCC",
  textDim: "#ffffff40",
  accent: "#ffffff",
  ringInactive: "#ffffff18",
  ringActive: "#ffffff",
};

const MENU_ITEMS = [
  { id: "chat", label: "CHAT", sub: [{ id: "team", label: "Team" }, { id: "clients", label: "Clients" }, { id: "ai", label: "AI" }, { id: "channels", label: "Channels" }, { id: "calls", label: "Calls" }, { id: "archive", label: "Archive" }] },
  { id: "plan", label: "PLAN", sub: [{ id: "kanban", label: "Kanban" }, { id: "timeline", label: "Timeline" }, { id: "tasks", label: "Tasks" }, { id: "calendar", label: "Calendar" }] },
  { id: "brand", label: "BRAND", sub: [{ id: "assets", label: "Assets" }, { id: "identity", label: "Identity" }, { id: "knowledge", label: "Intelligence" }, { id: "personas", label: "Personas" }, { id: "competitor", label: "Analyze" }, { id: "guidelines", label: "Guidelines" }] },
  { id: "docs", label: "PROJECTS", sub: [{ id: "notes", label: "Notes" }, { id: "briefs", label: "Briefs" }, { id: "wiki", label: "Wiki" }, { id: "templates", label: "Templates" }, { id: "proposals", label: "Proposals" }, { id: "reports", label: "Reports" }] },
  { id: "files", label: "FILES", sub: [{ id: "images", label: "Images" }, { id: "videos", label: "Videos" }, { id: "all", label: "Docs" }, { id: "fonts", label: "Fonts" }, { id: "links", label: "Links" }] },
  { id: "agents", label: "AGENTS", sub: [{ id: "dev", label: "Dev" }, { id: "design", label: "Design" }, { id: "strategy", label: "Strategy" }, { id: "finance", label: "Finance" }, { id: "marketing", label: "Marketing" }, { id: "sales", label: "Sales" }] },
];

const PLUS_MENU_ITEMS = [
  { id: "create", label: "CREATE", sub: [{ id: "project", label: "Project" }, { id: "brief", label: "Brief" }, { id: "document", label: "Document" }] },
  { id: "task", label: "TASK", sub: [{ id: "todo", label: "To-Do" }, { id: "reminder", label: "Reminder" }, { id: "note", label: "Note" }] },
  { id: "ideate", label: "IDEATE", sub: [{ id: "brainstorm", label: "Brainstorm" }, { id: "moodboard", label: "Moodboard" }, { id: "concept", label: "Concept" }] },
];

const FONT = "'Geist', -apple-system, sans-serif";

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
              stroke: isActive ? (darkMode ? "#ffffff" : "#1a1a2e") : (darkMode ? "#ffffff18" : "#1a1a2e18"),
              strokeWidth: isActive ? stroke + 1.5 : stroke,
            }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        );
      })}
    </svg>
  );
}

function AISphere() {
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

        // Blend colors — balanced pink-purple-blue, not too bright, not too pale
        vec3 rose = vec3(0.82, 0.28, 0.48);
        vec3 purple = vec3(0.52, 0.25, 0.72);
        vec3 deepblue = vec3(0.2, 0.35, 0.78);
        vec3 teal = vec3(0.3, 0.6, 0.68);
        vec3 mauve = vec3(0.72, 0.3, 0.6);

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
        final *= 0.4 + edge * 0.6;

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
  }, [ready]);

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
function WaveformEqualizer({ onAudioData }) {
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
            background: `linear-gradient(180deg, rgba(180,130,255,0.9), rgba(100,80,200,0.4))`,
            opacity: 0.3,
            transition: "height 0.06s ease-out, opacity 0.06s ease-out",
          }}
        />
      ))}
    </div>
  );
}

// AI Speaking Sphere — the sphere animates in the center while "responding"
function AISpeakingSphere() {
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
        vec3 rose = vec3(0.82, 0.28, 0.48);
        vec3 purple = vec3(0.52, 0.25, 0.72);
        vec3 deepblue = vec3(0.2, 0.35, 0.78);
        vec3 teal = vec3(0.3, 0.6, 0.68);
        vec3 mauve = vec3(0.72, 0.3, 0.6);
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
        final *= 0.4 + edge * 0.6;
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
  }, [ready]);

  return <div ref={containerRef} style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden" }} />;
}

// Kanban board data
const priColors = { high: "#EF4444", medium: "#F59E0B", low: "#ffffff30" };
const ASSIGNEE_COLORS = ["#8B7AFF", "#E84393", "#00B894", "#F59E0B", "#5B8DEF", "#E88D67", "#6C5CE7", "#FD79A8"];

// Hardcoded fallback columns — always visible even if Supabase fails
const DEFAULT_COLUMNS = [
  { id: "col-todo", key: "todo", label: "To Do", color: "#ffffff50", position: 0 },
  { id: "col-progress", key: "progress", label: "In Progress", color: "#F59E0B", position: 1 },
  { id: "col-review", key: "review", label: "Review", color: "#8B7AFF", position: 2 },
  { id: "col-done", key: "done", label: "Done", color: "#00B894", position: 3 },
];

function KanbanBoard({ onBack, session }) {
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", column_key: "todo", project_name: "", assignee_id: null });
  const [dragOverCol, setDragOverCol] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
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

      // 2. Load tasks
      const { data: taskData } = await supabase.from("tasks").select("*").eq("creator_id", u.id).order("position");
      setTasks(taskData || []);

      // 3. Load team members (after profile is ensured)
      const { data: members } = await supabase.from("team_members").select("*");
      const memberMap = {};
      (members || []).forEach(m => { memberMap[m.user_id] = m; });
      setTeamMembers(memberMap);

      setLoading(false);
    };
    init();
  }, [session]);

  const projectNames = [...new Set(tasks.map(t => t.project_name).filter(Boolean))];
  const filtered = filter === "all" ? tasks : tasks.filter(t => t.project_name === filter);

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
      position: tasks.filter(t => t.column_key === taskForm.column_key).length,
    };
    const { data, error } = await supabase.from("tasks").insert(taskData).select().single();
    console.log("Task create result:", { data, error, taskData });
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    if (data) {
      setTasks(prev => [...prev, data]);
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
      updated_at: new Date().toISOString(),
    };
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updates } : t));
    await supabase.from("tasks").update(updates).eq("id", editingTask.id);
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
    setTaskForm({ title: "", description: "", priority: "medium", column_key: "todo", project_name: "", assignee_id: session?.user?.id || null });
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      column_key: task.column_key || "todo",
      project_name: task.project_name || "",
      assignee_id: task.assignee_id || session?.user?.id || null,
    });
    setShowNewTask(true);
  };

  const openNewTask = (colKey) => {
    setEditingTask(null);
    setTaskForm({ title: "", description: "", priority: "medium", column_key: colKey || "todo", project_name: "", assignee_id: session?.user?.id || null });
    setShowNewTask(true);
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
        <motion.div
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onBack}
          style={{
            width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
            border: "1px solid #ffffff18", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#ffffff50", fontFamily: FONT,
          }}>←</motion.div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#ffffffe6", fontFamily: FONT, letterSpacing: -0.5 }}>Tasks</div>
          <div style={{ fontSize: 12, color: "#ffffff50", fontFamily: FONT, marginTop: 2 }}>
            {loading ? "Loading..." : `${filtered.length} tasks across ${colEntries.length} columns`}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 32px", flexWrap: "wrap" }}>
        {["all", ...projectNames].map(p => (
          <motion.button key={p} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setFilter(p)}
            style={{
              fontSize: 12, fontFamily: FONT, fontWeight: 400, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
              background: filter === p ? "#ffffff0F" : "transparent",
              border: `1px solid ${filter === p ? "#ffffff18" : "#ffffff0A"}`,
              color: filter === p ? "#ffffffe6" : "#ffffff50",
            }}
          >{p === "all" ? "All projects" : p}</motion.button>
        ))}
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => openNewTask("todo")}
          style={{
            fontSize: 12, fontFamily: FONT, fontWeight: 500, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
            background: "#8B7AFF15", border: "1px solid #8B7AFF30", color: "#8B7AFF", marginLeft: "auto",
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
                background: dragOverCol === col.key ? "rgba(139,122,255,0.04)" : "transparent",
                borderRadius: 16, transition: "background 0.2s",
                padding: dragOverCol === col.key ? "8px" : "0",
              }}>
              {/* Column Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "0 4px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color }} />
                <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffffa0", fontWeight: 500 }}>{col.label}</span>
                <span style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff30" }}>{colTasks.length}</span>
                <motion.div
                  whileHover={{ scale: 1.15, color: "#8B7AFF" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => openNewTask(col.key)}
                  style={{ marginLeft: "auto", cursor: "pointer", color: "#ffffff20", fontSize: 16, fontFamily: FONT, lineHeight: 1 }}
                >+</motion.div>
              </div>
              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 80, overflowY: "auto" }}>
                {loading ? (
                  <motion.div
                    animate={{ opacity: [0.15, 0.3, 0.15] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ height: 80, borderRadius: 14, background: "#ffffff08" }}
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
                              background: "#1A1A24", border: "1px solid #ffffff10", borderRadius: 14,
                              padding: "14px 16px", cursor: "grab",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                              <span style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30", letterSpacing: 0.5 }}>{task.project_name || "General"}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {task.is_ai_task && <span style={{ fontSize: 9, fontFamily: FONT, fontWeight: 500, color: "#E84393", padding: "2px 6px", borderRadius: 4, background: "#E8439315", letterSpacing: 0.5 }}>AI</span>}
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: priColors[task.priority] }} />
                                <motion.div
                                  whileHover={{ scale: 1.2 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); requestDelete(task.id); }}
                                  style={{ cursor: "pointer", color: "#ffffff20", fontSize: 12, fontFamily: FONT, padding: "0 2px" }}
                                >✕</motion.div>
                              </div>
                            </div>
                            <div style={{ fontSize: 14, fontFamily: FONT, color: "#ffffffe6", fontWeight: 500, marginBottom: 4, lineHeight: 1.4 }}>{task.title}</div>
                            {task.description && <div style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff50", lineHeight: 1.5, marginBottom: 12 }}>{task.description}</div>}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              {member ? (
                                member.avatar_url ? (
                                  <img src={member.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #ffffff15" }} />
                                ) : (
                                  <div style={{
                                    width: 22, height: 22, borderRadius: "50%", background: (member.avatar_color || "#8B7AFF") + "25", color: member.avatar_color || "#8B7AFF",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: FONT, fontWeight: 600,
                                  }}>{member.initials}</div>
                                )
                              ) : (
                                <div style={{
                                  width: 22, height: 22, borderRadius: "50%", background: "#8B7AFF25", color: "#8B7AFF",
                                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: FONT, fontWeight: 600,
                                }}>?</div>
                              )}
                              {task.time_tracked && <span style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30" }}>⏱ {task.time_tracked}</span>}
                              {task.due_date && <span style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30" }}>{new Date(task.due_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}</span>}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {colTasks.length === 0 && (
                      <div
                        onClick={() => openNewTask(col.key)}
                        style={{
                          flex: 1, border: `1px dashed ${dragOverCol === col.key ? "#8B7AFF30" : "#ffffff10"}`,
                          borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontFamily: FONT, cursor: "pointer",
                          color: dragOverCol === col.key ? "#8B7AFF60" : "#ffffff20",
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
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: 420, background: "rgba(22, 22, 30, 0.95)",
                backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 18, fontFamily: FONT, fontWeight: 600, color: "#ffffffdd" }}>
                  {editingTask ? "Task bearbeiten" : "Neuer Task"}
                </div>
                {editingTask && (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { resetForm(); requestDelete(editingTask.id); }}
                    style={{
                      fontSize: 11, fontFamily: FONT, color: "#EF4444", cursor: "pointer",
                      padding: "4px 10px", borderRadius: 8, background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >Löschen</motion.div>
                )}
              </div>

              {/* Title */}
              <input
                value={taskForm.title}
                onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Task Titel..."
                autoFocus
                onKeyDown={e => { if (e.key === "Enter" && taskForm.title.trim()) { editingTask ? updateTask() : createTask(); } }}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "12px 16px", fontSize: 14, fontFamily: FONT,
                  color: "#ffffffdd", outline: "none", caretColor: "#8B7AFF",
                }}
              />

              {/* Description */}
              <textarea
                value={taskForm.description}
                onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Beschreibung (optional)..."
                rows={3}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "12px 16px", fontSize: 13, fontFamily: FONT,
                  color: "#ffffffdd", outline: "none", resize: "none", caretColor: "#8B7AFF",
                }}
              />

              {/* Project name */}
              <input
                value={taskForm.project_name}
                onChange={e => setTaskForm(p => ({ ...p, project_name: e.target.value }))}
                placeholder="Projekt Name (z.B. Meridian)..."
                list="project-suggestions"
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "10px 16px", fontSize: 13, fontFamily: FONT,
                  color: "#ffffffdd", outline: "none", caretColor: "#8B7AFF",
                }}
              />
              <datalist id="project-suggestions">
                {projectNames.map(p => <option key={p} value={p} />)}
              </datalist>

              {/* Assignee */}
              <div>
                <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", marginBottom: 6 }}>Zugewiesen an</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.values(teamMembers).map(m => (
                    <motion.div
                      key={m.user_id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setTaskForm(prev => ({ ...prev, assignee_id: m.user_id }))}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 12px", borderRadius: 10, cursor: "pointer",
                        background: taskForm.assignee_id === m.user_id ? (m.avatar_color || "#8B7AFF") + "15" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${taskForm.assignee_id === m.user_id ? (m.avatar_color || "#8B7AFF") + "35" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 20, height: 20, borderRadius: "50%" }} />
                      ) : (
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: (m.avatar_color || "#8B7AFF") + "30", color: m.avatar_color || "#8B7AFF",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontFamily: FONT, fontWeight: 600,
                        }}>{m.initials}</div>
                      )}
                      <span style={{
                        fontSize: 12, fontFamily: FONT,
                        color: taskForm.assignee_id === m.user_id ? "#ffffffcc" : "#ffffff50",
                      }}>{m.display_name}</span>
                      {taskForm.assignee_id === m.user_id && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke={m.avatar_color || "#8B7AFF"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </motion.div>
                  ))}
                  {Object.keys(teamMembers).length === 0 && (
                    <div style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff30", padding: "6px 0" }}>Keine Team-Mitglieder gefunden</div>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div>
                <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", marginBottom: 6 }}>Priorität</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["high", "medium", "low"].map(p => (
                    <motion.div key={p} whileTap={{ scale: 0.95 }}
                      onClick={() => setTaskForm(prev => ({ ...prev, priority: p }))}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 8, textAlign: "center", cursor: "pointer",
                        fontSize: 11, fontFamily: FONT,
                        background: taskForm.priority === p ? priColors[p] + "20" : "rgba(255,255,255,0.03)",
                        color: taskForm.priority === p ? priColors[p] : "#ffffff40",
                        border: `1px solid ${taskForm.priority === p ? priColors[p] + "40" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >{p === "high" ? "Hoch" : p === "medium" ? "Mittel" : "Niedrig"}</motion.div>
                  ))}
                </div>
              </div>

              {/* Column */}
              <div>
                <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", marginBottom: 6 }}>Spalte</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {colEntries.map(c => (
                    <motion.div key={c.key} whileTap={{ scale: 0.95 }}
                      onClick={() => setTaskForm(prev => ({ ...prev, column_key: c.key }))}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 8, textAlign: "center", cursor: "pointer",
                        fontSize: 11, fontFamily: FONT,
                        background: taskForm.column_key === c.key ? c.color + "20" : "rgba(255,255,255,0.03)",
                        color: taskForm.column_key === c.key ? c.color : "#ffffff40",
                          border: `1px solid ${taskForm.column_key === c.key ? c.color + "40" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >{c.label}</motion.div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={resetForm}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 12, cursor: "pointer",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 13, fontFamily: FONT, color: "#ffffff60",
                  }}
                >Abbrechen</motion.button>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={editingTask ? updateTask : createTask}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 12, cursor: "pointer",
                    background: taskForm.title.trim() ? "rgba(139,122,255,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${taskForm.title.trim() ? "rgba(139,122,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                    fontSize: 13, fontFamily: FONT, fontWeight: 500,
                    color: taskForm.title.trim() ? "#8B7AFF" : "#ffffff30",
                  }}
                >{editingTask ? "Speichern" : "Task erstellen"}</motion.button>
              </div>
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
                width: 360, background: "rgba(22, 22, 30, 0.96)",
                backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.1)",
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
              <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: "#ffffffdd", marginBottom: 8 }}>
                Task löschen?
              </div>
              <div style={{ fontSize: 13, fontFamily: FONT, color: "#ffffff50", marginBottom: 24, lineHeight: 1.5 }}>
                „{confirmDelete.title}" wird unwiderruflich gelöscht.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 13, fontFamily: FONT, color: "#ffffff70", fontWeight: 500,
                  }}
                >Abbrechen</motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={confirmDeleteTask}
                  style={{
                    flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer",
                    background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
                    fontSize: 13, fontFamily: FONT, color: "#EF4444", fontWeight: 600,
                  }}
                >Löschen</motion.button>
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

function CalendarView({ onBack, session, getProviderToken, openMeetCall, autoReLogin }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState("month"); // "month" | "week" | "day"
  const [navDirection, setNavDirection] = useState(0); // -1 = prev, 1 = next, for animation
  const [navKey, setNavKey] = useState(0); // force re-render for animation
  const [googleEvents, setGoogleEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", date: "", startTime: "09:00", endTime: "10:00", description: "", allDay: false, withMeet: false });
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

      // Google Calendar
      const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
      if (providerToken) {
        try {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
            { headers: { Authorization: `Bearer ${providerToken}` } }
          );
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
            // Token expired — automatically refresh via silent OAuth redirect
            if (autoReLogin) autoReLogin();
            return;
          }
        } catch (err) {
          console.error("Calendar fetch error:", err);
        }
      } else {
        // No token available — auto-refresh
        if (autoReLogin) autoReLogin();
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

      setLoading(false);
    };
    load();
  }, [session, year, month]);

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
    setEventForm({ title: "", date: dateStr, startTime: "09:00", endTime: "10:00", description: "", allDay: false, withMeet: false });
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
      const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
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
        const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
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
  const cancelNewEvent = () => {
    if (tempEventId) {
      const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
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
    if (!eventObj?.id || eventObj.type !== "google") return;
    const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
    if (!providerToken) return;
    setDeletingEvent(true);
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventObj.id}?sendUpdates=all`,
        { method: "DELETE", headers: { Authorization: `Bearer ${providerToken}` } }
      );
      if (res.ok || res.status === 204) {
        // Remove from local state
        setGoogleEvents(prev => prev.filter(e => e.id !== eventObj.id));
        setConfirmDeleteEvent(null);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Delete event error:", res.status, err);
      }
    } catch (err) {
      console.error("Delete event error:", err);
    }
    setDeletingEvent(false);
  };

  // Create or update Google Calendar event
  const createGoogleEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date) return;
    const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
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
          style={{ width: 32, height: 32, borderRadius: "50%", cursor: "pointer", border: "1px solid #ffffff18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#ffffff50", fontFamily: FONT }}>←</motion.div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#ffffffe6", fontFamily: FONT, letterSpacing: -0.5 }}>Calendar</div>
          <div style={{ fontSize: 12, color: "#ffffff50", fontFamily: FONT, marginTop: 2 }}>
            {loading ? "Loading..." : `${googleEvents.length} Events · ${tasks.length} Tasks`}
          </div>
        </div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => openNewEvent(selectedDay)}
          style={{ cursor: "pointer", fontSize: 12, fontFamily: FONT, color: "#fff", padding: "8px 18px", borderRadius: 10, background: "rgba(139,122,255,0.25)", border: "1px solid rgba(139,122,255,0.35)", fontWeight: 500, letterSpacing: -0.2 }}>
          + Neuer Termin
        </motion.div>
      </div>

      {/* Navigation + View Switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 32px 8px" }}>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={navigatePrev}
          style={{ cursor: "pointer", color: "#ffffff50", fontSize: 18, fontFamily: FONT, padding: "4px 8px" }}>‹</motion.div>
        <motion.div
          key={`nav-${navKey}`}
          initial={{ opacity: 0, y: navDirection * 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 0.68, 0.35, 1.0] }}
          style={{ fontSize: 16, fontFamily: FONT, fontWeight: 500, color: "#ffffffcc", minWidth: 200, textAlign: "center" }}
        >
          {getNavLabel()}
        </motion.div>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={navigateNext}
          style={{ cursor: "pointer", color: "#ffffff50", fontSize: 18, fontFamily: FONT, padding: "4px 8px" }}>›</motion.div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={goToday}
          style={{ marginLeft: 8, cursor: "pointer", fontSize: 11, fontFamily: FONT, color: "#8B7AFF", padding: "4px 12px", borderRadius: 8, background: "rgba(139,122,255,0.1)", border: "1px solid rgba(139,122,255,0.2)" }}>Heute</motion.div>
        <div style={{ flex: 1 }} />
        {/* View mode switcher */}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, border: "1px solid rgba(255,255,255,0.06)" }}>
          {[{ key: "month", label: "Monat" }, { key: "week", label: "Woche" }, { key: "day", label: "Tag" }].map(v => (
            <motion.div key={v.key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setViewMode(v.key)}
              style={{
                cursor: "pointer", padding: "5px 14px", borderRadius: 8, fontSize: 11, fontFamily: FONT, fontWeight: 500,
                color: viewMode === v.key ? "#fff" : "#ffffff50",
                background: viewMode === v.key ? "rgba(139,122,255,0.25)" : "transparent",
                transition: "all 0.15s",
              }}
            >{v.label}</motion.div>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4, background: "rgba(20,18,30,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderRadius: 10, padding: "2px 0" }}>
              {WEEKDAYS.map((d, di) => (
                <div key={d} style={{ textAlign: "center", fontSize: 13, fontFamily: FONT, color: di >= 5 ? "#ffffff28" : "#ffffff45", padding: "6px 0", fontWeight: 500 }}>{d}</div>
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
                      background: isSelected ? "rgba(139,122,255,0.15)" : todayHighlight ? "rgba(139,122,255,0.08)" : weekend ? "rgba(255,255,255,0.025)" : "rgba(25,23,38,0.92)",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      border: isSelected ? "1px solid rgba(139,122,255,0.3)" : todayHighlight ? "1px solid rgba(139,122,255,0.15)" : "1px solid transparent",
                      display: "flex", flexDirection: "column", minHeight: 54, transition: "all 0.15s",
                      opacity: dayObj.isOtherMonth ? 0.25 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 11, fontFamily: FONT, fontWeight: todayHighlight ? 600 : 400,
                        color: todayHighlight ? "#8B7AFF" : weekend ? "#ffffff40" : isSelected ? "#ffffffcc" : "#ffffff70",
                      }}>{dayObj.day}</span>
                      {holiday && (
                        <>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ffffffcc", flexShrink: 0, marginLeft: 4 }} />
                          <span style={{ fontSize: 11, fontFamily: FONT, color: "#ffffffcc", opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{holiday}</span>
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
                        <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30" }}>+{events.length - 3} mehr</div>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4, background: "rgba(20,18,30,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderRadius: 10, padding: "6px 0" }}>
              {getWeekDays().map((d, di) => {
                const isTd = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                return (
                  <div key={di} style={{ textAlign: "center", fontFamily: FONT }}>
                    <div style={{ fontSize: 10, color: di >= 5 ? "#ffffff25" : "#ffffff40", fontWeight: 500 }}>{WEEKDAYS[di]}</div>
                    <div style={{ fontSize: 16, fontWeight: isTd ? 700 : 500, color: isTd ? "#8B7AFF" : di >= 5 ? "#ffffff35" : "#ffffffcc", marginTop: 2 }}>{d.getDate()}</div>
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
                    background: isTd ? "rgba(139,122,255,0.06)" : di >= 5 ? "rgba(255,255,255,0.01)" : "rgba(20,18,30,0.65)",
                    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                    border: isTd ? "1px solid rgba(139,122,255,0.15)" : "1px solid rgba(255,255,255,0.05)",
                    overflowY: "auto",
                  }}>
                    {hol && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ffffffcc", flexShrink: 0 }} />
                        <span style={{ fontSize: 9, fontFamily: FONT, color: "#ffffffcc", opacity: 0.8 }}>{hol}</span>
                      </div>
                    )}
                    {events.length === 0 && !hol && (
                      <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff15", textAlign: "center", marginTop: 12 }}>—</div>
                    )}
                    {events.map((e, ei) => (
                      <motion.div key={ei}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: ei * 0.03 }}
                        style={{
                          padding: "6px 8px", borderRadius: 8, borderLeft: `3px solid ${e.color}`,
                          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <div style={{ fontSize: 11, fontFamily: FONT, fontWeight: 500, color: "#ffffffdd", marginBottom: 2 }}>{e.title}</div>
                        {e.start && !e.allDay && (
                          <div style={{ fontSize: 9, fontFamily: FONT, color: "#ffffff40" }}>
                            {new Date(e.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            {e.end && ` – ${new Date(e.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                          </div>
                        )}
                        {e.allDay && <div style={{ fontSize: 9, fontFamily: FONT, color: "#ffffff30" }}>Ganztägig</div>}
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
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffffffcc" }} />
                        <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffffcc" }}>{hol}</span>
                      </div>
                    )}
                    {isWe && (
                      <span style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff30", padding: "5px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>Wochenende</span>
                    )}
                    <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff40" }}>
                      {dayEvents.length === 0 ? "Keine Termine" : `${dayEvents.length} ${dayEvents.length === 1 ? "Termin" : "Termine"}`}
                    </span>
                  </div>

                  {dayEvents.length === 0 && (
                    <div style={{ padding: "60px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
                      <div style={{ fontSize: 14, fontFamily: FONT, color: "#ffffff25" }}>Freier Tag</div>
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
                        background: "rgba(20,18,30,0.65)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.05)", borderLeft: `4px solid ${e.color}`,
                        display: "flex", alignItems: "flex-start", gap: 16,
                      }}
                    >
                      {/* Time column */}
                      <div style={{ minWidth: 65, flexShrink: 0 }}>
                        {e.start && !e.allDay ? (
                          <>
                            <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: "#ffffffcc" }}>
                              {new Date(e.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            {e.end && (
                              <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff35", marginTop: 2 }}>
                                {new Date(e.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff35", padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)", display: "inline-block" }}>Ganztägig</div>
                        )}
                      </div>
                      {/* Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontFamily: FONT, fontWeight: 500, color: "#ffffffdd", marginBottom: 4 }}>{e.title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {e.type === "google" && (
                            <span style={{ fontSize: 10, fontFamily: FONT, color: "#5B8DEF", padding: "2px 8px", borderRadius: 4, background: "rgba(91,141,239,0.1)" }}>Google</span>
                          )}
                          {e.type === "task" && (
                            <span style={{ fontSize: 10, fontFamily: FONT, color: "#8B7AFF", padding: "2px 8px", borderRadius: 4, background: "rgba(139,122,255,0.1)" }}>Task</span>
                          )}
                          {e.project && <span style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30" }}>{e.project}</span>}
                          {e.location && <span style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30" }}>📍 {e.location}</span>}
                        </div>
                        {e.hangoutLink && (
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            onClick={() => openMeetCall(e.hangoutLink, e.title)}
                            style={{ display: "inline-block", fontSize: 11, fontFamily: FONT, color: "#00B894", marginTop: 6, cursor: "pointer", padding: "3px 10px", borderRadius: 6, background: "rgba(0,184,148,0.08)", border: "1px solid rgba(0,184,148,0.15)" }}
                          >🔗 Google Meet beitreten</motion.div>
                        )}
                      </div>
                      {/* Delete button for Google events */}
                      {e.type === "google" && (
                        <motion.div
                          whileHover={{ scale: 1.15, background: "rgba(232,67,67,0.15)" }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setConfirmDeleteEvent(e)}
                          style={{ cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#ffffff25", flexShrink: 0, transition: "all 0.15s" }}
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
                width: 280, flexShrink: 0, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
                display: "flex", flexDirection: "column", overflow: "hidden",
              }}
            >
              <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 15, fontFamily: FONT, fontWeight: 600, color: "#ffffffdd" }}>
                    {selectedDay.day}. {MONTH_NAMES[month]}
                  </div>
                <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", marginTop: 2 }}>
                  {selectedEvents.length === 0 ? "Keine Termine" : `${selectedEvents.length} ${selectedEvents.length === 1 ? "Termin" : "Termine"}`}
                </div>
                {getHoliday(selectedDay) && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffffffcc", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: FONT, color: "#ffffffcc" }}>{getHoliday(selectedDay)}</span>
                  </div>
                )}
                </div>
                <motion.div
                  whileHover={{ scale: 1.15, background: "rgba(255,255,255,0.08)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedDay(null)}
                  style={{ cursor: "pointer", width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#ffffff40", flexShrink: 0, transition: "all 0.15s" }}
                >✕</motion.div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                {selectedEvents.length === 0 && (
                  <div style={{ padding: "24px 8px", textAlign: "center", fontSize: 12, fontFamily: FONT, color: "#ffffff25" }}>
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
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                      borderLeft: `3px solid ${e.color}`, position: "relative", group: "event",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                      <div style={{ fontSize: 13, fontFamily: FONT, fontWeight: 500, color: "#ffffffdd", marginBottom: 3, flex: 1 }}>{e.title}</div>
                      {e.type === "google" && (
                        <motion.div
                          whileHover={{ scale: 1.15, background: "rgba(232,67,67,0.15)" }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setConfirmDeleteEvent(e)}
                          style={{ cursor: "pointer", width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#ffffff30", flexShrink: 0, transition: "all 0.15s" }}
                          title="Event absagen"
                        >✕</motion.div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {e.start && !e.allDay && (
                        <span style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff45" }}>
                          {new Date(e.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                          {e.end && ` – ${new Date(e.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      )}
                      {e.allDay && <span style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff35", padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)" }}>Ganztägig</span>}
                      {e.type === "google" && (
                        <span style={{ fontSize: 9, fontFamily: FONT, color: "#5B8DEF", padding: "1px 6px", borderRadius: 4, background: "rgba(91,141,239,0.1)" }}>Google</span>
                      )}
                      {e.type === "task" && (
                        <span style={{ fontSize: 9, fontFamily: FONT, color: "#8B7AFF", padding: "1px 6px", borderRadius: 4, background: "rgba(139,122,255,0.1)" }}>Task</span>
                      )}
                      {e.project && (
                        <span style={{ fontSize: 9, fontFamily: FONT, color: "#ffffff30" }}>{e.project}</span>
                      )}
                    </div>
                    {e.location && (
                      <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30", marginTop: 4 }}>📍 {e.location}</div>
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
            style={{ width: 420, background: "rgba(28,26,42,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 28px 24px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            <div style={{ fontSize: 18, fontFamily: FONT, fontWeight: 600, color: "#ffffffdd", marginBottom: 20, letterSpacing: -0.3 }}>Neuer Termin</div>

            {/* Title */}
            <input
              value={eventForm.title}
              onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titel"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#ffffffdd", fontSize: 14, fontFamily: FONT, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
            />

            {/* Date */}
            <input
              type="date"
              value={eventForm.date}
              onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#ffffffdd", fontSize: 13, fontFamily: FONT, outline: "none", marginBottom: 12, boxSizing: "border-box", colorScheme: "dark" }}
            />

            {/* Toggles row */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 12 }}>
              {/* All day toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setEventForm(f => ({ ...f, allDay: !f.allDay }))}
                  style={{ width: 36, height: 20, borderRadius: 10, background: eventForm.allDay ? "rgba(139,122,255,0.4)" : "rgba(255,255,255,0.08)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
                >
                  <motion.div animate={{ x: eventForm.allDay ? 17 : 2 }} transition={{ duration: 0.2 }}
                    style={{ width: 16, height: 16, borderRadius: "50%", background: eventForm.allDay ? "#8B7AFF" : "#ffffff50", position: "absolute", top: 2 }} />
                </motion.div>
                <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff70" }}>Ganztägig</span>
              </div>

              {/* Google Meet toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  onClick={() => toggleMeet(!eventForm.withMeet)}
                  style={{ width: 36, height: 20, borderRadius: 10, background: eventForm.withMeet ? "rgba(0,184,148,0.4)" : "rgba(255,255,255,0.08)", cursor: meetLoading ? "wait" : "pointer", position: "relative", transition: "background 0.2s" }}
                >
                  <motion.div animate={{ x: eventForm.withMeet ? 17 : 2 }} transition={{ duration: 0.2 }}
                    style={{ width: 16, height: 16, borderRadius: "50%", background: eventForm.withMeet ? "#00B894" : "#ffffff50", position: "absolute", top: 2 }} />
                </motion.div>
                <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff70" }}>Google Meet</span>
                {meetLoading && <span style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40" }}>Erstelle Link...</span>}
              </div>
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
                  style={{ cursor: "pointer", padding: "5px 12px", borderRadius: 8, fontSize: 11, fontFamily: FONT, fontWeight: 500, color: linkCopied ? "#00B894" : "#ffffffcc", background: linkCopied ? "rgba(0,184,148,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${linkCopied ? "rgba(0,184,148,0.3)" : "rgba(255,255,255,0.08)"}`, transition: "all 0.2s", whiteSpace: "nowrap" }}
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
                <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff40", marginBottom: 6 }}>Teilnehmer</div>
                {/* Attendee chips */}
                {attendees.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {attendees.map((email, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 12px", borderRadius: 20, background: "rgba(139,122,255,0.1)", border: "1px solid rgba(139,122,255,0.2)", fontSize: 12, fontFamily: FONT, color: "#ffffffcc" }}
                      >
                        <span>{email}</span>
                        <motion.span
                          whileHover={{ scale: 1.2 }}
                          onClick={() => setAttendees(a => a.filter((_, idx) => idx !== i))}
                          style={{ cursor: "pointer", color: "#ffffff40", fontSize: 14, lineHeight: 1 }}
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
                    placeholder="E-Mail eingeben + Enter"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#ffffffdd", fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
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
                    style={{ cursor: "pointer", padding: "8px 14px", borderRadius: 10, fontSize: 12, fontFamily: FONT, color: "#8B7AFF", background: "rgba(139,122,255,0.1)", border: "1px solid rgba(139,122,255,0.2)", whiteSpace: "nowrap" }}
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
                  <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff40", marginBottom: 4 }}>Von</div>
                  <input
                    type="time"
                    value={eventForm.startTime}
                    onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#ffffffdd", fontSize: 13, fontFamily: FONT, outline: "none", boxSizing: "border-box", colorScheme: "dark" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff40", marginBottom: 4 }}>Bis</div>
                  <input
                    type="time"
                    value={eventForm.endTime}
                    onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#ffffffdd", fontSize: 13, fontFamily: FONT, outline: "none", boxSizing: "border-box", colorScheme: "dark" }}
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <textarea
              value={eventForm.description}
              onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Beschreibung (optional)"
              rows={3}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#ffffffdd", fontSize: 13, fontFamily: FONT, outline: "none", resize: "vertical", marginBottom: 20, boxSizing: "border-box" }}
            />

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={cancelNewEvent}
                style={{ cursor: "pointer", padding: "9px 20px", borderRadius: 10, fontSize: 13, fontFamily: FONT, color: "#ffffff60", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Abbrechen
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={createGoogleEvent}
                style={{ cursor: savingEvent ? "wait" : "pointer", padding: "9px 24px", borderRadius: 10, fontSize: 13, fontFamily: FONT, color: "#fff", fontWeight: 500, background: savingEvent ? "rgba(139,122,255,0.15)" : "rgba(139,122,255,0.3)", border: "1px solid rgba(139,122,255,0.4)", opacity: (!eventForm.title.trim() || savingEvent) ? 0.5 : 1 }}>
                {savingEvent ? "Speichern..." : "Termin erstellen"}
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
            style={{ width: 380, background: "rgba(28,26,42,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 28px 24px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            {/* Warning icon */}
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(232,67,67,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 22 }}>⚠️</div>

            <div style={{ fontSize: 17, fontFamily: FONT, fontWeight: 600, color: "#ffffffdd", marginBottom: 8, letterSpacing: -0.3 }}>Event absagen?</div>

            <div style={{ fontSize: 13, fontFamily: FONT, color: "#ffffff60", marginBottom: 6, lineHeight: 1.5 }}>
              Möchtest du dieses Event wirklich löschen?
            </div>

            {/* Event preview */}
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20, borderLeft: `3px solid ${confirmDeleteEvent.color}` }}>
              <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: "#ffffffcc" }}>{confirmDeleteEvent.title}</div>
              {confirmDeleteEvent.start && !confirmDeleteEvent.allDay && (
                <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", marginTop: 3 }}>
                  {new Date(confirmDeleteEvent.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  {confirmDeleteEvent.end && ` – ${new Date(confirmDeleteEvent.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                </div>
              )}
              {confirmDeleteEvent.allDay && (
                <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff35", marginTop: 3 }}>Ganztägig</div>
              )}
            </div>

            <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", marginBottom: 16 }}>
              Alle Teilnehmer werden per E-Mail benachrichtigt.
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => !deletingEvent && setConfirmDeleteEvent(null)}
                style={{ cursor: "pointer", padding: "9px 20px", borderRadius: 10, fontSize: 13, fontFamily: FONT, color: "#ffffff60", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Behalten
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => deleteGoogleEvent(confirmDeleteEvent)}
                style={{ cursor: deletingEvent ? "wait" : "pointer", padding: "9px 24px", borderRadius: 10, fontSize: 13, fontFamily: FONT, color: "#fff", fontWeight: 500, background: deletingEvent ? "rgba(232,67,67,0.15)" : "rgba(232,67,67,0.25)", border: "1px solid rgba(232,67,67,0.4)", opacity: deletingEvent ? 0.5 : 1 }}>
                {deletingEvent ? "Löschen..." : "Event absagen"}
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

function FilesView({ onBack, session, getProviderToken, autoReLogin }) {
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
        const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
        if (!providerToken) {
          if (autoReLogin) { autoReLogin(); return; }
          setError("Kein Google Drive Zugriff. Bitte neu einloggen.");
          setLoading(false);
          return;
        }

        let query = "trashed=false";
        if (currentFolder) {
          query += ` and '${currentFolder}' in parents`;
        } else {
          query += " and 'root' in parents";
        }

        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webViewLink)&orderBy=folder,name&pageSize=50`,
          { headers: { Authorization: `Bearer ${providerToken}` } }
        );

        if (!res.ok) {
          if (res.status === 401) {
            if (autoReLogin) { autoReLogin(); return; }
            setError("Google Drive Token abgelaufen. Bitte neu einloggen.");
          } else {
            setError("Fehler beim Laden der Dateien.");
          }
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

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

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
        const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
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
    const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
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
    const providerToken = getProviderToken ? getProviderToken() : session?.provider_token;
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
        background: "rgba(22, 22, 30, 0.75)",
        backdropFilter: "blur(40px)",
        border: "1px solid rgba(255,255,255,0.08)",
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
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="#8B7AFF" strokeWidth="1.5" fill="none" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: FONT, color: "#ffffff50", overflow: "hidden" }}>
            <span onClick={() => { setCurrentFolder(null); setFolderPath([]); }} style={{ cursor: "pointer", color: "#ffffff60" }}>Drive</span>
            {folderPath.map((fp, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#ffffff25" }}>/</span>
                <span onClick={() => {
                  setCurrentFolder(fp.id);
                  setFolderPath(prev => prev.slice(0, i));
                }} style={{ cursor: "pointer", color: "#ffffff60" }}>{fp.name}</span>
              </span>
            ))}
          </div>
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
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: "10px 14px",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#ffffff40" strokeWidth="1.8" />
              <path d="M16 16l4.5 4.5" stroke="#ffffff40" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files..."
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 13, fontFamily: FONT, color: "#ffffffdd",
                caretColor: "#8B7AFF",
              }}
            />
            {search && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSearch("")}
                style={{ cursor: "pointer", color: "#ffffff40", fontSize: 12, fontFamily: FONT }}
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
              style={{ padding: 40, textAlign: "center", fontSize: 13, fontFamily: FONT, color: "#ffffff40" }}
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
                  background: selectedFile?.id === file.id ? "rgba(139, 122, 255, 0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selectedFile?.id === file.id ? "rgba(139, 122, 255, 0.15)" : "rgba(255,255,255,0.05)"}`,
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
                  <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: "#ffffffdd", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                  <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    {formatFileSize(file.size)} · {getFileExtension(file.name, file.mimeType)}
                    {!isFolder && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 6, background: STATUS_COLORS[status] + "15", color: STATUS_COLORS[status], border: `1px solid ${STATUS_COLORS[status]}30` }}>{status}</span>
                    )}
                  </div>
                </div>
                {/* Arrow for folders */}
                {isFolder && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke="#ffffff30" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </motion.div>
            );
          })}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", fontSize: 13, fontFamily: FONT, color: "#ffffff30" }}>
              {files.length === 0 ? "Dieser Ordner ist leer" : "Keine Dateien gefunden"}
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
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}
            >
              <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40" }}>Status:</span>
                {["Neu", "In Prüfung", "Freigegeben", "Kunden-Sichtbar"].map(s => (
                  <motion.div
                    key={s}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => updateStatus(selectedFile.id, s)}
                    style={{
                      padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                      fontSize: 11, fontFamily: FONT,
                      background: (metadata[selectedFile.id]?.status || "Neu") === s ? STATUS_COLORS[s] + "25" : "rgba(255,255,255,0.03)",
                      color: (metadata[selectedFile.id]?.status || "Neu") === s ? STATUS_COLORS[s] : "#ffffff40",
                      border: `1px solid ${(metadata[selectedFile.id]?.status || "Neu") === s ? STATUS_COLORS[s] + "40" : "rgba(255,255,255,0.05)"}`,
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
                      fontSize: 11, fontFamily: FONT, color: "#8B7AFF",
                      background: "rgba(139,122,255,0.1)", border: "1px solid rgba(139,122,255,0.2)",
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
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}
            >
              <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  style={{ width: 16, height: 16, border: "2px solid rgba(139,122,255,0.3)", borderTop: "2px solid #8B7AFF", borderRadius: "50%" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: FONT, color: "#ffffffcc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Uploading: {uploadProgress.name}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff40", marginTop: 2 }}>
                    {uploadProgress.current} / {uploadProgress.total} Dateien
                  </div>
                </div>
                <div style={{
                  width: 80, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    style={{ height: "100%", background: "#8B7AFF", borderRadius: 2 }}
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
            padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)",
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
                <path d="M15 18l-6-6 6-6" stroke="#ffffff50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff50" }}>Back</span>
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
                  <path d="M15 18l-6-6 6-6" stroke="#ffffff40" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff40" }}>Ordner zurück</span>
              </motion.div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff25", marginRight: 4 }}>
              {filtered.length} {filtered.length === 1 ? "file" : "files"}
            </div>
            {/* New Folder button */}
            <motion.div
              onClick={handleCreateFolder}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: "5px 10px", borderRadius: 8, cursor: "pointer",
                fontSize: 11, fontFamily: FONT, color: "#ffffff60",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="#ffffff50" strokeWidth="1.5" fill="none" />
                <path d="M12 11v4M10 13h4" stroke="#ffffff50" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Neuer Ordner
            </motion.div>
            {/* Upload button */}
            <motion.div
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: "5px 12px", borderRadius: 8, cursor: uploading ? "not-allowed" : "pointer",
                fontSize: 11, fontFamily: FONT, color: uploading ? "#ffffff30" : "#8B7AFF",
                background: uploading ? "rgba(255,255,255,0.02)" : "rgba(139,122,255,0.1)",
                border: `1px solid ${uploading ? "rgba(255,255,255,0.05)" : "rgba(139,122,255,0.2)"}`,
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

const CHAT_CONVERSATIONS = [
  { id: 1, name: "Lena Müller", role: "Design Lead", avatar: "#E88D67", lastMsg: "Updated the brand kit — take a look when you can", time: "2 min", unread: 2 },
  { id: 2, name: "Max Fischer", role: "Developer", avatar: "#5B8DEF", lastMsg: "PR is up for the dashboard refactor", time: "15 min", unread: 0 },
  { id: 3, name: "Sofia Petrov", role: "Strategist", avatar: "#8B7AFF", lastMsg: "Client meeting moved to Thursday 3pm", time: "1h", unread: 1 },
  { id: 4, name: "AI Assistant", role: "Claude", avatar: "#6BC5A0", lastMsg: "Here's the competitive analysis you asked for", time: "2h", unread: 0 },
  { id: 5, name: "Tom Wagner", role: "PM", avatar: "#F59E0B", lastMsg: "Sprint review notes attached", time: "3h", unread: 0 },
  { id: 6, name: "Anna Schmidt", role: "Marketing", avatar: "#E84393", lastMsg: "Campaign draft ready for review", time: "5h", unread: 3 },
  { id: 7, name: "Jonas Beck", role: "Sales", avatar: "#00B894", lastMsg: "New lead from the conference", time: "1d", unread: 0 },
  { id: 8, name: "Clara Hoffmann", role: "Finance", avatar: "#FD79A8", lastMsg: "Q2 budget approved ✓", time: "1d", unread: 0 },
];

const CHAT_TABS = ["Team", "Clients", "AI", "Channels", "Calls", "Archive"];

const CHAT_MESSAGES = {
  1: [
    { id: 1, from: "them", text: "Hey, I just pushed the updated brand kit to the shared drive", time: "10:12" },
    { id: 2, from: "them", text: "New color palette + updated logo variations are in there", time: "10:12" },
    { id: 3, from: "me", text: "Nice! I'll check it out. Did you also update the Figma components?", time: "10:15" },
    { id: 4, from: "them", text: "Yes, everything is synced. The typography scale changed slightly too", time: "10:18" },
    { id: 5, from: "me", text: "Perfect. I'll review and give feedback by EOD", time: "10:20" },
    { id: 6, from: "them", text: "Updated the brand kit — take a look when you can", time: "10:42" },
  ],
  2: [
    { id: 1, from: "them", text: "Dashboard refactor PR is ready for review", time: "09:30" },
    { id: 2, from: "me", text: "Cool, I'll take a look. Any breaking changes?", time: "09:35" },
    { id: 3, from: "them", text: "Nope, just restructured the component tree. Performance is way better now", time: "09:36" },
    { id: 4, from: "them", text: "Also added lazy loading for the chart widgets", time: "09:36" },
    { id: 5, from: "me", text: "Sounds great. I'll test it on staging first", time: "09:40" },
    { id: 6, from: "them", text: "PR is up for the dashboard refactor", time: "09:45" },
  ],
  3: [
    { id: 1, from: "them", text: "Quick update — the Meridian client wants to reschedule", time: "08:00" },
    { id: 2, from: "me", text: "When are they thinking?", time: "08:05" },
    { id: 3, from: "them", text: "Thursday at 3pm works for them", time: "08:06" },
    { id: 4, from: "me", text: "That works. Can you send the updated invite?", time: "08:10" },
    { id: 5, from: "them", text: "Done! Also added the new deck to the agenda", time: "08:15" },
    { id: 6, from: "them", text: "Client meeting moved to Thursday 3pm", time: "08:20" },
  ],
  4: [
    { id: 1, from: "me", text: "Can you analyze our top 3 competitors in the SaaS space?", time: "14:00" },
    { id: 2, from: "them", text: "Of course! I'll look at pricing, features, and market positioning. Give me a moment.", time: "14:01" },
    { id: 3, from: "them", text: "Done. I found some interesting gaps in their onboarding flows we could exploit.", time: "14:08" },
    { id: 4, from: "me", text: "Great, can you summarize the key findings?", time: "14:10" },
    { id: 5, from: "them", text: "Here's the competitive analysis you asked for", time: "14:12" },
  ],
  5: [
    { id: 1, from: "them", text: "Sprint review went well today", time: "16:00" },
    { id: 2, from: "me", text: "Agreed! The team shipped a lot this cycle", time: "16:05" },
    { id: 3, from: "them", text: "Velocity is up 20% compared to last sprint", time: "16:06" },
    { id: 4, from: "them", text: "Sprint review notes attached", time: "16:10" },
  ],
  6: [
    { id: 1, from: "them", text: "The Q2 campaign draft is ready — want to review?", time: "11:00" },
    { id: 2, from: "me", text: "Sure, send it over", time: "11:05" },
    { id: 3, from: "them", text: "It's in the shared folder. Focus is on the product launch narrative", time: "11:06" },
    { id: 4, from: "me", text: "Love the direction. A few notes on the hero section though", time: "11:30" },
    { id: 5, from: "them", text: "Got it, I'll revise. Also the social assets need your sign-off", time: "11:35" },
    { id: 6, from: "them", text: "Campaign draft ready for review", time: "11:40" },
  ],
  7: [
    { id: 1, from: "them", text: "Met a great lead at the Design Systems conference", time: "yesterday" },
    { id: 2, from: "me", text: "Oh nice, what company?", time: "yesterday" },
    { id: 3, from: "them", text: "Nexora — they're scaling their design team and need agency support", time: "yesterday" },
    { id: 4, from: "them", text: "New lead from the conference", time: "yesterday" },
  ],
  8: [
    { id: 1, from: "them", text: "Q2 budget has been approved by finance", time: "yesterday" },
    { id: 2, from: "me", text: "Excellent! Any changes from what we proposed?", time: "yesterday" },
    { id: 3, from: "them", text: "Nope, full amount approved. We can proceed with the new hires", time: "yesterday" },
    { id: 4, from: "them", text: "Q2 budget approved ✓", time: "yesterday" },
  ],
};

function ConversationView({ conversation, onBack }) {
  const [msgInput, setMsgInput] = useState("");
  const messages = CHAT_MESSAGES[conversation.id] || [];
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Header with person info */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <motion.div
          onClick={onBack}
          className="hover-back"
          whileTap={{ scale: 0.95 }}
          style={{ cursor: "pointer", padding: "4px 6px", borderRadius: 8, flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#ffffff50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: `linear-gradient(135deg, ${conversation.avatar}50, ${conversation.avatar}20)`,
          border: `1px solid ${conversation.avatar}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: 13, fontWeight: 600, fontFamily: FONT,
          color: conversation.avatar,
        }}>
          {conversation.name.split(" ").map(n => n[0]).join("")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: "#ffffffdd" }}>{conversation.name}</div>
          <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40" }}>{conversation.role}</div>
        </div>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: "#6BC5A0",
          boxShadow: "0 0 6px #6BC5A040",
        }} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6,
      }}>
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 + i * 0.04, duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{
              display: "flex",
              justifyContent: msg.from === "me" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "75%",
              padding: "10px 14px",
              borderRadius: msg.from === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.from === "me"
                ? "rgba(139, 122, 255, 0.15)"
                : "rgba(255,255,255,0.06)",
              border: `1px solid ${msg.from === "me" ? "rgba(139, 122, 255, 0.2)" : "rgba(255,255,255,0.06)"}`,
              fontSize: 13, fontFamily: FONT, color: "#ffffffcc",
              lineHeight: 1.5,
            }}>
              {msg.text}
              <div style={{
                fontSize: 10, fontFamily: FONT, color: "#ffffff30",
                marginTop: 4, textAlign: msg.from === "me" ? "right" : "left",
              }}>{msg.time}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Message input */}
      <div style={{
        padding: "12px 20px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: "10px 14px",
        }}>
          <input
            value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            placeholder={`Message ${conversation.name.split(" ")[0]}...`}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 13, fontFamily: FONT, color: "#ffffffdd",
              caretColor: "#8B7AFF",
            }}
          />
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: msgInput.trim() ? "rgba(139, 122, 255, 0.3)" : "rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: msgInput.trim() ? "pointer" : "default",
              transition: "background 0.2s ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke={msgInput.trim() ? "#8B7AFF" : "#ffffff30"} strokeWidth="2" strokeLinecap="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={msgInput.trim() ? "#8B7AFF" : "#ffffff30"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function ChatView({ onBack, initialTab = "Team" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [activeConversation, setActiveConversation] = useState(null);
  const filtered = CHAT_CONVERSATIONS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.lastMsg.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 10, filter: "blur(4px)" }}
      transition={{ duration: 0.45, ease: [0.22, 0.68, 0.35, 1.0] }}
      style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: 40,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 680, maxHeight: "85%",
        background: "rgba(22, 22, 30, 0.75)",
        backdropFilter: "blur(40px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <AnimatePresence mode="wait">
          {activeConversation ? (
            <ConversationView
              key="conversation"
              conversation={activeConversation}
              onBack={() => setActiveConversation(null)}
            />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
            >
              {/* Tabs */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.3 }}
                style={{
                  padding: "16px 20px 0",
                  display: "flex", gap: 4, overflowX: "auto",
                }}
              >
                {CHAT_TABS.map(tab => (
                  <motion.div
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: "8px 16px", borderRadius: 12, cursor: "pointer",
                      fontSize: 12, fontFamily: FONT, fontWeight: 500, letterSpacing: 0.3,
                      background: activeTab === tab ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                      color: activeTab === tab ? "#ffffffdd" : "#ffffff50",
                      border: `1px solid ${activeTab === tab ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}`,
                      transition: "all 0.25s ease",
                      whiteSpace: "nowrap",
                    }}
                  >{tab}</motion.div>
                ))}
              </motion.div>

              {/* Search bar */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                style={{ padding: "12px 20px 8px" }}
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14, padding: "10px 14px",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="#ffffff40" strokeWidth="1.8" />
                    <path d="M16 16l4.5 4.5" stroke="#ffffff40" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search conversations..."
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      fontSize: 13, fontFamily: FONT, color: "#ffffffdd",
                      caretColor: "#8B7AFF",
                    }}
                  />
                  {search && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setSearch("")}
                      style={{ cursor: "pointer", color: "#ffffff40", fontSize: 12, fontFamily: FONT }}
                    >✕</motion.div>
                  )}
                </div>
              </motion.div>

              {/* Conversation list — scrollable */}
              <div style={{
                padding: "4px 20px 12px", display: "flex", flexDirection: "column", gap: 4,
                overflowY: "auto", flex: 1, minHeight: 0,
              }}>
                {filtered.map((conv, i) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.04, duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
                    className="hover-row"
                    onClick={() => setActiveConversation(conv)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 14px", borderRadius: 14,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${conv.avatar}50, ${conv.avatar}20)`,
                      border: `1px solid ${conv.avatar}40`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, fontSize: 15, fontWeight: 600, fontFamily: FONT,
                      color: conv.avatar,
                    }}>
                      {conv.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: "#ffffffdd", lineHeight: 1.3 }}>{conv.name}</div>
                        <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff35", flexShrink: 0 }}>{conv.time}</div>
                      </div>
                      <div style={{
                        fontSize: 12, fontFamily: FONT, color: "#ffffff50", marginTop: 3,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{conv.lastMsg}</div>
                    </div>
                    {/* Unread badge */}
                    {conv.unread > 0 && (
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: "#8B7AFF", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 600, fontFamily: FONT, color: "#fff", flexShrink: 0,
                      }}>{conv.unread}</div>
                    )}
                  </motion.div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding: 32, textAlign: "center", fontSize: 13, fontFamily: FONT, color: "#ffffff30" }}>
                    No conversations found
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                style={{
                  padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
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
                    <path d="M15 18l-6-6 6-6" stroke="#ffffff50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff50" }}>Back</span>
                </motion.div>
                {/* New chat button */}
                <motion.div
                  className="hover-back"
                  whileTap={{ scale: 0.95 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                    padding: "6px 14px", borderRadius: 10,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="#ffffff50" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 12, fontFamily: FONT, color: "#ffffff50" }}>New Chat</span>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("agencyos-dark-mode");
    return saved !== null ? JSON.parse(saved) : true; // default dark
  });
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
    text: "#1a1a2eCC",
    textDim: "#1a1a2e60",
    textFaint: "#1a1a2e30",
    textSub: "#1a1a2e80",
    border: "rgba(0,0,0,0.1)",
    borderFaint: "rgba(0,0,0,0.06)",
    hoverBg: "rgba(0,0,0,0.04)",
    overlay: "rgba(255,255,255,0.5)",
    accent: "#6C5CE7",
    accentBg: "rgba(108,92,231,0.1)",
    accentBorder: "rgba(108,92,231,0.3)",
    svgFill: "#1a1a2e",
    svgStroke: "#1a1a2e80",
    iconColor: "#555555",
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

  // Derive user info from session (Google profile) or fallback to localStorage
  const userName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || localStorage.getItem("agencyos-name") || "";
  const userAvatar = session?.user?.user_metadata?.avatar_url || null;
  const userEmail = session?.user?.email || "";

  // Helper: get Google provider token (session or localStorage fallback)
  const getProviderToken = useCallback(() => {
    return session?.provider_token || localStorage.getItem("agencyos-google-token") || null;
  }, [session]);

  // Listen for auth state changes — persist provider_token when available
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.provider_token) {
        localStorage.setItem("agencyos-google-token", s.provider_token);
      }
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.provider_token) {
        localStorage.setItem("agencyos-google-token", s.provider_token);
      }
      setSession(s);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
      },
    });
    if (error) setAuthError(error.message);
  };

  // Auto re-login: saves current view state, then silently redirects to Google OAuth
  // Since user already authorized the app, no consent screen is shown — just a quick redirect back
  const autoReLogin = useCallback(async () => {
    // Cooldown: don't redirect if we already tried in the last 30 seconds (prevents loops)
    const lastAttempt = localStorage.getItem("agencyos-relogin-ts");
    if (lastAttempt && Date.now() - parseInt(lastAttempt) < 30000) {
      console.warn("Token refresh cooldown active, skipping auto re-login");
      return;
    }
    localStorage.setItem("agencyos-relogin-ts", String(Date.now()));
    // Save current view so we return to it after redirect
    localStorage.setItem("agencyos-return-state", JSON.stringify({ view: currentView, timestamp: Date.now() }));
    localStorage.removeItem("agencyos-google-token");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
      },
    });
  }, [currentView]);

  const handleLogout = async () => {
    localStorage.removeItem("agencyos-google-token");
    await supabase.auth.signOut();
    setSession(null);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return "Still up";
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    if (h < 21) return "Good Evening";
    return "Good Night";
  };
  const [voiceMode, setVoiceMode] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [weather, setWeather] = useState("–");
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current_weather=true&temperature_unit=celsius`
        );
        const data = await res.json();
        setWeather(Math.round(data.current_weather.temperature));
      } catch { /* keep dash */ }
    }, () => { /* permission denied — keep dash */ });
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

  // Start voice recording with Web Speech API
  const startVoice = () => {
    setMenuOpen(false);
    setSubOpen(false);
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
      recognition.lang = "en-US";
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        let final = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        setTranscript(final + interim);
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
    
    setVoiceMode(false);
    setAiSpeaking(true);
    setAiStatus("thinking");
    aiStoppedRef.current = false;

    const userMessage = transcript || "Hello, what can you help me with?";

    try {
      // Call Claude via Vercel serverless function (or Artifact proxy as fallback)
      let data;
      try {
        // Try local API route first (Vercel deployment)
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
        });
        data = await response.json();
      } catch (proxyErr) {
        // Fallback: direct API call (works in Claude Artifact environment)
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 200,
            system: "You are the AI assistant inside Agency OS, a creative agency workspace app. Keep responses short (1-3 sentences), friendly, and helpful. Always respond in English. Never use emojis. You know about brand strategy, design, project management, and creative work.",
            messages: [{ role: "user", content: userMessage }],
          }),
        });
        data = await response.json();
      }
      const aiText = data.content?.[0]?.text || "I'm here to help with your creative projects.";
      setAiResponse(aiText);
      setAiStatus("speaking");

      // Try Fish Audio first, fallback to browser synthesis
      if (aiStoppedRef.current) return;
      try {
        const ttsResponse = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: aiText }),
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
            setTimeout(() => { if (!aiStoppedRef.current) { setAiSpeaking(false); setAiStatus(""); setAiResponse(""); setTranscript(""); } }, 800);
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
      setAiResponse("I'm having trouble connecting. Try again in a moment.");
      setAiStatus("speaking");
      setTimeout(() => { setAiSpeaking(false); setAiStatus(""); setAiResponse(""); setTranscript(""); }, 3000);
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
        if (!aiStoppedRef.current) setTimeout(() => { setAiSpeaking(false); setAiStatus(""); setAiResponse(""); setTranscript(""); }, 800);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      // No speech — just estimate ~150 words/min
      const words = text.split(/\s+/).filter(Boolean);
      const estimatedDuration = (words.length / 150) * 60;
      startKaraokeHighlight(text, Math.max(estimatedDuration, 3));
      setTimeout(() => { if (!aiStoppedRef.current) { stopKaraokeHighlight(); setAiSpeaking(false); setAiStatus(""); setAiResponse(""); setTranscript(""); } }, Math.max(estimatedDuration * 1000, 3000) + 800);
    }
  };

  const aiStoppedRef = useRef(false);

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
    // Let views with their own scrolling (files, chat) handle scroll natively
    if (currentView === "files" || currentView === "chat" || currentView === "kanban" || currentView === "calendar") {
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
    if (!menuOpen) { setMenuOpen(true); setSubOpen(false); setSubHover(-1); try { sounds.menuOpen(); } catch(e) {} return; }
    if (menuOpen && !subOpen) { setSubOpen(true); setSubHover(-1); try { sounds.subOpen(); } catch(e) {} return; }
    if (subOpen) { setSubOpen(false); try { sounds.menuClose(); } catch(e) {} return; }
  };

  const handleSubClick = (subItem) => {
    try { sounds.subSelect(); } catch(e) {}
    setSubOpen(false);
    setMenuOpen(false);
    setSubHover(-1);

    if (subItem.id === "kanban") {
      setCurrentView("kanban");
    } else if (subItem.id === "calendar") {
      setCurrentView("calendar");
    } else if (["images", "videos", "all", "fonts", "raw", "links"].includes(subItem.id)) {
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
      userSelect: "none", borderRadius: 12, transition: "background-color 0.4s ease",
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
              >Welcome to Agency OS</motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                style={{ fontSize: 14, color: "#ffffff40", fontFamily: FONT, marginBottom: 40 }}
              >Sign in to access your workspace</motion.div>

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
                Sign in with Google
              </motion.button>

              {authError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ marginTop: 20, fontSize: 13, color: "#E84393", fontFamily: FONT, textAlign: "center", maxWidth: 300 }}
                >{authError}</motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                style={{ marginTop: 48, fontSize: 11, color: "#ffffff20", fontFamily: FONT, textAlign: "center", lineHeight: 1.6 }}
              >Your data stays private and secure</motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Weather — on dashboard & files */}
      <AnimatePresence>
        {(currentView === "dashboard" || currentView === "files" || currentView === "chat") && !panelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
            style={{
              position: "absolute", top: 16, right: 24, display: "flex", alignItems: "center",
              fontSize: 20, color: "#79787D", zIndex: 10, fontFamily: FONT, fontWeight: 400, gap: 12,
            }}
          >
            {weather}°
            <svg width="24" height="19" viewBox="0 0 20 16" fill="none">
              <path opacity="0.7" d="M9 2C11.6123 2 13.8334 3.66984 14.6572 6H15C17.7614 6 20 8.23858 20 11C20 13.7614 17.7614 16 15 16H4.5C2.01472 16 0 13.9853 0 11.5C0 9.5226 1.27576 7.84409 3.04883 7.24023C3.4223 4.2853 5.9437 2 9 2ZM15 0C17.7614 0 20 2.23858 20 5C20 5.48668 19.9285 5.95656 19.7988 6.40137C18.7997 5.07171 17.2622 4.16972 15.5088 4.02246C14.883 2.57436 13.7037 1.42135 12.2373 0.831055C13.0287 0.305544 13.9788 0 15 0Z" fill="#79787D"/>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification */}
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
            <KanbanBoard session={session} onBack={() => setCurrentView("dashboard")} />
          )}
        </AnimatePresence>

        {/* CALENDAR VIEW */}
        <AnimatePresence>
          {currentView === "calendar" && (
            <CalendarView session={session} getProviderToken={getProviderToken} openMeetCall={openMeetCall} autoReLogin={autoReLogin} onBack={() => setCurrentView("dashboard")} />
          )}
        </AnimatePresence>

        {/* FILES VIEW */}
        <AnimatePresence>
          {currentView === "files" && (
            <FilesView session={session} getProviderToken={getProviderToken} autoReLogin={autoReLogin} onBack={() => {
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
                }}>{getGreeting()}, {(userName || "").split(" ")[0] || "there"}</div>
                <div style={{
                  fontSize: 43, fontWeight: 400, color: theme.textDim,
                  fontFamily: FONT, letterSpacing: -0.5, lineHeight: 1.3,
                }}>What would you like to do?</div>
              </div>

              {/* Tasks */}
              <div style={{
                display: "flex", flexDirection: "column", gap: 10,
                maxWidth: 720, alignSelf: "center", width: "100%",
                marginTop: "auto", marginBottom: 100,
              }}>
                {[
                  { icon: "🎨", iconBg: "#2D7A6A", name: "Figma", desc: "Complete the Dashboard Design", key: "F" },
                  { icon: "🤖", iconBg: "#C4624A", name: "Claude Code", desc: "Build the new app idea", key: "2" },
                  { icon: "👤", iconBg: "#5A7AB5", name: "Reply to Tom Behrens over Gmail", desc: null, key: "G" },
                  { icon: "✦", iconBg: "#4A9A8A", name: "Research with Perplexity", desc: null, key: "P" },
                ].map((task, i) => (
                  <motion.div
                    key={task.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 0.68, 0.35, 1.0], delay: 0.15 + i * 0.06 }}
                    className="hover-row"
                    style={{
                      display: "flex", alignItems: "center", gap: 18,
                      padding: "16px 24px", borderRadius: 18,
                      background: task.desc ? theme.hoverBg : "transparent",
                      border: task.desc ? `1px solid ${theme.borderFaint}` : "1px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 50, height: 50, borderRadius: "50%",
                      background: task.iconBg, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 22, flexShrink: 0,
                    }}>{task.icon}</div>
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
                      }}>{task.key}</span>
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
                  fontSize: 13, fontFamily: FONT, color: "#ffffff50",
                  letterSpacing: 2, marginBottom: 24, fontWeight: 400,
                }}
              >LISTENING...</motion.div>

              <WaveformEqualizer />

              {/* Live transcript */}
              <AnimatePresence>
                {transcript && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      fontSize: 15, fontFamily: FONT, color: "#ffffffAA",
                      fontWeight: 400, textAlign: "center", maxWidth: 400,
                      marginTop: 28, lineHeight: 1.5, padding: "0 20px",
                    }}
                  >{transcript}</motion.div>
                )}
              </AnimatePresence>

              <div style={{
                fontSize: 11, fontFamily: FONT, color: "#ffffff25",
                letterSpacing: 1.5, marginTop: 20,
              }}>CLICK TO SEND</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI SPEAKING VIEW — sphere animates in center */}
        <AnimatePresence>
          {aiSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 100, damping: 18, mass: 0.8 }}
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
                  fontSize: 11, fontFamily: FONT, color: "#ffffff40",
                  letterSpacing: 2, marginBottom: 20, fontWeight: 400,
                }}
              >{aiStatus === "thinking" ? "THINKING..." : ""}</motion.div>

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
                <AISpeakingSphere />
              </motion.div>
              {aiStatus === "speaking" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                  style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff25", letterSpacing: 2, marginTop: 10 }}>
                  CLICK TO STOP
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
                          color: isSpoken ? "#ffffffE6" : "#ffffff30",
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
                    background: isHovered ? (darkMode ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.85)") : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                    borderColor: isHovered ? (darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)") : (darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"),
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
              }}
            >
              <svg width={200} height={200}>
                <circle cx={100} cy={100} r={95} fill="none" stroke={COLORS.ringInactive} strokeWidth={1.5} />
              </svg>
            </motion.div>
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
                background: COLORS.bg, zIndex: 4, pointerEvents: "none",
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
                position: "relative", zIndex: 5,
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
                    fontSize: 14, fontWeight: 500, color: COLORS.text, letterSpacing: 5,
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
              background: "linear-gradient(180deg, transparent 0%, #111117 6%)",
              paddingTop: 32, zIndex: 25, overflowY: "hidden",
            }}
          >
            {/* Drag handle */}
            <div onClick={() => setPanelOpen(false)} style={{ width: 36, height: 4, borderRadius: 2, background: "#ffffff18", margin: "0 auto 24px", cursor: "pointer" }} />

            <div style={{ padding: "0 40px 120px", display: "flex", flexDirection: "column", gap: 28 }}>

              {/* Stats row */}
              <div>
                <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>Übersicht</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { label: "Offen", value: "8", color: "#8B7AFF" },
                    { label: "In Arbeit", value: "3", color: "#F59E0B" },
                    { label: "Heute fertig", value: "2", color: "#00B894" },
                    { label: "Nachrichten", value: "4", color: "#E84393" },
                  ].map((stat, i) => (
                    <motion.div key={stat.label}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                      style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "#16161E", border: "1px solid #ffffff0A" }}
                    >
                      <div style={{ fontSize: 26, fontWeight: 300, fontFamily: FONT, color: stat.color, lineHeight: 1, marginBottom: 5 }}>{stat.value}</div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40" }}>{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Active projects */}
              <div>
                <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>Aktive Projekte</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { name: "Meridian", progress: 68, color: "#8B7AFF", tasks: "12 Tasks" },
                    { name: "Volta", progress: 34, color: "#00B894", tasks: "7 Tasks" },
                    { name: "Rebranding", progress: 90, color: "#F59E0B", tasks: "3 Tasks" },
                  ].map((proj, i) => (
                    <motion.div key={proj.name}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.06, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                      style={{ flex: 1, padding: "16px 18px", borderRadius: 14, background: "#16161E", border: "1px solid #ffffff0A", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontFamily: FONT, color: "#ffffffCC", fontWeight: 500 }}>{proj.name}</div>
                        <div style={{ fontSize: 12, fontFamily: FONT, color: proj.color }}>{proj.progress}%</div>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: "#ffffff0A", marginBottom: 8 }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${proj.progress}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: [0.22, 0.68, 0.35, 1.0] }} style={{ height: "100%", borderRadius: 2, background: proj.color }} />
                      </div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff30" }}>{proj.tasks}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Activity feed */}
              <div>
                <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>Aktivität</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[
                    { icon: "◆", color: "#8B7AFF", title: "AI completed competitor analysis", time: "2 min ago", sub: "Meridian — 8 insights ready" },
                    { icon: "✓", color: "#00B894", title: "Brand guidelines v1 marked done", time: "18 min ago", sub: "Sandro · Meridian project" },
                    { icon: "◎", color: "#F59E0B", title: "New message from Maria", time: "34 min ago", sub: "#brand-refresh channel" },
                    { icon: "⏱", color: "#ffffff50", title: "Time tracked: Logo exploration", time: "1h ago", sub: "4h 30m logged today" },
                  ].map((item, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.06, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", borderRadius: 12, cursor: "pointer" }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: item.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: item.color }}>{item.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontFamily: FONT, color: "#ffffffCC", fontWeight: 400 }}>{item.title}</div>
                        <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", marginTop: 2 }}>{item.sub}</div>
                      </div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff25" }}>{item.time}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div>
                <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>Quick Actions</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { label: "New Task", icon: "＋", color: "#8B7AFF" },
                    { label: "Ask AI", icon: "✦", color: "#E84393" },
                    { label: "New Doc", icon: "◻", color: "#00B894" },
                    { label: "Schedule", icon: "◷", color: "#F59E0B" },
                  ].map((action, i) => (
                    <motion.div key={action.label}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.3, ease: [0.22, 0.68, 0.35, 1.0] }}
                      whileHover={{ scale: 1.04, background: "#1E1E28" }}
                      whileTap={{ scale: 0.97 }}
                      style={{ flex: 1, padding: "14px 12px", borderRadius: 14, background: "#16161E", border: "1px solid #ffffff0A", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                    >
                      <div style={{ fontSize: 18, color: action.color }}>{action.icon}</div>
                      <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff60" }}>{action.label}</div>
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
              background: "linear-gradient(0deg, transparent 0%, #111117 6%)",
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
                  <div style={{ fontSize: 10, fontFamily: FONT, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Deine Aufgaben</div>
                  <div style={{ fontSize: 28, fontFamily: FONT, color: "#ffffffCC", fontWeight: 300 }}>Was steht an</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { label: "Heute", count: 5, active: true },
                    { label: "Morgen", count: 3, active: false },
                    { label: "Woche", count: 12, active: false },
                  ].map(f => (
                    <div key={f.label} style={{
                      padding: "6px 14px", borderRadius: 10, cursor: "pointer",
                      background: f.active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${f.active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}`,
                      fontSize: 12, fontFamily: FONT, color: f.active ? "#ffffffdd" : "#ffffff50",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {f.label}
                      <span style={{ fontSize: 10, color: f.active ? "#8B7AFF" : "#ffffff30" }}>{f.count}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Task sections */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0 }}>

                {/* Priority / Überfällig */}
                <div>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    style={{ fontSize: 10, fontFamily: FONT, color: "#E8436380", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E84393" }} />
                    Priorität
                  </motion.div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { task: "Client-Präsentation finalisieren", project: "Meridian", due: "Überfällig", color: "#E84393", icon: "◆" },
                      { task: "Feedback von Lena einarbeiten", project: "Brand Refresh", due: "Heute, 14:00", color: "#E84393", icon: "◎" },
                    ].map((t, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                        className="hover-row"
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "13px 16px", borderRadius: 14,
                          background: "rgba(232, 67, 147, 0.04)",
                          border: "1px solid rgba(232, 67, 147, 0.1)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${t.color}60`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 9, color: t.color }}>{t.icon}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontFamily: FONT, color: "#ffffffCC", fontWeight: 400 }}>{t.task}</div>
                          <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff35", marginTop: 2 }}>{t.project}</div>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: FONT, color: t.color + "90", flexShrink: 0 }}>{t.due}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Heute */}
                <div>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    style={{ fontSize: 10, fontFamily: FONT, color: "#F59E0B80", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B" }} />
                    Heute
                  </motion.div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { task: "Dashboard Komponenten bauen", project: "Agency OS", due: "15:00", color: "#F59E0B", icon: "◻" },
                      { task: "Meeting mit Tom vorbereiten", project: "Volta", due: "16:30", color: "#F59E0B", icon: "◷" },
                      { task: "Social Media Assets exportieren", project: "Brand Refresh", due: "18:00", color: "#F59E0B", icon: "▲" },
                    ].map((t, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.22 + i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                        className="hover-row"
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "13px 16px", borderRadius: 14,
                          background: "rgba(255,255,255,0.025)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: "1.5px solid #ffffff20", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 9, color: "#ffffff40" }}>{t.icon}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontFamily: FONT, color: "#ffffffCC", fontWeight: 400 }}>{t.task}</div>
                          <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff35", marginTop: 2 }}>{t.project}</div>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff40", flexShrink: 0 }}>{t.due}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Geplant */}
                <div>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    style={{ fontSize: 10, fontFamily: FONT, color: "#8B7AFF80", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8B7AFF" }} />
                    Geplant
                  </motion.div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { task: "Wireframes für Onboarding Flow", project: "Meridian", due: "Morgen", color: "#8B7AFF", icon: "◆" },
                      { task: "Design Review vorbereiten", project: "Volta", due: "Mi", color: "#8B7AFF", icon: "◎" },
                      { task: "Competitor Analysis abschließen", project: "Strategy", due: "Do", color: "#8B7AFF", icon: "✦" },
                    ].map((t, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.32 + i * 0.05, duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
                        className="hover-row"
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "13px 16px", borderRadius: 14,
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.04)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: "1.5px solid #ffffff15", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 9, color: "#ffffff30" }}>{t.icon}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontFamily: FONT, color: "#ffffff90", fontWeight: 400 }}>{t.task}</div>
                          <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff25", marginTop: 2 }}>{t.project}</div>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: FONT, color: "#ffffff30", flexShrink: 0 }}>{t.due}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Drag handle at bottom */}
            <div onClick={() => setTasksOpen(false)} style={{ width: 36, height: 4, borderRadius: 2, background: "#ffffff18", margin: "24px auto 0", cursor: "pointer" }} />
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

      {/* Profile / Settings Panel */}
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setProfileOpen(false)}
            style={{
              position: "absolute", inset: 0, zIndex: 90,
              background: theme.overlay,
              backdropFilter: "blur(8px)",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.22, 0.68, 0.35, 1.0] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", bottom: 80, left: 24,
                width: 320,
                background: theme.cardBg,
                backdropFilter: "blur(40px)",
                border: `1px solid ${theme.border}`,
                borderRadius: 20, overflow: "hidden",
              }}
            >
              {/* Profile header */}
              <div style={{ padding: "24px 24px 20px", borderBottom: `1px solid ${theme.borderFaint}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {userAvatar ? (
                    <img src={userAvatar} alt="" referrerPolicy="no-referrer" style={{ width: 48, height: 48, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)" }} />
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: "linear-gradient(135deg, #8B7AFF, #6C5CE7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontFamily: FONT, color: "#fff", fontWeight: 600,
                    }}>{(userName || "?")[0]}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontFamily: FONT, fontWeight: 600, color: theme.text, lineHeight: 1.3 }}>
                      {userName || "User"}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: FONT, color: theme.textDim, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {userEmail}
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings items */}
              <div style={{ padding: "8px 8px" }}>
                {/* Appearance — Dark/Light toggle */}
                <motion.div
                  whileHover={{ backgroundColor: theme.hoverBg }}
                  onClick={() => setDarkMode(!darkMode)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                  }}
                >
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
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text }}>Appearance</div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 1 }}>{darkMode ? "Dark Mode" : "Light Mode"}</div>
                  </div>
                  {/* Toggle switch */}
                  <div onClick={(e) => { e.stopPropagation(); setDarkMode(!darkMode); }} style={{
                    width: 40, height: 22, borderRadius: 11, padding: 2,
                    background: darkMode ? "rgba(139,122,255,0.5)" : "rgba(0,0,0,0.15)",
                    cursor: "pointer", transition: "background 0.3s ease",
                    display: "flex", alignItems: "center",
                  }}>
                    <motion.div
                      animate={{ x: darkMode ? 18 : 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      style={{
                        width: 18, height: 18, borderRadius: 9,
                        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                </motion.div>

                {/* Language */}
                <motion.div
                  whileHover={{ backgroundColor: theme.hoverBg }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke={theme.svgStroke} strokeWidth="1.5" />
                    <path d="M3 12h18M12 3c-2.5 3-3.5 6-3.5 9s1 6 3.5 9M12 3c2.5 3 3.5 6 3.5 9s-1 6-3.5 9" stroke={theme.svgStroke} strokeWidth="1.5" />
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text }}>Language</div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 1 }}>Deutsch / English</div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint }}>Coming soon</div>
                </motion.div>

                {/* Notifications */}
                <motion.div
                  whileHover={{ backgroundColor: theme.hoverBg }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zM18 16v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" stroke={theme.svgStroke} strokeWidth="1.5" fill="none" />
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text }}>Notifications</div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 1 }}>Push & Sound</div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint }}>Coming soon</div>
                </motion.div>

                {/* Connected Apps */}
                <motion.div
                  whileHover={{ backgroundColor: theme.hoverBg }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={theme.svgStroke} strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={theme.svgStroke} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: FONT, color: theme.text }}>Connected Apps</div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textDim, marginTop: 1 }}>Google, Slack, LLMs</div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: FONT, color: theme.textFaint }}>Coming soon</div>
                </motion.div>
              </div>

              {/* Logout */}
              <div style={{ padding: "4px 8px 12px", borderTop: `1px solid ${theme.borderFaint}` }}>
                <motion.div
                  onClick={() => { handleLogout(); setProfileOpen(false); }}
                  whileHover={{ backgroundColor: "rgba(232, 67, 67, 0.08)" }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                    marginTop: 4,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="#E84343" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M16 17l5-5-5-5M21 12H9" stroke="#E84343" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 13, fontFamily: FONT, color: "#E84343", fontWeight: 500 }}>Logout</span>
                </motion.div>
              </div>

              {/* Version */}
              <div style={{ padding: "0 24px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontFamily: FONT, color: theme.textFaint }}>Agency OS v0.1.0</div>
              </div>
            </motion.div>
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
            onClick={() => setProfileOpen(!profileOpen)}
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
              if (currentView !== "dashboard") { setCurrentView("dashboard"); return; }
              if (menuOpen && menuSource === "grid") { handleClose(); } else { setMenuSource("grid"); setActiveIndex(0); try { sounds.menuOpen(); } catch(e) {} setMenuOpen(true); setSubOpen(false); }
            }}
            style={{ cursor: "pointer" }}>
            <svg width="50" height="50" viewBox="0 0 52 52" fill="none">
              <motion.rect x="0.6" y="0.6" width="50.4" height="50.4" rx="25.2" stroke="white"
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
              if (menuOpen && menuSource === "plus") { handleClose(); } else { setMenuSource("plus"); setActiveIndex(0); try { sounds.menuOpen(); } catch(e) {} setMenuOpen(true); setSubOpen(false); }
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
            <AISphere />
          </div>
        </div>
      </div>

      <style>{`
        .hover-row {
          transition: background 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-row:hover {
          background: rgba(255,255,255,0.07) !important;
          border-color: rgba(255,255,255,0.10) !important;
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
    </div>
  );
}
