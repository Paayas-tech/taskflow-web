import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { loadNotifications } from "../store/notifications";
import { getState, setState } from "../store/store";
import { makeProject } from "../test/fakeApi";
import { renderPage, seedStore } from "../test/renderApp";
import { InboxPage } from "./InboxPage";

const members = [
  {
    projectId: "project-1",
    userId: "user-2",
    role: "editor",
    displayName: "Ada Lovelace",
    avatarUrl: null,
  },
];

const notifications = [
  {
    id: "notification-comment",
    type: "comment_added",
    projectId: "project-1",
    readAt: null,
    createdAt: "2026-09-02T09:00:00.000Z",
    data: { actorId: "user-2", taskTitle: "the brief" },
  },
  {
    id: "notification-mention",
    type: "mentioned",
    projectId: "project-1",
    readAt: "2026-09-01T10:00:00.000Z",
    createdAt: "2026-09-01T09:00:00.000Z",
    data: { actorId: "user-2", taskTitle: "the roadmap" },
  },
];

const seed = {
  projects: [makeProject({ id: "project-1", name: "Website relaunch" })],
  members,
  notifications,
};

describe("InboxPage", () => {
  it("counts each tab and filters the list by the selected one", async () => {
    await seedStore(seed);
    renderPage(<InboxPage />);

    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /Unread/ })).toHaveTextContent("1");

    await userEvent.click(screen.getByRole("tab", { name: /Mentions/ }));
    expect(screen.getByText(/mentioned you on the roadmap/)).toBeInTheDocument();
    expect(screen.queryByText(/added a comment/)).not.toBeInTheDocument();
  });

  it("marks everything read and then disables the button", async () => {
    const { api } = await seedStore(seed);
    renderPage(<InboxPage />);

    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => expect(api.callCount("markAllNotificationsRead")).toBe(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled()
    );
  });

  it("dismisses a notification without opening it", async () => {
    const { api } = await seedStore(seed);
    renderPage(<InboxPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /^Dismiss: Ada Lovelace added a comment/ })
    );

    await waitFor(() =>
      expect(api.callsOf("deleteNotification")[0]).toEqual(["notification-comment"])
    );
    expect(api.callCount("markNotificationRead")).toBe(0);
    expect(screen.queryByText(/added a comment/)).not.toBeInTheDocument();
  });

  it("opening an unread notification marks it read and goes to its project", async () => {
    const { api } = await seedStore(seed);
    renderPage(<InboxPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /^Ada Lovelace added a comment/ })
    );

    await waitFor(() =>
      expect(api.callsOf("markNotificationRead")[0]).toEqual(["notification-comment"])
    );
    expect(getState().ui.path).toBe("/projects/project-1/overview");
  });

  it("shows the per-tab empty state when nothing is unread", async () => {
    await seedStore({ ...seed, notifications: [notifications[1]] });
    renderPage(<InboxPage />);

    await userEvent.click(screen.getByRole("tab", { name: /Unread/ }));
    expect(screen.getByText("Every notification has been read.")).toBeInTheDocument();
  });

  it("retries a failed load from the error notice", async () => {
    const { api } = await seedStore({ ...seed, notifications: [] });
    api.failNext("listNotifications", new Error("offline"));
    await loadNotifications();
    renderPage(<InboxPage />);

    expect(screen.getByText("Inbox is temporarily unavailable.")).toBeInTheDocument();

    const before = api.callCount("listNotifications");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(api.callCount("listNotifications")).toBe(before + 1));
  });

  it("warns when realtime updates are paused", async () => {
    await seedStore(seed);
    setState({ notificationsLive: false });
    renderPage(<InboxPage />);

    expect(
      screen.getByText(
        "Live updates are paused. Refresh to check for new activity."
      )
    ).toBeInTheDocument();
  });
});
