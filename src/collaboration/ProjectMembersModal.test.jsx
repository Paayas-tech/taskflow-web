import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectMembersModal } from "./ProjectMembersModal";
import { makeProject } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";

const member = (overrides) => ({
  projectId: "project-1",
  joinedAt: "2026-01-01T09:00:00.000Z",
  avatarUrl: "",
  ...overrides,
});

const seedMembers = ({ role = "owner", invitations = [] } = {}) =>
  seedStore({
    projects: [
      makeProject({
        id: "project-1",
        name: "Website relaunch",
        ownerId: role === "owner" ? "user-1" : "owner-9",
      }),
    ],
    members: [
      member({ userId: "user-1", role, displayName: "Sam Rivera" }),
      member({ userId: "user-2", role: "editor", displayName: "Dana Cruz" }),
    ],
    invitations,
  });

const openModal = () =>
  renderPage(
    <ProjectMembersModal project={getState().projects["project-1"]} onClose={() => {}} />
  );

describe("ProjectMembersModal", () => {
  beforeEach(() => {
    // The focus restoration is deferred to the next frame; run it inline.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  it("lists the roster from the store and invites a new member", async () => {
    const user = userEvent.setup();
    const { api } = await seedMembers();
    openModal();

    expect(await screen.findByText("Dana Cruz")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Invite by email"), "nina@example.com");
    await user.selectOptions(screen.getByLabelText("Invitation access"), "viewer");
    await user.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(api.callCount("sendInvitation")).toBe(1));
    expect(api.callsOf("sendInvitation")[0]).toEqual([
      "project-1",
      { email: "nina@example.com", role: "viewer", projectName: "Website relaunch" },
    ]);
    expect(await screen.findByText("Invitation sent.")).toBeInTheDocument();
  });

  it("changes a member role and re-reads the roster", async () => {
    const user = userEvent.setup();
    const { api } = await seedMembers();
    openModal();

    await user.selectOptions(await screen.findByLabelText("Role for Dana Cruz"), "viewer");

    await waitFor(() => expect(api.callCount("updateMemberRole")).toBe(1));
    expect(api.callsOf("updateMemberRole")[0]).toEqual(["project-1", "user-2", "viewer"]);
    await waitFor(() =>
      expect(getState().members["project-1"][1].role).toBe("viewer")
    );
  });

  it("removes a member only after the confirmation", async () => {
    const user = userEvent.setup();
    const { api } = await seedMembers();
    openModal();

    await user.click(await screen.findByRole("button", { name: "Remove Dana Cruz" }));
    expect(api.callCount("removeMember")).toBe(0);

    const confirmation = screen.getByRole("alertdialog");
    await user.click(within(confirmation).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(api.callCount("removeMember")).toBe(1));
    expect(api.callsOf("removeMember")[0]).toEqual(["project-1", "user-2"]);
  });

  it("hides the invite controls from a member who is not the owner", async () => {
    await seedMembers({ role: "editor" });
    openModal();

    expect(await screen.findByText("Dana Cruz")).toBeInTheDocument();
    expect(screen.queryByLabelText("Invite by email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Dana Cruz" })).not.toBeInTheDocument();
  });

  it("cancels a pending invitation from its row", async () => {
    const user = userEvent.setup();
    const { api } = await seedMembers({
      invitations: [
        {
          id: "invitation-1",
          projectId: "project-1",
          email: "nina@example.com",
          role: "editor",
          status: "pending",
          inviterDisplayName: "Sam Rivera",
        },
      ],
    });
    openModal();

    const row = (await screen.findByText("nina@example.com")).closest(".invitation-row");
    await user.click(within(row).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(api.callCount("cancelInvitation")).toBe(1));
    expect(api.callsOf("cancelInvitation")[0]).toEqual(["project-1", "invitation-1"]);
  });
});
