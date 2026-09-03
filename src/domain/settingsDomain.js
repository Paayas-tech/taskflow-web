import {
  emptyCalendarConnection,
  normalizeCalendarConnections,
} from "./calendarConnectionDomain";

export const SETTINGS_THEME_MODES = ["light", "dark"];

export const TASKFLOW_LANGUAGES = Object.freeze([
  Object.freeze({ code: "en", name: "English", locale: "English" }),
  Object.freeze({ code: "hi", name: "हिन्दी", locale: "Hindi" }),
  Object.freeze({ code: "es", name: "Español", locale: "Spanish" }),
  Object.freeze({ code: "fr", name: "Français", locale: "French" }),
  Object.freeze({ code: "de", name: "Deutsch", locale: "German" }),
  Object.freeze({ code: "pt", name: "Português", locale: "Portuguese" }),
  Object.freeze({ code: "ja", name: "日本語", locale: "Japanese" }),
]);
export const SETTINGS_LANGUAGE_CODES = TASKFLOW_LANGUAGES.map(({ code }) => code);

export const TASKFLOW_BACKGROUNDS = Object.freeze([
  Object.freeze({
    id: "calm",
    name: "Calm",
    category: "Minimal",
    description: "A quiet cool-white workspace.",
  }),
  Object.freeze({
    id: "lavender",
    name: "Lavender",
    category: "Abstract",
    description: "A soft lavender atmosphere.",
  }),
  Object.freeze({
    id: "morning-mist",
    name: "Morning Mist",
    category: "Soft",
    description: "A cool, airy blue-gray surface.",
  }),
  Object.freeze({
    id: "focus",
    name: "Focus",
    category: "Minimal",
    description: "A restrained neutral canvas.",
  }),
  Object.freeze({
    id: "aurora-flow",
    name: "Aurora Flow",
    category: "Live",
    description: "Slow-moving violet and aqua light.",
  }),
  Object.freeze({
    id: "ocean-drift",
    name: "Ocean Drift",
    category: "Live",
    description: "A calm animated blue horizon.",
  }),
  Object.freeze({
    id: "sunset-bloom",
    name: "Sunset Bloom",
    category: "Live",
    description: "Warm coral light that gently shifts.",
  }),
  Object.freeze({
    id: "forest-breathe",
    name: "Forest Breathe",
    category: "Live",
    description: "Soft green light with subtle movement.",
  }),
]);
export const SETTINGS_BACKGROUND_IDS = TASKFLOW_BACKGROUNDS.map(({ id }) => id);
export const SETTINGS_DEFAULT_VIEWS = [
  "dashboard",
  "tasks",
  "projects",
  "calendar",
  "last-viewed",
];
export const SETTINGS_TIME_FORMATS = ["12-hour", "24-hour"];
export const SETTINGS_DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
export const SETTINGS_WEEK_STARTS = ["sunday", "monday"];
export const SETTINGS_MY_DAY_RESETS = ["midnight", "early-morning", "custom"];

export const DEFAULT_SETTINGS = Object.freeze({
  reminder: Object.freeze({
    defaultTime: 15,
    enableBrowserNotifications: true,
    enableInAppReminders: true,
    enableSound: false,
  }),
  theme: Object.freeze({ mode: "light" }),
  background: Object.freeze({ selected: "calm" }),
  // Kept as a compatibility mirror for preferences saved by earlier builds.
  appearance: Object.freeze({ background: "calm" }),
  calendarConnections: Object.freeze({
    google: Object.freeze(emptyCalendarConnection()),
    microsoft: Object.freeze(emptyCalendarConnection()),
    icloud: Object.freeze(emptyCalendarConnection()),
  }),
  profile: Object.freeze({ displayName: "", email: "" }),
  navigation: Object.freeze({
    defaultView: "dashboard",
    lastViewedPath: "/",
  }),
  taskDefaults: Object.freeze({ listId: null }),
  time: Object.freeze({
    format: "12-hour",
    dateFormat: "DD/MM/YYYY",
    weekStartsOn: "sunday",
    timeDetection: false,
  }),
  myDay: Object.freeze({
    resetMode: "midnight",
    customResetTime: "00:00",
    externalSuggestions: false,
  }),
  language: Object.freeze({ code: "en" }),
  data: Object.freeze({}),
});

const booleanOrDefault = (value, fallback) =>
  typeof value === "boolean" ? value : fallback;

