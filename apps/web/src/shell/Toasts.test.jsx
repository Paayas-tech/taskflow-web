import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderPage, seedStore } from "../test/renderApp";
import { getState } from "../store/store";
import { notify, setReminderNotice } from "../store/ui";
import { Toasts } from "./Toasts";

describe("Toasts", () => {
  it("renders nothing while there is no message", async () => {
    await seedStore();
    const { container } = renderPage(<Toasts />);

    expect(container).toBeEmptyDOMElement();
  });

  it("announces an error notice assertively and marks it as an error", async () => {
    await seedStore();
    notify({ tone: "error", text: "We couldn't save that task move." });
    renderPage(<Toasts />);

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("We couldn't save that task move.");
    expect(toast).toHaveClass("toast", "toast-error");
    expect(toast).toHaveAttribute("aria-live", "assertive");
  });

  it("announces a plain notice politely", async () => {
    await seedStore();
    notify({ text: "Invitation sent." });
    renderPage(<Toasts />);

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("toast-info");
    expect(toast).toHaveAttribute("aria-live", "polite");
  });

  it("stacks a notice and a reminder instead of overlapping them", async () => {
    const user = userEvent.setup();
    await seedStore();
    notify({ tone: "error", text: "We couldn't archive that task." });
    setReminderNotice({ id: "task-1", title: "Ship the release notes" });
    renderPage(<Toasts />);

    const toasts = document.querySelectorAll(".toast");
    expect(toasts).toHaveLength(2);
    const stack = document.querySelector(".toast-stack");
    expect(stack).not.toBeNull();
    toasts.forEach((toast) => expect(toast.parentElement).toBe(stack));

    // Both are separately reachable while they share the corner.
    await user.click(screen.getByRole("button", { name: "Dismiss reminder" }));
    expect(getState().ui.reminderNotice).toBeNull();

    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(getState().ui.notice).toBeNull();
  });
});
