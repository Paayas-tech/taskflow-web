/**
 * Recent history for a project or a single task. Activity rows come from the
 * database's audit trail, so — like comments — they are read through the api
 * the store was configured with, and reloaded when the realtime channel fires.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityRow, CommentRow } from "./rows";
import { Button, EmptyState, Icon, InlineNotice, Spinner } from "../ui";
import { profileMap } from "../domain/collaboration";
import { selectUser } from "../store/selectors";
import { api, useStore } from "../store/store";

const LIVE_PAUSED = "Live updates are paused. Refresh to check for new activity.";
const DEAD_CHANNEL = ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"];

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** `Today | Yesterday | This week | Earlier` for one event. */
const activityGroup = (value) => {
  const date = new Date(value);
  const difference = Math.floor(
    (startOfDay(new Date()) - startOfDay(date)) / 86400000
  );
  if (difference === 0) return "Today";
  if (difference === 1) return "Yesterday";
  if (difference < 7) return "This week";
  return "Earlier";
};

const activityTimestamp = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

/** Newest first; equal or missing timestamps keep their original order. */
const sortActivityItems = (items) =>
  items
    .map((item, index) => ({
      item,
      index,
      timestamp: activityTimestamp(item.createdAt),
    }))
    .sort((left, right) => {
      if (
        left.timestamp !== null &&
        right.timestamp !== null &&
        left.timestamp !== right.timestamp
      ) {
        return right.timestamp - left.timestamp;
      }
      if (left.timestamp !== null && right.timestamp === null) return -1;
      if (left.timestamp === null && right.timestamp !== null) return 1;
      return left.index - right.index;
    })
    .map(({ item }) => item);

export function ActivityFeed({
  projectId,
  taskId = null,
  compact = false,
  includeComments = false,
  members = [],
}) {
  const user = useStore(selectUser);
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
          api().listTaskActivity(taskId, 30),
          api().listComments(taskId),
        ]);
        setActivity(activityItems);
        setComments(commentItems);
      } else {
        setActivity(
          taskId
            ? await api().listTaskActivity(taskId, 20)
            : await api().listProjectActivity(projectId, 30)
        );
        setComments([]);
      }
      return true;
    } catch {
      setError("We couldn't load recent activity.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [includeComments, projectId, taskId]);

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
      else if (DEAD_CHANNEL.includes(status)) setLiveNotice(LIVE_PAUSED);
    };

    try {
      if (taskId) {
        const unsubscribeActivity = api().subscribeToTaskActivity(
          taskId,
          () => void loadActivity(),
          onStatus
        );
        const unsubscribeComments = includeComments
          ? api().subscribeToComments(taskId, () => void loadActivity(), onStatus)
          : undefined;
        return () => {
          unsubscribeActivity?.();
          unsubscribeComments?.();
        };
      }
      return api().subscribeToProjectActivity(
        projectId,
        () => void loadActivity(),
        onStatus
      );
    } catch {
      setLiveNotice(LIVE_PAUSED);
      return undefined;
    }
  }, [includeComments, loadActivity, projectId, taskId]);

  // A comment that is still live is rendered once, as the comment itself.
  const activeCommentIds = new Set(comments.map((comment) => comment.id));
  const mergedActivity = sortActivityItems([
    ...activity.filter(
      (item) =>
        !(
          ["comment_added", "comment_updated"].includes(item.type) &&
          activeCommentIds.has(item.metadata?.commentId)
        )
    ),
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

  const editComment = async (commentId, content) => {
    await api().updateComment(commentId, content);
    await loadActivity();
  };

  const removeComment = async (commentId) => {
    await api().deleteComment(commentId);
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

      {liveNotice ? (
        <p className="collab-live-note muted" role="status">
          <Icon name="info" size={14} />
          {liveNotice}
        </p>
      ) : null}
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
      ) : visible.length === 0 && compact ? (
        <p className="activity-state">No activity yet</p>
      ) : visible.length === 0 ? (
        <EmptyState icon="activity" title="No activity yet" description="Changes show up here." />
      ) : (
        <div className="activity-list">
          {Object.entries(groups).map(([label, items]) => (
            <section className="activity-group" key={label}>
              <h4 className="activity-group-title">{label}</h4>
              {items.map((item) =>
                item.itemKind === "comment" ? (
                  <CommentRow
                    key={`comment-${item.id}`}
                    comment={item}
                    currentUserId={user?.id || ""}
                    profilesById={profilesById}
                    mentionCandidates={members}
                    onUpdate={editComment}
                    onDelete={removeComment}
                  />
                ) : (
                  <ActivityRow key={item.id} activity={item} />
                )
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
