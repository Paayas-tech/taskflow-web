import { withSupabase } from "npm:@supabase/server";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_IDENTITY_SCOPES,
  adminClient,
  corsHeaders,
  encryptSecret,
  jsonResponse,
  randomUrlSafeValue,
  requiredEnvironment,
  sha256UrlSafe,
} from "../_shared/googleCalendar.ts";

const handler = withSupabase({ auth: "user" }, async (request, context) => {
  if (request.method !== "POST") return jsonResponse(request, 405, { success: false });
  const userId = String(context.userClaims?.id || context.jwtClaims?.sub || "");
  if (!userId) return jsonResponse(request, 401, { success: false });

  try {
    const state = randomUrlSafeValue(32);
    const verifier = randomUrlSafeValue(64);
    const admin = adminClient();
    const { error } = await admin.rpc("store_google_calendar_oauth_state", {
      p_state_hash: await sha256UrlSafe(state),
      p_user_id: userId,
      p_code_verifier_ciphertext: await encryptSecret(verifier),
      p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw error;

    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.searchParams.set("client_id", requiredEnvironment("GOOGLE_CLIENT_ID"));
    authorization.searchParams.set("redirect_uri", requiredEnvironment("GOOGLE_REDIRECT_URI"));
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("scope", [...GOOGLE_IDENTITY_SCOPES, GOOGLE_CALENDAR_SCOPE].join(" "));
    authorization.searchParams.set("access_type", "offline");
    authorization.searchParams.set("prompt", "consent");
    authorization.searchParams.set("include_granted_scopes", "true");
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("code_challenge", await sha256UrlSafe(verifier));
    authorization.searchParams.set("code_challenge_method", "S256");

    return jsonResponse(request, 200, { success: true, authorizationUrl: authorization.toString() });
  } catch (error) {
    console.error("Google OAuth start failed", error);
    return jsonResponse(request, 503, { success: false, message: "Google Calendar is not configured yet." });
  }
});

export default {
  fetch(request: Request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    return handler(request);
  },
};
