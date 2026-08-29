import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import ProjectTaskCard from "./ProjectTaskCard";
import ProjectTaskQuickCreate from "./ProjectTaskQuickCreate";

export default function ProjectColumn({
  column,
  tasks,
  onEdit,
  onStartQuickCreate,
  onQuickCreate,
  onCancelQuickCreate,
  onAddTaskDetails,
  quickCreateActive = false,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  readOnly = false,
  formatSettings = {},
  bulkSelectionEnabled = false,
  selectedTaskIds = new Set(),
  onToggleTaskSelection,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });

  const startQuickCreate = () => {
    if (collapsed) onToggleCollapse?.();
    onStartQuickCreate(column);
  };

  return (
    <section
      ref={setNodeRef}
      className={`project-board-column${isOver ? " is-over" : ""}`}
      aria-labelledby={`column-${column.id}`}
    >
      <header>
        <div className="project-column-heading">
          {collapsible && (
            <button
              type="button"
              className="project-column-collapse"
              onClick={onToggleCollapse}
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${column.name}`}
              aria-expanded={!collapsed}
            >
              <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
            </button>
          )}
          <h3 id={`column-${column.id}`}>{column.name}</h3>
          <span className="project-column-count">{tasks.length}</span>
        </div>
        {!readOnly && (
          <button className="project-column-header-add" type="button" onClick={startQuickCreate} aria-label={`Add task to ${column.name}`}>+</button>
        )}
      </header>

      {!collapsed && (
        <SortableContext
          items={tasks.map((task) => `task:${task.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="project-board-column-list">
            {tasks.map((task) => (
              <ProjectTaskCard key={task.id} task={task} onEdit={onEdit} readOnly={readOnly} formatSettings={formatSettings} bulkSelectionEnabled={bulkSelectionEnabled} bulkSelected={selectedTaskIds.has(task.id)} onToggleBulkSelection={onToggleTaskSelection} />
            ))}
            {quickCreateActive && !readOnly && (
              <ProjectTaskQuickCreate
                contextLabel={column.name}
                variant="board"
                onCreate={(title) => onQuickCreate(title, column)}
                onCancel={onCancelQuickCreate}
                onAddDetails={onAddTaskDetails ? (title) => onAddTaskDetails(column, title) : undefined}
              />
            )}
            {tasks.length === 0 && !quickCreateActive && (
              <p className="project-column-empty">{readOnly ? "No tasks" : `No tasks in ${column.name.toLowerCase()}`}</p>
            )}
            {!readOnly && !quickCreateActive && (
              <button
                type="button"
                className="project-column-add-task"
                onClick={startQuickCreate}
              >
                + Add task
              </button>
            )}
          </div>
        </SortableContext>
      )}
    </section>
  );
}
