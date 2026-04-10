import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface AppCardProps {
  title?: string;
  subtitle?: string;
  tone?: "default" | "accent";
  headerAccessory?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppCard({
  title,
  subtitle,
  tone = "default",
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
        padding: spacing.lg,
      }}
    >
      {title ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            marginBottom: subtitle ? spacing.xs : spacing.md,
          }}
        >
          <Text style={{ ...typography.sectionTitle, color: colors.textPrimary, flex: 1 }}>
            {title}
          </Text>
          {headerAccessory}
        </View>
      ) : null}
      {subtitle ? (
        <Text style={{ ...typography.small, color: colors.textSecondary, marginBottom: spacing.md }}>
          {subtitle}
        </Text>
      ) : null}
      <View style={{ gap: spacing.md }}>
        {children}
      </View>
    </View>
  );
}
