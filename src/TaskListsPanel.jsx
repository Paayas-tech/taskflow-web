import { useState } from "react";

const listColors = ["#a45139", "#66806a", "#a9656a", "#b17a3e", "#6f7f86"];

export default function TaskListsPanel({
  lists,
  tasks,
  selectedListKey,
  onSelectList,
  loading,
  error,
  onRetry,
  onCreateList,
  onRenameList,
  onDeleteList,
}) {
  const [mode, setMode] = useState(null);
  const [activeList, setActiveList] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(listColors[0]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const knownListIds = new Set(lists.map((list) => list.id));
  const inboxCount = tasks.filter(
    (task) => !task.listId || !knownListIds.has(task.listId)
  ).length;

  const resetForm = () => {
    setMode(null);
    setActiveList(null);
    setName("");
    setColor(listColors[0]);
    setFormError("");
  };

  const beginCreate = () => {
    setMode("create");
    setActiveList(null);
    setName("");
    setColor(listColors[0]);
    setFormError("");
  };

  const beginRename = (list) => {
    setMode("rename");
    setActiveList(list);
    setName(list.name);
    setColor(list.color || listColors[0]);
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setFormError("Enter a list name before saving.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      if (mode === "create") {
        const newListId = await onCreateList({ name: trimmedName, color });
        onSelectList(newListId);
      } else if (activeList) {
        await onRenameList(activeList.id, { name: trimmedName, color });
      }

      resetForm();
    } catch (saveError) {
      console.error("Error saving list:", saveError);
      setFormError(
        `We couldn't ${mode === "create" ? "create" : "rename"} this list. Check your connection and try again.`
      );
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (list) => {
    setDeleteCandidate(list);
    setDeleteError("");
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteCandidate(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;

    setDeleting(true);
    setDeleteError("");

    try {
      await onDeleteList(deleteCandidate.id);
      setDeleteCandidate(null);
      if (activeList?.id === deleteCandidate.id) resetForm();
    } catch (deleteListError) {
      console.error("Error deleting list:", deleteListError);
      setDeleteError(
        "We couldn't delete this list. Check your connection and try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <aside className="task-lists-panel" aria-label="Task lists">
      <div className="task-lists-heading">
        <div>
          <p className="card-label">My lists</p>
          <h3>Organize</h3>
        </div>
        <button
          className="list-add-button"
          type="button"
          onClick={beginCreate}
          aria-label="Create a new list"
          disabled={saving || deleting}
        >
          +
        </button>
      </div>

      <nav className="task-list-nav" aria-label="Filter tasks by list">
        <button
          type="button"
          className={`task-list-filter ${selectedListKey === "all" ? "active" : ""}`}
          onClick={() => onSelectList("all")}
          aria-current={selectedListKey === "all" ? "page" : undefined}
        >
          <span className="list-symbol list-symbol-all" aria-hidden="true">#</span>
          <span>All tasks</span>
          <span className="list-count">{tasks.length}</span>
        </button>
        <button
          type="button"
          className={`task-list-filter ${selectedListKey === "inbox" ? "active" : ""}`}
          onClick={() => onSelectList("inbox")}
          aria-current={selectedListKey === "inbox" ? "page" : undefined}
        >
          <span className="list-symbol list-symbol-inbox" aria-hidden="true">⌂</span>
          <span>Inbox</span>
          <span className="list-count">{inboxCount}</span>
        </button>

        {loading ? (
          <p className="list-state" role="status">Loading lists...</p>
        ) : error ? (
          <div className="list-error" role="alert">
            <p>{error}</p>
            <button className="ghost-btn compact-btn" type="button" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : (
          <>
            {lists.length > 0 && (
              <p className="list-section-label">Custom lists</p>
            )}
            {lists.map((list) => {
              const taskCount = tasks.filter((task) => task.listId === list.id).length;

              return (
                <div className="task-list-entry" key={list.id}>
                  <button
                    type="button"
                    className={`task-list-filter ${selectedListKey === list.id ? "active" : ""}`}
                    onClick={() => onSelectList(list.id)}
                    aria-current={selectedListKey === list.id ? "page" : undefined}
                  >
                    <span
                      className="list-color-dot"
                      style={{ backgroundColor: list.color || listColors[0] }}
                      aria-hidden="true"
                    />
                    <span className="list-name">{list.name}</span>
                    <span className="list-count">{taskCount}</span>
                  </button>
                  <div className="task-list-actions">
                    <button type="button" onClick={() => beginRename(list)} aria-label={`Rename ${list.name}`}>
                      Rename
                    </button>
                    <button type="button" onClick={() => requestDelete(list)} aria-label={`Delete ${list.name}`}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            {lists.length === 0 && (
              <p className="list-state">No custom lists yet.</p>
            )}
          </>
        )}
      </nav>

      {mode && (
        <form className="list-editor" onSubmit={handleSubmit} noValidate>
          <div className="list-editor-heading">
            <strong>{mode === "create" ? "Create a list" : "Edit list"}</strong>
            <span>Use a name and color that are easy to scan.</span>
          </div>
          <label>
            <span>{mode === "create" ? "New list name" : "Rename list"}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Personal"
              disabled={saving}
              autoFocus
            />
          </label>
          <fieldset disabled={saving}>
            <legend>Color</legend>
            <div className="list-color-options">
              {listColors.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={color === option ? "selected" : ""}
                  style={{ backgroundColor: option }}
                  onClick={() => setColor(option)}
                  aria-label={`Use ${option} for this list`}
                  aria-pressed={color === option}
                />
              ))}
            </div>
          </fieldset>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="list-editor-actions">
            <button className="ghost-btn compact-btn" type="button" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
            <button className="primary-btn compact-btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : mode === "create" ? "Create list" : "Save name"}
            </button>
          </div>
        </form>
      )}

      {deleteCandidate && (
        <div className="confirmation-backdrop">
          <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-list-title" aria-describedby="delete-list-description">
            <p className="card-label">List cleanup</p>
            <h3 id="delete-list-title">Delete this list?</h3>
            <p id="delete-list-description">
              “{deleteCandidate.name}” will be deleted. Its tasks will stay safe and move to Inbox.
            </p>
            {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
            <div className="confirmation-actions">
              <button className="ghost-btn" type="button" onClick={cancelDelete} disabled={deleting}>Cancel</button>
              <button className="danger-btn" type="button" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete list"}
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
