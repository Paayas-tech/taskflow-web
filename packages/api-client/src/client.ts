import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import {
  validateCreateTask,
  type CreateTaskInput,
  type AgentContext,
  type AgentMessage,
  type AgentResponse,
  type LoginResult,
  type Project,
  type Task,
  type TaskStatus,
  type User,
} from "@taskflow/domain";

type Storage = NonNullable<SupabaseClientOptions<"public">["auth"]>["storage"];

export interface CreateTaskFlowApiOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  storage?: Storage;
}

const rowStatus = (status: string | null): TaskStatus => {
  if (status === "done") return "completed";
  if (status === "in_progress") return "in-progress";
  return "todo";
};

const databaseStatus = (status: TaskStatus): "todo" | "in_progress" | "done" =>
  status === "completed" ? "done" : status === "in-progress" ? "in_progress" : "todo";

export const friendlyAgentError = (value: unknown): Error => {
  const message = value instanceof Error ? value.message : String(value || "");
  if (/invalid api key|api key|not configured|unauthorized|\b401\b|\b403\b/i.test(message)) {
    return new Error(
      "AI Assistant is not configured for this app. Ask an administrator to update the server API key."
    );
  }
  if (/rate.?limit|\b429\b/i.test(message)) {
    return new Error("AI Assistant is temporarily busy. Please wait a moment and try again.");
  }
  return new Error(message || "AI Assistant is unavailable right now.");
};

