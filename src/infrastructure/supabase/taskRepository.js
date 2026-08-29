import { requireSupabase } from "./client.js";

const taskSelect = `
  id, project_id, created_by, title, description, notes, priority, status,
  work_type, story_id,
  column_id, position, version,
  due_date, start_date, start_time, end_date, end_time, reminder_enabled,
  reminder_at, completed_at, archived_at, created_at, updated_at,
  task_list_placements(list_id)
`;
const legacyTaskSelect = taskSelect.replace("  work_type, story_id,\n", "");
const missingStorySchema = (error) =>
  error?.code === "42703" && /work_type|story_id/i.test(error.message || "");

const throwIfError = (error) => {
  if (error) throw error;
};

export const taskRowToDocument = (row = {}) => ({
  title: row.title || "",
  description: row.description || "",
  notes: row.notes || "",
  priority: row.priority || "medium",
  status:
    row.status === "done"
      ? "completed"
      : row.status === "in_progress"
        ? "in-progress"
        : row.status || "todo",
  completed: row.status === "done",
  dueDate: row.due_date || "",
  endDate: row.end_date || "",
  startTime: row.start_time ? String(row.start_time).slice(0, 5) : "",
  endTime: row.end_time ? String(row.end_time).slice(0, 5) : "",
  reminder: row.reminder_enabled === true,
  reminderAt: row.reminder_at || "",
  // A project is the authoritative task scope. Ignore legacy personal-list
  // placements when both relationships exist.
  listId: row.project_id ? null : row.task_list_placements?.[0]?.list_id || null,
  projectId: row.project_id || null,
  workType: row.work_type === "story" ? "story" : "task",
  storyId: row.story_id || null,
  columnId: row.column_id || null,
  position: Number.isFinite(row.position) ? row.position : null,
  version: Number.isFinite(row.version) ? row.version : 1,
  archivedAt: row.archived_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
  completedAt: row.completed_at || null,
});

export const createTaskRepository = (client = null) => {
  const database = () => client || requireSupabase();

  const getTodoColumn = async (userId, projectId) => {
    const { data: project, error: projectError } = await database()
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", userId)
      .maybeSingle();
    throwIfError(projectError);
    if (!project) throw new Error("The selected project is unavailable.");

    const { data, error } = await database()
      .from("project_columns")
      .select("id")
      .eq("project_id", projectId)
      .eq("category", "todo")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("The selected project has no To Do column.");
    return data.id;
  };

  return {
    async getPersonalTasks(userId) {
      const request = (selection) => database().from("tasks").select(selection)
        .eq("created_by", userId).is("project_id", null)
        .order("created_at", { ascending: false });
      let { data, error } = await request(taskSelect);
      if (missingStorySchema(error)) ({ data, error } = await request(legacyTaskSelect));
      throwIfError(error);
      return data || [];
    },

    async getPersonalTask(userId, taskId) {
      const request = (selection) => database().from("tasks").select(selection)
        .eq("id", taskId).eq("created_by", userId).is("project_id", null)
        .maybeSingle();
      let { data, error } = await request(taskSelect);
      if (missingStorySchema(error)) ({ data, error } = await request(legacyTaskSelect));
      throwIfError(error);
      return data || null;
    },

    async createPersonalTask(userId, values) {
      const { data, error } = await database()
        .from("tasks")
        .insert({ ...values, created_by: userId, project_id: null })
        .select(taskSelect)
        .single();
      throwIfError(error);
      return data;
    },

    async updatePersonalTask(userId, taskId, values) {
      const { data, error } = await database()
        .from("tasks")
        .update(values)
        .eq("id", taskId)
        .eq("created_by", userId)
        .is("project_id", null)
        .select(taskSelect)
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected task is unavailable.");
      return data;
    },

    async relocatePersonalTask(userId, taskId, projectId) {
      if (!projectId) return;
      const columnId = await getTodoColumn(userId, projectId);
      const { count, error: countError } = await database()
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("column_id", columnId);
      throwIfError(countError);

      const { data, error } = await database()
        .from("tasks")
        .update({
          project_id: projectId,
          column_id: columnId,
          position: count || 0,
        })
        .eq("id", taskId)
        .eq("created_by", userId)
        .is("project_id", null)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected task is unavailable.");

      // Moving a personal task into a project must also remove its former
      // personal-list context. Existing RLS still scopes this deletion to the
      // authenticated user's own placement.
      const { error: placementError } = await database()
        .from("task_list_placements")
        .delete()
        .eq("task_id", taskId)
        .eq("user_id", userId);
      throwIfError(placementError);
    },

    async setTaskList(userId, taskId, listId) {
      if (!listId) {
        const { error } = await database()
          .from("task_list_placements")
          .delete()
          .eq("task_id", taskId)
          .eq("user_id", userId);
        throwIfError(error);
        return;
      }

      const { error } = await database()
        .from("task_list_placements")
        .upsert(
          { task_id: taskId, list_id: listId, user_id: userId },
          { onConflict: "task_id,user_id" }
        );
      throwIfError(error);
    },

    async deletePersonalTask(userId, taskId) {
      const { data, error } = await database()
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("created_by", userId)
        .is("project_id", null)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected task is unavailable.");
    },
  };
};

export const taskRepository = createTaskRepository();
