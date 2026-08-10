import { useMemo, useState } from "react";
import TaskForm from "./TaskForm";
import TaskRow from "./TaskRow";

const dateKeyFor = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isTaskComplete = (task) =>
  task.completed === true || task.status === "completed";

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

function TodayTaskGroup({
  title,
  description,
  tone,
  tasks,
  lists,
  selectedTaskId,
  completionTaskId,
  onToggleCompletion,
  onEdit,
  emptyMessage,
}) {
  return (
    <section className={`today-task-group today-task-group-${tone}`}>
      <header className="today-task-group-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{tasks.length}</span>
      </header>

      {tasks.length === 0 ? (
        <p className="today-group-empty">{emptyMessage}</p>
      ) : (
        <div className="tasks-page-list today-task-list">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              lists={lists}
              completionBusy={completionTaskId === task.id}
              selected={selectedTaskId === task.id}
              onToggleCompletion={onToggleCompletion}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function TodayPage({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
  onUpdateTask,
  onDeleteTask,
  lists,
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editError, setEditError] = useState("");
  const [completionTaskId, setCompletionTaskId] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const now = new Date();
  const todayKey = dateKeyFor(now);
  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const knownListIds = useMemo(
    () => new Set(lists.map((list) => list.id)),
    [lists]
  );
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const activeTasks = tasks.filter((task) => !isTaskComplete(task));
  const overdueTasks = activeTasks
    .filter((task) => task.dueDate && task.dueDate < todayKey)
    .sort((firstTask, secondTask) =>
      firstTask.dueDate.localeCompare(secondTask.dueDate)
    );
  const dueTodayTasks = activeTasks.filter(
    (task) => task.dueDate === todayKey
  );
  const anytimeTasks = activeTasks.filter((task) => !task.dueDate);
  const completedTasks = tasks.filter(
    (task) =>
      isTaskComplete(task) &&
      (!task.dueDate || task.dueDate <= todayKey)
  );
  const futureTaskCount = activeTasks.filter(
    (task) => task.dueDate && task.dueDate > todayKey
  ).length;

  const openEditor = (task) => {
    setSelectedTaskId(task.id);
    setEditValues(valuesFromTask(task, knownListIds));
    setEditError("");
    setMutationError("");
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
      console.error("Error saving task from Today:", error);
      setEditError(
        "We couldn't save your changes. Check your connection and try again."
      );
    } finally {
      setSavingTask(false);
    }
  };

  const handleCompletionChange = async (task) => {
    const completed = !isTaskComplete(task);
    setCompletionTaskId(task.id);
    setMutationError("");

    try {
      await onUpdateTask(task.id, {
        completed,
        status: completed ? "completed" : "todo",
      });
    } catch (error) {
      console.error("Error updating task completion from Today:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”. Try again.`
      );
    } finally {
      setCompletionTaskId(null);
    }
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
      console.error("Error deleting task from Today:", error);
      setDeleteError(
        "We couldn't delete this task. Check your connection and try again."
      );
    } finally {
      setDeletingTask(false);
    }
  };

  return (
    <section className="today-page" aria-labelledby="today-page-title">
      <header className="today-page-header">
        <div>
          <p className="card-label">Today</p>
          <h2 id="today-page-title">{currentDate}</h2>
          <p>Overdue work comes first, followed by everything due today.</p>
        </div>
        <div className="today-page-summary" aria-label="Today summary">
          <span><strong>{overdueTasks.length}</strong> overdue</span>
          <span><strong>{dueTodayTasks.length}</strong> due today</span>
        </div>
      </header>

      {futureTaskCount > 0 && (
        <p className="today-future-note">
          {futureTaskCount} upcoming {futureTaskCount === 1 ? "task remains" : "tasks remain"} in Tasks.
        </p>
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

      {selectedTask && editValues && (
        <section className="task-detail-panel" aria-labelledby="today-task-detail-title">
          <div className="task-detail-header">
            <div>
              <p className="card-label">Task details</p>
              <h3 id="today-task-detail-title">Edit task</h3>
            </div>
            <button
              className="danger-btn"
              type="button"
              onClick={requestDelete}
              disabled={savingTask}
            >
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
          <h3>Loading today...</h3>
          <p>Your saved tasks are being retrieved from Firestore.</p>
        </div>
      ) : tasksError ? (
        <div className="tasks-state error-state" role="alert">
          <h3>Today is unavailable</h3>
          <p>{tasksError}</p>
          <button className="ghost-btn" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="tasks-state">
          <h3>Nothing scheduled yet</h3>
          <p>Use New Task to add your first task.</p>
        </div>
      ) : (
        <div className="today-sections">
          <TodayTaskGroup
            title="Overdue"
            description="Needs attention before today’s work."
            tone="overdue"
            tasks={overdueTasks}
            lists={lists}
            selectedTaskId={selectedTaskId}
            completionTaskId={completionTaskId}
            onToggleCompletion={handleCompletionChange}
            onEdit={openEditor}
            emptyMessage="No overdue tasks."
          />
          <TodayTaskGroup
            title="Due today"
            description="The tasks scheduled for today."
            tone="today"
            tasks={dueTodayTasks}
            lists={lists}
            selectedTaskId={selectedTaskId}
            completionTaskId={completionTaskId}
            onToggleCompletion={handleCompletionChange}
            onEdit={openEditor}
            emptyMessage="Nothing else is due today."
          />
          {anytimeTasks.length > 0 && (
            <TodayTaskGroup
              title="Anytime"
              description="Tasks without a due date stay visible here."
              tone="anytime"
              tasks={anytimeTasks}
              lists={lists}
              selectedTaskId={selectedTaskId}
              completionTaskId={completionTaskId}
              onToggleCompletion={handleCompletionChange}
              onEdit={openEditor}
            />
          )}
          {completedTasks.length > 0 && (
            <TodayTaskGroup
              title="Completed"
              description="Finished tasks relevant to this view."
              tone="completed"
              tasks={completedTasks}
              lists={lists}
              selectedTaskId={selectedTaskId}
              completionTaskId={completionTaskId}
              onToggleCompletion={handleCompletionChange}
              onEdit={openEditor}
            />
          )}
        </div>
      )}

      {deleteCandidate && (
        <div className="confirmation-backdrop">
          <section
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="today-delete-dialog-title"
            aria-describedby="today-delete-dialog-description"
          >
            <p className="card-label">Permanent action</p>
            <h3 id="today-delete-dialog-title">Delete this task?</h3>
            <p id="today-delete-dialog-description">
              “{deleteCandidate.title}” will be permanently removed from TaskFlow. This cannot be undone.
            </p>
            {deleteError && (
              <p className="form-error" role="alert">{deleteError}</p>
            )}
            <div className="confirmation-actions">
              <button
                className="ghost-btn"
                type="button"
                onClick={cancelDelete}
                disabled={deletingTask}
              >
                Cancel
              </button>
              <button
                className="danger-btn"
                type="button"
                onClick={confirmDelete}
                disabled={deletingTask}
              >
                {deletingTask ? "Deleting..." : "Delete task"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
