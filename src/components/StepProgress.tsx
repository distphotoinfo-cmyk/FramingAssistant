import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/AppThemeProvider";

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  label: string;
  bottomSpacing?: number;
}

export default function StepProgress({ currentStep, totalSteps, label, bottomSpacing }: StepProgressProps) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <View style={{ marginBottom: bottomSpacing ?? spacing.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs }}>
        <Text style={{ ...typography.eyebrow, color: colors.textSecondary }}>
          Step {currentStep} of {totalSteps}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          {label}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {Array.from({ length: totalSteps }).map((_, index) => {
          const active = index < currentStep;
          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: 6,
                borderRadius: radii.pill,
                backgroundColor: active ? colors.accent : colors.backgroundMuted,
                borderWidth: active ? 0 : 1,
                borderColor: colors.borderSubtle,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
