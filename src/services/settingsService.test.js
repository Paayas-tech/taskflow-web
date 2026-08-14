import { describe, expect, it, vi } from "vitest";
import { getSettings, saveSettings, settingsStorageKey } from "./settingsService";

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

describe("settings service", () => {
  const user = {
    uid: "user-a",
    email: "user@example.com",
    displayName: "Original",
  };

  it("keeps settings isolated by authenticated user ID", async () => {
    const storage = memoryStorage();
    storage.setItem(
      settingsStorageKey("user-a"),
      JSON.stringify({ reminder: { defaultTime: 30 } })
    );

    expect((await getSettings(user, storage)).reminder.defaultTime).toBe(30);
    expect(
      (await getSettings({ ...user, uid: "user-b" }, storage)).reminder.defaultTime
    ).toBe(15);
  });

  it("validates, updates the auth profile, and saves normalized settings", async () => {
    const storage = memoryStorage();
    const updateProfileFn = vi.fn().mockResolvedValue(undefined);
    const result = await saveSettings(
      user,
      {
        reminder: {
          defaultTime: 10,
          enableBrowserNotifications: false,
          enableInAppReminders: true,
          enableSound: true,
        },
        theme: { mode: "dark" },
        profile: { displayName: "Updated", email: "ignored@example.com" },
        data: {},
      },
      { storage, updateProfileFn }
    );

    expect(updateProfileFn).toHaveBeenCalledWith(user, {
      displayName: "Updated",
    });
    expect(result.profileUpdated).toBe(true);
    expect(result.settings.profile.email).toBe(user.email);
    expect(JSON.parse(storage.getItem(settingsStorageKey(user.uid)))).toEqual(
      result.settings
    );
  });

  it("keeps local preferences when the auth profile is offline", async () => {
    const storage = memoryStorage();
    const result = await saveSettings(
      user,
      {
        reminder: {
          defaultTime: 30,
          enableBrowserNotifications: true,
          enableInAppReminders: true,
          enableSound: false,
        },
        theme: { mode: "system" },
        profile: { displayName: "Offline name", email: user.email },
        data: {},
      },
      {
        storage,
        updateProfileFn: vi.fn().mockRejectedValue(new Error("offline")),
      }
    );

    expect(result.profileUpdated).toBe(false);
    expect(JSON.parse(storage.getItem(settingsStorageKey(user.uid)))).toEqual(
      result.settings
    );
  });
});
