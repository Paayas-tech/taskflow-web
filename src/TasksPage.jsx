import { useEffect, useMemo, useState } from "react";
import TaskForm from "./TaskForm";
import TaskListsPanel from "./TaskListsPanel";

const statusLabels = {
  todo: "To do",
  "in-progress": "In progress",
  completed: "Completed",
};

const priorityLabels = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

const dateKeyFor = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTaskDueDate = (value) => {
  if (!value) return "No due date";

  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parsedDate);
};

const dueDateMetaFor = (value) => {
  if (!value) return { label: "No due date", tone: "undated" };

  const todayKey = dateKeyFor(new Date());
  if (value < todayKey) {
    return { label: `Overdue · ${formatTaskDueDate(value)}`, tone: "overdue" };
  }
  if (value === todayKey) return { label: "Due today", tone: "today" };

  return { label: formatTaskDueDate(value), tone: "upcoming" };
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
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editError, setEditError] = useState("");
  const [completionTaskId, setCompletionTaskId] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const filteredTasks = tasks.filter((task) => {
    if (selectedListKey === "all") return true;
    if (selectedListKey === "inbox") {
      return !task.listId || !knownListIds.has(task.listId);
    }
    return task.listId === selectedListKey;
  });

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

  const openEditor = (task) => {
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

  const closeEditor = () => {
    if (savingTask) return;
    setSelectedTaskId(null);
    setEditValues(null);
    setEditError("");
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");

    if (!editValues.title.trim()) {
      setEditError("Enter a task title before saving.");
      return;
    }

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
      setSavingTask(false);
    }
  };

  const handleCompletionChange = async (task) => {
    const completed = !task.completed;
    setCompletionTaskId(task.id);
    setMutationError("");

    try {
      await onUpdateTask(task.id, {
        completed,
        status: completed ? "completed" : "todo",
      });
    } catch (error) {
      console.error("Error updating task completion:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”. Try again.`
      );
    } finally {
      setCompletionTaskId(null);
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
    if (!deleteCandidate) return;

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
                {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
              </span>
            )}
          </div>

          {mutationError && (
            <div className="inline-error task-mutation-error" role="alert">
              <p>{mutationError}</p>
              <button className="ghost-btn compact-btn" onClick={() => setMutationError("")}>
                Dismiss
              </button>
            </div>
          )}

          {selectedTask && editValues && (
            <section className="task-detail-panel" aria-labelledby="task-detail-title">
              <div className="task-detail-header">
                <div>
                  <p className="card-label">Task details</p>
                  <h3 id="task-detail-title">Edit task</h3>
                </div>
                <button className="danger-btn" type="button" onClick={requestDelete} disabled={savingTask}>
                  Delete task
                </button>
              </div>

              <TaskForm
                values={editValues}
                onChange={handleEditChange}
                onSubmit={handleEditSubmit}
                onCancel={closeEditor}
                submitLabel="Save changes"
                busyLabel="Saving..."
                busy={savingTask}
                error={editError}
                lists={lists}
              />
            </section>
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
              <h3>{tasks.length === 0 ? "No tasks yet" : `No tasks in ${activeListTitle}`}</h3>
              <p>
                {tasks.length === 0
                  ? "Use New Task to create your first task."
                  : "Assign a task to this list or choose another list."}
              </p>
            </div>
          ) : (
            <div className="tasks-page-list">
              {filteredTasks.map((task) => {
                const completionBusy = completionTaskId === task.id;
                const taskList = lists.find((list) => list.id === task.listId);
                const dueDateMeta = dueDateMetaFor(task.dueDate);

                return (
                  <article
                    key={task.id}
                    className={`tasks-page-row ${
                      task.completed ? "task-row-completed" : ""
                    } ${selectedTaskId === task.id ? "is-selected" : ""}`}
                    aria-busy={completionBusy}
                  >
                    <button
                      type="button"
                      className={`completion-control ${task.completed ? "is-complete" : ""}`}
                      aria-label={task.completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
                      aria-pressed={task.completed}
                      onClick={() => handleCompletionChange(task)}
                      disabled={completionBusy}
                    >
                      {completionBusy ? <span className="completion-spinner" /> : <span aria-hidden="true">{task.completed ? "✓" : ""}</span>}
                    </button>

                    <div className="tasks-page-copy">
                      <button className="task-title-button" type="button" onClick={() => openEditor(task)}>
                        <span className="task-row-title">{task.title}</span>
                      </button>
                      {task.description && <p className="task-description">{task.description}</p>}
                      {task.notes && <p className="task-notes-preview"><strong>Notes:</strong> {task.notes}</p>}
                      <div className="tasks-page-meta">
                        <span className="task-list-badge">
                          <span
                            className="list-color-dot"
                            style={{ backgroundColor: taskList?.color || "#9a8170" }}
                            aria-hidden="true"
                          />
                          {taskList?.name || "Inbox"}
                        </span>
                        <span className={`task-due-meta task-due-${dueDateMeta.tone}`}>
                          {dueDateMeta.label}
                        </span>
                        <span className={`priority priority-${task.priority}`}>
                          {priorityLabels[task.priority] || "Medium priority"}
                        </span>
                        {task.reminder && (
                          <span className="task-reminder-meta">Reminder</span>
                        )}
                      </div>
                    </div>

                    <div className="task-row-actions">
                      <span className={`task-status task-status-${task.status}`}>
                        {statusLabels[task.status] || "To do"}
                      </span>
                      <button
                        className="ghost-btn compact-btn task-edit-button"
                        type="button"
                        onClick={() => openEditor(task)}
                        disabled={completionBusy}
                        aria-label={`Edit ${task.title}`}
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {deleteCandidate && (
        <div className="confirmation-backdrop">
          <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
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
