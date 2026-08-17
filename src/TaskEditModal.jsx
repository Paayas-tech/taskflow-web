import { useEffect, useId, useRef, useState } from "react";
import TaskForm from "./TaskForm";
import ActivityFeed from "./ActivityFeed";
import TaskAssigneeSelector from "./TaskAssigneeSelector";
import TaskComments from "./TaskComments";
import {
  buildTaskEditPayload,
  isArchived,
  taskFormValuesFromTask,
} from "./domain/taskDomain";

export default function TaskEditModal({
  task,
  lists,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
  onUpdateTask,
  onDeleteTask,
  onArchiveTask,
  onRestoreTask,
  onClose,
  returnFocusElement,
  browserNotificationsEnabled = true,
  userId = null,
  projectId = null,
  projectMembers = [],
  canAssign = false,
  onAssigneeChange,
  readOnly = false,
}) {
  const [values, setValues] = useState(() =>
    taskFormValuesFromTask(task, lists)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [lifecycleAction, setLifecycleAction] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || null);
  const [assigneeBusy, setAssigneeBusy] = useState(false);
  const [assigneeError, setAssigneeError] = useState("");
  const dialogRef = useRef(null);
  const saveSubmissionRef = useRef(false);
  const deleteSubmissionRef = useRef(false);
  const lifecycleSubmissionRef = useRef(false);
  const busyRef = useRef(false);
  const confirmingDeleteRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const deleteTitleId = `${dialogId}-delete-title`;
  const deleteDescriptionId = `${dialogId}-delete-description`;
  const archived = isArchived(task);
  const busy = saving || deleting || assigneeBusy || Boolean(lifecycleAction);

  busyRef.current = busy;
  confirmingDeleteRef.current = confirmingDelete;
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousScrollX = window.scrollX;
    const previousScrollY = window.scrollY;
    const handleKeyDown = (event) => {
      if (confirmingDeleteRef.current) return;

      if (event.key === "Escape" && !busyRef.current) {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll(
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
      window.requestAnimationFrame(() => {
        window.scrollTo(previousScrollX, previousScrollY);
        returnFocusElement?.focus({ preventScroll: true });
      });
    };
  }, [returnFocusElement]);

  const closeModal = () => {
    if (busy) return;
    onClose();
  };

  const handleBackdrop = (event) => {
    if (event.target === event.currentTarget) closeModal();
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saveSubmissionRef.current || busy) return;

    setSaveError("");

    if (!values.title.trim()) {
      setSaveError("Enter a task title before saving.");
      return;
    }

    saveSubmissionRef.current = true;
    setSaving(true);

    try {
      await onUpdateTask(task.id, buildTaskEditPayload(values));
      onClose();
    } catch (error) {
      console.error("Error saving task:", error);
      setSaveError(
        "We couldn't save your changes. Check your connection and try again."
      );
    } finally {
      saveSubmissionRef.current = false;
      setSaving(false);
    }
  };

  const requestDelete = () => {
    setDeleteError("");
    setConfirmingDelete(true);
  };

  const handleLifecycleAction = async () => {
    if (lifecycleSubmissionRef.current || busy) return;

    const action = archived ? onRestoreTask : onArchiveTask;
    if (!action) return;

    lifecycleSubmissionRef.current = true;
    setLifecycleAction(archived ? "restore" : "archive");
    setLifecycleError("");

    try {
      await action(task.id);
      onClose();
    } catch (error) {
      console.error(`Error ${archived ? "restoring" : "archiving"} task:`, error);
      setLifecycleError(
        `We couldn't ${archived ? "restore" : "archive"} this task. Check your connection and try again.`
      );
    } finally {
      lifecycleSubmissionRef.current = false;
      setLifecycleAction("");
    }
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteError("");
    setConfirmingDelete(false);
  };

  const confirmDelete = async () => {
    if (deleteSubmissionRef.current || deleting) return;

    deleteSubmissionRef.current = true;
    setDeleting(true);
    setDeleteError("");

    try {
      await onDeleteTask(task.id);
      setConfirmingDelete(false);
      onClose();
    } catch (error) {
      console.error("Error deleting task:", error);
      setDeleteError(
        "We couldn't delete this task. Check your connection and try again."
      );
    } finally {
      deleteSubmissionRef.current = false;
      setDeleting(false);
    }
  };

  const handleAssigneeChange = async (nextAssigneeId) => {
    if (!onAssigneeChange || assigneeBusy) return;
    const previous = assigneeId;
    setAssigneeId(nextAssigneeId);
    setAssigneeBusy(true);
    setAssigneeError("");
    try {
      await onAssigneeChange(task.id, nextAssigneeId);
    } catch (error) {
      setAssigneeId(previous);
      setAssigneeError(
        error.message || "We couldn't update this task's assignee."
      );
    } finally {
      setAssigneeBusy(false);
    }
  };

  return (
    <>
      <div
        className="task-modal-backdrop edit-task-modal-backdrop"
        onMouseDown={handleBackdrop}
      >
        <section
          ref={dialogRef}
          className="task-modal edit-task-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-busy={busy}
        >
          <div className="task-modal-header edit-task-modal-header">
            <div>
              <p className="card-label">Task details</p>
              <h2 id={titleId}>Edit Task</h2>
              <p id={descriptionId}>
                Update this task without leaving your current workspace.
              </p>
            </div>

            <div className="edit-task-modal-actions">
              {(archived ? onRestoreTask : onArchiveTask) && (
                <button
                  className={archived ? "secondary-btn" : "ghost-btn"}
                  type="button"
                  onClick={handleLifecycleAction}
                  disabled={busy}
                >
                  {lifecycleAction
                    ? archived
                      ? "Restoring..."
                      : "Archiving..."
                    : archived
                      ? "Restore task"
                      : "Archive task"}
                </button>
              )}
              {onDeleteTask && (
                <button
                  className="danger-btn"
                  type="button"
                  onClick={requestDelete}
                  disabled={busy}
                >
                  {archived ? "Delete permanently" : "Delete task"}
                </button>
              )}
              <button
                className="ghost-btn compact-btn task-modal-close"
                type="button"
                onClick={closeModal}
                disabled={busy}
                aria-label="Close Edit Task dialog"
              >
                Close
              </button>
            </div>
          </div>

          {lifecycleError && (
            <p className="form-error task-lifecycle-error" role="alert">
              {lifecycleError}
            </p>
          )}

          {readOnly ? (
            <section className="settings-section" aria-label="Read-only task details">
              <p className="form-hint">You have view-only access to this task.</p>
              <h3>{task.title}</h3>
              {task.description && <p>{task.description}</p>}
              {task.notes && <p><strong>Notes:</strong> {task.notes}</p>}
              <p className="form-hint">Status: {task.status} · Priority: {task.priority}{task.dueDate ? ` · Due ${task.dueDate}` : ""}</p>
            </section>
          ) : (
            <TaskForm
              values={values}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={closeModal}
              submitLabel="Save changes"
              busyLabel="Saving..."
              busy={busy}
              error={saveError}
              lists={lists}
              projects={projects}
              projectsLoading={projectsLoading}
              projectsError={projectsError}
              onRetryProjects={onRetryProjects}
              browserNotificationsEnabled={browserNotificationsEnabled}
            />
          )}

          {userId && projectId && (
            <>
              <TaskAssigneeSelector
                assigneeId={assigneeId}
                members={projectMembers}
                disabled={!canAssign || !onAssigneeChange}
                busy={assigneeBusy}
                error={assigneeError}
                onChange={handleAssigneeChange}
              />
              <TaskComments
                userId={userId}
                taskId={task.id}
                members={projectMembers}
              />
              <ActivityFeed
                userId={userId}
                projectId={projectId}
                taskId={task.id}
                compact
              />
            </>
          )}
        </section>
      </div>

      {confirmingDelete && (
        <div className="confirmation-backdrop">
          <section
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
            aria-describedby={deleteDescriptionId}
            aria-busy={deleting}
          >
            <p className="card-label">Permanent action</p>
            <h3 id={deleteTitleId}>
              {archived ? "Delete this archived task permanently?" : "Delete this task?"}
            </h3>
            <p id={deleteDescriptionId}>
              “{task.title}” will be permanently removed from TaskFlow. This
              cannot be undone.
            </p>
            {deleteError && (
              <p className="form-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="confirmation-actions">
              <button
                className="ghost-btn"
                type="button"
                onClick={cancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="danger-btn"
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting
                  ? "Deleting..."
                  : archived
                    ? "Delete permanently"
                    : "Delete task"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
