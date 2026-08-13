import {
  classifyDateOnly,
  compareDateOnly,
  dateOnlyKey,
  formatTaskDueDate,
  isTaskComplete,
} from "./domain/taskDomain";

function DashboardTaskRow({ task, dateLabel }) {
  const isOverdue = dateLabel?.startsWith("Overdue");

  return (
    <div className="dashboard-task-row">
      <span
        className={`dashboard-task-marker ${isOverdue ? "is-overdue" : ""}`}
        aria-hidden="true"
      />

      <div className="dashboard-task-copy">
        <h3>{task.title}</h3>
        <div className="dashboard-task-meta">
          <span className={isOverdue ? "dashboard-overdue" : ""}>
            {dateLabel || formatTaskDueDate(task.dueDate)}
          </span>
          {task.priority === "high" && (
            <span className="dashboard-priority">High priority</span>
          )}
          {task.reminder && <span>Reminder</span>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
}) {
  const now = new Date();
  const todayKey = dateOnlyKey(now);
  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const remainingTasks = tasks.filter((task) => !isTaskComplete(task));
  const completedTasks = tasks.filter(isTaskComplete);
  const reminderTasks = remainingTasks.filter((task) => task.reminder);
  const todayTasks = remainingTasks.filter(
    (task) => classifyDateOnly(task.dueDate, todayKey) === "today"
  );
  const overdueTasks = remainingTasks
    .filter((task) => classifyDateOnly(task.dueDate, todayKey) === "overdue")
    .sort((firstTask, secondTask) =>
      compareDateOnly(firstTask.dueDate, secondTask.dueDate)
    );
  const focusTasks = [...overdueTasks, ...todayTasks];
  const upcomingTasks = remainingTasks
    .filter((task) => classifyDateOnly(task.dueDate, todayKey) === "upcoming")
    .sort((firstTask, secondTask) =>
      compareDateOnly(firstTask.dueDate, secondTask.dueDate)
    )
    .slice(0, 5);
  const anytimeTasks = remainingTasks
    .filter((task) => classifyDateOnly(task.dueDate, todayKey) === "undated")
    .slice(0, 4);

  return (
    <div className="dashboard-page">
      <section className="dashboard-intro" aria-labelledby="dashboard-greeting">
        <div>
          <p className="dashboard-kicker">Your day</p>
          <h2 id="dashboard-greeting">Welcome back</h2>
          <p className="dashboard-date">{currentDate}</p>
        </div>
      </section>

      {tasksLoading ? (
        <section className="dashboard-feedback" role="status" aria-live="polite">
          <span className="dashboard-loading-indicator" aria-hidden="true" />
          <div>
            <h3>Loading your day</h3>
            <p>Your saved tasks are being retrieved.</p>
          </div>
        </section>
      ) : tasksError ? (
        <section className="dashboard-feedback dashboard-feedback-error" role="alert">
          <div>
            <h3>Tasks unavailable</h3>
            <p>{tasksError}</p>
          </div>
          <button className="ghost-btn" type="button" onClick={onRetry}>
            Try again
          </button>
        </section>
      ) : (
        <>
          <section className="dashboard-summary" aria-label="Task summary">
            <div className="summary-stat summary-stat-remaining">
              <span className="summary-stat-mark" aria-hidden="true" />
              <strong>{remainingTasks.length}</strong>
              <span>Remaining</span>
            </div>
            <div className="summary-stat summary-stat-completed">
              <span className="summary-stat-mark" aria-hidden="true" />
              <strong>{completedTasks.length}</strong>
              <span>Completed</span>
            </div>
            <div className="summary-stat summary-stat-reminders">
              <span className="summary-stat-mark" aria-hidden="true" />
              <strong>{reminderTasks.length}</strong>
              <span>Active reminders</span>
            </div>
          </section>

          <div className="dashboard-layout">
            <section className="dashboard-section dashboard-today" aria-labelledby="today-heading">
              <header className="dashboard-section-header">
                <div>
                  <p className="dashboard-kicker">Focus</p>
                  <h2 id="today-heading">Today</h2>
                </div>
                <span className="dashboard-section-count">{focusTasks.length}</span>
              </header>

              {focusTasks.length === 0 ? (
                <div className="dashboard-empty">
                  <span className="dashboard-empty-mark" aria-hidden="true">✓</span>
                  <h3>You’re all caught up.</h3>
                  <p>Nothing is due today.</p>
                </div>
              ) : (
                <div className="dashboard-task-list">
                  {focusTasks.map((task) => (
                    <DashboardTaskRow
                      key={task.id}
                      task={task}
                      dateLabel={
                        classifyDateOnly(task.dueDate, todayKey) === "overdue"
                          ? `Overdue · ${formatTaskDueDate(task.dueDate)}`
                          : "Today"
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="dashboard-section dashboard-agenda" aria-labelledby="up-next-heading">
              <header className="dashboard-section-header">
                <div>
                  <p className="dashboard-kicker">Plan ahead</p>
                  <h2 id="up-next-heading">Up next</h2>
                </div>
              </header>

              <div className="dashboard-task-group">
                <div className="dashboard-group-heading">
                  <h3>Upcoming</h3>
                  <span>{upcomingTasks.length}</span>
                </div>
                {upcomingTasks.length === 0 ? (
                  <p className="dashboard-group-empty">No upcoming due dates.</p>
                ) : (
                  <div className="dashboard-task-list dashboard-task-list-compact">
                    {upcomingTasks.map((task) => (
                      <DashboardTaskRow key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-task-group">
                <div className="dashboard-group-heading">
                  <h3>Anytime</h3>
                  <span>{anytimeTasks.length}</span>
                </div>
                {anytimeTasks.length === 0 ? (
                  <p className="dashboard-group-empty">No tasks without a due date.</p>
                ) : (
                  <div className="dashboard-task-list dashboard-task-list-compact">
                    {anytimeTasks.map((task) => (
                      <DashboardTaskRow
                        key={task.id}
                        task={task}
                        dateLabel="No due date"
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <footer className="dashboard-footer">
        © {now.getFullYear()} TaskFlow
      </footer>
    </div>
  );
}
