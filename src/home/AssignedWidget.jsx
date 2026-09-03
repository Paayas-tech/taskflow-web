import { useMemo } from "react";
import { TaskRow } from "../tasks";
import { Button } from "../ui";
import { assignedHomeTasks } from "./homeData";
import { Widget, WidgetError, WidgetSkeleton } from "./Widget";

const VISIBLE_LIMIT = 6;

/** Open project tasks assigned to the signed-in person. */
export function AssignedWidget({
  tasks = [],
  userId,
  loading = false,
  error = "",
  onRetry,
  context,
  taskActions,
  onOpenTask,
  selectedTaskId = null,
  onNavigate,
  todayKey,
  formatSettings,
}) {
  const assigned = useMemo(
    () => assignedHomeTasks(tasks, userId, todayKey),
    [tasks, todayKey, userId]
  );
  const visible = assigned.slice(0, VISIBLE_LIMIT);
  const pendingIds = taskActions?.pendingIds;

  return (
    <Widget
      className="assigned-widget"
      title="Assigned to me"
      actions={
        <Button variant="ghost" size="sm" onClick={() => onNavigate?.("/tasks")}>
          View all
        </Button>
      }
    >
      {loading ? <WidgetSkeleton label="Loading assigned tasks" /> : null}
      {!loading && error ? <WidgetError message={error} onRetry={onRetry} /> : null}
      {!loading && !error && visible.length === 0 ? (
        <p className="widget-empty muted">No project tasks are assigned to you.</p>
      ) : null}
      {!loading && !error
        ? visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              context={context}
              dense
              showProject
              todayKey={todayKey}
              selected={task.id === selectedTaskId}
              busy={Boolean(pendingIds?.has?.(task.id))}
              onOpen={onOpenTask}
              onToggleComplete={taskActions?.toggleComplete}
              formatSettings={formatSettings}
            />
          ))
        : null}
    </Widget>
  );
}

export default AssignedWidget;