const authUser = (user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User => ({
  id: user.id,
  email: user.email ?? "",
  displayName: typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "",
});

const taskFromRow = (row: Record<string, unknown>): Task => {
  const assignments = row.task_assignments;
  const assignment = Array.isArray(assignments) ? assignments[0] : assignments;
  return {
    id: String(row.id),
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    createdBy: String(row.created_by),
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : "",
    notes: typeof row.notes === "string" ? row.notes : "",
    priority: row.priority === "low" || row.priority === "high" ? row.priority : "medium",
    status: rowStatus(typeof row.status === "string" ? row.status : null),
    workType: row.work_type === "story" ? "story" : "task",
    storyId: typeof row.story_id === "string" ? row.story_id : null,
    parentTaskId: typeof row.parent_task_id === "string" ? row.parent_task_id : null,
    columnId: typeof row.column_id === "string" ? row.column_id : null,
    position: typeof row.position === "number" ? row.position : null,
    assigneeId:
      assignment && typeof assignment === "object" && "user_id" in assignment && typeof assignment.user_id === "string"
        ? assignment.user_id
        : null,
    dueDate: typeof row.due_date === "string" ? row.due_date : null,
    startDate: typeof row.start_date === "string" ? row.start_date : null,
    endDate: typeof row.end_date === "string" ? row.end_date : null,
    startTime: typeof row.start_time === "string" ? row.start_time.slice(0, 5) : null,
    endTime: typeof row.end_time === "string" ? row.end_time.slice(0, 5) : null,
    reminderEnabled: row.reminder_enabled === true,
    reminderAt: typeof row.reminder_at === "string" ? row.reminder_at : null,
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    archivedAt: typeof row.archived_at === "string" ? row.archived_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
};

const projectFromRow = (row: Record<string, unknown>): Project => ({
  id: String(row.id),
  ownerId: String(row.owner_id),
  name: typeof row.name === "string" && row.name.trim() ? row.name : "Untitled project",
  description: typeof row.description === "string" ? row.description : "",
  color: typeof row.color === "string" ? row.color : null,
  status: row.status === "archived" ? "archived" : "active",
  dueDate: typeof row.due_date === "string" ? row.due_date : null,
  archivedAt: typeof row.archived_at === "string" ? row.archived_at : null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const TASK_SELECT = `id, project_id, created_by, title, description, notes, priority, status,
  work_type, story_id, parent_task_id, column_id, position, due_date, start_date,
  end_date, start_time, end_time, reminder_enabled, reminder_at, completed_at,
  archived_at, created_at, updated_at, task_assignments(user_id)`;

const PROJECT_SELECT = `id, owner_id, name, description, color, status, due_date,
  archived_at, created_at, updated_at`;

export const createTaskFlowApi = (options: CreateTaskFlowApiOptions) => {
  if (!options.supabaseUrl || !options.supabaseAnonKey) {
    throw new Error("TaskFlow Supabase configuration is missing.");
  }

  const supabase: SupabaseClient = createClient(options.supabaseUrl, options.supabaseAnonKey, {
    auth: {
      ...(options.storage ? { storage: options.storage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return {
    supabase,

    async login(email: string, password: string): Promise<LoginResult> {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.user) throw new Error("Login did not return a user.");
      return { user: authUser(data.user) };
    },

    async logout(): Promise<void> {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    async askAgent(
      message: string,
      conversationHistory: AgentMessage[] = [],
      context: AgentContext = {},
    ): Promise<AgentResponse> {
      const prompt = message.trim();
      if (!prompt) throw new Error("Ask TaskFlow a question first.");
      const { data, error } = await supabase.functions.invoke<AgentResponse>("agent-chat", {
        body: { message: prompt, conversationHistory, context },
      });
      if (error) {
        let providerDetail = "";
        try {
          const response = (error as unknown as { context?: { clone?: () => { json: () => Promise<unknown> } } }).context?.clone?.();
          const payload = await response?.json();
          if (payload && typeof payload === "object") {
            const detail = (payload as { detail?: unknown; error?: unknown }).detail
              ?? (payload as { detail?: unknown; error?: unknown }).error;
            if (typeof detail === "string") providerDetail = detail;
          }
        } catch {
          // The transport error still carries enough information for fallback.
        }
        throw friendlyAgentError(providerDetail ? new Error(providerDetail) : error);
      }
      if (!data || typeof data.message !== "string" || !Array.isArray(data.actions)) {
        throw new Error("TaskFlow Agent returned an invalid response.");
      }
      return data;
    },

    async getTasks(): Promise<Task[]> {
      const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .is("archived_at", null)
        .neq("status", "done")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => taskFromRow(row as unknown as Record<string, unknown>));
    },

    async getCompletedTasks(limit = 20): Promise<Task[]> {
      const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .is("archived_at", null)
        .eq("status", "done")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((row) => taskFromRow(row as unknown as Record<string, unknown>));
    },

    async getProjects(): Promise<Project[]> {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => projectFromRow(row as unknown as Record<string, unknown>));
    },

    async getProject(projectId: string): Promise<Project> {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("The selected project is unavailable.");
      return projectFromRow(data as unknown as Record<string, unknown>);
    },

    async getProjectTasks(projectId: string): Promise<Task[]> {
      const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("project_id", projectId)
        .is("archived_at", null)
        .neq("status", "done")
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => taskFromRow(row as unknown as Record<string, unknown>));
    },

    async setTaskCompletion(taskId: string, completed: boolean): Promise<Task> {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          status: completed ? "done" : "todo",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", taskId)
        .select(TASK_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This task cannot be updated or is no longer available.");
      return taskFromRow(data as unknown as Record<string, unknown>);
    },

    async completeTask(taskId: string): Promise<Task> {
      return this.setTaskCompletion(taskId, true);
    },

    async reopenTask(taskId: string): Promise<Task> {
      return this.setTaskCompletion(taskId, false);
    },

    async createTask(input: CreateTaskInput): Promise<Task> {
      const values = validateCreateTask(input);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("You must be signed in to create a task.");

      const row = {
        created_by: userData.user.id,
        project_id: values.projectId ?? null,
        title: values.title,
        description: values.description ?? null,
        notes: values.notes ?? null,
        priority: values.priority ?? "medium",
        status: databaseStatus(values.status ?? "todo"),
        work_type: values.workType ?? "task",
        story_id: values.storyId ?? null,
        parent_task_id: values.parentTaskId ?? null,
        column_id: values.projectId ? values.columnId ?? null : null,
        position: values.projectId ? values.position ?? null : null,
        due_date: values.dueDate ?? null,
        start_date: values.dueDate ?? null,
        end_date: values.endDate ?? null,
        start_time: values.startTime ?? null,
        end_time: values.endTime ?? null,
        reminder_enabled: Boolean(values.reminderAt),
        reminder_at: values.reminderAt ?? null,
      };

      const { data, error } = await supabase.from("tasks").insert(row).select(TASK_SELECT).single();
      if (error) throw error;
      return taskFromRow(data as unknown as Record<string, unknown>);
    },
  };
};

export type TaskFlowApi = ReturnType<typeof createTaskFlowApi>;
