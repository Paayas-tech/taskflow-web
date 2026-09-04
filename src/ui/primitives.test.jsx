import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Avatar,
  AvatarStack,
  Badge,
  EmptyState,
  InlineNotice,
  SegmentedControl,
  Spinner,
  Tabs,
  cx,
} from "./primitives";

describe("cx", () => {
  it("joins truthy parts only", () => {
    expect(cx("a", false, undefined, "b", null, "")).toBe("a b");
  });
});

describe("Badge", () => {
  it("renders its tone and an optional dot", () => {
    const { container } = render(
      <Badge tone="warning" dot>
        At risk
      </Badge>
    );
    expect(screen.getByText("At risk")).toHaveClass("badge", "badge-warning");
    expect(container.querySelector(".badge-dot")).toBeInTheDocument();
  });
});

describe("Spinner", () => {
  it("exposes a loading status", () => {
    render(<Spinner size="sm" />);
    expect(screen.getByRole("status", { name: "Loading" })).toHaveClass("spinner-sm");
  });
});

describe("EmptyState", () => {
  it("renders the title, description and action", () => {
    render(
      <EmptyState
        icon="inbox"
        title="Nothing here"
        description="Add your first task"
        action={<button type="button">Add task</button>}
      />
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add your first task")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });
});

describe("InlineNotice", () => {
  it("announces errors as an alert and dismisses", async () => {
    const onDismiss = vi.fn();
    render(
      <InlineNotice tone="error" onDismiss={onDismiss}>
        Could not save
      </InlineNotice>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("Avatar", () => {
  it("shows initials, stack overflow and a placeholder without a name", () => {
    render(
      <>
        <AvatarStack
          people={[{ name: "Ada Lovelace" }, { name: "Grace Hopper" }, { name: "Alan Turing" }]}
          max={2}
        />
        <Avatar />
      </>
    );
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("GH")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  it("marks the active tab and reports selection", async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        ariaLabel="Project views"
        items={[
          { id: "list", label: "List" },
          { id: "board", label: "Board", count: 3 },
        ]}
        value="list"
        onChange={onChange}
      />
    );

    expect(screen.getByRole("tab", { name: "List" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: /Board/ }));
    expect(onChange).toHaveBeenCalledWith("board");
  });
});

describe("SegmentedControl", () => {
  it("presses the active option and reports selection", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="View"
        options={[
          { id: "list", label: "List" },
          { id: "board", label: "Board" },
        ]}
        value="board"
        onChange={onChange}
      />
    );

    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });
});
