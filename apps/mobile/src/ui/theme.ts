import { StyleSheet } from "react-native";

export const lightColors = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSoft: "#1E293B",
  muted: "#64748B",
  faint: "#94A3B8",
  subtle: "#F1F5F9",
  border: "#E2E8F0",
  primary: "#4F46E5",
  primaryPressed: "#4338CA",
  primarySoft: "#EEF2FF",
  success: "#059669",
  successSoft: "#ECFDF5",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  danger: "#E11D48",
  dangerSoft: "#FFF1F2",
} as const;

export const darkColors = {
  background: "#090D16",
  surface: "#131B2E",
  text: "#F8FAFC",
  textSoft: "#E2E8F0",
  muted: "#94A3B8",
  faint: "#64748B",
  subtle: "#182238",
  border: "#26334A",
  primary: "#818CF8",
  primaryPressed: "#6366F1",
  primarySoft: "#202A4C",
  success: "#34D399",
  successSoft: "#102E29",
  warning: "#FBBF24",
  warningSoft: "#332810",
  danger: "#FB7185",
  dangerSoft: "#351722",
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };
// Kept for non-render utilities; visual components should consume useTheme().colors.
export const colors = lightColors;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  sm: 6,
  md: 9,
  lg: 12,
  pill: 999,
} as const;

export const typography = {
  screenTitle: { fontSize: 25, lineHeight: 30, fontWeight: "600" as const, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const, letterSpacing: -0.15 },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: "600" as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  metadata: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const },
  button: { fontSize: 16, lineHeight: 20, fontWeight: "600" as const },
} as const;

export const elevation = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.025,
    shadowRadius: 3,
    elevation: 0,
  },
} as const;

export const hairline = StyleSheet.hairlineWidth;
