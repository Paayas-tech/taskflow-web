import { describe, expect, it, vi } from "vitest";
import {
  createSignOutController,
  SAFE_SIGN_OUT_ERROR,
} from "./signOutController";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe("shared sign-out controller", () => {
  it("reports successful sign-out and clears pending state", async () => {
    const states = [];
    const controller = createSignOutController({
      performSignOut: vi.fn().mockResolvedValue(undefined),
      onStateChange: (state) => states.push(state),
    });

    await expect(controller.run()).resolves.toEqual({ ok: true });
    expect(states).toEqual([
      { pending: true, error: "" },
      { pending: false, error: "" },
    ]);
  });

  it("keeps retry available and exposes only safe feedback on failure", async () => {
    const controller = createSignOutController({
      performSignOut: vi.fn().mockRejectedValue(new Error("provider internals")),
    });

    await expect(controller.run()).resolves.toEqual({
      ok: false,
      error: SAFE_SIGN_OUT_ERROR,
    });
    expect(controller.getState()).toEqual({
      pending: false,
      error: SAFE_SIGN_OUT_ERROR,
    });
    expect(controller.getState().error).not.toContain("provider internals");
  });

  it("guards duplicate clicks while sign-out is pending", async () => {
    const request = deferred();
    const performSignOut = vi.fn(() => request.promise);
    const controller = createSignOutController({ performSignOut });

    const firstAttempt = controller.run();
    await expect(controller.run()).resolves.toEqual({
      ok: false,
      duplicate: true,
    });
    expect(performSignOut).toHaveBeenCalledTimes(1);

    request.resolve();
    await expect(firstAttempt).resolves.toEqual({ ok: true });
  });

  it("clears a previous failure when a retry succeeds", async () => {
    const performSignOut = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const controller = createSignOutController({ performSignOut });

    await controller.run();
    expect(controller.getState().error).toBe(SAFE_SIGN_OUT_ERROR);

    await expect(controller.run()).resolves.toEqual({ ok: true });
    expect(controller.getState()).toEqual({ pending: false, error: "" });
  });
});
