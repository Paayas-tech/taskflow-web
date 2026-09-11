import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "./Login";

vi.mock("../api/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
  verifySignupOtp: vi.fn(),
}));

const { resendConfirmation, signIn, signUp, verifySignupOtp } = await import(
  "../api/auth"
);

/** The two mode buttons and the submit button share their labels. */
const modeButton = (name) =>
  within(screen.getByRole("group", { name: "Account access" })).getByRole(
    "button",
    { name }
  );

const submitButton = (name) =>
  screen
    .getAllByRole("button", { name })
    .find((button) => button.getAttribute("type") === "submit");

beforeEach(() => {
  window.sessionStorage.clear();
  vi.resetAllMocks();
});

describe("Login", () => {
  it("signs in and hands control back to the app", async () => {
    const user = userEvent.setup();
    vi.mocked(signIn).mockResolvedValue({ user: { id: "user-1" } });
    const onSignInSuccess = vi.fn();
    render(<Login onSignInSuccess={onSignInSuccess} />);

    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await user.click(submitButton("Sign in"));

    expect(signIn).toHaveBeenCalledWith("sam@example.com", "hunter2hunter2");
    expect(onSignInSuccess).toHaveBeenCalled();
  });

  it("requires a name before creating an account", async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(modeButton("Create account"));
    await user.type(screen.getByLabelText("Name"), "   ");
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await user.click(submitButton("Create account"));

    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("verifies the emailed code on the device that started the signup", async () => {
    const user = userEvent.setup();
    vi.mocked(signUp).mockResolvedValue({
      user: { id: "user-1" },
      session: null,
    });
    vi.mocked(verifySignupOtp).mockResolvedValue({ user: { id: "user-1" } });
    const onSignInSuccess = vi.fn();
    render(<Login onSignInSuccess={onSignInSuccess} />);

    await user.click(modeButton("Create account"));
    await user.type(screen.getByLabelText("Name"), "  Sam Rivera  ");
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await user.click(submitButton("Create account"));

    expect(signUp).toHaveBeenCalledWith(
      "sam@example.com",
      "hunter2hunter2",
      "Sam Rivera"
    );
    expect(await screen.findByText("Verify your email")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("taskflow.pendingSignupEmail")).toBe(
      "sam@example.com"
    );

    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect(verifySignupOtp).toHaveBeenCalledWith("sam@example.com", "123456");
    expect(onSignInSuccess).toHaveBeenCalled();
    expect(window.sessionStorage.getItem("taskflow.pendingSignupEmail")).toBeNull();
  });

  it("resumes an unconfirmed account from the sign-in form without claiming a new code", async () => {
    const user = userEvent.setup();
    const error = new Error("Email not confirmed");
    error.code = "email_not_confirmed";
    vi.mocked(signIn).mockRejectedValue(error);
    vi.mocked(resendConfirmation).mockResolvedValue({});
    render(<Login />);

    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await user.click(submitButton("Sign in"));

    expect(
      await screen.findByText(
        "Your email still needs verification. We can send a new code if needed."
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send a new code" }));

    expect(resendConfirmation).toHaveBeenCalledWith("sam@example.com");
    expect(
      await screen.findByText(
        "Verification request accepted. If this account still needs confirmation, check your inbox for a new code."
      )
    ).toBeInTheDocument();
  });
});
