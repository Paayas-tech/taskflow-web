import { useMemo, useState } from "react";
import { Button, EmptyState, Icon, InlineNotice, SegmentedControl } from "../ui";
import { cx } from "../ui/cx";
import {
  QuickAdd,
  QuickAddTrigger,
  TaskBoard,
  TaskFilterBar,
  TaskRow,
  groupTasksBy,
  groupTasksByDue,
  sortTasks,
  taskSearchMatch,
} from "../tasks";
import { dateOnlyKey, isTaskComplete } from "../domain/taskDomain";
import {
  mapPersonalTasksToBoard,
  personalTaskMoveUpdate,
} from "../domain/personalTaskBoardDomain";

const VIEW_STORAGE_KEY = "taskflow:my-tasks-view";
const GROUP_STORAGE_KEY = "taskflow:my-tasks-group";

const VIEWS = ["list", "board"];
const GROUPS = ["due", "priority", "project", "status"];

const VIEW_OPTIONS = [
  { id: "list", label: "List", icon: <Icon name="list" /> },
  { id: "board", label: "Board", icon: <Icon name="layout-board" /> },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "personal", label: "Personal" },
  { value: "projects", label: "Projects" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const GROUP_OPTIONS = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "project", label: "Project" },
  { value: "status", label: "Status" },
];

const SORT_OPTIONS = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created" },
  { value: "title", label: "Title" },
];

const BOARD_COLUMNS = [
  { id: "todo", name: "To do", category: "todo" },
  { id: "in-progress", name: "In progress", category: "in_progress" },
  { id: "completed", name: "Done", category: "done" },
];

const SKELETON_ROWS = [0, 1, 2];

const readPreference = (key, allowed, fallback) => {
  try {
    const stored = window.localStorage.getItem(key);
    return allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
};

const writePreference = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* view preferences are best effort */
  }
};

/**
 * My Tasks: personal tasks plus the project tasks assigned to you, as a grouped
 * list or the three personal board columns.
 */
