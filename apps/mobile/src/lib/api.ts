import * as SecureStore from "expo-secure-store";
import type { AgentMessage, AgentResponse, CreateTaskInput, Project, Task, User } from "@taskflow/domain";

export const apiBaseUrl = String(process.env.EXPO_PUBLIC_API_BASE_URL || "https://taskflow.bohaus.in/api").trim().replace(/\/+$/u, "");
export const hasApiConfiguration = /^https:\/\//u.test(apiBaseUrl);
const TOKEN_KEY = "taskflow.accessToken";
const REQUEST_TIMEOUT_MS = 12_000;

type Json = Record<string, any>;
export interface NotificationItem extends Json { id: string; read_at?: string | null; created_at?: string; title?: string; message?: string; }
export interface CommentItem extends Json { id: string; content: string; display_name?: string; created_at?: string; }
export interface ActivityItem extends Json { id: string; action?: string; event_type?: string; display_name?: string; created_at?: string; metadata?: Json; }
export interface AttachmentItem extends Json { id: string; file_name?: string; content_type?: string; size_bytes?: number; created_at?: string; }
type RequestOptions = RequestInit & { timeoutMs?: number };

const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    // Let fetch add the multipart boundary for FormData. Supplying a manual
    // Content-Type here produces an invalid upload on React Native.
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers, signal: controller.signal });
    if (response.status === 204) return null as T;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(String(data?.detail || data?.error || "TaskFlow API request failed."));
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    return data as T;
  } catch (value) {
    if (value instanceof Error && value.name === "AbortError") throw new Error("TaskFlow took too long to respond. Please try again.");
    throw value;
  } finally { clearTimeout(timeout); }
};

const mapUser = (row: Json): User => ({ id: row.id || row.uid, email: row.email || "", displayName: row.displayName || row.display_name || "" });
const mapProject = (row: Json): Project => ({ id: row.id, ownerId: row.owner_id, name: row.name || "Untitled project", description: row.description || "", color: row.color || null, status: row.status || "active", dueDate: row.due_date || null, archivedAt: row.archived_at || null, createdAt: row.created_at || "", updatedAt: row.updated_at || "" });
const mapTask = (row: Json): Task => ({
  id: row.id, projectId: row.project_id || null, createdBy: row.created_by, title: row.title || "", description: row.description || "", notes: row.notes || "", priority: row.priority || "medium",
  status: row.status === "done" ? "completed" : row.status === "in_progress" ? "in-progress" : "todo", workType: row.work_type === "story" ? "story" : "task", storyId: row.story_id || null, parentTaskId: row.parent_task_id || null,
  columnId: row.column_id || null, position: Number.isFinite(row.position) ? row.position : null, assigneeId: row.task_assignments?.user_id || null, dueDate: row.due_date || null, startDate: row.start_date || null,
  endDate: row.end_date || null, startTime: row.start_time || null, endTime: row.end_time || null, reminderEnabled: row.reminder_enabled === true, reminderAt: row.reminder_at || null,
  completedAt: row.completed_at || null, archivedAt: row.archived_at || null, createdAt: row.created_at || "", updatedAt: row.updated_at || "",
});

