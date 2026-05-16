import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AppCard from "../components/ui/AppCard";
import AppSheetModal from "../components/ui/AppSheetModal";
import MeasurementWheelField from "../components/ui/MeasurementWheelField";
import { useAppSettingsStore } from "../state/appSettingsStore";
import {
  canUseExperimentalFeature,
  useExperimentalFeaturesStore,
  type ExperimentalFeatureKey,
} from "../state/experimentalFeaturesStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FractionDenominator } from "../types/framing";
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

function ToggleRow({
  label,
  subtitle,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <Pressable
      onPress={() => {
        if (disabled) {
          return;
        }
        void Haptics.selectionAsync();
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...typography.sectionTitle,
            color: disabled ? colors.textSecondary : colors.textPrimary,
            marginBottom: 4,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            ...typography.small,
            color: disabled ? colors.textPlaceholder : colors.textSecondary,
          }}
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: radii.pill,
          backgroundColor: value ? colors.accent : colors.backgroundMuted,
          borderWidth: 1,
          borderColor: value ? colors.accent : colors.borderStrong,
          padding: 3,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radii.pill,
            backgroundColor: colors.white,
            alignSelf: value ? "flex-end" : "flex-start",
          }}
        />
      </View>
    </Pressable>
  );
}

function SelectorRow({
  label,
  title,
  valueLabel,
  value,
  options,
  onValueChange,
}: {
  label: string;
  title?: string;
  valueLabel: string;
  value: FractionDenominator;
  options: { label: string; value: FractionDenominator }[];
  onValueChange: (value: FractionDenominator) => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const [visible, setVisible] = React.useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={{
          minHeight: 42,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.backgroundInput,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.textPrimary,
            }}
            numberOfLines={1}
          >
            {valueLabel}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </Pressable>

      <AppSheetModal visible={visible} title={title ?? label} onClose={() => setVisible(false)}>
        {options.map((option) => {
          const active = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => {
                void Haptics.selectionAsync();
                onValueChange(option.value);
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
    </>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const { colors, spacing, typography } = useAppTheme();
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const previewSnapIncrementInches = useAppSettingsStore((state) => state.previewSnapIncrementInches);
  const guidanceTestingEnabled = useAppSettingsStore((state) => state.guidanceTestingEnabled);
  const alwaysShowGuidanceOnLaunch = useAppSettingsStore((state) => state.alwaysShowGuidanceOnLaunch);
  const featureToggles = useExperimentalFeaturesStore((state) => state.featureToggles);
  const entitlements = useExperimentalFeaturesStore((state) => state.entitlements);
  const usage = useExperimentalFeaturesStore((state) => state.usage);
  const setUnit = useAppSettingsStore((state) => state.setUnit);
  const setImperialPrecision = useAppSettingsStore((state) => state.setImperialPrecision);
  const setPreviewSnapIncrementInches = useAppSettingsStore((state) => state.setPreviewSnapIncrementInches);
  const setGuidanceTestingEnabled = useAppSettingsStore((state) => state.setGuidanceTestingEnabled);
  const setAlwaysShowGuidanceOnLaunch = useAppSettingsStore(
    (state) => state.setAlwaysShowGuidanceOnLaunch
  );
  const setExperimentalFeatureEnabled = useExperimentalFeaturesStore(
    (state) => state.setFeatureEnabled
  );
  const experimentalFeatureAvailable = (feature: ExperimentalFeatureKey) =>
    canUseExperimentalFeature(feature, entitlements);

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
            Measurements
          </Text>

          <AppCard
            title="Measurement preferences"
            subtitle="Choose working units, fraction display, and default preview drag snapping."
          >
            <View>
              <Text
                style={{
                  ...typography.sectionTitle,
                  color: colors.textPrimary,
                  marginBottom: spacing.xs,
                }}
              >
                Working units
              </Text>
              <Text
                style={{
                  ...typography.small,
                  color: colors.textSecondary,
                  marginBottom: spacing.sm,
                }}
              >
                Inches is the default. Imperial-only display precision is hidden when centimeters are selected.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <OptionButton label="Inches" selected={unit === "in"} onPress={() => setUnit("in")} />
                <OptionButton label="Centimeters" selected={unit === "cm"} onPress={() => setUnit("cm")} />
              </View>
            </View>

            {unit === "in" ? (
              <SelectorRow
                label="Imperial display precision"
                title="Imperial display precision"
                valueLabel={`1/${imperialPrecision} in`}
                value={imperialPrecision}
                options={FRACTION_PRECISION_OPTIONS.map((value) => ({
                  label: `1/${value} in`,
                  value,
                }))}
                onValueChange={setImperialPrecision}
              />
            ) : null}

            <MeasurementWheelField
              label="Preview drag snapping"
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

        <View style={{ marginTop: 24 }}>
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
            Experimental Features
          </Text>

          <AppCard subtitle="Beta and premium-ready features. These switches are local for now and can be connected to subscriptions later.">
            <ToggleRow
              label="AI Wall Enhancement (Beta)"
              subtitle={
                experimentalFeatureAvailable("aiWallEnhancement")
                  ? "Adds beta wall photo cleanup controls to Room View."
                  : "Requires AI feature access."
              }
              value={featureToggles.aiWallEnhancement}
              onValueChange={(enabled) => setExperimentalFeatureEnabled("aiWallEnhancement", enabled)}
              disabled={!experimentalFeatureAvailable("aiWallEnhancement")}
            />
            <ToggleRow
              label="Imported AI Rooms"
              subtitle={
                experimentalFeatureAvailable("importedAIRooms")
                  ? "Allow future AI-created room images to be imported as custom Room View scenes."
                  : "Requires custom room import access."
              }
              value={featureToggles.importedAIRooms}
              onValueChange={(enabled) => setExperimentalFeatureEnabled("importedAIRooms", enabled)}
              disabled={!experimentalFeatureAvailable("importedAIRooms")}
            />
            <ToggleRow
              label="AI Room Generation (Coming Soon)"
              subtitle="Room generation is scaffolded, but disabled until the generation service and entitlement are ready."
              value={false}
              onValueChange={() => undefined}
              disabled
            />
            <Text style={{ ...typography.small, color: colors.textSecondary }}>
              Local AI usage this month: {usage.aiWallEnhancementsUsed} wall enhancements,{" "}
              {usage.aiRoomsGenerated} generated rooms. Reset period starts {usage.monthlyResetDate}.
            </Text>
          </AppCard>
        </View>

        <View style={{ marginTop: 24 }}>
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
            Developer Settings
          </Text>

          <AppCard>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>
              Developer guidance controls are included in release builds, and both toggles start off by default.
            </Text>
            <ToggleRow
              label="Guidance"
              subtitle="Enable developer guidance testing controls for replaying onboarding copy and flow."
              value={guidanceTestingEnabled}
              onValueChange={setGuidanceTestingEnabled}
            />
            <ToggleRow
              label="Always show guidance on launch"
              subtitle="When off, guidance behaves normally and only appears once. When on, onboarding guidance replays on each fresh app launch."
              value={alwaysShowGuidanceOnLaunch}
              onValueChange={setAlwaysShowGuidanceOnLaunch}
              disabled={!guidanceTestingEnabled}
            />
          </AppCard>
        </View>
      </ScrollView>
    </View>
  );
}
