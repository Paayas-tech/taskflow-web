import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ apiRequest }));

import { askAgent } from "./agent";

describe("askAgent", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    vi.restoreAllMocks();
  });

  it("passes the prompt, history and context to the authenticated API", async () => {
    apiRequest.mockResolvedValue({ message: "Two tasks.", actions: [] });
    const history = [{ role: "user", content: "Earlier" }];
    const context = { projectId: "project-1", workspaceId: null };

    await expect(askAgent("  What is due?  ", history, context)).resolves.toEqual({ message: "Two tasks.", actions: [] });
    expect(apiRequest).toHaveBeenCalledWith("/chat", {
      method: "POST",
      body: JSON.stringify({ message: "What is due?", messages: history, projectId: "project-1", workspaceId: null }),
    });
  });

  it("rejects blank prompts without calling the API", async () => {
    const fetchMock = apiRequest;
    await expect(askAgent("   ")).rejects.toThrow("Ask TaskFlow");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an API error detail", async () => {
    apiRequest.mockRejectedValue(new Error("Upstream rate limit reached."));
    await expect(askAgent("What is due?")).rejects.toThrow("Upstream rate limit reached.");
  });
});
