type Message = Record<string, any>;

const text = (value: unknown, maximum = 2000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";

const compactToolResult = (message: Message, toolName = "task action") => {
  try {
    const parsed = JSON.parse(String(message.content || "{}"));
    if (parsed?.success === false || parsed?.error) {
      return JSON.stringify({ success: false, error: text(parsed.error || "The action failed.", 500) });
    }
  } catch {
    // Historical tool output is intentionally replaced even when it is not JSON.
  }
  return JSON.stringify({ success: true, summary: `Completed ${toolName.replaceAll("_", " ")}` });
};

const validExchange = (messages: Message[], compactTools: boolean) => {
  const output: Message[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "user") {
      const content = text(message.content);
      if (content) output.push({ role: "user", content });
      continue;
    }
    if (message.role !== "assistant") continue;

    const content = text(message.content);
    const calls = Array.isArray(message.tool_calls)
      ? message.tool_calls.filter((call: any) => typeof call?.id === "string" && call.id && typeof call?.function?.name === "string")
      : [];
    if (!calls.length) {
      if (content) output.push({ role: "assistant", content });
      continue;
    }

    const expected = new Set(calls.map((call: any) => call.id));
    const tools: Message[] = [];
    let cursor = index + 1;
    while (cursor < messages.length && messages[cursor]?.role === "tool") {
      const tool = messages[cursor];
      if (expected.has(tool.tool_call_id)) tools.push(tool);
      cursor += 1;
    }
    const received = new Set(tools.map((tool) => tool.tool_call_id));
    if ([...expected].some((id) => !received.has(id))) {
      index = cursor - 1;
      continue;
    }

    output.push({ role: "assistant", content: content || null, tool_calls: calls });
    const names = new Map(calls.map((call: any) => [call.id, call.function.name]));
    for (const tool of tools) {
      output.push({
        role: "tool",
        tool_call_id: tool.tool_call_id,
        content: compactTools
          ? compactToolResult(tool, names.get(tool.tool_call_id))
          : text(tool.content, 3000) || JSON.stringify({ success: true }),
      });
    }
    index = cursor - 1;
  }
  return output;
};

export const pruneModelMessages = (messages: unknown[], maximumTurns = 4) => {
  const source = Array.isArray(messages) ? messages.filter((item): item is Message => Boolean(item && typeof item === "object")) : [];
  const system = source.find((message) => message.role === "system" && text(message.content));
  const exchanges: Message[][] = [];
  let current: Message[] | null = null;
  for (const message of source) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      current = [message];
      exchanges.push(current);
    } else if (current) {
      current.push(message);
    }
  }

  const retained = exchanges.slice(-maximumTurns);
  const output: Message[] = system ? [{ role: "system", content: text(system.content, 12000) }] : [];
  retained.forEach((exchange, index) => {
    output.push(...validExchange(exchange, index < retained.length - 1));
  });
  return output;
};
