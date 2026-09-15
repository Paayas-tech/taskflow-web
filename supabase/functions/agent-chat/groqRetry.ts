type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const retryDelayMs = (response: Response, now = Date.now()) => {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return 1500;
  const seconds = Number(value);
  const parsed = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Math.min(3000, Math.max(0, Number.isFinite(parsed) ? parsed : 1500));
};

export const callGroqWithRetry = async (
  url: string,
  init: RequestInit,
  maxRetries = 1,
  fetcher: Fetcher = fetch,
  wait: (milliseconds: number) => Promise<unknown> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
) => {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetcher(url, init);
    if (response.status !== 429 || attempt >= maxRetries) return response;
    const waitMs = retryDelayMs(response);
    console.warn(`Groq 429 hit. Retrying after ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
    await response.body?.cancel();
    await wait(waitMs);
  }
  throw new Error("Groq retry loop ended unexpectedly.");
};
