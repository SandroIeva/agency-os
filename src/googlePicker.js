// Google Picker — lets the user explicitly select files from their Drive
// without us needing the broad `drive` scope. After selection, our app has
// per-file access via the `drive.file` scope.
//
// Requires the global `gapi` loaded from https://apis.google.com/js/api.js
// (included in index.html).

const VITE_GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";
const VITE_GOOGLE_APP_ID  = import.meta.env.VITE_GOOGLE_APP_ID  || "";

// The origin the Picker is embedded in. Google validates this, and without an
// explicit value the Picker infers it from the embedding window — which browsers
// expose differently, and when it comes out wrong the Picker reports "the API
// developer key is invalid" even though the key is fine. Setting it removes the
// guesswork. window.location.origin includes protocol, host and port; the Picker
// wants exactly that form.
const pickerOrigin = () =>
  (typeof window !== "undefined" && window.location)
    ? `${window.location.protocol}//${window.location.host}`
    : undefined;

// Firefox isolates third-party storage per site ("Total Cookie Protection"), and
// the Picker runs in an iframe from docs.google.com that needs the user's Google
// session. When it cannot reach it, the Picker shows "the API developer key is
// invalid" — a message about something entirely different, inside Google's own
// iframe, where we can neither catch it nor correct it.
//
// So the note goes next to the picker rather than inside it. It lives here, in
// the module, so every caller gets it without each one re-implementing it, and
// it disappears when the picker does.
const isFirefox = () => typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);

// A way out of the picker that does not depend on the picker.
//
// Google renders its own error page inside the iframe when something upsets it —
// most reliably Firefox's tracking protection, which isolates the Google session
// the picker needs and makes it report "the API developer key is invalid". That
// page has no close control, so the overlay became a dead end with no way back
// to the app.
//
// We build the picker, so we hold the reference: this bar sits above it with a
// close button, and Escape does the same. It is attached for every picker, in
// every browser — an error we have not seen yet must not be able to trap anyone
// either. On Firefox it also carries the explanation, since there the cause is
// known and fixable by the user.
function attachPickerEscape({ locale, onCancel }) {
  if (typeof document === "undefined") return () => {};
  const de = locale === "de";
  const bar = document.createElement("div");
  bar.setAttribute("role", "status");
  bar.style.cssText = [
    "position:fixed", "left:50%", "bottom:24px", "transform:translateX(-50%)",
    "z-index:2147483647", "max-width:min(560px,92vw)", "box-sizing:border-box",
    "display:flex", "align-items:center", "gap:14px",
    "padding:12px 12px 12px 16px", "border-radius:13px",
    "background:#15151c", "color:#fff",
    "font:400 12.5px/1.55 'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 16px 44px rgba(0,0,0,0.34)", "border:1px solid rgba(255,255,255,0.12)",
  ].join(";");

  if (isFirefox()) {
    const note = document.createElement("span");
    note.style.cssText = "flex:1;min-width:0";
    note.textContent = de
      ? "Zeigt Google einen Fehler zum „Entwicklerschlüssel“? Das ist Firefox’ Schutz vor Aktivitätenverfolgung — Schild-Symbol in der Adresszeile → „Schutz für diese Website deaktivieren“. Der direkte Datei-Upload ist davon nicht betroffen."
      : "Is Google showing a “developer key” error? That is Firefox’s tracking protection — click the shield in the address bar → “Turn off protection for this site”. Uploading a file directly is unaffected.";
    bar.appendChild(note);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = de ? "Schließen" : "Close";
  btn.style.cssText = [
    "flex-shrink:0", "padding:7px 15px", "border-radius:999px", "border:none",
    "background:#fff", "color:#15151c", "cursor:pointer",
    "font:600 12px 'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ].join(";");
  btn.addEventListener("click", onCancel);
  bar.appendChild(btn);

  // Capture phase: the picker's iframe would otherwise swallow the key.
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } };
  window.addEventListener("keydown", onKey, true);
  document.body.appendChild(bar);

  return () => {
    window.removeEventListener("keydown", onKey, true);
    try { bar.remove(); } catch (_) {}
  };
}

let pickerLoaded = false;
let pickerLoading = null;

function loadPickerOnce() {
  if (pickerLoaded) return Promise.resolve();
  if (pickerLoading) return pickerLoading;
  pickerLoading = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.gapi) {
      reject(new Error("Google API script not loaded yet — try again in a moment"));
      return;
    }
    window.gapi.load("picker", { callback: () => { pickerLoaded = true; resolve(); }, onerror: reject });
  });
  return pickerLoading;
}

/**
 * Open the Google Picker so the user can select one or more files.
 * Resolves with an array of file objects: { id, name, mimeType, sizeBytes, url, iconUrl }.
 * Resolves with an empty array if the user cancels.
 *
 * @param {Object} opts
 * @param {string} opts.accessToken  — the user's Google OAuth access_token (provider_token from Supabase)
 * @param {string} [opts.locale]     — "de" / "en"
 * @param {boolean} [opts.multi]     — allow multi-select
 * @param {string[]} [opts.mimeTypes] — restrict to specific MIME types
 */
