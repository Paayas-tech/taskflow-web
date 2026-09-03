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
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
  verifySignupOtp: vi.fn(),
}));
vi.mock("react", () => ({
  useState: runtime.useState,
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
}));
vi.mock("../application/authService", () => auth);
import Login from "./Login";

const createRunner = (props = {}) => ({
  slots: [],
  cursor: 0,
  render() {
    this.cursor = 0;
    runtime.activate(this);
    return render(Login(props));
  },
});

const inputs = (tree) => findAll(tree, (node) => node.type === "input");
const inputBy = (tree, predicate) => inputs(tree).find((node) => predicate(node.props));
const formOf = (tree) => find(tree, (node) => node.type === "form");
const buttonByText = (tree, label) =>
  find(tree, (node) => node.type === "button" && textContent(node) === label);
const alertText = (tree) =>
  textContent(find(tree, (node) => node.props?.role === "alert"));

const switchToSignup = (runner) => {
  const tree = runner.render();
  find(
    tree,
    (node) =>
      node.type === "button" &&
      String(node.props.className).includes("segmented-option") &&
      textContent(node) === "Create account"
  ).props.onClick();
  return runner.render();
};

const fillSignupForm = (runner, { name = "Ada", email = "user@example.test" } = {}) => {
  const tree = runner.render();
  inputBy(tree, (p) => p.autoComplete === "name").props.onChange({ target: { value: name } });
  inputBy(tree, (p) => p.type === "email").props.onChange({ target: { value: email } });
  inputBy(tree, (p) => p.type === "password").props.onChange({ target: { value: "password" } });
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
    expect(inputBy(runner.render(), (p) => p.autoComplete === "name")).toBeUndefined();
    const signupTree = switchToSignup(runner);
    const input = inputBy(signupTree, (p) => p.autoComplete === "name");
    expect(input.props).toMatchObject({ required: true, maxLength: 80, type: "text" });
    expect(
      find(
        signupTree,
        (node) => node.type === "label" && node.props.htmlFor === input.props.id
      )
    ).toBeDefined();
  });

  it("rejects a blank name before calling the auth service", async () => {
    const runner = createRunner();
    await formOf(switchToSignup(runner)).props.onSubmit({ preventDefault: vi.fn() });
    const tree = runner.render();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(alertText(tree)).toBe("Enter your name.");
  });

  it("passes the trimmed name through the confirmation signup flow", async () => {
    auth.signUp.mockResolvedValue({ user: { id: "user-a" }, session: null });
    const runner = createRunner();
    switchToSignup(runner);
    const tree = fillSignupForm(runner, { name: "  Ada Lovelace  " });
    await formOf(tree).props.onSubmit({ preventDefault: vi.fn() });
    expect(auth.signUp).toHaveBeenCalledWith("user@example.test", "password", "Ada Lovelace");
  });

  it("verifies the signup OTP on the device that started registration", async () => {
    auth.signUp.mockResolvedValue({ user: { id: "user-a" }, session: null });
    auth.verifySignupOtp.mockResolvedValue({
      user: { id: "user-a" },
      session: { access_token: "session" },
    });
    const onSignInSuccess = vi.fn();
    const runner = createRunner({ onSignInSuccess });

    switchToSignup(runner);
    await formOf(fillSignupForm(runner)).props.onSubmit({ preventDefault: vi.fn() });

    let tree = runner.render();
    inputBy(tree, (p) => p.autoComplete === "one-time-code").props.onChange({
      target: { value: "123456" },
    });
    tree = runner.render();
    await formOf(tree).props.onSubmit({ preventDefault: vi.fn() });

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
    switchToSignup(runner);
    await formOf(fillSignupForm(runner, { email: "pending@example.test" })).props.onSubmit({
      preventDefault: vi.fn(),
    });
    const tree = runner.render();

    expect(auth.resendConfirmation).not.toHaveBeenCalled();
    expect(inputBy(tree, (p) => p.autoComplete === "one-time-code")).toBeUndefined();
    expect(alertText(tree)).toContain("already exists");
  });

  it("lets an unconfirmed user resume verification through sign in", async () => {
    auth.signIn.mockRejectedValue(
      Object.assign(new Error("Email not confirmed"), {
        code: "email_not_confirmed",
      })
    );
    const runner = createRunner();
    let tree = runner.render();
    inputBy(tree, (p) => p.type === "email").props.onChange({
      target: { value: "pending@example.test" },
    });
    inputBy(tree, (p) => p.type === "password").props.onChange({ target: { value: "password" } });

    await formOf(runner.render()).props.onSubmit({ preventDefault: vi.fn() });
    tree = runner.render();

    expect(textContent(tree)).toContain("still needs verification");
    expect(inputBy(tree, (p) => p.autoComplete === "one-time-code")).toBeDefined();
    expect(auth.resendConfirmation).not.toHaveBeenCalled();
  });

  it("does not claim an OTP was sent when signup fails", async () => {
    auth.signUp.mockRejectedValue(
      Object.assign(new Error("Email rate limit exceeded"), {
        code: "over_email_send_rate_limit",
      })
    );
    const runner = createRunner();
    switchToSignup(runner);
    await formOf(fillSignupForm(runner)).props.onSubmit({ preventDefault: vi.fn() });
    const tree = runner.render();

    expect(find(tree, (node) => node.props?.role === "status")).toBeUndefined();
    expect(alertText(tree)).toContain("Too many attempts");
    expect(inputBy(tree, (p) => p.autoComplete === "one-time-code")).toBeUndefined();
  });

  it("restores an unfinished OTP screen after a refresh", () => {
    sessionValues.set("taskflow.pendingSignupEmail", "pending@example.test");

    const tree = createRunner().render();

    expect(textContent(tree)).toContain("pending@example.test");
    expect(inputBy(tree, (p) => p.autoComplete === "one-time-code")).toBeDefined();
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
    expect(inputBy(tree, (p) => p.autoComplete === "one-time-code")).toBeUndefined();
    expect(inputBy(tree, (p) => p.autoComplete === "name")).toBeDefined();
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
    await buttonByText(tree, "Send a new code").props.onClick();
    tree = runner.render();

    expect(find(tree, (node) => node.props?.role === "status")).toBeUndefined();
    expect(alertText(tree)).toContain("Too many attempts");
  });

  it("offers password recovery from the sign-in form only", () => {
    const onRecoverPassword = vi.fn();
    const runner = createRunner({ onRecoverPassword });

    buttonByText(runner.render(), "Forgot password?").props.onClick();
    expect(onRecoverPassword).toHaveBeenCalledOnce();

    expect(buttonByText(switchToSignup(runner), "Forgot password?")).toBeUndefined();
  });
});
