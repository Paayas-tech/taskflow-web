import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, type ColorValue, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthProvider";
import { useTheme } from "../../src/ui/ThemeProvider";

const tabIcon = (symbol: string, color: ColorValue) => (
  <Text style={[styles.icon, { color }]}>{symbol}</Text>
);

export default function TabLayout() {
  const { authenticated, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return <SafeAreaView style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} size="large" /></SafeAreaView>;
  }

  if (!authenticated) return <Redirect href="/" />;

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: styles.label,
      tabBarStyle: [styles.bar, { borderTopColor: colors.border, backgroundColor: colors.surface }],
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => tabIcon("⌂", color) }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks", tabBarIcon: ({ color }) => tabIcon("✓", color) }} />
      <Tabs.Screen name="projects" options={{ title: "Projects", tabBarIcon: ({ color }) => tabIcon("▦", color) }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => tabIcon("●", color) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 11, fontWeight: "600", marginBottom: 5 },
  bar: { height: 64, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, shadowColor: "#0F172A", shadowOpacity: 0.03, shadowRadius: 4 },
});
