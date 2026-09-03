import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const projectService = vi.hoisted(() => ({
  getProjectTasks: vi.fn(),
  getProjectColumns: vi.fn(),
  getProjectMembers: vi.fn(),
  getProject: vi.fn(),
}));

vi.mock("../application/projectService", () => projectService);

import { invalidateProjectContext, useProjectContext } from "./useProjectContext";

const tasks = [
  { id: "task-1", title: "Draft plan", workType: "task", archivedAt: null },
  { id: "story-1", title: "Billing", workType: "story", archivedAt: null },
  { id: "story-2", title: "Archived story", workType: "story", archivedAt: "2026-08-01T09:00:00.000Z" },
];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The runner calls components with a single argument, so pass the pair as one. */
const ProjectContextProbe = ([userId, projectId]) => useProjectContext(userId, projectId);

beforeEach(() => {
  invalidateProjectContext();
  projectService.getProjectTasks.mockReset().mockResolvedValue(tasks);
  projectService.getProjectColumns.mockReset().mockResolvedValue([{ id: "col-1", name: "To do" }]);
  projectService.getProjectMembers.mockReset().mockResolvedValue([{ userId: "user-a" }]);
  projectService.getProject.mockReset().mockResolvedValue({ id: "project-1", viewerRole: "editor" });
});

describe("useProjectContext", () => {
  it("returns empty lists and never loads without a project", async () => {
    const runner = runtime.createRunner(ProjectContextProbe);
    const state = runner.render(["user-a", null]);

    expect(state.loading).toBe(false);
    expect(state.tasks).toEqual([]);
    expect(state.members).toEqual([]);
    expect(state.stories).toEqual([]);

    await flush();
    expect(projectService.getProjectTasks).not.toHaveBeenCalled();
  });

  it("loads tasks, columns, members and the project, and derives active stories", async () => {
    const runner = runtime.createRunner(ProjectContextProbe);
    expect(runner.render(["user-a", "project-1"]).loading).toBe(true);

    await flush();
    const state = runner.render();

    expect(state.loading).toBe(false);
    expect(state.error).toBe("");
    expect(state.tasks).toHaveLength(3);
    expect(state.stories.map((story) => story.id)).toEqual(["story-1"]);
    expect(state.columns).toHaveLength(1);
    expect(state.members).toHaveLength(1);
    expect(state.project).toEqual({ id: "project-1", viewerRole: "editor" });
  });

  it("still returns the context when the project record cannot be read", async () => {
    projectService.getProject.mockRejectedValue(new Error("No access"));
    const runner = runtime.createRunner(ProjectContextProbe);
    runner.render(["user-a", "project-1"]);

    await flush();
    const state = runner.render();

    expect(state.project).toBeNull();
    expect(state.tasks).toHaveLength(3);
  });

  it("serves a second consumer from the cache and reloads past it", async () => {
    const first = runtime.createRunner(ProjectContextProbe);
    first.render(["user-a", "project-1"]);
    await flush();

    const second = runtime.createRunner(ProjectContextProbe);
    second.render(["user-a", "project-1"]);
    await flush();

    expect(projectService.getProjectTasks).toHaveBeenCalledTimes(1);

    await second.render().reload();
    expect(projectService.getProjectTasks).toHaveBeenCalledTimes(2);
  });

  it("reloads after the cache is invalidated", async () => {
    const runner = runtime.createRunner(ProjectContextProbe);
    runner.render(["user-a", "project-1"]);
    await flush();

    invalidateProjectContext("project-1");

    const next = runtime.createRunner(ProjectContextProbe);
    next.render(["user-a", "project-1"]);
    await flush();

    expect(projectService.getProjectTasks).toHaveBeenCalledTimes(2);
  });

  it("reports a load failure and drops the failed cache entry", async () => {
    projectService.getProjectTasks.mockRejectedValue(new Error("Network down"));
    const runner = runtime.createRunner(ProjectContextProbe);
    runner.render(["user-a", "project-1"]);

    await flush();
    const state = runner.render();

    expect(state.error).toBe("Network down");
    expect(state.loading).toBe(false);
    expect(state.tasks).toEqual([]);

    projectService.getProjectTasks.mockResolvedValue(tasks);
    await state.reload();
    expect(runner.render().error).toBe("");
  });

  it("ignores a slow response once the project changed", async () => {
    let resolveFirst;
    projectService.getProjectTasks.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveFirst = resolve;
      })
    );

    const runner = runtime.createRunner(ProjectContextProbe);
    runner.render(["user-a", "project-1"]);
    runner.render(["user-a", "project-2"]);
    await flush();

    resolveFirst([{ id: "stale", title: "Stale", workType: "task" }]);
    await flush();

    expect(runner.render().tasks.map((task) => task.id)).toEqual(["task-1", "story-1", "story-2"]);
  });
});
