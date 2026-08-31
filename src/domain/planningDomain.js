import { isTaskComplete } from "./taskDomain";

export const planningStatusGroup = (task) => isTaskComplete(task)
  ? "done"
  : ["in-progress", "in_progress"].includes(task.status) ? "in-progress" : "todo";

export const planningIssueLabels = (task, today) => {
  const labels = [];
  if (!isTaskComplete(task) && task.dueDate && task.dueDate < today) labels.push("Overdue");
  if (!isTaskComplete(task) && task.priority === "high") labels.push("High priority");
  if (!isTaskComplete(task) && task.projectId && !task.assigneeId) labels.push("Unassigned");
  return labels;
};

export const normalizePlanningGoals = (goals) => Array.isArray(goals)
  ? goals.filter((goal) => goal?.id && goal?.title)
  : [];
