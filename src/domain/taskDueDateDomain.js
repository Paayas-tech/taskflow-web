import { classifyDateOnly, dateOnlyKey } from "./taskDomain";
import { formatDateOnlyForDisplay } from "./settingsDomain";

export const taskDueDateMeta = (
  value,
  { dateFormat, today = new Date() } = {}
) => {
  if (!value) return null;

  const dateGroup = classifyDateOnly(value, dateOnlyKey(today));
  if (dateGroup === "overdue") {
    return {
      label: `Overdue · ${formatDateOnlyForDisplay(value, dateFormat)}`,
      tone: "overdue",
    };
  }
  if (dateGroup === "today") return { label: "Due today", tone: "today" };

  return {
    label: formatDateOnlyForDisplay(value, dateFormat),
    tone: "upcoming",
  };
};
