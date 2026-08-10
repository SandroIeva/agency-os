// Operator overview at /?admin — signups, workspaces and who belongs to which.
//
// Standalone route rather than a tab inside the app: it is not a product
// feature, and keeping it out of App.jsx means it can never be reached by
// wandering through the UI. Access is enforced server-side in api/admin-stats.js
// (session + ADMIN_USER_IDS); this page only renders what that endpoint returns,
// so hiding or showing it in the client is never the security boundary.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

const FONT = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const BG = "#0f0f14";
const CARD = "#17171f";
const LINE = "rgba(255,255,255,0.09)";
const TEXT = "#ffffffDD";
const DIM = "#ffffff8A";
const FAINT = "#ffffff55";

const fmtMB = (mb) => {
  const n = Number(mb) || 0;
  return n >= 1024 ? (n / 1024).toFixed(1) + " GB" : n.toFixed(1) + " MB";
};

function Tile({ label, value, hint }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: FAINT, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: TEXT, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: FAINT, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Table({ columns, rows, empty }) {
  if (!rows.length) {
    return <div style={{ padding: 22, color: DIM, fontSize: 13, textAlign: "center" }}>{empty}</div>;
  }
  return (
    // Its own horizontal scroller: a wide table must never make the page scroll
    // sideways.
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: c.right ? "right" : "left", padding: "10px 12px",
                color: FAINT, fontWeight: 600, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase",
                borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map(c => (
                <td key={c.key} style={{ padding: "11px 12px", color: c.dim ? DIM : TEXT,
                  borderBottom: `1px solid rgba(255,255,255,0.05)`, textAlign: c.right ? "right" : "left",
                  whiteSpace: c.wrap ? "normal" : "nowrap" }}>
                  {c.render ? c.render(r) : (r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminView() {
  const [state, setState] = useState({ status: "loading" });
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  // Takes the session as an argument instead of fetching it. Calling
  // supabase.auth.getSession() from inside an onAuthStateChange callback
  // deadlocks — the callback holds the auth lock and getSession() waits for the
  // same one, so the promise never settles and the page sits on "Lädt …"
  // forever. The callback already hands us the session; use that.
  const load = useCallback(async (session) => {
    if (!session?.access_token) { setState({ status: "anon" }); return; }
    try {
      const r = await fetch("/api/admin-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setState({ status: "anon" }); return; }
      if (r.status === 403) { setState({ status: "forbidden" }); return; }
      if (!r.ok) { setState({ status: "error", message: j.error || `HTTP ${r.status}` }); return; }
      setState({ status: "ready", data: j });
    } catch (e) {
      setState({ status: "error", message: e?.message || "Netzwerkfehler" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Initial read happens OUTSIDE any auth callback, so it's safe here.
    supabase.auth.getSession().then(({ data }) => { if (!cancelled) load(data?.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) load(session);
    });
    return () => { cancelled = true; sub?.subscription?.unsubscribe(); };
  }, [load]);

  const signIn = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/?admin` },
    });
    setSent(true);
  };

  const shell = (children) => (
    // The document itself cannot scroll: index.html pins the body to
    // overflow:hidden for the main app's full-screen layout, and this view is a
    // sibling route inside that same body. With minHeight the tables simply grew
    // past the bottom of the window with no way to reach them. So this view
    // scrolls itself instead of changing a rule the rest of the app relies on.
    <div style={{ height: "100vh", overflowY: "auto", background: BG, color: TEXT, fontFamily: FONT, padding: "38px 26px 60px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>{children}</div>
    </div>
  );

  if (state.status === "loading") return shell(<div style={{ color: DIM, fontSize: 14 }}>Lädt …</div>);

  if (state.status === "anon") {
    return shell(
      <div style={{ maxWidth: 380, margin: "12vh auto 0" }}>
        <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Interne Übersicht</div>
        <div style={{ fontSize: 13, color: DIM, marginBottom: 20, lineHeight: 1.55 }}>
          Anmeldung erforderlich. Du bekommst einen Login-Link per E-Mail.
        </div>
        {sent ? (
          <div style={{ fontSize: 13, color: DIM }}>Link verschickt — schau in dein Postfach.</div>
        ) : (
          <form onSubmit={signIn} style={{ display: "flex", gap: 8 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="deine@email.com"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${LINE}`,
                background: "rgba(255,255,255,0.04)", color: TEXT, fontSize: 13, fontFamily: FONT, outline: "none" }} />
            <button type="submit" style={{ padding: "10px 16px", borderRadius: 10, border: "none",
              background: "rgba(244,244,247,0.95)", color: "#15151c", fontSize: 13, fontWeight: 600,
              fontFamily: FONT, cursor: "pointer" }}>Login</button>
          </form>
        )}
      </div>
    );
  }

  if (state.status === "forbidden") {
    return shell(
      <div style={{ maxWidth: 460, margin: "12vh auto 0" }}>
        <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Kein Zugriff</div>
        <div style={{ fontSize: 13, color: DIM, lineHeight: 1.55 }}>
          Dieses Konto ist nicht für die interne Übersicht freigeschaltet.
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return shell(
      <div style={{ maxWidth: 460, margin: "12vh auto 0" }}>
        <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Fehler</div>
        <div style={{ fontSize: 13, color: "#E86767", lineHeight: 1.55 }}>{state.message}</div>
      </div>
    );
  }

  const { summary: s, workspaces, users, generatedAt } = state.data;

  return shell(
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>i7 OS — Interne Übersicht</div>
        {/* Fetches the session first — load() no longer looks it up itself.
            Safe outside an auth callback, which a click always is. */}
        <button onClick={() => { setState({ status: "loading" }); supabase.auth.getSession().then(({ data }) => load(data?.session)); }}
          style={{ padding: "7px 13px", borderRadius: 9, border: `1px solid ${LINE}`, background: "transparent",
            color: DIM, fontSize: 12.5, fontFamily: FONT, cursor: "pointer" }}>Aktualisieren</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: 12, marginBottom: 30 }}>
        <Tile label="Nutzer" value={s.nutzer_gesamt} hint={`${s.neu_7_tage} neu in 7 Tagen`} />
        <Tile label="Aktiv (7 Tage)" value={s.aktiv_7_tage} />
        {/* The drop-off between signing up and actually starting — the number
            nothing else in the product surfaces. */}
        <Tile label="Ohne Workspace" value={s.ohne_workspace} hint={`davon ${s.nie_eingeloggt} nie eingeloggt`} />
        <Tile label="Workspaces" value={s.workspaces} />
        <Tile label="Zahlende Kunden" value={s.zahlende_kunden} hint={`${s.im_trial} im Trial`} />
        <Tile label="Speicher" value={fmtMB(s.speicher_mb_gesamt)} />
      </div>

      <div style={{ fontSize: 12, color: FAINT, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 10 }}>Workspaces</div>
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, marginBottom: 30, overflow: "hidden" }}>
        <Table
          empty="Noch keine Workspaces."
          rows={workspaces}
          columns={[
            { key: "workspace", label: "Workspace" },
            { key: "besitzer", label: "Besitzer", dim: true },
            { key: "plan", label: "Plan" },
            { key: "mitglieder", label: "Mitgl.", right: true },
            { key: "personen", label: "Personen", dim: true, wrap: true },
            { key: "projekte", label: "Projekte", right: true },
            { key: "speicher_mb", label: "Speicher", right: true, render: r => fmtMB(r.speicher_mb) },
            { key: "angelegt", label: "Angelegt", dim: true },
          ]}
        />
      </div>

      <div style={{ fontSize: 12, color: FAINT, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 10 }}>Nutzer</div>
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
        <Table
          empty="Noch keine Nutzer."
          rows={users}
          columns={[
            { key: "email", label: "E-Mail" },
            { key: "name", label: "Name", dim: true },
            { key: "plan", label: "Plan" },
            { key: "abo_status", label: "Status", dim: true },
            { key: "eigene_workspaces", label: "Eigene WS", right: true },
            { key: "gast_in", label: "Gast in", right: true },
            { key: "speicher_mb", label: "Speicher", right: true, render: r => fmtMB(r.speicher_mb) },
            { key: "registriert", label: "Registriert", dim: true },
            { key: "zuletzt_aktiv", label: "Zuletzt aktiv", dim: true, render: r => r.zuletzt_aktiv || "nie" },
          ]}
        />
      </div>

      <div style={{ fontSize: 11, color: FAINT, marginTop: 18 }}>
        Stand: {new Date(generatedAt).toLocaleString("de-DE")}
      </div>
    </>
  );
}
