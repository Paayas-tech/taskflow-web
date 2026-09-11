import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  defaultViewPath,
  formatDateOnlyForDisplay,
  formatTimeForDisplay,
  getSettingsValidationError,
  myDayResetTime,
  normalizeSettings,
  resolveThemeMode,
  weekStartIndex,
} from "./settings";

describe("settings normalization", () => {
  it("returns safe defaults and the authenticated profile", () => {
    expect(
      normalizeSettings({}, { displayName: "Paayas", email: "user@example.com" })
    ).toEqual({
      reminder: { ...DEFAULT_SETTINGS.reminder },
      theme: { mode: "light" },
      calendarConnections: {
        google: { ...DEFAULT_SETTINGS.calendarConnections.google },
        microsoft: { ...DEFAULT_SETTINGS.calendarConnections.microsoft },
        icloud: { ...DEFAULT_SETTINGS.calendarConnections.icloud },
      },
      profile: { displayName: "Paayas", email: "user@example.com" },
      navigation: { ...DEFAULT_SETTINGS.navigation },
      time: { ...DEFAULT_SETTINGS.time },
      myDay: { ...DEFAULT_SETTINGS.myDay },
      language: { ...DEFAULT_SETTINGS.language },
      data: {},
    });
  });

  it("keeps supported hierarchical choices", () => {
    expect(
      normalizeSettings({
        navigation: { defaultView: "tasks", lastViewedPath: "/calendar" },
        time: {
          format: "24-hour",
          dateFormat: "YYYY-MM-DD",
          weekStartsOn: "monday",
          timeDetection: true,
        },
        myDay: {
          resetMode: "custom",
          customResetTime: "05:30",
          externalSuggestions: true,
        },
        language: { code: "fr" },
      })
    ).toMatchObject({
      navigation: { defaultView: "tasks", lastViewedPath: "/calendar" },
      // Natural-language detection and external suggestions do not exist yet.
      time: { format: "24-hour", dateFormat: "YYYY-MM-DD", timeDetection: false },
      myDay: { customResetTime: "05:30", externalSuggestions: false },
      language: { code: "fr" },
    });
  });

  it("ignores settings that earlier builds stored for removed features", () => {
    const normalized = normalizeSettings({
      background: { selected: "lavender" },
      appearance: { background: "mist" },
      taskDefaults: { priority: "high" },
    });

    expect(normalized).not.toHaveProperty("background");
    expect(normalized).not.toHaveProperty("appearance");
    expect(normalized).not.toHaveProperty("taskDefaults");
    expect(getSettingsValidationError(normalized)).toBe("");
  });

  it("strips calendar credentials from stored connections", () => {
    expect(
      normalizeSettings({
        calendarConnections: {
          google: {
            connected: true,
            accountLabel: "user@example.com",
            accessToken: "must-not-persist",
          },
        },
      }).calendarConnections.google
    ).toEqual({
      connected: true,
      accountLabel: "user@example.com",
      status: "connected",
      connectedAt: null,
    });
  });

  it("repairs invalid values and never trusts a stored email", () => {
    expect(
      normalizeSettings(
        {
          reminder: { defaultTime: -5, enableSound: "yes" },
          theme: { mode: "purple" },
          profile: { displayName: "  Local name  ", email: "stored@example.com" },
        },
        { email: "auth@example.com" }
      )
    ).toMatchObject({
      reminder: { defaultTime: 15, enableSound: false },
      theme: { mode: "light" },
      profile: { displayName: "Local name", email: "auth@example.com" },
    });
  });

  it("migrates the legacy automatic theme to light", () => {
    expect(normalizeSettings({ theme: { mode: "system" } }).theme).toEqual({
      mode: "light",
    });
  });

  it.each(["/", "/tasks", "/calendar", "/inbox", "/projects"])(
    "keeps %s as a startup view",
    (path) => {
      expect(defaultViewPath("last-viewed", path)).toBe(path);
      expect(
        normalizeSettings({ navigation: { lastViewedPath: path } }).navigation
          .lastViewedPath
      ).toBe(path);
    }
  );

  it.each(["/for-you", "/recent", "/starred", "/planning/timeline", "/today"])(
    "sends the removed view %s back to home",
    (path) => {
      expect(defaultViewPath("last-viewed", path)).toBe("/");
      expect(
        normalizeSettings({ navigation: { lastViewedPath: path } }).navigation
          .lastViewedPath
      ).toBe("/");
    }
  );
});

describe("settings validation", () => {
  it("accepts normalized settings and reports the first problem otherwise", () => {
    const settings = normalizeSettings();

    expect(getSettingsValidationError(settings)).toBe("");
    expect(
      getSettingsValidationError({
        ...settings,
        reminder: { ...settings.reminder, defaultTime: 0 },
      })
    ).toMatch(/1 to 1440/i);
    expect(
      getSettingsValidationError({ ...settings, theme: { mode: "sepia" } })
    ).toMatch(/light or dark/i);
    expect(
      getSettingsValidationError({
        ...settings,
        myDay: { resetMode: "custom", customResetTime: "25:00" },
      })
    ).toMatch(/custom My Day/i);
    expect(
      getSettingsValidationError({
        ...settings,
        profile: { displayName: "A".repeat(81) },
      })
    ).toMatch(/80 characters/i);
  });
});

describe("preference formatters", () => {
  it("resolves a stored theme without changing the preference", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
    expect(resolveThemeMode("light", true)).toBe("light");
  });

  it("maps default views to paths and week starts to an index", () => {
    expect(defaultViewPath("today")).toBe("/");
    expect(defaultViewPath("projects")).toBe("/projects");
    expect(weekStartIndex("monday")).toBe(1);
    expect(weekStartIndex("sunday")).toBe(0);
  });

  it("formats times and dates for the chosen preference", () => {
    expect(formatTimeForDisplay("18:05", "12-hour")).toBe("6:05 PM");
    expect(formatTimeForDisplay("06:05", "24-hour")).toBe("06:05");
    expect(formatDateOnlyForDisplay("2026-08-15", "DD/MM/YYYY")).toBe("15/08/2026");
    expect(formatDateOnlyForDisplay("2026-08-15", "MM/DD/YYYY")).toBe("08/15/2026");
    expect(formatDateOnlyForDisplay("not-a-date")).toBe("not-a-date");
  });

  it("resolves the My Day reset time from its mode", () => {
    expect(myDayResetTime({ resetMode: "early-morning" })).toBe("06:00");
    expect(myDayResetTime({ resetMode: "custom", customResetTime: "05:30" })).toBe(
      "05:30"
    );
    expect(myDayResetTime({})).toBe("00:00");
  });
});
