import { useMemo } from "react";
import { TaskRow } from "../tasks";
import { EmptyState } from "../ui";
import { groupCalendarAgenda, normalizeTaskSchedule } from "../domain/calendarDomain";
import { isTaskComplete, localDateFromDateOnly } from "../domain/taskDomain";
import { formatTimeForDisplay } from "../domain/settingsDomain";

const formatAgendaDate = (dateKey) => {
  const date = localDateFromDateOnly(dateKey);
  return date
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(date)
    : dateKey;
};

const timeLabel = (task, formatSettings) => {
  const schedule = normalizeTaskSchedule(task);
  if (schedule.isAllDay) return "All day";
  return `${formatTimeForDisplay(schedule.startTime, formatSettings.format)}–${formatTimeForDisplay(schedule.endTime, formatSettings.format)}`;
};

/** Chronological list of everything scheduled, grouped by date. */
export function CalendarAgendaView({
  tasks = [],
  todayKey,
  selectedTaskId = null,
  projectsById,
  pendingIds,
  onSelectDate,
  onToggleComplete,
  onOpenTask,
  formatSettings = {},
}) {
  const groups = useMemo(
    () => groupCalendarAgenda(tasks, { expandMultiDay: true }),
    [tasks]
  );
  const context = useMemo(() => ({ projectsById }), [projectsById]);
  const sections = [
    {
      id: "overdue",
      title: "Overdue",
      groups: groups
        .filter(({ date }) => date < todayKey)
        .map((group) => ({
          ...group,
          items: group.items.filter((task) => !isTaskComplete(task)),
        }))
        .filter(({ items }) => items.length),
    },
    {
      id: "today",
      title: "Today",
      groups: groups.filter(({ date }) => date === todayKey),
    },
    {
      id: "upcoming",
      title: "Upcoming",
      groups: groups.filter(({ date }) => date > todayKey),
    },
  ].filter(({ groups: sectionGroups }) => sectionGroups.length);

  if (sections.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Nothing scheduled"
        description="Tasks with a due date show up here in chronological order."
      />
    );
  }

  return (
    <div className="cal-agenda-view" aria-label="Agenda">
      {sections.map((section) => (
        <section className="section cal-agenda-section" key={section.id}>
          <header className="section-header">
            <h2 className="section-title">{section.title}</h2>
            <span className="section-meta">
              {section.groups.reduce((total, group) => total + group.items.length, 0)}
            </span>
          </header>

          {section.groups.map((group) => (
            <div className="cal-agenda-group" key={group.date}>
              <button
                type="button"
                className="cal-agenda-date"
                onClick={() => onSelectDate?.(group.date)}
              >
                {formatAgendaDate(group.date)}
              </button>
              <div className="row-list">
                {group.items.map((task) => {
                  const googleEvent = task.source === "google";
                  return (
                    <div className="cal-agenda-entry" key={`${group.date}:${task.id}`}>
                      <span className="cal-agenda-time muted">
                        {timeLabel(task, formatSettings)}
                      </span>
                      <TaskRow
                        task={task}
                        context={context}
                        dense
                        todayKey={todayKey}
                        selected={selectedTaskId === task.id}
                        busy={pendingIds?.has?.(task.id) || false}
                        readOnly={googleEvent}
                        formatSettings={formatSettings}
                        onOpen={onOpenTask}
                        onToggleComplete={googleEvent ? undefined : onToggleComplete}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default CalendarAgendaView;
