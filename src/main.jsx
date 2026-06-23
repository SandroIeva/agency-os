import React from "react";
import ReactDOM from "react-dom/client";
import App, { AppErrorBoundary } from "./App";
import DesktopView from "./DesktopView";
import PublicBrandLanding from "./PublicBrandLanding";

const params = new URLSearchParams(window.location.search);
const isDesktopPreview = params.has("desktop");
const brandToken = params.get("b"); // ?b=<token> (public share) or ?b=preview

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {brandToken ? <PublicBrandLanding token={brandToken} />
        : isDesktopPreview ? <DesktopView />
        : <App />}
    </AppErrorBoundary>
  </React.StrictMode>
);
