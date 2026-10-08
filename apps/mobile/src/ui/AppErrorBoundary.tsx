import { Component, type ErrorInfo, type ReactNode } from "react";
import { DevSettings, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "./theme";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TaskFlow mobile render failure:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <View style={styles.page}><View style={styles.mark}><Text style={styles.markText}>!</Text></View><Text style={styles.title}>TaskFlow couldn’t start</Text><Text style={styles.detail}>{this.state.error.message || "An unexpected interface error occurred."}</Text><Pressable accessibilityRole="button" onPress={() => DevSettings.reload()} style={styles.button}><Text style={styles.buttonText}>Reload app</Text></Pressable></View>;
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, backgroundColor: colors.background },
  mark: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.dangerSoft },
  markText: { fontSize: 24, fontWeight: "700", color: colors.danger }, title: { ...typography.sectionTitle, marginTop: spacing.lg, color: colors.text, textAlign: "center" },
  detail: { ...typography.body, marginTop: spacing.sm, color: colors.muted, textAlign: "center" }, button: { minHeight: 46, justifyContent: "center", marginTop: spacing.xl, paddingHorizontal: spacing.xl, borderRadius: radii.sm, backgroundColor: colors.primary }, buttonText: { ...typography.button, color: "#FFFFFF" },
});
