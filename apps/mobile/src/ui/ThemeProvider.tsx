import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { StatusBar, useColorScheme } from "react-native";
import { darkColors, lightColors, type ThemeColors } from "./theme";

type ThemeMode = "light" | "dark";
interface ThemeValue { mode: ThemeMode; dark: boolean; colors: ThemeColors; setMode: (mode: ThemeMode) => void; toggle: () => void; ready: boolean; }
const STORAGE_KEY = "taskflow.theme";
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(system === "dark" ? "dark" : "light");
  const [ready, setReady] = useState(false);
  useEffect(() => { void AsyncStorage.getItem(STORAGE_KEY).then((saved: string | null) => {
    if (saved === "dark" || saved === "light") setModeState(saved);
  }).catch((error) => console.warn("Unable to restore theme preference:", error)).finally(() => setReady(true)); }, []);
  const setMode = (next: ThemeMode) => { setModeState(next); void AsyncStorage.setItem(STORAGE_KEY, next).catch((error) => console.warn("Unable to save theme preference:", error)); };
  const value = useMemo<ThemeValue>(() => ({ mode, dark: mode === "dark", colors: mode === "dark" ? darkColors : lightColors, setMode, toggle: () => setMode(mode === "dark" ? "light" : "dark"), ready }), [mode, ready]);
  return <ThemeContext.Provider value={value}><StatusBar barStyle={value.dark ? "light-content" : "dark-content"} backgroundColor={value.colors.background} />{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider.");
  return value;
}
