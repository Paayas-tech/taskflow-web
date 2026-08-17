import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import ProjectTaskCard from "./ProjectTaskCard";

export default function ProjectColumn({ column, tasks, onEdit, onCreateTask, readOnly = false }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });

  return (
    <section
      ref={setNodeRef}
      className={`project-board-column${isOver ? " is-over" : ""}`}
      aria-labelledby={`column-${column.id}`}
    >
      <header>
        <div>
          <h3 id={`column-${column.id}`}>{column.name}</h3>
          <span>{tasks.length}</span>
        </div>
        {!readOnly && (
          <button type="button" onClick={() => onCreateTask(column)} aria-label={`Create task in ${column.name}`}>+</button>
        )}
      </header>

      <SortableContext
        items={tasks.map((task) => `task:${task.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="project-board-column-list">
          {tasks.map((task) => (
            <ProjectTaskCard key={task.id} task={task} onEdit={onEdit} readOnly={readOnly} />
          ))}
          {tasks.length === 0 && <p className="project-column-empty">{readOnly ? "No tasks" : "Drop a task here"}</p>}
        </div>
      </SortableContext>
    </section>
  );
}
