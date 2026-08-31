import { withSupabase } from "npm:@supabase/server";
import {
  GOOGLE_PROVIDER,
  adminClient,
  corsHeaders,
  decryptSecret,
  jsonResponse,
} from "../_shared/googleCalendar.ts";

const handler = withSupabase({ auth: "user" }, async (request, context) => {
  if (request.method !== "POST") return jsonResponse(request, 405, { success: false });
  const userId = String(context.userClaims?.id || context.jwtClaims?.sub || "");
  if (!userId) return jsonResponse(request, 401, { success: false });

  try {
    const admin = adminClient();
    const { data: connection, error: connectionError } = await admin
      .from("user_calendar_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", GOOGLE_PROVIDER)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return jsonResponse(request, 200, { success: true, revoked: false });

    const { data: storedTokens } = await admin
      .rpc("get_google_calendar_tokens", { p_connection_id: connection.id })
      .maybeSingle();

    let revoked = false;
    try {
      const encryptedToken = storedTokens?.refresh_token_ciphertext || storedTokens?.access_token_ciphertext;
      if (encryptedToken) {
        const token = await decryptSecret(encryptedToken);
        const revokeResponse = await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );
        revoked = revokeResponse.ok;
      }
    } catch (error) {
      console.warn("Google token revocation could not be confirmed", error);
    }

    const { error: deleteError } = await admin
      .from("user_calendar_connections")
      .delete()
      .eq("id", connection.id)
      .eq("user_id", userId);
    if (deleteError) throw deleteError;
    return jsonResponse(request, 200, { success: true, revoked });
  } catch (error) {
    console.error("Google Calendar disconnect failed", error);
    return jsonResponse(request, 500, {
      success: false,
      message: "Google Calendar could not be disconnected. Please try again.",
    });
  }
});

export default {
  fetch(request: Request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    return handler(request);
  },
};
