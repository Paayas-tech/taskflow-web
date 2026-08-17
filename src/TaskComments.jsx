import { useCallback, useEffect, useRef, useState } from "react";
import CommentRow from "./CommentRow";
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
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
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
      return subscribeToTaskComments(taskId, () => void loadComments());
    } catch {
      setError("Live discussion updates are temporarily unavailable.");
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
      await createTaskComment(userId, taskId, content);
      setContent("");
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

  return (
    <section className="settings-section" aria-labelledby="task-comments-title">
      <div className="section-heading-row">
        <div><p className="card-label">Discussion</p><h3 id="task-comments-title">Comments</h3></div>
        <span>{comments.length}</span>
      </div>
      {loading ? <p role="status">Loading comments...</p> : comments.length === 0 ? <p className="form-hint">No comments yet. Start the conversation.</p> : (
        <div className="settings-list">
          {comments.map((comment) => <CommentRow key={comment.id} comment={comment} currentUserId={userId} onUpdate={updateComment} onDelete={deleteComment} />)}
        </div>
      )}
      <form onSubmit={postComment} className="form-group">
        <label htmlFor={`comment-${taskId}`}>Add a comment</label>
        <textarea id={`comment-${taskId}`} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a comment. Mention a member with @ followed by their UID." maxLength={4000} disabled={posting} />
        {members.length > 0 && <p className="form-hint">Members: {members.map((member) => `@${member.userId}`).join(" · ")}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-btn" type="submit" disabled={posting || !content.trim()}>{posting ? "Posting..." : "Post comment"}</button>
      </form>
    </section>
  );
}
