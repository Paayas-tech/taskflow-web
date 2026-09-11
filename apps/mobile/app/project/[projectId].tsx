import { useCallback, useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Project, Task } from "@taskflow/domain";
import { getApi } from "../../src/lib/api";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";

export default function ProjectDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (!projectId) {
      setError("This project link is invalid.");
      setLoading(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextProject, nextTasks] = await Promise.all([
        getApi().getProject(projectId),
        getApi().getProjectTasks(projectId),
      ]);
      setProject(nextProject);
      setTasks(nextTasks);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to load this project.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to projects" accessibilityRole="button" hitSlop={12} onPress={router.back} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PROJECT</Text>
          <Text numberOfLines={1} style={styles.heading}>{project?.name ?? "Details"}</Text>
        </View>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading project…</Text></View> : null}
      {!loading && error ? <StateMessage title="Couldn’t load project" detail={error} action={() => void load()} /> : null}
      {!loading && !error && project ? (
        <FlatList
          data={tasks}
          keyExtractor={(task) => task.id}
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <View style={styles.projectCard}>
                <View style={styles.projectTitleRow}>
                  <View style={[styles.projectColor, { backgroundColor: project.color || colors.primary }]} />
                  <Text style={styles.projectName}>{project.name}</Text>
                </View>
                <View style={styles.statusPill}><Text style={styles.statusText}>{project.status}</Text></View>
                {project.description ? <Text style={styles.description}>{project.description}</Text> : <Text style={styles.muted}>No description added.</Text>}
                {project.dueDate ? <Text style={styles.due}>Due {project.dueDate}</Text> : null}
              </View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active tasks</Text>
                <Text style={styles.taskCount}>{tasks.length}</Text>
              </View>
            </>
          }
          ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>All clear</Text><Text style={styles.muted}>There are no active tasks in this project.</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.taskCard}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <View style={styles.metaRow}><Text style={styles.meta}>{item.status}</Text><Text style={styles.dot}>•</Text><Text style={styles.meta}>{item.priority} priority</Text></View>
            </View>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

function StateMessage({ title, detail, action }: { title: string; detail: string; action: () => void }) {
  return <View style={styles.center}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateDetail}>{detail}</Text><Pressable accessibilityRole="button" onPress={action} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.surface },
  backText: { marginTop: -2, fontSize: 28, lineHeight: 30, color: colors.primary },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.caption, letterSpacing: 1, color: colors.primary },
  heading: { ...typography.screenTitle, color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  list: { padding: spacing.lg, paddingTop: spacing.xs, paddingBottom: 40, gap: spacing.sm },
  projectCard: { ...elevation.card, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface },
  projectTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  projectColor: { width: 15, height: 15, borderRadius: radii.pill },
  projectName: { ...typography.sectionTitle, flex: 1, color: colors.text },
  statusPill: { alignSelf: "flex-start", marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  statusText: { ...typography.caption, color: colors.primary, textTransform: "capitalize" },
  description: { ...typography.body, marginTop: spacing.sm, color: colors.muted },
  due: { ...typography.metadata, marginTop: spacing.sm, fontWeight: "600", color: colors.text },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  sectionTitle: { ...typography.sectionTitle, color: colors.text },
  taskCount: { ...typography.caption, minWidth: 28, paddingVertical: spacing.xxs, textAlign: "center", borderRadius: radii.pill, overflow: "hidden", color: colors.primary, backgroundColor: colors.primarySoft },
  taskCard: { ...elevation.card, padding: spacing.md, borderRadius: radii.sm, backgroundColor: colors.surface },
  taskTitle: { ...typography.cardTitle, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  meta: { ...typography.metadata, color: colors.muted, textTransform: "capitalize" },
  dot: { color: colors.muted },
  emptyCard: { alignItems: "center", gap: spacing.xs, padding: spacing.xl, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { ...typography.sectionTitle, color: colors.text },
  muted: { ...typography.body, color: colors.muted, textAlign: "center" },
  stateTitle: { ...typography.sectionTitle, color: colors.text },
  stateDetail: { ...typography.body, color: colors.danger, textAlign: "center" },
  primaryButton: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryButtonText: { ...typography.button, color: "white" },
});
