import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WelcomeSplash } from "./WelcomeSplash";

afterEach(() => vi.useRealTimers());

describe("WelcomeSplash", () => {
  it("cycles its message, fades, and completes after the transition", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<WelcomeSplash duration={1600} fadeDuration={400} onComplete={onComplete} />);

    expect(screen.getByRole("region", { name: "Welcome to Taskflow" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Taskflow" })).toBeInTheDocument();
    expect(screen.getByText("Orchestrating engineering workflows…")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByText("Streamlining sprints & delivery…")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByRole("region", { name: "Welcome to Taskflow" })).toHaveClass("is-leaving");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(400));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
