// Bundled "send" endpoint — one serverless function for every outbound message,
// dispatched by `mode` in the POST body (Vercel Hobby caps us at 12 functions,
// so related endpoints are multiplexed here instead of one file each):
//   mode "invite"          → workspace invite email (Resend)
//   mode "project-invite"  → project invite email (Resend)
//   mode "push-setup"      → "enable push" setup email (Resend)
//   mode "push"            → web-push notification (VAPID)
import webpush from "web-push";
import { getAdminSupabase, requireUser } from "../server/billing.js";

// Everything that reaches an email template goes through this first. The
// templates interpolate names straight into HTML, and a name is whatever
// somebody typed into a field.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The lifecycle sweep is the one caller that is not a person. It runs on
// Vercel's cron with CRON_SECRET, so it can prove it is us; every other mode
// belongs to a signed-in user.
const isInternal = (req) => {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers["x-i7-internal"] === secret;
};

// Canonical public app URL. Override via the PUBLIC_APP_URL env var if the
// domain changes again; defaults to the current production domain.
const APP_URL = process.env.PUBLIC_APP_URL || "https://app.i7os.com";

// Fire a single transactional email through Resend. Returns a normalized result.
async function sendResend({ from, to, subject, html }) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, status: 500, error: "RESEND_API_KEY not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Resend error:", data);
    return { ok: false, status: response.status, error: data.message || "Failed to send email" };
  }
  return { ok: true, id: data.id };
}

const inviteHtml = ({ token, orgName, inviterName }) => `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="${APP_URL}/i7OS-Logo.png" alt="i7OS" width="96" height="59" style="display: block; margin: 0 auto 16px; border: 0;" />
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin: 0;">You're invited to join a workspace</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 24px;">
              <strong>${esc(inviterName || "A team member")}</strong> has invited you to join <strong>${esc(orgName || "their workspace")}</strong> on i7OS.
            </p>
            <div style="background: #f8f7ff; border: 1px solid #e8e5ff; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px;">
              <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your Invite Code</div>
              <div style="font-size: 15px; font-weight: 600; color: #555; letter-spacing: 0.3px; word-break: break-all; font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;">${esc(token)}</div>
            </div>
            <a href="${APP_URL}/?invite=${encodeURIComponent(token)}" style="display: inline-block; padding: 12px 28px; background: #111111; color: white; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px; margin-bottom: 24px;">Join Workspace</a>
            <p style="font-size: 13px; color: #888; line-height: 1.6; margin-bottom: 24px;">
              Click the button to join directly,<br/>or copy the invite code and enter it manually in i7OS.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `;

const projectInviteHtml = ({ projectName, inviterName, token }) => `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="${APP_URL}/i7OS-Logo.png" alt="i7OS" width="96" height="59" style="display: block; margin: 0 auto 16px; border: 0;" />
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin: 0;">Projekt-Einladung</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 24px;">
              <strong>${esc(inviterName || "Ein Teammitglied")}</strong> hat dich eingeladen, am Projekt <strong>${esc(projectName || "")}</strong> mitzuwirken.
            </p>
            <a href="${APP_URL}/?project-invite=${encodeURIComponent(token)}" style="display: inline-block; padding: 12px 28px; background: #111111; color: white; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px; margin-bottom: 24px;">Projekt beitreten</a>
            <p style="font-size: 13px; color: #888; line-height: 1.6; margin-bottom: 24px;">
              Klick auf den Button, um dem Projekt beizutreten. Die Einladung ist 14 Tage gültig.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
              Wenn du diese Einladung nicht erwartet hast, kannst du sie ignorieren.
            </p>
          </div>
        `;

