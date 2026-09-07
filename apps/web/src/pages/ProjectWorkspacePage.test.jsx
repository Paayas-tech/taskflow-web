import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectWorkspacePage } from "./ProjectWorkspacePage";
import { makeColumn, makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";
import { navigate } from "../store/ui";

const columnsFor = (projectId, prefix) => [
  makeColumn({ id: `${prefix}-todo`, projectId, name: "To Do", category: "todo", position: 0 }),
  makeColumn({
    id: `${prefix}-doing`,
    projectId,
    name: "In Progress",
    category: "in_progress",
    position: 1,
  }),
  makeColumn({
    id: `${prefix}-done`,
    projectId,
    name: "Done",
    category: "done",
    position: 2,
    isTerminal: true,
  }),
];

const seedWorkspace = (seed = {}) =>
  seedStore({
    projects: [
      makeProject({ id: "project-1", name: "Website relaunch" }),
      makeProject({ id: "project-2", name: "Mobile app" }),
    ],
    columns: [...columnsFor("project-1", "one"), ...columnsFor("project-2", "two")],
    members: [
      {
        projectId: "project-1",
        userId: "user-1",
        role: "owner",
        joinedAt: "2026-01-01T09:00:00.000Z",
        displayName: "Sam Rivera",
        avatarUrl: "",
      },
    ],
    tasks: [
      makeTask({
        id: "story-1",
        projectId: "project-1",
        workType: "story",
        title: "Checkout flow",
      }),
      makeTask({
        id: "task-1",
        projectId: "project-1",
        storyId: "story-1",
        columnId: "one-todo",
        position: 0,
        title: "Write the brief",
      }),
      makeTask({
        id: "task-2",
        projectId: "project-1",
        storyId: "story-1",
        columnId: "one-todo",
        position: 1,
        title: "Draft the copy",
      }),
      makeTask({
        id: "task-3",
        projectId: "project-1",
        columnId: "one-todo",
        position: 2,
        title: "Book the venue",
      }),
    ],
    ...seed,
  });

const openWorkspace = async (path = "/projects/project-1/list") => {
  const seeded = await seedWorkspace();
  navigate(path);
  renderPage(<ProjectWorkspacePage />);
  return seeded;
};

describe("ProjectWorkspacePage", () => {
  it("loads a workspace once and serves a revisit from the store", async () => {
    const { api } = await openWorkspace();
    expect(await screen.findByText("Write the brief")).toBeInTheDocument();

    navigate("/projects/project-2/list");
    await screen.findByText("Mobile app");
    navigate("/projects/project-1/list");
    await screen.findByText("Write the brief");

    await waitFor(() => expect(api.callCount("listProjectTasks")).toBe(2));
    expect(api.callsOf("listProjectTasks")).toEqual([["project-1"], ["project-2"]]);
    expect(screen.queryByText("Loading project…")).not.toBeInTheDocument();
  });

  it("completes a task immediately, without falling back to a skeleton", async () => {
    const user = userEvent.setup();
    const { api } = await openWorkspace();

    const checkbox = await screen.findByRole("checkbox", {
      name: "Mark Write the brief complete",
    });
    await user.click(checkbox);

    expect(
      screen.getByRole("checkbox", { name: "Mark Write the brief incomplete" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading project…")).not.toBeInTheDocument();
    await waitFor(() => expect(api.callCount("updateTask")).toBe(1));
    expect(api.callCount("listProjectTasks")).toBe(1);
  });

  it("bulk-updates the tasks of the filtered story and reports the count", async () => {
    const user = userEvent.setup();
    const { api } = await openWorkspace();
    await screen.findByText("Write the brief");

    await user.selectOptions(screen.getByLabelText("Story"), "story-1");
    expect(screen.queryByText("Book the venue")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Select all visible"));
    await user.selectOptions(
      screen.getByLabelText("Change selected task status"),
      "completed"
    );

    expect(await screen.findByText("2 tasks updated.")).toBeInTheDocument();
    const patched = api.callsOf("updateTask");
    expect(patched).toHaveLength(2);
    expect(patched.map(([taskId]) => taskId).sort()).toEqual(["task-1", "task-2"]);
  });

  it("opens a task in the shared detail panel", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(await screen.findByText("Write the brief"));

    expect(getState().ui.selectedTaskId).toBe("task-1");
  });

  it("switches tabs through the header and remembers the choice", async () => {
    const user = userEvent.setup();
    await openWorkspace("/projects/project-1/overview");

    expect(await screen.findByRole("region", { name: "Project overview" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Board/ }));

    expect(getState().ui.path).toBe("/projects/project-1/board");
    expect(await screen.findByRole("region", { name: "To Do" })).toBeInTheDocument();
  });

  it("offers a retry when the workspace cannot be loaded", async () => {
    const user = userEvent.setup();
    const seeded = await seedWorkspace();
    seeded.api.failNext("listProjectTasks", new Error("offline"));
    navigate("/projects/project-1/list");
    renderPage(<ProjectWorkspacePage />);

    expect(await screen.findByText("Project workspace unavailable")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Write the brief")).toBeInTheDocument();
  });

  it("hides every mutating control from a viewer", async () => {
    await seedWorkspace({
      projects: [
        makeProject({ id: "project-1", name: "Website relaunch", ownerId: "owner-9" }),
      ],
      members: [
        {
          projectId: "project-1",
          userId: "user-1",
          role: "viewer",
          joinedAt: "2026-01-01T09:00:00.000Z",
          displayName: "Sam Rivera",
          avatarUrl: "",
        },
      ],
    });
    navigate("/projects/project-1/list");
    renderPage(<ProjectWorkspacePage />);

    expect(await screen.findByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add task" })).not.toBeInTheDocument();
  });
});
