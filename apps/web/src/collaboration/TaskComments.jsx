/**
 * The comment thread of one task. Comments are not part of the client store —
 * they are read through the api the store was configured with and reloaded
 * silently whenever the realtime channel reports a change.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CommentRow } from "./rows";
import { Button, EmptyState, Icon, InlineNotice, Menu, Spinner, Textarea } from "../ui";
import {
  insertMention,
  profileMap,
  reconcileMentions,
  safeDisplayName,
  serializeMentionContent,
} from "../domain/collaboration";
import { selectUser } from "../store/selectors";
import { api, useStore } from "../store/store";

const COMMENT_LIMIT = 4000;
const LIVE_PAUSED = "Live updates are paused. Refresh to check for new comments.";
const DEAD_CHANNEL = ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"];

const autoGrow = (element) => {
  if (!element?.style) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

const commentLengthError = (content) => {
  const normalized = String(content || "").trim();
  if (!normalized) return "Write a comment before posting.";
  if (normalized.length > COMMENT_LIMIT) {
    return "Comments must be 4,000 characters or fewer.";
  }
  return "";
};

export function TaskComments({ taskId, members = [], compact = false }) {
  const user = useStore(selectUser);
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [liveNotice, setLiveNotice] = useState("");
  const postingRef = useRef(false);

  const loadComments = useCallback(async () => {
    setError("");
    try {
      setComments(await api().listComments(taskId));
    } catch {
      setError("We couldn't load this discussion. Try again.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    void loadComments();
    try {
      return api().subscribeToComments(
        taskId,
        () => void loadComments(),
        (status) => {
          if (status === "SUBSCRIBED") setLiveNotice("");
          else if (DEAD_CHANNEL.includes(status)) setLiveNotice(LIVE_PAUSED);
        }
      );
    } catch {
      setLiveNotice(LIVE_PAUSED);
      return undefined;
    }
  }, [loadComments, taskId]);

  const postComment = async (event) => {
    event.preventDefault();
    if (postingRef.current) return;

    const invalid = commentLengthError(content);
    if (invalid) {
      setError(invalid);
      return;
    }

    postingRef.current = true;
    setPosting(true);
    setError("");
    try {
      await api().createComment(taskId, serializeMentionContent(content, mentions));
      setContent("");
      setMentions([]);
      await loadComments();
    } catch (postError) {
      setError(postError.message || "We couldn't post this comment.");
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  };

  const editComment = async (commentId, nextContent) => {
    const invalid = commentLengthError(nextContent);
    if (invalid) throw new Error(invalid);
    await api().updateComment(commentId, nextContent);
    await loadComments();
  };

  const removeComment = async (commentId) => {
    await api().deleteComment(commentId);
    await loadComments();
  };

  const changeContent = (nextContent) => {
    setMentions((current) => reconcileMentions(content, nextContent, current));
    setContent(nextContent);
  };

  const addMention = (member) => {
    const next = insertMention(content, mentions, member);
    setContent(next.value);
    setMentions(next.mentions);
  };

  const profilesById = profileMap([...members, ...comments]);

  return (
    <section className="comment-thread" aria-label="Comments">
      {liveNotice ? (
        <p className="collab-live-note muted" role="status">
          <Icon name="info" size={14} />
          {liveNotice}
        </p>
      ) : null}

      {loading ? (
        <p className="comment-thread-state" role="status">
          <Spinner size="sm" />
          Loading comments…
        </p>
      ) : comments.length === 0 && compact ? (
        <p className="comment-thread-state">No comments yet</p>
      ) : comments.length === 0 ? (
        <EmptyState
          icon="message-circle"
          title="No comments yet"
          description="Ask a question or share an update."
        />
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              currentUserId={user?.id || ""}
              profilesById={profilesById}
              mentionCandidates={members}
              onUpdate={editComment}
              onDelete={removeComment}
            />
          ))}
        </div>
      )}

      <form onSubmit={postComment} className="comment-composer">
        <Textarea
          id={`comment-${taskId}`}
          className="comment-composer-input"
          value={content}
          onChange={(event) => {
            autoGrow(event.target);
            changeContent(event.target.value);
          }}
          placeholder="Write a comment"
          aria-label="Write a comment"
          rows={1}
          maxLength={COMMENT_LIMIT}
          disabled={posting}
        />
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        <div className="comment-composer-actions">
          {members.length > 0 ? (
            <Menu
              className="comment-mention-menu"
              align="start"
              trigger={(triggerProps) => (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="users" size={14} />}
                  disabled={posting}
                  {...triggerProps}
                >
                  Mention
                </Button>
              )}
              items={members.map((member) => ({
                id: member.userId,
                label: `@${safeDisplayName(member)}`,
                onSelect: () => addMention(member),
              }))}
            />
          ) : null}
          {content.length > 3600 ? (
            <span className="comment-counter">{`${content.length}/${COMMENT_LIMIT}`}</span>
          ) : null}
          <span className="toolbar-spacer" />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={posting}
            disabled={!content.trim()}
          >
            Comment
          </Button>
        </div>
      </form>
    </section>
  );
}
