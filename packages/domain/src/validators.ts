import type { CreateTaskInput, TaskPriority, TaskStatus } from "./types";

const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in-progress", "completed"];
const TASK_PRIORITIES: readonly TaskPriority[] = ["low", "medium", "high"];

export const isTaskStatus = (value: unknown): value is TaskStatus =>
  typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus);

export const isTaskPriority = (value: unknown): value is TaskPriority =>
  typeof value === "string" && TASK_PRIORITIES.includes(value as TaskPriority);

export const validateCreateTask = (input: CreateTaskInput): CreateTaskInput => {
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required.");
  if (title.length > 500) throw new Error("Task title must be 500 characters or fewer.");
  if (input.status !== undefined && !isTaskStatus(input.status)) {
    throw new Error("Invalid task status.");
  }
  if (input.priority !== undefined && !isTaskPriority(input.priority)) {
    throw new Error("Invalid task priority.");
  }
  if (input.position != null && (!Number.isInteger(input.position) || input.position < 0)) {
    throw new Error("Task position must be a non-negative integer.");
  }
  return { ...input, title };
};
