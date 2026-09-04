import { useMemo } from "react";
import { CalendarEvent } from "./CalendarEvent";
import {
  assignMultiDayLanes,
  buildCalendarTimeAxis,
  buildCalendarWeek,
  calendarMinutesToPixels,
  createCalendarTaskInitialValues,
  layoutCalendarDayEvents,
  segmentMultiDayItems,
} from "../domain/calendar";
import {
  isValidDateOnly,
  localDateFromDateOnly,
  normalizeTaskSchedule,
} from "../domain/task";
import { formatTimeForDisplay } from "../domain/settings";
import { selectSettings } from "../store/selectors";
import { useStore } from "../store/store";
import { cx } from "../ui";

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
  weekStartsOn = 0,
}) {
  const { time } = useStore(selectSettings);
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
          isValidDateOnly(task.dueDate) &&
          (task.isAllDay ||
            (isValidDateOnly(task.endDate) && task.endDate > task.dueDate))
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
          (!isValidDateOnly(task.endDate) || task.endDate <= task.dueDate)
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
                    selected={selectedTaskId === segment.id}
                    style={{
                      gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                      gridRow: segment.lane + 1,
                    }}
                    onClick={() => {
                      onSelectDate?.(segment.startDate);
                      onOpenTask?.(segment);
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
              <div className="cal-week-columns">
                {week.map(({ key }) => {
                  const timedEvents = layoutCalendarDayEvents(singleDayTimedTasks, key);
                  return (
                    <div className="cal-day-column" key={key}>
                      {timeAxis.map(({ minutes, time: slotTime }) => (
                        <button
                          type="button"
                          key={minutes}
                          className="cal-slot"
                          disabled={!onCreateTask}
                          aria-label={`Add a one-hour task on ${formatDay(key)} at ${formatTimeForDisplay(slotTime, time.format)}`}
                          onClick={() => createTimed(key, slotTime)}
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
                          selected={selectedTaskId === task.id}
                          displayTime={formatTimeForDisplay(task.startTime, time.format)}
                          style={timedEventStyle(task)}
                          onClick={() => {
                            onSelectDate?.(key);
                            onOpenTask?.(task);
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