const choiceOrDefault = (value, choices, fallback) =>
  choices.includes(value) ? value : fallback;

const legacyBackgroundAliases = { default: "calm", mist: "morning-mist" };

const normalizeBackgroundId = (value) =>
  choiceOrDefault(
    legacyBackgroundAliases[value] || value,
    SETTINGS_BACKGROUND_IDS,
    DEFAULT_SETTINGS.background.selected
  );

const isTimeOnly = (value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));

const allowedViewPaths = new Set([
  "/",
  "/tasks",
  "/calendar",
  "/inbox",
  "/projects",
]);

export const normalizeDefaultReminderTime = (value) => {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440
    ? minutes
    : DEFAULT_SETTINGS.reminder.defaultTime;
};

export const normalizeSettings = (value = {}, user = {}) => {
  const reminder = value?.reminder || {};
  // "system" was the old default. Treat it as light so existing accounts do
  // not unexpectedly inherit a dark operating-system theme.
  const requestedTheme =
    value?.theme?.mode === "system" ? "light" : value?.theme?.mode;
  const displayName = String(
    value?.profile?.displayName ?? user?.displayName ?? ""
  )
    .trim()
    .slice(0, 80);
  const lastViewedPath = String(value?.navigation?.lastViewedPath || "");
  const resetMode = choiceOrDefault(
    value?.myDay?.resetMode,
    SETTINGS_MY_DAY_RESETS,
    DEFAULT_SETTINGS.myDay.resetMode
  );
  const requestedBackground =
    value?.background?.selected ?? value?.appearance?.background;
  const selectedBackground = normalizeBackgroundId(requestedBackground);

  return {
    reminder: {
      defaultTime: normalizeDefaultReminderTime(reminder.defaultTime),
      enableBrowserNotifications: booleanOrDefault(
        reminder.enableBrowserNotifications,
        DEFAULT_SETTINGS.reminder.enableBrowserNotifications
      ),
      enableInAppReminders: booleanOrDefault(
        reminder.enableInAppReminders,
        DEFAULT_SETTINGS.reminder.enableInAppReminders
      ),
      enableSound: booleanOrDefault(
        reminder.enableSound,
        DEFAULT_SETTINGS.reminder.enableSound
      ),
    },
    theme: {
      mode: choiceOrDefault(
        requestedTheme,
        SETTINGS_THEME_MODES,
        DEFAULT_SETTINGS.theme.mode
      ),
    },
    background: { selected: selectedBackground },
    appearance: { background: selectedBackground },
    calendarConnections: normalizeCalendarConnections(
      value?.calendarConnections
    ),
    profile: {
      displayName,
      email: String(user?.email || value?.profile?.email || ""),
    },
    navigation: {
      defaultView: choiceOrDefault(
        value?.navigation?.defaultView,
        SETTINGS_DEFAULT_VIEWS,
        DEFAULT_SETTINGS.navigation.defaultView
      ),
      lastViewedPath: allowedViewPaths.has(lastViewedPath)
        ? lastViewedPath
        : DEFAULT_SETTINGS.navigation.lastViewedPath,
    },
    taskDefaults: {
      listId:
        typeof value?.taskDefaults?.listId === "string" &&
        value.taskDefaults.listId.trim()
          ? value.taskDefaults.listId.trim()
          : null,
    },
    time: {
      format: choiceOrDefault(
        value?.time?.format,
        SETTINGS_TIME_FORMATS,
        DEFAULT_SETTINGS.time.format
      ),
      dateFormat: choiceOrDefault(
        value?.time?.dateFormat,
        SETTINGS_DATE_FORMATS,
        DEFAULT_SETTINGS.time.dateFormat
      ),
      weekStartsOn: choiceOrDefault(
        value?.time?.weekStartsOn,
        SETTINGS_WEEK_STARTS,
        DEFAULT_SETTINGS.time.weekStartsOn
      ),
      // Natural-language time detection does not exist yet, so stored legacy
      // truthy values are deliberately not activated.
      timeDetection: false,
    },
    myDay: {
      resetMode,
      customResetTime: isTimeOnly(value?.myDay?.customResetTime)
        ? value.myDay.customResetTime
        : resetMode === "early-morning"
          ? "06:00"
          : DEFAULT_SETTINGS.myDay.customResetTime,
      // External suggestion infrastructure does not exist yet.
      externalSuggestions: false,
    },
    language: {
      code: choiceOrDefault(
        value?.language?.code,
        SETTINGS_LANGUAGE_CODES,
        DEFAULT_SETTINGS.language.code
      ),
    },
    data:
      value?.data && typeof value.data === "object" && !Array.isArray(value.data)
        ? { ...value.data }
        : {},
  };
};

