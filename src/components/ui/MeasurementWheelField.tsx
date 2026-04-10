import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { formatMeasurementValue, parseMeasurement } from "../../utils/formatters";
import WheelPickerColumn from "./WheelPickerColumn";

interface MeasurementWheelFieldProps {
  label: string;
  title?: string;
  value: string;
  unitLabel: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minWhole?: number;
  maxWhole?: number;
  fractionStep?: number;
  variant?: "field" | "compact";
  openSignal?: number;
  minValue?: number;
  maxValue?: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function formatFractionLabel(numerator: number, denominator: number) {
  if (numerator === 0) {
    return "0";
  }

  const divisor = gcd(numerator, denominator);
  return `${numerator / divisor}/${denominator / divisor}`;
}

function clampValue(value: number, minValue?: number, maxValue?: number) {
  let nextValue = value;

  if (minValue !== undefined) {
    nextValue = Math.max(minValue, nextValue);
  }

  if (maxValue !== undefined) {
    nextValue = Math.min(maxValue, nextValue);
  }

  return Number(nextValue.toFixed(4));
}

function parseClampedValue(
  value: string,
  minWhole: number,
  fractionStep?: number,
  minValue?: number,
  maxValue?: number
) {
  const parsed = parseMeasurement(value);
  if (parsed === null) {
    return {
      wholeIndex: 0,
      fractionIndex: 0,
    };
  }

  const clamped = clampValue(parsed, minValue, maxValue);
  const whole = Math.max(minWhole, Math.floor(clamped));

  if (!fractionStep) {
    return {
      wholeIndex: whole - minWhole,
      fractionIndex: Math.max(0, Math.min(9, Math.round((clamped - whole) * 10))),
    };
  }

  let fractionIndex = Math.round((clamped - whole) * fractionStep);
  let normalizedWhole = whole;

  if (fractionIndex >= fractionStep) {
    normalizedWhole += 1;
    fractionIndex = 0;
  }

  return {
    wholeIndex: Math.max(0, normalizedWhole - minWhole),
    fractionIndex: Math.max(0, Math.min(fractionStep - 1, fractionIndex)),
  };
}

function formatStoredValue(whole: number, fractionIndex: number, fractionStep?: number) {
  if (!fractionStep) {
    return fractionIndex === 0 ? `${whole}` : `${whole}.${fractionIndex}`;
  }

  const numericValue = whole + fractionIndex / fractionStep;
  return Number(numericValue.toFixed(4)).toString();
}

export default function MeasurementWheelField({
  label,
  title,
  value,
  unitLabel,
  onChange,
  placeholder = "Select",
  minWhole = 0,
  maxWhole = 60,
  fractionStep,
  variant = "field",
  openSignal,
  minValue,
  maxValue,
}: MeasurementWheelFieldProps) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const initialValue = useMemo(
    () => parseClampedValue(value, minWhole, fractionStep, minValue, maxValue),
    [fractionStep, maxValue, minValue, minWhole, value]
  );
  const [wholeIndex, setWholeIndex] = useState(initialValue.wholeIndex);
  const [fractionIndex, setFractionIndex] = useState(initialValue.fractionIndex);

  useEffect(() => {
    const next = parseClampedValue(value, minWhole, fractionStep, minValue, maxValue);
    setWholeIndex(next.wholeIndex);
    setFractionIndex(next.fractionIndex);
  }, [fractionStep, maxValue, minValue, minWhole, value]);

  useEffect(() => {
    if (!openSignal) {
      return;
    }

    setVisible(true);
  }, [openSignal]);

  const wholeLabels = useMemo(
    () => Array.from({ length: maxWhole - minWhole + 1 }, (_, index) => String(index + minWhole)),
    [maxWhole, minWhole]
  );

  const fractionLabels = useMemo(() => {
    const step = fractionStep ?? 10;
    return Array.from({ length: step }, (_, index) =>
      fractionStep ? formatFractionLabel(index, fractionStep) : String(index)
    );
  }, [fractionStep]);

  const displayValue = value ? `${formatMeasurementValue(value, unitLabel === "in" ? "in" : "cm", (fractionStep ?? 16) as 8 | 16 | 32)} ${unitLabel}` : "";
  const fractionColumnWidth = fractionStep ? 74 : 64;

  const trigger = (
    <Pressable
      onPress={() => setVisible(true)}
      style={
        variant === "compact"
          ? {
              minHeight: 42,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.backgroundInput,
              paddingHorizontal: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }
          : {
              height: 44,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.backgroundInput,
            }
      }
    >
      {variant === "compact" ? (
        <>
          <Text style={{ ...typography.small, color: colors.textSecondary }}>
            {label}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: value ? "600" : "400",
                color: value ? colors.textPrimary : colors.textPlaceholder,
              }}
              numberOfLines={1}
            >
              {displayValue || placeholder}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </>
      ) : (
        <>
          <Text
            style={{
              fontSize: 15,
              fontWeight: value ? "500" : "400",
              color: value ? colors.textPrimary : colors.textPlaceholder,
            }}
            numberOfLines={1}
          >
            {displayValue || placeholder}
          </Text>

          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} style={{ opacity: 0.7 }} />
        </>
      )}
    </Pressable>
  );

  return (
    <View>
      {variant === "field" ? (
        <Text
          style={{
            fontSize: 13,
            fontWeight: "500",
            color: colors.textPrimary,
            marginBottom: 4,
          }}
        >
          {label}
        </Text>
      ) : null}

      {trigger}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable
          onPress={() => setVisible(false)}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: "82%",
              maxWidth: 320,
              padding: 20,
              borderRadius: radii.md,
              borderWidth: 2,
              borderColor: colors.borderStrong,
              backgroundColor: colors.backgroundCard,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.textPrimary,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              {title ?? label}
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <View style={{ width: 80 }}>
                <WheelPickerColumn
                  labels={wholeLabels}
                  selectedIndex={wholeIndex}
                  onIndexChange={setWholeIndex}
                  accentColor={colors.accent}
                  textColor={colors.textPrimary}
                  secondaryColor={colors.textSecondary}
                  columnLabel={unitLabel}
                />
              </View>

              {!fractionStep ? (
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "700",
                    color: colors.textPrimary,
                    paddingHorizontal: 2,
                    marginTop: 16,
                  }}
                >
                  .
                </Text>
              ) : null}

              <View style={{ width: fractionColumnWidth }}>
                <WheelPickerColumn
                  labels={fractionLabels}
                  selectedIndex={fractionIndex}
                  onIndexChange={setFractionIndex}
                  accentColor={colors.accent}
                  textColor={colors.textPrimary}
                  secondaryColor={colors.textSecondary}
                  columnLabel={fractionStep ? "fraction" : "1/10"}
                  width={fractionColumnWidth}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                }}
              >
                <Text style={{ textAlign: "center", fontWeight: "600", color: colors.textPrimary }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const nextValue = parseMeasurement(
                    formatStoredValue(minWhole + wholeIndex, fractionIndex, fractionStep)
                  );
                  const storedValue =
                    nextValue === null
                      ? formatStoredValue(minWhole + wholeIndex, fractionIndex, fractionStep)
                      : clampValue(nextValue, minValue, maxValue).toString();

                  onChange(storedValue);
                  setVisible(false);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 6,
                  backgroundColor: colors.accent,
                }}
              >
                <Text style={{ textAlign: "center", fontWeight: "600", color: colors.white }}>
                  Set
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
