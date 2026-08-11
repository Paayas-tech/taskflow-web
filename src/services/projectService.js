import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";


const projectStatuses = new Set([
  "active",
  "completed",
  "archived",
]);


const normalizeName = (name) => String(name || "").trim();


const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim();

  return projectStatuses.has(value) ? value : "active";
};


const normalizePosition = (position, fallback = null) => {
  if (
    position === null ||
    position === undefined ||
    position === ""
  ) {
    return fallback;
  }

  const value = Number(position);
  return Number.isFinite(value) ? value : fallback;
};


const isValidDueDate = (dueDate) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;

  const [year, month, day] = dueDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};


const normalizeDueDate = (dueDate, validate = false) => {
  const value = String(dueDate || "").trim();

  if (!value) return "";
  if (isValidDueDate(value)) return value;

  if (validate) {
    throw new Error("Project due date must use YYYY-MM-DD format.");
  }

  return "";
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


const mutableProjectFields = [
  "name",
  "description",
  "color",
  "status",
  "dueDate",
  "position",
];


export const getProjects = async (userId) => {
  try {
    const projectsRef = collection(db, "users", userId, "projects");
    const snapshot = await getDocs(projectsRef);

    const projects = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        name: data.name || "Untitled project",
        description: data.description || "",
        color: data.color || "",
        status: normalizeStatus(data.status),
        dueDate: normalizeDueDate(data.dueDate),
        position: normalizePosition(data.position),
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
        completedAt: data.completedAt ?? null,
      };
    });

    return projects.sort((firstProject, secondProject) => {
      const firstPosition = firstProject.position;
      const secondPosition = secondProject.position;

      if (firstPosition !== null && secondPosition !== null) {
        if (firstPosition !== secondPosition) {
          return firstPosition - secondPosition;
        }
      } else if (firstPosition === null && secondPosition !== null) {
        return 1;
      } else if (firstPosition !== null && secondPosition === null) {
        return -1;
      }

      const firstCreatedAt = timestampToMillis(firstProject.createdAt);
      const secondCreatedAt = timestampToMillis(secondProject.createdAt);

      if (firstCreatedAt !== null && secondCreatedAt !== null) {
        return firstCreatedAt - secondCreatedAt;
      }

      if (firstCreatedAt === null && secondCreatedAt !== null) return 1;
      if (firstCreatedAt !== null && secondCreatedAt === null) return -1;

      return 0;
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    throw error;
  }
};


export const createProject = async (userId, projectData = {}) => {
  const name = normalizeName(projectData.name);

  if (!name) {
    throw new Error("Project name cannot be empty.");
  }

  const projectsRef = collection(db, "users", userId, "projects");
  const status = normalizeStatus(projectData.status);

  return await addDoc(projectsRef, {
    name,
    description: String(projectData.description || ""),
    color: String(projectData.color || ""),
    status,
    dueDate: normalizeDueDate(projectData.dueDate, true),
    position: normalizePosition(projectData.position, 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: status === "completed" ? serverTimestamp() : null,
  });
};


export const updateProject = async (
  userId,
  projectId,
  data = {}
) => {
  const projectRef = doc(
    db,
    "users",
    userId,
    "projects",
    projectId
  );
  const updatedData = {};

  mutableProjectFields.forEach((field) => {
    if (hasOwn(data, field)) {
      updatedData[field] = data[field];
    }
  });

  updatedData.updatedAt = serverTimestamp();

  if ("name" in updatedData) {
    updatedData.name = normalizeName(updatedData.name);

    if (!updatedData.name) {
      throw new Error("Project name cannot be empty.");
    }
  }

  if ("description" in updatedData) {
    updatedData.description = String(updatedData.description || "");
  }

  if ("color" in updatedData) {
    updatedData.color = String(updatedData.color || "");
  }

  if ("dueDate" in updatedData) {
    updatedData.dueDate = normalizeDueDate(updatedData.dueDate, true);
  }

  if ("position" in updatedData) {
    updatedData.position = normalizePosition(updatedData.position, 0);
  }

  if ("status" in updatedData) {
    updatedData.status = normalizeStatus(updatedData.status);
    updatedData.completedAt =
      updatedData.status === "completed"
        ? serverTimestamp()
        : null;
  }

  return await updateDoc(projectRef, updatedData);
};


export const deleteProject = async (userId, projectId) => {
  const tasksRef = collection(db, "users", userId, "tasks");
  const assignedTasksQuery = query(
    tasksRef,
    where("projectId", "==", projectId)
  );
  const assignedTasks = await getDocs(assignedTasksQuery);

  // Firestore batches support at most 500 writes.
  const taskDocuments = assignedTasks.docs;
  const chunkSize = 500;

  for (let index = 0; index < taskDocuments.length; index += chunkSize) {
    const batch = writeBatch(db);
    const chunk = taskDocuments.slice(index, index + chunkSize);

    chunk.forEach((taskDocument) => {
      batch.update(taskDocument.ref, {
        projectId: null,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }

  const projectRef = doc(
    db,
    "users",
    userId,
    "projects",
    projectId
  );

  return await deleteDoc(projectRef);
};
