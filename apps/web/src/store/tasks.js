/**
 * Task actions. Every mutation validates with the domain, applies the change
 * to the store immediately, then calls the api in the background: the server
 * row is merged on success and the previous values are restored on failure.
 * Mutations on one task are serialized so the server sees them in UI order,
 * and `pending[taskId]` counts the in-flight ones for the row's busy state.
 */
import {
  defaultReminderAt,
  getReminderValidationError,
  normalizeReminderAt,
} from "../domain/reminder";
import {
  isArchived,
  isTaskComplete,
  normalizeArchivedAt,
  normalizeTaskPriority,
  normalizeTaskSchedule,
  normalizeTaskStatus,
  resolveCompletionUpdate,
} from "../domain/task";
import {
  api,
  getState,
  isCurrentSession,
  onStoreReset,
  sessionStamp,
  setState,
} from "./store";
import { notify } from "./ui";

const SAVE_ERROR = "We couldn't save your changes.";
const MISSING_TASK_ERROR = "The selected task is unavailable.";
const SIGNED_OUT_ERROR = "You must be signed in to change a task.";
const MOVE_ERROR = "We couldn't save that task move. The board has been restored.";
const ASSIGNEE_ERROR = "We couldn't update this task's assignee.";
const DELETE_ERROR = "We couldn't delete this task. Check your connection and try again.";
const LINKED_STORY_ERROR =
  "Move linked tasks to No story before archiving this story.";
const LINKED_STORY_FAILURE =
  "Some linked tasks could not be moved to No story. The story was not archived.";

const STATUS_VALUES = ["todo", "in-progress", "completed"];
const PRIORITY_VALUES = ["low", "medium", "high"];
const SCHEDULE_FIELDS = ["dueDate", "endDate", "startTime", "endTime"];
const REMINDER_FIELDS = ["reminder", "reminderAt"];
const MOVE_FIELDS = ["columnId", "position", "status", "completed", "completedAt"];

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const nowIso = () => new Date().toISOString();

const pick = (source, keys) =>
  keys.reduce((picked, key) => {
    picked[key] = source[key];
    return picked;
  }, {});

const labelFor = (task) => (task?.workType === "story" ? "story" : "task");

/* -------------------------------------------------------------------------
 * Columns and positions
 * ---------------------------------------------------------------------- */

/** Board categories and task statuses are two spellings of the same states. */
const COLUMN_CATEGORY = {
  completed: "done",
  done: "done",
  "in-progress": "in_progress",
  in_progress: "in_progress",
};
const COLUMN_STATUS = { done: "completed", in_progress: "in-progress" };

const statusForColumn = (column) => COLUMN_STATUS[column?.category] || "todo";

/**
 * Where a task of this status belongs in a project board: the matching column
 * and one past the last card in it, so a new card lands at the bottom.
 *
 * Only a loaded workspace holds every card of that column — everywhere else
 * the store has just my own tasks in the project — so outside one the column
 * is set and the position is left to the board that owns it.
 */
const placeInColumn = (state, projectId, status) => {
  const category = COLUMN_CATEGORY[status] || "todo";
  const columnId =
    (state.columns[projectId] || []).find(
      (column) => column.category === category
    )?.id || null;
  if (state.loaded.workspaces[projectId] !== "ready") return { columnId };

  const positions = Object.values(state.tasks)
    .filter(
      (task) =>
        task.projectId === projectId &&
        task.columnId === columnId &&
        Number.isFinite(task.position)
    )
    .map((task) => task.position);

  return {
    columnId,
    position: positions.length ? Math.max(0, Math.max(...positions) + 1) : 0,
  };
};

/* -------------------------------------------------------------------------
 * Store writes
 * ---------------------------------------------------------------------- */

/**
 * A monotonic counter of local task writes. A list load reads `writeStamp()`
 * before it fires and then skips every task `writtenSince` that stamp: its
 * response predates those writes, so merging it would revert a create, an
 * edit or a board drop the person has already seen.
 */
