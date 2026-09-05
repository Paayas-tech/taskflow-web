import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("./client", () => ({
  requireSupabase: () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  }),
  throwIfError: (error) => {
    if (error) throw error;
  },
}));

const { exchangeDesktopAuthCode } = await import("./auth");

beforeEach(() => vi.clearAllMocks());

describe("exchangeDesktopAuthCode", () => {
  it("exchanges an approved PKCE code and normalizes its user", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "person@example.com", user_metadata: {} },
      },
      error: null,
    });

    const result = await exchangeDesktopAuthCode("abcdefghijklmnopqrstuvwxyz0123456789");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abcdefghijklmnopqrstuvwxyz0123456789");
    expect(result.user.id).toBe("user-1");
  });

  it("rejects malformed codes before calling Supabase", async () => {
    await expect(exchangeDesktopAuthCode("short")).rejects.toThrow(
      "Invalid desktop authentication callback."
    );
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
