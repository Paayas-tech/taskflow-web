export const colors = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  text: "#171A23",
  muted: "#687083",
  subtle: "#EEF0F6",
  border: "#DADCE3",
  primary: "#5856D6",
  primarySoft: "#EFEEFF",
  success: "#17855B",
  danger: "#B42318",
} as const;

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
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  screenTitle: { fontSize: 26, lineHeight: 32, fontWeight: "700" as const },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: "600" as const },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  metadata: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const },
  button: { fontSize: 16, lineHeight: 20, fontWeight: "600" as const },
} as const;

export const elevation = {
  card: {
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
} as const;
