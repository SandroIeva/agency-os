import React from "react";
import ReactDOM from "react-dom/client";
import App, { AppErrorBoundary } from "./App";
import DesktopView from "./DesktopView";

const isDesktopPreview = new URLSearchParams(window.location.search).has("desktop");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {isDesktopPreview ? <DesktopView /> : <App />}
    </AppErrorBoundary>
  </React.StrictMode>
);
