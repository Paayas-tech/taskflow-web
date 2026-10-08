import { Stack } from "expo-router";
import { AuthProvider } from "../src/auth/AuthProvider";
import { AppErrorBoundary } from "../src/ui/AppErrorBoundary";
import { ThemeProvider } from "../src/ui/ThemeProvider";

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <ThemeProvider><AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="tasks" />
          <Stack.Screen name="project/[projectId]" />
          <Stack.Screen name="inbox" />
          <Stack.Screen name="calendar" />
        </Stack>
      </AuthProvider></ThemeProvider>
    </AppErrorBoundary>
  );
}
