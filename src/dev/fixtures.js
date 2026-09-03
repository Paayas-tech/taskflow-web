/**
 * Deterministic sample data for the dev preview harness (`/__preview`).
 *
 * Nothing here is imported by the application: `src/main.jsx` only loads
 * `src/dev/*` behind `import.meta.env.DEV`, so this file never reaches a
 * production bundle. Every record follows the shape the real services return
 * (`normalizeTaskDocument`, `normalizeProjectRow`, `normalizeMemberRow`, …) so
 * the screens behave exactly as they do against Supabase.
 */

import { dateOnlyKey, normalizeTaskDocument } from "../domain/taskDomain";
import { normalizeSettings } from "../domain/settingsDomain";

/** Local date key (`YYYY-MM-DD`) for today. */
export const todayKey = () => dateOnlyKey(new Date());

/** Local date key `n` days from today (negative = in the past). */
export const daysFromToday = (offset) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Number(offset || 0));
  return dateOnlyKey(date);
};

/** ISO timestamp `n` days from now, used for created/completed stamps. */
const isoFromToday = (offset, hour = 9) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + Number(offset || 0));
  return date.toISOString();
};

export const user = {
  uid: "user-karthik",
  email: "karthik@example.com",
  displayName: "Karthik Rajagopalan",
};

export const projects = [
  {
    id: "project-apollo",
    ownerId: user.uid,
    name: "Apollo redesign",
    description: "Rebuild the workspace shell, board and task panel.",
    color: "#5b5bd6",
    status: "active",
    dueDate: daysFromToday(24),
    archivedAt: null,
    createdAt: isoFromToday(-48),
    updatedAt: isoFromToday(-1, 16),
    viewerRole: "owner",
  },
  {
    id: "project-orbit",
    ownerId: user.uid,
    name: "Orbit marketing site",
    description: "Pricing, changelog and the launch announcement.",
    color: "#1f9d64",
    status: "active",
    dueDate: daysFromToday(9),
    archivedAt: null,
    createdAt: isoFromToday(-30),
    updatedAt: isoFromToday(-3, 11),
    viewerRole: "owner",
  },
  {
    id: "project-atlas",
    ownerId: "user-priya",
    name: "Atlas mobile app",
    description: "Shared with you by Priya — release 2.4 hardening.",
    color: "#2f7fe0",
    status: "active",
    dueDate: "",
    archivedAt: null,
    createdAt: isoFromToday(-70),
    updatedAt: isoFromToday(-6, 14),
    viewerRole: "editor",
  },
  {
    id: "project-legacy",
    ownerId: user.uid,
    name: "Legacy data migration",
    description: "Finished in July; kept for the audit trail.",
    color: "#6b7280",
    status: "archived",
    dueDate: "",
    archivedAt: isoFromToday(-20),
    createdAt: isoFromToday(-180),
    updatedAt: isoFromToday(-20),
    viewerRole: "owner",
  },
];

export const members = [
  {
    projectId: "project-apollo",
    userId: user.uid,
    role: "owner",
    joinedAt: isoFromToday(-48),
    addedBy: user.uid,
    displayName: user.displayName,
    avatarUrl: null,
  },
  {
    projectId: "project-apollo",
    userId: "user-priya",
    role: "editor",
    joinedAt: isoFromToday(-40),
    addedBy: user.uid,
    displayName: "Priya Raman",
    avatarUrl: null,
  },
  {
    projectId: "project-apollo",
    userId: "user-daniel",
    role: "viewer",
    joinedAt: isoFromToday(-12),
    addedBy: user.uid,
    displayName: "Daniel Okafor",
    avatarUrl: null,
  },
];

export const columns = [
  {
    id: "column-todo",
    projectId: "project-apollo",
    name: "To do",
    category: "todo",
    position: 0,
    isTerminal: false,
    createdAt: isoFromToday(-48),
  },
  {
    id: "column-doing",
    projectId: "project-apollo",
    name: "In progress",
    category: "in_progress",
    position: 1,
    isTerminal: false,
    createdAt: isoFromToday(-48),
  },
  {
    id: "column-done",
    projectId: "project-apollo",
    name: "Done",
    category: "done",
    position: 2,
    isTerminal: true,
    createdAt: isoFromToday(-48),
  },
];

const projectNameOf = (projectId) =>
  projects.find((project) => project.id === projectId)?.name || "";

/**
 * Builds one task in the shape pages receive: a normalized task document plus
 * the project extras the assigned-task and workspace loads add.
 */
