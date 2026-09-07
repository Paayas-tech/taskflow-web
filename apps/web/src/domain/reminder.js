/**
 * Reminder scheduling: value normalization, presets, validation, the metadata
 * line shown next to a task and the "which reminders are due now" selection.
 */

const DATE_TIME_LOCAL_PATTERN =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;

const reminderPresetOffsets = {
  "at-time": 0,
  "5-minutes": 5,
  "15-minutes": 15,
  "30-minutes": 30,
  "1-hour": 60,
  "1-day": 1440,
};

const dateFromValue = (value) => {
  if (!value) return null;

  try {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "string") {
      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? null : new Date(timestamp);
    }
  } catch {
    return null;
  }

  return null;
};

const pad = (value) => String(value).padStart(2, "0");

const roundToMinute = (date) => {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  return rounded;
};

/** An ISO string for anything date-like, or "" when the value is unusable. */
export const normalizeReminderAt = (value) => {
  const date = dateFromValue(value);
  return date ? date.toISOString() : "";
};

/** The `YYYY-MM-DDTHH:mm` value a `datetime-local` input expects. */
export const toDateTimeLocalValue = (value) => {
  const date = dateFromValue(value);
  if (!date) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const dateTimeLocalToIso = (value) => {
  const normalized = String(value || "").trim();
  if (!DATE_TIME_LOCAL_PATTERN.test(normalized)) return "";

  const date = dateFromValue(normalized);
  return date ? date.toISOString() : "";
};

/** The local start moment of a task; undated tasks have none. */
const taskStartDateTime = ({ dueDate = "", startTime = "" } = {}) => {
  const date = String(dueDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const time = /^\d{2}:\d{2}$/.test(startTime) ? startTime : "09:00";
  const result = dateFromValue(`${date}T${time}`);
  return result && !Number.isNaN(result.getTime()) ? result : null;
};

export const calculateReminderPreset = (
  task,
  preset,
  { now = new Date() } = {}
) => {
  if (!Object.prototype.hasOwnProperty.call(reminderPresetOffsets, preset)) {
    return "";
  }

  const taskStart = taskStartDateTime(task);
  if (!taskStart) return "";

  const reminderDate = new Date(
    taskStart.getTime() - reminderPresetOffsets[preset] * 60_000
  );
  return reminderDate > now ? roundToMinute(reminderDate).toISOString() : "";
};

export const defaultReminderAt = (
  task = {},
  now = new Date(),
  defaultMinutes = 15
) => {
  const currentTime = now instanceof Date ? now : new Date(now);
  const taskStart = taskStartDateTime(task);
  const offsetMinutes =
    Number.isInteger(Number(defaultMinutes)) && Number(defaultMinutes) >= 1
      ? Number(defaultMinutes)
      : 15;

  if (taskStart) {
    const beforeTask = new Date(taskStart.getTime() - offsetMinutes * 60_000);
    if (beforeTask > currentTime) {
      return roundToMinute(beforeTask).toISOString();
    }
    if (taskStart > currentTime) return roundToMinute(taskStart).toISOString();
  }

  return roundToMinute(
    new Date(currentTime.getTime() + offsetMinutes * 60_000)
  ).toISOString();
};

export const getReminderValidationError = (
  { reminder = false, reminderAt = "", createdAt = null } = {},
  { now = new Date(), allowPast = false, requireScheduled = false } = {}
) => {
  if (!reminder) return "";
  if (!reminderAt) {
    return requireScheduled ? "Choose when TaskFlow should remind you." : "";
  }

  const normalizedReminder = normalizeReminderAt(reminderAt);
  if (!normalizedReminder) return "Choose a valid reminder date and time.";

  const reminderDate = new Date(normalizedReminder);
  const nowDate = now instanceof Date ? now : new Date(now);
  if (!allowPast && reminderDate <= nowDate) {
    return "Reminder time must be in the future.";
  }

  const createdDate = dateFromValue(createdAt);
  if (createdDate && reminderDate <= createdDate) {
    return "Reminder time must be later than the task creation time.";
  }

  return "";
};

export const formatReminderMetadata = (
  value,
  now = new Date(),
  { timeFormat = "12-hour" } = {}
) => {
  const normalized = normalizeReminderAt(value);
  if (!normalized) return "Reminder";

  const reminderDate = new Date(normalized);
  const currentTime = now instanceof Date ? now : new Date(now);
  const difference = reminderDate.getTime() - currentTime.getTime();

  if (difference <= 0) return "Reminder due";
  if (difference < 60_000) return "Reminds in less than a minute";
  if (difference <= 60 * 60_000) {
    const minutes = Math.ceil(difference / 60_000);
    return `Reminds in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }

  const sameDay =
    reminderDate.getFullYear() === currentTime.getFullYear() &&
    reminderDate.getMonth() === currentTime.getMonth() &&
    reminderDate.getDate() === currentTime.getDate();
  const formatted = new Intl.DateTimeFormat(undefined, {
    ...(sameDay ? {} : { month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat !== "24-hour",
  }).format(reminderDate);
  return `Reminds ${sameDay ? "at" : "on"} ${formatted}`;
};

/** Identifies one reminder occurrence so it is only announced once. */
export const reminderNotificationKey = (task) =>
  `${task.id}:${normalizeReminderAt(task.reminderAt)}`;

const isReminderDue = (task, now) => {
  if (
    task.reminder !== true ||
    task.completed === true ||
    task.status === "completed" ||
    (typeof task.archivedAt === "string" && task.archivedAt.trim())
  ) {
    return false;
  }

  const normalized = normalizeReminderAt(task.reminderAt);
  return normalized ? new Date(normalized) <= now : false;
};

export const getDueReminders = (
  tasks = [],
  { now = new Date(), notifiedIds = new Set() } = {}
) =>
  tasks.filter(
    (task) =>
      isReminderDue(task, now) &&
      !notifiedIds.has(reminderNotificationKey(task))
  );
