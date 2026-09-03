import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProject,
  getProjectColumns,
  getProjectMembers,
  getProjectTasks,
} from "../application/projectService";
import { isArchived } from "../domain/taskDomain";

const CACHE_TTL_MS = 60_000;

/** projectId -> { userId, at, promise } */
const contextCache = new Map();

const emptyContext = {
  project: null,
  tasks: [],
  stories: [],
  members: [],
  columns: [],
};

/** Drops the cached load for one project (or every project when called bare). */
export function invalidateProjectContext(projectId) {
  if (projectId === undefined || projectId === null) {
    contextCache.clear();
    return;
  }
  contextCache.delete(projectId);
}

const loadProjectContext = (userId, projectId) =>
  Promise.all([
    getProjectTasks(userId, projectId),
    getProjectColumns(userId, projectId),
    getProjectMembers(userId, projectId),
    // The project record only carries the viewer's role; a failure here must not
    // hide the tasks, so it degrades to `null`.
    Promise.resolve()
      .then(() => getProject(userId, projectId))
      .catch(() => null),
  ]).then(([tasks = [], columns = [], members = [], project = null]) => ({
    project,
    tasks,
    columns,
    members,
    stories: tasks.filter((task) => task.workType === "story" && !isArchived(task)),
  }));

const readProjectContext = (userId, projectId, { bypassCache = false } = {}) => {
  const cached = contextCache.get(projectId);
  if (
    !bypassCache &&
    cached &&
    cached.userId === userId &&
    Date.now() - cached.at < CACHE_TTL_MS
  ) {
    return cached.promise;
  }

  const promise = loadProjectContext(userId, projectId);
  contextCache.set(projectId, { userId, at: Date.now(), promise });
  promise.catch(() => {
    if (contextCache.get(projectId)?.promise === promise) {
      contextCache.delete(projectId);
    }
  });
  return promise;
};

/**
 * Loads the members, stories, columns and project record needed by the task
 * panel and composer outside the project workspace. Cached for 60s per project.
 */
export function useProjectContext(userId, projectId) {
  const [state, setState] = useState(() => ({
    ...emptyContext,
    loading: Boolean(userId && projectId),
    error: "",
  }));
  const requestRef = useRef(0);

  const load = useCallback(
    (options = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      if (!userId || !projectId) {
        setState({ ...emptyContext, loading: false, error: "" });
        return Promise.resolve();
      }

      setState((current) => ({ ...current, loading: true, error: "" }));

      return readProjectContext(userId, projectId, options).then(
        (context) => {
          if (requestRef.current !== requestId) return;
          setState({ ...context, loading: false, error: "" });
        },
        (error) => {
          if (requestRef.current !== requestId) return;
          setState({
            ...emptyContext,
            loading: false,
            error: error?.message || "We couldn't load this project.",
          });
        }
      );
    },
    [userId, projectId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => load({ bypassCache: true }), [load]);

  return { ...state, reload };
}

export default useProjectContext;
