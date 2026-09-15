import { requireSupabase } from "./client";

export const askAgent = async (message, messages = [], scope = {}) => {
  const prompt = String(message || "").trim();
  if (!prompt) throw new Error("Ask TaskFlow a question first.");

  const { data, error } = await requireSupabase().functions.invoke("agent-chat", {
    body: {
      message: prompt,
      messages,
      projectId: scope.projectId || null,
      workspaceId: scope.workspaceId || null,
    },
  });
  if (error) throw error;
  if (!data || typeof data.message !== "string" || !Array.isArray(data.actions)) {
    throw new Error("TaskFlow Agent returned an invalid response.");
  }
  return data;
};
