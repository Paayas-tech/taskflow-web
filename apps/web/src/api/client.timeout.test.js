import { afterEach, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("times out a stalled request without leaving the mutation pending forever", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const pending = apiRequest("/tasks", { timeoutMs: 100 });
  const assertion = expect(pending).rejects.toThrow("took too long");
  await vi.advanceTimersByTimeAsync(100);
  await assertion;
});
