import { requireSupabase, throwIfError } from "./client";

const CONNECTION_SELECT = `id, provider, calendar_account_email, scopes,
  last_synced_at, sync_status, sync_error, created_at, updated_at`;

/** Edge-function errors carry their message in the response body. */
const friendlyFunctionError = async (error, fallback) => {
  try {
    const payload = await error?.context?.json?.();
    if (payload?.message) return new Error(payload.message);
  } catch {
    // Fall through to the safe deployment-aware message below.
  }
  const status = Number(error?.context?.status || error?.status || 0);
  if (
    status === 404 ||
    /relay|fetch|not found/i.test(String(error?.name || error?.message || ""))
  ) {
    return new Error(
      "Google Calendar is not configured for this TaskFlow environment yet."
    );
  }
  return new Error(fallback);
};

export const getGoogleConnection = async () => {
  const { data, error } = await requireSupabase()
    .from("user_calendar_connections")
    .select(CONNECTION_SELECT)
    .eq("provider", "google")
    .maybeSingle();
  throwIfError(error);
  return data || null;
};

export const startGoogleOAuth = async () => {
  const { data, error } = await requireSupabase().functions.invoke(
    "google-calendar-oauth-start",
    { body: {} }
  );
  if (error) {
    throw await friendlyFunctionError(
      error,
      "Google Calendar connection could not be started."
    );
  }
  if (!data?.authorizationUrl) {
    throw new Error("Google Calendar connection could not be started.");
  }

  const authorizationUrl = new URL(data.authorizationUrl);
  if (
    authorizationUrl.protocol !== "https:" ||
    authorizationUrl.hostname !== "accounts.google.com"
  ) {
    throw new Error(
      "Google Calendar connection returned an invalid authorization address."
    );
  }
  return authorizationUrl.toString();
};

export const syncGoogleCalendar = async () => {
  const { data, error } = await requireSupabase().functions.invoke(
    "google-calendar-sync",
    { body: {} }
  );
  if (error) {
    throw await friendlyFunctionError(error, "Google Calendar could not be synced.");
  }
  return data;
};

export const disconnectGoogleCalendar = async () => {
  const { data, error } = await requireSupabase().functions.invoke(
    "google-calendar-disconnect",
    { body: {} }
  );
  if (error) {
    throw await friendlyFunctionError(
      error,
      "Google Calendar could not be disconnected."
    );
  }
  return data;
};
