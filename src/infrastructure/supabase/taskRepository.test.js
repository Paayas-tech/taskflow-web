import { describe, expect, it, vi } from "vitest";
import {
  createTaskRepository,
  taskRowToDocument,
} from "./taskRepository";

const queryResult = (result = { data: [], error: null }) => {
  const calls = [];
  const query = {
    calls,
    select(...args) {
      calls.push(["select", ...args]);
      return this;
    },
    eq(...args) {
      calls.push(["eq", ...args]);
      return this;
    },
    is(...args) {
      calls.push(["is", ...args]);
      return this;
    },
    order(...args) {
      calls.push(["order", ...args]);
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
};

describe("Supabase task repository", () => {
  it("scopes reads to the creator and personal tasks", async () => {
    const query = queryResult();
    const client = { from: vi.fn(() => query) };
    const repository = createTaskRepository(client);

    await repository.getPersonalTasks("user-a");

    expect(client.from).toHaveBeenCalledWith("tasks");
    expect(query.calls).toContainEqual(["eq", "created_by", "user-a"]);
    expect(query.calls).toContainEqual(["is", "project_id", null]);
  });

  it("maps database fields and list placement to the existing task contract", () => {
    expect(
      taskRowToDocument({
        status: "done",
        due_date: "2026-08-17",
        start_time: "09:30:00",
        reminder_enabled: true,
        reminder_at: "2026-08-17T08:30:00.000Z",
        task_list_placements: [{ list_id: "list-a" }],
      })
    ).toMatchObject({
      status: "completed",
      completed: true,
      dueDate: "2026-08-17",
      startTime: "09:30",
      reminder: true,
      listId: "list-a",
      projectId: null,
    });
  });
});
