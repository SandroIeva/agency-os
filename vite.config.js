import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // This project is a linked Vercel project (.vercel/repo.json). `vercel dev`
      // periodically rewrites .env.local to sync env vars, which touches its
      // mtime every few minutes even with no real content change. Vite's default
      // behavior is to restart the whole dev server on any .env.local change,
      // and a request that lands mid-restart gets a crashed/empty response —
      // ignoring this file for the watcher keeps `npm run dev:vercel` stable.
      // (Vite only reads env files once at server start, so genuinely editing
      // VITE_-prefixed vars here still needs a manual restart — server-only vars
      // like API keys never reach client code anyway.)
      ignored: ["**/.env.local"],
    },
  },
});
