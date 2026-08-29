import { createClient } from "npm:@supabase/supabase-js";
import { withSupabase } from "npm:@supabase/server";

const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const response = (request: Request, status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });

const authenticatedHandler = withSupabase(
  { auth: "user" },
  async (request, context) => {
    if (request.method !== "POST") {
      return response(request, 405, { success: false });
    }

    const callerId = String(context.userClaims?.id || context.jwtClaims?.sub || "");
    if (!callerId) {
      return response(request, 401, { success: false });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return response(request, 503, { success: false });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.auth.admin.deleteUser(callerId);
    if (error) {
      console.error("Account deletion failed", error.code || error.message);
      return response(request, 500, { success: false });
    }

    return response(request, 200, { success: true });
  }
);

export default {
  fetch(request: Request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    return authenticatedHandler(request);
  },
};

