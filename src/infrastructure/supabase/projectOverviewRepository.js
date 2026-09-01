import { requireSupabase } from "./client.js";

const throwIfError = (error) => { if (error) throw error; };
const isMissingHealthColumn = (error) => ["42703", "PGRST204"].includes(error?.code)
  || /health_status/i.test(error?.message || "");
const assignment = (row) => Array.isArray(row.task_assignments) ? row.task_assignments[0] : row.task_assignments;
const today = () => new Date().toISOString().slice(0, 10);

const mapTask = (row, names = new Map()) => {
  const assigneeId = assignment(row)?.user_id || null;
  return {
    id: row.id, title: row.title, status: row.status, dueDate: row.due_date || null,
    completedAt: row.completed_at || row.updated_at || null, assigneeId,
    assigneeName: names.get(assigneeId)?.displayName || "Unassigned",
    assigneeAvatarUrl: names.get(assigneeId)?.avatarUrl || "",
  };
};

export const createProjectOverviewRepository = (client = null) => {
  const database = () => client || requireSupabase();

  const hydrateTasks = async (rows) => {
    const ids = [...new Set(rows.map((row) => assignment(row)?.user_id).filter(Boolean))];
    if (!ids.length) return rows.map((row) => mapTask(row));
    const { data, error } = await database().rpc("get_visible_user_profiles", { target_user_ids: ids });
    throwIfError(error);
    const names = new Map((data || []).map((profile) => [profile.user_id, {
      displayName: profile.display_name || "TaskFlow user", avatarUrl: profile.avatar_url || "",
    }]));
    return rows.map((row) => mapTask(row, names));
  };

  return {
    async getProject(userId, projectId) {
      let { data, error } = await database().from("projects")
        .select("id, owner_id, name, description, health_status").eq("id", projectId).maybeSingle();
      let healthSupported = true;
      if (isMissingHealthColumn(error)) {
        healthSupported = false;
        ({ data, error } = await database().from("projects")
          .select("id, owner_id, name, description").eq("id", projectId).maybeSingle());
      }
      throwIfError(error);
      if (!data) return null;
      const { data: membership, error: membershipError } = await database().from("project_members")
        .select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
      throwIfError(membershipError);
      const viewerRole = data.owner_id === userId ? "owner" : membership?.role || null;
      return viewerRole ? {
        id: data.id, name: data.name, description: data.description || "",
        healthStatus: data.health_status || "on_track", healthSupported, viewerRole,
      } : null;
    },

    async getProjectOverviewMetrics(projectId) {
      const { data, error } = await database().from("tasks").select("status, due_date")
        .eq("project_id", projectId).eq("work_type", "task").is("archived_at", null);
      throwIfError(error);
      const rows = data || [];
      return {
        total: rows.length,
        completed: rows.filter((row) => ["done", "completed"].includes(row.status)).length,
        inProgress: rows.filter((row) => row.status === "in_progress").length,
        overdue: rows.filter((row) => row.due_date && row.due_date < today() && !["done", "completed"].includes(row.status)).length,
      };
    },

    async getProjectStatusDistribution(projectId) {
      const { data, error } = await database().from("tasks").select("status")
        .eq("project_id", projectId).eq("work_type", "task").is("archived_at", null);
      throwIfError(error);
      return (data || []).reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] || 0) + 1 }), {});
    },

    async getOverdueTasks(projectId, limit = 10) {
      const { data, error } = await database().from("tasks")
        .select("id, title, status, due_date, completed_at, updated_at, task_assignments(user_id)")
        .eq("project_id", projectId).eq("work_type", "task").is("archived_at", null)
        .lt("due_date", today()).neq("status", "done").order("due_date", { ascending: true }).limit(limit);
      throwIfError(error);
      return hydrateTasks(data || []);
    },

    async getRecentlyCompletedTasks(projectId, limit = 10) {
      const { data, error } = await database().from("tasks")
        .select("id, title, status, due_date, completed_at, updated_at, task_assignments(user_id)")
        .eq("project_id", projectId).eq("work_type", "task").is("archived_at", null)
        .eq("status", "done").order("completed_at", { ascending: false, nullsFirst: false }).limit(limit);
      throwIfError(error);
      return hydrateTasks(data || []);
    },

    async updateProjectHealthStatus(projectId, healthStatus) {
      const { data, error } = await database().rpc("set_project_health_status", {
        target_project_id: projectId, target_health_status: healthStatus,
      });
      throwIfError(error);
      return data;
    },
  };
};

export const projectOverviewRepository = createProjectOverviewRepository();
