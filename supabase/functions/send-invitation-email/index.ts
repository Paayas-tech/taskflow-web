import { withSupabase } from "npm:@supabase/server";

const jsonHeaders = { "Content-Type": "application/json" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedRoles = new Set(["editor", "viewer"]);

const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const response = (request: Request, status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), ...jsonHeaders },
  });

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);

const authenticatedHandler = withSupabase(
  { auth: "user" },
  async (request, context) => {
  if (request.method !== "POST") {
    return response(request, 405, { success: false });
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return response(request, 400, { success: false });
  }

  const projectId = String(input.projectId || "").trim();
  const inviteeEmail = String(input.inviteeEmail || "").trim().toLowerCase();
  const role = String(input.role || "editor").trim().toLowerCase();
  const suppliedInviterName = String(input.inviterName || "").trim().slice(0, 80);

  if (
    !uuidPattern.test(projectId) ||
    inviteeEmail.length > 320 ||
    !emailPattern.test(inviteeEmail) ||
    !allowedRoles.has(role)
  ) {
    return response(request, 400, { success: false });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return response(request, 503, { success: false });
  }

  const callerId = String(
    context.userClaims?.id || context.jwtClaims?.sub || ""
  );
  if (!callerId) {
    return response(request, 401, { success: false });
  }

  const { data: project, error: projectError } = await context.supabase
    .from("projects")
    .select("id, name, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return response(request, 500, { success: false });
  }
  if (!project || project.owner_id !== callerId) {
    return response(request, 403, { success: false });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: insertedInvitation, error: invitationError } = await context.supabase
    .from("project_invitations")
    .insert({
      project_id: projectId,
      email: inviteeEmail,
      email_normalized: inviteeEmail,
      role,
      inviter_id: callerId,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  let invitation = insertedInvitation;
  let createdInvitation = Boolean(insertedInvitation);
  if (invitationError?.code === "23505") {
    const { data: pendingInvitation, error: pendingError } = await context.supabase
      .from("project_invitations")
      .select("id")
      .eq("project_id", projectId)
      .eq("email_normalized", inviteeEmail)
      .eq("status", "pending")
      .maybeSingle();
    if (pendingError || !pendingInvitation) {
      return response(request, 500, { success: false });
    }
    invitation = pendingInvitation;
    createdInvitation = false;
  } else if (invitationError || !invitation) {
    return response(request, 500, { success: false });
  }

  const projectName = String(project.name || "your project").trim().slice(0, 120);
  const inviterName = suppliedInviterName;
  const inviterSentence = inviterName
    ? `${escapeHtml(inviterName)} invited you to collaborate.`
    : "A TaskFlow project owner invited you to collaborate.";
  const plainInviterSentence = inviterName
    ? `${inviterName} invited you to collaborate.`
    : "A TaskFlow project owner invited you to collaborate.";

  let emailSent = false;
  try {
    const resendResult = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "TaskFlow <noreply@mail.bohaus.in>",
        to: [inviteeEmail],
        subject: "You've been invited to join a project on TaskFlow",
        text: `${plainInviterSentence}\n\nProject: ${projectName}\n\nSign in or create a TaskFlow account using this email address, then open Projects to accept the pending invitation.`,
        html: `<p>${inviterSentence}</p><p><strong>Project:</strong> ${escapeHtml(projectName)}</p><p>Sign in or create a TaskFlow account using this email address, then open <strong>Projects</strong> to accept the pending invitation.</p>`,
      }),
    });
    emailSent = resendResult.ok;
  } catch {
    emailSent = false;
  }

  if (!emailSent && createdInvitation) {
    await context.supabase
      .from("project_invitations")
      .delete()
      .eq("id", invitation.id)
      .eq("project_id", projectId);
  }
  if (!emailSent) return response(request, 502, { success: false });

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
