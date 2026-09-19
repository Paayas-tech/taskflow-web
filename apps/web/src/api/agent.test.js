import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ requireSupabase: () => ({ auth: { getSession } }) }));

import { askAgent } from "./agent";

describe("askAgent", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: "user-token" } }, error: null });
    vi.restoreAllMocks();
  });

  it("passes the prompt, history and context to the authenticated API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Two tasks.", actions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const history = [{ role: "user", content: "Earlier" }];
    const context = { projectId: "project-1", workspaceId: null };

    await expect(askAgent("  What is due?  ", history, context)).resolves.toEqual({ message: "Two tasks.", actions: [] });
    expect(fetchMock).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What is due?", messages: history, projectId: "project-1", workspaceId: null }),
    });
  });

  it("rejects blank prompts without calling the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(askAgent("   ")).rejects.toThrow("Ask TaskFlow");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an API error detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Upstream rate limit reached." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(askAgent("What is due?")).rejects.toThrow("Upstream rate limit reached.");
  });
});
