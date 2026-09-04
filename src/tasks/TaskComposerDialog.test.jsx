import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeProject } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";
import { openComposer } from "../store/ui";
import { TaskComposerDialog } from "./TaskComposerDialog";

const seedComposer = (initialValues = {}, options = {}) =>
  seedStore({
    projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
  }).then((seeded) => {
    openComposer(initialValues, options);
    return seeded;
  });

describe("TaskComposerDialog", () => {
  it("focuses the title when it opens", async () => {
    await seedComposer();
    renderPage(<TaskComposerDialog />);

    expect(screen.getByLabelText("Task title")).toHaveFocus();
  });

  it("creates the typed task in the chosen project and closes", async () => {
    const { api } = await seedComposer();
    renderPage(<TaskComposerDialog />);

    expect(screen.getByRole("button", { name: "Create task" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Task title"), "Write the brief");
    await userEvent.selectOptions(screen.getByLabelText("Project"), "project-1");
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(api.callCount("createTask")).toBe(1));
    expect(api.callsOf("createTask")[0][0]).toMatchObject({
      title: "Write the brief",
      projectId: "project-1",
      workType: "task",
    });
    expect(getState().ui.composer.open).toBe(false);
  });

  it("stays open and explains a failed create", async () => {
    const { api } = await seedComposer();
    api.failNext("createTask", new Error("offline"));
    renderPage(<TaskComposerDialog />);

    await userEvent.type(screen.getByLabelText("Task title"), "Write the brief");
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(
      await screen.findByText(
        "We couldn't create this task. Check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(getState().ui.composer.open).toBe(true);
  });

  it("seeds itself from the composer's initial values and locks the project", async () => {
    await seedComposer({ title: "Draft the copy", projectId: "project-1" }, { lockProject: true });
    renderPage(<TaskComposerDialog />);

    expect(screen.getByLabelText("Task title")).toHaveValue("Draft the copy");
    expect(screen.queryByLabelText("Project")).not.toBeInTheDocument();
  });

  it("turns the reminder off when its delivery time is cleared", async () => {
    const user = userEvent.setup();
    await seedComposer();
    renderPage(<TaskComposerDialog />);

    await user.click(screen.getByLabelText("Remind me"));
    const reminderAt = screen.getByLabelText("Reminder date and time");
    expect(reminderAt).toHaveValue();

    await user.clear(reminderAt);

    expect(screen.getByLabelText("Remind me")).not.toBeChecked();
    expect(screen.queryByLabelText("Reminder date and time")).toBeNull();
  });
});
