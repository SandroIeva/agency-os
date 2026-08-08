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

function showThirdPartyCookieHint(locale) {
  if (!isFirefox() || typeof document === "undefined") return () => {};
  const de = locale === "de";
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.style.cssText = [
    "position:fixed", "left:50%", "bottom:24px", "transform:translateX(-50%)",
    "z-index:2147483647", "max-width:min(520px,92vw)", "box-sizing:border-box",
    "padding:12px 16px", "border-radius:13px", "background:#15151c", "color:#fff",
    "font:400 12.5px/1.55 'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 16px 44px rgba(0,0,0,0.34)", "border:1px solid rgba(255,255,255,0.12)",
  ].join(";");
  el.textContent = de
    ? "Zeigt Google hier einen Fehler zum „Entwicklerschlüssel“? Das ist Firefox’ Schutz vor Aktivitätenverfolgung — er trennt die Google-Sitzung ab. Schild-Symbol links in der Adresszeile → „Schutz für diese Website deaktivieren“. Oder die Datei direkt hochladen, das ist davon nicht betroffen."
    : "Is Google showing a “developer key” error? That is Firefox’s tracking protection cutting off the Google session. Click the shield in the address bar → “Turn off protection for this site”. Or upload the file directly — that path is unaffected.";
  document.body.appendChild(el);
  return () => { try { el.remove(); } catch (_) {} };
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
  const hideHint = showThirdPartyCookieHint(locale);
  try {
    return await openGooglePickerInner({ accessToken, locale, multi, mimeTypes });
  } finally {
    hideHint();
  }
}

async function openGooglePickerInner({ accessToken, locale = "en", multi = false, mimeTypes } = {}) {
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
  const hideHint = showThirdPartyCookieHint(locale);
  try {
    return await openGoogleFolderPickerInner({ accessToken, locale });
  } finally {
    hideHint();
  }
}

async function openGoogleFolderPickerInner({ accessToken, locale = "en" } = {}) {
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
        .setTitle(locale === "de" ? "Ordner für i7 OS auswählen" : "Select folder for i7 OS")
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
      picker.setVisible(true);
    } catch (e) {
      reject(e);
    }
  });
}
