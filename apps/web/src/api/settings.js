import {
  getSettingsValidationError,
  normalizeSettings,
} from "../domain/settings";
import { updateDisplayName } from "./auth";
import { apiRequest } from "./client";

const SETTINGS_SELECT = "user_id, settings_data";

/**
 * `settings_data` is the canonical document; the typed columns are NOT NULL
 * with database-level CHECK constraints, so they are kept in sync on write.
 */
export const settingsToRow = (settings) => ({
  theme: settings.theme.mode,
  default_view: settings.navigation.defaultView,
  reminder_default_time: settings.reminder.defaultTime,
  enable_browser_notifications: settings.reminder.enableBrowserNotifications,
  enable_in_app_reminders: settings.reminder.enableInAppReminders,
  enable_sound: settings.reminder.enableSound,
  time_format: settings.time.format === "24-hour" ? "24_hour" : "12_hour",
  date_format: settings.time.dateFormat,
  week_starts_on: settings.time.weekStartsOn,
  locale: settings.language.code,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  settings_data: settings,
});

export const getSettings = async (user) => {
  if (!user?.uid) throw new Error("A signed-in user is required for settings.");
  return normalizeSettings(await apiRequest("/settings"), user);
};

export const saveSettings = async (user, settings) => {
  if (!user?.uid) throw new Error("A signed-in user is required for settings.");
  const validationError = getSettingsValidationError(settings);
  if (validationError) throw new Error(validationError);

  const normalized = normalizeSettings(settings, user);
  await apiRequest("/settings", { method: "PUT", body: JSON.stringify(normalized) });

  const currentDisplayName = String(user.displayName || "").trim();
  let profileUpdated = true;
  if (normalized.profile.displayName !== currentDisplayName) {
    try {
      await updateDisplayName(normalized.profile.displayName);
    } catch {
      // Settings are saved; a failed profile rename is reported, not fatal.
      profileUpdated = false;
    }
  }
  return { settings: normalized, profileUpdated };
};
