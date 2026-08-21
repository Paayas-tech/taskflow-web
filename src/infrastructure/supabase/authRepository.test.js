import { describe, expect, it, vi } from "vitest";
import { createAuthRepository } from "./authRepository";

const createClient = (signUpResult) => ({
  auth: {
    signUp: vi.fn().mockResolvedValue(signUpResult),
  },
});

describe("Supabase auth repository signup contract", () => {
  it("propagates a Supabase signup error instead of returning success", async () => {
    const providerError = Object.assign(new Error("Provider rejected signup"), {
      code: "provider_error",
    });
    const repository = createAuthRepository(
      createClient({ data: null, error: providerError })
    );

    await expect(
      repository.signUp({ email: "user@example.test", password: "password" })
    ).rejects.toBe(providerError);
  });

  it("rejects an error-free Supabase response that has no user", async () => {
    const repository = createAuthRepository(
      createClient({ data: { user: null, session: null }, error: null })
    );

    await expect(
      repository.signUp({ email: "user@example.test", password: "password" })
    ).rejects.toMatchObject({ code: "unexpected_signup_response" });
  });
});

describe("Supabase password recovery contract", () => {
  it("requests a reset with the supplied recovery redirect", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    });
    const repository = createAuthRepository({
      auth: { resetPasswordForEmail },
    });

    await repository.requestPasswordReset({
      email: "user@example.test",
      redirectTo: "https://taskflow.example/recover",
    });

    expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.test", {
      redirectTo: "https://taskflow.example/recover",
    });
  });

  it("updates the signed-in recovery user's password", async () => {
    const updateUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    const repository = createAuthRepository({ auth: { updateUser } });

    await repository.updatePassword("new-password");

    expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
  });
});
