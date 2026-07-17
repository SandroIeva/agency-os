import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const APP_FONT = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const PLAN_OPTIONS = [
  { id: "starter", name: "Starter", monthly: 15, annual: 12, description: "A focused space for individual creative work." },
  { id: "pro", name: "Pro", monthly: 24, annual: 20, description: "Shared brand context and collaboration for small teams." },
  { id: "agency", name: "Agency", monthly: 85, annual: 72, description: "Flexible workspaces, roles, and support for agencies." },
];

const MANAGEABLE_STATUSES = new Set(["active", "trialing", "incomplete", "past_due", "unpaid", "paused"]);

function readPendingSelection() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = { plan: params.get("plan"), billing: params.get("billing") };
    if (PLAN_OPTIONS.some(item => item.id === fromUrl.plan) && ["monthly", "annual"].includes(fromUrl.billing)) {
      localStorage.setItem("i7os-pending-billing", JSON.stringify(fromUrl));
      return fromUrl;
    }
    const stored = JSON.parse(localStorage.getItem("i7os-pending-billing") || "null");
    if (PLAN_OPTIONS.some(item => item.id === stored?.plan) && ["monthly", "annual"].includes(stored?.billing)) return stored;
  } catch (_) {}
  return { plan: "pro", billing: "monthly" };
}

export default function BillingSettings({ session, org, isAdmin, theme, darkMode, appLanguage = "en" }) {
  const initial = useMemo(readPendingSelection, []);
  const [selectedPlan, setSelectedPlan] = useState(initial.plan);
  const [billingInterval, setBillingInterval] = useState(initial.billing);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null);
  const [error, setError] = useState("");
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

  const loadBilling = useCallback(async () => {
    if (!org?.id || !session?.access_token) return;
    setLoading(true);
    setError("");
    try {
      const data = await request("/api/billing-status", { orgId: org.id });
      setBilling(data.billing);
    } catch (requestError) {
      setError(requestError.code === "billing_not_configured"
        ? (de ? "Billing ist noch nicht vollständig konfiguriert." : "Billing is not fully configured yet.")
        : requestError.message);
    } finally {
      setLoading(false);
    }
  }, [de, org?.id, request, session?.access_token]);

  useEffect(() => { loadBilling(); }, [loadBilling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success" || checkout === "portal-return") {
      localStorage.removeItem("i7os-pending-billing");
      const timer = window.setTimeout(loadBilling, 900);
      window.history.replaceState({}, "", window.location.pathname);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [loadBilling]);

  const startCheckout = async () => {
    if (!isAdmin || action) return;
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
    if (!isAdmin || action) return;
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

  const hasSubscription = MANAGEABLE_STATUSES.has(billing?.status);
  const activePlan = PLAN_OPTIONS.find(item => item.id === billing?.plan);
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
        {de ? "Abo & Abrechnung" : "Plan & Billing"} — {org?.name}
      </div>

      <div style={{ borderRadius: 20, background: theme.cardBg, border: `1px solid ${theme.border}`, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: theme.text }}>
              {loading ? (de ? "Abo wird geladen …" : "Loading subscription …") : hasSubscription ? `${activePlan?.name || billing.plan} Plan` : (de ? "Wähle deinen Plan" : "Choose your plan")}
            </div>
            <div style={{ fontSize: 12, color: theme.textDim, marginTop: 5, lineHeight: 1.5 }}>
              {hasSubscription
                ? `${billing.status}${periodEnd ? ` · ${billing.cancelAtPeriodEnd ? (de ? "Endet" : "Ends") : (de ? "Verlängert sich" : "Renews")} ${periodEnd}` : ""}`
                : (de ? "Das Abo gilt für den gesamten aktuellen Workspace." : "The subscription applies to the entire current workspace.")}
            </div>
          </div>
          {hasSubscription && isAdmin && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={openPortal} disabled={Boolean(action)} style={{ padding: "10px 15px", borderRadius: 11, border: `1px solid ${theme.border}`, background: "transparent", color: theme.text, fontFamily: APP_FONT, fontSize: 12, fontWeight: 600, cursor: action ? "wait" : "pointer" }}>
              {action === "portal" ? "…" : (de ? "Abo verwalten" : "Manage billing")}
            </motion.button>
          )}
        </div>

        {!hasSubscription && (
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
                  <motion.button key={plan.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} onClick={() => setSelectedPlan(plan.id)} style={{ minHeight: 155, padding: 17, textAlign: "left", borderRadius: 16, border: `1px solid ${selected ? "#8B7AFF" : theme.border}`, background: selected ? "rgba(139,122,255,.10)" : "transparent", color: theme.text, fontFamily: APP_FONT, cursor: "pointer", transition: "border-color .25s ease, background .25s ease" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.name}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 12 }}>
                      <strong style={{ fontSize: 30, fontWeight: 600 }}>€{plan[billingInterval]}</strong>
                      <span style={{ fontSize: 10, color: theme.textDim }}>/ {de ? "Monat" : "month"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: theme.textDim, lineHeight: 1.45, marginTop: 10 }}>{plan.description}</div>
                  </motion.button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 20 }}>
              <div style={{ fontSize: 11, color: theme.textDim }}>
                {!isAdmin && (de ? "Nur Workspace-Admins können ein Abo abschließen." : "Only workspace admins can start a subscription.")}
              </div>
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={startCheckout} disabled={!isAdmin || Boolean(action) || loading} style={{ padding: "11px 20px", border: 0, borderRadius: 12, background: "#8B7AFF", color: "#fff", fontFamily: APP_FONT, fontSize: 13, fontWeight: 600, cursor: !isAdmin || action || loading ? "not-allowed" : "pointer", opacity: !isAdmin || action || loading ? 0.55 : 1 }}>
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
