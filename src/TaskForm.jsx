import { useId, useState } from "react";
import {
  calculateReminderPreset,
  defaultReminderAt,
  getReminderValidationError,
  toDateTimeLocalValue,
} from "./domain/reminderDomain";
import { safeDisplayName } from "./domain/identityDomain";
import { requestNotificationPermission } from "./services/reminderService";

const reminderPresets = [
  ["at-time", "At time of task"],
  ["5-minutes", "5 minutes before"],
  ["15-minutes", "15 minutes before"],
  ["30-minutes", "30 minutes before"],
  ["1-hour", "1 hour before"],
  ["1-day", "1 day before"],
];

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
  defaultReminderMinutes = 15,
  browserNotificationsEnabled = true,
  projectMembers = [],
  projectStories = [],
}) {
  const projectFieldId = useId();
  const reminderFieldId = useId();
  const [reminderPreset, setReminderPreset] = useState("custom");
  const [reminderPresetError, setReminderPresetError] = useState("");
  const isStory = values.workType === "story";
  const selectedProjectId = values.projectId || "";
  const selectedProjectIsUnavailable =
    selectedProjectId &&
    !projects.some((project) => project.id === selectedProjectId);
  const reminderError = isStory ? "" : getReminderValidationError(values);

  const updateField = (name, value, type = "text") => {
    onChange({
      target: {
        name,
        value,
        type,
        checked: type === "checkbox" ? value : false,
      },
    });
  };

  const handleSubmit = (event) => {
    if (reminderError) {
      event.preventDefault();
      return;
    }

    onSubmit(event);
  };

  const handleReminderToggle = (event) => {
    const enabled = event.target.checked;
    updateField("reminder", enabled, "checkbox");
    setReminderPresetError("");

    if (!enabled) {
      updateField("reminderAt", "");
      setReminderPreset("custom");
      return;
    }

    if (browserNotificationsEnabled) void requestNotificationPermission();
    if (!values.reminderAt) {
      updateField(
        "reminderAt",
        toDateTimeLocalValue(
          defaultReminderAt(values, new Date(), defaultReminderMinutes)
        )
      );
      setReminderPreset("custom");
    }
  };

  const handleReminderPreset = (event) => {
    const preset = event.target.value;
    setReminderPreset(preset);
    setReminderPresetError("");
    if (preset === "custom") return;

    const reminderAt = calculateReminderPreset(values, preset);
    if (!reminderAt) {
      setReminderPresetError(
        "Choose a future task date and time before using this preset."
      );
      return;
    }

    if (!values.reminder) {
      updateField("reminder", true, "checkbox");
      if (browserNotificationsEnabled) void requestNotificationPermission();
    }
    updateField("reminderAt", toDateTimeLocalValue(reminderAt));
  };

  const clearReminder = () => {
    updateField("reminder", false, "checkbox");
    updateField("reminderAt", "");
    setReminderPreset("custom");
    setReminderPresetError("");
  };

  return (
    <form className={`task-editor-form${isStory ? " story-editor-form" : ""}`} onSubmit={handleSubmit} noValidate>
      <section className="task-form-section task-form-primary">
        <label className="task-form-field task-title-field">
          <span>{isStory ? "Story title" : "Task title"}</span>
          <input
            name="title"
            placeholder={isStory ? "What larger piece of work does this Story represent?" : "What needs to be done?"}
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
          <span>{isStory ? "Explain the outcome covered by this Story." : "Add context that will help when you return to this task."}</span>
        </div>

        <div className="task-form-supporting-grid">
          <label className="task-form-field">
            <span>Description</span>
            <textarea
              name="description"
              placeholder="Add a short description"
              rows="2"
              maxLength="1000"
              value={values.description}
              onChange={onChange}
              disabled={busy}
            />
            <small className="task-description-count">{String(values.description || "").length}/1000</small>
          </label>

        </div>
      </section>

      <section className="task-form-section task-form-organization">
        <div className="task-form-section-heading">
          <strong>{isStory ? "Planning" : "Organization"}</strong>
          <span>{isStory ? "Set ownership, timing, status, and priority." : "Choose where this task belongs and when it needs attention."}</span>
        </div>

        <div className="task-form-controls-grid">
          {!isStory && <label className="task-form-field">
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
          </label>}

          {!isStory && <div className="task-form-field task-project-field">
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
          </div>}

          {selectedProjectId && projectMembers.length > 0 && (
            <label className="task-form-field">
              <span>Assignee</span>
              <select
                name="assigneeId"
                value={values.assigneeId || ""}
                onChange={onChange}
                disabled={busy}
              >
                <option value="">Unassigned</option>
                {projectMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {safeDisplayName(member)} · {member.role}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedProjectId && values.workType !== "story" && projectStories.length > 0 && (
            <label className="task-form-field">
              <span>Story</span>
              <select
                name="storyId"
                value={values.storyId || ""}
                onChange={onChange}
                disabled={busy}
              >
                <option value="">No story</option>
                {projectStories.map((story) => (
                  <option key={story.id} value={story.id}>{story.title}</option>
                ))}
              </select>
            </label>
          )}

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

        {!isStory && <label className="task-reminder-field">
          <input
            type="checkbox"
            name="reminder"
            checked={values.reminder}
            onChange={handleReminderToggle}
            disabled={busy}
          />
          <span>
            <strong>Reminder</strong>
            Schedule a browser or in-app notification.
          </span>
        </label>}

        {!isStory && values.reminder && (
          <div className="task-reminder-controls">
            <label className="task-form-field" htmlFor={`${reminderFieldId}-preset`}>
              <span>Reminder timing</span>
              <select
                id={`${reminderFieldId}-preset`}
                value={reminderPreset}
                onChange={handleReminderPreset}
                disabled={busy}
              >
                <option value="custom">Custom date and time</option>
                {reminderPresets.map(([value, label]) => (
                  <option key={value} value={value} disabled={!values.dueDate}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="task-form-field" htmlFor={`${reminderFieldId}-date`}>
              <span>Date and time</span>
              <input
                id={`${reminderFieldId}-date`}
                type="datetime-local"
                name="reminderAt"
                value={values.reminderAt || ""}
                onChange={(event) => {
                  setReminderPreset("custom");
                  setReminderPresetError("");
                  onChange(event);
                }}
                disabled={busy}
              />
            </label>

            <button
              className="ghost-btn compact-btn task-reminder-clear"
              type="button"
              onClick={clearReminder}
              disabled={busy}
            >
              Clear reminder
            </button>

            {!values.reminderAt && (
              <p className="task-reminder-note">
                This reminder remains visual-only until a time is selected.
              </p>
            )}
            {reminderPresetError && (
              <p className="form-error" role="alert">
                {reminderPresetError}
              </p>
            )}
            {reminderError && (
              <p className="form-error" role="alert">
                {reminderError}
              </p>
            )}
          </div>
        )}
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
        <button
          className="primary-btn"
          type="submit"
          disabled={busy || Boolean(reminderError)}
        >
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
