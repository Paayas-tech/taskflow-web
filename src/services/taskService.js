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
import {
  normalizeTaskDocument,
  normalizeTaskPriority,
  normalizeTaskStatus,
  resolveCompletionUpdate,
  sortTasksNewestFirst,
} from "../domain/taskDomain";


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
  "projectId",
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

  const status = normalizeTaskStatus(
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
    priority: normalizeTaskPriority(taskData.priority),
    dueDate: taskData.dueDate || "",
    reminder: taskData.reminder === true,
    listId: taskData.listId || null,
    projectId: taskData.projectId || null,
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

  Object.assign(
    updatedData,
    resolveCompletionUpdate(data, () => serverTimestamp())
  );

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
