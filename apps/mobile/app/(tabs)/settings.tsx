import { useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";

export default function SettingsScreen() {
  const { authenticated, email, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const signOut = async () => {
    setLoading(true);
    setError("");
    try {
      await logout();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to log out.");
      setLoading(false);
    }
  };

  if (!authenticated) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email}>{email || "Email unavailable"}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={signOut}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log out</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 24 },
  title: { marginTop: 20, fontSize: 30, fontWeight: "700", color: "#172033" },
  card: { marginTop: 24, padding: 22, borderRadius: 16, backgroundColor: "white" },
  label: { fontSize: 14, color: "#667085" },
  email: { marginTop: 6, fontSize: 17, fontWeight: "600", color: "#172033" },
  error: { marginTop: 14, color: "#b42318" },
  button: { marginTop: 24, alignItems: "center", borderRadius: 10, padding: 15, backgroundColor: "#4f46e5" },
  disabled: { opacity: 0.65 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
});
