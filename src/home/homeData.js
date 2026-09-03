/**
 * Pure helpers behind the Home widgets: the three task buckets of the My tasks
 * widget, the assigned list, the project rows and the latest notifications.
 */
import { sortAssignedTasksForAttention } from "../domain/assignmentDomain";
import {
  classifyDateOnly,
  compareDateOnly,
  dateOnlyKey,
  isArchived,
  isTaskComplete,
  localDateFromDateOnly,
} from "../domain/taskDomain";

const UPCOMING_DAYS = 7;
const priorityRank = { high: 0, medium: 1, low: 2 };

/** The date-only key `days` after `dateKey` (used for the 7-day horizon). */
export const shiftDateKey = (dateKey, days) => {
  const date = localDateFromDateOnly(dateKey);
  if (!date) return dateKey;
  date.setDate(date.getDate() + days);
  return dateOnlyKey(date);
};

const dueKey = (task) => (typeof task.dueDate === "string" ? task.dueDate.trim() : "");

const byDueThenPriority = (first, second) => {
  const dueDifference = compareDateOnly(dueKey(first), dueKey(second));
  if (dueDifference) return dueDifference;

  const priorityDifference =
    (priorityRank[first.priority] ?? priorityRank.medium) -
    (priorityRank[second.priority] ?? priorityRank.medium);
  if (priorityDifference) return priorityDifference;

  return String(first.title || "").localeCompare(String(second.title || ""));
};

/**
 * Open tasks split into the Today / Upcoming / Overdue tabs. `upcoming` stops
 * at the seven-day horizon so the widget stays a short list.
 */
export const homeTaskBuckets = (tasks = [], todayKey) => {
  const horizon = shiftDateKey(todayKey, UPCOMING_DAYS);
  const buckets = { today: [], upcoming: [], overdue: [] };

  tasks.forEach((task) => {
    if (isArchived(task) || isTaskComplete(task)) return;
    const due = dueKey(task);
    const group = classifyDateOnly(due, todayKey);

    if (group === "today") buckets.today.push(task);
    else if (group === "overdue") buckets.overdue.push(task);
    else if (group === "upcoming" && compareDateOnly(due, horizon) <= 0) {
      buckets.upcoming.push(task);
    }
  });

  buckets.today.sort(byDueThenPriority);
  buckets.upcoming.sort(byDueThenPriority);
  buckets.overdue.sort(byDueThenPriority);
  return buckets;
};

/**
 * Open project tasks assigned to the signed-in person, most urgent first
 * (undated last). Without a `userId` any assigned project task counts.
 */
export const assignedHomeTasks = (tasks = [], userId, todayKey) =>
  sortAssignedTasksForAttention(
    tasks.filter(
      (task) =>
        Boolean(task.projectId) &&
        (userId ? task.assigneeId === userId : Boolean(task.assigneeId))
    ),
    todayKey
  );

/** Projects that are neither archived nor on hold. */
export const activeProjects = (projects = []) =>
  projects.filter((project) => project.status === "active");

/** Active projects, most recently updated first. */
export const recentProjects = (projects = [], limit) => {
  const sorted = activeProjects(projects).sort((first, second) =>
    String(second.updatedAt || "").localeCompare(String(first.updatedAt || ""))
  );
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
};

/** Newest notifications first, capped for the widget. */
export const latestNotifications = (notifications = [], limit = 5) =>
  [...notifications]
    .sort((first, second) =>
      String(second.createdAt || "").localeCompare(String(first.createdAt || ""))
    )
    .slice(0, limit);