export const getSettingsValidationError = (settings = {}) => {
  const minutes = Number(settings?.reminder?.defaultTime);
  const requestedBackground =
    settings?.background?.selected ??
    settings?.appearance?.background ??
    DEFAULT_SETTINGS.background.selected;
  const validatedBackground =
    legacyBackgroundAliases[requestedBackground] || requestedBackground;
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    return "Default reminder time must be a whole number from 1 to 1440 minutes.";
  }

  if (
    !SETTINGS_THEME_MODES.includes(
      settings?.theme?.mode ?? DEFAULT_SETTINGS.theme.mode
    )
  ) {
    return "Choose light or dark theme mode.";
  }

  if (
    !SETTINGS_BACKGROUND_IDS.includes(validatedBackground)
  ) {
    return "Choose an available TaskFlow background.";
  }

  if (
    !SETTINGS_DEFAULT_VIEWS.includes(
      settings?.navigation?.defaultView ?? DEFAULT_SETTINGS.navigation.defaultView
    )
  ) {
    return "Choose an available default view.";
  }

  if (
    !SETTINGS_TIME_FORMATS.includes(
      settings?.time?.format ?? DEFAULT_SETTINGS.time.format
    )
  ) {
    return "Choose 12-hour or 24-hour time.";
  }

  if (
    !SETTINGS_DATE_FORMATS.includes(
      settings?.time?.dateFormat ?? DEFAULT_SETTINGS.time.dateFormat
    )
  ) {
    return "Choose an available date format.";
  }

  if (
    !SETTINGS_WEEK_STARTS.includes(
      settings?.time?.weekStartsOn ?? DEFAULT_SETTINGS.time.weekStartsOn
    )
  ) {
    return "Choose Sunday or Monday as the first day of the week.";
  }

  if (
    !SETTINGS_LANGUAGE_CODES.includes(
      settings?.language?.code ?? DEFAULT_SETTINGS.language.code
    )
  ) {
    return "Choose an available language.";
  }

  if (
    settings?.myDay?.resetMode === "custom" &&
    !isTimeOnly(settings?.myDay?.customResetTime)
  ) {
    return "Choose a valid custom My Day reset time.";
  }

  if (String(settings?.profile?.displayName || "").trim().length > 80) {
    return "Display name must be 80 characters or fewer.";
  }

  return "";
};

export const resolveThemeMode = (mode, systemPrefersDark = false) =>
  mode === "system" ? (systemPrefersDark ? "dark" : "light") : mode;

export const defaultViewPath = (defaultView, lastViewedPath = "/") => {
  const paths = {
    dashboard: "/",
    today: "/",
    tasks: "/tasks",
    projects: "/projects",
    calendar: "/calendar",
  };
  if (defaultView === "last-viewed") {
    return allowedViewPaths.has(lastViewedPath) ? lastViewedPath : "/";
  }
  return paths[defaultView] || "/";
};

export const weekStartIndex = (value) => (value === "monday" ? 1 : 0);

export const myDayResetTime = (myDay = {}) => {
  if (myDay.resetMode === "early-morning") return "06:00";
  if (myDay.resetMode === "custom" && isTimeOnly(myDay.customResetTime)) {
    return myDay.customResetTime;
  }
  return "00:00";
};

export const effectiveMyDayDate = (now = new Date(), myDay = {}) => {
  const current = now instanceof Date ? new Date(now) : new Date(now);
  if (Number.isNaN(current.getTime())) return new Date();
  const [resetHour, resetMinute] = myDayResetTime(myDay).split(":").map(Number);
  const beforeReset =
    current.getHours() < resetHour ||
    (current.getHours() === resetHour && current.getMinutes() < resetMinute);
  if (beforeReset) current.setDate(current.getDate() - 1);
  return current;
};

export const formatTimeForDisplay = (value, format = "12-hour") => {
  if (!isTimeOnly(value)) return String(value || "");
  const [hours, minutes] = value.split(":").map(Number);
  if (format === "24-hour") {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
};

export const formatDateOnlyForDisplay = (value, format = "DD/MM/YYYY") => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "");
  const [, year, month, day] = match;
  if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
};
