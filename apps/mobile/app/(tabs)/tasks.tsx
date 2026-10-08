import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Task } from "@taskflow/domain";
import { useAsyncResource } from "../../src/hooks/useAsyncResource";
import { getApi } from "../../src/lib/api";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";
import { TaskDetailModal } from "../../src/ui/TaskDetailModal";
import { AppHeader } from "../../src/ui/AppHeader";
import { useTheme } from "../../src/ui/ThemeProvider";

interface TaskGroups { active: Task[]; completed: Task[]; }

export default function TasksScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ taskId?: string }>();
  const loader = useCallback(async (): Promise<TaskGroups> => {
    const [active, completed] = await Promise.all([getApi().getTasks(), getApi().getCompletedTasks()]);
    return { active, completed };
  }, []);
  const { data, error, loading, refreshing, reload, setData } = useAsyncResource<TaskGroups>(loader, { active: [], completed: [] }, "Unable to load tasks.");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = [...data.active, ...data.completed].find((task) => task.id === selectedTaskId) ?? null;
  useEffect(() => { if (params.taskId && [...data.active, ...data.completed].some((task) => task.id === params.taskId)) setSelectedTaskId(params.taskId); }, [params.taskId, data.active, data.completed]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const toggleComplete = async (task: Task) => {
    if (completingId) return;
    const completing = task.status !== "completed";
    const previous = data;
    setCompletingId(task.id);
    setActionError("");
    setData((current) => completing
      ? {
          active: current.active.filter((item) => item.id !== task.id),
          completed: [{ ...task, status: "completed", completedAt: new Date().toISOString() }, ...current.completed],
        }
      : {
          active: [{ ...task, status: "todo", completedAt: null }, ...current.active],
          completed: current.completed.filter((item) => item.id !== task.id),
        });
    try {
      const saved = await getApi().setTaskCompletion(task.id, completing);
      setData((current) => completing
        ? { ...current, completed: current.completed.map((item) => item.id === task.id ? saved : item) }
        : { ...current, active: current.active.map((item) => item.id === task.id ? saved : item) });
    } catch (value) {
      setData(previous);
      setActionError(value instanceof Error ? value.message : `Unable to ${completing ? "complete" : "reopen"} this task.`);
    } finally {
      setCompletingId(null);
    }
  };

  const sections = [
    ...(data.active.length ? [{ title: "Active", data: data.active, completed: false }] : []),
    ...(data.completed.length ? [{ title: "Recently completed", data: data.completed, completed: true }] : []),
  ];

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <AppHeader title="My tasks" subtitle={`${data.active.length} active · ${data.completed.length} completed`} />
      {loading && sections.length === 0 ? <LoadingState /> : null}
      {!loading && error && sections.length === 0 ? <StateMessage detail={error} action={() => void reload()} /> : null}
      {(!loading || sections.length > 0) && !(error && sections.length === 0) ? (
        <SectionList
          sections={sections}
          keyExtractor={(task) => task.id}
          refreshing={refreshing}
          onRefresh={() => void reload(true)}
          contentContainerStyle={sections.length ? styles.list : styles.center}
          ListHeaderComponent={error || actionError ? <Text style={styles.inlineError}>{actionError || error}</Text> : null}
          ListEmptyComponent={<EmptyState />}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item, section }) => (
            <View style={[styles.task, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, section.completed && { backgroundColor: theme.colors.subtle }]}>
              <Pressable accessibilityLabel={section.completed ? `Reopen ${item.title}` : `Complete ${item.title}`} accessibilityRole="button" disabled={completingId !== null} hitSlop={8} onPress={() => void toggleComplete(item)} style={[styles.complete, section.completed && styles.completeDone]}>
                {completingId === item.id ? <ActivityIndicator color={colors.primary} size="small" /> : section.completed ? <Text style={styles.completeMark}>✓</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setSelectedTaskId(item.id)} style={styles.taskCopy}>
                <Text style={[styles.taskTitle, { color: theme.colors.text }, section.completed && styles.completedTitle]}>{item.title}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.chip, item.status === "completed" ? styles.doneChip : item.status === "in-progress" ? styles.progressChip : styles.todoChip]}><Text style={[styles.chipText, item.status === "completed" ? styles.doneText : item.status === "in-progress" ? styles.progressText : styles.todoText]}>{item.status === "in-progress" ? "In progress" : item.status === "completed" ? "Done" : "Todo"}</Text></View>
                  <View style={[styles.chip, item.priority === "high" ? styles.highChip : item.priority === "medium" ? styles.mediumChip : styles.lowChip]}><Text style={[styles.chipText, item.priority === "high" ? styles.highText : item.priority === "medium" ? styles.mediumText : styles.lowText]}>{item.priority[0].toUpperCase() + item.priority.slice(1)}</Text></View>
                  {item.dueDate ? <Text style={styles.due}>◷ {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text> : null}
                </View>
              </Pressable>
            </View>
          )}
        />
      ) : null}
      <TaskDetailModal task={selectedTask} busy={completingId !== null} onClose={() => setSelectedTaskId(null)} onUpdated={(saved) => setData((current) => ({ active: [...current.active.filter((item) => item.id !== saved.id), ...(saved.status !== "completed" ? [saved] : [])], completed: [...current.completed.filter((item) => item.id !== saved.id), ...(saved.status === "completed" ? [saved] : [])] }))} onToggleComplete={(task) => void toggleComplete(task)} />
    </SafeAreaView>
  );
}

