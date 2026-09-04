import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, InlineNotice, cx } from "../ui/primitives";
import { Button, IconButton } from "../ui/Button";
import { ConfirmDialog, SidePanel } from "../ui/Dialog";
import { Checkbox } from "../ui/Field";
import { Icon } from "../ui/icons";
import { ActivityFeed } from "../collaboration/ActivityFeed";
import { AttachmentSection } from "../collaboration/AttachmentSection";
import { TaskComments } from "../collaboration/TaskComments";
import { isArchived, isTaskComplete, taskFormValuesFromTask } from "../domain/task";
import { dateTimeLocalToIso } from "../domain/reminder";
import {
  selectEditableProjects,
  selectTask,
  selectUser,
  selectWorkspace,
} from "../store/selectors";
import { useStore } from "../store/store";
import { ensureWorkspace } from "../store/projects";
import {
  archiveTask,
  bulkUpdate,
  createTask,
  deleteTask,
  restoreTask,
  setAssignee,
  toggleComplete,
  updateTask,
} from "../store/tasks";
import { closeTask, openTask, openTaskInProject } from "../store/ui";
import { BulkActionBar } from "./BulkActionBar";
import { QuickAdd, QuickAddTrigger } from "./QuickAdd";
import { StoryProgress } from "./StoryProgress";
import { TaskProperties } from "./TaskProperties";
import { TaskRow } from "./TaskRow";

const REMINDER_FIELDS = ["reminder", "reminderAt"];
const SAVE_TEXT = { saving: "Saving…", saved: "Saved", error: "Couldn't save" };
const ACTIVITY_VIEWS = [
  ["comments", "Comments"],
  ["all", "All"],
];

/**
 * Opening a task from a story's task list remembers the story, so closing that
 * task returns to it. Module scope, not component state: it is set while the
 * previous task is still rendered, and cleared once the panel closes.
 */
let storyReturn = null;

