import {
  getProjectColumns,
  getProjectMembers,
  getProjectTasks,
} from "./projectService";

const pendingWorkspaces = new Map();

const workspaceKey = (userId, projectId) => `${userId}:${projectId}`;

const requestWorkspace = async (userId, projectId) => {
  const [tasks, columns, members] = await Promise.all([
    getProjectTasks(userId, projectId),
    getProjectColumns(userId, projectId),
    getProjectMembers(userId, projectId),
  ]);
  return { tasks, columns, members };
};

export const prefetchProjectWorkspace = (userId, projectId) => {
  if (!userId || !projectId) return null;
  const key = workspaceKey(userId, projectId);
  if (!pendingWorkspaces.has(key)) {
    const request = requestWorkspace(userId, projectId).catch((error) => {
      pendingWorkspaces.delete(key);
      throw error;
    });
    pendingWorkspaces.set(key, request);
  }
  return pendingWorkspaces.get(key);
};

export const consumeProjectWorkspace = async (userId, projectId) => {
  const key = workspaceKey(userId, projectId);
  const request = pendingWorkspaces.get(key) || requestWorkspace(userId, projectId);
  pendingWorkspaces.delete(key);
  return request;
};

export const clearProjectWorkspacePrefetches = () => pendingWorkspaces.clear();
