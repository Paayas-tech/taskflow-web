import { useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthProvider";
import { colors, elevation, radii, spacing, typography } from "../../src/ui/theme";

export default function SettingsScreen() {
  const { authenticated, email, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const signOut = async () => {
    setLoading(true); setError("");
    try { await logout(); }
    catch (value) { setError(value instanceof Error ? value.message : "Unable to log out."); setLoading(false); }
  };

  if (!authenticated) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{email?.slice(0, 1).toUpperCase() || "?"}</Text></View>
          <View style={styles.accountCopy}><Text style={styles.label}>Signed in as</Text><Text numberOfLines={2} style={styles.email}>{email || "Email unavailable"}</Text></View>
        </View>
        <View style={styles.sessionCard}><View><Text style={styles.sessionTitle}>Session</Text><Text style={styles.sessionDetail}>Secure session is active on this device</Text></View><View style={styles.activePill}><View style={styles.activeDot} /><Text style={styles.activeText}>Active</Text></View></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.logout, pressed && styles.pressed, loading && styles.disabled]} disabled={loading} onPress={() => void signOut()}>{loading ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.logoutText}>Log out</Text>}</Pressable>
        <Text style={styles.footnote}>Logging out removes the saved TaskFlow session from this device.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.lg, paddingBottom: 40 },
  title: { ...typography.screenTitle, marginBottom: spacing.xl, color: colors.text },
  card: { ...elevation.card, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface },
  avatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primary },
  avatarText: { fontSize: 18, fontWeight: "700", color: "white" },
  accountCopy: { flex: 1 },
  label: { ...typography.metadata, color: colors.muted },
  email: { ...typography.cardTitle, color: colors.text },
  sessionCard: { ...elevation.card, minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface },
  sessionTitle: { ...typography.cardTitle, color: colors.text },
  sessionDetail: { ...typography.metadata, color: colors.muted },
  activePill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: "#EAF8F2" },
  activeDot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.success },
  activeText: { ...typography.caption, color: colors.success },
  error: { marginTop: spacing.md, padding: spacing.md, borderRadius: radii.sm, color: colors.danger, backgroundColor: "#FEF3F2" },
  logout: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#F3B7B2" },
  logoutText: { ...typography.button, color: colors.danger },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.55 },
  footnote: { ...typography.metadata, marginTop: spacing.sm, paddingHorizontal: spacing.md, textAlign: "center", color: colors.muted },
});
