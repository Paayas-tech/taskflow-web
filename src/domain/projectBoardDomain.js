export const taskIdFromProjectDnd = (value) =>
  String(value || "").startsWith("task:") ? String(value).slice(5) : null;

export const columnIdFromProjectDnd = (value) =>
  String(value || "").startsWith("column:") ? String(value).slice(7) : null;

export function groupProjectTasksByColumn(columns, tasks) {
  const firstColumnId = columns[0]?.id || null;
  const groups = new Map(columns.map((column) => [column.id, []]));

  tasks.forEach((task) => {
    const columnId = groups.has(task.columnId) ? task.columnId : firstColumnId;
    if (columnId) groups.get(columnId).push(task);
  });

  groups.forEach((columnTasks) =>
    columnTasks.sort(
      (first, second) => (first.position ?? 0) - (second.position ?? 0)
    )
  );

  return groups;
}

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
    columns.map((column) => [
      column.id,
      [...(tasksByColumn.get(column.id) || [])],
    ])
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
