import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(
  import.meta.env?.VITE_SUPABASE_ANON_KEY || ""
).trim();

/** Only https, or http on a local loopback host during development. */
const isUsableSupabaseUrl = (value) => {
  try {
    const parsed = new URL(value);
    const isLocalLoopback =
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
    return Boolean(parsed.hostname) && (parsed.protocol === "https:" || isLocalLoopback);
  } catch {
    return false;
  }
};

let configuredClient = null;
let initializationError = null;
if (supabaseUrl && supabaseAnonKey && isUsableSupabaseUrl(supabaseUrl)) {
  try {
    configuredClient =
      globalThis.__taskflowSupabaseClient ||
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
export const isSupabaseConfigured = Boolean(supabase);

export const requireSupabase = () => {
  if (!supabase) {
    throw (
      initializationError ||
      new Error(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      )
    );
  }

  return supabase;
};

export const throwIfError = (error) => {
  if (error) throw error;
};

/**
 * The signed-in user's id, read from the locally cached session so writes that
 * must stamp `auth.uid()` themselves (comments, invitation responses) cost no
 * extra round trip.
 */
export const currentUserId = async () => {
  const { data, error } = await requireSupabase().auth.getSession();
  throwIfError(error);
  return data?.session?.user?.id || null;
};

/** Subscribes to postgres changes on one table. Returns an unsubscribe. */
export const subscribeToTable = ({ channel, table, filter, onChange, onStatus }) => {
  const database = requireSupabase();
  const subscription = database
    .channel(channel)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
      onChange
    )
    .subscribe(onStatus);
  return () => void database.removeChannel(subscription);
};
