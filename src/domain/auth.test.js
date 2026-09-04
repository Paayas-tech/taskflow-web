import { describe, expect, it } from "vitest";
import {
  friendlyAuthError,
  getSignUpOutcome,
  isEmailConfirmationError,
  isInvalidCredentialsError,
  validateRecoveryPassword,
  validateSignUpName,
} from "./auth";

describe("signup", () => {
  it.each([
    ["   ", "Enter your name."],
    ["A".repeat(81), "Name must be 80 characters or fewer."],
    ["  Ada Lovelace  ", ""],
  ])("validates the name %s", (name, expected) => {
    expect(validateSignUpName(name)).toBe(expected);
  });

  it("rejects a resolved signup response without a user", () => {
    expect(() => getSignUpOutcome({ user: null, session: null })).toThrow(
      "Unexpected signup response."
    );
  });

  it.each([
    [null, "confirmation_required"],
    [{ access_token: "test" }, "signed_in"],
  ])("resolves the outcome for session %s", (session, expected) => {
    expect(getSignUpOutcome({ user: { id: "user-1" }, session })).toBe(expected);
  });
});

describe("password recovery", () => {
  it.each([
    ["", "", "Enter a new password."],
    ["new-password", "different-password", "Passwords do not match."],
    ["new-password", "new-password", ""],
  ])("validates %s / %s", (password, confirmation, expected) => {
    expect(validateRecoveryPassword(password, confirmation)).toBe(expected);
  });
});

describe("authentication error messages", () => {
  it("maps invalid credentials without exposing provider details", () => {
    const error = { code: "invalid_credentials", message: "Invalid login credentials" };

    expect(isInvalidCredentialsError(error)).toBe(true);
    expect(friendlyAuthError(error, true)).toBe(
      "The email or password you entered is incorrect."
    );
  });

  it("explains when email confirmation is required", () => {
    const error = { code: "email_not_confirmed", message: "Email not confirmed" };

    expect(isEmailConfirmationError(error)).toBe(true);
    expect(friendlyAuthError(error, true)).toContain("Confirm your email");
  });

  it.each([
    [{ code: "user_already_exists" }, /account already exists/i],
    [{ code: "email_address_invalid" }, /valid email address/i],
    [{ code: "weak_password" }, /stronger password/i],
    [{ code: "over_request_rate_limit" }, /too many attempts/i],
    [{ message: "Failed to fetch" }, /couldn't connect/i],
  ])("maps %o to a safe message", (error, pattern) => {
    expect(friendlyAuthError(error, false)).toMatch(pattern);
  });

  it("does not mislabel unexpected errors as invalid credentials", () => {
    const message = friendlyAuthError(
      { code: "unexpected_failure", message: "Database error saving new user" },
      false
    );

    expect(message).toBe("We couldn't create your account. Please try again.");
    expect(message).not.toMatch(/database|secret|token/i);
  });

  it("uses the sign-in wording only for a sign-in attempt", () => {
    expect(friendlyAuthError({}, true)).toBe(
      "We couldn't sign you in. Please try again."
    );
  });
});
