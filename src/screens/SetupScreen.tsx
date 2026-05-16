import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../components/AppHeader";
import ScreenContainer from "../components/ScreenContainer";
import StepProgress from "../components/StepProgress";
import GuidanceAnchor from "../components/guidance/GuidanceAnchor";
import GuidanceOverlay, { type GuidanceItem } from "../components/guidance/GuidanceOverlay";
import { GuidanceProvider } from "../components/guidance/GuidanceProvider";
import {
  TABLET_LANDSCAPE_CONTROLS_COLUMN_WIDTH,
  TABLET_LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH,
  TABLET_WORKSPACE_BREAKPOINT,
  TabletWorkspaceContent,
  getTabletWorkspaceMode,
  getTabletWorkspacePreviewCanvasHeight,
} from "../components/layout/TabletWorkspaceLayout";
import ArtworkCanvasActionOverlay from "../components/preview/ArtworkCanvasActionOverlay";
import CanvasBackgroundColorPicker from "../components/preview/CanvasBackgroundColorPicker";
import MatPreviewCanvas from "../components/preview/MatPreviewCanvas";
import AppButton from "../components/ui/AppButton";
import AppCard from "../components/ui/AppCard";
import MeasurementWheelField from "../components/ui/MeasurementWheelField";
import { useStepNavigation } from "../hooks/useStepNavigation";
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

const STEP_ONE_PREVIEW_ARTWORK_FALLBACKS: Record<MeasurementUnit, NumericSize> = {
  in: { width: 8, height: 10 },
  cm: { width: 20.3, height: 25.4 },
};
const STEP_ONE_PREVIEW_OUTER_MARGINS: Record<MeasurementUnit, number> = {
  in: 2,
  cm: 5,
};
const SETUP_SHEET_GUIDANCE_TARGET_IDS = new Set([
  "setup-artwork-size",
  "setup-mat-window-opening",
  "setup-visible-border",
  "setup-outer-mat-size",
]);

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
  compact?: boolean;
  onPress: () => void;
};

