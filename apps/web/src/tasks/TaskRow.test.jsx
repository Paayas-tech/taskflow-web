import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { ensureWorkspace } from "../store/projects";
import { selectTask } from "../store/selectors";
import { getState, useStore } from "../store/store";
import { TaskRow } from "./TaskRow";

/** Rows take an enriched task, so the harness reads it back out of the store. */
function Row({ taskId, ...props }) {
  const task = useStore(selectTask(taskId));
  return task ? <TaskRow task={task} {...props} /> : null;
}

const seedProjectTask = async () => {
  const seeded = await seedStore({
    projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
    members: [
      {
        projectId: "project-1",
        userId: "user-1",
        role: "owner",
        joinedAt: "2026-01-01T09:00:00.000Z",
        displayName: "Sam Rivera",
        avatarUrl: null,
      },
    ],
    profiles: [{ userId: "user-1", displayName: "Sam Rivera", avatarUrl: null }],
    tasks: [
      makeTask({
        id: "story-1",
        projectId: "project-1",
        workType: "story",
        title: "Checkout",
      }),
      makeTask({
        id: "task-1",
        projectId: "project-1",
        storyId: "story-1",
        title: "Write the brief",
        assigneeId: "user-1",
        dueDate: "2026-03-04",
      }),
    ],
  });
  await ensureWorkspace("project-1");
  return seeded;
};

describe("TaskRow", () => {
  it("shows the title, the project and story badges and the assignee", async () => {
    await seedProjectTask();
    renderPage(<Row taskId="task-1" />);

    expect(screen.getByTitle("Write the brief")).toHaveTextContent("Write the brief");
    expect(
      screen.getByRole("button", { name: "Open Website relaunch project" })
    ).toBeInTheDocument();
    expect(screen.getByTitle("Story: Checkout")).toHaveTextContent("Checkout");
    expect(screen.getByTitle("Sam Rivera")).toBeInTheDocument();
  });

  it("completes the task from the checkbox, immediately and then on the server", async () => {
    const { api } = await seedProjectTask();
    renderPage(<Row taskId="task-1" />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Mark Write the brief complete" })
    );

    expect(
      screen.getByRole("checkbox", { name: "Mark Write the brief incomplete" })
    ).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(api.callCount("updateTask")).toBe(1));
    expect(api.callsOf("updateTask")[0][1]).toMatchObject({
      status: "completed",
      completed: true,
    });
  });

  it("marks the row busy while a mutation is in flight", async () => {
    const { api } = await seedProjectTask();
    const saved = api.updateTask;
    let release;
    api.updateTask = (...args) =>
      new Promise((resolve) => {
        release = () => resolve(saved(...args));
      });
    renderPage(<Row taskId="task-1" />);

    const checkbox = screen.getByRole("checkbox", {
      name: "Mark Write the brief complete",
    });
    await userEvent.click(checkbox);

    const row = screen.getByTitle("Write the brief").closest(".task-row");
    expect(row).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("checkbox", { name: "Mark Write the brief incomplete" })
    ).toBeDisabled();

    release();
    await waitFor(() => expect(row).not.toHaveAttribute("aria-busy"));
  });

  it("opens the task from a click and hands an override the task", async () => {
    await seedProjectTask();
    renderPage(<Row taskId="task-1" />);

    await userEvent.click(screen.getByTitle("Write the brief"));

    expect(getState().ui.selectedTaskId).toBe("task-1");
  });
});
