import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Sign in", headerShown: false }} />
      <Stack.Screen name="tasks" options={{ title: "My tasks", headerBackVisible: false }} />
    </Stack>
  );
}
