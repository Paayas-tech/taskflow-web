import { describe, expect, it } from "vitest";
import { validateSupabaseBrowserConfiguration } from "./client";

describe("Supabase browser configuration validation", () => {
  it("rejects a missing URL", () => {
    expect(
      validateSupabaseBrowserConfiguration({ url: "", anonKey: "key" })
    ).toMatchObject({ valid: false, issues: ["missing_url"] });
  });

  it("rejects a missing key", () => {
    expect(
      validateSupabaseBrowserConfiguration({
        url: "https://example.supabase.co",
        anonKey: "",
      })
    ).toMatchObject({ valid: false, issues: ["missing_key"] });
  });

  it.each(["not-a-url", "http://example.supabase.co"])(
    "rejects an invalid or non-HTTPS URL: %s",
    (url) => {
      expect(
        validateSupabaseBrowserConfiguration({ url, anonKey: "key" })
      ).toMatchObject({ valid: false, issues: ["invalid_url"] });
    }
  );

  it("accepts an HTTPS URL and a publishable key without requiring a legacy prefix", () => {
    expect(
      validateSupabaseBrowserConfiguration({
        url: "https://example.supabase.co",
        anonKey: "sb_publishable_example",
      })
    ).toEqual({ valid: true, issues: [] });
  });

  it("accepts HTTP only for the local Supabase loopback endpoint", () => {
    expect(
      validateSupabaseBrowserConfiguration({
        url: "http://127.0.0.1:54321",
        anonKey: "sb_publishable_local",
      })
    ).toEqual({ valid: true, issues: [] });
  });
});
