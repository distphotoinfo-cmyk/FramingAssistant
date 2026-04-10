import React from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface AppTextFieldProps extends TextInputProps {
  label: string;
  helperText?: string;
}

export default function AppTextField({ label, helperText, multiline, style, ...props }: AppTextFieldProps) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <View>
      <Text style={{ ...typography.eyebrow, color: colors.textPrimary, marginBottom: spacing.xs }}>
        {label}
      </Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textPlaceholder}
        style={[
          {
            minHeight: multiline ? 108 : 48,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: radii.md,
            backgroundColor: colors.backgroundInput,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            fontSize: 16,
            color: colors.textPrimary,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
      />
      {helperText ? (
        <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: spacing.xs }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
