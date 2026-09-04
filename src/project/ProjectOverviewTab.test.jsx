import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectOverviewTab } from "./ProjectOverviewTab";
import { makeProject, makeTask } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { ensureWorkspace } from "../store/projects";
import { getState } from "../store/store";

const seedOverview = async ({ role = "owner" } = {}) => {
  const seeded = await seedStore({
    projects: [
      makeProject({
        id: "project-1",
        name: "Website relaunch",
        ownerId: role === "owner" ? "user-1" : "owner-9",
      }),
    ],
    members: [
      {
        projectId: "project-1",
        userId: "user-1",
        role,
        joinedAt: "2026-01-01T09:00:00.000Z",
        displayName: "Sam Rivera",
        avatarUrl: "",
      },
    ],
    tasks: [
      makeTask({ id: "task-1", projectId: "project-1", title: "Write the brief" }),
      makeTask({
        id: "task-2",
        projectId: "project-1",
        title: "Fix the nav",
        status: "in-progress",
        dueDate: "2020-01-01",
      }),
      makeTask({
        id: "task-3",
        projectId: "project-1",
        title: "Ship the beta",
        status: "completed",
        completed: true,
        completedAt: "2026-02-01T10:00:00.000Z",
      }),
      makeTask({
        id: "story-1",
        projectId: "project-1",
        workType: "story",
        title: "Checkout flow",
      }),
    ],
  });
  await ensureWorkspace("project-1");
  return seeded;
};

describe("ProjectOverviewTab", () => {
  it("charts the status distribution of the project's tasks", async () => {
    await seedOverview();
    renderPage(<ProjectOverviewTab projectId="project-1" />);

    const statusCard = screen.getByRole("heading", { name: "Status" }).closest(".card");
    expect(within(statusCard).getByText("3 total")).toBeInTheDocument();
    const labels = within(statusCard).getAllByText(/^(To do|In progress|Done)$/);
    expect(labels.map((label) => label.textContent)).toEqual([
      "To do",
      "In progress",
      "Done",
    ]);
    // Stories are not tasks, so the story is not counted.
    expect(screen.queryByText("Checkout flow")).not.toBeInTheDocument();
  });

  it("lists the overdue and recently completed work, and opens a task", async () => {
    const user = userEvent.setup();
    await seedOverview();
    renderPage(<ProjectOverviewTab projectId="project-1" />);

    const overdue = screen.getByRole("heading", { name: "Overdue tasks" }).closest(".card");
    expect(within(overdue).getByText("Fix the nav")).toBeInTheDocument();
    expect(within(overdue).queryByText("Write the brief")).not.toBeInTheDocument();

    const completed = screen
      .getByRole("heading", { name: "Recently completed" })
      .closest(".card");
    expect(within(completed).getByText("Ship the beta")).toBeInTheDocument();
    expect(within(completed).getAllByText("Unassigned")[0]).toBeInTheDocument();

    await user.click(within(overdue).getByText("Fix the nav"));
    expect(getState().ui.selectedTaskId).toBe("task-2");
  });

  it("lets an editor change the project health", async () => {
    const user = userEvent.setup();
    const { api } = await seedOverview();
    renderPage(<ProjectOverviewTab projectId="project-1" />);

    await user.selectOptions(screen.getByLabelText("Project health"), "at_risk");

    await waitFor(() => expect(api.callCount("updateProject")).toBe(1));
    expect(api.callsOf("updateProject")[0]).toEqual([
      "project-1",
      { healthStatus: "at_risk" },
    ]);
    expect(getState().projects["project-1"].healthStatus).toBe("at_risk");
  });

  it("shows a viewer the health as a badge instead of a control", async () => {
    await seedOverview({ role: "viewer" });
    renderPage(<ProjectOverviewTab projectId="project-1" />);

    expect(screen.queryByLabelText("Project health")).not.toBeInTheDocument();
    expect(screen.getByText("On track")).toBeInTheDocument();
  });

  it("keeps health read-only when the remote is missing migration 017", async () => {
    await seedOverview();
    getState().projects["project-1"].healthSupported = false;
    renderPage(<ProjectOverviewTab projectId="project-1" />);

    expect(screen.queryByLabelText("Project health")).not.toBeInTheDocument();
    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByText("Read-only until migration 017.")).toBeInTheDocument();
  });
});
