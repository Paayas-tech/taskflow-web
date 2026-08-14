import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";
import {
  archiveTask as buildArchivedTask,
  normalizeTaskDocument,
  normalizeArchivedAt,
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


const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);


const mutableTaskFields = [
  "title",
  "description",
  "notes",
  "status",
  "completed",
  "priority",
  "dueDate",
  "endDate",
  "startTime",
  "endTime",
  "reminder",
  "reminderAt",
  "listId",
  "projectId",
  "archivedAt",
];


const scheduleFields = [
  "dueDate",
  "endDate",
  "startTime",
  "endTime",
];

const reminderFields = ["reminder", "reminderAt"];


export const createTask = async (userId, taskData = {}) => {
  const tasksRef = collection(
    db,
    "users",
    userId,
    "tasks"
  );

  const title = String(taskData.title || "").trim();

  if (!title) {
    throw new Error("Task title cannot be empty.");
  }

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

  return await addDoc(tasksRef, {
    title,
    description: taskData.description || "",
    notes: taskData.notes || "",
    status,
    completed,
    priority: normalizeTaskPriority(taskData.priority),
    // dueDate remains the legacy deadline and the calendar start date until
    // a future task/event `type` field can make those meanings explicit.
    dueDate: schedule.dueDate,
    endDate: schedule.endDate,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    reminder,
    reminderAt,
    listId: taskData.listId || null,
    projectId: taskData.projectId || null,
    archivedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: completed ? serverTimestamp() : null,
  });
};


export const getTasks = async (userId) => {
  try {
    const tasksRef = collection(
      db,
      "users",
      userId,
      "tasks"
    );

    const snapshot = await getDocs(tasksRef);

    const tasks = snapshot.docs.map((document) =>
      normalizeTaskDocument(document.id, document.data())
    );

    return sortTasksNewestFirst(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
};


export const updateTask = async (
  userId,
  taskId,
  data = {}
) => {
  const taskRef = doc(
    db,
    "users",
    userId,
    "tasks",
    taskId
  );

  const updatedData = {};

  mutableTaskFields.forEach((field) => {
    if (hasOwn(data, field)) {
      updatedData[field] = data[field];
    }
  });

  updatedData.updatedAt = serverTimestamp();

  if ("priority" in updatedData) {
    updatedData.priority = normalizeTaskPriority(
      updatedData.priority
    );
  }

  if ("archivedAt" in updatedData) {
    if (updatedData.archivedAt === null) {
      updatedData.archivedAt = null;
    } else {
      const archivedAt = normalizeArchivedAt(updatedData.archivedAt);
      if (!archivedAt) {
        throw new Error("Archived date must be a valid ISO 8601 timestamp or null.");
      }
      updatedData.archivedAt = archivedAt;
    }
  }

  Object.assign(
    updatedData,
    resolveCompletionUpdate(data, () => serverTimestamp())
  );

  const needsScheduleValidation = scheduleFields.some((field) =>
    hasOwn(data, field)
  );
  const needsReminderValidation = reminderFields.some((field) =>
    hasOwn(data, field)
  );
  let existingTask = null;

  if (needsScheduleValidation || needsReminderValidation) {
    const taskSnapshot = await getDoc(taskRef);

    if (!taskSnapshot.exists()) {
      throw new Error("The selected task is unavailable.");
    }

    existingTask = taskSnapshot.data();
  }

  if (needsScheduleValidation) {
    const schedule = normalizeTaskSchedule(
      { ...existingTask, ...updatedData },
      { validate: true }
    );

    // Writing the complete schedule tuple keeps partial updates consistent
    // and lazily adds missing fields to legacy tasks on their next edit.
    scheduleFields.forEach((field) => {
      updatedData[field] = schedule[field];
    });
  }

  if (needsReminderValidation) {
    const existingReminder = existingTask.reminder === true;
    const existingReminderAt = normalizeReminderAt(existingTask.reminderAt);
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

    if (!reminder) {
      reminderAt = "";
    } else if (!reminderAt && !existingReminder) {
      reminderAt = defaultReminderAt({ ...existingTask, ...updatedData });
    }

    const reminderChanged =
      reminder !== existingReminder || reminderAt !== existingReminderAt;
    if (reminderChanged && reminderAt) {
      const reminderError = getReminderValidationError({
        reminder,
        reminderAt,
        createdAt: existingTask.createdAt,
      });
      if (reminderError) throw new Error(reminderError);
    }

    updatedData.reminder = reminder;
    updatedData.reminderAt = reminderAt;
  }

  return await updateDoc(
    taskRef,
    updatedData
  );
};


const getTaskForArchiveTransition = async (userId, taskId) => {
  const taskRef = doc(db, "users", userId, "tasks", taskId);
  const snapshot = await getDoc(taskRef);

  if (!snapshot.exists()) {
    throw new Error("The selected task is unavailable.");
  }

  return normalizeTaskDocument(snapshot.id, snapshot.data());
};


export const archiveTask = async (userId, taskId) => {
  const task = await getTaskForArchiveTransition(userId, taskId);
  const archivedTask = buildArchivedTask(task);

  await updateTask(userId, taskId, { archivedAt: archivedTask.archivedAt });
  return archivedTask;
};


export const unarchiveTask = async (userId, taskId) => {
  const task = await getTaskForArchiveTransition(userId, taskId);
  const restoredTask = buildUnarchivedTask(task);

  await updateTask(userId, taskId, { archivedAt: null });
  return restoredTask;
};


export const deleteTask = async (
  userId,
  taskId
) => {
  const taskRef = doc(
    db,
    "users",
    userId,
    "tasks",
    taskId
  );

  return await deleteDoc(taskRef);
};
