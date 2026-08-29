import { describe, expect, it, vi } from "vitest";
import { createAuthRepository } from "./authRepository";

const createClient = (signUpResult) => ({
  auth: {
    signUp: vi.fn().mockResolvedValue(signUpResult),
  },
});

describe("Supabase auth repository signup contract", () => {
  it("persists the supplied name in confirmation-safe signup metadata", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "user-a" }, session: null },
      error: null,
    });
    const repository = createAuthRepository({ auth: { signUp } });

    await repository.signUp({
      email: "user@example.test",
      password: "password",
      displayName: "  Ada Lovelace  ",
      emailRedirectTo: "https://taskflow.example",
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "user@example.test",
      password: "password",
      options: {
        data: {
          display_name: "Ada Lovelace",
          onboarding_completed: false,
        },
        emailRedirectTo: "https://taskflow.example",
      },
    });
  });

  it("marks onboarding complete in auth metadata", async () => {
    const updateUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-a",
          user_metadata: { onboarding_completed: true },
        },
      },
      error: null,
    });
    const repository = createAuthRepository({ auth: { updateUser } });

    await repository.completeOnboarding();

    expect(updateUser).toHaveBeenCalledWith({
      data: { onboarding_completed: true },
    });
  });

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

describe("Supabase signup OTP contract", () => {
  it("verifies the emailed code as a signup OTP", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { id: "user-a" }, session: { access_token: "session" } },
      error: null,
    });
    const repository = createAuthRepository({ auth: { verifyOtp } });

    await repository.verifySignupOtp({
      email: "user@example.test",
      token: "123456",
    });

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "user@example.test",
      token: "123456",
      type: "email",
    });
  });
});

describe("Supabase account deletion contract", () => {
  it("deletes through the authenticated server function and clears the local session", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const repository = createAuthRepository({
      functions: { invoke },
      auth: { signOut },
    });

    await expect(repository.deleteAccount()).resolves.toBe(true);

    expect(invoke).toHaveBeenCalledWith("delete-account", { body: {} });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the local session when server-side deletion fails", async () => {
    const providerError = new Error("Function failed");
    const signOut = vi.fn();
    const repository = createAuthRepository({
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: providerError }),
      },
      auth: { signOut },
    });

    await expect(repository.deleteAccount()).rejects.toBe(providerError);
    expect(signOut).not.toHaveBeenCalled();
  });
});
