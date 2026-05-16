import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useAppTheme } from "../../theme/AppThemeProvider";
import {
  getSwatchBorderColor,
  hexToHsl,
  hslToHex,
  normalizeHex,
} from "../../utils/color";
import AppButton from "./AppButton";
import AppSheetModal from "./AppSheetModal";

const MAX_PRESET_SLOTS = 5;
const WHEEL_SIZE = 188;
const WHEEL_OUTER_RADIUS = 82;
const WHEEL_INNER_RADIUS = 56;
const WHEEL_CENTER = WHEEL_SIZE / 2;
const WHEEL_SEGMENTS = 48;
const SLIDER_HEIGHT = 12;

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleDegrees: number) {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
}

function describeRingSegment(startAngle: number, endAngle: number) {
  const outerStart = polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, WHEEL_OUTER_RADIUS, startAngle);
  const outerEnd = polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, WHEEL_OUTER_RADIUS, endAngle);
  const innerEnd = polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, WHEEL_INNER_RADIUS, endAngle);
  const innerStart = polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, WHEEL_INNER_RADIUS, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${WHEEL_OUTER_RADIUS} ${WHEEL_OUTER_RADIUS} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${WHEEL_INNER_RADIUS} ${WHEEL_INNER_RADIUS} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function SwatchButton({
  color,
  selected,
  onPress,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        backgroundColor: color,
        borderWidth: selected ? 2 : 1,
        borderColor: selected
          ? colors.accent
          : getSwatchBorderColor(color, isDark),
      }}
    />
  );
}

function EmptyPresetSlot() {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: "transparent",
      }}
    />
  );
}

function ColorSlider({
  label,
  value,
  gradientColors,
  onChange,
}: {
  label: string;
  value: number;
  gradientColors: { offset: string; color: string }[];
  onChange: (nextValue: number) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const gradientIdRef = useRef(`gradient-${Math.random().toString(36).slice(2)}`);

  const updateValue = useCallback(
    (event: GestureResponderEvent | { nativeEvent: { locationX: number } }) => {
      if (trackWidth <= 0) {
        return;
      }

      const locationX = Math.max(0, Math.min(trackWidth, event.nativeEvent.locationX));
      onChange(locationX / trackWidth);
    },
    [onChange, trackWidth]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => trackWidth > 0,
        onMoveShouldSetPanResponder: () => trackWidth > 0,
        onPanResponderGrant: updateValue,
        onPanResponderMove: updateValue,
      }),
    [trackWidth, updateValue]
  );

  const thumbLeft = trackWidth > 0 ? value * trackWidth : 0;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.eyebrow, color: colors.textPrimary }}>
        {label}
      </Text>
      <View
        {...panResponder.panHandlers}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        style={{
          height: 28,
          justifyContent: "center",
        }}
      >
        <Svg width="100%" height={SLIDER_HEIGHT}>
          <Defs>
            <LinearGradient id={gradientIdRef.current} x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientColors.map((stop) => (
                <Stop key={`${gradientIdRef.current}-${stop.offset}`} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width="100%"
            height={SLIDER_HEIGHT}
            rx={SLIDER_HEIGHT / 2}
            fill={`url(#${gradientIdRef.current})`}
          />
        </Svg>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.max(0, thumbLeft - 10),
            top: 2,
            width: 20,
            height: 20,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: colors.white,
            backgroundColor: colors.backgroundCard,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }}
        />
      </View>
    </View>
  );
}

interface ColorPickerFieldProps {
  label: string;
  title: string;
  value: string;
  defaultColors: string[];
  customPresets: string[];
  onChange: (hex: string) => void;
  onSavePreset: (hex: string) => void;
  variant?: "field" | "swatch";
  accessibilityLabel?: string;
  style?: ViewStyle;
  swatchSize?: number;
  swatchInnerSize?: number;
  swatchHitSlop?: number;
}

