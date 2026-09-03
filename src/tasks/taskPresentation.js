/**
 * Pure presentation helpers shared by every task surface (rows, cards, board,
 * panel). No React, no services — labels, tones, grouping, sorting, search.
 */
import {
  compareDateOnly,
  dateOnlyKey,
  isTaskComplete,
  localDateFromDateOnly,
  taskTimestampToMillis,
} from "../domain/taskDomain";
import { safeDisplayName } from "../domain/identityDomain";

const STATUS_LABELS = {
  todo: "To do",
  "in-progress": "In progress",
  completed: "Done",
};

const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

const normalizedDueDate = (task) =>
  typeof task?.dueDate === "string" ? task.dueDate.trim() : "";

const todayOrNow = (todayKey) =>
  typeof todayKey === "string" && todayKey ? todayKey : dateOnlyKey(new Date());

/** `To do | In progress | Done` */
export const statusLabel = (status) => STATUS_LABELS[status] || STATUS_LABELS.todo;

/** `Low | Medium | High` */
export const priorityLabel = (priority) =>
  PRIORITY_LABELS[priority] || PRIORITY_LABELS.medium;

const shiftDateOnly = (key, days) => {
  const date = localDateFromDateOnly(key);
  if (!date) return key;
  return dateOnlyKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
};

/**
 * `overdue | today | soon | later | none`. Completed work never reads as
 * overdue or due today, so a finished row stays muted.
 */
export function dueDateTone(dueDate, todayKey, completed = false) {
  const value = typeof dueDate === "string" ? dueDate.trim() : "";
  if (!value) return "none";
  if (completed) return "later";

  const reference = todayOrNow(todayKey);
  const comparison = compareDateOnly(value, reference);
  if (comparison < 0) return "overdue";
  if (comparison === 0) return "today";
  return compareDateOnly(value, shiftDateOnly(reference, 7)) <= 0 ? "soon" : "later";
}

