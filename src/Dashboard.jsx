import { classifyDateOnly, dateOnlyKey, formatTaskDueDate, isTaskComplete } from "./domain/taskDomain";
import { effectiveMyDayDate } from "./domain/settingsDomain";

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function AssignedTaskRow({ task, todayKey, selected, onOpenTask }) {
  const dueGroup = classifyDateOnly(task.dueDate, todayKey);
  return <button className={`dashboard-assigned-row${selected ? " is-selected" : ""}`} type="button" aria-pressed={selected} onClick={() => onOpenTask?.(task)}><span className="dashboard-assigned-completion" aria-label={isTaskComplete(task) ? "Completed" : "Incomplete"}>{isTaskComplete(task) ? "✓" : ""}</span><span><strong>{task.title}</strong><small>{task.projectName || "Project"}</small></span><time className={dueGroup === "overdue" || dueGroup === "today" ? "urgent" : ""}>{task.dueDate ? (dueGroup === "today" ? "Today" : formatTaskDueDate(task.dueDate)) : "No date"}</time><span className={`priority priority-${task.priority || "medium"}`}>{task.priority || "medium"}</span></button>;
}

function DashboardTaskRow({ task, project, todayKey, completionBusy, selected, onToggleTask, onOpenTask }) {
  const dueGroup = task.dueDate ? classifyDateOnly(task.dueDate, todayKey) : "";
  const completed = isTaskComplete(task);
  const toggleCompletion = (event) => {
    const button = event?.currentTarget;
    const mark = button?.querySelector("span");
    if (button) button.classList.toggle("is-complete", !completed);
    if (mark) mark.textContent = completed ? "" : "✓";
    try {
      const result = onToggleTask?.(task);
      Promise.resolve(result).catch(() => {
        if (button) button.classList.toggle("is-complete", completed);
        if (mark) mark.textContent = completed ? "✓" : "";
      });
    } catch {
      if (button) button.classList.toggle("is-complete", completed);
      if (mark) mark.textContent = completed ? "✓" : "";
    }
  };
  return <article className={`dashboard-home-task-row${selected ? " is-selected" : ""}`}>
    <button className={`completion-control ${completed ? "is-complete" : ""}`} type="button" aria-label={`Mark ${task.title} complete`} aria-busy={completionBusy} onClick={toggleCompletion} disabled={completionBusy}><span aria-hidden="true">{completed ? "✓" : completionBusy ? "…" : ""}</span></button>
    <button type="button" className="dashboard-home-task-name" aria-pressed={selected} onClick={() => onOpenTask?.(task)}><strong>{task.title}</strong><small>{project?.name || "Personal"}</small></button>
    <span className={`priority priority-${task.priority || "medium"}`}>{task.priority || "medium"}</span>
    <time className={dueGroup === "overdue" ? "urgent" : ""}>{!task.dueDate ? "No date" : dueGroup === "today" ? "Today" : formatTaskDueDate(task.dueDate)}</time>
  </article>;
}

