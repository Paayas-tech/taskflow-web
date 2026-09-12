import { useCallback, useState } from "react";
import { Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Project, Task } from "@taskflow/domain";
import { useAuth } from "../../src/auth/AuthProvider";
import { useAsyncResource } from "../../src/hooks/useAsyncResource";
import { getApi } from "../../src/lib/api";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";

interface ProjectData { project: Project | null; tasks: Task[]; }

export default function ProjectDetailsScreen() {
  const router = useRouter();
  const { authenticated, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const loader = useCallback(async (): Promise<ProjectData> => {
    if (!projectId) throw new Error("This project link is invalid.");
    const [project, tasks] = await Promise.all([getApi().getProject(projectId), getApi().getProjectTasks(projectId)]);
    return { project, tasks };
  }, [projectId]);
  const { data, error, loading, refreshing, reload, setData } = useAsyncResource<ProjectData>(loader, { project: null, tasks: [] }, "Unable to load this project.");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useFocusEffect(useCallback(() => {
    if (authenticated) void reload();
  }, [authenticated, reload]));

  const complete = async (task: Task) => {
    if (completingId) return;
    const previous = data;
    setCompletingId(task.id);
    setActionError("");
    setData((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }));
    try {
      await getApi().completeTask(task.id);
    } catch (value) {
      setData(previous);
      setActionError(value instanceof Error ? value.message : "Unable to complete this task.");
    } finally {
      setCompletingId(null);
    }
  };

  if (authLoading) return <SafeAreaView style={styles.page}><LoadingState /></SafeAreaView>;
  if (!authenticated) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to projects" accessibilityRole="button" hitSlop={12} onPress={router.back} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>PROJECT</Text><Text style={styles.heading}>{data.project?.name ?? "Details"}</Text></View>
      </View>
      {loading && !data.project ? <LoadingState /> : null}
      {!loading && error && !data.project ? <StateMessage title="Couldn’t load project" detail={error} action={() => void reload()} /> : null}
      {data.project ? (
        <FlatList
          data={data.tasks}
          keyExtractor={(task) => task.id}
          refreshing={refreshing}
          onRefresh={() => void reload(true)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<ProjectSummary project={data.project} taskCount={data.tasks.length} error={actionError || error} />}
          ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>All clear</Text><Text style={styles.muted}>There are no active tasks in this project.</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.taskCard}>
              <Pressable accessibilityLabel={`Complete ${item.title}`} accessibilityRole="button" disabled={completingId !== null} hitSlop={8} onPress={() => void complete(item)} style={styles.complete}>{completingId === item.id ? <ActivityIndicator color={colors.primary} size="small" /> : null}</Pressable>
              <View style={styles.taskCopy}><Text style={styles.taskTitle}>{item.title}</Text><Text style={styles.meta}>{item.status} • {item.priority} priority</Text></View>
            </View>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ProjectSummary({ project, taskCount, error }: { project: Project; taskCount: number; error: string }) {
  return <><View style={styles.projectCard}><View style={styles.projectTitleRow}><View style={[styles.projectColor, { backgroundColor: project.color || colors.primary }]} /><Text style={styles.projectName}>{project.name}</Text></View><View style={styles.statusPill}><Text style={styles.statusText}>{project.status}</Text></View>{project.description ? <Text style={styles.description}>{project.description}</Text> : <Text style={styles.muted}>No description added.</Text>}{project.dueDate ? <Text style={styles.due}>Due {project.dueDate}</Text> : null}</View>{error ? <Text style={styles.inlineError}>{error}</Text> : null}<View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Active tasks</Text><Text style={styles.taskCount}>{taskCount}</Text></View></>;
}
function LoadingState() { return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading project…</Text></View>; }
function StateMessage({ title, detail, action }: { title: string; detail: string; action: () => void }) { return <View style={styles.center}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateDetail}>{detail}</Text><Pressable accessibilityRole="button" onPress={action} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View>; }

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
  inlineError: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.sm, color: colors.danger, backgroundColor: "#FEF3F2" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  sectionTitle: { ...typography.sectionTitle, color: colors.text },
  taskCount: { ...typography.caption, minWidth: 28, paddingVertical: spacing.xxs, textAlign: "center", borderRadius: radii.pill, overflow: "hidden", color: colors.primary, backgroundColor: colors.primarySoft },
  taskCard: { ...elevation.card, minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.sm, backgroundColor: colors.surface },
  complete: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 2, borderColor: colors.primary },
  taskCopy: { flex: 1 },
  taskTitle: { ...typography.cardTitle, color: colors.text },
  meta: { ...typography.metadata, marginTop: spacing.xxs, color: colors.muted, textTransform: "capitalize" },
  emptyCard: { alignItems: "center", gap: spacing.xs, padding: spacing.xl, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { ...typography.sectionTitle, color: colors.text },
  muted: { ...typography.body, color: colors.muted, textAlign: "center" },
  stateTitle: { ...typography.sectionTitle, color: colors.text },
  stateDetail: { ...typography.body, color: colors.danger, textAlign: "center" },
  primaryButton: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryButtonText: { ...typography.button, color: "white" },
});
