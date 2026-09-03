import { Checkbox, Icon } from "../ui";
import { cx } from "../ui/cx";

const slug = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** A titled card of setting rows on the settings overview. */
export function SettingsGroup({ title, children }) {
  const titleId = `settings-group-${slug(title)}`;

  return (
    <section className="settings-group" aria-labelledby={titleId}>
      <h2 className="settings-group-title" id={titleId}>
        {title}
      </h2>
      <div className="row-list">{children}</div>
    </section>
  );
}

/** A navigating settings row: label, optional value, chevron. */
export function SettingsRow({ label, value, description, onClick, disabled = false }) {
  return (
    <button className="settings-row" type="button" onClick={onClick} disabled={disabled}>
      <span className="settings-row-body">
        <span className="settings-row-label">{label}</span>
        {description ? <span className="settings-row-description">{description}</span> : null}
      </span>
      {value ? <span className="settings-row-value">{value}</span> : null}
      <Icon className="settings-row-chevron" name="chevron-right" />
    </button>
  );
}

/** A settings row whose control is a switch. */
export function ToggleRow({ label, description, checked = false, onChange, disabled = false }) {
  return (
    <div className={cx("settings-row", "settings-toggle-row", disabled && "is-disabled")}>
      <span className="settings-row-body">
        <span className="settings-row-label">{label}</span>
        {description ? <span className="settings-row-description">{description}</span> : null}
      </span>
      <Checkbox
        className="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
    </div>
  );
}

/**
 * The body of a settings detail panel. The panel title and its Back button live
 * in the page header, so the title is only used as the region's accessible name.
 */
export function SettingsDetail({ title, description, children }) {
  return (
    <section className="settings-detail" aria-label={title}>
      {description ? <p className="settings-detail-description">{description}</p> : null}
      {children}
    </section>
  );
}

/** A single-choice list of options rendered as radio rows with a check icon. */
export function SelectionRows({ options, value, onSelect, ariaLabel }) {
  return (
    <div className="option-list" role="radiogroup" aria-label={ariaLabel}>
      {options.map(([optionValue, label, description]) => {
        const selected = value === optionValue;

        return (
          <label className={cx("option-row", selected && "is-selected")} key={optionValue}>
            <input
              className="option-input"
              type="radio"
              name={ariaLabel}
              value={optionValue}
              checked={selected}
              onChange={() => onSelect(optionValue)}
            />
            <span className="option-body">
              <span className="option-label">{label}</span>
              {description ? <span className="option-description">{description}</span> : null}
            </span>
            {selected ? <Icon className="option-check" name="check" /> : null}
          </label>
        );
      })}
    </div>
  );
}
