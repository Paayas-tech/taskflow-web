import { describe, expect, it, vi } from "vitest";
import { find, findAll, findByText, props, render, textContent } from "../test/elementTree";
import { ProjectStoriesTab } from "./ProjectStoriesTab";

const todayKey = "2026-09-02";

const stories = [
  {
    id: "story-1",
    title: "Billing",
    description: "Invoices and payments",
    status: "in-progress",
    dueDate: "2026-09-10",
    assigneeId: "user-b",
    assigneeName: "Asha Rao",
    workType: "story",
  },
  { id: "story-2", title: "Onboarding", description: "", status: "todo", workType: "story" },
];

const tasks = [
  { id: "task-1", storyId: "story-1", status: "completed", completed: true },
  { id: "task-2", storyId: "story-1", status: "todo" },
  { id: "task-3", storyId: "story-1", status: "in-progress" },
  { id: "task-4", storyId: null, status: "todo" },
];

const members = [{ userId: "user-b", displayName: "Asha Rao", role: "editor" }];

const columns = [
  { id: "col-1", name: "To do", category: "todo" },
  { id: "col-2", name: "Doing", category: "in_progress" },
  { id: "col-3", name: "Shipped", category: "done" },
];

const hasClass = (node, className) =>
  String(props(node).className || "").split(" ").includes(className);

const renderTab = (overrides = {}) =>
  render(
    ProjectStoriesTab({
      stories,
      tasks,
      members,
      columns: [],
      onOpenStory: vi.fn(),
      onNewStory: vi.fn(),
      archivedStories: [],
      onRestoreStory: vi.fn(),
      todayKey,
      ...overrides,
    })
  );

const storyRows = (tree) => findAll(tree, (node) => hasClass(node, "story-row"));

describe("ProjectStoriesTab", () => {
  it("counts each story's linked tasks in its progress bar", () => {
    const rows = storyRows(renderTab());
    const bar = find(rows[0], (node) => props(node).role === "progressbar");

    expect(textContent(find(rows[0], (node) => hasClass(node, "story-row-count")))).toBe("1/3");
    expect(props(bar)["aria-valuenow"]).toBe(33);
    expect(props(bar)["aria-label"]).toBe("Billing progress");
    expect(props(find(bar, (node) => hasClass(node, "progress-fill"))).style).toEqual({
      width: "33%",
    });

    const empty = find(rows[1], (node) => props(node).role === "progressbar");
    expect(textContent(find(rows[1], (node) => hasClass(node, "story-row-count")))).toBe("0/0");
    expect(props(empty)["aria-valuenow"]).toBe(0);
  });

  it("shows the story title, description, status, due date and assignee", () => {
    const [row] = storyRows(renderTab());

    expect(textContent(find(row, (node) => hasClass(node, "story-row-title")))).toBe("Billing");
    expect(textContent(find(row, (node) => hasClass(node, "story-row-description")))).toBe(
      "Invoices and payments"
    );
    expect(textContent(find(row, (node) => hasClass(node, "badge")))).toBe("In progress");
    expect(textContent(find(row, (node) => node.type === "time"))).toContain("Sep");
    expect(props(find(row, (node) => hasClass(node, "avatar"))).title).toBe("Asha Rao");
  });

  it("breaks the progress down by board column when the project has columns", () => {
    const [row] = storyRows(renderTab({ columns }));

    expect(props(find(row, (node) => hasClass(node, "story-row-progress"))).title).toBe(
      "To do 1 · Doing 1 · Shipped 1"
    );
  });

  it("opens a story from a click, Enter and Space and highlights the selected one", () => {
    const onOpenStory = vi.fn();
    const rows = storyRows(renderTab({ onOpenStory, selectedStoryId: "story-2" }));

    expect(props(rows[0]).role).toBe("button");
    expect(props(rows[0]).tabIndex).toBe(0);
    expect(hasClass(rows[0], "is-selected")).toBe(false);
    expect(hasClass(rows[1], "is-selected")).toBe(true);
    expect(props(rows[1])["aria-current"]).toBe("true");

    props(rows[0]).onClick({ currentTarget: "row-element" });
    expect(onOpenStory).toHaveBeenCalledWith(
      expect.objectContaining({ id: "story-1" }),
      "row-element"
    );

    const preventDefault = vi.fn();
    props(rows[0]).onKeyDown({ key: " ", preventDefault, currentTarget: "row-element" });
    expect(preventDefault).toHaveBeenCalled();
    expect(onOpenStory).toHaveBeenCalledTimes(2);

    props(rows[0]).onKeyDown({ key: "a", preventDefault: vi.fn(), currentTarget: "row-element" });
    expect(onOpenStory).toHaveBeenCalledTimes(2);
  });

  it("invites a first story when there are none", () => {
    const onNewStory = vi.fn();
    const tree = renderTab({ stories: [], onNewStory });

    expect(textContent(tree)).toContain("No stories yet");
    expect(textContent(tree)).toContain("Stories group related tasks.");

    findByText(tree, "New story").props.onClick();
    expect(onNewStory).toHaveBeenCalled();
  });

  it("hides the create action from viewers", () => {
    const tree = renderTab({ stories: [], readOnly: true });

    expect(textContent(tree)).toContain("No stories yet");
    expect(findByText(tree, "New story")).toBeUndefined();
  });

  it("restores an archived story and marks the pending row busy", () => {
    const onRestoreStory = vi.fn();
    const archivedStories = [
      { id: "story-9", title: "Old work" },
      { id: "story-8", title: "Older work" },
    ];
    const tree = renderTab({ archivedStories, onRestoreStory });

    expect(textContent(find(tree, (node) => node.type === "summary"))).toBe(
      "Archived stories (2)"
    );

    const buttons = findAll(tree, (node) => textContent(node) === "Restore" && node.type === "button");
    expect(buttons).toHaveLength(2);
    buttons[0].props.onClick();
    expect(onRestoreStory).toHaveBeenCalledWith("story-9");

    const busy = renderTab({ archivedStories, onRestoreStory, restoringId: "story-9" });
    const busyButtons = findAll(busy, (node) => node.type === "button" && hasClass(node, "btn"));
    expect(props(busyButtons[0])["aria-busy"]).toBe(true);
    expect(props(busyButtons[0]).disabled).toBe(true);
    expect(props(busyButtons[1]).disabled).toBe(true);
  });

  it("hides the archive from viewers", () => {
    const tree = renderTab({
      archivedStories: [{ id: "story-9", title: "Old work" }],
      readOnly: true,
    });

    expect(find(tree, (node) => node.type === "details")).toBeUndefined();
    expect(textContent(tree)).not.toContain("Old work");
  });

  it("falls back to the member directory for an assignee without a stored name", () => {
    const tree = renderTab({
      stories: [{ id: "story-1", title: "Billing", assigneeId: "user-b" }],
      members: [{ userId: "user-b", displayName: "" }],
    });

    expect(props(find(tree, (node) => hasClass(node, "avatar"))).title).toBe("TaskFlow user");
  });
});
