import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WelcomeSplash } from "./WelcomeSplash";

afterEach(() => vi.useRealTimers());

describe("WelcomeSplash", () => {
  it("cycles its message, fades, and completes after the transition", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<WelcomeSplash duration={1800} fadeDuration={400} onComplete={onComplete} />);

    expect(screen.getByRole("region", { name: "Welcome to TaskFlow" })).toBeInTheDocument();
    expect(screen.getByText("Orchestrating engineering workflows…")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByText("Streamlining sprints & delivery…")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("region", { name: "Welcome to TaskFlow" })).toHaveClass("is-leaving");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(400));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
