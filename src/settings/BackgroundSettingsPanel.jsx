import { SettingsDetail } from "./SettingsControls";

export default function BackgroundSettingsPanel({
  backgrounds,
  selectedBackgroundId,
  searchValue,
  onSearchChange,
  onSelectBackground,
  onBack,
}) {
  const normalizedSearch = searchValue.trim().toLowerCase();
  const visibleBackgrounds = backgrounds.filter(
    ({ name, category, description }) =>
      `${name} ${category} ${description}`
        .toLowerCase()
        .includes(normalizedSearch)
  );

  return (
    <SettingsDetail
      title="Choose Background"
      description="Choose a workspace background."
      onBack={onBack}
      headerAction={<span aria-hidden="true">⌕</span>}
    >
      <label className="settings-background-search">
        <span className="sr-only">Search backgrounds</span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search backgrounds"
        />
      </label>
      <div className="settings-background-grid">
        {visibleBackgrounds.map((background) => {
          const { id, name, category, description } = background;
          return (
            <button
              key={id}
              className={`settings-background-option background-${id} ${
                selectedBackgroundId === id ? "is-selected" : ""
              }`}
              type="button"
              onClick={() => onSelectBackground(background)}
            >
              <span className="settings-background-preview" aria-hidden="true" />
              <span>
                <strong>{name}</strong>
                <small>{category} · {description}</small>
              </span>
              {selectedBackgroundId === id && (
                <span className="settings-background-check">✓</span>
              )}
            </button>
          );
        })}
      </div>
      {visibleBackgrounds.length === 0 && (
        <div className="settings-background-empty" role="status">
          No matches.
        </div>
      )}
    </SettingsDetail>
  );
}