export default function ColorPickerField({
  label,
  title,
  value,
  defaultColors,
  customPresets,
  onChange,
  onSavePreset,
  variant = "field",
  accessibilityLabel,
  style,
  swatchSize = 36,
  swatchInnerSize = 18,
  swatchHitSlop = 8,
}: ColorPickerFieldProps) {
  const { colors, radii, spacing, typography, isDark } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [lightness, setLightness] = useState(0);

  const normalizedValue = normalizeHex(value);

  useEffect(() => {
    const parsed = hexToHsl(normalizedValue);
    setHue(parsed.h);
    setSaturation(parsed.s);
    setLightness(parsed.l);
  }, [normalizedValue, visible]);

  const currentHex = useMemo(
    () => hslToHex(hue, saturation, lightness),
    [hue, saturation, lightness]
  );

  const applyColor = useCallback(
    (nextHue: number, nextSaturation: number, nextLightness: number) => {
      onChange(hslToHex(nextHue, nextSaturation, nextLightness));
    },
    [onChange]
  );

  const updateHue = useCallback(
    (nextHue: number) => {
      const normalizedHue = ((nextHue % 360) + 360) % 360;
      setHue(normalizedHue);
      applyColor(normalizedHue, saturation, lightness);
    },
    [applyColor, lightness, saturation]
  );

  const updateSaturation = (nextSaturation: number) => {
    const normalizedSaturation = clampUnit(nextSaturation);
    setSaturation(normalizedSaturation);
    applyColor(hue, normalizedSaturation, lightness);
  };

  const updateLightness = (nextLightness: number) => {
    const normalizedLightness = clampUnit(nextLightness);
    setLightness(normalizedLightness);
    applyColor(hue, saturation, normalizedLightness);
  };

  const hueWheelResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const dx = locationX - WHEEL_CENTER;
          const dy = locationY - WHEEL_CENTER;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < WHEEL_INNER_RADIUS - 8 || distance > WHEEL_OUTER_RADIUS + 8) {
            return;
          }

          updateHue((Math.atan2(dy, dx) * 180) / Math.PI + 90);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const dx = locationX - WHEEL_CENTER;
          const dy = locationY - WHEEL_CENTER;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < WHEEL_INNER_RADIUS - 8 || distance > WHEEL_OUTER_RADIUS + 8) {
            return;
          }

          updateHue((Math.atan2(dy, dx) * 180) / Math.PI + 90);
        },
      }),
    [updateHue]
  );

  const wheelSegments = useMemo(
    () =>
      Array.from({ length: WHEEL_SEGMENTS }, (_, index) => {
        const startAngle = (index / WHEEL_SEGMENTS) * 360;
        const endAngle = ((index + 1) / WHEEL_SEGMENTS) * 360;
        const midHue = (startAngle + endAngle) / 2;

        return {
          path: describeRingSegment(startAngle, endAngle),
          color: hslToHex(midHue, 1, 0.5),
        };
      }),
    []
  );

  const hueHandlePosition = useMemo(
    () => polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, (WHEEL_OUTER_RADIUS + WHEEL_INNER_RADIUS) / 2, hue),
    [hue]
  );

  const paddedCustomPresets = [...customPresets.slice(0, MAX_PRESET_SLOTS)];
  while (paddedCustomPresets.length < MAX_PRESET_SLOTS) {
    paddedCustomPresets.push("");
  }

  const pickerModal = (
    <AppSheetModal visible={visible} title={title} onClose={() => setVisible(false)}>
      <View style={{ alignItems: "center", gap: spacing.md }}>
        <View
          {...hueWheelResponder.panHandlers}
          style={{
            width: WHEEL_SIZE,
            height: WHEEL_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
            {wheelSegments.map((segment, index) => (
              <Path key={`wheel-${index}`} d={segment.path} fill={segment.color} />
            ))}
            <Circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_INNER_RADIUS - 4} fill={currentHex} />
            <Circle
              cx={hueHandlePosition.x}
              cy={hueHandlePosition.y}
              r={9}
              fill="#FFFFFF"
              stroke="rgba(0,0,0,0.18)"
              strokeWidth={2}
            />
            <Circle cx={hueHandlePosition.x} cy={hueHandlePosition.y} r={5} fill={currentHex} />
          </Svg>
        </View>

        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            backgroundColor: currentHex,
            borderWidth: 1,
            borderColor: getSwatchBorderColor(currentHex, isDark),
          }}
        />

        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          {currentHex}
        </Text>
      </View>

      <ColorSlider
        label="Saturation"
        value={saturation}
        onChange={updateSaturation}
        gradientColors={[
          { offset: "0%", color: hslToHex(hue, 0, lightness) },
          { offset: "100%", color: hslToHex(hue, 1, lightness) },
        ]}
      />

      <ColorSlider
        label="Lightness"
        value={lightness}
        onChange={updateLightness}
        gradientColors={[
          { offset: "0%", color: "#000000" },
          { offset: "50%", color: hslToHex(hue, saturation, 0.5) },
          { offset: "100%", color: "#FFFFFF" },
        ]}
      />

      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.eyebrow, color: colors.textPrimary }}>
          Default Colors
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
          {defaultColors.map((preset) => {
            const normalizedPreset = normalizeHex(preset);

            return (
              <SwatchButton
                key={normalizedPreset}
                color={normalizedPreset}
                selected={normalizedPreset === normalizedValue}
                onPress={() => {
                  const parsed = hexToHsl(normalizedPreset);
                  setHue(parsed.h);
                  setSaturation(parsed.s);
                  setLightness(parsed.l);
                  onChange(normalizedPreset);
                }}
              />
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.eyebrow, color: colors.textPrimary }}>
          Saved Colors
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
          {paddedCustomPresets.map((preset, index) =>
            preset ? (
              <SwatchButton
                key={`${preset}-${index}`}
                color={preset}
                selected={normalizeHex(preset) === normalizedValue}
                onPress={() => {
                  const parsed = hexToHsl(preset);
                  setHue(parsed.h);
                  setSaturation(parsed.s);
                  setLightness(parsed.l);
                  onChange(normalizeHex(preset));
                }}
              />
            ) : (
              <EmptyPresetSlot key={`empty-${index}`} />
            )
          )}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <AppButton
          variant="secondary"
          label="Save Current"
          onPress={() => onSavePreset(currentHex)}
          style={{ flex: 1 }}
        />
        <AppButton
          label="Done"
          onPress={() => setVisible(false)}
          style={{ flex: 1 }}
        />
      </View>
    </AppSheetModal>
  );

  if (variant === "swatch") {
    return (
      <>
        <Pressable
          onPress={() => setVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          hitSlop={swatchHitSlop}
          style={{
            width: swatchSize,
            height: swatchSize,
            borderRadius: swatchSize / 2,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.backgroundCard,
            alignItems: "center",
            justifyContent: "center",
            ...style,
          }}
        >
          <View
            style={{
              width: swatchInnerSize,
              height: swatchInnerSize,
              borderRadius: 999,
              backgroundColor: normalizedValue,
              borderWidth: 1,
              borderColor: getSwatchBorderColor(normalizedValue, isDark),
            }}
          />
        </Pressable>
        {pickerModal}
      </>
    );
  }

  return (
    <View style={{ width: "100%", gap: spacing.xs, ...style }}>
      <Text style={{ ...typography.eyebrow, color: colors.textPrimary }}>
        {label}
      </Text>

      <Pressable
        onPress={() => setVisible(true)}
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
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              backgroundColor: normalizedValue,
              borderWidth: 1,
              borderColor: getSwatchBorderColor(normalizedValue, isDark),
            }}
          />
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }} numberOfLines={1}>
            {normalizedValue}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>

      {pickerModal}
    </View>
  );
}
