import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../theme/AppThemeProvider";
import AppSheetModal from "./AppSheetModal";

interface CompactOption<T extends string> {
  label: string;
  value: T;
}

interface CompactOptionPickerProps<T extends string> {
  label: string;
  title?: string;
  value: T;
  options: CompactOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export default function CompactOptionPicker<T extends string>({
  label,
  title,
  value,
  options,
  onChange,
  disabled = false,
}: CompactOptionPickerProps<T>) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const [visible, setVisible] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? "",
    [options, value]
  );

  return (
    <View style={{ width: "100%", gap: spacing.xs }}>
      <Text style={{ ...typography.eyebrow, color: colors.textPrimary }}>
        {label}
      </Text>

      <Pressable
        onPress={() => {
          if (!disabled) {
            setVisible(true);
          }
        }}
        disabled={disabled}
        style={{
          minHeight: 42,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: radii.md,
          backgroundColor: colors.backgroundInput,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: disabled ? 0.9 : 1,
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }} numberOfLines={1}>
            {selectedLabel}
          </Text>
        </View>
        {!disabled ? <Ionicons name="chevron-down" size={16} color={colors.textSecondary} /> : null}
      </Pressable>

      <AppSheetModal visible={visible && !disabled} title={title ?? label} onClose={() => setVisible(false)}>
        {options.map((option) => {
          const active = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setVisible(false);
              }}
              style={{
                minHeight: 46,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.borderStrong,
                borderRadius: radii.md,
                backgroundColor: active ? colors.accentSoft : colors.backgroundInput,
                paddingHorizontal: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: active ? "600" : "500",
                  color: colors.textPrimary,
                }}
              >
                {option.label}
              </Text>
              {active ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </AppSheetModal>
    </View>
  );
}
