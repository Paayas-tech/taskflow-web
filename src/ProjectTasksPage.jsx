import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CalendarPage from "./CalendarPage";
import ActivityFeed from "./ActivityFeed";
import ProjectBoard from "./ProjectBoard";
import ProjectMembersModal from "./ProjectMembersModal";
import TaskEditModal from "./TaskEditModal";
import TaskForm from "./TaskForm";
import TaskRow from "./TaskRow";
import {
  archiveProjectTask,
  createProjectTask,
  deleteProjectTask,
  getProjectColumns,
  getProjectMembers,
  getProjectTasks,
  reorderProjectTasks,
  setTaskAssignee,
  updateProjectTask,
} from "./application/projectService";
import { isArchived, isTaskComplete } from "./domain/taskDomain";

const emptyTaskForm = {
  title: "", description: "", notes: "", status: "todo", priority: "medium",
  dueDate: "", endDate: "", startTime: "", endTime: "", reminder: false,
  reminderAt: "", listId: "", projectId: "",
};

const statusForColumn = (column) =>
  column?.category === "done"
    ? "completed"
    : column?.category === "in_progress" ? "in-progress" : "todo";

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
  onRetryProjects, lists, onBack, browserNotificationsEnabled,
  formatSettings, weekStartsOn = 0, refreshToken = 0,
}) {
  const [view, setView] = useState("board");
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [pendingIds, setPendingIds] = useState(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sort, setSort] = useState("created");
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

  const loadWorkspace = useCallback(async () => {
    if (!userId || !projectId) return;
    const requestId = ++workspaceRequestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const [projectTasks, projectColumns, projectMembers] = await Promise.all([
        getProjectTasks(userId, projectId),
        getProjectColumns(userId, projectId),
        getProjectMembers(userId, projectId),
      ]);
      if (requestId !== workspaceRequestRef.current) return;
      setTasks(projectTasks);
      setColumns(projectColumns);
      setMembers(projectMembers);
    } catch (error) {
      if (requestId !== workspaceRequestRef.current) return;
      console.error("Error loading project workspace:", error);
      setTasks([]);
      setColumns([]);
      setMembers([]);
      setLoadError(
        "We couldn't load this project workspace. Check your connection and try again."
      );
    } finally {
      if (requestId === workspaceRequestRef.current) setLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    setView("board");
    setSelectedTaskId(null);
    setSearchTerm("");
    setStatusFilter("all");
    setAssigneeFilter("all");
    setCreateValues({ ...emptyTaskForm, projectId });
    void loadWorkspace();
    return () => {
      workspaceRequestRef.current += 1;
    };
  }, [loadWorkspace, projectId, refreshToken]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => !isArchived(task)),
    [tasks]
  );
  const completedTasks = useMemo(
    () => activeTasks.filter(isTaskComplete),
    [activeTasks]
  );
  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matches = activeTasks.filter((task) => {
      if (statusFilter === "active" && isTaskComplete(task)) return false;
      if (statusFilter === "completed" && !isTaskComplete(task)) return false;
      if (assigneeFilter === "unassigned" && task.assigneeId) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "unassigned" && task.assigneeId !== assigneeFilter) return false;
      if (!query) return true;
      return [task.title, task.description, task.notes].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    });
    return sortProjectTasks(matches, sort);
  }, [activeTasks, assigneeFilter, searchTerm, sort, statusFilter]);
  const selectedTask = activeTasks.find((task) => task.id === selectedTaskId);
  const canEditTasks = ["owner", "editor"].includes(project?.viewerRole);
  const editableProjects = projects.filter((candidate) =>
    ["owner", "editor"].includes(candidate.viewerRole)
  );

  const openCreate = (column = null, schedule = {}) => {
    if (!canEditTasks) return;
    createTriggerRef.current = document.activeElement;
    setCreateError("");
    setCreateValues({
      ...emptyTaskForm, ...schedule, projectId, status: statusForColumn(column),
    });
    setShowCreate(true);
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
      setCreateError("Enter a task title before saving.");
      return;
    }
    createSubmissionRef.current = true;
    setCreating(true);
    setCreateError("");
    try {
      await createProjectTask(userId, projectId, {
        ...createValues, projectId, listId: createValues.listId || null,
      });
      setShowCreate(false);
      await loadWorkspace();
    } catch (error) {
      console.error("Error creating project task:", error);
      setCreateError("We couldn't create this task. Check your connection and try again.");
    } finally {
      createSubmissionRef.current = false;
      setCreating(false);
    }
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
    setTasks((current) => current.map((task) =>
      task.id === taskId ? { ...task, ...data } : task
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
    await deleteProjectTask(userId, projectId, taskId);
    await loadWorkspace();
  };
  const handleArchive = async (taskId) => {
    if (!canEditTasks) throw new Error("This project is read-only for your account.");
    await archiveProjectTask(userId, projectId, taskId);
    await loadWorkspace();
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
    setSelectedTaskId(task.id);
  };

  const handleAssigneeChange = async (taskId, assigneeId) => {
    if (!canEditTasks) throw new Error("This project is read-only for your account.");
    await setTaskAssignee(userId, projectId, taskId, assigneeId);
    setTasks((current) => current.map((task) =>
      task.id === taskId ? { ...task, assigneeId: assigneeId || null } : task
    ));
  };

  if (projectsLoading) {
    return <div className="project-task-state" role="status"><div className="state-spinner" /><h2>Loading project...</h2></div>;
  }
  if (projectsError) {
    return <div className="project-task-state error-state" role="alert"><h2>Project unavailable</h2><p>{projectsError}</p><button className="primary-btn" type="button" onClick={onRetryProjects}>Try again</button></div>;
  }
  if (!project) {
    return <div className="project-task-state"><h2>Project not found</h2><p>This project doesn’t exist or isn’t available to your account.</p><button className="primary-btn" type="button" onClick={onBack}>Back to Projects</button></div>;
  }

  return (
    <section className="project-tasks-page" aria-labelledby="project-task-title">
      <button className="project-back-button" type="button" onClick={onBack}>← Projects</button>
      <header className="project-task-hero">
        <div className="project-task-identity">
          <span className="project-task-color" style={{ backgroundColor: project.color || "#6657c8" }} />
          <div><p className="card-label">Project workspace</p><h2 id="project-task-title">{project.name}</h2>{project.description && <p>{project.description}</p>}</div>
        </div>
        <div className="project-card-actions">
          <button ref={membersButtonRef} className="ghost-btn compact-btn" type="button" onClick={() => setShowMembers(true)}>Members</button>
          {canEditTasks && <button className="primary-btn" type="button" onClick={() => openCreate()}>+ New project task</button>}
        </div>
      </header>

      <div className="project-task-summary" aria-label="Project task summary">
        <div><strong>{activeTasks.length}</strong><span>Total</span></div>
        <div><strong>{activeTasks.length - completedTasks.length}</strong><span>Active</span></div>
        <div><strong>{completedTasks.length}</strong><span>Completed</span></div>
      </div>
      <p className="project-description">Your access: {project.viewerRole || "member"}{!canEditTasks ? " · Read only" : ""}</p>

      <div className="project-view-toolbar">
        <div className="project-view-switcher" role="group" aria-label="Project view">
          {["board", "list", "calendar"].map((option) => (
            <button key={option} type="button" className={view === option ? "active" : ""} aria-pressed={view === option} onClick={() => setView(option)}>{option[0].toUpperCase() + option.slice(1)}</button>
          ))}
        </div>
        {view === "list" && (
          <div className="project-list-controls">
            <input aria-label="Search project tasks" type="search" placeholder="Search tasks" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            <select aria-label="Filter project task status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="completed">Completed</option></select>
            <select aria-label="Filter project tasks by assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="all">All assignees</option><option value="unassigned">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.userId}</option>)}</select>
            <select aria-label="Sort project tasks" value={sort} onChange={(event) => setSort(event.target.value)}><option value="created">Newest</option><option value="due">Due date</option><option value="priority">Priority</option></select>
          </div>
        )}
      </div>

      {mutationError && <div className="inline-error" role="alert"><p>{mutationError}</p><button className="ghost-btn compact-btn" type="button" onClick={() => setMutationError("")}>Dismiss</button></div>}

      {loading ? (
        <div className="project-task-state" role="status"><div className="state-spinner" /><h3>Loading project tasks...</h3><p>Your project workspace is being retrieved securely.</p></div>
      ) : loadError ? (
        <div className="project-task-state error-state" role="alert"><h3>Project tasks unavailable</h3><p>{loadError}</p><button className="ghost-btn" type="button" onClick={loadWorkspace}>Try again</button></div>
      ) : activeTasks.length === 0 ? (
        <div className="project-task-state"><h3>No tasks in this project</h3><p>{canEditTasks ? "Create the first task to start planning this work." : "There are no tasks to review yet."}</p>{canEditTasks && <button className="primary-btn" type="button" onClick={() => openCreate()}>Create project task</button>}</div>
      ) : view === "board" ? (
        <ProjectBoard columns={columns} tasks={activeTasks} onMoveTasks={handleMoveTasks} onEditTask={openEditor} onCreateTask={openCreate} readOnly={!canEditTasks} />
      ) : view === "calendar" ? (
        <CalendarPage tasks={activeTasks} tasksLoading={false} tasksError="" onRetry={loadWorkspace} onUpdateTask={canEditTasks ? handleUpdate : undefined} onQuickUpdateTask={canEditTasks ? handleQuickUpdate : undefined} quickTaskPendingIds={pendingIds} onDeleteTask={canEditTasks ? handleDelete : undefined} onArchiveTask={canEditTasks ? handleArchive : undefined} onCreateTask={canEditTasks ? (schedule) => openCreate(null, typeof schedule === "string" ? { dueDate: schedule } : schedule) : undefined} lists={lists} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} onRetryProjects={onRetryProjects} browserNotificationsEnabled={browserNotificationsEnabled} formatSettings={formatSettings} weekStartsOn={weekStartsOn} />
      ) : filteredTasks.length === 0 ? (
        <div className="project-task-state"><h3>No matching project tasks</h3><p>Clear the search or choose another status.</p><button className="ghost-btn" type="button" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>Clear filters</button></div>
      ) : (
        <div className="tasks-page-list project-task-list">
          {filteredTasks.map((task) => <TaskRow key={task.id} task={task} lists={lists} projects={projects} completionBusy={pendingIds.has(task.id)} selected={selectedTaskId === task.id} onToggleCompletion={canEditTasks ? handleCompletion : undefined} onEdit={openEditor} onArchive={canEditTasks ? () => handleArchive(task.id) : undefined} formatSettings={formatSettings} />)}
        </div>
      )}

      <ActivityFeed userId={userId} projectId={projectId} compact />

      {showCreate && (
        <div className="task-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeCreate()}>
          <section ref={createDialogRef} className="task-modal" role="dialog" aria-modal="true" aria-labelledby="project-create-task-title" aria-busy={creating}>
            <div className="task-modal-header"><div><p className="card-label">Project task</p><h2 id="project-create-task-title">Create Task</h2><p>This task will be added to {project.name}.</p></div><button className="ghost-btn compact-btn" type="button" onClick={closeCreate} disabled={creating}>Close</button></div>
            <TaskForm values={createValues} onChange={handleCreateChange} onSubmit={handleCreate} onCancel={closeCreate} submitLabel="Create Task" busyLabel="Creating..." busy={creating} error={createError} lists={lists} projects={editableProjects} projectsLoading={projectsLoading} projectsError={projectsError} onRetryProjects={onRetryProjects} browserNotificationsEnabled={browserNotificationsEnabled} />
          </section>
        </div>
      )}

      {selectedTask && <TaskEditModal key={selectedTask.id} task={selectedTask} lists={lists} projects={editableProjects} projectsLoading={projectsLoading} projectsError={projectsError} onRetryProjects={onRetryProjects} browserNotificationsEnabled={browserNotificationsEnabled} onUpdateTask={canEditTasks ? handleUpdate : undefined} onDeleteTask={canEditTasks ? handleDelete : undefined} onArchiveTask={canEditTasks ? handleArchive : undefined} onClose={() => setSelectedTaskId(null)} returnFocusElement={editTriggerRef.current} userId={userId} projectId={projectId} projectMembers={members} canAssign={canEditTasks} onAssigneeChange={canEditTasks ? handleAssigneeChange : undefined} readOnly={!canEditTasks} />}
      {showMembers && <ProjectMembersModal userId={userId} project={project} onClose={() => setShowMembers(false)} returnFocusElement={membersButtonRef.current} />}
    </section>
  );
}
