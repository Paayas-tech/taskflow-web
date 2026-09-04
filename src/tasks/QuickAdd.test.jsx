import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage } from "../test/renderApp";
import { QuickAdd } from "./QuickAdd";

describe("QuickAdd", () => {
  it("creates the typed task and clears the field", async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: "task-1" });
    renderPage(<QuickAdd onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText("Task name"), "Renew domain{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Renew domain");
    expect(screen.getByLabelText("Task name")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the title and shows the error when the create fails", async () => {
    // Store actions resolve to `null` on failure instead of throwing.
    const onCreate = vi.fn().mockResolvedValue(null);
    renderPage(<QuickAdd onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText("Task name"), "Renew domain{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't create this task. Check your connection and try again."
    );
    expect(screen.getByLabelText("Task name")).toHaveValue("Renew domain");
  });

  it("shows the message from a rejected create", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("Pick a project you can edit."));
    renderPage(<QuickAdd onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText("Task name"), "Renew domain{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Pick a project you can edit.");
    expect(screen.getByLabelText("Task name")).toHaveValue("Renew domain");
  });
});
