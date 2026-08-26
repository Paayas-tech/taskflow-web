import { useEffect, useRef, useState } from "react";

export default function ProjectTaskQuickCreate({
  contextLabel = "project",
  onCreate,
  onCancel,
  onAddDetails,
  variant = "list",
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const submissionRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submissionRef.current) return;

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError("Enter a task title.");
      inputRef.current?.focus();
      return;
    }

    submissionRef.current = true;
    setBusy(true);
    setError("");
    try {
      await onCreate(normalizedTitle);
      setTitle("");
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      setError("We couldn't create this task. Check your connection and try again.");
    } finally {
      submissionRef.current = false;
      setBusy(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Escape" || busy) return;
    event.preventDefault();
    onCancel?.();
  };

  return (
    <form
      className={`project-task-quick-create project-task-quick-create-${variant}`}
      aria-label={`Add task to ${contextLabel}`}
      aria-busy={busy}
      onSubmit={handleSubmit}
    >
      <span className="project-task-quick-create-check" aria-hidden="true" />
      <div className="project-task-quick-create-field">
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={title}
          maxLength={200}
          placeholder="Write a task name"
          aria-label={`Task name for ${contextLabel}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "project-task-quick-create-error" : undefined}
          disabled={busy}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
        />
        {error && (
          <span id="project-task-quick-create-error" className="project-task-quick-create-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <div className="project-task-quick-create-actions">
        {onAddDetails && (
          <button
            type="button"
            className="project-task-quick-create-details"
            disabled={busy}
            onClick={() => onAddDetails(title.trim())}
          >
            Add details
          </button>
        )}
        <button type="submit" className="project-task-quick-create-submit" disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          className="project-task-quick-create-cancel"
          aria-label="Cancel adding task"
          disabled={busy}
          onClick={onCancel}
        >
          ×
        </button>
      </div>
    </form>
  );
}