const pushSetupHtml = ({ userName, setupUrl }) => `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 32px;">
              <img src="${APP_URL}/i7OS-Logo.png" alt="i7OS" width="96" height="59" style="display: block; margin: 0 auto 16px; border: 0;" />
              <h1 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0;">Push-Benachrichtigungen aktivieren</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 8px;">
              Hey ${esc(userName || "")},
            </p>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 28px;">
              öffne diesen Link <strong>auf deinem Handy</strong>, um Push-Benachrichtigungen für Erinnerungen zu aktivieren.
            </p>
            <a href="${setupUrl}" style="display: inline-block; padding: 14px 32px; background: #111111; color: white; text-decoration: none; border-radius: 12px; font-weight: 500; font-size: 15px; margin-bottom: 24px;">📱 Auf dem Handy öffnen</a>
            <p style="font-size: 13px; color: #888; line-height: 1.6; margin-top: 24px;">
              <strong>Android:</strong> Öffne den Link in Chrome und erlaube die Benachrichtigungen.
            </p>
            <div style="background: #fff8e1; border: 1px solid #ffe082; border-radius: 12px; padding: 14px 16px; margin-top: 16px; text-align: left;">
              <p style="font-size: 12px; color: #666; line-height: 1.6; margin: 0;">
                <strong style="color: #f57c00;">iPhone-Nutzer:</strong><br/>
                Apple erlaubt Push-Benachrichtigungen nur in installierten Web-Apps.<br/>
                1. Öffne den Link in Safari<br/>
                2. Tippe auf das <strong>Teilen-Symbol</strong> (↑)<br/>
                3. Wähle <strong>"Zum Home-Bildschirm"</strong><br/>
                4. Öffne i7OS dann vom Home-Bildschirm und aktiviere dort die Benachrichtigungen
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
            <p style="font-size: 11px; color: #999;">
              Du erhältst diese E-Mail, weil du Push-Benachrichtigungen in i7OS aktivieren möchtest.
            </p>
          </div>
        `;

// The display name to sign an invitation with. Read from the sender's own
// profile rather than from the request: a name in the body is a name the
// sender chose for themselves in that one message.
async function senderName(admin, userId) {
  const { data } = await admin.from("profiles").select("display_name, email").eq("id", userId).maybeSingle();
  return data?.display_name || data?.email || "";
}

