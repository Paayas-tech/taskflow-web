import { requireSupabase } from "./client.js";
import { taskRowToDocument } from "./taskRepository.js";

const projectSelect = `
  id, owner_id, name, description, color, status, due_date, archived_at,
  created_at, updated_at
`;

const projectTaskSelect = `
  id, project_id, created_by, title, description, notes, priority, status,
  column_id, position, version, due_date, start_date, start_time, end_date,
  end_time, reminder_enabled, reminder_at, completed_at, archived_at,
  created_at, updated_at, task_list_placements(list_id),
  task_assignments(user_id, assigned_at)
`;

const defaultColumnDefinitions = [
  { name: "To Do", category: "todo", position: 0, is_terminal: false },
  { name: "In Progress", category: "in_progress", position: 1, is_terminal: false },
  { name: "Done", category: "done", position: 2, is_terminal: true },
];

const throwIfError = (error) => {
  if (error) throw error;
};

const normalizeProjectRow = (row = {}, viewerRole = null) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name || "Untitled project",
  description: row.description || "",
  color: row.color || "",
  status: row.status || "active",
  dueDate: row.due_date || "",
  archivedAt: row.archived_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
  viewerRole: viewerRole || null,
});

const normalizeMemberRow = (row = {}) => ({
  projectId: row.project_id,
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at || null,
  addedBy: row.added_by,
});

const normalizeInvitationRow = (row = {}) => ({
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
  project: row.projects ? normalizeProjectRow(row.projects) : null,
});

const normalizeColumnRow = (row = {}) => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name || "Untitled column",
  category: row.category || "custom",
  position: Number.isFinite(row.position) ? row.position : 0,
  isTerminal: row.is_terminal === true,
  createdAt: row.created_at || null,
});

const normalizeCommentRow = (row = {}) => ({
  id: row.id,
  taskId: row.task_id,
  userId: row.user_id,
  content: row.content || "",
  editedAt: row.edited_at || null,
  createdAt: row.created_at || null,
});

const normalizeActivityRow = (row = {}) => ({
  id: row.id,
  projectId: row.project_id || null,
  taskId: row.task_id || null,
  userId: row.user_id || null,
  type: row.event_type,
  metadata: row.metadata || {},
  createdAt: row.created_at || null,
});

const statusCategory = (status) => {
  if (status === "done" || status === "completed") return "done";
  if (status === "in_progress" || status === "in-progress") {
    return "in_progress";
  }
  return "todo";
};

