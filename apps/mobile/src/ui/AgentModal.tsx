import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { AgentMessage } from "@taskflow/domain";
import { getApi } from "../lib/api";
import { colors, elevation, radii, spacing, typography } from "./theme";
import { useTheme } from "./ThemeProvider";

export function AgentModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const content = draft.trim();
    if (!content || loading) return;
    const history = [...messages, { role: "user" as const, content }];
    setDraft("");
    setMessages(history);
    setNotice("");
    setLoading(true);
    try {
      const response = await getApi().askAgent(content, messages);
      setMessages((current) => [...current, { role: "assistant", content: response.message }]);
    } catch (value) {
      setNotice(value instanceof Error ? value.message : "AI Assistant is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}><Text style={[styles.title, { color: theme.colors.text }]}>✦ AI Assistant</Text><Pressable accessibilityRole="button" onPress={onClose}><Text style={[styles.close, { color: theme.colors.primary }]}>Close</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? <Text style={[styles.empty, { color: theme.colors.muted }]}>Ask about your work or request a task update.</Text> : null}
          {messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.bubble, { backgroundColor: message.role === "user" ? theme.colors.primarySoft : theme.colors.surface }]}><Text style={[styles.body, { color: theme.colors.text }]}>{message.content}</Text></View>)}
          {notice ? <View style={[styles.notice, { backgroundColor: theme.colors.warningSoft }]}><Text style={[styles.noticeText, { color: theme.colors.text }]}>{notice}</Text></View> : null}
          {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </ScrollView>
        <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}><TextInput accessibilityLabel="Message AI Assistant" multiline value={draft} onChangeText={setDraft} placeholder="Ask a question…" placeholderTextColor={theme.colors.muted} style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]} /><Pressable accessibilityRole="button" disabled={!draft.trim() || loading} onPress={() => void send()} style={[styles.send, { backgroundColor: theme.colors.primary }, (!draft.trim() || loading) && styles.disabled]}><Text style={styles.sendText}>↑</Text></Pressable></View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: { ...typography.sectionTitle, color: colors.text },
  close: { ...typography.button, color: colors.primary },
  thread: { flexGrow: 1, gap: spacing.sm, padding: spacing.lg },
  empty: { ...typography.body, color: colors.muted, textAlign: "center" },
  bubble: { maxWidth: "88%", padding: spacing.md, borderRadius: radii.md },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.primarySoft },
  assistantBubble: { ...elevation.card, alignSelf: "flex-start", backgroundColor: colors.surface },
  body: { ...typography.body, color: colors.text },
  notice: { padding: spacing.md, borderRadius: radii.md, backgroundColor: "#FFF4E5" },
  noticeText: { ...typography.body, color: colors.text },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { ...typography.body, flex: 1, minWidth: 0, maxHeight: 120, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.text, backgroundColor: colors.background },
  send: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primary },
  disabled: { opacity: 0.45 },
  sendText: { fontSize: 24, color: "white" },
});
