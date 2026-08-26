import { describe, expect, it, vi } from "vitest";
import {
  createSettingsService,
  settingsStorageKey,
} from "./settingsService";

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

describe("Supabase settings application service", () => {
  const user = {
    uid: "user-a",
    email: "user@example.com",
    displayName: "Original",
  };

  it("migrates legacy browser settings into the database once", async () => {
    const storage = memoryStorage();
    storage.setItem(
      settingsStorageKey(user.uid),
      JSON.stringify({ theme: { mode: "dark" } })
    );
    const repository = {
      getSettings: vi.fn().mockResolvedValue(null),
      saveSettings: vi.fn().mockResolvedValue({}),
    };
    const service = createSettingsService(repository, {
      updateDisplayNameFn: vi.fn(),
    });

    const settings = await service.getSettings(user, storage);

    expect(settings.theme.mode).toBe("dark");
    expect(repository.saveSettings).toHaveBeenCalledWith(
      user.uid,
      expect.objectContaining({ theme: "dark", settings_data: settings })
    );
    expect(storage.getItem(settingsStorageKey(user.uid))).toBeNull();
  });

  it("persists the complete normalized settings snapshot", async () => {
    const repository = {
      saveSettings: vi.fn().mockResolvedValue({}),
    };
    const updateDisplayNameFn = vi.fn().mockResolvedValue(undefined);
    const service = createSettingsService(repository, { updateDisplayNameFn });

    const result = await service.saveSettings(user, {
      reminder: { defaultTime: 20 },
      theme: { mode: "light" },
      profile: { displayName: "Updated", email: user.email },
    });

    expect(repository.saveSettings).toHaveBeenCalledWith(
      user.uid,
      expect.objectContaining({
        theme: "light",
        reminder_default_time: 20,
        settings_data: result.settings,
      })
    );
    expect(updateDisplayNameFn).toHaveBeenCalledWith("Updated");
    expect(result.profileUpdated).toBe(true);
  });
});
