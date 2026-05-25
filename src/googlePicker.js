// Google Picker — lets the user explicitly select files from their Drive
// without us needing the broad `drive` scope. After selection, our app has
// per-file access via the `drive.file` scope.
//
// Requires the global `gapi` loaded from https://apis.google.com/js/api.js
// (included in index.html).

const VITE_GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";
const VITE_GOOGLE_APP_ID  = import.meta.env.VITE_GOOGLE_APP_ID  || "";

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
