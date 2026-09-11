import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeApi, makeProject, makeTask, makeUser } from "../test/fakeApi";
import { startSession } from "./session";
import { configureStore, getState } from "./store";
import {
  clearNotice,
  clearProjectOpenRequest,
  closeComposer,
  closeTask,
  dismissProfilePrompt,
  navigate,
  notify,
  openComposer,
  openTask,
  openTaskInProject,
  setMobileNav,
  setProjectTab,
  setSearchOpen,
  syncPathFromBrowser,
  toggleSidebar,
} from "./ui";

const user = makeUser({ id: "user-1", email: "sam@example.com" });

const boot = async () => {
  const api = createFakeApi({
    user,
    projects: [makeProject({ id: "project-1", ownerId: user.id })],
    tasks: [makeTask({ id: "task-1", projectId: "project-1", assigneeId: user.id })],
  });
  configureStore({ api });
  await startSession(user);
  return api;
};

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  clearNotice();
});

describe("navigation", () => {
  it("normalizes the path, pushes history and closes the mobile nav", async () => {
    await boot();
    setMobileNav(true);

    navigate("/tasks/");

    expect(getState().ui.path).toBe("/tasks");
    expect(getState().ui.mobileNavOpen).toBe(false);
    expect(window.location.pathname).toBe("/tasks");
  });

  it("remembers the pages the default-view setting offers", async () => {
    const api = await boot();
    vi.useFakeTimers();

    navigate("/calendar");
    expect(getState().settings.navigation.lastViewedPath).toBe("/calendar");

    navigate("/settings");
    expect(getState().settings.navigation.lastViewedPath).toBe("/calendar");

    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();
    await Promise.resolve();

    expect(api.callCount("saveSettings")).toBe(1);
    expect(api.callsOf("saveSettings")[0][1].navigation.lastViewedPath).toBe(
      "/calendar"
    );
  });

  it("adopts the browser path after back and forward", async () => {
    await boot();
    navigate("/projects");
    window.history.replaceState({}, "", "/inbox");

    syncPathFromBrowser();

    expect(getState().ui.path).toBe("/inbox");
  });

  it("opens a project task on the tab that project was last left on", async () => {
    await boot();
    setProjectTab("project-1", "board");
    expect(getState().ui.path).toBe("/projects/project-1/board");

    navigate("/");
    openTaskInProject(getState().tasks["task-1"]);

    expect(getState().ui.path).toBe("/projects/project-1/board");
    expect(getState().ui.projectOpenRequest).toMatchObject({
      projectId: "project-1",
      itemId: "task-1",
    });

    clearProjectOpenRequest();
    expect(getState().ui.projectOpenRequest).toBeNull();
  });
});

describe("panel, composer and chrome", () => {
  it("selects and clears the open task", async () => {
    await boot();

    openTask("task-1");
    expect(getState().ui.selectedTaskId).toBe("task-1");

    closeTask();
    expect(getState().ui.selectedTaskId).toBeNull();
  });

  it("carries the composer's initial values and work type", async () => {
    await boot();

    openComposer({ projectId: "project-1", workType: "story", lockProject: true });
    expect(getState().ui.composer).toEqual({
      open: true,
      initialValues: { projectId: "project-1" },
      workType: "story",
      lockProject: true,
    });

    closeComposer();
    expect(getState().ui.composer.open).toBe(false);
  });

  it("remembers the collapsed sidebar and toggles the search dialog", async () => {
    await boot();

    toggleSidebar();
    expect(getState().ui.sidebarCollapsed).toBe(true);
    expect(window.localStorage.getItem("taskflow:sidebar-collapsed")).toBe("true");

    setSearchOpen(true);
    expect(getState().ui.searchOpen).toBe(true);
  });

  it("dismisses the profile prompt for the session", async () => {
    await boot();

    dismissProfilePrompt();

    expect(getState().ui.profilePromptDismissed).toBe(true);
    expect(
      window.sessionStorage.getItem("taskflow.profile-prompt-dismissed.user-1")
    ).toBe("true");
  });
});

describe("notices", () => {
  it("shows one notice and clears it after six seconds", async () => {
    await boot();
    vi.useFakeTimers();

    notify({ tone: "error", text: "We couldn't save your changes." });
    expect(getState().ui.notice).toMatchObject({
      tone: "error",
      text: "We couldn't save your changes.",
    });

    await vi.advanceTimersByTimeAsync(6_000);
    expect(getState().ui.notice).toBeNull();
    vi.useRealTimers();
  });

  it("ignores an empty message and clears on demand", async () => {
    await boot();

    expect(notify({ text: "   " })).toBeNull();
    expect(getState().ui.notice).toBeNull();

    notify({ text: "Saved" });
    clearNotice();
    expect(getState().ui.notice).toBeNull();
  });
});
