import {
  getDueReminders,
  reminderNotificationKey,
} from "../domain/reminderDomain";

const browserNotificationApi = () =>
  typeof window !== "undefined" && "Notification" in window
    ? window.Notification
    : null;

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

export const playReminderSound = () => {
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

export const createReminderScheduler = ({
  getTasks,
  onInAppReminder,
  onOpenTask,
  notifiedIds = new Set(),
  intervalMs = 30_000,
  now = () => new Date(),
  notificationApi = browserNotificationApi(),
  getPreferences = () => ({
    enableBrowserNotifications: true,
    enableInAppReminders: true,
    enableSound: false,
  }),
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
