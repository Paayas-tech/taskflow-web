import { useState } from "react";
import {
  requestPasswordReset,
  updatePassword,
} from "./application/authService";
import { validateRecoveryPassword } from "./domain/recoveryDomain";

export default function Recover({ recoverySession, onBack, onComplete }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const handleRequest = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await requestPasswordReset(
        email.trim(),
        `${window.location.origin}/recover`
      );
      setNotice(
        "If an account exists for that email, a password reset link has been sent."
      );
    } catch {
      setError("We couldn't send a reset link right now. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const validationError = validateRecoveryPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await updatePassword(password);
      setPassword("");
      setConfirmation("");
      onComplete();
    } catch {
      setError("Password update failed. Request a new link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-badge">TaskFlow</div>
        <h1>{recoverySession ? "Set a new password" : "Reset your password"}</h1>
        <p className="auth-subtitle">
          {recoverySession
            ? "Choose a new password."
            : "Enter your email for a reset link."}
        </p>

        <form
          className="auth-form"
          onSubmit={recoverySession ? handleUpdate : handleRequest}
          aria-busy={submitting}
        >
          {recoverySession ? (
            <>
              <label className="auth-label">
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </label>
              <label className="auth-label">
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={submitting}
                  required
                />
              </label>
            </>
          ) : (
            <label className="auth-label">
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                required
              />
            </label>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}

          <button
            type="submit"
            className="auth-button"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting
              ? recoverySession
                ? "Updating password..."
                : "Sending reset link..."
              : recoverySession
                ? "Update password"
                : "Send reset link"}
          </button>
        </form>

        {!recoverySession && (
          <button
            type="button"
            className="auth-switch"
            onClick={onBack}
            disabled={submitting}
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
