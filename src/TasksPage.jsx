import { useEffect, useMemo, useRef, useState } from "react";
import TaskEditModal from "./TaskEditModal";
import TaskListsPanel from "./TaskListsPanel";
import TaskRow from "./TaskRow";
import {
  dateOnlyKey,
  filterTasks,
  isTaskComplete,
} from "./domain/taskDomain";

export default function TasksPage({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
  onUpdateTask,
  onQuickUpdateTask,
  quickTaskPendingIds,
  onDeleteTask,
  lists,
  listsLoading,
  listsError,
  onRetryLists,
  onCreateList,
  onRenameList,
  onDeleteList,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
}) {
  const [selectedListKey, setSelectedListKey] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [reminderFilter, setReminderFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const editTriggerRef = useRef(null);

  const knownListIds = useMemo(
    () => new Set(lists.map((list) => list.id)),
    [lists]
  );
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const selectedList = lists.find((list) => list.id === selectedListKey);
  const activeListTitle =
    selectedListKey === "all"
      ? "All tasks"
      : selectedListKey === "inbox"
        ? "Inbox"
        : selectedList?.name || "All tasks";
  const todayKey = dateOnlyKey(new Date());
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const queryFiltersActive =
    Boolean(normalizedSearch) ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    dueDateFilter !== "all" ||
    reminderFilter !== "all" ||
    completionFilter !== "all";
  const hasActiveFilters = selectedListKey !== "all" || queryFiltersActive;
  const advancedFilterCount = [
    statusFilter,
    priorityFilter,
    dueDateFilter,
    reminderFilter,
    completionFilter,
  ].filter((value) => value !== "all").length;

  const filteredTasks = useMemo(
    () =>
      filterTasks(tasks, {
        selectedListKey,
        knownListIds,
        searchTerm: normalizedSearch,
        status: statusFilter,
        priority: priorityFilter,
        dueDate: dueDateFilter,
        reminder: reminderFilter,
        completion: completionFilter,
        todayKey,
      }),
    [
      completionFilter,
      dueDateFilter,
      knownListIds,
      normalizedSearch,
      priorityFilter,
      reminderFilter,
      selectedListKey,
      statusFilter,
      tasks,
      todayKey,
    ]
  );

  const activeFilterLabels = useMemo(() => {
    const labels = [];

    if (normalizedSearch) labels.push(`Search: ${searchQuery.trim()}`);
    if (selectedListKey !== "all") labels.push(`List: ${activeListTitle}`);
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
    activeListTitle,
    completionFilter,
    dueDateFilter,
    normalizedSearch,
    priorityFilter,
    reminderFilter,
    searchQuery,
    selectedListKey,
    statusFilter,
  ]);

  useEffect(() => {
    if (
      selectedListKey !== "all" &&
      selectedListKey !== "inbox" &&
      !listsLoading &&
      !knownListIds.has(selectedListKey)
    ) {
      setSelectedListKey("inbox");
    }
  }, [selectedListKey, listsLoading, knownListIds]);

  const openEditor = (task, triggerElement) => {
    editTriggerRef.current = triggerElement || null;
    setSelectedTaskId(task.id);
    setMutationError("");
  };

  const handleSelectList = (listKey) => {
    setSelectedListKey(listKey);
    setSelectedTaskId(null);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedListKey("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setDueDateFilter("all");
    setReminderFilter("all");
    setCompletionFilter("all");
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
      console.error("Error updating task completion:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”. Try again.`
      );
    }
  };

  const handleDeleteList = async (listId) => {
    await onDeleteList(listId);
    if (selectedListKey === listId) setSelectedListKey("inbox");
  };

  return (
    <section className="tasks-page" aria-labelledby="tasks-page-title">
      <div className="tasks-workspace">
        <TaskListsPanel
          lists={lists}
          tasks={tasks}
          selectedListKey={selectedListKey}
          onSelectList={handleSelectList}
          loading={listsLoading}
          error={listsError}
          onRetry={onRetryLists}
          onCreateList={onCreateList}
          onRenameList={onRenameList}
          onDeleteList={handleDeleteList}
        />

        <div className="tasks-content">
          <div className="tasks-page-header">
            <div>
              <p className="card-label">Task workspace</p>
              <h2 id="tasks-page-title">{activeListTitle}</h2>
              <p>Complete tasks quickly, or open a row to update its details.</p>
            </div>
            {!tasksLoading && !tasksError && (
              <span className="tasks-count">
                {filteredTasks.length} {filteredTasks.length === 1 ? "result" : "results"}
              </span>
            )}
          </div>

          <section className="task-filters" aria-label="Search and filter tasks">
            <div className="task-filter-toolbar">
              <label className="task-search-control">
                <span>Search</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Title, description, or notes"
                  aria-describedby="task-filter-results"
                />
              </label>

              <div className="task-filter-actions">
                <button
                  className={`ghost-btn task-filter-toggle ${
                    advancedFilterCount > 0 ? "has-active-filters" : ""
                  }`}
                  type="button"
                  onClick={() => setFiltersExpanded((previous) => !previous)}
                  aria-expanded={filtersExpanded}
                  aria-controls="advanced-task-filters"
                >
                  <span>Filters</span>
                  {advancedFilterCount > 0 && (
                    <span
                      className="task-filter-count"
                      aria-label={`${advancedFilterCount} active`}
                    >
                      {advancedFilterCount}
                    </span>
                  )}
                </button>

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
              className="task-filter-panel"
              id="advanced-task-filters"
              hidden={!filtersExpanded}
              role="group"
              aria-labelledby="task-filters-title"
            >
              <div className="task-filter-panel-heading">
                <div>
                  <h3 id="task-filters-title">Filter tasks</h3>
                  <p>Narrow this workspace without changing your saved tasks.</p>
                </div>
                {advancedFilterCount > 0 && (
                  <span>
                    {advancedFilterCount} active
                  </span>
                )}
              </div>

              <div className="task-filter-controls">
                <label className="task-filter-control">
                  <span>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">Any status</option>
                    <option value="todo">To do</option>
                    <option value="in-progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>

                <label className="task-filter-control">
                  <span>Priority</span>
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                  >
                    <option value="all">Any priority</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>

                <label className="task-filter-control">
                  <span>Due date</span>
                  <select
                    value={dueDateFilter}
                    onChange={(event) => setDueDateFilter(event.target.value)}
                  >
                    <option value="all">Any date</option>
                    <option value="overdue">Overdue</option>
                    <option value="today">Today</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="undated">Undated</option>
                  </select>
                </label>

                <label className="task-filter-control">
                  <span>Reminder</span>
                  <select
                    value={reminderFilter}
                    onChange={(event) => setReminderFilter(event.target.value)}
                  >
                    <option value="all">Any reminder</option>
                    <option value="enabled">Enabled</option>
                  </select>
                </label>

                <label className="task-filter-control">
                  <span>Completion</span>
                  <select
                    value={completionFilter}
                    onChange={(event) => setCompletionFilter(event.target.value)}
                  >
                    <option value="all">Active and completed</option>
                    <option value="active">Active only</option>
                    <option value="completed">Completed only</option>
                  </select>
                </label>
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

          {tasksLoading ? (
            <div className="tasks-state" role="status" aria-live="polite">
              <div className="state-spinner" aria-hidden="true" />
              <h3>Loading tasks...</h3>
              <p>Your saved tasks are being retrieved from Firestore.</p>
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
                  : queryFiltersActive
                    ? "No matching tasks"
                    : `No tasks in ${activeListTitle}`}
              </h3>
              <p>
                {tasks.length === 0
                  ? "Use New Task to create your first task."
                  : queryFiltersActive
                    ? "Try a broader search or clear one of the active filters."
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
              {filteredTasks.map((task) => {
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
                  />
                );
              })}
            </div>
          )}
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
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onClose={closeEditor}
          returnFocusElement={editTriggerRef.current}
        />
      )}

    </section>
  );
}