const task = (id, data = {}) => ({
  ...normalizeTaskDocument(id, data),
  assigneeId: data.assigneeId ?? null,
  assigneeName: data.assigneeName ?? "",
  projectName: data.projectId ? projectNameOf(data.projectId) : "",
  storyName: data.storyName ?? "",
  columnId: data.columnId ?? null,
  position: data.position ?? 0,
  attachmentCount: data.attachmentCount ?? 0,
});

/** The two Apollo stories (task documents with `workType: "story"`). */
export const stories = [
  task("story-navigation", {
    title: "Navigation overhaul",
    description: "Sidebar, routing and the page header.",
    status: "in-progress",
    priority: "high",
    dueDate: daysFromToday(7),
    projectId: "project-apollo",
    workType: "story",
    assigneeId: user.uid,
    assigneeName: user.displayName,
    columnId: "column-doing",
    position: 0,
    createdAt: isoFromToday(-30),
    updatedAt: isoFromToday(-2),
  }),
  task("story-onboarding", {
    title: "Onboarding flow",
    description: "First-run experience for a brand new workspace.",
    status: "todo",
    priority: "medium",
    dueDate: daysFromToday(21),
    projectId: "project-apollo",
    workType: "story",
    assigneeId: "user-priya",
    assigneeName: "Priya Raman",
    columnId: "column-todo",
    position: 1,
    createdAt: isoFromToday(-18),
    updatedAt: isoFromToday(-4),
  }),
];

/**
 * Sixteen tasks: personal and project work, every priority, two overdue,
 * three due today, three inside the week, two later, two undated, three
 * completed and two archived.
 */
