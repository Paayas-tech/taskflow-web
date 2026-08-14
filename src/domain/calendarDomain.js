const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const normalizedText = (value) => String(value || "").trim();

const dateParts = (value) => {
  const normalized = normalizedText(value);
  if (!DATE_ONLY_PATTERN.test(normalized)) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? { year, month, day, date }
    : null;
};

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const shiftDateOnly = (value, amount) => {
  const parsed = dateParts(value);
  if (!parsed) return "";

  return dateKey(
    new Date(parsed.year, parsed.month - 1, parsed.day + amount)
  );
};

export const shiftCalendarDate = (value, amount) =>
  shiftDateOnly(value, amount);

const dateOrdinal = (value) => {
  const parsed = dateParts(value);
  return parsed
    ? Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86400000)
    : null;
};

const normalizedScheduleFields = (schedule = {}) => ({
  dueDate: normalizedText(schedule.dueDate),
  endDate: normalizedText(schedule.endDate),
  startTime: normalizedText(schedule.startTime),
  endTime: normalizedText(schedule.endTime),
});

export const isValidCalendarDate = (value) => dateParts(value) !== null;

export const isValidTimeOnly = (value) =>
  TIME_ONLY_PATTERN.test(normalizedText(value));

export const calendarTimeToMinutes = (value) => {
  if (!isValidTimeOnly(value)) return null;

  const [hours, minutes] = normalizedText(value).split(":").map(Number);
  return hours * 60 + minutes;
};

export const calendarMinutesToPixels = (minutes, pixelsPerMinute = 1) => {
  if (
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > 1440 ||
    !Number.isFinite(pixelsPerMinute) ||
    pixelsPerMinute <= 0
  ) {
    return null;
  }

  return minutes * pixelsPerMinute;
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

  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  const slots = [];

  for (let minutes = startMinutes; minutes < endMinutes; minutes += stepMinutes) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const remainder = String(minutes % 60).padStart(2, "0");
    slots.push({
      minutes,
      time: `${hours}:${remainder}`,
      label: remainder === "00" ? `${hours}:00` : `${hours}:${remainder}`,
    });
  }

  return slots;
};

export const deriveIsAllDay = (schedule = {}) => {
  const { startTime, endTime } = normalizedScheduleFields(schedule);
  return !startTime && !endTime;
};

export const getScheduleValidationError = (schedule = {}) => {
  const { dueDate, endDate, startTime, endTime } =
    normalizedScheduleFields(schedule);

  if (dueDate && !isValidCalendarDate(dueDate)) {
    return "Start date must use a valid YYYY-MM-DD date.";
  }

  if (!dueDate && (endDate || startTime || endTime)) {
    return "Choose a start date before adding an end date or time.";
  }

  if (endDate && !isValidCalendarDate(endDate)) {
    return "End date must use a valid YYYY-MM-DD date.";
  }

  if (endDate && endDate < dueDate) {
    return "End date cannot be earlier than the start date.";
  }

  if (Boolean(startTime) !== Boolean(endTime)) {
    return "Start time and end time must be provided together.";
  }

  if (startTime && !isValidTimeOnly(startTime)) {
    return "Start time must use a valid 24-hour HH:mm time.";
  }

  if (endTime && !isValidTimeOnly(endTime)) {
    return "End time must use a valid 24-hour HH:mm time.";
  }

  const effectiveEndDate = endDate || dueDate;
  if (
    startTime &&
    effectiveEndDate === dueDate &&
    calendarTimeToMinutes(endTime) <= calendarTimeToMinutes(startTime)
  ) {
    return "End time must be later than start time for a single-day item.";
  }

  return "";
};

export const normalizeTaskSchedule = (
  schedule = {},
  { validate = false } = {}
) => {
  const normalized = normalizedScheduleFields(schedule);
  const validationError = getScheduleValidationError(normalized);

  if (validate && validationError) {
    throw new Error(validationError);
  }

  return {
    ...normalized,
    isAllDay: deriveIsAllDay(normalized),
  };
};

export const clipDateRange = (
  startDate,
  endDate,
  visibleStartDate,
  visibleEndDate
) => {
  if (
    !isValidCalendarDate(startDate) ||
    !isValidCalendarDate(endDate) ||
    !isValidCalendarDate(visibleStartDate) ||
    !isValidCalendarDate(visibleEndDate) ||
    endDate < startDate ||
    visibleEndDate < visibleStartDate ||
    endDate < visibleStartDate ||
    startDate > visibleEndDate
  ) {
    return null;
  }

  const clippedStartDate =
    startDate < visibleStartDate ? visibleStartDate : startDate;
  const clippedEndDate = endDate > visibleEndDate ? visibleEndDate : endDate;

  return {
    startDate: clippedStartDate,
    endDate: clippedEndDate,
    continuesBefore: startDate < clippedStartDate,
    continuesAfter: endDate > clippedEndDate,
  };
};

