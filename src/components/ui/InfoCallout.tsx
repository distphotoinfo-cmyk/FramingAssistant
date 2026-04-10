import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface InfoCalloutProps {
  title: string;
  children: React.ReactNode;
}

export default function InfoCallout({ title, children }: InfoCalloutProps) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        backgroundColor: colors.accentSoft,
        borderWidth: 2,
        borderColor: colors.accent,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
        <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
          {title}
        </Text>
      </View>
      <Text style={{ ...typography.body, color: colors.textSecondary }}>
        {children}
      </Text>
    </View>
  );
}

