import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateOnlyKey, shiftDateOnly } from "../domain/task";
import { getState } from "../store/store";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { HomePage } from "./HomePage";

const todayKey = dateOnlyKey(new Date());
const yesterdayKey = shiftDateOnly(todayKey, -1);

const members = [
  {
    projectId: "project-1",
    userId: "user-1",
    role: "owner",
    displayName: "Sam Rivera",
    avatarUrl: null,
  },
  {
    projectId: "project-1",
    userId: "user-2",
    role: "editor",
    displayName: "Ada Lovelace",
    avatarUrl: null,
  },
];

const seed = (overrides = {}) => ({
  projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
  members,
  tasks: [
    makeTask({ id: "task-today", title: "Draft the brief", dueDate: todayKey }),
    makeTask({ id: "task-late", title: "Chase the invoice", dueDate: yesterdayKey }),
    makeTask({
      id: "task-project",
      title: "Review the homepage",
      projectId: "project-1",
      assigneeId: "user-1",
    }),
  ],
  ...overrides,
});

const invitation = {
  id: "invitation-1",
  projectId: "project-2",
  email: "sam@example.com",
  role: "editor",
  status: "pending",
  inviterDisplayName: "Ada Lovelace",
  expiresAt: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  project: { id: "project-2", name: "Marketing site" },
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("HomePage", () => {
  it("greets the person and summarizes the day", async () => {
    await seedStore(seed());
    renderPage(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /^Good (morning|afternoon|evening), Sam$/
    );
    expect(screen.getByText("1 due today · 1 overdue · 1 project")).toBeInTheDocument();
  });

  it("shows today's tasks and the work assigned to me in their widgets", async () => {
    await seedStore(seed());
    renderPage(<HomePage />);

    expect(
      within(screen.getByRole("region", { name: "My tasks" })).getByText("Draft the brief")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Assigned to me" })).getByText(
        "Review the homepage"
      )
    ).toBeInTheDocument();
  });

  it("treats yesterday as today until the My day reset time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-02T00:30:00"));

    try {
      await seedStore({
        settings: { myDay: { resetMode: "early-morning" } },
        tasks: [
          makeTask({ id: "task-1", title: "Chase the invoice", dueDate: "2026-09-01" }),
          makeTask({ id: "task-2", title: "Draft the brief", dueDate: "2026-09-02" }),
        ],
      });
      const { container } = renderPage(<HomePage />);

      expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-09-01");
      expect(screen.getByText("1 due today")).toBeInTheDocument();

      const myTasks = within(screen.getByRole("region", { name: "My tasks" }));
      expect(myTasks.getByText("Chase the invoice")).toBeInTheDocument();
      expect(myTasks.queryByText("Draft the brief")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts a pending invitation and drops the row", async () => {
    const { api } = await seedStore(seed({ invitations: [invitation] }));
    renderPage(<HomePage />);

    expect(screen.getByText("You have 1 project invitation")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(api.callsOf("respondToInvitation")[0]).toEqual([
        "invitation-1",
        "accepted",
      ])
    );
    await waitFor(() =>
      expect(screen.queryByText("You have 1 project invitation")).not.toBeInTheDocument()
    );
    expect(
      within(screen.getByRole("region", { name: "Projects" })).getByText("Marketing site")
    ).toBeInTheDocument();
  });

  it("declines a pending invitation", async () => {
    const { api } = await seedStore(seed({ invitations: [invitation] }));
    renderPage(<HomePage />);

    await userEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() =>
      expect(api.callsOf("respondToInvitation")[0]).toEqual([
        "invitation-1",
        "declined",
      ])
    );
  });

  it("opens a project on the tab it was last left on", async () => {
    window.localStorage.setItem("taskflow:project-tab:project-1", "board");
    await seedStore(seed());
    renderPage(<HomePage />);

    await userEvent.click(
      within(screen.getByRole("region", { name: "Projects" })).getByRole("button", {
        name: /Website relaunch/,
      })
    );

    expect(getState().ui.path).toBe("/projects/project-1/board");
  });

  it("names the actor of a notification in the inbox widget", async () => {
    await seedStore(
      seed({
        notifications: [
          {
            id: "notification-1",
            type: "comment_added",
            projectId: "project-1",
            readAt: null,
            createdAt: "2026-09-01T09:00:00.000Z",
            data: { actorId: "user-2", taskTitle: "the brief" },
          },
        ],
      })
    );
    renderPage(<HomePage />);

    expect(
      within(screen.getByRole("region", { name: "Inbox" })).getByText(
        "Ada Lovelace added a comment to the brief."
      )
    ).toBeInTheDocument();
  });
});
