import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(() => ({ auth: {} })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete globalThis.__taskflowSupabaseClient;
  delete window.taskflowDesktop;
});

afterEach(() => {
  delete globalThis.__taskflowSupabaseClient;
  delete window.taskflowDesktop;
});

describe("Supabase desktop auth options", () => {
  it("preserves automatic URL detection in the browser", async () => {
    await import("./client");
    expect(mocks.createClient.mock.calls[0][2].auth).toEqual({
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    });
  });

  it("uses explicit PKCE callback handling only on desktop", async () => {
    window.taskflowDesktop = { isDesktop: true };
    await import("./client");
    expect(mocks.createClient.mock.calls[0][2].auth).toEqual({
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    });
  });
});
