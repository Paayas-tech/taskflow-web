const statusLabels = {
  todo: "To do",
  "in-progress": "In progress",
  completed: "Completed",
};

export default function TasksPage({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
}) {
  return (
    <section className="tasks-page" aria-labelledby="tasks-page-title">
      <div className="tasks-page-header">
        <div>
          <p className="card-label">Task foundation</p>
          <h2 id="tasks-page-title">All tasks</h2>
          <p>
            A focused view of the tasks saved to your TaskFlow account.
          </p>
        </div>
        {!tasksLoading && !tasksError && (
          <span className="tasks-count">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        )}
      </div>

      {tasksLoading ? (
        <div className="tasks-state" role="status">
          <h3>Loading tasks...</h3>
          <p>Your saved tasks are being retrieved from Firestore.</p>
        </div>
      ) : tasksError ? (
        <div className="tasks-state error-state" role="alert">
          <h3>Tasks unavailable</h3>
          <p>{tasksError}</p>
          <button className="ghost-btn" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="tasks-state">
          <h3>No tasks yet</h3>
          <p>Use New Task to create your first task.</p>
        </div>
      ) : (
        <div className="tasks-page-list">
          {tasks.map((task) => (
            <article key={task.id} className="tasks-page-row">
              <div className="tasks-page-copy">
                <h3>{task.title}</h3>
                {task.description && <p>{task.description}</p>}
                <div className="tasks-page-meta">
                  <span>{task.dueDate || "No due date"}</span>
                  {task.reminder && <span>Reminder set</span>}
                </div>
              </div>

              <span className={`task-status task-status-${task.status}`}>
                {statusLabels[task.status] || "To do"}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
