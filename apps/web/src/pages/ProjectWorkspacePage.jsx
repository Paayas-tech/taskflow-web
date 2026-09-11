/**
 * One project workspace: Overview, Board, List and Stories over the single
 * cached workspace load in the store. Switching projects never remounts the
 * page and never refetches a workspace that is already loaded; only the
 * filters, the selection and the bulk result live here.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectBoardTab } from "../project/ProjectBoardTab";
import { ProjectHeader } from "../project/ProjectHeader";
import { ProjectListTab } from "../project/ProjectListTab";
import { ProjectOverviewTab } from "../project/ProjectOverviewTab";
import { ProjectStoriesTab } from "../project/ProjectStoriesTab";
import { TaskFilterBar } from "../tasks/TaskFilterBar";
import { Button } from "../ui/Button";
import { EmptyState, InlineNotice, Spinner, cx } from "../ui/primitives";
import { projectIdFromPath, projectTabFromPath } from "../router";
import { dateOnlyKey, isTaskComplete, sortTasks, taskSearchMatch } from "../domain/task";
import { safeDisplayName } from "../domain/collaboration";
import { ensureWorkspace } from "../store/projects";
import { loadProjects } from "../store/session";
import { archiveTask, bulkUpdate, createTask, moveTasks, restoreTask } from "../store/tasks";
import { clearProjectOpenRequest, navigate, openComposer, openTask } from "../store/ui";
import { selectErrors, selectLoaded, selectPath, selectUi, selectWorkspace } from "../store/selectors";
import { useStore } from "../store/store";

const GROUP_OPTIONS = [
  { value: "story", label: "Story" },
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "none", label: "None" },
];

const SORT_OPTIONS = [
  { value: "created", label: "Created" },
  { value: "due", label: "Due" },
  { value: "priority", label: "Priority" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Done" },
];

const statusForColumn = (column) => {
  if (column?.category === "done") return "completed";
  if (column?.category === "in_progress") return "in-progress";
  return "todo";
};

const taskStatusValue = (task) =>
  isTaskComplete(task) ? "completed" : task.status || "todo";

function WorkspaceSkeleton() {
  return (
    <div className="stack-2" aria-busy="true">
      <p className="workspace-loading" role="status">
        <Spinner size="sm" />
        <span className="muted">Loading project…</span>
      </p>
      <div className="skeleton skeleton-row" />
      <div className="skeleton skeleton-row" />
      <div className="skeleton skeleton-row" />
    </div>
  );
}

export function ProjectWorkspacePage() {
  const path = useStore(selectPath);
  const projectId = projectIdFromPath(path);
  const tab = projectTabFromPath(path);

  const workspace = useStore(selectWorkspace(projectId));
  const loaded = useStore(selectLoaded);
  const errors = useStore(selectErrors);
  const { projectOpenRequest, selectedTaskId } = useStore(selectUi);

  const [searchTerm, setSearchTerm] = useState("");
  const [storyFilter, setStoryFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [group, setGroup] = useState("story");
  const [sort, setSort] = useState("created");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const todayKey = useMemo(() => dateOnlyKey(new Date()), []);
  const { project, tasks, stories, archivedStories, columns, members, canEdit } = workspace;

  const clearFilters = () => {
    setSearchTerm("");
    setStoryFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
  };

  useEffect(() => {
    void ensureWorkspace(projectId);
  }, [projectId]);

  // The page is never remounted, so a project switch resets its own view state.
  const knownProjectId = useRef(projectId);
  useEffect(() => {
    if (knownProjectId.current === projectId) return;
    knownProjectId.current = projectId;
    clearFilters();
    setGroup("story");
    setSort("created");
    setRestoringId(null);
  }, [projectId]);

  const inheritedStoryId =
    storyFilter !== "all" && storyFilter !== "none" ? storyFilter : "";

  const filteredTasks = useMemo(
    () =>
      // The status filter belongs to the list view; the board shows its columns.
      // "unassigned" and "none" are the filter values for an empty assignee/story.
      tasks.filter(
        (task) =>
          (tab !== "list" ||
            statusFilter === "all" ||
            taskStatusValue(task) === statusFilter) &&
          (assigneeFilter === "all" ||
            (task.assigneeId || "unassigned") === assigneeFilter) &&
          (storyFilter === "all" || (task.storyId || "none") === storyFilter) &&
          taskSearchMatch(task, searchTerm)
      ),
    [assigneeFilter, searchTerm, statusFilter, storyFilter, tab, tasks]
  );

  const listTasks = useMemo(() => sortTasks(filteredTasks, sort), [filteredTasks, sort]);

  // Bulk edits apply to one story at a time, so they need a story filter.
  const bulkEnabled = (tab === "board" || tab === "list") && canEdit && Boolean(inheritedStoryId);

  const visibleBulkTasks = useMemo(
    () => (tab === "board" ? filteredTasks : tab === "list" ? listTasks : []),
    [filteredTasks, listTasks, tab]
  );

  const allVisibleSelected =
    visibleBulkTasks.length > 0 &&
    visibleBulkTasks.every((task) => selectedIds.has(task.id));

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkMessage(null);
  }, [projectId, storyFilter, tab]);

  // A task that scrolled out of the filter is no longer part of the selection.
  useEffect(() => {
    const visibleIds = new Set(visibleBulkTasks.map((task) => task.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((taskId) => visibleIds.has(taskId)));
      return next.size === current.size ? current : next;
    });
  }, [visibleBulkTasks]);

  // "Open in project" from another page: select the item once it is loaded.
  useEffect(() => {
    if (!projectOpenRequest || projectOpenRequest.projectId !== projectId) return;
    if (workspace.status !== "ready") return;
    const requested = [...tasks, ...stories].find(
      (task) => task.id === projectOpenRequest.itemId
    );
    if (requested) openTask(requested.id);
    clearProjectOpenRequest();
  }, [projectId, projectOpenRequest, stories, tasks, workspace.status]);

  /* ------------------------------------------------------------ mutations */

  const createWorkspaceTask = ({ title, column, storyId, assigneeId = "" }) =>
    createTask({
      title,
      projectId,
      assigneeId,
      status: statusForColumn(column),
      storyId: storyId ?? inheritedStoryId,
    });

  const openWorkspaceComposer = (initialValues = {}, workType = "task") => {
    if (!canEdit) return;
    const { column, ...rest } = initialValues;
    openComposer(
      {
        ...rest,
        projectId,
        status: rest.status || statusForColumn(column),
        storyId: workType === "story" ? "" : (rest.storyId ?? inheritedStoryId),
      },
      { workType, lockProject: true }
    );
  };

  const toggleTaskSelection = (taskId) => {
    if (!bulkEnabled) return;
    setBulkMessage(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(taskId)) next.add(taskId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (!bulkEnabled) return;
    setBulkMessage(null);
    setSelectedIds(
      allVisibleSelected ? new Set() : new Set(visibleBulkTasks.map((task) => task.id))
    );
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkMessage(null);
  };

  const runBulkUpdate = async (type, value) => {
    if (!bulkEnabled || bulkBusy || selectedIds.size === 0) return;
    setBulkBusy(true);
    setBulkMessage(null);

    const { updated, failed, failedIds } = await bulkUpdate([...selectedIds], { type, value });
    setSelectedIds(new Set(failedIds));
    setBulkMessage({
      error: failed > 0,
      text:
        failed > 0
          ? `${updated} of ${updated + failed} tasks updated; ${failed} failed due to permissions or another error.`
          : `${updated} ${updated === 1 ? "task" : "tasks"} updated.`,
    });
    setBulkBusy(false);
  };

  const restoreStory = async (storyId) => {
    if (!canEdit || restoringId) return;
    setRestoringId(storyId);
    await restoreTask(storyId);
    setRestoringId(null);
  };

  /* -------------------------------------------------------------- render */

  const tryAgainButton = (retry) => (
    <Button size="sm" onClick={() => void retry()}>
      Try again
    </Button>
  );

  // Until the project record resolves there is no name for the header, so the
  // three fallback states share one titled shell like every other page.
  if (!project) {
    return (
      <div className="page workspace">
        <header className="page-header">
          <h1 className="page-title">Project</h1>
        </header>
        <div className="page-body is-narrow">
          {loaded.projects === "loading" ? (
            <WorkspaceSkeleton />
          ) : errors.projects ? (
            <InlineNotice tone="error" action={tryAgainButton(loadProjects)}>
              {errors.projects}
            </InlineNotice>
          ) : (
            <EmptyState
              icon="folder"
              title="Project not found"
              description="This project doesn’t exist or isn’t available to your account."
              action={
                <Button variant="primary" onClick={() => navigate("/projects")}>
                  Back to projects
                </Button>
              }
            />
          )}
        </div>
      </div>
    );
  }

  const empty = tasks.length === 0 && stories.length === 0;
  const showSkeleton = workspace.status === "loading" && empty;
  const loadFailedEmpty = Boolean(workspace.error) && empty;
  const listView = tab === "list";
  const showFilters = tab === "board" || listView;
  const activeFilterCount =
    (searchTerm.trim() ? 1 : 0) +
    (storyFilter !== "all" ? 1 : 0) +
    (assigneeFilter !== "all" ? 1 : 0) +
    (listView && statusFilter !== "all" ? 1 : 0);

  const filters = [
    {
      id: "workspace-story-filter",
      label: "Story",
      value: storyFilter,
      options: [
        { value: "all", label: "All stories" },
        { value: "none", label: "No story" },
        ...stories.map((story) => ({ value: story.id, label: story.title })),
      ],
      onChange: setStoryFilter,
    },
    {
      id: "workspace-assignee-filter",
      label: "Assignee",
      value: assigneeFilter,
      options: [
        { value: "all", label: "Anyone" },
        { value: "unassigned", label: "Unassigned" },
        ...members.map((member) => ({ value: member.userId, label: safeDisplayName(member) })),
      ],
      onChange: setAssigneeFilter,
    },
    listView && {
      id: "workspace-status-filter",
      label: "Status",
      value: statusFilter,
      options: STATUS_OPTIONS,
      onChange: setStatusFilter,
    },
  ].filter(Boolean);

  const retryButton = tryAgainButton(() => ensureWorkspace(projectId));

  // Board and List share the bulk-selection strip and its result message.
  const bulkProps = {
    members,
    stories,
    selectable: bulkEnabled,
    selectedIds,
    allSelected: allVisibleSelected,
    onToggleSelect: toggleTaskSelection,
    onToggleAll: toggleAllVisible,
    bulkBusy,
    bulkMessage,
    currentStoryId: inheritedStoryId,
    onBulkAction: runBulkUpdate,
    onClearSelection: clearSelection,
  };

  const renderTab = () => {
    if (showSkeleton) return <WorkspaceSkeleton />;

    if (loadFailedEmpty) {
      return (
        <EmptyState
          icon="alert-circle"
          title="Project workspace unavailable"
          description={workspace.error}
          action={retryButton}
        />
      );
    }

    if (tab === "overview") return <ProjectOverviewTab projectId={projectId} />;

    if (tab === "stories") {
      return (
        <ProjectStoriesTab
          stories={stories}
          tasks={tasks}
          members={members}
          columns={columns}
          selectedStoryId={selectedTaskId}
          onOpenStory={(story) => openTask(story.id)}
          onNewStory={() => openWorkspaceComposer({}, "story")}
          archivedStories={archivedStories}
          onRestoreStory={restoreStory}
          restoringId={restoringId}
          readOnly={!canEdit}
          todayKey={todayKey}
        />
      );
    }

    if (tab === "board") {
      return (
        <ProjectBoardTab
          columns={columns}
          tasks={filteredTasks}
          onMove={(placements) => void moveTasks(projectId, placements)}
          onQuickCreate={(title, column) => createWorkspaceTask({ title, column })}
          onOpenComposer={openWorkspaceComposer}
          readOnly={!canEdit}
          selectedTaskId={selectedTaskId}
          todayKey={todayKey}
          {...bulkProps}
        />
      );
    }

    return (
      <ProjectListTab
        tasks={listTasks}
        stories={stories}
        members={members}
        columns={columns}
        group={group}
        onArchive={(task) => void archiveTask(task.id)}
        onCreate={(title, sectionDefaults) => createWorkspaceTask({ title, ...sectionDefaults })}
        onOpenComposer={openWorkspaceComposer}
        readOnly={!canEdit}
        selectedTaskId={selectedTaskId}
        hasTasks={tasks.length > 0}
        onClearFilters={clearFilters}
        todayKey={todayKey}
        {...bulkProps}
      />
    );
  };

  return (
    <div className="page workspace">
      <ProjectHeader projectId={projectId} tab={tab} storyId={inheritedStoryId} />

      {showFilters ? (
        <div className="workspace-toolbar">
          <TaskFilterBar
            search={searchTerm}
            onSearch={setSearchTerm}
            filters={filters}
            group={listView ? { value: group, options: GROUP_OPTIONS, onChange: setGroup } : undefined}
            sort={listView ? { value: sort, options: SORT_OPTIONS, onChange: setSort } : undefined}
            onClear={clearFilters}
            activeCount={activeFilterCount}
          />
        </div>
      ) : null}

      <div className={cx("page-body workspace-content", tab === "board" && "is-board")}>
        {workspace.error && !loadFailedEmpty ? (
          <div className="page-notice">
            <InlineNotice tone="error" action={retryButton}>
              {workspace.error}
            </InlineNotice>
          </div>
        ) : null}

        {renderTab()}
      </div>
    </div>
  );
}
