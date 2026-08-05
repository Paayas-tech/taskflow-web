import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
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


export const createTask = async (userId, taskData) => {
  const tasksRef = collection(
    db,
    "users",
    userId,
    "tasks"
  );

  return await addDoc(tasksRef, {
    title: taskData.title || "",
    description: taskData.description || "",
    status: normalizeStatus(taskData.status),
    priority: taskData.priority || "medium",
    dueDate: taskData.dueDate || "",
    reminder: taskData.reminder || false,
    completed: false,
    createdAt: serverTimestamp(),
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

    const q = query(
      tasksRef,
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        title: data.title || "Untitled task",
        status: normalizeStatus(
          data.status,
          data.completed
        ),
        dueDate: data.dueDate || "",
        reminder: data.reminder || false,
        completed: data.completed || false,
      };
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
};


export const updateTask = async (
  userId,
  taskId,
  data
) => {
  const taskRef = doc(
    db,
    "users",
    userId,
    "tasks",
    taskId
  );

  const updatedData = {
    ...data,
  };

  if ("status" in updatedData) {
    updatedData.status = normalizeStatus(
      updatedData.status,
      updatedData.completed
    );
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