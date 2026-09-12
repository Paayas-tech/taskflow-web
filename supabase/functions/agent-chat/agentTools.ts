const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_STATUSES = new Set(["todo", "in_progress", "done"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const PROJECT_STATUSES = new Set(["active", "archived"]);

type SupabaseLike = { from: (table: string) => any };

export interface AgentToolContext {
  supabase: SupabaseLike;
  userId: string;
  now: () => string;
}

const objectInput = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tool arguments must be an object.");
  return value as Record<string, unknown>;
};

const optionalText = (value: unknown, maximum = 500) => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.slice(0, maximum);
};

const requiredUuid = (value: unknown, label: string) => {
  const text = optionalText(value, 36);
  if (!text || !UUID_PATTERN.test(text)) throw new Error(`${label} must be a valid ID.`);
  return text;
};

const isoDate = (value: unknown, label: string) => {
  const text = optionalText(value, 10);
  if (!text) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }
  return text;
};

const boundedLimit = (value: unknown, fallback = 25) => {
  const number = Number(value ?? fallback);
  return Number.isInteger(number) ? Math.min(100, Math.max(1, number)) : fallback;
};

const safeTask = (row: Record<string, unknown>) => ({
  id: row.id,
  title: row.title,
  description: row.description || "",
  project_id: row.project_id || null,
  status: row.status,
  priority: row.priority,
  due_date: row.due_date || null,
  completed_at: row.completed_at || null,
});

const safeProject = (row: Record<string, unknown>) => ({
  id: row.id,
  name: row.name,
  description: row.description || "",
  color: row.color || null,
  status: row.status,
  due_date: row.due_date || null,
});

const resolveProjectId = async (supabase: SupabaseLike, projectName: string) => {
  const { data, error } = await supabase.from("projects").select("id, name").ilike("name", projectName).limit(2);
  if (error) throw error;
  if (!data?.length) throw new Error(`No accessible project named “${projectName}” was found.`);
  if (data.length > 1) throw new Error(`More than one accessible project is named “${projectName}”. Use a project ID.`);
  return String(data[0].id);
};

export async function executeAgentTool(name: string, rawInput: unknown, context: AgentToolContext): Promise<unknown> {
  const input = objectInput(rawInput);

  if (name === "list_projects") {
    const search = optionalText(input.query, 120);
    const status = optionalText(input.status, 20);
    if (status && !PROJECT_STATUSES.has(status)) throw new Error("Project status must be active or archived.");
    let query = context.supabase.from("projects").select("id, name, description, color, status, due_date").order("name").limit(boundedLimit(input.limit));
    if (search) query = query.ilike("name", `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return { projects: (data ?? []).map(safeProject) };
  }

  if (name === "query_tasks") {
    const projectId = input.project_id
      ? requiredUuid(input.project_id, "project_id")
      : optionalText(input.project_name, 120)
        ? await resolveProjectId(context.supabase, optionalText(input.project_name, 120)!)
        : undefined;
    const status = optionalText(input.status, 20);
    const priority = optionalText(input.priority, 20);
    const titleQuery = optionalText(input.query, 200);
    if (status && !TASK_STATUSES.has(status)) throw new Error("Task status must be todo, in_progress, or done.");
    if (priority && !PRIORITIES.has(priority)) throw new Error("Priority must be low, medium, or high.");
    const assignee = optionalText(input.assignee, 40);
    const assigneeId = assignee === "me" ? context.userId : assignee ? requiredUuid(assignee, "assignee") : undefined;
    const dueFrom = isoDate(input.due_from, "due_from");
    const dueTo = isoDate(input.due_to, "due_to");
    const completed = typeof input.completed === "boolean" ? input.completed : undefined;
    if (dueFrom && dueTo && dueFrom > dueTo) throw new Error("due_from must not be after due_to.");
    if (completed === true && status && status !== "done") throw new Error("completed=true conflicts with the requested status.");
    if (completed === false && status === "done") throw new Error("completed=false conflicts with status=done.");
    const select = `id, title, description, project_id, status, priority, due_date, completed_at${assigneeId ? ", task_assignments!inner(user_id)" : ""}`;
    let query = context.supabase.from("tasks").select(select).is("archived_at", null).order("due_date", { ascending: true, nullsFirst: false }).limit(boundedLimit(input.limit));
    if (projectId) query = query.eq("project_id", projectId);
    if (titleQuery) query = query.ilike("title", `%${titleQuery.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (completed !== undefined) query = completed ? query.eq("status", "done") : query.neq("status", "done");
    if (dueFrom) query = query.gte("due_date", dueFrom);
    if (dueTo) query = query.lte("due_date", dueTo);
    if (assigneeId) query = query.eq("task_assignments.user_id", assigneeId);
    const { data, error } = await query;
    if (error) throw error;
    return { project_id: projectId || null, tasks: (data ?? []).map(safeTask) };
  }

  if (name === "create_task") {
    const title = optionalText(input.title, 200);
    if (!title) throw new Error("A task title is required.");
    const projectId = input.project_id ? requiredUuid(input.project_id, "project_id") : null;
    const priority = optionalText(input.priority, 20) || "medium";
    if (!PRIORITIES.has(priority)) throw new Error("Priority must be low, medium, or high.");
    const dueDate = isoDate(input.due_date, "due_date") || null;
    const row = {
      created_by: context.userId,
      project_id: projectId,
      title,
      description: optionalText(input.description, 1000) || null,
      priority,
      status: "todo",
      work_type: "task",
      due_date: dueDate,
      start_date: dueDate,
    };
    const { data, error } = await context.supabase.from("tasks").insert(row).select("id, title, description, project_id, status, priority, due_date, completed_at").single();
    if (error) throw error;
    return { task: safeTask(data) };
  }

  if (name === "update_task") {
    const taskId = requiredUuid(input.task_id, "task_id");
    const patch: Record<string, unknown> = {};
    const title = optionalText(input.title, 200);
    const priority = optionalText(input.priority, 20);
    const status = optionalText(input.status, 20);
    if (input.title !== undefined) {
      if (!title) throw new Error("Task title cannot be empty.");
      patch.title = title;
    }
    if (priority) {
      if (!PRIORITIES.has(priority)) throw new Error("Priority must be low, medium, or high.");
      patch.priority = priority;
    }
    if (status) {
      if (!TASK_STATUSES.has(status)) throw new Error("Task status must be todo, in_progress, or done.");
      patch.status = status;
      patch.completed_at = status === "done" ? context.now() : null;
    }
    if (input.due_date !== undefined) patch.due_date = input.due_date === null ? null : isoDate(input.due_date, "due_date");
    if (!Object.keys(patch).length) throw new Error("Provide at least one task field to update.");
    const { data, error } = await context.supabase.from("tasks").update(patch).eq("id", taskId).select("id, title, description, project_id, status, priority, due_date, completed_at").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The task was not found or cannot be updated.");
    return { task: safeTask(data) };
  }

  throw new Error(`Unsupported tool: ${name}`);
}
