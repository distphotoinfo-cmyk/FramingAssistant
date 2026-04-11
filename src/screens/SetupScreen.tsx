import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import FlowStepLayout from "../components/FlowStepLayout";
import GuidanceAnchor from "../components/guidance/GuidanceAnchor";
import GuidanceOverlay, { type GuidanceItem } from "../components/guidance/GuidanceOverlay";
import { GuidanceProvider } from "../components/guidance/GuidanceProvider";
import MatPreviewCanvas from "../components/preview/MatPreviewCanvas";
import AppCard from "../components/ui/AppCard";
import MeasurementWheelField from "../components/ui/MeasurementWheelField";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { createInitialPreviewDraft, useFramingFlowStore } from "../state/framingFlowStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { MeasurementUnit, SizeInput } from "../types/framing";
import type { FramingRootStackParamList } from "../types/navigation";
import { getArtworkAspectRatio } from "../utils/artworkCrop";
import { importArtworkFromCamera, importArtworkFromLibrary } from "../utils/artworkImport";
import { resolveFrameColorHex } from "../utils/frameProfiles";
import { parseMeasurement } from "../utils/formatters";
import {
  calculateOpeningSize,
  type NumericSize,
  getDefaultOpeningAmount,
  parseSizeInput,
  toStoredSize,
} from "../utils/framingGeometry";

const TABLET_WIDTH_BREAKPOINT = 768;
const LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH = 1180;
const LANDSCAPE_CONTROLS_COLUMN_WIDTH = 408;
const STEP_ONE_PREVIEW_ARTWORK_FALLBACKS: Record<MeasurementUnit, NumericSize> = {
  in: { width: 8, height: 10 },
  cm: { width: 20.3, height: 25.4 },
};
const STEP_ONE_PREVIEW_OUTER_MARGINS: Record<MeasurementUnit, number> = {
  in: 2,
  cm: 5,
};
function resolvePreviewSize(size: SizeInput, fallback: NumericSize): NumericSize {
  return {
    width: parseMeasurement(size.width) ?? fallback.width,
    height: parseMeasurement(size.height) ?? fallback.height,
  };
}

