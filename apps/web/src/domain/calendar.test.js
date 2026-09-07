import { describe, expect, it } from "vitest";
import {
  collectGooglePages,
  isUsableOAuthState,
  normalizeGoogleEvent,
} from "../../../../supabase/functions/_shared/googleCalendarCore";
import {
  assignMultiDayLanes,
  buildCalendarMonthGrid,
  buildCalendarTimeAxis,
  buildCalendarWeek,
  calendarMinutesToPixels,
  calendarMonthStart,
  calendarProviderSetup,
  CALENDAR_PROVIDERS,
  createCalendarTaskInitialValues,
  groupCalendarAgenda,
  layoutCalendarDayEvents,
  normalizeCalendarConnections,
  normalizeGoogleCalendarEvents,
  segmentMultiDayItems,
  shiftCalendarMonth,
} from "./calendar";
import { dateOnlyKey } from "./task";

describe("month and week grids", () => {
  it("builds a stable six-week grid with correct weekday alignment", () => {
    const august = buildCalendarMonthGrid(new Date(2026, 7, 1));

    expect(august).toHaveLength(42);
    expect(august[0]).toEqual({
      key: "2026-07-26",
      day: 26,
      inCurrentMonth: false,
    });
    expect(august[6]).toEqual({ key: "2026-08-01", day: 1, inCurrentMonth: true });
    expect(august.at(-1).key).toBe("2026-09-05");
    expect(buildCalendarMonthGrid(new Date(2026, 7, 1), 1)[0].key).toBe(
      "2026-07-27"
    );
  });

  it("handles leap years and month shifts across year boundaries", () => {
    expect(
      buildCalendarMonthGrid(new Date(2024, 1, 1)).some(
        ({ key }) => key === "2024-02-29"
      )
    ).toBe(true);
    expect(dateOnlyKey(shiftCalendarMonth(new Date(2026, 11, 1), 1))).toBe(
      "2027-01-01"
    );
    expect(dateOnlyKey(shiftCalendarMonth(new Date(2026, 0, 1), -1))).toBe(
      "2025-12-01"
    );
    expect(dateOnlyKey(calendarMonthStart(new Date(2026, 7, 13)))).toBe(
      "2026-08-01"
    );
  });

  it("builds a seven-day week from a date-only key with a configurable start", () => {
    expect(buildCalendarWeek("2026-08-14").map(({ key }) => key)).toEqual([
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ]);
    expect(buildCalendarWeek("2026-08-14", 1)[0].key).toBe("2026-08-10");
    expect(buildCalendarWeek("not-a-date")).toEqual([]);
  });

  it("builds time-axis slots and converts minutes to pixels", () => {
    expect(buildCalendarTimeAxis({ startHour: 6, endHour: 8 })).toEqual([
      { minutes: 360, time: "06:00", label: "06:00" },
      { minutes: 420, time: "07:00", label: "07:00" },
    ]);
    expect(buildCalendarTimeAxis({ startHour: 8, endHour: 6 })).toEqual([]);
    expect(calendarMinutesToPixels(90, 1.25)).toBe(112.5);
    expect(calendarMinutesToPixels(-1)).toBeNull();
  });
});

describe("agenda grouping", () => {
  it("groups items by date, then by time, dropping undated work", () => {
    const groups = groupCalendarAgenda([
      {
        id: "late",
        title: "Late",
        dueDate: "2026-08-14",
        startTime: "14:00",
        endTime: "15:00",
      },
      {
        id: "early",
        title: "Early",
        dueDate: "2026-08-14",
        startTime: "09:00",
        endTime: "10:00",
      },
      { id: "next", title: "Next", dueDate: "2026-08-15" },
      { id: "undated", title: "Undated" },
    ]);

    expect(groups.map(({ date }) => date)).toEqual(["2026-08-14", "2026-08-15"]);
    expect(groups[0].items.map(({ id }) => id)).toEqual(["early", "late"]);
  });

  it("expands multi-day items across agenda dates when requested", () => {
    const groups = groupCalendarAgenda(
      [
        {
          id: "range",
          title: "Conference",
          dueDate: "2026-08-14",
          endDate: "2026-08-16",
        },
        {
          id: "timed",
          title: "Call",
          dueDate: "2026-08-15",
          startTime: "09:00",
          endTime: "09:30",
        },
      ],
      { expandMultiDay: true }
    );

    expect(groups.map(({ date }) => date)).toEqual([
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
    expect(groups[1].items.map(({ id }) => id)).toEqual(["range", "timed"]);
  });
});

describe("day layout", () => {
  const events = [
    {
      id: "range",
      dueDate: "2026-08-14",
      endDate: "2026-08-16",
      startTime: "16:00",
      endTime: "11:00",
    },
    { id: "overlap", dueDate: "2026-08-15", startTime: "09:00", endTime: "10:00" },
    { id: "all-day", dueDate: "2026-08-15" },
  ];

  it("clips a multi-day event to the first, middle and last day", () => {
    expect(layoutCalendarDayEvents(events, "2026-08-14")[0]).toMatchObject({
      id: "range",
      startMinutes: 960,
      endMinutes: 1440,
      continuesAfter: true,
    });
    expect(layoutCalendarDayEvents(events, "2026-08-16")[0]).toMatchObject({
      id: "range",
      startMinutes: 0,
      endMinutes: 660,
      continuesBefore: true,
    });
  });

  it("assigns overlap columns and skips all-day items", () => {
    const middle = layoutCalendarDayEvents(events, "2026-08-15");

    expect(middle.map(({ id }) => id).sort()).toEqual(["overlap", "range"]);
    expect(middle.find(({ id }) => id === "overlap")).toMatchObject({
      startMinutes: 540,
      endMinutes: 600,
      columnCount: 2,
    });
    expect(layoutCalendarDayEvents(events, "not-a-date")).toEqual([]);
  });
});

describe("multi-day segments", () => {
  it("splits at week boundaries and stacks overlapping bars into lanes", () => {
    const segments = segmentMultiDayItems(
      [
        { id: "long", dueDate: "2026-08-14", endDate: "2026-08-18" },
        { id: "overlap", dueDate: "2026-08-15", endDate: "2026-08-16" },
      ],
      "2026-08-09",
      "2026-08-22"
    );

    expect(segments.filter(({ id }) => id === "long")).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      rowKey: "2026-08-09",
      startColumn: 5,
      endColumn: 6,
      continuesAfter: true,
    });
    expect(
      assignMultiDayLanes(segments).filter(
        ({ rowKey }) => rowKey === "2026-08-09"
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "long", laneCount: 2 }),
        expect.objectContaining({ id: "overlap", laneCount: 2 }),
      ])
    );
  });

  it("clips to the visible range and keeps lane assignment deterministic", () => {
    const segments = assignMultiDayLanes(
      segmentMultiDayItems(
        [
          { id: "earlier", dueDate: "2026-07-30", endDate: "2026-08-03" },
          { id: "longer", dueDate: "2026-08-01", endDate: "2026-08-05" },
          { id: "short", dueDate: "2026-08-02", endDate: "2026-08-03" },
        ],
        "2026-07-26",
        "2026-09-05"
      )
    );

    expect(
      segments.find(({ id, rowKey }) => id === "earlier" && rowKey === "2026-08-02")
    ).toMatchObject({ startColumn: 0, endColumn: 1, continuesBefore: true });
    expect(
      segments
        .filter(({ rowKey }) => rowKey === "2026-08-02")
        .map(({ id, lane }) => [id, lane])
    ).toEqual([
      ["longer", 0],
      ["earlier", 1],
      ["short", 2],
    ]);
  });
});

