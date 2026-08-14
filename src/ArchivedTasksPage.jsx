import { useRef, useState } from "react";
import TaskEditModal from "./TaskEditModal";
import TaskRow from "./TaskRow";

export default function ArchivedTasksPage({
  tasks,
  loading,
  error,
  onRetry,
  onRestoreTask,
  onUpdateTask,
  onDeleteTask,
  onBack,
  lists,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
  browserNotificationsEnabled,
  formatSettings,
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const editTriggerRef = useRef(null);
  const actionSubmissionRef = useRef(false);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  const openEditor = (task, triggerElement) => {
    editTriggerRef.current = triggerElement || null;
    setSelectedTaskId(task.id);
    setMutationError("");
  };

  const restoreTask = async (taskOrId) => {
    const taskId = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    if (actionSubmissionRef.current) return;

    actionSubmissionRef.current = true;
    setPendingTaskId(taskId);
    setMutationError("");
    try {
      await onRestoreTask(taskId);
      setSelectedTaskId(null);
    } catch (restoreError) {
      console.error("Error restoring archived task:", restoreError);
      setMutationError("We couldn't restore this task. Check your connection and try again.");
      throw restoreError;
    } finally {
      actionSubmissionRef.current = false;
      setPendingTaskId(null);
    }
  };

  const permanentlyDeleteTask = async () => {
    if (!taskToDelete || actionSubmissionRef.current) return;

    actionSubmissionRef.current = true;
    setPendingTaskId(taskToDelete.id);
    setMutationError("");
    try {
      await onDeleteTask(taskToDelete.id);
      setTaskToDelete(null);
      setSelectedTaskId(null);
    } catch (deleteError) {
      console.error("Error permanently deleting archived task:", deleteError);
      setMutationError(
        "We couldn't permanently delete this task. Check your connection and try again."
      );
    } finally {
      actionSubmissionRef.current = false;
      setPendingTaskId(null);
    }
  };

  return (
    <section className="archived-tasks-page" aria-labelledby="archived-tasks-title">
      <header className="archived-tasks-header">
        <div>
          <p className="card-label">Account archive</p>
          <h2 id="archived-tasks-title">Archived Tasks</h2>
          <p>Restore tasks to active views or permanently remove them.</p>
        </div>
        <button className="ghost-btn" type="button" onClick={onBack}>
          Back to Settings
        </button>
      </header>

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

      {loading ? (
        <div className="tasks-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h3>Loading archived tasks...</h3>
          <p>Your archived tasks are being retrieved from Firestore.</p>
        </div>
      ) : error ? (
        <div className="tasks-state error-state" role="alert">
          <h3>Archived tasks unavailable</h3>
          <p>{error}</p>
          <button className="ghost-btn" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="tasks-state archived-tasks-empty">
          <span className="archive-empty-icon" aria-hidden="true">A</span>
          <h3>No archived tasks</h3>
          <p>Tasks you archive will appear here without affecting completed tasks.</p>
        </div>
      ) : (
        <div className="tasks-page-list archived-tasks-list">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              lists={lists}
              projects={projects}
              actionBusy={pendingTaskId === task.id}
              selected={selectedTaskId === task.id}
              onEdit={openEditor}
              onRestore={(taskToRestore) => {
                void restoreTask(taskToRestore).catch(() => undefined);
              }}
              onDeletePermanently={setTaskToDelete}
              formatSettings={formatSettings}
            />
          ))}
        </div>
      )}

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
          onRestoreTask={restoreTask}
          onClose={() => setSelectedTaskId(null)}
          returnFocusElement={editTriggerRef.current}
        />
      )}

      {taskToDelete && (
        <div className="confirmation-backdrop">
          <section
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archive-delete-title"
            aria-describedby="archive-delete-description"
            aria-busy={pendingTaskId === taskToDelete.id}
          >
            <p className="card-label">Permanent action</p>
            <h3 id="archive-delete-title">Delete this archived task permanently?</h3>
            <p id="archive-delete-description">
              “{taskToDelete.title}” will be removed from TaskFlow. This cannot be undone.
            </p>
            <div className="confirmation-actions">
              <button
                className="ghost-btn"
                type="button"
                onClick={() => setTaskToDelete(null)}
                disabled={pendingTaskId === taskToDelete.id}
              >
                Cancel
              </button>
              <button
                className="danger-btn"
                type="button"
                onClick={permanentlyDeleteTask}
                disabled={pendingTaskId === taskToDelete.id}
              >
                {pendingTaskId === taskToDelete.id
                  ? "Deleting..."
                  : "Delete permanently"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
