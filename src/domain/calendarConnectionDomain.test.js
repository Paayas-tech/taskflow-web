import { describe, expect, it } from "vitest";
import {
  CALENDAR_PROVIDERS,
  calendarProviderSetup,
  normalizeCalendarConnections,
} from "./calendarConnectionDomain";

describe("calendar connection domain", () => {
  it("returns disconnected provider defaults without credentials", () => {
    expect(normalizeCalendarConnections()).toEqual({
      google: {
        connected: false,
        accountLabel: "",
        status: "disconnected",
        connectedAt: null,
      },
      microsoft: {
        connected: false,
        accountLabel: "",
        status: "disconnected",
        connectedAt: null,
      },
      icloud: {
        connected: false,
        accountLabel: "",
        status: "disconnected",
        connectedAt: null,
      },
    });
  });

  it("reports missing provider configuration without enabling OAuth", () => {
    const google = CALENDAR_PROVIDERS.find(({ id }) => id === "google");
    expect(calendarProviderSetup(google, {})).toEqual({
      configured: false,
      missingVariables: [
        "VITE_GOOGLE_CALENDAR_CLIENT_ID",
        "VITE_GOOGLE_CALENDAR_REDIRECT_URI",
        "VITE_CALENDAR_OAUTH_BACKEND_URL",
      ],
      canConnect: false,
    });
  });

  it("does not claim a working flow from public configuration alone", () => {
    const microsoft = CALENDAR_PROVIDERS.find(
      ({ id }) => id === "microsoft"
    );
    expect(
      calendarProviderSetup(microsoft, {
        VITE_MICROSOFT_CALENDAR_CLIENT_ID: "configured",
        VITE_MICROSOFT_CALENDAR_REDIRECT_URI: "configured",
        VITE_CALENDAR_OAUTH_BACKEND_URL: "configured",
      })
    ).toEqual({ configured: true, missingVariables: [], canConnect: false });
  });
});
