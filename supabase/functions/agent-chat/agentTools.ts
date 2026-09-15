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
  if (status === "to do" || status === "todo" || status === "backlog") return "todo";
  if (status === "in progress" || status === "progress" || status === "working on it") return "in_progress";
  if (status === "done" || status === "completed" || status === "finished") return "done";
  if (status === "in review" || status === "review") return "in_review";
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
  const normalizedName = lookupText(projectName);
  if (!normalizedName) throw new Error("A project name is required.");
  const escaped = normalizedName.replaceAll("%", "\\%").replaceAll("_", "\\_");
  const { data, error } = await supabase.from("projects").select("id, name").ilike("name", `%${escaped}%`).limit(10);
  if (error) throw error;
  if (!data?.length) throw new Error(`No accessible project matching “${normalizedName}” was found.`);
  const exactMatches = data.filter((project: Record<string, unknown>) =>
    String(project.name || "").trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
  );
  const matches = exactMatches.length ? exactMatches : data;
  if (matches.length > 1) throw new Error(`More than one accessible project matches “${normalizedName}”. Be more specific.`);
  return String(matches[0].id);
};

const activeProjectId = (input: Record<string, unknown>, context: AgentToolContext) => {
  const value = optionalText(input.projectId, 36) || context.projectId;
  return value ? requiredUuid(value, "projectId") : undefined;
};

const resolveProjectScope = async (input: Record<string, unknown>, context: AgentToolContext) => {
  const projectReference = optionalText(input.projectId, 120) || optionalText(input.project_id, 120);
  if (projectReference) {
    return UUID_PATTERN.test(projectReference)
      ? projectReference
      : resolveProjectId(context.supabase, projectReference);
  }
  const projectName = optionalText(input.projectName, 120) || optionalText(input.project, 120);
  if (projectName) return resolveProjectId(context.supabase, projectName);
  return context.projectId ? requiredUuid(context.projectId, "projectId") : undefined;
};

const resolveTaskByTitle = async (
  context: AgentToolContext,
  titleQuery: string,
  projectId?: string,
) => {
  const normalizedTitle = lookupText(titleQuery);
  if (!normalizedTitle) return { error: "Provide a task title." };
  const escaped = normalizedTitle.replaceAll("%", "\\%").replaceAll("_", "\\_");
  let query = context.supabase
    .from("tasks")
    .select("id, title, description, project_id, status, priority, due_date, completed_at, updated_at")
    .is("archived_at", null)
    .ilike("title", escaped);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(5);
  if (error) return { error: error.message || "Task lookup failed." };
  if (!data?.length) return { error: `No task found with title "${normalizedTitle}".` };
  if (data.length > 1) {
    const projectIds = new Set(data.map((task: Record<string, unknown>) => String(task.project_id || "personal")));
    if (projectIds.size > 1) {
      return { error: `Found multiple tasks named "${normalizedTitle}" across different projects. Please specify which project you mean.` };
    }
    return { error: `Multiple tasks found matching "${normalizedTitle}". Please specify the exact title or rename duplicates.` };
  }
  return { task: data[0] as Record<string, unknown> };
};

