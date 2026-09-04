/**
 * Calendar domain: the month/week/day grids, agenda grouping, timed-event and
 * multi-day layout, Google Calendar event normalization and the calendar
 * connection descriptors shown in settings. Date and schedule primitives come
 * from `./task`.
 */
import {
  dateOnlyKey,
  getScheduleValidationError,
  isValidDateOnly,
  isValidTimeOnly,
  localDateFromDateOnly,
  normalizeTaskSchedule,
  shiftDateOnly,
  timeToMinutes,
} from "./task";

const MINUTES_PER_DAY = 1440;
const MILLISECONDS_PER_DAY = 86400000;

/** `HH:mm` for minutes since midnight, wrapping around the day. */
const minutesToTime = (minutes) => {
  const inDay = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = String(Math.floor(inDay / 60)).padStart(2, "0");
  return `${hours}:${String(inDay % 60).padStart(2, "0")}`;
};

/** `count` consecutive local days, each at midnight, starting at `start`. */
const daysFrom = (start, count) =>
  Array.from(
    { length: count },
    (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );

/* -- Grids -- */

export const calendarMonthStart = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const shiftCalendarMonth = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

/** A stable six-week grid (42 cells) for the month containing `visibleMonth`. */
export const buildCalendarMonthGrid = (visibleMonth, weekStartsOn = 0) => {
  const monthStart = calendarMonthStart(visibleMonth);
  const normalizedWeekStart = weekStartsOn === 1 ? 1 : 0;
  const leadingDays = (monthStart.getDay() - normalizedWeekStart + 7) % 7;
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - leadingDays
  );

  return daysFrom(gridStart, 42).map((date) => ({
    key: dateOnlyKey(date),
    day: date.getDate(),
    inCurrentMonth:
      date.getFullYear() === monthStart.getFullYear() &&
      date.getMonth() === monthStart.getMonth(),
  }));
};

/** Seven days starting on `weekStartsOn`, from a `Date` or a date-only key. */
export const buildCalendarWeek = (referenceDate, weekStartsOn = 0) => {
  const reference =
    referenceDate instanceof Date
      ? referenceDate
      : localDateFromDateOnly(referenceDate);

  if (
    !reference ||
    !Number.isInteger(weekStartsOn) ||
    weekStartsOn < 0 ||
    weekStartsOn > 6
  ) {
    return [];
  }

  const weekStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() - ((reference.getDay() - weekStartsOn + 7) % 7)
  );

  return daysFrom(weekStart, 7).map((date) => ({
    key: dateOnlyKey(date),
    date,
  }));
};

export const buildCalendarTimeAxis = ({
  startHour = 0,
  endHour = 24,
  stepMinutes = 60,
} = {}) => {
  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    endHour > 24 ||
    endHour <= startHour ||
    !Number.isInteger(stepMinutes) ||
    stepMinutes <= 0 ||
    60 % stepMinutes !== 0
  ) {
    return [];
  }

  const slotCount = ((endHour - startHour) * 60) / stepMinutes;
  return Array.from({ length: slotCount }, (_, index) => {
    const minutes = startHour * 60 + index * stepMinutes;
    const time = minutesToTime(minutes);
    return { minutes, time, label: time };
  });
};

export const calendarMinutesToPixels = (minutes, pixelsPerMinute = 1) => {
  if (
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > MINUTES_PER_DAY ||
    !Number.isFinite(pixelsPerMinute) ||
    pixelsPerMinute <= 0
  ) {
    return null;
  }

  return minutes * pixelsPerMinute;
};

/* -- Agenda -- */

const sortAgendaItems = (first, second) => {
  const firstTime = first.startTime || "00:00";
  const secondTime = second.startTime || "00:00";
  if (firstTime !== secondTime) return firstTime.localeCompare(secondTime);

  return String(first.title || "").localeCompare(String(second.title || ""));
};

export const groupCalendarAgenda = (
  tasks = [],
  { expandMultiDay = false } = {}
) => {
  const scheduled = tasks
    .map((task) => ({ ...task, ...normalizeTaskSchedule(task) }))
    .filter((item) => isValidDateOnly(item.dueDate))
    .sort(
      (first, second) =>
        first.dueDate.localeCompare(second.dueDate) ||
        sortAgendaItems(first, second)
    );

  const groups = new Map();
  scheduled.forEach((item) => {
    const finalDate =
      expandMultiDay &&
      isValidDateOnly(item.endDate) &&
      item.endDate >= item.dueDate
        ? item.endDate
        : item.dueDate;

    for (
      let date = item.dueDate;
      date <= finalDate;
      date = shiftDateOnly(date, 1)
    ) {
      const group = groups.get(date) || [];
      group.push(item);
      groups.set(date, group);
    }
  });

  return [...groups.entries()]
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, items]) => ({ date, items: items.sort(sortAgendaItems) }));
};

/* -- Overlap packing (shared by timed events and multi-day bars) -- */

