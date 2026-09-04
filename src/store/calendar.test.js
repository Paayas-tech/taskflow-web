import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeApi, makeUser } from "../test/fakeApi";
import { GOOGLE_EVENTS_STALE_MS, loadGoogleEvents, setGoogleEvents } from "./calendar";
import { startSession } from "./session";
import { configureStore, getState } from "./store";

const user = makeUser({ id: "user-1", email: "sam@example.com" });

const boot = async (seed = {}) => {
  const api = createFakeApi({ user, ...seed });
  configureStore({ api });
  await startSession(user);
  return api;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadGoogleEvents", () => {
  it("does not sync when no calendar is connected", async () => {
    const api = await boot();

    expect(await loadGoogleEvents()).toEqual([]);
    expect(api.callCount("syncGoogleCalendar")).toBe(0);
    expect(getState().loaded.googleEvents).toBe("ready");
  });

  it("syncs once and serves the fresh events from the store", async () => {
    const api = await boot({
      googleConnection: { provider: "google", syncStatus: "ok" },
      googleEvents: [{ id: "event-1", title: "Standup" }],
    });

    expect(await loadGoogleEvents()).toHaveLength(1);
    expect(getState().googleEvents[0].title).toBe("Standup");

    await loadGoogleEvents();
    expect(api.callCount("syncGoogleCalendar")).toBe(1);
  });

  it("re-syncs when the calendar is reopened after the events go stale", async () => {
    const api = await boot({
      googleConnection: { provider: "google", syncStatus: "ok" },
      googleEvents: [{ id: "event-1", title: "Standup" }],
    });

    await loadGoogleEvents();
    expect(api.callCount("syncGoogleCalendar")).toBe(1);

    // Google is the only source of these events, so a later visit re-syncs.
    const later = Date.now() + GOOGLE_EVENTS_STALE_MS + 1;
    vi.spyOn(Date, "now").mockReturnValue(later);
    api.data.googleEvents.push({ id: "event-2", title: "Retro" });

    expect(await loadGoogleEvents()).toHaveLength(2);
    expect(api.callCount("syncGoogleCalendar")).toBe(2);
  });

  it("keeps the events on screen when a re-sync fails", async () => {
    const api = await boot({
      googleConnection: { provider: "google" },
      googleEvents: [{ id: "event-1", title: "Standup" }],
    });

    await loadGoogleEvents();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + GOOGLE_EVENTS_STALE_MS + 1);
    api.failNext("syncGoogleCalendar", new Error("offline"));

    expect(await loadGoogleEvents()).toBeNull();
    expect(getState().googleEvents).toHaveLength(1);
    expect(getState().loaded.googleEvents).toBe("ready");
  });

  it("records a failed sync without clearing what is on screen", async () => {
    const api = await boot({ googleConnection: { provider: "google" } });
    api.failNext("syncGoogleCalendar", new Error("offline"));

    expect(await loadGoogleEvents()).toBeNull();
    expect(getState().loaded.googleEvents).toBe("error");
    expect(getState().googleEvents).toEqual([]);
  });

  it("takes the events the settings panel just synced", async () => {
    await boot();

    setGoogleEvents([{ id: "event-2" }]);

    expect(getState().googleEvents).toHaveLength(1);
    expect(getState().loaded.googleEvents).toBe("ready");
  });
});
