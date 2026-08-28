import { normalizeTaskSchedule } from "./calendarDomain";
import {
  dateTimeLocalToIso,
  normalizeReminderAt,
  toDateTimeLocalValue,
} from "./reminderDomain";

export { deriveIsAllDay } from "./calendarDomain";

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

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

export const isValidArchivedAt = (value) =>
  typeof value === "string" &&
  ISO_TIMESTAMP_PATTERN.test(value.trim()) &&
  Number.isFinite(Date.parse(value.trim()));

export const normalizeArchivedAt = (value) => {
  if (!isValidArchivedAt(value)) return null;
  return new Date(value.trim()).toISOString();
};

export const isArchived = (task = {}) =>
  normalizeArchivedAt(task.archivedAt) !== null;

export const archiveTask = (task, now = () => new Date()) => {
  if (isArchived(task)) {
    throw new Error("This task is already archived.");
  }

  const archivedDate = now();
  const archivedAt =
    archivedDate instanceof Date
      ? Number.isNaN(archivedDate.getTime())
        ? null
        : archivedDate.toISOString()
      : normalizeArchivedAt(archivedDate);

  if (!archivedAt) {
    throw new Error("Choose a valid archive timestamp.");
  }

  return { ...task, archivedAt };
};

export const unarchiveTask = (task) => {
  if (!isArchived(task)) {
    throw new Error("This task is not archived.");
  }

  return { ...task, archivedAt: null };
};

export const taskTimestampToMillis = (value) => {
  if (value === null || value === undefined) return null;
  try {
    if (typeof value.toMillis === "function") {
      const milliseconds = value.toMillis();
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }
    if (value instanceof Date) {
      const milliseconds = value.getTime();
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const milliseconds = Date.parse(value);
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }
    if (typeof value.toDate === "function") {
      const milliseconds = value.toDate().getTime();
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }
  } catch {
    return null;
  }
  return null;
};

export const normalizeTaskDocument = (id, data = {}) => {
  const status = normalizeTaskStatus(data.status, data.completed === true);
  const schedule = normalizeTaskSchedule(data);

  return {
    id,
    title: data.title || "Untitled task",
    description: data.description || "",
    notes: data.notes || "",
    status,
    completed: status === "completed",
    priority: normalizeTaskPriority(data.priority),
    dueDate: schedule.dueDate,
    endDate: schedule.endDate,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    isAllDay: schedule.isAllDay,
    reminder: data.reminder === true,
    reminderAt: normalizeReminderAt(data.reminderAt),
    listId: data.listId ?? null,
    projectId: data.projectId ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    completedAt: data.completedAt ?? null,
    archivedAt: normalizeArchivedAt(data.archivedAt),
  };
};

export const sortTasksNewestFirst = (tasks) =>
  [...tasks].sort((firstTask, secondTask) => {
    const firstCreatedAt = taskTimestampToMillis(firstTask.createdAt);
    const secondCreatedAt = taskTimestampToMillis(secondTask.createdAt);
    if (firstCreatedAt === null && secondCreatedAt === null) return 0;
    if (firstCreatedAt === null) return 1;
    if (secondCreatedAt === null) return -1;
    return secondCreatedAt - firstCreatedAt;
  });

export const isTaskComplete = (task) =>
  task.completed === true || task.status === "completed";

export const resolveCompletionUpdate = (
  data = {},
  completedTimestamp = () => null
) => {
  const hasStatus = hasOwn(data, "status");
  const hasCompleted = hasOwn(data, "completed");
  if (!hasStatus && !hasCompleted) return {};

  let status;
  if (hasCompleted && data.completed === true) {
    status = "completed";
  } else if (hasCompleted && data.completed === false) {
    const requestedStatus = hasStatus ? normalizeTaskStatus(data.status) : "todo";
    status = requestedStatus === "completed" ? "todo" : requestedStatus;
  } else if (hasStatus) {
    status = normalizeTaskStatus(data.status);
  } else {
    status = "todo";
  }

  const completed = status === "completed";
  return {
    status,
    completed,
    completedAt: completed ? completedTimestamp() : null,
  };
};

