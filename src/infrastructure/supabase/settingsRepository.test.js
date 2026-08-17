import { describe, expect, it, vi } from "vitest";
import { createSettingsRepository } from "./settingsRepository";

describe("Supabase settings repository", () => {
  it("reads only the current user's settings row", async () => {
    const query = {
      select: vi.fn(function select() {
        return this;
      }),
      eq: vi.fn(function eq() {
        return this;
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = { from: vi.fn(() => query) };

    await createSettingsRepository(client).getSettings("user-a");

    expect(client.from).toHaveBeenCalledWith("user_settings");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("upserts one settings row by user_id", async () => {
    const query = {
      upsert: vi.fn(function upsert() {
        return this;
      }),
      select: vi.fn(function select() {
        return this;
      }),
      single: vi.fn().mockResolvedValue({
        data: { user_id: "user-a", theme: "dark" },
        error: null,
      }),
    };
    const client = { from: vi.fn(() => query) };

    await createSettingsRepository(client).saveSettings("user-a", {
      theme: "dark",
    });

    expect(query.upsert).toHaveBeenCalledWith(
      { theme: "dark", user_id: "user-a" },
      { onConflict: "user_id" }
    );
  });
});
