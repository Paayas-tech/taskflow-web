import { useState } from "react";
import {
  resendConfirmation,
  signIn,
  signUp,
  verifySignupOtp,
} from "../api/auth";
import {
  friendlyAuthError,
  getSignUpOutcome,
  isEmailConfirmationError,
  isInvalidCredentialsError,
  validateSignUpName,
} from "../domain/auth";
import { Button, Field, IconButton, Icon, Input, InlineNotice, SegmentedControl } from "../ui";
import { AuthBrand } from "./AuthBrand";

const PENDING_SIGNUP_EMAIL_KEY = "taskflow.pendingSignupEmail";
const SIGNUP_OTP_LENGTH = 6;

const modeOptions = [
  { id: "signin", label: "Sign in" },
  { id: "signup", label: "Create account" },
];

const readPendingSignupEmail = () => {
  try {
    return window.sessionStorage?.getItem(PENDING_SIGNUP_EMAIL_KEY) || "";
  } catch {
    return "";
  }
};

const rememberPendingSignupEmail = (email) => {
  try {
    window.sessionStorage?.setItem(PENDING_SIGNUP_EMAIL_KEY, email);
  } catch {
    // Verification still works when storage is unavailable.
  }
};

const forgetPendingSignupEmail = () => {
  try {
    window.sessionStorage?.removeItem(PENDING_SIGNUP_EMAIL_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
};

export function Login({ onSignInSuccess, onRecoverPassword, initialMode = "signin" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLogin, setIsLogin] = useState(initialMode !== "signup");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState(readPendingSignupEmail);
  const [awaitingOtp, setAwaitingOtp] = useState(
    () => Boolean(readPendingSignupEmail())
  );
  const [otp, setOtp] = useState("");

  const busy = isSubmitting || isResending;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setAuthError("");
    setAuthNotice("");

    if (!isLogin) {
      const nameError = validateSignUpName(name);
      if (nameError) {
        setAuthError(nameError);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (isLogin) {
        await signIn(email, password);
        onSignInSuccess?.();
      } else {
        const result = await signUp(email, password, name.trim());
        const signUpOutcome = getSignUpOutcome(result);

        if (signUpOutcome === "confirmation_required") {
          const normalizedEmail = email.trim();
          rememberPendingSignupEmail(normalizedEmail);
          setConfirmationEmail(normalizedEmail);
          setPassword("");
          setOtp("");
          setAwaitingOtp(true);
          setAuthNotice(
            "We sent a verification code to your email. Enter it here to continue on this device."
          );
        } else {
          onSignInSuccess?.();
        }
      }
    } catch (error) {
      const normalizedEmail = email.trim();

      if (isLogin && isEmailConfirmationError(error)) {
        rememberPendingSignupEmail(normalizedEmail);
        setConfirmationEmail(normalizedEmail);
        setPassword("");
        setOtp("");
        setAwaitingOtp(true);
        setAuthNotice(
          "Your email still needs verification. We can send a new code if needed."
        );
        return;
      }

      if (isLogin && isInvalidCredentialsError(error)) {
        setConfirmationEmail("");
      }
      setAuthError(friendlyAuthError(error, isLogin));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    if (isSubmitting || !confirmationEmail) return;

    const normalizedOtp = otp.replace(/\D/g, "");
    if (normalizedOtp.length !== SIGNUP_OTP_LENGTH) {
      setAuthError("Enter the six-digit code from your email.");
      return;
    }

    setIsSubmitting(true);
    setAuthError("");
    setAuthNotice("");
    try {
      await verifySignupOtp(confirmationEmail, normalizedOtp);
      forgetPendingSignupEmail();
      onSignInSuccess?.();
    } catch (error) {
      if (["otp_expired", "token_expired"].includes(error?.code)) {
        setAuthError(
          "That code has expired or was already used. Request a new code and try again."
        );
      } else if (
        ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
          error?.code
        )
      ) {
        setAuthError("Too many attempts. Please wait a moment and try again.");
      } else {
        setAuthError("That verification code is incorrect. Check the email and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!confirmationEmail || isSubmitting || isResending) return;

    setIsResending(true);
    setAuthError("");
    setAuthNotice("");

    try {
      await resendConfirmation(confirmationEmail);
      setAuthNotice(
        "Verification request accepted. If this account still needs confirmation, check your inbox for a new code."
      );
    } catch (error) {
      setAuthError(friendlyAuthError(error, false));
    } finally {
      setIsResending(false);
    }
  };

  const switchMode = () => {
    if (isSubmitting || isResending) return;

    setIsLogin((previous) => !previous);
    setAuthError("");
    setAuthNotice("");
    setAwaitingOtp(false);
    setOtp("");
  };

  const returnToSignup = () => {
    if (isSubmitting || isResending) return;

    forgetPendingSignupEmail();
    setAwaitingOtp(false);
    setIsLogin(false);
    setEmail("");
    setPassword("");
    setConfirmationEmail("");
    setOtp("");
    setAuthError("");
    setAuthNotice("");
  };

  const handleModeChange = (mode) => {
    if (mode === (isLogin ? "signin" : "signup")) return;
    switchMode();
  };

  const title = awaitingOtp
    ? "Verify your email"
    : isLogin
      ? "Welcome back"
      : "Create your account";
  const subtitle = awaitingOtp
    ? `Enter the code sent to ${confirmationEmail}.`
    : isLogin
      ? "Continue to your workspace."
      : "Start using TaskFlow.";

  return (
    <main className="auth-page">
      <div className="auth-card">
        {awaitingOtp ? (
          <div className="auth-card-top">
            <IconButton
              label="Back to account creation"
              size="sm"
              onClick={returnToSignup}
              disabled={busy}
            >
              <Icon name="arrow-left" />
            </IconButton>
          </div>
        ) : null}
        <AuthBrand />
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>

        {!awaitingOtp && (
          <SegmentedControl
            className="auth-modes"
            ariaLabel="Account access"
            options={modeOptions}
            value={isLogin ? "signin" : "signup"}
            onChange={handleModeChange}
          />
        )}

        {awaitingOtp ? (
          <form className="auth-form" onSubmit={handleVerifyOtp} aria-busy={busy}>
            <Field label="Verification code" htmlFor="login-otp">
              <Input
                id="login-otp"
                className="auth-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={SIGNUP_OTP_LENGTH}
                pattern="[0-9]{6}"
                placeholder="000000"
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, SIGNUP_OTP_LENGTH))
                }
                disabled={busy}
                autoFocus
              />
            </Field>

            {authError && <InlineNotice tone="error">{authError}</InlineNotice>}
            {authNotice && <InlineNotice tone="info">{authNotice}</InlineNotice>}

            <Button
              type="submit"
              variant="primary"
              className="auth-submit"
              loading={isSubmitting}
              disabled={isResending}
            >
              {isSubmitting ? "Verifying…" : "Verify and continue"}
            </Button>

            <div className="auth-alt-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResendConfirmation}
                loading={isResending}
                disabled={isSubmitting}
              >
                {isResending ? "Sending new code…" : "Send a new code"}
              </Button>
              <Button variant="ghost" size="sm" onClick={returnToSignup} disabled={busy}>
                Use a different email
              </Button>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy}>
            {!isLogin && (
              <Field label="Name" htmlFor="login-name">
                <Input
                  id="login-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy}
                  maxLength={80}
                  required
                />
              </Field>
            )}

            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  const nextEmail = e.target.value;
                  setEmail(nextEmail);
                  if (
                    confirmationEmail &&
                    nextEmail.trim().toLowerCase() !==
                      confirmationEmail.toLowerCase()
                  ) {
                    setConfirmationEmail("");
                    setAuthNotice("");
                  }
                }}
                disabled={busy}
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </Field>

            {isLogin && (
              <div className="auth-forgot">
                <Button variant="ghost" size="sm" onClick={onRecoverPassword} disabled={busy}>
                  Forgot password?
                </Button>
              </div>
            )}

            {authError && <InlineNotice tone="error">{authError}</InlineNotice>}
            {authNotice && <InlineNotice tone="info">{authNotice}</InlineNotice>}

            <Button
              type="submit"
              variant="primary"
              className="auth-submit"
              loading={isSubmitting}
              disabled={isResending}
            >
              {isSubmitting
                ? isLogin
                  ? "Signing in…"
                  : "Creating account…"
                : isLogin
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </form>
        )}

        {!awaitingOtp && confirmationEmail && isLogin && (
          <div className="auth-alt-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendConfirmation}
              loading={isResending}
              disabled={isSubmitting}
            >
              {isResending ? "Sending confirmation…" : "Resend confirmation email"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
