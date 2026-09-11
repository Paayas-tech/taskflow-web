import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { Task } from "@taskflow/domain";
import { getApi } from "../../src/lib/api";

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(await getApi().getTasks());
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}><Text style={styles.heading}>Tasks</Text></View>
      {loading ? <ActivityIndicator style={styles.center} size="large" /> : null}
      {!loading && error ? (
        <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={loadTasks}><Text style={styles.retry}>Try again</Text></Pressable></View>
      ) : null}
      {!loading && !error ? (
        <FlatList
          data={tasks}
          keyExtractor={(task) => task.id}
          refreshing={loading}
          onRefresh={loadTasks}
          contentContainerStyle={tasks.length ? styles.list : styles.center}
          ListEmptyComponent={<Text style={styles.empty}>No tasks yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.task}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.status} · {item.priority}</Text>
            </View>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f6fb" },
  header: { padding: 20 },
  heading: { fontSize: 28, fontWeight: "700", color: "#172033" },
  list: { padding: 16, gap: 12 },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  task: { padding: 16, borderRadius: 12, backgroundColor: "white" },
  taskTitle: { fontSize: 17, fontWeight: "600", color: "#172033" },
  meta: { marginTop: 6, color: "#667085", textTransform: "capitalize" },
  error: { color: "#b42318", textAlign: "center" },
  retry: { color: "#4f46e5", fontWeight: "600" },
  empty: { color: "#667085" },
});
