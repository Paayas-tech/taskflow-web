import { afterEach, describe, expect, it, vi } from "vitest";
import { getUser } from "./auth";
import { getAccessToken, setSession } from "./client";

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

describe("session checks", () => {
  const user = { id: "u1", email: "person@example.com", displayName: "Ada" };
  it("retains credentials on an offline connection", async () => {
    setSession("token", user);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect((await getUser()).id).toBe("u1");
    expect(getAccessToken()).toBe("token");
  });
  it("retains credentials on a temporary server failure", async () => {
    setSession("token", user);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503, ok: false,
      json: async () => ({ detail: "Unavailable" }) }));
    expect((await getUser()).id).toBe("u1");
    expect(getAccessToken()).toBe("token");
  });
  it("clears credentials on an expired or rejected token", async () => {
    setSession("token", user);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, ok: false,
      json: async () => ({ detail: "Token expired" }) }));
    expect(await getUser()).toBeNull();
    expect(getAccessToken()).toBe("");
  });
});
