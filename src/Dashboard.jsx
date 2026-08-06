export default function Dashboard({
  user,
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
  onSignOut,
}) {
  const todayTasks = tasks.slice(0, 3).map((task, index) => ({
    ...task,
    time: task.dueDate || "No due date",
    status: task.status || "Pending",
    _key: task.id || task.title || `task-${index}`,
  }));

  const boardColumns = [
    {
      name: "To do",
      items: tasks.filter(
        (task) =>
          task.status === "todo" ||
          task.status === "Todo" ||
          !task.status
      ),
    },
    {
      name: "In progress",
      items: tasks.filter(
        (task) =>
          task.status === "in-progress" ||
          task.status === "In Progress"
      ),
    },
    {
      name: "Completed",
      items: tasks.filter(
        (task) => task.status === "completed" || task.completed
      ),
    },
  ];

  const calendarEvents = tasks
    .filter((task) => task.dueDate)
    .map((task, index) => ({
      day: task.dueDate,
      label: task.title,
      _key: task.id || `${task.title}-${task.dueDate}-${index}`,
    }));

  const reminders = tasks
    .filter((task) => task.reminder)
    .map((task, index) => ({
      title: task.title,
      meta: task.dueDate ? `Due ${task.dueDate}` : "Reminder set",
      _key:
        task.id || `${task.title}-${task.dueDate || "reminder"}-${index}`,
    }));

  return (
    <>
      <section className="hero-grid">
        <article className="hero-card accent">
          <p className="card-label">Focus</p>
          <h2>Build the first version of your task app UI</h2>
          <p>
            Keep the structure flexible so Firebase, collaboration, and AI
            agents can be added later.
          </p>
        </article>

        <article className="hero-card">
          <p className="card-label">Reminders</p>
          <h3>{reminders.length} due today</h3>
          <p>Task reminders are connected with Firestore.</p>
        </article>

        <article className="hero-card">
          <p className="card-label">Calendar</p>
          <h3>Weekly view</h3>
          <p>Tasks with due dates appear here.</p>
        </article>
      </section>

      <section className="content-grid task-board-grid">
        <article className="panel panel-wide todo-panel">
          <div className="panel-header">
            <h2>To-do list</h2>
            <button className="ghost-btn" disabled>
              View all
            </button>
          </div>

          <div className="task-list">
            {tasksLoading ? (
              <p>Loading tasks...</p>
            ) : tasksError ? (
              <div className="inline-error" role="alert">
                <p>{tasksError}</p>
                <button className="ghost-btn" onClick={onRetry}>
                  Try again
                </button>
              </div>
            ) : todayTasks.length === 0 ? (
              <p>No tasks created yet.</p>
            ) : (
              todayTasks.map((task) => (
                <div key={task._key} className="task-row">
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.time}</p>
                  </div>

                  <span
                    className={`status ${
                      task.status === "in-progress" ? "active" : ""
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel panel-wide board-panel">
          <div className="panel-header">
            <h2>Project board</h2>
            <button className="ghost-btn" disabled>
              Open board
            </button>
          </div>

          <div className="board-columns">
            {boardColumns.map((column) => (
              <div key={column.name} className="board-column">
                <div className="column-head">
                  <h3>{column.name}</h3>
                  <span>{column.items.length}</span>
                </div>

                {column.items.length === 0 ? (
                  <div className="board-item">No tasks</div>
                ) : (
                  column.items.map((task, index) => (
                    <div
                      key={task.id || task.title || `${column.name}-${index}`}
                      className="board-item"
                    >
                      {task.title}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid bottom-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Calendar</h2>
            <button className="ghost-btn" disabled>
              Monthly
            </button>
          </div>

          <div className="calendar-list">
            {calendarEvents.length === 0 ? (
              <p>No scheduled tasks.</p>
            ) : (
              calendarEvents.map((event) => (
                <div key={event._key} className="calendar-item">
                  <span className="calendar-day-label">{event.day}</span>
                  <strong className="calendar-day-title">
                    {event.label}
                  </strong>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Account</h2>
            <button className="ghost-btn" onClick={onSignOut}>
              Sign out
            </button>
          </div>

          <div className="account-card">
            <div className="avatar">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>

            <div>
              <h3>{user.email}</h3>
              <p>Firebase authentication is connected.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="reminders-section">
        <article className="panel">
          <div className="panel-header">
            <h2>Reminders</h2>
            <button className="ghost-btn" disabled>
              Manage
            </button>
          </div>

          <div className="reminder-grid">
            {reminders.length === 0 ? (
              <p>No reminders available.</p>
            ) : (
              reminders.map((reminder) => (
                <div key={reminder._key} className="reminder-card">
                  <p>{reminder.title}</p>
                  <span>{reminder.meta}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <footer className="dashboard-footer">
        Â© 2026 TaskFlow. All rights reserved.
      </footer>
    </>
  );
}