let writes = 0;
const writtenAt = new Map();

export const writeStamp = () => writes;

export const writtenSince = (taskId, stamp) => (writtenAt.get(taskId) || 0) > stamp;

const markWritten = (taskIds) => {
  writes += 1;
  taskIds.forEach((taskId) => writtenAt.set(taskId, writes));
};

const putTask = (task) => {
  markWritten([task.id]);
  return setState((state) => ({ tasks: { ...state.tasks, [task.id]: task } }));
};

/** Merges `[taskId, values]` pairs; tasks no longer in the store are skipped. */
const patchTasks = (entries) => {
  const stored = getState().tasks;
  const present = entries.filter(([taskId]) => stored[taskId]);
  if (present.length === 0) return null;

  markWritten(present.map(([taskId]) => taskId));
  return setState((state) => {
    const tasks = { ...state.tasks };
    present.forEach(([taskId, values]) => {
      if (tasks[taskId]) tasks[taskId] = { ...tasks[taskId], ...values };
    });
    return { tasks };
  });
};

const patchTask = (taskId, patch) => patchTasks([[taskId, patch]]);

const removeTask = (taskId) => {
  if (!getState().tasks[taskId]) return null;
  markWritten([taskId]);
  return setState((state) => {
    if (!state.tasks[taskId]) return null;
    const tasks = { ...state.tasks };
    delete tasks[taskId];
    return {
      tasks,
      ui:
        state.ui.selectedTaskId === taskId
          ? { ...state.ui, selectedTaskId: null }
          : state.ui,
    };
  });
};

const incPending = (taskId) =>
  setState((state) => ({
    pending: { ...state.pending, [taskId]: (state.pending[taskId] || 0) + 1 },
  }));

const decPending = (taskId) =>
  setState((state) => {
    const count = (state.pending[taskId] || 0) - 1;
    const pending = { ...state.pending };
    if (count > 0) pending[taskId] = count;
    else delete pending[taskId];
    return { pending };
  });

/** The task, or null after telling the person it is gone. */
const requireTask = (taskId, silent = false) => {
  const task = getState().tasks[taskId];
  if (!task && !silent) notify({ tone: "error", text: MISSING_TASK_ERROR });
  return task || null;
};

/* -------------------------------------------------------------------------
 * Per-task serialization
 * ---------------------------------------------------------------------- */

const queues = new Map();
const optimisticMutations = new Map();

/** The store was reset (sign-out, a fresh test): nothing queued still applies. */
onStoreReset(() => {
  queues.clear();
  optimisticMutations.clear();
  writtenAt.clear();
});

/**
 * Records the rollback values behind one optimistic patch. If an earlier
 * request fails, its baseline is handed to the next mutation of the same
 * field; that way two failed rapid edits restore the original value rather
 * than the first optimistic value.
 */
const registerOptimisticMutation = (taskId, previous) => {
  const mutation = { previous: { ...previous }, fields: Object.keys(previous) };
  const list = optimisticMutations.get(taskId) || [];
  list.push(mutation);
  optimisticMutations.set(taskId, list);
  return mutation;
};

const settleOptimisticMutation = (taskId, mutation, failed) => {
  const list = optimisticMutations.get(taskId) || [];
  const index = list.indexOf(mutation);
  if (index < 0) return;

  const rollback = {};
  if (failed) {
    mutation.fields.forEach((field) => {
      const follower = list
        .slice(index + 1)
        .find((candidate) => candidate.fields.includes(field));
      if (follower) follower.previous[field] = mutation.previous[field];
      else rollback[field] = mutation.previous[field];
    });
  }

  list.splice(index, 1);
  if (list.length > 0) optimisticMutations.set(taskId, list);
  else optimisticMutations.delete(taskId);
  if (Object.keys(rollback).length > 0) patchTask(taskId, rollback);
};

