import { useMemo, useState } from "react";
import { isWorkspaceItemStarred, workspaceItemForTask } from "./domain/workspaceNavigationDomain";
import { normalizePlanningGoals, planningIssueLabels, planningStatusGroup } from "./domain/planningDomain";

const statusLabel = { todo: "To do", "in-progress": "In progress", done: "Done" };

function PlanningTaskRow({ task, projects, workspaceData, onOpenItem, onToggleStar, issueLabel }) {
  const item = workspaceItemForTask(task);
  const project = projects.find((candidate) => candidate.id === task.projectId);
  const starred = isWorkspaceItemStarred(workspaceData, item);
  return (
    <article className="planning-task-row">
      <button type="button" onClick={() => onOpenItem(item)}>
        <span className={`planning-status-dot status-${planningStatusGroup(task)}`} aria-hidden="true" />
        <span><strong>{task.title}</strong><small>{project?.name || (task.projectId ? "Project work" : "Personal")} · {task.assigneeName || (task.assigneeId ? "Assigned" : "Unassigned")}</small></span>
      </button>
      {issueLabel && <span className="planning-issue-label">{issueLabel}</span>}
      <span className="planning-row-date">{task.dueDate || "No due date"}</span>
      <button className={`workspace-star${starred ? " active" : ""}`} type="button" aria-label={`${starred ? "Unstar" : "Star"} ${task.title}`} aria-pressed={starred} onClick={() => onToggleStar(item)}>{starred ? "★" : "☆"}</button>
    </article>
  );
}

function PlanningEmpty({ title, children }) {
  return <div className="planning-empty"><strong>{title}</strong><p>{children}</p></div>;
}

