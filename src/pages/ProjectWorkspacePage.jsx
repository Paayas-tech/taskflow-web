import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectBoardTab from "../project/ProjectBoardTab";
import ProjectHeader from "../project/ProjectHeader";
import ProjectListTab from "../project/ProjectListTab";
import ProjectOverviewTab from "../project/ProjectOverviewTab";
import ProjectStoriesTab from "../project/ProjectStoriesTab";
import { TaskComposerDialog, TaskDetailPanel, TaskFilterBar } from "../tasks";
import { sortTasks, taskSearchMatch } from "../tasks/taskPresentation";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { InlineNotice } from "../ui/InlineNotice";
import { Spinner } from "../ui/Spinner";
import { cx } from "../ui/cx";
import { attachmentService } from "../application/attachmentService";
import {
  archiveProjectTask,
  createProjectTask,
  deleteProjectTask,
  reorderProjectTasks,
  setTaskAssignee,
  updateProjectTask,
} from "../application/projectService";
import { consumeProjectWorkspace } from "../application/projectWorkspaceLoader";
import { dateOnlyKey, isArchived, isTaskComplete } from "../domain/taskDomain";
import { safeDisplayName } from "../domain/identityDomain";

const EMPTY_TASK_VALUES = {
  title: "",
  description: "",
  notes: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  reminder: false,
  reminderAt: "",
  listId: null,
  projectId: "",
  workType: "task",
  storyId: "",
};

const READ_ONLY_MESSAGE = "This project is read-only for your account.";
const WORKSPACE_LOAD_ERROR =
  "We couldn't load this project workspace. Check your connection and try again.";

const statusForColumn = (column) => {
  if (column?.category === "done") return "completed";
  if (column?.category === "in_progress") return "in-progress";
  return "todo";
};

const categoryForStatus = (status) => {
  if (status === "completed" || status === "done") return "done";
  if (status === "in-progress" || status === "in_progress") return "in_progress";
  return "todo";
};

const taskStatusValue = (task) =>
  isTaskComplete(task) ? "completed" : task.status || "todo";

const assigneeNameFor = (members, assigneeId) =>
  members.find((member) => member.userId === assigneeId)?.displayName || "";

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

/**
 * One project workspace: Overview, Board, List and Stories over a single
 * shared load of tasks, columns and members, with optimistic mutations.
 */
