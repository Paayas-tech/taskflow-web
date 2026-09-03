import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, Icon, Input } from "../ui";

const resultIcons = {
  project: "folder",
  task: "check-square",
  story: "book",
};

const SEARCH_RESULT_LIMIT = 12;

/** Case-insensitive match over the title and subtitle of each item. */
// eslint-disable-next-line react/only-export-components -- pure helper tested alongside the dialog
export function filterSearchItems(items = [], query, limit = SEARCH_RESULT_LIMIT) {
  const term = String(query || "")
    .trim()
    .toLowerCase();
  if (!term) return items.slice(0, limit);
  return items
    .filter((item) =>
      `${item.title || ""} ${item.subtitle || ""}`.toLowerCase().includes(term)
    )
    .slice(0, limit);
}

/**
 * Global search over projects, personal tasks and assigned project work.
 * Items are `{ id, type: 'project'|'task'|'story', title, subtitle }`.
 */
export function SearchDialog({ open, onClose, items = [], onSelect }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const results = useMemo(() => filterSearchItems(items, query), [items, query]);

  const select = (item) => {
    if (!item) return;
    onSelect?.(item);
    onClose?.();
  };

  const handleKeyDown = (event) => {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      select(results[Math.min(activeIndex, results.length - 1)]);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      className="search-dialog"
      initialFocusRef={inputRef}
      aria-label="Search TaskFlow"
    >
      <div className="search-field">
        <Icon name="search" />
        <Input
          ref={inputRef}
          className="search-input"
          type="search"
          value={query}
          placeholder="Search projects and tasks"
          aria-label="Search projects and tasks"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {results.length === 0 ? (
        <p className="search-empty muted" role="status">
          {query.trim() ? "No matches" : "Search projects, tasks and stories"}
        </p>
      ) : (
        <div className="search-results" role="listbox" aria-label="Search results">
          {results.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`search-result${index === activeIndex ? " is-active" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(item)}
            >
              <span className="search-result-icon" aria-hidden="true">
                <Icon name={resultIcons[item.type] || "check-square"} />
              </span>
              <span className="search-result-title truncate">{item.title}</span>
              {item.subtitle ? (
                <span className="search-result-subtitle truncate">{item.subtitle}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}

export default SearchDialog;
