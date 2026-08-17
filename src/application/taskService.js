import {
  archiveTask as buildArchivedTask,
  normalizeArchivedAt,
  normalizeTaskDocument,
  normalizeTaskPriority,
  normalizeTaskStatus,
  resolveCompletionUpdate,
  sortTasksNewestFirst,
  unarchiveTask as buildUnarchivedTask,
} from "../domain/taskDomain";
import { normalizeTaskSchedule } from "../domain/calendarDomain";
import {
  defaultReminderAt,
  getReminderValidationError,
  normalizeReminderAt,
} from "../domain/reminderDomain";
import {
  taskRepository,
  taskRowToDocument,
} from "../infrastructure/supabase/taskRepository";

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);
const scheduleFields = ["dueDate", "endDate", "startTime", "endTime"];
const reminderFields = ["reminder", "reminderAt"];

const statusToDatabase = (status) => {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "completed") return "done";
  if (normalized === "in-progress") return "in_progress";
  return normalized;
};

const mapTaskPatchToDatabase = (data) => {
  const mapped = {};
  const fields = {
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
  };

  Object.entries(fields).forEach(([source, target]) => {
    if (hasOwn(data, source)) {
      mapped[target] = data[source] === "" ? null : data[source];
    }
  });
  if (hasOwn(data, "status")) mapped.status = statusToDatabase(data.status);
  return mapped;
};

