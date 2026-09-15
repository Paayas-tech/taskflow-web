import { describe, expect, it } from "vitest";
import { compactConversationHistory } from "./agentHistory";

describe("compactConversationHistory", () => {
  it("keeps only the last four complete user-led dialogue turns", () => {
    const messages = [{ role: "assistant", content: "Welcome" }];
    for (let index = 1; index <= 6; index += 1) {
      messages.push({ role: "user", content: `Question ${index}` });
      messages.push({ role: "assistant", content: `Answer ${index}`, actions: [{ large: "ignored" }] });
    }

    expect(compactConversationHistory(messages)).toEqual([
      { role: "user", content: "Question 3" },
      { role: "assistant", content: "Answer 3" },
      { role: "user", content: "Question 4" },
      { role: "assistant", content: "Answer 4" },
      { role: "user", content: "Question 5" },
      { role: "assistant", content: "Answer 5" },
      { role: "user", content: "Question 6" },
      { role: "assistant", content: "Answer 6" },
    ]);
  });
});