const seedValues = (task) => ({
  ...taskFormValuesFromTask(task),
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

/**
 * Form values → the fields the store saves. Only the reminder needs rewriting:
 * the input holds a `datetime-local` value and the store stores an ISO one, and
 * the pair is saved together so a reminder without a time keeps neither.
 * Everything else (status ↔ completed, blank ids → null) `updateTask` derives.
 */
const savePatchFor = (patch, values) => {
  if (!REMINDER_FIELDS.some((field) => field in patch)) return patch;

  const merged = { ...values, ...patch };
  const reminder = merged.reminder === true;
  return {
    ...patch,
    reminder,
    reminderAt: reminder ? dateTimeLocalToIso(merged.reminderAt) || "" : "",
  };
};

/**
 * The one task/story detail surface. It reads the task and its project context
 * from the store and every field auto-saves through the store actions: the
 * title and description on blur or Enter, every other property immediately.
 */
export function TaskDetailPanel({ taskId }) {
  const task = useStore(selectTask(taskId));
  const projectId = task?.projectId || "";
  const workspace = useStore(selectWorkspace(projectId));
  const projects = useStore(selectEditableProjects);
  const userId = useStore(selectUser)?.id || null;

  const [values, setValues] = useState(() => seedValues(task || {}));
  /** `{ state, error }`: one save is in flight at a time, so one status line. */
  const [saveStatus, setSaveStatus] = useState({ state: "idle", error: "" });
  const [titleError, setTitleError] = useState("");
  /** The one action in flight: complete | lifecycle | delete | bulk. */
  const [pending, setPending] = useState("");
  /** The open confirmation, if any: delete | story-archive. */
  const [confirming, setConfirming] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [activityView, setActivityView] = useState("comments");
  const [selectedRelatedIds, setSelectedRelatedIds] = useState(() => new Set());
  const [bulkMessage, setBulkMessage] = useState(null);
  const [relatedQuickAddOpen, setRelatedQuickAddOpen] = useState(false);

  const dirtyFieldRef = useRef(null);
  const seededTaskIdRef = useRef(taskId);
  const lastPatchRef = useRef(null);
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);

  /**
   * Everything above that belongs to one task and one visit. The panel is never
   * unmounted — App renders it for whichever task is selected — so switching
   * tasks, or closing it, has to clear this by hand; otherwise a stale error, an
   * open confirmation or a queued retry patch lands on the next task.
   */
  const resetTaskState = () => {
    dirtyFieldRef.current = null;
    lastPatchRef.current = null;
    setTitleError("");
    setSaveStatus({ state: "idle", error: "" });
    setLifecycleError("");
    setDeleteError("");
    setConfirming("");
    setBulkMessage(null);
  };

  const isStory = task?.workType === "story";
  const relatedTasks = useMemo(
    () =>
      isStory ? workspace.tasks.filter((related) => related.storyId === taskId) : [],
    [isStory, workspace.tasks, taskId]
  );

  useEffect(() => {
    if (projectId) void ensureWorkspace(projectId);
  }, [projectId]);

  useEffect(() => {
    // A different task always wins; an edit in flight only survives a refresh of
    // the task it belongs to, so switching tasks can never show a stale (or
    // half-typed, or emptied) title.
    if (!task) return;
    const sameTask = seededTaskIdRef.current === task.id;
    seededTaskIdRef.current = task.id;
    if (!sameTask) resetTaskState();
    const dirty = dirtyFieldRef.current;
    const next = seedValues(task);
    setValues((current) => (dirty ? { ...next, [dirty]: current[dirty] } : next));
  }, [task]);

  useEffect(() => {
    autoGrow(titleRef.current);
    autoGrow(descriptionRef.current);
  }, [values.title, values.description]);

  useEffect(() => {
    const visibleIds = new Set(relatedTasks.map((related) => related.id));
    setSelectedRelatedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [relatedTasks]);

  useEffect(() => {
    if (saveStatus.state !== "saved") return undefined;
    const timer = window.setTimeout(() => setSaveStatus({ state: "idle", error: "" }), 1500);
    return () => window.clearTimeout(timer);
  }, [saveStatus.state]);

  // Closing the panel returns focus to whatever opened it, so a keyboard user
  // keeps their place in the list, and forgets the story to step back to. The
  // trigger is captured when the panel opens and focused again when it closes —
  // never when it switches from one task to another.
  const panelOpen = Boolean(taskId);
  useEffect(() => {
    if (!panelOpen || typeof document === "undefined") return undefined;
    const trigger = document.activeElement;
    return () => {
      storyReturn = null;
      if (trigger && trigger !== document.body && trigger.isConnected) {
        trigger.focus?.({ preventScroll: true });
      }
    };
  }, [panelOpen]);

  if (!task) return null;

  const { members, stories, columns, project } = workspace;
  const readOnly = project?.viewerRole === "viewer";
  const contextLoading = Boolean(projectId) && workspace.status === "loading";
  const archived = isArchived(task);
  const completed = isTaskComplete(task);
  const canCollaborate = Boolean(userId && task.projectId);
  const projectCrumb = task.projectId
    ? task.projectName || project?.name || "Project"
    : "My tasks";
  const storyCrumb =
    !isStory && task.projectId
      ? task.storyName || stories.find((story) => story.id === task.storyId)?.title || ""
      : "";
  const allRelatedSelected =
    relatedTasks.length > 0 &&
    relatedTasks.every((related) => selectedRelatedIds.has(related.id));

  /** Closes the panel, or steps back to the story this task was opened from. */
  const close = () => {
    const back = storyReturn?.toTaskId === task.id ? storyReturn.fromStoryId : "";
    storyReturn = null;
    resetTaskState();
    if (back) openTask(back);
    else closeTask();
  };

  const openRelatedTask = (related) => {
    storyReturn = { fromStoryId: task.id, toTaskId: related.id };
    openTask(related.id);
  };

  /** Runs one auto-save and reports it in the save-state line. */
  const autosave = async (run, errorText) => {
    setSaveStatus({ state: "saving", error: "" });
    const saved = await run();
    setSaveStatus(saved ? { state: "saved", error: "" } : { state: "error", error: errorText });
    return saved;
  };

  const save = async (patch) => {
    if (Object.keys(patch).length === 0) return;
    lastPatchRef.current = patch;
    const saved = await autosave(
      () => updateTask(task.id, patch),
      "We couldn't save your changes."
    );
    if (saved) lastPatchRef.current = null;
  };

  const changeAssignee = async (assigneeId) => {
    const saved = await autosave(
      () => setAssignee(task.id, assigneeId || null),
      "We couldn't update this task's assignee."
    );
    if (!saved) setValues((current) => ({ ...current, assigneeId: task.assigneeId || "" }));
  };

  const retrySave = () => {
    if (lastPatchRef.current) void save(lastPatchRef.current);
  };

  const handlePropertyChange = (nameOrPatch, value) => {
    if (readOnly) return;
    const patch =
      nameOrPatch && typeof nameOrPatch === "object" ? nameOrPatch : { [nameOrPatch]: value };
    setValues((current) => ({ ...current, ...patch }));

    if ("assigneeId" in patch) void changeAssignee(patch.assigneeId);
    else void save(savePatchFor(patch, values));
  };

  const commitTitle = () => {
    dirtyFieldRef.current = null;
    const nextTitle = values.title.trim();
    if (!nextTitle) {
      setTitleError("Enter a task title.");
      return;
    }
    setTitleError("");
    if (nextTitle !== (task.title || "")) void save({ title: nextTitle });
  };

  const commitDescription = () => {
    dirtyFieldRef.current = null;
    if (values.description !== (task.description || "")) {
      void save({ description: values.description });
    }
  };

  const handleToggleComplete = async () => {
    setPending("complete");
    await toggleComplete(task.id);
    setPending("");
  };

  const performLifecycle = async (moveLinkedTasksToUncategorized = false) => {
    setPending("lifecycle");
    setLifecycleError("");
    const done = archived
      ? await restoreTask(task.id)
      : await archiveTask(task.id, { moveLinkedTasksToUncategorized });
    setPending("");
    if (done) {
      setConfirming("");
      close();
      return;
    }
    setLifecycleError(
      `We couldn't ${archived ? "restore" : "archive"} this ${isStory ? "story" : "task"}. Check your connection and try again.`
    );
  };

  const handleLifecycle = () => {
    if (!archived && isStory && relatedTasks.length > 0) {
      setLifecycleError("");
      setConfirming("story-archive");
      return;
    }
    void performLifecycle();
  };

  const confirmDelete = async () => {
    const deletedTaskId = task.id;
    setPending("delete");
    setDeleteError("");
    const done = await deleteTask(deletedTaskId);
    setPending("");
    if (done) {
      setConfirming("");
      close();
      return;
    }
    // The store drops the row — and the selection with it — as soon as the
    // delete starts, and only puts the row back when it fails. Re-select the
    // task so this panel and its confirmation are still here to explain why.
    openTask(deletedTaskId);
    setDeleteError("We couldn't delete this task. Check your connection and try again.");
  };

  const toggleRelatedSelection = (relatedId) => {
    setBulkMessage(null);
    setSelectedRelatedIds((current) => {
      const next = new Set(current);
      if (!next.delete(relatedId)) next.add(relatedId);
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
    setPending("bulk");
    setBulkMessage(null);
    const { updated, failed, failedIds } = await bulkUpdate([...selectedRelatedIds], {
      type,
      value,
    });
    setPending("");
    setSelectedRelatedIds(new Set(failedIds));
    setBulkMessage({
      error: failed > 0,
      text:
        failed > 0
          ? `${updated} of ${updated + failed} tasks updated; ${failed} failed due to permissions or another error.`
          : `${updated} ${updated === 1 ? "task" : "tasks"} updated.`,
    });
  };

  const createRelatedTask = async (title) => {
    const created = await createTask({ title, projectId: task.projectId, storyId: task.id });
    if (!created) {
      throw new Error("We couldn't create this task. Check your connection and try again.");
    }
  };

  const header = (
    <div className="panel-head">
      <div className="panel-crumbs">
        {task.projectId ? (
          <button
            type="button"
            className="panel-crumb panel-crumb-link truncate"
            title={projectCrumb}
            onClick={() => openTaskInProject(task)}
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
            <Button
              variant="secondary"
              size="sm"
              className={cx("panel-complete", completed && "is-complete")}
              icon={<Icon name="check" />}
              loading={pending === "complete"}
              onClick={handleToggleComplete}
            >
              {completed ? "Completed" : "Mark complete"}
            </Button>
            <IconButton
              label={archived ? "Restore task" : "Archive task"}
              size="sm"
              disabled={pending === "lifecycle"}
              onClick={handleLifecycle}
            >
              <Icon name={archived ? "archive-restore" : "archive"} />
            </IconButton>
            <IconButton
              label={archived ? "Delete permanently" : isStory ? "Delete story" : "Delete task"}
              size="sm"
              onClick={() => {
                setDeleteError("");
                setConfirming("delete");
              }}
            >
              <Icon name="trash" />
            </IconButton>
          </>
        )}
        <IconButton label="Close panel" size="sm" onClick={close}>
          <Icon name="x" />
        </IconButton>
      </div>
    </div>
  );

  return (
    <>
      <SidePanel
        open
        onClose={close}
        ariaLabel={isStory ? "Story details" : "Task details"}
        header={header}
        className="task-panel"
      >
        {lifecycleError ? <InlineNotice tone="error">{lifecycleError}</InlineNotice> : null}

        <div className="panel-heading">
          <p className="panel-save-state" role="status" aria-live="polite">
            {SAVE_TEXT[saveStatus.state] || ""}
            {saveStatus.error ? (
              <>
                <span className="panel-save-error">{saveStatus.error}</span>
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
            value={values.title}
            disabled={readOnly}
            onChange={(event) => {
              dirtyFieldRef.current = "title";
              setTitleError("");
              setValues((current) => ({ ...current, title: event.target.value }));
            }}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== "Escape") return;
              event.preventDefault();
              if (event.key === "Enter") {
                commitTitle();
                return;
              }
              dirtyFieldRef.current = null;
              setTitleError("");
              setValues((current) => ({ ...current, title: task.title || "" }));
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
          isPersonal={!task.projectId}
          projects={projects}
          projectMembers={members}
          projectStories={stories.filter((story) => story.id !== task.id)}
          disabled={readOnly || contextLoading}
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
            value={values.description}
            disabled={readOnly}
            onChange={(event) => {
              dirtyFieldRef.current = "description";
              setValues((current) => ({ ...current, description: event.target.value }));
            }}
            onBlur={commitDescription}
          />
          {values.description.length > 900 ? (
            <span className="panel-char-count">{`${values.description.length}/1000`}</span>
          ) : null}
        </label>

        {isStory ? (
          <>
            <div className="divider" />
            <section className="panel-section" aria-label={`Tasks in ${task.title}`}>
              <StoryProgress tasks={relatedTasks} columns={columns} />

              <div className="panel-section-header">
                <h3 className="section-title">Tasks</h3>
                <span className="section-meta">{relatedTasks.length}</span>
                {!readOnly && relatedTasks.length > 0 ? (
                  <Checkbox
                    className="panel-select-all"
                    label="Select all"
                    checked={allRelatedSelected}
                    disabled={pending === "bulk"}
                    onChange={toggleAllRelated}
                  />
                ) : null}
              </div>

              {readOnly ? null : (
                <BulkActionBar
                  selectedCount={selectedRelatedIds.size}
                  members={members}
                  stories={stories}
                  currentStoryId={task.id}
                  busy={pending === "bulk"}
                  onAction={runBulkUpdate}
                  onClear={() => {
                    setSelectedRelatedIds(new Set());
                    setBulkMessage(null);
                  }}
                />
              )}

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
                    selectable={!readOnly}
                    selectedForBulk={selectedRelatedIds.has(related.id)}
                    onToggleSelect={toggleRelatedSelection}
                    onOpen={openRelatedTask}
                  />
                ))}
              </div>

              {readOnly ? null : relatedQuickAddOpen ? (
                <QuickAdd
                  contextLabel={task.title}
                  onCreate={createRelatedTask}
                  onCancel={() => setRelatedQuickAddOpen(false)}
                />
              ) : (
                <QuickAddTrigger onClick={() => setRelatedQuickAddOpen(true)} />
              )}
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
                canManage={!readOnly}
                compact
                allowDrop={!isStory}
              />
            </div>

            <div className="divider" />
            <section className="panel-section panel-activity" aria-label="Activity">
              <div className="panel-section-header">
                <h3 className="section-title">Activity</h3>
                <div className="text-switch" role="tablist" aria-label="Activity view">
                  {ACTIVITY_VIEWS.map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      role="tab"
                      aria-selected={activityView === view}
                      className={cx("text-switch-option", activityView === view && "is-active")}
                      onClick={() => setActivityView(view)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {activityView === "comments" ? (
                <TaskComments taskId={task.id} members={members} compact />
              ) : (
                <ActivityFeed
                  projectId={task.projectId}
                  taskId={task.id}
                  includeComments
                  compact
                  members={members}
                />
              )}
            </section>
          </>
        ) : null}
      </SidePanel>

      <ConfirmDialog
        open={confirming === "delete"}
        danger
        busy={pending === "delete"}
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
        onCancel={() => setConfirming("")}
        onConfirm={confirmDelete}
      >
        {deleteError ? <InlineNotice tone="error">{deleteError}</InlineNotice> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming === "story-archive"}
        busy={pending === "lifecycle"}
        title="Move linked tasks before archiving?"
        description={`“${task.title}” has ${relatedTasks.length} linked ${relatedTasks.length === 1 ? "task" : "tasks"}. They move to “No story” before this story is archived.`}
        confirmLabel="Move tasks to no story"
        onCancel={() => {
          setLifecycleError("");
          setConfirming("");
        }}
        onConfirm={() => performLifecycle(true)}
      >
        {lifecycleError ? <InlineNotice tone="error">{lifecycleError}</InlineNotice> : null}
      </ConfirmDialog>
    </>
  );
}