export const tasks = [
  task("task-domain", {
    title: "Renew the taskflow.app domain",
    description: "Auto-renew failed last month, do it by hand.",
    status: "todo",
    priority: "high",
    dueDate: daysFromToday(-3),
    createdAt: isoFromToday(-10),
    updatedAt: isoFromToday(-3),
  }),
  task("task-sidebar-bug", {
    title: "Fix the sidebar collapse animation",
    description: "The wordmark jumps a pixel when the rail collapses.",
    status: "in-progress",
    priority: "medium",
    dueDate: daysFromToday(-1),
    projectId: "project-apollo",
    storyId: "story-navigation",
    storyName: "Navigation overhaul",
    assigneeId: user.uid,
    assigneeName: user.displayName,
    columnId: "column-doing",
    position: 1,
    attachmentCount: 2,
    createdAt: isoFromToday(-9),
    updatedAt: isoFromToday(-1),
  }),
  task("task-offsite", {
    title: "Book flights for the team offsite",
    status: "todo",
    priority: "medium",
    dueDate: daysFromToday(0),
    createdAt: isoFromToday(-6),
    updatedAt: isoFromToday(-2),
  }),
  task("task-task-row", {
    title: "Ship the new task row everywhere",
    description: "One row component for lists, widgets and the agenda.",
    status: "in-progress",
    priority: "high",
    dueDate: daysFromToday(0),
    projectId: "project-apollo",
    storyId: "story-navigation",
    storyName: "Navigation overhaul",
    assigneeId: user.uid,
    assigneeName: user.displayName,
    columnId: "column-doing",
    position: 2,
    createdAt: isoFromToday(-8),
    updatedAt: isoFromToday(0),
  }),
  task("task-atlas-notes", {
    title: "Review the Atlas 2.4 release notes",
    status: "todo",
    priority: "low",
    dueDate: daysFromToday(0),
    projectId: "project-atlas",
    assigneeId: user.uid,
    assigneeName: user.displayName,
    createdAt: isoFromToday(-5),
    updatedAt: isoFromToday(-1),
  }),
  task("task-sprint-summary", {
    title: "Draft the sprint summary",
    status: "todo",
    priority: "low",
    dueDate: daysFromToday(2),
    createdAt: isoFromToday(-4),
    updatedAt: isoFromToday(-1),
  }),
  task("task-onboarding-copy", {
    title: "Write the onboarding copy",
    description: "Three steps, sentence case, no exclamation marks.",
    status: "todo",
    priority: "medium",
    dueDate: daysFromToday(4),
    projectId: "project-apollo",
    storyId: "story-onboarding",
    storyName: "Onboarding flow",
    assigneeId: "user-priya",
    assigneeName: "Priya Raman",
    columnId: "column-todo",
    position: 3,
    createdAt: isoFromToday(-7),
    updatedAt: isoFromToday(-2),
  }),
  task("task-pricing-page", {
    title: "Update the pricing page",
    status: "in-progress",
    priority: "high",
    dueDate: daysFromToday(6),
    projectId: "project-orbit",
    assigneeId: user.uid,
    assigneeName: user.displayName,
    createdAt: isoFromToday(-11),
    updatedAt: isoFromToday(-1),
  }),
  task("task-roadmap", {
    title: "Plan the Q4 roadmap review",
    status: "todo",
    priority: "medium",
    dueDate: daysFromToday(18),
    createdAt: isoFromToday(-3),
    updatedAt: isoFromToday(-3),
  }),
  task("task-empty-states", {
    title: "Localise the empty states",
    status: "todo",
    priority: "low",
    dueDate: daysFromToday(32),
    projectId: "project-apollo",
    storyId: "story-onboarding",
    storyName: "Onboarding flow",
    assigneeId: "user-daniel",
    assigneeName: "Daniel Okafor",
    columnId: "column-todo",
    position: 4,
    createdAt: isoFromToday(-2),
    updatedAt: isoFromToday(-2),
  }),
  task("task-reading", {
    title: "Read the design systems write-up",
    status: "todo",
    priority: "low",
    createdAt: isoFromToday(-14),
    updatedAt: isoFromToday(-14),
  }),
  task("task-contrast-audit", {
    title: "Audit colour contrast in dark mode",
    description: "Muted text on surface-2 is borderline.",
    status: "todo",
    priority: "medium",
    projectId: "project-apollo",
    columnId: "column-todo",
    position: 5,
    createdAt: isoFromToday(-13),
    updatedAt: isoFromToday(-13),
  }),
  task("task-invoice", {
    title: "Send the September invoice",
    status: "completed",
    completed: true,
    priority: "medium",
    dueDate: daysFromToday(-2),
    completedAt: isoFromToday(-1, 17),
    createdAt: isoFromToday(-16),
    updatedAt: isoFromToday(-1, 17),
  }),
  task("task-token-refactor", {
    title: "Merge the design token refactor",
    status: "completed",
    completed: true,
    priority: "high",
    dueDate: daysFromToday(-4),
    projectId: "project-apollo",
    storyId: "story-navigation",
    storyName: "Navigation overhaul",
    assigneeId: user.uid,
    assigneeName: user.displayName,
    columnId: "column-done",
    position: 0,
    completedAt: isoFromToday(-2, 15),
    createdAt: isoFromToday(-20),
    updatedAt: isoFromToday(-2, 15),
  }),
  task("task-changelog", {
    title: "Publish the August changelog",
    status: "completed",
    completed: true,
    priority: "low",
    dueDate: daysFromToday(-6),
    projectId: "project-orbit",
    assigneeId: user.uid,
    assigneeName: user.displayName,
    completedAt: isoFromToday(-3, 10),
    createdAt: isoFromToday(-24),
    updatedAt: isoFromToday(-3, 10),
  }),
  task("task-archived-survey", {
    title: "Run the old customer survey",
    status: "todo",
    priority: "low",
    archivedAt: isoFromToday(-9),
    createdAt: isoFromToday(-60),
    updatedAt: isoFromToday(-9),
  }),
  task("task-archived-newsletter", {
    title: "Restart the newsletter",
    status: "todo",
    priority: "medium",
    archivedAt: isoFromToday(-15),
    createdAt: isoFromToday(-90),
    updatedAt: isoFromToday(-15),
  }),
];

/**
 * Work that only exists inside Orbit and Atlas. It is deliberately kept out of
 * `tasks` (the personal ∪ assigned-to-me list App builds) so the other two
 * project workspaces have a populated board without unassigned project work
 * leaking into My Tasks.
 */
