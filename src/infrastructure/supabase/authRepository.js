import { requireSupabase } from "./client";

const throwIfError = (error) => {
  if (error) throw error;
};

export const createAuthRepository = (client = null) => {
  const database = () => client || requireSupabase();

  return ({
  async signUp({ email, password, displayName = "", emailRedirectTo = "" }) {
    const { data, error } = await database().auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: String(displayName || "").trim(),
          onboarding_completed: false,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });
    throwIfError(error);

    if (!data?.user?.id) {
      const unexpectedError = new Error("Unexpected signup response.");
      unexpectedError.code = "unexpected_signup_response";
      throw unexpectedError;
    }

    if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) {
      const duplicateError = new Error(
        "An account already exists for this email address."
      );
      duplicateError.code = "user_already_exists";
      throw duplicateError;
    }

    // public.handle_new_auth_user creates public.users atomically and copies
    // display_name from the signup metadata, including confirmation-required
    // projects where the browser does not receive a session yet.

    return data;
  },

  async resendConfirmation({ email, emailRedirectTo = "" }) {
    const { data, error } = await database().auth.resend({
      type: "signup",
      email,
      options: emailRedirectTo ? { emailRedirectTo } : {},
    });
    throwIfError(error);
    return data;
  },

  async verifySignupOtp({ email, token }) {
    const { data, error } = await database().auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    throwIfError(error);
    return data;
  },

  async signIn({ email, password }) {
    const { data, error } = await database().auth.signInWithPassword({
      email,
      password,
    });
    throwIfError(error);
    return data;
  },

  async requestPasswordReset({ email, redirectTo }) {
    const { data, error } = await database().auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    throwIfError(error);
    return data;
  },

  async updatePassword(password) {
    const { data, error } = await database().auth.updateUser({ password });
    throwIfError(error);
    return data;
  },

  async signOut() {
    const { error } = await database().auth.signOut();
    throwIfError(error);
  },

  async getUser() {
    const { data, error } = await database().auth.getUser();
    throwIfError(error);
    return data.user || null;
  },

  onAuthStateChange(callback) {
    const { data } = database().auth.onAuthStateChange((event, session) => {
      callback(event, session?.user || null);
    });
    return () => data.subscription.unsubscribe();
  },

  async updateDisplayName(displayName) {
    const normalizedName = String(displayName || "").trim();
    const { data, error } = await database().auth.updateUser({
      data: { display_name: normalizedName || null },
    });
    throwIfError(error);

    if (data.user) {
      const profile = await database()
        .from("users")
        .update({ display_name: normalizedName || null })
        .eq("id", data.user.id);
      throwIfError(profile.error);
    }

    return data.user || null;
  },

  async completeOnboarding() {
    const { data, error } = await database().auth.updateUser({
      data: { onboarding_completed: true },
    });
    throwIfError(error);
    return data.user || null;
  },

  async deleteAccount() {
    const { data, error } = await database().functions.invoke("delete-account", {
      body: {},
    });
    throwIfError(error);
    if (!data?.success) {
      throw new Error("Account deletion was not completed.");
    }

    const signOutResult = await database().auth.signOut({ scope: "local" });
    throwIfError(signOutResult.error);
    return true;
  },
  });
};

export const authRepository = createAuthRepository();
