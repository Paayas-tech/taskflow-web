import { useCallback, useState } from "react";
import { Redirect, type Href } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { colors, elevation, radii, spacing, typography } from "../src/ui/theme";
import { WelcomeSplash } from "../src/ui/WelcomeSplash";

export default function LoginScreen() {
  const { authenticated, loading: authLoading, login: signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const finishWelcome = useCallback(() => setShowWelcome(false), []);

  const login = async () => {
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <SafeAreaView style={styles.page}><ActivityIndicator size="large" /></SafeAreaView>;
  }

  if (authenticated) {
    return <Redirect href={"/(tabs)" as Href} />;
  }

  if (showWelcome) return <WelcomeSplash onComplete={finishWelcome} />;

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <View style={styles.mark}><Text style={styles.markText}>✓</Text></View>
        <Text style={styles.title}>TaskFlow</Text>
        <Text style={styles.subtitle}>Sign in to focus on what matters.</Text>
        <TextInput accessibilityLabel="Email" style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" />
        <TextInput accessibilityLabel="Password" style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]} disabled={loading} onPress={login}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.background },
  card: { ...elevation.card, gap: spacing.md, padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface },
  mark: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.primary },
  markText: { fontSize: 21, fontWeight: "700", color: "white" },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.body, marginBottom: spacing.sm, color: colors.muted },
  input: { ...typography.body, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.background },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.78 },
  buttonText: { ...typography.button, color: "white" },
  error: { ...typography.body, color: colors.danger },
});