const unresolvedDependencies = async (context: AgentToolContext, taskId: string) => {
  const { data: dependencies, error: dependencyError } = await context.supabase
    .from("task_dependencies")
    .select("depends_on_task_id")
    .eq("task_id", taskId)
    .limit(100);
  if (dependencyError) {
    console.error("Error querying task_dependencies:", dependencyError);
    throw new Error(`Failed querying task_dependencies: ${dependencyError.message || "Unknown error"} (${dependencyError.code || "unknown"})`);
  }
  const dependencyRows = Array.isArray(dependencies) ? dependencies : [];
  if (!dependencyRows.length) return [];
  const prerequisiteIds = [...new Set(dependencyRows
    .map((dependency: Record<string, unknown>) => String(dependency.depends_on_task_id || ""))
    .filter(Boolean))];
  if (!prerequisiteIds.length) return [];
  const { data: prerequisites, error: prerequisiteError } = await context.supabase
    .from("tasks")
    .select("id, title, status")
    .in("id", prerequisiteIds);
  if (prerequisiteError) {
    console.error("Error fetching prerequisite tasks:", prerequisiteError);
    throw new Error(`Failed querying prerequisite tasks: ${prerequisiteError.message || "Unknown error"} (${prerequisiteError.code || "unknown"})`);
  }
  const prerequisiteTasks = Array.isArray(prerequisites) ? prerequisites : [];
  return prerequisiteTasks.filter((task: Record<string, unknown>) => task.status !== "done");
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
    const projects = (data ?? []).map((project: Record<string, unknown>) => ({ name: project.name, status: project.status }));
    return { success: true, count: projects.length, projects };
  }

  if (name === "query_tasks") {
    const projectId = input.project_id
      ? requiredUuid(input.project_id, "project_id")
      : optionalText(input.project_name, 120)
        ? await resolveProjectId(context.supabase, optionalText(input.project_name, 120)!)
        : undefined;
    const statusInput = optionalText(input.status, 20);
    const status = statusInput ? normalizeStatus(statusInput) : undefined;
    if (statusInput && !status) return { success: false, error: "Task status must be todo, in progress, or done." };
    if (status === "in_review") {
      return { success: false, error: "TaskFlow does not currently support an in-review task status. Use in progress, todo, or done." };
    }
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
    const tasks = (data ?? []).map((task: Record<string, unknown>) => ({
      title: task.title,
      status: task.status,
      priority: task.priority || "medium",
      due_date: task.due_date || null,
    }));
    return { success: true, count: tasks.length, tasks };
  }

  if (name === "create_task") {
    const title = optionalText(input.title, 200);
    if (!title) throw new Error("A task title is required.");
    const projectName = optionalText(input.projectName, 120) || optionalText(input.project, 120);
    const projectReference = projectName || optionalText(input.projectId, 120) || optionalText(input.project_id, 120);
    let projectId: string | undefined;
    try {
      projectId = await resolveProjectScope(input, context);
    } catch {
      return {
        success: false,
        error: `Could not identify the project "${projectReference || "unknown"}". Please specify a valid project name.`,
      };
    }
    if (!projectId) {
      return {
        success: false,
        error: `Could not identify the project "${projectReference || "unknown"}". Please specify a valid project name.`,
      };
    }
    const escapedTitle = title.replaceAll("%", "\\%").replaceAll("_", "\\_");
    const duplicateQuery = context.supabase
      .from("tasks")
      .select("id, title")
      .is("archived_at", null)
      .eq("project_id", projectId);
    const { data: existingTasks, error: duplicateError } = await duplicateQuery
      .ilike("title", escapedTitle)
      .limit(1);
    if (duplicateError) throw duplicateError;
    if (existingTasks?.length) {
      return {
        success: false,
        error: `A task named "${title}" already exists in this project. Please choose a unique name.`,
      };
    }
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
    return { success: true, id: data.id, title: data.title, status: data.status };
  }

  if (name === "add_task_dependency") {
    try {
      const taskTitle = optionalText(input.taskTitle, 200);
      const dependsOnTitle = optionalText(input.dependsOnTitle, 200);
      if (!taskTitle || !dependsOnTitle) {
        return { success: false, error: "Both the blocked task and prerequisite task titles are required." };
      }
      const projectId = await resolveProjectScope(input, context);
      const taskResolution = await resolveTaskByTitle(context, taskTitle, projectId);
      if (!taskResolution.task) return { success: false, error: taskResolution.error };
      const prerequisiteResolution = await resolveTaskByTitle(context, dependsOnTitle, projectId);
      if (!prerequisiteResolution.task) return { success: false, error: prerequisiteResolution.error };
      if (String(taskResolution.task.id) === String(prerequisiteResolution.task.id)) {
        return { success: false, error: "A task cannot depend on itself." };
      }
      const { error } = await context.supabase.from("task_dependencies").insert({
        task_id: taskResolution.task.id,
        depends_on_task_id: prerequisiteResolution.task.id,
      });
      if (error) {
        const message = error.code === "23505"
          ? `"${taskResolution.task.title}" already depends on "${prerequisiteResolution.task.title}".`
          : error.message || "The task dependency could not be created.";
        return { success: false, error: message };
      }
      return {
        success: true,
        task: taskResolution.task.title,
        blockedBy: prerequisiteResolution.task.title,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (name === "update_task") {
    const suppliedId = optionalText(input.task_id, 36) || optionalText(input.taskId, 36);
    let taskId = suppliedId && UUID_PATTERN.test(suppliedId) ? suppliedId : undefined;
    let targetTask: Record<string, unknown> | undefined;
    if (!taskId) {
      const titleQuery = optionalText(input.taskTitle, 200) || optionalText(input.query, 200);
      if (!titleQuery) throw new Error("Provide a valid task ID or task title.");
      const resolution = await resolveTaskByTitle(context, titleQuery, await resolveProjectScope(input, context));
      if (!resolution.task) return { success: false, error: resolution.error };
      targetTask = resolution.task;
      taskId = String(resolution.task.id);
    }
    if (!taskId) return { success: false, error: "Provide a valid task ID or task title." };
    const patch: Record<string, unknown> = {};
    const title = optionalText(input.title, 200);
    const priority = input.priority === undefined ? undefined : normalizePriority(input.priority);
    const statusInput = optionalText(input.status, 20);
    const status = statusInput ? normalizeStatus(statusInput) : undefined;
    if (statusInput && !status) return { success: false, error: "Task status must be todo, in progress, or done." };
    if (status === "in_review") {
      return { success: false, error: "TaskFlow does not currently support an in-review task status. Use in progress, todo, or done." };
    }
    if (input.title !== undefined) {
      if (!title) throw new Error("Task title cannot be empty.");
      patch.title = title;
    }
    if (priority) {
      patch.priority = priority;
    }
    if (status) {
      if (!TASK_STATUSES.has(status)) return { success: false, error: "Task status must be todo, in progress, or done." };
      if (status === "in_progress" || status === "done") {
        if (!targetTask) {
          const { data, error } = await context.supabase
            .from("tasks")
            .select("id, title, status, project_id")
            .eq("id", taskId)
            .maybeSingle();
          if (error) return { success: false, error: error.message || "The task could not be loaded." };
          if (!data) return { success: false, error: "The task was not found or cannot be updated." };
          targetTask = data;
        }
        const blockers = await unresolvedDependencies(context, taskId);
        if (blockers.length) {
          const blockerTitles = blockers.map((task: Record<string, unknown>) => String(task.title));
          const message = `Cannot mark "${targetTask.title}" as ${status} because it is blocked by: ${blockerTitles.map((value) => `"${value}"`).join(", ")}. Complete those first.`;
          return {
            success: false,
            blocked: true,
            blockers: blockerTitles,
            message,
            error: message,
          };
        }
      }
      patch.status = status;
      patch.completed_at = status === "done" ? context.now() : null;
    }
    if (input.due_date !== undefined) patch.due_date = input.due_date === null ? null : isoDate(input.due_date, "due_date");
    if (!Object.keys(patch).length) throw new Error("Provide at least one task field to update.");
    const { data, error: updateError } = await context.supabase.from("tasks").update(patch).eq("id", taskId).select("id, title, description, project_id, status, priority, due_date, completed_at").maybeSingle();
    if (updateError) {
      throw new Error(`Failed updating task status: ${updateError.message || "Unknown error"} (${updateError.code || "unknown"})`);
    }
    if (!data) throw new Error("The task was not found or cannot be updated.");
    return { success: true, id: data.id, title: data.title, status: data.status };
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
        const resolution = await resolveTaskByTitle(context, titleQuery, await resolveProjectScope(input, context));
        if (!resolution.task) return { success: false, error: resolution.error };
        task = resolution.task;
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
      const deleted = data?.[0] || task;
      return { success: true, id: deleted.id, title: deleted.title, status: deleted.status };
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
      story: story.title,
      total: tasks.length,
      completed,
      in_progress: inProgress,
      percentage: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      remaining: tasks.filter((task: Record<string, unknown>) => task.status !== "done").map((task: Record<string, unknown>) => String(task.title)),
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
      success: true,
      tasks: tasks.map((task: Record<string, unknown>) => ({
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
    return { success: true, days, people: [...groups.values()].map((person) => ({
      ...person,
      achievements: person.achievements.slice(0, 15),
    })) };
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
    try {
    const taskTitle = optionalText(input.taskTitle, 200);
    if (!taskTitle) throw new Error("A parent task title is required.");
    let rawSubtasks = input.subtasks;
    if (typeof rawSubtasks === "string") {
      try {
        rawSubtasks = JSON.parse(rawSubtasks);
      } catch {
        return { success: false, error: "Subtasks must be a valid list of task titles." };
      }
    }
    if (!Array.isArray(rawSubtasks) || !rawSubtasks.length) {
      throw new Error("Provide at least one subtask title.");
    }
    if (rawSubtasks.length > 6) throw new Error("A breakdown cannot contain more than 6 subtasks.");
    const seen = new Set<string>();
    const subtaskTitles = rawSubtasks.map((value) => {
      const title = optionalText(value, 200);
      if (!title) throw new Error("Every subtask must have a title.");
      const key = title.toLocaleLowerCase();
      if (seen.has(key)) throw new Error("Subtask titles must be distinct.");
      seen.add(key);
      return title;
    });
    const resolution = await resolveTaskByTitle(context, taskTitle, await resolveProjectScope(input, context));
    if (!resolution.task) return { success: false, error: resolution.error };
    const parent = resolution.task;
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
    if (error) return { success: false, error: error.message || "The subtasks could not be created." };
    return {
      success: true,
      parent: parent.title,
      titles: (data ?? []).map((task: Record<string, unknown>) => String(task.title)),
      count: data?.length ?? 0,
    };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (name === "generate_daily_standup") {
    try {
    const projectId = await resolveProjectScope(input, context);
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
    let { data, error } = await recentQuery.order("updated_at", { ascending: false }).limit(15);
    if (error) return { success: false, error: error.message || "The recent tasks could not be loaded." };

    let source: "last_24_hours" | "active_fallback" = "last_24_hours";
    if (!data?.length) {
      source = "active_fallback";
      let activeQuery = context.supabase
        .from("tasks")
        .select(selection)
        .is("archived_at", null)
        .in("status", ["todo", "in_progress"]);
      if (projectId) activeQuery = activeQuery.eq("project_id", projectId);
      const fallback = await activeQuery.order("updated_at", { ascending: false }).limit(15);
      data = fallback.data;
      error = fallback.error;
      if (error) return { success: false, error: error.message || "The active tasks could not be loaded." };
    }

    const tasks = (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      title: optionalText(row.title, 200) || "Untitled task",
      status: normalizeStatus(row.status, "todo"),
      priority: normalizePriority(row.priority),
      due_date: typeof row.due_date === "string" ? row.due_date : null,
    }));
    const completed = tasks.filter((task) => task.status === "done");
    const inProgress = tasks.filter((task) => task.status === "in_progress");
    const riskBlockers = tasks.filter((task) =>
      (task.status === "todo" && task.priority === "high")
      || (task.status !== "done" && task.due_date !== null && task.due_date < today)
    );
    const blockerLabels = new Set(riskBlockers.map((task) => task.title));
    const activeTasks = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
    if (activeTasks.length) {
      const activeIds = activeTasks.map((task) => task.id);
      const { data: dependencies, error: dependencyError } = await context.supabase
        .from("task_dependencies")
        .select("task_id, depends_on_task_id")
        .in("task_id", activeIds)
        .limit(100);
      if (dependencyError) return { success: false, error: dependencyError.message || "Task blockers could not be loaded." };
      const prerequisiteIds = [...new Set((dependencies ?? []).map((dependency: Record<string, unknown>) => String(dependency.depends_on_task_id)))];
      if (prerequisiteIds.length) {
        const { data: prerequisites, error: prerequisiteError } = await context.supabase
          .from("tasks")
          .select("id, title, status")
          .in("id", prerequisiteIds);
        if (prerequisiteError) return { success: false, error: prerequisiteError.message || "Prerequisite tasks could not be loaded." };
        const unresolved = new Map((prerequisites ?? [])
          .filter((task: Record<string, unknown>) => task.status !== "done")
          .map((task: Record<string, unknown>) => [String(task.id), String(task.title)]));
        const activeTitles = new Map(activeTasks.map((task) => [task.id, task.title]));
        const grouped = new Map<string, string[]>();
        for (const dependency of dependencies ?? []) {
          const prerequisite = unresolved.get(String(dependency.depends_on_task_id));
          if (!prerequisite) continue;
          const taskId = String(dependency.task_id);
          grouped.set(taskId, [...(grouped.get(taskId) ?? []), prerequisite]);
        }
        for (const [taskId, prerequisiteTitles] of grouped) {
          blockerLabels.add(`${activeTitles.get(taskId) || "Task"} — blocked by ${prerequisiteTitles.join(", ")}`);
        }
      }
    }
    const section = (heading: string, items: string[]) =>
      `## ${heading}\n${items.length ? items.map((title) => `- ${title.replace(/[\r\n]+/gu, " ")}`).join("\n") : "- None"}`;
    const completedTitles = completed.map((task) => task.title);
    const inProgressTitles = inProgress.map((task) => task.title);
    const blockers = [...blockerLabels];
    const markdown = [
      "# Daily Standup",
      section("Completed Today", completedTitles),
      section("Working On Today", inProgressTitles),
      section("Blockers", blockers),
    ].join("\n\n");
    return {
      success: true,
      source,
      completed: completedTitles,
      in_progress: inProgressTitles,
      blockers,
      markdown,
    };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
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
    if (!ids.length) return { success: true, updated: [], count: 0 };

    const { data, error } = await context.supabase
      .from("tasks")
      .update(patch)
      .in("id", ids)
      .select("id, title, description, project_id, status, priority, due_date, completed_at");
    if (error) throw error;
    const tasks = (data ?? []).map((task: Record<string, unknown>) => ({
      title: task.title,
      status: task.status,
      due_date: task.due_date || null,
    }));
    return { success: true, updated: tasks.slice(0, 25), count: tasks.length, truncated: tasks.length > 25 };
  }

  throw new Error(`Unsupported tool: ${name}`);
}
