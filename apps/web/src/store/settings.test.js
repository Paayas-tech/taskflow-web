import { describe, expect, it } from "vitest";
import { createFakeApi, makeUser } from "../test/fakeApi";
import { saveSettings } from "./settings";
import { startSession } from "./session";
import { configureStore, getState } from "./store";

const user = makeUser({ id: "user-1", email: "sam@example.com" });

const boot = async (seed = {}) => {
  const api = createFakeApi({ user, ...seed });
  configureStore({ api });
  await startSession(user);
  return api;
};

const withTheme = (mode) => ({ ...getState().settings, theme: { mode } });

describe("saveSettings", () => {
  it("applies the change immediately and keeps what the server returned", async () => {
    const api = await boot();

    const saving = saveSettings(withTheme("dark"));
    expect(getState().settings.theme.mode).toBe("dark");

    const result = await saving;
    expect(result.settings.theme.mode).toBe("dark");
    expect(result.profileUpdated).toBe(true);
    expect(api.data.settings.theme.mode).toBe("dark");
    expect(getState().errors.settings).toBe("");
  });

  it("refuses settings the database would reject, without calling the api", async () => {
    const api = await boot();

    const invalid = {
      ...getState().settings,
      reminder: { ...getState().settings.reminder, defaultTime: 0 },
    };
    expect(await saveSettings(invalid)).toBeNull();

    expect(getState().errors.settings).toBe(
      "Default reminder time must be a whole number from 1 to 1440 minutes."
    );
    expect(api.callCount("saveSettings")).toBe(0);
    expect(getState().settings.reminder.defaultTime).toBe(15);
  });

  it("restores the previous settings when the save fails", async () => {
    const api = await boot();
    api.failNext("saveSettings", new Error("offline"));

    expect(await saveSettings(withTheme("dark"))).toBeNull();

    expect(getState().settings.theme.mode).toBe("light");
    expect(getState().errors.settings).toBe("offline");
  });
});
