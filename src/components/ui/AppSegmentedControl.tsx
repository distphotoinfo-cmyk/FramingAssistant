import React from "react";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

interface AppSegmentedControlProps<T extends string> {
  label?: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function AppSegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: AppSegmentedControlProps<T>) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <View>
      {label ? (
        <Text style={{ ...typography.eyebrow, color: colors.textPrimary, marginBottom: spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row" }}>
        {options.map((option, index) => {
          const active = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.sm,
                borderWidth: 2,
                borderColor: active ? colors.accent : colors.borderStrong,
                backgroundColor: active ? colors.accent : colors.backgroundCard,
                borderTopLeftRadius: index === 0 ? radii.md : 0,
                borderBottomLeftRadius: index === 0 ? radii.md : 0,
                borderTopRightRadius: index === options.length - 1 ? radii.md : 0,
                borderBottomRightRadius: index === options.length - 1 ? radii.md : 0,
                borderRightWidth: index === options.length - 1 ? 2 : 0,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: active ? colors.white : colors.textPrimary }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
