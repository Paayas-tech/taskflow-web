import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../domain/settings";
import { settingsToRow } from "./settings";

const user = { uid: "user-1", email: "person@example.com", displayName: "Ada" };

describe("settingsToRow", () => {
  it("writes the typed columns the database requires plus the canonical json", () => {
    const settings = normalizeSettings(
      {
        theme: { mode: "dark" },
        navigation: { defaultView: "calendar" },
        reminder: {
          defaultTime: 30,
          enableBrowserNotifications: false,
          enableInAppReminders: true,
          enableSound: true,
        },
        time: {
          format: "24-hour",
          dateFormat: "YYYY-MM-DD",
          weekStartsOn: "monday",
        },
        language: { code: "fr" },
      },
      user
    );

    expect(settingsToRow(settings)).toMatchObject({
      theme: "dark",
      default_view: "calendar",
      reminder_default_time: 30,
      enable_browser_notifications: false,
      enable_in_app_reminders: true,
      enable_sound: true,
      time_format: "24_hour",
      date_format: "YYYY-MM-DD",
      week_starts_on: "monday",
      locale: "fr",
      settings_data: settings,
    });
  });

  it("writes the underscore spelling the time_format check constraint expects", () => {
    const row = settingsToRow(normalizeSettings({}, user));
    expect(row.time_format).toBe("12_hour");
    expect(row.timezone).toBeTruthy();
  });

  it("no longer writes the removed background and list columns", () => {
    const row = settingsToRow(normalizeSettings({ background: "calm" }, user));
    expect(row).not.toHaveProperty("background");
    expect(row).not.toHaveProperty("default_list_id");
  });
});
