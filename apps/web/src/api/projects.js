import { currentUserId, requireSupabase, throwIfError } from "./client";

const LEGACY_PROJECT_SELECT = `
  id, owner_id, name, description, color, status, due_date, archived_at,
  created_at, updated_at
`;

const PROJECT_SELECT = `${LEGACY_PROJECT_SELECT}, health_status`;

const COLUMN_SELECT =
  "id, project_id, name, category, position, is_terminal, created_at";

const MEMBER_SELECT = "project_id, user_id, role, joined_at, added_by";

const INVITATION_SELECT = `id, project_id, email, role, inviter_id, status,
  expires_at, accepted_by, accepted_at, created_at`;

const DEFAULT_COLUMNS = [
  { name: "To Do", category: "todo", position: 0, is_terminal: false },
  { name: "In Progress", category: "in_progress", position: 1, is_terminal: false },
  { name: "Done", category: "done", position: 2, is_terminal: true },
];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isMissingHealthColumn = (error) =>
  ["42703", "PGRST204"].includes(error?.code) &&
  /health_status/i.test(error?.message || "");

let healthColumnSupported = null;

/**
 * Reads project rows using the current schema, then remembers a legacy remote
 * for the rest of the page session. Migration 017 only adds project health;
 * its absence must not make every project feature unavailable.
 */
const readProjectRows = async (buildQuery) => {
  const selection =
    healthColumnSupported === false ? LEGACY_PROJECT_SELECT : PROJECT_SELECT;
  let response = await buildQuery(selection);

  if (selection === PROJECT_SELECT && isMissingHealthColumn(response.error)) {
    healthColumnSupported = false;
    response = await buildQuery(LEGACY_PROJECT_SELECT);
  } else if (!response.error && selection === PROJECT_SELECT) {
    healthColumnSupported = true;
  }

  return {
    ...response,
    healthSupported: healthColumnSupported !== false,
  };
};

const projectRows = () => requireSupabase().from("projects");
const columnRows = () => requireSupabase().from("project_columns");
const memberRows = () => requireSupabase().from("project_members");
const invitationRows = () => requireSupabase().from("project_invitations");

const INVITATION_ROLES = new Set(["editor", "viewer"]);

const normalizeInvitationRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  if (!INVITATION_ROLES.has(normalized)) {
    throw new Error("Choose either Editor or Viewer access.");
  }
  return normalized;
};

const normalizeInvitationEmail = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }
  return normalized;
};

/** Database row → the app's Project shape. */
export const rowToProject = (
  row = {},
  viewerRole = null,
  healthSupported = hasOwn(row, "health_status")
) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name || "Untitled project",
  description: row.description || "",
  color: row.color || "",
  status: row.status || "active",
  healthStatus: row.health_status || "on_track",
  dueDate: row.due_date || "",
  archivedAt: row.archived_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
  viewerRole: viewerRole || null,
  healthSupported,
});

const rowToColumn = (row = {}) => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name || "Untitled column",
  category: row.category || "custom",
  position: Number.isFinite(row.position) ? row.position : 0,
  isTerminal: row.is_terminal === true,
});

const rowToMember = (row = {}) => ({
  projectId: row.project_id,
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at || null,
  displayName: "",
  avatarUrl: null,
});

const rowToInvitation = (row = {}) => ({
  id: row.id,
  projectId: row.project_id,
  email: row.email || "",
  role: row.role,
  inviterId: row.inviter_id,
  status: row.status,
  expiresAt: row.expires_at || null,
  acceptedBy: row.accepted_by || null,
  acceptedAt: row.accepted_at || null,
  createdAt: row.created_at || null,
  project: row.projects ? rowToProject(row.projects) : null,
});

/** Deletes the row `query` selects, raising `message` when nothing matched. */
const deleteRow = async (query, message) => {
  const { data, error } = await query.maybeSingle();
  throwIfError(error);
  if (!data) throw new Error(message);
};

