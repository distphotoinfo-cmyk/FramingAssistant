import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
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
  TabletWorkspaceContent,
  getTabletWorkspaceMode,
  getTabletWorkspacePreviewCanvasHeight,
} from "../components/layout/TabletWorkspaceLayout";
import ArtworkCanvasActionOverlay from "../components/preview/ArtworkCanvasActionOverlay";
import CanvasBackgroundColorPicker from "../components/preview/CanvasBackgroundColorPicker";
import MatPreviewCanvas from "../components/preview/MatPreviewCanvas";
import AppButton from "../components/ui/AppButton";
import AppCard from "../components/ui/AppCard";
import AppSegmentedControl from "../components/ui/AppSegmentedControl";
import AppSheetModal from "../components/ui/AppSheetModal";
import ColorPickerField from "../components/ui/ColorPickerField";
import CompactOptionPicker from "../components/ui/CompactOptionPicker";
import { useStepNavigation } from "../hooks/useStepNavigation";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { createInitialPreviewDraft, useFramingFlowStore } from "../state/framingFlowStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FrameFamily, FrameFinishId, FrameProfileId, MatCoreColor } from "../types/framing";
import type { FramingRootStackParamList } from "../types/navigation";
import { getArtworkAspectRatio, isArtworkCropCompatible } from "../utils/artworkCrop";
import { importArtworkFromCamera, importArtworkFromLibrary } from "../utils/artworkImport";
import {
  getDefaultFinishForProfile,
  getFinishOptionsForProfile,
  getFrameProfile,
  resolveFrameColorHex,
} from "../utils/frameProfiles";
import { buildDerivedGeometry, calculateMargins } from "../utils/framingGeometry";
import {
  formatMeasurement,
  getSnapIncrement,
} from "../utils/formatters";

const BOARD_DEFAULT_COLORS = [
  "#FFFFFF",
  "#F8F6F0",
  "#F4F0E8",
  "#E7DED2",
  "#D8CCBE",
  "#C8CCC8",
  "#8E948F",
  "#252525",
  "#000000",
];
const PREVIEW_ADJUST_SHEET_GUIDANCE_TARGET_IDS = new Set([
  "preview-adjust-options-card",
  "preview-adjust-live-margins-card",
]);

type FrameStyleOptionId = "none" | FrameFamily;
type FrameProfilePickerValue = FrameProfileId | "notApplicable";

const MAT_CORE_OPTIONS: { label: string; value: MatCoreColor }[] = [
  { label: "White", value: "white" },
  { label: "Black", value: "black" },
];

const FRAME_STYLE_OPTIONS: { label: string; value: FrameStyleOptionId }[] = [
  { label: "No frame", value: "none" },
  { label: "Basic", value: "basic" },
  { label: "Nielsen Florentine", value: "nielsenFlorentine" },
  { label: "Nielsen Monochrome", value: "nielsenMonochrome" },
];

const FRAME_PROFILE_OPTIONS_BY_STYLE: Record<
  Exclude<FrameStyleOptionId, "none">,
  { label: string; value: FrameProfileId }[]
> = {
  basic: [
    { label: "Basic Thin - 7/16 in", value: "basicThin" },
    { label: "Basic Gallery - 3/4 in", value: "basicGallery" },
  ],
  nielsenFlorentine: [
    { label: "Profile 93 - 7/16 in", value: "nielsenFlorentine93" },
  ],
  nielsenMonochrome: [
  { label: "Profile 97 - 7/8 in", value: "nielsenMonochrome97" },
  ],
};

function DimensionChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.backgroundInput,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={{ ...typography.eyebrow, color: colors.textSecondary, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}

function FloatingPositionIconButton({
  icon,
  onPress,
  accessibilityLabel,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        backgroundColor: pressed ? colors.backgroundMuted : "transparent",
      })}
    >
      <Ionicons name={icon} size={20} color={color ?? colors.textPrimary} />
    </Pressable>
  );
}

function PanelControlRow({
  compact = false,
  children,
}: {
  compact?: boolean;
  children: React.ReactNode;
}) {
  const { colors, radii, spacing } = useAppTheme();

  return (
    <View
      style={{
        width: "100%",
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radii.md,
        backgroundColor: colors.backgroundCard,
        padding: compact ? spacing.sm : spacing.md,
      }}
    >
      {children}
    </View>
  );
}

