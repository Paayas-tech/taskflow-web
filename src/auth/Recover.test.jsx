import { beforeEach, describe, expect, it, vi } from "vitest";
import { find, findAll, render, textContent } from "../test/elementTree";

const runtime = vi.hoisted(() => {
  let active;
  return {
    activate(runner) { active = runner; },
    useState(initial) {
      const index = active.cursor++;
      active.slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      const slot = active.slots[index];
      return [slot.value, (next) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
    },
  };
});

const auth = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
}));
vi.mock("react", () => ({
  useState: runtime.useState,
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
}));
vi.mock("../application/authService", () => auth);
import Recover from "./Recover";

const createRunner = (props) => ({
  props,
  slots: [],
  cursor: 0,
  render() {
    this.cursor = 0;
    runtime.activate(this);
    return render(Recover(this.props));
  },
});

const passwordInputs = (tree) =>
  findAll(tree, (node) => node.type === "input" && node.props.type === "password");
const formOf = (tree) => find(tree, (node) => node.type === "form");
const noticeText = (tree, role) =>
  textContent(find(tree, (node) => node.props?.role === role));

describe("password recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", { location: { origin: "https://tasks.test" } });
  });

  it("sends a reset link for the trimmed email and confirms without leaking accounts", async () => {
    auth.requestPasswordReset.mockResolvedValue(undefined);
    const runner = createRunner({ recoverySession: false, onBack: vi.fn(), onComplete: vi.fn() });
    let tree = runner.render();

    find(tree, (node) => node.type === "input" && node.props.type === "email").props.onChange({
      target: { value: "  ada@example.test  " },
    });
    await formOf(runner.render()).props.onSubmit({ preventDefault: vi.fn() });
    tree = runner.render();

    expect(auth.requestPasswordReset).toHaveBeenCalledWith(
      "ada@example.test",
      "https://tasks.test/recover"
    );
    expect(noticeText(tree, "status")).toContain("If an account exists for that email");
  });

  it("reports a failed reset request", async () => {
    auth.requestPasswordReset.mockRejectedValue(new Error("network"));
    const runner = createRunner({ recoverySession: false, onBack: vi.fn(), onComplete: vi.fn() });

    await formOf(runner.render()).props.onSubmit({ preventDefault: vi.fn() });

    expect(noticeText(runner.render(), "alert")).toContain("couldn't send a reset link");
  });

  it("returns to sign in from the request step", () => {
    const onBack = vi.fn();
    const runner = createRunner({ recoverySession: false, onBack, onComplete: vi.fn() });

    find(
      runner.render(),
      (node) => node.type === "button" && textContent(node) === "Back to sign in"
    ).props.onClick();

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("rejects mismatched passwords before calling the auth service", async () => {
    const runner = createRunner({ recoverySession: true, onBack: vi.fn(), onComplete: vi.fn() });
    let tree = runner.render();
    const [password, confirmation] = passwordInputs(tree);

    password.props.onChange({ target: { value: "new-password" } });
    confirmation.props.onChange({ target: { value: "other-password" } });
    await formOf(runner.render()).props.onSubmit({ preventDefault: vi.fn() });
    tree = runner.render();

    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(noticeText(tree, "alert")).toBe("Passwords do not match.");
  });

  it("updates the password and hands control back to the app", async () => {
    auth.updatePassword.mockResolvedValue(undefined);
    const onComplete = vi.fn();
    const runner = createRunner({ recoverySession: true, onBack: vi.fn(), onComplete });
    const tree = runner.render();
    const [password, confirmation] = passwordInputs(tree);

    password.props.onChange({ target: { value: "new-password" } });
    confirmation.props.onChange({ target: { value: "new-password" } });
    await formOf(runner.render()).props.onSubmit({ preventDefault: vi.fn() });

    expect(auth.updatePassword).toHaveBeenCalledWith("new-password");
    expect(onComplete).toHaveBeenCalledOnce();
    expect(passwordInputs(runner.render()).every((node) => node.props.value === "")).toBe(true);
  });

  it("reports a failed password update", async () => {
    auth.updatePassword.mockRejectedValue(new Error("expired"));
    const runner = createRunner({ recoverySession: true, onBack: vi.fn(), onComplete: vi.fn() });
    const tree = runner.render();
    const [password, confirmation] = passwordInputs(tree);

    password.props.onChange({ target: { value: "new-password" } });
    confirmation.props.onChange({ target: { value: "new-password" } });
    await formOf(runner.render()).props.onSubmit({ preventDefault: vi.fn() });

    expect(noticeText(runner.render(), "alert")).toBe(
      "Password update failed. Request a new link."
    );
  });
});
