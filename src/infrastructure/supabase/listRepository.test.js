import { describe, expect, it, vi } from "vitest";
import { createListRepository } from "./listRepository";

describe("Supabase list repository", () => {
  it("scopes list reads to the authenticated user", async () => {
    const calls = [];
    const query = {
      select(...args) {
        calls.push(["select", ...args]);
        return this;
      },
      eq(...args) {
        calls.push(["eq", ...args]);
        return this;
      },
      order(...args) {
        calls.push(["order", ...args]);
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    const client = { from: vi.fn(() => query) };

    await createListRepository(client).getLists("user-a");

    expect(client.from).toHaveBeenCalledWith("lists");
    expect(calls).toContainEqual(["eq", "user_id", "user-a"]);
  });
});
