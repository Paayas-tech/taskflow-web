import { useCallback, useEffect, useState } from "react";
import ActivityRow from "./ActivityRow";
import {
  getProjectActivity,
  getTaskActivity,
  subscribeToProjectActivity,
  subscribeToTaskActivity,
} from "./application/projectService";

const activityGroup = (value) => {
  const date = new Date(value);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const difference = Math.floor((startToday - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
  if (difference === 0) return "Today";
  if (difference === 1) return "Yesterday";
  if (difference < 7) return "This week";
  return "Earlier";
};

export default function ActivityFeed({ userId, projectId, taskId = null, compact = false }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [liveNotice, setLiveNotice] = useState("");
  const [refreshNotice, setRefreshNotice] = useState("");

  const loadActivity = useCallback(async () => {
    setError("");
    try {
      setActivity(taskId ? await getTaskActivity(userId, taskId, 20) : await getProjectActivity(userId, projectId, 30));
      return true;
    } catch {
      setError("We couldn't load recent activity.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, userId]);

  const refreshActivity = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshNotice("");
    const succeeded = await loadActivity();
    if (succeeded) setRefreshNotice("History is up to date.");
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    void loadActivity();
    const onStatus = (status) => {
      if (status === "SUBSCRIBED") setLiveNotice("");
      else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        setLiveNotice("Live updates are paused. Refresh to check for new activity.");
      }
    };
    try {
      return taskId
        ? subscribeToTaskActivity(taskId, () => void loadActivity(), onStatus)
        : subscribeToProjectActivity(projectId, () => void loadActivity(), onStatus);
    } catch {
      setLiveNotice("Live updates are paused. Refresh to check for new activity.");
      return undefined;
    }
  }, [loadActivity, projectId, taskId]);

  const visible = compact ? activity.slice(0, 8) : activity;
  const groups = visible.reduce((result, item) => {
    const label = activityGroup(item.createdAt);
    result[label] ||= [];
    result[label].push(item);
    return result;
  }, {});
  return (
    <section className="settings-section task-history-panel" aria-labelledby={`activity-${taskId || projectId}`}>
      <div className="collaboration-panel-heading">
        <span className="collaboration-heading-icon" aria-hidden="true">↻</span>
        <div><h3 id={`activity-${taskId || projectId}`}>Activity</h3><p>Recent changes.</p></div>
        <button className="ghost-btn compact-btn collaboration-refresh" type="button" onClick={refreshActivity} disabled={refreshing}><span className={refreshing ? "is-spinning" : ""} aria-hidden="true">↻</span><span>{refreshing ? "Refreshing…" : "Refresh"}</span></button>
      </div>
      {liveNotice && <p className="form-hint" role="status">{liveNotice}</p>}
      {refreshNotice && <p className="form-success collaboration-refresh-notice" role="status">{refreshNotice}</p>}
      {loading ? <div className="task-collaboration-state" role="status"><span className="state-spinner" /><p>Loading…</p></div> : error ? <p className="form-error" role="alert">{error}</p> : visible.length === 0 ? <div className="task-collaboration-empty"><span aria-hidden="true">↻</span><strong>No activity</strong><p>Changes appear here.</p></div> : <div className="settings-list task-history-list">{Object.entries(groups).map(([label, items]) => <section key={label}><h4>{label}</h4>{items.map((item) => <ActivityRow key={item.id} activity={item} />)}</section>)}</div>}
    </section>
  );
}
