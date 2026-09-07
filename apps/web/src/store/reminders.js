/**
 * The reminder scheduler. Every 30 seconds (and whenever tasks change) it
 * looks for reminders that came due and announces each one once: a browser
 * notification when the person allowed them, an in-app toast otherwise, plus
 * the optional sound.
 */
import { getDueReminders, reminderNotificationKey } from "../domain/reminder";
import { selectMyTasks } from "./selectors";
import { getState, subscribe } from "./store";
import { openTask, openTaskInProject, setReminderNotice } from "./ui";

const browserNotificationApi = () =>
  typeof window !== "undefined" && "Notification" in window
    ? window.Notification
    : null;

/** Asks for browser notification permission; "unsupported" when unavailable. */
export const requestNotificationPermission = async () => {
  const notificationApi = browserNotificationApi();
  if (!notificationApi) return "unsupported";
  if (notificationApi.permission !== "default") return notificationApi.permission;

  try {
    return await notificationApi.requestPermission();
  } catch {
    return "unsupported";
  }
};

const notificationBody = (task) => {
  if (task.startTime) {
    return `Scheduled for ${task.dueDate} at ${task.startTime}.`;
  }
  if (task.dueDate) return `Scheduled for ${task.dueDate}.`;
  return "This task needs your attention.";
};

const playReminderSound = () => {
  if (typeof window === "undefined") return false;

  const AudioContextApi = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextApi) return false;

  try {
    const context = new AudioContextApi();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 640;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    oscillator.addEventListener("ended", () => void context.close());
    return true;
  } catch {
    return false;
  }
};

/**
 * The scheduler itself. Every dependency is injectable so the delivery rules
 * can be tested without timers, permissions or audio.
 */
export const createReminderScheduler = ({
  getTasks = () => selectMyTasks(getState()),
  onInAppReminder = setReminderNotice,
  onOpenTask = (task) =>
    task.projectId ? openTaskInProject(task) : openTask(task.id),
  notifiedIds = new Set(),
  intervalMs = 30_000,
  now = () => new Date(),
  notificationApi = browserNotificationApi(),
  getPreferences = () => getState().settings.reminder,
  onPlaySound = playReminderSound,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) => {
  let intervalId = null;

  const check = () => {
    const dueReminders = getDueReminders(getTasks?.() || [], {
      now: now(),
      notifiedIds,
    });

    dueReminders.forEach((task) => {
      const preferences = getPreferences?.() || {};
      const notificationKey = reminderNotificationKey(task);
      notifiedIds.add(notificationKey);
      let browserDelivered = false;

      if (
        preferences.enableBrowserNotifications !== false &&
        notificationApi?.permission === "granted"
      ) {
        try {
          const notification = new notificationApi("TaskFlow reminder", {
            body: `${task.title}. ${notificationBody(task)}`,
            tag: notificationKey,
          });
          notification.onclick = () => {
            if (typeof window !== "undefined") window.focus();
            onOpenTask?.(task);
            notification.close?.();
          };
          browserDelivered = true;
        } catch {
          browserDelivered = false;
        }
      }

      const inAppDelivered =
        !browserDelivered && preferences.enableInAppReminders !== false;
      if (inAppDelivered) onInAppReminder?.(task);
      if (
        preferences.enableSound === true &&
        (browserDelivered || inAppDelivered)
      ) {
        onPlaySound?.(task);
      }
    });

    return dueReminders;
  };

  const start = () => {
    if (intervalId !== null) return;
    check();
    intervalId = setIntervalFn(check, intervalMs);
  };

  const stop = () => {
    if (intervalId === null) return;
    clearIntervalFn(intervalId);
    intervalId = null;
  };

  return { check, start, stop, notifiedIds };
};

let scheduler = null;
let unsubscribe = null;

/** Starts the one scheduler for the signed-in session. */
export const startReminderScheduler = (options = {}) => {
  if (scheduler) return scheduler;

  scheduler = createReminderScheduler(options);
  scheduler.start();

  // Reminder times change as tasks are edited; re-check as soon as they do.
  let lastTasks = getState().tasks;
  unsubscribe = subscribe((state) => {
    if (state.tasks === lastTasks) return;
    lastTasks = state.tasks;
    scheduler?.check();
  });

  return scheduler;
};

export const stopReminderScheduler = () => {
  unsubscribe?.();
  unsubscribe = null;
  scheduler?.stop();
  scheduler = null;
  setReminderNotice(null);
};
