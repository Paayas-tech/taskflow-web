import { isTaskComplete, normalizeTaskSchedule } from "../domain/task";
import { formatReminderMetadata } from "../domain/reminder";
import {
  formatDateOnlyForDisplay,
  formatTimeForDisplay,
} from "../domain/settings";
import { selectProject, selectSettings } from "../store/selectors";
import { useStore } from "../store/store";
import { Icon, cx } from "../ui";

const eventKind = (schedule, segment) => {
  if (segment) return "multiday";
  return schedule.isAllDay ? "allday" : "timed";
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

/**
 * One scheduled item on the calendar: a `.cal-chip` in the month grid and a
 * `.cal-event` block in the week and day time grids. The left bar takes the
 * project color, or the accent for personal tasks and the info tone for
 * Google Calendar events.
 */
export function CalendarEvent({
  task,
  onClick,
  viewContext = "month",
  segment = null,
  style,
  displayTime,
  selected = false,
}) {
  const { time } = useStore(selectSettings);
  const project = useStore(selectProject(task.projectId || ""));
  const schedule = normalizeTaskSchedule(task);
  const kind = eventKind(schedule, segment);
  const googleEvent = task.source === "google";
  const timeLabel =
    displayTime !== undefined
      ? displayTime
      : kind === "timed"
        ? formatTimeForDisplay(schedule.startTime, time.format)
        : segmentMetadata(schedule, segment, time.format);
  const completed = isTaskComplete(task);
  const color = googleEvent
    ? "var(--color-info)"
    : project?.color || "var(--color-accent)";
  const rangeLabel = schedule.endDate
    ? `${formatDateOnlyForDisplay(schedule.dueDate, time.dateFormat)} through ${formatDateOnlyForDisplay(schedule.endDate, time.dateFormat)}`
    : formatDateOnlyForDisplay(schedule.dueDate, time.dateFormat);
  const scheduleLabel = schedule.isAllDay
    ? `${rangeLabel}, all day`
    : `${rangeLabel}, ${formatTimeForDisplay(schedule.startTime, time.format)} to ${formatTimeForDisplay(schedule.endTime, time.format)}`;
  const reminderLabel = task.reminderAt
    ? formatReminderMetadata(task.reminderAt, new Date(), {
        timeFormat: time.format,
      })
    : "Reminder enabled";
  const description = `${task.title}. ${scheduleLabel}${task.reminder ? `. ${reminderLabel}` : ""}`;

  return (
    <button
      type="button"
      className={cx(
        viewContext === "month" ? "cal-chip" : "cal-event",
        `cal-ev-${kind}`,
        completed && "is-complete",
        googleEvent && "is-google",
        selected && "is-selected",
        segment?.continuesBefore && "continues-before",
        segment?.continuesAfter && "continues-after"
      )}
      style={{ ...style, "--cal-event-color": color }}
      title={description}
      aria-label={`${googleEvent ? "Open Google Calendar event" : "Open"} ${description}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
    >
      {googleEvent ? (
        <span className="cal-ev-source" aria-hidden="true">
          G
        </span>
      ) : null}
      {timeLabel ? <span className="cal-ev-time">{timeLabel}</span> : null}
      <span className="cal-ev-title">{task.title}</span>
      {task.reminder ? (
        <span className="cal-ev-reminder" aria-hidden="true">
          <Icon name="bell" size={11} />
        </span>
      ) : null}
    </button>
  );
}