export default async function handler(req, res) {
  // No wildcard CORS. Every caller is the app on its own origin or the cron.
  // `*` on an endpoint that sends mail is an open relay with a nice header.
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const mode = req.body?.mode || req.query?.mode;

  // ── Who is asking ─────────────────────────────────────────────────────────
  //
  // Nothing here used to ask. Anyone on the internet could POST an address and
  // a bit of text and i7OS would send mail to it, on our Resend account and
  // under our domain's reputation, or push a notification to any endpoint they
  // happened to know. The recipient came out of the request body, which is the
  // definition of an open relay.
  //
  // Now: the sweep proves it is the sweep with the cron secret, everyone else
  // proves who they are with the same bearer token the rest of api/ takes, and
  // every mode below re-derives WHO may receive from the database instead of
  // believing the body.
  const internal = isInternal(req);
  let user = null;
  if (!internal) {
    try {
      user = await requireUser(req);
    } catch {
      return res.status(401).json({ error: "Authentication required", code: "unauthorized" });
    }
  }
  if (mode === "lifecycle-warning" && !internal) {
    return res.status(403).json({ error: "Not yours to send", code: "forbidden" });
  }
  const admin = getAdminSupabase();

  try {
    if (mode === "invite") {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Missing token" });

      // The invitation decides everything: who it is for, which workspace, and
      // whether it is still open. The body only says which invitation.
      const { data: inv } = await admin
        .from("invitations")
        .select("email, org_id, status, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (!inv || inv.status !== "pending" || (inv.expires_at && new Date(inv.expires_at) < new Date())) {
        return res.status(404).json({ error: "No open invitation for that token", code: "no_invite" });
      }
      // And only an admin of that workspace may cause it to be sent.
      const { data: mem } = await admin
        .from("org_members").select("role").eq("org_id", inv.org_id).eq("user_id", user.id).maybeSingle();
      if (mem?.role !== "admin") return res.status(403).json({ error: "Not yours to send", code: "forbidden" });

      const { data: org } = await admin.from("organizations").select("name").eq("id", inv.org_id).maybeSingle();
      const orgName = org?.name || "their workspace";
      const inviterName = await senderName(admin, user.id);
      const r = await sendResend({
        from: "Agency OS <invite@i7os.com>",
        to: inv.email,
        subject: `${inviterName || "Someone"} invited you to join ${orgName} on i7OS`,
        html: inviteHtml({ token, orgName, inviterName }),
      });
      return r.ok ? res.status(200).json({ success: true, id: r.id }) : res.status(r.status).json({ error: r.error });
    }

    if (mode === "storage-warning") {
      // Goes to the person asking, never to an address in the body.
      const { pct } = req.body;
      const email = user.email;
      if (!email) return res.status(400).json({ error: "Missing email" });
      const usedPct = Math.min(100, Math.max(0, Math.round(Number(pct) || 90)));
      const r = await sendResend({
        from: "i7OS <invite@i7os.com>",
        to: email,
        subject: `Dein Workspace-Speicher ist zu ${usedPct}% voll — i7OS`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 28px;">
              <img src="${APP_URL}/i7OS-Logo.png" alt="i7OS" width="96" height="59" style="display: block; margin: 0 auto 16px; border: 0;" />
              <h1 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0;">Dein Speicher wird knapp</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 24px;">
              Dein i7OS Workspace nutzt bereits <strong>${usedPct}%</strong> des verfügbaren Speichers.
              Sobald er voll ist, kannst du keine neuen Dateien mehr hochladen.
            </p>
            <a href="${APP_URL}/?view=settings" style="display: inline-block; padding: 12px 28px; background: #111111; color: white; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px; margin-bottom: 24px;">Speicher upgraden</a>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
              Du erhältst diese E-Mail, weil dein Workspace-Speicher fast erschöpft ist.
            </p>
          </div>
        `,
      });
      return r.ok ? res.status(200).json({ success: true, id: r.id }) : res.status(r.status).json({ error: r.error });
    }

    // Sent by the lifecycle sweep before an inactive account's files are
    // removed. Deliberately plain and specific about the date and the way out —
    // nobody should lose work to a message they mistook for marketing.
    if (mode === "lifecycle-warning") {
      const { email, daysLeft, workspaces } = req.body;
      if (!email) return res.status(400).json({ error: "Missing email" });
      const days = Math.max(0, Math.round(Number(daysLeft) || 14));
      const names = Array.isArray(workspaces) ? workspaces.filter(Boolean) : [];
      const r = await sendResend({
        from: "i7OS <invite@i7os.com>",
        to: email,
        subject: days <= 3
          ? `Letzte Erinnerung: Deine Dateien werden in ${days} Tagen gelöscht — i7OS`
          : `Deine i7OS Dateien werden in ${days} Tagen gelöscht`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 28px;">
              <img src="${APP_URL}/i7OS-Logo.png" alt="i7OS" width="96" height="59" style="display: block; margin: 0 auto 16px; border: 0;" />
              <h1 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0;">Deine Dateien werden bald gelöscht</h1>
            </div>
            <p style="font-size: 15px; color: #444; line-height: 1.6;">
              Dein i7OS Konto hat seit einer Weile keinen aktiven Plan. In <strong>${days} Tagen</strong>
              entfernen wir deshalb die hochgeladenen Dateien${names.length ? ` aus ${names.length === 1 ? "deinem Workspace" : "deinen Workspaces"} <strong>${names.map(esc).join(", ")}</strong>` : ""}.
            </p>
            <p style="font-size: 15px; color: #444; line-height: 1.6;">
              Deine Projekte, Aufgaben und Markendaten bleiben zunächst erhalten und sind weiterhin sichtbar.
              Wenn du einen Plan wählst, passiert nichts davon — alles bleibt, wo es ist.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${APP_URL}/?view=settings" style="display: inline-block; padding: 12px 28px; background: #111111; color: white; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px;">Plan wählen</a>
            </div>
            <p style="font-size: 13px; color: #666; line-height: 1.6;">
              Du möchtest deine Inhalte behalten, aber nicht weitermachen? Melde dich an und exportiere sie,
              solange sie noch da sind.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
              Du erhältst diese E-Mail, weil dein i7OS Konto derzeit keinen aktiven Plan hat.
            </p>
          </div>
        `,
      });
      return r.ok ? res.status(200).json({ success: true, id: r.id }) : res.status(r.status).json({ error: r.error });
    }

    if (mode === "project-invite") {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Missing token" });

      const { data: inv } = await admin
        .from("project_invitations")
        .select("email, project_id, status, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (!inv || inv.status !== "pending" || (inv.expires_at && new Date(inv.expires_at) < new Date())) {
        return res.status(404).json({ error: "No open invitation for that token", code: "no_invite" });
      }
      const { data: proj } = await admin
        .from("projects").select("name, owner_id, org_id").eq("id", inv.project_id).maybeSingle();
      if (!proj) return res.status(404).json({ error: "No such project", code: "no_project" });
      // The project's owner, or an admin of the workspace it lives in.
      let allowed = proj.owner_id === user.id;
      if (!allowed) {
        const { data: mem } = await admin
          .from("org_members").select("role").eq("org_id", proj.org_id).eq("user_id", user.id).maybeSingle();
        allowed = mem?.role === "admin";
      }
      if (!allowed) return res.status(403).json({ error: "Not yours to send", code: "forbidden" });

      const inviterName = await senderName(admin, user.id);
      const projectName = proj.name || "";
      const r = await sendResend({
        from: "i7OS <invite@i7os.com>",
        to: inv.email,
        subject: `${inviterName || "Jemand"} hat dich zum Projekt "${projectName}" eingeladen`,
        html: projectInviteHtml({ projectName, inviterName, token }),
      });
      return r.ok ? res.status(200).json({ success: true, id: r.id }) : res.status(r.status).json({ error: r.error });
    }

    if (mode === "push-setup") {
      // A setup link is a way into somebody's account on another device, so it
      // may only ever be posted to that same somebody's own address.
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Missing token" });
      const { data: row } = await admin
        .from("push_setup_tokens").select("user_id, used, expires_at").eq("token", token).maybeSingle();
      if (!row || row.user_id !== user.id || row.used || (row.expires_at && new Date(row.expires_at) < new Date())) {
        return res.status(403).json({ error: "Not yours to send", code: "forbidden" });
      }
      const email = user.email;
      if (!email) return res.status(400).json({ error: "Missing email" });
      const userName = await senderName(admin, user.id);
      const setupUrl = `${APP_URL}/?push-setup=true&token=${encodeURIComponent(token)}`;
      const r = await sendResend({
        from: "i7OS <invite@i7os.com>",
        to: email,
        subject: "Push-Benachrichtigungen aktivieren — i7OS",
        html: pushSetupHtml({ userName, setupUrl }),
      });
      return r.ok ? res.status(200).json({ success: true, id: r.id }) : res.status(r.status).json({ error: r.error });
    }

    if (mode === "push") {
      const { subscription, title, body, tag, url } = req.body;
      if (!subscription || !subscription.endpoint) return res.status(400).json({ error: "Missing subscription" });
      // The endpoint has to be one of this user's own registered devices.
      // Otherwise anybody who has ever seen a push endpoint can write anything
      // they like onto somebody else's lock screen, signed i7OS.
      const { data: own } = await admin
        .from("push_subscriptions").select("id").eq("user_id", user.id).eq("endpoint", subscription.endpoint).maybeSingle();
      if (!own) return res.status(403).json({ error: "Not one of your devices", code: "forbidden" });
      const vapidPublic = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      if (!vapidPublic || !vapidPrivate) return res.status(500).json({ error: "VAPID keys not configured" });
      webpush.setVapidDetails("mailto:invite@i7os.com", vapidPublic, vapidPrivate);
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: title || "i7OS", body: body || "", tag: tag || "reminder", url: url || "/" })
        );
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error("Push send error:", error);
        // 410 = subscription expired, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          return res.status(410).json({ error: "Subscription expired", gone: true });
        }
        return res.status(500).json({ error: "Failed to send push" });
      }
    }

    return res.status(400).json({ error: "Unknown mode" });
  } catch (error) {
    console.error("send handler error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
