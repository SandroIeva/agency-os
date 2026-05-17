import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://oidbemeetiawiahpweyg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZGJlbWVldGlhd2lhaHB3ZXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTA2ODAsImV4cCI6MjA5NDE4NjY4MH0.dTE2Yv1OgBS1k4oucHhVKKrUe4U31szqhtuW4dchM9M";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "agencyos-supabase-auth",
  },
});
