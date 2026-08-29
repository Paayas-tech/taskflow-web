export default function StoryBulkActionBar({
  selectedCount,
  projectMembers = [],
  projectStories = [],
  currentStoryId = null,
  busy = false,
  onAction,
  onClear,
}) {
  if (selectedCount < 1) return null;

  const runAction = (type, value) => {
    if (!value || busy) return;
    const normalizedValue = value === "unassigned" || value === "uncategorized" ? null : value;
    void onAction?.(type, normalizedValue);
  };

  return (
    <div className="story-bulk-actions" role="toolbar" aria-label="Bulk task actions">
      <strong>{selectedCount} selected</strong>
      <select aria-label="Change selected task status" defaultValue="" onChange={(event) => runAction("status", event.target.value)} disabled={busy}>
        <option value="" disabled>Change status</option>
        <option value="todo">To do</option>
        <option value="in-progress">In progress</option>
        <option value="completed">Done</option>
      </select>
      <select aria-label="Change selected task priority" defaultValue="" onChange={(event) => runAction("priority", event.target.value)} disabled={busy}>
        <option value="" disabled>Change priority</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select aria-label="Change selected task assignee" defaultValue="" onChange={(event) => runAction("assignee", event.target.value)} disabled={busy}>
        <option value="" disabled>Change assignee</option>
        <option value="unassigned">Unassigned</option>
        {projectMembers.map((member) => <option key={member.userId} value={member.userId}>{member.displayName || "TaskFlow user"}</option>)}
      </select>
      <select aria-label="Move selected tasks to Story" defaultValue="" onChange={(event) => runAction("story", event.target.value)} disabled={busy}>
        <option value="" disabled>Move to Story</option>
        <option value="uncategorized">Uncategorized</option>
        {projectStories.filter((story) => story.id !== currentStoryId).map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
      </select>
      <button className="ghost-btn compact-btn" type="button" onClick={onClear} disabled={busy}>Clear</button>
    </div>
  );
}