export const dateOnlyKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const localDateFromDateOnly = (value) => {
  if (!isValidDateOnly(value)) return null;
  const [year, month, day] = String(value).trim().split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const calendarMonthStart = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const shiftCalendarMonth = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const buildCalendarMonthGrid = (visibleMonth, weekStartsOn = 0) => {
  const monthStart = calendarMonthStart(visibleMonth);
  const normalizedWeekStart = weekStartsOn === 1 ? 1 : 0;
  const leadingDays = (monthStart.getDay() - normalizedWeekStart + 7) % 7;
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - leadingDays
  );

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );

    return {
      key: dateOnlyKey(date),
      day: date.getDate(),
      inCurrentMonth:
        date.getFullYear() === monthStart.getFullYear() &&
        date.getMonth() === monthStart.getMonth(),
    };
  });
};

export const calendarTasks = (tasks) =>
  tasks.filter(
    (task) => !isArchived(task) && isValidDateOnly(task.dueDate)
  );

export const calendarTasksByDate = (tasks) => {
  const tasksByDate = new Map();

  calendarTasks(tasks).forEach((task) => {
    const dueDate = task.dueDate.trim();
    const dateTasks = tasksByDate.get(dueDate) || [];
    dateTasks.push(task);
    tasksByDate.set(dueDate, dateTasks);
  });

  return tasksByDate;
};

export const tasksForCalendarDate = (tasks, dateKey) =>
  calendarTasks(tasks).filter((task) => task.dueDate.trim() === dateKey);

export const tasksForCalendarMonth = (tasks, visibleMonth) => {
  const monthStart = calendarMonthStart(visibleMonth);
  const firstDateKey = dateOnlyKey(monthStart);
  const lastDateKey = dateOnlyKey(
    new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  );

  return calendarTasks(tasks).filter((task) => {
    const dueDate = task.dueDate.trim();
    return (
      compareDateOnly(dueDate, firstDateKey) >= 0 &&
      compareDateOnly(dueDate, lastDateKey) <= 0
    );
  });
};

export const upcomingCalendarTasks = (tasks, visibleMonth, limit = 5) => {
  const monthStart = calendarMonthStart(visibleMonth);
  const lastDateKey = dateOnlyKey(
    new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  );

  return calendarTasks(tasks)
    .filter(
      (task) =>
        !isTaskComplete(task) &&
        compareDateOnly(task.dueDate.trim(), lastDateKey) > 0
    )
    .sort((firstTask, secondTask) =>
      compareDateOnly(firstTask.dueDate.trim(), secondTask.dueDate.trim())
    )
    .slice(0, limit);
};

export const isValidDateOnly = (value) => {
  const normalizedValue = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) return false;
  const [year, month, day] = normalizedValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const compareDateOnly = (firstValue, secondValue) => {
  const first = String(firstValue || "");
  const second = String(secondValue || "");
  if (first === second) return 0;
  return first < second ? -1 : 1;
};

export const classifyDateOnly = (value, referenceKey) => {
  const normalizedValue = typeof value === "string" ? value : "";
  if (!normalizedValue) return "undated";
  const comparison = compareDateOnly(normalizedValue, referenceKey);
  if (comparison < 0) return "overdue";
  if (comparison === 0) return "today";
  return "upcoming";
};

export const formatTaskDueDate = (value) => {
  if (!value) return "No due date";
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsedDate);
};

