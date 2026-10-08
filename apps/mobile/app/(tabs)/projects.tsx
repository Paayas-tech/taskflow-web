import { useCallback } from "react";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Project } from "@taskflow/domain";
import { useAuth } from "../../src/auth/AuthProvider";
import { useAsyncResource } from "../../src/hooks/useAsyncResource";
import { getApi } from "../../src/lib/api";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";
import { AppHeader } from "../../src/ui/AppHeader";
import { useTheme } from "../../src/ui/ThemeProvider";

export default function ProjectsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { userId } = useAuth();
  const loader = useCallback(async () => {
    const projects = await getApi().getProjects();
    return Promise.all(projects.map(async (project) => ({ project, taskCount: (await getApi().getProjectTasks(project.id)).length })));
  }, []);
  const { data: projects, error, loading, refreshing, reload } = useAsyncResource(loader, [], "Unable to load projects.");

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <AppHeader title="Projects" subtitle={`${projects.length} active workspaces`} onAdd={() => Alert.alert("New project", "Project creation is available from the web and desktop workspace.")} />
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading projects…</Text></View> : null}
      {!loading && error && projects.length === 0 ? <StateMessage detail={error} action={() => void reload()} /> : null}
      {(!loading || projects.length > 0) && !(error && projects.length === 0) ? (
        <FlatList
          data={projects}
          keyExtractor={({ project }) => project.id}
          refreshing={refreshing}
          onRefresh={() => void reload(true)}
          contentContainerStyle={projects.length ? styles.list : styles.center}
          ListHeaderComponent={error ? <Text style={styles.inlineError}>{error}</Text> : null}
          ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptySymbol}>▦</Text></View><Text style={styles.emptyTitle}>No projects yet</Text><Text style={styles.muted}>Projects you own or collaborate on will appear here.</Text></View>}
          renderItem={({ item: { project, taskCount } }) => (
            <Pressable accessibilityHint="Opens project details and tasks" accessibilityRole="button" onPress={() => router.push(`/project/${project.id}` as Href)} style={({ pressed }) => [styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, pressed && styles.pressed]}>
              <View style={[styles.projectIcon, { backgroundColor: `${project.color || colors.primary}18` }]}><View style={[styles.projectDot, { backgroundColor: project.color || colors.primary }]} /></View>
              <View style={styles.cardCopy}><View style={styles.nameRow}><Text numberOfLines={1} style={[styles.name, { color: theme.colors.text }]}>{project.name}</Text><View style={[styles.badge, { backgroundColor: theme.colors.primarySoft }]}><Text style={[styles.badgeText, { color: theme.colors.primary }]}>{project.ownerId === userId ? "Owner" : "Member"}</Text></View></View><Text numberOfLines={2} style={[styles.description, { color: theme.colors.muted }]}>{project.description || "No description added"}</Text><Text style={[styles.status, { color: theme.colors.muted }]}>{taskCount} active {taskCount === 1 ? "task" : "tasks"}</Text></View>
              <View style={styles.open}><Text style={styles.chevron}>›</Text></View>
            </Pressable>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

function StateMessage({ detail, action }: { detail: string; action: () => void }) { return <View style={styles.center}><Text style={styles.stateTitle}>Couldn’t load projects</Text><Text style={styles.error}>{detail}</Text><Pressable accessibilityRole="button" onPress={action} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.metadata, marginTop: spacing.xxs, color: colors.muted },
  newButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 13, borderRadius: radii.pill, backgroundColor: colors.primary }, newButtonText: { ...typography.caption, color: "#FFFFFF" },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: 40, gap: spacing.sm },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  card: { ...elevation.card, minHeight: 104, flexDirection: "row", alignItems: "center", padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface },
  pressed: { opacity: 0.62, transform: [{ scale: 0.99 }] },
  projectIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radii.sm }, projectDot: { width: 14, height: 14, borderRadius: 4 },
  cardCopy: { flex: 1, minWidth: 0, justifyContent: "center", paddingLeft: spacing.md }, nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { ...typography.cardTitle, flex: 1, color: colors.textSoft }, badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: colors.primarySoft }, badgeText: { fontSize: 11, fontWeight: "600", color: colors.primary },
  status: { ...typography.metadata, marginTop: spacing.sm, color: colors.muted },
  description: { ...typography.metadata, marginTop: spacing.xxs, color: colors.muted },
  open: { width: 44, alignItems: "center", justifyContent: "center" },
  chevron: { fontSize: 21, color: colors.muted },
  empty: { alignItems: "center", gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  emptySymbol: { fontSize: 28, color: colors.primary },
  emptyTitle: { ...typography.sectionTitle, color: colors.text },
  muted: { ...typography.body, color: colors.muted, textAlign: "center" },
  stateTitle: { ...typography.sectionTitle, color: colors.text },
  error: { ...typography.body, color: colors.danger, textAlign: "center" },
  inlineError: { marginBottom: spacing.sm, padding: spacing.md, borderRadius: radii.sm, color: colors.danger, backgroundColor: "#FEF3F2" },
  button: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.sm, backgroundColor: colors.primary },
  buttonText: { ...typography.button, color: "white" },
});
