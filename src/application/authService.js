import { authRepository } from "../infrastructure/supabase/authRepository";

export const normalizeAuthUser = (user) => {
  if (!user) return null;
  const id = user.id || user.uid;

  return {
    id,
    uid: id,
    email: user.email || "",
    displayName: user.user_metadata?.display_name || user.displayName || "",
    raw: user,
  };
};

const repository = authRepository;

export const signUp = async (
  email,
  password,
  displayName = "",
  options = {}
) => {
  const data = await repository.signUp({
    email,
    password,
    displayName,
    emailRedirectTo: options.emailRedirectTo || "",
  });
  return { ...data, user: normalizeAuthUser(data.user) };
};

export const resendConfirmation = (email, options = {}) =>
  repository.resendConfirmation({
    email,
    emailRedirectTo: options.emailRedirectTo || "",
  });

export const signIn = async (email, password) => {
  const data = await repository.signIn({ email, password });
  return { ...data, user: normalizeAuthUser(data.user) };
};

export const requestPasswordReset = (email, redirectTo) =>
  repository.requestPasswordReset({ email, redirectTo });

export const updatePassword = (password) =>
  repository.updatePassword(password);

export const signOut = () => repository.signOut();

export const getUser = async () => normalizeAuthUser(await repository.getUser());

export const onAuthStateChange = (callback) =>
  repository.onAuthStateChange((event, user) =>
    callback(event, normalizeAuthUser(user))
  );

export const updateDisplayName = async (displayName) =>
  normalizeAuthUser(await repository.updateDisplayName(displayName));
