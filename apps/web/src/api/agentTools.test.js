import { describe, expect, it, vi } from "vitest";
import { executeAgentTool } from "../../../../supabase/functions/agent-chat/agentTools";

const context = {
  supabase: { from: () => { throw new Error("Database should not be reached for invalid input."); } },
  userId: "00000000-0000-4000-8000-000000000001",
  now: () => "2026-09-12T00:00:00.000Z",
};

describe("agent tool execution guards", () => {
  it("rejects an empty task title before querying Supabase", async () => {
    await expect(executeAgentTool("create_task", { title: "   " }, context)).rejects.toThrow("title is required");
  });

  it("resolves a create-task project name and applies safe defaults", async () => {
    const projectId = "00000000-0000-4000-8000-000000000010";
    const task = {
      id: "00000000-0000-4000-8000-000000000011",
      title: "Prepare launch notes",
      project_id: projectId,
      status: "todo",
      priority: "medium",
    };
    const projectLimit = vi.fn().mockResolvedValue({ data: [{ id: projectId, name: "web dev 01" }], error: null });
    const projectIlike = vi.fn(() => ({ limit: projectLimit }));
    const projectSelect = vi.fn(() => ({ ilike: projectIlike }));
    const single = vi.fn().mockResolvedValue({ data: task, error: null });
    const taskSelect = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select: taskSelect }));
    const duplicateLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const duplicateIlike = vi.fn(() => ({ limit: duplicateLimit }));
    const duplicateScope = { eq: vi.fn(() => ({ ilike: duplicateIlike })) };
    const duplicateSelect = vi.fn(() => ({ is: vi.fn(() => duplicateScope) }));
    const from = vi.fn((table) => table === "projects" ? { select: projectSelect } : { select: duplicateSelect, insert });

    await expect(executeAgentTool("create_task", {
      title: task.title,
      projectName: "web dev 01",
    }, { ...context, supabase: { from } })).resolves.toMatchObject({
      success: true, id: task.id, title: task.title, status: "todo",
    });
    expect(projectIlike).toHaveBeenCalledWith("name", "%web dev 01%");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: projectId,
      priority: "medium",
      status: "todo",
    }));
  });

  it("returns a structured error when a project task title already exists", async () => {
    const projectId = "00000000-0000-4000-8000-000000000012";
    const duplicateLimit = vi.fn().mockResolvedValue({ data: [{ id: "existing", title: "Prepare launch notes" }], error: null });
    const ilike = vi.fn(() => ({ limit: duplicateLimit }));
    const projectEq = vi.fn(() => ({ ilike }));
    const select = vi.fn(() => ({ is: vi.fn(() => ({ eq: projectEq })) }));
    const insert = vi.fn();
    const from = vi.fn(() => ({ select, insert }));

    await expect(executeAgentTool("create_task", {
      title: "Prepare launch notes",
      projectId,
    }, { ...context, supabase: { from } })).resolves.toEqual({
      success: false,
      error: 'A task named "Prepare launch notes" already exists in this project. Please choose a unique name.',
    });
    expect(ilike).toHaveBeenCalledWith("title", "Prepare launch notes");
    expect(insert).not.toHaveBeenCalled();
  });

  it("stops before querying tasks when the requested project cannot be resolved", async () => {
    const projectLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const projectIlike = vi.fn(() => ({ limit: projectLimit }));
    const projectSelect = vi.fn(() => ({ ilike: projectIlike }));
    const from = vi.fn((table) => table === "projects" ? { select: projectSelect } : undefined);

    await expect(executeAgentTool("create_task", {
      title: "Prepare launch notes",
      projectName: "  Missing Project  ",
    }, { ...context, supabase: { from } })).resolves.toEqual({
      success: false,
      error: 'Could not identify the project "Missing Project". Please specify a valid project name.',
    });
    expect(projectIlike).toHaveBeenCalledWith("name", "%Missing Project%");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid update status before querying Supabase", async () => {
    await expect(executeAgentTool("update_task", {
      task_id: "00000000-0000-4000-8000-000000000002",
      status: "blocked",
    }, context)).resolves.toEqual({ success: false, error: "Task status must be todo, in progress, or done." });
  });

  it("resolves an update target by title in the active project and normalizes its status", async () => {
    const projectId = "00000000-0000-4000-8000-000000000020";
    const taskId = "00000000-0000-4000-8000-000000000021";
    const updated = { id: taskId, title: "Write release notes", project_id: projectId, status: "in_progress", priority: "medium" };
    const limit = vi.fn().mockResolvedValue({ data: [
      { id: taskId, title: updated.title, status: "todo", updated_at: "2026-09-12T12:00:00Z" },
    ], error: null });
    const order = vi.fn(() => ({ limit }));
    const projectEq = vi.fn(() => ({ order }));
    const ilike = vi.fn(() => ({ eq: projectEq, order }));
    const is = vi.fn(() => ({ ilike }));
    const select = vi.fn(() => ({ is }));
    const maybeSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
    const updateSelect = vi.fn(() => ({ maybeSingle }));
    const updateEq = vi.fn(() => ({ select: updateSelect }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const from = vi.fn(() => ({ select, update }));

    await expect(executeAgentTool("update_task", {
      taskTitle: updated.title,
      status: "In Progress",
    }, { ...context, projectId, supabase: { from } })).resolves.toMatchObject({
      success: true, id: taskId, status: "in_progress",
    });
    expect(ilike).toHaveBeenCalledWith("title", updated.title);
    expect(projectEq).toHaveBeenCalledWith("project_id", projectId);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
    expect(updateEq).toHaveBeenCalledWith("id", taskId);
  });

  it("returns a structured error when a task title matches multiple tasks", async () => {
    const projectId = "00000000-0000-4000-8000-000000000020";
    const limit = vi.fn().mockResolvedValue({
      data: [
        { id: "first", title: "Release", status: "todo", project_id: projectId },
        { id: "second", title: "Release notes", status: "todo", project_id: projectId },
      ],
      error: null,
    });
    const order = vi.fn(() => ({ limit }));
    const projectEq = vi.fn(() => ({ order }));
    const ilike = vi.fn(() => ({ eq: projectEq, order }));
    const select = vi.fn(() => ({ is: vi.fn(() => ({ ilike })) }));
    const update = vi.fn();
    const from = vi.fn(() => ({ select, update }));

    await expect(executeAgentTool("update_task", {
      taskTitle: "Release",
      projectId,
      status: "done",
    }, { ...context, supabase: { from } })).resolves.toEqual({
      success: false,
      error: 'Multiple tasks found matching "Release". Please specify the exact title or rename duplicates.',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates a uniquely named task across accessible projects without project context", async () => {
    const projectId = "00000000-0000-4000-8000-000000000025";
    const taskId = "00000000-0000-4000-8000-000000000026";
    const matched = { id: taskId, title: "Configure SSL termination", project_id: projectId, status: "todo", updated_at: "2026-09-15T10:00:00Z" };
    const updated = { ...matched, status: "in_progress", priority: "medium" };
    const limit = vi.fn().mockResolvedValue({ data: [matched], error: null });
    const order = vi.fn(() => ({ limit }));
    const ilike = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ is: vi.fn(() => ({ ilike })) }));
    const maybeSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
    const updateSelect = vi.fn(() => ({ maybeSingle }));
    const updateEq = vi.fn(() => ({ select: updateSelect }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const from = vi.fn(() => ({ select, update }));

    await expect(executeAgentTool("update_task", {
      taskTitle: matched.title,
      status: "working on it",
    }, { ...context, projectId: undefined, supabase: { from } })).resolves.toMatchObject({
      success: true, id: taskId, status: "in_progress",
    });
    expect(ilike).toHaveBeenCalledWith("title", matched.title);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
  });

  it("reports cross-project ambiguity instead of updating a title match", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        { id: "first", title: "Configure SSL termination", project_id: "project-one", updated_at: "2026-09-15T10:00:00Z" },
        { id: "second", title: "Configure SSL termination", project_id: "project-two", updated_at: "2026-09-14T10:00:00Z" },
      ],
      error: null,
    });
    const order = vi.fn(() => ({ limit }));
    const ilike = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ is: vi.fn(() => ({ ilike })) }));
    const update = vi.fn();
    const from = vi.fn(() => ({ select, update }));

    await expect(executeAgentTool("update_task", {
      taskTitle: "Configure SSL termination",
      status: "in progress",
    }, { ...context, projectId: undefined, supabase: { from } })).resolves.toEqual({
      success: false,
      error: 'Found multiple tasks named "Configure SSL termination" across different projects. Please specify which project you mean.',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("maps critical priority to the highest schema-supported priority", async () => {
    const projectId = "00000000-0000-4000-8000-000000000024";
    const task = {
      id: "00000000-0000-4000-8000-000000000023",
      title: "Restore production",
      project_id: projectId,
      status: "todo",
      priority: "high",
    };
    const single = vi.fn().mockResolvedValue({ data: task, error: null });
    const insertedSelect = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select: insertedSelect }));
    const duplicateLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const duplicateIlike = vi.fn(() => ({ limit: duplicateLimit }));
    const projectEq = vi.fn(() => ({ ilike: duplicateIlike }));
    const duplicateSelect = vi.fn(() => ({ is: vi.fn(() => ({ eq: projectEq })) }));
    const from = vi.fn(() => ({ select: duplicateSelect, insert }));

    await executeAgentTool("create_task", { title: task.title, priority: "critical", projectId }, { ...context, supabase: { from } });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: projectId, priority: "high" }));
  });

  it("creates a viewer invitation when member is requested", async () => {
    const projectId = "00000000-0000-4000-8000-000000000024";
    const invoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });

    await expect(executeAgentTool("invite_member", {
      email: "Member@Example.com",
      projectId,
      role: "member",
    }, { ...context, supabase: { from: vi.fn(), functions: { invoke } } })).resolves.toMatchObject({
      success: true,
      email: "member@example.com",
      role: "viewer",
    });
    expect(invoke).toHaveBeenCalledWith("send-invitation-email", {
      body: { projectId, inviteeEmail: "member@example.com", role: "viewer" },
    });
  });

  it("creates normalized child tasks under a resolved parent task", async () => {
    const projectId = "00000000-0000-4000-8000-000000000030";
    const parentId = "00000000-0000-4000-8000-000000000031";
    const parent = { id: parentId, title: "Ship onboarding", project_id: projectId, status: "todo", priority: "high" };
    const children = [
      { id: "00000000-0000-4000-8000-000000000032", title: "Write copy", project_id: projectId, parent_task_id: parentId, status: "todo", priority: "high" },
      { id: "00000000-0000-4000-8000-000000000033", title: "Review analytics", project_id: projectId, parent_task_id: parentId, status: "todo", priority: "high" },
    ];
    const limit = vi.fn().mockResolvedValue({ data: [parent], error: null });
    const order = vi.fn(() => ({ limit }));
    const projectEq = vi.fn(() => ({ order }));
    const ilike = vi.fn(() => ({ eq: projectEq, order }));
    const is = vi.fn(() => ({ ilike }));
    const parentSelect = vi.fn(() => ({ is }));
    const childSelect = vi.fn().mockResolvedValue({ data: children, error: null });
    const insert = vi.fn(() => ({ select: childSelect }));
    const from = vi.fn(() => ({ select: parentSelect, insert }));

    await expect(executeAgentTool("generate_subtasks", {
      taskTitle: parent.title,
      projectId,
      subtasks: JSON.stringify(["Write copy", "Review analytics"]),
    }, { ...context, supabase: { from } })).resolves.toMatchObject({
      success: true,
      count: 2,
      titles: ["Write copy", "Review analytics"],
    });
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ title: "Write copy", project_id: projectId, parent_task_id: parentId, status: "todo" }),
      expect.objectContaining({ title: "Review analytics", project_id: projectId, parent_task_id: parentId, status: "todo" }),
    ]);
  });

  it("caps generated subtask lists at six items before querying the database", async () => {
    const from = vi.fn();
    await expect(executeAgentTool("generate_subtasks", {
      taskTitle: "Ship onboarding",
      subtasks: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"],
    }, { ...context, supabase: { from } })).resolves.toEqual({
      success: false,
      error: "A breakdown cannot contain more than 6 subtasks.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("builds a structured standup from tasks updated in the last 24 hours", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-12T00:00:00.000Z"));
    const rows = [
      { id: "done", title: "Release API", status: "done", updated_at: "2026-09-11T22:00:00Z", completed_at: "2026-09-11T22:00:00Z" },
      { id: "active", title: "Polish docs", status: "in_progress", updated_at: "2026-09-11T23:00:00Z", due_date: "2026-09-13" },
      { id: "late", title: "Fix blocker", status: "todo", priority: "high", updated_at: "2026-09-11T21:00:00Z", due_date: "2026-09-10" },
    ];
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ limit }));
    const gte = vi.fn(() => ({ order }));
    const is = vi.fn(() => ({ gte }));
    const select = vi.fn(() => ({ is }));
    const from = vi.fn(() => ({ select }));

    try {
      const result = await executeAgentTool("generate_daily_standup", {}, { ...context, supabase: { from } });
      expect(gte).toHaveBeenCalledWith("updated_at", "2026-09-11T00:00:00.000Z");
      expect(limit).toHaveBeenCalledWith(15);
      expect(result).toMatchObject({
        source: "last_24_hours",
        completed: ["Release API"],
        in_progress: ["Polish docs"],
        blockers: ["Fix blocker"],
      });
      expect(result.markdown).toContain("## Completed Today\n- Release API");
      expect(result.markdown).toContain("## Potential Blockers\n- Fix blocker");
    } finally {
      now.mockRestore();
    }
  });

  it("falls back to a bounded active-task summary when no tasks changed recently", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-12T00:00:00.000Z"));
    const recentLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const recentOrder = vi.fn(() => ({ limit: recentLimit }));
    const gte = vi.fn(() => ({ order: recentOrder }));
    const recentIs = vi.fn(() => ({ gte }));
    const activeRows = [{ id: "active", title: "Continue rollout", status: "in_progress", priority: null, due_date: null }];
    const activeLimit = vi.fn().mockResolvedValue({ data: activeRows, error: null });
    const activeOrder = vi.fn(() => ({ limit: activeLimit }));
    const statusIn = vi.fn(() => ({ order: activeOrder }));
    const activeIs = vi.fn(() => ({ in: statusIn }));
    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn(() => ({ is: recentIs })) })
      .mockReturnValueOnce({ select: vi.fn(() => ({ is: activeIs })) });

    try {
      const result = await executeAgentTool("generate_daily_standup", {}, { ...context, supabase: { from } });
      expect(statusIn).toHaveBeenCalledWith("status", ["todo", "in_progress"]);
      expect(activeLimit).toHaveBeenCalledWith(15);
      expect(result).toMatchObject({
        source: "active_fallback",
        completed: [],
        in_progress: ["Continue rollout"],
        blockers: [],
      });
    } finally {
      now.mockRestore();
    }
  });

  it("returns a structured standup error when the task query fails", async () => {
    const limit = vi.fn().mockResolvedValue({ data: null, error: { message: "standup query denied" } });
    const order = vi.fn(() => ({ limit }));
    const gte = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ is: vi.fn(() => ({ gte })) }));
    const from = vi.fn(() => ({ select }));

    await expect(executeAgentTool("generate_daily_standup", {}, {
      ...context,
      supabase: { from },
    })).resolves.toEqual({ success: false, error: "standup query denied" });
  });

  it("resolves a standup project name when no project page context exists", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-12T00:00:00.000Z"));
    const projectId = "00000000-0000-4000-8000-000000000040";
    const projectLimit = vi.fn().mockResolvedValue({ data: [{ id: projectId, name: "web dev 01" }], error: null });
    const projectIlike = vi.fn(() => ({ limit: projectLimit }));
    const projectSelect = vi.fn(() => ({ ilike: projectIlike }));
    const taskLimit = vi.fn().mockResolvedValue({
      data: [{ id: "active", title: "Ship release", status: "in_progress", priority: "high", updated_at: "2026-09-11T23:00:00Z" }],
      error: null,
    });
    const order = vi.fn(() => ({ limit: taskLimit }));
    const projectEq = vi.fn(() => ({ order }));
    const gte = vi.fn(() => ({ eq: projectEq, order }));
    const taskIs = vi.fn(() => ({ gte }));
    const taskSelect = vi.fn(() => ({ is: taskIs }));
    const from = vi.fn((table) => table === "projects" ? { select: projectSelect } : { select: taskSelect });

    try {
      const result = await executeAgentTool("generate_daily_standup", {
        projectName: "web dev 01",
      }, { ...context, supabase: { from } });
      expect(projectIlike).toHaveBeenCalledWith("name", "%web dev 01%");
      expect(projectEq).toHaveBeenCalledWith("project_id", projectId);
      expect(result).toMatchObject({
        source: "last_24_hours",
        in_progress: ["Ship release"],
      });
    } finally {
      now.mockRestore();
    }
  });

  it("rejects unsupported tools", async () => {
    await expect(executeAgentTool("delete_everything", {}, context)).rejects.toThrow("Unsupported tool");
  });

  it("returns a descriptive delete error instead of throwing", async () => {
    await expect(executeAgentTool("delete_task", { taskId: "not-an-id" }, context))
      .resolves.toEqual({ success: false, error: "Provide a valid task ID or task title." });
  });

  it("deletes through the authenticated Supabase client", async () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000002",
      title: "Old task",
      project_id: null,
      status: "todo",
      priority: "medium",
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const deleteSelect = vi.fn().mockResolvedValue({ data: [row], error: null });
    const match = vi.fn(() => ({ select: deleteSelect }));
    const deleteQuery = vi.fn(() => ({ match }));
    const from = vi.fn(() => ({ select, delete: deleteQuery }));

    await expect(executeAgentTool("delete_task", { taskId: row.id }, { ...context, supabase: { from } }))
      .resolves.toMatchObject({ success: true, id: row.id, title: "Old task" });
    expect(from).toHaveBeenCalledWith("tasks");
    expect(deleteQuery).toHaveBeenCalledOnce();
    expect(match).toHaveBeenCalledWith({ id: row.id });
  });

  it("resolves a unique task title before deleting", async () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000003",
      title: "Fix login bug",
      project_id: null,
      status: "todo",
      priority: "high",
    };
    const limit = vi.fn().mockResolvedValue({ data: [row], error: null });
    const order = vi.fn(() => ({ limit }));
    const ilike = vi.fn(() => ({ order }));
    const is = vi.fn(() => ({ ilike }));
    const select = vi.fn(() => ({ is }));
    const deleteSelect = vi.fn().mockResolvedValue({ data: [row], error: null });
    const match = vi.fn(() => ({ select: deleteSelect }));
    const deleteQuery = vi.fn(() => ({ match }));
    const from = vi.fn(() => ({ select, delete: deleteQuery }));

    await expect(executeAgentTool("delete_task", { taskTitle: "Fix login bug" }, { ...context, supabase: { from } }))
      .resolves.toMatchObject({ success: true, id: row.id, title: row.title });
    expect(ilike).toHaveBeenCalledWith("title", "Fix login bug");
    expect(match).toHaveBeenCalledWith({ id: row.id });
  });

  it("requires a bounded selection for bulk updates", async () => {
    await expect(executeAgentTool("bulk_update_tasks", {
      updates: { status: "done" },
    }, context)).rejects.toThrow("taskIds or at least one filter");
  });

  it("rejects invalid bulk updates before querying Supabase", async () => {
    await expect(executeAgentTool("bulk_update_tasks", {
      filters: { status: "todo" },
      updates: { status: "blocked" },
    }, context)).rejects.toThrow("Update status must be");
  });
});
