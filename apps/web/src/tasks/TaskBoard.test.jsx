import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeColumn, makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { ensureWorkspace } from "../store/projects";
import { selectWorkspace } from "../store/selectors";
import { getState } from "../store/store";
import { TaskBoard } from "./TaskBoard";

const seedBoard = async () => {
  const seeded = await seedStore({
    projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
    columns: [
      makeColumn({ id: "column-todo", projectId: "project-1", name: "To Do", category: "todo", position: 0 }),
      makeColumn({
        id: "column-doing",
        projectId: "project-1",
        name: "In Progress",
        category: "in_progress",
        position: 1,
      }),
    ],
    tasks: [
      makeTask({
        id: "task-1",
        projectId: "project-1",
        columnId: "column-todo",
        position: 0,
        title: "Write the brief",
      }),
    ],
  });
  await ensureWorkspace("project-1");
  const workspace = selectWorkspace("project-1")(getState());
  return { ...seeded, workspace };
};

describe("TaskBoard", () => {
  it("renders one column per board column with its task count", async () => {
    const { workspace } = await seedBoard();
    renderPage(<TaskBoard columns={workspace.columns} tasks={workspace.tasks} />);

    const [todo, doing] = screen.getAllByRole("region");
    expect(todo).toHaveTextContent("To Do");
    expect(todo).toHaveTextContent("Write the brief");
    expect(todo.querySelector(".board-column-count")).toHaveTextContent("1");
    expect(doing.querySelector(".board-column-count")).toHaveTextContent("0");
  });

  it("hands a quick-created title and its column to onQuickCreate", async () => {
    const { workspace } = await seedBoard();
    const onQuickCreate = vi.fn();
    renderPage(
      <TaskBoard
        columns={workspace.columns}
        tasks={workspace.tasks}
        onQuickCreate={onQuickCreate}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Add task to In Progress" }));
    await userEvent.type(
      screen.getByLabelText("Task name for In Progress"),
      "Draft the copy"
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onQuickCreate).toHaveBeenCalledWith(
      "Draft the copy",
      expect.objectContaining({ id: "column-doing" })
    );
  });
});