export default function PlanningPage({ view, tasks = [], assignedTasks = [], projects = [], workspaceData = {}, goals = [], onGoalsChange, onOpenItem, onToggleStar }) {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDueDate, setGoalDueDate] = useState("");
  const allTasks = useMemo(() => [...tasks, ...assignedTasks.filter((candidate) => !tasks.some((task) => task.id === candidate.id))], [assignedTasks, tasks]);
  const filteredTasks = useMemo(() => allTasks.filter((task) => {
    if (projectFilter !== "all" && (task.projectId || "personal") !== projectFilter) return false;
    return !query.trim() || `${task.title || ""} ${task.description || ""}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [allTasks, projectFilter, query]);
  const currentGoals = normalizePlanningGoals(goals);
  const today = new Date().toISOString().slice(0, 10);

  const toolbar = (
    <div className="planning-toolbar">
      <input type="search" aria-label="Search planned work" placeholder="Search planned work" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filter planning by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">All projects</option><option value="personal">Personal tasks</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
    </div>
  );

  if (view === "timeline") {
    const dated = filteredTasks.filter((task) => task.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const groups = dated.reduce((result, task) => ({ ...result, [task.dueDate]: [...(result[task.dueDate] || []), task] }), {});
    return <section className="planning-page" aria-label="Planning timeline">{toolbar}<div className="planning-help"><strong>Timeline</strong><span>Work ordered by due date.</span></div>{dated.length === 0 ? <PlanningEmpty title="No scheduled work">Add a due date to see work here.</PlanningEmpty> : <div className="planning-timeline">{Object.entries(groups).map(([date, dateTasks]) => <section key={date}><header><time dateTime={date}>{date}</time><span>{dateTasks.length} {dateTasks.length === 1 ? "item" : "items"}</span></header><div>{dateTasks.map((task) => <PlanningTaskRow key={task.id} task={task} projects={projects} workspaceData={workspaceData} onOpenItem={onOpenItem} onToggleStar={onToggleStar} />)}</div></section>)}</div>}</section>;
  }

  if (view === "board") {
    return <section className="planning-page" aria-label="Planning board">{toolbar}<div className="planning-help"><strong>Board</strong><span>Work grouped by status.</span></div><div className="planning-board">{["todo", "in-progress", "done"].map((group) => { const groupTasks = filteredTasks.filter((task) => planningStatusGroup(task) === group); return <section key={group}><header><strong>{statusLabel[group]}</strong><span>{groupTasks.length}</span></header><div>{groupTasks.length ? groupTasks.map((task) => <PlanningTaskRow key={task.id} task={task} projects={projects} workspaceData={workspaceData} onOpenItem={onOpenItem} onToggleStar={onToggleStar} />) : <PlanningEmpty title={`No work in ${statusLabel[group].toLowerCase()}`}>Nothing here yet.</PlanningEmpty>}</div></section>; })}</div></section>;
  }

  if (view === "lists") {
    const sorted = [...filteredTasks].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
    return <section className="planning-page" aria-label="Planning lists">{toolbar}<div className="planning-help"><strong>Lists</strong><span>Personal and project tasks.</span></div><div className="planning-list"><header><strong>Work</strong><span>Due date</span></header>{sorted.length ? sorted.map((task) => <PlanningTaskRow key={task.id} task={task} projects={projects} workspaceData={workspaceData} onOpenItem={onOpenItem} onToggleStar={onToggleStar} />) : <PlanningEmpty title="No matching work">Try another filter.</PlanningEmpty>}</div></section>;
  }

  if (view === "goals") {
    const addGoal = (event) => {
      event.preventDefault();
      const title = goalTitle.trim();
      if (!title) return;
      const id = globalThis.crypto?.randomUUID?.() || `goal-${Date.now()}`;
      onGoalsChange([{ id, title, dueDate: goalDueDate || null, completed: false, createdAt: new Date().toISOString() }, ...currentGoals]);
      setGoalTitle("");
      setGoalDueDate("");
    };
    return <section className="planning-page" aria-label="Planning goals"><div className="planning-help"><strong>Goals</strong><span>Track key outcomes.</span></div><form className="planning-goal-form" onSubmit={addGoal}><input aria-label="Goal title" placeholder="Add an outcome" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} maxLength={120} /><input aria-label="Goal target date" type="date" value={goalDueDate} onChange={(event) => setGoalDueDate(event.target.value)} /><button className="primary-btn compact-btn" type="submit" disabled={!goalTitle.trim()}>+ Add Goal</button></form><div className="planning-goals">{currentGoals.length === 0 ? <PlanningEmpty title="No goals yet">Add your first outcome.</PlanningEmpty> : currentGoals.map((goal) => <article key={goal.id} className={goal.completed ? "completed" : ""}><label><input type="checkbox" checked={Boolean(goal.completed)} onChange={() => onGoalsChange(currentGoals.map((candidate) => candidate.id === goal.id ? { ...candidate, completed: !candidate.completed } : candidate))} /><span><strong>{goal.title}</strong><small>{goal.dueDate ? `Target ${goal.dueDate}` : "No target date"}</small></span></label><button className="ghost-btn compact-btn" type="button" onClick={() => onGoalsChange(currentGoals.filter((candidate) => candidate.id !== goal.id))}>Remove</button></article>)}</div></section>;
  }

  const issues = filteredTasks.flatMap((task) => {
    const labels = planningIssueLabels(task, today);
    return labels.length ? [{ task, labels }] : [];
  }).filter(({ labels }) => issueFilter === "all" || labels.some((label) => label.toLowerCase().replace(" ", "-") === issueFilter));
  return <section className="planning-page" aria-label="Planning issues"><div className="planning-toolbar"><select aria-label="Filter planning issues" value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)}><option value="all">All issues</option><option value="overdue">Overdue</option><option value="high-priority">High priority</option><option value="unassigned">Unassigned</option></select><span>{issues.length} {issues.length === 1 ? "issue" : "issues"}</span></div><div className="planning-help"><strong>Issues</strong><span>Work that needs attention.</span></div><div className="planning-list">{issues.length ? issues.map(({ task, labels }) => <PlanningTaskRow key={task.id} task={task} projects={projects} workspaceData={workspaceData} onOpenItem={onOpenItem} onToggleStar={onToggleStar} issueLabel={labels.join(" · ")} />) : <PlanningEmpty title="No issues found">No matching risks.</PlanningEmpty>}</div></section>;
}
