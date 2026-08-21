import { describe, expect, it } from "vitest";
import { validateRecoveryPassword } from "./recoveryDomain";

describe("password recovery validation", () => {
  it("requires a password", () => {
    expect(validateRecoveryPassword("", "")).toBe("Enter a new password.");
  });

  it("requires matching passwords", () => {
    expect(validateRecoveryPassword("new-password", "different-password")).toBe(
      "Passwords do not match."
    );
  });

  it("accepts a non-empty matching password", () => {
    expect(validateRecoveryPassword("new-password", "new-password")).toBe("");
  });
});
