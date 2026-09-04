/**
 * Task domain: status/priority/completion/archive rules, the date-only and
 * schedule helpers every surface shares, one due-date classification
 * (tone + label), grouping, sorting and search.
 * Pure functions — no React, no api, no store.
 */
import { safeDisplayName } from "./collaboration";
import { toDateTimeLocalValue } from "./reminder";

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const text = (value) => String(value || "").trim();
const trimmedDate = (value) => (typeof value === "string" ? value.trim() : "");

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const STATUS_LABELS = {
  todo: "To do",
  "in-progress": "In progress",
  in_progress: "In progress",
  completed: "Done",
  done: "Done",
};

const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };
const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };
const URGENCY_WEIGHT = { overdue: 0, today: 1, upcoming: 2, undated: 3 };

const UPCOMING_DAYS = 7;

/* -- Date-only values (`YYYY-MM-DD`, always read in the viewer's local zone) -- */

/** A local `Date` at midnight, or null when the value is not a date-only key. */
export const localDateFromDateOnly = (value) => {
  const normalized = text(value);
  if (!DATE_ONLY_PATTERN.test(normalized)) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

export const isValidDateOnly = (value) => localDateFromDateOnly(value) !== null;

export const dateOnlyKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** The date-only key `amount` days after `value`; "" for an invalid input. */
export const shiftDateOnly = (value, amount) => {
  const date = localDateFromDateOnly(value);
  if (!date) return "";
  date.setDate(date.getDate() + amount);
  return dateOnlyKey(date);
};

/** Date-only keys compare correctly as plain strings. */
export const compareDateOnly = (firstValue, secondValue) => {
  const first = String(firstValue || "");
  const second = String(secondValue || "");
  if (first === second) return 0;
  return first < second ? -1 : 1;
};

/** `undated | overdue | today | upcoming` against a reference day. */
export const classifyDateOnly = (value, referenceKey) => {
  const normalizedValue = typeof value === "string" ? value : "";
  if (!normalizedValue) return "undated";
  const comparison = compareDateOnly(normalizedValue, referenceKey);
  if (comparison < 0) return "overdue";
  if (comparison === 0) return "today";
  return "upcoming";
};

export const isValidTimeOnly = (value) => TIME_ONLY_PATTERN.test(text(value));

/** Minutes since midnight for an `HH:mm` value, or null. */
export const timeToMinutes = (value) => {
  if (!isValidTimeOnly(value)) return null;
  const [hours, minutes] = text(value).split(":").map(Number);
  return hours * 60 + minutes;
};

/* -- Task schedule (start date, optional end date, optional times) -- */

const scheduleFields = (schedule = {}) => ({
  dueDate: text(schedule.dueDate),
  endDate: text(schedule.endDate),
  startTime: text(schedule.startTime),
  endTime: text(schedule.endTime),
});

/** The first broken rule, in order, or "" when the schedule is usable. */
export const getScheduleValidationError = (schedule = {}) => {
  const { dueDate, endDate, startTime, endTime } = scheduleFields(schedule);

  if (dueDate && !isValidDateOnly(dueDate)) {
    return "Start date must use a valid YYYY-MM-DD date.";
  }
  if (!dueDate && (endDate || startTime || endTime)) {
    return "Choose a start date before adding an end date or time.";
  }
  if (endDate && !isValidDateOnly(endDate)) {
    return "End date must use a valid YYYY-MM-DD date.";
  }
  if (endDate && endDate < dueDate) {
    return "End date cannot be earlier than the start date.";
  }
  if (Boolean(startTime) !== Boolean(endTime)) {
    return "Start time and end time must be provided together.";
  }
  if (startTime && !isValidTimeOnly(startTime)) {
    return "Start time must use a valid 24-hour HH:mm time.";
  }
  if (endTime && !isValidTimeOnly(endTime)) {
    return "End time must use a valid 24-hour HH:mm time.";
  }
  if (
    startTime &&
    (endDate || dueDate) === dueDate &&
    timeToMinutes(endTime) <= timeToMinutes(startTime)
  ) {
    return "End time must be later than start time for a single-day item.";
  }

  return "";
};

export const normalizeTaskSchedule = (
  schedule = {},
  { validate = false } = {}
) => {
  const normalized = scheduleFields(schedule);

  if (validate) {
    const validationError = getScheduleValidationError(normalized);
    if (validationError) throw new Error(validationError);
  }

  return {
    ...normalized,
    isAllDay: !normalized.startTime && !normalized.endTime,
  };
};

/* -- Status, priority and their labels -- */

export const normalizeTaskStatus = (status, completed = false) => {
  if (completed) return "completed";
  const value = String(status || "").toLowerCase().trim();
  if (value === "in progress" || value === "in-progress" || value === "progress") {
    return "in-progress";
  }
  if (value === "completed" || value === "complete" || value === "done") {
    return "completed";
  }
  return "todo";
};

export const normalizeTaskPriority = (priority) => {
  const value = String(priority || "").toLowerCase().trim();
  return value === "low" || value === "high" ? value : "medium";
};

/** `To do | In progress | Done`, accepting both the app and database spelling. */
export const statusLabel = (status) => STATUS_LABELS[status] || STATUS_LABELS.todo;

/** `Low | Medium | High` */
export const priorityLabel = (priority) =>
  PRIORITY_LABELS[priority] || PRIORITY_LABELS.medium;

const priorityWeight = (task) =>
  PRIORITY_WEIGHT[task.priority] ?? PRIORITY_WEIGHT.medium;

/* -- Timestamps and the comparators built on them -- */

/** Milliseconds for an ISO string (the api shape), a `Date` or a number. */
export const taskTimestampToMillis = (value) => {
  const milliseconds =
    typeof value === "string"
      ? Date.parse(value)
      : value instanceof Date
        ? value.getTime()
        : typeof value === "number"
          ? value
          : NaN;
  return Number.isFinite(milliseconds) ? milliseconds : null;
};

/** Newest first by `field`, treating an unreadable timestamp as the epoch. */
const byTimestampDescending = (field) => (first, second) =>
  (taskTimestampToMillis(second[field]) ?? 0) -
  (taskTimestampToMillis(first[field]) ?? 0);

const byCompletedAtDescending = byTimestampDescending("completedAt");

const byTitle = (first, second) =>
  String(first.title || "").localeCompare(String(second.title || ""));

/* -- Completion and archiving -- */

export const isTaskComplete = (task) =>
  task.completed === true || task.status === "completed";

export const normalizeArchivedAt = (value) => {
  const trimmed = trimmedDate(value);
  if (!ISO_TIMESTAMP_PATTERN.test(trimmed)) return null;
  const milliseconds = Date.parse(trimmed);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : null;
};

export const isArchived = (task = {}) =>
  normalizeArchivedAt(task.archivedAt) !== null;

/** Archived tasks, most recently archived first. */
export const filterArchivedTasks = (tasks = []) =>
  tasks.filter(isArchived).sort(byTimestampDescending("archivedAt"));

/**
 * Derives `status`/`completed`/`completedAt` from whichever of the two the
 * caller supplied. Returns `{}` for updates that touch neither.
 */
export const resolveCompletionUpdate = (
  data = {},
  completedTimestamp = () => null
) => {
  const hasStatus = hasOwn(data, "status");
  const hasCompleted = hasOwn(data, "completed");
  if (!hasStatus && !hasCompleted) return {};

  const requestedStatus = hasStatus ? normalizeTaskStatus(data.status) : "todo";
  let status = requestedStatus;
  if (hasCompleted && data.completed === true) {
    status = "completed";
  } else if (hasCompleted && data.completed === false) {
    status = requestedStatus === "completed" ? "todo" : requestedStatus;
  }

  const completed = status === "completed";
  return {
    status,
    completed,
    completedAt: completed ? completedTimestamp() : null,
  };
};

/* -- Form values -- */

/** The editable shape a task form starts from. */
export const taskFormValuesFromTask = (task) => {
  // The form edits the four schedule fields; `isAllDay` is derived from them.
  const { isAllDay: _isAllDay, ...schedule } = normalizeTaskSchedule(task);

  return {
    title: task.title || "",
    description: task.description || "",
    notes: task.notes || "",
    status: task.status || "todo",
    priority: task.priority || "medium",
    ...schedule,
    reminder: task.reminder === true,
    reminderAt: toDateTimeLocalValue(task.reminderAt),
    projectId: task.projectId || "",
    workType: task.workType === "story" ? "story" : "task",
    storyId: task.storyId || "",
  };
};

/* -- Due-date presentation -- */

const normalizedDueDate = (task) => trimmedDate(task?.dueDate);

const todayOrNow = (todayKey) =>
  typeof todayKey === "string" && todayKey ? todayKey : dateOnlyKey(new Date());

/**
 * `overdue | today | soon | later | none`. Completed work never reads as
 * overdue or due today, so a finished row stays muted.
 */
export function dueDateTone(dueDate, todayKey, completed = false) {
  const value = trimmedDate(dueDate);
  if (!value) return "none";
  if (completed) return "later";

  const reference = todayOrNow(todayKey);
  const comparison = compareDateOnly(value, reference);
  if (comparison < 0) return "overdue";
  if (comparison === 0) return "today";
  return compareDateOnly(value, shiftDateOnly(reference, UPCOMING_DAYS)) <= 0
    ? "soon"
    : "later";
}

/** `Today`, `Tomorrow`, `Yesterday` or `Mon 12 Aug` (with the year when it differs). */
export function formatDueLabel(dueDate, todayKey) {
  const value = trimmedDate(dueDate);
  if (!value) return "";

  const date = localDateFromDateOnly(value);
  if (!date) return value;

  const reference = todayOrNow(todayKey);
  if (value === reference) return "Today";
  if (value === shiftDateOnly(reference, 1)) return "Tomorrow";
  if (value === shiftDateOnly(reference, -1)) return "Yesterday";

  const referenceYear = localDateFromDateOnly(reference)?.getFullYear();
  const sameYear =
    referenceYear === undefined || referenceYear === date.getFullYear();

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/* -- Grouping, sorting and search -- */

const byDueDateAscending = (first, second) =>
  compareDateOnly(normalizedDueDate(first), normalizedDueDate(second));

const DUE_GROUPS = [
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["later", "Later"],
  ["none", "No due date"],
  ["completed", "Completed"],
];

/**
 * Ordered due-date sections: overdue, today, upcoming (next 7 days), later,
 * no due date, then completed. Empty groups are dropped except `today`, so the
 * page always has somewhere to add work.
 */
export function groupTasksByDue(tasks = [], todayKey) {
  const reference = todayOrNow(todayKey);
  const buckets = Object.fromEntries(DUE_GROUPS.map(([id]) => [id, []]));

  tasks.forEach((task) => {
    if (isTaskComplete(task)) {
      buckets.completed.push(task);
      return;
    }
    // `dueDateTone` calls the next-7-days bucket `soon`; the section is `upcoming`.
    const tone = dueDateTone(task.dueDate, reference, false);
    buckets[tone === "soon" ? "upcoming" : tone].push(task);
  });

  [buckets.overdue, buckets.upcoming, buckets.later].forEach((bucket) =>
    bucket.sort(byDueDateAscending)
  );
  buckets.completed.sort(byCompletedAtDescending);

  return DUE_GROUPS.map(([id, label]) => ({
    id,
    label,
    tasks: buckets[id],
  })).filter((group) => group.id === "today" || group.tasks.length > 0);
}

const memberName = (member) =>
  member ? safeDisplayName(member) : "TaskFlow user";

/**
 * How each grouping key names a task's group (`[id, label]`), plus the order
 * its groups are shown in. Keys with no fixed `order` keep first-seen order and
 * push `trailing` (the "no value" group) to the end.
 */
const GROUPERS = {
  priority: {
    order: ["high", "medium", "low"],
    entry: (task) => {
      const priority = task.priority || "medium";
      return [priority, priorityLabel(priority)];
    },
  },
  status: {
    order: ["todo", "in-progress", "completed"],
    entry: (task) => {
      const status = isTaskComplete(task) ? "completed" : task.status || "todo";
      return [status, statusLabel(status)];
    },
  },
  project: {
    trailing: "none",
    entry: ({ projectId, projectName }, { projectsById }) =>
      projectId
        ? [
            projectId,
            projectsById?.get?.(projectId)?.name || projectName || "Project",
          ]
        : ["none", "Personal"],
  },
  story: {
    trailing: "none",
    entry: ({ storyId, storyName }, { storiesById }) =>
      storyId
        ? [storyId, storiesById?.get?.(storyId)?.title || storyName || "Story"]
        : ["none", "No story"],
  },
  assignee: {
    trailing: "none",
    entry: ({ assigneeId, assigneeName }, { membersById }) =>
      assigneeId
        ? [assigneeId, assigneeName || memberName(membersById?.get?.(assigneeId))]
        : ["none", "Unassigned"],
  },
};

const UNGROUPED = { trailing: "none", entry: () => ["all", "All tasks"] };

/** Groups tasks by `priority | project | status | story | assignee`. */
export function groupTasksBy(tasks = [], key, context = {}) {
  const {
    order = [],
    trailing = "",
    entry,
  } = hasOwn(GROUPERS, key) ? GROUPERS[key] : UNGROUPED;
  const byId = new Map();

  tasks.forEach((task) => {
    const [id, label] = entry(task, context);
    if (!byId.has(id)) byId.set(id, { id, label, tasks: [] });
    byId.get(id).tasks.push(task);
  });

  const rank = ({ id }) => {
    if (trailing && id === trailing) return order.length + 1;
    const index = order.indexOf(id);
    return index === -1 ? order.length : index;
  };

  return [...byId.values()].sort((first, second) => rank(first) - rank(second));
}

const TASK_COMPARATORS = {
  due: (first, second) => {
    const firstDue = normalizedDueDate(first);
    const secondDue = normalizedDueDate(second);
    if (!firstDue || !secondDue) {
      return (firstDue ? 0 : 1) - (secondDue ? 0 : 1);
    }
    return compareDateOnly(firstDue, secondDue);
  },
  priority: (first, second) => priorityWeight(first) - priorityWeight(second),
  title: byTitle,
  created: byTimestampDescending("createdAt"),
  updated: byTimestampDescending("updatedAt"),
};

/** Sorts by `due | priority | created | title | updated` without mutating the input. */
export function sortTasks(tasks = [], sort = "due") {
  const compare = hasOwn(TASK_COMPARATORS, sort)
    ? TASK_COMPARATORS[sort]
    : TASK_COMPARATORS.due;
  return [...tasks].sort(compare);
}

/** Personal tasks, newest first; a task with no `createdAt` sorts last. */
export const sortTasksNewestFirst = (tasks) => sortTasks(tasks, "created");

/** Case-insensitive match across title, description, notes, project and story. */
export function taskSearchMatch(task, query) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return true;

  return [
    task?.title,
    task?.description,
    task?.notes,
    task?.projectName,
    task?.storyName,
  ].some((value) => String(value || "").toLocaleLowerCase().includes(needle));
}

/* -- Assigned work -- */

const byAttention = (todayKey) => (first, second) => {
  const firstUrgency = classifyDateOnly(first.dueDate, todayKey);
  const secondUrgency = classifyDateOnly(second.dueDate, todayKey);
  const urgencyDifference =
    URGENCY_WEIGHT[firstUrgency] - URGENCY_WEIGHT[secondUrgency];
  if (urgencyDifference) return urgencyDifference;

  if (firstUrgency !== "undated") {
    const dueDateDifference = compareDateOnly(first.dueDate, second.dueDate);
    if (dueDateDifference) return dueDateDifference;
  }

  const priorityDifference = priorityWeight(first) - priorityWeight(second);
  if (priorityDifference) return priorityDifference;

  return byTitle(first, second);
};

const byCompletionRecency = (first, second) =>
  byCompletedAtDescending(first, second) || byTitle(first, second);

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

  const completed = visible.filter(isTaskComplete).sort(byCompletionRecency);
  return [...open, ...completed];
};

/* -- Project overview -- */

export const PROJECT_HEALTH_OPTIONS = [
  { value: "on_track", label: "On track" },
  { value: "at_risk", label: "At risk" },
  { value: "off_track", label: "Off track" },
  { value: "on_hold", label: "On hold" },
  { value: "complete", label: "Complete" },
];

const healthValues = new Set(PROJECT_HEALTH_OPTIONS.map(({ value }) => value));

export const normalizeProjectHealth = (value) =>
  healthValues.has(value) ? value : "on_track";

export const formatOverviewDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};
