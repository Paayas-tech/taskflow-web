import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectBoard from "./ProjectBoard";
import ProjectMembersModal from "./ProjectMembersModal";
import ProjectTaskQuickCreate from "./ProjectTaskQuickCreate";
import TaskEditModal from "./TaskEditModal";
import TaskForm from "./TaskForm";
import TaskRow from "./TaskRow";
import StoryBulkActionBar from "./StoryBulkActionBar";
import AttachmentSection from "./AttachmentSection";
import { attachmentService } from "./application/attachmentService";
import {
  archiveProjectTask,
  createProjectTask,
  deleteProjectTask,
  reorderProjectTasks,
  setTaskAssignee,
  updateProjectTask,
} from "./application/projectService";
import { consumeProjectWorkspace } from "./application/projectWorkspaceLoader";
import { isArchived, isTaskComplete } from "./domain/taskDomain";
import { groupProjectTasksByColumn } from "./domain/projectBoardDomain";

const emptyTaskForm = {
  title: "", description: "", notes: "", status: "todo", priority: "medium",
  dueDate: "", endDate: "", startTime: "", endTime: "", reminder: false,
  reminderAt: "", listId: "", projectId: "", assigneeId: "",
  workType: "task", storyId: "",
};

const statusForColumn = (column) =>
  column?.category === "done"
    ? "completed"
    : column?.category === "in_progress" ? "in-progress" : "todo";

const categoryForStatus = (status) =>
  status === "completed" || status === "done"
    ? "done"
    : status === "in-progress" || status === "in_progress"
      ? "in_progress"
      : "todo";

const sortProjectTasks = (tasks, sort) => [...tasks].sort((first, second) => {
  if (sort === "due") {
    return (first.dueDate || "9999-12-31").localeCompare(
      second.dueDate || "9999-12-31"
    );
  }
  if (sort === "priority") {
    const rank = { high: 0, medium: 1, low: 2 };
    return (rank[first.priority] ?? 1) - (rank[second.priority] ?? 1);
  }
  return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
});

