/**
 * Month / Week / Day / Agenda calendar over everything assigned to me, plus the
 * read-only mirror of a connected Google Calendar. Reads its data from the
 * store; the view, the visible month and the selected day are local UI state.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarAgendaView } from "../calendar/CalendarAgendaView";
import { CalendarDayView } from "../calendar/CalendarDayView";
import { CalendarEvent } from "../calendar/CalendarEvent";
import { CalendarWeekView } from "../calendar/CalendarWeekView";
import { QuickAdd } from "../tasks/QuickAdd";
import { TaskRow } from "../tasks/TaskRow";
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  InlineNotice,
  SegmentedControl,
  cx,
} from "../ui";
import {
  assignMultiDayLanes,
  buildCalendarMonthGrid,
  buildCalendarWeek,
  calendarMonthStart,
  createCalendarTaskInitialValues,
  groupCalendarAgenda,
  normalizeGoogleCalendarEvents,
  segmentMultiDayItems,
  shiftCalendarMonth,
} from "../domain/calendar";
import {
  dateOnlyKey,
  isValidDateOnly,
  localDateFromDateOnly,
  normalizeTaskSchedule,
  shiftDateOnly,
} from "../domain/task";
import { loadGoogleEvents } from "../store/calendar";
import { loadTasks } from "../store/session";
import {
  selectGoogleEvents,
  selectMyTasks,
  selectSelectedTaskId,
  selectTasksError,
  selectTasksStatus,
  selectWeekStartsOn,
} from "../store/selectors";
import { useStore } from "../store/store";
import { createTask } from "../store/tasks";
import { openComposer, openTask } from "../store/ui";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const visibleEventLimit = 3;
const viewOptions = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];
const periodNoun = { month: "month", week: "week", day: "day" };

const formatMonth = (date) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);

const formatFullDate = (dateKey) => {
  const date = localDateFromDateOnly(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatWeekRange = (dateKey, weekStartsOn) => {
  const week = buildCalendarWeek(dateKey, weekStartsOn);
  if (!week.length) return "Week";

  const start = week[0].date;
  const end = week.at(-1).date;
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(sameMonth ? {} : { year: "numeric" }),
  }).format(start);
  const endLabel = new Intl.DateTimeFormat(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  }).format(end);
  return `${startLabel}–${endLabel}`;
};

const isMultiDayTask = (task) =>
  isValidDateOnly(task.endDate) && task.endDate > task.dueDate;

const countLabel = (count) => `${count} ${count === 1 ? "task" : "tasks"}`;

const isGoogleEvent = (item) => item?.source === "google";

/** Month / Week / Day / Agenda calendar over personal and assigned project work. */
export function CalendarPage() {
  const tasks = useStore(selectMyTasks);
  const googleEvents = useStore(selectGoogleEvents);
  const selectedTaskId = useStore(selectSelectedTaskId);
  const tasksStatus = useStore(selectTasksStatus);
  const tasksError = useStore(selectTasksError);
  const weekStartsOn = useStore(selectWeekStartsOn);

  const now = new Date();
  const todayKey = dateOnlyKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [visibleMonth, setVisibleMonth] = useState(() => calendarMonthStart(new Date()));
  const [view, setView] = useState("month");
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateOnlyKey(new Date()));

  useEffect(() => {
    void loadGoogleEvents();
  }, []);

  const monthGrid = useMemo(
    () => buildCalendarMonthGrid(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn]
  );
  const orderedWeekdayLabels = useMemo(
    () => [...weekdayLabels.slice(weekStartsOn), ...weekdayLabels.slice(0, weekStartsOn)],
    [weekStartsOn]
  );
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, index) => monthGrid.slice(index * 7, index * 7 + 7)),
    [monthGrid]
  );
  const externalCalendarItems = useMemo(
    () => normalizeGoogleCalendarEvents(googleEvents),
    [googleEvents]
  );
  const scheduledItems = useMemo(
    () =>
      [...tasks, ...externalCalendarItems]
        .map((task) => ({ ...task, ...normalizeTaskSchedule(task) }))
        .filter((task) => isValidDateOnly(task.dueDate)),
    [externalCalendarItems, tasks]
  );
  const agendaByDate = useMemo(
    () =>
      new Map(
        groupCalendarAgenda(scheduledItems, { expandMultiDay: true }).map(
          ({ date, items }) => [date, items]
        )
      ),
    [scheduledItems]
  );
  const gridStartDate = monthGrid[0]?.key || "";
  const gridEndDate = monthGrid.at(-1)?.key || "";
  const segmentsByWeek = useMemo(() => {
    const positioned = assignMultiDayLanes(
      segmentMultiDayItems(
        scheduledItems.filter(isMultiDayTask),
        gridStartDate,
        gridEndDate,
        weekStartsOn
      )
    );
    const grouped = new Map();
    positioned.forEach((segment) => {
      const row = grouped.get(segment.rowKey) || [];
      row.push(segment);
      grouped.set(segment.rowKey, row);
    });
    return grouped;
  }, [gridEndDate, gridStartDate, scheduledItems, weekStartsOn]);

  const selectedDateItems = agendaByDate.get(selectedDateKey) || [];
  const rangeLabel = {
    month: () => formatMonth(visibleMonth),
    week: () => formatWeekRange(selectedDateKey, weekStartsOn),
    day: () => formatFullDate(selectedDateKey),
    agenda: () => "Agenda",
  }[view]();

  const selectDate = (dateKey) => {
    setSelectedDateKey(dateKey);
    const date = localDateFromDateOnly(dateKey);
    const month = date ? calendarMonthStart(date) : null;
    if (month && month.getTime() !== visibleMonth.getTime()) setVisibleMonth(month);
  };

  const changePeriod = (amount) => {
    if (view === "month") {
      const nextMonth = shiftCalendarMonth(visibleMonth, amount);
      setVisibleMonth(nextMonth);
      setSelectedDateKey(dateOnlyKey(nextMonth));
      return;
    }
    const nextDate = shiftDateOnly(selectedDateKey, view === "week" ? amount * 7 : amount);
    if (nextDate) selectDate(nextDate);
  };

  const returnToToday = () => {
    const today = new Date();
    setVisibleMonth(calendarMonthStart(today));
    setSelectedDateKey(dateOnlyKey(today));
  };

  /** Google events open in Google Calendar; everything else opens the panel. */
  const openItem = (item) => {
    if (isGoogleEvent(item)) {
      if (item.htmlLink) window.open(item.htmlLink, "_blank", "noopener,noreferrer");
      return;
    }
    openTask(item.id);
  };

  const openComposerForDate = (initialValues = {}) => {
    const dateValues = isValidDateOnly(selectedDateKey)
      ? createCalendarTaskInitialValues({ date: selectedDateKey })
      : {};
    openComposer({ ...dateValues, ...initialValues });
  };

  const renderMonthGrid = () => (
    <div className="cal-grid" role="grid" aria-label={formatMonth(visibleMonth)}>
      <div className="cal-weekdays" role="row">
        {orderedWeekdayLabels.map((label) => (
          <span className="cal-weekday" role="columnheader" key={label}>
            {label}
          </span>
        ))}
      </div>

      {weeks.map((week) => {
        const rowKey = week[0].key;
        const rowSegments = segmentsByWeek.get(rowKey) || [];
        const visibleSegments = rowSegments.filter(({ lane }) => lane < visibleEventLimit);
        const laneCount = Math.min(
          visibleEventLimit,
          Math.max(0, ...rowSegments.map(({ lane }) => lane + 1))
        );

        return (
          <div
            className="cal-week-row"
            role="row"
            key={rowKey}
            style={{ "--cal-lane-count": laneCount }}
          >
            {week.map((cell) => {
              const dayItems = agendaByDate.get(cell.key) || [];
              const singleDayItems = dayItems.filter((task) => !isMultiDayTask(task));
              const coveringSegments = visibleSegments.filter(
                (segment) => segment.startDate <= cell.key && segment.endDate >= cell.key
              );
              const openSlots = Math.max(0, visibleEventLimit - coveringSegments.length);
              const visibleItems = singleDayItems.slice(0, openSlots);
              const hiddenCount = Math.max(
                0,
                dayItems.length - coveringSegments.length - visibleItems.length
              );
              const selected = cell.key === selectedDateKey;
              const dayLabel = formatFullDate(cell.key);

              return (
                <div
                  className={cx(
                    "cal-cell",
                    !cell.inCurrentMonth && "is-outside",
                    selected && "is-selected",
                    cell.key === todayKey && "is-today"
                  )}
                  role="gridcell"
                  aria-selected={selected}
                  key={cell.key}
                >
                  <button
                    type="button"
                    className="cal-cell-select"
                    aria-label={
                      dayItems.length ? `${dayLabel}, ${countLabel(dayItems.length)}` : dayLabel
                    }
                    onClick={() => selectDate(cell.key)}
                  />
                  <span className="cal-daynum" aria-hidden="true">
                    {cell.day}
                  </span>

                  <div className="cal-cell-events">
                    {visibleItems.map((task) => (
                      <CalendarEvent
                        key={task.id}
                        task={task}
                        viewContext="month"
                        selected={selectedTaskId === task.id}
                        onClick={() => {
                          setSelectedDateKey(cell.key);
                          openItem(task);
                        }}
                      />
                    ))}
                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        className="cal-more"
                        aria-label={`Show ${hiddenCount} more on ${dayLabel}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectDate(cell.key);
                        }}
                      >
                        {`+${hiddenCount} more`}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {visibleSegments.length > 0 ? (
              <div className="cal-multiday" role="presentation">
                {visibleSegments.map((segment) => (
                  <CalendarEvent
                    key={segment.segmentId}
                    task={segment}
                    segment={segment}
                    viewContext="month"
                    selected={selectedTaskId === segment.id}
                    style={{
                      gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                      gridRow: segment.lane + 1,
                    }}
                    onClick={() => {
                      setSelectedDateKey(segment.startDate);
                      openItem(segment);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const renderDayAgenda = () => (
    <aside className="cal-agenda" aria-labelledby="cal-agenda-title">
      <header className="cal-agenda-header">
        <h2 className="cal-agenda-title" id="cal-agenda-title">
          {formatFullDate(selectedDateKey)}
        </h2>
        <p className="cal-agenda-count muted">{countLabel(selectedDateItems.length)}</p>
      </header>

      {selectedDateItems.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Nothing on this day"
          description="Add a task below or pick another day."
        />
      ) : (
        <div className="row-list">
          {selectedDateItems.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              dense
              todayKey={todayKey}
              selected={selectedTaskId === task.id}
              readOnly={isGoogleEvent(task)}
              onOpen={openItem}
            />
          ))}
        </div>
      )}

      <QuickAdd
        autoFocus={false}
        contextLabel={formatFullDate(selectedDateKey)}
        onCreate={(title) => createTask({ title, dueDate: selectedDateKey })}
        onOpenDetails={(title) => openComposerForDate({ title })}
      />
    </aside>
  );

  const renderBody = () => {
    if (view === "agenda") {
      return (
        <CalendarAgendaView
          tasks={scheduledItems}
          todayKey={todayKey}
          selectedTaskId={selectedTaskId}
          onSelectDate={(dateKey) => {
            selectDate(dateKey);
            setView("day");
          }}
          onOpenTask={openItem}
        />
      );
    }

    // Week and Day are the same time grid over a different span.
    const timeGridProps = {
      tasks: scheduledItems,
      selectedDateKey,
      todayKey,
      nowMinutes,
      selectedTaskId,
      onCreateTask: openComposer,
      onOpenTask: openItem,
    };

    if (view === "week") {
      return (
        <CalendarWeekView
          {...timeGridProps}
          weekStartsOn={weekStartsOn}
          onSelectDate={selectDate}
        />
      );
    }

    if (view === "day") return <CalendarDayView {...timeGridProps} />;

    return (
      <div className="cal-layout">
        {renderMonthGrid()}
        {renderDayAgenda()}
      </div>
    );
  };

  return (
    <section className="page calendar-page">
      <header className="page-header">
        <h1 className="page-title">Calendar</h1>

        <SegmentedControl
          className="cal-views"
          ariaLabel="Calendar view"
          options={viewOptions}
          value={view}
          onChange={setView}
        />

        <div className="page-actions">
          <Button size="sm" onClick={returnToToday}>
            Today
          </Button>
          {view === "agenda" ? null : (
            <span className="cal-nav">
              <IconButton
                size="sm"
                label={`Previous ${periodNoun[view]}`}
                onClick={() => changePeriod(-1)}
              >
                <Icon name="chevron-left" />
              </IconButton>
              <IconButton
                size="sm"
                label={`Next ${periodNoun[view]}`}
                onClick={() => changePeriod(1)}
              >
                <Icon name="chevron-right" />
              </IconButton>
            </span>
          )}
          <span className="cal-range">{rangeLabel}</span>
          <Button
            variant="primary"
            size="sm"
            icon={<Icon name="plus" size={14} />}
            onClick={() => openComposerForDate()}
          >
            New task
          </Button>
        </div>
      </header>

      <div className="page-body cal-body">
        {tasksError ? (
          <InlineNotice
            className="page-notice"
            tone="error"
            action={
              <Button size="sm" onClick={() => loadTasks()}>
                Try again
              </Button>
            }
          >
            {tasksError}
          </InlineNotice>
        ) : null}

        {tasksStatus === "loading" && tasks.length === 0 ? (
          <div className="cal-loading" role="status" aria-label="Loading calendar">
            <span className="skeleton cal-skeleton" />
            <span className="skeleton cal-skeleton" />
            <span className="skeleton cal-skeleton" />
          </div>
        ) : (
          renderBody()
        )}
      </div>
    </section>
  );
}
