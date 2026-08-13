import { useEffect, useId, useRef, useState } from "react";
import TaskForm from "./TaskForm";
import {
  buildTaskEditPayload,
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
  onClose,
  returnFocusElement,
}) {
  const [values, setValues] = useState(() =>
    taskFormValuesFromTask(task, lists)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const dialogRef = useRef(null);
  const saveSubmissionRef = useRef(false);
  const deleteSubmissionRef = useRef(false);
  const busyRef = useRef(false);
  const confirmingDeleteRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const deleteTitleId = `${dialogId}-delete-title`;
  const deleteDescriptionId = `${dialogId}-delete-description`;
  const busy = saving || deleting;

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
              <button
                className="danger-btn"
                type="button"
                onClick={requestDelete}
                disabled={busy}
              >
                Delete task
              </button>
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
          />
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
            <h3 id={deleteTitleId}>Delete this task?</h3>
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
                {deleting ? "Deleting..." : "Delete task"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