export async function openGooglePicker({ accessToken, locale = "en", multi = false, mimeTypes } = {}) {
  return withEscape(locale, [], (register) =>
    openGooglePickerInner({ accessToken, locale, multi, mimeTypes, register }));
}

async function openGooglePickerInner({ accessToken, locale = "en", multi = false, mimeTypes, register } = {}) {
  if (!accessToken) throw new Error("No access token — please sign in with Google first");
  if (!VITE_GOOGLE_API_KEY) throw new Error("VITE_GOOGLE_API_KEY not configured");

  await loadPickerOnce();
  const google = window.google;
  if (!google?.picker) throw new Error("Picker SDK failed to load");

  return new Promise((resolve, reject) => {
    try {
      // Build a "My Drive" view that lets the user navigate and pick.
      const view = new google.picker.DocsView()
        .setOwnedByMe(true)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMode(google.picker.DocsViewMode.LIST);
      if (mimeTypes?.length) view.setMimeTypes(mimeTypes.join(","));

      const builder = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(VITE_GOOGLE_API_KEY)
        .setOrigin(pickerOrigin())
        .setLocale(locale)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
        .setCallback((data) => {
          const Action = google.picker.Action;
          if (data.action === Action.PICKED) {
            const docs = (data.docs || []).map(d => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              sizeBytes: d.sizeBytes ? Number(d.sizeBytes) : null,
              url: d.url,
              iconUrl: d.iconUrl,
              parentId: d.parentId,
              lastEditedUtc: d.lastEditedUtc,
            }));
            resolve(docs);
          } else if (data.action === Action.CANCEL) {
            resolve([]);
          }
        });
      if (multi) builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
      if (VITE_GOOGLE_APP_ID) builder.setAppId(VITE_GOOGLE_APP_ID);

      const picker = builder.build();
      register?.(picker);
      picker.setVisible(true);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Open the Google Picker in *folder-select* mode. Lets the user choose ONE folder
 * from My Drive or any Shared Drive they belong to. The folder ID is then stored
 * so the app can upload/list inside it without going through the Picker again.
 * Resolves with: { id, name, type: 'my_drive' | 'shared_drive', driveId? } or null on cancel.
 */
export async function openGoogleFolderPicker({ accessToken, locale = "en" } = {}) {
  return withEscape(locale, null, (register) =>
    openGoogleFolderPickerInner({ accessToken, locale, register }));
}

// Runs `open` with an escape bar attached. `cancelValue` is what the caller gets
// when the user closes it — the same value a normal cancel produces, so callers
// need no new branch. Whichever settles first wins: a real pick, a real cancel,
// or the way out.
function withEscape(locale, cancelValue, open) {
  let picker = null;
  let detach = () => {};
  const register = (p) => { picker = p; };
  const escaped = new Promise((resolve) => {
    detach = attachPickerEscape({
      locale,
      onCancel: () => {
        try { picker?.setVisible(false); } catch (_) {}
        try { picker?.dispose?.(); } catch (_) {}
        resolve(cancelValue);
      },
    });
  });
  return Promise.race([open(register), escaped]).finally(() => detach());
}

async function openGoogleFolderPickerInner({ accessToken, locale = "en", register } = {}) {
  if (!accessToken) throw new Error("No access token — please sign in with Google first");
  if (!VITE_GOOGLE_API_KEY) throw new Error("VITE_GOOGLE_API_KEY not configured");

  await loadPickerOnce();
  const google = window.google;
  if (!google?.picker) throw new Error("Picker SDK failed to load");

  return new Promise((resolve, reject) => {
    try {
      const FOLDER_MIME = "application/vnd.google-apps.folder";

      // My Drive folders
      const myDriveView = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes(FOLDER_MIME)
        .setMode(google.picker.DocsViewMode.LIST);

      // Shared Drives (Workspace only — auto-hidden for users without)
      const sharedDrivesView = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setEnableDrives(true)
        .setMimeTypes(FOLDER_MIME)
        .setMode(google.picker.DocsViewMode.LIST);

      const builder = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(VITE_GOOGLE_API_KEY)
        .setOrigin(pickerOrigin())
        .setLocale(locale)
        .setTitle(locale === "de" ? "Ordner für i7OS auswählen" : "Select folder for i7OS")
        .addView(myDriveView)
        .addView(sharedDrivesView)
        .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
        .setCallback((data) => {
          const Action = google.picker.Action;
          if (data.action === Action.PICKED) {
            const d = (data.docs || [])[0];
            if (!d) { resolve(null); return; }
            // If a Shared Drive folder was picked, d.driveId is set
            const isShared = !!d.driveId;
            resolve({
              id: d.id,
              name: d.name,
              type: isShared ? "shared_drive" : "my_drive",
              driveId: d.driveId || null,
              url: d.url,
            });
          } else if (data.action === Action.CANCEL) {
            resolve(null);
          }
        });
      if (VITE_GOOGLE_APP_ID) builder.setAppId(VITE_GOOGLE_APP_ID);

      const picker = builder.build();
      register?.(picker);
      picker.setVisible(true);
    } catch (e) {
      reject(e);
    }
  });
}
