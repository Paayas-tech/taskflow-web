import { cx } from "./primitives";

const shapes = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M9.5 20v-6h5v6" />,
  "check-square": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  checklist: <path d="m3 6 2 2 3-3M3 14l2 2 3-3M11 7h10M11 15h10" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  inbox: (
    <>
      <path d="M5.5 5h13l2.5 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" />
      <path d="M3 12h5l2 3h4l2-3h5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  folders: (
    <>
      <path d="M7 8V6a2 2 0 0 1 2-2h3l2 2.5h5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-2" />
      <path d="M3 11a2 2 0 0 1 2-2h3l2 2.5h5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.2 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-2.7-1.2l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.2-2.7l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 2.7 1.2l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1.1z" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "chevron-up": <path d="m6 15 6-6 6 6" />,
  "more-horizontal": (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  "more-vertical": (
    <>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  flag: <path d="M5 21V4m0 1h11l-1.6 3.5L16 12H5" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 4.9a3.5 3.5 0 0 1 0 6.2M17.5 14.4A5.8 5.8 0 0 1 21 20" />
    </>
  ),
  "layout-board": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5z" />
      <path d="M5 18.5A1.5 1.5 0 0 1 6.5 17H19v4H6.5A1.5 1.5 0 0 1 5 19.5z" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4" />
    </>
  ),
  "archive-restore": (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path d="M12 17.5V11m-2.5 2.5L12 11l2.5 2.5" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V5h6v2M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M10 11v6M14 11v6" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 3.6 1 5 2 6H4c1-1 2-2.4 2-6z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  "arrow-up-down": <path d="M7 20V4m-3 3 3-3 3 3M17 4v16m-3-3 3 3 3-3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  paperclip: (
    <path d="M20 11.5 12 19.5a4.5 4.5 0 0 1-6.4-6.4l8-8a3 3 0 0 1 4.3 4.3l-8 8a1.5 1.5 0 0 1-2.2-2.1l7.3-7.3" />
  ),
  "message-circle": <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  circle: <circle cx="12" cy="12" r="8.5" />,
  "circle-dot": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  "circle-check": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  "panel-left": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9.5 4v16" />
    </>
  ),
  "panel-right": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M14.5 4v16" />
    </>
  ),
  "external-link": <path d="M14 4h6v6m0-6-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  "log-out": <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h9" />,
  edit: (
    <>
      <path d="M12 20h8" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
    </>
  ),
  "calendar-plus": (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5" />
    </>
  ),
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  layers: <path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" />,
  tag: (
    <>
      <path d="M11 3H4a1 1 0 0 0-1 1v7l9.5 9.5a2 2 0 0 0 2.8 0l6.2-6.2a2 2 0 0 0 0-2.8z" />
      <path d="M7.5 7.5h.01" />
    </>
  ),
  "grip-vertical": (
    <>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 0 0-13.7-5.1L3 9M3 4v5h5M4 13a8 8 0 0 0 13.7 5.1L21 15m0 5v-5h-5" />,
  "arrow-left": <path d="M20 12H4m6-6-6 6 6 6" />,
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  star: <path d="m12 3.5 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />,
  eye: (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5L12 7" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5L12 17" />
    </>
  ),
};

export function Icon({ name, size = 16, className, ...rest }) {
  const shape = shapes[name];
  if (!shape) {
    return null;
  }

  return (
    <svg
      className={cx("icon", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {shape}
    </svg>
  );
}

const statusModifier = {
  todo: "is-todo",
  "in-progress": "is-in-progress",
  completed: "is-completed",
};

export function StatusIcon({ status = "todo", size = 16, className, ...rest }) {
  const modifier = statusModifier[status] ?? statusModifier.todo;

  return (
    <svg
      className={cx("status-icon", modifier, className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <circle cx="12" cy="12" r="8.5" />
      {status === "in-progress" ? (
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
      ) : null}
      {status === "completed" ? (
        <>
          <circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" />
          <path d="m8.5 12 2.5 2.5 4.5-5" stroke="var(--color-surface)" />
        </>
      ) : null}
    </svg>
  );
}

const priorityMeta = {
  low: { modifier: "is-low", label: "Low priority", bars: 1 },
  medium: { modifier: "is-medium", label: "Medium priority", bars: 2 },
  high: { modifier: "is-high", label: "High priority", bars: 3 },
};

export function PriorityIcon({ priority = "medium", size = 16, className, ...rest }) {
  const meta = priorityMeta[priority] ?? priorityMeta.medium;
  const bars = [
    { key: "low", x: 4, y: 14, height: 6 },
    { key: "medium", x: 10, y: 10, height: 10 },
    { key: "high", x: 16, y: 6, height: 14 },
  ];

  return (
    <svg
      className={cx("priority-icon", meta.modifier, className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={meta.label}
      focusable="false"
      {...rest}
    >
      <title>{meta.label}</title>
      {bars.map((bar, index) => (
        <rect
          key={bar.key}
          className={cx("priority-bar", index < meta.bars ? "is-on" : "is-off")}
          x={bar.x}
          y={bar.y}
          width="4"
          height={bar.height}
          rx="1"
        />
      ))}
    </svg>
  );
}
