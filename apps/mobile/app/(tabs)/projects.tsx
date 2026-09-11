import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function ProjectsScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.title}>Projects</Text>
        <View style={styles.card}>
          <Text style={styles.comingSoon}>Coming soon</Text>
          <Text style={styles.description}>Project management will be added in a future mobile checkpoint.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 24 },
  title: { marginTop: 20, fontSize: 30, fontWeight: "700", color: "#172033" },
  card: { marginTop: 24, padding: 24, borderRadius: 16, backgroundColor: "white" },
  comingSoon: { fontSize: 20, fontWeight: "600", color: "#172033" },
  description: { marginTop: 10, fontSize: 16, lineHeight: 23, color: "#667085" },
});