export const createProjectRepository = (client = null) => {
  const database = () => client || requireSupabase();

  const getMembership = async (userId, projectId) => {
    const { data, error } = await database()
      .from("project_members")
      .select("project_id, user_id, role, joined_at, added_by")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfError(error);
    return data ? normalizeMemberRow(data) : null;
  };

  const getAccessibleProject = async (userId, projectId) => {
    const { data, error } = await database()
      .from("projects")
      .select(projectSelect)
      .eq("id", projectId)
      .maybeSingle();
    throwIfError(error);
    if (!data) return null;
    const membership = await getMembership(userId, projectId);
    return normalizeProjectRow(
      data,
      data.owner_id === userId ? "owner" : membership?.role
    );
  };

  const getProjectColumns = async (userId, projectId) => {
    const project = await getAccessibleProject(userId, projectId);
    if (!project) return [];

    const { data, error } = await database()
      .from("project_columns")
      .select("id, project_id, name, category, position, is_terminal, created_at")
      .eq("project_id", projectId)
      .order("position", { ascending: true });
    throwIfError(error);
    return (data || []).map(normalizeColumnRow);
  };

  const ensureDefaultColumns = async (userId, projectId) => {
    const existing = await getProjectColumns(userId, projectId);
    if (existing.length) return existing;

    const project = await getAccessibleProject(userId, projectId);
    if (!project || !["owner", "editor"].includes(project.viewerRole)) return [];

    const { data, error } = await database()
      .from("project_columns")
      .insert(
        defaultColumnDefinitions.map((column) => ({
          ...column,
          project_id: projectId,
        }))
      )
      .select("id, project_id, name, category, position, is_terminal, created_at");

    if (error?.code === "23505") return getProjectColumns(userId, projectId);
    throwIfError(error);
    return (data || [])
      .map(normalizeColumnRow)
      .sort((first, second) => first.position - second.position);
  };

  const nextPosition = async (projectId, columnId) => {
    const { count, error } = await database()
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("column_id", columnId);
    throwIfError(error);
    return count || 0;
  };

  return {
    async getProjects(userId) {
      const { data, error } = await database()
        .from("projects")
        .select(projectSelect)
        .order("created_at", { ascending: true });
      throwIfError(error);
      const projects = data || [];
      if (!projects.length) return [];
      const { data: memberships, error: membershipError } = await database()
        .from("project_members")
        .select("project_id, user_id, role, joined_at, added_by")
        .eq("user_id", userId);
      throwIfError(membershipError);
      const roles = new Map(
        (memberships || []).map((membership) => [membership.project_id, membership.role])
      );
      return projects.map((project) => normalizeProjectRow(
        project,
        project.owner_id === userId ? "owner" : roles.get(project.id)
      ));
    },

    getProject: getAccessibleProject,
    getMembership,
    getProjectColumns,
    ensureDefaultColumns,

    async createProject(userId, values) {
      const projectId = crypto.randomUUID();
      const { error } = await database()
        .from("projects")
        .insert({ ...values, id: projectId, owner_id: userId });
      throwIfError(error);

      try {
        await ensureDefaultColumns(userId, projectId);
      } catch (columnError) {
        await database()
          .from("projects")
          .delete()
          .eq("id", projectId)
          .eq("owner_id", userId);
        throw columnError;
      }

      const project = await getAccessibleProject(userId, projectId);
      if (!project) throw new Error("The new project could not be loaded.");
      return project;
    },

    async updateProject(userId, projectId, values) {
      const { data, error } = await database()
        .from("projects")
        .update(values)
        .eq("id", projectId)
        .eq("owner_id", userId)
        .select(projectSelect)
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected project is unavailable.");
      return normalizeProjectRow(data, "owner");
    },

    async deleteProject(userId, projectId) {
      const { data, error } = await database()
        .from("projects")
        .delete()
        .eq("id", projectId)
        .eq("owner_id", userId)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected project is unavailable.");
    },

    async getProjectTasks(userId, projectId) {
      const project = await getAccessibleProject(userId, projectId);
      if (!project) return [];

      const { data, error } = await database()
        .from("tasks")
        .select(projectTaskSelect)
        .eq("project_id", projectId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      throwIfError(error);
      return data || [];
    },

    async getProjectTask(userId, projectId, taskId) {
      const { data, error } = await database()
        .from("tasks")
        .select(projectTaskSelect)
        .eq("id", taskId)
        .eq("project_id", projectId)
        .maybeSingle();
      throwIfError(error);
      return data || null;
    },

    async createProjectTask(userId, projectId, values) {
      const columns = await ensureDefaultColumns(userId, projectId);
      const category = statusCategory(values.status);
      const column =
        columns.find((candidate) => candidate.category === category) || columns[0];
      if (!column) throw new Error("This project has no task columns.");
      const position = await nextPosition(projectId, column.id);

      const { data, error } = await database()
        .from("tasks")
        .insert({
          ...values,
          created_by: userId,
          project_id: projectId,
          column_id: column.id,
          position,
        })
        .select(projectTaskSelect)
        .single();
      throwIfError(error);
      return data;
    },

    async updateProjectTask(userId, projectId, taskId, values) {
      const current = await this.getProjectTask(userId, projectId, taskId);
      if (!current) throw new Error("The selected task is unavailable.");
      const patch = { ...values };

      if (Object.prototype.hasOwnProperty.call(values, "status")) {
        const columns = await ensureDefaultColumns(userId, projectId);
        const target = columns.find(
          (column) => column.category === statusCategory(values.status)
        );
        if (target && target.id !== current.column_id) {
          patch.column_id = target.id;
          patch.position = await nextPosition(projectId, target.id);
        }
      }

      const { data, error } = await database()
        .from("tasks")
        .update(patch)
        .eq("id", taskId)
        .eq("project_id", projectId)
        .select(projectTaskSelect)
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected task is unavailable.");
      return data;
    },

    async relocateProjectTask(userId, projectId, taskId, targetProjectId) {
      let columnId = null;
      let position = null;
      if (targetProjectId) {
        const columns = await ensureDefaultColumns(userId, targetProjectId);
        const column = columns.find((candidate) => candidate.category === "todo") || columns[0];
        if (!column) throw new Error("The destination project has no task columns.");
        columnId = column.id;
        position = await nextPosition(targetProjectId, column.id);
      }

      const { data, error } = await database()
        .from("tasks")
        .update({
          project_id: targetProjectId || null,
          column_id: columnId,
          position,
        })
        .eq("id", taskId)
        .eq("project_id", projectId)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected task is unavailable.");
    },

    async moveProjectTask(userId, projectId, taskId, columnId, position) {
      const project = await getAccessibleProject(userId, projectId);
      if (!project) throw new Error("The selected project is unavailable.");
      const columns = await getProjectColumns(userId, projectId);
      const column = columns.find((candidate) => candidate.id === columnId);
      if (!column) throw new Error("The destination column is unavailable.");

      const status =
        column.category === "done"
          ? "done"
          : column.category === "in_progress"
            ? "in_progress"
            : "todo";
      const completedAt = status === "done" ? new Date().toISOString() : null;
      const { data, error } = await database()
        .from("tasks")
        .update({
          column_id: columnId,
          position: Math.max(0, Number(position) || 0),
          status,
          completed_at: completedAt,
        })
        .eq("id", taskId)
        .eq("project_id", projectId)
        .select(projectTaskSelect)
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected task is unavailable.");
      return data;
    },

    async reorderProjectTasks(userId, projectId, placements) {
      const project = await getAccessibleProject(userId, projectId);
      if (!project) throw new Error("The selected project is unavailable.");
      const columns = await getProjectColumns(userId, projectId);
      const columnsById = new Map(columns.map((column) => [column.id, column]));

      await Promise.all(
        placements.map(async ({ taskId, columnId, position }) => {
          const column = columnsById.get(columnId);
          if (!column) throw new Error("A destination column is unavailable.");
          const status =
            column.category === "done"
              ? "done"
              : column.category === "in_progress"
                ? "in_progress"
                : "todo";
          const { error } = await database()
            .from("tasks")
            .update({
              column_id: columnId,
              position: Math.max(0, Number(position) || 0),
              status,
              completed_at: status === "done" ? new Date().toISOString() : null,
            })
            .eq("id", taskId)
            .eq("project_id", projectId);
          throwIfError(error);
        })
      );
    },

    async deleteProjectTask(userId, projectId, taskId) {
      const { data, error } = await database()
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("project_id", projectId)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected task is unavailable.");
    },

    async getProjectMembers(_userId, projectId) {
      const { data, error } = await database()
        .from("project_members")
        .select("project_id, user_id, role, joined_at, added_by")
        .eq("project_id", projectId)
        .order("joined_at", { ascending: true });
      throwIfError(error);
      return (data || []).map(normalizeMemberRow);
    },

    async getProjectInvitations(_userId, projectId) {
      const { data, error } = await database()
        .from("project_invitations")
        .select("id, project_id, email, role, inviter_id, status, expires_at, accepted_by, accepted_at, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      throwIfError(error);
      return (data || []).map(normalizeInvitationRow);
    },

    async getUserInvitations(_userId, email) {
      const { data, error } = await database()
        .from("project_invitations")
        .select(`id, project_id, email, role, inviter_id, status, expires_at,
          accepted_by, accepted_at, created_at, projects(${projectSelect})`)
        .eq("email_normalized", String(email || "").trim().toLowerCase())
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      throwIfError(error);
      return (data || []).map(normalizeInvitationRow);
    },

    async createProjectInvitation(userId, projectId, invitation) {
      const { data, error } = await database()
        .from("project_invitations")
        .insert({
          project_id: projectId,
          email: invitation.email,
          email_normalized: invitation.email.toLowerCase(),
          role: invitation.role,
          inviter_id: userId,
          status: "pending",
          expires_at: invitation.expiresAt,
        })
        .select("id, project_id, email, role, inviter_id, status, expires_at, accepted_by, accepted_at, created_at")
        .single();
      if (error?.code === "23505") {
        throw new Error("A pending invitation already exists for this email address.");
      }
      throwIfError(error);
      return normalizeInvitationRow(data);
    },

    async respondToInvitation(userId, invitationId, status) {
      const accepted = status === "accepted";
      const { data, error } = await database()
        .from("project_invitations")
        .update({
          status,
          accepted_by: accepted ? userId : null,
          accepted_at: accepted ? new Date().toISOString() : null,
        })
        .eq("id", invitationId)
        .eq("status", "pending")
        .select("id, project_id, email, role, inviter_id, status, expires_at, accepted_by, accepted_at, created_at")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("This invitation is no longer available.");
      return normalizeInvitationRow(data);
    },

    async cancelProjectInvitation(_userId, projectId, invitationId) {
      const { data, error } = await database()
        .from("project_invitations")
        .delete()
        .eq("id", invitationId)
        .eq("project_id", projectId)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("This invitation is no longer available.");
    },

    async updateProjectMemberRole(_userId, projectId, memberId, role) {
      const { data, error } = await database()
        .from("project_members")
        .update({ role })
        .eq("project_id", projectId)
        .eq("user_id", memberId)
        .select("project_id, user_id, role, joined_at, added_by")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("This member is no longer available.");
      return normalizeMemberRow(data);
    },

    async removeProjectMember(_userId, projectId, memberId) {
      const { data, error } = await database()
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", memberId)
        .select("user_id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("This member is no longer available.");
    },

    async setTaskAssignee(_userId, _projectId, taskId, assigneeId) {
      const { error } = await database().rpc("set_task_assignee", {
        target_task_id: taskId,
        target_user_id: assigneeId || null,
      });
      throwIfError(error);
    },

    async getTaskComments(_userId, taskId) {
      const { data, error } = await database()
        .from("task_comments")
        .select("id, task_id, user_id, content, edited_at, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      throwIfError(error);
      return (data || []).map(normalizeCommentRow);
    },

    async createTaskComment(userId, taskId, content) {
      const { data, error } = await database()
        .from("task_comments")
        .insert({ task_id: taskId, user_id: userId, content })
        .select("id, task_id, user_id, content, edited_at, created_at")
        .single();
      throwIfError(error);
      return normalizeCommentRow(data);
    },

    async updateTaskComment(userId, commentId, content) {
      const { data, error } = await database()
        .from("task_comments")
        .update({ content })
        .eq("id", commentId)
        .eq("user_id", userId)
        .select("id, task_id, user_id, content, edited_at, created_at")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("This comment is no longer available.");
      return normalizeCommentRow(data);
    },

    async deleteTaskComment(userId, commentId) {
      const { data, error } = await database()
        .from("task_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("This comment is no longer available.");
    },

    async getProjectActivity(_userId, projectId, limit = 50) {
      const { data, error } = await database()
        .from("activity_events")
        .select("id, project_id, task_id, user_id, event_type, metadata, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);
      throwIfError(error);
      return (data || []).map(normalizeActivityRow);
    },

    async getTaskActivity(_userId, taskId, limit = 30) {
      const { data, error } = await database()
        .from("activity_events")
        .select("id, project_id, task_id, user_id, event_type, metadata, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(limit);
      throwIfError(error);
      return (data || []).map(normalizeActivityRow);
    },

    subscribeToTaskComments(taskId, onChange) {
      const db = database();
      const channel = db
        .channel(`task-comments:${taskId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
          onChange
        )
        .subscribe();
      return () => void db.removeChannel(channel);
    },

    subscribeToProjectActivity(projectId, onChange) {
      const db = database();
      const channel = db
        .channel(`project-activity:${projectId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "activity_events", filter: `project_id=eq.${projectId}` },
          onChange
        )
        .subscribe();
      return () => void db.removeChannel(channel);
    },

    taskRowToDocument,
  };
};

export const projectRepository = createProjectRepository();
