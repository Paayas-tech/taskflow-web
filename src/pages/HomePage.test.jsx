import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const taskModule = vi.hoisted(() => ({
  TaskRow: () => null,
  QuickAdd: () => null,
}));

vi.mock("../tasks", () => taskModule);

import InvitationRow from "../collaboration/InvitationRow";
import AssignedWidget from "../home/AssignedWidget";
import InboxWidget from "../home/InboxWidget";
import MyTasksWidget from "../home/MyTasksWidget";
import ProjectsWidget from "../home/ProjectsWidget";
import { find, findAll, props, textContent } from "../test/elementTree";
import { Button } from "../ui";
import HomePage from "./HomePage";

const todayKey = "2026-09-02";
const now = new Date(2026, 8, 2, 9, 30);

const task = (overrides = {}) => ({
  id: "task",
  title: "Task",
  status: "todo",
  priority: "medium",
  completed: false,
  dueDate: "",
  projectId: null,
  archivedAt: null,
  ...overrides,
});

const tasks = [
  task({ id: "1", title: "Ship release", dueDate: todayKey }),
  task({ id: "2", title: "Second today", dueDate: todayKey }),
  task({ id: "3", title: "Fix billing", dueDate: "2026-08-28" }),
];

const projects = [
  { id: "apollo", name: "Apollo", status: "active", viewerRole: "owner", updatedAt: null },
  { id: "bee", name: "Bee", status: "archived", viewerRole: "editor", updatedAt: null },
];

const invitation = (overrides = {}) => ({
  id: "invite-1",
  projectId: "comet",
  email: "priya@example.com",
  role: "editor",
  status: "pending",
  expiresAt: "2099-01-01T00:00:00Z",
  inviterDisplayName: "Sam Reed",
  project: { name: "Comet" },
  ...overrides,
});

const baseProps = (overrides = {}) => ({
  userId: "user-1",
  displayName: "Karthik Rajagopalan",
  now,
  tasks,
  projects,
  invitations: [],
  notifications: [],
  taskActions: { pendingIds: new Set(), createPersonal: vi.fn(), toggleComplete: vi.fn() },
  onOpenTask: vi.fn(),
  onNewTask: vi.fn(),
  onNewProject: vi.fn(),
  onNavigate: vi.fn(),
  onRetryTasks: vi.fn(),
  onRetryProjects: vi.fn(),
  onAcceptInvitation: vi.fn(() => Promise.resolve()),
  onDeclineInvitation: vi.fn(() => Promise.resolve()),
  ...overrides,
});

const widget = (tree, component) => find(tree, (node) => node.type === component);
const heading = (tree) => textContent(find(tree, (node) => node.type === "h1"));
const summary = (tree) =>
  textContent(find(tree, (node) => props(node).className === "home-summary"));

describe("HomePage greeting", () => {
  it("greets by the time of day and the first name", () => {
    expect(heading(HomePage(baseProps()))).toBe("Good morning, Karthik");
    expect(heading(HomePage(baseProps({ now: new Date(2026, 8, 2, 13, 0) })))).toBe(
      "Good afternoon, Karthik"
    );
    expect(heading(HomePage(baseProps({ now: new Date(2026, 8, 2, 17, 0) })))).toBe(
      "Good evening, Karthik"
    );
    expect(heading(HomePage(baseProps({ displayName: "  " })))).toBe("Good morning");
  });

  it("dates the greeting and summarises only the non-zero counts", () => {
    const tree = HomePage(baseProps());
    const date = find(tree, (node) => node.type === "time");

    expect(props(date).dateTime).toBe(todayKey);
    expect(textContent(date)).toContain("Wednesday");
    expect(textContent(date)).toContain("September");
    expect(summary(tree)).toBe("2 due today · 1 overdue · 1 project");

    const quiet = HomePage(baseProps({ tasks: [], projects: [] }));
    expect(find(quiet, (node) => props(node).className === "home-summary")).toBeUndefined();

    expect(summary(HomePage(baseProps({ tasks: [tasks[2]] })))).toBe("1 overdue · 1 project");
  });

  it("opens the composer from the header", () => {
    const pageProps = baseProps();
    const tree = HomePage(pageProps);
    const newTask = find(
      tree,
      (node) => node.type === Button && textContent(node) === "New task"
    );

    props(newTask).onClick();
    expect(pageProps.onNewTask).toHaveBeenCalledWith();
  });
});