export const buildCalendarWeek = (referenceDate, weekStartsOn = 0) => {
  const reference =
    referenceDate instanceof Date
      ? new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          referenceDate.getDate()
        )
      : dateParts(referenceDate)?.date;

  if (!reference || !Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    return [];
  }

  const offset = (reference.getDay() - weekStartsOn + 7) % 7;
  const weekStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() - offset
  );

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + index
    );

    return { key: dateKey(date), date };
  });
};

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
  const scheduledTasks = tasks
    .map((task) => ({ task, schedule: normalizeTaskSchedule(task) }))
    .filter(({ schedule }) => isValidCalendarDate(schedule.dueDate))
    .sort((first, second) => {
      if (first.schedule.dueDate !== second.schedule.dueDate) {
        return first.schedule.dueDate.localeCompare(second.schedule.dueDate);
      }

      return sortAgendaItems(
        { ...first.task, ...first.schedule },
        { ...second.task, ...second.schedule }
      );
    });

  const groups = new Map();
  scheduledTasks.forEach(({ task, schedule }) => {
    const item = { ...task, ...schedule };
    const finalDate =
      expandMultiDay &&
      isValidCalendarDate(schedule.endDate) &&
      schedule.endDate >= schedule.dueDate
        ? schedule.endDate
        : schedule.dueDate;
    let currentDate = schedule.dueDate;

    while (currentDate <= finalDate) {
      const group = groups.get(currentDate) || [];
      group.push(item);
      groups.set(currentDate, group);
      currentDate = shiftDateOnly(currentDate, 1);
    }
  });

  return [...groups.entries()]
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, items]) => ({
      date,
      items: [...items].sort(sortAgendaItems),
    }));
};

const positionTimedIntervals = (timedEvents) => {
  const sortedEvents = [...timedEvents]
    .sort(
      (first, second) =>
        first.startMinutes - second.startMinutes ||
        first.endMinutes - second.endMinutes
    );

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
    const columnEnds = [];
    const positioned = cluster.map((event) => {
      let columnIndex = columnEnds.findIndex(
        (columnEnd) => columnEnd <= event.startMinutes
      );

      if (columnIndex === -1) {
        columnIndex = columnEnds.length;
        columnEnds.push(event.endMinutes);
      } else {
        columnEnds[columnIndex] = event.endMinutes;
      }

      return { ...event, columnIndex };
    });

    const columnCount = columnEnds.length;
    return positioned.map(({ event, ...layout }) => ({
      ...event,
      ...layout,
      columnCount,
    }));
  });
};

export const layoutTimedEvents = (events = []) => {
  const timedEvents = events
    .map((event) => {
      const schedule = normalizeTaskSchedule(event);
      const validationError = getScheduleValidationError(schedule);
      const effectiveEndDate = schedule.endDate || schedule.dueDate;

      if (
        validationError ||
        schedule.isAllDay ||
        effectiveEndDate !== schedule.dueDate
      ) {
        return null;
      }

      return {
        event,
        startMinutes: calendarTimeToMinutes(schedule.startTime),
        endMinutes: calendarTimeToMinutes(schedule.endTime),
      };
    })
    .filter(Boolean);

  return positionTimedIntervals(timedEvents);
};

export const layoutCalendarDayEvents = (events = [], date) => {
  if (!isValidCalendarDate(date)) return [];

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
      const startMinutes = continuesBefore
        ? 0
        : calendarTimeToMinutes(schedule.startTime);
      const endMinutes = continuesAfter
        ? 1440
        : calendarTimeToMinutes(schedule.endTime);

      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return null;
      }

      return {
        event: {
          ...event,
          ...schedule,
          calendarDate: date,
          continuesBefore,
          continuesAfter,
        },
        startMinutes,
        endMinutes,
      };
    })
    .filter(Boolean);

  return positionTimedIntervals(timedEvents);
};

const weekStartKey = (dateValue, weekStartsOn) =>
  buildCalendarWeek(dateValue, weekStartsOn)[0]?.key || "";

export const segmentMultiDayItems = (
  items = [],
  visibleStartDate,
  visibleEndDate,
  weekStartsOn = 0
) => {
  const segments = [];

  items.forEach((item) => {
    const schedule = normalizeTaskSchedule(item);
    if (!isValidCalendarDate(schedule.dueDate)) return;

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
      const rowStart = weekStartKey(segmentStart, weekStartsOn);
      const rowEnd = shiftDateOnly(rowStart, 6);
      const segmentEnd =
        clipped.endDate < rowEnd ? clipped.endDate : rowEnd;
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

export const assignMultiDayLanes = (segments = []) => {
  const rows = new Map();
  segments.forEach((segment) => {
    const row = rows.get(segment.rowKey) || [];
    row.push(segment);
    rows.set(segment.rowKey, row);
  });

  return [...rows.values()].flatMap((rowSegments) => {
    const laneEnds = [];
    const positioned = [...rowSegments]
      .sort(
        (first, second) =>
          first.startColumn - second.startColumn ||
          second.endColumn - first.endColumn
      )
      .map((segment) => {
        let lane = laneEnds.findIndex(
          (laneEnd) => laneEnd < segment.startColumn
        );

        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(segment.endColumn);
        } else {
          laneEnds[lane] = segment.endColumn;
        }

        return { ...segment, lane };
      });

    return positioned.map((segment) => ({
      ...segment,
      laneCount: laneEnds.length,
    }));
  });
};

const minutesToTime = (minutes) => {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalizedMinutes / 60)).padStart(2, "0");
  const remainder = String(normalizedMinutes % 60).padStart(2, "0");
  return `${hours}:${remainder}`;
};

export const createCalendarTaskInitialValues = ({
  date,
  startTime = "",
  endTime = "",
  endDate = "",
  durationMinutes = 60,
} = {}) => {
  if (!isValidCalendarDate(date)) {
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

    const endMinutes = calendarTimeToMinutes(startTime) + durationMinutes;
    const dayOffset = Math.floor(endMinutes / 1440);
    resolvedEndTime = minutesToTime(endMinutes);
    resolvedEndDate = resolvedEndDate || (dayOffset ? shiftDateOnly(date, dayOffset) : "");
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
