import { useCallback, useMemo, useRef, useState } from "react";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Project, Task } from "@taskflow/domain";
import { useAuth } from "../../src/auth/AuthProvider";
import { useAsyncResource } from "../../src/hooks/useAsyncResource";
import { getApi } from "../../src/lib/api";
import { localDateKey } from "../../src/lib/dates";
import { AgentModal } from "../../src/ui/AgentModal";
import { AppHeader } from "../../src/ui/AppHeader";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeProvider";

interface HomeData { tasks: Task[]; projects: Project[]; }
type Filter = "today" | "upcoming" | "overdue";
const dateKey = localDateKey;
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; };

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { name, userId } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("today");
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState("");
  const loader = useCallback(async (): Promise<HomeData> => {
    const [tasks, projects] = await Promise.all([getApi().getTasks(), getApi().getProjects()]);
    return { tasks, projects: projects.filter((project) => project.status === "active") };
  }, []);
  const { data, error, loading, refreshing, reload, setData } = useAsyncResource<HomeData>(loader, { tasks: [], projects: [] }, "Unable to load your dashboard.");
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const groups = useMemo(() => {
    const today = dateKey();
    return {
      today: data.tasks.filter((task) => task.dueDate === today),
      upcoming: data.tasks.filter((task) => Boolean(task.dueDate && task.dueDate > today)),
      overdue: data.tasks.filter((task) => Boolean(task.dueDate && task.dueDate < today)),
    };
  }, [data.tasks]);

  const addTask = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true); setActionError("");
    try {
      const created = await getApi().createTask({ title, status: "todo" });
      setData((current) => ({ ...current, tasks: [created, ...current.tasks] }));
      setDraft("");
    } catch (value) { setActionError(value instanceof Error ? value.message : "Unable to add this task."); }
    finally { setAdding(false); }
  };

  const displayName = name.split(/\s+/u)[0] || "there";
  const formattedDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return <SafeAreaView style={[styles.page, { backgroundColor: theme.colors.background }]}>
    <AppHeader title="TaskFlow" subtitle={`${data.projects.length} active projects`} onAdd={() => inputRef.current?.focus()} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload(true)} tintColor={theme.colors.primary} />}>
      <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.greeting, { color: theme.colors.text }]}>{greeting()}, {displayName}</Text><Text style={[styles.date, { color: theme.colors.muted }]}>{formattedDate}</Text></View></View>
      {(error || actionError) ? <View style={styles.errorCard}><Text style={styles.errorText}>{actionError || error}</Text></View> : null}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}><View><Text style={[styles.cardTitle, { color: theme.colors.text }]}>My tasks</Text><Text style={[styles.cardSubtitle, { color: theme.colors.muted }]}>Focus on what matters today</Text></View>{loading ? <ActivityIndicator color={theme.colors.primary} /> : null}</View>
        <View style={styles.filters}>{(["today", "upcoming", "overdue"] as Filter[]).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, { borderColor: theme.colors.border, backgroundColor: filter === item ? theme.colors.primarySoft : theme.colors.surface }]}><Text style={[styles.filterText, { color: filter === item ? theme.colors.primary : theme.colors.muted }]}>{item[0].toUpperCase() + item.slice(1)} ({groups[item].length})</Text></Pressable>)}</View>
        <View style={[styles.quickAdd, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}><TextInput ref={inputRef} value={draft} onChangeText={setDraft} onSubmitEditing={() => void addTask()} placeholder="Add a task..." placeholderTextColor={theme.colors.faint} style={[styles.input, { color: theme.colors.text }]} returnKeyType="done" /><Pressable disabled={!draft.trim() || adding} onPress={() => void addTask()} style={[styles.addButton, { backgroundColor: theme.colors.primary }, (!draft.trim() || adding) && styles.disabled]}><Text style={styles.addText}>{adding ? "…" : "Add"}</Text></Pressable></View>
        {groups[filter].length ? groups[filter].slice(0, 4).map((task, index) => <Pressable key={task.id} onPress={() => router.push({ pathname: "/(tabs)/tasks", params: { taskId: task.id } } as Href)} style={[styles.taskRow, index > 0 && styles.divider, { borderTopColor: theme.colors.border }]}><View style={[styles.checkbox, { borderColor: theme.colors.faint }]} /><Text numberOfLines={1} style={[styles.taskTitle, { color: theme.colors.text }]}>{task.title}</Text><Text style={[styles.chevron, { color: theme.colors.faint }]}>›</Text></Pressable>) : <View style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: theme.colors.primarySoft }]}><Text style={[styles.emptySymbol, { color: theme.colors.primary }]}>✓</Text></View><Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nothing due {filter === "today" ? "today" : filter}</Text><Text style={[styles.emptyCopy, { color: theme.colors.muted }]}>You’re clear to focus on your next priority.</Text></View>}
      </View>
      <View style={styles.sectionHeading}><Text style={[styles.cardTitle, { color: theme.colors.text }]}>Projects</Text><Pressable onPress={() => router.push("/(tabs)/projects" as Href)}><Text style={[styles.seeAll, { color: theme.colors.primary }]}>See all</Text></Pressable></View>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>{data.projects.length ? data.projects.slice(0, 4).map((project, index) => <Pressable key={project.id} onPress={() => router.push(`/project/${project.id}` as Href)} style={[styles.projectRow, index > 0 && styles.divider, { borderTopColor: theme.colors.border }]}><View style={[styles.projectDot, { backgroundColor: project.color || theme.colors.primary }]} /><View style={styles.projectCopy}><Text numberOfLines={1} style={[styles.projectName, { color: theme.colors.text }]}>{project.name}</Text><Text numberOfLines={1} style={[styles.projectDescription, { color: theme.colors.muted }]}>{project.description || "No description"}</Text></View><View style={[styles.roleBadge, { backgroundColor: theme.colors.subtle }]}><Text style={[styles.roleText, { color: theme.colors.muted }]}>{project.ownerId === userId ? "Owner" : "Editor"}</Text></View></Pressable>) : <View style={styles.emptyCompact}><Text style={[styles.emptyCopy, { color: theme.colors.muted }]}>No active projects yet.</Text></View>}</View>
    </ScrollView>
    <Pressable accessibilityLabel="Open AI Assistant" accessibilityRole="button" onPress={() => setAgentOpen(true)} style={({ pressed }) => [styles.agentButton, pressed && styles.primaryPressed]}><Text style={styles.agentSymbol}>✦</Text></Pressable>
    <AgentModal visible={agentOpen} onClose={() => setAgentOpen(false)} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, paddingBottom: 96, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, headerCopy: { flex: 1, minWidth: 0 }, greeting: { ...typography.screenTitle, color: colors.text }, date: { ...typography.metadata, marginTop: 3, color: colors.muted },
  primaryButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.primary }, primaryPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.98 }] }, primaryButtonText: { ...typography.caption, color: "#FFFFFF" },
  card: { ...elevation.card, overflow: "hidden", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface }, cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, paddingBottom: spacing.md }, cardTitle: { ...typography.sectionTitle, color: colors.textSoft }, cardSubtitle: { ...typography.metadata, marginTop: 2, color: colors.muted },
  filters: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }, filter: { paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.surface }, filterActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, filterText: { ...typography.caption, color: colors.muted }, filterTextActive: { color: colors.primary },
  quickAdd: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: 5, paddingLeft: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.background }, input: { ...typography.body, flex: 1, minWidth: 0, paddingVertical: 7, color: colors.text }, addButton: { minWidth: 54, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 7, backgroundColor: colors.primary }, addText: { ...typography.caption, color: "#FFFFFF" }, disabled: { opacity: 0.45 },
  taskRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg }, checkbox: { width: 18, height: 18, borderWidth: 1.5, borderColor: colors.faint, borderRadius: 6 }, taskTitle: { ...typography.body, flex: 1, color: colors.textSoft }, chevron: { fontSize: 20, color: colors.faint }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  empty: { alignItems: "center", padding: spacing.xxl, paddingTop: spacing.lg }, emptyCompact: { alignItems: "center", padding: spacing.lg }, emptyIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primarySoft }, emptySymbol: { fontSize: 20, fontWeight: "700", color: colors.primary }, emptyTitle: { ...typography.cardTitle, marginTop: spacing.sm, color: colors.textSoft }, emptyCopy: { ...typography.metadata, marginTop: 2, color: colors.muted, textAlign: "center" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs }, seeAll: { ...typography.caption, color: colors.primary }, projectRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg }, projectDot: { width: 11, height: 11, borderRadius: 3 }, projectCopy: { flex: 1, minWidth: 0 }, projectName: { ...typography.cardTitle, color: colors.textSoft }, projectDescription: { ...typography.metadata, color: colors.muted }, roleBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.subtle }, roleText: { ...typography.caption, color: colors.muted },
  errorCard: { padding: spacing.md, borderWidth: 1, borderColor: "#FECDD3", borderRadius: radii.sm, backgroundColor: colors.dangerSoft }, errorText: { ...typography.metadata, color: colors.danger },
  agentButton: { ...elevation.card, position: "absolute", right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primary }, agentSymbol: { fontSize: 25, color: "#FFFFFF" },
});
