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
} from "../domain/calendarDomain";
import { localDateFromDateOnly } from "../domain/taskDomain";
import { formatTimeForDisplay } from "../domain/settingsDomain";
import { cx } from "../ui/cx";

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

/** Seven-day time grid with an all-day lane above the hour canvas. */
export function CalendarWeekView({
  tasks = [],
  selectedDateKey,
  todayKey,
  nowMinutes = null,
  onSelectDate,
  onCreateTask,
  onOpenTask,
  selectedTaskId = null,
  projectsById,
  weekStartsOn = 0,
  formatSettings = {},
}) {
  const week = useMemo(
    () => buildCalendarWeek(selectedDateKey, weekStartsOn),
    [selectedDateKey, weekStartsOn]
  );
  const timeAxis = useMemo(() => buildCalendarTimeAxis(), []);
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
  const laneCount = Math.max(1, ...allDaySegments.map(({ lane }) => lane + 1));
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
    onSelectDate?.(date);
    onCreateTask(createCalendarTaskInitialValues({ date }));
  };

  const createTimed = (date, startTime) => {
    if (!onCreateTask) return;
    onSelectDate?.(date);
    onCreateTask(createCalendarTaskInitialValues({ date, startTime }));
  };

  return (
    <section className="cal-timegrid cal-week" aria-label="Week view">
      <div className="cal-timegrid-scroll">
        <div className="cal-week-surface">
          <div className="cal-week-headings">
            <span className="cal-gutter" aria-hidden="true" />
            {week.map(({ key }) => (
              <button
                type="button"
                key={key}
                className={cx(
                  "cal-week-heading",
                  key === selectedDateKey && "is-selected",
                  key === todayKey && "is-today"
                )}
                aria-pressed={key === selectedDateKey}
                onClick={() => onSelectDate?.(key)}
              >
                {formatDay(key)}
              </button>
            ))}
          </div>

          <div className="cal-allday" style={{ "--cal-lane-count": laneCount }}>
            <span className="cal-gutter cal-allday-label">All day</span>
            <div className="cal-allday-cells">
              {week.map(({ key }) => (
                <button
                  type="button"
                  key={key}
                  className="cal-allday-cell"
                  disabled={!onCreateTask}
                  aria-label={`Add an all-day task on ${formatDay(key)}`}
                  onClick={() => createAllDay(key)}
                />
              ))}
              <div className="cal-allday-events">
                {allDaySegments.map((segment) => (
                  <CalendarEvent
                    key={segment.segmentId}
                    task={segment}
                    segment={segment}
                    viewContext="week"
                    projectsById={projectsById}
                    selected={selectedTaskId === segment.id}
                    formatSettings={formatSettings}
                    style={{
                      gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                      gridRow: segment.lane + 1,
                    }}
                    onClick={(event) => {
                      onSelectDate?.(segment.startDate);
                      onOpenTask?.(segment, event.currentTarget);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="cal-time-scroll">
            <div
              className="cal-time-canvas"
              style={{ height: calendarMinutesToPixels(1440, pixelsPerMinute) }}
            >
              <div className="cal-time-axis" aria-hidden="true">
                {timeAxis.map(({ minutes, label, time }) => (
                  <span key={minutes} style={{ top: calendarMinutesToPixels(minutes) }}>
                    {formatTimeForDisplay(time, formatSettings.format) || label}
                  </span>
                ))}
              </div>
              <div className="cal-hour-lines" aria-hidden="true">
                {timeAxis.map(({ minutes }) => (
                  <span key={minutes} style={{ top: calendarMinutesToPixels(minutes) }} />
                ))}
              </div>
              <div className="cal-week-columns">
                {week.map(({ key }) => {
                  const timedEvents = layoutCalendarDayEvents(singleDayTimedTasks, key);
                  return (
                    <div className="cal-day-column" key={key}>
                      {timeAxis.map(({ minutes, time }) => (
                        <button
                          type="button"
                          key={minutes}
                          className="cal-slot"
                          disabled={!onCreateTask}
                          aria-label={`Add a one-hour task on ${formatDay(key)} at ${formatTimeForDisplay(time, formatSettings.format)}`}
                          onClick={() => createTimed(key, time)}
                        />
                      ))}
                      {key === todayKey && nowMinutes !== null ? (
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
                          viewContext="week"
                          projectsById={projectsById}
                          selected={selectedTaskId === task.id}
                          displayTime={formatTimeForDisplay(
                            task.startTime,
                            formatSettings.format
                          )}
                          formatSettings={formatSettings}
                          style={timedEventStyle(task)}
                          onClick={(event) => {
                            onSelectDate?.(key);
                            onOpenTask?.(task, event.currentTarget);
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

export default CalendarWeekView;
