import { useMemo, useRef, useState } from "react";
import { Button, ConfirmDialog, EmptyState, Icon, InlineNotice } from "../ui";
import { TaskRow } from "../tasks";

const SKELETON_ROWS = [0, 1, 2];

/**
 * Archived tasks: a read-only list of hidden personal tasks with Restore and
 * Delete permanently, reached from Settings.
 */
export default function ArchivedTasksPage({
  tasks = [],
  loading = false,
  error = "",
  onRetry,
  taskActions,
  onOpenTask,
  onOpenProject,
  onBack,
  projects = [],
  formatSettings,
}) {
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const submissionRef = useRef(false);

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const context = useMemo(() => ({ projectsById }), [projectsById]);
  const deleteBusy = Boolean(taskToDelete) && pendingTaskId === taskToDelete?.id;

  const runMutation = async (task, action, message) => {
    if (submissionRef.current) return false;

    submissionRef.current = true;
    setPendingTaskId(task.id);
    setMutationError("");
    try {
      await action();
      return true;
    } catch {
      setMutationError(message);
      return false;
    } finally {
      submissionRef.current = false;
      setPendingTaskId(null);
    }
  };

  const handleRestore = (task) => {
    void runMutation(
      task,
      () => taskActions.restore(task),
      `We couldn't restore “${task.title}”. Check your connection and try again.`
    );
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;
    const deleted = await runMutation(
      taskToDelete,
      () => taskActions.remove(taskToDelete),
      `We couldn't delete “${taskToDelete.title}”. Check your connection and try again.`
    );
    if (deleted) setTaskToDelete(null);
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div
          className="row-list archived-tasks-skeleton"
          role="status"
          aria-label="Loading archived tasks"
        >
          {SKELETON_ROWS.map((row) => (
            <div className="skeleton-row" key={row}>
              <span className="skeleton archived-tasks-skeleton-line" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <InlineNotice
          tone="error"
          action={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </InlineNotice>
      );
    }

    if (tasks.length === 0) {
      return (
        <EmptyState
          icon="archive"
          title="No archived tasks"
          description="Archiving hides a task without deleting it."
        />
      );
    }

    return (
      <div className="row-list">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            context={context}
            busy={pendingTaskId === task.id}
            onOpen={onOpenTask}
            onOpenProject={onOpenProject}
            onRestore={handleRestore}
            onDeletePermanently={setTaskToDelete}
            formatSettings={formatSettings}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="page archived-tasks-page">
      <header className="page-header">
        <h1 className="page-title">
          Archived tasks
          <span className="page-title-count">{tasks.length}</span>
        </h1>

        <div className="page-actions">
          <Button variant="ghost" icon={<Icon name="arrow-left" size={14} />} onClick={onBack}>
            Back to settings
          </Button>
        </div>
      </header>

      <div className="page-body is-narrow">
        {mutationError ? (
          <div className="page-notice">
            <InlineNotice tone="error" onDismiss={() => setMutationError("")}>
              {mutationError}
            </InlineNotice>
          </div>
        ) : null}

        {renderBody()}
      </div>

      <ConfirmDialog
        open={Boolean(taskToDelete)}
        title="Delete permanently?"
        description={
          taskToDelete ? `Deleting “${taskToDelete.title}” cannot be undone.` : ""
        }
        confirmLabel="Delete permanently"
        danger
        busy={deleteBusy}
        onCancel={() => setTaskToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export { ArchivedTasksPage };
