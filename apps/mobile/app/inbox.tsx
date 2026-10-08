import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAsyncResource } from "../src/hooks/useAsyncResource";
import { getApi, type NotificationItem } from "../src/lib/api";
import { AppHeader } from "../src/ui/AppHeader";
import { spacing, typography } from "../src/ui/theme";
import { useTheme } from "../src/ui/ThemeProvider";

export default function InboxScreen() {
  const { colors } = useTheme();
  const loader = useCallback(() => getApi().getNotifications(), []);
  const { data, loading, refreshing, reload, setData, error } = useAsyncResource<NotificationItem[]>(loader, [], "Unable to load inbox.");
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const unread = data.filter((item) => !item.read_at).length;
  const markRead = async (item: NotificationItem) => { if (item.read_at) return; const saved = await getApi().markNotificationRead(item.id); setData((current) => current.map((entry) => entry.id === item.id ? saved : entry)); };
  const markAll = async () => { await getApi().markAllNotificationsRead(); const now = new Date().toISOString(); setData((current) => current.map((item) => ({ ...item, read_at: item.read_at || now }))); };
  return <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]}><AppHeader back title="Inbox" subtitle={unread ? `${unread} unread updates` : "You're all caught up"} />
    {unread ? <Pressable onPress={() => void markAll()} style={styles.markAll}><Text style={[styles.markAllText, { color: colors.primary }]}>Mark all as read</Text></Pressable> : null}
    {loading && !data.length ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <FlatList data={data} keyExtractor={(item) => item.id} refreshing={refreshing} onRefresh={() => void reload(true)} contentContainerStyle={data.length ? styles.list : styles.center} ListHeaderComponent={error ? <Text style={{ color: colors.danger }}>{error}</Text> : null} ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyIcon, { color: colors.primary }]}>✓</Text><Text style={[styles.emptyTitle, { color: colors.text }]}>You're all caught up</Text><Text style={[styles.meta, { color: colors.muted }]}>New assignments, mentions, and workspace activity will appear here.</Text></View>} renderItem={({ item }) => <Pressable onPress={() => void markRead(item)} style={[styles.row, { borderBottomColor: colors.border, backgroundColor: item.read_at ? colors.background : colors.surface }]}><View style={[styles.dot, { backgroundColor: item.read_at ? "transparent" : colors.primary }]} /><View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{item.title || item.type || "Workspace update"}</Text><Text style={[styles.meta, { color: colors.muted }]}>{item.message || item.body || "TaskFlow activity"}</Text><Text style={[styles.time, { color: colors.faint }]}>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</Text></View></Pressable>} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, markAll: { alignSelf: "flex-end", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }, markAllText: { ...typography.metadata, fontWeight: "600" }, list: { paddingHorizontal: spacing.md, paddingBottom: 40 }, center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }, row: { minHeight: 74, flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth }, dot: { width: 7, height: 7, marginTop: 7, borderRadius: 4 }, copy: { flex: 1 }, title: { ...typography.cardTitle }, meta: { ...typography.metadata, marginTop: 3 }, time: { ...typography.caption, marginTop: spacing.xs, fontWeight: "400" }, empty: { alignItems: "center", maxWidth: 300 }, emptyIcon: { fontSize: 30, marginBottom: spacing.md }, emptyTitle: { ...typography.sectionTitle, marginBottom: spacing.xs } });
