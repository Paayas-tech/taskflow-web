import { requireSupabase, throwIfError } from "./client";

/** Supabase auth user → the app's user shape. */
export const normalizeAuthUser = (user) => {
  if (!user) return null;
  const id = user.id || user.uid;

  return {
    id,
    uid: id,
    email: user.email || "",
    displayName: user.user_metadata?.display_name || user.displayName || "",
    onboardingRequired: user.user_metadata?.onboarding_completed === false,
  };
};

/** Awaits one auth call, raising its error and handing back its payload. */
const authCall = async (request) => {
  const { data, error } = await request;
  throwIfError(error);
  return data;
};

/** An auth payload carrying the app's user shape instead of the raw one. */
const withUser = (data) => ({ ...data, user: normalizeAuthUser(data.user) });

export const signUp = async (email, password, displayName = "", options = {}) => {
  const emailRedirectTo = options.emailRedirectTo || "";
  const data = await authCall(
    requireSupabase().auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: String(displayName || "").trim(),
          onboarding_completed: false,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    })
  );

  if (!data?.user?.id) {
    const unexpectedError = new Error("Unexpected signup response.");
    unexpectedError.code = "unexpected_signup_response";
    throw unexpectedError;
  }

  if (Array.isArray(data.user.identities) && !data.user.identities.length) {
    const duplicateError = new Error(
      "An account already exists for this email address."
    );
    duplicateError.code = "user_already_exists";
    throw duplicateError;
  }

  // public.handle_new_auth_user creates public.users atomically and copies
  // display_name from the signup metadata, including confirmation-required
  // projects where the browser does not receive a session yet.
  return withUser(data);
};

export const resendConfirmation = async (email, options = {}) => {
  const emailRedirectTo = options.emailRedirectTo || "";
  return authCall(
    requireSupabase().auth.resend({
      type: "signup",
      email,
      options: emailRedirectTo ? { emailRedirectTo } : {},
    })
  );
};

export const verifySignupOtp = async (email, token) =>
  withUser(
    await authCall(
      requireSupabase().auth.verifyOtp({ email, token, type: "email" })
    )
  );

export const signIn = async (email, password) =>
  withUser(
    await authCall(requireSupabase().auth.signInWithPassword({ email, password }))
  );

export const requestPasswordReset = async (email, redirectTo) =>
  authCall(requireSupabase().auth.resetPasswordForEmail(email, { redirectTo }));

export const updatePassword = async (password) =>
  authCall(requireSupabase().auth.updateUser({ password }));

export const signOut = async () => {
  await authCall(requireSupabase().auth.signOut());
};

export const getUser = async () => {
  const data = await authCall(requireSupabase().auth.getUser());
  return normalizeAuthUser(data.user || null);
};

export const onAuthStateChange = (callback) => {
  const { data } = requireSupabase().auth.onAuthStateChange((event, session) => {
    callback(event, normalizeAuthUser(session?.user || null));
  });
  return () => data.subscription.unsubscribe();
};

export const updateDisplayName = async (displayName) => {
  const database = requireSupabase();
  const normalizedName = String(displayName || "").trim();
  const data = await authCall(
    database.auth.updateUser({ data: { display_name: normalizedName || null } })
  );

  if (data.user) {
    const profile = await database
      .from("users")
      .update({ display_name: normalizedName || null })
      .eq("id", data.user.id);
    throwIfError(profile.error);
  }

  return normalizeAuthUser(data.user || null);
};

export const completeOnboarding = async () => {
  const data = await authCall(
    requireSupabase().auth.updateUser({ data: { onboarding_completed: true } })
  );
  return normalizeAuthUser(data.user || null);
};

export const deleteAccount = async () => {
  const database = requireSupabase();
  const data = await authCall(
    database.functions.invoke("delete-account", { body: {} })
  );
  if (!data?.success) throw new Error("Account deletion was not completed.");

  await authCall(database.auth.signOut({ scope: "local" }));
  return true;
};