export default function MyTasksPage({
  tasks = [],
  tasksLoading = false,
  tasksError = "",
  onRetry,
  projects = [],
  taskActions,
  onOpenTask,
  onOpenProject,
  selectedTaskId = null,
  onNewTask,
  formatSettings,
}) {
  const [view, setView] = useState(() => readPreference(VIEW_STORAGE_KEY, VIEWS, "list"));
  const [groupBy, setGroupBy] = useState(() =>
    readPreference(GROUP_STORAGE_KEY, GROUPS, "due")
  );
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [sort, setSort] = useState("due");
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(["completed"]));
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [mutationError, setMutationError] = useState("");

  const todayKey = useMemo(() => dateOnlyKey(new Date()), []);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const context = useMemo(() => ({ projectsById }), [projectsById]);
  const openCount = useMemo(
    () => tasks.filter((task) => !isTaskComplete(task)).length,
    [tasks]
  );

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (source === "personal" && task.projectId) return false;
        if (source === "projects" && !task.projectId) return false;
        if (priority !== "all" && (task.priority || "medium") !== priority) return false;
        if (projectFilter !== "all" && task.projectId !== projectFilter) return false;
        return taskSearchMatch(task, search);
      }),
    [priority, projectFilter, search, source, tasks]
  );

  const listTasks = useMemo(
    () => (showCompleted ? visibleTasks : visibleTasks.filter((task) => !isTaskComplete(task))),
    [showCompleted, visibleTasks]
  );

  const groups = useMemo(() => {
    const grouped =
      groupBy === "due"
        ? groupTasksByDue(listTasks, todayKey)
        : groupTasksBy(listTasks, groupBy, { projectsById });
    return grouped.map((group) => ({ ...group, tasks: sortTasks(group.tasks, sort) }));
  }, [groupBy, listTasks, projectsById, sort, todayKey]);

  const boardTasks = useMemo(() => mapPersonalTasksToBoard(visibleTasks), [visibleTasks]);
  const quickAddGroupId = groupBy === "due" ? "today" : groups[0]?.id;
  const quickAddDueDate = groupBy === "due" ? todayKey : "";
  const pendingIds = taskActions?.pendingIds;
  const activeCount =
    (search.trim() ? 1 : 0) +
    (source === "all" ? 0 : 1) +
    (priority === "all" ? 0 : 1) +
    (projectFilter === "all" ? 0 : 1) +
    (showCompleted ? 1 : 0);

  const changeView = (next) => {
    setView(next);
    writePreference(VIEW_STORAGE_KEY, next);
  };

  const changeGroup = (next) => {
    setGroupBy(next);
    writePreference(GROUP_STORAGE_KEY, next);
  };

  const clearFilters = () => {
    setSearch("");
    setSource("all");
    setPriority("all");
    setProjectFilter("all");
    setShowCompleted(false);
  };

  const toggleGroup = (groupId) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const runMutation = async (action, message) => {
    setMutationError("");
    try {
      await action();
    } catch {
      setMutationError(message);
    }
  };

  const handleOpen = (task, triggerElement) => onOpenTask?.(task, triggerElement);

  const handleToggleComplete = (task) => {
    void runMutation(
      () => taskActions.toggleComplete(task),
      `We couldn't update “${task.title}”. Check your connection and try again.`
    );
  };

  const handleArchive = (task) => {
    void runMutation(
      () => taskActions.archive(task),
      `We couldn't archive “${task.title}”. Check your connection and try again.`
    );
  };

  const handleMove = (placements) => {
    const move = personalTaskMoveUpdate(boardTasks, placements);
    const task = move ? tasks.find((candidate) => candidate.id === move.taskId) : null;
    if (!task) return undefined;
    return runMutation(
      () => taskActions.quickUpdate(task, move.changes),
      `We couldn't move “${task.title}”. Check your connection and try again.`
    );
  };

  const createFromQuickAdd = async (title) => {
    setMutationError("");
    await taskActions.createPersonal({ title, dueDate: quickAddDueDate });
  };

  const openDetailsFromQuickAdd = (title) => {
    setQuickAddOpen(false);
    onNewTask?.({ title, dueDate: quickAddDueDate });
  };

  const createFromBoard = async (title, column) => {
    setMutationError("");
    await taskActions.createPersonal({
      title,
      status: column.id,
      completed: column.id === "completed",
    });
  };

  const openDetailsFromBoard = (title, column) => {
    onNewTask?.({ title, status: column.id });
  };

  const renderRow = (task) => (
    <TaskRow
      key={task.id}
      task={task}
      context={context}
      todayKey={todayKey}
      selected={selectedTaskId === task.id}
      busy={Boolean(pendingIds?.has?.(task.id))}
      showProject={groupBy !== "project"}
      onOpen={handleOpen}
      onOpenProject={onOpenProject}
      onToggleComplete={handleToggleComplete}
      onArchive={task.projectId ? undefined : handleArchive}
      formatSettings={formatSettings}
    />
  );

  const renderQuickAdd = () =>
    quickAddOpen ? (
      <QuickAdd
        onCreate={createFromQuickAdd}
        onOpenDetails={openDetailsFromQuickAdd}
        onCancel={() => setQuickAddOpen(false)}
      />
    ) : (
      <QuickAddTrigger onClick={() => setQuickAddOpen(true)} />
    );

  const renderList = () => {
    if (listTasks.length === 0 && activeCount > 0) {
      return (
        <EmptyState
          icon="filter"
          title="No tasks match these filters"
          description="Try a different search or clear the filters."
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      );
    }

    if (groups.length === 0) {
      return (
        <EmptyState
          icon="checklist"
          title="Nothing left to do"
          description="Add a task to this view."
          action={renderQuickAdd()}
        />
      );
    }

    return (
      <div className="my-tasks-groups">
        {groups.map((group) => {
          const collapsed = collapsedGroups.has(group.id);
          return (
            <section
              key={group.id}
              className={cx("task-group", collapsed && "is-collapsed")}
              aria-label={group.label}
            >
              <button
                type="button"
                className="task-group-header"
                aria-expanded={!collapsed}
                onClick={() => toggleGroup(group.id)}
              >
                <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
                <span className="task-group-label">{group.label}</span>
                <span className="task-group-count">{group.tasks.length}</span>
              </button>

              {collapsed ? null : (
                <div className="task-group-body">
                  {group.tasks.length > 0 ? (
                    <div className="row-list">{group.tasks.map(renderRow)}</div>
                  ) : null}
                  {group.id === quickAddGroupId ? renderQuickAdd() : null}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  const renderBody = () => {
    if (tasksLoading) {
      return (
        <div className="row-list my-tasks-skeleton" role="status" aria-label="Loading tasks">
          {SKELETON_ROWS.map((row) => (
            <div className="skeleton-row" key={row}>
              <span className="skeleton my-tasks-skeleton-check" />
              <span className="skeleton my-tasks-skeleton-line" />
            </div>
          ))}
        </div>
      );
    }

    if (tasksError) {
      return (
        <InlineNotice
          tone="error"
          action={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {tasksError}
        </InlineNotice>
      );
    }

    if (tasks.length === 0) {
      return (
        <EmptyState
          icon="checklist"
          title="No tasks yet"
          description="Add your first task."
          action={
            <QuickAdd
              autoFocus={false}
              onCreate={createFromQuickAdd}
              onOpenDetails={openDetailsFromQuickAdd}
            />
          }
        />
      );
    }

    return (
      <>
        <TaskFilterBar
          search={search}
          onSearch={setSearch}
          filters={[
            {
              id: "my-tasks-source",
              label: "Source",
              value: source,
              defaultValue: "all",
              options: SOURCE_OPTIONS,
              onChange: setSource,
            },
            {
              id: "my-tasks-priority",
              label: "Priority",
              value: priority,
              defaultValue: "all",
              options: PRIORITY_OPTIONS,
              onChange: setPriority,
            },
            ...(projects.length > 0
              ? [
                  {
                    id: "my-tasks-project",
                    label: "Project",
                    value: projectFilter,
                    defaultValue: "all",
                    options: [
                      { value: "all", label: "Any" },
                      ...projects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      })),
                    ],
                    onChange: setProjectFilter,
                  },
                ]
              : []),
            ...(view === "list"
              ? [
                  {
                    id: "my-tasks-completed",
                    type: "checkbox",
                    label: "Show completed",
                    value: showCompleted,
                    onChange: setShowCompleted,
                  },
                ]
              : []),
          ]}
          group={
            view === "list"
              ? { value: groupBy, options: GROUP_OPTIONS, onChange: changeGroup }
              : undefined
          }
          sort={
            view === "list"
              ? { value: sort, options: SORT_OPTIONS, onChange: setSort }
              : undefined
          }
          activeCount={activeCount}
          onClear={clearFilters}
        />

        {view === "board" ? (
          <div className="my-tasks-board">
            <TaskBoard
              columns={BOARD_COLUMNS}
              tasks={boardTasks}
              context={context}
              todayKey={todayKey}
              selectedTaskId={selectedTaskId}
              collapsible
              initiallyCollapsedIds={["completed"]}
              onMove={handleMove}
              onOpen={handleOpen}
              onOpenProject={onOpenProject}
              onQuickCreate={createFromBoard}
              onOpenDetails={openDetailsFromBoard}
              formatSettings={formatSettings}
            />
          </div>
        ) : (
          renderList()
        )}
      </>
    );
  };

  return (
    <div className="page my-tasks-page">
      <header className="page-header">
        <h1 className="page-title">
          My Tasks
          <span className="page-title-count">{openCount}</span>
        </h1>

        <div className="my-tasks-views">
          <SegmentedControl
            options={VIEW_OPTIONS}
            value={view}
            ariaLabel="Task view"
            size="sm"
            onChange={changeView}
          />
        </div>

        <div className="page-actions">
          <Button
            variant="primary"
            icon={<Icon name="plus" size={14} />}
            onClick={() => onNewTask?.()}
          >
            New task
          </Button>
        </div>
      </header>

      <div
        className={cx("page-body", view === "board" ? "my-tasks-board-body" : "is-narrow")}
      >
        {mutationError ? (
          <div className="page-notice">
            <InlineNotice tone="error" onDismiss={() => setMutationError("")}>
              {mutationError}
            </InlineNotice>
          </div>
        ) : null}

        {renderBody()}
      </div>
    </div>
  );
}

export { MyTasksPage };
