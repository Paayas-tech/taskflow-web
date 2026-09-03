import { describe, expect, it, vi } from "vitest";

const runtime = await vi.hoisted(async () => {
  const { createHookRuntime } = await import("../test/hookRuntime");
  return createHookRuntime();
});

vi.mock("react", () => runtime.react);

const prefetchProjectWorkspace = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("../application/projectWorkspaceLoader", () => ({ prefetchProjectWorkspace }));

import { find, findAll, findByText, props, render, textContent } from "../test/elementTree";
import ProjectsPage from "./ProjectsPage";

const userId = "user-a";

const owned = {
  id: "project-owned",
  name: "Website launch",
  description: "Marketing site",
  color: "#5b5bd6",
  status: "active",
  ownerId: userId,
  viewerRole: "owner",
  updatedAt: "2026-09-01T10:00:00.000Z",
};

const shared = {
  id: "project-shared",
  name: "Billing revamp",
  description: "Shared with me",
  status: "active",
  ownerId: "user-b",
  viewerRole: "editor",
};

const archived = {
  id: "project-archived",
  name: "Old roadmap",
  description: "",
  status: "archived",
  ownerId: userId,
  viewerRole: "owner",
};

const readOnly = {
  id: "project-readonly",
  name: "Design system",
  description: "",
  status: "active",
  ownerId: "user-c",
  viewerRole: "viewer",
};

