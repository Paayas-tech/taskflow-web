import {
  classifyDateOnly,
  compareDateOnly,
  isArchived,
  isTaskComplete,
  taskTimestampToMillis,
} from "./taskDomain";

const urgencyRank = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  undated: 3,
};

const priorityRank = { high: 0, medium: 1, low: 2 };

const byAttention = (todayKey) => (first, second) => {
  const firstUrgency = classifyDateOnly(first.dueDate, todayKey);
  const secondUrgency = classifyDateOnly(second.dueDate, todayKey);
  const urgencyDifference = urgencyRank[firstUrgency] - urgencyRank[secondUrgency];
  if (urgencyDifference) return urgencyDifference;

  if (firstUrgency !== "undated") {
    const dueDateDifference = compareDateOnly(first.dueDate, second.dueDate);
    if (dueDateDifference) return dueDateDifference;
  }

  const priorityDifference =
    (priorityRank[first.priority] ?? priorityRank.medium) -
    (priorityRank[second.priority] ?? priorityRank.medium);
  if (priorityDifference) return priorityDifference;

  return String(first.title || "").localeCompare(String(second.title || ""));
};

const byCompletedAtDescending = (first, second) => {
  const firstCompletedAt = taskTimestampToMillis(first.completedAt);
  const secondCompletedAt = taskTimestampToMillis(second.completedAt);
  if (firstCompletedAt === secondCompletedAt) {
    return String(first.title || "").localeCompare(String(second.title || ""));
  }
  if (firstCompletedAt === null) return 1;
  if (secondCompletedAt === null) return -1;
  return secondCompletedAt - firstCompletedAt;
};

/**
 * Assigned project tasks ordered by how much attention they need. Completed
 * tasks are dropped unless `includeCompleted` is set, in which case they follow
 * the open tasks, most recently completed first.
 */
export const sortAssignedTasksForAttention = (
  tasks = [],
  todayKey,
  { includeCompleted = false } = {}
) => {
  const visible = tasks.filter(
    (task) => !isArchived(task) && task.projectStatus !== "archived"
  );
  const open = visible
    .filter((task) => !isTaskComplete(task))
    .sort(byAttention(todayKey));

  if (!includeCompleted) return open;

  const completed = visible.filter(isTaskComplete).sort(byCompletedAtDescending);
  return [...open, ...completed];
};
