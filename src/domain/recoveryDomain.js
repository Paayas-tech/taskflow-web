export const validateRecoveryPassword = (password, confirmation) => {
  if (!password) return "Enter a new password.";
  if (password !== confirmation) return "Passwords do not match.";
  return "";
};
