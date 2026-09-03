import { Button } from "../ui/Button";
import { Select } from "../ui/Field";
import { cx } from "../ui/cx";
import { safeDisplayName } from "../domain/identityDomain";

/** Bulk edits for the selected tasks in a story or a filtered list. */
export function BulkActionBar({
  selectedCount = 0,
  members = [],
  stories = [],
  currentStoryId = null,
  busy = false,
  onAction,
  onClear,
  className,
  ...rest
}) {
  if (selectedCount < 1) return null;

  const runAction = (type, value) => {
    if (!value || busy) return;
    const normalizedValue =
      value === "unassigned" || value === "uncategorized" ? null : value;
    void onAction?.(type, normalizedValue);
  };

  return (
    <div
      className={cx("bulk-bar", className)}
      role="toolbar"
      aria-label="Bulk task actions"
      aria-busy={busy || undefined}
      {...rest}
    >
      <strong className="bulk-bar-count">{`${selectedCount} selected`}</strong>

      <Select
        className="bulk-bar-select"
        aria-label="Change selected task status"
        value=""
        disabled={busy}
        onChange={(event) => runAction("status", event.target.value)}
      >
        <option value="" disabled>
          Change status
        </option>
        <option value="todo">To do</option>
        <option value="in-progress">In progress</option>
        <option value="completed">Done</option>
      </Select>

      <Select
        className="bulk-bar-select"
        aria-label="Change selected task priority"
        value=""
        disabled={busy}
        onChange={(event) => runAction("priority", event.target.value)}
      >
        <option value="" disabled>
          Change priority
        </option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </Select>

      <Select
        className="bulk-bar-select"
        aria-label="Change selected task assignee"
        value=""
        disabled={busy}
        onChange={(event) => runAction("assignee", event.target.value)}
      >
        <option value="" disabled>
          Change assignee
        </option>
        <option value="unassigned">Unassigned</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {safeDisplayName(member)}
          </option>
        ))}
      </Select>

      <Select
        className="bulk-bar-select"
        aria-label="Move selected tasks to story"
        value=""
        disabled={busy}
        onChange={(event) => runAction("story", event.target.value)}
      >
        <option value="" disabled>
          Move to story
        </option>
        <option value="uncategorized">No story</option>
        {stories
          .filter((story) => story.id !== currentStoryId)
          .map((story) => (
            <option key={story.id} value={story.id}>
              {story.title}
            </option>
          ))}
      </Select>

      <Button variant="ghost" size="sm" disabled={busy} onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

export default BulkActionBar;
