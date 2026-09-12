import { requireSupabase } from "./client";

export const askAgent = async (message, conversationHistory = [], context = {}) => {
  const prompt = String(message || "").trim();
  if (!prompt) throw new Error("Ask TaskFlow a question first.");

  const { data, error } = await requireSupabase().functions.invoke("agent-chat", {
    body: { message: prompt, conversationHistory, context },
  });
  if (error) throw error;
  if (!data || typeof data.message !== "string" || !Array.isArray(data.actions)) {
    throw new Error("TaskFlow Agent returned an invalid response.");
  }
  return data;
};
