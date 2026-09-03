import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ setters: [] }));
const popover = vi.hoisted(() => ({
  open: false,
  toggle: vi.fn(),
  close: vi.fn(),
  setOpen: vi.fn(),
  rootRef: { current: null },
}));

vi.mock("react", () => ({
  useState: (initial) => {
    const setter = vi.fn();
    hooks.setters.push(setter);
    return [initial, setter];
  },
  useRef: (initial) => ({ current: initial }),
  useEffect: () => {},
}));

vi.mock("./usePopover", () => ({ usePopover: () => popover }));

import { Menu } from "./Menu";
import { find, findAll, textContent } from "../test/elementTree";

const items = [
  { label: "Actions", heading: true },
  { id: "open", label: "Open", onSelect: vi.fn() },
  { id: "archive", label: "Archive", disabled: true, onSelect: vi.fn() },
  { separator: true },
  { id: "delete", label: "Delete permanently", danger: true, onSelect: vi.fn() },
];

const trigger = (triggerProps) => ({ type: "button", props: triggerProps });

afterEach(() => {
  hooks.setters.length = 0;
  vi.clearAllMocks();
  popover.open = false;
});

describe("Menu", () => {
  it("hands the trigger its popover props and renders nothing while closed", () => {
    const output = Menu({ trigger, items });

    expect(output.props.className).toBe("menu-wrap");
    expect(output.props.children[0].props["aria-haspopup"]).toBe("menu");
    expect(output.props.children[0].props["aria-expanded"]).toBe(false);
    expect(find(output, (node) => node.props.role === "menu")).toBeUndefined();
  });

  it("renders headings, separators, disabled and danger items when open", () => {
    popover.open = true;
    const output = Menu({ trigger, items, align: "end" });
    const menu = find(output, (node) => node.props.role === "menu");
    const menuItems = findAll(output, (node) => node.props.role === "menuitem");

    expect(menu.props.className).toBe("menu menu-align-end");
    expect(menuItems).toHaveLength(3);
    expect(menuItems[1].props.disabled).toBe(true);
    expect(menuItems[2].props.className).toBe("menu-item is-danger");
    expect(textContent(find(output, (node) => node.props.className === "menu-heading"))).toBe("Actions");
    expect(find(output, (node) => node.props.role === "separator")).toBeDefined();
  });

  it("closes and reports the selection when an item is chosen", () => {
    popover.open = true;
    const onSelect = vi.fn();
    const output = Menu({ trigger, items: [{ id: "open", label: "Open", onSelect }] });

    findAll(output, (node) => node.props.role === "menuitem")[0].props.onClick();
    expect(popover.close).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("moves the roving focus with the arrow keys and closes on Escape", () => {
    popover.open = true;
    const output = Menu({ trigger, items });
    const menu = find(output, (node) => node.props.role === "menu");
    const setActiveIndex = hooks.setters.at(-1);
    const event = { preventDefault: vi.fn() };

    menu.props.onKeyDown({ ...event, key: "ArrowDown" });
    expect(setActiveIndex).toHaveBeenCalledWith(1);

    menu.props.onKeyDown({ ...event, key: "End" });
    expect(setActiveIndex).toHaveBeenCalledWith(4);

    menu.props.onKeyDown({ ...event, key: "Escape" });
    expect(popover.close).toHaveBeenCalledTimes(1);
  });
});