export const createTaskService = (
  repository,
  { now = () => new Date().toISOString() } = {}
) => {
  const getNormalizedTask = async (userId, taskId) => {
    const row = await repository.getPersonalTask(userId, taskId);
    if (!row) throw new Error("The selected task is unavailable.");
    return normalizeTaskDocument(row.id, taskRowToDocument(row));
  };

  const service = {
    async createTask(userId, taskData = {}) {
      const title = String(taskData.title || "").trim();
      if (!title) throw new Error("Task title cannot be empty.");

      const status = normalizeTaskStatus(
        taskData.status,
        taskData.completed === true
      );
      const completed = status === "completed";
      const schedule = normalizeTaskSchedule(taskData, { validate: true });
      const reminder = taskData.reminder === true;
      const suppliedReminderAt = normalizeReminderAt(taskData.reminderAt);
      if (reminder && taskData.reminderAt && !suppliedReminderAt) {
        throw new Error("Choose a valid reminder date and time.");
      }
      const reminderAt = reminder
        ? suppliedReminderAt || defaultReminderAt(taskData)
        : "";
      const reminderError = getReminderValidationError(
        { reminder, reminderAt },
        { requireScheduled: reminder }
      );
      if (reminderError) throw new Error(reminderError);

      const row = await repository.createPersonalTask(userId, {
        title,
        description: taskData.description || "",
        notes: taskData.notes || "",
        status: statusToDatabase(status),
        priority: normalizeTaskPriority(taskData.priority),
        due_date: schedule.dueDate || null,
        start_date: schedule.dueDate || null,
        end_date: schedule.endDate || null,
        start_time: schedule.startTime || null,
        end_time: schedule.endTime || null,
        reminder_enabled: reminder,
        reminder_at: reminderAt || null,
        completed_at: completed ? now() : null,
        archived_at: null,
      });

      try {
        await repository.setTaskList(userId, row.id, taskData.listId || null);
      } catch (error) {
        await repository.deletePersonalTask(userId, row.id).catch(() => {});
        throw error;
      }

      return { id: row.id };
    },

    async getTasks(userId) {
      const rows = await repository.getPersonalTasks(userId);
      return sortTasksNewestFirst(
        rows.map((row) =>
          normalizeTaskDocument(row.id, taskRowToDocument(row))
        )
      );
    },

    async updateTask(userId, taskId, data = {}) {
      const currentTask = await getNormalizedTask(userId, taskId);
      const updatedData = { ...data };

      if (hasOwn(updatedData, "priority")) {
        updatedData.priority = normalizeTaskPriority(updatedData.priority);
      }
      if (hasOwn(updatedData, "archivedAt")) {
        if (updatedData.archivedAt !== null) {
          const archivedAt = normalizeArchivedAt(updatedData.archivedAt);
          if (!archivedAt) {
            throw new Error(
              "Archived date must be a valid ISO 8601 timestamp or null."
            );
          }
          updatedData.archivedAt = archivedAt;
        }
      }

      Object.assign(updatedData, resolveCompletionUpdate(data, now));

      if (scheduleFields.some((field) => hasOwn(data, field))) {
        Object.assign(
          updatedData,
          normalizeTaskSchedule(
            { ...currentTask, ...updatedData },
            { validate: true }
          )
        );
      }

      if (reminderFields.some((field) => hasOwn(data, field))) {
        const existingReminder = currentTask.reminder === true;
        const existingReminderAt = normalizeReminderAt(currentTask.reminderAt);
        const reminder = hasOwn(updatedData, "reminder")
          ? updatedData.reminder === true
          : existingReminder;
        const suppliedReminderAt = hasOwn(updatedData, "reminderAt")
          ? normalizeReminderAt(updatedData.reminderAt)
          : existingReminderAt;
        if (
          hasOwn(updatedData, "reminderAt") &&
          updatedData.reminderAt &&
          !suppliedReminderAt
        ) {
          throw new Error("Choose a valid reminder date and time.");
        }
        let reminderAt = hasOwn(updatedData, "reminderAt")
          ? suppliedReminderAt
          : existingReminderAt;
        if (!reminder) reminderAt = "";
        else if (!reminderAt && !existingReminder) {
          reminderAt = defaultReminderAt({ ...currentTask, ...updatedData });
        }
        if (
          (reminder !== existingReminder || reminderAt !== existingReminderAt) &&
          reminderAt
        ) {
          const reminderError = getReminderValidationError({
            reminder,
            reminderAt,
            createdAt: currentTask.createdAt,
          });
          if (reminderError) throw new Error(reminderError);
        }
        updatedData.reminder = reminder;
        updatedData.reminderAt = reminderAt;
      }

      const databasePatch = mapTaskPatchToDatabase(updatedData);
      if (hasOwn(updatedData, "dueDate")) {
        databasePatch.start_date = updatedData.dueDate || null;
      }
      await repository.updatePersonalTask(userId, taskId, databasePatch);
      if (hasOwn(data, "listId")) {
        await repository.setTaskList(userId, taskId, data.listId || null);
      }
      if (hasOwn(data, "projectId") && data.projectId) {
        if (!repository.relocatePersonalTask) {
          throw new Error("Project assignment is unavailable.");
        }
        await repository.relocatePersonalTask(userId, taskId, data.projectId);
      }
    },

    async archiveTask(userId, taskId) {
      const task = await getNormalizedTask(userId, taskId);
      const archivedTask = buildArchivedTask(task);
      await service.updateTask(userId, taskId, {
        archivedAt: archivedTask.archivedAt,
      });
      return archivedTask;
    },

    async unarchiveTask(userId, taskId) {
      const task = await getNormalizedTask(userId, taskId);
      const restoredTask = buildUnarchivedTask(task);
      await service.updateTask(userId, taskId, { archivedAt: null });
      return restoredTask;
    },

    deleteTask: (userId, taskId) =>
      repository.deletePersonalTask(userId, taskId),
  };

  return service;
};

const supabaseTaskService = createTaskService(taskRepository);

export const createTask = (...args) => supabaseTaskService.createTask(...args);
export const getTasks = (...args) => supabaseTaskService.getTasks(...args);
export const updateTask = (...args) => supabaseTaskService.updateTask(...args);
export const archiveTask = (...args) => supabaseTaskService.archiveTask(...args);
export const unarchiveTask = (...args) => supabaseTaskService.unarchiveTask(...args);
export const deleteTask = (...args) => supabaseTaskService.deleteTask(...args);
