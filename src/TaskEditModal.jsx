import { useEffect, useId, useRef, useState } from "react";
import TaskForm from "./TaskForm";
import ActivityFeed from "./ActivityFeed";
import TaskAssigneeSelector from "./TaskAssigneeSelector";
import TaskComments from "./TaskComments";
import { useModalLifecycle } from "./components/modal/useModalLifecycle";
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
  presentation = "modal",
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
  const [activePage, setActivePage] = useState("details");
  const dialogRef = useRef(null);
  const confirmationDialogRef = useRef(null);
  const deleteButtonRef = useRef(null);
  const saveSubmissionRef = useRef(false);
  const deleteSubmissionRef = useRef(false);
  const lifecycleSubmissionRef = useRef(false);
  const busyRef = useRef(false);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const deleteTitleId = `${dialogId}-delete-title`;
  const deleteDescriptionId = `${dialogId}-delete-description`;
  const archived = isArchived(task);
  const isPanel = presentation === "panel";
  const busy = saving || deleting || assigneeBusy || Boolean(lifecycleAction);
  const pageTitle = activePage === "comments"
    ? "Comments"
    : activePage === "history"
      ? "History"
      : isPanel ? task.title : "Edit Task";

  busyRef.current = busy;

  useEffect(() => {
    if (isPanel) return undefined;
    const previousScrollX = window.scrollX;
    const previousScrollY = window.scrollY;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector(
          'input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)'
        )
        ?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.requestAnimationFrame(() => {
        window.scrollTo(previousScrollX, previousScrollY);
        returnFocusElement?.focus({ preventScroll: true });
      });
    };
  }, [isPanel, returnFocusElement]);

  useEffect(() => {
    if (!confirmingDelete) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) {
        setDeleteError("");
        setConfirmingDelete(false);
        window.requestAnimationFrame(() => deleteButtonRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") return;
      const activeDialog = confirmationDialogRef.current;
      const focusableElements = activeDialog?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) {
        event.preventDefault();
        activeDialog?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === firstElement ||
          document.activeElement === activeDialog)
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    const focusFrame = window.requestAnimationFrame(() => {
      confirmationDialogRef.current
        ?.querySelector('button:not(:disabled)')
        ?.focus();
    });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmingDelete]);

  const { onBackdropMouseDown } = useModalLifecycle({
    isOpen: !isPanel,
    modalRef: dialogRef,
    onClose,
    isDismissDisabled: busy,
    allowEscape: !confirmingDelete,
    trapFocus: !confirmingDelete,
    restoreFocus: false,
  });

  const closeModal = () => {
    if (busy) return;
    onClose();
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
    window.requestAnimationFrame(() => deleteButtonRef.current?.focus());
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
        className={`task-modal-backdrop edit-task-modal-backdrop${isPanel ? " task-panel-backdrop" : ""}`}
        onMouseDown={onBackdropMouseDown}
      >
        <section
          ref={dialogRef}
          className={`task-modal edit-task-modal${isPanel ? " task-details-panel" : ""}`}
          role={isPanel ? "complementary" : "dialog"}
          aria-modal={isPanel ? undefined : "true"}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-busy={busy}
        >
          <div className="task-modal-header edit-task-modal-header">
            <div>
              <p className="card-label">{isPanel ? "Task details" : task.title}</p>
              <h2 id={titleId}>{pageTitle}</h2>
              <p id={descriptionId}>
                {activePage === "comments"
                  ? "Discuss this task with project members."
                  : activePage === "history"
                    ? "Review task-specific changes and activity."
                    : "Update this task without leaving your current workspace."}
              </p>
            </div>

            <div className="edit-task-modal-actions">
              {isPanel && activePage === "details" && !readOnly && (
                <label className="task-panel-complete">
                  <input
                    type="checkbox"
                    checked={values.status === "completed"}
                    onChange={(event) => setValues((previous) => ({
                      ...previous,
                      status: event.target.checked ? "completed" : "todo",
                    }))}
                    disabled={busy}
                  />
                  <span>{values.status === "completed" ? "Completed" : "Mark complete"}</span>
                </label>
              )}
              {activePage === "details" && (archived ? onRestoreTask : onArchiveTask) && (
                <button
                  className={`${archived ? "secondary-btn" : "ghost-btn"}${isPanel ? " task-panel-icon-btn" : ""}`}
                  type="button"
                  onClick={handleLifecycleAction}
                  disabled={busy}
                  aria-label={archived ? "Restore task" : "Archive task"}
                  title={archived ? "Restore" : "Archive"}
                >
                  {isPanel && !lifecycleAction ? (
                    archived
                      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v11H4zM3 4h18v4H3zM12 11v5m0-5-2 2m2-2 2 2" /></svg>
                      : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v11H4zM3 4h18v4H3zM9 12h6" /></svg>
                  ) : lifecycleAction
                    ? archived
                      ? "Restoring..."
                      : "Archiving..."
                    : archived
                      ? "Restore"
                      : "Archive"}
                </button>
              )}
              {activePage === "details" && onDeleteTask && (
                <button
                  ref={deleteButtonRef}
                  className={`danger-btn${isPanel ? " task-panel-icon-btn" : ""}`}
                  type="button"
                  onClick={requestDelete}
                  disabled={busy}
                  aria-label={archived ? "Delete task permanently" : "Delete task"}
                  title={archived ? "Delete permanently" : "Delete"}
                >
                  {isPanel ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg> : archived ? "Delete permanently" : "Delete"}
                </button>
              )}
              <button
                className={`ghost-btn compact-btn task-modal-close${isPanel ? " task-panel-icon-btn" : ""}`}
                type="button"
                onClick={closeModal}
                disabled={busy}
                aria-label="Close Edit Task dialog"
                title="Close"
              >
                {isPanel ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg> : "Close"}
              </button>
            </div>
          </div>

          {isPanel && !projectId && (
            <nav className="task-modal-pages task-panel-pages" aria-label="Task details sections">
              {["details", "subtasks", "activity"].map((page) => (
                <button
                  key={page}
                  type="button"
                  className={activePage === page ? "active" : ""}
                  aria-current={activePage === page ? "page" : undefined}
                  onClick={() => setActivePage(page)}
                  disabled={busy}
                >
                  {page[0].toUpperCase() + page.slice(1)}
                </button>
              ))}
            </nav>
          )}

          {userId && projectId && (
            <nav className="task-modal-pages" aria-label="Task workspace">
              {["details", "comments", "history"].map((page) => (
                <button
                  key={page}
                  type="button"
                  className={activePage === page ? "active" : ""}
                  aria-current={activePage === page ? "page" : undefined}
                  onClick={() => setActivePage(page)}
                  disabled={busy}
                >
                  {page[0].toUpperCase() + page.slice(1)}
                </button>
              ))}
            </nav>
          )}

          {activePage === "details" && lifecycleError && (
            <p className="form-error task-lifecycle-error" role="alert">
              {lifecycleError}
            </p>
          )}

          {userId && projectId && activePage === "details" && (
            <TaskAssigneeSelector
              assigneeId={assigneeId}
              members={projectMembers}
              disabled={!canAssign || !onAssigneeChange}
              busy={assigneeBusy}
              error={assigneeError}
              onChange={handleAssigneeChange}
            />
          )}

          {activePage === "details" && (readOnly ? (
            <section className="settings-section" aria-label="Read-only task details">
              <p className="form-hint">You have view-only access to this task.</p>
              <h3>{task.title}</h3>
              {task.description && <p>{task.description}</p>}
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
          ))}

          {userId && projectId && activePage === "comments" && (
            <div className="task-modal-page task-modal-comments-page">
              <TaskComments
                userId={userId}
                taskId={task.id}
                members={projectMembers}
              />
            </div>
          )}

          {userId && projectId && activePage === "history" && (
            <div className="task-modal-page task-modal-history-page">
              <ActivityFeed
                userId={userId}
                projectId={projectId}
                taskId={task.id}
              />
            </div>
          )}

          {isPanel && !projectId && activePage === "subtasks" && (
            <section className="task-panel-empty-state" aria-labelledby={`${dialogId}-subtasks-title`}>
              <span aria-hidden="true">✓</span>
              <h3 id={`${dialogId}-subtasks-title`}>No subtasks available</h3>
              <p>Personal tasks do not currently support subtasks.</p>
            </section>
          )}

          {isPanel && !projectId && activePage === "activity" && (
            <section className="task-panel-empty-state" aria-labelledby={`${dialogId}-activity-title`}>
              <span aria-hidden="true">↻</span>
              <h3 id={`${dialogId}-activity-title`}>Activity is unavailable</h3>
              <p>Task history is available for project tasks, but not for personal tasks yet.</p>
            </section>
          )}
        </section>
      </div>

      {confirmingDelete && (
        <div className="confirmation-backdrop">
          <section
            ref={confirmationDialogRef}
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
            aria-describedby={deleteDescriptionId}
            aria-busy={deleting}
            tabIndex={-1}
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
