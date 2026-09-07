import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkActionBar } from "./BulkActionBar";

describe("BulkActionBar", () => {
  it("stays hidden until something is selected", () => {
    render(<BulkActionBar selectedCount={0} onAction={vi.fn()} />);

    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("reports the chosen action, mapping unassigned to no assignee", async () => {
    const onAction = vi.fn();
    render(
      <BulkActionBar
        selectedCount={2}
        members={[{ userId: "user-2", displayName: "Ada Lovelace", role: "editor" }]}
        onAction={onAction}
      />
    );

    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText("Change selected task status"),
      "completed"
    );
    expect(onAction).toHaveBeenLastCalledWith("status", "completed");

    await userEvent.selectOptions(
      screen.getByLabelText("Change selected task assignee"),
      "unassigned"
    );
    expect(onAction).toHaveBeenLastCalledWith("assignee", null);
  });
});
