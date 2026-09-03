import { useCallback, useEffect, useRef, useState } from "react";
import CommentRow from "./CommentRow";
import { Button, EmptyState, InlineNotice, Spinner, Textarea } from "../ui";
import { profileMap, safeDisplayName } from "../domain/identityDomain";
import { insertMention, reconcileMentions, serializeMentionContent } from "../domain/mentionDomain";
import {
  createTaskComment,
  deleteTaskComment,
  getTaskComments,
  subscribeToTaskComments,
  updateTaskComment,
} from "../application/projectService";

const autoGrow = (element) => {
  if (!element?.style) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

export default function TaskComments({ userId, taskId, members = [] }) {
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
      setComments(await getTaskComments(userId, taskId));
    } catch {
      setError("We couldn't load this discussion. Try again.");
    } finally {
      setLoading(false);
    }
  }, [taskId, userId]);

  useEffect(() => {
    setLoading(true);
    void loadComments();
    try {
      return subscribeToTaskComments(taskId, () => void loadComments(), (status) => {
        if (status === "SUBSCRIBED") setLiveNotice("");
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setLiveNotice("Live updates are paused. Refresh to check for new comments.");
        }
      });
    } catch {
      setLiveNotice("Live updates are paused. Refresh to check for new comments.");
      return undefined;
    }
  }, [loadComments, taskId]);

  const postComment = async (event) => {
    event.preventDefault();
    if (postingRef.current) return;
    postingRef.current = true;
    setPosting(true);
    setError("");
    try {
      await createTaskComment(userId, taskId, serializeMentionContent(content, mentions));
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

  const updateComment = async (commentId, nextContent) => {
    await updateTaskComment(userId, commentId, nextContent);
    await loadComments();
  };
  const deleteComment = async (commentId) => {
    await deleteTaskComment(userId, commentId);
    await loadComments();
  };
  const profilesById = profileMap([...members, ...comments]);
  const changeContent = (nextContent) => {
    setMentions((current) => reconcileMentions(content, nextContent, current));
    setContent(nextContent);
  };
  const addMention = (member) => {
    const next = insertMention(content, mentions, member);
    setContent(next.value);
    setMentions(next.mentions);
  };

  return (
    <section className="comment-thread" aria-label="Comments">
      {liveNotice ? <InlineNotice tone="info">{liveNotice}</InlineNotice> : null}
      {loading ? (
        <p className="comment-thread-state" role="status">
          <Spinner size="sm" />
          Loading comments…
        </p>
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
              currentUserId={userId}
              profilesById={profilesById}
              mentionCandidates={members}
              onUpdate={updateComment}
              onDelete={deleteComment}
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
          rows={2}
          maxLength={4000}
          disabled={posting}
        />
        {members.length > 0 ? (
          <div className="menu comment-mentions" role="group" aria-label="Mention a project member">
            {members.map((member) => (
              <button
                key={member.userId}
                className="menu-item"
                type="button"
                onClick={() => addMention(member)}
                disabled={posting}
              >
                @{safeDisplayName(member)}
              </button>
            ))}
          </div>
        ) : null}
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <div className="comment-composer-actions">
          <span className="comment-counter">{String(content || "").length}/4000</span>
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