function LoadingState() { return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading tasks…</Text></View>; }
function EmptyState() { return <View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.check}>✓</Text></View><Text style={styles.emptyTitle}>All clear</Text><Text style={styles.muted}>No tasks need your attention.</Text></View>; }
function StateMessage({ detail, action }: { detail: string; action: () => void }) { return <View style={styles.center}><Text style={styles.stateTitle}>Couldn’t load tasks</Text><Text style={styles.error}>{detail}</Text><Pressable accessibilityRole="button" onPress={action} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  heading: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.metadata, marginTop: spacing.xxs, color: colors.muted },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  sectionTitle: { ...typography.caption, marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  task: { ...elevation.card, minHeight: 72, flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface },
  completedTask: { backgroundColor: "#FAFBFC" },
  complete: { width: 22, height: 22, alignItems: "center", justifyContent: "center", marginTop: 1, borderRadius: 7, borderWidth: 1.5, borderColor: colors.faint },
  completeDone: { borderColor: colors.success, backgroundColor: colors.success },
  completeMark: { fontSize: 13, fontWeight: "700", color: "white" },
  taskCopy: { flex: 1, minWidth: 0 },
  taskTitle: { fontSize: 15, lineHeight: 20, fontWeight: "600", color: colors.textSoft },
  completedTitle: { textDecorationLine: "line-through", color: colors.muted },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill }, chipText: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  todoChip: { backgroundColor: colors.subtle }, todoText: { color: colors.muted }, progressChip: { backgroundColor: "#EFF6FF" }, progressText: { color: "#2563EB" }, doneChip: { backgroundColor: colors.successSoft }, doneText: { color: colors.success },
  lowChip: { backgroundColor: colors.subtle }, lowText: { color: colors.muted }, mediumChip: { backgroundColor: colors.warningSoft }, mediumText: { color: colors.warning }, highChip: { backgroundColor: colors.dangerSoft }, highText: { color: colors.danger }, due: { ...typography.metadata, color: colors.muted },
  inlineError: { marginBottom: spacing.sm, padding: spacing.md, borderRadius: radii.sm, color: colors.danger, backgroundColor: "#FEF3F2" },
  empty: { alignItems: "center", gap: spacing.sm },
  emptyIcon: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  check: { fontSize: 26, color: colors.primary },
  emptyTitle: { ...typography.sectionTitle, color: colors.text },
  muted: { ...typography.body, color: colors.muted, textAlign: "center" },
  stateTitle: { ...typography.sectionTitle, color: colors.text },
  error: { ...typography.body, color: colors.danger, textAlign: "center" },
  button: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.sm, backgroundColor: colors.primary },
  buttonText: { ...typography.button, color: "white" },
});