const client = {
  async getSession(): Promise<User | null> {
    if (!await SecureStore.getItemAsync(TOKEN_KEY)) return null;
    try { return mapUser((await apiRequest<{ user: Json }>("/auth/me")).user); }
    catch (value) {
      if ((value as Error & { status?: number })?.status === 401) await SecureStore.deleteItemAsync(TOKEN_KEY);
      return null;
    }
  },
  async login(email: string, password: string) {
    const result = await apiRequest<{ accessToken: string; user: Json }>("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
    await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken);
    return { user: mapUser(result.user) };
  },
  async logout() { try { await apiRequest("/auth/logout", { method: "POST" }); } finally { await SecureStore.deleteItemAsync(TOKEN_KEY); } },
  async getTasks() { return (await apiRequest<Json[]>("/tasks?mine=true")).filter((row) => row.status !== "done").map(mapTask); },
  async getAllTasks() { return (await apiRequest<Json[]>("/tasks")).map(mapTask); },
  async getCompletedTasks(limit = 20) { return (await apiRequest<Json[]>("/tasks?mine=true")).filter((row) => row.status === "done").slice(0, limit).map(mapTask); },
  async getProjects() { return (await apiRequest<Json[]>("/projects")).map(mapProject); },
  async getProject(projectId: string) { const project = (await client.getProjects()).find((item) => item.id === projectId); if (!project) throw new Error("The selected project is unavailable."); return project; },
  async getProjectMembers(projectId: string) { return apiRequest<Json[]>(`/projects/${projectId}/members`); },
  async getProjectTasks(projectId: string) { return (await apiRequest<Json[]>(`/tasks?projectId=${encodeURIComponent(projectId)}`)).map(mapTask); },
  async updateTask(taskId: string, updates: Json) { return mapTask(await apiRequest<Json>(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(updates) })); },
  async setTaskStatus(taskId: string, status: "todo" | "in_progress" | "done") { return client.updateTask(taskId, { status, completed_at: status === "done" ? new Date().toISOString() : null }); },
  async setTaskCompletion(taskId: string, completed: boolean) { return mapTask(await apiRequest<Json>(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status: completed ? "done" : "todo", completed_at: completed ? new Date().toISOString() : null }) })); },
  async completeTask(taskId: string) { return client.setTaskCompletion(taskId, true); },
  async createTask(input: CreateTaskInput) { return mapTask(await apiRequest<Json>("/tasks", { method: "POST", body: JSON.stringify({ ...input, status: input.status === "in-progress" ? "in_progress" : input.status === "completed" ? "done" : input.status || "todo" }) })); },
  async askAgent(message: string, messages: AgentMessage[] = []): Promise<AgentResponse> {
    const prompt = message.trim();
    if (!prompt || prompt.length > 4000) throw new Error("Enter a message between 1 and 4,000 characters.");
    const recentHistory = messages.slice(-8).map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
    return apiRequest<AgentResponse>("/chat", { method: "POST", timeoutMs: 60_000, body: JSON.stringify({ message: prompt, messages: recentHistory }) });
  },
  async search(query: string) {
    const needle = query.trim().toLocaleLowerCase();
    const [tasks, projects] = await Promise.all([client.getAllTasks(), client.getProjects()]);
    if (!needle) return { tasks: tasks.slice(0, 8), projects: projects.slice(0, 6) };
    return {
      tasks: tasks.filter((task) => `${task.title} ${task.description}`.toLocaleLowerCase().includes(needle)).slice(0, 20),
      projects: projects.filter((project) => `${project.name} ${project.description}`.toLocaleLowerCase().includes(needle)).slice(0, 12),
    };
  },
  async getNotifications() { return apiRequest<NotificationItem[]>("/notifications?limit=100"); },
  async markNotificationRead(id: string) { return apiRequest<NotificationItem>(`/notifications/${id}`, { method: "PATCH" }); },
  async markAllNotificationsRead() { return apiRequest<void>("/notifications/read-all", { method: "POST" }); },
  async getComments(taskId: string) { return apiRequest<CommentItem[]>(`/tasks/${taskId}/comments`); },
  async addComment(taskId: string, content: string) { return apiRequest<CommentItem>(`/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ content }) }); },
  async getActivity(taskId: string) { return apiRequest<ActivityItem[]>(`/activity?taskId=${encodeURIComponent(taskId)}&limit=50`); },
  async getAttachments(task: Task) {
    if (!task.projectId) return [] as AttachmentItem[];
    return apiRequest<AttachmentItem[]>(`/attachments?projectId=${encodeURIComponent(task.projectId)}&entityType=task&entityId=${encodeURIComponent(task.id)}`);
  },
  async uploadTaskAttachment(task: Task, file: { uri: string; name: string; mimeType?: string | null }) {
    if (!task.projectId) throw new Error("Attachments require a project task.");
    const form = new FormData();
    form.append("projectId", task.projectId);
    form.append("entityType", "task");
    form.append("entityId", task.id);
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType || "application/octet-stream" } as unknown as Blob);
    return apiRequest<AttachmentItem>("/attachments", { method: "POST", body: form, timeoutMs: 30_000 });
  },
};

export const getApi = () => client;
