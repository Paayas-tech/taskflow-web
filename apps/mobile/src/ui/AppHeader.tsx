import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getApi } from "../lib/api";
import { radii, spacing, typography } from "./theme";
import { useTheme } from "./ThemeProvider";
import { GlobalSearchModal } from "./GlobalSearchModal";

export function AppHeader({ title, subtitle, onAdd, back }: { title: string; subtitle?: string; onAdd?: () => void; back?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => { void getApi().getNotifications().then((items) => setUnread(items.filter((item) => !item.read_at).length)).catch(() => undefined); }, []);
  return <>
    <View style={[styles.bar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      {back ? <Pressable accessibilityLabel="Go back" hitSlop={10} onPress={router.back} style={styles.back}><Text style={[styles.backText, { color: colors.text }]}>‹</Text></Pressable> : null}
      <View style={styles.copy}><Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}</View>
      <Pressable accessibilityLabel="Search" hitSlop={8} onPress={() => setSearchOpen(true)} style={styles.iconButton}><Text style={[styles.icon, { color: colors.textSoft }]}>⌕</Text></Pressable>
      <Pressable accessibilityLabel="Inbox" hitSlop={8} onPress={() => router.push("/inbox" as Href)} style={styles.iconButton}><Text style={[styles.icon, { color: colors.textSoft }]}>♢</Text>{unread ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}</Pressable>
      {onAdd ? <Pressable accessibilityLabel="Quick add" hitSlop={8} onPress={onAdd} style={[styles.add, { backgroundColor: colors.primary }]}><Text style={styles.addText}>＋</Text></Pressable> : null}
    </View>
    <GlobalSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
  </>;
}

const styles = StyleSheet.create({
  bar: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 34, alignItems: "flex-start" }, backText: { fontSize: 29, lineHeight: 32 },
  copy: { flex: 1, minWidth: 0 }, title: { ...typography.cardTitle, letterSpacing: -0.2 }, subtitle: { ...typography.metadata, marginTop: 1 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, icon: { fontSize: 23, lineHeight: 27 },
  dot: { position: "absolute", right: 7, top: 7, width: 7, height: 7, borderRadius: 4 },
  add: { width: 34, height: 34, alignItems: "center", justifyContent: "center", marginLeft: 2, borderRadius: radii.sm }, addText: { fontSize: 21, lineHeight: 23, color: "#FFFFFF" },
});
