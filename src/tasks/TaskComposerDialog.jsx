import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Input, Textarea } from "../ui/Field";
import { InlineNotice } from "../ui/primitives";
import { Icon } from "../ui/icons";
import { dateTimeLocalToIso } from "../domain/reminder";
import { formatTimeForDisplay } from "../domain/settings";
import {
  selectComposer,
  selectEditableProjects,
  selectSettings,
  selectWorkspace,
} from "../store/selectors";
import { useStore } from "../store/store";
import { ensureWorkspace } from "../store/projects";
import { createTask } from "../store/tasks";
import { closeComposer } from "../store/ui";
import { TaskProperties } from "./TaskProperties";

const CREATE_ERROR =
  "We couldn't create this task. Check your connection and try again.";

// `endDate`, `startTime` and `endTime` have no chip of their own, but the
// calendar week/day views seed them through the composer's initial values, so
// they are carried through and submitted unchanged.
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

/** The single create surface for tasks and stories, driven by `ui.composer`. */
export function TaskComposerDialog() {
  const { open, initialValues, workType, lockProject } = useStore(selectComposer);
  const projects = useStore(selectEditableProjects);
  const settings = useStore(selectSettings);

  const [values, setValues] = useState(() => initialComposerValues(initialValues, workType));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const workspace = useStore(selectWorkspace(values.projectId || ""));
  const isStory = workType === "story";

  // Re-seeding is tied to the dialog opening, not to every prop identity change.
  const seedRef = useRef({ initialValues, workType });
  seedRef.current = { initialValues, workType };

  useEffect(() => {
    if (!open) return;
    setValues(initialComposerValues(seedRef.current.initialValues, seedRef.current.workType));
    setError("");
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open || !values.projectId) return;
    void ensureWorkspace(values.projectId);
  }, [open, values.projectId]);

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
    const created = await createTask({
      ...values,
      title,
      projectId: values.projectId || null,
      storyId: values.storyId || null,
      assigneeId: values.assigneeId || null,
      workType,
      reminder: values.reminder === true,
      reminderAt: values.reminder ? dateTimeLocalToIso(values.reminderAt) || "" : "",
    });
    setBusy(false);

    if (!created) {
      setError(CREATE_ERROR);
      return;
    }
    closeComposer();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const startLabel = values.startTime
    ? formatTimeForDisplay(values.startTime, settings.time.format)
    : "";
  const endLabel = values.endTime
    ? formatTimeForDisplay(values.endTime, settings.time.format)
    : "";
  const scheduleLabel = startLabel && endLabel ? `${startLabel}–${endLabel}` : startLabel;

  return (
    <Dialog
      open={open}
      onClose={closeComposer}
      busy={busy}
      size="md"
      title={isStory ? "New story" : "New task"}
      className="composer"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={closeComposer}>
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
          projectMembers={workspace.members}
          projectStories={workspace.stories}
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
