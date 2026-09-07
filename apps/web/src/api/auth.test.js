import { describe, expect, it } from "vitest";
import { normalizeAuthUser } from "./auth";

describe("normalizeAuthUser", () => {
  it("maps a Supabase auth user to the app's user shape", () => {
    expect(
      normalizeAuthUser({
        id: "user-1",
        email: "person@example.com",
        user_metadata: { display_name: "Ada", onboarding_completed: true },
      })
    ).toEqual({
      id: "user-1",
      uid: "user-1",
      email: "person@example.com",
      displayName: "Ada",
      onboardingRequired: false,
    });
  });

  it("returns null when there is no user", () => {
    expect(normalizeAuthUser(null)).toBeNull();
    expect(normalizeAuthUser(undefined)).toBeNull();
  });

  it("requires onboarding only when the flag is explicitly false", () => {
    expect(normalizeAuthUser({ id: "u", user_metadata: { onboarding_completed: false } })
      .onboardingRequired).toBe(true);
    expect(normalizeAuthUser({ id: "u", user_metadata: {} }).onboardingRequired)
      .toBe(false);
    expect(normalizeAuthUser({ id: "u" }).onboardingRequired).toBe(false);
  });

  it("falls back to uid and an empty email and display name", () => {
    expect(normalizeAuthUser({ uid: "user-2" })).toEqual({
      id: "user-2",
      uid: "user-2",
      email: "",
      displayName: "",
      onboardingRequired: false,
    });
  });
});
