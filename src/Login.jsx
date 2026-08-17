import { useState } from "react";
import {
  resendConfirmation,
  signIn,
  signUp,
} from "./application/authService";
import {
  friendlyAuthError,
  getSignUpOutcome,
  isEmailConfirmationError,
  isInvalidCredentialsError,
} from "./domain/authDomain";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setAuthError("");
    setAuthNotice("");

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password, "", {
          emailRedirectTo: window.location.origin,
        });
        const signUpOutcome = getSignUpOutcome(result);

        if (signUpOutcome === "confirmation_required") {
          const normalizedEmail = email.trim();
          setConfirmationEmail(normalizedEmail);
          setPassword("");
          setIsLogin(true);
          setAuthNotice(
            "Check your inbox and confirm your email address before signing in."
          );
        }
      }
    } catch (error) {
      if (
        isLogin &&
        (isEmailConfirmationError(error) || isInvalidCredentialsError(error))
      ) {
        setConfirmationEmail(email.trim());
      }
      setAuthError(friendlyAuthError(error, isLogin));
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
      await resendConfirmation(confirmationEmail, {
        emailRedirectTo: window.location.origin,
      });
      setAuthNotice("A new confirmation email has been sent. Check your inbox.");
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
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-badge">TaskFlow</div>
        <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {isLogin
            ? "Sign in to continue to your workspace."
            : "Create your TaskFlow account to get started."}
        </p>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
          aria-busy={isSubmitting || isResending}
        >
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
        </form>

        {confirmationEmail && isLogin && (
          <button
            type="button"
            className="auth-switch auth-resend"
            onClick={handleResendConfirmation}
            disabled={isSubmitting || isResending}
          >
            {isResending ? "Sending confirmation..." : "Resend confirmation email"}
          </button>
        )}

        <button
          type="button"
          className="auth-switch"
          onClick={switchMode}
          disabled={isSubmitting || isResending}
        >
          {isLogin ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