const otherProjectTasks = [
  task("task-launch-post", {
    title: "Write the launch announcement",
    description: "Blog post plus the in-app changelog entry.",
    status: "todo",
    priority: "high",
    dueDate: daysFromToday(3),
    projectId: "project-orbit",
    assigneeId: "user-priya",
    assigneeName: "Priya Raman",
    position: 0,
    createdAt: isoFromToday(-12),
    updatedAt: isoFromToday(-2),
  }),
  task("task-changelog-page", {
    title: "Design the changelog page",
    status: "in-progress",
    priority: "medium",
    dueDate: daysFromToday(8),
    projectId: "project-orbit",
    position: 1,
    createdAt: isoFromToday(-15),
    updatedAt: isoFromToday(-1),
  }),
  task("task-pricing-feedback", {
    title: "Collect pricing feedback from the beta",
    status: "todo",
    priority: "low",
    projectId: "project-orbit",
    position: 2,
    createdAt: isoFromToday(-5),
    updatedAt: isoFromToday(-5),
  }),
  task("task-cold-start", {
    title: "Fix the crash on cold start",
    description: "Only reproduces on Android 13 after an update.",
    status: "in-progress",
    priority: "high",
    dueDate: daysFromToday(-2),
    projectId: "project-atlas",
    assigneeId: "user-priya",
    assigneeName: "Priya Raman",
    position: 0,
    createdAt: isoFromToday(-21),
    updatedAt: isoFromToday(-1),
  }),
  task("task-release-checklist", {
    title: "Update the 2.4 release checklist",
    status: "todo",
    priority: "medium",
    dueDate: daysFromToday(5),
    projectId: "project-atlas",
    position: 1,
    createdAt: isoFromToday(-9),
    updatedAt: isoFromToday(-4),
  }),
  task("task-beta-triage", {
    title: "Triage the beta feedback inbox",
    status: "todo",
    priority: "low",
    projectId: "project-atlas",
    position: 2,
    createdAt: isoFromToday(-4),
    updatedAt: isoFromToday(-4),
  }),
];

/** Every project's board/list content: the two stories plus each project's tasks. */
export const projectTasks = [
  ...stories,
  ...tasks.filter((item) => item.projectId === "project-apollo"),
  ...otherProjectTasks,
];

export const notifications = [
  {
    id: "notification-assigned",
    actorId: "user-priya",
    actorName: "Priya Raman",
    projectId: "project-apollo",
    taskId: "task-task-row",
    type: "task_assigned",
    data: { taskTitle: "Ship the new task row everywhere" },
    readAt: null,
    createdAt: isoFromToday(0, 8),
  },
  {
    id: "notification-mention",
    actorId: "user-daniel",
    actorName: "Daniel Okafor",
    projectId: "project-apollo",
    taskId: "task-sidebar-bug",
    type: "mentioned",
    data: { taskTitle: "Fix the sidebar collapse animation" },
    readAt: null,
    createdAt: isoFromToday(-1, 16),
  },
  {
    id: "notification-comment",
    actorId: "user-priya",
    actorName: "Priya Raman",
    projectId: "project-orbit",
    taskId: "task-pricing-page",
    type: "comment_added",
    data: { taskTitle: "Update the pricing page" },
    readAt: isoFromToday(-2, 9),
    createdAt: isoFromToday(-2, 8),
  },
  {
    id: "notification-comment-old",
    actorId: "user-daniel",
    actorName: "Daniel Okafor",
    projectId: "project-apollo",
    taskId: "task-contrast-audit",
    type: "comment_added",
    data: { taskTitle: "Audit colour contrast in dark mode" },
    readAt: isoFromToday(-4, 12),
    createdAt: isoFromToday(-4, 11),
  },
];

export const invitations = [
  {
    id: "invitation-nebula",
    projectId: "project-nebula",
    email: user.email,
    role: "editor",
    inviterId: "user-priya",
    inviterDisplayName: "Priya Raman",
    status: "pending",
    expiresAt: isoFromToday(6),
    acceptedBy: null,
    acceptedAt: null,
    createdAt: isoFromToday(-1, 10),
    project: {
      id: "project-nebula",
      ownerId: "user-priya",
      name: "Nebula research",
      description: "Discovery for the next platform bet.",
      color: "#8e44ad",
      status: "active",
      dueDate: "",
      archivedAt: null,
      createdAt: isoFromToday(-8),
      updatedAt: isoFromToday(-1),
      viewerRole: null,
    },
  },
];

export const settings = normalizeSettings(
  {
    theme: { mode: "light" },
    profile: { displayName: user.displayName },
    navigation: { defaultView: "dashboard", lastViewedPath: "/" },
    reminder: { defaultTime: 15, enableBrowserNotifications: true },
    time: { format: "12h", dateFormat: "medium", weekStartsOn: "sunday" },
  },
  user
);

/** A fresh copy of the mutable slice of the fixtures, for `useState`. */
export const createPreviewState = () => ({
  tasks: tasks.map((item) => ({ ...item })),
  projectTasks: projectTasks.map((item) => ({ ...item })),
  projects: projects.map((project) => ({ ...project })),
  notifications: notifications.map((item) => ({ ...item })),
  invitations: invitations.map((item) => ({ ...item })),
  settings,
  pendingIds: new Set(),
});
