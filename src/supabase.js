import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://oidbemeetiawiahpweyg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZGJlbWVldGlhd2lhaHB3ZXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTA2ODAsImV4cCI6MjA5NDE4NjY4MH0.dTE2Yv1OgBS1k4oucHhVKKrUe4U31szqhtuW4dchM9M";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // Realtime drops anything above this rate SILENTLY, client-side, and the
  // default is 10/s. Live cursors alone want about ten, and a board being
  // edited is sending item updates through the same budget — at the default,
  // the first cursor position arrived and every one after it vanished with no
  // error anywhere. Twenty leaves room for both.
  realtime: { params: { eventsPerSecond: 20 } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "agencyos-supabase-auth",
  },
});
