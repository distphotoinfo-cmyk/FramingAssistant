import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FlowStepLayout from "../components/FlowStepLayout";
import AppCard from "../components/ui/AppCard";
import MeasurementWheelField from "../components/ui/MeasurementWheelField";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { useFramingFlowStore } from "../state/framingFlowStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import {
  calculateOpeningSize,
  getDefaultOpeningAmount,
  parseSizeInput,
  toStoredSize,
} from "../utils/framingGeometry";

type SetupOptionRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function SetupOptionRow({ label, selected, onPress }: SetupOptionRowProps) {
  const { colors, radii, spacing } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.borderStrong,
        backgroundColor: selected ? colors.accentSoft : colors.backgroundInput,
        borderRadius: radii.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Ionicons
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={18}
        color={selected ? colors.accent : colors.textSecondary}
      />
      <Text
        style={{
          flex: 1,
          marginLeft: spacing.sm,
          fontSize: 15,
          fontWeight: selected ? "600" : "500",
          color: colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SetupScreen() {
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const hasSeenSetupIntro = useAppSettingsStore((state) => state.hasSeenSetupIntro);
  const markSetupIntroSeen = useAppSettingsStore((state) => state.markSetupIntroSeen);
  const { spacing } = useAppTheme();
  const draft = useFramingFlowStore((state) => state.draft);
  const setArtwork = useFramingFlowStore((state) => state.setArtwork);
  const setReveal = useFramingFlowStore((state) => state.setReveal);
  const setOuterMat = useFramingFlowStore((state) => state.setOuterMat);
  const [borderPickerOpenSignal, setBorderPickerOpenSignal] = useState(0);

  const fractionStep = unit === "in" ? imperialPrecision : undefined;
  const artworkSize = parseSizeInput(draft.artwork.artworkSize);
  const openingAmount = draft.reveal.openingAmount || getDefaultOpeningAmount(unit);
  const openingSize = useMemo(
    () => calculateOpeningSize(artworkSize, draft.reveal.openingBehavior, openingAmount),
    [artworkSize, draft.reveal.openingBehavior, openingAmount]
  );

  useEffect(() => {
    const nextVisibleRevealAmount = draft.reveal.openingBehavior === "border" ? openingAmount : "0";
    const nextVisibleReveal = {
      top: nextVisibleRevealAmount,
      right: nextVisibleRevealAmount,
      bottom: nextVisibleRevealAmount,
      left: nextVisibleRevealAmount,
    };

    const nextMountStyle = draft.reveal.openingBehavior === "overlap" ? "window" : "float";
    const nextOpeningSize = toStoredSize(openingSize);

    const needsUpdate =
      draft.reveal.mountStyle !== nextMountStyle ||
      draft.reveal.openingAmount !== openingAmount ||
      draft.reveal.visibleReveal.top !== nextVisibleReveal.top ||
      draft.reveal.visibleReveal.right !== nextVisibleReveal.right ||
      draft.reveal.visibleReveal.bottom !== nextVisibleReveal.bottom ||
      draft.reveal.visibleReveal.left !== nextVisibleReveal.left ||
      draft.reveal.matOpeningSize.width !== nextOpeningSize.width ||
      draft.reveal.matOpeningSize.height !== nextOpeningSize.height;

    if (!needsUpdate) {
      return;
    }

    setReveal({
      mountStyle: nextMountStyle,
      openingAmount,
      visibleReveal: nextVisibleReveal,
      matOpeningSize: nextOpeningSize,
    });
  }, [
    draft.reveal.matOpeningSize.height,
    draft.reveal.matOpeningSize.width,
    draft.reveal.mountStyle,
    draft.reveal.openingAmount,
    draft.reveal.openingBehavior,
    draft.reveal.visibleReveal.bottom,
    draft.reveal.visibleReveal.left,
    draft.reveal.visibleReveal.right,
    draft.reveal.visibleReveal.top,
    openingAmount,
    openingSize,
    setReveal,
  ]);

  return (
    <FlowStepLayout
      route="Setup"
      title="Setup"
      nextLabel="See Preview"
      shellBubble={{
        visible: !hasSeenSetupIntro,
        title: "Start with the core geometry",
        body: "Set the artwork size, decide whether the mat overlaps the edge or shows a border, and enter the outer mat size. The opening preview will stay in sync.",
        stepLabel: "Step 1 guide",
        onDismiss: markSetupIntroSeen,
      }}
    >
      <AppCard title="Artwork size">
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <MeasurementWheelField
              label="Width"
              title="Artwork width"
              unitLabel={unit}
              value={draft.artwork.artworkSize.width}
              onChange={(width) =>
                setArtwork({
                  artworkSize: {
                    ...draft.artwork.artworkSize,
                    width,
                  },
                })
              }
              fractionStep={fractionStep}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MeasurementWheelField
              label="Height"
              title="Artwork height"
              unitLabel={unit}
              value={draft.artwork.artworkSize.height}
              onChange={(height) =>
                setArtwork({
                  artworkSize: {
                    ...draft.artwork.artworkSize,
                    height,
                  },
                })
              }
              fractionStep={fractionStep}
            />
          </View>
        </View>
      </AppCard>

      <AppCard title="How should the mat sit on the artwork?">
        <View style={{ gap: spacing.sm }}>
          <SetupOptionRow
            label="Cover the edge slightly"
            selected={draft.reveal.openingBehavior === "overlap"}
            onPress={() =>
              setReveal({
                openingBehavior: "overlap",
                openingAmount:
                  draft.reveal.openingBehavior === "overlap"
                    ? openingAmount
                    : getDefaultOpeningAmount(unit),
              })
            }
          />
          <SetupOptionRow
            label="Show a border around the artwork"
            selected={draft.reveal.openingBehavior === "border"}
            onPress={() => {
              const isSwitchingModes = draft.reveal.openingBehavior !== "border";

              setReveal({
                openingBehavior: "border",
                openingAmount:
                  draft.reveal.openingBehavior === "border"
                    ? openingAmount
                    : getDefaultOpeningAmount(unit),
              });

              if (isSwitchingModes) {
                setBorderPickerOpenSignal((current) => current + 1);
              }
            }}
          />
        </View>

        {draft.reveal.openingBehavior === "overlap" ? (
          <MeasurementWheelField
            label="Overlap"
            title="Overlap amount"
            unitLabel={unit}
            value={openingAmount}
            onChange={(value) => setReveal({ openingAmount: value })}
            maxWhole={unit === "in" ? 4 : 10}
            fractionStep={fractionStep}
            variant="compact"
          />
        ) : null}

        {draft.reveal.openingBehavior === "border" ? (
          <MeasurementWheelField
            label="Visible border"
            title="Visible border amount"
            unitLabel={unit}
            value={openingAmount}
            onChange={(value) => setReveal({ openingAmount: value })}
            maxWhole={unit === "in" ? 4 : 10}
            fractionStep={fractionStep}
            variant="compact"
            openSignal={borderPickerOpenSignal}
          />
        ) : null}
      </AppCard>

      <AppCard title="Outer mat size">
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <MeasurementWheelField
              label="Width"
              title="Outer mat width"
              unitLabel={unit}
              value={draft.outerMat.outerMatSize.width}
              onChange={(width) =>
                setOuterMat({
                  outerMatSize: {
                    ...draft.outerMat.outerMatSize,
                    width,
                  },
                })
              }
              maxWhole={80}
              fractionStep={fractionStep}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MeasurementWheelField
              label="Height"
              title="Outer mat height"
              unitLabel={unit}
              value={draft.outerMat.outerMatSize.height}
              onChange={(height) =>
                setOuterMat({
                  outerMatSize: {
                    ...draft.outerMat.outerMatSize,
                    height,
                  },
                })
              }
              maxWhole={80}
              fractionStep={fractionStep}
            />
          </View>
        </View>
      </AppCard>
    </FlowStepLayout>
  );
}
