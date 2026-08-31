import { describe, expect, it } from "vitest";
import { collectGooglePages, isUsableOAuthState, normalizeGoogleEvent } from "../../supabase/functions/_shared/googleCalendarCore";
import { normalizeGoogleCalendarEvents } from "./googleCalendarDomain";

describe("Google Calendar domain", () => {
  it("rejects missing and expired OAuth state and accepts an active state", () => {
    expect(isUsableOAuthState(null, 1000)).toBe(false);
    expect(isUsableOAuthState({ expires_at: new Date(999).toISOString() }, 1000)).toBe(false);
    expect(isUsableOAuthState({ expires_at: new Date(1001).toISOString() }, 1000)).toBe(true);
  });

  it("collects paginated Google results", async () => {
    const requested = [];
    const result = await collectGooglePages("https://example.test/events", async (url) => {
      requested.push(url);
      return requested.length === 1 ? { items: [{ id: "1" }], nextPageToken: "next" } : { items: [{ id: "2" }] };
    });
    expect(result.map(({ id }) => id)).toEqual(["1", "2"]);
    expect(requested[1]).toContain("pageToken=next");
  });

  it("normalizes and deduplicates read-only Google events", () => {
    const event = normalizeGoogleEvent({ id: "event-1", summary: "Planning", start: { date: "2026-09-01" }, end: { date: "2026-09-02" } }, { id: "primary", summary: "Work" });
    const normalized = normalizeGoogleCalendarEvents([event, event]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({ id: "google:primary:event-1", title: "Planning", calendarName: "Work", isAllDay: true, source: "google" });
  });
});
