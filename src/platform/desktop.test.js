import { afterEach, describe, expect, it, vi } from "vitest";
import { isDesktopApp, listenForDesktopAuthCallback, openExternalAuthorization, recoveryRedirectUrl } from "./desktop";

afterEach(() => {
  delete window.taskflowDesktop;
  vi.restoreAllMocks();
});

describe("desktop platform boundary", () => {
  it("preserves the browser recovery redirect", () => {
    expect(isDesktopApp()).toBe(false);
    expect(recoveryRedirectUrl("https://taskflow.example/")).toBe("https://taskflow.example/recover");
  });

  it("uses the registered desktop recovery callback", () => {
    window.taskflowDesktop = { isDesktop: true };
    expect(recoveryRedirectUrl("https://ignored.example")).toBe("taskflow://auth/callback?next=recover");
  });

  it("opens authorization through the desktop bridge", async () => {
    const openExternal = vi.fn(async () => true);
    window.taskflowDesktop = { isDesktop: true, openExternal };
    await openExternalAuthorization("https://accounts.google.com/oauth");
    expect(openExternal).toHaveBeenCalledOnce();
  });

  it("subscribes only through the desktop bridge", () => {
    const unsubscribe = vi.fn();
    const onAuthCallback = vi.fn(() => unsubscribe);
    const callback = vi.fn();
    window.taskflowDesktop = { isDesktop: true, onAuthCallback };
    expect(listenForDesktopAuthCallback(callback)).toBe(unsubscribe);
  });
});
