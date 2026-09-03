import { useMemo, useState } from "react";
import CalendarAgendaView from "../calendar/CalendarAgendaView";
import CalendarDayView from "../calendar/CalendarDayView";
import CalendarEvent from "../calendar/CalendarEvent";
import CalendarWeekView from "../calendar/CalendarWeekView";
import { QuickAdd, TaskRow } from "../tasks";
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  InlineNotice,
  SegmentedControl,
} from "../ui";
import {
  assignMultiDayLanes,
  buildCalendarWeek,
  createCalendarTaskInitialValues,
  groupCalendarAgenda,
  isValidCalendarDate,
  normalizeTaskSchedule,
  segmentMultiDayItems,
  shiftCalendarDate,
} from "../domain/calendarDomain";
import {
  buildCalendarMonthGrid,
  calendarMonthStart,
  dateOnlyKey,
  localDateFromDateOnly,
  shiftCalendarMonth,
} from "../domain/taskDomain";
import { normalizeGoogleCalendarEvents } from "../domain/googleCalendarDomain";

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

const chunkWeeks = (monthGrid) =>
  Array.from({ length: 6 }, (_, index) => monthGrid.slice(index * 7, index * 7 + 7));

const isMultiDayTask = (task) =>
  isValidCalendarDate(task.endDate) && task.endDate > task.dueDate;

const countLabel = (count) => `${count} ${count === 1 ? "task" : "tasks"}`;