export default function ProjectWorkspacePage({
  userId,
  projectId,
  project,
  projects = [],
  projectsLoading = false,
  projectsError = "",
  onRetryProjects,
  tab = "overview",
  onTabChange,
  openItemRequest = null,
  refreshToken = 0,
  onProjectTasksChanged,
  onUpdateProject,
  onDeleteProject,
  onBack,
  formatSettings = {},
  browserNotificationsEnabled = true,
  defaultReminderMinutes = 15,
  workspaceLoader = consumeProjectWorkspace,
}) {
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [attachmentCounts, setAttachmentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [storyReturnId, setStoryReturnId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [storyFilter, setStoryFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [group, setGroup] = useState("story");
  const [sort, setSort] = useState("created");
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkMessage, setBulkMessage] = useState(null);
  const [storyActionId, setStoryActionId] = useState(null);
  const [composer, setComposer] = useState(null);

  const workspaceRequestRef = useRef(0);
  const loadedProjectIdRef = useRef(null);
  const openTriggerRef = useRef(null);

  const todayKey = useMemo(() => dateOnlyKey(new Date()), []);
  const canEdit = ["owner", "editor"].includes(project?.viewerRole);

  const loadWorkspace = useCallback(async () => {
    if (!userId || !projectId) return;
    const requestId = ++workspaceRequestRef.current;
    const initialLoad = loadedProjectIdRef.current !== projectId;
    if (initialLoad) setLoading(true);
    setLoadError("");
    try {
      const {
        tasks: projectTasks,
        columns: projectColumns,
        members: projectMembers,
      } = await workspaceLoader(userId, projectId);
      if (requestId !== workspaceRequestRef.current) return;
      setTasks(projectTasks);
      setColumns(projectColumns);
      setMembers(projectMembers);
      void attachmentService
        .getTaskCounts(projectId)
        .then(setAttachmentCounts)
        .catch(() => {});
      loadedProjectIdRef.current = projectId;
    } catch (error) {
      if (requestId !== workspaceRequestRef.current) return;
      console.error("Error loading project workspace:", error);
      if (initialLoad) {
        setTasks([]);
        setColumns([]);
        setMembers([]);
        setAttachmentCounts({});
      }
      setLoadError(WORKSPACE_LOAD_ERROR);
    } finally {
      if (requestId === workspaceRequestRef.current && initialLoad) setLoading(false);
    }
  }, [projectId, userId, workspaceLoader]);

  useEffect(() => {
    setSelectedTaskId(null);
    setStoryReturnId(null);
    setSearchTerm("");
    setStoryFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
    setGroup("story");
    setSort("created");
    setMutationError("");
    setComposer(null);
    void loadWorkspace();
    return () => {
      workspaceRequestRef.current += 1;
    };
  }, [loadWorkspace, projectId, refreshToken]);

  const stories = useMemo(
    () => tasks.filter((task) => !isArchived(task) && task.workType === "story"),
    [tasks]
  );
  const archivedStories = useMemo(
    () => tasks.filter((task) => isArchived(task) && task.workType === "story"),
    [tasks]
  );

  const activeTasks = useMemo(() => {
    const storyNames = new Map(stories.map((story) => [story.id, story.title]));
    const withAttachmentCount = (task) =>
      attachmentCounts[task.id] > 0
        ? { ...task, attachmentCount: attachmentCounts[task.id] }
        : task;
    return tasks
      .filter((task) => !isArchived(task) && task.workType !== "story")
      .map((task) => {
        if (storyNames.has(task.storyId)) {
          return withAttachmentCount({ ...task, storyName: storyNames.get(task.storyId) });
        }
        if (task.storyId) {
          return withAttachmentCount({
            ...task,
            orphanedStoryId: task.storyId,
            storyId: null,
            storyName: "",
          });
        }
        return withAttachmentCount(task);
      });
  }, [attachmentCounts, stories, tasks]);

  const context = useMemo(
    () => ({
      projectsById: new Map(projects.map((candidate) => [candidate.id, candidate])),
      membersById: new Map(members.map((member) => [member.userId, member])),
    }),
    [members, projects]
  );

  const editableProjects = useMemo(
    () => projects.filter((candidate) => ["owner", "editor"].includes(candidate.viewerRole)),
    [projects]
  );

  const filteredTasks = useMemo(() => {
    const listView = tab === "list";
    return activeTasks.filter((task) => {
      if (listView && statusFilter !== "all" && taskStatusValue(task) !== statusFilter) {
        return false;
      }
      if (assigneeFilter === "unassigned" && task.assigneeId) return false;
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "unassigned" &&
        task.assigneeId !== assigneeFilter
      ) {
        return false;
      }
      if (storyFilter === "none" && task.storyId) return false;
      if (storyFilter !== "all" && storyFilter !== "none" && task.storyId !== storyFilter) {
        return false;
      }
      return taskSearchMatch(task, searchTerm);
    });
  }, [activeTasks, assigneeFilter, searchTerm, statusFilter, storyFilter, tab]);

  const listTasks = useMemo(() => sortTasks(filteredTasks, sort), [filteredTasks, sort]);

  const selectedTask = useMemo(
    () => [...activeTasks, ...stories].find((task) => task.id === selectedTaskId) || null,
    [activeTasks, selectedTaskId, stories]
  );

  const bulkEnabled =
    (tab === "board" || tab === "list") &&
    canEdit &&
    storyFilter !== "all" &&
    storyFilter !== "none";
  const visibleBulkTasks = useMemo(() => {
    if (tab === "board") return filteredTasks;
    if (tab === "list") return listTasks;
    return [];
  }, [filteredTasks, listTasks, tab]);
  const allVisibleSelected =
    visibleBulkTasks.length > 0 &&
    visibleBulkTasks.every((task) => selectedTaskIds.has(task.id));

  useEffect(() => {
    setSelectedTaskIds(new Set());
    setBulkMessage(null);
  }, [projectId, storyFilter, tab]);

  useEffect(() => {
    const visibleIds = new Set(visibleBulkTasks.map((task) => task.id));
    setSelectedTaskIds((current) => {
      const next = new Set([...current].filter((taskId) => visibleIds.has(taskId)));
      return next.size === current.size ? current : next;
    });
  }, [visibleBulkTasks]);

  useEffect(() => {
    if (!openItemRequest || openItemRequest.projectId !== projectId) return;
    const requestedItem = tasks.find(
      (task) => task.id === openItemRequest.itemId && !isArchived(task)
    );
    if (requestedItem) {
      setSelectedTaskId(requestedItem.id);
      setStoryReturnId(null);
    }
  }, [openItemRequest, projectId, tasks]);

  const updateAttachmentCount = useCallback((taskId, count) => {
    setAttachmentCounts((current) => ({ ...current, [taskId]: count }));
  }, []);

  const inheritedStoryId =
    storyFilter !== "all" && storyFilter !== "none" ? storyFilter : "";

  const openEditor = (task, triggerElement) => {
    openTriggerRef.current = triggerElement || null;
    setStoryReturnId(null);
    setSelectedTaskId(task.id);
  };

  const openTaskById = (taskId) => {
    const target = tasks.find((task) => task.id === taskId && !isArchived(task));
    if (target) openEditor(target, null);
  };

  const openStoryTask = (task) => {
    if (selectedTask?.workType === "story") setStoryReturnId(selectedTask.id);
    setSelectedTaskId(task.id);
  };

  const closeSelectedItem = () => {
    if (storyReturnId) {
      setSelectedTaskId(storyReturnId);
      setStoryReturnId(null);
      return;
    }
    setSelectedTaskId(null);
  };

  const openComposer = (initialValues = {}, workType = "task") => {
    if (!canEdit) return;
    const { column, ...rest } = initialValues;
    setComposer({
      workType,
      initialValues: {
        ...rest,
        projectId,
        status: rest.status || statusForColumn(column),
        storyId: workType === "story" ? "" : (rest.storyId ?? inheritedStoryId),
      },
    });
  };

  const createWorkspaceTask = async ({ title, column, storyId, assigneeId = "" }) => {
    if (!canEdit) throw new Error(READ_ONLY_MESSAGE);
    const normalizedTitle = String(title || "").trim();
    if (!normalizedTitle) throw new Error("Task title cannot be empty.");
    const created = await createProjectTask(userId, projectId, {
      ...EMPTY_TASK_VALUES,
      title: normalizedTitle,
      projectId,
      listId: null,
      status: statusForColumn(column),
      workType: "task",
      storyId: storyId ?? inheritedStoryId,
    });
    if (assigneeId && created?.id) {
      await setTaskAssignee(userId, projectId, created.id, assigneeId);
    }
    await loadWorkspace();
    onProjectTasksChanged?.();
  };

  const handleComposerSubmit = async (values) => {
    if (!canEdit) throw new Error(READ_ONLY_MESSAGE);
    const { assigneeId, ...taskValues } = values;
    const title = String(values.title || "").trim();
    let created = null;
    try {
      created = await createProjectTask(userId, projectId, {
        ...taskValues,
        title,
        projectId,
        listId: null,
      });
    } catch (error) {
      console.error("Error creating project task:", error);
      throw new Error(
        `We couldn't create this ${values.workType === "story" ? "story" : "task"}. Check your connection and try again.`
      );
    }
    if (assigneeId && created?.id) {
      try {
        await setTaskAssignee(userId, projectId, created.id, assigneeId);
      } catch (error) {
        console.error("Error assigning new project task:", error);
        setMutationError(
          `“${title}” was created, but its assignee could not be saved. Open the task to assign it.`
        );
      }
    }
    await loadWorkspace();
    onProjectTasksChanged?.();
    return created;
  };

  const handleUpdate = async (taskId, data) => {
    if (!canEdit) throw new Error(READ_ONLY_MESSAGE);
    await updateProjectTask(userId, projectId, taskId, data);
    await loadWorkspace();
    onProjectTasksChanged?.();
  };

  const handleQuickUpdate = async (taskId, data) => {
    if (!canEdit) throw new Error(READ_ONLY_MESSAGE);
    const previous = tasks;
    setPendingIds((ids) => new Set(ids).add(taskId));
    const statusColumn = Object.prototype.hasOwnProperty.call(data, "status")
      ? columns.find((column) => column.category === categoryForStatus(data.status))
      : null;
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, ...data, ...(statusColumn ? { columnId: statusColumn.id } : {}) }
          : task
      )
    );
    try {
      await updateProjectTask(userId, projectId, taskId, data);
      onProjectTasksChanged?.();
    } catch (error) {
      setTasks(previous);
      throw error;
    } finally {
      setPendingIds((ids) => {
        const next = new Set(ids);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleCompletion = async (task) => {
    const completed = !isTaskComplete(task);
    setMutationError("");
    try {
      await handleQuickUpdate(task.id, {
        completed,
        status: completed ? "completed" : "todo",
      });
    } catch (error) {
      console.error("Error updating project task completion:", error);
      setMutationError(`We couldn't ${completed ? "complete" : "reopen"} “${task.title}”.`);
    }
  };

  const handleDelete = async (taskId) => {
    if (!canEdit) throw new Error(READ_ONLY_MESSAGE);
    const deletingTask = tasks.find((task) => task.id === taskId);
    await attachmentService.removeAll({
      projectId,
      entityType: deletingTask?.workType === "story" ? "story" : "task",
      entityId: taskId,
    });
    await deleteProjectTask(userId, projectId, taskId);
    await loadWorkspace();
    onProjectTasksChanged?.();
  };

  const handleArchive = async (taskId, options = {}) => {
    if (!canEdit) throw new Error(READ_ONLY_MESSAGE);
    const story = tasks.find((task) => task.id === taskId && task.workType === "story");
    const linkedTasks = story
      ? tasks.filter((task) => task.workType !== "story" && task.storyId === taskId)
      : [];
    if (linkedTasks.length > 0) {
      if (options?.moveLinkedTasksToUncategorized !== true) {
        throw new Error("Move linked tasks to No story before archiving this story.");
      }
      const results = await Promise.allSettled(
        linkedTasks.map((linkedTask) =>
          updateProjectTask(userId, projectId, linkedTask.id, { storyId: null })
        )
      );
      if (results.some((result) => result.status === "rejected")) {
        await loadWorkspace();
        throw new Error(
          "Some linked tasks could not be moved to No story. The story was not archived."
        );
      }
    }
    await archiveProjectTask(userId, projectId, taskId);
    await loadWorkspace();
    onProjectTasksChanged?.();
  };

  const archiveFromRow = async (task) => {
    setMutationError("");
    try {
      await handleArchive(task.id);
    } catch (error) {
      setMutationError(error?.message || `We couldn't archive “${task.title}”.`);
    }
  };

  const handleRestoreStory = async (storyId) => {
    if (!canEdit || storyActionId) return;
    setStoryActionId(storyId);
    setMutationError("");
    try {
      await updateProjectTask(userId, projectId, storyId, { archivedAt: null });
      await loadWorkspace();
      onProjectTasksChanged?.();
    } catch (error) {
      console.error("Error restoring project story:", error);
      setMutationError("We couldn't restore that story. Check your connection and try again.");
    } finally {
      setStoryActionId(null);
    }
  };

  const handleMoveTasks = async (placements) => {
    if (!canEdit) return;
    const previous = tasks;
    const placementMap = new Map(placements.map((item) => [item.taskId, item]));
    const columnsById = new Map(columns.map((column) => [column.id, column]));
    setTasks((current) =>
      current.map((task) => {
        const placement = placementMap.get(task.id);
        if (!placement) return task;
        const status = statusForColumn(columnsById.get(placement.columnId));
        return {
          ...task,
          columnId: placement.columnId,
          position: placement.position,
          status,
          completed: status === "completed",
        };
      })
    );
    try {
      await reorderProjectTasks(userId, projectId, placements);
      onProjectTasksChanged?.();
    } catch (error) {
      console.error("Error moving project task:", error);
      setTasks(previous);
      setMutationError("We couldn't save that task move. The board has been restored.");
    }
  };

  const handleAssigneeChange = async (taskId, assigneeId) => {
    if (!canEdit) throw new Error(READ_ONLY_MESSAGE);
    await setTaskAssignee(userId, projectId, taskId, assigneeId);
    const assigneeName = assigneeNameFor(members, assigneeId);
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, assigneeId: assigneeId || null, assigneeName } : task
      )
    );
    onProjectTasksChanged?.();
  };

  const handleBulkStoryTaskUpdate = async (taskIds, action, sourceStoryId = null) => {
    if (!canEdit) throw new Error(READ_ONLY_MESSAGE);
    const currentStoryId =
      sourceStoryId || (selectedTask?.workType === "story" ? selectedTask.id : null);
    const selectedIds = [...new Set(taskIds)].filter((taskId) =>
      activeTasks.some((task) => task.id === taskId && task.storyId === currentStoryId)
    );
    if (!currentStoryId || selectedIds.length === 0) {
      return { updated: 0, failed: 0, failedIds: [] };
    }

    let patch = {};
    if (action.type === "status") {
      if (!["todo", "in-progress", "completed"].includes(action.value)) {
        throw new Error("Choose a valid task status.");
      }
      patch = { status: action.value, completed: action.value === "completed" };
    } else if (action.type === "priority") {
      if (!["low", "medium", "high"].includes(action.value)) {
        throw new Error("Choose a valid task priority.");
      }
      patch = { priority: action.value };
    } else if (action.type === "story") {
      const destinationStoryId = action.value || null;
      if (destinationStoryId && !stories.some((story) => story.id === destinationStoryId)) {
        throw new Error("Choose a story from this project.");
      }
      patch = { storyId: destinationStoryId };
    } else if (action.type !== "assignee") {
      throw new Error("Choose a valid bulk action.");
    }

    const assigneeId = action.type === "assignee" ? action.value || null : undefined;
    if (assigneeId && !members.some((member) => member.userId === assigneeId)) {
      throw new Error("Choose a member of this project.");
    }
    const assigneeName = assigneeNameFor(members, assigneeId);
    const statusColumn =
      action.type === "status"
        ? columns.find((column) => column.category === categoryForStatus(action.value))
        : null;
    const previous = tasks;

    setPendingIds((ids) => new Set([...ids, ...selectedIds]));
    setTasks((current) =>
      current.map((task) => {
        if (!selectedIds.includes(task.id)) return task;
        if (action.type === "assignee") return { ...task, assigneeId, assigneeName };
        return { ...task, ...patch, ...(statusColumn ? { columnId: statusColumn.id } : {}) };
      })
    );

    const results = await Promise.allSettled(
      selectedIds.map((taskId) =>
        action.type === "assignee"
          ? setTaskAssignee(userId, projectId, taskId, assigneeId)
          : updateProjectTask(userId, projectId, taskId, patch)
      )
    );
    const failedIds = selectedIds.filter((_, index) => results[index].status === "rejected");
    if (failedIds.length > 0) setTasks(previous);
    await loadWorkspace();
    onProjectTasksChanged?.();
    setPendingIds((ids) => {
      const next = new Set(ids);
      selectedIds.forEach((taskId) => next.delete(taskId));
      return next;
    });
    return {
      updated: selectedIds.length - failedIds.length,
      failed: failedIds.length,
      failedIds,
    };
  };

  const toggleTaskSelection = (taskId) => {
    if (!bulkEnabled) return;
    setBulkMessage(null);
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (!bulkEnabled) return;
    setBulkMessage(null);
    setSelectedTaskIds(
      allVisibleSelected ? new Set() : new Set(visibleBulkTasks.map((task) => task.id))
    );
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
    setBulkMessage(null);
  };

  const runBulkUpdate = async (type, value) => {
    if (!bulkEnabled || bulkUpdating || selectedTaskIds.size === 0) return;
    setBulkUpdating(true);
    setBulkMessage(null);
    try {
      const result = await handleBulkStoryTaskUpdate(
        [...selectedTaskIds],
        { type, value },
        storyFilter
      );
      const updated = result.updated || 0;
      const failed = result.failed || 0;
      setSelectedTaskIds(new Set(result.failedIds || []));
      setBulkMessage({
        error: failed > 0,
        text:
          failed > 0
            ? `${updated} of ${updated + failed} tasks updated; ${failed} failed due to permissions or another error.`
            : `${updated} ${updated === 1 ? "task" : "tasks"} updated.`,
      });
    } catch (error) {
      setBulkMessage({
        error: true,
        text: error?.message || "We couldn't update the selected tasks.",
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStoryFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
  };

  // Before the project record resolves there is no name for the header, so the
  // three fallback states share one titled shell (`.page-header` + `.page-body`,
  // like every other page) instead of a bare body.
  const fallbackPage = (children) => (
    <div className="page workspace">
      <header className="page-header">
        <h1 className="page-title">Project</h1>
      </header>
      <div className="page-body is-narrow">{children}</div>
    </div>
  );

  if (projectsLoading && !project) {
    return fallbackPage(
      <>
        <p className="workspace-loading" role="status">
          <Spinner size="sm" />
          <span className="muted">Loading project…</span>
        </p>
        <div className="stack-2">
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </div>
      </>
    );
  }

  if (projectsError) {
    return fallbackPage(
      <InlineNotice
        tone="error"
        action={
          <Button size="sm" onClick={onRetryProjects}>
            Try again
          </Button>
        }
      >
        {projectsError}
      </InlineNotice>
    );
  }

  if (!project) {
    return fallbackPage(
      <EmptyState
        icon="folder"
        title="Project not found"
        description="This project doesn’t exist or isn’t available to your account."
        action={
          <Button variant="primary" onClick={onBack}>
            Back to projects
          </Button>
        }
      />
    );
  }

  const showFilters = tab === "board" || tab === "list";
  const activeFilterCount =
    (searchTerm.trim() ? 1 : 0) +
    (storyFilter !== "all" ? 1 : 0) +
    (assigneeFilter !== "all" ? 1 : 0) +
    (tab === "list" && statusFilter !== "all" ? 1 : 0);

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
        ...members.map((member) => ({
          value: member.userId,
          label: safeDisplayName(member),
        })),
      ],
      onChange: setAssigneeFilter,
    },
  ];
  if (tab === "list") {
    filters.push({
      id: "workspace-status-filter",
      label: "Status",
      value: statusFilter,
      options: STATUS_OPTIONS,
      onChange: setStatusFilter,
    });
  }

  const isStorySelected = selectedTask?.workType === "story";
  const relatedTasks = isStorySelected
    ? activeTasks.filter((task) => task.storyId === selectedTask.id)
    : [];

  const loadFailedEmpty = Boolean(loadError) && activeTasks.length === 0 && stories.length === 0;

  const renderTab = () => {
    if (loadFailedEmpty) {
      return (
        <EmptyState
          icon="alert-circle"
          title="Project workspace unavailable"
          description={loadError}
          action={
            <Button size="sm" onClick={loadWorkspace}>
              Try again
            </Button>
          }
        />
      );
    }

    if (tab === "overview") {
      return (
        <ProjectOverviewTab
          userId={userId}
          projectId={projectId}
          project={project}
          onOpenTask={openTaskById}
          members={members}
        />
      );
    }

    if (tab === "stories") {
      return (
        <ProjectStoriesTab
          stories={stories}
          tasks={activeTasks}
          members={members}
          columns={columns}
          selectedStoryId={selectedTaskId}
          onOpenStory={openEditor}
          onNewStory={() => openComposer({}, "story")}
          archivedStories={archivedStories}
          onRestoreStory={handleRestoreStory}
          restoringId={storyActionId}
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
          context={context}
          onMove={handleMoveTasks}
          onOpen={openEditor}
          onQuickCreate={(title, column) => createWorkspaceTask({ title, column })}
          onOpenComposer={openComposer}
          readOnly={!canEdit}
          selectedTaskId={selectedTaskId}
          selectable={bulkEnabled}
          selectedIds={selectedTaskIds}
          allSelected={allVisibleSelected}
          onToggleSelect={toggleTaskSelection}
          onToggleAll={toggleAllVisible}
          bulkBusy={bulkUpdating}
          bulkMessage={bulkMessage}
          members={members}
          stories={stories}
          currentStoryId={inheritedStoryId}
          onBulkAction={runBulkUpdate}
          onClearSelection={clearSelection}
          todayKey={todayKey}
          formatSettings={formatSettings}
        />
      );
    }

    return (
      <ProjectListTab
        tasks={listTasks}
        stories={stories}
        members={members}
        columns={columns}
        context={context}
        group={group}
        onOpen={openEditor}
        onToggleComplete={handleCompletion}
        onArchive={(task) => void archiveFromRow(task)}
        onCreate={(title, sectionDefaults) =>
          createWorkspaceTask({ title, ...sectionDefaults })
        }
        onOpenComposer={openComposer}
        readOnly={!canEdit}
        selectedTaskId={selectedTaskId}
        pendingIds={pendingIds}
        selectable={bulkEnabled}
        selectedIds={selectedTaskIds}
        allSelected={allVisibleSelected}
        onToggleSelect={toggleTaskSelection}
        onToggleAll={toggleAllVisible}
        bulkBusy={bulkUpdating}
        bulkMessage={bulkMessage}
        currentStoryId={inheritedStoryId}
        onBulkAction={runBulkUpdate}
        onClearSelection={clearSelection}
        hasTasks={activeTasks.length > 0}
        onClearFilters={clearFilters}
        todayKey={todayKey}
        formatSettings={formatSettings}
      />
    );
  };

  return (
    <div className="page workspace" aria-busy={loading || undefined}>
      <ProjectHeader
        userId={userId}
        project={project}
        members={members}
        stories={stories}
        tab={tab}
        onTabChange={onTabChange}
        canEdit={canEdit}
        onNewTask={() => openComposer({})}
        onNewStory={() => openComposer({}, "story")}
        onUpdateProject={onUpdateProject}
        onDeleteProject={onDeleteProject}
        onBack={onBack}
      />

      {showFilters ? (
        <div className="workspace-toolbar">
          <TaskFilterBar
            search={searchTerm}
            onSearch={setSearchTerm}
            filters={filters}
            group={tab === "list" ? { value: group, options: GROUP_OPTIONS, onChange: setGroup } : undefined}
            sort={tab === "list" ? { value: sort, options: SORT_OPTIONS, onChange: setSort } : undefined}
            onClear={clearFilters}
            activeCount={activeFilterCount}
          />
        </div>
      ) : null}

      <div
        className={cx(
          "page-body",
          "workspace-content",
          tab === "board" ? "is-board" : "is-narrow"
        )}
      >
        {mutationError ? (
          <div className="page-notice">
            <InlineNotice tone="error" onDismiss={() => setMutationError("")}>
              {mutationError}
            </InlineNotice>
          </div>
        ) : null}

        {loadError && !loadFailedEmpty ? (
          <div className="page-notice">
            <InlineNotice
              tone="error"
              action={
                <Button size="sm" onClick={loadWorkspace}>
                  Try again
                </Button>
              }
            >
              {loadError}
            </InlineNotice>
          </div>
        ) : null}

        {renderTab()}
      </div>

      {selectedTask ? (
        <TaskDetailPanel
          key={selectedTask.id}
          task={selectedTask}
          userId={userId}
          project={project}
          projectMembers={members}
          projectStories={stories}
          projectColumns={columns}
          projects={editableProjects}
          readOnly={!canEdit}
          onUpdate={canEdit ? (patch) => handleUpdate(selectedTask.id, patch) : undefined}
          onToggleComplete={canEdit ? () => handleQuickUpdate(selectedTask.id, {
            completed: !isTaskComplete(selectedTask),
            status: isTaskComplete(selectedTask) ? "todo" : "completed",
          }) : undefined}
          onArchive={canEdit ? (options) => handleArchive(selectedTask.id, options) : undefined}
          onDelete={canEdit ? () => handleDelete(selectedTask.id) : undefined}
          onSetAssignee={
            canEdit ? (assigneeId) => handleAssigneeChange(selectedTask.id, assigneeId) : undefined
          }
          onClose={closeSelectedItem}
          returnFocusElement={openTriggerRef.current}
          relatedTasks={relatedTasks}
          onOpenRelatedTask={openStoryTask}
          onCreateRelatedTask={
            canEdit && isStorySelected
              ? (title) => createWorkspaceTask({ title, storyId: selectedTask.id })
              : undefined
          }
          onBulkUpdateRelatedTasks={
            canEdit && isStorySelected
              ? (taskIds, action) => handleBulkStoryTaskUpdate(taskIds, action, selectedTask.id)
              : undefined
          }
          archiveLinkedTaskCount={
            isStorySelected
              ? tasks.filter(
                  (task) => task.workType !== "story" && task.storyId === selectedTask.id
                ).length
              : 0
          }
          onAttachmentCountChange={updateAttachmentCount}
          browserNotificationsEnabled={browserNotificationsEnabled}
          defaultReminderMinutes={defaultReminderMinutes}
          formatSettings={formatSettings}
          todayKey={todayKey}
        />
      ) : null}

      <TaskComposerDialog
        open={Boolean(composer)}
        workType={composer?.workType || "task"}
        initialValues={composer?.initialValues || {}}
        onClose={() => setComposer(null)}
        onSubmit={handleComposerSubmit}
        userId={userId}
        projects={editableProjects}
        lockProject
        projectContext={{ members, stories }}
        formatSettings={formatSettings}
        browserNotificationsEnabled={browserNotificationsEnabled}
        defaultReminderMinutes={defaultReminderMinutes}
      />
    </div>
  );
}
