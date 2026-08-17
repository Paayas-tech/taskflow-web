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
        data: { display_name: String(displayName || "").trim() },
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

  async signIn({ email, password }) {
    const { data, error } = await database().auth.signInWithPassword({
      email,
      password,
    });
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
  });
};

export const authRepository = createAuthRepository();
