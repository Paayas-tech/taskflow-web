import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeProject } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";
import { navigate } from "../store/ui";
import { Sidebar } from "./Sidebar";

vi.mock("../api/auth", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { signOut } = await import("../api/auth");

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(signOut).mockReset();
});

describe("Sidebar", () => {
  it("marks the active view and navigates through the store", async () => {
    const user = userEvent.setup();
    await seedStore();
    renderPage(<Sidebar />);

    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await user.click(screen.getByRole("button", { name: "My Tasks" }));

    expect(getState().ui.path).toBe("/tasks");
    expect(screen.getByRole("button", { name: "My Tasks" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("keeps Projects active inside a workspace and lists its active projects", async () => {
    const user = userEvent.setup();
    const project = makeProject({ id: "project-1", name: "Website relaunch" });
    const archived = makeProject({
      id: "project-2",
      name: "Old site",
      status: "archived",
    });
    await seedStore({ projects: [project, archived] });
    navigate("/projects/project-1/board");

    renderPage(<Sidebar />);

    expect(screen.getByRole("button", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByRole("button", { name: "Old site" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Website relaunch" }));
    expect(getState().ui.path).toBe("/projects/project-1/overview");
  });

  it("badges unread notifications and pending invitations", async () => {
    await seedStore({
      notifications: [
        { id: "n1", type: "assignment", title: "Assigned", readAt: null },
        { id: "n2", type: "comment", title: "Comment", readAt: null },
      ],
      invitations: [
        {
          id: "i1",
          projectId: "project-1",
          email: "sam@example.com",
          role: "editor",
          status: "pending",
        },
      ],
    });
    renderPage(<Sidebar />);

    expect(screen.getByRole("button", { name: "Inbox, 2 unread" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Projects, 1 pending invitation" })
    ).toBeInTheDocument();
  });

  it("explains an empty project list", async () => {
    await seedStore();
    renderPage(<Sidebar />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it("keeps the session and reports a failed sign-out under the user row", async () => {
    const user = userEvent.setup();
    vi.mocked(signOut).mockRejectedValue(new Error("offline"));
    const { user: account } = await seedStore();
    renderPage(<Sidebar />);

    await user.click(
      screen.getByRole("button", { name: `Account menu for ${account.displayName}` })
    );
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(
      await screen.findByText(
        "Couldn’t sign out. Please check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(getState().auth.user).not.toBeNull();
  });
});
