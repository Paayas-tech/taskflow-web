import { useMemo, useRef, useState } from "react";
import CalendarAgendaView from "./CalendarAgendaView";
import CalendarDayView from "./CalendarDayView";
import CalendarEvent from "./CalendarEvent";
import CalendarWeekView from "./CalendarWeekView";
import TaskEditModal from "./TaskEditModal";
import TaskRow from "./TaskRow";
import {
  assignMultiDayLanes,
  clipDateRange,
  createCalendarTaskInitialValues,
  buildCalendarWeek,
  groupCalendarAgenda,
  isValidCalendarDate,
  normalizeTaskSchedule,
  segmentMultiDayItems,
  shiftCalendarDate,
} from "./domain/calendarDomain";
import {
  buildCalendarMonthGrid,
  calendarMonthStart,
  dateOnlyKey,
  isTaskComplete,
  localDateFromDateOnly,
  shiftCalendarMonth,
  upcomingCalendarTasks,
} from "./domain/taskDomain";
import { normalizeGoogleCalendarEvents } from "./domain/googleCalendarDomain";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const visibleEventLimit = 3;
const calendarViews = ["month", "week", "day", "agenda"];

const formatMonth = (date) =>
  new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);

const formatSelectedDate = (dateKey) => {
  const date = localDateFromDateOnly(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatCompactSelectedDate = (dateKey) => {
  const date = localDateFromDateOnly(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(date);
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
  Array.from({ length: 6 }, (_, index) =>
    monthGrid.slice(index * 7, index * 7 + 7)
  );

const isMultiDayTask = (task) =>
  isValidCalendarDate(task.endDate) && task.endDate > task.dueDate;

export default function CalendarPage({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
  onUpdateTask,
  onQuickUpdateTask,
  quickTaskPendingIds,
  onDeleteTask,
  onArchiveTask,
  onCreateTask,
  lists,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
  browserNotificationsEnabled,
  formatSettings = {},
  weekStartsOn = 0,
  onOpenTask,
  embedded = false,
  externalEvents = [],
}) {
  const now = new Date();
  const todayKey = dateOnlyKey(now);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    calendarMonthStart(now)
  );
  const [calendarView, setCalendarView] = useState("month");
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const editTriggerRef = useRef(null);

  const effectiveWeekStartsOn = embedded ? 1 : weekStartsOn;
  const monthGrid = useMemo(
    () => buildCalendarMonthGrid(visibleMonth, effectiveWeekStartsOn),
    [visibleMonth, effectiveWeekStartsOn]
  );
  const orderedWeekdayLabels = useMemo(
    () => [
      ...weekdayLabels.slice(effectiveWeekStartsOn),
      ...weekdayLabels.slice(0, effectiveWeekStartsOn),
    ],
    [effectiveWeekStartsOn]
  );
  const weeks = useMemo(() => chunkWeeks(monthGrid), [monthGrid]);
  const externalCalendarItems = useMemo(
    () => normalizeGoogleCalendarEvents(externalEvents),
    [externalEvents]
  );
  const calendarItems = useMemo(
    () => [...tasks, ...externalCalendarItems],
    [externalCalendarItems, tasks]
  );
  const normalizedTasks = useMemo(
    () =>
      calendarItems
        .map((task) => ({ ...task, ...normalizeTaskSchedule(task) }))
        .filter((task) => isValidCalendarDate(task.dueDate)),
    [calendarItems]
  );
  const agendaByDate = useMemo(
    () =>
      new Map(
        groupCalendarAgenda(normalizedTasks, { expandMultiDay: true }).map(
          ({ date, items }) => [date, items]
        )
      ),
    [normalizedTasks]
  );
  const selectedDateTasks = agendaByDate.get(selectedDateKey) || [];
  const gridStartDate = monthGrid[0]?.key || "";
  const gridEndDate = monthGrid.at(-1)?.key || "";
  const monthStartDate = dateOnlyKey(calendarMonthStart(visibleMonth));
  const monthEndDate = dateOnlyKey(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
  );
  const visibleMonthTasks = useMemo(
    () =>
      normalizedTasks.filter((task) =>
        clipDateRange(
          task.dueDate,
          task.endDate || task.dueDate,
          monthStartDate,
          monthEndDate
        )
      ),
    [monthEndDate, monthStartDate, normalizedTasks]
  );
  const positionedSegments = useMemo(
    () =>
      assignMultiDayLanes(
        segmentMultiDayItems(
          normalizedTasks.filter(isMultiDayTask),
          gridStartDate,
          gridEndDate,
          effectiveWeekStartsOn
        )
      ),
    [effectiveWeekStartsOn, gridEndDate, gridStartDate, normalizedTasks]
  );
  const segmentsByWeek = useMemo(() => {
    const grouped = new Map();
    positionedSegments.forEach((segment) => {
      const row = grouped.get(segment.rowKey) || [];
      row.push(segment);
      grouped.set(segment.rowKey, row);
    });
    return grouped;
  }, [positionedSegments]);
  const upcomingTasks = useMemo(
    () => upcomingCalendarTasks(normalizedTasks, visibleMonth),
    [normalizedTasks, visibleMonth]
  );
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const calendarTitle =
    calendarView === "month"
      ? formatMonth(visibleMonth)
      : calendarView === "week"
        ? formatWeekRange(selectedDateKey, weekStartsOn)
        : calendarView === "day"
          ? formatSelectedDate(selectedDateKey)
          : "Agenda";
  const calendarSummary =
    calendarView === "month"
      ? `${visibleMonthTasks.length} ${
          visibleMonthTasks.length === 1 ? "task" : "tasks"
        } scheduled this month`
      : calendarView === "week"
        ? "Seven-day schedule with all-day and timed tasks"
        : calendarView === "day"
          ? `${selectedDateTasks.length} ${
              selectedDateTasks.length === 1 ? "task" : "tasks"
            } on this date`
          : `${normalizedTasks.length} scheduled ${
              normalizedTasks.length === 1 ? "task" : "tasks"
            }`;

  const selectDate = (dateKey) => {
    setSelectedDateKey(dateKey);
    const selectedDate = localDateFromDateOnly(dateKey);
    if (
      selectedDate &&
      (selectedDate.getFullYear() !== visibleMonth.getFullYear() ||
        selectedDate.getMonth() !== visibleMonth.getMonth())
    ) {
      setVisibleMonth(calendarMonthStart(selectedDate));
    }
  };

  const createOnDate = (dateKey) => {
    if (!onCreateTask) return;
    setSelectedDateKey(dateKey);
    onCreateTask(createCalendarTaskInitialValues({ date: dateKey }));
  };

  const changeMonth = (amount) => {
    const nextMonth = shiftCalendarMonth(visibleMonth, amount);
    setVisibleMonth(nextMonth);
    setSelectedDateKey(dateOnlyKey(nextMonth));
  };

  const changeSelectedDate = (amount) => {
    const nextDate = shiftCalendarDate(selectedDateKey, amount);
    if (!nextDate) return;
    selectDate(nextDate);
  };

  const changePeriod = (amount) => {
    if (calendarView === "month") {
      changeMonth(amount);
      return;
    }

    changeSelectedDate(calendarView === "week" ? amount * 7 : amount);
  };

  const returnToToday = () => {
    const currentDate = new Date();
    setVisibleMonth(calendarMonthStart(currentDate));
    setSelectedDateKey(dateOnlyKey(currentDate));
  };

  const openEditor = (task, triggerElement) => {
    if (task.source === "google") {
      if (task.htmlLink) window.open(task.htmlLink, "_blank", "noopener,noreferrer");
      return;
    }
    if (!onUpdateTask) return;
    if (onOpenTask) {
      onOpenTask(task, triggerElement);
      return;
    }
    editTriggerRef.current = triggerElement || null;
    setSelectedTaskId(task.id);
    setMutationError("");
  };

  const closeEditor = () => {
    setSelectedTaskId(null);
  };

  const handleCompletionChange = async (task) => {
    if (task.source === "google") return;
    if (!onQuickUpdateTask) return;
    const completed = !isTaskComplete(task);
    setMutationError("");

    try {
      await onQuickUpdateTask(task.id, {
        completed,
        status: completed ? "completed" : "todo",
      });
    } catch (error) {
      console.error("Error updating task completion from Calendar:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”. Try again.`
      );
    }
  };

  const handleArchiveTask = async (task) => {
    if (!onArchiveTask) return;
    setMutationError("");
    try {
      await onArchiveTask(task.id);
    } catch (error) {
      console.error("Error archiving task from Calendar:", error);
      setMutationError(`We couldn't archive “${task.title}”. Try again.`);
    }
  };

  if (tasksLoading) {
    return (
      <section className="calendar-page">
        <div className="calendar-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h2>Loading calendar...</h2>
          <p>Your dated tasks are being retrieved securely.</p>
        </div>
      </section>
    );
  }

  if (tasksError) {
    return (
      <section className="calendar-page">
        <div className="calendar-state error-state" role="alert">
          <h2>Calendar unavailable</h2>
          <p>{tasksError}</p>
          <button className="ghost-btn" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (embedded) {
    const compactWeekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return (
      <section className="calendar-page calendar-compact" aria-labelledby="calendar-view-title">
        <header className="calendar-compact-header">
          <div className="calendar-compact-month-controls">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
            <h2 id="calendar-view-title">{formatMonth(visibleMonth)}</h2>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
          </div>
          <button className="calendar-compact-today" type="button" onClick={returnToToday}>Today</button>
        </header>

        {mutationError && (
          <div className="inline-error task-mutation-error" role="alert">
            <p>{mutationError}</p>
            <button className="ghost-btn compact-btn" type="button" onClick={() => setMutationError("")}>Dismiss</button>
          </div>
        )}

        <div className="calendar-compact-layout">
          <div className="calendar-compact-grid-shell">
            <div className="calendar-compact-weekdays" aria-hidden="true">
              {compactWeekdays.map((label) => <span key={label}><span>{label.slice(0, 3)}</span><span>{label}</span></span>)}
            </div>
            <div className="calendar-compact-grid" role="grid" aria-label={formatMonth(visibleMonth)}>
              {monthGrid.map((cell) => {
                const dateTasks = agendaByDate.get(cell.key) || [];
                const selected = cell.key === selectedDateKey;
                const isToday = cell.key === todayKey;
                const isPast = cell.key < todayKey;
                const className = [
                  "calendar-compact-day",
                  cell.inCurrentMonth ? "" : "is-outside",
                  selected ? "is-selected" : "",
                  isToday ? "is-today" : "",
                  isPast ? "is-past" : "",
                ].filter(Boolean).join(" ");
                return (
                  <button
                    type="button"
                    role="gridcell"
                    className={className}
                    aria-selected={selected}
                    aria-label={formatSelectedDate(cell.key) + (dateTasks.length ? ", " + dateTasks.length + " " + (dateTasks.length === 1 ? "task" : "tasks") : "")}
                    key={cell.key}
                    onClick={() => selectDate(cell.key)}
                  >
                    <span className="calendar-compact-date">{cell.day}</span>
                    {dateTasks.length > 0 && (
                      <span className="calendar-task-indicators" aria-hidden="true">
                        {Array.from({ length: Math.min(dateTasks.length, 3) }, (_, index) => <i key={index} />)}
                        {dateTasks.length > 3 && <small>+{dateTasks.length - 3}</small>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-compact-agenda" aria-labelledby="calendar-compact-selected-date">
            <header>
              <div><h3 id="calendar-compact-selected-date">{formatCompactSelectedDate(selectedDateKey)}</h3><span>{selectedDateTasks.length} {selectedDateTasks.length === 1 ? "task" : "tasks"}</span></div>
              {onCreateTask && <button type="button" onClick={() => createOnDate(selectedDateKey)}>+ Add task</button>}
            </header>
            {selectedDateTasks.length === 0 ? (
              <p className="calendar-compact-empty">No tasks for this day</p>
            ) : (
              <div className="calendar-compact-task-list">
                {selectedDateTasks.map((task) => {
                  const projectName = projects.find((project) => project.id === task.projectId)?.name;
                  const listName = lists.find((list) => list.id === task.listId)?.name;
                  return (
                    <article className="calendar-compact-task" key={task.id}>
                      {task.source === "google" ? <span className="calendar-compact-source" aria-label="Google Calendar event">G</span> : <button className={"calendar-compact-check" + (isTaskComplete(task) ? " is-complete" : "")} type="button" onClick={() => handleCompletionChange(task)} disabled={quickTaskPendingIds.has(task.id)} aria-label={(isTaskComplete(task) ? "Reopen " : "Complete ") + task.title}>{isTaskComplete(task) ? "✓" : ""}</button>}
                      <button className="calendar-compact-task-title" type="button" onClick={(event) => openEditor(task, event.currentTarget)}>{task.title}</button>
                      {task.source === "google" ? <span className="calendar-google-label">Google</span> : <span className={"priority priority-" + (task.priority || "medium")}>{task.priority || "medium"}</span>}
                      {(task.calendarName || projectName || listName) && <small>{task.calendarName || projectName || listName}</small>}
                    </article>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="calendar-page" aria-labelledby="calendar-view-title">
      <header className="calendar-toolbar">
        <div>
          <p className="card-label">Schedule</p>
          <h2 id="calendar-view-title">{calendarTitle}</h2>
          <p>{calendarSummary}</p>
        </div>

        {calendarView !== "agenda" && (
        <div className="calendar-controls" aria-label="Calendar navigation">
          <button
            className="ghost-btn compact-btn"
            type="button"
            onClick={() => changePeriod(-1)}
            aria-label={`Previous ${calendarView === "month" ? "month" : calendarView === "week" ? "week" : "day"}`}
          >
            ←
          </button>
          <button className="ghost-btn compact-btn" type="button" onClick={returnToToday}>
            Today
          </button>
          <button
            className="ghost-btn compact-btn"
            type="button"
            onClick={() => changePeriod(1)}
            aria-label={`Next ${calendarView === "month" ? "month" : calendarView === "week" ? "week" : "day"}`}
          >
            →
          </button>
        </div>
        )}
      </header>

      <div className="calendar-view-switcher" role="tablist" aria-label="Calendar view">
        {calendarViews.map((view) => (
          <button
            className={calendarView === view ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={calendarView === view}
            key={view}
            onClick={() => setCalendarView(view)}
          >
            {view[0].toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {normalizedTasks.length === 0 && calendarView !== "agenda" && (
        <div className="calendar-no-tasks" role="status">
          <h3>No scheduled tasks yet</h3>
          <p>Tasks with a valid due date will appear on this calendar.</p>
          <button
            className="primary-btn"
            type="button"
            onClick={() => createOnDate(selectedDateKey)}
          >
            Create a dated task
          </button>
        </div>
      )}

      {mutationError && (
        <div className="inline-error task-mutation-error" role="alert">
          <p>{mutationError}</p>
          <button
            className="ghost-btn compact-btn"
            type="button"
            onClick={() => setMutationError("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {calendarView === "agenda" ? (
        <CalendarAgendaView
          tasks={normalizedTasks}
          todayKey={todayKey}
          selectedTaskId={selectedTaskId}
          lists={lists}
          projects={projects}
          quickTaskPendingIds={quickTaskPendingIds}
          onSelectDate={selectDate}
          onToggleCompletion={handleCompletionChange}
          onEditTask={openEditor}
          onArchiveTask={handleArchiveTask}
          formatSettings={formatSettings}
        />
      ) : (
      <div className={`calendar-layout calendar-layout-${calendarView}`}>
        {calendarView === "month" ? (
          <div className="calendar-grid-shell">
          <div className="calendar-weekdays" aria-hidden="true">
            {orderedWeekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="calendar-grid" role="grid" aria-label={formatMonth(visibleMonth)}>
            {weeks.map((week) => {
              const rowKey = week[0].key;
              const rowSegments = segmentsByWeek.get(rowKey) || [];
              const visibleSegments = rowSegments.filter(
                ({ lane }) => lane < visibleEventLimit
              );
              const visibleLaneCount = Math.min(
                visibleEventLimit,
                Math.max(0, ...rowSegments.map(({ lane }) => lane + 1))
              );

              return (
                <div
                  className="calendar-week-row"
                  role="row"
                  key={rowKey}
                  style={{ "--calendar-lane-count": visibleLaneCount }}
                >
                  {week.map((cell) => {
                    const dateTasks = agendaByDate.get(cell.key) || [];
                    const singleDayTasks = dateTasks.filter(
                      (task) => !isMultiDayTask(task)
                    );
                    const coveringSegments = visibleSegments.filter(
                      (segment) =>
                        segment.startDate <= cell.key && segment.endDate >= cell.key
                    );
                    const availableSingleSlots = Math.max(
                      0,
                      visibleEventLimit - coveringSegments.length
                    );
                    const visibleSingleTasks = singleDayTasks.slice(
                      0,
                      availableSingleSlots
                    );
                    const hiddenCount = Math.max(
                      0,
                      dateTasks.length -
                        coveringSegments.length -
                        visibleSingleTasks.length
                    );
                    const selected = cell.key === selectedDateKey;
                    const isToday = cell.key === todayKey;

                    return (
                      <div
                        className={`calendar-day ${
                          cell.inCurrentMonth ? "" : "calendar-day-outside"
                        } ${selected ? "calendar-day-selected" : ""}`}
                        role="gridcell"
                        aria-selected={selected}
                        key={cell.key}
                      >
                        <button
                          className="calendar-day-create-area"
                          type="button"
                          onClick={() => createOnDate(cell.key)}
                          aria-label={`Create a task on ${formatSelectedDate(cell.key)}`}
                          title={`Create a task on ${formatSelectedDate(cell.key)}`}
                        />
                        <button
                          className={`calendar-date-button ${isToday ? "is-today" : ""}`}
                          type="button"
                          onClick={() => selectDate(cell.key)}
                          aria-label={`${formatSelectedDate(cell.key)}${
                            dateTasks.length
                              ? `, ${dateTasks.length} ${dateTasks.length === 1 ? "task" : "tasks"}`
                              : ""
                          }`}
                        >
                          {cell.day}
                        </button>

                        <div className="calendar-day-tasks">
                          {visibleSingleTasks.map((task) => (
                            <CalendarEvent
                              key={task.id}
                              task={task}
                              viewContext="month"
                              formatSettings={formatSettings}
                              onClick={(event) => {
                                setSelectedDateKey(cell.key);
                                openEditor(task, event.currentTarget);
                              }}
                            />
                          ))}
                          {hiddenCount > 0 && (
                            <button
                              className="calendar-more-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectDate(cell.key);
                              }}
                              aria-label={`Show ${hiddenCount} more tasks for ${formatSelectedDate(cell.key)} in the agenda`}
                              title="Show all tasks in the selected-date agenda"
                            >
                              +{hiddenCount} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {visibleSegments.length > 0 && (
                    <div className="calendar-multi-day-layer" aria-label="Multi-day tasks">
                      {visibleSegments.map((segment) => (
                        <CalendarEvent
                          key={segment.segmentId}
                          task={segment}
                          segment={segment}
                          viewContext="month"
                          formatSettings={formatSettings}
                          style={{
                            gridColumn: `${segment.startColumn + 1} / ${
                              segment.endColumn + 2
                            }`,
                            gridRow: segment.lane + 1,
                          }}
                          onClick={(event) => {
                            setSelectedDateKey(segment.startDate);
                            openEditor(segment, event.currentTarget);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        ) : calendarView === "week" ? (
          <CalendarWeekView
            tasks={normalizedTasks}
            selectedDateKey={selectedDateKey}
            onSelectDate={selectDate}
            onCreateTask={onCreateTask}
            onEditTask={openEditor}
            weekStartsOn={effectiveWeekStartsOn}
            formatSettings={formatSettings}
          />
        ) : (
          <CalendarDayView
            tasks={normalizedTasks}
            selectedDateKey={selectedDateKey}
            onCreateTask={onCreateTask}
            onEditTask={openEditor}
            formatSettings={formatSettings}
          />
        )}

        <aside className="calendar-agenda" aria-labelledby="calendar-selected-date">
          <header className="calendar-agenda-header">
            <div>
              <p className="card-label">Selected date</p>
              <h3 id="calendar-selected-date">{formatSelectedDate(selectedDateKey)}</h3>
              <p>
                {selectedDateTasks.length} {selectedDateTasks.length === 1 ? "task" : "tasks"}
              </p>
            </div>
            {onCreateTask && (
              <button className="primary-btn compact-btn" type="button" onClick={() => createOnDate(selectedDateKey)}>+ Task</button>
            )}
          </header>

          {selectedDateTasks.length === 0 ? (
            <div className="calendar-date-empty">
              <h4>No tasks on this date</h4>
              <p>Select another day or create a task for this date.</p>
            </div>
          ) : (
            <div className="tasks-page-list calendar-agenda-list">
              {selectedDateTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  lists={lists}
                  projects={projects}
                  completionBusy={quickTaskPendingIds.has(task.id)}
                  selected={selectedTaskId === task.id}
                  onToggleCompletion={onQuickUpdateTask ? handleCompletionChange : undefined}
                  onEdit={onUpdateTask ? openEditor : undefined}
                  onArchive={onArchiveTask ? handleArchiveTask : undefined}
                  formatSettings={formatSettings}
                />
              ))}
            </div>
          )}

          {upcomingTasks.length > 0 && (
            <section className="calendar-upcoming" aria-labelledby="calendar-upcoming-title">
              <header>
                <h4 id="calendar-upcoming-title">After {formatMonth(visibleMonth)}</h4>
                <span>{upcomingTasks.length}</span>
              </header>
              <div className="tasks-page-list calendar-upcoming-list">
                {upcomingTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    lists={lists}
                    projects={projects}
                    completionBusy={quickTaskPendingIds.has(task.id)}
                    selected={selectedTaskId === task.id}
                    onToggleCompletion={onQuickUpdateTask ? handleCompletionChange : undefined}
                    onEdit={onUpdateTask ? openEditor : undefined}
                    onArchive={onArchiveTask ? handleArchiveTask : undefined}
                    formatSettings={formatSettings}
                  />
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
      )}

      {!embedded && selectedTask && (
        <TaskEditModal
          key={selectedTask.id}
          task={selectedTask}
          lists={lists}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          onRetryProjects={onRetryProjects}
          browserNotificationsEnabled={browserNotificationsEnabled}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onArchiveTask={onArchiveTask}
          onClose={closeEditor}
          returnFocusElement={editTriggerRef.current}
        />
      )}
    </section>
  );
}
