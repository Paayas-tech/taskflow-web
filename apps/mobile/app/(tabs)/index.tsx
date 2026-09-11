import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { getApi } from "../../src/lib/api";

export default function HomeScreen() {
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCount = useCallback(async () => {
    setLoading(true);
    try {
      setTaskCount((await getApi().getTasks()).length);
    } catch {
      setTaskCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.title}>TaskFlow</Text>
        <Text style={styles.welcome}>Welcome back. Keep your work moving.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Active tasks</Text>
          {loading ? <ActivityIndicator style={styles.activity} /> : <Text style={styles.count}>{taskCount ?? "Unavailable"}</Text>}
          {!loading && taskCount === null ? (
            <Pressable onPress={loadCount}><Text style={styles.retry}>Try again</Text></Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 24, gap: 12 },
  title: { marginTop: 20, fontSize: 34, fontWeight: "700", color: "#172033" },
  welcome: { fontSize: 17, lineHeight: 24, color: "#667085" },
  card: { marginTop: 20, padding: 22, borderRadius: 16, backgroundColor: "white" },
  label: { fontSize: 15, color: "#667085" },
  count: { marginTop: 8, fontSize: 30, fontWeight: "700", color: "#172033" },
  activity: { marginTop: 16, alignSelf: "flex-start" },
  retry: { marginTop: 12, color: "#4f46e5", fontWeight: "600" },
});
