import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFilterBar } from "./TaskFilterBar";

const statusFilter = (onChange) => ({
  id: "status",
  label: "Status",
  value: "all",
  defaultValue: "all",
  options: [
    { value: "all", label: "All" },
    { value: "todo", label: "To do" },
  ],
  onChange,
});

describe("TaskFilterBar", () => {
  it("reports the typed search text and the chosen filter value", async () => {
    const onSearch = vi.fn();
    const onChange = vi.fn();
    render(<TaskFilterBar search="" onSearch={onSearch} filters={[statusFilter(onChange)]} />);

    // The search box is controlled by the page, so each keystroke is reported
    // against the value the bar was given.
    await userEvent.type(screen.getByLabelText("Search tasks"), "b");
    expect(onSearch).toHaveBeenLastCalledWith("b");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "todo");
    expect(onChange).toHaveBeenCalledWith("todo");
  });

  it("offers Clear only while filters are active", async () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <TaskFilterBar filters={[statusFilter(vi.fn())]} onClear={onClear} />
    );
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();

    rerender(
      <TaskFilterBar filters={[statusFilter(vi.fn())]} onClear={onClear} activeCount={1} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
