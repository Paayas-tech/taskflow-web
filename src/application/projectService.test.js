import { describe, expect, it, vi } from "vitest";
import { createProjectService } from "./projectService";

const projectRow = (overrides = {}) => ({
  id: "project-a",
  ownerId: "user-a",
  name: "Launch",
  description: "",
  color: "#6657c8",
  status: "active",
  dueDate: "",
  ...overrides,
});

describe("Supabase project application service", () => {
  it("creates a trimmed owner project", async () => {
    const repository = {
      createProject: vi.fn().mockResolvedValue(projectRow()),
    };
    const service = createProjectService(repository);

    await service.createProject("user-a", {
      name: " Launch ",
      description: "Ship it",
      color: "#6657c8",
    });

    expect(repository.createProject).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ name: "Launch", status: "active" })
    );
  });

  it("rejects an empty project name before reaching the repository", async () => {
    const repository = { createProject: vi.fn() };
    const service = createProjectService(repository);

    await expect(service.createProject("user-a", { name: "  " })).rejects.toThrow(
      "Project name cannot be empty"
    );
    expect(repository.createProject).not.toHaveBeenCalled();
  });

  it("rejects project descriptions longer than 1,000 characters", async () => {
    const repository = { createProject: vi.fn() };
    const service = createProjectService(repository);

    await expect(service.createProject("user-a", {
      name: "Launch",
      description: "x".repeat(1001),
    })).rejects.toThrow("1,000 characters or fewer");
    expect(repository.createProject).not.toHaveBeenCalled();
  });

  it("normalizes invitation email and role", async () => {
    const repository = { createProjectInvitation: vi.fn().mockResolvedValue({ id: "invite-a" }) };
    const service = createProjectService(repository);

    await service.createProjectInvitation("owner-a", "project-a", {
      email: " Member@Example.COM ", role: "viewer", projectName: " Launch ",
    });

    expect(repository.createProjectInvitation).toHaveBeenCalledWith(
      "owner-a",
      "project-a",
      expect.objectContaining({
        email: "member@example.com", role: "viewer", projectName: "Launch",
      })
    );
  });

  it("rejects invalid invitation inputs before the repository", async () => {
    const repository = { createProjectInvitation: vi.fn() };
    const service = createProjectService(repository);

    await expect(service.createProjectInvitation("owner-a", "project-a", {
      email: "not-an-email", role: "admin",
    })).rejects.toThrow("valid email");
    expect(repository.createProjectInvitation).not.toHaveBeenCalled();
  });

  it("forwards invitation responses and member role changes", async () => {
    const repository = {
      respondToInvitation: vi.fn(),
      updateProjectMemberRole: vi.fn(),
    };
    const service = createProjectService(repository);

    await service.acceptProjectInvitation("member-a", "invite-a");
    await service.updateProjectMemberRole("owner-a", "project-a", "member-a", "editor");

    expect(repository.respondToInvitation).toHaveBeenCalledWith("member-a", "invite-a", "accepted");
    expect(repository.updateProjectMemberRole).toHaveBeenCalledWith(
      "owner-a", "project-a", "member-a", "editor"
    );
  });

  it("normalizes optional task assignees and forwards assignment changes", async () => {
    const repository = { setTaskAssignee: vi.fn() };
    const service = createProjectService(repository);

    await expect(
      service.setTaskAssignee("owner-a", "project-a", "task-a", " member-a ")
    ).resolves.toBe("member-a");
    await expect(
      service.setTaskAssignee("owner-a", "project-a", "task-a", "")
    ).resolves.toBeNull();

    expect(repository.setTaskAssignee).toHaveBeenNthCalledWith(
      1, "owner-a", "project-a", "task-a", "member-a"
    );
    expect(repository.setTaskAssignee).toHaveBeenNthCalledWith(
      2, "owner-a", "project-a", "task-a", null
    );
  });

  it("clears personal-list placement when creating a project task", async () => {
    const repository = {
      createProjectTask: vi.fn().mockResolvedValue({ id: "task-a" }),
      deleteProjectTask: vi.fn(),
    };
    const placementRepository = {
      setTaskList: vi.fn().mockResolvedValue(undefined),
    };
    const service = createProjectService(repository, placementRepository);

    await service.createProjectTask("owner-a", "project-a", {
      title: "Prepare launch",
      listId: "legacy-list-a",
    });

    expect(placementRepository.setTaskList).toHaveBeenCalledWith(
      "owner-a",
      "task-a",
      null
    );
  });

  it("normalizes and orders assigned project task metadata", async () => {
    const repository = {
      getAssignedProjectTasks: vi.fn().mockResolvedValue([
        {
          id: "task-upcoming",
          title: "Upcoming",
          status: "todo",
          priority: "low",
          due_date: "2026-08-22",
          project_id: "project-a",
          projects: { name: "Launch", status: "active" },
          task_assignments: [
            { user_id: "user-a", assigned_at: "2026-08-19T10:00:00.000Z" },
          ],
        },
        {
          id: "task-overdue",
          title: "Overdue",
          status: "in_progress",
          priority: "high",
          due_date: "2026-08-19",
          project_id: "project-b",
          projects: { name: "Website", status: "active" },
          task_assignments: [{ user_id: "user-a", assigned_at: null }],
        },
      ]),
      taskRowToDocument: (row) => ({
        ...row,
        projectId: row.project_id,
        dueDate: row.due_date,
      }),
    };
    const service = createProjectService(repository);

    const tasks = await service.getAssignedProjectTasks(
      "user-a",
      new Date(2026, 7, 20)
    );

    expect(tasks.map(({ id }) => id)).toEqual(["task-overdue", "task-upcoming"]);
    expect(tasks[0]).toEqual(
      expect.objectContaining({
        projectId: "project-b",
        projectName: "Website",
        projectStatus: "active",
        assigneeId: "user-a",
      })
    );
  });

  it("restores a persisted assignee from Supabase's to-one relationship shape", async () => {
    const repository = {
      getProjectTasks: vi.fn().mockResolvedValue([
        {
          id: "task-a",
          title: "Prepare launch",
          status: "todo",
          priority: "medium",
          task_assignments: {
            user_id: "member-a",
            assigned_at: "2026-08-28T08:30:00.000Z",
          },
          assignee_display_name: "Priya Shah",
        },
      ]),
      taskRowToDocument: (row) => row,
    };
    const service = createProjectService(repository);

    const result = await service.getProjectTasks("owner-a", "project-a");

    expect(result).toEqual([
      expect.objectContaining({
        id: "task-a",
        assigneeId: "member-a",
        assigneeName: "Priya Shah",
      }),
    ]);
  });

  it("normalizes assigned-task metadata from Supabase's to-one relationship shape", async () => {
    const repository = {
      getAssignedProjectTasks: vi.fn().mockResolvedValue([
        {
          id: "task-a",
          title: "Prepare launch",
          status: "todo",
          priority: "medium",
          task_assignments: {
            user_id: "member-a",
            assigned_at: "2026-08-28T08:30:00.000Z",
          },
          assignee_display_name: "Priya Shah",
          projects: { name: "Launch", status: "active" },
        },
      ]),
      taskRowToDocument: (row) => row,
    };
    const service = createProjectService(repository);

    const result = await service.getAssignedProjectTasks(
      "member-a",
      new Date(2026, 7, 28)
    );

    expect(result[0]).toEqual(expect.objectContaining({
      assigneeId: "member-a",
      assigneeName: "Priya Shah",
      assignedAt: "2026-08-28T08:30:00.000Z",
    }));
  });

  it("returns an empty assigned-task list", async () => {
    const service = createProjectService({
      getAssignedProjectTasks: vi.fn().mockResolvedValue([]),
      taskRowToDocument: vi.fn(),
    });

    await expect(
      service.getAssignedProjectTasks("user-a", new Date(2026, 7, 20))
    ).resolves.toEqual([]);
  });

  it("validates comment content before repository writes", async () => {
    const repository = {
      createTaskComment: vi.fn().mockResolvedValue({ id: "comment-a" }),
      updateTaskComment: vi.fn(),
    };
    const service = createProjectService(repository);

    await service.createTaskComment("user-a", "task-a", "  Ready for review  ");
    expect(repository.createTaskComment).toHaveBeenCalledWith(
      "user-a", "task-a", "Ready for review"
    );
    await expect(service.createTaskComment("user-a", "task-a", "  ")).rejects.toThrow(
      "Write a comment"
    );
    await expect(service.updateTaskComment("user-a", "comment-a", "")).rejects.toThrow(
      "cannot be empty"
    );
  });

  it("forwards collaboration reads and realtime subscriptions", async () => {
    const unsubscribe = vi.fn();
    const repository = {
      getTaskComments: vi.fn().mockResolvedValue([]),
      getProjectActivity: vi.fn().mockResolvedValue([]),
      getTaskActivity: vi.fn().mockResolvedValue([]),
      subscribeToTaskComments: vi.fn().mockReturnValue(unsubscribe),
      subscribeToProjectActivity: vi.fn().mockReturnValue(unsubscribe),
    };
    const service = createProjectService(repository);

    await service.getTaskComments("user-a", "task-a");
    await service.getProjectActivity("user-a", "project-a", 10);
    await service.getTaskActivity("user-a", "task-a", 5);
    expect(service.subscribeToTaskComments("task-a", vi.fn())).toBe(unsubscribe);
    expect(service.subscribeToProjectActivity("project-a", vi.fn())).toBe(unsubscribe);
  });
});
