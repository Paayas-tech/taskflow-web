import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Task } from "@taskflow/domain";
import { useAsyncResource } from "../src/hooks/useAsyncResource";
import { getApi } from "../src/lib/api";
import { localDateKey } from "../src/lib/dates";
import { useFocusEffect } from "expo-router";
import { AppHeader } from "../src/ui/AppHeader";
import { TaskDetailModal } from "../src/ui/TaskDetailModal";
import { radii, spacing, typography } from "../src/ui/theme";
import { useTheme } from "../src/ui/ThemeProvider";

const key = localDateKey;
export default function CalendarScreen() {
  const { colors } = useTheme(); const [selected, setSelected] = useState(key(new Date())); const [task, setTask] = useState<Task | null>(null);
  const { data, loading, reload } = useAsyncResource(useCallback(() => getApi().getAllTasks(), []), [], "Unable to load calendar.");
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const days = useMemo(() => Array.from({ length: 14 }, (_, index) => { const value = new Date(); value.setDate(value.getDate() + index - 3); return value; }), []);
  const scheduled = data.filter((item) => item.dueDate === selected);
  return <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]}><AppHeader back title="Calendar" subtitle={new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>{days.map((day) => { const active = key(day) === selected; const count = data.filter((item) => item.dueDate === key(day)).length; return <Pressable key={key(day)} onPress={() => setSelected(key(day))} style={[styles.day, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.surface }]}><Text style={[styles.weekday, { color: active ? colors.primary : colors.muted }]}>{day.toLocaleDateString(undefined, { weekday: "short" })}</Text><Text style={[styles.dayNumber, { color: colors.text }]}>{day.getDate()}</Text>{count ? <View style={[styles.eventDot, { backgroundColor: colors.primary }]} /> : null}</Pressable>; })}</ScrollView>
    <Text style={[styles.section, { color: colors.muted }]}>AGENDA · {scheduled.length}</Text>{loading ? <ActivityIndicator color={colors.primary} /> : <FlatList data={scheduled} keyExtractor={(item) => item.id} contentContainerStyle={scheduled.length ? styles.list : styles.center} ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyTitle, { color: colors.text }]}>No tasks scheduled</Text><Text style={[styles.meta, { color: colors.muted }]}>Select another date or add a due date from a task.</Text></View>} renderItem={({ item }) => <Pressable onPress={() => setTask(item)} style={[styles.task, { borderBottomColor: colors.border }]}><View style={[styles.priority, { backgroundColor: item.priority === "high" ? colors.danger : item.priority === "medium" ? colors.warning : colors.faint }]} /><View style={styles.copy}><Text style={[styles.taskTitle, { color: colors.text }]}>{item.title}</Text><Text style={[styles.meta, { color: colors.muted }]}>{item.status} · {item.priority} priority</Text></View><Text style={{ color: colors.faint }}>›</Text></Pressable>} />}
    <TaskDetailModal task={task} busy={false} onClose={() => setTask(null)} onUpdated={(saved) => { setTask(saved); void reload(); }} onToggleComplete={async (value) => { await getApi().setTaskCompletion(value.id, value.status !== "completed"); setTask(null); void reload(); }} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, days: { gap: spacing.sm, padding: spacing.md }, day: { width: 56, height: 70, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.sm }, weekday: { ...typography.caption, fontWeight: "500" }, dayNumber: { fontSize: 18, fontWeight: "600", marginTop: 3 }, eventDot: { width: 5, height: 5, borderRadius: 3, marginTop: 5 }, section: { ...typography.caption, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, letterSpacing: 0.7 }, list: { paddingHorizontal: spacing.lg }, center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }, task: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, priority: { width: 3, height: 34, borderRadius: 2 }, copy: { flex: 1 }, taskTitle: { ...typography.cardTitle }, meta: { ...typography.metadata, marginTop: 3 }, empty: { alignItems: "center" }, emptyTitle: { ...typography.sectionTitle, marginBottom: spacing.xs } });
