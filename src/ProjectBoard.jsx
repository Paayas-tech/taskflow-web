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
import {
  buildProjectTaskPlacements,
  groupProjectTasksByColumn,
  taskIdFromProjectDnd,
} from "./domain/projectBoardDomain";

export default function ProjectBoard({
  columns,
  tasks,
  onMoveTasks,
  onEditTask,
  onStartQuickCreate,
  onQuickCreate,
  onCancelQuickCreate,
  onAddTaskDetails,
  quickCreateColumnId,
  collapsible = false,
  initiallyCollapsedColumnIds = [],
  readOnly = false,
}) {
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [collapsedColumnIds, setCollapsedColumnIds] = useState(
    () => new Set(initiallyCollapsedColumnIds)
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const tasksByColumn = useMemo(
    () => groupProjectTasksByColumn(columns, tasks),
    [columns, tasks]
  );
  const activeTask = tasks.find((task) => task.id === activeTaskId);

  const toggleColumn = (columnId) => {
    setCollapsedColumnIds((current) => {
      const next = new Set(current);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  };

  const handleDragEnd = ({ active, over }) => {
    if (readOnly) return;
    const taskId = taskIdFromProjectDnd(active.id);
    setActiveTaskId(null);
    if (!taskId || !over) return;
    const placements = buildProjectTaskPlacements({
      columns,
      tasks,
      movingTaskId: taskId,
      overId: over.id,
    });
    if (!placements) return;
    void onMoveTasks(placements);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) =>
        setActiveTaskId(taskIdFromProjectDnd(active.id))
      }
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
            onStartQuickCreate={onStartQuickCreate}
            onQuickCreate={onQuickCreate}
            onCancelQuickCreate={onCancelQuickCreate}
            onAddTaskDetails={onAddTaskDetails}
            quickCreateActive={quickCreateColumnId === column.id}
            collapsible={collapsible}
            collapsed={collapsible && collapsedColumnIds.has(column.id)}
            onToggleCollapse={() => toggleColumn(column.id)}
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
