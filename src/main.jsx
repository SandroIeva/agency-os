import React from "react";
import ReactDOM from "react-dom/client";
import App, { AppErrorBoundary } from "./App";
import DesktopView from "./DesktopView";
import PublicBrandLanding from "./PublicBrandLanding";
import AdminView from "./AdminView";

const params = new URLSearchParams(window.location.search);

// A Zernio OAuth that was started in a popup ends here, in that popup. Tell the
// window that opened it and close, BEFORE React boots: the popup only ever
// existed to hold the consent screen, and booting the whole app inside it to
// discover that is a second copy of the workspace loading for nothing.
//
// Only when there is an opener. The same return url is also reached by the
// full-page redirect, which is the fallback when a popup is blocked, and that
// one has to boot the app because it IS the app.
if (params.get("zernio") === "connected" && window.opener && !window.opener.closed) {
  try {
    window.opener.postMessage({ type: "zernio-connected", platform: params.get("connected") || null }, window.location.origin);
  } catch (_) { /* different origin, nothing to tell */ }
  window.close();
}

const isDesktopPreview = params.has("desktop");
const isAdmin = params.has("admin"); // internal operator overview
const brandToken = params.get("b"); // ?b=<token> (public share) or ?b=preview

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {brandToken ? <PublicBrandLanding token={brandToken} />
        : isAdmin ? <AdminView />
        : isDesktopPreview ? <DesktopView />
        : <App />}
    </AppErrorBoundary>
  </React.StrictMode>
);