describe("HomePage widgets", () => {
  it("feeds every widget from the page props", () => {
    const pageProps = baseProps({
      tasksLoading: true,
      tasksError: "Tasks are unavailable.",
      projectsLoading: true,
      projectsError: "Projects are unavailable.",
      notificationsLoading: true,
      selectedTaskId: "1",
      formatSettings: { format: "24-hour" },
    });
    const tree = HomePage(pageProps);

    const myTasks = props(widget(tree, MyTasksWidget));
    expect(myTasks.tasks).toBe(pageProps.tasks);
    expect(myTasks.todayKey).toBe(todayKey);
    expect(myTasks.loading).toBe(true);
    expect(myTasks.error).toBe("Tasks are unavailable.");
    expect(myTasks.onRetry).toBe(pageProps.onRetryTasks);
    expect(myTasks.selectedTaskId).toBe("1");
    expect(myTasks.context.projectsById.get("apollo").name).toBe("Apollo");

    const assigned = props(widget(tree, AssignedWidget));
    expect(assigned.userId).toBe("user-1");
    expect(assigned.context).toBe(myTasks.context);

    const projectsWidget = props(widget(tree, ProjectsWidget));
    expect(projectsWidget.projects).toBe(pageProps.projects);
    expect(projectsWidget.loading).toBe(true);
    expect(projectsWidget.error).toBe("Projects are unavailable.");
    expect(projectsWidget.onRetry).toBe(pageProps.onRetryProjects);
    expect(projectsWidget.onNewProject).toBe(pageProps.onNewProject);

    const inbox = props(widget(tree, InboxWidget));
    expect(inbox.notifications).toBe(pageProps.notifications);
    expect(inbox.loading).toBe(true);
    expect(inbox.formatSettings).toEqual({ format: "24-hour" });
  });
});

describe("HomePage invitations", () => {
  it("stays hidden when there is no invitation", () => {
    const tree = HomePage(baseProps());
    expect(find(tree, (node) => node.type === InvitationRow)).toBeUndefined();
  });

  it("announces the invitations and accepts one by id", async () => {
    const pageProps = baseProps({
      invitations: [invitation(), invitation({ id: "invite-2", project: { name: "Delta" } })],
    });
    const runner = runtime.createRunner(HomePage);
    const tree = runner.render(pageProps);

    expect(
      textContent(find(tree, (node) => props(node).className === "home-invitations-title"))
    ).toBe("You have 2 project invitations");

    const rows = findAll(tree, (node) => node.type === InvitationRow);
    expect(rows.map((row) => props(row).invitation.id)).toEqual(["invite-1", "invite-2"]);
    expect(props(rows[0]).incoming).toBe(true);
    expect(props(rows[0]).busy).toBe(false);

    await props(rows[0]).onAccept(props(rows[0]).invitation);
    expect(pageProps.onAcceptInvitation).toHaveBeenCalledWith("invite-1");

    await props(rows[1]).onDecline(props(rows[1]).invitation);
    expect(pageProps.onDeclineInvitation).toHaveBeenCalledWith("invite-2");
  });

  it("uses the singular heading and marks the acting row busy", () => {
    const pageProps = baseProps({
      invitations: [invitation()],
      onAcceptInvitation: vi.fn(() => new Promise(() => {})),
    });
    const runner = runtime.createRunner(HomePage);
    const tree = runner.render(pageProps);

    expect(
      textContent(find(tree, (node) => props(node).className === "home-invitations-title"))
    ).toBe("You have 1 project invitation");

    const row = find(tree, (node) => node.type === InvitationRow);
    void props(row).onAccept(props(row).invitation);

    const pending = runner.render();
    expect(props(find(pending, (node) => node.type === InvitationRow)).busy).toBe(true);
  });

  it("reports a failed response without losing the banner", async () => {
    const pageProps = baseProps({
      invitations: [invitation()],
      onAcceptInvitation: vi.fn(() => Promise.reject(new Error("That invitation expired."))),
    });
    const runner = runtime.createRunner(HomePage);
    const tree = runner.render(pageProps);
    const row = find(tree, (node) => node.type === InvitationRow);

    await props(row).onAccept(props(row).invitation);
    const failed = runner.render();
    const error = find(failed, (node) => props(node).className === "home-invitation-error");

    expect(props(error).role).toBe("alert");
    expect(textContent(error)).toBe("That invitation expired.");
    expect(props(find(failed, (node) => node.type === InvitationRow)).busy).toBe(false);
  });
});