/** { userId, displayName, avatarUrl } for every id the viewer may see. */
export const listProfiles = async (userIds = []) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return [];
  const { data, error } = await requireSupabase().rpc("get_visible_user_profiles", {
    target_user_ids: uniqueIds,
  });
  throwIfError(error);
  return (data || []).map((row) => ({
    userId: row.user_id,
    displayName: String(row.display_name || "").trim(),
    avatarUrl: row.avatar_url || null,
  }));
};

/** userId → profile, for a set of ids. */
export const profilesById = async (userIds) =>
  new Map(
    (await listProfiles(userIds)).map((profile) => [profile.userId, profile])
  );

/** Adds displayName/avatarUrl to records that carry a userId. */
export const withAuthors = async (records) => {
  const byId = await profilesById(records.map((record) => record.userId));
  return records.map((record) => ({ ...record, ...byId.get(record.userId) }));
};

/** The viewer's role in a project row: ownership first, then membership. */
export const viewerRoleForRow = (row = {}, userId) => {
  if (row.owner_id === userId) return "owner";
  const membership = (row.project_members || []).find(
    (member) => member.user_id === userId
  );
  return membership?.role || null;
};

export const listProjects = async (userId) => {
  const { data, error, healthSupported } = await readProjectRows((selection) =>
    projectRows()
      .select(`${selection}, project_members(user_id, role)`)
      .order("created_at", { ascending: true })
  );
  throwIfError(error);
  return (data || []).map((row) =>
    rowToProject(row, viewerRoleForRow(row, userId), healthSupported)
  );
};

const readColumns = async (query) => {
  const { data, error } = await query.order("position", { ascending: true });
  throwIfError(error);
  return (data || []).map(rowToColumn);
};

/** Every column the viewer can see, for every project. */
export const listAllColumns = () => readColumns(columnRows().select(COLUMN_SELECT));

export const listColumns = (projectId) =>
  readColumns(columnRows().select(COLUMN_SELECT).eq("project_id", projectId));

export const createDefaultColumns = async (projectId) => {
  const { data, error } = await columnRows()
    .insert(DEFAULT_COLUMNS.map((column) => ({ ...column, project_id: projectId })))
    .select(COLUMN_SELECT);
  // Another tab created them first; read back what exists.
  if (error?.code === "23505") return listColumns(projectId);
  throwIfError(error);
  return (data || [])
    .map(rowToColumn)
    .sort((first, second) => first.position - second.position);
};

/**
 * The owner membership row is written by an AFTER INSERT trigger, so the row
 * only becomes selectable once the insert statement completes: insert without
 * RETURNING, create the board columns, then read the project back.
 */
export const createProject = async (values = {}) => {
  const id = values.id || crypto.randomUUID();
  const { error } = await projectRows().insert({
    id,
    owner_id: values.ownerId,
    name: values.name,
    description: values.description || "",
    color: values.color || "",
    status: "active",
    due_date: values.dueDate || null,
    archived_at: null,
  });
  throwIfError(error);

  try {
    await createDefaultColumns(id);
  } catch (columnError) {
    await projectRows().delete().eq("id", id);
    throw columnError;
  }

  const {
    data,
    error: readError,
    healthSupported,
  } = await readProjectRows((selection) =>
    projectRows().select(selection).eq("id", id).maybeSingle()
  );
  throwIfError(readError);
  if (!data) throw new Error("The new project could not be loaded.");
  return rowToProject(data, "owner", healthSupported);
};

