import { describe, expect, it, vi } from "vitest";
import { createProjectOverviewService } from "./projectOverviewService";

const repository = () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p", name: "Launch", healthStatus: "on_track", viewerRole: "editor" }),
  getProjectOverviewMetrics: vi.fn().mockResolvedValue({ total: 4, completed: 1, inProgress: 2, overdue: 1 }),
  getProjectStatusDistribution: vi.fn().mockResolvedValue({ todo: 1, in_progress: 2, done: 1 }),
  getOverdueTasks: vi.fn().mockResolvedValue([{ id: "late" }]),
  getRecentlyCompletedTasks: vi.fn().mockResolvedValue([{ id: "done" }]),
  updateProjectHealthStatus: vi.fn().mockResolvedValue("at_risk"),
});

describe("project overview service", () => {
  it("loads the project snapshot and keeps list queries capped at ten", async () => {
    const repo = repository();
    const result = await createProjectOverviewService(repo).load("user-a", "project-a");
    expect(result.metrics).toEqual({ total: 4, completed: 1, inProgress: 2, overdue: 1 });
    expect(result.statusDistribution.done).toBe(1);
    expect(repo.getOverdueTasks).toHaveBeenCalledWith("project-a", 10);
    expect(repo.getRecentlyCompletedTasks).toHaveBeenCalledWith("project-a", 10);
  });

  it("returns null when RLS exposes no project", async () => {
    const repo = repository();
    repo.getProject.mockResolvedValue(null);
    await expect(createProjectOverviewService(repo).load("outsider", "project-a")).resolves.toBeNull();
    expect(repo.getProjectOverviewMetrics).not.toHaveBeenCalled();
  });

  it("validates and persists health changes", async () => {
    const repo = repository();
    const service = createProjectOverviewService(repo);
    await expect(service.updateHealth("project-a", "at_risk")).resolves.toBe("at_risk");
    expect(repo.updateProjectHealthStatus).toHaveBeenCalledWith("project-a", "at_risk");
    await expect(service.updateHealth("project-a", "surprised")).rejects.toThrow(/valid project health/i);
  });
});
