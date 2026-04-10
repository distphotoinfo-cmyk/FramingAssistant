import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AppCard from "../components/ui/AppCard";
import MeasurementWheelField from "../components/ui/MeasurementWheelField";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FramingRootStackParamList } from "../types/navigation";
import {
  DEFAULT_PREVIEW_SNAP_INCREMENT_INCHES,
  FRACTION_PRECISION_OPTIONS,
  MAX_PREVIEW_SNAP_INCREMENT_INCHES,
  MIN_PREVIEW_SNAP_INCREMENT_INCHES,
} from "../utils/formatters";

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={{
        backgroundColor: selected ? colors.accent : "transparent",
        borderWidth: 2,
        borderColor: selected ? colors.accent : colors.borderStrong,
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: selected ? colors.white : colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const { colors } = useAppTheme();
  const colorMode = useAppSettingsStore((state) => state.colorMode);
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const previewSnapIncrementInches = useAppSettingsStore((state) => state.previewSnapIncrementInches);
  const setColorMode = useAppSettingsStore((state) => state.setColorMode);
  const setUnit = useAppSettingsStore((state) => state.setUnit);
  const setImperialPrecision = useAppSettingsStore((state) => state.setImperialPrecision);
  const setPreviewSnapIncrementInches = useAppSettingsStore((state) => state.setPreviewSnapIncrementInches);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomWidth: 2,
          borderBottomColor: colors.borderStrong,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>
            Settings
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Appearance
          </Text>

          <AppCard title="Color mode" subtitle="Framing Assistant now defaults to the darker Darkroom-like shell.">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <OptionButton label="Dark" selected={colorMode === "dark"} onPress={() => setColorMode("dark")} />
              <OptionButton label="Light" selected={colorMode === "light"} onPress={() => setColorMode("light")} />
            </View>
          </AppCard>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Measurements
          </Text>

          <AppCard title="Working units" subtitle="Units now live in Settings so the guided flow can begin immediately.">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <OptionButton label="Inches" selected={unit === "in"} onPress={() => setUnit("in")} />
              <OptionButton label="Centimeters" selected={unit === "cm"} onPress={() => setUnit("cm")} />
            </View>
          </AppCard>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Precision
          </Text>

          <AppCard title="Imperial display precision" subtitle="Main UI measurements use fractions instead of decimals.">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {FRACTION_PRECISION_OPTIONS.map((value) => (
                <OptionButton
                  key={`precision-${value}`}
                  label={`1/${value}`}
                  selected={imperialPrecision === value}
                  onPress={() => setImperialPrecision(value)}
                />
              ))}
            </View>
          </AppCard>

          <View style={{ height: 12 }} />

          <AppCard title="Preview drag snapping" subtitle="Set the default snap size for weighting the mat.">
            <MeasurementWheelField
              label="Default snap"
              title="Preview drag snapping"
              value={String(previewSnapIncrementInches ?? DEFAULT_PREVIEW_SNAP_INCREMENT_INCHES)}
              unitLabel="in"
              onChange={setPreviewSnapIncrementInches}
              minWhole={0}
              maxWhole={1}
              minValue={MIN_PREVIEW_SNAP_INCREMENT_INCHES}
              maxValue={MAX_PREVIEW_SNAP_INCREMENT_INCHES}
              fractionStep={16}
              variant="compact"
            />
          </AppCard>
        </View>

        <AppCard title="Saved projects" subtitle="Projects are entered later from Review and Cut Specs, not before the user starts framing.">
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            The folder button in the header stays available throughout the flow so saved work can live outside the setup steps, similar to Darkroom Assistant&apos;s persistent shell actions.
          </Text>
        </AppCard>
      </ScrollView>
    </View>
  );
}