/** Month / Week / Day / Agenda calendar over personal and assigned project work. */
export function CalendarPage({
  tasks = [],
  externalEvents = [],
  tasksLoading = false,
  tasksError = "",
  onRetry,
  taskActions = {},
  onOpenTask,
  selectedTaskId = null,
  onNewTask,
  formatSettings = {},
  weekStartsOn = 0,
  projects = [],
}) {
  const now = new Date();
  const todayKey = dateOnlyKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [visibleMonth, setVisibleMonth] = useState(() => calendarMonthStart(new Date()));
  const [view, setView] = useState("month");
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateOnlyKey(new Date()));
  const [mutationError, setMutationError] = useState("");

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const rowContext = useMemo(() => ({ projectsById }), [projectsById]);
  const monthGrid = useMemo(
    () => buildCalendarMonthGrid(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn]
  );
  const orderedWeekdayLabels = useMemo(
    () => [...weekdayLabels.slice(weekStartsOn), ...weekdayLabels.slice(0, weekStartsOn)],
    [weekStartsOn]
  );
  const weeks = useMemo(() => chunkWeeks(monthGrid), [monthGrid]);
  const externalCalendarItems = useMemo(
    () => normalizeGoogleCalendarEvents(externalEvents),
    [externalEvents]
  );
  const scheduledItems = useMemo(
    () =>
      [...tasks, ...externalCalendarItems]
        .map((task) => ({ ...task, ...normalizeTaskSchedule(task) }))
        .filter((task) => isValidCalendarDate(task.dueDate)),
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
  const pendingIds = taskActions.pendingIds;
  const rangeLabel =
    view === "month"
      ? formatMonth(visibleMonth)
      : view === "week"
        ? formatWeekRange(selectedDateKey, weekStartsOn)
        : view === "day"
          ? formatFullDate(selectedDateKey)
          : "Agenda";

  const selectDate = (dateKey) => {
    setSelectedDateKey(dateKey);
    const date = localDateFromDateOnly(dateKey);
    if (
      date &&
      (date.getFullYear() !== visibleMonth.getFullYear() ||
        date.getMonth() !== visibleMonth.getMonth())
    ) {
      setVisibleMonth(calendarMonthStart(date));
    }
  };

  const changePeriod = (amount) => {
    if (view === "month") {
      const nextMonth = shiftCalendarMonth(visibleMonth, amount);
      setVisibleMonth(nextMonth);
      setSelectedDateKey(dateOnlyKey(nextMonth));
      return;
    }
    const nextDate = shiftCalendarDate(selectedDateKey, view === "week" ? amount * 7 : amount);
    if (nextDate) selectDate(nextDate);
  };

  const returnToToday = () => {
    const today = new Date();
    setVisibleMonth(calendarMonthStart(today));
    setSelectedDateKey(dateOnlyKey(today));
  };

  const openTask = (task, triggerElement) => {
    if (task?.source === "google") {
      if (task.htmlLink) window.open(task.htmlLink, "_blank", "noopener,noreferrer");
      return;
    }
    onOpenTask?.(task, triggerElement);
  };

  const toggleComplete = async (task) => {
    if (task?.source === "google" || !taskActions.toggleComplete) return;
    setMutationError("");
    try {
      await taskActions.toggleComplete(task);
    } catch {
      setMutationError(`We couldn't update “${task.title}”. Try again.`);
    }
  };

  const createOnSelectedDate = async (title) => {
    if (!taskActions.createPersonal) return;
    setMutationError("");
    await taskActions.createPersonal({ title, dueDate: selectedDateKey });
  };

  const openComposerForDate = (initialValues = {}) => {
    if (!onNewTask) return;
    const dateValues = isValidCalendarDate(selectedDateKey)
      ? createCalendarTaskInitialValues({ date: selectedDateKey })
      : {};
    onNewTask({ ...dateValues, ...initialValues });
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
                  className={[
                    "cal-cell",
                    cell.inCurrentMonth ? "" : "is-outside",
                    selected ? "is-selected" : "",
                    cell.key === todayKey ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  role="gridcell"
                  aria-selected={selected}
                  key={cell.key}
                >
                  <button
                    type="button"
                    className="cal-cell-select"
                    aria-label={
                      dayItems.length
                        ? `${dayLabel}, ${countLabel(dayItems.length)}`
                        : dayLabel
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
                        projectsById={projectsById}
                        selected={selectedTaskId === task.id}
                        formatSettings={formatSettings}
                        onClick={(event) => {
                          setSelectedDateKey(cell.key);
                          openTask(task, event.currentTarget);
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
                    projectsById={projectsById}
                    selected={selectedTaskId === segment.id}
                    formatSettings={formatSettings}
                    style={{
                      gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                      gridRow: segment.lane + 1,
                    }}
                    onClick={(event) => {
                      setSelectedDateKey(segment.startDate);
                      openTask(segment, event.currentTarget);
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
          {selectedDateItems.map((task) => {
            const googleEvent = task.source === "google";
            return (
              <TaskRow
                key={task.id}
                task={task}
                context={rowContext}
                dense
                todayKey={todayKey}
                selected={selectedTaskId === task.id}
                busy={pendingIds?.has?.(task.id) || false}
                readOnly={googleEvent}
                formatSettings={formatSettings}
                onOpen={openTask}
                onToggleComplete={googleEvent ? undefined : toggleComplete}
              />
            );
          })}
        </div>
      )}

      <QuickAdd
        autoFocus={false}
        contextLabel={formatFullDate(selectedDateKey)}
        onCreate={createOnSelectedDate}
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
          projectsById={projectsById}
          pendingIds={pendingIds}
          formatSettings={formatSettings}
          onSelectDate={(dateKey) => {
            selectDate(dateKey);
            setView("day");
          }}
          onToggleComplete={toggleComplete}
          onOpenTask={openTask}
        />
      );
    }

    if (view === "week") {
      return (
        <CalendarWeekView
          tasks={scheduledItems}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          nowMinutes={nowMinutes}
          selectedTaskId={selectedTaskId}
          projectsById={projectsById}
          weekStartsOn={weekStartsOn}
          formatSettings={formatSettings}
          onSelectDate={selectDate}
          onCreateTask={onNewTask}
          onOpenTask={openTask}
        />
      );
    }

    if (view === "day") {
      return (
        <CalendarDayView
          tasks={scheduledItems}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          nowMinutes={nowMinutes}
          selectedTaskId={selectedTaskId}
          projectsById={projectsById}
          formatSettings={formatSettings}
          onCreateTask={onNewTask}
          onOpenTask={openTask}
        />
      );
    }

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
        {mutationError ? (
          <InlineNotice
            className="page-notice"
            tone="error"
            onDismiss={() => setMutationError("")}
          >
            {mutationError}
          </InlineNotice>
        ) : null}

        {tasksError ? (
          <InlineNotice
            className="page-notice"
            tone="error"
            action={
              onRetry ? (
                <Button size="sm" onClick={onRetry}>
                  Try again
                </Button>
              ) : null
            }
          >
            {tasksError}
          </InlineNotice>
        ) : null}

        {tasksLoading ? (
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

export default CalendarPage;
