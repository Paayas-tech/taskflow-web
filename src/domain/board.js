/**
 * Board layout: the drag-and-drop identifiers, grouping tasks into columns and
 * turning a drop into the placements the caller persists. Personal tasks have
 * no stored column, so their board is derived from status.
 */
import { isTaskComplete } from "./task";

/* -------------------------------------------------------------------------
 * Personal board (status columns, no ordering)
 * ---------------------------------------------------------------------- */

const personalTaskColumnId = (task) =>
  isTaskComplete(task)
    ? "completed"
    : task.status === "in-progress"
      ? "in-progress"
      : "todo";

/** Personal tasks given the derived `columnId`/`position` a board needs. */
export const mapPersonalTasksToBoard = (tasks) =>
  tasks.map((task, position) => ({
    ...task,
    columnId: personalTaskColumnId(task),
    position,
  }));

/**
 * The single task update a personal-board drop implies, or null when nothing
 * changed column (personal tasks have no ordering field to persist).
 */
export const personalTaskMoveUpdate = (boardTasks, placements) => {
  const changed = placements.find((placement) => {
    const task = boardTasks.find((candidate) => candidate.id === placement.taskId);
    return task && task.columnId !== placement.columnId;
  });
  if (!changed) return null;
  return {
    taskId: changed.taskId,
    changes: {
      status: changed.columnId,
      completed: changed.columnId === "completed",
    },
  };
};

/* -------------------------------------------------------------------------
 * Project board (real columns with positions)
 * ---------------------------------------------------------------------- */

export const taskIdFromProjectDnd = (value) =>
  String(value || "").startsWith("task:") ? String(value).slice(5) : null;

const columnIdFromProjectDnd = (value) =>
  String(value || "").startsWith("column:") ? String(value).slice(7) : null;

const taskStatusCategory = (task = {}) => {
  if (
    task.status === "completed" ||
    task.status === "done" ||
    task.completed === true
  ) {
    return "done";
  }
  if (task.status === "in-progress" || task.status === "in_progress") {
    return "in_progress";
  }
  return "todo";
};

/**
 * `Map<columnId, Task[]>` in column order. A task whose `columnId` is unknown
 * falls back to the column matching its status, then to the first column.
 */
export function groupProjectTasksByColumn(
  columns,
  tasks,
  { preserveTaskOrder = false } = {}
) {
  const firstColumnId = columns[0]?.id || null;
  const groups = new Map(columns.map((column) => [column.id, []]));

  tasks.forEach((task) => {
    const statusColumn = columns.find(
      (column) => column.category === taskStatusCategory(task)
    );
    const columnId = groups.has(task.columnId)
      ? task.columnId
      : statusColumn?.id || firstColumnId;
    if (columnId) groups.get(columnId).push(task);
  });

  if (!preserveTaskOrder) {
    groups.forEach((columnTasks) =>
      columnTasks.sort(
        (first, second) => (first.position ?? 0) - (second.position ?? 0)
      )
    );
  }

  return groups;
}

/**
 * Complete, sequential `{ taskId, columnId, position }` placements for every
 * task after `movingTaskId` is dropped on `overId`, or null when the drop
 * cannot be resolved.
 */
export function buildProjectTaskPlacements({
  columns,
  tasks,
  movingTaskId,
  overId,
}) {
  if (!movingTaskId || overId == null) return null;

  const overTaskId = taskIdFromProjectDnd(overId);
  const overTask = overTaskId
    ? tasks.find((task) => task.id === overTaskId)
    : null;
  const targetColumnId =
    columnIdFromProjectDnd(overId) || overTask?.columnId || columns[0]?.id;
  if (!targetColumnId) return null;

  const tasksByColumn = groupProjectTasksByColumn(columns, tasks);
  const ordered = new Map(
    columns.map((column) => [column.id, [...(tasksByColumn.get(column.id) || [])]])
  );
  let movingTask = null;

  ordered.forEach((columnTasks, columnId) => {
    const index = columnTasks.findIndex((task) => task.id === movingTaskId);
    if (index >= 0) {
      [movingTask] = columnTasks.splice(index, 1);
      ordered.set(columnId, columnTasks);
    }
  });

  if (!movingTask) return null;

  const targetTasks = ordered.get(targetColumnId) || [];
  const targetIndex = overTaskId
    ? Math.max(0, targetTasks.findIndex((task) => task.id === overTaskId))
    : targetTasks.length;
  targetTasks.splice(
    targetIndex < 0 ? targetTasks.length : targetIndex,
    0,
    movingTask
  );
  ordered.set(targetColumnId, targetTasks);

  const placements = [];
  ordered.forEach((columnTasks, columnId) => {
    columnTasks.forEach((task, position) => {
      placements.push({ taskId: task.id, columnId, position });
    });
  });

  return placements;
}