function SetupOptionRow({ label, selected, compact = false, onPress }: SetupOptionRowProps) {
  const { colors, radii, spacing } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.borderStrong,
        backgroundColor: selected ? colors.accentSoft : colors.backgroundInput,
        borderRadius: radii.md,
        paddingHorizontal: compact ? spacing.sm : spacing.md,
        paddingVertical: compact ? spacing.sm : spacing.md,
        flexDirection: "row",
        alignItems: "center",
        minHeight: compact ? 44 : undefined,
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
          fontSize: compact ? 14 : 15,
          fontWeight: selected ? "600" : "500",
          color: colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SetupBottomSheet({
  visible,
  title,
  maxHeight,
  compact = false,
  contentMaxWidth,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  maxHeight: number;
  compact?: boolean;
  contentMaxWidth?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors, radii, spacing, typography } = useAppTheme();
  const shouldConstrainContent = Boolean(contentMaxWidth || compact);

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        elevation: 100,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Close ${title}`}
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.overlay,
        }}
      />

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight,
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          borderWidth: 2,
          borderBottomWidth: 0,
          borderColor: colors.borderStrong,
          paddingTop: spacing.sm,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          paddingBottom: Math.max(insets.bottom, compact ? spacing.md : spacing.lg),
          gap: compact ? spacing.sm : spacing.md,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 42,
            height: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.borderStrong,
            opacity: 0.45,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            ...(contentMaxWidth
              ? {
                  width: "100%",
                  maxWidth: contentMaxWidth,
                  alignSelf: "center",
                }
              : {}),
          }}
        >
          <Text style={{ ...typography.screenTitle, color: colors.textPrimary, flex: 1 }}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.backgroundInput,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            alignItems: shouldConstrainContent ? "center" : undefined,
            gap: shouldConstrainContent ? undefined : spacing.md,
            paddingBottom: spacing.xs,
          }}
          showsVerticalScrollIndicator
        >
          {shouldConstrainContent ? (
            <View
              style={{
                width: "100%",
                maxWidth: contentMaxWidth,
                gap: compact ? spacing.sm : spacing.md,
              }}
            >
              {children}
            </View>
          ) : (
            children
          )}
        </ScrollView>
      </View>
    </View>
  );
}

export default function SetupScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const { currentStep, totalSteps, goNext } = useStepNavigation("Setup");
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const shouldShowSetupGuidance = useAppSettingsStore(
    (state) => state.hasHydrated && !state.sessionHasSeenSetupIntro
  );
  const markSetupIntroSeen = useAppSettingsStore((state) => state.markSetupIntroSeen);
  const { colors, layout, radii, spacing, typography } = useAppTheme();
  const draft = useFramingFlowStore((state) => state.draft);
  const setArtwork = useFramingFlowStore((state) => state.setArtwork);
  const setReveal = useFramingFlowStore((state) => state.setReveal);
  const setOuterMat = useFramingFlowStore((state) => state.setOuterMat);
  const [borderPickerOpenSignal, setBorderPickerOpenSignal] = useState(0);
  const [guidanceIndex, setGuidanceIndex] = useState(0);
  const [setupSheetVisible, setSetupSheetVisible] = useState(false);
  const [readyGuidanceTargetId, setReadyGuidanceTargetId] = useState<string | null>(null);
  const [previewAreaSize, setPreviewAreaSize] = useState({ width: 0, height: 0 });

  const fractionStep = unit === "in" ? imperialPrecision : undefined;
  const artworkSize = parseSizeInput(draft.artwork.artworkSize);
  const openingAmount = draft.reveal.openingAmount || getDefaultOpeningAmount(unit);
  const tabletWorkspaceMode = getTabletWorkspaceMode(windowWidth, windowHeight);
  const isTabletScreen = Math.min(windowWidth, windowHeight) >= TABLET_WORKSPACE_BREAKPOINT;
  const isTabletPortrait = tabletWorkspaceMode === "tabletPortrait";
  const isTabletLandscape = tabletWorkspaceMode === "tabletLandscape";
  const isShortViewport = windowHeight < 620;
  const measuredPreviewHeight = previewAreaSize.height > 0 ? previewAreaSize.height : windowHeight * 0.42;
  const previewCanvasHeight = getTabletWorkspacePreviewCanvasHeight({
    mode: tabletWorkspaceMode,
    measuredPreviewHeight,
    isShortViewport,
  });
  const workspaceVerticalPadding = isTabletPortrait ? spacing.sm : spacing.md;
  const workspaceGap = isTabletPortrait ? spacing.sm : spacing.md;
  const progressBottomSpacing = isTabletPortrait ? spacing.md : undefined;
  const preview = draft.preview ?? createInitialPreviewDraft();
  const resolvedFrameColorHex = useMemo(
    () => resolveFrameColorHex(preview.frameProfileId, preview.frameFinishId, preview.frameColorHex),
    [preview.frameColorHex, preview.frameFinishId, preview.frameProfileId]
  );
  const setupGuidanceItems = useMemo<GuidanceItem[]>(
    () => [
      {
        id: "setup-preview-bubble",
        targetId: "setup-preview",
        text: "Use this live preview to check the overall artwork, mat, and frame proportions as you enter setup values.",
        preferredPlacement: "bottom",
      },
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
        id: "setup-visible-border-bubble",
        targetId: "setup-visible-border",
        text: "Set the visible border or overlap amount. This value updates the mat window in the preview.",
        preferredPlacement: "top",
      },
      {
        id: "setup-outer-mat-size-bubble",
        targetId: "setup-outer-mat-size",
        text: "Enter the outer dimensions of your full mat size.",
        preferredPlacement: "top",
      },
      {
        id: "setup-folder-library-bubble",
        targetId: "setup-folder-library",
        text: "Open your saved library from here when you want to return to saved framing work.",
        preferredPlacement: "bottom",
      },
      {
        id: "setup-main-settings-bubble",
        targetId: "setup-main-settings",
        text: "Use settings to adjust app-wide preferences like measurement units.",
        preferredPlacement: "bottom",
      },
      {
        id: "setup-room-view-bubble",
        targetId: "setup-room-view",
        text: "Open Room View when you want to place saved framed artwork on a wall.",
        preferredPlacement: "top",
      },
      {
        id: "setup-next-bubble",
        targetId: "setup-next",
        text: "When the setup preview looks right, continue to refine color, frame, and artwork placement.",
        preferredPlacement: "top",
      },
    ],
    []
  );
  const activeGuidanceTargetId = setupGuidanceItems[guidanceIndex]?.targetId ?? null;
  const activeGuidanceTargetIsInSheet = activeGuidanceTargetId
    ? SETUP_SHEET_GUIDANCE_TARGET_IDS.has(activeGuidanceTargetId)
    : false;
  const guidanceOverlayVisible =
    shouldShowSetupGuidance && readyGuidanceTargetId === activeGuidanceTargetId;
  const openingSize = useMemo(
    () => calculateOpeningSize(artworkSize, draft.reveal.openingBehavior, openingAmount),
    [artworkSize, draft.reveal.openingBehavior, openingAmount]
  );
  const artworkAspectRatio = useMemo(() => getArtworkAspectRatio(artworkSize), [artworkSize]);
  const hasImportedArtwork =
    preview.artworkSourceMode === "import" && Boolean(preview.artworkImageUri);
  const showStepOneArtworkOverlay = Platform.OS === "ios";
  const stepOneArtworkActionLabel = hasImportedArtwork ? "Change Artwork" : "Upload Artwork";
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
    setReadyGuidanceTargetId(null);
    setSetupSheetVisible(false);
    markSetupIntroSeen();
  }, [markSetupIntroSeen]);
  const handlePreviewAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setPreviewAreaSize((currentSize) =>
      Math.abs(currentSize.width - width) < 1 && Math.abs(currentSize.height - height) < 1
        ? currentSize
        : { width, height }
    );
  }, []);

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

  useEffect(() => {
    if (!shouldShowSetupGuidance || !activeGuidanceTargetId) {
      setReadyGuidanceTargetId(null);
      return;
    }

    setReadyGuidanceTargetId(null);
    setSetupSheetVisible(activeGuidanceTargetIsInSheet);

    const settleDelay = activeGuidanceTargetIsInSheet ? 320 : 140;
    const timeout = setTimeout(() => {
      setReadyGuidanceTargetId(activeGuidanceTargetId);
    }, settleDelay);

    return () => {
      clearTimeout(timeout);
    };
  }, [activeGuidanceTargetId, activeGuidanceTargetIsInSheet, shouldShowSetupGuidance]);

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

        <CanvasBackgroundColorPicker />

        {showStepOneArtworkOverlay ? (
          <ArtworkCanvasActionOverlay
            label={stepOneArtworkActionLabel}
            compact={isTabletPortrait}
            cornerInset={isTabletPortrait ? spacing.sm : undefined}
            onPress={openArtworkSourceChooser}
          />
        ) : null}
      </View>
    ),
    [
      hasImportedArtwork,
      isTabletPortrait,
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
      spacing.sm,
      stepOneArtworkActionLabel,
    ]
  );

  const setupSheetCompact = isTabletScreen;
  const setupFieldVariant = setupSheetCompact ? "compact" : "field";
  const setupSheetContentMaxWidth = setupSheetCompact
    ? isTabletLandscape
      ? 720
      : 680
    : undefined;

  const renderSetupCards = () => {
    const artworkSizeCard = (
      <GuidanceAnchor id="setup-artwork-size" style={{ width: "100%" }}>
        <AppCard title="Artwork size" compact={setupSheetCompact}>
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
                variant={setupFieldVariant}
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
                variant={setupFieldVariant}
              />
            </View>
          </View>
        </AppCard>
      </GuidanceAnchor>
    );

    const matWindowCard = (
      <GuidanceAnchor id="setup-mat-window-opening" style={{ width: "100%" }}>
        <AppCard title="Mat window opening" compact={setupSheetCompact}>
          <View
            style={{
              flexDirection: setupSheetCompact ? "row" : "column",
              gap: spacing.sm,
            }}
          >
            <View style={setupSheetCompact ? { flex: 1 } : undefined}>
              <SetupOptionRow
                label="Cover the edge slightly"
                selected={draft.reveal.openingBehavior === "overlap"}
                compact={setupSheetCompact}
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
            </View>
            <View style={setupSheetCompact ? { flex: 1 } : undefined}>
              <SetupOptionRow
                label="Show a border around the artwork"
                selected={draft.reveal.openingBehavior === "border"}
                compact={setupSheetCompact}
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
          </View>

          <GuidanceAnchor
            id="setup-visible-border"
            style={setupSheetCompact ? { width: "100%", maxWidth: 360 } : undefined}
          >
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
            ) : (
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
            )}
          </GuidanceAnchor>
        </AppCard>
      </GuidanceAnchor>
    );

    const outerMatCard = (
      <GuidanceAnchor id="setup-outer-mat-size" style={{ width: "100%" }}>
        <AppCard title="Outer mat size" compact={setupSheetCompact}>
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
                variant={setupFieldVariant}
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
                variant={setupFieldVariant}
              />
            </View>
          </View>
        </AppCard>
      </GuidanceAnchor>
    );

    return setupSheetCompact ? (
      <>
        {artworkSizeCard}
        {outerMatCard}
        {matWindowCard}
      </>
    ) : (
      <>
        {artworkSizeCard}
        {matWindowCard}
        {outerMatCard}
      </>
    );
  };

  const setupSheetMaxHeight = Math.min(windowHeight * 0.74, isTabletLandscape ? 680 : 620);

  return (
    <GuidanceProvider>
      <ScreenContainer>
        <AppHeader
          onOpenProjects={() => navigation.navigate("SavedProjects")}
          onOpenSettings={() => navigation.navigate("Settings")}
          projectGuidanceAnchorId="setup-folder-library"
          settingsGuidanceAnchorId="setup-main-settings"
        />

        <View
          style={{
            flex: 1,
            minHeight: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: workspaceVerticalPadding,
            paddingBottom: workspaceVerticalPadding,
          }}
        >
          <TabletWorkspaceContent
            mode={tabletWorkspaceMode}
            phoneContentMaxWidth={layout.contentMaxWidth}
          >
            <StepProgress
              currentStep={currentStep.stepNumber}
              totalSteps={totalSteps}
              label={currentStep.shortLabel}
              bottomSpacing={progressBottomSpacing}
            />

            <View style={{ flex: 1, minHeight: 0, gap: workspaceGap }}>
              <GuidanceAnchor
                id="setup-preview"
                style={{ flex: 1, minHeight: 0, justifyContent: "center" }}
              >
                <View
                  onLayout={handlePreviewAreaLayout}
                  style={{ flex: 1, minHeight: 0, justifyContent: "center" }}
                >
                  {renderStepOnePreview("workspace", previewCanvasHeight)}
                </View>
              </GuidanceAnchor>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Artwork Setup"
                onPress={() => setSetupSheetVisible(true)}
                style={({ pressed }) => ({
                  minHeight: 58,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: radii.xl,
                  backgroundColor: pressed ? colors.backgroundMuted : colors.backgroundCard,
                  paddingHorizontal: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                })}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="options-outline" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
                    Artwork Setup
                  </Text>
                  <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={1}>
                    Artwork size, mat window, border, and outer mat
                  </Text>
                </View>
                <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </TabletWorkspaceContent>
        </View>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.08)",
            backgroundColor: colors.headerBackground,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: isTabletLandscape
                ? TABLET_LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH
                : layout.contentMaxWidth,
              alignSelf: "center",
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: isTabletLandscape
                  ? TABLET_LANDSCAPE_CONTROLS_COLUMN_WIDTH
                  : undefined,
                alignSelf: "center",
                minHeight: 44,
                justifyContent: "center",
                position: "relative",
              }}
            >
              <GuidanceAnchor
                id="setup-next"
                style={{
                  width: "52%",
                  maxWidth: 360,
                  alignSelf: "center",
                }}
              >
                <AppButton label="Next" onPress={goNext} style={{ width: "100%" }} />
              </GuidanceAnchor>

              <GuidanceAnchor
                id="setup-room-view"
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                }}
              >
                <Pressable
                  onPress={() => navigation.navigate("RoomView")}
                  accessibilityRole="button"
                  accessibilityLabel="Open Wall View"
                  hitSlop={10}
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="home-outline" size={22} color={colors.textSecondary} />
                </Pressable>
              </GuidanceAnchor>
            </View>
          </View>
        </View>

        <SetupBottomSheet
          visible={setupSheetVisible}
          title="Artwork Setup"
          maxHeight={setupSheetMaxHeight}
          compact={setupSheetCompact}
          contentMaxWidth={setupSheetContentMaxWidth}
          onClose={() => setSetupSheetVisible(false)}
        >
          {renderSetupCards()}
        </SetupBottomSheet>
      </ScreenContainer>

      <GuidanceOverlay
        visible={guidanceOverlayVisible}
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
