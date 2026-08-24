import { beforeEach, describe, expect, it, vi } from "vitest";

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

const auth = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn(), resendConfirmation: vi.fn() }));
vi.mock("react", () => ({ useState: runtime.useState }));
vi.mock("./application/authService", () => auth);
import Login from "./Login";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
};
const walk = (node, visit) => {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node || typeof node !== "object") return;
  visit(node);
  childrenOf(node).forEach((child) => walk(child, visit));
};
const find = (root, predicate) => {
  let result;
  walk(root, (node) => { if (!result && predicate(node)) result = node; });
  return result;
};
const text = (node) => typeof node === "string" || typeof node === "number"
  ? String(node) : childrenOf(node).map(text).join("");
const createRunner = () => ({
  slots: [], cursor: 0,
  render() { this.cursor = 0; runtime.activate(this); this.tree = Login({}); return this.tree; },
});
const switchToSignup = (runner) => {
  const tree = runner.render();
  find(tree, (node) => node.type === "button" && text(node).includes("Need an account")).props.onClick();
  return runner.render();
};

describe("Login signup identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", { location: { origin: "https://taskflow.example" } });
  });

  it("shows a required, accessible name field only for signup", () => {
    const runner = createRunner();
    expect(find(runner.render(), (node) => node.type === "input" && node.props.autoComplete === "name")).toBeUndefined();
    const input = find(switchToSignup(runner), (node) => node.type === "input" && node.props.autoComplete === "name");
    expect(input.props).toMatchObject({ required: true, maxLength: 80, type: "text" });
  });

  it("rejects a blank name before calling the auth service", async () => {
    const runner = createRunner();
    const form = find(switchToSignup(runner), (node) => node.type === "form");
    await form.props.onSubmit({ preventDefault: vi.fn() });
    const tree = runner.render();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(find(tree, (node) => node.props?.role === "alert").props.children).toBe("Enter your name.");
  });

  it("passes the trimmed name through the confirmation signup flow", async () => {
    auth.signUp.mockResolvedValue({ user: { id: "user-a" }, session: null });
    const runner = createRunner();
    let tree = switchToSignup(runner);
    const inputs = [];
    walk(tree, (node) => { if (node.type === "input") inputs.push(node); });
    inputs.find((input) => input.props.autoComplete === "name").props.onChange({ target: { value: "  Ada Lovelace  " } });
    inputs.find((input) => input.props.type === "email").props.onChange({ target: { value: "user@example.test" } });
    inputs.find((input) => input.props.type === "password").props.onChange({ target: { value: "password" } });
    tree = runner.render();
    await find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    expect(auth.signUp).toHaveBeenCalledWith("user@example.test", "password", "Ada Lovelace", {
      emailRedirectTo: "https://taskflow.example",
    });
  });
});
