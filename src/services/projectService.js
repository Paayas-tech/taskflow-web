import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";
import {
  buildProjectMemberRecord,
  buildProjectOwnerMembership,
  normalizeProjectMemberDocument,
  validateMembershipId,
} from "../domain/projectMemberDomain";


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


const projectMembersRef = (ownerId, projectId) =>
  collection(
    db,
    "users",
    validateMembershipId(ownerId, "Owner ID"),
    "projects",
    validateMembershipId(projectId, "Project ID"),
    "members"
  );


const projectMemberRef = (ownerId, projectId, memberId) =>
  doc(
    projectMembersRef(ownerId, projectId),
    validateMembershipId(memberId, "Member ID")
  );


export const getProjectMembers = async (ownerId, projectId) => {
  const normalizedOwnerId = validateMembershipId(ownerId, "Owner ID");
  const membersSnapshot = await getDocs(
    projectMembersRef(normalizedOwnerId, projectId)
  );

  return membersSnapshot.docs
    .map((memberDocument) =>
      normalizeProjectMemberDocument(
        normalizedOwnerId,
        memberDocument.id,
        memberDocument.data()
      )
    )
    .sort((firstMember, secondMember) => {
      if (firstMember.role === secondMember.role) {
        return firstMember.userId.localeCompare(secondMember.userId);
      }
      return firstMember.role === "owner" ? -1 : 1;
    });
};


export const ensureProjectOwnerMembership = async (ownerId, projectId) => {
  const normalizedOwnerId = validateMembershipId(ownerId, "Owner ID");
  const ownerMemberRef = projectMemberRef(
    normalizedOwnerId,
    projectId,
    normalizedOwnerId
  );

  await runTransaction(db, async (transaction) => {
    const ownerSnapshot = await transaction.get(ownerMemberRef);

    if (ownerSnapshot.exists()) {
      normalizeProjectMemberDocument(
        normalizedOwnerId,
        normalizedOwnerId,
        ownerSnapshot.data()
      );
      return;
    }

    transaction.set(
      ownerMemberRef,
      buildProjectOwnerMembership(normalizedOwnerId, () => serverTimestamp())
    );
  });

  return ownerMemberRef;
};


export const addProjectMemberRecord = async (
  ownerId,
  projectId,
  memberId,
  data = {}
) => {
  const normalizedOwnerId = validateMembershipId(ownerId, "Owner ID");
  const normalizedMemberId = validateMembershipId(memberId, "Member ID");
  const memberRef = projectMemberRef(
    normalizedOwnerId,
    projectId,
    normalizedMemberId
  );
  const memberData = buildProjectMemberRecord(
    normalizedOwnerId,
    normalizedMemberId,
    data,
    () => serverTimestamp()
  );

  await runTransaction(db, async (transaction) => {
    const memberSnapshot = await transaction.get(memberRef);

    if (memberSnapshot.exists()) {
      normalizeProjectMemberDocument(
        normalizedOwnerId,
        normalizedMemberId,
        memberSnapshot.data()
      );
      return;
    }

    transaction.set(memberRef, memberData);
  });

  return memberRef;
};


export const removeProjectMemberRecord = async (
  ownerId,
  projectId,
  memberId
) => {
  const normalizedOwnerId = validateMembershipId(ownerId, "Owner ID");
  const normalizedMemberId = validateMembershipId(memberId, "Member ID");

  if (normalizedMemberId === normalizedOwnerId) {
    throw new Error("The project owner membership cannot be removed.");
  }

  const memberRef = projectMemberRef(
    normalizedOwnerId,
    projectId,
    normalizedMemberId
  );

  return await runTransaction(db, async (transaction) => {
    const memberSnapshot = await transaction.get(memberRef);
    if (!memberSnapshot.exists()) return false;

    normalizeProjectMemberDocument(
      normalizedOwnerId,
      normalizedMemberId,
      memberSnapshot.data()
    );
    transaction.delete(memberRef);
    return true;
  });
};


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
  const ownerId = validateMembershipId(userId, "Owner ID");
  const name = normalizeName(projectData.name);

  if (!name) {
    throw new Error("Project name cannot be empty.");
  }

  const projectsRef = collection(db, "users", ownerId, "projects");
  const status = normalizeStatus(projectData.status);

  const projectReference = await addDoc(projectsRef, {
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

  try {
    await ensureProjectOwnerMembership(ownerId, projectReference.id);
  } catch {
    // Existing/deployed rules may not include the members subcollection yet.
    // The owner remains authoritative through the project path and is treated
    // as an implicit owner until this idempotent write can be retried.
  }

  return projectReference;
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
  const ownerId = validateMembershipId(userId, "Owner ID");
  const normalizedProjectId = validateMembershipId(projectId, "Project ID");
  const tasksRef = collection(db, "users", ownerId, "tasks");
  const assignedTasksQuery = query(
    tasksRef,
    where("projectId", "==", normalizedProjectId)
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
    ownerId,
    "projects",
    normalizedProjectId
  );
  let membersSnapshot;
  try {
    membersSnapshot = await getDocs(
      projectMembersRef(ownerId, normalizedProjectId)
    );
  } catch (error) {
    if (error?.code === "permission-denied") {
      // Preserve project deletion while deployed rules still predate the
      // members subcollection. No member records can exist under those rules.
      return await deleteDoc(projectRef);
    }
    throw error;
  }
  const nonOwnerMembers = membersSnapshot.docs.filter(
    (memberDocument) => memberDocument.id !== ownerId
  );

  for (let index = 0; index < nonOwnerMembers.length; index += chunkSize) {
    const batch = writeBatch(db);
    nonOwnerMembers.slice(index, index + chunkSize).forEach((memberDocument) => {
      batch.delete(memberDocument.ref);
    });
    await batch.commit();
  }

  const ownerMemberSnapshot = await getDoc(
    projectMemberRef(ownerId, normalizedProjectId, ownerId)
  );
  const finalBatch = writeBatch(db);
  if (ownerMemberSnapshot.exists()) {
    finalBatch.delete(ownerMemberSnapshot.ref);
  }
  finalBatch.delete(projectRef);
  return await finalBatch.commit();
};
