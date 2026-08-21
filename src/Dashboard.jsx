import {
  classifyDateOnly,
  compareDateOnly,
  dateOnlyKey,
  formatTaskDueDate,
  isTaskComplete,
} from "./domain/taskDomain";
import { effectiveMyDayDate } from "./domain/settingsDomain";

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

const assignmentDueLabel = (task, todayKey) => {
  const group = classifyDateOnly(task.dueDate, todayKey);
  if (group === "overdue") {
    return `Overdue · ${formatTaskDueDate(task.dueDate)}`;
  }
  if (group === "today") return "Due today";
  return formatTaskDueDate(task.dueDate);
};

const assignmentStatusLabel = (status) =>
  status === "in-progress" || status === "in_progress"
    ? "In progress"
    : status === "completed" || status === "done"
      ? "Completed"
      : "To do";

function DashboardAssignmentRow({ task, todayKey, onOpenProject }) {
  const overdue = classifyDateOnly(task.dueDate, todayKey) === "overdue";

  return (
    <button
      className="dashboard-assignment-row"
      type="button"
      onClick={() => onOpenProject(task.projectId)}
      aria-label={`Open ${task.title} in ${task.projectName}`}
    >
      <span
        className={`dashboard-task-marker ${overdue ? "is-overdue" : ""}`}
        aria-hidden="true"
      />
      <span className="dashboard-task-copy">
        <strong>{task.title}</strong>
        <span className="dashboard-task-meta">
          <span>{task.projectName}</span>
          <span className={overdue ? "dashboard-overdue" : ""}>
            {assignmentDueLabel(task, todayKey)}
          </span>
          <span>{assignmentStatusLabel(task.status)}</span>
          <span className={task.priority === "high" ? "dashboard-priority" : ""}>
            {task.priority === "high"
              ? "High priority"
              : `${task.priority[0]?.toUpperCase() || "M"}${task.priority.slice(1)} priority`}
          </span>
        </span>
      </span>
      <span className="dashboard-assignment-arrow" aria-hidden="true">›</span>
    </button>
  );
}

export default function Dashboard({
  tasks,
  tasksLoading,
  tasksError,
  onRetry,
  myDaySettings,
  assignedTasks = [],
  assignedTasksLoading = false,
  assignedTasksError = "",
  onRetryAssignedTasks,
  accessibleProjectCount = 0,
  pendingInvitations = [],
  invitationsLoading = false,
  invitationsError = "",
  onOpenProject,
  onOpenInvitations,
}) {
  const now = effectiveMyDayDate(new Date(), myDaySettings);
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

      <section
        className="dashboard-collaboration"
        aria-labelledby="collaboration-heading"
      >
        <header className="dashboard-section-header dashboard-collaboration-header">
          <div>
            <p className="dashboard-kicker">Collaboration</p>
            <h2 id="collaboration-heading">My work</h2>
          </div>
        </header>

        <div className="dashboard-collaboration-summary" aria-label="Collaboration summary">
          <div className="dashboard-collaboration-stat">
            <strong>{accessibleProjectCount}</strong>
            <span>Accessible projects</span>
          </div>
          <div className="dashboard-collaboration-stat">
            <strong>{assignedTasks.length}</strong>
            <span>Tasks needing attention</span>
          </div>
          <div className="dashboard-collaboration-stat">
            <strong>{invitationsLoading ? "…" : pendingInvitations.length}</strong>
            <span>Pending invitations</span>
          </div>
        </div>

        <div className="dashboard-collaboration-layout">
          <section
            className="dashboard-collaboration-panel dashboard-assignments"
            aria-labelledby="assigned-tasks-heading"
          >
            <div className="dashboard-group-heading">
              <h3 id="assigned-tasks-heading">Assigned to me</h3>
              <span aria-label={`${assignedTasks.length} assigned tasks`}>
                {assignedTasks.length}
              </span>
            </div>

            {assignedTasksLoading ? (
              <div className="dashboard-collaboration-state" role="status">
                <span className="dashboard-loading-indicator" aria-hidden="true" />
                <span>Loading assigned tasks…</span>
              </div>
            ) : assignedTasksError ? (
              <div className="dashboard-collaboration-state dashboard-collaboration-error" role="alert">
                <span>{assignedTasksError}</span>
                <button className="ghost-btn compact-btn" type="button" onClick={onRetryAssignedTasks}>
                  Try again
                </button>
              </div>
            ) : assignedTasks.length === 0 ? (
              <p className="dashboard-group-empty">
                No active project tasks are assigned to you.
              </p>
            ) : (
              <div className="dashboard-assignment-list">
                {assignedTasks.slice(0, 6).map((task) => (
                  <DashboardAssignmentRow
                    key={task.id}
                    task={task}
                    todayKey={todayKey}
                    onOpenProject={onOpenProject}
                  />
                ))}
                {assignedTasks.length > 6 && (
                  <p className="dashboard-assignment-more">
                    {assignedTasks.length - 6} more assigned tasks are available in your projects.
                  </p>
                )}
              </div>
            )}
          </section>

          <section
            className="dashboard-collaboration-panel dashboard-invitations"
            aria-labelledby="dashboard-invitations-heading"
          >
            <div className="dashboard-group-heading">
              <h3 id="dashboard-invitations-heading">Invitations</h3>
              <span>{invitationsLoading ? "…" : pendingInvitations.length}</span>
            </div>
            {invitationsLoading ? (
              <p className="dashboard-group-empty" role="status">
                Loading invitations…
              </p>
            ) : invitationsError ? (
              <p className="dashboard-collaboration-inline-error" role="alert">
                Invitations are temporarily unavailable.
              </p>
            ) : pendingInvitations.length === 0 ? (
              <p className="dashboard-group-empty">No invitations need your response.</p>
            ) : (
              <>
                <p className="dashboard-invitation-copy">
                  You have {pendingInvitations.length} project {pendingInvitations.length === 1 ? "invitation" : "invitations"} waiting.
                </p>
                <button className="primary-btn compact-btn" type="button" onClick={onOpenInvitations}>
                  Review invitations
                </button>
              </>
            )}
          </section>
        </div>
      </section>

      <footer className="dashboard-footer">
        © {now.getFullYear()} TaskFlow
      </footer>
    </div>
  );
}
