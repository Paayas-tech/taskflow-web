import { requireSupabase } from "./client";

const apiBaseUrl = String(import.meta.env?.VITE_API_BASE_URL || "/api")
  .trim()
  .replace(/\/+$/u, "");

export const askAgent = async (message, messages = [], scope = {}) => {
  const prompt = String(message || "").trim();
  if (!prompt) throw new Error("Ask TaskFlow a question first.");

  const { data: sessionData, error: sessionError } = await requireSupabase().auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sign in again before using the TaskFlow Agent.");

  const response = await fetch(`${apiBaseUrl}/chat`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: prompt,
      messages,
      projectId: scope.projectId || null,
      workspaceId: scope.workspaceId || null,
    }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("TaskFlow API returned an invalid response.");
  }
  if (!response.ok) {
    throw new Error(String(data?.detail || data?.message || "TaskFlow API request failed."));
  }
  if (!data || typeof data.message !== "string" || !Array.isArray(data.actions)) {
    throw new Error("TaskFlow Agent returned an invalid response.");
  }
  return data;
};
