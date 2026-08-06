export default function TaskForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busyLabel,
  busy = false,
  error = "",
}) {
  return (
    <form className="task-editor-form" onSubmit={onSubmit} noValidate>
      <label className="task-form-field task-form-field-wide">
        <span>Title</span>
        <input
          name="title"
          placeholder="What needs to be done?"
          value={values.title}
          onChange={onChange}
          disabled={busy}
          autoFocus
        />
      </label>

      <label className="task-form-field task-form-field-wide">
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

      <label className="task-form-field task-form-field-wide">
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
