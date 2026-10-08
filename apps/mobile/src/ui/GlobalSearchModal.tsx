import { type Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Project, Task } from "@taskflow/domain";
import { getApi } from "../lib/api";
import { radii, spacing, typography } from "./theme";
import { useTheme } from "./ThemeProvider";

export function GlobalSearchModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter(); const { colors } = useTheme(); const input = useRef<TextInput>(null);
  const [query, setQuery] = useState(""); const [results, setResults] = useState<{ tasks: Task[]; projects: Project[] }>({ tasks: [], projects: [] }); const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!visible) return; const timer = setTimeout(() => input.current?.focus(), 250); return () => clearTimeout(timer); }, [visible]);
  useEffect(() => { if (!visible) return; let active = true; setLoading(true); setError(""); const timer = setTimeout(() => { void getApi().search(query).then((value) => { if (active) setResults(value); }).catch((value) => { if (active) { setResults({ tasks: [], projects: [] }); setError(value instanceof Error ? value.message : "Unable to search. Please try again."); } }).finally(() => { if (active) setLoading(false); }); }, 180); return () => { active = false; clearTimeout(timer); }; }, [query, visible]);
  const open = (href: Href) => { onClose(); router.push(href); };
  return <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
    <View style={[styles.page, { backgroundColor: colors.background }]}><View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}><Text style={[styles.symbol, { color: colors.muted }]}>⌕</Text><TextInput ref={input} value={query} onChangeText={setQuery} placeholder="Search tasks and projects" placeholderTextColor={colors.faint} autoCapitalize="none" style={[styles.input, { color: colors.text }]} /><Pressable onPress={onClose}><Text style={[styles.cancel, { color: colors.primary }]}>Cancel</Text></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        {results.projects.length ? <><Text style={[styles.label, { color: colors.muted }]}>PROJECTS</Text>{results.projects.map((project) => <Pressable key={project.id} onPress={() => open(`/project/${project.id}` as Href)} style={[styles.row, { borderBottomColor: colors.border }]}><View style={[styles.projectDot, { backgroundColor: project.color || colors.primary }]} /><View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{project.name}</Text><Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>{project.description || "Project"}</Text></View><Text style={{ color: colors.faint }}>›</Text></Pressable>)}</> : null}
        {results.tasks.length ? <><Text style={[styles.label, { color: colors.muted }]}>TASKS</Text>{results.tasks.map((task) => <Pressable key={task.id} onPress={() => open({ pathname: "/(tabs)/tasks", params: { taskId: task.id } } as Href)} style={[styles.row, { borderBottomColor: colors.border }]}><View style={[styles.status, { borderColor: colors.faint }]} /><View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{task.title}</Text><Text style={[styles.meta, { color: colors.muted }]}>{task.status} · {task.priority}</Text></View></Pressable>)}</> : null}
        {!loading && !results.projects.length && !results.tasks.length ? <View style={styles.empty}><Text style={[styles.emptyTitle, { color: colors.text }]}>No results</Text><Text style={[styles.meta, { color: colors.muted }]}>Try a task title or project name.</Text></View> : null}
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: 48, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, symbol: { fontSize: 23 }, input: { ...typography.body, flex: 1, minWidth: 0, paddingVertical: 9 }, cancel: { ...typography.metadata, fontWeight: "600" }, content: { padding: spacing.lg, paddingBottom: 50 }, label: { ...typography.caption, marginTop: spacing.lg, marginBottom: spacing.xs, letterSpacing: 0.7 }, row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, copy: { flex: 1, minWidth: 0 }, title: { ...typography.cardTitle }, meta: { ...typography.metadata, marginTop: 2 }, projectDot: { width: 10, height: 10, borderRadius: 3 }, status: { width: 17, height: 17, borderRadius: 6, borderWidth: 1 }, empty: { alignItems: "center", paddingTop: 90 }, emptyTitle: { ...typography.sectionTitle, marginBottom: spacing.xs } });
