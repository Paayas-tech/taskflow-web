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

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
  verifySignupOtp: vi.fn(),
}));
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
  find(
    tree,
    (node) =>
      node.type === "button" &&
      node.props?.role === "tab" &&
      text(node) === "Create account"
  ).props.onClick();
  return runner.render();
};

describe("Login signup identity", () => {
  let sessionValues;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionValues = new Map();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key) => sessionValues.get(key) ?? null,
        setItem: (key, value) => sessionValues.set(key, value),
        removeItem: (key) => sessionValues.delete(key),
      },
    });
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
    expect(auth.signUp).toHaveBeenCalledWith("user@example.test", "password", "Ada Lovelace");
  });

  it("verifies the signup OTP on the device that started registration", async () => {
    auth.signUp.mockResolvedValue({ user: { id: "user-a" }, session: null });
    auth.verifySignupOtp.mockResolvedValue({
      user: { id: "user-a" },
      session: { access_token: "session" },
    });
    const onSignInSuccess = vi.fn();
    const runner = {
      slots: [],
      cursor: 0,
      render() {
        this.cursor = 0;
        runtime.activate(this);
        this.tree = Login({ onSignInSuccess });
        return this.tree;
      },
    };

    let tree = switchToSignup(runner);
    const inputs = [];
    walk(tree, (node) => { if (node.type === "input") inputs.push(node); });
    inputs.find((input) => input.props.autoComplete === "name").props.onChange({ target: { value: "Ada" } });
    inputs.find((input) => input.props.type === "email").props.onChange({ target: { value: "user@example.test" } });
    inputs.find((input) => input.props.type === "password").props.onChange({ target: { value: "password" } });
    await find(runner.render(), (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });

    tree = runner.render();
    const otpInput = find(tree, (node) => node.type === "input" && node.props.autoComplete === "one-time-code");
    otpInput.props.onChange({ target: { value: "123456" } });
    tree = runner.render();
    await find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });

    expect(auth.verifySignupOtp).toHaveBeenCalledWith("user@example.test", "123456");
    expect(onSignInSuccess).toHaveBeenCalledOnce();
  });

  it("does not report a sent OTP for an existing account", async () => {
    auth.signUp.mockRejectedValue(
      Object.assign(new Error("User already registered"), {
        code: "user_already_exists",
      })
    );
    const runner = createRunner();
    let tree = switchToSignup(runner);
    const inputs = [];
    walk(tree, (node) => { if (node.type === "input") inputs.push(node); });
    inputs.find((input) => input.props.autoComplete === "name").props.onChange({ target: { value: "Ada" } });
    inputs.find((input) => input.props.type === "email").props.onChange({ target: { value: "pending@example.test" } });
    inputs.find((input) => input.props.type === "password").props.onChange({ target: { value: "password" } });

    await find(runner.render(), (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    tree = runner.render();

    expect(auth.resendConfirmation).not.toHaveBeenCalled();
    expect(find(tree, (node) => node.type === "input" && node.props.autoComplete === "one-time-code")).toBeUndefined();
    expect(find(tree, (node) => node.props?.role === "alert").props.children).toContain("already exists");
  });

  it("lets an unconfirmed user resume verification through sign in", async () => {
    auth.signIn.mockRejectedValue(
      Object.assign(new Error("Email not confirmed"), {
        code: "email_not_confirmed",
      })
    );
    const runner = createRunner();
    let tree = runner.render();
    const inputs = [];
    walk(tree, (node) => { if (node.type === "input") inputs.push(node); });
    inputs.find((input) => input.props.type === "email").props.onChange({ target: { value: "pending@example.test" } });
    inputs.find((input) => input.props.type === "password").props.onChange({ target: { value: "password" } });

    await find(runner.render(), (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    tree = runner.render();

    expect(text(tree)).toContain("still needs verification");
    expect(find(tree, (node) => node.props?.autoComplete === "one-time-code")).toBeDefined();
    expect(auth.resendConfirmation).not.toHaveBeenCalled();
  });

  it("does not claim an OTP was sent when signup fails", async () => {
    auth.signUp.mockRejectedValue(
      Object.assign(new Error("Email rate limit exceeded"), {
        code: "over_email_send_rate_limit",
      })
    );
    const runner = createRunner();
    let tree = switchToSignup(runner);
    const inputs = [];
    walk(tree, (node) => { if (node.type === "input") inputs.push(node); });
    inputs.find((input) => input.props.autoComplete === "name").props.onChange({ target: { value: "Ada" } });
    inputs.find((input) => input.props.type === "email").props.onChange({ target: { value: "user@example.test" } });
    inputs.find((input) => input.props.type === "password").props.onChange({ target: { value: "password" } });

    await find(runner.render(), (node) => node.type === "form").props.onSubmit({ preventDefault: vi.fn() });
    tree = runner.render();

    expect(find(tree, (node) => node.props?.role === "status")).toBeUndefined();
    expect(find(tree, (node) => node.props?.role === "alert").props.children).toContain("Too many attempts");
    expect(find(tree, (node) => node.props?.autoComplete === "one-time-code")).toBeUndefined();
  });

  it("restores an unfinished OTP screen after a refresh", () => {
    sessionValues.set("taskflow.pendingSignupEmail", "pending@example.test");

    const tree = createRunner().render();

    expect(text(tree)).toContain("pending@example.test");
    expect(find(tree, (node) => node.props?.autoComplete === "one-time-code")).toBeDefined();
  });

  it("returns from OTP verification to a clean account-creation form", () => {
    sessionValues.set("taskflow.pendingSignupEmail", "pending@example.test");
    const runner = createRunner();
    let tree = runner.render();

    find(
      tree,
      (node) => node.type === "button" && node.props?.["aria-label"] === "Back to account creation"
    ).props.onClick();
    tree = runner.render();

    expect(sessionValues.has("taskflow.pendingSignupEmail")).toBe(false);
    expect(find(tree, (node) => node.props?.autoComplete === "one-time-code")).toBeUndefined();
    expect(find(tree, (node) => node.props?.autoComplete === "name")).toBeDefined();
  });

  it("shows resend rate limits without claiming a new code was sent", async () => {
    sessionValues.set("taskflow.pendingSignupEmail", "pending@example.test");
    auth.resendConfirmation.mockRejectedValue(
      Object.assign(new Error("Email rate limit exceeded"), {
        code: "over_email_send_rate_limit",
      })
    );
    const runner = createRunner();
    let tree = runner.render();
    await find(tree, (node) => node.type === "button" && text(node) === "Send a new code").props.onClick();
    tree = runner.render();

    expect(find(tree, (node) => node.props?.role === "status")).toBeUndefined();
    expect(find(tree, (node) => node.props?.role === "alert").props.children).toContain("Too many attempts");
  });
});
