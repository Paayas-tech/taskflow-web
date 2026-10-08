import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing, typography } from "./theme";

const messages = [
  "Orchestrating engineering workflows…",
  "Streamlining sprints & delivery…",
  "Turning plans into progress…",
];

export function WelcomeSplash({ onComplete }: { onComplete: () => void }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, damping: 9, stiffness: 110, useNativeDriver: true }).start();
    const ticker = setInterval(() => setMessageIndex((value) => (value + 1) % messages.length), 650);
    const fade = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => finished && onComplete());
    }, 1800);
    return () => {
      clearInterval(ticker);
      clearTimeout(fade);
    };
  }, [onComplete, opacity, scale]);

  return (
    <SafeAreaView style={styles.page} accessibilityLabel="Welcome to TaskFlow">
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}> 
        <View style={styles.mark}><Text style={styles.check}>✓</Text></View>
        <Text style={styles.title}>TaskFlow</Text>
        <Text style={styles.message}>{messages[messageIndex]}</Text>
        <View style={styles.track}><View style={styles.progress} /></View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background },
  content: { width: "100%", alignItems: "center" },
  mark: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderRadius: radii.lg, backgroundColor: colors.primary },
  check: { fontSize: 34, fontWeight: "700", color: "white" },
  title: { ...typography.screenTitle, marginTop: spacing.xl, fontSize: 38, lineHeight: 44, color: colors.text },
  message: { ...typography.body, minHeight: 24, marginTop: spacing.md, color: colors.muted, textAlign: "center" },
  track: { width: 230, height: 3, marginTop: spacing.xxl, overflow: "hidden", borderRadius: radii.pill, backgroundColor: colors.border },
  progress: { width: "44%", height: "100%", borderRadius: radii.pill, backgroundColor: colors.primary },
});
