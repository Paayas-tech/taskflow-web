/**
 * Pure helpers behind the Home widgets and the Inbox: the three task buckets of
 * the My tasks widget, the project rows and the notification list.
 */
import { notificationLabel } from "../domain/collaboration";
import { myDayResetTime } from "../domain/settings";
import {
  classifyDateOnly,
  compareDateOnly,
  isArchived,
  isTaskComplete,
  shiftDateOnly,
} from "../domain/task";

const UPCOMING_DAYS = 7;
const priorityRank = { high: 0, medium: 1, low: 2 };

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
 * The date Home treats as "today". Before the My day reset time the day has
 * not rolled over yet, so the previous calendar day is still the current one;
 * the clock time is left alone, so the greeting still matches the wall clock.
 */
export const effectiveMyDayDate = (now = new Date(), myDay = {}) => {
  const current = new Date(now);
  if (Number.isNaN(current.getTime())) return new Date();

  const [resetHour, resetMinute] = myDayResetTime(myDay).split(":").map(Number);
  const beforeReset =
    current.getHours() < resetHour ||
    (current.getHours() === resetHour && current.getMinutes() < resetMinute);

  if (beforeReset) current.setDate(current.getDate() - 1);
  return current;
};

/**
 * Open tasks split into the Today / Upcoming / Overdue tabs. `upcoming` stops
 * at the seven-day horizon so the widget stays a short list.
 */
export const homeTaskBuckets = (tasks = [], todayKey) => {
  const horizon = shiftDateOnly(todayKey, UPCOMING_DAYS);
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

/** The given projects, most recently updated first, capped for the widget. */
export const recentProjects = (projects = [], limit) => {
  const sorted = [...projects].sort((first, second) =>
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

/**
 * A notification's sentence, with the actor's name taken from the store's
 * profile map when the row itself does not carry one.
 */
export const notificationText = (notification, profiles = {}) =>
  notificationLabel({
    ...notification,
    actorName:
      notification.actorName ||
      profiles[notification.data?.actorId]?.displayName ||
      "",
  });