/**
 * Runs `request` after every earlier request for each of `taskIds` has
 * settled. `request` receives the queue entries, whose `pending` counts are
 * greater than one while newer mutations are already waiting behind it.
 */
const enqueueAll = (taskIds, request) => {
  const session = sessionStamp();
  const entries = [...new Set(taskIds)].map((taskId) => {
    const entry = queues.get(taskId) || { chain: Promise.resolve(), pending: 0 };
    queues.set(taskId, entry);
    entry.pending += 1;
    incPending(taskId);
    return [taskId, entry];
  });

  const operation = Promise.allSettled(entries.map(([, entry]) => entry.chain))
    .then(() =>
      isCurrentSession(session)
        ? request(entries.map(([, entry]) => entry))
        : null
    )
    .finally(() => {
      entries.forEach(([taskId, entry]) => {
        entry.pending -= 1;
        if (isCurrentSession(session)) decPending(taskId);
        if (entry.pending === 0 && queues.get(taskId) === entry) {
          queues.delete(taskId);
        }
      });
    });

  // The chain only sequences; a failed request must not stall what follows.
  const chain = operation.catch(() => undefined);
  entries.forEach(([, entry]) => {
    entry.chain = chain;
  });
  return operation;
};

/** Runs `request` after every earlier request for the same task has settled. */
const enqueue = (taskId, request) =>
  enqueueAll([taskId], ([entry]) => request(entry));

/**
 * The shared optimistic-mutation shape: patch now, call the api in order,
 * merge the server row when nothing newer is queued, restore on failure.
 * Resolves to whether the server accepted the change.
 */
const runTaskMutation = (
  taskId,
  optimisticPatch,
  request,
  { errorText = SAVE_ERROR, silent = false } = {}
) => {
  const session = sessionStamp();
  const current = getState().tasks[taskId];
  if (!current) return Promise.resolve(false);

  const previous = pick(current, Object.keys(optimisticPatch));
  const mutation = registerOptimisticMutation(taskId, previous);
  patchTask(taskId, optimisticPatch);

  return enqueue(taskId, async (entry) => {
    try {
      const saved = await request();
      if (!isCurrentSession(session)) return false;
      // A newer mutation is already queued: its optimistic values must stand.
      // Even then, only the fields this mutation asked for are merged — a
      // response must never write back a placement or a status it never set.
      if (saved && entry.pending === 1) {
        const fields = Object.keys(optimisticPatch).filter((key) =>
          hasOwn(saved, key)
        );
        if (fields.length > 0) patchTask(taskId, pick(saved, fields));
      }
      settleOptimisticMutation(taskId, mutation, false);
      return true;
    } catch {
      if (!isCurrentSession(session)) return false;
      settleOptimisticMutation(taskId, mutation, true);
      if (!silent) notify({ tone: "error", text: errorText });
      return false;
    }
  }).then((saved) => saved === true);
};

/* -------------------------------------------------------------------------
 * Validation
 * ---------------------------------------------------------------------- */

const validateTitle = (value) => {
  const title = String(value || "").trim();
  if (!title) throw new Error("Task title cannot be empty.");
  return title;
};

const validateDescription = (value) => {
  const description = String(value || "");
  if (description.length > 1000) {
    throw new Error("Task descriptions must be 1,000 characters or fewer.");
  }
  return description;
};

/** The plain fields an update may set, and how each one is normalized. */
const FIELD_RULES = {
  title: validateTitle,
  description: validateDescription,
  notes: (value) => String(value || ""),
  priority: normalizeTaskPriority,
  storyId: (value) => value || null,
  archivedAt: (value) => {
    if (value === null) return null;
    const archivedAt = normalizeArchivedAt(value);
    if (archivedAt) return archivedAt;
    throw new Error("Archived date must be a valid ISO 8601 timestamp or null.");
  },
};

