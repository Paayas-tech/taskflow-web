import { useId, useState } from "react";
import { Avatar, cx } from "../ui/primitives";
import { IconButton } from "../ui/Button";
import { Checkbox, Select } from "../ui/Field";
import { Icon, PriorityIcon, StatusIcon } from "../ui/icons";
import { safeDisplayName } from "../domain/collaboration";
import { priorityLabel, statusLabel } from "../domain/task";
import {
  calculateReminderPreset,
  defaultReminderAt,
  getReminderValidationError,
  toDateTimeLocalValue,
} from "../domain/reminder";
import { requestNotificationPermission } from "../store/reminders";
import { selectSettings } from "../store/selectors";
import { useStore } from "../store/store";

const REMINDER_PRESETS = [
  ["at-time", "At time of task"],
  ["5-minutes", "5 minutes before"],
  ["15-minutes", "15 minutes before"],
  ["30-minutes", "30 minutes before"],
  ["1-hour", "1 hour before"],
  ["1-day", "1 day before"],
];

// `[value, label]` pairs, the shape every property `<Select>` takes.
const STATUS_OPTIONS = ["todo", "in-progress", "completed"].map((status) => [
  status,
  statusLabel(status),
]);
const PRIORITY_OPTIONS = ["low", "medium", "high"].map((priority) => [
  priority,
  priorityLabel(priority),
]);

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
  errors = {},
  className,
  ...rest
}) {
  const fieldId = useId();
  const [reminderPreset, setReminderPreset] = useState("custom");
  const [presetError, setPresetError] = useState("");
  const { enableBrowserNotifications, defaultTime } = useStore(selectSettings).reminder;

  const emit = (nameOrPatch, value) => onChange?.(nameOrPatch, value);

  const projectVisible = showProject ?? isPersonal;
  const assigneeVisible = !isPersonal && projectMembers.length > 0;
  const storyVisible = !isPersonal && !isStory;
  const reminderVisible = showReminder && isPersonal && !isStory;

  const selectedProjectId = values.projectId || "";
  const selectedProjectMissing =
    selectedProjectId && !projects.some((project) => project.id === selectedProjectId);
  const selectedMember = projectMembers.find((member) => member.userId === values.assigneeId);
  const reminderError =
    errors.reminderAt || (reminderVisible ? getReminderValidationError(values) : "");

  const handleReminderToggle = (enabled) => {
    setPresetError("");
    setReminderPreset("custom");

    if (!enabled) {
      emit({ reminder: false, reminderAt: "" });
      return;
    }

    if (enableBrowserNotifications) void requestNotificationPermission();
    emit({
      reminder: true,
      reminderAt:
        values.reminderAt ||
        toDateTimeLocalValue(defaultReminderAt(values, new Date(), defaultTime)),
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

    if (enableBrowserNotifications && !values.reminder) void requestNotificationPermission();
    emit({ reminder: true, reminderAt: toDateTimeLocalValue(reminderAt) });
  };

  /** One property `<Select>`. `options` are `[value, label]` pairs. */
  const select = (idSuffix, label, name, value, options) => (
    <Select
      id={`${fieldId}-${idSuffix}`}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => emit(name, event.target.value)}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </Select>
  );

  // `labelIcon` names the icon of the row's label; a row without its own `icon`
  // reuses it at chip size. `slot` puts that icon inside the select itself.
  const rows = [
    {
      id: "status",
      label: "Status",
      labelIcon: "circle-dot",
      icon: <StatusIcon status={values.status || "todo"} size={14} />,
      slot: true,
      control: select("status", "Status", "status", values.status || "todo", STATUS_OPTIONS),
    },
    {
      id: "priority",
      label: "Priority",
      labelIcon: "flag",
      icon: <PriorityIcon priority={values.priority || "medium"} size={14} />,
      slot: true,
      control: select(
        "priority",
        "Priority",
        "priority",
        values.priority || "medium",
        PRIORITY_OPTIONS
      ),
    },
    {
      id: "dueDate",
      label: "Due date",
      labelIcon: "calendar",
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
    },
    assigneeVisible && {
      id: "assigneeId",
      label: "Assignee",
      labelIcon: "user",
      icon: values.assigneeId ? (
        <Avatar
          size="sm"
          name={
            values.assigneeName ||
            (selectedMember ? safeDisplayName(selectedMember) : "TaskFlow user")
          }
        />
      ) : null,
      error: errors.assigneeId,
      control: select("assignee", "Assignee", "assigneeId", values.assigneeId || "", [
        ["", "Unassigned"],
        ...projectMembers.map((member) => [
          member.userId,
          `${safeDisplayName(member)} · ${member.role}`,
        ]),
      ]),
    },
    storyVisible && {
      id: "storyId",
      label: "Story",
      labelIcon: "book",
      control: select("story", "Story", "storyId", values.storyId || "", [
        ["", "No story"],
        ...projectStories.map((story) => [story.id, story.title]),
      ]),
    },
    projectVisible && {
      id: "projectId",
      label: "Project",
      labelIcon: "folder",
      error: errors.projectId,
      control: select("project", "Project", "projectId", selectedProjectId, [
        ["", "No project"],
        ...(selectedProjectMissing
          ? [[selectedProjectId, "Current project (unavailable)"]]
          : []),
        ...projects.map((project) => [project.id, project.name]),
      ]),
    },
    reminderVisible && {
      id: "reminder",
      label: "Reminder",
      labelIcon: "bell",
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
                  const reminderAt = event.target.value;
                  emit({ reminder: Boolean(reminderAt), reminderAt });
                }}
              />
            </>
          ) : null}
        </div>
      ),
    },
  ].filter(Boolean);

  if (mode === "composer") {
    return (
      <div className={cx("props", "props-chips", className)} {...rest}>
        {rows.map((row) => (
          <div className={cx("props-chip", `props-chip-${row.id}`)} key={row.id}>
            <span className="props-chip-icon" aria-hidden="true">{row.icon || <Icon name={row.labelIcon} size={14} />}</span>
            {row.control}
            {row.error ? <p className="prop-error" role="alert">{row.error}</p> : null}
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
            <span className="prop-label-icon" aria-hidden="true"><Icon name={row.labelIcon} /></span>
            <span className="prop-label-text">{row.label}</span>
          </span>
          <div className="prop-control">
            {row.slot ? (
              <span className="prop-select">
                <span className="prop-select-icon" aria-hidden="true">{row.icon}</span>
                {row.control}
              </span>
            ) : (
              row.control
            )}
            {row.error ? <p className="prop-error" role="alert">{row.error}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
