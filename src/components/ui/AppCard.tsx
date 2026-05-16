import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface AppCardProps {
  title?: string;
  subtitle?: string;
  tone?: "default" | "accent";
  compact?: boolean;
  headerAccessory?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppCard({
  title,
  subtitle,
  tone = "default",
  compact = false,
  headerAccessory,
  children,
}: AppCardProps) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const isAccent = tone === "accent";

  return (
    <View
      style={{
        backgroundColor: isAccent ? colors.accentSoft : colors.backgroundCard,
        borderWidth: 2,
        borderColor: isAccent ? colors.accent : colors.borderStrong,
        borderRadius: radii.lg,
        padding: compact ? spacing.md : spacing.lg,
      }}
    >
      {title ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            marginBottom: subtitle ? spacing.xs : compact ? spacing.sm : spacing.md,
          }}
        >
          <Text style={{ ...typography.sectionTitle, color: colors.textPrimary, flex: 1 }}>
            {title}
          </Text>
          {headerAccessory}
        </View>
      ) : null}
      {subtitle ? (
        <Text
          style={{
            ...typography.small,
            color: colors.textSecondary,
            marginBottom: compact ? spacing.sm : spacing.md,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      <View style={{ gap: compact ? spacing.sm : spacing.md }}>
        {children}
      </View>
    </View>
  );
}
