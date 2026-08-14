import { useMemo } from "react";
import TaskRow from "./TaskRow";
import { groupCalendarAgenda, normalizeTaskSchedule } from "./domain/calendarDomain";
import { isTaskComplete, localDateFromDateOnly } from "./domain/taskDomain";
import { formatReminderMetadata } from "./domain/reminderDomain";
import {
  formatDateOnlyForDisplay,
  formatTimeForDisplay,
} from "./domain/settingsDomain";

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

const scheduleLabel = (task, formatSettings) => {
  const schedule = normalizeTaskSchedule(task);
  if (schedule.isAllDay) {
    return schedule.endDate
      ? `All day through ${formatDateOnlyForDisplay(schedule.endDate, formatSettings.dateFormat)}`
      : "All day";
  }
  return schedule.endDate
    ? `${formatTimeForDisplay(schedule.startTime, formatSettings.format)} · ends ${formatDateOnlyForDisplay(schedule.endDate, formatSettings.dateFormat)} at ${formatTimeForDisplay(schedule.endTime, formatSettings.format)}`
    : `${formatTimeForDisplay(schedule.startTime, formatSettings.format)}–${formatTimeForDisplay(schedule.endTime, formatSettings.format)}`;
};

export default function CalendarAgendaView({
  tasks,
  todayKey,
  selectedTaskId,
  lists,
  projects,
  quickTaskPendingIds,
  onSelectDate,
  onToggleCompletion,
  onEditTask,
  onArchiveTask,
  formatSettings = {},
}) {
  const groups = useMemo(
    () => groupCalendarAgenda(tasks, { expandMultiDay: true }),
    [tasks]
  );
  const sections = [
    {
      key: "overdue",
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
      key: "today",
      title: "Today",
      groups: groups.filter(({ date }) => date === todayKey),
    },
    {
      key: "upcoming",
      title: "Upcoming",
      groups: groups.filter(({ date }) => date > todayKey),
    },
  ].filter(({ groups: sectionGroups }) => sectionGroups.length);

  if (sections.length === 0) {
    return (
      <section className="calendar-dedicated-agenda calendar-date-empty">
        <h3>No scheduled tasks</h3>
        <p>Dated tasks will appear here in chronological order.</p>
      </section>
    );
  }

  return (
    <section className="calendar-dedicated-agenda" aria-label="Calendar agenda">
      {sections.map((section) => (
        <section className="calendar-agenda-section" key={section.key}>
          <header>
            <h3>{section.title}</h3>
            <span>
              {section.groups.reduce(
                (total, group) => total + group.items.length,
                0
              )}
            </span>
          </header>
          {section.groups.map((group) => (
            <div className="calendar-agenda-date-group" key={group.date}>
              <button type="button" onClick={() => onSelectDate(group.date)}>
                {formatAgendaDate(group.date)}
              </button>
              <div className="calendar-agenda-group-list">
                {group.items.map((task) => (
                  <div
                    className="calendar-agenda-entry"
                    key={`${group.date}:${task.id}`}
                  >
                    <p className="calendar-agenda-schedule">
                      {scheduleLabel(task, formatSettings)}
                      {task.reminder
                        ? ` · ${formatReminderMetadata(task.reminderAt, new Date(), {
                            timeFormat: formatSettings.format,
                          })}`
                        : ""}
                    </p>
                    <TaskRow
                      task={task}
                      lists={lists}
                      projects={projects}
                      completionBusy={quickTaskPendingIds.has(task.id)}
                      selected={selectedTaskId === task.id}
                      onToggleCompletion={onToggleCompletion}
                      onEdit={onEditTask}
                      onArchive={onArchiveTask}
                      formatSettings={formatSettings}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}
