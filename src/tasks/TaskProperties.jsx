import { useId, useState } from "react";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/Button";
import { Checkbox, Select } from "../ui/Field";
import { Icon, PriorityIcon, StatusIcon } from "../ui/icons";
import { cx } from "../ui/cx";
import { safeDisplayName } from "../domain/identityDomain";
import {
  calculateReminderPreset,
  defaultReminderAt,
  getReminderValidationError,
  toDateTimeLocalValue,
} from "../domain/reminderDomain";
import { requestNotificationPermission } from "../services/reminderService";
import { priorityLabel, statusLabel } from "./taskPresentation";

const REMINDER_PRESETS = [
  ["at-time", "At time of task"],
  ["5-minutes", "5 minutes before"],
  ["15-minutes", "15 minutes before"],
  ["30-minutes", "30 minutes before"],
  ["1-hour", "1 hour before"],
  ["1-day", "1 day before"],
];

const STATUS_OPTIONS = ["todo", "in-progress", "completed"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];

/**
 * The property rows shared by the detail panel (`mode="panel"`, a label grid)
 * and the composer (`mode="composer"`, a wrapping chip row).
 *
 * `onChange` accepts either `(name, value)` or a single patch object, which the
 * reminder controls use so a paired `{ reminder, reminderAt }` change saves once.
 */
