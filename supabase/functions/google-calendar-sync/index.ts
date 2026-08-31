import { withSupabase } from "npm:@supabase/server";
import {
  GOOGLE_PROVIDER,
  adminClient,
  corsHeaders,
  decryptSecret,
  encryptSecret,
  googleApi,
  googleTokenRequest,
  jsonResponse,
  requiredEnvironment,
} from "../_shared/googleCalendar.ts";
import { collectGooglePages, normalizeGoogleEvent } from "../_shared/googleCalendarCore.ts";

const handler = withSupabase({ auth: "user" }, async (request, context) => {
  if (request.method !== "POST") return jsonResponse(request, 405, { success: false });
  const userId = String(context.userClaims?.id || context.jwtClaims?.sub || "");
  if (!userId) return jsonResponse(request, 401, { success: false });

  const admin = adminClient();
  const { data: connection, error: connectionError } = await admin
    .from("user_calendar_connections")
    .select("id, calendar_account_email")
    .eq("user_id", userId)
    .eq("provider", GOOGLE_PROVIDER)
    .maybeSingle();
  if (connectionError || !connection) {
    return jsonResponse(request, 404, { success: false, message: "Connect Google Calendar first." });
  }

  await admin.from("user_calendar_connections").update({ sync_status: "syncing", sync_error: null }).eq("id", connection.id);
  try {
    const { data: storedTokens, error: tokenError } = await admin
      .rpc("get_google_calendar_tokens", { p_connection_id: connection.id })
      .single();
    if (tokenError || !storedTokens) throw new Error("Stored Google authorization is unavailable");

    let accessToken = await decryptSecret(storedTokens.access_token_ciphertext);
    if (new Date(storedTokens.expires_at).getTime() <= Date.now() + 60_000) {
      if (!storedTokens.refresh_token_ciphertext) throw new Error("Google authorization has expired");
      const refreshed = await googleTokenRequest(new URLSearchParams({
        client_id: requiredEnvironment("GOOGLE_CLIENT_ID"),
        client_secret: requiredEnvironment("GOOGLE_CLIENT_SECRET"),
        refresh_token: await decryptSecret(storedTokens.refresh_token_ciphertext),
        grant_type: "refresh_token",
      }));
      accessToken = refreshed.access_token;
      const { error: refreshError } = await admin.rpc("update_google_calendar_access_token", {
        p_connection_id: connection.id,
        p_access_token_ciphertext: await encryptSecret(accessToken),
        p_expires_at: new Date(Date.now() + Math.max(60, Number(refreshed.expires_in || 3600)) * 1000).toISOString(),
      });
      if (refreshError) throw refreshError;
    }

    const calendarItems = await collectGooglePages(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&showDeleted=false",
      (url) => googleApi(url, accessToken),
    );
    const calendars = calendarItems
      .filter((calendar: Record<string, any>) => !calendar.deleted)
      .map((calendar: Record<string, any>) => ({
        id: String(calendar.id || ""),
        name: String(calendar.summary || calendar.id || "Calendar"),
        primary: Boolean(calendar.primary),
        selected: calendar.selected !== false,
        accessRole: String(calendar.accessRole || "reader"),
        backgroundColor: String(calendar.backgroundColor || ""),
      }));

    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const events: Record<string, unknown>[] = [];
    for (const calendar of calendars.filter(({ selected }) => selected)) {
      const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
      eventsUrl.searchParams.set("timeMin", timeMin);
      eventsUrl.searchParams.set("timeMax", timeMax);
      eventsUrl.searchParams.set("singleEvents", "true");
      eventsUrl.searchParams.set("orderBy", "startTime");
      eventsUrl.searchParams.set("maxResults", "250");
      const eventItems = await collectGooglePages(eventsUrl.toString(), (url) => googleApi(url, accessToken));
      for (const event of eventItems) {
        if (event.status !== "cancelled") events.push(normalizeGoogleEvent(event, calendar));
      }
    }

    const lastSyncedAt = new Date().toISOString();
    const { error: updateError } = await admin.from("user_calendar_connections").update({
      last_synced_at: lastSyncedAt,
      sync_status: "success",
      sync_error: null,
    }).eq("id", connection.id);
    if (updateError) throw updateError;

    return jsonResponse(request, 200, {
      success: true,
      calendars,
      events,
      range: { start: timeMin, end: timeMax },
      lastSyncedAt,
    });
  } catch (error) {
    console.error("Google Calendar sync failed", error);
    await admin.from("user_calendar_connections").update({
      sync_status: "error",
      sync_error: "Google Calendar could not be synced. Reconnect if this continues.",
    }).eq("id", connection.id);
    return jsonResponse(request, 502, {
      success: false,
      message: "Google Calendar could not be synced. Reconnect if this continues.",
    });
  }
});

export default {
  fetch(request: Request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    return handler(request);
  },
};
