import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";


const normalizeStatus = (status, completed = false) => {
  if (completed) return "completed";

  const value = String(status || "")
    .toLowerCase()
    .trim();

  if (
    value === "in progress" ||
    value === "in-progress" ||
    value === "progress"
  ) {
    return "in-progress";
  }

  if (
    value === "completed" ||
    value === "complete" ||
    value === "done"
  ) {
    return "completed";
  }

  return "todo";
};


const normalizePriority = (priority) => {
  const value = String(priority || "")
    .toLowerCase()
    .trim();

  if (value === "low" || value === "high") {
    return value;
  }

  return "medium";
};


const timestampToMillis = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    if (typeof value.toMillis === "function") {
      const milliseconds = value.toMillis();
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }

    if (value instanceof Date) {
      const milliseconds = value.getTime();
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "string") {
      const milliseconds = Date.parse(value);
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }

    if (typeof value.toDate === "function") {
      const milliseconds = value.toDate().getTime();
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }
  } catch {
    return null;
  }

  return null;
};


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
  "reminder",
  "listId",
];


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

  const status = normalizeStatus(
    taskData.status,
    taskData.completed === true
  );
  const completed = status === "completed";

  return await addDoc(tasksRef, {
    title,
    description: taskData.description || "",
    notes: taskData.notes || "",
    status,
    completed,
    priority: normalizePriority(taskData.priority),
    dueDate: taskData.dueDate || "",
    reminder: taskData.reminder === true,
    listId: taskData.listId || null,
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

    const tasks = snapshot.docs.map((document) => {
      const data = document.data();
      const status = normalizeStatus(
        data.status,
        data.completed === true
      );

      return {
        id: document.id,
        title: data.title || "Untitled task",
        description: data.description || "",
        notes: data.notes || "",
        status,
        completed: status === "completed",
        priority: normalizePriority(data.priority),
        dueDate: data.dueDate ?? "",
        reminder: data.reminder === true,
        listId: data.listId ?? null,
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
        completedAt: data.completedAt ?? null,
      };
    });

    return tasks.sort((firstTask, secondTask) => {
      const firstCreatedAt = timestampToMillis(firstTask.createdAt);
      const secondCreatedAt = timestampToMillis(secondTask.createdAt);

      if (firstCreatedAt === null && secondCreatedAt === null) {
        return 0;
      }

      if (firstCreatedAt === null) return 1;
      if (secondCreatedAt === null) return -1;

      return secondCreatedAt - firstCreatedAt;
    });
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
    updatedData.priority = normalizePriority(
      updatedData.priority
    );
  }

  const hasStatus = hasOwn(data, "status");
  const hasCompleted = hasOwn(data, "completed");

  if (hasStatus || hasCompleted) {
    let status;

    if (hasCompleted && data.completed === true) {
      status = "completed";
    } else if (hasCompleted && data.completed === false) {
      const requestedStatus = hasStatus
        ? normalizeStatus(data.status)
        : "todo";
      status = requestedStatus === "completed"
        ? "todo"
        : requestedStatus;
    } else if (hasStatus) {
      status = normalizeStatus(data.status);
    } else {
      status = "todo";
    }

    const completed = status === "completed";
    updatedData.status = status;
    updatedData.completed = completed;
    updatedData.completedAt = completed
      ? serverTimestamp()
      : null;
  }

  return await updateDoc(
    taskRef,
    updatedData
  );
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
