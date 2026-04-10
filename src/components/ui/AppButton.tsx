import React from "react";
import { Pressable, Text, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: ViewStyle;
}

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  style,
}: AppButtonProps) {
  const { colors, radii, isDark } = useAppTheme();
  const primary = variant === "primary";

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={{
        minHeight: primary ? 44 : 38,
        borderRadius: primary ? radii.md : radii.pill,
        borderWidth: primary ? 0 : 1,
        borderColor: primary ? colors.accent : "rgba(255,255,255,0.18)",
        backgroundColor: primary ? colors.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
        paddingHorizontal: primary ? 18 : 14,
        ...style,
      }}
    >
      <Text
        style={{
          fontSize: primary ? 15 : 13,
          fontWeight: "600",
          color: primary ? colors.white : isDark ? "rgba(255,255,255,0.72)" : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
