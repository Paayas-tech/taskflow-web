import { useState } from "react";
import { Button, Field, Icon, InlineNotice, Input } from "../ui";
import { AuthBrand } from "./AuthBrand";

const purposeChoices = [
  {
    id: "work",
    title: "Work",
    icon: "folder",
    description: "Organize your day-to-day tasks and professional projects.",
  },
  {
    id: "personal",
    title: "Personal",
    icon: "user",
    description: "Plan routines, goals, and everything outside of work.",
  },
  {
    id: "business",
    title: "Business",
    icon: "users",
    description: "Coordinate a team, clients, and growing business operations.",
  },
];

export function Onboarding({ displayName, saving, onComplete, onStartOver }) {
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
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="onboarding-title">
        <div className="auth-card-top">
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="arrow-left" />}
            onClick={goBack}
            disabled={saving}
            aria-label={
              step === 1 ? "Go back and start signup over" : "Go back to profile step"
            }
          >
            {step === 1 ? "Start over" : "Back"}
          </Button>
          <span className="auth-step">Step {step} of 2</span>
        </div>
        <AuthBrand />
        <h1 className="auth-title" id="onboarding-title">
          {step === 1
            ? "Let’s make TaskFlow yours."
            : "What will you use TaskFlow for?"}
        </h1>
        <p className="auth-subtitle">
          {step === 1
            ? "Use the name your teammates know."
            : "Choose what best fits your work."}
        </p>

        {step === 1 ? (
          <form className="auth-form" onSubmit={continueFromProfile}>
            <Field label="Display name" htmlFor="onboarding-display-name">
              <Input
                id="onboarding-display-name"
                autoFocus
                type="text"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </Field>

            {error && <InlineNotice tone="error">{error}</InlineNotice>}

            <Button type="submit" variant="primary" className="auth-submit">
              Continue
            </Button>
          </form>
        ) : (
          <div className="auth-form">
            <div className="choice-list" role="radiogroup" aria-label="TaskFlow purpose">
              {purposeChoices.map((choice) => {
                const checked = purpose === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className={`choice-card${checked ? " is-selected" : ""}`}
                    onClick={() => setPurpose(choice.id)}
                  >
                    <span className="choice-card-icon" aria-hidden="true">
                      <Icon name={choice.icon} />
                    </span>
                    <span className="choice-card-body">
                      <span className="choice-card-label">{choice.title}</span>
                      <span className="choice-card-description">{choice.description}</span>
                    </span>
                    {checked ? (
                      <span className="choice-card-check" aria-hidden="true">
                        <Icon name="check" size={14} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {error && <InlineNotice tone="error">{error}</InlineNotice>}

            <Button
              type="button"
              variant="primary"
              className="auth-submit"
              onClick={finish}
              loading={saving}
            >
              {saving ? "Preparing workspace…" : "Enter TaskFlow"}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