function PreviewAdjustBottomSheet({
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

function getFrameStyleValue(
  frameFamily: FrameFamily,
  frameProfileId: FrameProfileId
): FrameStyleOptionId {
  if (frameProfileId === "basicNone") {
    return "none";
  }

  return frameFamily;
}

export default function PreviewAdjustScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const { currentStep, totalSteps, previousStep, goBack, goNext } =
    useStepNavigation("PreviewAdjust");
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const previewSnapIncrementInches = useAppSettingsStore((state) => state.previewSnapIncrementInches);
  const shouldShowPreviewAdjustGuidance = useAppSettingsStore(
    (state) => state.hasHydrated && !state.sessionHasSeenPreviewAdjustIntro
  );
  const matColorPresets = useAppSettingsStore((state) => state.matColorPresets);
  const saveMatColorPreset = useAppSettingsStore((state) => state.saveMatColorPreset);
  const markPreviewAdjustIntroSeen = useAppSettingsStore((state) => state.markPreviewAdjustIntroSeen);
  const draft = useFramingFlowStore((state) => state.draft);
  const setPreview = useFramingFlowStore((state) => state.setPreview);
  const { colors, layout, radii, spacing, typography } = useAppTheme();
  const [liveDragOffsets, setLiveDragOffsets] = useState<{ offsetX: number; offsetY: number } | null>(null);
  const [artworkSourceSheetVisible, setArtworkSourceSheetVisible] = useState(false);
  const [artworkFrameSheetVisible, setArtworkFrameSheetVisible] = useState(false);
  const [guidanceIndex, setGuidanceIndex] = useState(0);
  const [readyGuidanceTargetId, setReadyGuidanceTargetId] = useState<string | null>(null);
  const [previewAreaSize, setPreviewAreaSize] = useState({ width: 0, height: 0 });
  const lastLiveOffsetsUpdateRef = useRef(0);
  const preview = draft.preview ?? createInitialPreviewDraft();
  const tabletWorkspaceMode = getTabletWorkspaceMode(windowWidth, windowHeight);
  const isPhoneWorkspace = tabletWorkspaceMode === "phone";
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

  const derived = buildDerivedGeometry(draft);
  const artworkAspectRatio = getArtworkAspectRatio(derived.artworkSize);
  const snapIncrement = getSnapIncrement(unit, previewSnapIncrementInches);
  const visibleOffsets = liveDragOffsets ?? {
    offsetX: preview.offsetX,
    offsetY: preview.offsetY,
  };
  const liveMargins = useMemo(
    () =>
      calculateMargins(
        derived.outerMatSize,
        derived.openingSize,
        visibleOffsets.offsetX,
        visibleOffsets.offsetY
      ),
    [derived.openingSize, derived.outerMatSize, visibleOffsets.offsetX, visibleOffsets.offsetY]
  );
  const marginValue = (value: number | undefined) =>
    value === undefined ? "Not set" : formatMeasurement(value, unit, imperialPrecision);
  const usingImportedArtwork =
    preview.artworkSourceMode === "import" && Boolean(preview.artworkImageUri);
  const artworkCanvasActionLabel = usingImportedArtwork ? "Change Artwork" : "Upload Artwork";
  const cropNeedsReview =
    usingImportedArtwork &&
    !isArtworkCropCompatible(preview.artworkCrop, artworkAspectRatio);
  const selectedFrameProfile = useMemo(
    () => getFrameProfile(preview.frameProfileId),
    [preview.frameProfileId]
  );
  const frameFinishOptions = useMemo(
    () => getFinishOptionsForProfile(preview.frameProfileId),
    [preview.frameProfileId]
  );
  const resolvedFrameColorHex = resolveFrameColorHex(
    preview.frameProfileId,
    preview.frameFinishId,
    preview.frameColorHex
  );
  const frameColorPickerOptions = useMemo(() => {
    if (preview.frameProfileId === "basicNone") {
      return [{ label: "Not applicable", value: "notApplicable" }];
    }

    return frameFinishOptions;
  }, [frameFinishOptions, preview.frameProfileId]);
  const selectedFrameFinishId = (preview.frameFinishId ??
    selectedFrameProfile.defaultFinishId ??
    frameFinishOptions[0]?.value ??
    "florentineGrey") as FrameFinishId;
  const selectedFrameColorValue =
    preview.frameProfileId === "basicNone" ? "notApplicable" : selectedFrameFinishId;
  const selectedFrameStyleValue = getFrameStyleValue(
    preview.frameFamily,
    preview.frameProfileId
  );
  const frameProfilePickerOptions = useMemo<
    { label: string; value: FrameProfilePickerValue }[]
  >(
    () =>
      selectedFrameStyleValue === "none"
        ? [{ label: "Not applicable", value: "notApplicable" }]
        : FRAME_PROFILE_OPTIONS_BY_STYLE[selectedFrameStyleValue],
    [selectedFrameStyleValue]
  );
  const selectedFrameProfileValue: FrameProfilePickerValue =
    selectedFrameStyleValue === "none" ? "notApplicable" : preview.frameProfileId;
  const selectedFrameStyleLabel =
    FRAME_STYLE_OPTIONS.find((option) => option.value === selectedFrameStyleValue)?.label ??
    "No frame";
  const selectedFrameProfileLabel =
    frameProfilePickerOptions.find((option) => option.value === selectedFrameProfileValue)
      ?.label ?? "Not applicable";
  const selectedFrameFinishLabel =
    frameColorPickerOptions.find((option) => option.value === selectedFrameColorValue)?.label ??
    "Not applicable";
  const mattingSummary = `${preview.matThicknessPly} ply, ${
    preview.matCoreColor === "white" ? "white core" : "black core"
  }`;
  const framingSummary =
    selectedFrameStyleValue === "none"
      ? "No frame selected"
      : `${selectedFrameStyleLabel}, ${selectedFrameProfileLabel}, ${selectedFrameFinishLabel}`;
  const previewAdjustGuidanceItems = useMemo<GuidanceItem[]>(
    () => [
      {
        id: "preview-adjust-canvas-bubble",
        targetId: "preview-adjust-canvas",
        text: "Move the mat opening to adjust the borders around your artwork or add more weight to the bottom.",
        preferredPlacement: "bottom",
      },
      {
        id: "preview-adjust-tools-bubble",
        targetId: "preview-adjust-artwork-tools",
        text: "Re-center, adjust, and crop your artwork to refine the composition.",
        preferredPlacement: "top",
      },
      {
        id: "preview-adjust-upload-bubble",
        targetId: "preview-adjust-upload-artwork",
        text: "Upload the artwork you want to display inside the mat.",
        preferredPlacement: "top",
      },
      {
        id: "preview-adjust-options-bubble",
        targetId: "preview-adjust-options-card",
        text: "Adjust your mat thickness and color, then choose your frame style and finish.",
        preferredPlacement: "top",
      },
      {
        id: "preview-adjust-live-margins-bubble",
        targetId: "preview-adjust-live-margins-card",
        text: "These are the final mat margins to cut for your print.",
        preferredPlacement: "top",
      },
      {
        id: "preview-adjust-next-bubble",
        targetId: "preview-adjust-next",
        text: "When the preview looks right, continue to the final specs.",
        preferredPlacement: "top",
      },
    ],
    []
  );
  const activeGuidanceTargetId = previewAdjustGuidanceItems[guidanceIndex]?.targetId ?? null;
  const activeGuidanceTargetIsInSheet = activeGuidanceTargetId
    ? PREVIEW_ADJUST_SHEET_GUIDANCE_TARGET_IDS.has(activeGuidanceTargetId)
    : false;
  const previewAdjustGuidanceVisible =
    shouldShowPreviewAdjustGuidance && readyGuidanceTargetId === activeGuidanceTargetId;

  useEffect(() => {
    if (
      liveDragOffsets &&
      liveDragOffsets.offsetX === preview.offsetX &&
      liveDragOffsets.offsetY === preview.offsetY
    ) {
      setLiveDragOffsets(null);
    }
  }, [liveDragOffsets, preview.offsetX, preview.offsetY]);

  useEffect(() => {
    if (selectedFrameProfile.finishIds.length === 0) {
      return;
    }

    if (resolvedFrameColorHex !== preview.frameColorHex) {
      setPreview({ frameColorHex: resolvedFrameColorHex });
    }
  }, [
    preview.frameColorHex,
    resolvedFrameColorHex,
    selectedFrameProfile.finishIds.length,
    setPreview,
  ]);

  const handleLiveOffsetsChange = useCallback((offsetX: number, offsetY: number) => {
    const now = Date.now();

    if (now - lastLiveOffsetsUpdateRef.current < 48) {
      return;
    }

    lastLiveOffsetsUpdateRef.current = now;
    setLiveDragOffsets({ offsetX, offsetY });
  }, []);

  const handleCommittedOffsets = useCallback(
    (offsetX: number, offsetY: number) => {
      lastLiveOffsetsUpdateRef.current = Date.now();
      setLiveDragOffsets({ offsetX, offsetY });
      setPreview({ offsetX, offsetY });
    },
    [setPreview]
  );

  const openCropEditor = useCallback(
    (
      imageUri: string,
      imageWidth?: number | null,
      imageHeight?: number | null,
      mode: "import" | "edit" = "import"
    ) => {
      navigation.navigate("ArtworkCrop", {
        imageUri,
        imageWidth: imageWidth ?? null,
        imageHeight: imageHeight ?? null,
        mode,
      });
    },
    [navigation]
  );

  const handlePickFromLibrary = useCallback(async () => {
    await importArtworkFromLibrary(({ imageUri, imageWidth, imageHeight }) => {
      openCropEditor(imageUri, imageWidth, imageHeight, "import");
    });
  }, [openCropEditor]);

  const handleTakePhoto = useCallback(async () => {
    await importArtworkFromCamera(({ imageUri, imageWidth, imageHeight }) => {
      openCropEditor(imageUri, imageWidth, imageHeight, "import");
    });
  }, [openCropEditor]);

  const handleEditCrop = useCallback(() => {
    if (!preview.artworkImageUri) {
      return;
    }

    openCropEditor(
      preview.artworkImageUri,
      preview.artworkCrop?.sourceWidth ?? null,
      preview.artworkCrop?.sourceHeight ?? null,
      "edit"
    );
  }, [
    openCropEditor,
    preview.artworkCrop?.sourceHeight,
    preview.artworkCrop?.sourceWidth,
    preview.artworkImageUri,
  ]);

  const openArtworkSourceChooser = useCallback(() => {
    if (!artworkAspectRatio) {
      Alert.alert(
        "Artwork size needed",
        "Set the artwork width and height first so Framing Assistant can lock the crop ratio correctly."
      );
      return;
    }

    if (Platform.OS === "ios") {
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
      return;
    }

    setArtworkSourceSheetVisible(true);
  }, [artworkAspectRatio, colors.background, handlePickFromLibrary, handleTakePhoto]);

  const handleFramePresetChange = useCallback(
    (frameProfileId: FrameProfileId) => {
      const profile = getFrameProfile(frameProfileId);
      const frameFinishId = getDefaultFinishForProfile(frameProfileId);

      setPreview({
        frameFamily: profile.family,
        frameProfileId,
        frameFinishId,
        frameColorHex: resolveFrameColorHex(frameProfileId, frameFinishId, preview.frameColorHex),
      });
    },
    [preview.frameColorHex, setPreview]
  );

  const handleFrameStyleChange = useCallback(
    (frameStyle: FrameStyleOptionId) => {
      if (frameStyle === "none") {
        setPreview({
          frameFamily: "basic",
          frameProfileId: "basicNone",
          frameFinishId: null,
          frameColorHex: resolveFrameColorHex("basicNone", null, preview.frameColorHex),
        });
        return;
      }

      const nextProfileId =
        frameStyle === "basic"
          ? preview.frameFamily === "basic" && preview.frameProfileId !== "basicNone"
            ? preview.frameProfileId
            : "basicThin"
          : frameStyle === "nielsenFlorentine"
            ? "nielsenFlorentine93"
            : "nielsenMonochrome97";

      handleFramePresetChange(nextProfileId);
    },
    [handleFramePresetChange, preview.frameColorHex, preview.frameFamily, preview.frameProfileId, setPreview]
  );

  const handleFrameFinishChange = useCallback(
    (frameFinishId: FrameFinishId) => {
      setPreview({
        frameFinishId,
        frameColorHex: resolveFrameColorHex(preview.frameProfileId, frameFinishId, preview.frameColorHex),
      });
    },
    [preview.frameColorHex, preview.frameProfileId, setPreview]
  );

  const handleAdvanceGuidance = useCallback(() => {
    setGuidanceIndex((current) => Math.min(current + 1, previewAdjustGuidanceItems.length - 1));
  }, [previewAdjustGuidanceItems.length]);

  const handleCloseGuidance = useCallback(() => {
    setReadyGuidanceTargetId(null);
    setArtworkFrameSheetVisible(false);
    markPreviewAdjustIntroSeen();
  }, [markPreviewAdjustIntroSeen]);

  const handlePreviewAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setPreviewAreaSize((currentSize) =>
      Math.abs(currentSize.width - width) < 1 && Math.abs(currentSize.height - height) < 1
        ? currentSize
        : { width, height }
    );
  }, []);

  useEffect(() => {
    if (shouldShowPreviewAdjustGuidance) {
      setGuidanceIndex(0);
    }
  }, [shouldShowPreviewAdjustGuidance]);

  useEffect(() => {
    if (!shouldShowPreviewAdjustGuidance || !activeGuidanceTargetId) {
      setReadyGuidanceTargetId(null);
      return;
    }

    setReadyGuidanceTargetId(null);
    setArtworkFrameSheetVisible(activeGuidanceTargetIsInSheet);

    const settleDelay = activeGuidanceTargetIsInSheet ? 320 : 140;
    const timeout = setTimeout(() => {
      setReadyGuidanceTargetId(activeGuidanceTargetId);
    }, settleDelay);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    activeGuidanceTargetId,
    activeGuidanceTargetIsInSheet,
    shouldShowPreviewAdjustGuidance,
  ]);

  const positioningToolbarSection = (
    <GuidanceAnchor
      id="preview-adjust-artwork-tools"
      style={{
        position: "absolute",
        alignSelf: "center",
        bottom: spacing.sm,
        zIndex: 5,
      }}
    >
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: radii.pill,
          backgroundColor: colors.headerBackground,
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.xs,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          shadowColor: "#000",
          shadowOpacity: 0.24,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <FloatingPositionIconButton
          icon="swap-horizontal"
          accessibilityLabel="Re-center horizontally"
          onPress={() => setPreview({ offsetX: 0 })}
        />
        <FloatingPositionIconButton
          icon="swap-vertical"
          accessibilityLabel="Re-center vertically"
          onPress={() => setPreview({ offsetY: 0 })}
        />
        <FloatingPositionIconButton
          icon="locate-outline"
          accessibilityLabel="Re-center all"
          onPress={() => setPreview({ offsetX: 0, offsetY: 0 })}
        />
        {usingImportedArtwork ? (
          <FloatingPositionIconButton
            icon="crop-outline"
            accessibilityLabel={cropNeedsReview ? "Review crop" : "Edit crop"}
            onPress={handleEditCrop}
            color={cropNeedsReview ? colors.warning : colors.textPrimary}
          />
        ) : null}
      </View>
    </GuidanceAnchor>
  );

  const previewCanvasSection = (
    <GuidanceAnchor
      id="preview-adjust-canvas"
      style={{ flex: 1, minHeight: 0, justifyContent: "center" }}
    >
      <View
        onLayout={handlePreviewAreaLayout}
        style={{
          flex: 1,
          minHeight: 0,
          justifyContent: "center",
          position: "relative",
        }}
      >
        <View style={{ position: "relative" }}>
          <MatPreviewCanvas
            artworkSize={derived.artworkSize}
            openingSize={derived.openingSize}
            outerMatSize={derived.outerMatSize}
            frameProfileId={preview.frameProfileId}
            frameColorHex={resolvedFrameColorHex}
            matThicknessPly={preview.matThicknessPly}
            matColorHex={preview.matColorHex}
            matCoreColor={preview.matCoreColor}
            mountingBoardColorHex={preview.mountingBoardColorHex}
            offsetX={preview.offsetX}
            offsetY={preview.offsetY}
            snapIncrement={snapIncrement}
            artworkSourceMode={preview.artworkSourceMode}
            artworkImageUri={preview.artworkImageUri}
            artworkCrop={preview.artworkCrop}
            onAdjustOffsets={handleCommittedOffsets}
            onLiveOffsetsChange={handleLiveOffsetsChange}
            canvasHeight={previewCanvasHeight}
            layoutVariant="workspace"
          />
          <CanvasBackgroundColorPicker compact={isPhoneWorkspace} />
          <ArtworkCanvasActionOverlay
            guidanceId="preview-adjust-upload-artwork"
            label={artworkCanvasActionLabel}
            compact={isPhoneWorkspace || isTabletPortrait}
            mini={isPhoneWorkspace}
            placement="overlay"
            cornerInset={isPhoneWorkspace || isTabletPortrait ? spacing.sm : undefined}
            onPress={openArtworkSourceChooser}
          />
        </View>
        {positioningToolbarSection}
      </View>
    </GuidanceAnchor>
  );

  const previewWarningSection = !derived.isValidGeometry ? (
    <Text style={{ ...typography.small, color: colors.warning, textAlign: "center" }}>
      Outer mat size needs to be larger than the opening size before the preview can be trusted.
    </Text>
  ) : null;

  const artworkFrameSheetCompact = tabletWorkspaceMode !== "phone";
  const artworkFrameSheetContentMaxWidth = artworkFrameSheetCompact
    ? isTabletLandscape
      ? 860
      : 760
    : undefined;
  const mattingControls = (
    <>
      <PanelControlRow compact={artworkFrameSheetCompact}>
        <ColorPickerField
          label="Mat color"
          title="Mat color"
          value={preview.matColorHex}
          defaultColors={BOARD_DEFAULT_COLORS}
          customPresets={matColorPresets}
          onChange={(matColorHex) => setPreview({ matColorHex })}
          onSavePreset={saveMatColorPreset}
        />
      </PanelControlRow>

      <PanelControlRow compact={artworkFrameSheetCompact}>
        <AppSegmentedControl
          label="Mat core"
          options={MAT_CORE_OPTIONS}
          value={preview.matCoreColor}
          onChange={(matCoreColor) => setPreview({ matCoreColor })}
        />
      </PanelControlRow>

      <PanelControlRow compact={artworkFrameSheetCompact}>
        <ColorPickerField
          label="Mount board color"
          title="Mount board color"
          value={preview.mountingBoardColorHex}
          defaultColors={BOARD_DEFAULT_COLORS}
          customPresets={matColorPresets}
          onChange={(mountingBoardColorHex) => setPreview({ mountingBoardColorHex })}
          onSavePreset={saveMatColorPreset}
        />
      </PanelControlRow>

      <PanelControlRow compact={artworkFrameSheetCompact}>
        <CompactOptionPicker
          label="Mat thickness"
          title="Mat thickness"
          value={String(preview.matThicknessPly) as "2" | "4" | "6" | "8"}
          onChange={(value) =>
            setPreview({
              matThicknessPly: Number(value) as 2 | 4 | 6 | 8,
            })
          }
          options={[
            { label: "2 ply", value: "2" },
            { label: "4 ply", value: "4" },
            { label: "6 ply", value: "6" },
            { label: "8 ply", value: "8" },
          ]}
        />
      </PanelControlRow>
    </>
  );
  const frameControls = (
    <>
      <PanelControlRow compact={artworkFrameSheetCompact}>
        <CompactOptionPicker
          label="Frame family / style"
          title="Frame family / style"
          value={selectedFrameStyleValue}
          onChange={handleFrameStyleChange}
          options={FRAME_STYLE_OPTIONS}
        />
      </PanelControlRow>

      <PanelControlRow compact={artworkFrameSheetCompact}>
        <CompactOptionPicker
          label="Frame profile / width"
          title="Frame profile / width"
          value={selectedFrameProfileValue}
          onChange={(value) => {
            if (value === "notApplicable") {
              return;
            }

            handleFramePresetChange(value);
          }}
          options={frameProfilePickerOptions}
          disabled={selectedFrameStyleValue === "none"}
        />
      </PanelControlRow>

      <PanelControlRow compact={artworkFrameSheetCompact}>
        <CompactOptionPicker
          label="Frame finish / color"
          title="Frame finish / color"
          value={selectedFrameColorValue}
          onChange={(value) => {
            if (value === "notApplicable") {
              return;
            }

            handleFrameFinishChange(value as FrameFinishId);
          }}
          options={frameColorPickerOptions}
          disabled={selectedFrameStyleValue === "none"}
        />
      </PanelControlRow>
    </>
  );
  const optionsCardSection = (
    <GuidanceAnchor id="preview-adjust-options-card">
      <AppCard title="Matting & Framing" compact={artworkFrameSheetCompact}>
        {artworkFrameSheetCompact ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Text style={{ ...typography.eyebrow, color: colors.textSecondary }}>
                Mat settings
              </Text>
              {mattingControls}
            </View>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Text style={{ ...typography.eyebrow, color: colors.textSecondary }}>
                Frame settings
              </Text>
              {frameControls}
            </View>
          </View>
        ) : (
          <>
            <Text style={{ ...typography.eyebrow, color: colors.textSecondary }}>
              Matting
            </Text>
            {mattingControls}

            <Text style={{ ...typography.eyebrow, color: colors.textSecondary }}>
              Framing
            </Text>
            {frameControls}
          </>
        )}
      </AppCard>
    </GuidanceAnchor>
  );

  const liveMarginsCardSection = (
    <GuidanceAnchor id="preview-adjust-live-margins-card">
      <AppCard title="Live margins" compact={artworkFrameSheetCompact}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <DimensionChip label="Top" value={marginValue(liveMargins?.top)} />
          <DimensionChip label="Right" value={marginValue(liveMargins?.right)} />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <DimensionChip label="Bottom" value={marginValue(liveMargins?.bottom)} />
          <DimensionChip label="Left" value={marginValue(liveMargins?.left)} />
        </View>
      </AppCard>
    </GuidanceAnchor>
  );

  const artworkFrameSheetMaxHeight = Math.min(windowHeight * 0.76, isTabletLandscape ? 700 : 640);

  return (
    <GuidanceProvider>
      <ScreenContainer>
        <AppHeader
          onOpenProjects={() => navigation.navigate("SavedProjects")}
          onOpenSettings={() => navigation.navigate("Settings")}
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
              {previewCanvasSection}
              {previewWarningSection}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Framing Materials settings"
                onPress={() => setArtworkFrameSheetVisible(true)}
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
                  <Ionicons name="color-palette-outline" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
                    Framing Materials
                  </Text>
                  <Text
                    style={{ ...typography.small, color: colors.textSecondary }}
                    numberOfLines={1}
                  >
                    {mattingSummary} · {framingSummary}
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
              {previousStep ? (
                <Pressable
                  onPress={goBack}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  hitSlop={10}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
                </Pressable>
              ) : null}

              <GuidanceAnchor
                id="preview-adjust-next"
                style={{
                  width: "52%",
                  maxWidth: 360,
                  alignSelf: "center",
                }}
              >
                <AppButton label="Next" onPress={goNext} style={{ width: "100%" }} />
              </GuidanceAnchor>

              <Pressable
                onPress={() => navigation.navigate("RoomView")}
                accessibilityRole="button"
                accessibilityLabel="Open Wall View"
                hitSlop={10}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="home-outline" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>

        <PreviewAdjustBottomSheet
          visible={artworkFrameSheetVisible}
          title="Framing Materials"
          maxHeight={artworkFrameSheetMaxHeight}
          compact={artworkFrameSheetCompact}
          contentMaxWidth={artworkFrameSheetContentMaxWidth}
          onClose={() => setArtworkFrameSheetVisible(false)}
        >
          {liveMarginsCardSection}
          {optionsCardSection}
        </PreviewAdjustBottomSheet>

        <AppSheetModal
          visible={artworkSourceSheetVisible}
          title="Upload artwork"
          onClose={() => setArtworkSourceSheetVisible(false)}
        >
          <Pressable
            onPress={() => {
              setArtworkSourceSheetVisible(false);
              setTimeout(() => {
                void handlePickFromLibrary();
              }, 220);
            }}
            style={{
              minHeight: 46,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              borderRadius: radii.md,
              backgroundColor: colors.backgroundInput,
              paddingHorizontal: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="images-outline" size={18} color={colors.textPrimary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>
                Photo Library
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => {
              setArtworkSourceSheetVisible(false);
              setTimeout(() => {
                void handleTakePhoto();
              }, 220);
            }}
            style={{
              minHeight: 46,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              borderRadius: radii.md,
              backgroundColor: colors.backgroundInput,
              paddingHorizontal: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="camera-outline" size={18} color={colors.textPrimary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>
                Take Photo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        </AppSheetModal>
      </ScreenContainer>

      <GuidanceOverlay
        visible={previewAdjustGuidanceVisible}
        items={previewAdjustGuidanceItems}
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
