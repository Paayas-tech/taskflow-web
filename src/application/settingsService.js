import {
  getSettingsValidationError,
  normalizeSettings,
} from "../domain/settingsDomain";
import { updateDisplayName } from "./authService";
import { settingsRepository } from "../infrastructure/supabase/settingsRepository";

const STORAGE_PREFIX = "taskflow.settings";
export const settingsStorageKey = (userId) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("A user ID is required for settings.");
  return `${STORAGE_PREFIX}.${normalizedUserId}`;
};

const browserStorage = () =>
  typeof window !== "undefined" ? window.localStorage : null;

const settingsFromRow = (row = {}) => {
  if (row.settings_data && Object.keys(row.settings_data).length) {
    return row.settings_data;
  }

  return {
    theme: { mode: row.theme },
    background: { selected: row.background },
    navigation: { defaultView: row.default_view },
    taskDefaults: { listId: row.default_list_id },
    reminder: {
      defaultTime: row.reminder_default_time,
      enableBrowserNotifications: row.enable_browser_notifications,
      enableInAppReminders: row.enable_in_app_reminders,
      enableSound: row.enable_sound,
    },
    time: {
      format: row.time_format === "24_hour" ? "24-hour" : "12-hour",
      dateFormat: row.date_format,
      weekStartsOn: row.week_starts_on,
    },
    language: { code: row.locale },
  };
};

export const settingsToRow = (settings) => ({
  theme: settings.theme.mode,
  background: settings.background.selected,
  default_view: settings.navigation.defaultView,
  default_list_id: settings.taskDefaults.listId,
  reminder_default_time: settings.reminder.defaultTime,
  enable_browser_notifications: settings.reminder.enableBrowserNotifications,
  enable_in_app_reminders: settings.reminder.enableInAppReminders,
  enable_sound: settings.reminder.enableSound,
  time_format: settings.time.format === "24-hour" ? "24_hour" : "12_hour",
  date_format: settings.time.dateFormat,
  week_starts_on: settings.time.weekStartsOn,
  locale: settings.language.code,
  timezone:
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  settings_data: settings,
});

export const createSettingsService = (
  repository,
  { updateDisplayNameFn = updateDisplayName } = {}
) => ({
  async getSettings(user, storage = browserStorage()) {
    if (!user?.uid) throw new Error("A signed-in user is required for settings.");

    const row = await repository.getSettings(user.uid);
    if (row) return normalizeSettings(settingsFromRow(row), user);

    let storedValue = null;
    try {
      const stored = storage?.getItem(settingsStorageKey(user.uid));
      storedValue = stored ? JSON.parse(stored) : null;
    } catch {
      storedValue = null;
    }

    const normalized = normalizeSettings(storedValue || {}, user);
    if (storedValue) {
      await repository.saveSettings(user.uid, settingsToRow(normalized));
      try {
        storage?.removeItem?.(settingsStorageKey(user.uid));
      } catch {
        // The database migration succeeded; inability to clean old browser
        // storage must not make settings unavailable.
      }
    }
    return normalized;
  },

  async saveSettings(user, settings) {
    if (!user?.uid) throw new Error("A signed-in user is required for settings.");
    const validationError = getSettingsValidationError(settings);
    if (validationError) throw new Error(validationError);

    const normalized = normalizeSettings(settings, user);
    await repository.saveSettings(user.uid, settingsToRow(normalized));

    const currentDisplayName = String(user.displayName || "").trim();
    let profileUpdated = true;
    if (normalized.profile.displayName !== currentDisplayName) {
      try {
        await updateDisplayNameFn(normalized.profile.displayName);
      } catch {
        profileUpdated = false;
      }
    }
    return { settings: normalized, profileUpdated };
  },
});

const supabaseSettingsService = createSettingsService(settingsRepository);

export const getSettings = (...args) => supabaseSettingsService.getSettings(...args);
export const saveSettings = (...args) => supabaseSettingsService.saveSettings(...args);
