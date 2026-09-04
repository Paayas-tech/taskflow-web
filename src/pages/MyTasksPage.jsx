import { useMemo, useState } from "react";
import { mapPersonalTasksToBoard, personalTaskMoveUpdate } from "../domain/board";
import {
  dateOnlyKey,
  groupTasksBy,
  groupTasksByDue,
  isTaskComplete,
  sortTasks,
  taskSearchMatch,
} from "../domain/task";
import {
  readMyTasksGroup,
  readMyTasksView,
  writeMyTasksGroup,
  writeMyTasksView,
} from "../lib/preferences";
import {
  selectActiveProjects,
  selectErrors,
  selectLoaded,
  selectMyTasks,
  selectSelectedTaskId,
} from "../store/selectors";
import { loadTasks } from "../store/session";
import { useStore } from "../store/store";
import { archiveTask, createTask, updateTask } from "../store/tasks";
import { openComposer } from "../store/ui";
import { QuickAdd, QuickAddTrigger } from "../tasks/QuickAdd";
import { TaskBoard } from "../tasks/TaskBoard";
import { TaskFilterBar } from "../tasks/TaskFilterBar";
import { TaskRow } from "../tasks/TaskRow";
import { Button, EmptyState, Icon, InlineNotice, SegmentedControl } from "../ui";
import { cx } from "../ui/primitives";

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

/**
 * My Tasks: personal tasks plus the project tasks assigned to you, as a grouped
 * list or the three personal board columns.
 */
export function MyTasksPage() {
  const tasks = useStore(selectMyTasks);
  const projects = useStore(selectActiveProjects);
  const loaded = useStore(selectLoaded);
  const errors = useStore(selectErrors);
  const selectedTaskId = useStore(selectSelectedTaskId);

  const [view, setView] = useState(readMyTasksView);
  const [groupBy, setGroupBy] = useState(readMyTasksGroup);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [sort, setSort] = useState("due");
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(["completed"]));
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const todayKey = useMemo(() => dateOnlyKey(new Date()), []);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
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
    () =>
      showCompleted ? visibleTasks : visibleTasks.filter((task) => !isTaskComplete(task)),
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
  const listView = view === "list";
  const openCount = tasks.filter((task) => !isTaskComplete(task)).length;
  const quickAddGroupId = groupBy === "due" ? "today" : groups[0]?.id;
  const quickAddDueDate = groupBy === "due" ? todayKey : "";
  const loading = loaded.tasks === "loading" && tasks.length === 0;
  const activeCount = [
    search.trim(),
    source !== "all",
    priority !== "all",
    projectFilter !== "all",
    showCompleted,
  ].filter(Boolean).length;

  const changeView = (next) => {
    setView(next);
    writeMyTasksView(next);
  };

  const changeGroup = (next) => {
    setGroupBy(next);
    writeMyTasksGroup(next);
  };

  const clearFilters = () => {
    setSearch("");
    setSource("all");
    setPriority("all");
    setProjectFilter("all");
    setShowCompleted(false);
  };

  const toggleGroup = (groupId) =>
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (!next.delete(groupId)) next.add(groupId);
      return next;
    });

  const handleMove = (placements) => {
    const move = personalTaskMoveUpdate(boardTasks, placements);
    return move ? updateTask(move.taskId, move.changes) : undefined;
  };

  const createQuickTask = (title) => createTask({ title, dueDate: quickAddDueDate });

  const openDetailsFromQuickAdd = (title) => {
    setQuickAddOpen(false);
    openComposer({ title, dueDate: quickAddDueDate });
  };

  const renderRow = (task) => (
    <TaskRow
      key={task.id}
      task={task}
      todayKey={todayKey}
      selected={selectedTaskId === task.id}
      showProject={groupBy !== "project"}
      onArchive={task.projectId ? undefined : (item) => archiveTask(item.id)}
    />
  );

  const renderQuickAdd = () =>
    quickAddOpen ? (
      <QuickAdd
        onCreate={createQuickTask}
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
    if (loading) {
      return (
        <div className="row-list my-tasks-skeleton" role="status" aria-label="Loading tasks">
          {[0, 1, 2].map((row) => (
            <div className="skeleton-row" key={row}>
              <span className="skeleton my-tasks-skeleton-check" />
              <span className="skeleton my-tasks-skeleton-line" />
            </div>
          ))}
        </div>
      );
    }

    if (errors.tasks) {
      return (
        <InlineNotice
          tone="error"
          action={
            <Button variant="secondary" size="sm" onClick={() => void loadTasks()}>
              Retry
            </Button>
          }
        >
          {errors.tasks}
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
              onCreate={createQuickTask}
              onOpenDetails={openDetailsFromQuickAdd}
            />
          }
        />
      );
    }

    // Every select filter falls back to its first option, which is always "all".
    const filters = [
      {
        id: "my-tasks-source",
        label: "Source",
        value: source,
        options: SOURCE_OPTIONS,
        onChange: setSource,
      },
      {
        id: "my-tasks-priority",
        label: "Priority",
        value: priority,
        options: PRIORITY_OPTIONS,
        onChange: setPriority,
      },
      projects.length > 0 && {
        id: "my-tasks-project",
        label: "Project",
        value: projectFilter,
        options: [
          { value: "all", label: "Any" },
          ...projects.map((project) => ({ value: project.id, label: project.name })),
        ],
        onChange: setProjectFilter,
      },
      listView && {
        id: "my-tasks-completed",
        type: "checkbox",
        label: "Show completed",
        value: showCompleted,
        onChange: setShowCompleted,
      },
    ].filter(Boolean);

    return (
      <>
        <TaskFilterBar
          search={search}
          onSearch={setSearch}
          filters={filters}
          group={listView ? { value: groupBy, options: GROUP_OPTIONS, onChange: changeGroup } : undefined}
          sort={listView ? { value: sort, options: SORT_OPTIONS, onChange: setSort } : undefined}
          activeCount={activeCount}
          onClear={clearFilters}
        />

        {view === "board" ? (
          <div className="my-tasks-board">
            <TaskBoard
              columns={BOARD_COLUMNS}
              tasks={boardTasks}
              todayKey={todayKey}
              selectedTaskId={selectedTaskId}
              collapsible
              initiallyCollapsedIds={["completed"]}
              onMove={handleMove}
              onQuickCreate={(title, column) => createTask({ title, status: column.id })}
              onOpenDetails={(title, column) => openComposer({ title, status: column.id })}
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
            onClick={() => openComposer()}
          >
            New task
          </Button>
        </div>
      </header>

      <div className={cx("page-body", view === "board" && "my-tasks-board-body")}>
        {renderBody()}
      </div>
    </div>
  );
}
