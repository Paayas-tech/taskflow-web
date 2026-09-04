import { useMemo } from "react";
import { CalendarEvent } from "./CalendarEvent";
import {
  buildCalendarTimeAxis,
  calendarMinutesToPixels,
  createCalendarTaskInitialValues,
  layoutCalendarDayEvents,
} from "../domain/calendar";
import { isValidDateOnly, normalizeTaskSchedule } from "../domain/task";
import { formatTimeForDisplay } from "../domain/settings";
import { selectSettings } from "../store/selectors";
import { useStore } from "../store/store";
import { Button, Icon } from "../ui";

const pixelsPerMinute = 1;

const timedEventStyle = ({ startMinutes, endMinutes, columnIndex, columnCount }) => ({
  top: calendarMinutesToPixels(startMinutes, pixelsPerMinute),
  height: Math.max(
    28,
    calendarMinutesToPixels(endMinutes - startMinutes, pixelsPerMinute)
  ),
  left: `calc(${(columnIndex / columnCount) * 100}% + 4px)`,
  width: `calc(${100 / columnCount}% - 8px)`,
});

const displayTimeForSegment = (task, timeFormat) => {
  if (task.continuesBefore && task.continuesAfter) return "Ongoing";
  if (task.continuesBefore)
    return `Ends ${formatTimeForDisplay(task.endTime, timeFormat)}`;
  if (task.continuesAfter)
    return `${formatTimeForDisplay(task.startTime, timeFormat)} →`;
  return formatTimeForDisplay(task.startTime, timeFormat);
};

/** Single-day time grid with its own all-day lane. */
export function CalendarDayView({
  tasks = [],
  selectedDateKey,
  todayKey,
  nowMinutes = null,
  onCreateTask,
  onOpenTask,
  selectedTaskId = null,
}) {
  const { time } = useStore(selectSettings);
  const timeAxis = useMemo(() => buildCalendarTimeAxis(), []);
  const normalizedTasks = useMemo(
    () => tasks.map((task) => ({ ...task, ...normalizeTaskSchedule(task) })),
    [tasks]
  );
  const allDayTasks = useMemo(
    () =>
      normalizedTasks.filter((task) => {
        const finalDate = task.endDate || task.dueDate;
        return (
          task.isAllDay &&
          isValidDateOnly(task.dueDate) &&
          selectedDateKey >= task.dueDate &&
          selectedDateKey <= finalDate
        );
      }),
    [normalizedTasks, selectedDateKey]
  );
  const timedEvents = useMemo(
    () => layoutCalendarDayEvents(normalizedTasks, selectedDateKey),
    [normalizedTasks, selectedDateKey]
  );

  const createAllDay = () => {
    onCreateTask?.(createCalendarTaskInitialValues({ date: selectedDateKey }));
  };

  const createTimed = (startTime) => {
    onCreateTask?.(
      createCalendarTaskInitialValues({ date: selectedDateKey, startTime })
    );
  };

  return (
    <section className="cal-timegrid cal-day" aria-label="Day view">
      <div className="cal-allday cal-day-allday">
        <span className="cal-gutter cal-allday-label">All day</span>
        <div className="cal-day-allday-events">
          {allDayTasks.length === 0 ? (
            <p className="cal-allday-empty muted">No all-day tasks</p>
          ) : (
            allDayTasks.map((task) => {
              const finalDate = task.endDate || task.dueDate;
              const segment =
                finalDate > task.dueDate
                  ? {
                      continuesBefore: selectedDateKey > task.dueDate,
                      continuesAfter: selectedDateKey < finalDate,
                    }
                  : null;
              return (
                <CalendarEvent
                  key={task.id}
                  task={task}
                  segment={segment}
                  viewContext="day"
                  selected={selectedTaskId === task.id}
                  onClick={() => onOpenTask?.(task)}
                />
              );
            })
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="plus" size={14} />}
          disabled={!onCreateTask}
          onClick={createAllDay}
        >
          Add all-day task
        </Button>
      </div>

      <div className="cal-time-scroll">
        <div
          className="cal-time-canvas"
          style={{ height: calendarMinutesToPixels(1440, pixelsPerMinute) }}
        >
          <div className="cal-time-axis" aria-hidden="true">
            {timeAxis.map(({ minutes, label, time: slotTime }) => (
              <span key={minutes} style={{ top: calendarMinutesToPixels(minutes) }}>
                {formatTimeForDisplay(slotTime, time.format) || label}
              </span>
            ))}
          </div>
          <div className="cal-hour-lines" aria-hidden="true">
            {timeAxis.map(({ minutes }) => (
              <span key={minutes} style={{ top: calendarMinutesToPixels(minutes) }} />
            ))}
          </div>
          <div className="cal-day-column">
            {timeAxis.map(({ minutes, time: slotTime }) => (
              <button
                type="button"
                key={minutes}
                className="cal-slot"
                disabled={!onCreateTask}
                aria-label={`Add a one-hour task at ${formatTimeForDisplay(slotTime, time.format)}`}
                onClick={() => createTimed(slotTime)}
              />
            ))}
            {selectedDateKey === todayKey && nowMinutes !== null ? (
              <div
                className="cal-now-line"
                aria-hidden="true"
                style={{ top: calendarMinutesToPixels(nowMinutes) }}
              />
            ) : null}
            {timedEvents.map((task) => (
              <CalendarEvent
                key={task.id}
                task={task}
                viewContext="day"
                selected={selectedTaskId === task.id}
                displayTime={displayTimeForSegment(task, time.format)}
                style={timedEventStyle(task)}
                onClick={() => onOpenTask?.(task)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
