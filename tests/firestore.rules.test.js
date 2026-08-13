import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_PROJECT_ID = "demo-taskflow";
const OWNER_ID = "owner-user";
const MEMBER_ID = "member-user";
const OTHER_ID = "other-user";
const PROJECT_ID = "project-one";

const projectPath = (projectId = PROJECT_ID) =>
  `users/${OWNER_ID}/projects/${projectId}`;
const memberPath = (memberId, projectId = PROJECT_ID) =>
  `${projectPath(projectId)}/members/${memberId}`;
const taskPath = (taskId = "task-one") =>
  `users/${OWNER_ID}/tasks/${taskId}`;
const listPath = (listId = "list-one") =>
  `users/${OWNER_ID}/lists/${listId}`;

const persistedOwnerMembership = () => ({
  userId: OWNER_ID,
  role: "owner",
  status: "active",
  addedBy: OWNER_ID,
  joinedAt: Timestamp.fromMillis(1_000),
  updatedAt: Timestamp.fromMillis(1_000),
});

const persistedMemberMembership = (overrides = {}) => ({
  userId: MEMBER_ID,
  role: "member",
  status: "active",
  addedBy: OWNER_ID,
  joinedAt: Timestamp.fromMillis(1_000),
  updatedAt: Timestamp.fromMillis(1_000),
  ...overrides,
});

const newOwnerMembership = () => ({
  userId: OWNER_ID,
  role: "owner",
  status: "active",
  addedBy: OWNER_ID,
  joinedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const newMemberMembership = (memberId = MEMBER_ID, overrides = {}) => ({
  userId: memberId,
  role: "member",
  status: "active",
  addedBy: OWNER_ID,
  joinedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
});

let testEnvironment;

const seedDocuments = async (documents) => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();

    for (const [path, data] of Object.entries(documents)) {
      await setDoc(doc(database, path), data);
    }
  });
};

const seedProject = async (additionalDocuments = {}) => {
  await seedDocuments({
    [projectPath()]: {
      name: "Security test project",
      status: "active",
    },
    ...additionalDocuments,
  });
};

