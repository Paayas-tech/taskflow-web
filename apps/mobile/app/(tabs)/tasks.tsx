import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Task } from "@taskflow/domain";
import { getApi } from "../../src/lib/api";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try { setTasks(await getApi().getTasks()); }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to load tasks."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const complete = async (task: Task) => {
    setCompletingId(task.id);
    setError("");
    try { await getApi().completeTask(task.id); setTasks((current) => current.filter((item) => item.id !== task.id)); }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to complete this task."); }
    finally { setCompletingId(null); }
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}><Text style={styles.heading}>Tasks</Text><Text style={styles.subtitle}>{tasks.length} active</Text></View>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading tasks…</Text></View> : null}
      {!loading && error && tasks.length === 0 ? <StateMessage detail={error} action={() => void load()} /> : null}
      {!loading && !(error && tasks.length === 0) ? <FlatList data={tasks} keyExtractor={(task) => task.id} refreshing={refreshing} onRefresh={() => void load(true)} contentContainerStyle={tasks.length ? styles.list : styles.center} ListHeaderComponent={error ? <Text style={styles.inlineError}>{error}</Text> : null} ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.check}>✓</Text></View><Text style={styles.emptyTitle}>All clear</Text><Text style={styles.muted}>No active tasks need your attention.</Text></View>} renderItem={({ item }) => <View style={styles.task}><Pressable accessibilityLabel={`Complete ${item.title}`} accessibilityRole="button" disabled={completingId !== null} hitSlop={8} onPress={() => void complete(item)} style={({ pressed }) => [styles.complete, pressed && styles.completePressed]}>{completingId === item.id ? <ActivityIndicator color={colors.primary} size="small" /> : null}</Pressable><View style={styles.taskCopy}><Text style={styles.taskTitle}>{item.title}</Text><View style={styles.metaRow}><Text style={styles.meta}>{item.status}</Text><Text style={styles.dot}>•</Text><Text style={styles.meta}>{item.priority} priority</Text></View></View></View>} /> : null}
    </SafeAreaView>
  );
}

function StateMessage({ detail, action }: { detail: string; action: () => void }) { return <View style={styles.center}><Text style={styles.stateTitle}>Couldn’t load tasks</Text><Text style={styles.error}>{detail}</Text><Pressable accessibilityRole="button" onPress={action} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md },
  heading: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.metadata, marginTop: spacing.xxs, color: colors.muted },
  list: { padding: spacing.md, paddingTop: spacing.xs, paddingBottom: 40, gap: spacing.xs },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  task: { ...elevation.card, minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.surface },
  complete: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 2, borderColor: colors.primary },
  completePressed: { backgroundColor: colors.primarySoft },
  taskCopy: { flex: 1 },
  taskTitle: { ...typography.cardTitle, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  meta: { ...typography.metadata, color: colors.muted, textTransform: "capitalize" },
  dot: { color: colors.muted },
  inlineError: { marginBottom: spacing.sm, padding: spacing.md, borderRadius: radii.sm, color: colors.danger, backgroundColor: "#FEF3F2" },
  empty: { alignItems: "center", gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  check: { fontSize: 30, color: colors.primary },
  emptyTitle: { ...typography.sectionTitle, color: colors.text },
  muted: { ...typography.body, color: colors.muted, textAlign: "center" },
  stateTitle: { ...typography.sectionTitle, color: colors.text },
  error: { ...typography.body, color: colors.danger, textAlign: "center" },
  button: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.sm, backgroundColor: colors.primary },
  buttonText: { ...typography.button, color: "white" },
});
