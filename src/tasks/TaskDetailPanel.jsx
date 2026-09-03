import { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/Dialog";
import { Checkbox } from "../ui/Field";
import { Icon } from "../ui/icons";
import { InlineNotice } from "../ui/InlineNotice";
import { SidePanel } from "../ui/SidePanel";
import { cx } from "../ui/cx";
import ActivityFeed from "../collaboration/ActivityFeed";
import AttachmentSection from "../collaboration/AttachmentSection";
import TaskComments from "../collaboration/TaskComments";
import { isArchived, isTaskComplete, taskFormValuesFromTask } from "../domain/taskDomain";
import { dateTimeLocalToIso } from "../domain/reminderDomain";
import { safeDisplayName } from "../domain/identityDomain";
import { BulkActionBar } from "./BulkActionBar";
import { QuickAdd, QuickAddTrigger } from "./QuickAdd";
import { StoryProgress } from "./StoryProgress";
import { TaskProperties } from "./TaskProperties";
import { TaskRow } from "./TaskRow";

const REMINDER_FIELDS = ["reminder", "reminderAt"];

const seedValues = (task) => ({
  ...taskFormValuesFromTask(task, []),
  assigneeId: task.assigneeId || "",
  assigneeName: task.assigneeName || "",
});

/**
 * Grow a textarea to fit its content. `field-sizing: content` does the same in
 * browsers that support it; this keeps the title and description readable
 * everywhere else (and never leaves a collapsed, seemingly empty box).
 */
const autoGrow = (element) => {
  if (!element?.style) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

const savePatchFor = (patch, values) => {
  const saved = {};

  Object.entries(patch).forEach(([name, value]) => {
    if (REMINDER_FIELDS.includes(name)) return;
    if (name === "status") {
      saved.status = value;
      saved.completed = value === "completed";
      return;
    }
    if (name === "projectId" || name === "storyId") {
      saved[name] = value || null;
      return;
    }
    saved[name] = value;
  });

  if (REMINDER_FIELDS.some((field) => field in patch)) {
    const reminder = ("reminder" in patch ? patch.reminder : values.reminder) === true;
    const reminderAt = "reminderAt" in patch ? patch.reminderAt : values.reminderAt;
    saved.reminder = reminder;
    saved.reminderAt = reminder ? dateTimeLocalToIso(reminderAt) || "" : "";
  }

  return saved;
};

/**
 * The one task/story detail surface. Every field auto-saves: the title and
 * description on blur or Enter, every other property immediately.
 */
export function TaskDetailPanel({
  task,
  userId = null,
  project = null,
  projectMembers = [],
  projectStories = [],
  projectColumns = [],
  projects = [],
  readOnly = false,
  contextLoading = false,
  onUpdate,
  onToggleComplete,
  onArchive,
  onRestore,
  onDelete,
  onSetAssignee,
  onClose,
  onOpenProject,
  returnFocusElement,
  relatedTasks = [],
  onOpenRelatedTask,
  onCreateRelatedTask,
  onBulkUpdateRelatedTasks,
  archiveLinkedTaskCount = 0,
  onAttachmentCountChange,
  browserNotificationsEnabled = true,
  defaultReminderMinutes = 15,
  formatSettings = {},
  todayKey,
  className,
}) {
  const [values, setValues] = useState(() => seedValues(task));
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [completeBusy, setCompleteBusy] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingStoryArchive, setConfirmingStoryArchive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [activityView, setActivityView] = useState("comments");
  const [selectedRelatedIds, setSelectedRelatedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState(null);
  const [relatedQuickAddOpen, setRelatedQuickAddOpen] = useState(false);

  const dirtyFieldRef = useRef(null);
  const seededTaskIdRef = useRef(task.id);
  const lastPatchRef = useRef(null);
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const returnFocusRef = useRef(returnFocusElement);
  returnFocusRef.current = returnFocusElement;

  const isStory = task.workType === "story";
  const archived = isArchived(task);
  const completed = isTaskComplete(task);
  const isPersonal = !task.projectId;
  const canCollaborate = Boolean(userId && task.projectId);
  const storyName = task.storyName || projectStories.find((story) => story.id === task.storyId)?.title || "";
  const projectCrumb = task.projectId
    ? project?.name || task.projectName || "Project"
    : "My tasks";
  const storyCrumb = !isStory && task.projectId ? storyName : "";
  const canOpenProject = Boolean(onOpenProject && task.projectId);
  const allRelatedSelected =
    relatedTasks.length > 0 && relatedTasks.every((related) => selectedRelatedIds.has(related.id));

  useEffect(() => {
    // A different task always wins; an edit in flight only survives a refresh of
    // the task it belongs to, so switching tasks can never show a stale (or
    // half-typed, or emptied) title.
    const sameTask = seededTaskIdRef.current === task.id;
    seededTaskIdRef.current = task.id;
    if (!sameTask) {
      dirtyFieldRef.current = null;
      setTitleError("");
    }
    const dirty = dirtyFieldRef.current;
    const next = seedValues(task);
    setValues((current) => (dirty ? { ...next, [dirty]: current[dirty] } : next));
  }, [task]);

  useEffect(() => {
    autoGrow(titleRef.current);
  }, [values.title]);

  useEffect(() => {
    autoGrow(descriptionRef.current);
  }, [values.description]);

  useEffect(() => {
    const visibleIds = new Set(relatedTasks.map((related) => related.id));
    setSelectedRelatedIds((current) => {
      const next = new Set([...current].filter((taskId) => visibleIds.has(taskId)));
      return next.size === current.size ? current : next;
    });
  }, [relatedTasks]);

  useEffect(() => {
    if (saveState !== "saved" || typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => setSaveState("idle"), 1500);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  useEffect(
    () => () => {
      returnFocusRef.current?.focus?.({ preventScroll: true });
    },
    []
  );

  const save = async (patch) => {
    if (!onUpdate || Object.keys(patch).length === 0) return;
    lastPatchRef.current = patch;
    setSaveState("saving");
    setSaveError("");
    try {
      await onUpdate(patch);
      setSaveState("saved");
      lastPatchRef.current = null;
    } catch (error) {
      setSaveState("error");
      setSaveError(error?.message || "We couldn't save your changes.");
    }
  };

  const retrySave = () => {
    const patch = lastPatchRef.current;
    if (patch) void save(patch);
  };

  const changeAssignee = async (assigneeId) => {
    if (!onSetAssignee) return;
    setSaveState("saving");
    setSaveError("");
    try {
      await onSetAssignee(assigneeId || null);
      setSaveState("saved");
    } catch (error) {
      setValues((current) => ({ ...current, assigneeId: task.assigneeId || "" }));
      setSaveState("error");
      setSaveError(error?.message || "We couldn't update this task's assignee.");
    }
  };

  const handlePropertyChange = (nameOrPatch, value) => {
    if (readOnly) return;
    const patch =
      nameOrPatch && typeof nameOrPatch === "object" ? nameOrPatch : { [nameOrPatch]: value };
    setValues((current) => ({ ...current, ...patch }));

    if ("assigneeId" in patch) {
      void changeAssignee(patch.assigneeId);
      return;
    }
    void save(savePatchFor(patch, values));
  };

  const commitTitle = () => {
    dirtyFieldRef.current = null;
    const nextTitle = String(values.title || "").trim();
    if (!nextTitle) {
      setTitleError("Enter a task title.");
      return;
    }
    setTitleError("");
    if (nextTitle === (task.title || "")) return;
    void save({ title: nextTitle });
  };

  const commitDescription = () => {
    dirtyFieldRef.current = null;
    const nextDescription = values.description || "";
    if (nextDescription === (task.description || "")) return;
    void save({ description: nextDescription });
  };

  const handleToggleComplete = async () => {
    if (!onToggleComplete || completeBusy) return;
    setCompleteBusy(true);
    try {
      await onToggleComplete();
    } catch (error) {
      setSaveState("error");
      setSaveError(error?.message || "We couldn't update this task.");
    } finally {
      setCompleteBusy(false);
    }
  };

  const performLifecycle = async (options) => {
    const action = archived ? onRestore : onArchive;
    if (!action || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError("");
    try {
      await (options === undefined ? action() : action(options));
      setConfirmingStoryArchive(false);
      onClose?.();
    } catch {
      setLifecycleError(
        `We couldn't ${archived ? "restore" : "archive"} this ${isStory ? "story" : "task"}. Check your connection and try again.`
      );
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleLifecycle = () => {
    if (!archived && isStory && archiveLinkedTaskCount > 0) {
      setLifecycleError("");
      setConfirmingStoryArchive(true);
      return;
    }
    void performLifecycle();
  };

  const confirmDelete = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete();
      setConfirmingDelete(false);
      onClose?.();
    } catch {
      setDeleteError("We couldn't delete this task. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleRelatedSelection = (taskId) => {
    setBulkMessage(null);
    setSelectedRelatedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAllRelated = () => {
    setBulkMessage(null);
    setSelectedRelatedIds(
      allRelatedSelected ? new Set() : new Set(relatedTasks.map((related) => related.id))
    );
  };

  const runBulkUpdate = async (type, value) => {
    if (!onBulkUpdateRelatedTasks || bulkBusy || selectedRelatedIds.size === 0) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const result = await onBulkUpdateRelatedTasks([...selectedRelatedIds], { type, value });
      const updated = result?.updated || 0;
      const failed = result?.failed || 0;
      setSelectedRelatedIds(new Set(result?.failedIds || []));
      setBulkMessage({
        error: failed > 0,
        text:
          failed > 0
            ? `${updated} of ${updated + failed} tasks updated; ${failed} failed due to permissions or another error.`
            : `${updated} ${updated === 1 ? "task" : "tasks"} updated.`,
      });
    } catch (error) {
      setBulkMessage({
        error: true,
        text: error?.message || "We couldn't update the selected tasks.",
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleAttachmentCount = (entityId, count) => {
    onAttachmentCountChange?.(entityId, count);
  };

  const saveStateText =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Couldn't save"
          : "";

  const header = (
    <div className="panel-head">
      <div className="panel-crumbs">
        {canOpenProject ? (
          <button
            type="button"
            className="panel-crumb panel-crumb-link truncate"
            title={projectCrumb}
            onClick={() => onOpenProject()}
          >
            {projectCrumb}
          </button>
        ) : (
          <span className="panel-crumb truncate" title={projectCrumb}>
            {projectCrumb}
          </span>
        )}
        {storyCrumb ? (
          <>
            <span className="panel-crumb-separator" aria-hidden="true">
              ›
            </span>
            <span className="panel-crumb truncate" title={storyCrumb}>
              {storyCrumb}
            </span>
          </>
        ) : null}
      </div>
      <div className="panel-head-actions">
        {readOnly ? (
          <Badge tone="neutral">View only</Badge>
        ) : (
          <>
            {onToggleComplete ? (
              <Button
                variant="secondary"
                size="sm"
                className={cx("panel-complete", completed && "is-complete")}
                icon={<Icon name="check" />}
                loading={completeBusy}
                onClick={handleToggleComplete}
              >
                {completed ? "Completed" : "Mark complete"}
              </Button>
            ) : null}
            {(archived ? onRestore : onArchive) ? (
              <IconButton
                label={archived ? "Restore task" : "Archive task"}
                size="sm"
                disabled={lifecycleBusy}
                onClick={handleLifecycle}
              >
                <Icon name={archived ? "archive-restore" : "archive"} />
              </IconButton>
            ) : null}
            {onDelete ? (
              <IconButton
                label={archived ? "Delete permanently" : isStory ? "Delete story" : "Delete task"}
                size="sm"
                onClick={() => {
                  setDeleteError("");
                  setConfirmingDelete(true);
                }}
              >
                <Icon name="trash" />
              </IconButton>
            ) : null}
          </>
        )}
        <IconButton label="Close panel" size="sm" onClick={onClose}>
          <Icon name="x" />
        </IconButton>
      </div>
    </div>
  );

  return (
    <>
      <SidePanel
        open
        onClose={onClose}
        ariaLabel={isStory ? "Story details" : "Task details"}
        header={header}
        className={cx("task-panel", className)}
      >
        {lifecycleError ? <InlineNotice tone="error">{lifecycleError}</InlineNotice> : null}

        <div className="panel-heading">
          <p className="panel-save-state" role="status" aria-live="polite">
            {saveStateText}
            {saveState === "error" ? (
              <>
                <span className="panel-save-error">{saveError}</span>
                <Button variant="ghost" size="sm" onClick={retrySave}>
                  Retry
                </Button>
              </>
            ) : null}
          </p>

          <textarea
            ref={titleRef}
            className="panel-title"
            rows={1}
            placeholder="Untitled task"
            aria-label={isStory ? "Story title" : "Task title"}
            value={values.title ?? ""}
            disabled={readOnly}
            onChange={(event) => {
              dirtyFieldRef.current = "title";
              setTitleError("");
              setValues((current) => ({ ...current, title: event.target.value }));
            }}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTitle();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                dirtyFieldRef.current = null;
                setTitleError("");
                setValues((current) => ({ ...current, title: task.title || "" }));
              }
            }}
          />
          {titleError ? (
            <p className="panel-error" role="alert">
              {titleError}
            </p>
          ) : null}
        </div>

        <TaskProperties
          values={values}
          mode="panel"
          isStory={isStory}
          isPersonal={isPersonal}
          projects={projects}
          projectMembers={projectMembers}
          projectStories={projectStories.filter((story) => story.id !== task.id)}
          disabled={readOnly || contextLoading}
          browserNotificationsEnabled={browserNotificationsEnabled}
          defaultReminderMinutes={defaultReminderMinutes}
          onChange={handlePropertyChange}
        />

        <label className="panel-description-field">
          <span className="panel-section-label">Description</span>
          <textarea
            ref={descriptionRef}
            className="panel-description"
            placeholder="Add a description…"
            maxLength={1000}
            rows={3}
            value={values.description ?? ""}
            disabled={readOnly}
            onChange={(event) => {
              dirtyFieldRef.current = "description";
              setValues((current) => ({ ...current, description: event.target.value }));
            }}
            onBlur={commitDescription}
          />
          {String(values.description || "").length > 900 ? (
            <span className="panel-char-count">{`${String(values.description).length}/1000`}</span>
          ) : null}
        </label>

        {isStory ? (
          <>
            <div className="divider" />
            <section className="panel-section" aria-label={`Tasks in ${task.title}`}>
              <StoryProgress tasks={relatedTasks} columns={projectColumns} />

              <div className="panel-section-header">
                <h3 className="section-title">Tasks</h3>
                <span className="section-meta">{relatedTasks.length}</span>
                {!readOnly && onBulkUpdateRelatedTasks && relatedTasks.length > 0 ? (
                  <Checkbox
                    className="panel-select-all"
                    label="Select all"
                    checked={allRelatedSelected}
                    disabled={bulkBusy}
                    onChange={toggleAllRelated}
                  />
                ) : null}
              </div>

              {!readOnly && onBulkUpdateRelatedTasks ? (
                <BulkActionBar
                  selectedCount={selectedRelatedIds.size}
                  members={projectMembers}
                  stories={projectStories}
                  currentStoryId={task.id}
                  busy={bulkBusy}
                  onAction={runBulkUpdate}
                  onClear={() => {
                    setSelectedRelatedIds(new Set());
                    setBulkMessage(null);
                  }}
                />
              ) : null}

              {bulkMessage ? (
                <p
                  className={cx("panel-bulk-message", bulkMessage.error && "is-error")}
                  role={bulkMessage.error ? "alert" : "status"}
                >
                  {bulkMessage.text}
                </p>
              ) : null}

              <div className="row-list">
                {relatedTasks.map((related) => (
                  <TaskRow
                    key={related.id}
                    task={related}
                    dense
                    showProject={false}
                    showStory={false}
                    readOnly={readOnly}
                    selectable={!readOnly && Boolean(onBulkUpdateRelatedTasks)}
                    selectedForBulk={selectedRelatedIds.has(related.id)}
                    onToggleSelect={toggleRelatedSelection}
                    onOpen={onOpenRelatedTask ? (openedTask) => onOpenRelatedTask(openedTask) : undefined}
                    todayKey={todayKey}
                    formatSettings={formatSettings}
                    context={{ membersById: new Map(projectMembers.map((member) => [member.userId, member])) }}
                  />
                ))}
              </div>

              {!readOnly && onCreateRelatedTask ? (
                relatedQuickAddOpen ? (
                  <QuickAdd
                    contextLabel={task.title}
                    onCreate={(title) => onCreateRelatedTask(title)}
                    onCancel={() => setRelatedQuickAddOpen(false)}
                  />
                ) : (
                  <QuickAddTrigger onClick={() => setRelatedQuickAddOpen(true)} />
                )
              ) : null}
            </section>
          </>
        ) : null}

        {canCollaborate ? (
          <>
            <div className="divider" />
            <div className="panel-section panel-attachments">
              <AttachmentSection
                projectId={task.projectId}
                entityType={isStory ? "story" : "task"}
                entityId={task.id}
                userId={userId}
                uploaderName={safeDisplayName(projectMembers.find((member) => member.userId === userId))}
                canManage={!readOnly}
                compact
                allowDrop={!isStory}
                onCountChange={handleAttachmentCount}
              />
            </div>

            <div className="divider" />
            <section className="panel-section panel-activity" aria-label="Activity">
              <div className="panel-section-header">
                <h3 className="section-title">Activity</h3>
                <div className="text-switch" role="tablist" aria-label="Activity view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activityView === "comments"}
                    className={cx("text-switch-option", activityView === "comments" && "is-active")}
                    onClick={() => setActivityView("comments")}
                  >
                    Comments
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activityView === "all"}
                    className={cx("text-switch-option", activityView === "all" && "is-active")}
                    onClick={() => setActivityView("all")}
                  >
                    All
                  </button>
                </div>
              </div>
              {activityView === "comments" ? (
                <TaskComments
                  userId={userId}
                  taskId={task.id}
                  members={projectMembers}
                  compact
                />
              ) : (
                <ActivityFeed
                  userId={userId}
                  projectId={task.projectId}
                  taskId={task.id}
                  includeComments
                  compact
                  members={projectMembers}
                />
              )}
            </section>
          </>
        ) : null}
      </SidePanel>

      <ConfirmDialog
        open={confirmingDelete}
        danger
        busy={deleting}
        title={
          isStory
            ? "Delete this story?"
            : archived
              ? "Delete this archived task permanently?"
              : "Delete this task?"
        }
        description={
          isStory
            ? `Delete “${task.title}”? Linked tasks move to no story.`
            : `Delete “${task.title}” permanently?`
        }
        confirmLabel={isStory ? "Delete story" : archived ? "Delete permanently" : "Delete task"}
        onCancel={() => {
          if (deleting) return;
          setDeleteError("");
          setConfirmingDelete(false);
        }}
        onConfirm={confirmDelete}
      >
        {deleteError ? <InlineNotice tone="error">{deleteError}</InlineNotice> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmingStoryArchive}
        busy={lifecycleBusy}
        title="Move linked tasks before archiving?"
        description={`“${task.title}” has ${archiveLinkedTaskCount} linked ${archiveLinkedTaskCount === 1 ? "task" : "tasks"}. They move to “No story” before this story is archived.`}
        confirmLabel="Move tasks to no story"
        onCancel={() => {
          if (lifecycleBusy) return;
          setLifecycleError("");
          setConfirmingStoryArchive(false);
        }}
        onConfirm={() => performLifecycle({ moveLinkedTasksToUncategorized: true })}
      >
        {lifecycleError ? <InlineNotice tone="error">{lifecycleError}</InlineNotice> : null}
      </ConfirmDialog>
    </>
  );
}

export default TaskDetailPanel;