const reminderForCreate = (values, schedule, defaultMinutes) => {
  const reminder = values.reminder === true;
  const supplied = normalizeReminderAt(values.reminderAt);
  if (reminder && values.reminderAt && !supplied) {
    throw new Error("Choose a valid reminder date and time.");
  }

  const reminderAt = reminder
    ? supplied ||
      defaultReminderAt({ ...values, ...schedule }, new Date(), defaultMinutes)
    : "";
  const error = getReminderValidationError(
    { reminder, reminderAt },
    { requireScheduled: reminder }
  );
  if (error) throw new Error(error);

  return { reminder, reminderAt };
};

const reminderForUpdate = (current, patch, next) => {
  const existingReminder = current.reminder === true;
  const existingReminderAt = normalizeReminderAt(current.reminderAt);
  let reminder = hasOwn(patch, "reminder")
    ? patch.reminder === true
    : existingReminder;
  const supplied = hasOwn(patch, "reminderAt")
    ? normalizeReminderAt(patch.reminderAt)
    : existingReminderAt;

  if (hasOwn(patch, "reminderAt") && patch.reminderAt && !supplied) {
    throw new Error("Choose a valid reminder date and time.");
  }

  // Clearing the time of an existing reminder disables the reminder as one
  // atomic update; the database must never retain `reminder_enabled = true`
  // with no time to deliver it.
  if (
    existingReminder &&
    hasOwn(patch, "reminderAt") &&
    !String(patch.reminderAt || "").trim()
  ) {
    reminder = false;
  }

  let reminderAt = supplied;
  if (!reminder) reminderAt = "";
  else if (!reminderAt && !existingReminder) {
    reminderAt = defaultReminderAt({ ...current, ...next }, new Date());
  }

  if (
    (reminder !== existingReminder || reminderAt !== existingReminderAt) &&
    reminderAt
  ) {
    const error = getReminderValidationError({
      reminder,
      reminderAt,
      createdAt: current.createdAt,
    });
    if (error) throw new Error(error);
  }

  return { reminder, reminderAt };
};

/* -------------------------------------------------------------------------
 * Create
 * ---------------------------------------------------------------------- */

const buildNewTask = (values, state) => {
  const title = validateTitle(values.title);
  const description = validateDescription(values.description);
  const workType = values.workType === "story" ? "story" : "task";
  const projectId = values.projectId || null;
  if (workType === "story" && !projectId) {
    throw new Error("A story must belong to a project.");
  }

  const status = normalizeTaskStatus(values.status, values.completed === true);
  const completed = status === "completed";
  const schedule = normalizeTaskSchedule(values, { validate: true });
  const { reminder, reminderAt } = reminderForCreate(
    values,
    schedule,
    state.settings.reminder.defaultTime
  );
  const createdAt = nowIso();

  return {
    id: crypto.randomUUID(),
    projectId,
    workType,
    storyId: workType === "story" ? null : values.storyId || null,
    title,
    description,
    notes: values.notes || "",
    status,
    completed,
    completedAt: completed ? createdAt : null,
    priority: normalizeTaskPriority(values.priority),
    dueDate: schedule.dueDate,
    endDate: schedule.endDate,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    reminder,
    reminderAt,
    // Outside a loaded board `placeInColumn` sets no position; the workspace
    // that owns the column assigns one on its next reorder.
    ...(projectId
      ? { position: null, ...placeInColumn(state, projectId, status) }
      : { columnId: null, position: null }),
    assigneeId: values.assigneeId || null,
    archivedAt: null,
    createdBy: state.auth.user.id,
    createdAt,
    updatedAt: createdAt,
  };
};

