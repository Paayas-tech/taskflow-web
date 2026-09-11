/**
 * Settings actions. The store always holds a normalized settings object
 * (defaults until the account row loads), so every surface can read it without
 * a loading branch.
 */
import {
  getSettingsValidationError,
  normalizeSettings,
} from "../domain/settings";
import {
  api,
  getState,
  isCurrentSession,
  sessionStamp,
  setState,
} from "./store";

const SAVE_ERROR = "We couldn't save your settings. Please try again.";
const REMEMBERED_PATHS = ["/", "/tasks", "/calendar", "/inbox", "/projects"];
const REMEMBER_DEBOUNCE_MS = 300;

let rememberTimer = null;

const setSettingsError = (message) =>
  setState((state) => ({ errors: { ...state.errors, settings: message } }));

/**
 * Validates, applies the change immediately and writes it in the background;
 * a failed save restores the previous settings and records `errors.settings`.
 */
export const saveSettings = async (next) => {
  const { auth, settings: previous } = getState();
  if (!auth.user) return null;
  const session = sessionStamp();

  const validationError = getSettingsValidationError(next);
  if (validationError) {
    setSettingsError(validationError);
    return null;
  }

  const normalized = normalizeSettings(next, auth.user);
  setState({ settings: normalized });
  setSettingsError("");

  try {
    const result = await api().saveSettings(auth.user, normalized);
    if (!isCurrentSession(session)) return null;
    const saved = result?.settings || normalized;
    setState({ settings: saved });
    return { settings: saved, profileUpdated: result?.profileUpdated !== false };
  } catch (error) {
    if (!isCurrentSession(session)) return null;
    setState({ settings: previous });
    setSettingsError(error?.message || SAVE_ERROR);
    return null;
  }
};

/**
 * Remembers the last page visited so the next sign-in reopens it. Debounced,
 * silent, and only for the pages the default-view setting offers.
 */
export const rememberLastViewed = (path) => {
  const state = getState();
  if (!state.auth.user || !REMEMBERED_PATHS.includes(path)) return;
  if (state.settings.navigation.lastViewedPath === path) return;

  setState({
    settings: {
      ...state.settings,
      navigation: { ...state.settings.navigation, lastViewedPath: path },
    },
  });

  if (rememberTimer !== null) clearTimeout(rememberTimer);
  rememberTimer = setTimeout(() => {
    rememberTimer = null;
    const { auth, settings } = getState();
    if (!auth.user) return;
    try {
      void Promise.resolve(api().saveSettings(auth.user, settings)).catch(
        () => {}
      );
    } catch {
      // Remembering a page is never worth surfacing an error for.
    }
  }, REMEMBER_DEBOUNCE_MS);
};

/** Cancels a pending debounce (sign-out). */
export const cancelRememberLastViewed = () => {
  if (rememberTimer === null) return;
  clearTimeout(rememberTimer);
  rememberTimer = null;
};
