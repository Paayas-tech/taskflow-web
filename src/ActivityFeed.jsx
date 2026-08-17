import { useCallback, useEffect, useState } from "react";
import ActivityRow from "./ActivityRow";
import {
  getProjectActivity,
  getTaskActivity,
  subscribeToProjectActivity,
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
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setError("");
    try {
      setActivity(taskId ? await getTaskActivity(userId, taskId, 20) : await getProjectActivity(userId, projectId, 30));
    } catch {
      setError("We couldn't load recent activity.");
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, userId]);

  useEffect(() => {
    setLoading(true);
    void loadActivity();
    try {
      return subscribeToProjectActivity(projectId, () => void loadActivity());
    } catch {
      setError("Live activity updates are temporarily unavailable.");
      return undefined;
    }
  }, [loadActivity, projectId]);

  const visible = compact ? activity.slice(0, 8) : activity;
  const groups = visible.reduce((result, item) => {
    const label = activityGroup(item.createdAt);
    result[label] ||= [];
    result[label].push(item);
    return result;
  }, {});
  return (
    <section className="settings-section" aria-labelledby={`activity-${taskId || projectId}`}>
      <div className="section-heading-row"><div><p className="card-label">History</p><h3 id={`activity-${taskId || projectId}`}>Recent activity</h3></div><button className="ghost-btn compact-btn" type="button" onClick={loadActivity}>Refresh</button></div>
      {loading ? <p role="status">Loading activity...</p> : error ? <p className="form-error" role="alert">{error}</p> : visible.length === 0 ? <p className="form-hint">No activity yet.</p> : <div className="settings-list">{Object.entries(groups).map(([label, items]) => <section key={label}><h4>{label}</h4>{items.map((item) => <ActivityRow key={item.id} activity={item} />)}</section>)}</div>}
    </section>
  );
}
