import { useMemo, useRef, useState } from "react";
import TaskEditModal from "./TaskEditModal";
import TaskRow from "./TaskRow";
import {
  buildCalendarMonthGrid,
  calendarMonthStart,
  calendarTasks,
  calendarTasksByDate,
  dateOnlyKey,
  isTaskComplete,
  localDateFromDateOnly,
  shiftCalendarMonth,
  tasksForCalendarDate,
  tasksForCalendarMonth,
  upcomingCalendarTasks,
} from "./domain/taskDomain";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function CalendarPage({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
  onUpdateTask,
  onQuickUpdateTask,
  quickTaskPendingIds,
  onDeleteTask,
  onCreateTask,
  lists,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
}) {
  const now = new Date();
  const todayKey = dateOnlyKey(now);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    calendarMonthStart(now)
  );
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const editTriggerRef = useRef(null);

  const monthGrid = useMemo(
    () => buildCalendarMonthGrid(visibleMonth),
    [visibleMonth]
  );
  const datedTasks = useMemo(() => calendarTasks(tasks), [tasks]);
  const tasksByDate = useMemo(() => calendarTasksByDate(tasks), [tasks]);
  const selectedDateTasks = useMemo(
    () => tasksForCalendarDate(tasks, selectedDateKey),
    [selectedDateKey, tasks]
  );
  const visibleMonthTasks = useMemo(
    () => tasksForCalendarMonth(tasks, visibleMonth),
    [tasks, visibleMonth]
  );
  const upcomingTasks = useMemo(
    () => upcomingCalendarTasks(tasks, visibleMonth),
    [tasks, visibleMonth]
  );
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

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

  const changeMonth = (amount) => {
    const nextMonth = shiftCalendarMonth(visibleMonth, amount);
    setVisibleMonth(nextMonth);
    setSelectedDateKey(dateOnlyKey(nextMonth));
  };

  const returnToToday = () => {
    const currentDate = new Date();
    setVisibleMonth(calendarMonthStart(currentDate));
    setSelectedDateKey(dateOnlyKey(currentDate));
  };

  const openEditor = (task, triggerElement) => {
    editTriggerRef.current = triggerElement || null;
    setSelectedTaskId(task.id);
    setMutationError("");
  };

  const closeEditor = () => {
    setSelectedTaskId(null);
  };

  const handleCompletionChange = async (task) => {
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

  if (tasksLoading) {
    return (
      <section className="calendar-page">
        <div className="calendar-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h2>Loading calendar...</h2>
          <p>Your dated tasks are being retrieved from Firestore.</p>
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

  return (
    <section className="calendar-page" aria-labelledby="calendar-month-title">
      <header className="calendar-toolbar">
        <div>
          <p className="card-label">Schedule</p>
          <h2 id="calendar-month-title">{formatMonth(visibleMonth)}</h2>
          <p>
            {visibleMonthTasks.length} {visibleMonthTasks.length === 1 ? "task" : "tasks"} scheduled this month
          </p>
        </div>

        <div className="calendar-controls" aria-label="Calendar navigation">
          <button
            className="ghost-btn compact-btn"
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
          >
            ←
          </button>
          <button className="ghost-btn compact-btn" type="button" onClick={returnToToday}>
            Today
          </button>
          <button
            className="ghost-btn compact-btn"
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </header>

      {datedTasks.length === 0 && (
        <div className="calendar-no-tasks" role="status">
          <h3>No scheduled tasks yet</h3>
          <p>Tasks with a valid due date will appear on this calendar.</p>
          <button
            className="primary-btn"
            type="button"
            onClick={() => onCreateTask(selectedDateKey)}
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

      <div className="calendar-layout">
        <div className="calendar-grid-shell">
          <div className="calendar-weekdays" aria-hidden="true">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="calendar-grid" role="grid" aria-label={formatMonth(visibleMonth)}>
            {monthGrid.map((cell) => {
              const dateTasks = cell.inCurrentMonth
                ? tasksByDate.get(cell.key) || []
                : [];
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

                  {dateTasks.length > 0 && (
                    <div className="calendar-day-tasks">
                      {dateTasks.slice(0, 3).map((task) => (
                        <button
                          className={`calendar-task-chip ${
                            isTaskComplete(task) ? "is-completed" : ""
                          } priority-${task.priority}`}
                          type="button"
                          key={task.id}
                          onClick={(event) => {
                            setSelectedDateKey(cell.key);
                            openEditor(task, event.currentTarget);
                          }}
                          title={task.title}
                        >
                          <span aria-hidden="true" />
                          {task.title}
                        </button>
                      ))}
                      {dateTasks.length > 3 && (
                        <button
                          className="calendar-more-button"
                          type="button"
                          onClick={() => selectDate(cell.key)}
                        >
                          +{dateTasks.length - 3} more
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="calendar-agenda" aria-labelledby="calendar-selected-date">
          <header className="calendar-agenda-header">
            <div>
              <p className="card-label">Selected date</p>
              <h3 id="calendar-selected-date">{formatSelectedDate(selectedDateKey)}</h3>
              <p>
                {selectedDateTasks.length} {selectedDateTasks.length === 1 ? "task" : "tasks"}
              </p>
            </div>
            <button
              className="primary-btn compact-btn"
              type="button"
              onClick={() => onCreateTask(selectedDateKey)}
            >
              + Task
            </button>
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
                  onToggleCompletion={handleCompletionChange}
                  onEdit={openEditor}
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
                    onToggleCompletion={handleCompletionChange}
                    onEdit={openEditor}
                  />
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      {selectedTask && (
        <TaskEditModal
          key={selectedTask.id}
          task={selectedTask}
          lists={lists}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          onRetryProjects={onRetryProjects}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onClose={closeEditor}
          returnFocusElement={editTriggerRef.current}
        />
      )}
    </section>
  );
}
