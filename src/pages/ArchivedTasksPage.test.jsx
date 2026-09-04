import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getState } from "../store/store";
import { makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { ArchivedTasksPage } from "./ArchivedTasksPage";

const seed = {
  tasks: [
    makeTask({
      id: "task-archived",
      title: "Old newsletter",
      archivedAt: "2026-08-20T09:00:00.000Z",
    }),
    makeTask({ id: "task-open", title: "Draft the brief" }),
  ],
};

const openRowMenu = async (title) => {
  await userEvent.click(screen.getByRole("button", { name: `More actions for ${title}` }));
};

describe("ArchivedTasksPage", () => {
  it("lists only the archived tasks, with the count in the title", async () => {
    await seedStore(seed);
    renderPage(<ArchivedTasksPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("1");
    expect(screen.getByText("Old newsletter")).toBeInTheDocument();
    expect(screen.queryByText("Draft the brief")).not.toBeInTheDocument();
  });

  it("restores a task and drops it from the list", async () => {
    const { api } = await seedStore(seed);
    renderPage(<ArchivedTasksPage />);

    await openRowMenu("Old newsletter");
    await userEvent.click(screen.getByRole("menuitem", { name: "Restore" }));

    await waitFor(() => expect(api.callCount("updateTask")).toBe(1));
    expect(api.callsOf("updateTask")[0]).toEqual(["task-archived", { archivedAt: null }]);
    expect(screen.queryByText("Old newsletter")).not.toBeInTheDocument();
  });

  it("keeps the task when the delete confirmation is cancelled", async () => {
    const { api } = await seedStore(seed);
    renderPage(<ArchivedTasksPage />);

    await openRowMenu("Old newsletter");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete permanently" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.callCount("deleteTask")).toBe(0);
    expect(screen.getByText("Old newsletter")).toBeInTheDocument();
  });

  it("deletes a task permanently once confirmed", async () => {
    const { api } = await seedStore(seed);
    renderPage(<ArchivedTasksPage />);

    await openRowMenu("Old newsletter");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete permanently" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(api.callsOf("deleteTask")[0]).toEqual(["task-archived"]));
    expect(screen.queryByText("Old newsletter")).not.toBeInTheDocument();
  });

  it("shows an empty state and goes back to settings", async () => {
    await seedStore({ tasks: [] });
    renderPage(<ArchivedTasksPage />);

    expect(screen.getByText("No archived tasks")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to settings" }));
    expect(getState().ui.path).toBe("/settings");
  });
});
