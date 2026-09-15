export function compactConversationHistory(messages, maximumTurns = 4) {
  const exchanges = [];
  let current = null;
  messages.forEach((message) => {
    if (!message || (message.role !== "user" && message.role !== "assistant")) return;
    const content = typeof message.content === "string" ? message.content.trim().slice(0, 2000) : "";
    if (!content) return;
    if (message.role === "user") {
      current = [{ role: "user", content }];
      exchanges.push(current);
    } else if (current) {
      current.push({ role: "assistant", content });
    }
  });
  return exchanges.slice(-maximumTurns).flat();
}
