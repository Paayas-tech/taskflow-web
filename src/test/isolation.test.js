/**
 * The store arms module-level timers that can outlive the test that started
 * them — the debounced `saveSettings` behind `navigate` is the one with teeth,
 * because it resolves `api()` when it fires, not when it is scheduled. These
 * two tests run in order on purpose: the first arms the debounce, the second
 * proves it never reaches its fake api.
 */
import { describe, expect, it } from "vitest";
import { seedStore } from "./renderApp";
import { getState } from "../store/store";
import { navigate } from "../store/ui";

/** Longer than the 300 ms debounce in `store/settings.js`. */
const AFTER_DEBOUNCE_MS = 400;

const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("store isolation between tests", () => {
  it("arms the remembered-path debounce", async () => {
    await seedStore();
    navigate("/tasks");

    expect(getState().settings.navigation.lastViewedPath).toBe("/tasks");
  });

  it("starts with a fake api the previous test cannot write to", async () => {
    const { api } = await seedStore();
    await settle(AFTER_DEBOUNCE_MS);

    expect(api.callCount("saveSettings")).toBe(0);
    expect(getState().settings.navigation.lastViewedPath).toBe("/");
  });
});
