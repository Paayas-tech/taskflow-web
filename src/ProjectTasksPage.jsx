import { useEffect, useMemo, useRef, useState } from "react";
import TaskEditModal from "./TaskEditModal";
import TaskRow from "./TaskRow";
import ProjectMembersSection from "./ProjectMembersSection";
import {
  filterTasksByProject,
  isTaskComplete,
} from "./domain/taskDomain";

const projectStatusLabels = {
  active: "Active project",
  completed: "Completed project",
  archived: "Archived project",
};

export default function ProjectTasksPage({
  projectId,
  project,
  projects,
  projectsLoading,
  projectsError,
  onRetryProjects,
  tasks,
  tasksLoading,
  tasksError,
  onRetryTasks,
  onUpdateTask,
  onQuickUpdateTask,
  quickTaskPendingIds,
  onDeleteTask,
  onArchiveTask,
  lists,
  onBack,
  onCreateTask,
  ownerId,
  ownerEmail,
  browserNotificationsEnabled,
  formatSettings,
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const editTriggerRef = useRef(null);
  const projectTasks = useMemo(
    () => filterTasksByProject(tasks, projectId),
    [projectId, tasks]
  );
  const activeTasks = useMemo(
    () => projectTasks.filter((task) => !isTaskComplete(task)),
    [projectTasks]
  );
  const completedTasks = useMemo(
    () => projectTasks.filter(isTaskComplete),
    [projectTasks]
  );
  const filteredTasks =
    statusFilter === "active"
      ? activeTasks
      : statusFilter === "completed"
        ? completedTasks
        : projectTasks;
  const selectedTask = projectTasks.find(
    (task) => task.id === selectedTaskId
  );

  useEffect(() => {
    setStatusFilter("all");
    setSelectedTaskId(null);
    setMutationError("");
  }, [projectId]);

  const openEditor = (task, triggerElement) => {
    editTriggerRef.current = triggerElement || null;
    setSelectedTaskId(task.id);
    setMutationError("");
  };

  const closeEditor = () => {
    setSelectedTaskId(null);
  };

  const handleCompletionChange = async (task) => {
    const completed = !isTaskComplete(task);
    setMutationError("");

    try {
      await onQuickUpdateTask(task.id, {
        completed,
        status: completed ? "completed" : "todo",
      });
    } catch (error) {
      console.error("Error updating project task completion:", error);
      setMutationError(
        `We couldn't ${completed ? "complete" : "reopen"} “${task.title}”. Try again.`
      );
    }
  };

  const handleArchiveTask = async (task) => {
    setMutationError("");
    try {
      await onArchiveTask(task.id);
    } catch (error) {
      console.error("Error archiving project task:", error);
      setMutationError(`We couldn't archive “${task.title}”. Try again.`);
    }
  };

  if (projectsLoading) {
    return (
      <section className="project-tasks-page">
        <div className="project-task-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h2>Loading project...</h2>
          <p>We’re retrieving this project from your workspace.</p>
        </div>
      </section>
    );
  }

  if (projectsError) {
    return (
      <section className="project-tasks-page">
        <div className="project-task-state error-state" role="alert">
          <h2>Project unavailable</h2>
          <p>{projectsError}</p>
          <div className="project-task-state-actions">
            <button className="ghost-btn" type="button" onClick={onBack}>
              Back to Projects
            </button>
            <button className="primary-btn" type="button" onClick={onRetryProjects}>
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="project-tasks-page">
        <div className="project-task-state">
          <span className="projects-empty-icon" aria-hidden="true">◇</span>
          <h2>Project not found</h2>
          <p>This project doesn’t exist or isn’t available to your account.</p>
          <button className="primary-btn" type="button" onClick={onBack}>
            Back to Projects
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="project-tasks-page" aria-labelledby="project-task-title">
      <button className="project-back-button" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Projects
      </button>

      <header className="project-task-hero">
        <div className="project-task-identity">
          <span
            className="project-task-color"
            style={{ backgroundColor: project.color || "#6657c8" }}
            aria-hidden="true"
          />
          <div>
            <p className="card-label">Project workspace</p>
            <h2 id="project-task-title">{project.name}</h2>
            {project.description && <p>{project.description}</p>}
            <span className={`project-status project-status-${project.status}`}>
              {projectStatusLabels[project.status] || "Active project"}
            </span>
          </div>
        </div>
        <button className="primary-btn" type="button" onClick={onCreateTask}>
          + New project task
        </button>
      </header>

      <div className="project-task-summary" aria-label="Project task summary">
        <div>
          <strong>{projectTasks.length}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>{activeTasks.length}</strong>
          <span>Active</span>
        </div>
        <div>
          <strong>{completedTasks.length}</strong>
          <span>Completed</span>
        </div>
      </div>

      <ProjectMembersSection
        ownerId={ownerId}
        ownerEmail={ownerEmail}
        projectId={projectId}
      />

      <div className="project-task-toolbar">
        <div>
          <h3>Project tasks</h3>
          <p>Only tasks assigned to this project appear here.</p>
        </div>
        <div className="project-status-filters" role="group" aria-label="Filter project tasks">
          {[
            ["all", "All"],
            ["active", "Active"],
            ["completed", "Completed"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={statusFilter === value ? "active" : ""}
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mutationError && (
        <div className="inline-error task-mutation-error" role="alert">
          <p>{mutationError}</p>
          <button
            className="ghost-btn compact-btn"
            type="button"
            onClick={() => setMutationError("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {tasksLoading ? (
        <div className="project-task-state" role="status" aria-live="polite">
          <div className="state-spinner" aria-hidden="true" />
          <h3>Loading project tasks...</h3>
          <p>Your saved tasks are being retrieved from Firestore.</p>
        </div>
      ) : tasksError ? (
        <div className="project-task-state error-state" role="alert">
          <h3>Project tasks unavailable</h3>
          <p>{tasksError}</p>
          <button className="ghost-btn" type="button" onClick={onRetryTasks}>
            Try again
          </button>
        </div>
      ) : projectTasks.length === 0 ? (
        <div className="project-task-state project-task-empty">
          <span className="projects-empty-icon" aria-hidden="true">✓</span>
          <h3>No tasks in this project</h3>
          <p>Create a task here to keep the next step connected to this project.</p>
          <button className="primary-btn" type="button" onClick={onCreateTask}>
            Create project task
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="project-task-state project-task-filter-empty">
          <h3>No {statusFilter} tasks</h3>
          <p>Choose another status to see the rest of this project.</p>
          <button className="ghost-btn" type="button" onClick={() => setStatusFilter("all")}>
            Show all tasks
          </button>
        </div>
      ) : (
        <div className="tasks-page-list project-task-list">
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              lists={lists}
              projects={projects}
              completionBusy={quickTaskPendingIds.has(task.id)}
              selected={selectedTaskId === task.id}
              onToggleCompletion={handleCompletionChange}
              onEdit={openEditor}
              onArchive={handleArchiveTask}
              formatSettings={formatSettings}
            />
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskEditModal
          key={selectedTask.id}
          task={selectedTask}
          lists={lists}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          onRetryProjects={onRetryProjects}
          browserNotificationsEnabled={browserNotificationsEnabled}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onArchiveTask={onArchiveTask}
          onClose={closeEditor}
          returnFocusElement={editTriggerRef.current}
        />
      )}

    </section>
  );
}