export default function ProjectTasksPage({
  userId, projectId, project, projects, projectsLoading, projectsError,
  onRetryProjects, lists, onBack, onOpenOverview, browserNotificationsEnabled,
  formatSettings, refreshToken = 0, openItemRequest = null, onItemOpened,
  showEmbeddedTaskViews = false, requestedView = "board", onViewChange,
}) {
  const [view, setView] = useState("board");
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [attachmentCounts, setAttachmentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [pendingIds, setPendingIds] = useState(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [storyReturnId, setStoryReturnId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [storyFilter, setStoryFilter] = useState("all");
  const [filteredSelectedTaskIds, setFilteredSelectedTaskIds] = useState(() => new Set());
  const [filteredBulkUpdating, setFilteredBulkUpdating] = useState(false);
  const [filteredBulkMessage, setFilteredBulkMessage] = useState(null);
  const [storyActionId, setStoryActionId] = useState(null);
  const [sort, setSort] = useState("created");
  const [quickCreateTarget, setQuickCreateTarget] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createValues, setCreateValues] = useState({ ...emptyTaskForm, projectId });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const createSubmissionRef = useRef(false);
  const createDialogRef = useRef(null);
  const createTriggerRef = useRef(null);
  const creatingRef = useRef(false);
  const editTriggerRef = useRef(null);
  const membersButtonRef = useRef(null);
  const workspaceRequestRef = useRef(0);
  const loadedProjectIdRef = useRef(null);

  useEffect(() => {
    if (requestedView === "board" || requestedView === "list") {
      setView(requestedView);
    }
  }, [requestedView]);

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
      } = await consumeProjectWorkspace(userId, projectId);
      if (requestId !== workspaceRequestRef.current) return;
      setTasks(projectTasks);
      setColumns(projectColumns);
      setMembers(projectMembers);
      void attachmentService.getTaskCounts(projectId).then(setAttachmentCounts);
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
      setLoadError(
        "We couldn't load this project workspace. Check your connection and try again."
      );
    } finally {
      if (requestId === workspaceRequestRef.current && initialLoad) setLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    setView("board");
    setSelectedTaskId(null);
    setStoryReturnId(null);
    setSearchTerm("");
    setStatusFilter("all");
    setAssigneeFilter("all");
    setStoryFilter("all");
    setQuickCreateTarget(null);
    setCreateValues({ ...emptyTaskForm, projectId });
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
    const withAttachmentCount = (task) => attachmentCounts[task.id] > 0
      ? { ...task, attachmentCount: attachmentCounts[task.id] }
      : task;
    return tasks
      .filter((task) => !isArchived(task) && task.workType !== "story")
      .map((task) => storyNames.has(task.storyId)
        ? withAttachmentCount({ ...task, storyName: storyNames.get(task.storyId) })
        : task.storyId
          ? withAttachmentCount({ ...task, orphanedStoryId: task.storyId, storyId: null, storyName: "" })
          : withAttachmentCount(task));
  }, [attachmentCounts, stories, tasks]);

  const updateAttachmentCount = useCallback((taskId, count) => {
    setAttachmentCounts((current) => ({ ...current, [taskId]: count }));
  }, []);

  useEffect(() => {
    if (!openItemRequest || openItemRequest.projectId !== projectId) return;
    const requestedItem = tasks.find((task) => task.id === openItemRequest.itemId && !isArchived(task));
    if (requestedItem) {
      setSelectedTaskId(requestedItem.id);
      setStoryReturnId(null);
    }
  }, [openItemRequest, projectId, tasks]);
  const boardTasks = useMemo(() => activeTasks.filter((task) => {
    if (storyFilter === "none") return !task.storyId;
    return storyFilter === "all" || task.storyId === storyFilter;
  }), [activeTasks, storyFilter]);
  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matches = activeTasks.filter((task) => {
      if (statusFilter === "active" && isTaskComplete(task)) return false;
      if (statusFilter === "completed" && !isTaskComplete(task)) return false;
      if (assigneeFilter === "unassigned" && task.assigneeId) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "unassigned" && task.assigneeId !== assigneeFilter) return false;
      if (storyFilter === "none" && task.storyId) return false;
      if (storyFilter !== "all" && storyFilter !== "none" && task.storyId !== storyFilter) return false;
      if (!query) return true;
      return [task.title, task.description, task.notes].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    });
    return sortProjectTasks(matches, sort);
  }, [activeTasks, assigneeFilter, searchTerm, sort, statusFilter, storyFilter]);
  const listTasksByColumn = useMemo(
    () => groupProjectTasksByColumn(columns, filteredTasks, { preserveTaskOrder: true }),
    [columns, filteredTasks]
  );
  const listSections = useMemo(() => {
    if (storyFilter !== "all") {
      return columns.map((column) => ({
        id: column.id,
        title: column.name,
        tasks: listTasksByColumn.get(column.id) || [],
      }));
    }

    const tasksByStory = new Map(stories.map((story) => [story.id, []]));
    const tasksWithoutStory = [];
    filteredTasks.forEach((task) => {
      const storyTasks = tasksByStory.get(task.storyId);
      if (storyTasks) storyTasks.push(task);
      else tasksWithoutStory.push(task);
    });

    return [
      ...stories.map((story) => ({
        id: `story-${story.id}`,
        title: story.title,
        tasks: tasksByStory.get(story.id) || [],
      })),
      { id: "story-none", title: "No Story", tasks: tasksWithoutStory },
    ].filter((section) => section.tasks.length > 0);
  }, [columns, filteredTasks, listTasksByColumn, stories, storyFilter]);
  const selectedTask = [...activeTasks, ...stories].find((task) => task.id === selectedTaskId);
  const canEditTasks = ["owner", "editor"].includes(project?.viewerRole);
  const storyFilteredBulkEnabled = canEditTasks && storyFilter !== "all" && storyFilter !== "none";
  const visibleBulkTasks = view === "board" ? boardTasks : filteredTasks;
  const allVisibleBulkTasksSelected = visibleBulkTasks.length > 0
    && visibleBulkTasks.every((task) => filteredSelectedTaskIds.has(task.id));
  const editableProjects = projects.filter((candidate) =>
    ["owner", "editor"].includes(candidate.viewerRole)
  );

  useEffect(() => {
    setFilteredSelectedTaskIds(new Set());
    setFilteredBulkMessage(null);
  }, [projectId, storyFilter, view]);

  useEffect(() => {
    const visibleIds = new Set(visibleBulkTasks.map((task) => task.id));
    setFilteredSelectedTaskIds((current) => {
      const next = new Set([...current].filter((taskId) => visibleIds.has(taskId)));
      return next.size === current.size ? current : next;
    });
  }, [visibleBulkTasks]);

  const openCreate = (column = null, schedule = {}) => {
    if (!canEditTasks) return;
    createTriggerRef.current = document.activeElement;
    setCreateError("");
    setCreateValues({
      ...emptyTaskForm, ...schedule, projectId, status: statusForColumn(column),
    });
    setShowCreate(true);
  };
  const openStoryCreate = () => openCreate(null, { workType: "story", storyId: "" });
  const startQuickCreate = (column = null) => {
    if (!canEditTasks) return;
    const defaultColumn =
      column || columns.find((candidate) => candidate.category === "todo") || columns[0];
    setQuickCreateTarget(view === "list" ? "list" : defaultColumn?.id || null);
  };
  const cancelQuickCreate = () => setQuickCreateTarget(null);
  const openQuickCreateDetails = (column = null, title = "") => {
    setQuickCreateTarget(null);
    openCreate(column, title ? { title } : {});
  };
  const closeCreate = () => {
    if (creating) return;
    setShowCreate(false);
    setCreateError("");
  };

  useEffect(() => {
    creatingRef.current = creating;
  }, [creating]);

  useEffect(() => {
    if (!showCreate) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !creatingRef.current) {
        event.preventDefault();
        setShowCreate(false);
        setCreateError("");
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = createDialogRef.current?.querySelectorAll(
        'input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)'
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => createTriggerRef.current?.focus({ preventScroll: true }));
    };
  }, [showCreate]);
  const handleCreateChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCreateValues((previous) => ({
      ...previous, [name]: type === "checkbox" ? checked : value,
    }));
  };
  const handleCreate = async (event) => {
    event.preventDefault();
    if (createSubmissionRef.current) return;
    if (!createValues.title.trim()) {
      setCreateError(createValues.workType === "story"
        ? "Enter a Story name before saving."
        : "Enter a task title before saving.");
      return;
    }
    createSubmissionRef.current = true;
    setCreating(true);
    setCreateError("");
    let createdTask = null;
    try {
      const { assigneeId, ...taskValues } = createValues;
      createdTask = await createProjectTask(userId, projectId, {
        ...taskValues, projectId, listId: taskValues.listId || null,
      });
      if (assigneeId) {
        await setTaskAssignee(userId, projectId, createdTask.id, assigneeId);
      }
      setShowCreate(false);
      await loadWorkspace();
    } catch (error) {
      console.error("Error creating project task:", error);
      if (createdTask) {
        setShowCreate(false);
        await loadWorkspace();
        setMutationError(
          `“${createValues.title.trim()}” was created, but its assignee could not be saved. Open the task to assign it.`
        );
      } else {
        setCreateError(`We couldn't create this ${createValues.workType === "story" ? "Story" : "task"}. Check your connection and try again.`);
      }
    } finally {
      createSubmissionRef.current = false;
      setCreating(false);
    }
  };

  const handleQuickCreate = async (title, column = null) => {
    if (!canEditTasks) {
      throw new Error("This project is read-only for your account.");
    }
    const normalizedTitle = String(title || "").trim();
    if (!normalizedTitle) throw new Error("Task title cannot be empty.");
    await createProjectTask(userId, projectId, {
      ...emptyTaskForm,
      title: normalizedTitle,
      projectId,
      listId: null,
      status: statusForColumn(column),
      workType: "task",
      storyId: storyFilter !== "all" && storyFilter !== "none" ? storyFilter : "",
    });
    await loadWorkspace();
  };

  const handleCreateStoryTask = async (story, title) => {
    await createProjectTask(userId, projectId, {
      ...emptyTaskForm,
      title,
      projectId,
      workType: "task",
      storyId: story.id,
    });
    await loadWorkspace();
  };

  const handleUpdate = async (taskId, data) => {
    if (!canEditTasks) throw new Error("This project is read-only for your account.");
    await updateProjectTask(userId, projectId, taskId, data);
    await loadWorkspace();
  };
  const handleQuickUpdate = async (taskId, data) => {
    if (!canEditTasks) throw new Error("This project is read-only for your account.");
    const previous = tasks;
    setPendingIds((ids) => new Set(ids).add(taskId));
    const statusColumn = Object.prototype.hasOwnProperty.call(data, "status")
      ? columns.find((column) => column.category === categoryForStatus(data.status))
      : null;
    setTasks((current) => current.map((task) =>
      task.id === taskId
        ? { ...task, ...data, ...(statusColumn ? { columnId: statusColumn.id } : {}) }
        : task
    ));
    try {
      await updateProjectTask(userId, projectId, taskId, data);
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
        completed, status: completed ? "completed" : "todo",
      });
    } catch (error) {
      console.error("Error updating project task completion:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”.`
      );
    }
  };
  const handleDelete = async (taskId) => {
    if (!canEditTasks) throw new Error("This project is read-only for your account.");
    const deletingTask = tasks.find((task) => task.id === taskId);
    await attachmentService.removeAll({
      projectId,
      entityType: deletingTask?.workType === "story" ? "story" : "task",
      entityId: taskId,
    });
    await deleteProjectTask(userId, projectId, taskId);
    await loadWorkspace();
  };
  const handleArchive = async (taskId, options = {}) => {
    if (!canEditTasks) throw new Error("This project is read-only for your account.");
    const story = tasks.find((task) => task.id === taskId && task.workType === "story");
    const linkedTasks = story
      ? tasks.filter((task) => task.workType !== "story" && task.storyId === taskId)
      : [];
    if (linkedTasks.length > 0) {
      if (options.moveLinkedTasksToUncategorized !== true) {
        throw new Error("Move linked tasks to No Story before archiving this Story.");
      }
      const results = await Promise.allSettled(linkedTasks.map((linkedTask) =>
        updateProjectTask(userId, projectId, linkedTask.id, { storyId: null })
      ));
      if (results.some((result) => result.status === "rejected")) {
        await loadWorkspace();
        throw new Error("Some linked tasks could not be moved to No Story. The Story was not archived.");
      }
    }
    await archiveProjectTask(userId, projectId, taskId);
    await loadWorkspace();
  };
  const handleRestoreStory = async (storyId) => {
    if (!canEditTasks || storyActionId) return;
    setStoryActionId(storyId);
    setMutationError("");
    try {
      await updateProjectTask(userId, projectId, storyId, { archivedAt: null });
      await loadWorkspace();
    } catch (error) {
      console.error("Error restoring project Story:", error);
      setMutationError("We couldn't restore that Story. Check your connection and try again.");
    } finally {
      setStoryActionId(null);
    }
  };
  const handleMoveTasks = async (placements) => {
    if (!canEditTasks) return;
    const previous = tasks;
    const placementMap = new Map(placements.map((item) => [item.taskId, item]));
    const columnsById = new Map(columns.map((column) => [column.id, column]));
    setTasks((current) => current.map((task) => {
      const placement = placementMap.get(task.id);
      if (!placement) return task;
      const status = statusForColumn(columnsById.get(placement.columnId));
      return {
        ...task, columnId: placement.columnId, position: placement.position,
        status, completed: status === "completed",
      };
    }));
    try {
      await reorderProjectTasks(userId, projectId, placements);
    } catch (error) {
      console.error("Error moving project task:", error);
      setTasks(previous);
      setMutationError("We couldn't save that task move. The board has been restored.");
    }
  };
  const openEditor = (task, triggerElement) => {
    editTriggerRef.current = triggerElement || null;
    setStoryReturnId(null);
    setSelectedTaskId(task.id);
    onItemOpened?.(task);
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

  const handleAssigneeChange = async (taskId, assigneeId) => {
    if (!canEditTasks) throw new Error("This project is read-only for your account.");
    await setTaskAssignee(userId, projectId, taskId, assigneeId);
    const assigneeName = members.find((member) => member.userId === assigneeId)?.displayName || "";
    setTasks((current) => current.map((task) =>
      task.id === taskId ? { ...task, assigneeId: assigneeId || null, assigneeName } : task
    ));
  };

  const handleBulkStoryTaskUpdate = async (taskIds, action, sourceStoryId = null) => {
    if (!canEditTasks) throw new Error("This project is read-only for your account.");
    const currentStoryId = sourceStoryId
      || (selectedTask?.workType === "story" ? selectedTask.id : null);
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
        throw new Error("Choose a Story from this project.");
      }
      patch = { storyId: destinationStoryId };
    } else if (action.type !== "assignee") {
      throw new Error("Choose a valid bulk action.");
    }

    const assigneeId = action.type === "assignee" ? action.value || null : undefined;
    if (assigneeId && !members.some((member) => member.userId === assigneeId)) {
      throw new Error("Choose a member of this project.");
    }
    const assigneeName = members.find((member) => member.userId === assigneeId)?.displayName || "";
    const statusColumn = action.type === "status"
      ? columns.find((column) => column.category === categoryForStatus(action.value))
      : null;
    const previous = tasks;

    setPendingIds((ids) => new Set([...ids, ...selectedIds]));
    setTasks((current) => current.map((task) => {
      if (!selectedIds.includes(task.id)) return task;
      if (action.type === "assignee") return { ...task, assigneeId, assigneeName };
      return { ...task, ...patch, ...(statusColumn ? { columnId: statusColumn.id } : {}) };
    }));

    const results = await Promise.allSettled(selectedIds.map((taskId) =>
      action.type === "assignee"
        ? setTaskAssignee(userId, projectId, taskId, assigneeId)
        : updateProjectTask(userId, projectId, taskId, patch)
    ));
    const failedIds = selectedIds.filter((_, index) => results[index].status === "rejected");
    if (failedIds.length > 0) {
      setTasks(previous);
    }
    await loadWorkspace();
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

  const toggleFilteredTaskSelection = (taskId) => {
    if (!storyFilteredBulkEnabled) return;
    setFilteredBulkMessage(null);
    setFilteredSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAllVisibleFilteredTasks = () => {
    if (!storyFilteredBulkEnabled) return;
    setFilteredBulkMessage(null);
    setFilteredSelectedTaskIds(allVisibleBulkTasksSelected
      ? new Set()
      : new Set(visibleBulkTasks.map((task) => task.id))
    );
  };

  const runFilteredBulkUpdate = async (type, value) => {
    if (!storyFilteredBulkEnabled || filteredBulkUpdating || filteredSelectedTaskIds.size === 0) return;
    setFilteredBulkUpdating(true);
    setFilteredBulkMessage(null);
    try {
      const result = await handleBulkStoryTaskUpdate(
        [...filteredSelectedTaskIds],
        { type, value },
        storyFilter
      );
      const updated = result.updated || 0;
      const failed = result.failed || 0;
      setFilteredSelectedTaskIds(new Set(result.failedIds || []));
      setFilteredBulkMessage({
        error: failed > 0,
        text: failed > 0
          ? `${updated} of ${updated + failed} tasks updated; ${failed} failed due to permissions or another error.`
          : `${updated} ${updated === 1 ? "task" : "tasks"} updated.`,
      });
    } catch (error) {
      setFilteredBulkMessage({ error: true, text: error.message || "We couldn't update the selected tasks." });
    } finally {
      setFilteredBulkUpdating(false);
    }
  };

  if (projectsLoading && !project) {
    return <div className="project-task-state" role="status"><div className="state-spinner" /><h2>Loading project...</h2></div>;
  }
  if (projectsError) {
    return <div className="project-task-state error-state" role="alert"><h2>Project unavailable</h2><p>{projectsError}</p><button className="primary-btn" type="button" onClick={onRetryProjects}>Try again</button></div>;
  }
  if (!project) {
    return <div className="project-task-state"><h2>Project not found</h2><p>This project doesn’t exist or isn’t available to your account.</p><button className="primary-btn" type="button" onClick={onBack}>Back to Projects</button></div>;
  }

  return (
    <section className={`project-tasks-page${selectedTask ? " has-task-panel" : ""}`} aria-labelledby="project-task-title" aria-busy={loading}>
      <div className="project-tasks-workspace-main">
      <button className="project-back-button" type="button" onClick={onBack}>← Projects</button>
      <header className="project-task-hero">
        <div className="project-task-identity">
          <span className="project-task-color" style={{ backgroundColor: project.color || "#6657c8" }} />
          <div>
            <h2 id="project-task-title">{project.name}</h2>
            <p className="project-access">Your access · <span>{project.viewerRole || "member"}</span>{!canEditTasks ? " · Read only" : ""}</p>
            {project.description && <p className="project-description-compact">{project.description}</p>}
            {project.description?.length > 160 && <details className="project-about"><summary>About</summary><p>{project.description}</p></details>}
          </div>
        </div>
        <div className="project-card-actions">
          <button className="ghost-btn compact-btn" type="button" onClick={onOpenOverview}>Overview</button>
          <button ref={membersButtonRef} className="ghost-btn compact-btn" type="button" onClick={() => setShowMembers(true)}>Members</button>
        </div>
      </header>

      <div className="project-resources-grid">
        <AttachmentSection
          projectId={projectId}
          entityType="project"
          entityId={projectId}
          userId={userId}
          uploaderName={members.find((member) => member.userId === userId)?.displayName || "TaskFlow user"}
          canManage={canEditTasks}
          compact
        />

        <section className="project-stories" aria-labelledby="project-stories-title">
        <header>
          <div>
            <h3 id="project-stories-title">Stories <span className="project-story-count" aria-label={`${stories.length} Stories`}>{stories.length}</span></h3>
            <p className="project-stories-help">Group related tasks.</p>
          </div>
          <div className="project-stories-actions">
            {canEditTasks && <button className="primary-btn compact-btn" type="button" onClick={openStoryCreate}>+ New Story</button>}
          </div>
        </header>
        <div className="project-story-list">
          {stories.map((story) => {
            const storyTasks = activeTasks.filter((task) => task.storyId === story.id);
            const completedCount = storyTasks.filter(isTaskComplete).length;
            return (
              <button key={story.id} type="button" title="Open Story and view its tasks" onClick={(event) => openEditor(story, event.currentTarget)}>
                <span className="project-story-icon" aria-hidden="true">▱</span>
                <span><strong>{story.title}</strong><small>{completedCount}/{storyTasks.length} tasks completed</small></span>
                <span aria-hidden="true">→</span>
              </button>
            );
          })}
          {stories.length === 0 && (
            <div className="project-story-empty">
              <span>
                <strong>No Stories yet</strong>
                <small>{canEditTasks ? "Create one to group tasks." : "Nothing to show."}</small>
              </span>
            </div>
          )}
        </div>
        {archivedStories.length > 0 && (
          <details className="project-archived-stories">
            <summary>Archived Stories <span>{archivedStories.length}</span></summary>
            <div>
              {archivedStories.map((story) => (
                <div key={story.id}>
                  <span className="project-story-icon" aria-hidden="true">▱</span>
                  <strong>{story.title}</strong>
                  {canEditTasks && <button className="ghost-btn compact-btn" type="button" onClick={() => void handleRestoreStory(story.id)} disabled={Boolean(storyActionId)}>{storyActionId === story.id ? "Restoring..." : "Restore"}</button>}
                </div>
              ))}
            </div>
          </details>
        )}
        </section>
      </div>

      {showEmbeddedTaskViews && <>
      <header className="project-workspace-heading">
        <div>
          <h3>Tasks</h3>
          <p>Plan and track project work.</p>
        </div>
        <span>{activeTasks.filter((task) => task.workType !== "story").length} tasks</span>
      </header>
      <div className="project-view-toolbar">
        <div className="project-view-primary-controls">
          <div className="project-view-switcher" role="group" aria-label="Project view">
            {["board", "list"].map((option) => (
              <button
                key={option}
                type="button"
                className={view === option ? "active" : ""}
                aria-pressed={view === option}
                onClick={() => {
                  setView(option);
                  onViewChange?.(option);
                  setQuickCreateTarget(null);
                }}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
          <label className="project-story-filter"><span>Story</span><select aria-label="Filter project tasks by story" value={storyFilter} onChange={(event) => setStoryFilter(event.target.value)}><option value="all">All stories</option><option value="none">No Story</option>{stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}</select></label>
        </div>
        {view === "list" && (<>
          <div className="project-list-controls">
            <input aria-label="Search project tasks" type="search" placeholder="Search tasks" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            <select aria-label="Filter project task status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="completed">Completed</option></select>
            <select aria-label="Filter project tasks by assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="all">All assignees</option><option value="unassigned">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName || "TaskFlow user"}</option>)}</select>
            <select aria-label="Sort project tasks" value={sort} onChange={(event) => setSort(event.target.value)}><option value="created">Newest</option><option value="due">Due date</option><option value="priority">Priority</option></select>
          </div>
        </>)}
      </div>

      {storyFilteredBulkEnabled && visibleBulkTasks.length > 0 && (
        <div className="project-filtered-bulk-tools">
          <label className="story-select-all">
            <input
              type="checkbox"
              checked={allVisibleBulkTasksSelected}
              aria-checked={filteredSelectedTaskIds.size > 0 && !allVisibleBulkTasksSelected ? "mixed" : allVisibleBulkTasksSelected}
              onChange={toggleAllVisibleFilteredTasks}
              disabled={filteredBulkUpdating}
            />
            <span>Select all visible</span>
          </label>
          <StoryBulkActionBar
            selectedCount={filteredSelectedTaskIds.size}
            projectMembers={members}
            projectStories={stories}
            currentStoryId={storyFilter}
            busy={filteredBulkUpdating}
            onAction={runFilteredBulkUpdate}
            onClear={() => { setFilteredSelectedTaskIds(new Set()); setFilteredBulkMessage(null); }}
          />
        </div>
      )}
      {filteredBulkMessage && <p className={filteredBulkMessage.error ? "form-error story-bulk-message project-filtered-bulk-message" : "form-success story-bulk-message project-filtered-bulk-message"} role={filteredBulkMessage.error ? "alert" : "status"}>{filteredBulkMessage.text}</p>}

      {mutationError && <div className="inline-error" role="alert"><p>{mutationError}</p><button className="ghost-btn compact-btn" type="button" onClick={() => setMutationError("")}>Dismiss</button></div>}
      {loadError && activeTasks.length > 0 && <div className="inline-error" role="alert"><p>{loadError}</p><button className="ghost-btn compact-btn" type="button" onClick={loadWorkspace}>Try again</button></div>}

      {loadError && activeTasks.length === 0 ? (
        <div className="project-task-state error-state" role="alert"><h3>Project tasks unavailable</h3><p>{loadError}</p><button className="ghost-btn" type="button" onClick={loadWorkspace}>Try again</button></div>
      ) : view === "board" ? (
        <ProjectBoard
          columns={columns}
          tasks={boardTasks}
          onMoveTasks={handleMoveTasks}
          onEditTask={openEditor}
          onStartQuickCreate={startQuickCreate}
          onQuickCreate={handleQuickCreate}
          onCancelQuickCreate={cancelQuickCreate}
          onAddTaskDetails={openQuickCreateDetails}
          quickCreateColumnId={quickCreateTarget}
          readOnly={!canEditTasks}
          formatSettings={formatSettings}
          bulkSelectionEnabled={storyFilteredBulkEnabled}
          selectedTaskIds={filteredSelectedTaskIds}
          onToggleTaskSelection={toggleFilteredTaskSelection}
        />
      ) : (
        <div className="tasks-page-list project-task-list">
          {quickCreateTarget === "list" && canEditTasks && (
            <ProjectTaskQuickCreate
              contextLabel={project.name}
              onCreate={(title) => handleQuickCreate(title)}
              onCancel={cancelQuickCreate}
              onAddDetails={(title) => openQuickCreateDetails(null, title)}
            />
          )}
          {listSections.map((section) => {
            const sectionTitleId = `project-list-section-${section.id}`;
            return (
              <section className="project-task-list-section" key={section.id} aria-labelledby={sectionTitleId}>
                <header className="project-task-list-section-header">
                  <h3 id={sectionTitleId}>{section.title}</h3>
                  <span aria-label={`${section.tasks.length} tasks`}>{section.tasks.length}</span>
                </header>
                <div className="project-task-list-section-rows">
                  {section.tasks.map((task) => <TaskRow key={task.id} task={task} lists={lists} projects={projects} completionBusy={pendingIds.has(task.id)} selected={selectedTaskId === task.id} onToggleCompletion={canEditTasks ? handleCompletion : undefined} onEdit={openEditor} onArchive={canEditTasks ? () => handleArchive(task.id) : undefined} formatSettings={formatSettings} bulkSelectionEnabled={storyFilteredBulkEnabled} bulkSelected={filteredSelectedTaskIds.has(task.id)} onToggleBulkSelection={toggleFilteredTaskSelection} />)}
                  {section.tasks.length === 0 && <p className="project-task-list-section-empty">No tasks</p>}
                </div>
              </section>
            );
          })}
          {filteredTasks.length === 0 && quickCreateTarget !== "list" && (
            <div className="project-task-list-empty">
              <p>{activeTasks.length === 0 ? "No tasks in this project yet." : "No tasks match these filters."}</p>
              {canEditTasks ? (
                <button className="ghost-btn compact-btn" type="button" onClick={() => startQuickCreate()}>+ Add task</button>
              ) : activeTasks.length > 0 ? (
                <button className="ghost-btn compact-btn" type="button" onClick={() => { setSearchTerm(""); setStatusFilter("all"); setAssigneeFilter("all"); }}>Clear filters</button>
              ) : null}
            </div>
          )}
          {canEditTasks && quickCreateTarget !== "list" && filteredTasks.length > 0 && (
            <button className="project-list-add-task" type="button" onClick={() => startQuickCreate()}>+ Add task</button>
          )}
        </div>
      )}

      </>}

      {showCreate && (
        <div className="task-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeCreate()}>
          <section ref={createDialogRef} className="task-modal" role="dialog" aria-modal="true" aria-labelledby="project-create-task-title" aria-busy={creating}>
            <div className="task-modal-header"><div><p className="card-label">{createValues.workType === "story" ? "Project story" : "Project task"}</p><h2 id="project-create-task-title">Create {createValues.workType === "story" ? "Story" : "Task"}</h2><p>Add to {project.name}.</p></div><button className="ghost-btn compact-btn" type="button" onClick={closeCreate} disabled={creating}>Close</button></div>
            <TaskForm values={createValues} onChange={handleCreateChange} onSubmit={handleCreate} onCancel={closeCreate} submitLabel={createValues.workType === "story" ? "Create Story" : "Create Task"} busyLabel="Creating..." busy={creating} error={createError} lists={lists} projects={editableProjects} projectMembers={members} projectStories={stories} projectsLoading={projectsLoading} projectsError={projectsError} onRetryProjects={onRetryProjects} browserNotificationsEnabled={browserNotificationsEnabled} />
          </section>
        </div>
      )}

      </div>

      {selectedTask && <TaskEditModal key={selectedTask.id} task={selectedTask} lists={lists} projects={editableProjects} projectsLoading={projectsLoading} projectsError={projectsError} onRetryProjects={onRetryProjects} browserNotificationsEnabled={browserNotificationsEnabled} onUpdateTask={canEditTasks ? handleUpdate : undefined} onDeleteTask={canEditTasks ? handleDelete : undefined} onArchiveTask={canEditTasks ? handleArchive : undefined} onClose={closeSelectedItem} returnFocusElement={editTriggerRef.current} userId={userId} projectId={projectId} projectMembers={members} projectStories={stories} projectColumns={columns} canAssign={canEditTasks} onAssigneeChange={canEditTasks ? handleAssigneeChange : undefined} readOnly={!canEditTasks} presentation="panel" relatedTasks={selectedTask.workType === "story" ? activeTasks.filter((task) => task.storyId === selectedTask.id) : []} archiveLinkedTaskCount={selectedTask.workType === "story" ? tasks.filter((task) => task.workType !== "story" && task.storyId === selectedTask.id).length : 0} onOpenRelatedTask={openStoryTask} onCreateRelatedTask={canEditTasks ? handleCreateStoryTask : undefined} onBulkUpdateRelatedTasks={canEditTasks && selectedTask.workType === "story" ? (taskIds, action) => handleBulkStoryTaskUpdate(taskIds, action, selectedTask.id) : undefined} onAttachmentCountChange={updateAttachmentCount} />}
      {showMembers && <ProjectMembersModal userId={userId} project={project} onClose={() => setShowMembers(false)} returnFocusElement={membersButtonRef.current} />}
    </section>
  );
}
