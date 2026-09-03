import { useCallback, useEffect, useState } from "react";
import ActivityRow from "./ActivityRow";
import CommentRow from "./CommentRow";
import { Button, EmptyState, Icon, InlineNotice, Spinner } from "../ui";
import { profileMap } from "../domain/identityDomain";
import {
  deleteTaskComment,
  getTaskComments,
  getProjectActivity,
  getTaskActivity,
  subscribeToProjectActivity,
  subscribeToTaskComments,
  subscribeToTaskActivity,
  updateTaskComment,
} from "../application/projectService";

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

const activityTimestamp = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const sortActivityItems = (items) => items
  .map((item, index) => ({ item, index, timestamp: activityTimestamp(item.createdAt) }))
  .sort((left, right) => {
    if (left.timestamp !== null && right.timestamp !== null && left.timestamp !== right.timestamp) {
      return right.timestamp - left.timestamp;
    }
    if (left.timestamp !== null && right.timestamp === null) return -1;
    if (left.timestamp === null && right.timestamp !== null) return 1;
    return left.index - right.index;
  })
  .map(({ item }) => item);

export default function ActivityFeed({ userId, projectId, taskId = null, compact = false, includeComments = false, members = [] }) {
  const [activity, setActivity] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [liveNotice, setLiveNotice] = useState("");
  const [refreshNotice, setRefreshNotice] = useState("");

  const loadActivity = useCallback(async () => {
    setError("");
    try {
      if (taskId && includeComments) {
        const [activityItems, commentItems] = await Promise.all([
          getTaskActivity(userId, taskId, 30),
          getTaskComments(userId, taskId),
        ]);
        setActivity(activityItems);
        setComments(commentItems);
      } else {
        setActivity(taskId ? await getTaskActivity(userId, taskId, 20) : await getProjectActivity(userId, projectId, 30));
        setComments([]);
      }
      return true;
    } catch {
      setError("We couldn't load recent activity.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [includeComments, projectId, taskId, userId]);

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
      if (taskId) {
        const unsubscribeActivity = subscribeToTaskActivity(taskId, () => void loadActivity(), onStatus);
        const unsubscribeComments = includeComments
          ? subscribeToTaskComments(taskId, () => void loadActivity(), onStatus)
          : undefined;
        return () => {
          unsubscribeActivity?.();
          unsubscribeComments?.();
        };
      }
      return subscribeToProjectActivity(projectId, () => void loadActivity(), onStatus);
    } catch {
      setLiveNotice("Live updates are paused. Refresh to check for new activity.");
      return undefined;
    }
  }, [includeComments, loadActivity, projectId, taskId]);

  const activeCommentIds = new Set(comments.map((comment) => comment.id));
  const mergedActivity = sortActivityItems([
    ...activity.filter((item) => !(
      ["comment_added", "comment_updated"].includes(item.type)
      && activeCommentIds.has(item.metadata?.commentId)
    )),
    ...comments.map((comment) => ({ ...comment, itemKind: "comment" })),
  ]);
  const visible = compact ? mergedActivity.slice(0, 8) : mergedActivity;
  const groups = visible.reduce((result, item) => {
    const label = activityGroup(item.createdAt);
    result[label] ||= [];
    result[label].push(item);
    return result;
  }, {});
  const profilesById = profileMap([...members, ...comments]);
  const updateComment = async (commentId, content) => {
    await updateTaskComment(userId, commentId, content);
    await loadActivity();
  };
  const removeComment = async (commentId) => {
    await deleteTaskComment(userId, commentId);
    await loadActivity();
  };

  return (
    <section className="activity-feed" aria-label="Activity">
      <div className="activity-header">
        <h3 className="section-title">Activity</h3>
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon name="refresh" />}
          onClick={refreshActivity}
          loading={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {liveNotice ? <InlineNotice tone="info">{liveNotice}</InlineNotice> : null}
      {refreshNotice ? <InlineNotice tone="success">{refreshNotice}</InlineNotice> : null}
      {loading ? (
        <p className="activity-state" role="status">
          <Spinner size="sm" />
          Loading activity…
        </p>
      ) : error ? (
        <InlineNotice
          tone="error"
          action={
            <Button variant="secondary" size="sm" onClick={refreshActivity}>
              Try again
            </Button>
          }
        >
          {error}
        </InlineNotice>
      ) : visible.length === 0 ? (
        <EmptyState icon="activity" title="No activity yet" description="Changes show up here." />
      ) : (
        <div className="activity-list">
          {Object.entries(groups).map(([label, items]) => (
            <section className="activity-group" key={label}>
              <h4 className="activity-group-title">{label}</h4>
              {items.map((item) => (item.itemKind === "comment" ? (
                <CommentRow
                  key={`comment-${item.id}`}
                  comment={item}
                  currentUserId={userId}
                  profilesById={profilesById}
                  mentionCandidates={members}
                  onUpdate={updateComment}
                  onDelete={removeComment}
                />
              ) : (
                <ActivityRow key={item.id} activity={item} />
              )))}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
