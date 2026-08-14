import { useMemo } from "react";
import CalendarEvent from "./CalendarEvent";
import {
  buildCalendarTimeAxis,
  calendarMinutesToPixels,
  createCalendarTaskInitialValues,
  isValidCalendarDate,
  layoutCalendarDayEvents,
  normalizeTaskSchedule,
} from "./domain/calendarDomain";
import { formatTimeForDisplay } from "./domain/settingsDomain";

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

export default function CalendarDayView({
  tasks,
  selectedDateKey,
  onCreateTask,
  onEditTask,
  formatSettings = {},
}) {
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
          isValidCalendarDate(task.dueDate) &&
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
    onCreateTask(createCalendarTaskInitialValues({ date: selectedDateKey }));
  };

  const createTimed = (startTime) => {
    onCreateTask(
      createCalendarTaskInitialValues({ date: selectedDateKey, startTime })
    );
  };

  return (
    <section className="calendar-time-view calendar-day-view" aria-label="Day view">
      <div className="calendar-day-all-day">
        <button
          className="calendar-day-all-day-create"
          type="button"
          onClick={createAllDay}
        >
          <span>All day</span>
          <small>+ Add task</small>
        </button>
        <div className="calendar-day-all-day-events">
          {allDayTasks.length === 0 ? (
            <p>No all-day tasks</p>
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
                  formatSettings={formatSettings}
                  onClick={(event) => onEditTask(task, event.currentTarget)}
                />
              );
            })
          )}
        </div>
      </div>

      <div className="calendar-time-scroll calendar-day-time-scroll">
        <div
          className="calendar-time-canvas calendar-day-time-canvas"
          style={{ height: calendarMinutesToPixels(1440, pixelsPerMinute) }}
        >
          <div className="calendar-time-axis" aria-hidden="true">
            {timeAxis.map(({ minutes, label, time }) => (
              <span key={minutes} style={{ top: calendarMinutesToPixels(minutes) }}>
                {formatTimeForDisplay(time, formatSettings.format) || label}
              </span>
            ))}
          </div>
          <div className="calendar-hour-lines" aria-hidden="true">
            {timeAxis.map(({ minutes }) => (
              <span key={minutes} style={{ top: calendarMinutesToPixels(minutes) }} />
            ))}
          </div>
          <div className="calendar-day-time-column">
            {timeAxis.map(({ minutes, time }) => (
              <button
                className="calendar-time-slot"
                type="button"
                key={minutes}
                onClick={() => createTimed(time)}
                aria-label={`Create a one-hour task at ${formatTimeForDisplay(time, formatSettings.format)}`}
              />
            ))}
            {timedEvents.map((task) => (
              <CalendarEvent
                key={task.id}
                task={task}
                viewContext="day"
                displayTime={displayTimeForSegment(task, formatSettings.format)}
                formatSettings={formatSettings}
                style={timedEventStyle(task)}
                onClick={(event) => onEditTask(task, event.currentTarget)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
