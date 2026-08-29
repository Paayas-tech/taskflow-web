const hasMessage = (error, pattern) =>
  pattern.test(String(error?.message || ""));

export const isEmailConfirmationError = (error) =>
  error?.code === "email_not_confirmed" ||
  hasMessage(error, /email (?:address )?not confirmed/i);

export const isInvalidCredentialsError = (error) =>
  ["invalid_credentials", "user_not_found"].includes(error?.code) ||
  hasMessage(error, /invalid login credentials/i);

export const isExistingAccountError = (error) =>
  ["user_already_exists", "email_exists"].includes(error?.code) ||
  hasMessage(error, /already (?:been )?registered|already exists/i);

export const getSignUpOutcome = (result) => {
  if (!result?.user?.id) {
    const error = new Error("Unexpected signup response.");
    error.code = "unexpected_signup_response";
    throw error;
  }

  return result.session ? "signed_in" : "confirmation_required";
};

export const isCurrentAuthRequest = (activeUserId, requestUserId) =>
  Boolean(requestUserId) && activeUserId === requestUserId;

export const shouldWaitForOnboardingSettings = (
  user,
  settingsLoading,
  settingsLoadedUserId
) =>
  Boolean(
    user?.onboardingRequired &&
      (settingsLoading || settingsLoadedUserId !== user.uid)
  );

export const validateSignUpName = (name) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return "Enter your name.";
  if (normalizedName.length > 80) return "Name must be 80 characters or fewer.";
  return "";
};

export const friendlyAuthError = (error, isLogin) => {
  if (isEmailConfirmationError(error)) {
    return "Confirm your email address before signing in. You can resend the confirmation email below.";
  }

  if (isInvalidCredentialsError(error)) {
    return "The email or password you entered is incorrect.";
  }

  if (
    isExistingAccountError(error)
  ) {
    return "An account already exists for this email address.";
  }

  if (["email_address_invalid", "validation_failed"].includes(error?.code)) {
    return "Enter a valid email address and try again.";
  }

  if (
    ["weak_password", "over_email_send_rate_limit", "over_request_rate_limit"].includes(
      error?.code
    )
  ) {
    return error?.code === "weak_password"
      ? "Choose a stronger password with at least six characters."
      : "Too many attempts. Please wait a moment and try again.";
  }

  if (hasMessage(error, /fetch|network|connection/i)) {
    return "We couldn't connect. Check your internet connection and try again.";
  }

  return isLogin
    ? "We couldn't sign you in. Please try again."
    : "We couldn't create your account. Please try again.";
};
