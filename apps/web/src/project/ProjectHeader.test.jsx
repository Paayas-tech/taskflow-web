import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProjectHeader } from "./ProjectHeader";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";
import { navigate } from "../store/ui";

const seedWorkspace = (project = {}) =>
  seedStore({
    projects: [makeProject({ id: "project-1", name: "Website relaunch", ...project })],
    members: [
      {
        projectId: "project-1",
        userId: "user-1",
        role: project.viewerRole || "owner",
        displayName: "Sam Rivera",
        avatarUrl: "",
      },
    ],
    // Assigned to me, so the store holds it without the workspace being opened.
    tasks: [
      makeTask({
        id: "task-1",
        projectId: "project-1",
        assigneeId: "user-1",
        title: "Write the brief",
      }),
    ],
  });

const openHeader = async (project = {}) => {
  const seeded = await seedWorkspace(project);
  navigate("/projects/project-1/list");
  renderPage(<ProjectHeader projectId="project-1" tab="list" />);
  return seeded;
};

const openOwnerMenu = async (user) => {
  await user.click(screen.getByRole("button", { name: "Project actions" }));
};

describe("ProjectHeader", () => {
  it("archives and restores the project from the owner menu", async () => {
    const user = userEvent.setup();
    const { api } = await openHeader();

    await openOwnerMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Archive project" }));

    await waitFor(() => expect(api.callCount("updateProject")).toBe(1));
    expect(api.callsOf("updateProject")[0][1]).toMatchObject({ status: "archived" });
    expect(await screen.findByText("Archived")).toBeInTheDocument();

    await openOwnerMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Restore project" }));

    await waitFor(() => expect(api.callCount("updateProject")).toBe(2));
    expect(api.callsOf("updateProject")[1][1]).toMatchObject({ status: "active" });
  });

  it("edits the project through the dialog", async () => {
    const user = userEvent.setup();
    const { api } = await openHeader();

    await openOwnerMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Edit project" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit project" });
    const name = within(dialog).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Website relaunch v2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.callCount("updateProject")).toBe(1));
    expect(api.callsOf("updateProject")[0][1]).toMatchObject({ name: "Website relaunch v2" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit project" })).not.toBeInTheDocument()
    );
  });

  it("keeps the edit dialog open with an explanation when the save fails", async () => {
    const user = userEvent.setup();
    const { api } = await openHeader();
    api.failNext("updateProject", new Error("offline"));

    await openOwnerMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Edit project" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit project" });
    await user.type(within(dialog).getByLabelText("Name"), " v2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      await within(dialog).findByText(
        "We couldn't save this project. Check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit project" })).toBeInTheDocument();
    expect(getState().projects["project-1"].name).toBe("Website relaunch");
  });

  it("deletes the project only after the confirmation and then leaves the workspace", async () => {
    const user = userEvent.setup();
    const { api } = await openHeader();

    await openOwnerMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete project" }));

    const confirm = await screen.findByRole("alertdialog", { name: "Delete project?" });
    expect(api.callCount("deleteProject")).toBe(0);

    await user.click(within(confirm).getByRole("button", { name: "Delete project" }));

    await waitFor(() => expect(api.callCount("deleteProject")).toBe(1));
    expect(getState().projects["project-1"]).toBeUndefined();
    expect(getState().tasks["task-1"]).toBeUndefined();
    expect(getState().ui.path).toBe("/projects");
  });

  it("restores everything and reports a failed delete through the store notice", async () => {
    const user = userEvent.setup();
    const { api } = await openHeader();
    api.failNext("deleteProject", new Error("offline"));

    await openOwnerMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete project" }));

    const confirm = await screen.findByRole("alertdialog", { name: "Delete project?" });
    await user.click(within(confirm).getByRole("button", { name: "Delete project" }));

    await waitFor(() => expect(getState().projects["project-1"]).toBeDefined());
    expect(getState().tasks["task-1"]).toBeDefined();
    expect(getState().ui.notice?.text).toBe(
      "We couldn't delete this project. Check your connection and try again."
    );
    // Nothing is left covering the notice: the confirmation closed on confirm.
    expect(screen.queryByRole("alertdialog", { name: "Delete project?" })).toBeNull();
  });

  it("offers only Copy link to someone who does not own the project", async () => {
    const user = userEvent.setup();
    await openHeader({ viewerRole: "viewer", ownerId: "user-2" });

    await openOwnerMenu(user);

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Copy link",
    ]);
  });
});
