import { useCallback } from "react";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Project } from "@taskflow/domain";
import { useAsyncResource } from "../../src/hooks/useAsyncResource";
import { getApi } from "../../src/lib/api";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";

export default function ProjectsScreen() {
  const router = useRouter();
  const loader = useCallback(() => getApi().getProjects(), []);
  const { data: projects, error, loading, refreshing, reload } = useAsyncResource<Project[]>(loader, [], "Unable to load projects.");

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}><Text style={styles.title}>Projects</Text><Text style={styles.subtitle}>{projects.length} available</Text></View>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading projects…</Text></View> : null}
      {!loading && error && projects.length === 0 ? <StateMessage detail={error} action={() => void reload()} /> : null}
      {(!loading || projects.length > 0) && !(error && projects.length === 0) ? (
        <FlatList
          data={projects}
          keyExtractor={(project) => project.id}
          refreshing={refreshing}
          onRefresh={() => void reload(true)}
          contentContainerStyle={projects.length ? styles.list : styles.center}
          ListHeaderComponent={error ? <Text style={styles.inlineError}>{error}</Text> : null}
          ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptySymbol}>▦</Text></View><Text style={styles.emptyTitle}>No projects yet</Text><Text style={styles.muted}>Projects you own or collaborate on will appear here.</Text></View>}
          renderItem={({ item }) => (
            <Pressable accessibilityHint="Opens project details and tasks" accessibilityRole="button" onPress={() => router.push(`/project/${item.id}` as Href)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={[styles.colorBar, { backgroundColor: item.color || colors.primary }]} />
              <View style={styles.cardCopy}><Text style={styles.name}>{item.name}</Text><Text style={styles.status}>{item.status}</Text>{item.description ? <Text numberOfLines={2} style={styles.description}>{item.description}</Text> : null}</View>
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
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.metadata, marginTop: spacing.xxs, color: colors.muted },
  list: { padding: spacing.md, paddingTop: spacing.xs, paddingBottom: 40, gap: spacing.xs },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  card: { ...elevation.card, minHeight: 62, flexDirection: "row", alignItems: "stretch", overflow: "hidden", borderRadius: radii.sm, backgroundColor: colors.surface },
  pressed: { opacity: 0.62, transform: [{ scale: 0.99 }] },
  colorBar: { width: 5 },
  cardCopy: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  name: { ...typography.cardTitle, color: colors.text },
  status: { ...typography.metadata, color: colors.muted, textTransform: "capitalize" },
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
