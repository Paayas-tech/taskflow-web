import { updateProfile } from "firebase/auth";
import {
  getSettingsValidationError,
  normalizeSettings,
} from "../domain/settingsDomain";

const STORAGE_PREFIX = "taskflow.settings";

export const settingsStorageKey = (userId) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("A user ID is required for settings.");
  return `${STORAGE_PREFIX}.${normalizedUserId}`;
};

const browserStorage = () =>
  typeof window !== "undefined" ? window.localStorage : null;

export const getSettings = async (user, storage = browserStorage()) => {
  if (!user?.uid) throw new Error("A signed-in user is required for settings.");

  try {
    const stored = storage?.getItem(settingsStorageKey(user.uid));
    return normalizeSettings(stored ? JSON.parse(stored) : {}, user);
  } catch {
    return normalizeSettings({}, user);
  }
};

export const saveSettings = async (
  user,
  settings,
  { storage = browserStorage(), updateProfileFn = updateProfile } = {}
) => {
  if (!user?.uid) throw new Error("A signed-in user is required for settings.");

  const validationError = getSettingsValidationError(settings);
  if (validationError) throw new Error(validationError);

  const normalized = normalizeSettings(settings, user);
  if (!storage) throw new Error("Browser storage is unavailable.");
  storage.setItem(settingsStorageKey(user.uid), JSON.stringify(normalized));

  const currentDisplayName = String(user.displayName || "").trim();
  let profileUpdated = true;
  if (normalized.profile.displayName !== currentDisplayName) {
    try {
      await updateProfileFn(user, {
        displayName: normalized.profile.displayName || null,
      });
    } catch {
      profileUpdated = false;
    }
  }

  return { settings: normalized, profileUpdated };
};
