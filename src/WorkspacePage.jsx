import {
  isWorkspaceItemStarred,
  normalizeWorkspaceData,
  workspaceItemForProject,
  workspaceItemForTask,
} from "./domain/workspaceNavigationDomain";
import { isTaskComplete } from "./domain/taskDomain";

const todayKey = () => new Date().toISOString().slice(0, 10);
const soonKey = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
};

const taskDueLabel = (task) => task.dueDate ? `Due ${task.dueDate}` : "No due date";

function StarButton({ item, workspaceData, onToggleStar }) {
  const starred = isWorkspaceItemStarred(workspaceData, item);
  return (
    <button className={`workspace-star${starred ? " active" : ""}`} type="button" aria-label={`${starred ? "Unstar" : "Star"} ${item.title}`} aria-pressed={starred} onClick={(event) => { event.stopPropagation(); onToggleStar(item); }}>
      {starred ? "★" : "☆"}
    </button>
  );
}

function WorkItem({ item, workspaceData, onOpenItem, onToggleStar, supporting }) {
  return (
    <article className="workspace-item-row">
      <button type="button" onClick={() => onOpenItem(item)}>
        <span className={`workspace-item-icon type-${item.type}`} aria-hidden="true">{item.type === "project" ? "□" : item.type === "story" ? "▱" : "✓"}</span>
        <span><strong>{item.title}</strong><small>{supporting || (item.type === "project" ? "Project" : item.type === "story" ? "Story" : "Task")}</small></span>
      </button>
      <StarButton item={item} workspaceData={workspaceData} onToggleStar={onToggleStar} />
    </article>
  );
}

function EmptyState({ children }) {
  return <p className="workspace-compact-empty">{children}</p>;
}

export default function WorkspacePage({ mode, tasks = [], assignedTasks = [], projects = [], workspaceData = {}, onOpenItem, onToggleStar }) {
  const data = normalizeWorkspaceData(workspaceData);
  const allTasks = [...tasks, ...assignedTasks.filter((candidate) => !tasks.some((task) => task.id === candidate.id))];
  const assigned = assignedTasks.filter((task) => !isTaskComplete(task)).slice(0, 6);
  const dueSoon = allTasks.filter((task) => !isTaskComplete(task) && task.dueDate && task.dueDate >= todayKey() && task.dueDate <= soonKey()).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  const recentlyWorked = [...allTasks].filter((task) => task.updatedAt || task.createdAt).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 6);

  if (mode === "recent" || mode === "starred") {
    const items = mode === "recent" ? data.recent : data.starred;
    return <section className="workspace-hub" aria-label={mode === "recent" ? "Recent" : "Starred"}><div className="workspace-section-list">{items.length === 0 ? <EmptyState>{mode === "recent" ? "Open a project or task and it will appear here." : "Star a project or task to keep it here."}</EmptyState> : items.map((item) => <WorkItem key={`${item.type}:${item.id}`} item={item} workspaceData={data} onOpenItem={onOpenItem} onToggleStar={onToggleStar} supporting={item.interactedAt ? `Opened ${new Date(item.interactedAt).toLocaleString()}` : undefined} />)}</div></section>;
  }

  return (
    <section className="workspace-hub" aria-label="For you">
      <div className="workspace-hub-grid">
        <section><h3>My assigned tasks <span>{assigned.length}</span></h3>{assigned.length ? assigned.map((task) => <WorkItem key={task.id} item={workspaceItemForTask(task)} workspaceData={data} onOpenItem={onOpenItem} onToggleStar={onToggleStar} supporting={taskDueLabel(task)} />) : <EmptyState>No active tasks are assigned to you.</EmptyState>}</section>
        <section><h3>Due soon <span>{dueSoon.length}</span></h3>{dueSoon.length ? dueSoon.map((task) => <WorkItem key={task.id} item={workspaceItemForTask(task)} workspaceData={data} onOpenItem={onOpenItem} onToggleStar={onToggleStar} supporting={taskDueLabel(task)} />) : <EmptyState>Nothing is due in the next seven days.</EmptyState>}</section>
        <section><h3>Recently worked on</h3>{recentlyWorked.length ? recentlyWorked.map((task) => <WorkItem key={task.id} item={workspaceItemForTask(task)} workspaceData={data} onOpenItem={onOpenItem} onToggleStar={onToggleStar} supporting={task.projectId ? "Project task" : "Personal task"} />) : <EmptyState>No recent task activity.</EmptyState>}</section>
        <section><h3>My projects <span>{projects.length}</span></h3>{projects.length ? projects.slice(0, 6).map((project) => <WorkItem key={project.id} item={workspaceItemForProject(project)} workspaceData={data} onOpenItem={onOpenItem} onToggleStar={onToggleStar} supporting={project.viewerRole ? `Access · ${project.viewerRole}` : "Project"} />) : <EmptyState>You do not have any projects yet.</EmptyState>}</section>
      </div>
    </section>
  );
}
