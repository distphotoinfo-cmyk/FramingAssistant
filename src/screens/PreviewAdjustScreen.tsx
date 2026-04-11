import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  InteractionManager,
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
import FlowStepLayout from "../components/FlowStepLayout";
import GuidanceAnchor from "../components/guidance/GuidanceAnchor";
import GuidanceOverlay, { type GuidanceItem } from "../components/guidance/GuidanceOverlay";
import { GuidanceProvider } from "../components/guidance/GuidanceProvider";
import MatPreviewCanvas from "../components/preview/MatPreviewCanvas";
import AppCard from "../components/ui/AppCard";
import AppSegmentedControl from "../components/ui/AppSegmentedControl";
import AppSheetModal from "../components/ui/AppSheetModal";
import ColorPickerField from "../components/ui/ColorPickerField";
import CompactOptionPicker from "../components/ui/CompactOptionPicker";
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

const MAT_DEFAULT_COLORS = [
  "#F4F0E8",
  "#E7DED2",
  "#D8CCBE",
  "#C8CCC8",
  "#252525",
];
const MOUNTING_BOARD_DEFAULT_COLORS = [
  "#FFFFFF",
  "#F4F0E8",
  "#E7DED2",
  "#C8CCC8",
  "#252525",
];
const GUIDANCE_SCROLL_SETTLE_DELAY_MS = 240;
const GUIDANCE_SCROLL_FALLBACK_DELAY_MS = 900;
const GUIDANCE_SCROLL_MIN_DELTA = 12;
const TABLET_WIDTH_BREAKPOINT = 768;
const LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH = 1180;
const LANDSCAPE_CONTROLS_COLUMN_WIDTH = 408;

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

function HeaderToolIconButton({
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
  const { colors, radii } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: pressed ? colors.backgroundCard : colors.backgroundInput,
      })}
    >
      <Ionicons name={icon} size={19} color={color ?? colors.textSecondary} />
    </Pressable>
  );
}

