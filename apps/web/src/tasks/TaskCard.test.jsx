import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { ensureWorkspace } from "../store/projects";
import { selectTask } from "../store/selectors";
import { getState, useStore } from "../store/store";
import { TaskCard } from "./TaskCard";

/** Cards are sortable, so they need the board's drag context around them. */
function Card({ taskId, ...props }) {
  const task = useStore(selectTask(taskId));
  if (!task) return null;
  return (
    <DndContext>
      <SortableContext items={[`task:${task.id}`]}>
        <TaskCard task={task} {...props} />
      </SortableContext>
    </DndContext>
  );
}

const seedCard = async () => {
  const seeded = await seedStore({
    projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
    tasks: [
      makeTask({
        id: "task-1",
        projectId: "project-1",
        title: "Write the brief",
        priority: "high",
        dueDate: "2026-03-04",
      }),
    ],
  });
  await ensureWorkspace("project-1");
  return seeded;
};

describe("TaskCard", () => {
  it("shows the title, the due date and the project badge", async () => {
    await seedCard();
    renderPage(<Card taskId="task-1" />);

    expect(screen.getByText("Write the brief")).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute("datetime", "2026-03-04");
    expect(
      screen.getByRole("button", { name: "Open Website relaunch project" })
    ).toBeInTheDocument();
  });

  it("opens the task when the card is clicked", async () => {
    await seedCard();
    renderPage(<Card taskId="task-1" />);

    // The card is its own drag handle: a pointer sequence belongs to the drag
    // sensor, so the plain click is what opens the task.
    fireEvent.click(screen.getByRole("button", { name: "Write the brief" }));

    expect(getState().ui.selectedTaskId).toBe("task-1");
  });
});
