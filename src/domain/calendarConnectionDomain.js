export const CALENDAR_PROVIDERS = Object.freeze([
  Object.freeze({
    id: "google",
    name: "Google Calendar",
    accountLabel: "Google account",
    requirements: Object.freeze([
      "VITE_GOOGLE_CALENDAR_CLIENT_ID",
      "VITE_GOOGLE_CALENDAR_REDIRECT_URI",
      "VITE_CALENDAR_OAUTH_BACKEND_URL",
    ]),
    setup:
      "Create a Google OAuth web client, allow the TaskFlow redirect URI, request the minimum Calendar scopes, and exchange/refresh tokens through a secure backend.",
  }),
  Object.freeze({
    id: "microsoft",
    name: "Microsoft Outlook",
    accountLabel: "Microsoft account",
    requirements: Object.freeze([
      "VITE_MICROSOFT_CALENDAR_CLIENT_ID",
      "VITE_MICROSOFT_CALENDAR_REDIRECT_URI",
      "VITE_CALENDAR_OAUTH_BACKEND_URL",
    ]),
    setup:
      "Register TaskFlow in Microsoft Entra, configure the redirect URI and delegated Calendar permissions, and complete token exchange/refresh through a secure backend.",
  }),
  Object.freeze({
    id: "icloud",
    name: "iCloud",
    accountLabel: "Apple account",
    requirements: Object.freeze(["VITE_CALENDAR_CALDAV_BACKEND_URL"]),
    setup:
      "iCloud Calendar requires a reviewed server-side CalDAV connector. TaskFlow must never collect or store an Apple app-specific password in this browser UI.",
  }),
]);

export const emptyCalendarConnection = () => ({
  connected: false,
  accountLabel: "",
  status: "disconnected",
  connectedAt: null,
});

export const normalizeCalendarConnection = (value = {}) => {
  const connected = value?.connected === true;
  return {
    connected,
    accountLabel: connected ? String(value?.accountLabel || "").slice(0, 160) : "",
    status: connected ? "connected" : "disconnected",
    connectedAt: connected ? value?.connectedAt ?? null : null,
  };
};

export const normalizeCalendarConnections = (value = {}) =>
  Object.fromEntries(
    CALENDAR_PROVIDERS.map(({ id }) => [
      id,
      normalizeCalendarConnection(value?.[id]),
    ])
  );

export const calendarProviderSetup = (provider, environment = {}) => {
  const missingVariables = provider.requirements.filter(
    (variableName) => !String(environment?.[variableName] || "").trim()
  );

  return {
    configured: missingVariables.length === 0,
    missingVariables,
    // This repository intentionally has no authorization callback/token
    // exchange implementation. Environment values alone must never be
    // treated as a working calendar connection.
    canConnect: false,
  };
};