export const updateProject = async (id, patch = {}) => {
  const userId = await currentUserId();
  const row = {};
  if (hasOwn(patch, "name")) row.name = patch.name;
  if (hasOwn(patch, "description")) row.description = patch.description || "";
  if (hasOwn(patch, "color")) row.color = patch.color || "";
  if (hasOwn(patch, "dueDate")) row.due_date = patch.dueDate || null;
  if (hasOwn(patch, "status")) {
    const archived = patch.status === "archived";
    row.status = archived ? "archived" : "active";
    row.archived_at = archived ? new Date().toISOString() : null;
  }

  // Health is only writable through the security-definer function.
  if (hasOwn(patch, "healthStatus")) {
    if (healthColumnSupported === false) {
      throw new Error("Project health is read-only until migration 017 is applied.");
    }
    const { error } = await requireSupabase().rpc("set_project_health_status", {
      target_project_id: id,
      target_health_status: patch.healthStatus,
    });
    throwIfError(error);
  }

  const { data, error, healthSupported } = await readProjectRows((selection) =>
    (Object.keys(row).length
      ? projectRows().update(row).eq("id", id).select(selection)
      : projectRows().select(selection).eq("id", id)
    ).maybeSingle()
  );
  throwIfError(error);
  if (!data) throw new Error("The selected project is unavailable.");
  // Only owners and editors may update a project, so a successful write tells
  // us the viewer's role without a second query.
  return rowToProject(
    data,
    data.owner_id === userId ? "owner" : "editor",
    healthSupported
  );
};

export const deleteProject = (id) =>
  deleteRow(
    projectRows().delete().eq("id", id).select("id"),
    "The selected project is unavailable."
  );

const readMembers = async (query) => {
  const { data, error } = await query.order("joined_at", { ascending: true });
  throwIfError(error);
  return withAuthors((data || []).map(rowToMember));
};

/** Every membership the viewer can see, for every project. */
export const listAllMembers = () => readMembers(memberRows().select(MEMBER_SELECT));

export const listMembers = (projectId) =>
  readMembers(memberRows().select(MEMBER_SELECT).eq("project_id", projectId));

/** Rows → invitations, each carrying the inviter's display name. */
const withInviters = async (rows) => {
  const invitations = rows.map(rowToInvitation);
  const byId = await profilesById(invitations.map((item) => item.inviterId));
  return invitations.map((item) => ({
    ...item,
    inviterDisplayName: byId.get(item.inviterId)?.displayName || "",
  }));
};

export const listProjectInvitations = async (projectId) => {
  const { data, error } = await invitationRows()
    .select(INVITATION_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return withInviters(data || []);
};

export const listMyInvitations = async (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const { data, error, healthSupported } = await readProjectRows((selection) =>
    invitationRows()
      .select(`${INVITATION_SELECT}, projects(${selection})`)
      .eq("email_normalized", normalizedEmail)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
  );
  throwIfError(error);
  const invitations = await withInviters(data || []);
  return invitations.map((invitation) => ({
    ...invitation,
    project: invitation.project
      ? { ...invitation.project, healthSupported }
      : null,
  }));
};

/** Validates the address and role, then hands off to the invitation mailer. */
export const sendInvitation = async (projectId, invitation = {}) => {
  const email = normalizeInvitationEmail(invitation.email);
  const role = normalizeInvitationRole(invitation.role);
  const { data, error } = await requireSupabase().functions.invoke(
    "send-invitation-email",
    {
      body: {
        projectId,
        inviteeEmail: email,
        role,
        projectName: String(invitation.projectName || "").trim() || undefined,
      },
    }
  );
  if (error || data?.success !== true) {
    throw new Error("We couldn't send this invitation. Try again.");
  }
  return data;
};

export const respondToInvitation = async (id, status) => {
  const accepted = status === "accepted";
  // The membership trigger reads accepted_by, and the update policy requires it.
  const userId = accepted ? await currentUserId() : null;
  const { data, error } = await invitationRows()
    .update({
      status,
      accepted_by: userId,
      accepted_at: accepted ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(INVITATION_SELECT)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("This invitation is no longer available.");
  return rowToInvitation(data);
};

export const cancelInvitation = (projectId, id) =>
  deleteRow(
    invitationRows().delete().eq("id", id).eq("project_id", projectId).select("id"),
    "This invitation is no longer available."
  );

export const updateMemberRole = async (projectId, userId, role) => {
  const { data, error } = await memberRows()
    .update({ role: normalizeInvitationRole(role) })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .select(MEMBER_SELECT)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("This member is no longer available.");
  return rowToMember(data);
};

export const removeMember = (projectId, userId) =>
  deleteRow(
    memberRows()
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .select("user_id"),
    "This member is no longer available."
  );