function DetailSheetLauncher({
  label,
  summary,
  onPress,
}: {
  label: string;
  summary: string;
  onPress: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 64,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        backgroundColor: colors.backgroundInput,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
          {label}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          {summary}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function PanelControlRow({ children }: { children: React.ReactNode }) {
  const { colors, radii, spacing } = useAppTheme();

  return (
    <View
      style={{
        width: "100%",
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radii.md,
        backgroundColor: colors.backgroundCard,
        padding: spacing.md,
      }}
    >
      {children}
    </View>
  );
}

function SheetFormContent({ children }: { children: React.ReactNode }) {
  const { spacing } = useAppTheme();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ maxHeight: 520 }}
      contentContainerStyle={{
        gap: spacing.md,
        paddingBottom: spacing.xs,
      }}
    >
      {children}
    </ScrollView>
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
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
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
  const { colors, radii, spacing, typography } = useAppTheme();
  const [liveDragOffsets, setLiveDragOffsets] = useState<{ offsetX: number; offsetY: number } | null>(null);
  const [artworkSourceSheetVisible, setArtworkSourceSheetVisible] = useState(false);
  const [mattingSheetVisible, setMattingSheetVisible] = useState(false);
  const [framingSheetVisible, setFramingSheetVisible] = useState(false);
  const [guidanceIndex, setGuidanceIndex] = useState(0);
  const [isGuidanceAutoScrolling, setIsGuidanceAutoScrolling] = useState(false);
  const lastLiveOffsetsUpdateRef = useRef(0);
  const previewAdjustScrollRef = useRef<ScrollView | null>(null);
  const lowerControlsAnchorYRef = useRef<number | null>(null);
  const currentScrollOffsetYRef = useRef(0);
  const pendingGuidanceResumeIndexRef = useRef<number | null>(null);
  const guidanceScrollFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidanceSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidanceAfterInteractionsRef =
    useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const preview = draft.preview ?? createInitialPreviewDraft();
  const isTabletLandscape =
    Math.min(windowWidth, windowHeight) >= TABLET_WIDTH_BREAKPOINT && windowWidth > windowHeight;
  const landscapePreviewHeight = Math.min(Math.max(windowHeight - 280, 460), 620);

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
  const previewAdjustGuidanceVisible =
    shouldShowPreviewAdjustGuidance && !isGuidanceAutoScrolling;
  const previewAdjustGuidanceItems = useMemo<GuidanceItem[]>(
    () => [
      {
        id: "preview-adjust-canvas-bubble",
        targetId: "preview-adjust-canvas",
        text: "Move the mat opening to adjust the borders around your artwork or add more weight to the bottom.",
        preferredPlacement: "bottom",
      },
      {
        id: "preview-adjust-upload-bubble",
        targetId: "preview-adjust-upload-artwork",
        text: "Upload the artwork you want to display inside the mat.",
        preferredPlacement: "bottom",
      },
      {
        id: "preview-adjust-tools-bubble",
        targetId: "preview-adjust-artwork-tools",
        text: "Re-center, adjust, and crop your artwork to refine the composition.",
        preferredPlacement: "bottom",
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
    ],
    []
  );

  const clearGuidanceScrollWait = useCallback(() => {
    if (guidanceScrollFallbackTimeoutRef.current) {
      clearTimeout(guidanceScrollFallbackTimeoutRef.current);
      guidanceScrollFallbackTimeoutRef.current = null;
    }

    if (guidanceSettleTimeoutRef.current) {
      clearTimeout(guidanceSettleTimeoutRef.current);
      guidanceSettleTimeoutRef.current = null;
    }

    guidanceAfterInteractionsRef.current?.cancel();
    guidanceAfterInteractionsRef.current = null;
  }, []);

  const finishGuidanceAutoScroll = useCallback(() => {
    const nextIndex = pendingGuidanceResumeIndexRef.current;

    if (nextIndex === null) {
      return;
    }

    clearGuidanceScrollWait();
    guidanceAfterInteractionsRef.current = InteractionManager.runAfterInteractions(() => {
      guidanceSettleTimeoutRef.current = setTimeout(() => {
        pendingGuidanceResumeIndexRef.current = null;
        setGuidanceIndex(nextIndex);
        setIsGuidanceAutoScrolling(false);
      }, GUIDANCE_SCROLL_SETTLE_DELAY_MS);
    });
  }, [clearGuidanceScrollWait]);

  const beginGuidanceAutoScroll = useCallback(
    (nextIndex: number) => {
      pendingGuidanceResumeIndexRef.current = nextIndex;
      setIsGuidanceAutoScrolling(true);
      clearGuidanceScrollWait();

      const scrollTargetY = lowerControlsAnchorYRef.current;
      const targetOffsetY = Math.max(0, (scrollTargetY ?? 0) - spacing.md);
      const scrollView = previewAdjustScrollRef.current;

      if (!scrollView) {
        finishGuidanceAutoScroll();
        return;
      }

      if (
        scrollTargetY !== null &&
        Math.abs(targetOffsetY - currentScrollOffsetYRef.current) <= GUIDANCE_SCROLL_MIN_DELTA
      ) {
        finishGuidanceAutoScroll();
        return;
      }

      guidanceScrollFallbackTimeoutRef.current = setTimeout(() => {
        finishGuidanceAutoScroll();
      }, GUIDANCE_SCROLL_FALLBACK_DELAY_MS);

      requestAnimationFrame(() => {
        if (scrollTargetY === null) {
          scrollView.scrollToEnd({ animated: true });
          return;
        }

        scrollView.scrollTo({ y: targetOffsetY, animated: true });
      });
    },
    [clearGuidanceScrollWait, finishGuidanceAutoScroll, spacing.md]
  );

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
    if (guidanceIndex === 0) {
      beginGuidanceAutoScroll(1);
      return;
    }

    setGuidanceIndex((current) => Math.min(current + 1, previewAdjustGuidanceItems.length - 1));
  }, [beginGuidanceAutoScroll, guidanceIndex, previewAdjustGuidanceItems.length]);

  const handleCloseGuidance = useCallback(() => {
    pendingGuidanceResumeIndexRef.current = null;
    clearGuidanceScrollWait();
    setIsGuidanceAutoScrolling(false);
    markPreviewAdjustIntroSeen();
  }, [clearGuidanceScrollWait, markPreviewAdjustIntroSeen]);

  const handlePreviewAdjustScroll = useCallback<NonNullable<React.ComponentProps<typeof FlowStepLayout>["onScroll"]>>(
    (event) => {
      currentScrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  const handlePreviewAdjustMomentumScrollEnd = useCallback<
    NonNullable<React.ComponentProps<typeof FlowStepLayout>["onMomentumScrollEnd"]>
  >(
    (event) => {
      currentScrollOffsetYRef.current = event.nativeEvent.contentOffset.y;

      if (pendingGuidanceResumeIndexRef.current !== null) {
        finishGuidanceAutoScroll();
      }
    },
    [finishGuidanceAutoScroll]
  );

  const handleLowerControlsAnchorLayout = useCallback((event: LayoutChangeEvent) => {
    lowerControlsAnchorYRef.current = event.nativeEvent.layout.y;
  }, []);

  useEffect(() => {
    if (shouldShowPreviewAdjustGuidance) {
      pendingGuidanceResumeIndexRef.current = null;
      clearGuidanceScrollWait();
      setGuidanceIndex(0);
      setIsGuidanceAutoScrolling(false);
    }
  }, [clearGuidanceScrollWait, shouldShowPreviewAdjustGuidance]);

  useEffect(() => () => {
    pendingGuidanceResumeIndexRef.current = null;
    clearGuidanceScrollWait();
  }, [clearGuidanceScrollWait]);

  const previewCanvasSection = (
    <GuidanceAnchor id="preview-adjust-canvas">
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
        canvasHeight={isTabletLandscape ? landscapePreviewHeight : undefined}
        layoutVariant={isTabletLandscape ? "workspace" : "default"}
      />
    </GuidanceAnchor>
  );

  const previewWarningSection = !derived.isValidGeometry ? (
    <Text style={{ ...typography.small, color: colors.warning, textAlign: "center" }}>
      Outer mat size needs to be larger than the opening size before the preview can be trusted.
    </Text>
  ) : null;

  const artworkCardSection = (
    <AppCard
      title="Artwork"
      headerAccessory={
        <GuidanceAnchor id="preview-adjust-artwork-tools">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <HeaderToolIconButton
              icon="swap-horizontal"
              accessibilityLabel="Re-center horizontally"
              onPress={() => setPreview({ offsetX: 0 })}
            />
            <HeaderToolIconButton
              icon="swap-vertical"
              accessibilityLabel="Re-center vertically"
              onPress={() => setPreview({ offsetY: 0 })}
            />
            <HeaderToolIconButton
              icon="locate-outline"
              accessibilityLabel="Re-center all"
              onPress={() => setPreview({ offsetX: 0, offsetY: 0 })}
            />
            {usingImportedArtwork ? (
              <HeaderToolIconButton
                icon="crop-outline"
                accessibilityLabel={cropNeedsReview ? "Review crop" : "Edit crop"}
                onPress={handleEditCrop}
                color={cropNeedsReview ? colors.warning : colors.textSecondary}
              />
            ) : null}
          </View>
        </GuidanceAnchor>
      }
    >
      <GuidanceAnchor id="preview-adjust-upload-artwork">
        <Pressable
          onPress={openArtworkSourceChooser}
          style={{
            minHeight: 42,
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
            <Ionicons name="image-outline" size={16} color={colors.textPrimary} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>
              Upload Artwork
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </Pressable>
      </GuidanceAnchor>
    </AppCard>
  );

  const optionsCardSection = (
    <GuidanceAnchor id="preview-adjust-options-card">
      <AppCard title="Matting & Framing">
        <DetailSheetLauncher
          label="Matting"
          summary={mattingSummary}
          onPress={() => setMattingSheetVisible(true)}
        />

        <DetailSheetLauncher
          label="Framing"
          summary={framingSummary}
          onPress={() => setFramingSheetVisible(true)}
        />
      </AppCard>
    </GuidanceAnchor>
  );

  const liveMarginsCardSection = (
    <GuidanceAnchor id="preview-adjust-live-margins-card">
      <AppCard title="Live margins">
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

  return (
    <GuidanceProvider>
      <FlowStepLayout
        route="PreviewAdjust"
        title="Preview and Adjust"
        nextLabel="View Final Specs"
        footerVariant="compactBackArrow"
        scrollViewRef={previewAdjustScrollRef}
        onScroll={handlePreviewAdjustScroll}
        onMomentumScrollEnd={handlePreviewAdjustMomentumScrollEnd}
        scrollEventThrottle={16}
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
              {previewCanvasSection}
              {previewWarningSection}
            </View>

            <View
              onLayout={handleLowerControlsAnchorLayout}
              style={{
                width: LANDSCAPE_CONTROLS_COLUMN_WIDTH,
                maxWidth: "40%",
                flexShrink: 0,
                marginTop: spacing.xxl,
                gap: spacing.lg,
              }}
            >
              {artworkCardSection}
              {optionsCardSection}
              {liveMarginsCardSection}
            </View>
          </View>
        ) : (
          <>
            {previewCanvasSection}
            {previewWarningSection}
            <View onLayout={handleLowerControlsAnchorLayout}>
              {artworkCardSection}
            </View>
            {optionsCardSection}
            {liveMarginsCardSection}
          </>
        )}

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

        <AppSheetModal
          visible={mattingSheetVisible}
          title="Matting"
          onClose={() => setMattingSheetVisible(false)}
          showDoneButton
        >
          <SheetFormContent>
            <PanelControlRow>
              <ColorPickerField
                label="Mat color"
                title="Mat color"
                value={preview.matColorHex}
                defaultColors={MAT_DEFAULT_COLORS}
                customPresets={matColorPresets}
                onChange={(matColorHex) => setPreview({ matColorHex })}
                onSavePreset={saveMatColorPreset}
              />
            </PanelControlRow>

            <PanelControlRow>
              <AppSegmentedControl
                label="Mat core"
                options={MAT_CORE_OPTIONS}
                value={preview.matCoreColor}
                onChange={(matCoreColor) => setPreview({ matCoreColor })}
              />
            </PanelControlRow>

            <PanelControlRow>
              <ColorPickerField
                label="Mount board color"
                title="Mount board color"
                value={preview.mountingBoardColorHex}
                defaultColors={MOUNTING_BOARD_DEFAULT_COLORS}
                customPresets={matColorPresets}
                onChange={(mountingBoardColorHex) => setPreview({ mountingBoardColorHex })}
                onSavePreset={saveMatColorPreset}
              />
            </PanelControlRow>

            <PanelControlRow>
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
          </SheetFormContent>
        </AppSheetModal>

        <AppSheetModal
          visible={framingSheetVisible}
          title="Framing"
          onClose={() => setFramingSheetVisible(false)}
          showDoneButton
        >
          <SheetFormContent>
            <PanelControlRow>
              <CompactOptionPicker
                label="Frame family / style"
                title="Frame family / style"
                value={selectedFrameStyleValue}
                onChange={handleFrameStyleChange}
                options={FRAME_STYLE_OPTIONS}
              />
            </PanelControlRow>

            <PanelControlRow>
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

            <PanelControlRow>
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
          </SheetFormContent>
        </AppSheetModal>
      </FlowStepLayout>

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
