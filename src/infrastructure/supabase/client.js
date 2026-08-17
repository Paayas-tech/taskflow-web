import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(
  import.meta.env?.VITE_SUPABASE_ANON_KEY || ""
).trim();

export const hasSupabaseEnvironment = Boolean(supabaseUrl && supabaseAnonKey);

let configuredClient = null;
let initializationError = null;
if (hasSupabaseEnvironment) {
  try {
    const existingClient = globalThis.__taskflowSupabaseClient;
    configuredClient =
      existingClient ||
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
    globalThis.__taskflowSupabaseClient = configuredClient;
  } catch (error) {
    initializationError = error;
  }
}

export const supabase = configuredClient;
export const supabaseInitializationError = initializationError;
export const isSupabaseConfigured = Boolean(supabase);

export const requireSupabase = () => {
  if (!supabase) {
    throw (
      supabaseInitializationError ||
      new Error(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      )
    );
  }

  return supabase;
};
