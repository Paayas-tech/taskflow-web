import { describe, expect, it, vi } from "vitest";
import { createGoogleCalendarIntegrationService } from "./googleCalendarIntegrationService";

const query = (result) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue(result),
});

describe("Google Calendar integration service", () => {
  it("returns only connection metadata", async () => {
    const connection = { id: "connection-1", provider: "google", calendar_account_email: "user@example.com" };
    const builder = query({ data: connection, error: null });
    const client = { from: vi.fn(() => builder), functions: { invoke: vi.fn() } };
    await expect(createGoogleCalendarIntegrationService(client).getConnection()).resolves.toEqual(connection);
    expect(builder.select.mock.calls[0][0]).not.toMatch(/token/i);
  });

  it("starts OAuth, syncs, and disconnects through server functions", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ data: { authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth" }, error: null })
      .mockResolvedValueOnce({ data: { events: [], calendars: [] }, error: null })
      .mockResolvedValueOnce({ data: { success: true }, error: null });
    const service = createGoogleCalendarIntegrationService({ functions: { invoke } });
    await expect(service.startOAuth()).resolves.toMatch(/^https:\/\/accounts\.google\.com/);
    await expect(service.sync()).resolves.toEqual({ events: [], calendars: [] });
    await expect(service.disconnect()).resolves.toEqual({ success: true });
    expect(invoke.mock.calls.map(([name]) => name)).toEqual([
      "google-calendar-oauth-start",
      "google-calendar-sync",
      "google-calendar-disconnect",
    ]);
  });

  it("rejects an authorization URL that is not the Google consent host", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { authorizationUrl: "https://attacker.example/oauth" },
      error: null,
    });
    const service = createGoogleCalendarIntegrationService({ functions: { invoke } });
    await expect(service.startOAuth()).rejects.toThrow("invalid authorization address");
  });

  it("surfaces safe function error messages", async () => {
    const error = {
      context: { json: vi.fn().mockResolvedValue({ message: "Reconnect Google Calendar." }) },
    };
    const service = createGoogleCalendarIntegrationService({
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error }) },
    });
    await expect(service.sync()).rejects.toThrow("Reconnect Google Calendar.");
  });

  it("reports an undeployed Edge Function as missing configuration", async () => {
    const error = { name: "FunctionsRelayError", context: { status: 404, json: vi.fn().mockRejectedValue(new Error("not json")) } };
    const service = createGoogleCalendarIntegrationService({ functions: { invoke: vi.fn().mockResolvedValue({ data: null, error }) } });
    await expect(service.startOAuth()).rejects.toThrow("not configured for this TaskFlow environment");
  });
});
