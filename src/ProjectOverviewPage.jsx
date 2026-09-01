import { useCallback, useEffect, useState } from "react";
import { projectOverviewService } from "./application/projectOverviewService";
import { formatOverviewDate, PROJECT_HEALTH_OPTIONS, statusLabel } from "./domain/projectOverviewDomain";

const Avatar = ({ task }) => <span className="overview-avatar" title={task.assigneeName}>{task.assigneeAvatarUrl
  ? <img src={task.assigneeAvatarUrl} alt="" />
  : task.assigneeName === "Unassigned" ? "—" : task.assigneeName.slice(0, 1).toUpperCase()}</span>;

const EmptyRows = ({ children }) => <div className="overview-empty">{children}</div>;
const InfoTip = ({ label, children }) => <span className="inline-info-wrap"><button className="inline-info" type="button" aria-label={label}>?</button><span className="inline-info-tooltip" role="tooltip">{children}</span></span>;

export function ProjectOverviewContent({ data, savingHealth = false, healthError = "", onHealthChange, onOpenTask, onBack }) {
  const { project, metrics, statusDistribution, overdueTasks, recentlyCompletedTasks } = data;
  const canEdit = project.healthSupported !== false && ["owner", "editor"].includes(project.viewerRole);
  const maximum = Math.max(1, ...Object.values(statusDistribution));
  return (
    <section className="project-overview-page" aria-labelledby="project-overview-title">
      <button className="project-back-button" type="button" onClick={onBack}>← Project work</button>
      <header className="project-overview-hero">
        <div><h2 id="project-overview-title">{project.name}</h2>{project.description && <p className="project-description-compact">{project.description}</p>}</div>
        <label className="project-health-control"><span>Health <InfoTip label="About project health">Shows whether work is on track, at risk, paused, or complete.</InfoTip></span>
          {canEdit ? <select value={project.healthStatus} disabled={savingHealth} onChange={(event) => onHealthChange(event.target.value)}>
            {PROJECT_HEALTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <strong className={`health-badge is-${project.healthStatus}`}>{PROJECT_HEALTH_OPTIONS.find((option) => option.value === project.healthStatus)?.label}</strong>}
          {project.healthSupported === false && <small>Read-only until migration 017.</small>}
        </label>
      </header>
      {healthError && <p className="project-overview-feedback" role="alert">{healthError}</p>}

      <div className="overview-metrics" aria-label="Project task metrics">
        {[['Total', metrics.total], ['Completed', metrics.completed], ['In progress', metrics.inProgress], ['Overdue', metrics.overdue]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </div>

      <section className="overview-card" aria-labelledby="status-distribution-title"><header><div><h3 id="status-distribution-title">Status</h3></div><span>{metrics.total} total</span></header>
        {Object.keys(statusDistribution).length ? <div className="overview-status-chart">{Object.entries(statusDistribution).map(([status, count]) => <div key={status}><span>{statusLabel(status)}</span><div><i style={{ width: `${Math.max(4, count / maximum * 100)}%` }} /></div><strong>{count}</strong></div>)}</div> : <EmptyRows>No active tasks to chart.</EmptyRows>}
      </section>

      <div className="overview-list-grid">
        <section className="overview-card overview-task-list" aria-labelledby="overdue-title"><header><div><h3 id="overdue-title">Overdue</h3></div><span>{overdueTasks.length}</span></header>
          {overdueTasks.length ? overdueTasks.map((task) => <button type="button" key={task.id} onClick={() => onOpenTask(task.id)}><span className="overview-task-title">{task.title}</span><span className="overview-assignee"><Avatar task={task} />{task.assigneeName}</span><time>{formatOverviewDate(task.dueDate)}</time><span className="overview-status-pill">{statusLabel(task.status)}</span></button>) : <EmptyRows>No overdue tasks.</EmptyRows>}
        </section>
        <section className="overview-card overview-task-list" aria-labelledby="completed-title"><header><div><h3 id="completed-title">Recently completed</h3></div><span>{recentlyCompletedTasks.length}</span></header>
          {recentlyCompletedTasks.length ? recentlyCompletedTasks.map((task) => <button type="button" key={task.id} onClick={() => onOpenTask(task.id)}><span className="overview-task-title">{task.title}</span><span className="overview-assignee"><Avatar task={task} />{task.assigneeName}</span><time>{formatOverviewDate(task.completedAt)}</time></button>) : <EmptyRows>No completed tasks yet.</EmptyRows>}
        </section>
      </div>
    </section>
  );
}

export default function ProjectOverviewPage({ userId, projectId, onBack, onOpenTask }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingHealth, setSavingHealth] = useState(false);
  const [healthError, setHealthError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await projectOverviewService.load(userId, projectId)); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [projectId, userId]);
  useEffect(() => { void load(); }, [load]);

  const updateHealth = async (healthStatus) => {
    const previous = data.project.healthStatus;
    setData((current) => ({ ...current, project: { ...current.project, healthStatus } }));
    setSavingHealth(true); setHealthError("");
    try { await projectOverviewService.updateHealth(projectId, healthStatus); }
    catch (updateError) {
      setData((current) => ({ ...current, project: { ...current.project, healthStatus: previous } }));
      setHealthError(updateError.message);
    } finally { setSavingHealth(false); }
  };

  if (loading) return <div className="project-task-state" role="status"><div className="state-spinner" /><h2>Loading project overview…</h2></div>;
  if (error) return <div className="project-task-state error-state" role="alert"><h2>Overview unavailable</h2><p>{error}</p><button className="primary-btn" type="button" onClick={() => void load()}>Try again</button></div>;
  if (!data) return <div className="project-task-state"><h2>You don’t have access</h2><p>This project doesn’t exist or isn’t available to your account.</p><button className="primary-btn" type="button" onClick={onBack}>Back to Projects</button></div>;
  return <ProjectOverviewContent data={data} savingHealth={savingHealth} healthError={healthError} onHealthChange={updateHealth} onOpenTask={onOpenTask} onBack={onBack} />;
}
