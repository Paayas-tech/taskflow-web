import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";
import { find, findAll, props, textContent } from "../test/elementTree";

const baseProps = () => ({
  currentPath: "/",
  currentView: "home",
  projects: [],
  onNavigate: vi.fn(),
  onNewTask: vi.fn(),
  onNewProject: vi.fn(),
  onOpenSearch: vi.fn(),
  onToggleCollapsed: vi.fn(),
  onMobileClose: vi.fn(),
  user: { displayName: "Priya Shah", email: "priya@example.com" },
});

const navItems = (tree) =>
  findAll(tree, (node) =>
    ["nav-item", "nav-item is-active"].includes(props(node).className)
  );

const byLabel = (tree, label) =>
  find(tree, (node) => (props(node)["aria-label"] ?? props(node).label) === label);

const storage = new Map();

beforeEach(() => {
  storage.clear();
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
  };
});

afterEach(() => {
  delete globalThis.window;
});

describe("Sidebar navigation", () => {
  it("renders the five primary views plus Settings and marks the active one", () => {
    const tree = Sidebar({ ...baseProps(), currentPath: "/tasks", currentView: "tasks" });

    expect(navItems(tree).map((node) => props(node)["aria-label"])).toEqual([
      "Home",
      "My Tasks",
      "Calendar",
      "Inbox",
      "Projects",
      "Settings",
    ]);

    const myTasks = byLabel(tree, "My Tasks");
    expect(props(myTasks).className).toBe("nav-item is-active");
    expect(props(myTasks)["aria-current"]).toBe("page");
    expect(props(byLabel(tree, "Home"))["aria-current"]).toBeUndefined();
  });

  it("keeps Projects active inside a project workspace and Settings active for archived tasks", () => {
    const inProject = Sidebar({
      ...baseProps(),
      currentPath: "/projects/project-a/board",
      currentView: "project",
    });
    expect(props(byLabel(inProject, "Projects")).className).toBe("nav-item is-active");

    const archived = Sidebar({
      ...baseProps(),
      currentPath: "/archived-tasks",
      currentView: "archived",
    });
    expect(props(byLabel(archived, "Settings")).className).toBe("nav-item is-active");
  });

  it("shows unread and invitation badges only when there is something to show", () => {
    const quiet = Sidebar(baseProps());
    expect(find(quiet, (node) => props(node).className === "nav-badge")).toBeUndefined();

    const busy = Sidebar({ ...baseProps(), unreadCount: 3, invitationCount: 1 });
    const badges = findAll(busy, (node) => props(node).className === "nav-badge");

    expect(badges.map((node) => textContent(node))).toEqual(["3", "1"]);
    expect(byLabel(busy, "Inbox, 3 unread")).toBeDefined();
    expect(byLabel(busy, "Projects, 1 pending invitation")).toBeDefined();
  });

  it("navigates and closes the mobile drawer when a view is chosen", () => {
    const sidebarProps = { ...baseProps(), mobileOpen: true };
    const tree = Sidebar(sidebarProps);

    expect(props(tree).className).toBe("sidebar is-open");
    props(byLabel(tree, "Calendar")).onClick();

    expect(sidebarProps.onNavigate).toHaveBeenCalledWith("/calendar");
    expect(sidebarProps.onMobileClose).toHaveBeenCalledOnce();
  });

  it("wires the create, search and collapse controls", () => {
    const sidebarProps = baseProps();
    const tree = Sidebar(sidebarProps);

    props(byLabel(tree, "New task")).onClick();
    props(byLabel(tree, "Search")).onClick();
    props(byLabel(tree, "Collapse sidebar")).onClick();
    props(byLabel(tree, "New project")).onClick();

    expect(sidebarProps.onNewTask).toHaveBeenCalledOnce();
    expect(sidebarProps.onOpenSearch).toHaveBeenCalledOnce();
    expect(sidebarProps.onToggleCollapsed).toHaveBeenCalledOnce();
    expect(sidebarProps.onNewProject).toHaveBeenCalledOnce();
  });
});

