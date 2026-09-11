import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "./Menu";

const renderMenu = (items) =>
  render(
    <Menu
      trigger={(triggerProps) => (
        <button type="button" {...triggerProps}>
          Actions
        </button>
      )}
      items={items}
    />
  );

describe("Menu", () => {
  it("opens on the trigger and runs the selected item", async () => {
    const onSelect = vi.fn();
    renderMenu([
      { id: "heading", heading: true, label: "Task" },
      { id: "edit", label: "Edit", onSelect },
      { id: "sep", separator: true },
      { id: "delete", label: "Delete", danger: true },
    ]);

    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);

    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("skips disabled items when arrowing and closes on Escape", async () => {
    renderMenu([
      { id: "edit", label: "Edit" },
      { id: "archive", label: "Archive", disabled: true },
      { id: "delete", label: "Delete" },
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("portals the menu outside clipping ancestors and still handles outside clicks", async () => {
    const { container } = renderMenu([{ id: "open", label: "Open" }]);

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));

    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(container).not.toContainElement(menu);

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
