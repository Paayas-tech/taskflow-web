import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(
  import.meta.env?.VITE_SUPABASE_ANON_KEY || ""
).trim();

export const validateSupabaseBrowserConfiguration = ({ url, anonKey }) => {
  const normalizedUrl = String(url || "").trim();
  const normalizedKey = String(anonKey || "").trim();
  const issues = [];

  if (!normalizedUrl) {
    issues.push("missing_url");
  } else {
    try {
      const parsedUrl = new URL(normalizedUrl);
      const isLocalLoopback =
        parsedUrl.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(parsedUrl.hostname);
      if (
        !parsedUrl.hostname ||
        (parsedUrl.protocol !== "https:" && !isLocalLoopback)
      ) {
        issues.push("invalid_url");
      }
    } catch {
      issues.push("invalid_url");
    }
  }

  if (!normalizedKey) issues.push("missing_key");

  return {
    valid: issues.length === 0,
    issues,
  };
};

export const supabaseConfiguration = validateSupabaseBrowserConfiguration({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
});
export const hasSupabaseEnvironment = supabaseConfiguration.valid;

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
