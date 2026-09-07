/**
 * Derived views of the store. Every selector that builds an array or an object
 * is memoized on its inputs, so a component that reads it only re-renders when
 * the data it actually depends on changed. Selector factories (`selectTask`,
 * `selectProject`, `selectWorkspace`) are cached per id so hooks receive the
 * same function on every render.
 */
import { safeDisplayName } from "../domain/collaboration";
import { weekStartIndex } from "../domain/settings";
import {
  dateOnlyKey,
  filterArchivedTasks,
  isArchived,
  sortAssignedTasksForAttention,
  sortTasksNewestFirst,
} from "../domain/task";

/**
 * Memoizes `combiner` on the references its input selectors return. The tiny
 * subset of reselect this app needs.
 */
export const createSelector = (inputSelectors, combiner) => {
  let lastInputs = null;
  let lastResult;

  return (state) => {
    const inputs = inputSelectors.map((select) => select(state));
    if (
      lastInputs &&
      lastInputs.length === inputs.length &&
      inputs.every((value, index) => Object.is(value, lastInputs[index]))
    ) {
      return lastResult;
    }
    lastInputs = inputs;
    lastResult = combiner(...inputs);
    return lastResult;
  };
};

/* -------------------------------------------------------------------------
 * Plain readers (already stable references)
 * ---------------------------------------------------------------------- */

export const selectUser = (state) => state.auth.user;
export const selectAuth = (state) => state.auth;
export const selectSettings = (state) => state.settings;
export const selectPath = (state) => state.ui.path;
export const selectUi = (state) => state.ui;
export const selectLoaded = (state) => state.loaded;
export const selectErrors = (state) => state.errors;
export const selectPending = (state) => state.pending;
export const selectInvitations = (state) => state.invitations;
export const selectNotifications = (state) => state.notifications;
export const selectGoogleEvents = (state) => state.googleEvents;
export const selectNotificationsLive = (state) => state.notificationsLive;
export const selectProfiles = (state) => state.profiles;

export const selectTasksStatus = (state) => state.loaded.tasks;
export const selectTasksError = (state) => state.errors.tasks;

export const selectSelectedTaskId = (state) => state.ui.selectedTaskId;
export const selectComposer = (state) => state.ui.composer;
export const selectProjectCreateRequest = (state) => state.ui.projectCreateRequest;
export const selectProfileSettingsRequest = (state) =>
  state.ui.profileSettingsRequest;

/** 0 for Sunday, 1 for Monday — the index the calendar grids start from. */
export const selectWeekStartsOn = (state) =>
  weekStartIndex(state.settings.time.weekStartsOn);

const selectTasksMap = (state) => state.tasks;
const selectProjectsMap = (state) => state.projects;
const selectColumnsMap = (state) => state.columns;
const selectMembersMap = (state) => state.members;
const selectAttachmentCounts = (state) => state.attachmentCounts;

/* -------------------------------------------------------------------------
 * Enrichment
 * ---------------------------------------------------------------------- */

/**
 * Adds the names and counts every task surface shows. A task pointing at a
 * story that is not loaded (or no longer a story) keeps the reference in
 * `orphanedStoryId` and reads as unlinked.
 */
export const enrichTask = (task, state) => {
  if (!task) return null;

  const { tasks, projects, profiles, attachmentCounts } = state;
  const project = task.projectId ? projects[task.projectId] : null;
  const story = task.storyId ? tasks[task.storyId] : null;
  const linkedStory = story?.workType === "story" ? story : null;
  const orphanedStoryId = task.storyId && !linkedStory ? task.storyId : null;
  const profile = task.assigneeId ? profiles[task.assigneeId] : null;

  return {
    ...task,
    projectName: project?.name || "",
    projectStatus: project?.status || "",
    assigneeName: task.assigneeId ? safeDisplayName(profile) : "",
    storyId: orphanedStoryId ? null : task.storyId,
    storyName: linkedStory?.title || "",
    orphanedStoryId,
    attachmentCount: attachmentCounts[task.id] || 0,
  };
};

const enrichAll = (tasks, state) => tasks.map((task) => enrichTask(task, state));

/* -------------------------------------------------------------------------
 * Tasks
 * ---------------------------------------------------------------------- */

const taskInputs = [
  selectTasksMap,
  selectProjectsMap,
  selectProfiles,
  selectAttachmentCounts,
];

const enrichmentState = (tasks, projects, profiles, attachmentCounts) => ({
  tasks,
  projects,
  profiles,
  attachmentCounts,
});

/**
 * Everything "mine": my personal tasks, newest first, followed by the project
 * tasks assigned to me ordered by how much attention they need.
 */
export const selectMyTasks = createSelector(
  [...taskInputs, selectUser],
  (tasks, projects, profiles, attachmentCounts, user) => {
    const state = enrichmentState(tasks, projects, profiles, attachmentCounts);
    const all = Object.values(tasks);
    const userId = user?.id || "";

    const personal = sortTasksNewestFirst(
      all.filter((task) => !task.projectId && !isArchived(task))
    );
    const assigned = sortAssignedTasksForAttention(
      enrichAll(
        all.filter(
          (task) =>
            task.projectId &&
            task.workType !== "story" &&
            task.assigneeId === userId &&
            !isArchived(task)
        ),
        state
      ),
      dateOnlyKey(new Date()),
      { includeCompleted: true }
    );

    return [...enrichAll(personal, state), ...assigned];
  }
);

