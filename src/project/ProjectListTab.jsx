import { useState } from "react";
import { BulkActionBar, QuickAdd, QuickAddTrigger, TaskRow } from "../tasks";
import { Button, IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Checkbox } from "../ui/Field";
import { Icon } from "../ui/icons";
import { InlineNotice } from "../ui/InlineNotice";
import { groupProjectTasksByColumn } from "../domain/projectBoardDomain";
import { safeDisplayName } from "../domain/identityDomain";

const sectionsFor = ({ group, tasks, stories, members, columns }) => {
  if (group === "status") {
    const byColumn = groupProjectTasksByColumn(columns, tasks, { preserveTaskOrder: true });
    return columns.map((column) => ({
      id: `column-${column.id}`,
      title: column.name,
      tasks: byColumn.get(column.id) || [],
      create: { column },
    }));
  }

  if (group === "assignee") {
    const byAssignee = new Map(members.map((member) => [member.userId, []]));
    const unassigned = [];
    tasks.forEach((task) => {
      const bucket = task.assigneeId ? byAssignee.get(task.assigneeId) : null;
      if (bucket) bucket.push(task);
      else unassigned.push(task);
    });
    return [
      ...members.map((member) => ({
        id: `assignee-${member.userId}`,
        title: safeDisplayName(member),
        tasks: byAssignee.get(member.userId) || [],
        create: { assigneeId: member.userId },
      })),
      { id: "assignee-none", title: "Unassigned", tasks: unassigned, create: { assigneeId: "" } },
    ];
  }

  if (group === "none") {
    return [{ id: "all", title: "All tasks", tasks, create: {} }];
  }

  const byStory = new Map(stories.map((story) => [story.id, []]));
  const withoutStory = [];
  tasks.forEach((task) => {
    const bucket = task.storyId ? byStory.get(task.storyId) : null;
    if (bucket) bucket.push(task);
    else withoutStory.push(task);
  });
  return [
    ...stories.map((story) => ({
      id: `story-${story.id}`,
      title: story.title,
      tasks: byStory.get(story.id) || [],
      create: { storyId: story.id },
    })),
    { id: "story-none", title: "No story", tasks: withoutStory, create: { storyId: "" } },
  ];
};

/**
 * The project list: grouped sections of `TaskRow`s with an inline quick add per
 * section that inherits that section's story, status or assignee.
 */
export function ProjectListTab({
  tasks = [],
  stories = [],
  members = [],
  columns = [],
  context,
  group = "story",
  onOpen,
  onToggleComplete,
  onArchive,
  onCreate,
  onOpenComposer,
  readOnly = false,
  selectedTaskId = null,
  pendingIds,
  selectable = false,
  selectedIds,
  allSelected = false,
  onToggleSelect,
  onToggleAll,
  bulkBusy = false,
  bulkMessage = null,
  currentStoryId = null,
  onBulkAction,
  onClearSelection,
  hasTasks = false,
  onClearFilters,
  todayKey,
  formatSettings,
}) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [quickAddSectionId, setQuickAddSectionId] = useState(null);

  const sections = sectionsFor({ group, tasks, stories, members, columns });
  const selectedCount = selectedIds?.size ?? 0;
  const canCreate = !readOnly && Boolean(onCreate);

  const toggleSection = (sectionId) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  return (
    <div className="workspace-list">
      {selectable && tasks.length > 0 ? (
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
        <InlineNotice tone={bulkMessage.error ? "error" : "success"} className="workspace-bulk-message">
          {bulkMessage.text}
        </InlineNotice>
      ) : null}

      {tasks.length === 0 ? (
        hasTasks ? (
          <EmptyState
            icon="filter"
            title="No tasks match these filters"
            description="Clear the filters to see the rest of this project."
            action={
              onClearFilters ? (
                <Button size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <EmptyState
            icon="checklist"
            title="No tasks yet"
            description="Add the first task to this project."
            action={
              canCreate && onOpenComposer ? (
                <Button variant="primary" size="sm" onClick={() => onOpenComposer({})}>
                  New task
                </Button>
              ) : null
            }
          />
        )
      ) : (
        sections.map((section) => {
          const collapsed = collapsedIds.has(section.id);
          const headingId = `workspace-section-${section.id}`;
          return (
            <section className="section workspace-section" key={section.id} aria-labelledby={headingId}>
              <header className="section-header">
                <IconButton
                  label={`${collapsed ? "Expand" : "Collapse"} ${section.title}`}
                  size="sm"
                  aria-expanded={!collapsed}
                  onClick={() => toggleSection(section.id)}
                >
                  <Icon name={collapsed ? "chevron-right" : "chevron-down"} />
                </IconButton>
                <h3 className="section-title" id={headingId}>
                  {section.title}
                </h3>
                <span className="section-meta">{section.tasks.length}</span>
              </header>

              {collapsed ? null : (
                <>
                  <div className="row-list">
                    {section.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        context={context}
                        selected={selectedTaskId === task.id}
                        busy={Boolean(pendingIds?.has?.(task.id))}
                        readOnly={readOnly}
                        showProject={false}
                        showStory={group !== "story"}
                        todayKey={todayKey}
                        selectable={selectable}
                        selectedForBulk={Boolean(selectedIds?.has?.(task.id))}
                        onToggleSelect={onToggleSelect}
                        onOpen={onOpen}
                        onToggleComplete={readOnly ? undefined : onToggleComplete}
                        onArchive={readOnly ? undefined : onArchive}
                        formatSettings={formatSettings}
                      />
                    ))}
                    {section.tasks.length === 0 ? (
                      <p className="workspace-section-empty muted">No tasks</p>
                    ) : null}
                  </div>

                  {canCreate ? (
                    quickAddSectionId === section.id ? (
                      <QuickAdd
                        contextLabel={section.title}
                        onCreate={(title) => onCreate(title, section.create)}
                        onOpenDetails={
                          onOpenComposer
                            ? (title) => {
                                setQuickAddSectionId(null);
                                onOpenComposer({ title, ...section.create });
                              }
                            : undefined
                        }
                        onCancel={() => setQuickAddSectionId(null)}
                      />
                    ) : (
                      <QuickAddTrigger onClick={() => setQuickAddSectionId(section.id)} />
                    )
                  ) : null}
                </>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

export default ProjectListTab;
