import { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getApi } from "../src/lib/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    setError("");
    try {
      await getApi().login(email, password);
      router.replace("/tasks");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>TaskFlow</Text>
        <Text style={styles.subtitle}>Sign in to see your tasks</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={login}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f4f6fb" },
  card: { gap: 14, padding: 24, borderRadius: 18, backgroundColor: "white" },
  title: { fontSize: 32, fontWeight: "700", color: "#172033" },
  subtitle: { marginBottom: 8, fontSize: 16, color: "#667085" },
  input: { borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 10, padding: 14, fontSize: 16 },
  button: { alignItems: "center", borderRadius: 10, padding: 15, backgroundColor: "#4f46e5" },
  disabled: { opacity: 0.65 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  error: { color: "#b42318" },
});