export function TaskProperties({
  values,
  onChange,
  disabled = false,
  mode = "panel",
  isStory = false,
  isPersonal = false,
  projects = [],
  projectMembers = [],
  projectStories = [],
  showProject,
  showReminder = true,
  browserNotificationsEnabled = true,
  defaultReminderMinutes = 15,
  errors = {},
  className,
  ...rest
}) {
  const fieldId = useId();
  const [reminderPreset, setReminderPreset] = useState("custom");
  const [presetError, setPresetError] = useState("");

  const emit = (nameOrPatch, value) => {
    if (nameOrPatch && typeof nameOrPatch === "object") {
      onChange?.(nameOrPatch);
      return;
    }
    onChange?.(nameOrPatch, value);
  };

  const projectVisible = showProject ?? isPersonal;
  const assigneeVisible = !isPersonal && projectMembers.length > 0;
  const storyVisible = !isPersonal && !isStory;
  const reminderVisible = showReminder && isPersonal && !isStory;

  const selectedProjectId = values.projectId || "";
  const selectedProjectMissing =
    selectedProjectId && !projects.some((project) => project.id === selectedProjectId);
  const selectedMember = projectMembers.find((member) => member.userId === values.assigneeId);
  const reminderError = errors.reminderAt || (reminderVisible ? getReminderValidationError(values) : "");

  const handleReminderToggle = (enabled) => {
    setPresetError("");
    setReminderPreset("custom");

    if (!enabled) {
      emit({ reminder: false, reminderAt: "" });
      return;
    }

    if (browserNotificationsEnabled) void requestNotificationPermission();
    emit({
      reminder: true,
      reminderAt:
        values.reminderAt ||
        toDateTimeLocalValue(defaultReminderAt(values, new Date(), defaultReminderMinutes)),
    });
  };

  const handleReminderPreset = (preset) => {
    setReminderPreset(preset);
    setPresetError("");
    if (preset === "custom") return;

    const reminderAt = calculateReminderPreset(values, preset);
    if (!reminderAt) {
      setPresetError("Choose a future task date and time before using this preset.");
      return;
    }

    if (browserNotificationsEnabled && !values.reminder) void requestNotificationPermission();
    emit({ reminder: true, reminderAt: toDateTimeLocalValue(reminderAt) });
  };

  const rows = [];

  rows.push({
    id: "status",
    label: "Status",
    labelIcon: <Icon name="circle-dot" />,
    icon: <StatusIcon status={values.status || "todo"} size={14} />,
    slotIcon: <StatusIcon status={values.status || "todo"} size={14} />,
    control: (
      <Select
        id={`${fieldId}-status`}
        aria-label="Status"
        value={values.status || "todo"}
        disabled={disabled}
        onChange={(event) => emit("status", event.target.value)}
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {statusLabel(status)}
          </option>
        ))}
      </Select>
    ),
  });

  rows.push({
    id: "priority",
    label: "Priority",
    labelIcon: <Icon name="flag" />,
    icon: <PriorityIcon priority={values.priority || "medium"} size={14} />,
    slotIcon: <PriorityIcon priority={values.priority || "medium"} size={14} />,
    control: (
      <Select
        id={`${fieldId}-priority`}
        aria-label="Priority"
        value={values.priority || "medium"}
        disabled={disabled}
        onChange={(event) => emit("priority", event.target.value)}
      >
        {PRIORITY_OPTIONS.map((priority) => (
          <option key={priority} value={priority}>
            {priorityLabel(priority)}
          </option>
        ))}
      </Select>
    ),
  });

  rows.push({
    id: "dueDate",
    label: "Due date",
    labelIcon: <Icon name="calendar" />,
    icon: <Icon name="calendar" size={14} />,
    error: errors.dueDate,
    control: (
      <span className="prop-date">
        <input
          id={`${fieldId}-due-date`}
          className="input"
          type="date"
          aria-label="Due date"
          value={values.dueDate || ""}
          disabled={disabled}
          onChange={(event) => emit("dueDate", event.target.value)}
        />
        {values.dueDate ? (
          <IconButton
            label="Clear due date"
            size="sm"
            disabled={disabled}
            onClick={() => emit("dueDate", "")}
          >
            <Icon name="x" />
          </IconButton>
        ) : null}
      </span>
    ),
  });

  if (assigneeVisible) {
    rows.push({
      id: "assigneeId",
      label: "Assignee",
      labelIcon: <Icon name="user" />,
      icon: values.assigneeId ? (
        <Avatar
          size="sm"
          name={
            values.assigneeName ||
            (selectedMember ? safeDisplayName(selectedMember) : "TaskFlow user")
          }
        />
      ) : (
        <Icon name="user" size={14} />
      ),
      error: errors.assigneeId,
      control: (
        <Select
          id={`${fieldId}-assignee`}
          aria-label="Assignee"
          value={values.assigneeId || ""}
          disabled={disabled}
          onChange={(event) => emit("assigneeId", event.target.value)}
        >
          <option value="">Unassigned</option>
          {projectMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {`${safeDisplayName(member)} · ${member.role}`}
            </option>
          ))}
        </Select>
      ),
    });
  }

  if (storyVisible) {
    rows.push({
      id: "storyId",
      label: "Story",
      labelIcon: <Icon name="book" />,
      icon: <Icon name="book" size={14} />,
      control: (
        <Select
          id={`${fieldId}-story`}
          aria-label="Story"
          value={values.storyId || ""}
          disabled={disabled}
          onChange={(event) => emit("storyId", event.target.value)}
        >
          <option value="">No story</option>
          {projectStories.map((story) => (
            <option key={story.id} value={story.id}>
              {story.title}
            </option>
          ))}
        </Select>
      ),
    });
  }

  if (projectVisible) {
    rows.push({
      id: "projectId",
      label: "Project",
      labelIcon: <Icon name="folder" />,
      icon: <Icon name="folder" size={14} />,
      error: errors.projectId,
      control: (
        <Select
          id={`${fieldId}-project`}
          aria-label="Project"
          value={selectedProjectId}
          disabled={disabled}
          onChange={(event) => emit("projectId", event.target.value)}
        >
          <option value="">No project</option>
          {selectedProjectMissing ? (
            <option value={selectedProjectId}>Current project (unavailable)</option>
          ) : null}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      ),
    });
  }

  if (reminderVisible) {
    rows.push({
      id: "reminder",
      label: "Reminder",
      labelIcon: <Icon name="bell" />,
      icon: <Icon name="bell" size={14} />,
      error: presetError || reminderError,
      control: (
        <div className="prop-reminder">
          <Checkbox
            label="Remind me"
            checked={values.reminder === true}
            disabled={disabled}
            onChange={(event) => handleReminderToggle(event.target.checked)}
          />
          {values.reminder ? (
            <>
              <Select
                id={`${fieldId}-reminder-preset`}
                aria-label="Reminder timing"
                value={reminderPreset}
                disabled={disabled}
                onChange={(event) => handleReminderPreset(event.target.value)}
              >
                <option value="custom">Custom date and time</option>
                {REMINDER_PRESETS.map(([value, label]) => (
                  <option key={value} value={value} disabled={!values.dueDate}>
                    {label}
                  </option>
                ))}
              </Select>
              <input
                id={`${fieldId}-reminder-at`}
                className="input"
                type="datetime-local"
                aria-label="Reminder date and time"
                value={values.reminderAt || ""}
                disabled={disabled}
                onChange={(event) => {
                  setReminderPreset("custom");
                  setPresetError("");
                  emit({ reminder: true, reminderAt: event.target.value });
                }}
              />
            </>
          ) : null}
        </div>
      ),
    });
  }

  if (mode === "composer") {
    return (
      <div className={cx("props", "props-chips", className)} {...rest}>
        {rows.map((row) => (
          <div className={cx("props-chip", `props-chip-${row.id}`)} key={row.id}>
            <span className="props-chip-icon" aria-hidden="true">
              {row.icon}
            </span>
            {row.control}
            {row.error ? (
              <p className="prop-error" role="alert">
                {row.error}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cx("props", "props-grid", className)} {...rest}>
      {rows.map((row) => (
        <div className={cx("prop-row", `prop-row-${row.id}`)} key={row.id}>
          <span className="prop-label">
            <span className="prop-label-icon" aria-hidden="true">
              {row.labelIcon}
            </span>
            <span className="prop-label-text">{row.label}</span>
          </span>
          <div className="prop-control">
            {row.slotIcon ? (
              <span className="prop-select">
                <span className="prop-select-icon" aria-hidden="true">
                  {row.slotIcon}
                </span>
                {row.control}
              </span>
            ) : (
              row.control
            )}
            {row.error ? (
              <p className="prop-error" role="alert">
                {row.error}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TaskProperties;
