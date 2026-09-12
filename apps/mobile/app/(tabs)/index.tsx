import { useCallback } from "react";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Task } from "@taskflow/domain";
import { getApi } from "../../src/lib/api";
import { useAsyncResource } from "../../src/hooks/useAsyncResource";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";

export default function HomeScreen() {
  const router = useRouter();
  const loader = useCallback(() => getApi().getTasks(), []);
  const { data: tasks, error, loading, refreshing, reload } = useAsyncResource<Task[]>(loader, [], "Unable to load your summary.");

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload(true)} tintColor={colors.primary} colors={[colors.primary]} />}>
        <Text style={styles.title}>TaskFlow</Text>
        <Text style={styles.welcome}>Today</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}><Text style={styles.summarySymbol}>✓</Text></View>
          <View style={styles.summaryCopy}><Text style={styles.summaryLabel}>Active tasks</Text><Text style={styles.summaryDetail}>{tasks.length === 0 && !loading ? "You’re all caught up" : "Ready when you are"}</Text></View>
          {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.count}>{tasks.length}</Text>}
        </View>
        {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void reload()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
        {!loading && !error && tasks.length > 0 ? <View style={styles.preview}><Text style={styles.sectionTitle}>Up next</Text><View style={styles.previewList}>{tasks.slice(0, 3).map((task, index) => <View key={task.id} style={[styles.previewRow, index < Math.min(tasks.length, 3) - 1 && styles.divider]}><View style={styles.taskDot} /><Text numberOfLines={1} style={styles.previewTitle}>{task.title}</Text></View>)}</View></View> : null}
        <Text style={styles.sectionTitle}>Browse</Text>
        <View style={styles.actions}>
          <Action title="All tasks" detail="Review and complete work" symbol="✓" onPress={() => router.push("/(tabs)/tasks" as Href)} />
          <Action title="Projects" detail="Browse project work" symbol="▦" onPress={() => router.push("/(tabs)/projects" as Href)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ title, detail, symbol, onPress }: { title: string; detail: string; symbol: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Text style={styles.actionSymbol}>{symbol}</Text></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: spacing.lg, paddingBottom: 40 },
  title: { ...typography.screenTitle, color: colors.text },
  welcome: { ...typography.body, marginTop: spacing.xxs, color: colors.muted },
  summaryCard: { ...elevation.card, minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface },
  summaryIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primary },
  summarySymbol: { fontSize: 17, fontWeight: "700", color: "white" },
  summaryCopy: { flex: 1 },
  summaryLabel: { ...typography.cardTitle, color: colors.text },
  summaryDetail: { ...typography.metadata, color: colors.muted },
  count: { fontSize: 25, lineHeight: 30, fontWeight: "700", color: colors.primary },
  errorCard: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: "#FFF1F0" },
  error: { ...typography.body, color: colors.danger },
  retry: { ...typography.button, marginTop: spacing.xs, color: colors.primary },
  preview: { marginTop: spacing.sm },
  sectionTitle: { ...typography.caption, marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.xs, letterSpacing: 0.4, color: colors.muted, textTransform: "uppercase" },
  previewList: { overflow: "hidden", borderRadius: radii.md, backgroundColor: colors.surface },
  previewRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  taskDot: { width: 12, height: 12, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.primary },
  previewTitle: { ...typography.body, flex: 1, color: colors.text },
  actions: { overflow: "hidden", borderRadius: radii.md, backgroundColor: colors.surface },
  action: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { opacity: 0.65 },
  actionIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  actionSymbol: { fontSize: 16, fontWeight: "700", color: colors.primary },
  actionCopy: { flex: 1 },
  actionTitle: { ...typography.cardTitle, color: colors.text },
  actionDetail: { ...typography.metadata, color: colors.muted },
  chevron: { fontSize: 21, color: colors.muted },
});
