import { useId, useRef, useState } from "react";
import { Button, IconButton } from "../ui/Button";
import { Input } from "../ui/Field";
import { Icon } from "../ui/icons";
import { cx } from "../ui/primitives";

const CREATE_ERROR = "We couldn't create this task. Check your connection and try again.";

/**
 * Inline task creation. Enter creates and keeps the field open for rapid entry,
 * Escape cancels, Shift+Enter (or "Add details") hands the title to the composer.
 */
export function QuickAdd({
  placeholder = "Add a task…",
  onCreate,
  onOpenDetails,
  onCancel,
  autoFocus = true,
  contextLabel,
  variant = "row",
  className,
  ...rest
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const submissionRef = useRef(false);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const inputLabel = contextLabel ? `Task name for ${contextLabel}` : "Task name";

  const focusInput = () => {
    inputRef.current?.focus?.();
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (submissionRef.current) return;

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError("Enter a task title.");
      focusInput();
      return;
    }

    submissionRef.current = true;
    setBusy(true);
    setError("");
    try {
      // Store actions report a failure by resolving to `null` rather than by
      // throwing, so a null (or false) result is a failed create: keep the
      // typed title and show the error at the field. A handler that returns
      // nothing at all succeeded.
      const created = await onCreate?.(normalizedTitle);
      if (created === null || created === false) {
        setError(CREATE_ERROR);
        return;
      }
      setTitle("");
      focusInput();
    } catch (createError) {
      setError(createError?.message || CREATE_ERROR);
    } finally {
      submissionRef.current = false;
      setBusy(false);
    }
  };

  const handleKeyDown = (event) => {
    if (busy) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel?.();
      return;
    }
    if (event.key === "Enter" && event.shiftKey && onOpenDetails) {
      event.preventDefault();
      onOpenDetails(title.trim());
    }
  };

  return (
    <form
      className={cx("quick-add", `quick-add-${variant}`, className)}
      aria-label={contextLabel ? `Add task to ${contextLabel}` : "Add a task"}
      aria-busy={busy || undefined}
      onSubmit={handleSubmit}
      {...rest}
    >
      <span className="quick-add-check" aria-hidden="true" />

      <div className="quick-add-field">
        <Input
          ref={inputRef}
          type="text"
          value={title}
          maxLength={200}
          placeholder={placeholder}
          aria-label={inputLabel}
          aria-describedby={error ? errorId : undefined}
          invalid={Boolean(error)}
          autoFocus={autoFocus}
          disabled={busy}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
        />
        {error ? (
          <p className="quick-add-error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="quick-add-actions">
        <Button type="submit" variant="primary" size="sm" loading={busy}>
          Add
        </Button>
        {onOpenDetails ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onOpenDetails(title.trim())}
          >
            Add details
          </Button>
        ) : null}
        {onCancel ? (
          <IconButton label="Cancel adding task" size="sm" disabled={busy} onClick={onCancel}>
            <Icon name="x" />
          </IconButton>
        ) : null}
      </div>
    </form>
  );
}

/** The muted "Add task" row that reveals a `QuickAdd`. */
export function QuickAddTrigger({ label = "Add task", onClick, className, ...rest }) {
  return (
    <button type="button" className={cx("quick-add-trigger", className)} onClick={onClick} {...rest}>
      <Icon name="plus" size={14} />
      <span>{label}</span>
    </button>
  );
}
