const localDateParts = (value) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return { date: value, time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
};

export const normalizeGoogleCalendarEvent = (event) => {
  const start = localDateParts(event?.start);
  if (!event?.id || !start) return null;
  const parsedEnd = localDateParts(event.end) || start;
  const inclusiveAllDayEnd = event.allDay && parsedEnd.date > start.date
    ? localDateParts(new Date(new Date(`${parsedEnd.date}T00:00:00`).getTime() - 24 * 60 * 60 * 1000).toISOString())
    : parsedEnd;
  const end = inclusiveAllDayEnd || start;
  return {
    id: `google:${event.calendarId || "calendar"}:${event.id}`,
    externalId: String(event.id),
    source: "google",
    title: String(event.title || "Untitled event"),
    description: String(event.description || ""),
    location: String(event.location || ""),
    calendarName: String(event.calendarName || "Google Calendar"),
    htmlLink: /^https:\/\//u.test(String(event.htmlLink || "")) ? String(event.htmlLink) : "",
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