/**
 * Greedy first-fit: every item takes the lowest lane still free at its start.
 * `bounds` returns the item's half-open `[start, end)` coordinates.
 */
const packIntoLanes = (items, bounds) => {
  const laneEnds = [];
  const lanes = items.map((item) => {
    const [start, end] = bounds(item);
    const lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane !== -1) {
      laneEnds[lane] = end;
      return lane;
    }
    laneEnds.push(end);
    return laneEnds.length - 1;
  });

  return { lanes, laneCount: laneEnds.length };
};

/* -- Timed layout -- */

const positionTimedIntervals = (timedEvents) => {
  const sortedEvents = [...timedEvents].sort(
    (first, second) =>
      first.startMinutes - second.startMinutes ||
      first.endMinutes - second.endMinutes
  );

  // Events that overlap transitively share a cluster, and only a cluster's own
  // events compete for its columns.
  const clusters = [];
  let currentCluster = [];
  let currentClusterEnd = -1;

  sortedEvents.forEach((event) => {
    if (currentCluster.length && event.startMinutes >= currentClusterEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      currentClusterEnd = -1;
    }

    currentCluster.push(event);
    currentClusterEnd = Math.max(currentClusterEnd, event.endMinutes);
  });
  if (currentCluster.length) clusters.push(currentCluster);

  return clusters.flatMap((cluster) => {
    const { lanes, laneCount } = packIntoLanes(
      cluster,
      ({ startMinutes, endMinutes }) => [startMinutes, endMinutes]
    );

    return cluster.map((event, index) => ({
      ...event,
      columnIndex: lanes[index],
      columnCount: laneCount,
    }));
  });
};

/**
 * Timed events that cover `date`, positioned in overlap columns. Multi-day
 * items are clipped to the day and flagged with `continuesBefore/After`.
 */
export const layoutCalendarDayEvents = (events = [], date) => {
  if (!isValidDateOnly(date)) return [];

  const timedEvents = events
    .map((event) => {
      const schedule = normalizeTaskSchedule(event);
      const finalDate = schedule.endDate || schedule.dueDate;

      if (
        getScheduleValidationError(schedule) ||
        schedule.isAllDay ||
        date < schedule.dueDate ||
        date > finalDate
      ) {
        return null;
      }

      const continuesBefore = date > schedule.dueDate;
      const continuesAfter = date < finalDate;
      const startMinutes = continuesBefore ? 0 : timeToMinutes(schedule.startTime);
      const endMinutes = continuesAfter
        ? MINUTES_PER_DAY
        : timeToMinutes(schedule.endTime);

      if (
        startMinutes === null ||
        endMinutes === null ||
        endMinutes <= startMinutes
      ) {
        return null;
      }

      return {
        ...event,
        ...schedule,
        calendarDate: date,
        continuesBefore,
        continuesAfter,
        startMinutes,
        endMinutes,
      };
    })
    .filter(Boolean);

  return positionTimedIntervals(timedEvents);
};

/* -- Multi-day bars -- */

const dateOrdinal = (value) => {
  const date = localDateFromDateOnly(value);
  return date
    ? Math.floor(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
          MILLISECONDS_PER_DAY
      )
    : null;
};

const clipDateRange = (startDate, endDate, visibleStartDate, visibleEndDate) => {
  const allValid = [startDate, endDate, visibleStartDate, visibleEndDate].every(
    isValidDateOnly
  );

  if (
    !allValid ||
    endDate < startDate ||
    visibleEndDate < visibleStartDate ||
    endDate < visibleStartDate ||
    startDate > visibleEndDate
  ) {
    return null;
  }

  return {
    startDate: startDate < visibleStartDate ? visibleStartDate : startDate,
    endDate: endDate > visibleEndDate ? visibleEndDate : endDate,
  };
};

/** Splits multi-day items into one bar per calendar row. */
export const segmentMultiDayItems = (
  items = [],
  visibleStartDate,
  visibleEndDate,
  weekStartsOn = 0
) => {
  const segments = [];

  items.forEach((item) => {
    const schedule = normalizeTaskSchedule(item);
    if (!isValidDateOnly(schedule.dueDate)) return;

    const itemEndDate = schedule.endDate || schedule.dueDate;
    const clipped = clipDateRange(
      schedule.dueDate,
      itemEndDate,
      visibleStartDate,
      visibleEndDate
    );
    if (!clipped) return;

    let segmentStart = clipped.startDate;
    while (segmentStart <= clipped.endDate) {
      const rowStart =
        buildCalendarWeek(segmentStart, weekStartsOn)[0]?.key || "";
      const rowEnd = shiftDateOnly(rowStart, 6);
      const segmentEnd = clipped.endDate < rowEnd ? clipped.endDate : rowEnd;
      const rowOrdinal = dateOrdinal(rowStart);
      const startColumn = dateOrdinal(segmentStart) - rowOrdinal;
      const endColumn = dateOrdinal(segmentEnd) - rowOrdinal;

      segments.push({
        ...item,
        segmentId: `${item.id || "item"}:${segmentStart}`,
        rowKey: rowStart,
        startDate: segmentStart,
        endDate: segmentEnd,
        startColumn,
        endColumn,
        span: endColumn - startColumn + 1,
        continuesBefore: schedule.dueDate < segmentStart,
        continuesAfter: itemEndDate > segmentEnd,
      });

      segmentStart = shiftDateOnly(segmentEnd, 1);
    }
  });

  return segments;
};

