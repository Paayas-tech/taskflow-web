import { describe, expect, it } from "vitest";
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

  it("rejects an invalid update status before querying Supabase", async () => {
    await expect(executeAgentTool("update_task", {
      task_id: "00000000-0000-4000-8000-000000000002",
      status: "blocked",
    }, context)).rejects.toThrow("status must be");
  });

  it("rejects unsupported tools", async () => {
    await expect(executeAgentTool("delete_everything", {}, context)).rejects.toThrow("Unsupported tool");
  });
});
