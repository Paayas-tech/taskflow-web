import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TaskForm from "./TaskForm";
import TaskListsPanel from "./TaskListsPanel";
import TaskRow from "./TaskRow";

const dateKeyFor = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isTaskComplete = (task) =>
  task.completed === true || task.status === "completed";

const includesSearchTerm = (task, searchTerm) => {
  if (!searchTerm) return true;

  return [task.title, task.description, task.notes].some((value) =>
    String(value || "").toLocaleLowerCase().includes(searchTerm)
  );
};

const valuesFromTask = (task, knownListIds) => ({
  title: task.title || "",
  description: task.description || "",
  notes: task.notes || "",
  status: task.status || "todo",
  priority: task.priority || "medium",
  dueDate: task.dueDate || "",
  reminder: task.reminder === true,
  listId: knownListIds.has(task.listId) ? task.listId : "",
});

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
  const [editValues, setEditValues] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editError, setEditError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const editDialogRef = useRef(null);
  const editTriggerRef = useRef(null);
  const editSubmissionRef = useRef(false);
  const deleteSubmissionRef = useRef(false);
  const savingTaskRef = useRef(false);
  const deletingTaskRef = useRef(false);
  const deleteCandidateRef = useRef(null);

  savingTaskRef.current = savingTask;
  deletingTaskRef.current = deletingTask;
  deleteCandidateRef.current = deleteCandidate;

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
  const todayKey = dateKeyFor(new Date());
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
      tasks.filter((task) => {
        const belongsToSelectedList =
          selectedListKey === "all" ||
          (selectedListKey === "inbox"
            ? !task.listId || !knownListIds.has(task.listId)
            : task.listId === selectedListKey);

        if (!belongsToSelectedList || !includesSearchTerm(task, normalizedSearch)) {
          return false;
        }

        if (statusFilter !== "all" && task.status !== statusFilter) return false;
        if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;

        const completed = isTaskComplete(task);
        if (completionFilter === "active" && completed) return false;
        if (completionFilter === "completed" && !completed) return false;

        if (reminderFilter === "enabled" && task.reminder !== true) return false;

        const dueDate =
          typeof task.dueDate === "string" ? task.dueDate.trim() : "";
        if (dueDateFilter === "overdue" && (!dueDate || dueDate >= todayKey)) {
          return false;
        }
        if (dueDateFilter === "today" && dueDate !== todayKey) return false;
        if (dueDateFilter === "upcoming" && (!dueDate || dueDate <= todayKey)) {
          return false;
        }
        if (dueDateFilter === "undated" && dueDate) return false;

        return true;
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
    setEditValues(valuesFromTask(task, knownListIds));
    setEditError("");
    setMutationError("");
  };

  const handleSelectList = (listKey) => {
    setSelectedListKey(listKey);
    setSelectedTaskId(null);
    setEditValues(null);
    setEditError("");
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

  const closeEditor = useCallback(() => {
    if (savingTaskRef.current || deletingTaskRef.current) return;
    setSelectedTaskId(null);
    setEditValues(null);
    setEditError("");
  }, []);

  const handleEditModalBackdrop = (event) => {
    if (event.target === event.currentTarget) closeEditor();
  };

  useEffect(() => {
    if (!selectedTaskId) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (deleteCandidateRef.current) return;

      if (
        event.key === "Escape" &&
        !savingTaskRef.current &&
        !deletingTaskRef.current
      ) {
        closeEditor();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = editDialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => editTriggerRef.current?.focus());
    };
  }, [closeEditor, selectedTaskId]);

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (editSubmissionRef.current || savingTask || deletingTask) return;

    setEditError("");

    if (!editValues.title.trim()) {
      setEditError("Enter a task title before saving.");
      return;
    }

    editSubmissionRef.current = true;
    setSavingTask(true);

    try {
      const completed = editValues.status === "completed";
      await onUpdateTask(selectedTask.id, {
        title: editValues.title.trim(),
        description: editValues.description,
        notes: editValues.notes,
        status: editValues.status,
        completed,
        priority: editValues.priority,
        dueDate: editValues.dueDate,
        reminder: editValues.reminder,
        listId: editValues.listId || null,
      });

      setSelectedTaskId(null);
      setEditValues(null);
    } catch (error) {
      console.error("Error saving task:", error);
      setEditError(
        "We couldn't save your changes. Check your connection and try again."
      );
    } finally {
      editSubmissionRef.current = false;
      setSavingTask(false);
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

  const handleDeleteList = async (listId) => {
    await onDeleteList(listId);
    if (selectedListKey === listId) setSelectedListKey("inbox");
  };

  const requestDelete = () => {
    if (!selectedTask) return;
    setDeleteCandidate(selectedTask);
    setDeleteError("");
  };

  const cancelDelete = () => {
    if (deletingTask) return;
    setDeleteCandidate(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteCandidate || deleteSubmissionRef.current || deletingTask) return;

    deleteSubmissionRef.current = true;
    setDeletingTask(true);
    setDeleteError("");

    try {
      await onDeleteTask(deleteCandidate.id);
      setDeleteCandidate(null);
      setSelectedTaskId(null);
      setEditValues(null);
    } catch (error) {
      console.error("Error deleting task:", error);
      setDeleteError(
        "We couldn't delete this task. Check your connection and try again."
      );
    } finally {
      deleteSubmissionRef.current = false;
      setDeletingTask(false);
    }
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

      {selectedTask && editValues && (
        <div
          className="task-modal-backdrop edit-task-modal-backdrop"
          onMouseDown={handleEditModalBackdrop}
        >
          <section
            ref={editDialogRef}
            className="task-modal edit-task-modal"
            id="edit-task-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-dialog-title"
            aria-describedby="edit-task-dialog-description"
            aria-busy={savingTask || deletingTask}
          >
            <div className="task-modal-header edit-task-modal-header">
              <div>
                <p className="card-label">Task details</p>
                <h2 id="edit-task-dialog-title">Edit Task</h2>
                <p id="edit-task-dialog-description">
                  Update this task without leaving your current workspace.
                </p>
              </div>

              <div className="edit-task-modal-actions">
                <button
                  className="danger-btn"
                  type="button"
                  onClick={requestDelete}
                  disabled={savingTask || deletingTask}
                >
                  Delete task
                </button>
                <button
                  className="ghost-btn compact-btn task-modal-close"
                  type="button"
                  onClick={closeEditor}
                  disabled={savingTask || deletingTask}
                  aria-label="Close Edit Task dialog"
                >
                  Close
                </button>
              </div>
            </div>

            <TaskForm
              values={editValues}
              onChange={handleEditChange}
              onSubmit={handleEditSubmit}
              onCancel={closeEditor}
              submitLabel="Save changes"
              busyLabel="Saving..."
              busy={savingTask || deletingTask}
              error={editError}
              lists={lists}
            />
          </section>
        </div>
      )}

      {deleteCandidate && (
        <div className="confirmation-backdrop">
          <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" aria-busy={deletingTask}>
            <p className="card-label">Permanent action</p>
            <h3 id="delete-dialog-title">Delete this task?</h3>
            <p id="delete-dialog-description">
              “{deleteCandidate.title}” will be permanently removed from TaskFlow. This cannot be undone.
            </p>
            {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
            <div className="confirmation-actions">
              <button className="ghost-btn" type="button" onClick={cancelDelete} disabled={deletingTask}>Cancel</button>
              <button className="danger-btn" type="button" onClick={confirmDelete} disabled={deletingTask}>
                {deletingTask ? "Deleting..." : "Delete task"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