function buildStepOnePreviewOuterMatSize(
  openingSize: NumericSize | null,
  artworkSize: NumericSize,
  unit: MeasurementUnit
): NumericSize {
  const outerMargin = STEP_ONE_PREVIEW_OUTER_MARGINS[unit];
  const baseWidth = openingSize?.width ?? artworkSize.width;
  const baseHeight = openingSize?.height ?? artworkSize.height;

  return {
    width: baseWidth + outerMargin * 2,
    height: baseHeight + outerMargin * 2,
  };
}

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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const shouldShowSetupGuidance = useAppSettingsStore(
    (state) => state.hasHydrated && !state.sessionHasSeenSetupIntro
  );
  const markSetupIntroSeen = useAppSettingsStore((state) => state.markSetupIntroSeen);
  const { colors, spacing } = useAppTheme();
  const draft = useFramingFlowStore((state) => state.draft);
  const setArtwork = useFramingFlowStore((state) => state.setArtwork);
  const setReveal = useFramingFlowStore((state) => state.setReveal);
  const setOuterMat = useFramingFlowStore((state) => state.setOuterMat);
  const [borderPickerOpenSignal, setBorderPickerOpenSignal] = useState(0);
  const [guidanceIndex, setGuidanceIndex] = useState(0);

  const fractionStep = unit === "in" ? imperialPrecision : undefined;
  const artworkSize = parseSizeInput(draft.artwork.artworkSize);
  const openingAmount = draft.reveal.openingAmount || getDefaultOpeningAmount(unit);
  const isTabletScreen = Math.min(windowWidth, windowHeight) >= TABLET_WIDTH_BREAKPOINT;
  const isPortrait = windowHeight > windowWidth;
  const isTabletLandscape = isTabletScreen && !isPortrait;
  const landscapePreviewHeight = Math.min(Math.max(windowHeight - 280, 460), 620);
  const preview = draft.preview ?? createInitialPreviewDraft();
  const resolvedFrameColorHex = useMemo(
    () => resolveFrameColorHex(preview.frameProfileId, preview.frameFinishId, preview.frameColorHex),
    [preview.frameColorHex, preview.frameFinishId, preview.frameProfileId]
  );
  const setupGuidanceItems = useMemo<GuidanceItem[]>(
    () => [
      {
        id: "setup-artwork-size-bubble",
        targetId: "setup-artwork-size",
        text: "Measure and enter the dimensions of your artwork to be framed.",
        preferredPlacement: "bottom",
      },
      {
        id: "setup-mat-window-opening-bubble",
        targetId: "setup-mat-window-opening",
        text: "Select whether you want the mat to cover the artwork or show a border around it, then enter the coverage or border amount.",
        preferredPlacement: "bottom",
      },
      {
        id: "setup-outer-mat-size-bubble",
        targetId: "setup-outer-mat-size",
        text: "Enter the outer dimensions of your full mat size.",
        preferredPlacement: "top",
      },
    ],
    []
  );
  const openingSize = useMemo(
    () => calculateOpeningSize(artworkSize, draft.reveal.openingBehavior, openingAmount),
    [artworkSize, draft.reveal.openingBehavior, openingAmount]
  );
  const artworkAspectRatio = useMemo(() => getArtworkAspectRatio(artworkSize), [artworkSize]);
  const hasImportedArtwork =
    preview.artworkSourceMode === "import" && Boolean(preview.artworkImageUri);
  const showStepOneArtworkOverlay = Platform.OS === "ios" && isTabletScreen && !hasImportedArtwork;
  const previewArtworkSize = useMemo(
    () => resolvePreviewSize(draft.artwork.artworkSize, STEP_ONE_PREVIEW_ARTWORK_FALLBACKS[unit]),
    [draft.artwork.artworkSize, unit]
  );
  const previewOpeningSize = useMemo(
    () => calculateOpeningSize(previewArtworkSize, draft.reveal.openingBehavior, openingAmount),
    [draft.reveal.openingBehavior, openingAmount, previewArtworkSize]
  );
  const previewOuterMatFallback = useMemo(
    () => buildStepOnePreviewOuterMatSize(previewOpeningSize, previewArtworkSize, unit),
    [previewArtworkSize, previewOpeningSize, unit]
  );
  const previewOuterMatSize = useMemo(
    () => resolvePreviewSize(draft.outerMat.outerMatSize, previewOuterMatFallback),
    [draft.outerMat.outerMatSize, previewOuterMatFallback]
  );
  const handleAdvanceGuidance = useCallback(() => {
    setGuidanceIndex((current) => Math.min(current + 1, setupGuidanceItems.length - 1));
  }, [setupGuidanceItems.length]);
  const handleCloseGuidance = useCallback(() => {
    markSetupIntroSeen();
  }, [markSetupIntroSeen]);

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

  useEffect(() => {
    if (shouldShowSetupGuidance) {
      setGuidanceIndex(0);
    }
  }, [shouldShowSetupGuidance]);

  const openCropEditor = useCallback(
    (imageUri: string, imageWidth?: number | null, imageHeight?: number | null) => {
      navigation.navigate("ArtworkCrop", {
        imageUri,
        imageWidth: imageWidth ?? null,
        imageHeight: imageHeight ?? null,
        mode: "import",
      });
    },
    [navigation]
  );

  const handlePickFromLibrary = useCallback(async () => {
    await importArtworkFromLibrary(({ imageUri, imageWidth, imageHeight }) => {
      openCropEditor(imageUri, imageWidth, imageHeight);
    });
  }, [openCropEditor]);

  const handleTakePhoto = useCallback(async () => {
    await importArtworkFromCamera(({ imageUri, imageWidth, imageHeight }) => {
      openCropEditor(imageUri, imageWidth, imageHeight);
    });
  }, [openCropEditor]);

  const openArtworkSourceChooser = useCallback(() => {
    if (!artworkAspectRatio) {
      Alert.alert(
        "Artwork size needed",
        "Set the artwork width and height first so Framing Assistant can lock the crop ratio correctly."
      );
      return;
    }

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", "Photo Library", "Take Photo"],
        cancelButtonIndex: 0,
        userInterfaceStyle: colors.background === "#F4F4F5" ? "light" : "dark",
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          void handlePickFromLibrary();
        }

        if (buttonIndex === 2) {
          void handleTakePhoto();
        }
      }
    );
  }, [artworkAspectRatio, colors.background, handlePickFromLibrary, handleTakePhoto]);

  const renderStepOnePreview = useCallback(
    (layoutVariant: "default" | "workspace", canvasHeight?: number) => (
      <View style={{ position: "relative" }}>
        <View pointerEvents="none">
          <MatPreviewCanvas
            artworkSize={previewArtworkSize}
            openingSize={previewOpeningSize}
            outerMatSize={previewOuterMatSize}
            frameProfileId={preview.frameProfileId}
            frameColorHex={resolvedFrameColorHex}
            matThicknessPly={preview.matThicknessPly}
            matColorHex={preview.matColorHex}
            matCoreColor={preview.matCoreColor}
            mountingBoardColorHex={preview.mountingBoardColorHex}
            offsetX={0}
            offsetY={0}
            snapIncrement={0}
            artworkSourceMode={hasImportedArtwork ? "import" : "placeholder"}
            artworkImageUri={hasImportedArtwork ? preview.artworkImageUri : null}
            artworkCrop={hasImportedArtwork ? preview.artworkCrop : null}
            onAdjustOffsets={() => undefined}
            canvasHeight={canvasHeight}
            layoutVariant={layoutVariant}
          />
        </View>

        {showStepOneArtworkOverlay ? (
          <Pressable
            onPress={openArtworkSourceChooser}
            accessibilityRole="button"
            accessibilityLabel="Add artwork"
            style={({ pressed }) => ({
              position: "absolute",
              right: spacing.xl,
              bottom: spacing.xl,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
              backgroundColor: pressed ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.66)",
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            })}
          >
            <Ionicons name="image-outline" size={16} color={colors.white} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.white }}>
              Add Artwork
            </Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [
      colors.white,
      hasImportedArtwork,
      openArtworkSourceChooser,
      preview.artworkCrop,
      preview.artworkImageUri,
      preview.frameProfileId,
      preview.matColorHex,
      preview.matCoreColor,
      preview.matThicknessPly,
      preview.mountingBoardColorHex,
      previewOpeningSize,
      previewOuterMatSize,
      previewArtworkSize,
      resolvedFrameColorHex,
      showStepOneArtworkOverlay,
      spacing.md,
      spacing.sm,
      spacing.xl,
    ]
  );

  const renderSetupCards = () => (
    <>
      <GuidanceAnchor id="setup-artwork-size">
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
      </GuidanceAnchor>

      <GuidanceAnchor id="setup-mat-window-opening">
        <AppCard title="Mat window opening">
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
      </GuidanceAnchor>

      <GuidanceAnchor id="setup-outer-mat-size">
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
      </GuidanceAnchor>
    </>
  );

  return (
    <GuidanceProvider>
      <FlowStepLayout
        route="Setup"
        title="Setup"
        nextLabel="Next"
        contentMaxWidth={isTabletLandscape ? LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH : undefined}
        footerMaxWidth={isTabletLandscape ? LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH : undefined}
        footerColumnWidth={isTabletLandscape ? LANDSCAPE_CONTROLS_COLUMN_WIDTH : undefined}
        footerColumnAlign="center"
      >
        {isTabletLandscape ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.xxxl,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: spacing.lg }}>
              {renderStepOnePreview("workspace", landscapePreviewHeight)}
            </View>

            <View
              style={{
                width: LANDSCAPE_CONTROLS_COLUMN_WIDTH,
                maxWidth: "40%",
                flexShrink: 0,
                marginTop: spacing.xxl,
                gap: spacing.lg,
              }}
            >
              {renderSetupCards()}
            </View>
          </View>
        ) : isTabletScreen ? (
          <>
            {renderStepOnePreview("default")}
            {renderSetupCards()}
          </>
        ) : (
          <View style={{ gap: spacing.xl }}>
            {renderSetupCards()}
          </View>
        )}
      </FlowStepLayout>

      <GuidanceOverlay
        visible={shouldShowSetupGuidance}
        items={setupGuidanceItems}
        currentIndex={guidanceIndex}
        onNext={handleAdvanceGuidance}
        onClose={handleCloseGuidance}
        accentColor={colors.accent}
        actionLabel="Got it"
        showCloseButton={false}
        dismissOnBackdropPress={false}
      />
    </GuidanceProvider>
  );
}
