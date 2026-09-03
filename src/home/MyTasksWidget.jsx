import { useMemo, useState } from "react";
import { QuickAdd, TaskRow } from "../tasks";
import { Button, EmptyState, SegmentedControl } from "../ui";
import { homeTaskBuckets } from "./homeData";
import { Widget, WidgetError, WidgetSkeleton } from "./Widget";

const VISIBLE_LIMIT = 6;

const tabs = [
  { id: "today", label: "Today", empty: "Nothing due today" },
  { id: "upcoming", label: "Upcoming", empty: "Nothing due in the next 7 days" },
  { id: "overdue", label: "Overdue", empty: "Nothing overdue" },
];

/** Today / Upcoming / Overdue tasks with an inline quick-add underneath. */
export function MyTasksWidget({
  tasks = [],
  loading = false,
  error = "",
  onRetry,
  context,
  taskActions,
  onOpenTask,
  onOpenProject,
  selectedTaskId = null,
  onNewTask,
  onNavigate,
  todayKey,
  formatSettings,
}) {
  const [tab, setTab] = useState("today");
  const buckets = useMemo(() => homeTaskBuckets(tasks, todayKey), [tasks, todayKey]);

  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0];
  const visible = buckets[activeTab.id].slice(0, VISIBLE_LIMIT);
  const dueDate = activeTab.id === "today" ? todayKey : "";
  const pendingIds = taskActions?.pendingIds;

  return (
    <Widget
      className="my-tasks-widget"
      title="My tasks"
      actions={
        <>
          <SegmentedControl
            size="sm"
            ariaLabel="Filter my tasks"
            value={activeTab.id}
            onChange={setTab}
            options={tabs.map((item) => ({
              id: item.id,
              label: item.label,
              count: buckets[item.id].length,
            }))}
          />
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.("/tasks")}>
            View all
          </Button>
        </>
      }
      footer={
        <QuickAdd
          autoFocus={false}
          onCreate={(title) => taskActions?.createPersonal?.({ title, dueDate })}
          onOpenDetails={(title) => onNewTask?.({ title, dueDate })}
        />
      }
    >
      {loading ? <WidgetSkeleton label="Loading tasks" /> : null}
      {!loading && error ? <WidgetError message={error} onRetry={onRetry} /> : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState icon="check-square" title={activeTab.empty} />
      ) : null}
      {!loading && !error
        ? visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              context={context}
              dense
              showProject
              todayKey={todayKey}
              selected={task.id === selectedTaskId}
              busy={Boolean(pendingIds?.has?.(task.id))}
              onOpen={onOpenTask}
              onOpenProject={onOpenProject}
              onToggleComplete={taskActions?.toggleComplete}
              formatSettings={formatSettings}
            />
          ))
        : null}
    </Widget>
  );
}

export default MyTasksWidget;
