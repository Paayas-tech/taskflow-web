import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityFeed } from "./ActivityFeed";
import { renderPage, seedStore } from "../test/renderApp";

const MEMBER_ID = "8f1c9f0a-1c2b-4a7f-9a3e-0d7c5b6e1234";

const members = [
  { userId: MEMBER_ID, role: "editor", displayName: "Dana Cruz", avatarUrl: "" },
];

const makeActivity = (overrides = {}) => ({
  id: "activity-1",
  projectId: "project-1",
  taskId: "task-1",
  userId: "user-1",
  displayName: "Sam Rivera",
  type: "task_created",
  metadata: { taskTitle: "Write the brief" },
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("ActivityFeed", () => {
  it("shows a project's recent history", async () => {
    const { api } = await seedStore({ activity: [makeActivity()] });
    renderPage(<ActivityFeed projectId="project-1" members={members} />);

    expect(await screen.findByText("Sam Rivera")).toBeInTheDocument();
    expect(screen.getByText("Sam Rivera").parentElement).toHaveTextContent(
      "Sam Rivera created a task"
    );
    expect(screen.getByText("Write the brief")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(api.callsOf("listProjectActivity")[0]).toEqual(["project-1", 30]);
    expect(api.callCount("subscribeToProjectActivity")).toBe(1);
  });

  it("reads only this task's history and reloads it when the channel fires", async () => {
    const { api } = await seedStore({
      activity: [
        makeActivity(),
        makeActivity({ id: "activity-2", taskId: "task-2", type: "task_updated" }),
      ],
    });
    renderPage(<ActivityFeed projectId="project-1" taskId="task-1" members={members} />);

    expect(await screen.findByText("Write the brief")).toBeInTheDocument();
    expect(api.callsOf("listTaskActivity")[0]).toEqual(["task-1", 20]);

    api.data.activity.push(
      makeActivity({
        id: "activity-3",
        type: "task_completed",
        metadata: { taskTitle: "Ship the brief" },
        createdAt: new Date().toISOString(),
      })
    );
    api.emit("activity:task:task-1");

    expect(await screen.findByText("Ship the brief")).toBeInTheDocument();
  });

  it("renders a live comment once, as the comment itself", async () => {
    await seedStore({
      activity: [
        makeActivity({
          id: "activity-comment",
          userId: MEMBER_ID,
          displayName: "Dana Cruz",
          type: "comment_added",
          metadata: { commentId: "comment-1" },
        }),
      ],
      comments: [
        {
          id: "comment-1",
          taskId: "task-1",
          userId: MEMBER_ID,
          displayName: "Dana Cruz",
          content: "Shipping tomorrow",
          editedAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    renderPage(
      <ActivityFeed projectId="project-1" taskId="task-1" includeComments members={members} />
    );

    expect(await screen.findByText("Shipping tomorrow")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("commented on a task");
  });

  it("refreshes on demand", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore({ activity: [makeActivity()] });
    renderPage(<ActivityFeed projectId="project-1" members={members} />);

    await screen.findByText("Write the brief");
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("History is up to date.")).toBeInTheDocument();
    await waitFor(() => expect(api.callCount("listProjectActivity")).toBe(2));
  });

  it("explains a failed read and recovers on Try again", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore({ activity: [makeActivity()] });
    api.failNext("listProjectActivity", new Error("offline"));
    renderPage(<ActivityFeed projectId="project-1" members={members} />);

    expect(
      await screen.findByText("We couldn't load recent activity.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Write the brief")).toBeInTheDocument();
  });

  it("says live updates are paused when the channel cannot be opened", async () => {
    const { api } = await seedStore({ activity: [makeActivity()] });
    api.failNext("subscribeToProjectActivity", new Error("no realtime"));
    renderPage(<ActivityFeed projectId="project-1" members={members} />);

    expect(
      await screen.findByText(
        "Live updates are paused. Refresh to check for new activity."
      )
    ).toBeInTheDocument();
    expect(await screen.findByText("Write the brief")).toBeInTheDocument();
  });
});
