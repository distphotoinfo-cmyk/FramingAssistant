import type { TextStyle } from "react-native";
import type { AppColorMode } from "../types/framing";

export const lightColors = {
  background: "#F3F4F7",
  backgroundCard: "#FFFFFF",
  backgroundModal: "#ECEFF3",
  backgroundInput: "#F7F8FA",
  backgroundMuted: "#EEF2F7",
  headerBackground: "#000000",
  headerText: "#FFFFFF",
  textPrimary: "#171717",
  textSecondary: "#5B6472",
  textPlaceholder: "#8791A1",
  accent: "#0038FF",
  accentSoft: "rgba(0, 56, 255, 0.12)",
  accentMuted: "#DCE6FF",
  borderStrong: "#111111",
  borderSubtle: "#D6DCE5",
  guideSurface: "#151920",
  guideBorder: "rgba(255,255,255,0.14)",
  guideTextPrimary: "#FFFFFF",
  guideTextSecondary: "rgba(255,255,255,0.78)",
  overlay: "rgba(0, 0, 0, 0.5)",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#7F1D1D",
  white: "#FFFFFF",
};

export const darkColors = {
  background: "#171717",
  backgroundCard: "#1A1A1A",
  backgroundModal: "#101010",
  backgroundInput: "#131313",
  backgroundMuted: "#202020",
  headerBackground: "#000000",
  headerText: "#FFFFFF",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  textPlaceholder: "#6B7280",
  accent: "#0038FF",
  accentSoft: "rgba(0, 56, 255, 0.18)",
  accentMuted: "#0F1F52",
  borderStrong: "#404040",
  borderSubtle: "#2A2A2A",
  guideSurface: "#151920",
  guideBorder: "rgba(255,255,255,0.14)",
  guideTextPrimary: "#FFFFFF",
  guideTextSecondary: "rgba(255,255,255,0.78)",
  overlay: "rgba(0, 0, 0, 0.66)",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#7F1D1D",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  pill: 999,
};

export const layout = {
  contentMaxWidth: 760,
};

export const typography = {
  title: {
    fontSize: 27,
    fontWeight: "700" as TextStyle["fontWeight"],
    letterSpacing: -0.4,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "700" as TextStyle["fontWeight"],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as TextStyle["fontWeight"],
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600" as TextStyle["fontWeight"],
    textTransform: "uppercase" as TextStyle["textTransform"],
    letterSpacing: 1,
  },
};

export function resolveTheme(colorMode: AppColorMode) {
  return {
    colors: colorMode === "light" ? lightColors : darkColors,
    spacing,
    radii,
    layout,
    typography,
    colorMode,
    isDark: colorMode === "dark",
  };
}

export type AppTheme = ReturnType<typeof resolveTheme>;
