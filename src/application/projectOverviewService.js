import { normalizeProjectHealth } from "../domain/projectOverviewDomain.js";
import { projectOverviewRepository } from "../infrastructure/supabase/projectOverviewRepository.js";

const friendlyError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("permission") || message.includes("row-level") || message.includes("policy")) {
    return new Error("You don’t have access to this project.");
  }
  return new Error("The project overview could not be loaded. Please try again.");
};

export const createProjectOverviewService = (repository = projectOverviewRepository) => ({
  async load(userId, projectId) {
    if (!userId || !projectId) throw new Error("You don’t have access to this project.");
    try {
      const project = await repository.getProject(userId, projectId);
      if (!project) return null;
      const [metrics, statusDistribution, overdueTasks, recentlyCompletedTasks] = await Promise.all([
        repository.getProjectOverviewMetrics(projectId),
        repository.getProjectStatusDistribution(projectId),
        repository.getOverdueTasks(projectId, 10),
        repository.getRecentlyCompletedTasks(projectId, 10),
      ]);
      return {
        project: { ...project, healthStatus: normalizeProjectHealth(project.healthStatus) },
        metrics, statusDistribution, overdueTasks, recentlyCompletedTasks,
      };
    } catch (error) { throw friendlyError(error); }
  },

  async updateHealth(projectId, healthStatus) {
    const normalized = normalizeProjectHealth(healthStatus);
    if (normalized !== healthStatus) throw new Error("Choose a valid project health status.");
    try { return await repository.updateProjectHealthStatus(projectId, normalized); }
    catch (error) { throw friendlyError(error); }
  },
});

export const projectOverviewService = createProjectOverviewService();
