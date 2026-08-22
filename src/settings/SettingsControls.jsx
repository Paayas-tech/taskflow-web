export function SettingsGroup({ title, children }) {
  return (
    <section className="settings-list-section" aria-labelledby={`settings-${title}`}>
      <h2 id={`settings-${title}`}>{title}</h2>
      <div className="settings-list">{children}</div>
    </section>
  );
}

export function SettingsRow({ label, value, onClick, disabled = false, selected = false }) {
  return (
    <button
      className="settings-list-row"
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      <span className="settings-row-end">
        {value && <small>{value}</small>}
        {selected ? (
          <span className="settings-check" aria-label="Selected">✓</span>
        ) : (
          !disabled && <span className="settings-chevron" aria-hidden="true">›</span>
        )}
      </span>
    </button>
  );
}

export function ToggleRow({ label, description, checked, onChange, disabled = false, status }) {
  return (
    <label className={`settings-list-row settings-list-toggle ${disabled ? "is-disabled" : ""}`}>
      <span className="settings-toggle-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="settings-row-end">
        {status && <small>{status}</small>}
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange?.(event.target.checked)}
          disabled={disabled}
        />
      </span>
    </label>
  );
}

export function SettingsDetail({ title, description, onBack, children, headerAction }) {
  return (
    <section className="settings-detail" aria-labelledby="settings-detail-title">
      <header className="settings-detail-navigation">
        <button className="settings-back" type="button" onClick={onBack} aria-label={`Back from ${title}`}>
          <span aria-hidden="true">←</span>
        </button>
        <h2 id="settings-detail-title">{title}</h2>
        <span className="settings-detail-header-action">{headerAction}</span>
      </header>
      {description && <p className="settings-detail-description">{description}</p>}
      {children}
    </section>
  );
}

export function SelectionRows({ options, value, onSelect, ariaLabel }) {
  return (
    <div className="settings-compact-list" role="radiogroup" aria-label={ariaLabel}>
      {options.map(([optionValue, label, description]) => (
        <label
          className={`settings-choice-row ${value === optionValue ? "is-selected" : ""}`}
          key={optionValue}
        >
          <span>
            <strong>{label}</strong>
            {description && <small>{description}</small>}
          </span>
          <input
            type="radio"
            name={ariaLabel}
            value={optionValue}
            checked={value === optionValue}
            onChange={() => onSelect(optionValue)}
          />
          <span className="settings-check" aria-hidden="true">
            {value === optionValue ? "✓" : ""}
          </span>
        </label>
      ))}
    </div>
  );
}

export function UnavailableProviders({ providers }) {
  return (
    <div className="settings-compact-list">
      {providers.map((provider) => (
        <div className="settings-provider-row" key={provider}>
          <span>
            <strong>{provider}</strong>
            <small>No connection is configured.</small>
          </span>
          <button className="ghost-btn compact-btn" type="button" disabled>
            Not available
          </button>
        </div>
      ))}
    </div>
  );
}

export function PlaceholderPanel({ title, description, onBack, children }) {
  return (
    <SettingsDetail title={title} description={description} onBack={onBack}>
      <div className="settings-placeholder-panel">
        {children || <p>This capability is not connected in TaskFlow yet.</p>}
      </div>
    </SettingsDetail>
  );
}
