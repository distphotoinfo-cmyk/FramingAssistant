import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface AppSelectRowProps {
  label: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
}

export default function AppSelectRow({
  label,
  value,
  placeholder = "Select",
  onPress,
}: AppSelectRowProps) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <View>
      <Text style={{ ...typography.eyebrow, color: colors.textPrimary, marginBottom: spacing.xs }}>
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: radii.md,
          backgroundColor: colors.backgroundInput,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 16, color: value ? colors.textPrimary : colors.textPlaceholder }}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}
