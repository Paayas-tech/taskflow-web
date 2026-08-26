import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./projectService", () => ({
  getProjectTasks: vi.fn(),
  getProjectColumns: vi.fn(),
  getProjectMembers: vi.fn(),
}));

import {
  getProjectColumns,
  getProjectMembers,
  getProjectTasks,
} from "./projectService";
import {
  clearProjectWorkspacePrefetches,
  consumeProjectWorkspace,
  prefetchProjectWorkspace,
} from "./projectWorkspaceLoader";

beforeEach(() => {
  clearProjectWorkspacePrefetches();
  getProjectTasks.mockReset().mockResolvedValue([{ id: "task-a" }]);
  getProjectColumns.mockReset().mockResolvedValue([{ id: "todo" }]);
  getProjectMembers.mockReset().mockResolvedValue([{ userId: "user-a" }]);
});

describe("projectWorkspaceLoader", () => {
  it("reuses a prefetched workspace exactly once when the project opens", async () => {
    const prefetched = prefetchProjectWorkspace("user-a", "project-a");
    const consumed = consumeProjectWorkspace("user-a", "project-a");

    await expect(consumed).resolves.toEqual({
      tasks: [{ id: "task-a" }],
      columns: [{ id: "todo" }],
      members: [{ userId: "user-a" }],
    });
    await expect(prefetched).resolves.toBeDefined();
    expect(getProjectTasks).toHaveBeenCalledOnce();
    expect(getProjectColumns).toHaveBeenCalledOnce();
    expect(getProjectMembers).toHaveBeenCalledOnce();
  });

  it("starts a fresh request when no prefetch exists", async () => {
    await consumeProjectWorkspace("user-a", "project-b");
    expect(getProjectTasks).toHaveBeenCalledWith("user-a", "project-b");
  });
});
