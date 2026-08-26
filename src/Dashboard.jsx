import { classifyDateOnly, compareDateOnly, dateOnlyKey, formatTaskDueDate, isTaskComplete } from "./domain/taskDomain";
import { effectiveMyDayDate } from "./domain/settingsDomain";

const priorityColors = { high: "#ef777c", medium: "#f3ba4f", low: "#62bf8c" };
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dateKeyFrom = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const chartPeriods = {
  "7-days": { label: "Last 7 days", days: 7 },
  "30-days": { label: "Last 30 days", days: 30 },
  month: { label: "This month", month: true },
  year: { label: "This year", year: true },
};

function chartSeries(tasks, now, period) {
  const datedByCompletion = tasks.some((task) => task.completedAt);
  const timestampFor = (task) => datedByCompletion ? task.completedAt : task.createdAt;
  if (period === "year") {
    return Array.from({ length: 12 }, (_, month) => ({
      key: `${now.getFullYear()}-${month}`,
      label: new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(now.getFullYear(), month, 1)),
      value: tasks.filter((task) => { const date = new Date(timestampFor(task) || ""); return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === month; }).length,
    }));
  }
  const configuredDays = chartPeriods[period]?.days;
  const totalDays = chartPeriods[period]?.month ? now.getDate() : configuredDays || 7;
  const bucketSize = totalDays > 14 ? Math.ceil(totalDays / 10) : 1;
  const start = chartPeriods[period]?.month ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - totalDays + 1);
  const buckets = [];
  for (let offset = 0; offset < totalDays; offset += bucketSize) {
    const bucketStart = new Date(start); bucketStart.setDate(start.getDate() + offset);
    const bucketEnd = new Date(bucketStart); bucketEnd.setDate(bucketStart.getDate() + Math.min(bucketSize, totalDays - offset) - 1); bucketEnd.setHours(23, 59, 59, 999);
    buckets.push({
      key: dateKeyFrom(bucketStart),
      label: bucketSize === 1 ? new Intl.DateTimeFormat(undefined, { weekday: totalDays === 7 ? "short" : undefined, day: totalDays === 7 ? undefined : "numeric", month: totalDays === 7 ? undefined : "short" }).format(bucketStart) : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(bucketStart),
      value: tasks.filter((task) => { const date = new Date(timestampFor(task) || ""); return !Number.isNaN(date.getTime()) && date >= bucketStart && date <= bucketEnd; }).length,
    });
  }
  return buckets;
}

function ActivityChart({ tasks, now, period }) {
  const days = chartSeries(tasks, now, period);
  const max = Math.max(1, ...days.map((day) => day.value));
  const step = days.length > 1 ? 600 / (days.length - 1) : 600;
  const points = days.map((day, index) => `${index * step},${150 - (day.value / max) * 120}`).join(" ");
  const metric = tasks.some((task) => task.completedAt) ? "completed" : "created";
  return <div className="dashboard-chart" aria-label={`Tasks ${metric} during ${chartPeriods[period].label.toLocaleLowerCase()}`}><svg viewBox="0 0 600 170" role="img" aria-label={days.map((day) => `${day.label}: ${day.value}`).join(", ")}>{[30, 70, 110, 150].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} />)}<polygon points={`0,150 ${points} 600,150`} /><polyline points={points} />{days.map((day, index) => <circle key={day.key} cx={index * step} cy={150 - (day.value / max) * 120} r="4" />)}</svg><div style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>{days.map((day) => <span key={day.key}>{day.label}</span>)}</div></div>;
}

function UpcomingRow({ task, todayKey, onOpenTask, onOpenProject }) {
  const dueGroup = classifyDateOnly(task.dueDate, todayKey);
  const projectTask = Boolean(task.projectId && task.projectName);
  return <button className="dashboard-upcoming-row" type="button" onClick={() => projectTask ? onOpenProject?.(task.projectId) : onOpenTask?.(task)}><span className="dashboard-upcoming-icon" aria-hidden="true">✓</span><span><strong>{task.title}</strong><small>{projectTask ? task.projectName : "Personal"}</small></span><time className={dueGroup === "overdue" || dueGroup === "today" ? "urgent" : ""}>{dueGroup === "today" ? "Today" : formatTaskDueDate(task.dueDate)}</time><span className={`priority priority-${task.priority}`}>{task.priority || "medium"}</span></button>;
}

