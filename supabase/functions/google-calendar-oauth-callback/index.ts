import {
  adminClient,
  appRedirect,
  decryptSecret,
  encryptSecret,
  googleApi,
  googleTokenRequest,
  requiredEnvironment,
  sha256UrlSafe,
} from "../_shared/googleCalendar.ts";
import { isUsableOAuthState } from "../_shared/googleCalendarCore.ts";

export default {
  async fetch(request: Request) {
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    const url = new URL(request.url);
    const code = String(url.searchParams.get("code") || "");
    const state = String(url.searchParams.get("state") || "");
    if (!code || !state || url.searchParams.has("error")) return appRedirect("error", "authorization_denied");

    try {
      const admin = adminClient();
      const stateHash = await sha256UrlSafe(state);
      const { data: storedState, error: stateError } = await admin
        .rpc("consume_google_calendar_oauth_state", { p_state_hash: stateHash })
        .maybeSingle();
      if (stateError || !isUsableOAuthState(storedState)) {
        return appRedirect("error", "invalid_or_expired_state");
      }

      const tokens = await googleTokenRequest(new URLSearchParams({
        client_id: requiredEnvironment("GOOGLE_CLIENT_ID"),
        client_secret: requiredEnvironment("GOOGLE_CLIENT_SECRET"),
        code,
        code_verifier: await decryptSecret(storedState.code_verifier_ciphertext),
        grant_type: "authorization_code",
        redirect_uri: requiredEnvironment("GOOGLE_REDIRECT_URI"),
      }));
      if (!tokens.refresh_token) throw new Error("Google did not return a refresh token");
      const profile = await googleApi("https://openidconnect.googleapis.com/v1/userinfo", tokens.access_token);
      const scopes = String(tokens.scope || "").split(/\s+/u).filter(Boolean);
      const { error: credentialError } = await admin.rpc("store_google_calendar_credentials", {
        p_user_id: storedState.user_id,
        p_calendar_account_email: String(profile.email || ""),
        p_scopes: scopes,
        p_access_token_ciphertext: await encryptSecret(tokens.access_token),
        p_refresh_token_ciphertext: await encryptSecret(tokens.refresh_token),
        p_expires_at: new Date(Date.now() + Math.max(60, Number(tokens.expires_in || 3600)) * 1000).toISOString(),
      });
      if (credentialError) throw credentialError;
      return appRedirect("connected");
    } catch (error) {
      console.error("Google OAuth callback failed", error);
      return appRedirect("error", "connection_failed");
    }
  },
};
