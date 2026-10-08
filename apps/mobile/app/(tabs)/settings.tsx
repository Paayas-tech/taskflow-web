import { type ReactNode, useMemo, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthProvider";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeProvider";

export default function SettingsScreen() {
  const { authenticated, email, name, logout } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState(true);
  const initials = useMemo(() => name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TF", [name]);

  const signOut = async () => {
    setLoading(true); setError("");
    try { await logout(); }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to log out."); setLoading(false); }
  };
  if (!authenticated) return <Redirect href="/" />;

  return <SafeAreaView style={[styles.page, { backgroundColor: theme.colors.background }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
      <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}><Text style={styles.avatarText}>{initials}</Text></View><View style={styles.profileCopy}><Text style={[styles.name, { color: theme.colors.text }]}>{name}</Text><Text numberOfLines={1} style={[styles.email, { color: theme.colors.muted }]}>{email || "Email unavailable"}</Text><Text style={[styles.workspace, { color: theme.colors.primary }]}>TaskFlow workspace</Text></View></View>

      <Text style={styles.groupLabel}>Preferences</Text>
      <View style={[styles.group, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <SettingRow icon="◎" title="Account preferences" detail="Profile and personal details" />
        <SettingRow icon="◐" title="Dark theme" detail="Use a darker app appearance" trailing={<Switch value={theme.dark} onValueChange={theme.toggle} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={theme.dark ? theme.colors.primary : "#FFFFFF"} />} />
        <SettingRow icon="◉" title="Notifications" detail="Task reminders and activity" last trailing={<Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: colors.border, true: "#A5B4FC" }} thumbColor={notifications ? colors.primary : "#FFFFFF"} />} />
      </View>

      <Text style={styles.groupLabel}>Workspace</Text>
      <View style={[styles.group, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <SettingRow icon="▦" title="TaskFlow workspace" detail="Your projects and collaborators" />
        <SettingRow icon="⌁" title="Connected services" detail="Calendar and integrations" last />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.logout, pressed && styles.pressed, loading && styles.disabled]} disabled={loading} onPress={() => void signOut()}>{loading ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.logoutText}>Log out</Text>}</Pressable>
      <Text style={styles.footnote}>TaskFlow mobile · Secure session active</Text>
    </ScrollView>
  </SafeAreaView>;
}

function SettingRow({ icon, title, detail, trailing, last = false }: { icon: string; title: string; detail: string; trailing?: ReactNode; last?: boolean }) {
  const { colors: themed } = useTheme();
  return <Pressable accessibilityRole="button" style={({ pressed }) => [styles.row, !last && styles.rowBorder, { borderBottomColor: themed.border }, pressed && { backgroundColor: themed.subtle }]}><View style={[styles.rowIcon, { backgroundColor: themed.primarySoft }]}><Text style={[styles.rowIconText, { color: themed.primary }]}>{icon}</Text></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: themed.text }]}>{title}</Text><Text style={[styles.rowDetail, { color: themed.muted }]}>{detail}</Text></View>{trailing || <Text style={[styles.chevron, { color: themed.faint }]}>›</Text>}</Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, paddingBottom: 48 }, title: { ...typography.screenTitle, marginBottom: spacing.lg, color: colors.text },
  profileCard: { ...elevation.card, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface },
  avatar: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primary }, avatarText: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" }, profileCopy: { flex: 1, minWidth: 0 }, name: { ...typography.sectionTitle, color: colors.textSoft }, email: { ...typography.metadata, marginTop: 2, color: colors.muted }, workspace: { ...typography.caption, marginTop: spacing.xs, color: colors.primary },
  groupLabel: { ...typography.caption, marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.7 }, group: { ...elevation.card, overflow: "hidden", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md }, rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowPressed: { backgroundColor: colors.subtle }, rowIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primarySoft }, rowIconText: { fontSize: 16, fontWeight: "700", color: colors.primary }, rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { ...typography.cardTitle, color: colors.textSoft }, rowDetail: { ...typography.metadata, color: colors.muted }, chevron: { fontSize: 22, color: colors.faint },
  error: { marginTop: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: "#FECDD3", borderRadius: radii.sm, color: colors.danger, backgroundColor: colors.dangerSoft }, logout: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, borderWidth: 1, borderColor: "#FDA4AF", borderRadius: radii.sm, backgroundColor: colors.dangerSoft }, logoutText: { ...typography.button, color: colors.danger }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.5 }, footnote: { ...typography.metadata, marginTop: spacing.md, textAlign: "center", color: colors.faint },
});
