import {
  classifyDateOnly,
  compareDateOnly,
  isArchived,
  isTaskComplete,
} from "./taskDomain";

const urgencyRank = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  undated: 3,
};

const priorityRank = { high: 0, medium: 1, low: 2 };

export const sortAssignedTasksForAttention = (tasks = [], todayKey) =>
  tasks
    .filter(
      (task) =>
        !isTaskComplete(task) &&
        !isArchived(task) &&
        task.projectStatus !== "archived"
    )
    .sort((first, second) => {
      const firstUrgency = classifyDateOnly(first.dueDate, todayKey);
      const secondUrgency = classifyDateOnly(second.dueDate, todayKey);
      const urgencyDifference =
        urgencyRank[firstUrgency] - urgencyRank[secondUrgency];
      if (urgencyDifference) return urgencyDifference;

      if (firstUrgency !== "undated") {
        const dueDateDifference = compareDateOnly(
          first.dueDate,
          second.dueDate
        );
        if (dueDateDifference) return dueDateDifference;
      }

      const priorityDifference =
        (priorityRank[first.priority] ?? priorityRank.medium) -
        (priorityRank[second.priority] ?? priorityRank.medium);
      if (priorityDifference) return priorityDifference;

      return String(first.title || "").localeCompare(
        String(second.title || "")
      );
    });
