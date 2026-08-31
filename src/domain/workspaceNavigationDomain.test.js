import { describe, expect, it } from "vitest";
import {
  isWorkspaceItemStarred,
  normalizeWorkspaceData,
  recordRecentItem,
  toggleStarredItem,
  workspaceItemForProject,
  workspaceItemForTask,
} from "./workspaceNavigationDomain";

describe("workspace navigation preferences", () => {
  it("deduplicates recent items and keeps the newest interaction first", () => {
    const item = { id: "task-a", type: "task", title: "Plan launch" };
    const first = recordRecentItem({}, item, "2026-08-30T10:00:00.000Z");
    const second = recordRecentItem(first, item, "2026-08-31T10:00:00.000Z");
    expect(second.recent).toEqual([{ ...item, interactedAt: "2026-08-31T10:00:00.000Z" }]);
  });

  it("stars and unstars only the selected reference", () => {
    const item = { id: "project-a", type: "project", title: "Launch" };
    const starred = toggleStarredItem({}, item);
    expect(isWorkspaceItemStarred(starred, item)).toBe(true);
    expect(toggleStarredItem(starred, item).starred).toEqual([]);
  });

  it("normalizes malformed saved preferences safely", () => {
    expect(normalizeWorkspaceData({ recent: "bad", starred: [null, { id: "a" }] })).toEqual({ recent: [], starred: [] });
  });

  it("creates compact references without copying task or project records", () => {
    expect(workspaceItemForTask({ id: "t", title: "Task", projectId: "p", workType: "story", dueDate: "2026-09-01", notes: "private" })).toEqual({ id: "t", type: "story", title: "Task", projectId: "p", dueDate: "2026-09-01" });
    expect(workspaceItemForProject({ id: "p", name: "Project", description: "private" })).toEqual({ id: "p", type: "project", title: "Project", projectId: "p" });
  });
});
