import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PLAN_NAMES, PLAN_PRICES, TRIAL_DAYS, TRIAL_PLAN, planFeatures } from "./entitlements";

const APP_FONT = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Prices and feature bullets come from src/entitlements.js — the same file the
// limits are enforced from — so a card can never advertise a number the product
// doesn't actually grant. Only the positioning line is written by hand.
const PLAN_TAGLINES = {
  starter: { de: "Ein fokussierter Ort für die eigene kreative Arbeit.", en: "A focused space for individual creative work." },
  pro: { de: "Gemeinsamer Markenkontext und Zusammenarbeit im kleinen Team.", en: "Shared brand context and collaboration for small teams." },
  agency: { de: "Flexible Workspaces, Rollen und Support für Agenturen.", en: "Flexible workspaces, roles, and support for agencies." },
};
const PLAN_OPTIONS = ["starter", "pro", "agency"].map(id => ({
  id,
  name: PLAN_NAMES[id],
  monthly: PLAN_PRICES[id].monthly,
  annual: PLAN_PRICES[id].annual,
}));

const MANAGEABLE_STATUSES = new Set(["active", "trialing", "incomplete", "past_due", "unpaid", "paused"]);
const CHECKOUT_POLL_INTERVAL_MS = 1500;
// Returning from the Customer Portal: refresh over roughly the first eight
// seconds, which is the window Stripe's webhook for the change lands in.
const PORTAL_REFRESH_ATTEMPTS = 6;
const PORTAL_REFRESH_INTERVAL_MS = 1400;
const CHECKOUT_POLL_ATTEMPTS = 8;

function readPendingSelection() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = { plan: params.get("plan"), billing: params.get("billing") };
    if (PLAN_OPTIONS.some(item => item.id === fromUrl.plan) && ["monthly", "annual"].includes(fromUrl.billing)) {
      // The timestamp matters: App.jsx uses it to decide whether to open
      // Settings on load. Writing this without one would resurrect the entry as
      // undated — i.e. permanently stale — and reinstate the redirect loop.
      localStorage.setItem("i7os-pending-billing", JSON.stringify({ ...fromUrl, at: Date.now() }));
      return fromUrl;
    }
    const stored = JSON.parse(localStorage.getItem("i7os-pending-billing") || "null");
    if (PLAN_OPTIONS.some(item => item.id === stored?.plan) && ["monthly", "annual"].includes(stored?.billing)) return stored;
  } catch (_) {}
  return { plan: "pro", billing: "monthly" };
}