/** Creates a task (or story) optimistically; returns it, or null on failure. */
export const createTask = async (values = {}) => {
  const state = getState();
  if (!state.auth.user) {
    notify({ tone: "error", text: SIGNED_OUT_ERROR });
    return null;
  }
  const session = sessionStamp();

  let task;
  try {
    task = buildNewTask(values, state);
  } catch (error) {
    notify({ tone: "error", text: error.message });
    return null;
  }

  const { id, assigneeId } = task;
  putTask(task);
  const stamp = writeStamp();

  try {
    // Queued like every other mutation, so an edit made on the new row waits
    // for the insert instead of racing it to the server.
    const saved = await enqueue(id, () => api().createTask(task));
    if (!isCurrentSession(session)) return null;
    const stored = getState().tasks[id];
    // A concurrent list load may have dropped the optimistic row; the server
    // accepted it, so put it back unless it was deliberately removed since.
    if (saved && !writtenSince(id, stamp)) {
      putTask({ ...(stored || task), ...saved, assigneeId });
    }
  } catch {
    if (!isCurrentSession(session)) return null;
    removeTask(id);
    notify({
      tone: "error",
      text: `We couldn't create this ${labelFor(task)}. Check your connection and try again.`,
    });
    return null;
  }

  if (assigneeId) {
    if (!isCurrentSession(session)) return null;
    try {
      await api().setAssignee(id, assigneeId);
      if (!isCurrentSession(session)) return null;
    } catch {
      if (!isCurrentSession(session)) return null;
      patchTask(id, { assigneeId: null });
      notify({
        tone: "error",
        text: `“${task.title}” was created, but its assignee could not be saved. Open the task to assign it.`,
      });
    }
  }

  return getState().tasks[id] || null;
};

/* -------------------------------------------------------------------------
 * Update
 * ---------------------------------------------------------------------- */

const buildUpdatePatch = (current, patch, state) => {
  const next = {};

  Object.entries(FIELD_RULES).forEach(([field, normalize]) => {
    if (hasOwn(patch, field)) next[field] = normalize(patch[field]);
  });

  // status ↔ completed ↔ completedAt, mirroring normalize_task_completion.
  Object.assign(
    next,
    resolveCompletionUpdate(patch, () => current.completedAt || nowIso())
  );

  if (SCHEDULE_FIELDS.some((field) => hasOwn(patch, field))) {
    const schedule = normalizeTaskSchedule(
      { ...current, ...patch },
      { validate: true }
    );
    Object.assign(next, pick(schedule, SCHEDULE_FIELDS));
  }

  if (REMINDER_FIELDS.some((field) => hasOwn(patch, field))) {
    Object.assign(next, reminderForUpdate(current, patch, next));
  }

  const relocating =
    hasOwn(patch, "projectId") && (patch.projectId || null) !== current.projectId;
  if (relocating) {
    next.projectId = patch.projectId || null;
    if (!hasOwn(patch, "storyId")) next.storyId = null;
    // A placement and assignment both belong to the old project. The target
    // workspace chooses a fresh column below; an unloaded board leaves the
    // position null until it can order the complete set of cards.
    next.position = null;
    if (current.assigneeId) next.assigneeId = null;
  }

  const projectId = relocating ? next.projectId : current.projectId;
  if (projectId && (relocating || hasOwn(next, "status"))) {
    const status = hasOwn(next, "status") ? next.status : current.status;
    Object.assign(next, placeInColumn(state, projectId, status));
  } else if (relocating) {
    // Leaving every project: the task keeps no board placement.
    next.columnId = null;
    next.position = null;
  }

  return next;
};

/** Applies a patch to one task; returns true when the server accepted it. */
export const updateTask = async (taskId, patch = {}, options = {}) => {
  const current = requireTask(taskId, options.silent);
  if (!current) return false;

  let optimistic;
  try {
    optimistic = buildUpdatePatch(current, patch, getState());
  } catch (error) {
    if (!options.silent) notify({ tone: "error", text: error.message });
    return false;
  }
  if (Object.keys(optimistic).length === 0) return true;

  const clearsAssignment = optimistic.assigneeId === null && current.assigneeId;
  return runTaskMutation(
    taskId,
    optimistic,
    async () => {
      if (clearsAssignment) await api().setAssignee(taskId, null);
      return api().updateTask(taskId, optimistic);
    },
    options
  );
};

