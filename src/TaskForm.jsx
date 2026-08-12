import { useId } from "react";

export default function TaskForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busyLabel,
  busy = false,
  error = "",
  lists = [],
  projects = [],
  projectsLoading = false,
  projectsError = "",
  onRetryProjects,
}) {
  const projectFieldId = useId();
  const selectedProjectId = values.projectId || "";
  const selectedProjectIsUnavailable =
    selectedProjectId &&
    !projects.some((project) => project.id === selectedProjectId);

  return (
    <form className="task-editor-form" onSubmit={onSubmit} noValidate>
      <section className="task-form-section task-form-primary">
        <label className="task-form-field task-title-field">
          <span>Task title</span>
          <input
            name="title"
            placeholder="What needs to be done?"
            value={values.title}
            onChange={onChange}
            disabled={busy}
            autoFocus
          />
        </label>
      </section>

      <section className="task-form-section task-form-supporting">
        <div className="task-form-section-heading">
          <strong>Details</strong>
          <span>Add context that will help when you return to this task.</span>
        </div>

        <div className="task-form-supporting-grid">
          <label className="task-form-field">
            <span>Description</span>
            <textarea
              name="description"
              placeholder="Add a short description"
              rows="3"
              value={values.description}
              onChange={onChange}
              disabled={busy}
            />
          </label>

          <label className="task-form-field">
            <span>Notes</span>
            <textarea
              name="notes"
              placeholder="Capture supporting notes or context"
              rows="4"
              value={values.notes}
              onChange={onChange}
              disabled={busy}
            />
          </label>
        </div>
      </section>

      <section className="task-form-section task-form-organization">
        <div className="task-form-section-heading">
          <strong>Organization</strong>
          <span>Choose where this task belongs and when it needs attention.</span>
        </div>

        <div className="task-form-controls-grid">
          <label className="task-form-field">
            <span>List</span>
            <select
              name="listId"
              value={values.listId || ""}
              onChange={onChange}
              disabled={busy}
            >
              <option value="">Inbox</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>

          <div className="task-form-field task-project-field">
            <label htmlFor={projectFieldId}>Project</label>
            <select
              id={projectFieldId}
              name="projectId"
              value={selectedProjectId}
              onChange={onChange}
              disabled={busy || projectsLoading}
              aria-busy={projectsLoading}
            >
              <option value="">No project</option>
              {selectedProjectIsUnavailable && (
                <option value={selectedProjectId}>
                  Current project (unavailable)
                </option>
              )}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {projectsLoading && (
              <span className="task-project-feedback" role="status">
                Loading projects...
              </span>
            )}
            {!projectsLoading && projectsError && (
              <span className="task-project-feedback task-project-error" role="alert">
                <span>Projects could not be loaded.</span>
                {onRetryProjects && (
                  <button
                    type="button"
                    className="task-project-retry"
                    onClick={onRetryProjects}
                    disabled={busy}
                  >
                    Try again
                  </button>
                )}
              </span>
            )}
          </div>

          <label className="task-form-field">
            <span>Due date</span>
            <input
              type="date"
              name="dueDate"
              value={values.dueDate}
              onChange={onChange}
              onInput={onChange}
              disabled={busy}
            />
          </label>

          <label className="task-form-field">
            <span>Status</span>
            <select
              name="status"
              value={values.status}
              onChange={onChange}
              disabled={busy}
            >
              <option value="todo">To do</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label className="task-form-field">
            <span>Priority</span>
            <select
              name="priority"
              value={values.priority}
              onChange={onChange}
              disabled={busy}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <label className="task-reminder-field">
          <input
            type="checkbox"
            name="reminder"
            checked={values.reminder}
            onChange={onChange}
            disabled={busy}
          />
          <span>
            <strong>Reminder</strong>
            Keep this task visible in reminder summaries.
          </span>
        </label>
      </section>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="task-form-actions">
        <button
          className="ghost-btn"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
