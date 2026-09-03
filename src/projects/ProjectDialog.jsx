import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, Input, Textarea } from "../ui/Field";
import { InlineNotice } from "../ui/InlineNotice";
import { cx } from "../ui/cx";

/** The eight project colors offered by the picker (§3). */
const projectColors = [
  "#5b5bd6",
  "#1f9d64",
  "#d5484a",
  "#d68a0c",
  "#2f7fe0",
  "#8e44ad",
  "#0e9aa7",
  "#6b7280",
];

const colorNames = {
  "#5b5bd6": "Indigo",
  "#1f9d64": "Green",
  "#d5484a": "Red",
  "#d68a0c": "Amber",
  "#2f7fe0": "Blue",
  "#8e44ad": "Purple",
  "#0e9aa7": "Teal",
  "#6b7280": "Gray",
};

const DESCRIPTION_LIMIT = 1000;

const valuesFromProject = (project) => ({
  name: project?.name || "",
  description: project?.description || "",
  color: project?.color || projectColors[0],
});

/** Create and edit surface for a project. `project` switches it to edit mode. */
export function ProjectDialog({
  open = false,
  onClose,
  onSubmit,
  project = null,
  busy = false,
  error = "",
}) {
  const editing = Boolean(project);
  const [values, setValues] = useState(() => valuesFromProject(project));
  const [nameError, setNameError] = useState("");
  const nameInputRef = useRef(null);

  // Re-seeding is tied to the dialog opening, not to every prop identity change.
  const seedRef = useRef(project);
  seedRef.current = project;

  useEffect(() => {
    if (!open) return;
    setValues(valuesFromProject(seedRef.current));
    setNameError("");
  }, [open, project?.id]);

  const patch = (changes) => setValues((current) => ({ ...current, ...changes }));

  const handleSubmit = (event) => {
    event?.preventDefault?.();
    if (busy) return;

    const name = values.name.trim();
    if (!name) {
      setNameError("Enter a project name before saving.");
      return;
    }

    setNameError("");
    onSubmit?.({ name, description: values.description, color: values.color });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="sm"
      title={editing ? "Edit project" : "New project"}
      initialFocusRef={nameInputRef}
      className="project-dialog"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={handleSubmit}>
            {editing ? "Save" : "Create project"}
          </Button>
        </>
      }
    >
      <form className="project-dialog-body" onSubmit={handleSubmit} noValidate>
        <Field label="Name" htmlFor="project-dialog-name" error={nameError}>
          <Input
            id="project-dialog-name"
            ref={nameInputRef}
            value={values.name}
            disabled={busy}
            invalid={Boolean(nameError)}
            placeholder="e.g. Website launch"
            onChange={(event) => {
              patch({ name: event.target.value });
              setNameError("");
            }}
          />
        </Field>

        <Field label="Description" htmlFor="project-dialog-description">
          <Textarea
            id="project-dialog-description"
            rows={3}
            maxLength={DESCRIPTION_LIMIT}
            value={values.description}
            disabled={busy}
            placeholder="What is this project for?"
            onChange={(event) => patch({ description: event.target.value })}
          />
          <span className="project-description-count">
            {`${values.description.length}/${DESCRIPTION_LIMIT}`}
          </span>
        </Field>

        <Field label="Color">
          <div className="project-color-picker" role="radiogroup" aria-label="Project color">
            {projectColors.map((color) => {
              const selected = values.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={colorNames[color] || color}
                  title={colorNames[color] || color}
                  className={cx("project-color-swatch", selected && "is-selected")}
                  style={{ backgroundColor: color }}
                  disabled={busy}
                  onClick={() => patch({ color })}
                />
              );
            })}
          </div>
        </Field>

        {error ? (
          <InlineNotice tone="error" className="project-dialog-error">
            {error}
          </InlineNotice>
        ) : null}
      </form>
    </Dialog>
  );
}

export default ProjectDialog;
