export const PROJECT_HEALTH_OPTIONS = [
  { value: "on_track", label: "On track" },
  { value: "at_risk", label: "At risk" },
  { value: "off_track", label: "Off track" },
  { value: "on_hold", label: "On hold" },
  { value: "complete", label: "Complete" },
];

const healthValues = new Set(PROJECT_HEALTH_OPTIONS.map(({ value }) => value));
export const normalizeProjectHealth = (value) => healthValues.has(value) ? value : "on_track";
export const isCompletedStatus = (status) => ["done", "completed"].includes(status);
export const statusLabel = (status) => ({ todo: "To do", in_progress: "In progress", done: "Done", completed: "Completed" })[status]
  || String(status || "Unknown").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

export const formatOverviewDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
