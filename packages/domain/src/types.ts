export type UUID = string;
export type ISODate = string;
export type ISODateTime = string;

export type TaskStatus = "todo" | "in-progress" | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type WorkType = "task" | "story";
export type ProjectStatus = "active" | "archived";
export type ProjectRole = "owner" | "editor" | "viewer";

export interface User {
  id: UUID;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  timezone?: string;
  locale?: string;
}

export interface Project {
  id: UUID;
  ownerId: UUID;
  name: string;
  description: string;
  color: string | null;
  status: ProjectStatus;
  dueDate: ISODate | null;
  archivedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Task {
  id: UUID;
  projectId: UUID | null;
  createdBy: UUID;
  title: string;
  description: string;
  notes: string;
  priority: TaskPriority;
  status: TaskStatus;
  workType: WorkType;
  storyId: UUID | null;
  parentTaskId: UUID | null;
  columnId: UUID | null;
  position: number | null;
  assigneeId: UUID | null;
  dueDate: ISODate | null;
  startDate: ISODate | null;
  endDate: ISODate | null;
  startTime: string | null;
  endTime: string | null;
  reminderEnabled: boolean;
  reminderAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  archivedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CreateTaskInput {
  title: string;
  projectId?: UUID | null;
  description?: string;
  notes?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  workType?: WorkType;
  storyId?: UUID | null;
  parentTaskId?: UUID | null;
  columnId?: UUID | null;
  position?: number | null;
  dueDate?: ISODate | null;
  endDate?: ISODate | null;
  startTime?: string | null;
  endTime?: string | null;
  reminderAt?: ISODateTime | null;
}

export interface LoginResult {
  user: User;
}

export type AgentMessageRole = "user" | "assistant";

export interface AgentMessage {
  role: AgentMessageRole;
  content: string;
}

export interface AgentContext {
  timezone?: string;
  currentProjectId?: UUID | null;
  currentProjectName?: string | null;
  confirmedDeleteTask?: AgentDeleteConfirmation;
}

export type AgentToolName =
  | "list_projects"
  | "query_tasks"
  | "create_task"
  | "update_task"
  | "delete_task"
  | "bulk_update_tasks";

export interface AgentDeleteConfirmation {
  type: "delete_task";
  taskId?: string;
  taskTitle?: string;
  query?: string;
  reason?: string;
}

export interface AgentToolExecution {
  id: string;
  name: AgentToolName;
  arguments: Record<string, unknown>;
  status: "completed" | "failed";
  result?: unknown;
  error?: string;
}

export interface AgentResponse {
  message: string;
  actions: AgentToolExecution[];
  confirmation?: AgentDeleteConfirmation | null;
}
