import { requireSupabase } from "../infrastructure/supabase/client";

const friendlyFunctionError = async (error, fallback) => {
  try {
    const payload = await error?.context?.json?.();
    if (payload?.message) return new Error(payload.message);
  } catch {
    // Fall through to the safe deployment-aware message below.
  }
  const status = Number(error?.context?.status || error?.status || 0);
  if (status === 404 || /relay|fetch|not found/i.test(String(error?.name || error?.message || ""))) {
    return new Error("Google Calendar is not configured for this TaskFlow environment yet.");
  }
  return new Error(fallback);
};

export const createGoogleCalendarIntegrationService = (client = null) => {
  const database = () => client || requireSupabase();
  return {
    async getConnection() {
      const { data, error } = await database()
        .from("user_calendar_connections")
        .select("id, provider, calendar_account_email, scopes, last_synced_at, sync_status, sync_error, created_at, updated_at")
        .eq("provider", "google")
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },

    async startOAuth() {
      const { data, error } = await database().functions.invoke("google-calendar-oauth-start", {
        body: {},
      });
      if (error) throw await friendlyFunctionError(error, "Google Calendar connection could not be started.");
      if (!data?.authorizationUrl) throw new Error("Google Calendar connection could not be started.");
      const authorizationUrl = new URL(data.authorizationUrl);
      if (authorizationUrl.protocol !== "https:" || authorizationUrl.hostname !== "accounts.google.com") {
        throw new Error("Google Calendar connection returned an invalid authorization address.");
      }
      return authorizationUrl.toString();
    },

    async sync() {
      const { data, error } = await database().functions.invoke("google-calendar-sync", {
        body: {},
      });
      if (error) throw await friendlyFunctionError(error, "Google Calendar could not be synced.");
      return data;
    },

    async disconnect() {
      const { data, error } = await database().functions.invoke("google-calendar-disconnect", {
        body: {},
      });
      if (error) throw await friendlyFunctionError(error, "Google Calendar could not be disconnected.");
      return data;
    },
  };
};

export const googleCalendarIntegrationService = createGoogleCalendarIntegrationService();
