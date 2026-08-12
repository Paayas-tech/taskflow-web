import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TaskForm from "./TaskForm";
import TaskRow from "./TaskRow";

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
  projectId: task.projectId || "",
});

const projectStatusLabels = {
  active: "Active project",
  completed: "Completed project",
  archived: "Archived project",
};

export default function ProjectTasksPage({
  projectId,
  project,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
  tasks,
  tasksLoading,
  tasksError,
  onRetryTasks,
  onUpdateTask,
  onQuickUpdateTask,
  quickTaskPendingIds,
  onDeleteTask,
  lists,
  onBack,
  onCreateTask,
}) {
  const [statusFilter, setStatusFilter] = useState("all");
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

  savingTaskRef.current = savingTask;
  deletingTaskRef.current = deletingTask;

  const knownListIds = useMemo(
    () => new Set(lists.map((list) => list.id)),
    [lists]
  );
  const projectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === projectId),
    [projectId, tasks]
  );
  const activeTasks = useMemo(
    () => projectTasks.filter((task) => !isTaskComplete(task)),
    [projectTasks]
  );
  const completedTasks = useMemo(
    () => projectTasks.filter(isTaskComplete),
    [projectTasks]
  );
  const filteredTasks =
    statusFilter === "active"
      ? activeTasks
      : statusFilter === "completed"
        ? completedTasks
        : projectTasks;
  const selectedTask = projectTasks.find(
    (task) => task.id === selectedTaskId
  );

  useEffect(() => {
    setStatusFilter("all");
    setSelectedTaskId(null);
    setEditValues(null);
    setEditError("");
    setMutationError("");
    setDeleteCandidate(null);
    setDeleteError("");
  }, [projectId]);

  const openEditor = (task, triggerElement) => {
    editTriggerRef.current = triggerElement || null;
    setSelectedTaskId(task.id);
    setEditValues(valuesFromTask(task, knownListIds));
    setEditError("");
    setMutationError("");
  };

  const closeEditor = useCallback(() => {
    if (savingTaskRef.current || deletingTaskRef.current) return;
    setSelectedTaskId(null);
    setEditValues(null);
    setEditError("");
  }, []);

  useEffect(() => {
    if (!selectedTaskId) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !savingTaskRef.current &&
        !deletingTaskRef.current &&
        !deleteCandidate
      ) {
        closeEditor();
        return;
      }

      if (event.key !== "Tab" || deleteCandidate) return;

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
  }, [closeEditor, deleteCandidate, selectedTaskId]);

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (
      editSubmissionRef.current ||
      savingTask ||
      deletingTask ||
      !selectedTask
    ) {
      return;
    }

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
        projectId: editValues.projectId || null,
      });

      setSelectedTaskId(null);
      setEditValues(null);
    } catch (error) {
      console.error("Error saving project task:", error);
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
      console.error("Error updating project task completion:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”. Try again.`
      );
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
    if (!deleteCandidate || deleteSubmissionRef.current) return;

    deleteSubmissionRef.current = true;
    setDeletingTask(true);
    setDeleteError("");

    try {
      await onDeleteTask(deleteCandidate.id);
      setDeleteCandidate(null);
      setSelectedTaskId(null);
      setEditValues(null);
    } catch (error) {
      console.error("Error deleting project task:", error);
      setDeleteError(
        "We couldn't delete this task. Check your connection and try again."
      );
    } finally {
      deleteSubmissionRef.current = false;
      setDeletingTask(false);
    }
  };

  if (projectsLoading) {
    return (
      <section className="project-tasks-page">
        <div className="project-task-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h2>Loading project...</h2>
          <p>We’re retrieving this project from your workspace.</p>
        </div>
      </section>
    );
  }

  if (projectsError) {
    return (
      <section className="project-tasks-page">
        <div className="project-task-state error-state" role="alert">
          <h2>Project unavailable</h2>
          <p>{projectsError}</p>
          <div className="project-task-state-actions">
            <button className="ghost-btn" type="button" onClick={onBack}>
              Back to Projects
            </button>
            <button className="primary-btn" type="button" onClick={onRetryProjects}>
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="project-tasks-page">
        <div className="project-task-state">
          <span className="projects-empty-icon" aria-hidden="true">◇</span>
          <h2>Project not found</h2>
          <p>This project doesn’t exist or isn’t available to your account.</p>
          <button className="primary-btn" type="button" onClick={onBack}>
            Back to Projects
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="project-tasks-page" aria-labelledby="project-task-title">
      <button className="project-back-button" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Projects
      </button>

      <header className="project-task-hero">
        <div className="project-task-identity">
          <span
            className="project-task-color"
            style={{ backgroundColor: project.color || "#6657c8" }}
            aria-hidden="true"
          />
          <div>
            <p className="card-label">Project workspace</p>
            <h2 id="project-task-title">{project.name}</h2>
            {project.description && <p>{project.description}</p>}
            <span className={`project-status project-status-${project.status}`}>
              {projectStatusLabels[project.status] || "Active project"}
            </span>
          </div>
        </div>
        <button className="primary-btn" type="button" onClick={onCreateTask}>
          + New project task
        </button>
      </header>

      <div className="project-task-summary" aria-label="Project task summary">
        <div>
          <strong>{projectTasks.length}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>{activeTasks.length}</strong>
          <span>Active</span>
        </div>
        <div>
          <strong>{completedTasks.length}</strong>
          <span>Completed</span>
        </div>
      </div>

      <div className="project-task-toolbar">
        <div>
          <h3>Project tasks</h3>
          <p>Only tasks assigned to this project appear here.</p>
        </div>
        <div className="project-status-filters" role="group" aria-label="Filter project tasks">
          {[
            ["all", "All"],
            ["active", "Active"],
            ["completed", "Completed"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={statusFilter === value ? "active" : ""}
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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

      {tasksLoading ? (
        <div className="project-task-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h3>Loading project tasks...</h3>
          <p>Your saved tasks are being retrieved from Firestore.</p>
        </div>
      ) : tasksError ? (
        <div className="project-task-state error-state" role="alert">
          <h3>Project tasks unavailable</h3>
          <p>{tasksError}</p>
          <button className="ghost-btn" type="button" onClick={onRetryTasks}>
            Try again
          </button>
        </div>
      ) : projectTasks.length === 0 ? (
        <div className="project-task-state project-task-empty">
          <span className="projects-empty-icon" aria-hidden="true">✓</span>
          <h3>No tasks in this project</h3>
          <p>Create a task here to keep the next step connected to this project.</p>
          <button className="primary-btn" type="button" onClick={onCreateTask}>
            Create project task
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="project-task-state project-task-filter-empty">
          <h3>No {statusFilter} tasks</h3>
          <p>Choose another status to see the rest of this project.</p>
          <button className="ghost-btn" type="button" onClick={() => setStatusFilter("all")}>
            Show all tasks
          </button>
        </div>
      ) : (
        <div className="tasks-page-list project-task-list">
          {filteredTasks.map((task) => (
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

      {selectedTask && editValues && (
        <div
          className="task-modal-backdrop edit-task-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <section
            ref={editDialogRef}
            className="task-modal edit-task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-edit-task-title"
            aria-busy={savingTask || deletingTask}
          >
            <div className="task-modal-header edit-task-modal-header">
              <div>
                <p className="card-label">{project.name}</p>
                <h2 id="project-edit-task-title">Edit Task</h2>
                <p>Update this task without leaving the project.</p>
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
              projects={projects}
              projectsLoading={projectsLoading}
              projectsError={projectsError}
              onRetryProjects={onRetryProjects}
            />
          </section>
        </div>
      )}

      {deleteCandidate && (
        <div className="confirmation-backdrop">
          <section
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="project-delete-task-title"
            aria-busy={deletingTask}
          >
            <p className="card-label">Permanent action</p>
            <h3 id="project-delete-task-title">Delete this task?</h3>
            <p>“{deleteCandidate.title}” will be permanently removed from TaskFlow.</p>
            {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
            <div className="confirmation-actions">
              <button className="ghost-btn" type="button" onClick={cancelDelete} disabled={deletingTask}>
                Cancel
              </button>
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
