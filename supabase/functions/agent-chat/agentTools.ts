const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_STATUSES = new Set(["todo", "in_progress", "done"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const PROJECT_STATUSES = new Set(["active", "archived"]);

type SupabaseLike = {
  from: (table: string) => any;
  functions?: {
    invoke: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: any; error: any }>;
  };
};

export interface AgentToolContext {
  supabase: SupabaseLike;
  userId: string;
  now: () => string;
  projectId?: string;
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

const lookupText = (value: string) =>
  value.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/gu, "").trim();

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

const normalizePriority = (value: unknown) => {
  const priority = String(value ?? "").trim().toLowerCase().replaceAll("_", " ");
  if (priority === "urgent" || priority === "critical") return "high";
  if (priority === "high" || priority === "high priority") return "high";
  if (priority === "low" || priority === "minor") return "low";
  if (priority === "medium" || priority === "normal") return "medium";
  return "medium";
};

const normalizeStatus = (value: unknown, fallback?: string) => {
  const status = String(value ?? "").trim().toLowerCase().replaceAll("_", " ");
  if (status === "to do" || status === "todo") return "todo";
  if (status === "in progress" || status === "progress") return "in_progress";
  if (status === "done" || status === "completed") return "done";
  return fallback;
};

const requiredUuidList = (value: unknown, label: string) => {
  if (!Array.isArray(value) || !value.length) throw new Error(`${label} must contain at least one task ID.`);
  if (value.length > 100) throw new Error(`${label} cannot contain more than 100 task IDs.`);
  return [...new Set(value.map((item) => requiredUuid(item, label)))];
};

const safeTask = (row: Record<string, unknown>) => ({
  id: row.id,
  title: row.title,
  description: row.description || "",
  project_id: row.project_id || null,
  parent_task_id: row.parent_task_id || null,
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

const activeProjectId = (input: Record<string, unknown>, context: AgentToolContext) => {
  const value = optionalText(input.projectId, 36) || context.projectId;
  return value ? requiredUuid(value, "projectId") : undefined;
};

const resolveTaskByTitle = async (
  context: AgentToolContext,
  titleQuery: string,
  projectId?: string,
) => {
  const normalizedTitle = lookupText(titleQuery);
  if (!normalizedTitle) throw new Error("Provide a task title.");
  const escaped = normalizedTitle.replaceAll("%", "\\%").replaceAll("_", "\\_");
  let query = context.supabase
    .from("tasks")
    .select("id, title, description, project_id, status, priority, due_date, completed_at, updated_at")
    .is("archived_at", null)
    .ilike("title", `%${escaped}%`);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(25);
  if (error) throw error;
  if (!data?.length) throw new Error(`No accessible task matching “${normalizedTitle}” was found.`);
  return data.find((task: Record<string, unknown>) => task.status !== "done") || data[0];
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
    const statusInput = optionalText(input.status, 20);
    const status = statusInput ? normalizeStatus(statusInput) : undefined;
    if (statusInput && !status) throw new Error("Task status must be todo, in progress, or done.");
    const priorityInput = optionalText(input.priority, 20);
    const priority = priorityInput ? normalizePriority(priorityInput) : undefined;
    const titleQuery = optionalText(input.query, 200);
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
    const projectValue = optionalText(input.project_id, 120) || optionalText(input.projectId, 120) || optionalText(input.project, 120);
    const projectName = optionalText(input.projectName, 120);
    const projectId = projectValue
      ? UUID_PATTERN.test(projectValue)
        ? projectValue
        : await resolveProjectId(context.supabase, projectValue)
      : projectName
        ? await resolveProjectId(context.supabase, projectName)
        : null;
    const priority = normalizePriority(input.priority);
    const statusInput = input.status === undefined ? "todo" : input.status;
    const status = normalizeStatus(statusInput);
    if (!status) throw new Error("Task status must be todo, in progress, or done.");
    const dueDate = isoDate(input.due_date ?? input.dueDate, "due_date") || null;
    const row = {
      created_by: context.userId,
      project_id: projectId,
      title,
      description: optionalText(input.description, 1000) || null,
      priority,
      status,
      completed_at: status === "done" ? context.now() : null,
      work_type: "task",
      due_date: dueDate,
      start_date: dueDate,
    };
    const { data, error } = await context.supabase.from("tasks").insert(row).select("id, title, description, project_id, status, priority, due_date, completed_at").single();
    if (error) throw error;
    return { task: safeTask(data) };
  }

  if (name === "update_task") {
    const suppliedId = optionalText(input.task_id, 36) || optionalText(input.taskId, 36);
    let taskId = suppliedId && UUID_PATTERN.test(suppliedId) ? suppliedId : undefined;
    if (!taskId) {
      const titleQuery = optionalText(input.taskTitle, 200) || optionalText(input.query, 200);
      if (!titleQuery) throw new Error("Provide a valid task ID or task title.");
      const target = await resolveTaskByTitle(context, titleQuery, activeProjectId(input, context));
      taskId = String(target.id);
    }
    const patch: Record<string, unknown> = {};
    const title = optionalText(input.title, 200);
    const priority = input.priority === undefined ? undefined : normalizePriority(input.priority);
    const statusInput = optionalText(input.status, 20);
    const status = statusInput ? normalizeStatus(statusInput) : undefined;
    if (statusInput && !status) throw new Error("Task status must be todo, in progress, or done.");
    if (input.title !== undefined) {
      if (!title) throw new Error("Task title cannot be empty.");
      patch.title = title;
    }
    if (priority) {
      patch.priority = priority;
    }
    if (status) {
      if (!TASK_STATUSES.has(status)) throw new Error("Task status must be todo, in progress, or done.");
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

  if (name === "delete_task") {
    try {
      optionalText(input.reason, 500);
      const suppliedId = optionalText(input.taskId, 36);
      const titleQuery = optionalText(input.taskTitle, 200) || optionalText(input.query, 200);
      let taskId = suppliedId && UUID_PATTERN.test(suppliedId) ? suppliedId : undefined;
      let task: Record<string, unknown> | undefined;

      if (!taskId) {
        if (!titleQuery) throw new Error("Provide a valid task ID or task title.");
        task = await resolveTaskByTitle(context, titleQuery, activeProjectId(input, context));
        taskId = String(task.id);
      }

      if (!task) {
        const { data, error } = await context.supabase
          .from("tasks")
          .select("id, title, description, project_id, status, priority, due_date, completed_at")
          .eq("id", taskId)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("The task was not found or cannot be deleted.");
        task = data;
      }

      const { data, error } = await context.supabase
        .from("tasks")
        .delete()
        .match({ id: taskId })
        .select("id, title, description, project_id, status, priority, due_date, completed_at");
      if (error) throw error;
      const deleted = (data ?? []).map(safeTask);
      return { success: true, deleted, task: deleted[0] || safeTask(task) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (name === "get_story_progress") {
    const storyName = optionalText(input.storyName, 200);
    if (!storyName) throw new Error("A story name is required.");
    const projectId = activeProjectId(input, context);
    const escaped = storyName.replaceAll("%", "\\%").replaceAll("_", "\\_");
    let storyQuery = context.supabase
      .from("tasks")
      .select("id, title, project_id, status, updated_at")
      .eq("work_type", "story")
      .is("archived_at", null)
      .ilike("title", `%${escaped}%`);
    if (projectId) storyQuery = storyQuery.eq("project_id", projectId);
    const { data: stories, error: storyError } = await storyQuery.order("updated_at", { ascending: false }).limit(10);
    if (storyError) throw storyError;
    if (!stories?.length) throw new Error(`No accessible story matching “${storyName}” was found.`);
    const story = stories.find((item: Record<string, unknown>) => String(item.title).toLowerCase() === storyName.toLowerCase()) || stories[0];
    const { data, error } = await context.supabase
      .from("tasks")
      .select("id, title, description, project_id, status, priority, due_date, completed_at")
      .eq("story_id", story.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const tasks = (data ?? []).map(safeTask);
    const completed = tasks.filter((task: Record<string, unknown>) => task.status === "done").length;
    const inProgress = tasks.filter((task: Record<string, unknown>) => task.status === "in_progress").length;
    return {
      story: { id: story.id, title: story.title, project_id: story.project_id },
      total: tasks.length,
      completed,
      in_progress: inProgress,
      percentage: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      remaining: tasks.filter((task: Record<string, unknown>) => task.status !== "done"),
    };
  }

  if (name === "get_urgent_todos") {
    const projectId = activeProjectId(input, context);
    const limit = boundedLimit(input.limit, 5);
    let query = context.supabase
      .from("tasks")
      .select("id, title, description, project_id, status, priority, due_date, completed_at")
      .is("archived_at", null)
      .neq("status", "done")
      .limit(100);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) throw error;
    const today = context.now().slice(0, 10);
    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const tasks = (data ?? []).map(safeTask).sort((first: Record<string, unknown>, second: Record<string, unknown>) => {
      const firstDue = typeof first.due_date === "string" ? first.due_date : "9999-12-31";
      const secondDue = typeof second.due_date === "string" ? second.due_date : "9999-12-31";
      const overdueDifference = Number(secondDue < today) - Number(firstDue < today);
      if (overdueDifference) return overdueDifference;
      const priorityDifference = (priorityRank[String(first.priority)] ?? 1) - (priorityRank[String(second.priority)] ?? 1);
      return priorityDifference || firstDue.localeCompare(secondDue);
    }).slice(0, limit);
    return {
      tasks,
      actionable: tasks.map((task: Record<string, unknown>) => ({
        title: task.title,
        priority: task.priority || "medium",
        due_date: task.due_date,
        overdue: typeof task.due_date === "string" && task.due_date < today,
      })),
    };
  }

  if (name === "get_team_overview") {
    const days = boundedLimit(input.days, 7);
    const projectId = activeProjectId(input, context);
    const since = new Date(Date.parse(context.now()) - days * 86_400_000).toISOString();
    let query = context.supabase
      .from("tasks")
      .select("id, title, status, updated_at, completed_at, task_assignments(user_id)")
      .is("archived_at", null)
      .or(`updated_at.gte.${since},completed_at.gte.${since}`)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) throw error;
    const groups = new Map<string, { assignee: string; completed: number; updated: number; achievements: unknown[] }>();
    for (const task of data ?? []) {
      const assignments = Array.isArray(task.task_assignments) && task.task_assignments.length
        ? task.task_assignments
        : [{ user_id: null }];
      for (const assignment of assignments) {
        const assigneeId = typeof assignment.user_id === "string" ? assignment.user_id : "unassigned";
        const assignee = assigneeId === "unassigned"
          ? "Unassigned"
          : assigneeId === context.userId
            ? "You"
            : "Another team member";
        const group = groups.get(assigneeId) || { assignee, completed: 0, updated: 0, achievements: [] };
        if (task.status === "done" && task.completed_at && task.completed_at >= since) group.completed += 1;
        else group.updated += 1;
        group.achievements.push({ title: task.title, status: task.status });
        groups.set(assigneeId, group);
      }
    }
    return { days, since, people: [...groups.values()] };
  }

  if (name === "invite_member") {
    const email = optionalText(input.email, 254)?.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new Error("A valid email address is required.");
    const projectId = activeProjectId(input, context);
    if (!projectId) throw new Error("A project is required to send an invitation.");
    const requestedRole = optionalText(input.role, 20)?.toLowerCase() || "member";
    const role = requestedRole === "editor" ? "editor" : requestedRole === "member" || requestedRole === "viewer" ? "viewer" : undefined;
    if (!role) throw new Error("Invitation role must be member, viewer, or editor.");
    if (!context.supabase.functions?.invoke) {
      return { success: false, error: "The invitation service is unavailable." };
    }
    const { data, error } = await context.supabase.functions.invoke("send-invitation-email", {
      body: { projectId, inviteeEmail: email, role },
    });
    if (error || data?.success !== true) {
      return {
        success: false,
        error: "The invitation could not be sent. Confirm that you own the project and that email delivery is configured.",
      };
    }
    return { success: true, email, role };
  }

  if (name === "generate_subtasks") {
    const taskTitle = optionalText(input.taskTitle, 200);
    if (!taskTitle) throw new Error("A parent task title is required.");
    if (!Array.isArray(input.subtasks) || !input.subtasks.length) {
      throw new Error("Provide at least one subtask title.");
    }
    if (input.subtasks.length > 20) throw new Error("A breakdown cannot contain more than 20 subtasks.");
    const seen = new Set<string>();
    const subtaskTitles = input.subtasks.map((value) => {
      const title = optionalText(value, 200);
      if (!title) throw new Error("Every subtask must have a title.");
      const key = title.toLocaleLowerCase();
      if (seen.has(key)) throw new Error("Subtask titles must be distinct.");
      seen.add(key);
      return title;
    });
    const parent = await resolveTaskByTitle(context, taskTitle, activeProjectId(input, context));
    const rows = subtaskTitles.map((title) => ({
      created_by: context.userId,
      project_id: parent.project_id || null,
      parent_task_id: parent.id,
      title,
      description: null,
      priority: normalizePriority(parent.priority),
      status: "todo",
      completed_at: null,
      work_type: "task",
    }));
    const { data, error } = await context.supabase
      .from("tasks")
      .insert(rows)
      .select("id, title, description, project_id, parent_task_id, status, priority, due_date, completed_at");
    if (error) throw error;
    return {
      parent: safeTask(parent),
      subtasks: (data ?? []).map(safeTask),
      count: data?.length ?? 0,
    };
  }

  if (name === "generate_daily_standup") {
    const projectId = activeProjectId(input, context);
    const currentTime = Date.now();
    const oneDayAgo = new Date(currentTime - 24 * 60 * 60 * 1000).toISOString();
    const today = new Date(currentTime).toISOString().slice(0, 10);
    const selection = "id, title, status, priority, due_date, updated_at";
    let recentQuery = context.supabase
      .from("tasks")
      .select(selection)
      .is("archived_at", null)
      .gte("updated_at", oneDayAgo);
    if (projectId) recentQuery = recentQuery.eq("project_id", projectId);
    let { data, error } = await recentQuery.order("updated_at", { ascending: false }).limit(25);
    if (error) throw error;

    let source: "last_24_hours" | "active_fallback" = "last_24_hours";
    if (!data?.length) {
      source = "active_fallback";
      let activeQuery = context.supabase
        .from("tasks")
        .select(selection)
        .is("archived_at", null)
        .in("status", ["todo", "in_progress"]);
      if (projectId) activeQuery = activeQuery.eq("project_id", projectId);
      const fallback = await activeQuery.order("updated_at", { ascending: false }).limit(25);
      data = fallback.data;
      error = fallback.error;
      if (error) throw error;
    }

    const tasks = (data ?? []).map((row: Record<string, unknown>) => ({
      title: optionalText(row.title, 200) || "Untitled task",
      status: normalizeStatus(row.status, "todo"),
      priority: normalizePriority(row.priority),
      due_date: typeof row.due_date === "string" ? row.due_date : null,
    }));
    const completed = tasks.filter((task) => task.status === "done");
    const inProgress = tasks.filter((task) => task.status === "in_progress");
    const blockers = tasks.filter((task) =>
      (task.status === "todo" && task.priority === "high")
      || (task.status !== "done" && task.due_date !== null && task.due_date < today)
    );
    const section = (heading: string, items: typeof tasks) =>
      `## ${heading}\n${items.length ? items.map((task) => `- ${task.title.replace(/[\r\n]+/gu, " ")}`).join("\n") : "- None"}`;
    const markdown = [
      "# Daily Standup",
      section("Completed Today", completed),
      section("Working On Today", inProgress),
      section("Potential Blockers", blockers),
    ].join("\n\n");
    return {
      source,
      period_start: oneDayAgo,
      completed,
      in_progress: inProgress,
      blockers,
      markdown,
    };
  }

  if (name === "bulk_update_tasks") {
    const taskIds = input.taskIds === undefined ? undefined : requiredUuidList(input.taskIds, "taskIds");
    const filters = input.filters === undefined ? {} : objectInput(input.filters);
    const updates = objectInput(input.updates);
    const filterStatusInput = optionalText(filters.status, 20);
    const filterStatus = filterStatusInput ? normalizeStatus(filterStatusInput) : undefined;
    const projectId = filters.projectId === undefined ? undefined : requiredUuid(filters.projectId, "projectId");
    const dueDateRange = filters.dueDateRange === undefined ? {} : objectInput(filters.dueDateRange);
    const dueFrom = isoDate(dueDateRange.from, "dueDateRange.from");
    const dueTo = isoDate(dueDateRange.to, "dueDateRange.to");
    if (filterStatusInput && !filterStatus) throw new Error("Filter status must be todo, in progress, or done.");
    if (dueFrom && dueTo && dueFrom > dueTo) throw new Error("dueDateRange.from must not be after dueDateRange.to.");
    if (!taskIds && !filterStatus && !projectId && !dueFrom && !dueTo) {
      throw new Error("Bulk updates require taskIds or at least one filter.");
    }

    const updateStatusInput = optionalText(updates.status, 20);
    const updateStatus = updateStatusInput ? normalizeStatus(updateStatusInput) : undefined;
    if (updateStatusInput && !updateStatus) throw new Error("Update status must be todo, in progress, or done.");
    const patch: Record<string, unknown> = {};
    if (updateStatus) {
      if (!TASK_STATUSES.has(updateStatus)) throw new Error("Update status must be todo, in progress, or done.");
      patch.status = updateStatus;
      patch.completed_at = updateStatus === "done" ? context.now() : null;
    }
    if (updates.dueDate !== undefined) {
      patch.due_date = updates.dueDate === null ? null : isoDate(updates.dueDate, "updates.dueDate");
    }
    if (!Object.keys(patch).length) throw new Error("Bulk updates require status or dueDate.");

    let candidates = context.supabase.from("tasks").select("id").is("archived_at", null).limit(100);
    if (taskIds) candidates = candidates.in("id", taskIds);
    if (filterStatus) candidates = candidates.eq("status", filterStatus);
    if (projectId) candidates = candidates.eq("project_id", projectId);
    if (dueFrom) candidates = candidates.gte("due_date", dueFrom);
    if (dueTo) candidates = candidates.lte("due_date", dueTo);
    const { data: candidateRows, error: candidateError } = await candidates;
    if (candidateError) throw candidateError;
    const ids = (candidateRows ?? []).map((row: Record<string, unknown>) => String(row.id));
    if (!ids.length) return { tasks: [], count: 0 };

    const { data, error } = await context.supabase
      .from("tasks")
      .update(patch)
      .in("id", ids)
      .select("id, title, description, project_id, status, priority, due_date, completed_at");
    if (error) throw error;
    const tasks = (data ?? []).map(safeTask);
    return { tasks, count: tasks.length };
  }

  throw new Error(`Unsupported tool: ${name}`);
}
