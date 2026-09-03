import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Input, Textarea } from "../ui/Field";
import { InlineNotice } from "../ui/InlineNotice";
import { Icon } from "../ui/icons";
import { dateTimeLocalToIso } from "../domain/reminderDomain";
import { formatTimeForDisplay } from "../domain/settingsDomain";
import { useProjectContext } from "../projects/useProjectContext";
import { TaskProperties } from "./TaskProperties";

// `endDate`, `startTime` and `endTime` have no chip of their own, but the
// calendar week/day views seed them through `onNewTask`, so they are carried
// through the composer and submitted unchanged.
const EMPTY_VALUES = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  projectId: "",
  storyId: "",
  assigneeId: "",
  workType: "task",
  reminder: false,
  reminderAt: "",
};

const initialComposerValues = (initialValues = {}, workType = "task") => {
  const seeded = { ...EMPTY_VALUES, workType };
  Object.keys(EMPTY_VALUES).forEach((key) => {
    if (initialValues[key] !== undefined && initialValues[key] !== null) {
      seeded[key] = initialValues[key];
    }
  });
  seeded.workType = workType;
  return seeded;
};

/** The single create surface for tasks and stories. */
export function TaskComposerDialog({
  open = false,
  onClose,
  onSubmit,
  initialValues = {},
  userId = null,
  projects = [],
  lockProject = false,
  projectContext = null,
  workType = "task",
  browserNotificationsEnabled = true,
  defaultReminderMinutes = 15,
  formatSettings = {},
}) {
  const [values, setValues] = useState(() => initialComposerValues(initialValues, workType));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isStory = workType === "story";
  const needsContext = !projectContext && Boolean(values.projectId);
  const loadedContext = useProjectContext(userId, needsContext ? values.projectId : null);
  const projectMembers = projectContext?.members ?? loadedContext.members;
  const projectStories = projectContext?.stories ?? loadedContext.stories;

  // Re-seeding is tied to the dialog opening, not to every prop identity change.
  const seedRef = useRef({ initialValues, workType });
  seedRef.current = { initialValues, workType };

  useEffect(() => {
    if (!open) return;
    setValues(initialComposerValues(seedRef.current.initialValues, seedRef.current.workType));
    setError("");
    setBusy(false);
  }, [open]);

  const handleChange = (nameOrPatch, value) => {
    const patch =
      nameOrPatch && typeof nameOrPatch === "object" ? nameOrPatch : { [nameOrPatch]: value };
    setValues((current) => {
      const next = { ...current, ...patch };
      if ("projectId" in patch && patch.projectId !== current.projectId) {
        next.storyId = "";
        next.assigneeId = "";
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const title = String(values.title || "").trim();
    if (!title || busy) return;

    setBusy(true);
    setError("");
    try {
      await onSubmit?.({
        ...values,
        title,
        projectId: values.projectId || "",
        storyId: values.storyId || "",
        assigneeId: values.assigneeId || "",
        workType,
        reminder: values.reminder === true,
        reminderAt: values.reminder ? dateTimeLocalToIso(values.reminderAt) || "" : "",
      });
      onClose?.();
    } catch (submitError) {
      setError(
        submitError?.message || "We couldn't create this task. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const startLabel = values.startTime
    ? formatTimeForDisplay(values.startTime, formatSettings.format)
    : "";
  const endLabel = values.endTime
    ? formatTimeForDisplay(values.endTime, formatSettings.format)
    : "";
  const scheduleLabel = startLabel && endLabel ? `${startLabel}–${endLabel}` : startLabel;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="md"
      title={isStory ? "New story" : "New task"}
      className="composer"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!String(values.title || "").trim()}
            onClick={handleSubmit}
          >
            {isStory ? "Create story" : "Create task"}
          </Button>
        </>
      }
    >
      <div className="composer-body" onKeyDown={handleKeyDown}>
        <Input
          className="composer-title"
          autoFocus
          value={values.title}
          disabled={busy}
          placeholder={isStory ? "Story title" : "Task title"}
          aria-label={isStory ? "Story title" : "Task title"}
          onChange={(event) => handleChange("title", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
        />

        <Textarea
          className="composer-description"
          rows={2}
          maxLength={1000}
          value={values.description}
          disabled={busy}
          placeholder="Add a description…"
          aria-label="Description"
          onChange={(event) => handleChange("description", event.target.value)}
        />

        {scheduleLabel ? (
          <p className="composer-schedule" aria-label={`Scheduled ${scheduleLabel}`}>
            <Icon name="clock" size={12} />
            {scheduleLabel}
          </p>
        ) : null}

        <TaskProperties
          mode="composer"
          values={values}
          onChange={handleChange}
          disabled={busy}
          isStory={isStory}
          isPersonal={!values.projectId}
          showProject={!lockProject && !isStory}
          showReminder={!isStory}
          projects={projects}
          projectMembers={projectMembers}
          projectStories={projectStories}
          browserNotificationsEnabled={browserNotificationsEnabled}
          defaultReminderMinutes={defaultReminderMinutes}
        />

        {error ? (
          <InlineNotice tone="error" className="composer-error">
            {error}
          </InlineNotice>
        ) : null}
      </div>
    </Dialog>
  );
}

export default TaskComposerDialog;
