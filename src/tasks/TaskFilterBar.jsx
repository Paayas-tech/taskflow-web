import { Button } from "../ui/Button";
import { Checkbox, Input, Select } from "../ui/Field";
import { Icon } from "../ui/icons";
import { cx } from "../ui/primitives";

function FilterChip({ id, label, value, options = [], defaultValue, onChange, disabled }) {
  const fallback = defaultValue ?? options[0]?.value;

  return (
    <label className={cx("filter-select", value !== fallback && "is-active")}>
      <span className="filter-select-label">{`${label}:`}</span>
      <Select
        id={id}
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

/** The compact search + filters toolbar shared by My Tasks and the project tabs. */
export function TaskFilterBar({
  search = "",
  onSearch,
  filters = [],
  sort,
  group,
  onClear,
  activeCount = 0,
  className,
  ...rest
}) {
  return (
    <div className={cx("toolbar", "task-filter-bar", className)} aria-label="Task filters" {...rest}>
      <div className="filter-search">
        <Icon name="search" size={14} className="filter-search-icon" />
        <Input
          type="search"
          className="filter-search-input"
          value={search}
          placeholder="Search tasks"
          aria-label="Search tasks"
          onChange={(event) => onSearch?.(event.target.value)}
        />
      </div>

      {filters.map((filter) =>
        filter.type === "checkbox" ? (
          <Checkbox
            key={filter.id}
            className={cx("filter-checkbox", filter.value && "is-active")}
            checked={Boolean(filter.value)}
            label={filter.label}
            disabled={filter.disabled}
            onChange={(event) => filter.onChange?.(event.target.checked)}
          />
        ) : (
          <FilterChip
            key={filter.id}
            id={filter.id}
            label={filter.label}
            value={filter.value}
            options={filter.options}
            defaultValue={filter.defaultValue}
            disabled={filter.disabled}
            onChange={filter.onChange}
          />
        )
      )}

      {group ? (
        <FilterChip
          id="task-filter-group"
          label="Group by"
          value={group.value}
          options={group.options}
          onChange={group.onChange}
        />
      ) : null}

      {sort ? (
        <FilterChip
          id="task-filter-sort"
          label="Sort"
          value={sort.value}
          options={sort.options}
          onChange={sort.onChange}
        />
      ) : null}

      {activeCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