const baseProps = (overrides = {}) => ({
  userId,
  projects: [owned, shared, archived],
  loading: false,
  error: "",
  onRetry: vi.fn(),
  onCreateProject: vi.fn().mockResolvedValue("project-new"),
  onUpdateProject: vi.fn().mockResolvedValue(undefined),
  onDeleteProject: vi.fn().mockResolvedValue(undefined),
  onOpenProject: vi.fn(),
  createRequest: 0,
  invitations: [],
  invitationsLoading: false,
  invitationsError: "",
  onRetryInvitations: vi.fn(),
  onAcceptInvitation: vi.fn().mockResolvedValue(undefined),
  onDeclineInvitation: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mount = (overrides = {}) => {
  const runner = runtime.createRunner(ProjectsPage);
  runner.render(baseProps(overrides));
  return runner;
};

const hasClass = (node, className) =>
  String(props(node).className || "")
    .split(" ")
    .includes(className);

const rows = (runner) => findAll(runner.output, (node) => hasClass(node, "project-row"));

const rowFor = (runner, name) =>
  rows(runner).find((node) => props(node)["aria-label"] === `Open ${name}`);

const menuItems = (row) => props(find(row, (node) => Array.isArray(props(node).items))).items;

const visibleCount = (runner) =>
  textContent(find(runner.output, (node) => hasClass(node, "page-title-count")));

const control = (runner, label) =>
  find(runner.output, (node) => props(node).ariaLabel === label || props(node)["aria-label"] === label);

const dialog = (runner) => find(runner.output, (node) => "project" in props(node));

const confirm = (runner) =>
  find(runner.output, (node) => props(node).confirmLabel === "Delete project");

const invitationRows = (runner) =>
  findAll(runner.output, (node) => Boolean(props(node).invitation));

const deferred = () => {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe("ProjectsPage filters", () => {
  it("hides archived projects and counts what is visible", () => {
    const runner = mount();

    expect(visibleCount(runner)).toBe("2");
    expect(rows(runner).map((node) => props(node)["aria-label"])).toEqual([
      "Open Website launch",
      "Open Billing revamp",
    ]);
  });

  it("splits owned from shared projects", () => {
    const runner = mount();

    props(control(runner, "Filter projects by access")).onChange("mine");
    runner.render();
    expect(rows(runner).map((node) => props(node)["aria-label"])).toEqual([
      "Open Website launch",
    ]);

    props(control(runner, "Filter projects by access")).onChange("shared");
    runner.render();
    expect(rows(runner).map((node) => props(node)["aria-label"])).toEqual([
      "Open Billing revamp",
    ]);
  });

  it("searches the name and the description", () => {
    const runner = mount();

    props(control(runner, "Search projects")).onChange({ target: { value: "shared with" } });
    runner.render();

    expect(rows(runner).map((node) => props(node)["aria-label"])).toEqual([
      "Open Billing revamp",
    ]);
  });

  it("adds archived projects when the chip is checked", () => {
    const runner = mount();
    const chip = find(
      runner.output,
      (node) => props(node).label === "Show archived"
    );

    props(chip).onChange({ target: { checked: true } });
    runner.render();

    expect(visibleCount(runner)).toBe("3");
    expect(textContent(render(rowFor(runner, "Old roadmap")))).toContain("Archived");
  });

  it("explains an empty result without losing the projects", () => {
    const runner = mount();

    props(control(runner, "Search projects")).onChange({ target: { value: "nothing" } });
    runner.render();

    expect(rows(runner)).toHaveLength(0);
    expect(
      textContent(find(runner.output, (node) => hasClass(node, "projects-no-match")))
    ).toBe("No matching projects");
  });
});

describe("ProjectsPage rows", () => {
  it("shows the role badge and the last update", () => {
    const runner = mount();
    const row = render(rowFor(runner, "Website launch"));

    expect(textContent(row)).toContain("Owner");
    expect(textContent(row)).toContain("Marketing site");
    expect(textContent(row)).toContain("Updated");
    expect(textContent(render(rowFor(runner, "Billing revamp")))).toContain("Editor");
  });

  it("opens the project from a row click and from the menu", () => {
    const pageProps = baseProps();
    const runner = runtime.createRunner(ProjectsPage);
    runner.render(pageProps);

    props(rowFor(runner, "Website launch")).onClick();
    expect(pageProps.onOpenProject).toHaveBeenCalledWith("project-owned");

    menuItems(rowFor(runner, "Billing revamp"))[0].onSelect();
    expect(pageProps.onOpenProject).toHaveBeenCalledWith("project-shared");
  });

  it("keeps edit, archive and delete for owners only", () => {
    const runner = mount({ projects: [owned, readOnly, archived] });

    expect(menuItems(rowFor(runner, "Website launch")).map((item) => item.label)).toEqual([
      "Open",
      "Edit",
      "Archive",
      "Delete",
    ]);
    expect(menuItems(rowFor(runner, "Design system")).map((item) => item.label)).toEqual([
      "Open",
    ]);

    props(find(runner.output, (node) => props(node).label === "Show archived")).onChange({
      target: { checked: true },
    });
    runner.render();

    expect(menuItems(rowFor(runner, "Old roadmap")).map((item) => item.label)).toEqual([
      "Open",
      "Edit",
      "Restore",
      "Delete",
    ]);
  });

  it("prefetches the workspace when a row is hovered", () => {
    prefetchProjectWorkspace.mockClear();
    const runner = mount();

    props(rowFor(runner, "Website launch")).onMouseEnter();

    expect(prefetchProjectWorkspace).toHaveBeenCalledWith(userId, "project-owned");
  });

  it("archives and restores through onUpdateProject", async () => {
    const pageProps = baseProps({ projects: [owned, archived] });
    const runner = runtime.createRunner(ProjectsPage);
    runner.render(pageProps);

    await menuItems(rowFor(runner, "Website launch"))[2].onSelect();
    expect(pageProps.onUpdateProject).toHaveBeenCalledWith("project-owned", {
      status: "archived",
    });

    props(find(runner.output, (node) => props(node).label === "Show archived")).onChange({
      target: { checked: true },
    });
    runner.render();

    await menuItems(rowFor(runner, "Old roadmap"))[2].onSelect();
    expect(pageProps.onUpdateProject).toHaveBeenCalledWith("project-archived", {
      status: "active",
    });
  });

  it("reports an archive failure and lets it be dismissed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onUpdateProject = vi.fn().mockRejectedValue(new Error("offline"));
    const runner = mount({ onUpdateProject });

    await menuItems(rowFor(runner, "Website launch"))[2].onSelect();
    runner.render();

    const notice = find(runner.output, (node) => props(node).tone === "error");
    expect(textContent(notice)).toContain("We couldn't archive");

    props(notice).onDismiss();
    runner.render();
    expect(find(runner.output, (node) => props(node).tone === "error")).toBeUndefined();
  });
});

describe("ProjectsPage create and edit", () => {
  it("opens the create dialog when createRequest changes", () => {
    const runner = runtime.createRunner(ProjectsPage);
    runner.render(baseProps());
    expect(props(dialog(runner)).open).toBe(false);

    runner.render(baseProps({ createRequest: 1 }));
    runner.render();

    expect(props(dialog(runner)).open).toBe(true);
    expect(props(dialog(runner)).project).toBeNull();
  });

  it("opens the create dialog from the header button", () => {
    const runner = mount();

    props(findByText(runner.output, "New project")).onClick();
    runner.render();

    expect(props(dialog(runner)).open).toBe(true);
  });

  it("creates a project and closes the dialog", async () => {
    const pageProps = baseProps({ createRequest: 1 });
    const runner = runtime.createRunner(ProjectsPage);
    runner.render(pageProps);
    runner.render();

    await props(dialog(runner)).onSubmit({
      name: "Phase 4",
      description: "Ship it",
      color: "#1f9d64",
    });
    runner.render();

    expect(pageProps.onCreateProject).toHaveBeenCalledWith({
      name: "Phase 4",
      description: "Ship it",
      color: "#1f9d64",
    });
    expect(props(dialog(runner)).open).toBe(false);
  });

  it("keeps the dialog open with an error when saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onCreateProject = vi.fn().mockRejectedValue(new Error("offline"));
    const runner = mount({ createRequest: 1, onCreateProject });
    runner.render();

    await props(dialog(runner)).onSubmit({ name: "Phase 4", description: "", color: "#5b5bd6" });
    runner.render();

    expect(props(dialog(runner)).open).toBe(true);
    expect(props(dialog(runner)).error).toBe(
      "We couldn't create this project. Check your connection and try again."
    );
  });

  it("prefills the dialog from the Edit menu item and saves the update", async () => {
    const pageProps = baseProps();
    const runner = runtime.createRunner(ProjectsPage);
    runner.render(pageProps);

    menuItems(rowFor(runner, "Website launch"))[1].onSelect();
    runner.render();

    expect(props(dialog(runner)).open).toBe(true);
    expect(props(dialog(runner)).project).toBe(owned);

    await props(dialog(runner)).onSubmit({
      name: "Website relaunch",
      description: "Marketing site",
      color: "#5b5bd6",
    });

    expect(pageProps.onUpdateProject).toHaveBeenCalledWith("project-owned", {
      name: "Website relaunch",
      description: "Marketing site",
      color: "#5b5bd6",
    });
  });
});

describe("ProjectsPage delete", () => {
  it("asks for confirmation before deleting", async () => {
    const pageProps = baseProps();
    const runner = runtime.createRunner(ProjectsPage);
    runner.render(pageProps);

    expect(props(confirm(runner)).open).toBe(false);

    menuItems(rowFor(runner, "Website launch"))[3].onSelect();
    runner.render();

    expect(props(confirm(runner)).open).toBe(true);
    expect(props(confirm(runner)).danger).toBe(true);
    expect(props(confirm(runner)).title).toContain("Website launch");
    expect(pageProps.onDeleteProject).not.toHaveBeenCalled();

    await props(confirm(runner)).onConfirm();
    runner.render();

    expect(pageProps.onDeleteProject).toHaveBeenCalledWith("project-owned");
    expect(props(confirm(runner)).open).toBe(false);
  });

  it("keeps the confirmation open and explains a failed delete", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onDeleteProject = vi.fn().mockRejectedValue(new Error("offline"));
    const runner = mount({ onDeleteProject });

    menuItems(rowFor(runner, "Website launch"))[3].onSelect();
    runner.render();
    await props(confirm(runner)).onConfirm();
    runner.render();

    expect(props(confirm(runner)).open).toBe(true);
    expect(textContent(render(props(confirm(runner)).children))).toContain(
      "We couldn't delete this project."
    );
  });
});