/** My archived personal tasks, most recently archived first. */
export const selectArchivedTasks = createSelector(
  taskInputs,
  (tasks, projects, profiles, attachmentCounts) => {
    const state = enrichmentState(tasks, projects, profiles, attachmentCounts);
    return enrichAll(
      filterArchivedTasks(
        Object.values(tasks).filter((task) => !task.projectId)
      ),
      state
    );
  }
);

const taskSelectors = new Map();

/** Enriched task by id, or null. Cached per id so hooks stay stable. */
export const selectTask = (taskId) => {
  const key = String(taskId || "");
  const cached = taskSelectors.get(key);
  if (cached) return cached;

  const selector = createSelector(taskInputs, (tasks, projects, profiles, counts) => {
    const task = tasks[key];
    if (!task) return null;
    return enrichTask(
      task,
      enrichmentState(tasks, projects, profiles, counts)
    );
  });
  taskSelectors.set(key, selector);
  return selector;
};

/* -------------------------------------------------------------------------
 * Projects
 * ---------------------------------------------------------------------- */

/** Every project I can see, oldest first (the order the sidebar shows). */
export const selectProjects = createSelector([selectProjectsMap], (projects) =>
  Object.values(projects).sort((first, second) =>
    String(first.createdAt || "").localeCompare(String(second.createdAt || ""))
  )
);

export const selectActiveProjects = createSelector(
  [selectProjects],
  (projects) => projects.filter((project) => project.status !== "archived")
);

export const selectEditableProjects = createSelector(
  [selectProjects],
  (projects) =>
    projects.filter((project) =>
      ["owner", "editor"].includes(project.viewerRole)
    )
);

const projectSelectors = new Map();

/** Project by id, or null. Cached per id. */
export const selectProject = (projectId) => {
  const key = String(projectId || "");
  const cached = projectSelectors.get(key);
  if (cached) return cached;

  const selector = (state) => state.projects[key] || null;
  projectSelectors.set(key, selector);
  return selector;
};

const workspaceSelectors = new Map();

const canEditProject = (project) =>
  ["owner", "editor"].includes(project?.viewerRole);

/**
 * Everything the project workspace renders: its status, tasks, stories,
 * columns and members. Cached per project id.
 */
export const selectWorkspace = (projectId) => {
  const key = String(projectId || "");
  const cached = workspaceSelectors.get(key);
  if (cached) return cached;

  const selector = createSelector(
    [
      ...taskInputs,
      selectColumnsMap,
      selectMembersMap,
      selectLoaded,
      selectErrors,
    ],
    (tasks, projects, profiles, counts, columns, members, loaded, errors) => {
      const state = enrichmentState(tasks, projects, profiles, counts);
      const project = projects[key] || null;
      const projectTasks = Object.values(tasks).filter(
        (task) => task.projectId === key
      );
      const active = projectTasks.filter((task) => !isArchived(task));

      return {
        status: loaded.workspaces[key] || "idle",
        error: errors.workspaces[key] || "",
        project,
        tasks: enrichAll(
          active.filter((task) => task.workType !== "story"),
          state
        ),
        stories: enrichAll(
          active.filter((task) => task.workType === "story"),
          state
        ),
        archivedStories: enrichAll(
          projectTasks.filter(
            (task) => isArchived(task) && task.workType === "story"
          ),
          state
        ),
        columns: columns[key] || [],
        members: members[key] || [],
        canEdit: canEditProject(project),
      };
    }
  );
  workspaceSelectors.set(key, selector);
  return selector;
};

/* -------------------------------------------------------------------------
 * Search and notifications
 * ---------------------------------------------------------------------- */

const selectStories = createSelector(
  taskInputs,
  (tasks, projects, profiles, counts) =>
    enrichAll(
      Object.values(tasks).filter(
        (task) => task.workType === "story" && !isArchived(task)
      ),
      enrichmentState(tasks, projects, profiles, counts)
    )
);

/** Projects, my tasks and the stories I can see, as the search dialog needs. */
export const selectSearchItems = createSelector(
  [selectProjects, selectMyTasks, selectStories],
  (projects, myTasks, stories) => {
    const items = projects.map((project) => ({
      id: `project:${project.id}`,
      type: "project",
      title: project.name,
      subtitle: project.description || "Project",
      project,
    }));

    myTasks.forEach((task) => {
      items.push({
        id: `task:${task.id}`,
        type: "task",
        title: task.title,
        subtitle: task.projectId
          ? task.projectName || "Project task"
          : "Personal task",
        task,
      });
    });

    stories.forEach((task) => {
      items.push({
        id: `story:${task.id}`,
        type: "story",
        title: task.title,
        subtitle: task.projectName || "Story",
        task,
      });
    });

    return items;
  }
);

export const selectUnreadCount = createSelector(
  [selectNotifications],
  (notifications) =>
    notifications.filter((notification) => !notification.readAt).length
);
