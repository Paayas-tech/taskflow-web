import { useEffect, useMemo, useRef, useState } from "react";
import TaskEditModal from "./TaskEditModal";
import TaskRow from "./TaskRow";
import ProjectTaskQuickCreate from "./ProjectTaskQuickCreate";
import CalendarPage from "./CalendarPage";
import ProjectBoard from "./ProjectBoard";
import {
  dateOnlyKey,
  filterTasks,
  isTaskComplete,
} from "./domain/taskDomain";
import {
  mapPersonalTasksToBoard,
  personalTaskBoardColumns,
  personalTaskMoveUpdate,
} from "./domain/personalTaskBoardDomain";

export default function TasksPage({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
  onUpdateTask,
  onQuickUpdateTask,
  quickTaskPendingIds,
  onDeleteTask,
  onArchiveTask,
  onInlineCreateTask,
  onCreateScheduledTask,
  createTaskTriggerRef,
  openTaskRequest,
  filterRequest,
  lists,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
  browserNotificationsEnabled,
  formatSettings,
  weekStartsOn = 0,
  initialWorkspaceView = "list",
  onWorkspaceViewChange,
  externalCalendarEvents = [],
}) {
  const selectedListKey = "all";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [reminderFilter, setReminderFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [workspaceView, setWorkspaceView] = useState(initialWorkspaceView);
  const [boardQuickCreateColumnId, setBoardQuickCreateColumnId] = useState(null);
  const [sortBy, setSortBy] = useState("created");
  const [groupBy, setGroupBy] = useState("none");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const editTriggerRef = useRef(null);

  const knownListIds = useMemo(
    () => new Set(lists.map((list) => list.id)),
    [lists]
  );
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const personalBoardTasks = useMemo(
    () => mapPersonalTasksToBoard(tasks),
    [tasks]
  );

  useEffect(() => {
    setWorkspaceView(initialWorkspaceView);
  }, [initialWorkspaceView]);
  useEffect(() => {
    if (openTaskRequest?.id && tasks.some((task) => task.id === openTaskRequest.id)) {
      setSelectedTaskId(openTaskRequest.id);
    }
  }, [openTaskRequest, tasks]);
  useEffect(() => {
    if (!filterRequest?.request) return;
    setSearchQuery("");
    setStatusFilter(filterRequest.status || "all");
    setPriorityFilter(filterRequest.priority || "all");
    setDueDateFilter(filterRequest.due || "all");
    setReminderFilter("all");
    setCompletionFilter(filterRequest.completion || "all");
    setQuickFilter(filterRequest.quick || "all");
  }, [filterRequest]);
  const todayKey = dateOnlyKey(new Date());
  const quickFilterLabels = { all: "All tasks", today: "Today", upcoming: "Upcoming", completed: "Completed" };
  const activeListTitle = quickFilterLabels[quickFilter] || "All tasks";
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const queryFiltersActive =
    Boolean(normalizedSearch) ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    dueDateFilter !== "all" ||
    reminderFilter !== "all" ||
    completionFilter !== "all";
  const hasActiveFilters = queryFiltersActive || quickFilter !== "all";
  const filteredTasks = useMemo(
    () => {
      const baseTasks = filterTasks(tasks, {
        selectedListKey,
        knownListIds,
        searchTerm: normalizedSearch,
        status: statusFilter,
        priority: priorityFilter,
        dueDate: dueDateFilter,
        reminder: reminderFilter,
        completion: completionFilter,
        todayKey,
      });
      const quickFiltered = baseTasks.filter((task) => {
        if (quickFilter === "today") return task.dueDate === todayKey && !isTaskComplete(task);
        if (quickFilter === "upcoming") return Boolean(task.dueDate && task.dueDate > todayKey) && !isTaskComplete(task);
        if (quickFilter === "completed") return isTaskComplete(task);
        return true;
      });
      const priorityRank = { high: 0, medium: 1, low: 2 };
      return [...quickFiltered].sort((first, second) => {
        if (sortBy === "title") return first.title.localeCompare(second.title);
        if (sortBy === "priority") return (priorityRank[first.priority] ?? 1) - (priorityRank[second.priority] ?? 1);
        if (sortBy === "due") return (first.dueDate || "9999-12-31").localeCompare(second.dueDate || "9999-12-31");
        return String(second.createdAt || "").localeCompare(String(first.createdAt || ""));
      });
    },
    [
      completionFilter,
      dueDateFilter,
      knownListIds,
      normalizedSearch,
      priorityFilter,
      reminderFilter,
      selectedListKey,
      statusFilter,
      quickFilter,
      sortBy,
      tasks,
      todayKey,
    ]
  );

  const quickFilterCounts = useMemo(() => ({
    all: tasks.length,
    today: tasks.filter((task) => task.dueDate === todayKey && !isTaskComplete(task)).length,
    upcoming: tasks.filter((task) => Boolean(task.dueDate && task.dueDate > todayKey) && !isTaskComplete(task)).length,
    completed: tasks.filter(isTaskComplete).length,
  }), [tasks, todayKey]);

  const selectQuickFilter = (value) => {
    setQuickFilter(value);
    setStatusFilter("all");
    setDueDateFilter("all");
    setCompletionFilter("all");
  };

  const taskGroups = useMemo(() => {
    if (groupBy === "none") return [["All tasks", filteredTasks]];
    const groups = new Map();
    filteredTasks.forEach((task) => {
      let key = "Other";
      if (groupBy === "status") key = task.status === "in-progress" ? "In progress" : task.status === "completed" ? "Completed" : "To do";
      if (groupBy === "due") key = !task.dueDate ? "No due date" : task.dueDate < todayKey ? "Overdue" : task.dueDate === todayKey ? "Today" : "Upcoming";
      if (groupBy === "project") key = projects.find((project) => project.id === task.projectId)?.name || "No project";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    });
    return [...groups.entries()];
  }, [filteredTasks, groupBy, projects, todayKey]);

  const activeFilterLabels = useMemo(() => {
    const labels = [];

    if (normalizedSearch) labels.push(`Search: ${searchQuery.trim()}`);
    if (statusFilter !== "all") {
      const statusLabels = {
        todo: "To do",
        "in-progress": "In progress",
        completed: "Completed",
      };
      labels.push(`Status: ${statusLabels[statusFilter]}`);
    }
    if (priorityFilter !== "all") {
      labels.push(
        `Priority: ${priorityFilter[0].toUpperCase()}${priorityFilter.slice(1)}`
      );
    }
    if (dueDateFilter !== "all") {
      labels.push(
        `Due: ${dueDateFilter[0].toUpperCase()}${dueDateFilter.slice(1)}`
      );
    }
    if (reminderFilter === "enabled") labels.push("Reminder: Enabled");
    if (completionFilter !== "all") {
      labels.push(
        completionFilter === "active" ? "Active tasks" : "Completed tasks"
      );
    }

    return labels;
  }, [
    completionFilter,
    dueDateFilter,
    normalizedSearch,
    priorityFilter,
    reminderFilter,
    searchQuery,
    statusFilter,
  ]);

  const openEditor = (task, triggerElement) => {
    editTriggerRef.current = triggerElement || null;
    setSelectedTaskId(task.id);
    setMutationError("");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setDueDateFilter("all");
    setReminderFilter("all");
    setCompletionFilter("all");
    setQuickFilter("all");
  };

  const closeEditor = () => {
    setSelectedTaskId(null);
  };

  const moveBoardTask = async (placements) => {
    const update = personalTaskMoveUpdate(personalBoardTasks, placements);
    if (!update) return;
    setMutationError("");
    try {
      await onQuickUpdateTask(update.taskId, update.changes);
    } catch (error) {
      console.error("Error moving personal task:", error);
      setMutationError("We couldn't move this task. Check your connection and try again.");
    }
  };

  const handleArchiveTask = async (task) => {
    setMutationError("");
    try {
      await onArchiveTask(task.id);
    } catch (error) {
      console.error("Error archiving task from Tasks:", error);
      setMutationError(`We couldn't archive “${task.title}”. Try again.`);
    }
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
      console.error("Error updating task completion:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”. Try again.`
      );
    }
  };

  return (
    <section className={`tasks-page${selectedTask ? " has-task-panel" : ""}`} aria-labelledby="tasks-page-title">
      <div className="tasks-workspace">
        <div className="tasks-content">
          <div className="tasks-page-header">
            <div>
              <p className="card-label">Task workspace</p>
              <h2 id="tasks-page-title">{activeListTitle}</h2>
              <p>Review and update your tasks.</p>
            </div>
            {!tasksLoading && !tasksError && (
              <div className="tasks-page-header-actions">
                <span className="tasks-count">
                  {filteredTasks.length} {filteredTasks.length === 1 ? "result" : "results"}
                </span>
                <button
                  ref={createTaskTriggerRef}
                  className="primary-btn compact-btn"
                  type="button"
                  onClick={() => setQuickCreateOpen(true)}
                  aria-expanded={quickCreateOpen}
                  aria-controls="personal-task-quick-create"
                  hidden={quickCreateOpen}
                >
                  + Add task
                </button>
              </div>
            )}
          </div>

          <nav className="tasks-view-tabs" aria-label="Task views">
            <button type="button" className={workspaceView === "list" ? "active" : ""} aria-current={workspaceView === "list" ? "page" : undefined} onClick={() => { setWorkspaceView("list"); onWorkspaceViewChange?.("list"); }}>List</button>
            <button type="button" className={workspaceView === "board" ? "active" : ""} aria-current={workspaceView === "board" ? "page" : undefined} onClick={() => { setWorkspaceView("board"); onWorkspaceViewChange?.("board"); }}>Board</button>
            <button type="button" className={workspaceView === "calendar" ? "active" : ""} aria-current={workspaceView === "calendar" ? "page" : undefined} onClick={() => { setWorkspaceView("calendar"); onWorkspaceViewChange?.("calendar"); }}>Calendar</button>
          </nav>

          {workspaceView === "board" ? (
            <div className="personal-task-board">
              <ProjectBoard
                columns={personalTaskBoardColumns}
                tasks={personalBoardTasks}
                onMoveTasks={moveBoardTask}
                onEditTask={openEditor}
                quickCreateColumnId={boardQuickCreateColumnId}
                onStartQuickCreate={(column) => setBoardQuickCreateColumnId(column.id)}
                onQuickCreate={async (title, column) => {
                  await onInlineCreateTask(title, {
                    status: column.id,
                    completed: column.id === "completed",
                  });
                  setBoardQuickCreateColumnId(null);
                }}
                onCancelQuickCreate={() => setBoardQuickCreateColumnId(null)}
                collapsible
                initiallyCollapsedColumnIds={["completed"]}
              />
            </div>
          ) : workspaceView === "calendar" ? (
            <div className="tasks-embedded-calendar">
              <CalendarPage
                tasks={tasks}
                tasksLoading={tasksLoading}
                tasksError={tasksError}
                onRetry={onRetry}
                onUpdateTask={onUpdateTask}
                onQuickUpdateTask={onQuickUpdateTask}
                quickTaskPendingIds={quickTaskPendingIds}
                onDeleteTask={onDeleteTask}
                onArchiveTask={onArchiveTask}
                onCreateTask={onCreateScheduledTask}
                onOpenTask={openEditor}
                lists={lists}
                projects={projects}
                projectsLoading={projectsLoading}
                projectsError={projectsError}
                onRetryProjects={onRetryProjects}
                browserNotificationsEnabled={browserNotificationsEnabled}
                formatSettings={formatSettings}
                weekStartsOn={weekStartsOn}
                embedded
                externalEvents={externalCalendarEvents}
              />
            </div>
          ) : <>

          <div className="tasks-quick-filters" role="tablist" aria-label="Task date filters">
            {[
              ["all", "All tasks"],
              ["today", "Today"],
              ["upcoming", "Upcoming"],
              ["completed", "Completed"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={quickFilter === value}
                className={quickFilter === value ? "active" : ""}
                onClick={() => selectQuickFilter(value)}
              >
                {label}<span>{quickFilterCounts[value]}</span>
              </button>
            ))}
          </div>

          <section className="task-filters" aria-label="Search and filter tasks">
            <div className="task-filter-toolbar">
              <label className="task-search-control">
                <span>Search</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search task titles or descriptions"
                  aria-describedby="task-filter-results"
                />
              </label>

              <div className="task-filter-actions">
                <label className="task-toolbar-select">
                  <span className="sr-only">Sort tasks</span>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort tasks">
                    <option value="created">Sort: Created</option>
                    <option value="due">Sort: Due date</option>
                    <option value="priority">Sort: Priority</option>
                    <option value="title">Sort: Title</option>
                  </select>
                </label>

                <label className="task-toolbar-select">
                  <span className="sr-only">Group tasks</span>
                  <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)} aria-label="Group tasks">
                    <option value="none">Group: None</option>
                    <option value="status">Group: Status</option>
                    <option value="due">Group: Due date</option>
                    <option value="project">Group: Project</option>
                  </select>
                </label>

                {hasActiveFilters && (
                  <button
                    className="ghost-btn compact-btn task-filter-clear"
                    type="button"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            <div
              className={`task-filter-results ${hasActiveFilters ? "has-filters" : ""}`}
              id="task-filter-results"
              aria-live="polite"
            >
              <p>
                Showing <strong>{filteredTasks.length}</strong> of {tasks.length}{" "}
                {tasks.length === 1 ? "task" : "tasks"}
              </p>
              {activeFilterLabels.length > 0 && (
                <div className="active-filter-list" aria-label="Active filters">
                  {activeFilterLabels.map((label) => (
                    <span className="active-filter-chip" key={label}>
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {mutationError && (
            <div className="inline-error task-mutation-error" role="alert">
              <p>{mutationError}</p>
              <button className="ghost-btn compact-btn" onClick={() => setMutationError("")}>
                Dismiss
              </button>
            </div>
          )}

          {!tasksLoading && !tasksError && quickCreateOpen && (
            <div className="tasks-inline-create" id="personal-task-quick-create">
              <ProjectTaskQuickCreate
                contextLabel="My tasks"
                variant="list"
                onCreate={async (title) => {
                  await onInlineCreateTask(title);
                  setQuickCreateOpen(false);
                }}
                onCancel={() => {
                  setQuickCreateOpen(false);
                  window.requestAnimationFrame(() => createTaskTriggerRef?.current?.focus());
                }}
              />
            </div>
          )}

          {tasksLoading ? (
            <div className="tasks-state" role="status" aria-live="polite">
              <div className="state-spinner" aria-hidden="true" />
              <h3>Loading tasks...</h3>
              <p>Loading tasks…</p>
            </div>
          ) : tasksError ? (
            <div className="tasks-state error-state" role="alert">
              <h3>Tasks unavailable</h3>
              <p>{tasksError}</p>
              <button className="ghost-btn" onClick={onRetry}>Try again</button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="tasks-state">
              <h3>
                {tasks.length === 0
                  ? "No tasks yet"
                  : queryFiltersActive || quickFilter !== "all"
                    ? "No matching tasks"
                    : `No tasks in ${activeListTitle}`}
              </h3>
              <p>
                {tasks.length === 0
                  ? "Use + Add task above to create your first task."
                  : queryFiltersActive || quickFilter !== "all"
                    ? `No tasks are currently in ${activeListTitle}.`
                    : "Assign a task to this list or choose another list."}
              </p>
              {hasActiveFilters && (
                <button className="ghost-btn" type="button" onClick={clearFilters}>
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="tasks-page-list">
              {taskGroups.map(([groupName, groupTasks]) => (
                <section className="tasks-list-group" key={groupName} aria-label={groupName}>
                  {groupBy !== "none" && <h3>{groupName}<span>{groupTasks.length}</span></h3>}
                  {groupTasks.map((task) => {
                const completionBusy = quickTaskPendingIds.has(task.id);

                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    lists={lists}
                    projects={projects}
                    completionBusy={completionBusy}
                    selected={selectedTaskId === task.id}
                    onToggleCompletion={handleCompletionChange}
                    onEdit={openEditor}
                    onArchive={handleArchiveTask}
                    formatSettings={formatSettings}
                    workspace
                  />
                );
                  })}
                </section>
              ))}
            </div>
          )}
          </>}
        </div>
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
          browserNotificationsEnabled={browserNotificationsEnabled}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onArchiveTask={onArchiveTask}
          onClose={closeEditor}
          returnFocusElement={editTriggerRef.current}
          presentation="panel"
        />
      )}

    </section>
  );
}
