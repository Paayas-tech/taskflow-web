import { useState } from "react";
import {
  requestPasswordReset,
  updatePassword,
} from "../api/auth";
import { validateRecoveryPassword } from "../domain/auth";
import { Button, Field, InlineNotice, Input } from "../ui";
import { AuthBrand } from "./AuthBrand";
import { recoveryRedirectUrl } from "../platform/desktop";

export function Recover({ recoverySession, onBack, onComplete }) {
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
        recoveryRedirectUrl()
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
    <main className="auth-page">
      <div className="auth-card">
        <AuthBrand />
        <h1 className="auth-title">
          {recoverySession ? "Set a new password" : "Reset your password"}
        </h1>
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
              <Field label="New password" htmlFor="recover-password">
                <Input
                  id="recover-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </Field>
              <Field label="Confirm new password" htmlFor="recover-confirmation">
                <Input
                  id="recover-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={submitting}
                  required
                />
              </Field>
            </>
          ) : (
            <Field label="Email" htmlFor="recover-email">
              <Input
                id="recover-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                required
              />
            </Field>
          )}

          {error && <InlineNotice tone="error">{error}</InlineNotice>}
          {notice && <InlineNotice tone="info">{notice}</InlineNotice>}

          <Button
            type="submit"
            variant="primary"
            className="auth-submit"
            loading={submitting}
          >
            {submitting
              ? recoverySession
                ? "Updating password…"
                : "Sending reset link…"
              : recoverySession
                ? "Update password"
                : "Send reset link"}
          </Button>
        </form>

        {!recoverySession && (
          <div className="auth-alt-actions">
            <Button variant="ghost" size="sm" onClick={onBack} disabled={submitting}>
              Back to sign in
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
