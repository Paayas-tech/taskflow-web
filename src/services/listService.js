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


const normalizeName = (name) => String(name || "").trim();


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


export const getLists = async (userId) => {
  try {
    const listsRef = collection(db, "users", userId, "lists");
    const snapshot = await getDocs(listsRef);

    const lists = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        name: data.name || "Untitled list",
        color: data.color || "",
        position: normalizePosition(data.position),
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
      };
    });

    return lists.sort((firstList, secondList) => {
      const firstPosition = firstList.position;
      const secondPosition = secondList.position;

      if (firstPosition !== null && secondPosition !== null) {
        if (firstPosition !== secondPosition) {
          return firstPosition - secondPosition;
        }
      } else if (firstPosition === null && secondPosition !== null) {
        return 1;
      } else if (firstPosition !== null && secondPosition === null) {
        return -1;
      }

      const firstCreatedAt = timestampToMillis(firstList.createdAt);
      const secondCreatedAt = timestampToMillis(secondList.createdAt);

      if (firstCreatedAt !== null && secondCreatedAt !== null) {
        return firstCreatedAt - secondCreatedAt;
      }

      if (firstCreatedAt === null && secondCreatedAt !== null) return 1;
      if (firstCreatedAt !== null && secondCreatedAt === null) return -1;

      return 0;
    });
  } catch (error) {
    console.error("Error fetching lists:", error);
    throw error;
  }
};


export const createList = async (userId, listData = {}) => {
  const name = normalizeName(listData.name);

  if (!name) {
    throw new Error("List name cannot be empty.");
  }

  const listsRef = collection(db, "users", userId, "lists");

  return await addDoc(listsRef, {
    name,
    color: listData.color || "",
    position: normalizePosition(listData.position, 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};


export const updateList = async (
  userId,
  listId,
  data = {}
) => {
  const listRef = doc(db, "users", userId, "lists", listId);
  const updatedData = {};

  ["name", "color", "position"].forEach((field) => {
    if (hasOwn(data, field)) {
      updatedData[field] = data[field];
    }
  });

  updatedData.updatedAt = serverTimestamp();

  if ("name" in updatedData) {
    updatedData.name = normalizeName(updatedData.name);

    if (!updatedData.name) {
      throw new Error("List name cannot be empty.");
    }
  }

  if ("position" in updatedData) {
    updatedData.position = normalizePosition(updatedData.position, 0);
  }

  return await updateDoc(listRef, updatedData);
};


export const deleteList = async (userId, listId) => {
  const tasksRef = collection(db, "users", userId, "tasks");
  const assignedTasksQuery = query(
    tasksRef,
    where("listId", "==", listId)
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
        listId: null,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }

  const listRef = doc(db, "users", userId, "lists", listId);
  return await deleteDoc(listRef);
};
