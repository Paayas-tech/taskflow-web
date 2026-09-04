import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsPage } from "./ProjectsPage";
import { makeProject } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";
import { openProjectCreate } from "../store/ui";

const seedProjects = () =>
  seedStore({
    projects: [
      makeProject({ id: "project-live", name: "Website relaunch", description: "Q3 push" }),
      makeProject({ id: "project-old", name: "Old intranet", status: "archived" }),
    ],
  });

describe("ProjectsPage", () => {
  it("lists active projects and reveals archived ones on request", async () => {
    const user = userEvent.setup();
    await seedProjects();
    renderPage(<ProjectsPage />);

    expect(screen.getByRole("button", { name: "Open Website relaunch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Old intranet" })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Show archived"));
    expect(screen.getByRole("button", { name: "Open Old intranet" })).toBeInTheDocument();
  });

  it("filters the list by the search box", async () => {
    const user = userEvent.setup();
    await seedProjects();
    renderPage(<ProjectsPage />);

    await user.type(screen.getByLabelText("Search projects"), "intranet");

    expect(screen.queryByRole("button", { name: "Open Website relaunch" })).not.toBeInTheDocument();
    expect(screen.getByText("No matching projects")).toBeInTheDocument();
  });

  it("creates a project from the dialog", async () => {
    const user = userEvent.setup();
    const { api } = await seedProjects();
    renderPage(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Mobile app");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(api.callCount("createProject")).toBe(1));
    expect(api.callsOf("createProject")[0][0]).toMatchObject({ name: "Mobile app" });
    expect(screen.getByRole("button", { name: "Open Mobile app" })).toBeInTheDocument();
  });

  it("opens the create dialog for a request raised before the page mounted", async () => {
    const user = userEvent.setup();
    await seedProjects();
    // "New project" from the sidebar, Home or Settings navigates here first,
    // so the request is already pending on this page's first render.
    openProjectCreate();
    const view = renderPage(<ProjectsPage />);

    expect(await screen.findByRole("dialog", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(getState().ui.projectCreateRequest).toBe(0);

    await user.click(screen.getByRole("button", { name: "Close" }));
    view.unmount();
    renderPage(<ProjectsPage />);
    expect(screen.queryByRole("dialog", { name: "New project" })).toBeNull();
  });

  it("keeps the dialog open with an explanation when the create fails", async () => {
    const user = userEvent.setup();
    const { api } = await seedProjects();
    api.failNext("createProject", new Error("offline"));
    renderPage(<ProjectsPage />);

    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Mobile app");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      await screen.findByText(
        "We couldn't create this project. Check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Mobile app");
  });

  it("accepts an incoming invitation", async () => {
    const user = userEvent.setup();
    const { api } = await seedStore({
      invitations: [
        {
          id: "invitation-1",
          projectId: "project-shared",
          email: "sam@example.com",
          role: "editor",
          status: "pending",
          inviterDisplayName: "Dana Cruz",
          project: { id: "project-shared", name: "Design system" },
        },
      ],
    });
    renderPage(<ProjectsPage />);

    const invitation = screen.getByText("Design system").closest(".invitation-row");
    await user.click(within(invitation).getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(api.callCount("respondToInvitation")).toBe(1));
    expect(api.callsOf("respondToInvitation")[0]).toEqual(["invitation-1", "accepted"]);
    // The invitation is replaced by the project it gave access to.
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Open Design system" })
    ).toBeInTheDocument();
  });

  it("opens a project on its remembered tab and warms the workspace on hover", async () => {
    const user = userEvent.setup();
    const { api } = await seedProjects();
    renderPage(<ProjectsPage />);

    const row = screen.getByRole("button", { name: "Open Website relaunch" });
    await user.hover(row);
    await waitFor(() => expect(api.callCount("listProjectTasks")).toBe(1));
    expect(api.callsOf("listProjectTasks")[0]).toEqual(["project-live"]);

    await user.click(row);
    expect(getState().ui.path).toBe("/projects/project-live/overview");
  });
});
