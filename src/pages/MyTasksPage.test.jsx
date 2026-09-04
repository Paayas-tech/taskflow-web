import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { dateOnlyKey, shiftDateOnly } from "../domain/task";
import { loadTasks } from "../store/session";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { MyTasksPage } from "./MyTasksPage";

const todayKey = dateOnlyKey(new Date());
const yesterdayKey = shiftDateOnly(todayKey, -1);

const seed = (overrides = {}) => ({
  projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
  members: [
    {
      projectId: "project-1",
      userId: "user-1",
      role: "owner",
      displayName: "Sam Rivera",
      avatarUrl: null,
    },
  ],
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

beforeEach(() => {
  window.localStorage.clear();
});

describe("MyTasksPage", () => {
  it("groups tasks by due date and counts the open ones", async () => {
    await seedStore(seed());
    renderPage(<MyTasksPage />);

    expect(screen.getByRole("heading", { name: /My Tasks/ })).toHaveTextContent("3");
    expect(
      within(screen.getByRole("region", { name: "Overdue" })).getByText("Chase the invoice")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Today" })).getByText("Draft the brief")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "No due date" })).getByText(
        "Review the homepage"
      )
    ).toBeInTheDocument();
  });

  it("completing a task saves it without showing a loading skeleton", async () => {
    const { api } = await seedStore(seed());
    renderPage(<MyTasksPage />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Mark Draft the brief complete" })
    );

    await waitFor(() => expect(api.callCount("updateTask")).toBe(1));
    expect(api.callsOf("updateTask")[0][0]).toBe("task-today");
    expect(api.callsOf("updateTask")[0][1]).toMatchObject({ status: "completed" });
    expect(screen.queryByLabelText("Loading tasks")).not.toBeInTheDocument();
    expect(screen.getByText("Chase the invoice")).toBeInTheDocument();
  });

  it("quick add creates a task dated today before the server answers", async () => {
    const { api } = await seedStore(seed());
    renderPage(<MyTasksPage />);

    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    await userEvent.type(screen.getByLabelText("Task name"), "Book the venue");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Book the venue")).toBeInTheDocument();
    await waitFor(() => expect(api.callCount("createTask")).toBe(1));
    expect(api.callsOf("createTask")[0][0]).toMatchObject({
      title: "Book the venue",
      dueDate: todayKey,
      projectId: null,
    });
  });

  it("filters by search and by source, and Clear restores every task", async () => {
    await seedStore(seed());
    renderPage(<MyTasksPage />);

    await userEvent.type(screen.getByLabelText("Search tasks"), "invoice");
    expect(screen.getByText("Chase the invoice")).toBeInTheDocument();
    expect(screen.queryByText("Draft the brief")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Draft the brief")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Source"), "personal");
    expect(screen.queryByText("Review the homepage")).not.toBeInTheDocument();
    expect(screen.getByText("Draft the brief")).toBeInTheDocument();
  });

  it("remembers the board view and creates in the column it was started from", async () => {
    const { api } = await seedStore(seed());
    renderPage(<MyTasksPage />);

    await userEvent.click(screen.getByRole("button", { name: "Board" }));

    expect(window.localStorage.getItem("taskflow:my-tasks-view")).toBe("board");
    const column = screen.getByRole("region", { name: "In progress" });
    await userEvent.click(
      within(column).getByRole("button", { name: "Add task to In progress" })
    );
    await userEvent.type(
      screen.getByLabelText("Task name for In progress"),
      "Wire the form"
    );
    await userEvent.click(within(column).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(api.callCount("createTask")).toBe(1));
    expect(api.callsOf("createTask")[0][0]).toMatchObject({
      title: "Wire the form",
      status: "in-progress",
    });
  });

  it("offers a quick add when nothing is in the list yet", async () => {
    await seedStore({ tasks: [] });
    renderPage(<MyTasksPage />);

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Task name")).toBeInTheDocument();
  });

  it("retries a failed load from the error notice", async () => {
    const { api } = await seedStore(seed());
    api.failNext("listPersonalTasks", new Error("offline"));
    await loadTasks();
    renderPage(<MyTasksPage />);

    expect(
      screen.getByText(
        "We couldn't load your tasks. Check your connection and try again."
      )
    ).toBeInTheDocument();

    const before = api.callCount("listPersonalTasks");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(api.callCount("listPersonalTasks")).toBe(before + 1));
    expect(await screen.findByText("Draft the brief")).toBeInTheDocument();
  });
});