beforeAll(async () => {
  const rules = await readFile(
    new URL("../firestore.rules", import.meta.url),
    "utf8"
  );

  testEnvironment = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

afterAll(async () => {
  await testEnvironment?.cleanup();
});

describe("project membership rules", () => {
  it("denies unauthenticated membership reads and writes", async () => {
    await seedProject({
      [memberPath(MEMBER_ID)]: persistedMemberMembership(),
    });
    const database = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(database, memberPath(MEMBER_ID))));
    await assertFails(
      getDocs(collection(database, `${projectPath()}/members`))
    );
    await assertFails(
      setDoc(doc(database, memberPath("new-member")), newMemberMembership("new-member"))
    );
    await assertFails(
      updateDoc(doc(database, memberPath(MEMBER_ID)), {
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(database, memberPath(MEMBER_ID))));
  });

  it("allows the owner to read a membership record and list members", async () => {
    await seedProject({
      [memberPath(OWNER_ID)]: persistedOwnerMembership(),
      [memberPath(MEMBER_ID)]: persistedMemberMembership(),
    });
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    const ownerSnapshot = await assertSucceeds(
      getDoc(doc(database, memberPath(OWNER_ID)))
    );
    const membersSnapshot = await assertSucceeds(
      getDocs(collection(database, `${projectPath()}/members`))
    );

    expect(ownerSnapshot.data().role).toBe("owner");
    expect(membersSnapshot.size).toBe(2);
  });

  it("allows the owner to create valid owner and member records", async () => {
    await seedProject();
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertSucceeds(
      setDoc(doc(database, memberPath(OWNER_ID)), newOwnerMembership())
    );
    await assertSucceeds(
      setDoc(doc(database, memberPath(MEMBER_ID)), newMemberMembership())
    );
  });

  it("denies non-owner membership reads and management", async () => {
    await seedProject({
      [memberPath(MEMBER_ID)]: persistedMemberMembership(),
    });
    const database = testEnvironment.authenticatedContext(OTHER_ID).firestore();

    await assertFails(getDoc(doc(database, memberPath(MEMBER_ID))));
    await assertFails(
      getDocs(collection(database, `${projectPath()}/members`))
    );
    await assertFails(
      setDoc(doc(database, memberPath("new-member")), newMemberMembership("new-member"))
    );
    await assertFails(
      updateDoc(doc(database, memberPath(MEMBER_ID)), {
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(database, memberPath(MEMBER_ID))));
  });

  it("requires the membership document ID to equal userId", async () => {
    await seedProject();
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(
      setDoc(
        doc(database, memberPath("document-member")),
        newMemberMembership("different-user")
      )
    );
  });

  it("denies invalid membership roles", async () => {
    await seedProject();
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(
      setDoc(
        doc(database, memberPath(MEMBER_ID)),
        newMemberMembership(MEMBER_ID, { role: "editor" })
      )
    );
  });

  it("denies invalid membership statuses", async () => {
    await seedProject();
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(
      setDoc(
        doc(database, memberPath(MEMBER_ID)),
        newMemberMembership(MEMBER_ID, { status: "pending" })
      )
    );
  });

  it("does not allow another user to receive the owner role", async () => {
    await seedProject();
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(
      setDoc(
        doc(database, memberPath(MEMBER_ID)),
        newMemberMembership(MEMBER_ID, { role: "owner" })
      )
    );
  });

  it("requires addedBy to equal the project owner", async () => {
    await seedProject();
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(
      setDoc(
        doc(database, memberPath(MEMBER_ID)),
        newMemberMembership(MEMBER_ID, { addedBy: OTHER_ID })
      )
    );
  });

  it.each([
    ["userId", OTHER_ID],
    ["role", "owner"],
    ["addedBy", OTHER_ID],
    ["joinedAt", Timestamp.fromMillis(2_000)],
  ])("keeps %s immutable", async (field, value) => {
    await seedProject({
      [memberPath(MEMBER_ID)]: persistedMemberMembership(),
    });
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(
      updateDoc(doc(database, memberPath(MEMBER_ID)), {
        [field]: value,
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("allows the owner to update only updatedAt", async () => {
    await seedProject({
      [memberPath(MEMBER_ID)]: persistedMemberMembership(),
    });
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertSucceeds(
      updateDoc(doc(database, memberPath(MEMBER_ID)), {
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("does not allow owner membership deletion while the project exists", async () => {
    await seedProject({
      [memberPath(OWNER_ID)]: persistedOwnerMembership(),
    });
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(deleteDoc(doc(database, memberPath(OWNER_ID))));
  });

  it("allows atomic deletion of the project and its owner membership", async () => {
    await seedProject({
      [memberPath(OWNER_ID)]: persistedOwnerMembership(),
    });
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const batch = writeBatch(database);
    batch.delete(doc(database, memberPath(OWNER_ID)));
    batch.delete(doc(database, projectPath()));

    await assertSucceeds(batch.commit());
  });
});

describe("existing owner-only collection rules", () => {
  it("preserves owner task CRUD", async () => {
    const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const reference = doc(database, taskPath());

    await assertSucceeds(setDoc(reference, { title: "Owner task" }));
    await assertSucceeds(getDoc(reference));
    await assertSucceeds(updateDoc(reference, { title: "Updated task" }));
    await assertSucceeds(deleteDoc(reference));
  });

  it("denies other users access to owner-scoped tasks", async () => {
    await seedDocuments({ [taskPath()]: { title: "Owner task" } });
    const database = testEnvironment.authenticatedContext(OTHER_ID).firestore();
    const reference = doc(database, taskPath());

    await assertFails(getDoc(reference));
    await assertFails(setDoc(reference, { title: "Overwrite" }));
    await assertFails(updateDoc(reference, { title: "Update" }));
    await assertFails(deleteDoc(reference));
  });

  it("preserves owner-only list CRUD", async () => {
    const ownerDatabase = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const otherDatabase = testEnvironment.authenticatedContext(OTHER_ID).firestore();
    const ownerReference = doc(ownerDatabase, listPath());
    const otherReference = doc(otherDatabase, listPath());

    await assertSucceeds(setDoc(ownerReference, { name: "Owner list" }));
    await assertSucceeds(getDoc(ownerReference));
    await assertSucceeds(updateDoc(ownerReference, { name: "Updated list" }));
    await assertFails(getDoc(otherReference));
    await assertFails(setDoc(otherReference, { name: "Overwrite" }));
    await assertFails(updateDoc(otherReference, { name: "Update" }));
    await assertFails(deleteDoc(otherReference));
    await assertSucceeds(deleteDoc(ownerReference));
  });

  it("preserves owner-only project CRUD", async () => {
    const ownerDatabase = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const otherDatabase = testEnvironment.authenticatedContext(OTHER_ID).firestore();
    const ownerReference = doc(ownerDatabase, projectPath());
    const otherReference = doc(otherDatabase, projectPath());

    await assertSucceeds(setDoc(ownerReference, { name: "Owner project" }));
    await assertSucceeds(getDoc(ownerReference));
    await assertSucceeds(updateDoc(ownerReference, { name: "Updated project" }));
    await assertFails(getDoc(otherReference));
    await assertFails(setDoc(otherReference, { name: "Overwrite" }));
    await assertFails(updateDoc(otherReference, { name: "Update" }));
    await assertFails(deleteDoc(otherReference));
    await assertSucceeds(deleteDoc(ownerReference));
  });
});
