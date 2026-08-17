import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import ProjectColumn from "./ProjectColumn";

const taskIdFromDnd = (value) =>
  String(value || "").startsWith("task:") ? String(value).slice(5) : null;
const columnIdFromDnd = (value) =>
  String(value || "").startsWith("column:") ? String(value).slice(7) : null;

export default function ProjectBoard({
  columns,
  tasks,
  onMoveTasks,
  onEditTask,
  onCreateTask,
  readOnly = false,
}) {
  const [activeTaskId, setActiveTaskId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const tasksByColumn = useMemo(() => {
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
  }, [columns, tasks]);
  const activeTask = tasks.find((task) => task.id === activeTaskId);

  const handleDragEnd = ({ active, over }) => {
    if (readOnly) return;
    const taskId = taskIdFromDnd(active.id);
    setActiveTaskId(null);
    if (!taskId || !over) return;

    const overTaskId = taskIdFromDnd(over.id);
    const overTask = overTaskId
      ? tasks.find((task) => task.id === overTaskId)
      : null;
    const targetColumnId =
      columnIdFromDnd(over.id) || overTask?.columnId || columns[0]?.id;
    if (!targetColumnId) return;

    const ordered = new Map(
      columns.map((column) => [column.id, [...(tasksByColumn.get(column.id) || [])]])
    );
    let movingTask = null;
    ordered.forEach((columnTasks, columnId) => {
      const index = columnTasks.findIndex((task) => task.id === taskId);
      if (index >= 0) {
        [movingTask] = columnTasks.splice(index, 1);
        ordered.set(columnId, columnTasks);
      }
    });
    if (!movingTask) return;

    const targetTasks = ordered.get(targetColumnId) || [];
    const targetIndex = overTaskId
      ? Math.max(0, targetTasks.findIndex((task) => task.id === overTaskId))
      : targetTasks.length;
    targetTasks.splice(targetIndex < 0 ? targetTasks.length : targetIndex, 0, movingTask);
    ordered.set(targetColumnId, targetTasks);

    const placements = [];
    ordered.forEach((columnTasks, columnId) => {
      columnTasks.forEach((task, position) => {
        placements.push({ taskId: task.id, columnId, position });
      });
    });
    void onMoveTasks(placements);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveTaskId(taskIdFromDnd(active.id))}
      onDragCancel={() => setActiveTaskId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="project-board" aria-label="Project Kanban board">
        {columns.map((column) => (
          <ProjectColumn
            key={column.id}
            column={column}
            tasks={tasksByColumn.get(column.id) || []}
            onEdit={onEditTask}
            onCreateTask={onCreateTask}
            readOnly={readOnly}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="project-task-card drag-overlay-card">
            <strong>{activeTask.title}</strong>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
