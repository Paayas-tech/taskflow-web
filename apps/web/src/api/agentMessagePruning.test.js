import { describe, expect, it } from "vitest";
import { pruneModelMessages } from "../../../../supabase/functions/agent-chat/messagePruning";

describe("pruneModelMessages", () => {
  it("drops orphaned tool exchanges and compacts retained historical tool output", () => {
    const messages = [
      { role: "system", content: "System rules" },
      { role: "tool", tool_call_id: "orphan", content: "large orphan" },
      { role: "user", content: "First" },
      { role: "assistant", content: null, tool_calls: [{ id: "missing", function: { name: "query_tasks", arguments: "{}" } }] },
      { role: "user", content: "Second" },
      { role: "assistant", content: null, tool_calls: [{ id: "kept", function: { name: "update_task", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "kept", content: JSON.stringify({ success: true, huge: "x".repeat(5000) }) },
      { role: "assistant", content: "Updated." },
      { role: "user", content: "Third" },
    ];

    const result = pruneModelMessages(messages, 2);
    expect(result[0]).toEqual({ role: "system", content: "System rules" });
    expect(result.some((message) => message.tool_call_id === "orphan" || message.tool_call_id === "missing")).toBe(false);
    expect(result.find((message) => message.tool_call_id === "kept")?.content)
      .toBe('{"success":true,"summary":"Completed update task"}');
    expect(result.at(-1)).toEqual({ role: "user", content: "Third" });
  });

  it("keeps every tool response belonging to the current complete assistant call", () => {
    const calls = [
      { id: "one", function: { name: "query_tasks", arguments: "{}" } },
      { id: "two", function: { name: "list_projects", arguments: "{}" } },
    ];
    const result = pruneModelMessages([
      { role: "system", content: "System" },
      { role: "user", content: "Check work" },
      { role: "assistant", content: null, tool_calls: calls },
      { role: "tool", tool_call_id: "one", content: '{"success":true,"count":2}' },
      { role: "tool", tool_call_id: "two", content: '{"success":true,"count":1}' },
    ]);

    expect(result.filter((message) => message.role === "tool")).toHaveLength(2);
  });
});