/** Completes or reopens a task, stamping `completedAt` like the database does. */
export const toggleComplete = (taskId) => {
  const task = requireTask(taskId);
  if (!task) return Promise.resolve(false);

  const completing = !isTaskComplete(task);
  const completedAt = completing ? nowIso() : null;
  return updateTask(
    taskId,
    {
      completed: completing,
      status: completing ? "done" : "todo",
      completedAt,
    },
    {
      errorText: `We couldn't ${completing ? "complete" : "reopen"} “${task.title}”.`,
    }
  );
};

/* -------------------------------------------------------------------------
 * Lifecycle
 * ---------------------------------------------------------------------- */

const setArchivedAt = (task, archivedAt, verb) =>
  runTaskMutation(
    task.id,
    { archivedAt },
    () => api().updateTask(task.id, { archivedAt }),
    {
      errorText: `We couldn't ${verb} this ${labelFor(task)}. Check your connection and try again.`,
    }
  );

/**
 * Archives a task. A story with linked tasks needs
 * `moveLinkedTasksToUncategorized`, which unlinks them first.
 */
export const archiveTask = async (taskId, options = {}) => {
  const task = requireTask(taskId);
  if (!task) return false;

  if (task.workType === "story") {
    const linked = Object.values(getState().tasks).filter(
      (other) =>
        other.workType !== "story" &&
        other.storyId === taskId &&
        !isArchived(other)
    );
    if (linked.length > 0) {
      if (options.moveLinkedTasksToUncategorized !== true) {
        notify({ tone: "error", text: LINKED_STORY_ERROR });
        return false;
      }
      const saved = await Promise.all(
        linked.map((linkedTask) =>
          updateTask(linkedTask.id, { storyId: null }, { silent: true })
        )
      );
      if (saved.some((accepted) => accepted !== true)) {
        notify({ tone: "error", text: LINKED_STORY_FAILURE });
        return false;
      }
    }
  }

  return setArchivedAt(task, nowIso(), "archive");
};

export const restoreTask = (taskId) => {
  const task = requireTask(taskId);
  return task ? setArchivedAt(task, null, "restore") : Promise.resolve(false);
};

/** Deletes a task optimistically; the API owns all dependent-row cleanup. */
export const deleteTask = async (taskId) => {
  const session = sessionStamp();
  const task = requireTask(taskId);
  if (!task) return false;

  removeTask(taskId);
  try {
    await enqueue(taskId, async () => {
      await api().deleteTask(taskId);
    });
    return isCurrentSession(session);
  } catch {
    if (!isCurrentSession(session)) return false;
    putTask(task);
    notify({ tone: "error", text: DELETE_ERROR });
    return false;
  }
};

/* -------------------------------------------------------------------------
 * Board moves, assignment and bulk edits
 * ---------------------------------------------------------------------- */

