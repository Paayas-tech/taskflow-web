import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { IconButton } from "../ui/Button";
import { Icon, StatusIcon } from "../ui/icons";
import { cx } from "../ui/cx";
import {
  buildProjectTaskPlacements,
  groupProjectTasksByColumn,
  taskIdFromProjectDnd,
} from "../domain/projectBoardDomain";
import { QuickAdd, QuickAddTrigger } from "./QuickAdd";
import { TaskCard } from "./TaskCard";

const statusForCategory = (category) => {
  if (category === "done") return "completed";
  if (category === "in_progress" || category === "in-progress") return "in-progress";
  return "todo";
};

/**
 * One Kanban column: header, sortable card list, inline quick add. When
 * `onOpenDetails(title, column)` is supplied the quick add offers "Add details"
 * so the typed title can be handed to the full composer, like the list views do.
 */
export function BoardColumn({
  column,
  tasks = [],
  context,
  onOpen,
  onQuickCreate,
  onOpenDetails,
  readOnly = false,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  quickCreateActive = false,
  onStartQuickCreate,
  onCancelQuickCreate,
  selectedTaskId,
  selectable = false,
  selectedIds,
  onToggleSelect,
  todayKey,
  formatSettings,
  className,
  ...rest
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });
  const headingId = `board-column-${column.id}`;
  const canCreate = !readOnly && Boolean(onQuickCreate);

  return (
    <section
      ref={setNodeRef}
      className={cx("board-column", isOver && "is-over", collapsed && "is-collapsed", className)}
      aria-labelledby={headingId}
      {...rest}
    >
      <header className="board-column-header">
        {collapsible ? (
          <IconButton
            label={`${collapsed ? "Expand" : "Collapse"} ${column.name}`}
            size="sm"
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-down"} />
          </IconButton>
        ) : null}
        <StatusIcon status={statusForCategory(column.category)} size={14} />
        <h3 className="board-column-name" id={headingId}>
          {column.name}
        </h3>
        <span className="board-column-count">{tasks.length}</span>
        {canCreate ? (
          <IconButton
            label={`Add task to ${column.name}`}
            size="sm"
            className="board-column-add"
            onClick={() => onStartQuickCreate?.(column)}
          >
            <Icon name="plus" />
          </IconButton>
        ) : null}
      </header>

      {collapsed ? null : (
        <>
          <SortableContext
            items={tasks.map((task) => `task:${task.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="board-column-list">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  context={context}
                  onOpen={onOpen}
                  readOnly={readOnly}
                  selected={selectedTaskId === task.id}
                  selectable={selectable}
                  selectedForBulk={Boolean(selectedIds?.has?.(task.id))}
                  onToggleSelect={onToggleSelect}
                  todayKey={todayKey}
                  formatSettings={formatSettings}
                />
              ))}
              {tasks.length === 0 && !quickCreateActive ? (
                <p className="board-column-empty">No tasks</p>
              ) : null}
            </div>
          </SortableContext>

          {canCreate ? (
            <div className="board-column-footer">
              {quickCreateActive ? (
                <QuickAdd
                  variant="card"
                  contextLabel={column.name}
                  placeholder="Write a task name"
                  onCreate={(title) => onQuickCreate(title, column)}
                  onOpenDetails={
                    onOpenDetails ? (title) => onOpenDetails(title, column) : undefined
                  }
                  onCancel={onCancelQuickCreate}
                />
              ) : (
                <QuickAddTrigger onClick={() => onStartQuickCreate?.(column)} />
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** The shared Kanban board (project columns or the personal status columns). */
export function TaskBoard({
  columns = [],
  tasks = [],
  context,
  onMove,
  onOpen,
  onQuickCreate,
  onOpenDetails,
  readOnly = false,
  collapsible = false,
  initiallyCollapsedIds = [],
  selectedTaskId = null,
  selectable = false,
  selectedIds,
  onToggleSelect,
  todayKey,
  formatSettings,
  className,
  ...rest
}) {
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [quickCreateColumnId, setQuickCreateColumnId] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(() => new Set(initiallyCollapsedIds));
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
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  };

  const handleDragEnd = ({ active, over }) => {
    const taskId = taskIdFromProjectDnd(active?.id);
    setActiveTaskId(null);
    if (readOnly || !taskId || !over) return;
    const placements = buildProjectTaskPlacements({
      columns,
      tasks,
      movingTaskId: taskId,
      overId: over.id,
    });
    if (!placements) return;
    void onMove?.(placements);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveTaskId(taskIdFromProjectDnd(active?.id))}
      onDragCancel={() => setActiveTaskId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className={cx("task-board", className)} aria-label="Task board" {...rest}>
        {columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={tasksByColumn.get(column.id) || []}
            context={context}
            onOpen={onOpen}
            onQuickCreate={onQuickCreate}
            onOpenDetails={onOpenDetails}
            readOnly={readOnly}
            collapsible={collapsible}
            collapsed={collapsible && collapsedIds.has(column.id)}
            onToggleCollapse={() => toggleColumn(column.id)}
            quickCreateActive={quickCreateColumnId === column.id}
            onStartQuickCreate={(target) => {
              if (collapsible && collapsedIds.has(target.id)) toggleColumn(target.id);
              setQuickCreateColumnId(target.id);
            }}
            onCancelQuickCreate={() => setQuickCreateColumnId(null)}
            selectedTaskId={selectedTaskId}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            todayKey={todayKey}
            formatSettings={formatSettings}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <article className="task-card is-overlay">
            <span className="task-card-title">{activeTask.title}</span>
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default TaskBoard;
