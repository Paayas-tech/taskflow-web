import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";
import { setSearchOpen } from "../store/ui";
import { SearchDialog } from "./SearchDialog";

const seed = () =>
  seedStore({
    projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
    tasks: [
      makeTask({ id: "task-1", title: "Write the brief" }),
      makeTask({ id: "task-2", title: "Book the venue" }),
    ],
  });

describe("SearchDialog", () => {
  it("filters items as the query changes and prompts when nothing matches", async () => {
    const user = userEvent.setup();
    await seed();
    setSearchOpen(true);
    renderPage(<SearchDialog />);

    expect(screen.getByText("Write the brief")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search projects and tasks"), "brief");
    expect(screen.getByText("Write the brief")).toBeInTheDocument();
    expect(screen.queryByText("Book the venue")).toBeNull();

    await user.clear(screen.getByLabelText("Search projects and tasks"));
    await user.type(screen.getByLabelText("Search projects and tasks"), "zzz");
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("opens the selected task and closes", async () => {
    const user = userEvent.setup();
    await seed();
    setSearchOpen(true);
    renderPage(<SearchDialog />);

    await user.click(screen.getByRole("option", { name: /Book the venue/ }));

    expect(getState().ui.selectedTaskId).toBe("task-2");
    expect(getState().ui.searchOpen).toBe(false);
  });

  it("moves the active result with the arrow keys and selects it with Enter", async () => {
    const user = userEvent.setup();
    await seed();
    setSearchOpen(true);
    renderPage(<SearchDialog />);

    const input = screen.getByLabelText("Search projects and tasks");
    await user.type(input, "e{ArrowDown}{Enter}");

    // "Website relaunch", "Write the brief" and "Book the venue" all match "e";
    // one ArrowDown moves from the project to the first task.
    expect(getState().ui.selectedTaskId).toBe("task-1");
  });

  it("navigates to a project result on its remembered tab", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("taskflow:project-tab:project-1", "board");
    await seed();
    setSearchOpen(true);
    renderPage(<SearchDialog />);

    await user.click(screen.getByRole("option", { name: /Website relaunch/ }));

    expect(getState().ui.path).toBe("/projects/project-1/board");
    window.localStorage.clear();
  });
});