/** `Today`, `Tomorrow`, `Yesterday` or `Mon 12 Aug` (with the year when it differs). */
export function formatDueLabel(dueDate, todayKey) {
  const value = typeof dueDate === "string" ? dueDate.trim() : "";
  if (!value) return "";

  const date = localDateFromDateOnly(value);
  if (!date) return value;

  const reference = todayOrNow(todayKey);
  if (value === reference) return "Today";
  if (value === shiftDateOnly(reference, 1)) return "Tomorrow";
  if (value === shiftDateOnly(reference, -1)) return "Yesterday";

  const referenceDate = localDateFromDateOnly(reference);
  const sameYear = referenceDate ? referenceDate.getFullYear() === date.getFullYear() : true;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

const byDueDateAscending = (first, second) =>
  compareDateOnly(normalizedDueDate(first), normalizedDueDate(second));

const byCompletedAtDescending = (first, second) =>
  (taskTimestampToMillis(second.completedAt) ?? 0) -
  (taskTimestampToMillis(first.completedAt) ?? 0);

/**
 * Ordered due-date sections: overdue, today, upcoming (next 7 days), later,
 * no due date, then completed. Empty groups are dropped except `today`, so the
 * page always has somewhere to add work.
 */
export function groupTasksByDue(tasks = [], todayKey) {
  const reference = todayOrNow(todayKey);
  const buckets = {
    overdue: [],
    today: [],
    upcoming: [],
    later: [],
    none: [],
    completed: [],
  };

  tasks.forEach((task) => {
    if (isTaskComplete(task)) {
      buckets.completed.push(task);
      return;
    }
    const tone = dueDateTone(task.dueDate, reference, false);
    if (tone === "soon") buckets.upcoming.push(task);
    else if (tone === "none") buckets.none.push(task);
    else buckets[tone].push(task);
  });

  buckets.overdue.sort(byDueDateAscending);
  buckets.upcoming.sort(byDueDateAscending);
  buckets.later.sort(byDueDateAscending);
  buckets.completed.sort(byCompletedAtDescending);

  const groups = [
    { id: "overdue", label: "Overdue", tasks: buckets.overdue },
    { id: "today", label: "Today", tasks: buckets.today },
    { id: "upcoming", label: "Upcoming", tasks: buckets.upcoming },
    { id: "later", label: "Later", tasks: buckets.later },
    { id: "none", label: "No due date", tasks: buckets.none },
    { id: "completed", label: "Completed", tasks: buckets.completed },
  ];

  return groups.filter((group) => group.id === "today" || group.tasks.length > 0);
}

const groupCollector = () => {
  const order = [];
  const byId = new Map();
  return {
    add(id, label, task) {
      if (!byId.has(id)) {
        const group = { id, label, tasks: [] };
        byId.set(id, group);
        order.push(group);
      }
      byId.get(id).tasks.push(task);
    },
    result: () => order,
  };
};

const orderedGroups = (collector, order, trailingId) => {
  const groups = collector.result();
  const rank = (group) => {
    if (trailingId && group.id === trailingId) return order.length + 1;
    const index = order.indexOf(group.id);
    return index === -1 ? order.length : index;
  };
  return [...groups].sort((first, second) => rank(first) - rank(second));
};

/** Groups tasks by `priority | project | status | story | assignee`. */
export function groupTasksBy(tasks = [], key, context = {}) {
  const collector = groupCollector();
  const { projectsById, membersById, storiesById } = context;

  tasks.forEach((task) => {
    if (key === "priority") {
      const priority = task.priority || "medium";
      collector.add(priority, priorityLabel(priority), task);
      return;
    }
    if (key === "status") {
      const status = isTaskComplete(task) ? "completed" : task.status || "todo";
      collector.add(status, statusLabel(status), task);
      return;
    }
    if (key === "project") {
      const projectId = task.projectId || "";
      if (!projectId) {
        collector.add("none", "Personal", task);
        return;
      }
      const project = projectsById?.get?.(projectId);
      collector.add(projectId, project?.name || task.projectName || "Project", task);
      return;
    }
    if (key === "story") {
      const storyId = task.storyId || "";
      if (!storyId) {
        collector.add("none", "No story", task);
        return;
      }
      const story = storiesById?.get?.(storyId);
      collector.add(storyId, story?.title || task.storyName || "Story", task);
      return;
    }
    if (key === "assignee") {
      const assigneeId = task.assigneeId || "";
      if (!assigneeId) {
        collector.add("none", "Unassigned", task);
        return;
      }
      const member = membersById?.get?.(assigneeId);
      collector.add(
        assigneeId,
        task.assigneeName || (member ? safeDisplayName(member) : "TaskFlow user"),
        task
      );
      return;
    }
    collector.add("all", "All tasks", task);
  });

  if (key === "priority") return orderedGroups(collector, ["high", "medium", "low"]);
  if (key === "status") return orderedGroups(collector, ["todo", "in-progress", "completed"]);
  return orderedGroups(collector, [], "none");
}

/** Sorts by `due | priority | created | title | updated` without mutating the input. */
export function sortTasks(tasks = [], sort = "due") {
  const sorted = [...tasks];

  if (sort === "priority") {
    return sorted.sort(
      (first, second) =>
        (PRIORITY_WEIGHT[first.priority] ?? 1) - (PRIORITY_WEIGHT[second.priority] ?? 1)
    );
  }
  if (sort === "title") {
    return sorted.sort((first, second) =>
      String(first.title || "").localeCompare(String(second.title || ""))
    );
  }
  if (sort === "created" || sort === "updated") {
    const field = sort === "created" ? "createdAt" : "updatedAt";
    return sorted.sort(
      (first, second) =>
        (taskTimestampToMillis(second[field]) ?? 0) - (taskTimestampToMillis(first[field]) ?? 0)
    );
  }

  return sorted.sort((first, second) => {
    const firstDue = normalizedDueDate(first);
    const secondDue = normalizedDueDate(second);
    if (!firstDue && !secondDue) return 0;
    if (!firstDue) return 1;
    if (!secondDue) return -1;
    return compareDateOnly(firstDue, secondDue);
  });
}

/** Case-insensitive match across title, description, notes, project and story. */
export function taskSearchMatch(task, query) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return true;

  return [task?.title, task?.description, task?.notes, task?.projectName, task?.storyName].some(
    (value) => String(value || "").toLocaleLowerCase().includes(needle)
  );
}
