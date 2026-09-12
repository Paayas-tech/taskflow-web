import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Task } from "@taskflow/domain";
import { useAsyncResource } from "../../src/hooks/useAsyncResource";
import { getApi } from "../../src/lib/api";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";

interface TaskGroups { active: Task[]; completed: Task[]; }

export default function TasksScreen() {
  const loader = useCallback(async (): Promise<TaskGroups> => {
    const [active, completed] = await Promise.all([getApi().getTasks(), getApi().getCompletedTasks()]);
    return { active, completed };
  }, []);
  const { data, error, loading, refreshing, reload, setData } = useAsyncResource<TaskGroups>(loader, { active: [], completed: [] }, "Unable to load tasks.");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const complete = async (task: Task) => {
    if (completingId) return;
    const previous = data;
    setCompletingId(task.id);
    setActionError("");
    setData((current) => ({ active: current.active.filter((item) => item.id !== task.id), completed: [{ ...task, status: "completed" }, ...current.completed] }));
    try {
      const completed = await getApi().completeTask(task.id);
      setData((current) => ({ ...current, completed: current.completed.map((item) => item.id === task.id ? completed : item) }));
    } catch (value) {
      setData(previous);
      setActionError(value instanceof Error ? value.message : "Unable to complete this task.");
    } finally {
      setCompletingId(null);
    }
  };

  const sections = [
    ...(data.active.length ? [{ title: "Active", data: data.active, completed: false }] : []),
    ...(data.completed.length ? [{ title: "Recently completed", data: data.completed, completed: true }] : []),
  ];

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}><Text style={styles.heading}>Tasks</Text><Text style={styles.subtitle}>{data.active.length} active</Text></View>
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
            <View style={[styles.task, section.completed && styles.completedTask]}>
              <Pressable accessibilityLabel={section.completed ? `${item.title} is complete` : `Complete ${item.title}`} accessibilityRole="button" disabled={section.completed || completingId !== null} hitSlop={8} onPress={() => void complete(item)} style={[styles.complete, section.completed && styles.completeDone]}>
                {completingId === item.id ? <ActivityIndicator color={colors.primary} size="small" /> : section.completed ? <Text style={styles.completeMark}>✓</Text> : null}
              </Pressable>
              <View style={styles.taskCopy}><Text style={[styles.taskTitle, section.completed && styles.completedTitle]}>{item.title}</Text><Text style={styles.meta}>{section.completed ? "Completed" : `${item.status} • ${item.priority} priority`}</Text></View>
            </View>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

function LoadingState() { return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading tasks…</Text></View>; }
function EmptyState() { return <View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.check}>✓</Text></View><Text style={styles.emptyTitle}>All clear</Text><Text style={styles.muted}>No tasks need your attention.</Text></View>; }
function StateMessage({ detail, action }: { detail: string; action: () => void }) { return <View style={styles.center}><Text style={styles.stateTitle}>Couldn’t load tasks</Text><Text style={styles.error}>{detail}</Text><Pressable accessibilityRole="button" onPress={action} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  heading: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.metadata, marginTop: spacing.xxs, color: colors.muted },
  list: { padding: spacing.md, paddingTop: 0, paddingBottom: 40, gap: spacing.xs },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  sectionTitle: { ...typography.caption, marginTop: spacing.md, marginBottom: spacing.xxs, paddingHorizontal: spacing.xs, color: colors.muted, textTransform: "uppercase" },
  task: { ...elevation.card, minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.surface },
  completedTask: { opacity: 0.72 },
  complete: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 2, borderColor: colors.primary },
  completeDone: { borderColor: colors.success, backgroundColor: colors.success },
  completeMark: { fontSize: 13, fontWeight: "700", color: "white" },
  taskCopy: { flex: 1 },
  taskTitle: { ...typography.cardTitle, color: colors.text },
  completedTitle: { textDecorationLine: "line-through", color: colors.muted },
  meta: { ...typography.metadata, marginTop: spacing.xxs, color: colors.muted, textTransform: "capitalize" },
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
