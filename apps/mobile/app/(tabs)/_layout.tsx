import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, type ColorValue, SafeAreaView, StyleSheet, Text } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";

const tabIcon = (symbol: string, color: ColorValue) => (
  <Text style={[styles.icon, { color }]}>{symbol}</Text>
);

export default function TabLayout() {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" /></SafeAreaView>;
  }

  if (!authenticated) return <Redirect href="/" />;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#4f46e5", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => tabIcon("⌂", color) }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks", tabBarIcon: ({ color }) => tabIcon("✓", color) }} />
      <Tabs.Screen name="projects" options={{ title: "Projects", tabBarIcon: ({ color }) => tabIcon("▦", color) }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => tabIcon("⚙", color) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 20, fontWeight: "700" },
});
