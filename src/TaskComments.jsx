import { useCallback, useEffect, useRef, useState } from "react";
import CommentRow from "./CommentRow";
import { profileMap, safeDisplayName } from "./domain/identityDomain";
import { insertMention, reconcileMentions, serializeMentionContent } from "./domain/mentionDomain";
import {
  createTaskComment,
  deleteTaskComment,
  getTaskComments,
  subscribeToTaskComments,
  updateTaskComment,
} from "./application/projectService";

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
    <section className="settings-section task-comments-panel" aria-labelledby="task-comments-title">
      <div className="collaboration-panel-heading">
        <span className="collaboration-heading-icon" aria-hidden="true">↩</span>
        <div>
          <h3 id="task-comments-title">Comments</h3>
          <p>Share updates and mention project members.</p>
        </div>
        <span className="collaboration-count" aria-label={`${comments.length} comments`}>{comments.length}</span>
      </div>
      {liveNotice && <p className="form-hint" role="status">{liveNotice}</p>}
      {loading ? <div className="task-collaboration-state" role="status"><span className="state-spinner" /><p>Loading comments…</p></div> : comments.length === 0 ? <div className="task-collaboration-empty"><span aria-hidden="true">↩</span><strong>No comments yet</strong><p>Start a focused conversation about this task.</p></div> : (
        <div className="settings-list task-comment-list">
          {comments.map((comment) => <CommentRow key={comment.id} comment={comment} currentUserId={userId} profilesById={profilesById} mentionCandidates={members} onUpdate={updateComment} onDelete={deleteComment} />)}
        </div>
      )}
      <form onSubmit={postComment} className="task-comment-composer">
        <label htmlFor={`comment-${taskId}`}>Write a comment</label>
        <textarea id={`comment-${taskId}`} value={content} onChange={(event) => changeContent(event.target.value)} placeholder="Write a comment, then choose a teammate to mention." maxLength={4000} disabled={posting} />
        {members.length > 0 && <div className="task-comment-mentions" aria-label="Mention a project member"><span>Mention</span>{members.map((member) => <button key={member.userId} className="ghost-btn compact-btn" type="button" onClick={() => addMention(member)} disabled={posting}>@{safeDisplayName(member)}</button>)}</div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="task-comment-submit"><span>{String(content || "").length}/4000</span><button className="primary-btn" type="submit" disabled={posting || !content.trim()}>{posting ? "Posting..." : "Post comment"}</button></div>
      </form>
    </section>
  );
}