describe("ProjectsPage invitations", () => {
  const invitation = {
    id: "invitation-1",
    role: "editor",
    status: "pending",
    project: { name: "Growth" },
    inviterDisplayName: "Priya Shah",
  };

  it("lists incoming invitations above the projects", () => {
    const runner = mount({ invitations: [invitation] });
    const section = find(
      runner.output,
      (node) => props(node)["aria-labelledby"] === "projects-invitations-title"
    );

    expect(textContent(section)).toContain("Invitations");
    expect(invitationRows(runner)).toHaveLength(1);
    expect(props(invitationRows(runner)[0]).incoming).toBe(true);
    expect(textContent(render(section))).toContain("Growth");
  });

  it("marks the row busy while an invitation is accepted", async () => {
    const pending = deferred();
    const onAcceptInvitation = vi.fn(() => pending.promise);
    const runner = mount({ invitations: [invitation], onAcceptInvitation });

    const response = props(invitationRows(runner)[0]).onAccept(invitation);
    runner.render();

    expect(onAcceptInvitation).toHaveBeenCalledWith("invitation-1");
    expect(props(invitationRows(runner)[0]).busy).toBe(true);

    pending.resolve();
    await response;
    runner.render();

    expect(props(invitationRows(runner)[0]).busy).toBe(false);
  });

  it("declines an invitation and surfaces a failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onDeclineInvitation = vi.fn().mockRejectedValue(new Error("Invitation expired."));
    const runner = mount({ invitations: [invitation], onDeclineInvitation });

    await props(invitationRows(runner)[0]).onDecline(invitation);
    runner.render();

    expect(onDeclineInvitation).toHaveBeenCalledWith("invitation-1");
    expect(textContent(find(runner.output, (node) => props(node).tone === "error"))).toContain(
      "Invitation expired."
    );
  });

  it("retries a failed invitation load", () => {
    const pageProps = baseProps({ invitationsError: "Invitations unavailable." });
    const runner = runtime.createRunner(ProjectsPage);
    runner.render(pageProps);

    const notice = find(runner.output, (node) => props(node).tone === "error");
    expect(textContent(notice)).toContain("Invitations unavailable.");

    props(find(render(props(notice).action), (node) => node.type === "button")).onClick();
    expect(pageProps.onRetryInvitations).toHaveBeenCalledOnce();
  });
});

