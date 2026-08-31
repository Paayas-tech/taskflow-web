import { normalizeTaskSchedule } from "./domain/calendarDomain";
import { isTaskComplete } from "./domain/taskDomain";
import { formatReminderMetadata } from "./domain/reminderDomain";
import {
  formatDateOnlyForDisplay,
  formatTimeForDisplay,
} from "./domain/settingsDomain";

const eventKind = (schedule, segment) => {
  if (segment) return "multi-day";
  return schedule.isAllDay ? "all-day" : "timed";
};

const segmentMetadata = (schedule, segment, timeFormat) => {
  if (!segment) return "";

  if (!segment.continuesBefore && !segment.continuesAfter) {
    return schedule.startTime
      ? `${formatTimeForDisplay(schedule.startTime, timeFormat)}–${formatTimeForDisplay(schedule.endTime, timeFormat)}`
      : "All day";
  }

  if (!segment.continuesBefore) {
    return schedule.startTime
      ? formatTimeForDisplay(schedule.startTime, timeFormat)
      : "Starts";
  }

  if (!segment.continuesAfter) {
    return schedule.endTime
      ? `Ends ${formatTimeForDisplay(schedule.endTime, timeFormat)}`
      : "Ends";
  }

  return "";
};

export default function CalendarEvent({
  task,
  onClick,
  viewContext = "month",
  segment = null,
  style,
  displayTime,
  formatSettings = {},
}) {
  const schedule = normalizeTaskSchedule(task);
  const kind = eventKind(schedule, segment);
  const timeLabel =
    displayTime !== undefined
      ? displayTime
      : kind === "timed"
        ? formatTimeForDisplay(schedule.startTime, formatSettings.format)
        : segmentMetadata(schedule, segment, formatSettings.format);
  const completed = isTaskComplete(task);
  const priority = task.priority || "medium";
  const rangeLabel = schedule.endDate
    ? `${formatDateOnlyForDisplay(schedule.dueDate, formatSettings.dateFormat)} through ${formatDateOnlyForDisplay(schedule.endDate, formatSettings.dateFormat)}`
    : formatDateOnlyForDisplay(schedule.dueDate, formatSettings.dateFormat);
  const scheduleLabel = schedule.isAllDay
    ? `${rangeLabel}, all day`
    : `${rangeLabel}, ${formatTimeForDisplay(schedule.startTime, formatSettings.format)} to ${formatTimeForDisplay(schedule.endTime, formatSettings.format)}`;
  const reminderLabel = task.reminderAt
    ? formatReminderMetadata(task.reminderAt, new Date(), {
        timeFormat: formatSettings.format,
      })
    : "Reminder enabled";

  return (
    <button
      className={`calendar-event calendar-event-${kind} calendar-event-${viewContext} priority-${priority} ${
        completed ? "is-completed" : ""
      } ${task.source === "google" ? "calendar-event-google" : ""
      } ${segment?.continuesBefore ? "continues-before" : ""} ${
        segment?.continuesAfter ? "continues-after" : ""
      }`}
      type="button"
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      title={`${task.title}. ${scheduleLabel}${
        task.reminder ? `. ${reminderLabel}` : ""
      }`}
      aria-label={`${task.source === "google" ? "Open Google Calendar event" : "Edit"} ${task.title}. ${scheduleLabel}${
        task.reminder ? `. ${reminderLabel}` : ""
      }`}
    >
      <span className="calendar-priority-dot" aria-hidden="true" />
      {timeLabel && <span className="calendar-event-time">{timeLabel}</span>}
      <span className="calendar-event-title">{task.title}</span>
      {task.source === "google" && <span className="calendar-event-source" aria-hidden="true">G</span>}
      {task.reminder && (
        <span className="calendar-reminder-icon" aria-label="Reminder enabled">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 11.5h9l-1.1-1.7V6.7a3.4 3.4 0 0 0-6.8 0v3.1L3.5 11.5Zm3 1.3a1.5 1.5 0 0 0 3 0" />
          </svg>
        </span>
      )}
      {task.reminderAt && (
        <span className="calendar-reminder-time">{reminderLabel}</span>
      )}
    </button>
  );
}
