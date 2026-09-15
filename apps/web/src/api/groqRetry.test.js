import { describe, expect, it, vi } from "vitest";
import { callGroqWithRetry, retryDelayMs } from "../../../../supabase/functions/agent-chat/groqRetry";

describe("Groq rate-limit retry", () => {
  it("retries one 429 using Retry-After and returns the next response", async () => {
    const limited = new Response("rate limited", { status: 429, headers: { "Retry-After": "2" } });
    const success = new Response("ok", { status: 200 });
    const fetcher = vi.fn().mockResolvedValueOnce(limited).mockResolvedValueOnce(success);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(callGroqWithRetry("https://example.test", {}, 1, fetcher, wait)).resolves.toBe(success);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(2250);
  });

  it("honors fractional provider retry delays and caps excessive waits", () => {
    expect(retryDelayMs(new Response(null, { status: 429, headers: { "Retry-After": "3.817" } }))).toBe(3817);
    expect(retryDelayMs(new Response(null, { status: 429, headers: { "Retry-After": "90" } }))).toBe(60000);
    expect(retryDelayMs(new Response(null, { status: 429 }))).toBe(1500);
  });
});
