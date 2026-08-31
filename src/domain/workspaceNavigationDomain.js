const MAX_RECENT_ITEMS = 30;

export const workspaceItemKey = (item) => `${item.type}:${item.id}`;

export const normalizeWorkspaceData = (data = {}) => ({
  recent: Array.isArray(data.recent)
    ? data.recent.filter((item) => item?.id && item?.type && item?.title).slice(0, MAX_RECENT_ITEMS)
    : [],
  starred: Array.isArray(data.starred)
    ? data.starred.filter((item) => item?.id && item?.type && item?.title)
    : [],
});

export const recordRecentItem = (data, item, now = new Date().toISOString()) => {
  const normalized = normalizeWorkspaceData(data);
  const next = { ...item, interactedAt: now };
  return {
    ...data,
    recent: [next, ...normalized.recent.filter((entry) => workspaceItemKey(entry) !== workspaceItemKey(next))]
      .slice(0, MAX_RECENT_ITEMS),
    starred: normalized.starred,
  };
};

export const toggleStarredItem = (data, item) => {
  const normalized = normalizeWorkspaceData(data);
  const key = workspaceItemKey(item);
  const exists = normalized.starred.some((entry) => workspaceItemKey(entry) === key);
  return {
    ...data,
    recent: normalized.recent,
    starred: exists
      ? normalized.starred.filter((entry) => workspaceItemKey(entry) !== key)
      : [{ ...item, starredAt: new Date().toISOString() }, ...normalized.starred],
  };
};

export const isWorkspaceItemStarred = (data, item) =>
  normalizeWorkspaceData(data).starred.some(
    (entry) => workspaceItemKey(entry) === workspaceItemKey(item)
  );

export const workspaceItemForTask = (task) => ({
  id: task.id,
  type: task.workType === "story" ? "story" : "task",
  title: task.title,
  projectId: task.projectId || null,
  dueDate: task.dueDate || null,
});

export const workspaceItemForProject = (project) => ({
  id: project.id,
  type: "project",
  title: project.name,
  projectId: project.id,
});