describe("ProjectsPage list states", () => {
  it("shows skeleton rows while projects load", () => {
    const runner = mount({ loading: true, projects: [] });

    expect(findAll(runner.output, (node) => hasClass(node, "skeleton-row"))).toHaveLength(3);
    expect(textContent(find(runner.output, (node) => props(node).role === "status"))).toBe(
      "Loading projects…"
    );
  });

  it("offers a retry when the list fails", () => {
    const pageProps = baseProps({ error: "Projects unavailable.", projects: [] });
    const runner = runtime.createRunner(ProjectsPage);
    runner.render(pageProps);

    const notice = find(runner.output, (node) => props(node).tone === "error");
    expect(textContent(notice)).toContain("Projects unavailable.");

    props(find(render(props(notice).action), (node) => node.type === "button")).onClick();
    expect(pageProps.onRetry).toHaveBeenCalledOnce();
  });

  it("invites the first project from the empty state", () => {
    const runner = mount({ projects: [] });
    const empty = find(runner.output, (node) => props(node).title === "No projects yet");

    expect(props(empty).icon).toBe("folders");
    expect(props(empty).description).toContain("Projects hold a board");

    props(find(render(props(empty).action), (node) => node.type === "button")).onClick();
    runner.render();

    expect(props(dialog(runner)).open).toBe(true);
  });
});
