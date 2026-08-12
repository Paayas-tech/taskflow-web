import { useRef, useState } from "react";
import TaskEditModal from "./TaskEditModal";
import TaskRow from "./TaskRow";

const dateKeyFor = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isTaskComplete = (task) =>
  task.completed === true || task.status === "completed";

function TodayTaskGroup({
  title,
  description,
  tone,
  tasks,
  lists,
  projects,
  selectedTaskId,
  completionTaskIds,
  onToggleCompletion,
  onEdit,
  emptyMessage,
}) {
  return (
    <section className={`today-task-group today-task-group-${tone}`}>
      <header className="today-task-group-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{tasks.length}</span>
      </header>

      {tasks.length === 0 ? (
        <p className="today-group-empty">{emptyMessage}</p>
      ) : (
        <div className="tasks-page-list today-task-list">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              lists={lists}
              projects={projects}
              completionBusy={completionTaskIds.has(task.id)}
              selected={selectedTaskId === task.id}
              onToggleCompletion={onToggleCompletion}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function TodayPage({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
  onUpdateTask,
  onQuickUpdateTask,
  quickTaskPendingIds,
  onDeleteTask,
  lists,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const editTriggerRef = useRef(null);

  const now = new Date();
  const todayKey = dateKeyFor(now);
  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const activeTasks = tasks.filter((task) => !isTaskComplete(task));
  const overdueTasks = activeTasks
    .filter((task) => task.dueDate && task.dueDate < todayKey)
    .sort((firstTask, secondTask) =>
      firstTask.dueDate.localeCompare(secondTask.dueDate)
    );
  const dueTodayTasks = activeTasks.filter(
    (task) => task.dueDate === todayKey
  );
  const anytimeTasks = activeTasks.filter((task) => !task.dueDate);
  const completedTasks = tasks.filter(
    (task) =>
      isTaskComplete(task) &&
      (!task.dueDate || task.dueDate <= todayKey)
  );
  const futureTaskCount = activeTasks.filter(
    (task) => task.dueDate && task.dueDate > todayKey
  ).length;

  const openEditor = (task, triggerElement) => {
    editTriggerRef.current = triggerElement || null;
    setSelectedTaskId(task.id);
    setMutationError("");
  };

  const closeEditor = () => {
    setSelectedTaskId(null);
  };

  const handleCompletionChange = async (task) => {
    const completed = !isTaskComplete(task);
    setMutationError("");

    try {
      await onQuickUpdateTask(task.id, {
        completed,
        status: completed ? "completed" : "todo",
      });
    } catch (error) {
      console.error("Error updating task completion from Today:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”. Try again.`
      );
    }
  };

  return (
    <section className="today-page" aria-labelledby="today-page-title">
      <header className="today-page-header">
        <div>
          <p className="card-label">Today</p>
          <h2 id="today-page-title">{currentDate}</h2>
          <p>Overdue work comes first, followed by everything due today.</p>
        </div>
        <div className="today-page-summary" aria-label="Today summary">
          <span><strong>{overdueTasks.length}</strong> overdue</span>
          <span><strong>{dueTodayTasks.length}</strong> due today</span>
        </div>
      </header>

      {futureTaskCount > 0 && (
        <p className="today-future-note">
          {futureTaskCount} upcoming {futureTaskCount === 1 ? "task remains" : "tasks remain"} in Tasks.
        </p>
      )}

      {mutationError && (
        <div className="inline-error task-mutation-error" role="alert">
          <p>{mutationError}</p>
          <button
            className="ghost-btn compact-btn"
            type="button"
            onClick={() => setMutationError("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {selectedTask && (
        <TaskEditModal
          key={selectedTask.id}
          task={selectedTask}
          lists={lists}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          onRetryProjects={onRetryProjects}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onClose={closeEditor}
          returnFocusElement={editTriggerRef.current}
        />
      )}

      {tasksLoading ? (
        <div className="tasks-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h3>Loading today...</h3>
          <p>Your saved tasks are being retrieved from Firestore.</p>
        </div>
      ) : tasksError ? (
        <div className="tasks-state error-state" role="alert">
          <h3>Today is unavailable</h3>
          <p>{tasksError}</p>
          <button className="ghost-btn" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="tasks-state">
          <h3>Nothing scheduled yet</h3>
          <p>Use New Task to add your first task.</p>
        </div>
      ) : (
        <div className="today-sections">
          <TodayTaskGroup
            title="Overdue"
            description="Needs attention before today’s work."
            tone="overdue"
            tasks={overdueTasks}
            lists={lists}
            projects={projects}
            selectedTaskId={selectedTaskId}
            completionTaskIds={quickTaskPendingIds}
            onToggleCompletion={handleCompletionChange}
            onEdit={openEditor}
            emptyMessage="No overdue tasks."
          />
          <TodayTaskGroup
            title="Due today"
            description="The tasks scheduled for today."
            tone="today"
            tasks={dueTodayTasks}
            lists={lists}
            projects={projects}
            selectedTaskId={selectedTaskId}
            completionTaskIds={quickTaskPendingIds}
            onToggleCompletion={handleCompletionChange}
            onEdit={openEditor}
            emptyMessage="Nothing else is due today."
          />
          {anytimeTasks.length > 0 && (
            <TodayTaskGroup
              title="Anytime"
              description="Tasks without a due date stay visible here."
              tone="anytime"
              tasks={anytimeTasks}
              lists={lists}
              projects={projects}
              selectedTaskId={selectedTaskId}
              completionTaskIds={quickTaskPendingIds}
              onToggleCompletion={handleCompletionChange}
              onEdit={openEditor}
            />
          )}
          {completedTasks.length > 0 && (
            <TodayTaskGroup
              title="Completed"
              description="Finished tasks relevant to this view."
              tone="completed"
              tasks={completedTasks}
              lists={lists}
              projects={projects}
              selectedTaskId={selectedTaskId}
              completionTaskIds={quickTaskPendingIds}
              onToggleCompletion={handleCompletionChange}
              onEdit={openEditor}
            />
          )}
        </div>
      )}

    </section>
  );
}
