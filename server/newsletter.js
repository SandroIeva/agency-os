// Only explicit preference changes call this. Never resubscribe on login.
const LIST_NAME = "i7OS Product Updates";

export async function saveNewsletterPreference({ user, body, admin, fetchImpl = fetch, env = process.env }) {
  if (!user?.id || !user.email || !user.email_confirmed_at) {
    return { status: 401, error: "Verified account required" };
  }
  const { subscribed, source } = body || {};
  if (typeof subscribed !== "boolean" || !["tour", "dialog", "settings"].includes(source)) {
    return { status: 400, error: "Invalid preference" };
  }
  // Record the decision before contacting the processor, especially withdrawals.
  const { data: profile, error } = await admin.from("profiles").update({
    marketing_opt_in: subscribed,
    marketing_opt_in_at: new Date().toISOString(),
    marketing_opt_in_source: source,
  }).eq("id", user.id).select("id, display_name").single();
  if (error || !profile) return { status: 500, error: "Preference could not be saved", saved: false };

  try {
    if (!env.LOOPS_API_KEY) throw new Error("not_configured");
    const request = async (path, method = "GET", payload) => {
      const response = await fetchImpl(`https://app.loops.so/api/v1/${path}`, {
        method,
        headers: { Authorization: `Bearer ${env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(8000),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) throw new Error("loops_request_failed");
      return data;
    };
    // Declining must not create a contact. Find by trusted account identity only.
    if (!subscribed) {
      const contacts = await request(`contacts/find?email=${encodeURIComponent(user.email)}`);
      if (!Array.isArray(contacts)) throw new Error("invalid_contacts_response");
      if (!contacts.length) return { status: 200, success: true, subscribed, saved: true };
    }
    let listId = env.LOOPS_PRODUCT_UPDATES_LIST_ID;
    if (!listId) {
      const lists = await request("lists");
      const matches = Array.isArray(lists) ? lists.filter(list => list.name === LIST_NAME) : [];
      if (matches.length !== 1) throw new Error("mailing_list_not_found_or_ambiguous");
      listId = matches[0].id;
    }
    const names = String(profile.display_name || "").trim().split(/\s+/);
    await request("contacts/update", "PUT", {
      email: user.email,
      userId: user.id,
      // Only a new, explicit YES may override a global unsubscribe.
      ...(subscribed ? { subscribed: true, ...(names[0] ? { firstName: names[0], lastName: names.slice(1).join(" ") } : {}) } : {}),
      mailingLists: { [listId]: subscribed },
    });
    return { status: 200, success: true, subscribed, saved: true };
  } catch {
    // No provider payloads or tokens in logs/responses. The UI offers retry.
    return { status: 502, error: "Preference saved, mailing list sync failed", saved: true, subscribed };
  }
}
