import { apiRequest } from "./client";

/** The only task projection. Every task read in the app uses it. */
export const TASK_SELECT = `
  id, project_id, created_by, title, description, notes, priority, status,
  work_type, story_id, column_id, position,
  due_date, start_date, start_time, end_date, end_time,
  reminder_enabled, reminder_at, completed_at, archived_at,
  created_at, updated_at,
  task_assignments(user_id, assigned_at)
`;

// PostgREST only restricts the parent rows when the embedded resource is an
// inner join, so filtering by assignee needs this variant of the same select.
const ASSIGNED_TASK_SELECT = TASK_SELECT.replace(
  "task_assignments(",
  "task_assignments!inner("
);

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const ROW_TO_STATUS = { done: "completed", in_progress: "in-progress" };

const STATUS_TO_ROW = {
  completed: "done",
  done: "done",
  "in-progress": "in_progress",
  in_progress: "in_progress",
  todo: "todo",
};

const statusToRow = (status) => STATUS_TO_ROW[status] || "todo";

// PostgREST exposes task_assignments as a to-one object because task_id is
// unique; older fixtures represent it as an array. Accept both shapes.
const assignmentOf = (row) =>
  (Array.isArray(row.task_assignments)
    ? row.task_assignments[0]
    : row.task_assignments) || null;

/** Database row → the app's Task shape. */
export const rowToTask = (row = {}) => {
  const status = ROW_TO_STATUS[row.status] || row.status || "todo";
  return {
    id: row.id,
    projectId: row.project_id || null,
    workType: row.work_type === "story" ? "story" : "task",
    storyId: row.story_id || null,
    title: row.title || "",
    description: row.description || "",
    notes: row.notes || "",
    status,
    completed: status === "completed",
    priority: row.priority || "medium",
    dueDate: row.due_date || "",
    // A row ending on its start date is a single-day item: the app spells that
    // as no end date, the shape `taskToRow` turned into one for the database.
    endDate: row.end_date && row.end_date !== row.due_date ? row.end_date : "",
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : "",
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : "",
    reminder: row.reminder_enabled === true,
    reminderAt: row.reminder_at || "",
    columnId: row.column_id || null,
    position: Number.isFinite(row.position) ? row.position : null,
    assigneeId: assignmentOf(row)?.user_id || null,
    archivedAt: row.archived_at || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const TASK_COLUMNS = {
  title: "title",
  description: "description",
  notes: "notes",
  priority: "priority",
  dueDate: "due_date",
  endDate: "end_date",
  startTime: "start_time",
  endTime: "end_time",
  reminder: "reminder_enabled",
  reminderAt: "reminder_at",
  archivedAt: "archived_at",
  completedAt: "completed_at",
  projectId: "project_id",
  storyId: "story_id",
  workType: "work_type",
  columnId: "column_id",
  position: "position",
};

/**
 * App-shaped task values → a row patch. Only the keys present in `values` are
 * mapped. `version`, `created_by`, `created_at` and `updated_at` are owned by
 * database triggers and are never written from the client.
 */
export const taskToRow = (values = {}) => {
  const row = {};
  Object.entries(TASK_COLUMNS).forEach(([key, column]) => {
    if (!hasOwn(values, key)) return;
    row[column] = values[key] === "" ? null : values[key];
  });
  if (hasOwn(values, "status")) row.status = statusToRow(values.status);
  // start_date mirrors due_date so calendar queries can range over one column.
  if (hasOwn(values, "dueDate")) row.start_date = values.dueDate || null;
  // A single-day timed item carries no end date in the app, but
  // `tasks_end_time_requires_date` rejects an end time without one: it ends on
  // the day it starts. `rowToTask` reads that back as no end date again.
  if (row.end_time && !row.end_date) {
    row.end_date = values.endDate || values.dueDate || null;
  }
  return row;
};

export const listPersonalTasks = async () => {
  return (await apiRequest("/tasks?personal=true")).map(rowToTask);
};

export const listAssignedTasks = async (userId) => {
  return (await apiRequest(`/tasks?assignedTo=${encodeURIComponent(userId)}`)).map(rowToTask);
};

export const listProjectTasks = async (projectId) => {
  return (await apiRequest(`/tasks?projectId=${encodeURIComponent(projectId)}`)).map(rowToTask);
};

/**
 * Inserts one already-validated task. The caller mints the id so the optimistic
 * row and the server row share it, and supplies `createdBy` because the insert
 * policy checks `created_by = auth.uid()`.
 */
export const createTask = async (values = {}) => {
  const projectId = values.projectId || null;
  const row = {
    ...taskToRow(values),
    id: values.id,
    created_by: values.createdBy,
    project_id: projectId,
    column_id: projectId ? values.columnId ?? null : null,
    position: projectId ? values.position ?? null : null,
  };

  return rowToTask(await apiRequest("/tasks", { method: "POST", body: JSON.stringify({ ...values, status: statusToRow(values.status) }) }));
};

export const updateTask = async (id, patch = {}) => {
  return rowToTask(await apiRequest(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ ...patch, ...(hasOwn(patch, "status") ? { status: statusToRow(patch.status) } : {}) }) }));
};

export const deleteTask = (id) => apiRequest(`/tasks/${id}`, { method: "DELETE" });

/** Board drag and drop: [{ taskId, columnId, position, status, completedAt }]. */
export const reorderTasks = async (placements = []) => {
  await apiRequest("/tasks/reorder", { method: "POST", body: JSON.stringify(placements.map(item => ({...item, status: statusToRow(item.status)}))) });
};

export const setAssignee = (taskId, userId) => apiRequest(`/tasks/${taskId}/assignee`, { method: "PUT", body: JSON.stringify({ userId: userId || null }) });
