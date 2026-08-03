import React from "react";
import ReactDOM from "react-dom/client";
import App, { AppErrorBoundary } from "./App";
import DesktopView from "./DesktopView";
import PublicBrandLanding from "./PublicBrandLanding";
import AdminView from "./AdminView";

const params = new URLSearchParams(window.location.search);
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
