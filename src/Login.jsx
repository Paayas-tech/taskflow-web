import { useState } from "react";
import {
  resendConfirmation,
  signIn,
  signUp,
  verifySignupOtp,
} from "./application/authService";
import {
  friendlyAuthError,
  getSignUpOutcome,
  isEmailConfirmationError,
  isInvalidCredentialsError,
  validateSignUpName,
} from "./domain/authDomain";

const PENDING_SIGNUP_EMAIL_KEY = "taskflow.pendingSignupEmail";
const SIGNUP_OTP_LENGTH = 6;

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

export default function Login({ onSignInSuccess, onRecoverPassword, initialMode = "signin" }) {
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

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-intro" aria-label="TaskFlow introduction">
          <div>
            <div className="auth-logo-mark" aria-hidden="true">✓</div>
            <strong>TaskFlow</strong>
          </div>
          <div>
            <p>Plan clearly. Work calmly.</p>
            <h2>Tasks, projects, and teamwork in one place.</h2>
          </div>
          <small>Stay focused and organized.</small>
        </aside>
        <div className="auth-card">
        <div className="auth-card-topline">
          {awaitingOtp && (
            <button
              type="button"
              className="auth-back-button"
              aria-label="Back to account creation"
              onClick={returnToSignup}
              disabled={isSubmitting || isResending}
            >
              <span aria-hidden="true">←</span>
            </button>
          )}
          <div className="auth-badge">TaskFlow</div>
        </div>
        <h1>{awaitingOtp ? "Verify your email" : isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {awaitingOtp
            ? `Enter the code sent to ${confirmationEmail}.`
            : isLogin
            ? "Continue to your workspace."
            : "Start using TaskFlow."}
        </p>

        {!awaitingOtp && <div className="auth-mode-tabs" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={isLogin ? "active" : ""}
            onClick={() => !isLogin && switchMode()}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={!isLogin ? "active" : ""}
            onClick={() => isLogin && switchMode()}
          >
            Create account
          </button>
        </div>}

        {awaitingOtp ? (
          <form className="auth-form auth-otp-form" onSubmit={handleVerifyOtp} aria-busy={isSubmitting || isResending}>
            <label className="auth-label">
              Verification code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={SIGNUP_OTP_LENGTH}
                pattern="[0-9]{6}"
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, SIGNUP_OTP_LENGTH))}
                disabled={isSubmitting || isResending}
                autoFocus
              />
            </label>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
            <button type="submit" className="auth-button" disabled={isSubmitting || isResending}>
              {isSubmitting ? "Verifying…" : "Verify and continue"}
            </button>
            <button
              type="button"
              className="auth-switch auth-resend"
              onClick={handleResendConfirmation}
              disabled={isSubmitting || isResending}
            >
              {isResending ? "Sending new code…" : "Send a new code"}
            </button>
            <button type="button" className="auth-switch" onClick={returnToSignup} disabled={isSubmitting || isResending}>
              Use a different email
            </button>
          </form>
        ) : <form
          onSubmit={handleSubmit}
          className="auth-form"
          aria-busy={isSubmitting || isResending}
        >
          {!isLogin && (
            <label className="auth-label">
              Name
              <input
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSubmitting || isResending}
                maxLength={80}
                required
              />
            </label>
          )}

          <label className="auth-label">
            Email
            <input
              type="email"
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
              disabled={isSubmitting || isResending}
            />
          </label>

          <label className="auth-label">
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting || isResending}
            />
          </label>

          {isLogin && (
            <button
              type="button"
              className="auth-forgot"
              onClick={onRecoverPassword}
              disabled={isSubmitting || isResending}
            >
              Forgot password?
            </button>
          )}

          {authError && (
            <p className="auth-error" role="alert">
              {authError}
            </p>
          )}

          {authNotice && (
            <p className="auth-notice" role="status">
              {authNotice}
            </p>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting || isResending}
            aria-busy={isSubmitting || isResending}
          >
            <span className="auth-button-content">
              {isSubmitting && (
                <span className="auth-button-spinner" aria-hidden="true" />
              )}
              <span>
                {isSubmitting
                  ? isLogin
                    ? "Signing in..."
                    : "Creating account..."
                  : isLogin
                    ? "Sign In"
                    : "Create Account"}
              </span>
            </span>
          </button>
        </form>}

        {!awaitingOtp && confirmationEmail && isLogin && (
          <button
            type="button"
            className="auth-switch auth-resend"
            onClick={handleResendConfirmation}
            disabled={isSubmitting || isResending}
          >
            {isResending ? "Sending confirmation..." : "Resend confirmation email"}
          </button>
        )}

        </div>
      </div>
    </div>
  );
}