/** Persists a board drop: every placement is applied at once and rolled back together. */
export const moveTasks = async (projectId, placements = []) => {
  const session = sessionStamp();
  const state = getState();
  const columnsById = new Map(
    (state.columns[projectId] || []).map((column) => [column.id, column])
  );
  const applied = placements.filter((placement) => state.tasks[placement.taskId]);
  if (applied.length === 0) return true;

  const previous = applied.map(({ taskId }) => [
    taskId,
    pick(state.tasks[taskId], MOVE_FIELDS),
  ]);
  const mutations = new Map(
    previous.map(([taskId, values]) => [
      taskId,
      registerOptimisticMutation(taskId, values),
    ])
  );
  // Exactly the payload `reorderTasks` takes; `completed` follows the status.
  const rows = applied.map(({ taskId, columnId, position }) => {
    const status = statusForColumn(columnsById.get(columnId));
    return {
      taskId,
      columnId,
      position: Math.max(0, Number(position) || 0),
      status,
      completedAt:
        status === "completed"
          ? state.tasks[taskId].completedAt || nowIso()
          : null,
    };
  });

  patchTasks(
    rows.map(({ taskId, ...values }) => [
      taskId,
      { ...values, completed: values.status === "completed" },
    ])
  );

  // Queued per task like every other mutation: an update already on the wire
  // sees a newer placement waiting behind it and leaves the drop alone.
  const saved = await enqueueAll(
    rows.map((row) => row.taskId),
    async () => {
      try {
        await api().reorderTasks(rows);
        if (!isCurrentSession(session)) return false;
        mutations.forEach((mutation, taskId) =>
          settleOptimisticMutation(taskId, mutation, false)
        );
        return true;
      } catch {
        if (!isCurrentSession(session)) return false;
        mutations.forEach((mutation, taskId) =>
          settleOptimisticMutation(taskId, mutation, true)
        );
        notify({ tone: "error", text: MOVE_ERROR });
        return false;
      }
    }
  );
  return saved === true;
};

/** Assigns a project task to a member, or clears the assignment with null. */
export const setAssignee = (taskId, userId, options = {}) => {
  const assigneeId = String(userId || "").trim() || null;
  return runTaskMutation(
    taskId,
    { assigneeId },
    async () => {
      await api().setAssignee(taskId, assigneeId);
      return null;
    },
    { errorText: ASSIGNEE_ERROR, silent: options.silent }
  );
};

/**
 * The per-task mutation one bulk action runs. Throws the message to show when
 * the action is not one this workspace offers.
 */
const bulkMutation = (action, projectId, state) => {
  if (action.type === "assignee") {
    const assigneeId = action.value || null;
    const members = state.members[projectId] || [];
    if (assigneeId && !members.some((member) => member.userId === assigneeId)) {
      throw new Error("Choose a member of this project.");
    }
    return (task) => setAssignee(task.id, assigneeId, { silent: true });
  }

  let patch;
  if (action.type === "status") {
    if (!STATUS_VALUES.includes(action.value)) {
      throw new Error("Choose a valid task status.");
    }
    patch = { status: action.value, completed: action.value === "completed" };
  } else if (action.type === "priority") {
    if (!PRIORITY_VALUES.includes(action.value)) {
      throw new Error("Choose a valid task priority.");
    }
    patch = { priority: action.value };
  } else if (action.type === "story") {
    const storyId = action.value || null;
    const story = storyId ? state.tasks[storyId] : null;
    if (storyId && (story?.workType !== "story" || story.projectId !== projectId)) {
      throw new Error("Choose a story from this project.");
    }
    patch = { storyId };
  } else {
    throw new Error("Choose a valid bulk action.");
  }

  return (task) => updateTask(task.id, patch, { silent: true });
};

/**
 * Applies one change to many tasks. Each task keeps its own optimistic update
 * and rollback, so a partial failure reports exactly which ones failed.
 */
export const bulkUpdate = async (taskIds = [], action = {}) => {
  const state = getState();
  const tasks = [...new Set(taskIds)]
    .map((taskId) => state.tasks[taskId])
    .filter(Boolean);
  const none = { updated: 0, failed: 0, failedIds: [] };
  if (tasks.length === 0) return none;

  let mutate;
  try {
    mutate = bulkMutation(action, tasks[0].projectId || null, state);
  } catch (error) {
    notify({ tone: "error", text: error.message });
    return none;
  }

  const saved = await Promise.all(tasks.map((task) => mutate(task)));
  const failedIds = tasks
    .filter((task, index) => saved[index] !== true)
    .map((task) => task.id);

  return {
    updated: tasks.length - failedIds.length,
    failed: failedIds.length,
    failedIds,
  };
};
