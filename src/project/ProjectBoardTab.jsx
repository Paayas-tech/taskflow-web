/**
 * The project board: the shared `TaskBoard` over the project columns, with the
 * bulk-selection strip that appears while a single story is filtered.
 *
 * `onOpenComposer({ title, column })` powers the column quick-add's "Add
 * details" button, matching the list tab's flow.
 */
import { BulkActionBar } from "../tasks/BulkActionBar";
import { TaskBoard } from "../tasks/TaskBoard";
import { Checkbox } from "../ui/Field";
import { EmptyState, InlineNotice } from "../ui/primitives";

export function ProjectBoardTab({
  columns = [],
  tasks = [],
  onMove,
  onQuickCreate,
  onOpenComposer,
  readOnly = false,
  selectedTaskId = null,
  selectable = false,
  selectedIds,
  allSelected = false,
  onToggleSelect,
  onToggleAll,
  bulkBusy = false,
  bulkMessage = null,
  members = [],
  stories = [],
  currentStoryId = null,
  onBulkAction,
  onClearSelection,
  todayKey,
}) {
  const selectedCount = selectedIds?.size ?? 0;
  const showBulkTools = selectable && tasks.length > 0;

  if (columns.length === 0) {
    return (
      <EmptyState
        icon="layout-board"
        title="No columns yet"
        description="This project has no board columns to show."
      />
    );
  }

  return (
    <div className="workspace-board">
      {showBulkTools ? (
        <div className="workspace-bulk">
          <Checkbox
            className="workspace-bulk-all"
            checked={allSelected}
            aria-checked={selectedCount > 0 && !allSelected ? "mixed" : allSelected}
            label="Select all visible"
            disabled={bulkBusy}
            onChange={onToggleAll}
          />
          <BulkActionBar
            selectedCount={selectedCount}
            members={members}
            stories={stories}
            currentStoryId={currentStoryId}
            busy={bulkBusy}
            onAction={onBulkAction}
            onClear={onClearSelection}
          />
        </div>
      ) : null}

      {bulkMessage ? (
        <InlineNotice
          tone={bulkMessage.error ? "error" : "success"}
          className="workspace-bulk-message"
        >
          {bulkMessage.text}
        </InlineNotice>
      ) : null}

      <TaskBoard
        columns={columns}
        tasks={tasks}
        onMove={onMove}
        onQuickCreate={onQuickCreate}
        onOpenDetails={
          onOpenComposer ? (title, column) => onOpenComposer({ title, column }) : undefined
        }
        readOnly={readOnly}
        selectedTaskId={selectedTaskId}
        selectable={selectable}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        todayKey={todayKey}
      />
    </div>
  );
}
