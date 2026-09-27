import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { ensureWorkspace } from "../store/projects";
import { selectSelectedTaskId } from "../store/selectors";
import { useStore } from "../store/store";
import { openTask } from "../store/ui";
import { TaskDetailPanel } from "./TaskDetailPanel";

// The collaboration sections fetch through `src/api` directly rather than the
// store, so they are stubbed out here; they have their own tests.
vi.mock("../collaboration/TaskComments", () => ({ TaskComments: () => null }));
vi.mock("../collaboration/ActivityFeed", () => ({ ActivityFeed: () => null }));
vi.mock("../collaboration/AttachmentSection", () => ({ AttachmentSection: () => null }));

/**
 * Mirrors how App renders the panel: one long-lived instance, no key, driven by
 * `ui.selectedTaskId`.
 */
function PanelHost() {
  const taskId = useStore(selectSelectedTaskId);
  return (
    <>
      <TaskDetailPanel taskId={taskId} />
      {taskId ? null : <p>No task open</p>}
    </>
  );
}

const member = (role) => ({
  projectId: "project-1",
  userId: "user-1",
  role,
  joinedAt: "2026-01-01T09:00:00.000Z",
  displayName: "Sam Rivera",
  avatarUrl: null,
});

const seedStory = async () => {
  const seeded = await seedStore({
    projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
    members: [member("owner")],
    tasks: [
      makeTask({ id: "story-1", projectId: "project-1", workType: "story", title: "Checkout" }),
      makeTask({
        id: "task-1",
        projectId: "project-1",
        storyId: "story-1",
        title: "Design the header",
      }),
    ],
  });
  await ensureWorkspace("project-1");
  return seeded;
};

describe("TaskDetailPanel", () => {
  it("saves an edited title on blur", async () => {
    const { api } = await seedStore({
      tasks: [makeTask({ id: "task-1", title: "Write the brief" })],
    });
    renderPage(<TaskDetailPanel taskId="task-1" />);

    const title = screen.getByLabelText("Task title");
    await userEvent.clear(title);
    await userEvent.type(title, "Write the launch brief");
    await userEvent.tab();

    await waitFor(() => expect(api.callCount("updateTask")).toBe(1));
    expect(api.callsOf("updateTask")[0]).toEqual([
      "task-1",
      { title: "Write the launch brief" },
    ]);
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("completes the task from the header button", async () => {
    const { api } = await seedStore({
      tasks: [makeTask({ id: "task-1", title: "Write the brief" })],
    });
    renderPage(<TaskDetailPanel taskId="task-1" />);

    await userEvent.click(screen.getByRole("button", { name: "Mark complete" }));

    expect(await screen.findByRole("button", { name: "Completed" })).toBeInTheDocument();
    expect(api.callsOf("updateTask")[0][1]).toMatchObject({
      status: "completed",
      completed: true,
      completedAt: expect.any(String),
    });
  });

  it("opens a task from the story's list and returns to the story on close", async () => {
    await seedStory();
    openTask("story-1");
    renderPage(<PanelHost />);

    expect(screen.getByLabelText("Story title")).toHaveValue("Checkout");
    await userEvent.click(screen.getByTitle("Design the header"));

    expect(screen.getByLabelText("Task title")).toHaveValue("Design the header");

    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));

    expect(screen.getByLabelText("Story title")).toHaveValue("Checkout");
  });

  it("asks to move linked tasks before archiving a story", async () => {
    const { api } = await seedStory();
    renderPage(<TaskDetailPanel taskId="story-1" />);

    await userEvent.click(screen.getByRole("button", { name: "Archive task" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Move linked tasks before archiving?" })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Move tasks to no story" }));

    await waitFor(() => expect(api.callCount("updateTask")).toBe(2));
    expect(api.callsOf("updateTask")[0]).toEqual(["task-1", { storyId: null }]);
    expect(api.callsOf("updateTask")[1][0]).toBe("story-1");
    expect(api.callsOf("updateTask")[1][1].archivedAt).toEqual(expect.any(String));
  });

  it("keeps the panel open and explains a failed delete", async () => {
    const { api } = await seedStore({
      tasks: [makeTask({ id: "task-1", title: "Write the brief" })],
    });
    api.failNext("deleteTask", new Error("offline"));
    openTask("task-1");
    renderPage(<PanelHost />);

    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this task?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete task" }));

    expect(
      await screen.findByText("We couldn't delete this task. Check your connection and try again.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Task title")).toHaveValue("Write the brief");
    expect(screen.queryByText("No task open")).not.toBeInTheDocument();
  });

  it("drops the previous task's save error when the panel switches tasks", async () => {
    const { api } = await seedStory();
    api.failNext("updateTask", new Error("offline"));
    openTask("story-1");
    renderPage(<PanelHost />);

    const title = screen.getByLabelText("Story title");
    await userEvent.clear(title);
    await userEvent.type(title, "Checkout flow");
    await userEvent.tab();

    expect(await screen.findByText("Couldn't save")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    await userEvent.click(screen.getByTitle("Design the header"));

    expect(screen.getByLabelText("Task title")).toHaveValue("Design the header");
    expect(screen.queryByText("Couldn't save")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(api.callsOf("updateTask").every(([taskId]) => taskId === "story-1")).toBe(true);
  });

  it("returns focus to the element that opened it", async () => {
    await seedStore({ tasks: [makeTask({ id: "task-1", title: "Write the brief" })] });
    renderPage(
      <>
        <button type="button" onClick={() => openTask("task-1")}>
          Open task
        </button>
        <PanelHost />
      </>
    );

    const trigger = screen.getByRole("button", { name: "Open task" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));

    expect(screen.getByText("No task open")).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("is read-only for a viewer", async () => {
    await seedStore({
      projects: [makeProject({ id: "project-1", name: "Website relaunch", ownerId: "user-2" })],
      members: [member("viewer")],
      tasks: [
        makeTask({ id: "task-1", projectId: "project-1", title: "Write the brief" }),
      ],
    });
    await ensureWorkspace("project-1");
    renderPage(<TaskDetailPanel taskId="task-1" />);

    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark complete" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Task title")).toBeDisabled();
  });
});