describe("Sidebar projects", () => {
  const projects = [
    { id: "project-a", name: "Launch", color: "#5b5bd6", status: "active" },
    { id: "project-b", name: "Website", status: "active" },
    { id: "project-c", name: "Old work", status: "archived" },
  ];

  it("lists active projects and highlights the open one", () => {
    const tree = Sidebar({ ...baseProps(), projects, selectedProjectId: "project-b" });
    const rows = findAll(tree, (node) =>
      String(props(node).className || "").startsWith("project-nav-item")
    );

    expect(rows.map((node) => textContent(node))).toEqual(["Launch", "Website"]);
    expect(props(rows[1]).className).toBe("project-nav-item is-active");
    expect(props(rows[1])["aria-current"]).toBe("page");
  });

  it("opens a project on its last used tab", () => {
    storage.set("taskflow:project-tab:project-a", "stories");
    const sidebarProps = { ...baseProps(), projects };
    const tree = Sidebar(sidebarProps);
    const rows = findAll(tree, (node) =>
      String(props(node).className || "").startsWith("project-nav-item")
    );

    props(rows[0]).onClick();
    props(rows[1]).onClick();

    expect(sidebarProps.onNavigate).toHaveBeenNthCalledWith(
      1,
      "/projects/project-a/stories"
    );
    expect(sidebarProps.onNavigate).toHaveBeenNthCalledWith(
      2,
      "/projects/project-b/overview"
    );
  });

  it("explains the empty project list", () => {
    const tree = Sidebar(baseProps());
    expect(
      textContent(find(tree, (node) => props(node).className?.includes("sidebar-projects-empty")))
    ).toBe("No projects yet");
  });
});

describe("Sidebar collapsed and account states", () => {
  it("hides labels and the project list when collapsed", () => {
    const projects = [{ id: "project-a", name: "Launch", status: "active" }];
    const tree = Sidebar({ ...baseProps(), collapsed: true, projects });

    expect(props(tree).className).toBe("sidebar is-collapsed");
    expect(textContent(tree)).not.toContain("Launch");
    expect(find(tree, (node) => props(node).className === "nav-item-label")).toBeUndefined();
    expect(props(byLabel(tree, "Home")).title).toBe("Home");
    expect(props(byLabel(tree, "Expand sidebar"))).toBeDefined();
  });

  it("surfaces a sign-out failure under the user row", () => {
    const tree = Sidebar({ ...baseProps(), signOutError: "We couldn't sign you out." });
    const alert = find(tree, (node) => props(node).role === "alert");

    expect(textContent(alert)).toBe("We couldn't sign you out.");
  });
});

describe("UserMenu", () => {
  it("offers profile, settings and sign out", () => {
    const menuProps = {
      user: { displayName: "Priya Shah", email: "priya@example.com" },
      onOpenProfile: vi.fn(),
      onOpenSettings: vi.fn(),
      onSignOut: vi.fn(),
    };
    const menu = UserMenu(menuProps);
    const items = props(menu).items;

    expect(items.map((item) => item.label ?? "separator")).toEqual([
      "Profile",
      "Settings",
      "separator",
      "Sign out",
    ]);

    items[0].onSelect();
    items[3].onSelect();
    expect(menuProps.onOpenProfile).toHaveBeenCalledOnce();
    expect(menuProps.onSignOut).toHaveBeenCalledOnce();

    const trigger = props(menu).trigger({ ref: null, onClick: vi.fn() });
    expect(props(trigger)["aria-label"]).toBe("Account menu for Priya Shah");
    expect(textContent(trigger)).toContain("Priya Shah");
  });

  it("shows a busy label while signing out", () => {
    const menu = UserMenu({
      user: { email: "priya@example.com" },
      signOutPending: true,
    });
    const signOut = props(menu).items.at(-1);

    expect(signOut.label).toBe("Signing out…");
    expect(signOut.disabled).toBe(true);
  });
});