/** Stacks overlapping row segments into lanes. */
export const assignMultiDayLanes = (segments = []) => {
  const rows = new Map();
  segments.forEach((segment) => {
    const row = rows.get(segment.rowKey) || [];
    row.push(segment);
    rows.set(segment.rowKey, row);
  });

  return [...rows.values()].flatMap((rowSegments) => {
    const ordered = [...rowSegments].sort(
      (first, second) =>
        first.startColumn - second.startColumn ||
        second.endColumn - first.endColumn
    );
    // Columns are inclusive, so a lane frees up the column after it ends.
    const { lanes, laneCount } = packIntoLanes(
      ordered,
      ({ startColumn, endColumn }) => [startColumn, endColumn + 1]
    );

    return ordered.map((segment, index) => ({
      ...segment,
      lane: lanes[index],
      laneCount,
    }));
  });
};

/* -- Creating from the calendar -- */

/** The schedule a new task starts with when it is created from a grid cell. */
export const createCalendarTaskInitialValues = ({
  date,
  startTime = "",
  endTime = "",
  endDate = "",
  durationMinutes = 60,
} = {}) => {
  if (!isValidDateOnly(date)) {
    throw new Error("A valid calendar date is required.");
  }

  if (!startTime) {
    return {
      dueDate: date,
      endDate: endDate || "",
      startTime: "",
      endTime: "",
    };
  }

  if (!isValidTimeOnly(startTime)) {
    throw new Error("A valid start time is required.");
  }

  let resolvedEndDate = endDate;
  let resolvedEndTime = endTime;

  if (!resolvedEndTime) {
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new Error("Duration must be greater than zero.");
    }

    const endMinutes = timeToMinutes(startTime) + durationMinutes;
    const dayOffset = Math.floor(endMinutes / MINUTES_PER_DAY);
    resolvedEndTime = minutesToTime(endMinutes);
    resolvedEndDate =
      resolvedEndDate || (dayOffset ? shiftDateOnly(date, dayOffset) : "");
  }

  const initialValues = {
    dueDate: date,
    endDate: resolvedEndDate || "",
    startTime,
    endTime: resolvedEndTime,
  };

  const validationError = getScheduleValidationError(initialValues);
  if (validationError) throw new Error(validationError);

  return initialValues;
};

/* -- Google Calendar (read-only mirror) -- */

const localDateParts = (value) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return { date: value, time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: dateOnlyKey(date),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`,
  };
};

const normalizeGoogleCalendarEvent = (event) => {
  const start = localDateParts(event?.start);
  if (!event?.id || !start) return null;

  // Google reports an all-day range with an exclusive end date; step back a day
  // so the mirrored event ends on the last day it actually covers.
  const parsedEnd = localDateParts(event.end) || start;
  const end =
    event.allDay && parsedEnd.date > start.date
      ? localDateParts(
          new Date(
            new Date(`${parsedEnd.date}T00:00:00`).getTime() -
              MILLISECONDS_PER_DAY
          ).toISOString()
        )
      : parsedEnd;

  return {
    id: `google:${event.calendarId || "calendar"}:${event.id}`,
    externalId: String(event.id),
    source: "google",
    title: String(event.title || "Untitled event"),
    description: String(event.description || ""),
    location: String(event.location || ""),
    calendarName: String(event.calendarName || "Google Calendar"),
    htmlLink: /^https:\/\//u.test(String(event.htmlLink || ""))
      ? String(event.htmlLink)
      : "",
    dueDate: start.date,
    endDate: end.date === start.date ? "" : end.date,
    startTime: event.allDay ? "" : start.time,
    endTime: event.allDay ? "" : end.time,
    isAllDay: Boolean(event.allDay),
    completed: false,
    status: "todo",
    priority: "medium",
  };
};

export const normalizeGoogleCalendarEvents = (events = []) => {
  const unique = new Map();
  events.forEach((event) => {
    const normalized = normalizeGoogleCalendarEvent(event);
    if (normalized) unique.set(normalized.id, normalized);
  });
  return [...unique.values()];
};

/* -- Provider connections (settings) -- */

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

const normalizeCalendarConnection = (value = {}) =>
  value?.connected === true
    ? {
        connected: true,
        accountLabel: String(value?.accountLabel || "").slice(0, 160),
        status: "connected",
        connectedAt: value?.connectedAt ?? null,
      }
    : emptyCalendarConnection();

/** Every provider, credential-free, from whatever was stored. */
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