function DashboardTaskRow({ task, project, todayKey, completionBusy, onToggleTask, onOpenTask }) {
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
  return <article className="dashboard-home-task-row">
    <button className={`completion-control ${completed ? "is-complete" : ""}`} type="button" aria-label={`Mark ${task.title} complete`} aria-busy={completionBusy} onClick={toggleCompletion} disabled={completionBusy}><span aria-hidden="true">{completed ? "✓" : completionBusy ? "…" : ""}</span></button>
    <button type="button" className="dashboard-home-task-name" onClick={() => onOpenTask?.(task)}><strong>{task.title}</strong><small>{project?.name || "Personal"}</small></button>
    <span className={`priority priority-${task.priority || "medium"}`}>{task.priority || "medium"}</span>
    <time className={dueGroup === "overdue" ? "urgent" : ""}>{!task.dueDate ? "No date" : dueGroup === "today" ? "Today" : formatTaskDueDate(task.dueDate)}</time>
  </article>;
}

export default function Dashboard({
  isActive = true, tasks = [], tasksLoading, tasksError, onRetry, myDaySettings,
  assignedTasks = [], assignedTasksLoading = false, assignedTasksError = "", onRetryAssignedTasks,
  pendingInvitations = [], invitationsLoading = false, invitationsError = "", onOpenInvitations,
  onOpenProject, onViewAllTasks, onViewAllProjects, displayName = "", onCreateTask,
  createTaskTriggerRef, onOpenTask, projects = [], projectsLoading = false,
  projectsError = "", onRetryProjects, notificationControl = null,
  searchQuery = "", onSearchChange, onFilterTasks, chartPeriod = "7-days", onChartPeriodChange,
  onToggleTask, quickTaskPendingIds = new Set(),
  taskView = "upcoming", onTaskViewChange,
  summaryPeriod = "week", onSummaryPeriodChange,
}) {
  const now = effectiveMyDayDate(new Date(), myDaySettings);
  const todayKey = dateOnlyKey(now);
  const firstName = String(displayName || "").trim().split(/\s+/)[0] || "";
  const currentHour = now.getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const completedTasks = tasks.filter(isTaskComplete);
  const inProgressTasks = tasks.filter((task) => task.status === "in-progress" && !isTaskComplete(task));
  const dueTodayTasks = tasks.filter((task) => task.dueDate === todayKey && !isTaskComplete(task));
  const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < todayKey && !isTaskComplete(task));
  const completedTodayTasks = completedTasks.filter((task) => {
    const completedAt = new Date(task.completedAt || "");
    return !Number.isNaN(completedAt.getTime()) && dateOnlyKey(completedAt) === todayKey;
  });
  const weekStart = startOfDay(now); weekStart.setDate(weekStart.getDate() - 6);
  const weeklyCompleted = completedTasks.filter((task) => { const value = new Date(task.completedAt || ""); return !Number.isNaN(value.getTime()) && value >= weekStart && value <= now; }).length;
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthlyCompleted = completedTasks.filter((task) => { const value = new Date(task.completedAt || ""); return !Number.isNaN(value.getTime()) && value >= monthStart && value <= now; }).length;
  const periodCompleted = summaryPeriod === "month" ? monthlyCompleted : weeklyCompleted;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const upcomingTasks = [...tasks, ...assignedTasks].filter((task) => !isTaskComplete(task) && task.dueDate && task.dueDate >= todayKey).filter((task) => !normalizedQuery || `${task.title} ${task.description || ""} ${task.projectName || ""}`.toLocaleLowerCase().includes(normalizedQuery)).sort((first, second) => compareDateOnly(first.dueDate, second.dueDate)).slice(0, 5);
  const recentProjects = [...projects].filter((project) => !normalizedQuery || `${project.name} ${project.description || ""}`.toLocaleLowerCase().includes(normalizedQuery)).sort((first, second) => String(second.updatedAt || second.createdAt || "").localeCompare(String(first.updatedAt || first.createdAt || ""))).slice(0, 4);
  const priorityCounts = ["high", "medium", "low"].map((priority) => ({ priority, count: tasks.filter((task) => task.priority === priority).length }));
  const priorityTotal = priorityCounts.reduce((total, item) => total + item.count, 0);
  let angle = 0;
  const donutStops = priorityCounts.map((item) => { const start = angle; angle += priorityTotal ? (item.count / priorityTotal) * 360 : 0; return `${priorityColors[item.priority]} ${start}deg ${angle}deg`; }).join(", ");
  const productivityTitle = weeklyCompleted === 0 ? "Ready to get started?" : weeklyCompleted <= 5 ? "Nice start!" : weeklyCompleted <= 15 ? "Great progress!" : "You’re on fire!";
  const productivityMessage = weeklyCompleted === 0 ? "Pick one small task and begin." : weeklyCompleted <= 5 ? "Keep the momentum going." : weeklyCompleted <= 15 ? "Keep it going." : "Amazing productivity this week.";

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
  const collaborators = [...new Map(assignedTasks.filter((task) => task.assigneeName).map((task) => [task.assigneeId || task.assigneeName, task.assigneeName])).entries()];
  const formattedDay = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);

  return <div className="dashboard-page dashboard-reference-page">
    <header className="dashboard-home-header"><div className="dashboard-home-title"><time>{formattedDay}</time><h1>{greeting}{firstName ? `, ${firstName}` : ""}</h1></div><div className="dashboard-home-toolbar"><label><span className="sr-only">Dashboard summary period</span><select value={summaryPeriod} onChange={(event) => onSummaryPeriodChange?.(event.target.value)}><option value="week">My week</option><option value="month">My month</option></select></label><span>✓ {periodCompleted} tasks completed</span><span>♙ {collaborators.length} collaborators</span></div></header>
    <div className="dashboard-home-actions"><label className="dashboard-search"><span className="sr-only">Search tasks and projects</span><input type="search" value={searchQuery} onChange={(event) => onSearchChange?.(event.target.value)} placeholder="Search tasks, projects..." /></label>{notificationControl}{isActive && <button ref={createTaskTriggerRef} className="primary-btn" type="button" onClick={onCreateTask} aria-haspopup="dialog" aria-controls="create-task-dialog">+ New Task</button>}</div>
    {tasksLoading ? <section className="dashboard-feedback" role="status"><span className="dashboard-loading-indicator" /> Loading your dashboard…</section> : tasksError ? <section className="dashboard-feedback dashboard-feedback-error" role="alert"><span>Dashboard tasks are temporarily unavailable.</span><button className="ghost-btn" onClick={onRetry}>Try again</button></section> : <>
      <div className="dashboard-home-primary-grid">
        <section className="dashboard-reference-card dashboard-my-tasks-card"><header><h2>My tasks</h2><button type="button" onClick={onViewAllTasks}>View all</button></header><nav aria-label="My task views">{[["upcoming", "Upcoming", dashboardTaskLists.upcoming.length], ["overdue", "Overdue", overdueTasks.length], ["completed", "Completed", completedTasks.length]].map(([value, label, count]) => <button type="button" key={value} className={taskView === value ? "active" : ""} onClick={() => onTaskViewChange?.(value)}>{label}<span>{count}</span></button>)}</nav>{visibleMyTasks.length ? <div>{visibleMyTasks.map((task) => <DashboardTaskRow key={task.id} task={task} project={projects.find((project) => project.id === task.projectId)} todayKey={todayKey} completionBusy={quickTaskPendingIds.has(task.id)} onToggleTask={onToggleTask} onOpenTask={onOpenTask} />)}</div> : <div className="dashboard-card-empty"><strong>No {taskView} tasks</strong><span>Your work is clear here.</span><button className="ghost-btn compact-btn" type="button" onClick={onCreateTask}>+ Add task</button></div>}</section>
        <section className="dashboard-reference-card dashboard-projects-card"><header><h2>Projects</h2><button type="button" onClick={onViewAllProjects}>View all</button></header>{projectsLoading ? <p className="dashboard-card-state">Loading projects…</p> : projectsError ? <div className="dashboard-card-state"><span>Projects are unavailable.</span><button className="ghost-btn compact-btn" onClick={onRetryProjects}>Try again</button></div> : recentProjects.length ? <div>{recentProjects.map((project) => <button key={project.id} className="dashboard-home-project-row" type="button" onClick={() => onOpenProject?.(project.id)}><span className="dashboard-project-icon" style={{ "--project-color": project.color || "#6657c8" }} /><span><strong>{project.name}</strong><small>{project.description || (project.viewerRole === "owner" ? "My project" : `Shared · ${project.viewerRole || "member"}`)}</small></span><span className={`project-status project-status-${project.status || "active"}`}>{project.status || "active"}</span><span aria-hidden="true">›</span></button>)}</div> : <div className="dashboard-card-empty"><strong>No projects yet</strong><span>Create a project to organize your work.</span></div>}</section>
      </div>
      <div className="dashboard-home-collaboration-grid">
        <section className="dashboard-reference-card dashboard-assigned-card"><header><div><h2>Tasks I’ve assigned</h2><p>Track delegated work and follow up where needed.</p></div></header><div className="dashboard-card-empty"><strong>No delegated tasks to show</strong><span>Assignments to teammates will appear here when available.</span><button className="ghost-btn compact-btn" type="button" onClick={onOpenInvitations}>Invite a teammate</button></div></section>
        <section className="dashboard-reference-card dashboard-people-card"><header><div><h2>People</h2><p>See who is collaborating with you.</p></div></header>{collaborators.length ? <div className="dashboard-people-list">{collaborators.slice(0, 5).map(([id, name]) => <div key={id}><span className="dashboard-person-avatar">{name.slice(0, 1).toUpperCase()}</span><strong>{name}</strong><span>Collaborator</span></div>)}</div> : <div className="dashboard-card-empty"><strong>Your team starts here</strong><span>Invite people through a project to collaborate securely.</span><button className="ghost-btn compact-btn" type="button" onClick={onOpenInvitations}>Invite a teammate</button></div>}</section>
      </div>
      <div className="dashboard-reference-grid">
        <section className="dashboard-reference-card dashboard-overview-card"><header><h2>Task Overview</h2><label className="dashboard-period-select"><span className="sr-only">Chart period</span><select value={chartPeriod} onChange={(event) => onChartPeriodChange?.(event.target.value)}>{Object.entries(chartPeriods).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select></label></header><ActivityChart tasks={tasks} now={now} period={chartPeriod} /></section>
        <section className="dashboard-reference-card dashboard-upcoming-card"><header><h2>Upcoming Tasks</h2><button type="button" onClick={onViewAllTasks}>View all</button></header>{assignedTasksLoading ? <p className="dashboard-card-state">Loading upcoming work…</p> : assignedTasksError ? <div className="dashboard-card-state"><span>Project tasks are unavailable.</span><button className="ghost-btn compact-btn" onClick={onRetryAssignedTasks}>Try again</button></div> : upcomingTasks.length ? <div>{upcomingTasks.map((task) => <UpcomingRow key={`${task.projectId || "personal"}-${task.id}`} task={task} todayKey={todayKey} onOpenTask={onOpenTask} onOpenProject={onOpenProject} />)}</div> : <div className="dashboard-card-empty"><span className="dashboard-empty-check" aria-hidden="true">✓</span><strong>You’re all caught up!</strong><span>No upcoming tasks.</span><button className="ghost-btn compact-btn" type="button" onClick={onCreateTask}>+ Create a task</button></div>}</section>
        <section className="dashboard-reference-card dashboard-recent-projects"><header><h2>Workload summary</h2><button type="button" onClick={onViewAllTasks}>View tasks</button></header><div className="dashboard-workload-summary"><button type="button" onClick={() => onFilterTasks?.({ status: "in-progress" })}><strong>{inProgressTasks.length}</strong><span>In progress</span></button><button type="button" onClick={() => onFilterTasks?.({ due: "today", quick: "today" })}><strong>{dueTodayTasks.length}</strong><span>Due today</span></button><button type="button" onClick={() => onFilterTasks?.({ quick: "overdue" })}><strong>{overdueTasks.length}</strong><span>Overdue</span></button><button type="button" onClick={() => onFilterTasks?.({ completion: "completed", quick: "completed" })}><strong>{completedTodayTasks.length}</strong><span>Completed today</span></button></div></section>
        <div className="dashboard-reference-side-stack"><section className="dashboard-reference-card dashboard-priority-card"><header><h2>Task by Priority</h2></header>{priorityTotal ? <div className="dashboard-priority-layout"><div className="dashboard-priority-donut" style={{ background: `conic-gradient(${donutStops})` }}><span><strong>{priorityTotal}</strong><small>Total</small></span></div><div className="dashboard-priority-legend">{priorityCounts.map((item) => <button type="button" key={item.priority} onClick={() => onFilterTasks?.({ priority: item.priority })}><i style={{ background: priorityColors[item.priority] }} /><span>{item.priority[0].toUpperCase() + item.priority.slice(1)}</span><strong>{item.count} ({Math.round((item.count / priorityTotal) * 100)}%)</strong></button>)}</div></div> : <div className="dashboard-card-empty"><strong>No priority data</strong><span>Priorities appear here when tasks are added.</span></div>}</section><aside className="dashboard-productivity-card"><span aria-hidden="true">✦</span><div><strong>{productivityTitle}</strong><p>{weeklyCompleted ? `You’ve completed ${weeklyCompleted} ${weeklyCompleted === 1 ? "task" : "tasks"} this week. ` : ""}{productivityMessage}</p></div></aside>{(pendingInvitations.length > 0 || invitationsLoading || invitationsError) && <aside className="dashboard-invitation-card"><strong>Project invitations</strong><span>{invitationsLoading ? "Loading…" : invitationsError ? "Invitations are unavailable." : `${pendingInvitations.length} waiting for your response`}</span>{pendingInvitations.length > 0 && <button type="button" onClick={onOpenInvitations}>Review</button>}</aside>}</div>
      </div>
    </>}
  </div>;
}
