import { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";

const friendlyAuthError = (error, isLogin) => {
  switch (error?.code) {
    case "auth/invalid-email":
      return "Enter a valid email address and try again.";
    case "auth/missing-password":
      return "Enter your password to continue.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "The email or password you entered is incorrect.";
    case "auth/email-already-in-use":
      return "An account already exists for this email address.";
    case "auth/weak-password":
      return "Choose a stronger password with at least six characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "We couldn't connect. Check your internet connection and try again.";
    default:
      return isLogin
        ? "We couldn't sign you in. Please try again."
        : "We couldn't create your account. Please try again.";
  }
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setAuthError("");

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Account created");
      }
    } catch (error) {
      setAuthError(friendlyAuthError(error, isLogin));
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    if (isSubmitting) return;

    setIsLogin((previous) => !previous);
    setAuthError("");
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
          aria-busy={isSubmitting}
        >
          <label className="auth-label">
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="auth-label">
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          {authError && (
            <p className="auth-error" role="alert">
              {authError}
            </p>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
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

        <button
          type="button"
          className="auth-switch"
          onClick={switchMode}
          disabled={isSubmitting}
        >
          {isLogin ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
