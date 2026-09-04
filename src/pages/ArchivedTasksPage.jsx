import { useState } from "react";
import {
  selectArchivedTasks,
  selectErrors,
  selectLoaded,
} from "../store/selectors";
import { loadTasks } from "../store/session";
import { useStore } from "../store/store";
import { deleteTask, restoreTask } from "../store/tasks";
import { navigate } from "../store/ui";
import { TaskRow } from "../tasks/TaskRow";
import { Button, ConfirmDialog, EmptyState, Icon, InlineNotice } from "../ui";

const SKELETON_ROWS = [0, 1, 2];

/**
 * Archived tasks: a read-only list of hidden personal tasks with Restore and
 * Delete permanently, reached from Settings.
 */
export function ArchivedTasksPage() {
  const tasks = useStore(selectArchivedTasks);
  const loaded = useStore(selectLoaded);
  const errors = useStore(selectErrors);

  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loading = loaded.tasks === "loading" && tasks.length === 0;

  const handleDelete = async () => {
    if (!taskToDelete || deleteBusy) return;
    setDeleteBusy(true);
    const deleted = await deleteTask(taskToDelete.id);
    setDeleteBusy(false);
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
            onRestore={(item) => restoreTask(item.id)}
            onDeletePermanently={setTaskToDelete}
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
          <Button
            variant="ghost"
            icon={<Icon name="arrow-left" size={14} />}
            onClick={() => navigate("/settings")}
          >
            Back to settings
          </Button>
        </div>
      </header>

      <div className="page-body is-narrow">{renderBody()}</div>

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
