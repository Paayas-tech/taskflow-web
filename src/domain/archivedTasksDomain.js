import { isArchived, unarchiveTask } from "./taskDomain";

const archivedTime = (task) => Date.parse(task.archivedAt || "") || 0;

export const filterActiveTasks = (tasks = []) =>
  tasks.filter((task) => !isArchived(task));

export const filterArchivedTasks = (tasks = []) =>
  tasks
    .filter(isArchived)
    .sort((firstTask, secondTask) =>
      archivedTime(secondTask) - archivedTime(firstTask)
    );

export const restoreArchivedTaskInCollection = (tasks = [], taskId) => {
  const selectedTask = tasks.find((task) => task.id === taskId);
  if (!selectedTask) throw new Error("The selected task is unavailable.");

  const restoredTask = unarchiveTask(selectedTask);
  return tasks.map((task) => (task.id === taskId ? restoredTask : task));
};

export const permanentlyDeleteArchivedTaskFromCollection = (
  tasks = [],
  taskId
) => {
  const selectedTask = tasks.find((task) => task.id === taskId);
  if (!selectedTask) throw new Error("The selected task is unavailable.");
  if (!isArchived(selectedTask)) {
    throw new Error("Only archived tasks can be permanently deleted here.");
  }

  return tasks.filter((task) => task.id !== taskId);
};
