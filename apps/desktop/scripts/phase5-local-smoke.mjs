import { createClient } from "@supabase/supabase-js";

const url = String(process.env.SUPABASE_URL || "");
const anonKey = String(process.env.SUPABASE_ANON_KEY || "");
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
  throw new Error("Phase 5 smoke tests only run against local Supabase.");
}
if (!anonKey || !serviceKey) {
  throw new Error("Local Supabase anon and service-role keys are required.");
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, clientOptions);
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = `Local-only-${suffix}!`;
const accounts = ["owner", "editor", "viewer"].map((role) => ({
  role,
  email: `phase5-${role}-${suffix}@taskflow.local`,
  id: null,
  client: null,
}));
let projectId = null;
const subscriptions = [];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const checked = async (promise, label) => {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const waitFor = async (predicate, label, timeout = 6000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}.`);
};

try {
  for (const account of accounts) {
    const created = await checked(
      admin.auth.admin.createUser({ email: account.email, password, email_confirm: true }),
      `create ${account.role}`
    );
    account.id = created.user.id;
    const loginClient = createClient(url, anonKey, clientOptions);
    const signedIn = await checked(
      loginClient.auth.signInWithPassword({ email: account.email, password }),
      `sign in ${account.role}`
    );
    account.client = createClient(url, anonKey, {
      ...clientOptions,
      global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
    });
    await account.client.realtime.setAuth(signedIn.session.access_token);
  }
  const [owner, editor, viewer] = accounts;

  projectId = crypto.randomUUID();
  await checked(
    owner.client.from("projects").insert({ id: projectId, owner_id: owner.id, name: "Phase 5 local smoke", status: "active" }),
    "create project"
  );
  const columns = await checked(
    owner.client.from("project_columns").insert([
      { project_id: projectId, name: "To Do", category: "todo", position: 0, is_terminal: false },
      { project_id: projectId, name: "In Progress", category: "in_progress", position: 1, is_terminal: false },
      { project_id: projectId, name: "Done", category: "done", position: 2, is_terminal: true },
    ]).select("id, category"),
    "create columns"
  );

  for (const account of [editor, viewer]) {
    const invitation = await checked(
      owner.client.from("project_invitations").insert({
        project_id: projectId,
        email: account.email,
        email_normalized: account.email,
        role: account.role,
        inviter_id: owner.id,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }).select("id").single(),
      `invite ${account.role}`
    );
    await checked(
      account.client.from("project_invitations").update({
        status: "accepted", accepted_by: account.id, accepted_at: new Date().toISOString(),
      }).eq("id", invitation.id),
      `accept ${account.role} invitation`
    );
  }

  const task = await checked(
    owner.client.from("tasks").insert({
      project_id: projectId,
      created_by: owner.id,
      title: "Collaborative launch task",
      status: "todo",
      column_id: columns.find((column) => column.category === "todo").id,
      position: 0,
    }).select("id").single(),
    "create task"
  );

  const editorEvents = [];
  const editorChannel = editor.client.channel(`phase5-editor-${suffix}`).on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${editor.id}` },
    (payload) => editorEvents.push(payload.new)
  ).subscribe();
  subscriptions.push([editor.client, editorChannel]);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime subscription did not become ready.")), 6000);
    editorChannel.on("system", {}, (payload) => {
      if (payload.status === "ok") { clearTimeout(timeout); resolve(); }
    });
  }).catch(() => undefined);

  await checked(
    owner.client.rpc("set_task_assignee", { target_task_id: task.id, target_user_id: editor.id }),
    "assign editor"
  );
  await waitFor(() => editorEvents.some((event) => event.type === "task_assigned"), "realtime assignment notification");

  await checked(
    editor.client.from("task_comments").insert({
      task_id: task.id,
      user_id: editor.id,
      content: `Ready for review @${viewer.id}`,
    }),
    "add comment and mention"
  );
  const viewerNotifications = await checked(
    viewer.client.from("notifications").select("type").eq("task_id", task.id),
    "read viewer notifications"
  );
  assert(viewerNotifications.some((item) => item.type === "mentioned"), "Mention notification was not created.");
  const ownerNotifications = await checked(
    owner.client.from("notifications").select("type").eq("task_id", task.id),
    "read owner notifications"
  );
  assert(ownerNotifications.some((item) => item.type === "comment_added"), "Comment notification was not created.");

  const activity = await checked(
    viewer.client.from("activity_events").select("event_type").eq("project_id", projectId),
    "read activity"
  );
  assert(activity.some((item) => item.event_type === "task_assigned"), "Assignment activity was not recorded.");
  assert(activity.some((item) => item.event_type === "comment_added"), "Comment activity was not recorded.");

  const viewerUpdate = await viewer.client.from("tasks").update({ title: "Blocked viewer edit" }).eq("id", task.id).select("id");
  assert(!viewerUpdate.error && viewerUpdate.data.length === 0, "Viewer unexpectedly edited a task.");

  await checked(
    owner.client.from("project_members").delete().eq("project_id", projectId).eq("user_id", editor.id),
    "remove editor"
  );
  const assignmentAfterRemoval = await checked(
    owner.client.from("task_assignments").select("id").eq("task_id", task.id),
    "verify assignment cleanup"
  );
  assert(assignmentAfterRemoval.length === 0, "Removed member assignment was not cleared.");
  const editorTasks = await checked(
    editor.client.from("tasks").select("id").eq("project_id", projectId),
    "verify removed member access"
  );
  assert(editorTasks.length === 0, "Removed member retained project task access.");

  console.log("Phase 5 local collaboration smoke test passed (3 users, RLS, realtime, cleanup).");
} finally {
  for (const [client, channel] of subscriptions) await client.removeChannel(channel);
  if (projectId && accounts[0].id) {
    await accounts[0].client.from("projects").delete().eq("id", projectId);
  }
  for (const account of accounts) {
    if (account.id) await admin.auth.admin.deleteUser(account.id);
  }
}
