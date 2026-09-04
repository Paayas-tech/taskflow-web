import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createFakeApi } from "../test/fakeApi";
import { createSelector } from "./selectors";
import {
  api,
  configureStore,
  getState,
  initialState,
  resetStore,
  setState,
  subscribe,
  useStore,
} from "./store";

describe("store", () => {
  it("normalizes an unknown browser URL in both state and the address bar", () => {
    window.history.replaceState({}, "", "/unknown/path?from=test#section");

    configureStore({ api: createFakeApi() });

    expect(getState().ui.path).toBe("/");
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?from=test");
    expect(window.location.hash).toBe("#section");
    window.history.replaceState({}, "", "/");
  });

  it("starts from the documented initial state", () => {
    configureStore({ api: createFakeApi() });

    const state = getState();
    expect(state.auth).toEqual({ status: "booting", user: null, recovery: false });
    expect(state.tasks).toEqual({});
    expect(state.loaded.tasks).toBe("idle");
    expect(state.settings.theme.mode).toBe("light");
    expect(state.ui.composer.open).toBe(false);
  });

  it("merges a partial state and notifies subscribers once", () => {
    configureStore({ api: createFakeApi() });
    const seen = [];
    const unsubscribe = subscribe((state) => seen.push(state.invitations.length));

    setState({ invitations: [{ id: "invitation-1" }] });
    expect(getState().invitations).toHaveLength(1);
    expect(seen).toEqual([1]);

    unsubscribe();
    setState({ invitations: [] });
    expect(seen).toEqual([1]);
  });

  it("accepts an updater and skips the notification when nothing changed", () => {
    configureStore({ api: createFakeApi() });
    let notifications = 0;
    subscribe(() => {
      notifications += 1;
    });

    setState((state) => ({ notifications: state.notifications }));
    expect(notifications).toBe(0);

    setState((state) => ({ googleEvents: [...state.googleEvents, { id: "event" }] }));
    expect(notifications).toBe(1);
  });

  it("resets back to the initial state", () => {
    configureStore({ api: createFakeApi() });
    setState({ tasks: { "task-1": { id: "task-1" } } });

    resetStore();
    expect(getState().tasks).toEqual(initialState().tasks);
  });

  it("hands the configured api to the actions and refuses to run without one", () => {
    const fake = createFakeApi();
    configureStore({ api: fake });
    expect(api()).toBe(fake);

    configureStore({});
    expect(() => api()).toThrow(/has not been configured/);
  });

  it("re-renders a component when the data its selector reads changes", async () => {
    configureStore({ api: createFakeApi() });
    const selectTitles = createSelector(
      [(state) => state.tasks],
      (tasks) => Object.values(tasks).map((task) => task.title)
    );
    let renders = 0;

    const TaskTitles = () => {
      const titles = useStore(selectTitles);
      renders += 1;
      return (
        <div>
          <p>{titles.join(", ") || "No tasks"}</p>
          <button
            type="button"
            onClick={() => setState({ searchOpen: false, googleEvents: [] })}
          >
            Unrelated change
          </button>
        </div>
      );
    };

    render(<TaskTitles />);
    expect(screen.getByText("No tasks")).toBeInTheDocument();

    const rendersBefore = renders;
    await userEvent.click(screen.getByRole("button", { name: "Unrelated change" }));
    expect(renders).toBe(rendersBefore);

    setState({ tasks: { "task-1": { id: "task-1", title: "Ship it" } } });
    expect(await screen.findByText("Ship it")).toBeInTheDocument();
  });
});
