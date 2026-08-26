import { describe, expect, it } from "vitest";
import {
  assignMultiDayLanes,
  buildCalendarTimeAxis,
  buildCalendarWeek,
  calendarMinutesToPixels,
  clipDateRange,
  createCalendarTaskInitialValues,
  deriveIsAllDay,
  getScheduleValidationError,
  groupCalendarAgenda,
  isValidTimeOnly,
  layoutTimedEvents,
  layoutCalendarDayEvents,
  normalizeTaskSchedule,
  segmentMultiDayItems,
  shiftCalendarDate,
} from "./calendarDomain";

describe("calendar schedule normalization", () => {
  it("normalizes legacy tasks as single-day all-day items", () => {
    expect(normalizeTaskSchedule({ dueDate: "2026-08-14" })).toEqual({
      dueDate: "2026-08-14",
      endDate: "",
      startTime: "",
      endTime: "",
      isAllDay: true,
    });
    expect(deriveIsAllDay({ startTime: "09:00", endTime: "10:00" })).toBe(
      false
    );
  });

  it("validates single-day and multi-day time ranges", () => {
    expect(isValidTimeOnly("09:30")).toBe(true);
    expect(isValidTimeOnly("24:00")).toBe(false);
    expect(
      getScheduleValidationError({
        dueDate: "2026-08-14",
        startTime: "10:00",
        endTime: "09:00",
      })
    ).toMatch(/later than start time/i);
    expect(
      getScheduleValidationError({
        dueDate: "2026-08-14",
        endDate: "2026-08-15",
        startTime: "16:00",
        endTime: "11:00",
      })
    ).toBe("");
    expect(() =>
      normalizeTaskSchedule(
        { dueDate: "", startTime: "09:00", endTime: "10:00" },
        { validate: true }
      )
    ).toThrow(/choose a start date/i);
  });
});

describe("calendar date ranges", () => {
  it("clips ranges to the visible calendar interval", () => {
    expect(
      clipDateRange(
        "2026-07-30",
        "2026-08-04",
        "2026-08-01",
        "2026-08-31"
      )
    ).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-04",
      continuesBefore: true,
      continuesAfter: false,
    });
    expect(
      clipDateRange(
        "2026-09-01",
        "2026-09-02",
        "2026-08-01",
        "2026-08-31"
      )
    ).toBeNull();
  });

  it("builds a seven-day week with configurable week start", () => {
    expect(
      buildCalendarWeek("2026-08-14").map(({ key }) => key)
    ).toEqual([
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ]);
    expect(buildCalendarWeek("2026-08-14", 1)[0].key).toBe("2026-08-10");
    expect(shiftCalendarDate("2026-08-31", 1)).toBe("2026-09-01");
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

describe("future calendar view models", () => {
  it("groups agenda items by date and time", () => {
    const groups = groupCalendarAgenda([
      { id: "late", title: "Late", dueDate: "2026-08-14", startTime: "14:00", endTime: "15:00" },
      { id: "early", title: "Early", dueDate: "2026-08-14", startTime: "09:00", endTime: "10:00" },
      { id: "next", title: "Next", dueDate: "2026-08-15" },
      { id: "undated", title: "Undated" },
    ]);

    expect(groups.map(({ date }) => date)).toEqual([
      "2026-08-14",
      "2026-08-15",
    ]);
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

  it("assigns columns to overlapping timed events", () => {
    const layout = layoutTimedEvents([
      { id: "a", dueDate: "2026-08-14", startTime: "09:00", endTime: "10:30" },
      { id: "b", dueDate: "2026-08-14", startTime: "09:30", endTime: "10:00" },
      { id: "c", dueDate: "2026-08-14", startTime: "11:00", endTime: "12:00" },
    ]);

    expect(layout.find(({ id }) => id === "a")).toMatchObject({
      columnIndex: 0,
      columnCount: 2,
      startMinutes: 540,
    });
    expect(layout.find(({ id }) => id === "b")).toMatchObject({
      columnIndex: 1,
      columnCount: 2,
    });
    expect(layout.find(({ id }) => id === "c")).toMatchObject({
      columnIndex: 0,
      columnCount: 1,
    });
  });

  it("lays out timed event segments for a selected day", () => {
    const events = [
      {
        id: "range",
        dueDate: "2026-08-14",
        endDate: "2026-08-16",
        startTime: "16:00",
        endTime: "11:00",
      },
      {
        id: "overlap",
        dueDate: "2026-08-15",
        startTime: "09:00",
        endTime: "10:00",
      },
      { id: "all-day", dueDate: "2026-08-15" },
    ];

    expect(layoutCalendarDayEvents(events, "2026-08-14")[0]).toMatchObject({
      id: "range",
      startMinutes: 960,
      endMinutes: 1440,
      continuesAfter: true,
    });
    expect(layoutCalendarDayEvents(events, "2026-08-15")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "range",
          startMinutes: 0,
          endMinutes: 1440,
          continuesBefore: true,
          continuesAfter: true,
        }),
        expect.objectContaining({
          id: "overlap",
          startMinutes: 540,
          endMinutes: 600,
          columnCount: 2,
        }),
      ])
    );
    expect(layoutCalendarDayEvents(events, "2026-08-16")[0]).toMatchObject({
      id: "range",
      startMinutes: 0,
      endMinutes: 660,
      continuesBefore: true,
    });
  });

  it("segments multi-day items at week boundaries and assigns lanes", () => {
    const segments = segmentMultiDayItems(
      [
        { id: "long", dueDate: "2026-08-14", endDate: "2026-08-18" },
        { id: "overlap", dueDate: "2026-08-15", endDate: "2026-08-16" },
      ],
      "2026-08-09",
      "2026-08-22"
    );
    const positioned = assignMultiDayLanes(segments);

    expect(segments.filter(({ id }) => id === "long")).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      rowKey: "2026-08-09",
      startColumn: 5,
      endColumn: 6,
      continuesAfter: true,
    });
    expect(
      positioned.filter(({ rowKey }) => rowKey === "2026-08-09")
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "long", laneCount: 2 }),
        expect.objectContaining({ id: "overlap", laneCount: 2 }),
      ])
    );
  });

  it("clips month segments and keeps overlapping lane assignment deterministic", () => {
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
      segments.find(
        ({ id, rowKey }) => id === "earlier" && rowKey === "2026-08-02"
      )
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

  it("builds all-day and timed create-form defaults", () => {
    expect(createCalendarTaskInitialValues({ date: "2026-08-14" })).toEqual({
      dueDate: "2026-08-14",
      endDate: "",
      startTime: "",
      endTime: "",
    });
    expect(
      createCalendarTaskInitialValues({
        date: "2026-08-14",
        startTime: "23:30",
      })
    ).toEqual({
      dueDate: "2026-08-14",
      endDate: "2026-08-15",
      startTime: "23:30",
      endTime: "00:30",
    });
  });
});
