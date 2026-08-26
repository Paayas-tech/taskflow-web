import { isTaskComplete } from "./taskDomain";

export const personalTaskBoardColumns = [
  { id: "todo", name: "To do" },
  { id: "in-progress", name: "In progress" },
  { id: "completed", name: "Completed" },
];

export const personalTaskColumnId = (task) =>
  isTaskComplete(task)
    ? "completed"
    : task.status === "in-progress"
      ? "in-progress"
      : "todo";

export const mapPersonalTasksToBoard = (tasks) =>
  tasks.map((task, position) => ({
    ...task,
    columnId: personalTaskColumnId(task),
    position,
  }));

export const personalTaskMoveUpdate = (boardTasks, placements) => {
  const changed = placements.find((placement) => {
    const task = boardTasks.find((candidate) => candidate.id === placement.taskId);
    return task && task.columnId !== placement.columnId;
  });
  if (!changed) return null;
  return {
    taskId: changed.taskId,
    changes: {
      status: changed.columnId,
      completed: changed.columnId === "completed",
    },
  };
};
