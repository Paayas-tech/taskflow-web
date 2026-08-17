import { describe, expect, it, vi } from "vitest";
import { createTaskService } from "./taskService";

const row = (overrides = {}) => ({
  id: "task-a",
  created_by: "user-a",
  project_id: null,
  title: "Test task",
  description: "",
  notes: "",
  priority: "medium",
  status: "todo",
  due_date: null,
  start_date: null,
  start_time: null,
  end_date: null,
  end_time: null,
  reminder_enabled: false,
  reminder_at: null,
  completed_at: null,
  archived_at: null,
  created_at: "2026-08-17T00:00:00.000Z",
  updated_at: "2026-08-17T00:00:00.000Z",
  task_list_placements: [],
  ...overrides,
});

describe("Supabase task application service", () => {
  it("creates a personal task and preserves list placement", async () => {
    const repository = {
      createPersonalTask: vi.fn().mockResolvedValue(row()),
      setTaskList: vi.fn().mockResolvedValue(undefined),
      deletePersonalTask: vi.fn(),
    };
    const service = createTaskService(repository, {
      now: () => "2026-08-17T10:00:00.000Z",
    });

    await expect(
      service.createTask("user-a", {
        title: " Test task ",
        priority: "high",
        listId: "list-a",
      })
    ).resolves.toEqual({ id: "task-a" });

    expect(repository.createPersonalTask).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({
        title: "Test task",
        status: "todo",
      })
    );
    expect(repository.setTaskList).toHaveBeenCalledWith(
      "user-a",
      "task-a",
      "list-a"
    );
  });

  it("synchronizes completion status and timestamp", async () => {
    const repository = {
      getPersonalTask: vi.fn().mockResolvedValue(row()),
      updatePersonalTask: vi.fn().mockResolvedValue(row({ status: "done" })),
      setTaskList: vi.fn(),
    };
    const service = createTaskService(repository, {
      now: () => "2026-08-17T10:00:00.000Z",
    });

    await service.updateTask("user-a", "task-a", { completed: true });

    expect(repository.updatePersonalTask).toHaveBeenCalledWith(
      "user-a",
      "task-a",
      expect.objectContaining({
        status: "done",
        completed_at: "2026-08-17T10:00:00.000Z",
      })
    );
  });

  it("maps the existing in-progress status to the PostgreSQL enum value", async () => {
    const repository = {
      getPersonalTask: vi.fn().mockResolvedValue(row()),
      updatePersonalTask: vi.fn().mockResolvedValue(row({ status: "in_progress" })),
      setTaskList: vi.fn(),
    };
    const service = createTaskService(repository);

    await service.updateTask("user-a", "task-a", { status: "in-progress" });

    expect(repository.updatePersonalTask).toHaveBeenCalledWith(
      "user-a",
      "task-a",
      expect.objectContaining({ status: "in_progress" })
    );
  });

  it("returns only normalized personal rows supplied by the repository", async () => {
    const repository = {
      getPersonalTasks: vi.fn().mockResolvedValue([
        row({ status: "done", task_list_placements: [{ list_id: "list-a" }] }),
      ]),
    };
    const service = createTaskService(repository);

    await expect(service.getTasks("user-a")).resolves.toEqual([
      expect.objectContaining({
        id: "task-a",
        status: "completed",
        completed: true,
        listId: "list-a",
        projectId: null,
      }),
    ]);
  });

  it("moves an edited personal task into an owned project", async () => {
    const repository = {
      getPersonalTask: vi.fn().mockResolvedValue(row()),
      updatePersonalTask: vi.fn().mockResolvedValue(row()),
      setTaskList: vi.fn(),
      relocatePersonalTask: vi.fn().mockResolvedValue(undefined),
    };
    const service = createTaskService(repository);

    await service.updateTask("user-a", "task-a", { projectId: "project-a" });

    expect(repository.relocatePersonalTask).toHaveBeenCalledWith(
      "user-a",
      "task-a",
      "project-a"
    );
  });
});
