import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  defaultViewPath,
  effectiveMyDayDate,
  formatDateOnlyForDisplay,
  formatTimeForDisplay,
  getSettingsValidationError,
  normalizeSettings,
  resolveThemeMode,
} from "./settingsDomain";

describe("settings defaults and normalization", () => {
  it("returns safe defaults and authenticated profile data", () => {
    expect(
      normalizeSettings({}, { displayName: "Paayas", email: "user@example.com" })
    ).toEqual({
      reminder: { ...DEFAULT_SETTINGS.reminder },
      theme: { mode: "light" },
      background: { ...DEFAULT_SETTINGS.background },
      appearance: { ...DEFAULT_SETTINGS.appearance },
      calendarConnections: {
        google: { ...DEFAULT_SETTINGS.calendarConnections.google },
        microsoft: { ...DEFAULT_SETTINGS.calendarConnections.microsoft },
        icloud: { ...DEFAULT_SETTINGS.calendarConnections.icloud },
      },
      profile: { displayName: "Paayas", email: "user@example.com" },
      navigation: { ...DEFAULT_SETTINGS.navigation },
      taskDefaults: { ...DEFAULT_SETTINGS.taskDefaults },
      time: { ...DEFAULT_SETTINGS.time },
      myDay: { ...DEFAULT_SETTINGS.myDay },
      language: { ...DEFAULT_SETTINGS.language },
      data: {},
    });
  });

  it("normalizes hierarchical setting choices and legacy values", () => {
    expect(
      normalizeSettings({
        appearance: { background: "lavender" },
        navigation: { defaultView: "tasks", lastViewedPath: "/calendar" },
        taskDefaults: { listId: "work" },
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
      appearance: { background: "lavender" },
      background: { selected: "lavender" },
      navigation: { defaultView: "tasks", lastViewedPath: "/calendar" },
      taskDefaults: { listId: "work" },
      time: {
        format: "24-hour",
        dateFormat: "YYYY-MM-DD",
        weekStartsOn: "monday",
        timeDetection: false,
      },
      myDay: {
        resetMode: "custom",
        customResetTime: "05:30",
        externalSuggestions: false,
      },
      language: { code: "en" },
    });
  });

  it("migrates legacy backgrounds and strips calendar credentials", () => {
    expect(
      normalizeSettings({
        appearance: { background: "mist" },
        calendarConnections: {
          google: {
            connected: true,
            accountLabel: "user@example.com",
            accessToken: "must-not-persist",
          },
        },
      })
    ).toMatchObject({
      background: { selected: "morning-mist" },
      appearance: { background: "morning-mist" },
      calendarConnections: {
        google: {
          connected: true,
          accountLabel: "user@example.com",
          status: "connected",
        },
      },
    });
    expect(
      normalizeSettings({
        calendarConnections: {
          google: { connected: true, accessToken: "must-not-persist" },
        },
      }).calendarConnections.google
    ).not.toHaveProperty("accessToken");
  });

  it("normalizes invalid values without trusting stored email", () => {
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

  it("resolves startup views and supported time, date, and My Day formats", () => {
    expect(defaultViewPath("today")).toBe("/");
    expect(defaultViewPath("last-viewed", "/calendar")).toBe("/calendar");
    expect(formatTimeForDisplay("18:05", "12-hour")).toBe("6:05 PM");
    expect(formatTimeForDisplay("06:05", "24-hour")).toBe("06:05");
    expect(formatDateOnlyForDisplay("2026-08-15", "DD/MM/YYYY")).toBe(
      "15/08/2026"
    );
    expect(
      effectiveMyDayDate(new Date(2026, 7, 15, 5, 30), {
        resetMode: "early-morning",
      }).getDate()
    ).toBe(14);
  });
});
describe("settings validation and theme resolution", () => {
  it("validates reminder offsets and theme modes", () => {
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
  });

  it("resolves system theme without changing the stored preference", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
    expect(resolveThemeMode("light", true)).toBe("light");
  });
});
