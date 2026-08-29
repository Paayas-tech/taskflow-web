import { describe, expect, it } from "vitest";
import { normalizeAuthUser } from "./authService";

describe("Supabase auth application service", () => {
  it("keeps a signed-out session empty", () => {
    expect(normalizeAuthUser(null)).toBeNull();
  });

  it("maps Supabase identity and profile metadata to the application user", () => {
    const source = {
      id: "user-a",
      email: "user@example.com",
      user_metadata: { display_name: "TaskFlow User" },
    };

    expect(normalizeAuthUser(source)).toEqual({
      id: "user-a",
      uid: "user-a",
      email: "user@example.com",
      displayName: "TaskFlow User",
      onboardingRequired: false,
      raw: source,
    });
  });

  it("provides safe defaults for optional profile fields", () => {
    expect(normalizeAuthUser({ id: "user-b" })).toEqual({
      id: "user-b",
      uid: "user-b",
      email: "",
      displayName: "",
      onboardingRequired: false,
      raw: { id: "user-b" },
    });
  });

  it("only requires onboarding when signup metadata explicitly leaves it incomplete", () => {
    expect(
      normalizeAuthUser({
        id: "new-user",
        user_metadata: { onboarding_completed: false },
      }).onboardingRequired
    ).toBe(true);

    expect(
      normalizeAuthUser({ id: "existing-user", user_metadata: {} })
        .onboardingRequired
    ).toBe(false);
  });
});
