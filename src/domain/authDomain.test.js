import { describe, expect, it } from "vitest";
import {
  friendlyAuthError,
  getSignUpOutcome,
  isCurrentAuthRequest,
  isEmailConfirmationError,
  isInvalidCredentialsError,
} from "./authDomain";

describe("signup outcomes", () => {
  it("rejects a resolved signup response without a user", () => {
    expect(() => getSignUpOutcome({ user: null, session: null })).toThrow(
      "Unexpected signup response."
    );
  });

  it("requires confirmation only when signup returned a valid user without a session", () => {
    expect(
      getSignUpOutcome({ user: { id: "user-1" }, session: null })
    ).toBe("confirmation_required");
  });

  it("continues signed-in behavior when signup returned a user and session", () => {
    expect(
      getSignUpOutcome({ user: { id: "user-1" }, session: { access_token: "test" } })
    ).toBe("signed_in");
  });
});

describe("authenticated request ownership", () => {
  it("accepts results only for the active authenticated user", () => {
    expect(isCurrentAuthRequest("user-a", "user-a")).toBe(true);
    expect(isCurrentAuthRequest("user-b", "user-a")).toBe(false);
    expect(isCurrentAuthRequest(null, "user-a")).toBe(false);
  });
});

describe("authentication error messages", () => {
  it("maps invalid credentials without exposing provider details", () => {
    const error = {
      code: "invalid_credentials",
      message: "Invalid login credentials",
    };

    expect(isInvalidCredentialsError(error)).toBe(true);
    expect(friendlyAuthError(error, true)).toBe(
      "The email or password you entered is incorrect."
    );
  });

  it("explains when email confirmation is required", () => {
    const error = {
      code: "email_not_confirmed",
      message: "Email not confirmed",
    };

    expect(isEmailConfirmationError(error)).toBe(true);
    expect(friendlyAuthError(error, true)).toContain("Confirm your email");
  });

  it("does not mislabel unexpected errors as invalid credentials", () => {
    const message = friendlyAuthError(
      { code: "unexpected_failure", message: "Database error saving new user" },
      false
    );

    expect(message).toBe("We couldn't create your account. Please try again.");
    expect(message).not.toMatch(/database|secret|token/i);
  });
});
