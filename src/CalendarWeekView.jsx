import { useMemo } from "react";
import CalendarEvent from "./CalendarEvent";
import {
  assignMultiDayLanes,
  buildCalendarTimeAxis,
  buildCalendarWeek,
  calendarMinutesToPixels,
  createCalendarTaskInitialValues,
  isValidCalendarDate,
  layoutCalendarDayEvents,
  normalizeTaskSchedule,
  segmentMultiDayItems,
} from "./domain/calendarDomain";
import { dateOnlyKey, localDateFromDateOnly } from "./domain/taskDomain";
import { formatTimeForDisplay } from "./domain/settingsDomain";

const pixelsPerMinute = 1;

const formatDay = (dateKey) => {
  const date = localDateFromDateOnly(dateKey);
  return date
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
      }).format(date)
    : dateKey;
};

const timedEventStyle = ({ startMinutes, endMinutes, columnIndex, columnCount }) => ({
  top: calendarMinutesToPixels(startMinutes, pixelsPerMinute),
  height: Math.max(
    24,
    calendarMinutesToPixels(endMinutes - startMinutes, pixelsPerMinute)
  ),
  left: `calc(${(columnIndex / columnCount) * 100}% + 2px)`,
  width: `calc(${100 / columnCount}% - 4px)`,
});

export default function CalendarWeekView({
  tasks,
  selectedDateKey,
  onSelectDate,
  onCreateTask,
  onEditTask,
  weekStartsOn = 0,
  formatSettings = {},
}) {
  const week = useMemo(
    () => buildCalendarWeek(selectedDateKey, weekStartsOn),
    [selectedDateKey, weekStartsOn]
  );
  const timeAxis = useMemo(() => buildCalendarTimeAxis(), []);
  const todayKey = dateOnlyKey(new Date());
  const weekStart = week[0]?.key || "";
  const weekEnd = week.at(-1)?.key || "";
  const normalizedTasks = useMemo(
    () => tasks.map((task) => ({ ...task, ...normalizeTaskSchedule(task) })),
    [tasks]
  );
  const allDayItems = useMemo(
    () =>
      normalizedTasks.filter(
        (task) =>
          isValidCalendarDate(task.dueDate) &&
          (task.isAllDay ||
            (isValidCalendarDate(task.endDate) && task.endDate > task.dueDate))
      ),
    [normalizedTasks]
  );
  const allDaySegments = useMemo(
    () =>
      assignMultiDayLanes(
        segmentMultiDayItems(allDayItems, weekStart, weekEnd, weekStartsOn)
      ),
    [allDayItems, weekEnd, weekStart, weekStartsOn]
  );
  const laneCount = Math.max(
    1,
    ...allDaySegments.map(({ lane }) => lane + 1)
  );
  const singleDayTimedTasks = useMemo(
    () =>
      normalizedTasks.filter(
        (task) =>
          !task.isAllDay &&
          (!isValidCalendarDate(task.endDate) || task.endDate <= task.dueDate)
      ),
    [normalizedTasks]
  );

  const createAllDay = (date) => {
    if (!onCreateTask) return;
    onSelectDate(date);
    onCreateTask(createCalendarTaskInitialValues({ date }));
  };

  const createTimed = (date, startTime) => {
    if (!onCreateTask) return;
    onSelectDate(date);
    onCreateTask(createCalendarTaskInitialValues({ date, startTime }));
  };

  return (
    <section className="calendar-time-view calendar-week-view" aria-label="Week view">
      <div className="calendar-time-view-scroll calendar-week-horizontal-scroll">
        <div className="calendar-week-surface">
          <div className="calendar-week-day-headings">
            <span aria-hidden="true" />
            {week.map(({ key }) => (
              <button
                className={`${key === selectedDateKey ? "is-selected" : ""} ${
                  key === todayKey ? "is-today" : ""
                }`}
                type="button"
                key={key}
                onClick={() => onSelectDate(key)}
              >
                {formatDay(key)}
              </button>
            ))}
          </div>

          <div
            className="calendar-all-day-section calendar-week-all-day"
            style={{ "--calendar-all-day-lanes": laneCount }}
          >
            <span className="calendar-all-day-label">All day</span>
            <div className="calendar-week-all-day-cells">
              {week.map(({ key }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => createAllDay(key)}
                  disabled={!onCreateTask}
                  aria-label={`Create an all-day task on ${formatDay(key)}`}
                />
              ))}
              <div className="calendar-week-all-day-events">
                {allDaySegments.map((segment) => (
                  <CalendarEvent
                    key={segment.segmentId}
                    task={segment}
                    segment={segment}
                    viewContext="week"
                    style={{
                      gridColumn: `${segment.startColumn + 1} / ${
                        segment.endColumn + 2
                      }`,
                      gridRow: segment.lane + 1,
                    }}
                    onClick={(event) => {
                      onSelectDate(segment.startDate);
                      onEditTask?.(segment, event.currentTarget);
                    }}
                    formatSettings={formatSettings}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="calendar-time-scroll">
            <div
              className="calendar-time-canvas calendar-week-time-canvas"
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
              <div className="calendar-week-time-columns">
                {week.map(({ key }) => {
                  const timedEvents = layoutCalendarDayEvents(
                    singleDayTimedTasks,
                    key
                  );
                  return (
                    <div className="calendar-time-day-column" key={key}>
                      {timeAxis.map(({ minutes, time }) => (
                        <button
                          className="calendar-time-slot"
                          type="button"
                          key={minutes}
                          onClick={() => createTimed(key, time)}
                          disabled={!onCreateTask}
                          aria-label={`Create a one-hour task on ${formatDay(key)} at ${formatTimeForDisplay(time, formatSettings.format)}`}
                        />
                      ))}
                      {timedEvents.map((task) => (
                        <CalendarEvent
                          key={task.id}
                          task={task}
                          viewContext="week"
                          displayTime={formatTimeForDisplay(
                            task.startTime,
                            formatSettings.format
                          )}
                          formatSettings={formatSettings}
                          style={timedEventStyle(task)}
                          onClick={(event) => {
                            onSelectDate(key);
                            onEditTask?.(task, event.currentTarget);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
