import { invalidateProjectContext, useProjectContext } from "../projects/useProjectContext";
import { TaskDetailPanel } from "./TaskDetailPanel";

/**
 * `TaskDetailPanel` wired to `taskActions` for the views outside the project
 * workspace (Home, My Tasks, Calendar, Inbox, Projects). Project data is loaded
 * on demand; the workspace passes its own data to `TaskDetailPanel` directly.
 */
export function ConnectedTaskDetailPanel({
  task = null,
  userId = null,
  projects = [],
  taskActions,
  onClose,
  ...passthrough
}) {
  const projectId = task?.projectId || null;
  const context = useProjectContext(userId, projectId);

  if (!task) return null;

  const project = projects.find((candidate) => candidate.id === projectId) || context.project;
  const readOnly = project?.viewerRole === "viewer";

  const afterProjectMutation = () => {
    if (projectId) invalidateProjectContext(projectId);
  };

  const onUpdate = taskActions?.update
    ? (patch) => Promise.resolve(taskActions.update(task, patch)).then((result) => {
        afterProjectMutation();
        return result;
      })
    : undefined;

  const onSetAssignee =
    projectId && taskActions?.setAssignee
      ? (assigneeId) =>
          Promise.resolve(taskActions.setAssignee(task, assigneeId)).then((result) => {
            afterProjectMutation();
            return result;
          })
      : undefined;

  return (
    <TaskDetailPanel
      task={task}
      userId={userId}
      project={project}
      projects={projects}
      projectMembers={context.members}
      projectStories={context.stories}
      projectColumns={context.columns}
      contextLoading={context.loading}
      readOnly={readOnly}
      onClose={onClose}
      onUpdate={onUpdate}
      onToggleComplete={
        taskActions?.toggleComplete ? () => taskActions.toggleComplete(task) : undefined
      }
      onArchive={taskActions?.archive ? (options) => taskActions.archive(task, options) : undefined}
      onRestore={taskActions?.restore ? () => taskActions.restore(task) : undefined}
      onDelete={taskActions?.remove ? () => taskActions.remove(task) : undefined}
      onSetAssignee={onSetAssignee}
      {...passthrough}
    />
  );
}

export default ConnectedTaskDetailPanel;