export default function BillingSettings({ session, org, isAdmin, entitlements, onBillingChange, theme, darkMode, appLanguage = "en" }) {
  const initial = useMemo(readPendingSelection, []);
  const [selectedPlan, setSelectedPlan] = useState(initial.plan);
  const [billingInterval, setBillingInterval] = useState(initial.billing);
  const [billing, setBilling] = useState(null);
  // One plan covers all of the owner's workspaces, so buying and managing it is
  // the OWNER's action — an invited admin would get a 403 from the API. Seeded
  // from the app-wide entitlements so the button doesn't flicker before the
  // component's own status call lands.
  const [isOwner, setIsOwner] = useState(() => Boolean(entitlements?.isOwner));
  const [effectivePlan, setEffectivePlan] = useState(() => entitlements?.plan || null);
  const [comped, setComped] = useState(false);
  const [hasStripeSub, setHasStripeSub] = useState(false);
  const [trial, setTrial] = useState(() => entitlements?.trial || null);
  // Held in a ref, not the poll effect's deps: that effect clears the URL's
  // ?checkout=success on its first run, so re-running it mid-poll would cancel
  // the poll and never restart it.
  const onBillingChangeRef = useRef(onBillingChange);
  useEffect(() => { onBillingChangeRef.current = onBillingChange; }, [onBillingChange]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null);
  const [error, setError] = useState("");
  const [checkoutProcessing, setCheckoutProcessing] = useState(() => new URLSearchParams(window.location.search).get("checkout") === "success");
  const [checkoutSyncDelayed, setCheckoutSyncDelayed] = useState(false);
  const de = appLanguage === "de";

  const request = useCallback(async (path, body) => {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const requestError = new Error(payload.error || "Billing request failed");
      requestError.code = payload.code;
      throw requestError;
    }
    return payload;
  }, [session?.access_token]);

  const loadBilling = useCallback(async ({ silent = false } = {}) => {
    if (!org?.id || !session?.access_token) return null;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const data = await request("/api/billing-status", { orgId: org.id });
      setBilling(data.billing);
      setIsOwner(Boolean(data.isOwner));
      // The plan actually in force, which is NOT billing.plan: that column holds
      // the Stripe subscription's plan, while a trial or a manual grant
      // (plan_override) can put the account on a different one.
      setEffectivePlan(data.plan || null);
      setComped(Boolean(data.comped));
      setHasStripeSub(Boolean(data.stripeSubscription));
      setTrial(data.trial || null);
      return data.billing;
    } catch (requestError) {
      setError(requestError.code === "billing_not_configured"
        ? (de ? "Billing ist noch nicht vollständig konfiguriert." : "Billing is not fully configured yet.")
        : requestError.message);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [de, org?.id, request, session?.access_token]);

  useEffect(() => { loadBilling(); }, [loadBilling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      localStorage.removeItem("i7os-pending-billing");
      window.history.replaceState({}, "", window.location.pathname);
      setCheckoutProcessing(true);
      setCheckoutSyncDelayed(false);

      let cancelled = false;
      let timer = null;
      let attempts = 0;

      const pollBilling = async () => {
        const latestBilling = await loadBilling({ silent: true });
        if (cancelled) return;
        if (MANAGEABLE_STATUSES.has(latestBilling?.status)) {
          setCheckoutProcessing(false);
          setCheckoutSyncDelayed(false);
          // The new plan changes limits app-wide (storage, seats, projects) —
          // refresh the shared entitlements so the rest of the UI unlocks
          // without a page reload.
          onBillingChangeRef.current?.();
          return;
        }

        attempts += 1;
        if (attempts < CHECKOUT_POLL_ATTEMPTS) {
          timer = window.setTimeout(pollBilling, CHECKOUT_POLL_INTERVAL_MS);
        } else {
          setCheckoutSyncDelayed(true);
        }
      };

      timer = window.setTimeout(pollBilling, 450);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    if (checkout === "portal-return") {
      window.history.replaceState({}, "", window.location.pathname);
      // Re-read a few times, not once. Coming back from the portal beats the
      // webhook that carries what was changed there — a single read 450ms later
      // usually lands before Stripe has told us anything, and then the screen
      // sits on stale text (a cancelled plan still showing a renewal date)
      // until the page is reloaded. Unlike checkout there is no status to wait
      // for: a cancellation leaves the subscription active, so this simply
      // refreshes over the window in which the webhook arrives.
      let cancelled = false;
      let timer = null;
      let attempts = 0;
      const refresh = async () => {
        await loadBilling({ silent: true });
        if (cancelled) return;
        attempts += 1;
        if (attempts < PORTAL_REFRESH_ATTEMPTS) timer = window.setTimeout(refresh, PORTAL_REFRESH_INTERVAL_MS);
        else onBillingChangeRef.current?.(); // limits may have changed with the plan
      };
      timer = window.setTimeout(refresh, 450);
      return () => { cancelled = true; window.clearTimeout(timer); };
    }
    return undefined;
  }, [loadBilling]);

  const startCheckout = async () => {
    if (!isOwner || action) return;
    setAction("checkout");
    setError("");
    try {
      const data = await request("/api/create-checkout-session", {
        orgId: org.id,
        plan: selectedPlan,
        billing: billingInterval,
      });
      localStorage.removeItem("i7os-pending-billing");
      window.location.assign(data.url);
    } catch (requestError) {
      setError(requestError.code === "subscription_exists"
        ? (de ? "Dieser Workspace hat bereits ein Abo. Öffne das Kundenportal, um es zu verwalten." : "This workspace already has a subscription. Open the customer portal to manage it.")
        : requestError.message);
      setAction(null);
    }
  };

  const openPortal = async () => {
    if (!isOwner || action) return;
    setAction("portal");
    setError("");
    try {
      const data = await request("/api/create-customer-portal-session", { orgId: org.id });
      window.location.assign(data.url);
    } catch (requestError) {
      setError(requestError.message);
      setAction(null);
    }
  };

  // A real, billed Stripe subscription — NOT merely status "trialing", which our
  // own cardless trial also carries. Getting this wrong hid the plan picker from
  // trial users and pointed them at a customer portal that cannot open.
  const hasSubscription = hasStripeSub && MANAGEABLE_STATUSES.has(billing?.status);
  const onTrial = Boolean(trial?.active) && !hasSubscription;
  // Show what the account actually gets. A manual grant or a running trial can
  // put it on a different plan than the Stripe subscription says, and showing
  // the Stripe one then looks like the app is simply wrong.
  const shownPlan = effectivePlan && effectivePlan !== "free" ? effectivePlan : billing?.plan;
  const activePlan = PLAN_OPTIONS.find(item => item.id === shownPlan);
  // The plan picker must stay hidden until the status is known, otherwise it
  // flashes for a second on every visit to the Account tab before being
  // replaced by the active-plan view. Deliberately just !loading: a failed
  // request also ends the loading state, and showing the picker then is the
  // right fallback — waiting forever on a placeholder is not.
  const statusKnown = !loading;
  const periodEnd = billing?.currentPeriodEnd
    ? new Intl.DateTimeFormat(de ? "de-DE" : "en-US", { dateStyle: "medium" }).format(new Date(billing.currentPeriodEnd))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.4, ease: [0.22, 0.68, 0.35, 1] }}
      style={{ marginTop: 24, fontFamily: APP_FONT }}
    >
      <div style={{ fontSize: 10, color: theme.textFaint, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>
        {de ? "Abo & Abrechnung" : "Plan & Billing"}
      </div>

      <div style={{ borderRadius: 20, background: theme.cardBg, border: `1px solid ${theme.border}`, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: theme.text }}>
              {checkoutProcessing
                ? (checkoutSyncDelayed ? (de ? "Deine Zahlung wird verarbeitet" : "Your payment is being processed") : (de ? "Dein Plan wird aktiviert …" : "Activating your plan …"))
                : !statusKnown ? (de ? "Abo wird geladen …" : "Loading subscription …")
                : onTrial ? (de ? "Kostenlose Testphase" : "Free trial")
                : (hasSubscription || comped) ? `${activePlan?.name || shownPlan} Plan`
                : trial?.expired ? (de ? "Testphase beendet" : "Trial ended")
                : (de ? "Wähle deinen Plan" : "Choose your plan")}
            </div>
            <div style={{ fontSize: 12, color: theme.textDim, marginTop: 5, lineHeight: 1.5 }}>
              {checkoutProcessing
                ? (checkoutSyncDelayed
                  ? (de ? "Die Synchronisierung dauert länger als üblich. Du kannst diese Seite sicher verlassen und in Kürze zurückkehren." : "Synchronization is taking longer than usual. You can safely leave this page and return shortly.")
                  : (de ? "Stripe hat den Checkout bestätigt. Wir synchronisieren das Abo gerade mit diesem Workspace." : "Stripe confirmed the checkout. We’re syncing the subscription with this workspace."))
                : !statusKnown ? ""
                : onTrial
                // Concrete and actionable: how long it runs, how much is left,
                // and what happens at the end. "trialing" told the user nothing.
                ? (de
                  ? `Du testest i7 OS ${TRIAL_DAYS} Tage lang mit allen ${PLAN_NAMES[TRIAL_PLAN]}-Funktionen — ${trial.daysLeft === 1 ? "noch 1 Tag" : `noch ${trial.daysLeft} Tage`}. Danach bleiben deine Inhalte erhalten, für Änderungen brauchst du einen Plan.`
                  : `You're trying i7 OS for ${TRIAL_DAYS} days with every ${PLAN_NAMES[TRIAL_PLAN]} feature — ${trial.daysLeft === 1 ? "1 day left" : `${trial.daysLeft} days left`}. Afterwards your content stays, but changes need a plan.`)
                : trial?.expired
                ? (de
                  ? "Deine Testphase ist beendet. Deine Inhalte bleiben erhalten und lassen sich exportieren — für Änderungen brauchst du einen Plan."
                  : "Your trial has ended. Your content stays and can be exported — changes need a plan.")
                : comped
                // Manually granted: name the Stripe subscription separately so
                // the two plan names on this screen don't look contradictory.
                ? (de
                  ? `Manuell freigeschaltet — nicht über Stripe abgerechnet.${billing?.plan ? ` Hinterlegtes Abo: ${PLAN_NAMES[billing.plan] || billing.plan}.` : ""}`
                  : `Granted manually — not billed through Stripe.${billing?.plan ? ` Stripe subscription: ${PLAN_NAMES[billing.plan] || billing.plan}.` : ""}`)
                : hasSubscription
                ? `${billing.status}${periodEnd ? ` · ${billing.cancelAtPeriodEnd ? (de ? "Endet" : "Ends") : (de ? "Verlängert sich" : "Renews")} ${periodEnd}` : ""}`
                : (de ? "Ein Abo gilt für alle Workspaces deines Kontos." : "One plan covers every workspace on your account.")}
            </div>
          </div>
          {hasSubscription && isOwner && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={openPortal} disabled={Boolean(action)} style={{ padding: "10px 15px", borderRadius: 11, border: `1px solid ${theme.border}`, background: "transparent", color: theme.text, fontFamily: APP_FONT, fontSize: 12, fontWeight: 600, cursor: action ? "wait" : "pointer" }}>
              {action === "portal" ? "…" : (de ? "Abo verwalten" : "Manage billing")}
            </motion.button>
          )}
        </div>

        {!hasSubscription && checkoutProcessing && (
          <div style={{ minHeight: 235, borderRadius: 16, border: `1px solid ${theme.border}`, background: darkMode ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.018)", display: "grid", placeItems: "center", textAlign: "center", padding: 28 }}>
            <div>
              <motion.div
                aria-hidden="true"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, ease: "linear", repeat: Infinity }}
                style={{ width: 28, height: 28, margin: "0 auto 15px", borderRadius: "50%", border: `2px solid ${theme.border}`, borderTopColor: theme.text }}
              />
              <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>
                {checkoutSyncDelayed ? (de ? "Fast geschafft" : "Almost there") : (de ? "Workspace wird aktualisiert" : "Updating your workspace")}
              </div>
              <div style={{ color: theme.textDim, fontSize: 11, lineHeight: 1.55, marginTop: 7, maxWidth: 340 }}>
                {checkoutSyncDelayed
                  ? (de ? "Dein Kauf ist sicher. Lade diese Seite in Kürze neu, um den aktualisierten Plan zu sehen." : "Your purchase is safe. Refresh this page shortly to see the updated plan.")
                  : (de ? "Das dauert normalerweise nur wenige Sekunden." : "This normally takes only a few seconds.")}
              </div>
            </div>
          </div>
        )}

        {/* Placeholder while the status is still unknown. Same height as the
            plan grid, so the card doesn't jump once the answer arrives. */}
        {!statusKnown && !checkoutProcessing && (
          <div style={{ minHeight: 235, borderRadius: 16, border: `1px solid ${theme.border}`, background: darkMode ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.018)" }} />
        )}

        {statusKnown && !hasSubscription && !comped && !checkoutProcessing && (
          <>
            <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: darkMode ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.045)", marginBottom: 18 }}>
              {["monthly", "annual"].map(interval => (
                <button key={interval} onClick={() => setBillingInterval(interval)} style={{ padding: "8px 14px", border: 0, borderRadius: 9, background: billingInterval === interval ? (darkMode ? "rgba(255,255,255,.12)" : "#fff") : "transparent", boxShadow: billingInterval === interval ? "0 1px 4px rgba(0,0,0,.12)" : "none", color: billingInterval === interval ? theme.text : theme.textDim, fontFamily: APP_FONT, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .25s ease" }}>
                  {interval === "monthly" ? (de ? "Monatlich" : "Monthly") : (de ? "Jährlich" : "Annual")}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {PLAN_OPTIONS.map(plan => {
                const selected = selectedPlan === plan.id;
                return (
                  <motion.button key={plan.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} onClick={() => setSelectedPlan(plan.id)} style={{ padding: 17, textAlign: "left", borderRadius: 16, border: `1px solid ${selected ? theme.text : theme.border}`, background: selected ? (darkMode ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)") : "transparent", color: theme.text, fontFamily: APP_FONT, cursor: "pointer", transition: "border-color .25s ease, background .25s ease" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.name}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 12 }}>
                      <strong style={{ fontSize: 30, fontWeight: 600 }}>€{plan[billingInterval]}</strong>
                      <span style={{ fontSize: 10, color: theme.textDim }}>/ {de ? "Monat" : "month"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: theme.textDim, lineHeight: 1.45, marginTop: 10 }}>
                      {PLAN_TAGLINES[plan.id][de ? "de" : "en"]}
                    </div>
                    <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                      {planFeatures(plan.id, de).map((feature, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: i ? 6 : 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 3 }}>
                            <path d="M20 6L9 17l-5-5" stroke={theme.textDim} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span style={{ fontSize: 11, color: theme.textSub, lineHeight: 1.4 }}>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 20 }}>
              <div style={{ fontSize: 11, color: theme.textDim }}>
                {!isOwner && (de ? "Nur der Besitzer dieses Workspaces kann das Abo verwalten. Ein Abo deckt alle Workspaces seines Kontos ab." : "Only this workspace’s owner can manage the subscription. One plan covers every workspace on their account.")}
              </div>
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={startCheckout} disabled={!isOwner || Boolean(action) || loading} style={{ padding: "12px 24px", border: 0, borderRadius: 999, background: darkMode ? "#fff" : "#15151c", color: darkMode ? "#15151c" : "#fff", fontFamily: APP_FONT, fontSize: 13, fontWeight: 600, cursor: !isOwner || action || loading ? "not-allowed" : "pointer", opacity: !isOwner || action || loading ? 0.55 : 1 }}>
                {action === "checkout" ? (de ? "Öffnet Checkout …" : "Opening checkout …") : (de ? "Weiter zum sicheren Checkout" : "Continue to secure checkout")}
              </motion.button>
            </div>
          </>
        )}

        {error && <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(232,67,67,.08)", border: "1px solid rgba(232,67,67,.16)", color: "#E86767", fontSize: 12, lineHeight: 1.45 }}>{error}</div>}
      </div>
    </motion.div>
  );
}