export default function Dashboard({
  tasks = [], tasksLoading, tasksError, onRetry, myDaySettings,
  assignedTasks = [], assignedTasksLoading = false, assignedTasksError = "", onRetryAssignedTasks,
  pendingInvitations = [], invitationsLoading = false, invitationsError = "", onOpenInvitations,
  onOpenProject, onViewAllTasks, onViewAllAssigned, onViewAllProjects, displayName = "",
  onOpenTask, projects = [], projectsLoading = false,
  projectsError = "", onRetryProjects, notificationControl = null,
  searchQuery = "", onSearchChange,
  showGlobalActions = true,
  onToggleTask, quickTaskPendingIds = new Set(),
  selectedTaskId = null,
  taskView = "upcoming", onTaskViewChange,
  summaryPeriod = "week", onSummaryPeriodChange,
}) {
  const now = effectiveMyDayDate(new Date(), myDaySettings);
  const todayKey = dateOnlyKey(now);
  const firstName = String(displayName || "").trim().split(/\s+/)[0] || "";
  const currentHour = now.getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const completedTasks = tasks.filter(isTaskComplete);
  const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < todayKey && !isTaskComplete(task));
  const weekStart = startOfDay(now); weekStart.setDate(weekStart.getDate() - 6);
  const weeklyCompleted = completedTasks.filter((task) => { const value = new Date(task.completedAt || ""); return !Number.isNaN(value.getTime()) && value >= weekStart && value <= now; }).length;
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthlyCompleted = completedTasks.filter((task) => { const value = new Date(task.completedAt || ""); return !Number.isNaN(value.getTime()) && value >= monthStart && value <= now; }).length;
  const periodCompleted = summaryPeriod === "month" ? monthlyCompleted : weeklyCompleted;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const assignedProjectWork = assignedTasks.filter((task) => task.projectId && task.workType !== "story").filter((task) => !normalizedQuery || `${task.title} ${task.description || ""} ${task.projectName || ""}`.toLocaleLowerCase().includes(normalizedQuery));
  const visibleAssignedTasks = assignedProjectWork.slice(0, 5);
  const recentProjects = [...projects].filter((project) => !normalizedQuery || `${project.name} ${project.description || ""}`.toLocaleLowerCase().includes(normalizedQuery)).sort((first, second) => String(second.updatedAt || second.createdAt || "").localeCompare(String(first.updatedAt || first.createdAt || ""))).slice(0, 4);

  const dashboardTaskLists = {
    upcoming: tasks.filter((task) => {
      if (!isTaskComplete(task)) return !task.dueDate || task.dueDate >= todayKey;
      const completedAt = new Date(task.completedAt || "");
      return !Number.isNaN(completedAt.getTime()) && dateOnlyKey(completedAt) === todayKey;
    }),
    overdue: overdueTasks,
    completed: completedTasks,
  };
  const visibleMyTasks = (dashboardTaskLists[taskView] || dashboardTaskLists.upcoming)
    .filter((task) => !normalizedQuery || `${task.title} ${task.description || ""}`.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, 5);
  const formattedDay = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);

  return <div className="dashboard-page dashboard-reference-page">
    <header className="dashboard-home-header"><div className="dashboard-home-title"><time>{formattedDay}</time><h1>{greeting}{firstName ? `, ${firstName}` : ""}</h1></div><div className="dashboard-home-toolbar"><label><span className="sr-only">Dashboard summary period</span><select value={summaryPeriod} onChange={(event) => onSummaryPeriodChange?.(event.target.value)}><option value="week">My week</option><option value="month">My month</option></select></label></div></header>
    {showGlobalActions && <div className="dashboard-home-actions"><label className="dashboard-search"><span className="sr-only">Search tasks and projects</span><input type="search" value={searchQuery} onChange={(event) => onSearchChange?.(event.target.value)} placeholder="Search tasks, projects..." /></label>{notificationControl}</div>}
    {tasksLoading ? <section className="dashboard-feedback" role="status"><span className="dashboard-loading-indicator" /> Loading your dashboard…</section> : tasksError ? <section className="dashboard-feedback dashboard-feedback-error" role="alert"><span>Dashboard tasks are temporarily unavailable.</span><button className="ghost-btn" onClick={onRetry}>Try again</button></section> : <>
      <div className="dashboard-home-primary-grid">
        <section className="dashboard-reference-card dashboard-my-tasks-card"><header><div><h2>My Tasks</h2><span className="dashboard-completed-summary">{periodCompleted} completed</span></div><button type="button" onClick={onViewAllTasks}>View all</button></header><nav aria-label="My task views">{[["upcoming", "Upcoming", dashboardTaskLists.upcoming.length], ["overdue", "Overdue", overdueTasks.length], ["completed", "Completed", completedTasks.length]].map(([value, label, count]) => <button type="button" key={value} className={taskView === value ? "active" : ""} aria-pressed={taskView === value} onClick={() => onTaskViewChange?.(value)}>{label}<span>{count}</span></button>)}</nav>{visibleMyTasks.length ? <div>{visibleMyTasks.map((task) => <DashboardTaskRow key={task.id} task={task} project={projects.find((project) => project.id === task.projectId)} todayKey={todayKey} completionBusy={quickTaskPendingIds.has(task.id)} selected={selectedTaskId === task.id} onToggleTask={onToggleTask} onOpenTask={onOpenTask} />)}</div> : <div className="dashboard-quiet-empty"><span>No {taskView} tasks</span><button type="button" onClick={onViewAllTasks}>Open My Tasks</button></div>}</section>
        <section className="dashboard-reference-card dashboard-projects-card"><header><h2>Projects</h2><button type="button" onClick={onViewAllProjects}>View all</button></header>{projectsLoading ? <p className="dashboard-card-state">Loading projects…</p> : projectsError ? <div className="dashboard-card-state"><span>Projects are unavailable.</span><button className="ghost-btn compact-btn" onClick={onRetryProjects}>Try again</button></div> : recentProjects.length ? <div>{recentProjects.map((project) => <button key={project.id} className="dashboard-home-project-row" type="button" onClick={() => onOpenProject?.(project.id)}><span className="dashboard-project-icon" style={{ "--project-color": project.color || "#6657c8" }} /><span><strong>{project.name}</strong><small>{project.description || (project.viewerRole === "owner" ? "Personal" : `Shared · ${(project.viewerRole || "member").replace(/^./, (value) => value.toUpperCase())}`)}</small></span>{project.status && project.status !== "active" && <span className={`project-status project-status-${project.status}`}>{project.status}</span>}<span aria-hidden="true">›</span></button>)}</div> : <div className="dashboard-quiet-empty"><span>No projects yet</span></div>}</section>
      </div>
      <section className="dashboard-reference-card dashboard-assigned-to-me-card"><header><h2>Assigned to me</h2>{assignedProjectWork.length > 5 && <button type="button" onClick={onViewAllAssigned}>View all</button>}</header>{assignedTasksLoading ? <p className="dashboard-card-state" role="status">Loading assigned tasks…</p> : assignedTasksError ? <div className="dashboard-card-state" role="alert"><span>Assigned tasks unavailable.</span><button className="ghost-btn compact-btn" onClick={onRetryAssignedTasks}>Retry</button></div> : visibleAssignedTasks.length ? <div>{visibleAssignedTasks.map((task) => <AssignedTaskRow key={`${task.projectId}-${task.id}`} task={task} todayKey={todayKey} selected={selectedTaskId === task.id} onOpenTask={onOpenTask} />)}</div> : <div className="dashboard-assigned-empty">No tasks assigned to you</div>}</section>
      {(pendingInvitations.length > 0 || invitationsLoading || invitationsError) && <aside className="dashboard-invitation-card dashboard-invitation-strip"><strong>Invitations</strong><span>{invitationsLoading ? "Loading…" : invitationsError ? "Unavailable." : `${pendingInvitations.length} pending`}</span>{pendingInvitations.length > 0 && <button type="button" onClick={onOpenInvitations}>Review</button>}</aside>}
    </>}
  </div>;
}
