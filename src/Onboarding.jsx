import { useState } from "react";

const purposeChoices = [
  {
    id: "work",
    title: "Work",
    description: "Organize your day-to-day tasks and professional projects.",
  },
  {
    id: "personal",
    title: "Personal",
    description: "Plan routines, goals, and everything outside of work.",
  },
  {
    id: "business",
    title: "Business",
    description: "Coordinate a team, clients, and growing business operations.",
  },
];

export default function Onboarding({ displayName, saving, onComplete, onStartOver }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(String(displayName || ""));
  const [purpose, setPurpose] = useState("work");
  const [error, setError] = useState("");

  const continueFromProfile = (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter the name you want teammates to see.");
      return;
    }
    setError("");
    setStep(2);
  };

  const finish = async () => {
    setError("");
    try {
      await onComplete({ displayName: name.trim(), purpose });
    } catch (completionError) {
      setError(
        completionError?.message ||
          "We couldn't finish setting up your workspace. Please try again."
      );
    }
  };

  const goBack = async () => {
    if (step > 1) {
      setError("");
      setStep(1);
      return;
    }

    setError("");
    try {
      await onStartOver?.();
    } catch (restartError) {
      setError(
        restartError?.message || "We couldn't restart signup. Please try again."
      );
    }
  };

  return (
    <main className="onboarding-page">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <button
          className="onboarding-back-button"
          type="button"
          onClick={goBack}
          disabled={saving}
          aria-label={step === 1 ? "Go back and start signup over" : "Go back to profile step"}
        >
          <span aria-hidden="true">←</span>
          {step === 1 ? "Start over" : "Back"}
        </button>
        <div className="onboarding-brand">
          <span className="auth-badge">TaskFlow</span>
          <span>Step {step} of 2</span>
        </div>

        {step === 1 ? (
          <form onSubmit={continueFromProfile}>
            <p className="onboarding-kicker">Welcome to your workspace</p>
            <h1 id="onboarding-title">Let’s make TaskFlow yours.</h1>
            <p className="onboarding-copy">
              Start with the name your teammates will recognize. You can change
              it later in Settings.
            </p>
            <label className="auth-label onboarding-field">
              Display name
              <input
                autoFocus
                type="text"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-button" type="submit">Continue</button>
          </form>
        ) : (
          <div>
            <p className="onboarding-kicker">Choose your purpose</p>
            <h1 id="onboarding-title">What will you use TaskFlow for?</h1>
            <p className="onboarding-copy">
              This helps us shape your workspace around what matters to you.
              You can still use every TaskFlow feature.
            </p>
            <div className="onboarding-choices" role="radiogroup" aria-label="TaskFlow purpose">
              {purposeChoices.map((choice) => (
                <button
                  key={choice.id}
                  className={`onboarding-choice${purpose === choice.id ? " selected" : ""}`}
                  type="button"
                  role="radio"
                  aria-checked={purpose === choice.id}
                  onClick={() => setPurpose(choice.id)}
                >
                  <span className="onboarding-choice-mark" aria-hidden="true" />
                  <span>
                    <strong>{choice.title}</strong>
                    <small>{choice.description}</small>
                  </span>
                </button>
              ))}
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="onboarding-actions onboarding-actions-single">
              <button className="auth-button" type="button" onClick={finish} disabled={saving}>
                {saving ? "Preparing workspace…" : "Enter TaskFlow"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
