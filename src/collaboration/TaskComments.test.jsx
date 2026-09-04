import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskComments } from "./TaskComments";
import { renderPage, seedStore } from "../test/renderApp";

const MEMBER_ID = "8f1c9f0a-1c2b-4a7f-9a3e-0d7c5b6e1234";

const members = [
  { userId: MEMBER_ID, role: "editor", displayName: "Dana Cruz", avatarUrl: "" },
];

const seedComments = (comments = []) => seedStore({ comments });

describe("TaskComments", () => {
  it("posts a comment", async () => {
    const user = userEvent.setup();
    const { api } = await seedComments();
    renderPage(<TaskComments taskId="task-1" members={members} />);

    await screen.findByText("No comments yet");
    await user.type(screen.getByLabelText("Write a comment"), "Looks good to me");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => expect(api.callCount("createComment")).toBe(1));
    expect(api.callsOf("createComment")[0]).toEqual(["task-1", "Looks good to me"]);
    expect(await screen.findByText("Looks good to me")).toBeInTheDocument();
  });

  it("stores a mention by id but never shows one", async () => {
    const user = userEvent.setup();
    const { api } = await seedComments();
    renderPage(<TaskComments taskId="task-1" members={members} />);

    await screen.findByText("No comments yet");
    await user.click(screen.getByRole("button", { name: "Mention" }));
    await user.click(screen.getByRole("menuitem", { name: "@Dana Cruz" }));
    await user.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => expect(api.callCount("createComment")).toBe(1));
    expect(api.callsOf("createComment")[0][1].trim()).toBe(
      `@[Dana%20Cruz](user:${MEMBER_ID})`
    );
    expect(await screen.findByText("@Dana Cruz")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(MEMBER_ID))).not.toBeInTheDocument();
  });

  it("explains a failure to post without losing the draft", async () => {
    const user = userEvent.setup();
    const { api } = await seedComments();
    api.failNext("createComment", new Error("Comments must be 4,000 characters or fewer."));
    renderPage(<TaskComments taskId="task-1" members={members} />);

    await screen.findByText("No comments yet");
    await user.type(screen.getByLabelText("Write a comment"), "Too long");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(
      await screen.findByText("Comments must be 4,000 characters or fewer.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Write a comment")).toHaveValue("Too long");
  });

  it("shows the discussion and reloads it when the realtime channel fires", async () => {
    const { api } = await seedComments([
      {
        id: "comment-1",
        taskId: "task-1",
        userId: MEMBER_ID,
        displayName: "Dana Cruz",
        content: "Shipping tomorrow",
        editedAt: null,
        createdAt: "2026-02-01T10:00:00.000Z",
      },
    ]);
    renderPage(<TaskComments taskId="task-1" members={members} />);

    expect(await screen.findByText("Shipping tomorrow")).toBeInTheDocument();

    api.data.comments.push({
      id: "comment-2",
      taskId: "task-1",
      userId: "user-1",
      displayName: "Sam Rivera",
      content: "Thanks Dana",
      editedAt: null,
      createdAt: "2026-02-01T11:00:00.000Z",
    });
    api.emit("comments:task-1");

    expect(await screen.findByText("Thanks Dana")).toBeInTheDocument();
  });
});