export const groupTasksForToday = (tasks, todayKey) => {
  const visibleTasks = tasks.filter((task) => !isArchived(task));
  const activeTasks = visibleTasks.filter((task) => !isTaskComplete(task));
  const overdue = activeTasks
    .filter((task) => classifyDateOnly(task.dueDate, todayKey) === "overdue")
    .sort((firstTask, secondTask) => compareDateOnly(firstTask.dueDate, secondTask.dueDate));
  const today = activeTasks.filter((task) => classifyDateOnly(task.dueDate, todayKey) === "today");
  const upcoming = activeTasks.filter((task) => classifyDateOnly(task.dueDate, todayKey) === "upcoming");
  const undated = activeTasks.filter((task) => classifyDateOnly(task.dueDate, todayKey) === "undated");
  const completed = visibleTasks.filter(
    (task) => isTaskComplete(task) && (!task.dueDate || compareDateOnly(task.dueDate, todayKey) <= 0)
  );
  return { overdue, today, upcoming, undated, completed };
};

export const taskMatchesSearch = (task, searchTerm) => {
  const normalizedSearch = String(searchTerm || "").trim().toLocaleLowerCase();
  if (!normalizedSearch) return true;
  return [task.title, task.description, task.notes].some((value) =>
    String(value || "").toLocaleLowerCase().includes(normalizedSearch)
  );
};

export const filterTasks = (
  tasks,
  {
    selectedListKey = "all",
    knownListIds = new Set(),
    searchTerm = "",
    status = "all",
    priority = "all",
    dueDate = "all",
    reminder = "all",
    completion = "all",
    todayKey,
  } = {}
) => tasks.filter((task) => {
  if (isArchived(task)) return false;
  // Personal task views are a second line of defense behind the repository's
  // `project_id IS NULL` query. A project-scoped row must never be classified
  // into All, Inbox, Today, Upcoming, Completed, or a personal list.
  if (task.projectId) return false;

  const belongsToSelectedList =
    selectedListKey === "all" ||
    (selectedListKey === "inbox"
      ? !task.listId || !knownListIds.has(task.listId)
      : task.listId === selectedListKey);
  if (!belongsToSelectedList || !taskMatchesSearch(task, searchTerm)) return false;
  if (status !== "all" && task.status !== status) return false;
  if (priority !== "all" && task.priority !== priority) return false;

  const completed = isTaskComplete(task);
  if (completion === "active" && completed) return false;
  if (completion === "completed" && !completed) return false;
  if (reminder === "enabled" && task.reminder !== true) return false;

  const taskDueDate =
    typeof task.dueDate === "string" ? task.dueDate.trim() : "";
  const dueDateGroup = classifyDateOnly(taskDueDate, todayKey);
  if (dueDate !== "all" && dueDateGroup !== dueDate) return false;
  return true;
});

export const filterTasksByProject = (tasks, projectId) =>
  tasks.filter((task) => !isArchived(task) && task.projectId === projectId);

export const taskFormValuesFromTask = (task, lists = []) => {
  const knownListIds = new Set(lists.map((list) => list.id));
  const schedule = normalizeTaskSchedule(task);

  return {
    title: task.title || "",
    description: task.description || "",
    notes: task.notes || "",
    status: task.status || "todo",
    priority: task.priority || "medium",
    dueDate: schedule.dueDate,
    endDate: schedule.endDate,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    reminder: task.reminder === true,
    reminderAt: toDateTimeLocalValue(task.reminderAt),
    listId: knownListIds.has(task.listId) ? task.listId : "",
    projectId: task.projectId || "",
  };
};

export const buildTaskEditPayload = (values) => ({
  title: values.title.trim(),
  description: values.description,
  notes: values.notes,
  status: values.status,
  completed: values.status === "completed",
  priority: values.priority,
  dueDate: values.dueDate,
  endDate: values.endDate || "",
  startTime: values.startTime || "",
  endTime: values.endTime || "",
  reminder: values.reminder,
  reminderAt: values.reminder
    ? dateTimeLocalToIso(values.reminderAt) || normalizeReminderAt(values.reminderAt)
    : "",
  listId: values.listId || null,
  projectId: values.projectId || null,
});
