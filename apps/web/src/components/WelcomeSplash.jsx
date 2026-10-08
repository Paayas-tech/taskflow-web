import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui";

export const SPLASH_SESSION_KEY = "taskflow_splash_shown";

const messages = [
  "Orchestrating engineering workflows…",
  "Streamlining sprints & delivery…",
  "Turning plans into progress…",
];

/** A short, session-scoped welcome shown on the first app launch in this session. */
export function WelcomeSplash({ duration = 1600, fadeDuration = 400, onComplete }) {
  const [leaving, setLeaving] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const completed = useRef(false);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 760);
    const fadeTimer = window.setTimeout(() => setLeaving(true), duration);
    const completeTimer = window.setTimeout(() => {
      if (completed.current) return;
      completed.current = true;
      onComplete?.();
    }, duration + fadeDuration);

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, [duration, fadeDuration, onComplete]);

  return (
    <section
      className={`welcome-splash${leaving ? " is-leaving" : ""}`}
      aria-label="Welcome to Taskflow"
      aria-busy={!leaving}
    >
      <div className="welcome-splash-glow" aria-hidden="true" />
      <div className="welcome-splash-content">
        <span className="welcome-splash-mark" aria-hidden="true">
          <Icon name="check" size={32} />
        </span>
        <h1>Taskflow</h1>
        <p key={messageIndex} className="welcome-splash-message">
          {messages[messageIndex]}
        </p>
        <div className="welcome-splash-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}
