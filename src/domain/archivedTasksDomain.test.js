import { describe, expect, it } from "vitest";
import {
  filterActiveTasks,
  filterArchivedTasks,
  permanentlyDeleteArchivedTaskFromCollection,
  restoreArchivedTaskInCollection,
} from "./archivedTasksDomain";

const tasks = [
  { id: "active", title: "Active", archivedAt: null },
  {
    id: "older",
    title: "Older archive",
    archivedAt: "2026-08-12T09:00:00.000Z",
  },
  {
    id: "newer",
    title: "Newer archive",
    archivedAt: "2026-08-14T09:00:00.000Z",
  },
  { id: "legacy", title: "Legacy task" },
];

describe("archived task collections", () => {
  it("separates active and archived tasks and sorts archives newest first", () => {
    expect(filterActiveTasks(tasks).map(({ id }) => id)).toEqual([
      "active",
      "legacy",
    ]);
    expect(filterArchivedTasks(tasks).map(({ id }) => id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("restores an archived task without changing the other tasks", () => {
    const restored = restoreArchivedTaskInCollection(tasks, "older");

    expect(restored.find(({ id }) => id === "older")?.archivedAt).toBeNull();
    expect(restored.find(({ id }) => id === "newer")?.archivedAt).toBe(
      "2026-08-14T09:00:00.000Z"
    );
  });

  it("permanently removes only an archived task", () => {
    expect(
      permanentlyDeleteArchivedTaskFromCollection(tasks, "older").map(
        ({ id }) => id
      )
    ).toEqual(["active", "newer", "legacy"]);

    expect(() =>
      permanentlyDeleteArchivedTaskFromCollection(tasks, "active")
    ).toThrow("Only archived tasks");
  });
});