describe("creating from a grid cell", () => {
  it("builds all-day and timed defaults, rolling past midnight", () => {
    expect(createCalendarTaskInitialValues({ date: "2026-08-14" })).toEqual({
      dueDate: "2026-08-14",
      endDate: "",
      startTime: "",
      endTime: "",
    });
    expect(
      createCalendarTaskInitialValues({ date: "2026-08-14", startTime: "23:30" })
    ).toEqual({
      dueDate: "2026-08-14",
      endDate: "2026-08-15",
      startTime: "23:30",
      endTime: "00:30",
    });
  });

  it("rejects an invalid date or start time", () => {
    expect(() => createCalendarTaskInitialValues({ date: "2026-02-29" })).toThrow(
      /valid calendar date/i
    );
    expect(() =>
      createCalendarTaskInitialValues({ date: "2026-08-14", startTime: "24:00" })
    ).toThrow(/valid start time/i);
  });
});

describe("Google Calendar mirror", () => {
  it("rejects missing and expired OAuth state and accepts an active state", () => {
    expect(isUsableOAuthState(null, 1000)).toBe(false);
    expect(
      isUsableOAuthState({ expires_at: new Date(999).toISOString() }, 1000)
    ).toBe(false);
    expect(
      isUsableOAuthState({ expires_at: new Date(1001).toISOString() }, 1000)
    ).toBe(true);
  });

  it("collects paginated Google results", async () => {
    const requested = [];
    const result = await collectGooglePages(
      "https://example.test/events",
      async (url) => {
        requested.push(url);
        return requested.length === 1
          ? { items: [{ id: "1" }], nextPageToken: "next" }
          : { items: [{ id: "2" }] };
      }
    );

    expect(result.map(({ id }) => id)).toEqual(["1", "2"]);
    expect(requested[1]).toContain("pageToken=next");
  });

  it("normalizes and deduplicates read-only Google events", () => {
    const event = normalizeGoogleEvent(
      {
        id: "event-1",
        summary: "Planning",
        start: { date: "2026-09-01" },
        end: { date: "2026-09-02" },
      },
      { id: "primary", summary: "Work" }
    );
    const normalized = normalizeGoogleCalendarEvents([event, event]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: "google:primary:event-1",
      title: "Planning",
      calendarName: "Work",
      isAllDay: true,
      source: "google",
    });
  });
});

describe("provider connections", () => {
  it("returns disconnected, credential-free defaults for every provider", () => {
    const disconnected = {
      connected: false,
      accountLabel: "",
      status: "disconnected",
      connectedAt: null,
    };

    expect(normalizeCalendarConnections()).toEqual({
      google: disconnected,
      microsoft: disconnected,
      icloud: disconnected,
    });
  });

  it("keeps a connected label but never persists credentials", () => {
    const google = normalizeCalendarConnections({
      google: {
        connected: true,
        accountLabel: "user@example.com",
        accessToken: "must-not-persist",
      },
    }).google;

    expect(google).toEqual({
      connected: true,
      accountLabel: "user@example.com",
      status: "connected",
      connectedAt: null,
    });
    expect(google).not.toHaveProperty("accessToken");
  });

  it("reports missing configuration without ever enabling OAuth", () => {
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

    const microsoft = CALENDAR_PROVIDERS.find(({ id }) => id === "microsoft");
    expect(
      calendarProviderSetup(microsoft, {
        VITE_MICROSOFT_CALENDAR_CLIENT_ID: "configured",
        VITE_MICROSOFT_CALENDAR_REDIRECT_URI: "configured",
        VITE_CALENDAR_OAUTH_BACKEND_URL: "configured",
      })
    ).toEqual({ configured: true, missingVariables: [], canConnect: false });
  });
});
