import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ requireSupabase: () => ({ functions: { invoke } }) }));

import { askAgent } from "./agent";

describe("askAgent", () => {
  beforeEach(() => invoke.mockReset());

  it("passes the prompt, history and context to the authenticated Edge Function", async () => {
    invoke.mockResolvedValue({ data: { message: "Two tasks.", actions: [] }, error: null });
    const history = [{ role: "user", content: "Earlier" }];
    const context = { timezone: "Asia/Kolkata" };

    await expect(askAgent("  What is due?  ", history, context)).resolves.toEqual({ message: "Two tasks.", actions: [] });
    expect(invoke).toHaveBeenCalledWith("agent-chat", { body: { message: "What is due?", conversationHistory: history, context } });
  });

  it("rejects blank prompts without invoking the function", async () => {
    await expect(askAgent("   ")).rejects.toThrow("Ask TaskFlow");
    expect(invoke).not.toHaveBeenCalled();
  });
});
