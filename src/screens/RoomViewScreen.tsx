import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle as SvgCircle,
  Image as SvgImage,
  Line as SvgLine,
  Rect as SvgRect,
} from "react-native-svg";
import AppHeader from "../components/AppHeader";
import ScreenContainer from "../components/ScreenContainer";
import { FinishedFramedArtwork } from "../components/preview/MatPreviewCanvas";
import PresetRoomSceneImage from "../components/room/PresetRoomSceneImage";
import AppButton from "../components/ui/AppButton";
import AppCard from "../components/ui/AppCard";
import AppSegmentedControl from "../components/ui/AppSegmentedControl";
import AppSheetModal from "../components/ui/AppSheetModal";
import AppTextField from "../components/ui/AppTextField";
import {
  DEFAULT_PRESET_ROOM_SCENE_ID,
  PRESET_ROOM_SCENES,
  ROOM_SCENE_ORIENTATION_LABELS,
  getPresetRoomScenesByOrientation,
  getPresetRoomSceneById,
  type RegisteredRoomPresetScene,
} from "../data/presetRoomScenes";
import { useAppSettingsStore } from "../state/appSettingsStore";
import {
  createInitialRoomViewDraft,
  createRoomArtworkPlacement,
  useFramingFlowStore,
} from "../state/framingFlowStore";
import { useSavedProjectsStore, type SavedFramedArtwork } from "../state/savedProjectsStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type {
  ArtworkCropState,
  MeasurementUnit,
  FractionDenominator,
  PreviewDraft,
  RoomArtworkPlacementDraft,
  RoomEnvironmentLighting,
  RoomKnownMeasurementMode,
  RoomMaterialRealismDraft,
  RoomWallShadowDraft,
  RoomViewRect,
  RoomViewPoint,
  RoomViewSourceMode,
} from "../types/framing";
import type { FramingRootStackParamList } from "../types/navigation";
import { getArtworkAspectRatio } from "../utils/artworkCrop";
import {
  importArtworkFromCamera,
  importArtworkFromLibrary,
  importWallPhotoFromCamera,
  importWallPhotoFromLibrary,
  type ArtworkImportSelection,
} from "../utils/artworkImport";
import { normalizeHex } from "../utils/color";
import { formatMeasurement, parseMeasurement, roundMeasurementString } from "../utils/formatters";
import { FRAME_FINISHES, getFrameProfile, resolveFrameColorHex } from "../utils/frameProfiles";
import {
  buildDerivedGeometry,
  getFinishedFrameOuterSizeInches,
  inchesToMeasurementUnit,
  measurementToInches,
  type NumericSize,
} from "../utils/framingGeometry";
import {
  calculateCalibrationPixelsPerInch,
  clampRoomPoint,
  getDefaultRoomGridSize,
  getDisplayPixelsPerInch,
  MY_WALL_SCENE_SOURCE_ID,
  getPresetScenePixelsPerInch,
  getRoomGridSizeInches,
  getRoomKnownMeasurementOptions,
  getRoomSourceId,
  getStandardCalibrationMeasurementLabel,
  getStandardCalibrationPaperLabel,
  getWallPhotoAspectRatio,
} from "../utils/roomView";
import { resolveWallShadow, type ResolvedWallShadow } from "../utils/roomShadow";
import {
  resolveRoomMaterialRealism,
  type ResolvedRoomMaterialRealism,
} from "../utils/roomRealism";

const CALIBRATION_HANDLE_SIZE = 38;
const CALIBRATION_RULER_HEIGHT = 24;
const CALIBRATION_RULER_HIT_HEIGHT = 46;
const CALIBRATION_LOUPE_SIZE = 116;
const CALIBRATION_LOUPE_ZOOM = 2.6;
const MAX_EXPORT_WIDTH = 1800;
const TABLET_WIDTH_BREAKPOINT = 768;
const LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH = 1180;
const LANDSCAPE_CONTROLS_COLUMN_WIDTH = 408;
const ARTWORK_THUMBNAIL_WIDTH = 58;
const ARTWORK_THUMBNAIL_HEIGHT = 68;
const WALL_SHADOW_MAX_SOFTNESS = 160;
const WALL_SHADOW_FEATHER_STEPS = 18;
const ROOM_REALISM_CONTROL_CONTENT_HEIGHT = 158;
const SELECTED_ARTWORK_TOOLBAR_WIDTH = 204;
const SELECTED_ARTWORK_TOOLBAR_HEIGHT = 48;

type ArtworkSortMode = "recent" | "name" | "size";
type RoomViewDockSheet = "artwork" | "interiors" | "layouts" | "settings" | "export";
type RoomRealismControlTab = "wall" | "mat" | "frame" | "glass";

const ROOM_SOURCE_OPTIONS: {
  label: string;
  value: RoomViewSourceMode;
}[] = [
  { label: "My Wall", value: "myWall" },
  { label: "Preset Rooms", value: "presetRoom" },
];

const ARTWORK_SORT_OPTIONS: {
  label: string;
  value: ArtworkSortMode;
}[] = [
  { label: "Most Recent", value: "recent" },
  { label: "Name A-Z", value: "name" },
  { label: "Size", value: "size" },
];

const ROOM_VIEW_DOCK_ITEMS: {
  label: string;
  sheet: RoomViewDockSheet;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { label: "Artwork", sheet: "artwork", icon: "images-outline" },
  { label: "Interiors", sheet: "interiors", icon: "home-outline" },
  { label: "Layouts", sheet: "layouts", icon: "grid-outline" },
  { label: "Settings", sheet: "settings", icon: "options-outline" },
  { label: "Export", sheet: "export", icon: "share-outline" },
];

const ROOM_REALISM_TABS: {
  label: string;
  value: RoomRealismControlTab;
}[] = [
  { label: "Wall", value: "wall" },
  { label: "Mat", value: "mat" },
  { label: "Frame", value: "frame" },
  { label: "Glass", value: "glass" },
];

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundToStep(value: number, step: number) {
  return Number((Math.round(value / step) * step).toFixed(4));
}

function createDefaultArtworkCrop(
  selection: ArtworkImportSelection,
  artworkSize: NumericSize | null
): ArtworkCropState | null {
  const aspectRatio = getArtworkAspectRatio(artworkSize);

  if (!selection.imageWidth || !selection.imageHeight || !aspectRatio) {
    return null;
  }

  return {
    sourceWidth: selection.imageWidth,
    sourceHeight: selection.imageHeight,
    aspectRatio,
    zoomScale: 1,
    offsetXRatio: 0,
    offsetYRatio: 0,
  };
}

function getPlacementPreview(
  artwork: SavedFramedArtwork,
  placement: RoomArtworkPlacementDraft
): PreviewDraft {
  const basePreview = artwork.draft.preview;

  if (!placement.artworkImageUriOverride) {
    return basePreview;
  }

  return {
    ...basePreview,
    artworkSourceMode: placement.artworkSourceModeOverride ?? "import",
    artworkImageUri: placement.artworkImageUriOverride,
    artworkCrop: placement.artworkCropOverride ?? null,
  };
}

function clampRoomPointToRect(point: RoomViewPoint, rect: RoomViewRect): RoomViewPoint {
  return {
    x: clampNumber(point.x, rect.x, rect.x + rect.width),
    y: clampNumber(point.y, rect.y, rect.y + rect.height),
  };
}

function getSelectedArtworkToolbarPosition({
  selectedArtwork,
  imageRect,
}: {
  selectedArtwork: WallArtworkRenderItem | null;
  imageRect: DisplayedImageRect;
}) {
  if (!selectedArtwork || imageRect.width <= 0 || imageRect.height <= 0) {
    return null;
  }

  const margin = 12;
  const defaultLeft = imageRect.left + imageRect.width - SELECTED_ARTWORK_TOOLBAR_WIDTH - margin;
  const defaultTop = imageRect.top + imageRect.height - SELECTED_ARTWORK_TOOLBAR_HEIGHT - margin;
  const selectedLeft =
    imageRect.left +
    selectedArtwork.placement.center.x * imageRect.width -
    selectedArtwork.displaySize.width / 2;
  const selectedTop =
    imageRect.top +
    selectedArtwork.placement.center.y * imageRect.height -
    selectedArtwork.displaySize.height / 2;
  const selectedRight = selectedLeft + selectedArtwork.displaySize.width;
  const selectedBottom = selectedTop + selectedArtwork.displaySize.height;
  const toolbarRight = defaultLeft + SELECTED_ARTWORK_TOOLBAR_WIDTH;
  const toolbarBottom = defaultTop + SELECTED_ARTWORK_TOOLBAR_HEIGHT;
  const overlapsSelected =
    defaultLeft < selectedRight &&
    toolbarRight > selectedLeft &&
    defaultTop < selectedBottom &&
    toolbarBottom > selectedTop;

  if (!overlapsSelected) {
    return { left: defaultLeft, top: defaultTop };
  }

  const aboveSelectedTop = selectedTop - SELECTED_ARTWORK_TOOLBAR_HEIGHT - margin;

  if (aboveSelectedTop >= imageRect.top + margin) {
    return {
      left: defaultLeft,
      top: aboveSelectedTop,
    };
  }

  return {
    left: imageRect.left + margin,
    top: defaultTop,
  };
}

function getWallShadowDistance(shadow: { offsetX: number; offsetY: number }) {
  return Math.sqrt(shadow.offsetX ** 2 + shadow.offsetY ** 2);
}

function getWallShadowDirection(
  currentShadow: { offsetX: number; offsetY: number },
  fallbackShadow: { offsetX: number; offsetY: number }
) {
  const currentDistance = getWallShadowDistance(currentShadow);
  const directionSource = currentDistance > 0.1 ? currentShadow : fallbackShadow;
  const sourceDistance = getWallShadowDistance(directionSource);

  if (sourceDistance <= 0.1) {
    return { x: 0.58, y: 0.82 };
  }

  return {
    x: directionSource.offsetX / sourceDistance,
    y: directionSource.offsetY / sourceDistance,
  };
}

function getWallShadowAngle(shadow: { offsetX: number; offsetY: number }) {
  return Math.atan2(shadow.offsetY, shadow.offsetX);
}

function getWallShadowFeatherRadius(blurRadius: number) {
  return clampNumber(blurRadius * 1.45 + 4, 4, WALL_SHADOW_MAX_SOFTNESS * 1.55);
}

function WallCastShadow({
  width,
  height,
  shadow,
}: {
  width: number;
  height: number;
  shadow: ResolvedWallShadow;
}) {
  if (width <= 0 || height <= 0 || shadow.opacity <= 0.001) {
    return null;
  }

  const featherRadius = getWallShadowFeatherRadius(shadow.blurRadius);
  let layerWeightTotal = 0;

  for (let index = 0; index < WALL_SHADOW_FEATHER_STEPS; index += 1) {
    const progress = index / WALL_SHADOW_FEATHER_STEPS;

    layerWeightTotal += (1 - progress) ** 2;
  }
  const nearEdgeOpacity = clampNumber(shadow.opacity * 0.3, 0, 0.34);
  const shadowLayers = Array.from({ length: WALL_SHADOW_FEATHER_STEPS }).map((_layer, index) => {
    const progress = (index + 1) / WALL_SHADOW_FEATHER_STEPS;
    const falloff = (1 - index / WALL_SHADOW_FEATHER_STEPS) ** 2;
    const grow = featherRadius * progress;

    return {
      grow,
      opacity: (nearEdgeOpacity * falloff) / layerWeightTotal,
    };
  });

  return (
    <Svg
      pointerEvents="none"
      width={width + featherRadius * 2}
      height={height + featherRadius * 2}
      style={{
        position: "absolute",
        left: shadow.offsetX - featherRadius,
        top: shadow.offsetY - featherRadius,
      }}
    >
      {shadowLayers.map((layer, index) => (
        <SvgRect
          key={`${index}-${layer.grow}`}
          x={featherRadius - layer.grow}
          y={featherRadius - layer.grow}
          width={width + layer.grow * 2}
          height={height + layer.grow * 2}
          rx={1}
          ry={1}
          fill="#000000"
          opacity={layer.opacity}
        />
      ))}
    </Svg>
  );
}

function SelectedArtworkToolbar({
  position,
  onDuplicate,
  onReplace,
  onEdit,
  onDelete,
}: {
  position: { left: number; top: number };
  onDuplicate: () => void;
  onReplace: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const actions: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone?: "default" | "danger";
    onPress: () => void;
  }[] = [
    { label: "Duplicate", icon: "copy-outline", onPress: onDuplicate },
    { label: "Replace Artwork", icon: "image-outline", onPress: onReplace },
    { label: "Edit Framing", icon: "options-outline", onPress: onEdit },
    { label: "Delete", icon: "trash-outline", tone: "danger", onPress: onDelete },
  ];

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: position.left,
        top: position.top,
        width: SELECTED_ARTWORK_TOOLBAR_WIDTH,
        height: SELECTED_ARTWORK_TOOLBAR_HEIGHT,
        zIndex: 60,
      }}
    >
      <View
        style={{
          height: SELECTED_ARTWORK_TOOLBAR_HEIGHT,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.backgroundCard,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.xs,
          shadowColor: "#000000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        {actions.map((action) => {
          const actionColor = action.tone === "danger" ? colors.warning : colors.textPrimary;

          return (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              hitSlop={8}
              style={{
                width: 46,
                height: 38,
                borderRadius: radii.pill,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={action.icon} size={20} color={actionColor} />
              <Text
                style={{
                  ...typography.small,
                  fontSize: 8,
                  lineHeight: 10,
                  color: colors.textSecondary,
                  fontWeight: "700",
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {action.label === "Replace Artwork" ? "Replace" : action.label.split(" ")[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type SvgElementRef = React.ElementRef<typeof Svg> & {
  toDataURL?: (
    callback: (base64: string) => void,
    options?: { width?: number; height?: number }
  ) => void;
};

interface WallArtworkRenderItem {
  placement: RoomArtworkPlacementDraft;
  artwork: SavedFramedArtwork;
  preview: PreviewDraft;
  displaySize: {
    width: number;
    height: number;
  };
  frameColorHex: string;
  physicalScale: number;
  renderGeometry: {
    artworkSize: NumericSize | null;
    openingSize: NumericSize | null;
    outerMatSize: NumericSize | null;
    offsetX: number;
    offsetY: number;
  };
}

interface DisplayedImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function getFittedStageSize({
  containerWidth,
  containerHeight,
  aspectRatio,
}: {
  containerWidth: number;
  containerHeight: number;
  aspectRatio: number;
}) {
  if (containerWidth <= 0 || containerHeight <= 0 || aspectRatio <= 0) {
    return null;
  }

  let width = containerWidth;
  let height = width / aspectRatio;

  if (height > containerHeight) {
    height = containerHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function WallPhotoSourceOption({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors, radii, spacing } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
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
        <Ionicons name={icon} size={18} color={colors.textPrimary} />
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

function PresetRoomSceneOption({
  scene,
  selected,
  onPress,
}: {
  scene: RegisteredRoomPresetScene;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.borderStrong,
        borderRadius: radii.md,
        backgroundColor: selected ? colors.accentSoft : colors.backgroundInput,
        padding: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <PresetRoomSceneImage
        scene={scene}
        style={{
          width: 76,
          height: 48,
          borderRadius: radii.sm,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        }}
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}
          numberOfLines={1}
        >
          {scene.title}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={2}>
          {scene.description}
        </Text>
      </View>

      {selected ? (
        <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
      ) : null}
    </Pressable>
  );
}

function RoomViewBottomDock({
  activeSheet,
  onOpenSheet,
}: {
  activeSheet: RoomViewDockSheet | null;
  onOpenSheet: (sheet: RoomViewDockSheet) => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: radii.xl,
        backgroundColor: colors.backgroundCard,
        padding: spacing.xs,
        flexDirection: "row",
        gap: spacing.xs,
      }}
    >
      {ROOM_VIEW_DOCK_ITEMS.map((item) => {
        const selected = activeSheet === item.sheet;

        return (
          <Pressable
            key={item.sheet}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.label}`}
            onPress={() => onOpenSheet(item.sheet)}
            style={{
              flex: 1,
              minHeight: 58,
              borderRadius: radii.lg,
              backgroundColor: selected ? colors.accentSoft : colors.backgroundInput,
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              paddingHorizontal: 4,
            }}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={selected ? colors.accent : colors.textSecondary}
            />
            <Text
              style={{
                ...typography.small,
                color: selected ? colors.accent : colors.textSecondary,
                fontWeight: "700",
                textAlign: "center",
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RoomViewBottomSheet({
  visible,
  title,
  maxHeight,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  maxHeight: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            width: "100%",
            maxHeight,
            backgroundColor: colors.backgroundCard,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderWidth: 2,
            borderBottomWidth: 0,
            borderColor: colors.borderStrong,
            paddingTop: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            gap: spacing.md,
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
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xs }}
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getArtworkCenterBounds({
  stageWidth,
  stageHeight,
  artworkWidth,
  artworkHeight,
  placementBounds,
}: {
  stageWidth: number;
  stageHeight: number;
  artworkWidth: number | null;
  artworkHeight: number | null;
  placementBounds: RoomViewRect;
}) {
  if (!artworkWidth || !artworkHeight || stageWidth <= 0 || stageHeight <= 0) {
    return {
      minX: placementBounds.x,
      maxX: placementBounds.x + placementBounds.width,
      minY: placementBounds.y,
      maxY: placementBounds.y + placementBounds.height,
    };
  }

  const halfWidthRatio = artworkWidth / stageWidth / 2;
  const halfHeightRatio = artworkHeight / stageHeight / 2;
  const boundsMaxX = placementBounds.x + placementBounds.width;
  const boundsMaxY = placementBounds.y + placementBounds.height;

  return {
    minX:
      halfWidthRatio * 2 >= placementBounds.width
        ? placementBounds.x + placementBounds.width / 2
        : placementBounds.x + halfWidthRatio,
    maxX:
      halfWidthRatio * 2 >= placementBounds.width
        ? placementBounds.x + placementBounds.width / 2
        : boundsMaxX - halfWidthRatio,
    minY:
      halfHeightRatio * 2 >= placementBounds.height
        ? placementBounds.y + placementBounds.height / 2
        : placementBounds.y + halfHeightRatio,
    maxY:
      halfHeightRatio * 2 >= placementBounds.height
        ? placementBounds.y + placementBounds.height / 2
        : boundsMaxY - halfHeightRatio,
  };
}

function convertSizeToUnit(
  size: NumericSize | null,
  sourceUnit: MeasurementUnit,
  targetUnit: MeasurementUnit
): NumericSize | null {
  if (!size) {
    return null;
  }

  return {
    width: inchesToMeasurementUnit(measurementToInches(size.width, sourceUnit), targetUnit),
    height: inchesToMeasurementUnit(measurementToInches(size.height, sourceUnit), targetUnit),
  };
}

function convertMeasurementToUnit(
  value: number,
  sourceUnit: MeasurementUnit,
  targetUnit: MeasurementUnit
) {
  return inchesToMeasurementUnit(measurementToInches(value, sourceUnit), targetUnit);
}

function getPlacementScale(placement: RoomArtworkPlacementDraft) {
  return Number.isFinite(placement.scale) && placement.scale > 0 ? placement.scale : 1;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

function getSavedArtworkFinalOuterSizeInches(
  artwork: SavedFramedArtwork,
  derived = buildDerivedGeometry(artwork.draft)
): NumericSize | null {
  const storedSize = artwork.finalOuterSizeInches;

  if (
    isPositiveFiniteNumber(storedSize?.width) &&
    isPositiveFiniteNumber(storedSize?.height)
  ) {
    return storedSize;
  }

  return getFinishedFrameOuterSizeInches(
    derived.outerMatSize,
    artwork.draft.preview.frameProfileId,
    artwork.unit
  );
}

function getSavedArtworkSizeLabel(
  artwork: SavedFramedArtwork,
  unit: MeasurementUnit,
  imperialPrecision: FractionDenominator
) {
  const finalOuterSize = getSavedArtworkFinalOuterSizeInches(artwork);

  if (!finalOuterSize) {
    return "Size not set";
  }

  return `${formatMeasurement(
    inchesToMeasurementUnit(finalOuterSize.width, unit),
    unit,
    imperialPrecision
  )} x ${formatMeasurement(
    inchesToMeasurementUnit(finalOuterSize.height, unit),
    unit,
    imperialPrecision
  )}`;
}

function getSavedArtworkSummary(artwork: SavedFramedArtwork) {
  const preview = artwork.draft.preview;
  const profile = getFrameProfile(preview.frameProfileId);
  const finishLabel = preview.frameFinishId ? FRAME_FINISHES[preview.frameFinishId]?.label : null;
  const frameLabel =
    profile.renderStyle === "none"
      ? "No frame"
      : [profile.profileCode ? `Profile ${profile.profileCode}` : profile.label, finishLabel]
          .filter(Boolean)
          .join(", ");
  const matLabel = preview.matCoreColor === "black" ? "black core mat" : "white core mat";

  return `${frameLabel} · ${matLabel}`;
}

function sortFramedArtworks(
  artworks: SavedFramedArtwork[],
  sortMode: ArtworkSortMode
) {
  return [...artworks].sort((first, second) => {
    if (sortMode === "name") {
      return first.name.localeCompare(second.name);
    }

    if (sortMode === "size") {
      const firstSize = getSavedArtworkFinalOuterSizeInches(first);
      const secondSize = getSavedArtworkFinalOuterSizeInches(second);
      const firstArea = firstSize ? firstSize.width * firstSize.height : 0;
      const secondArea = secondSize ? secondSize.width * secondSize.height : 0;

      return secondArea - firstArea;
    }

    return (
      new Date(second.updatedAt ?? second.savedAt).getTime() -
      new Date(first.updatedAt ?? first.savedAt).getTime()
    );
  });
}

function clampArtworkCenter({
  point,
  stageWidth,
  stageHeight,
  artworkWidth,
  artworkHeight,
  placementBounds,
}: {
  point: RoomViewPoint;
  stageWidth: number;
  stageHeight: number;
  artworkWidth: number | null;
  artworkHeight: number | null;
  placementBounds: RoomViewRect;
}) {
  const bounds = getArtworkCenterBounds({
    stageWidth,
    stageHeight,
    artworkWidth,
    artworkHeight,
    placementBounds,
  });

  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  };
}

function snapArtworkCenterToGrid({
  point,
  stageWidth,
  stageHeight,
  artworkWidth,
  artworkHeight,
  placementBounds,
  snapGridSizePixels,
}: {
  point: RoomViewPoint;
  stageWidth: number;
  stageHeight: number;
  artworkWidth: number | null;
  artworkHeight: number | null;
  placementBounds: RoomViewRect;
  snapGridSizePixels: number | null;
}) {
  const clampedPoint = clampArtworkCenter({
    point,
    stageWidth,
    stageHeight,
    artworkWidth,
    artworkHeight,
    placementBounds,
  });

  if (
    snapGridSizePixels === null ||
    !Number.isFinite(snapGridSizePixels) ||
    snapGridSizePixels <= 0 ||
    stageWidth <= 0 ||
    stageHeight <= 0
  ) {
    return clampedPoint;
  }

  const snappedPoint = {
    x: Math.round((clampedPoint.x * stageWidth) / snapGridSizePixels) *
      snapGridSizePixels /
      stageWidth,
    y: Math.round((clampedPoint.y * stageHeight) / snapGridSizePixels) *
      snapGridSizePixels /
      stageHeight,
  };

  return clampArtworkCenter({
    point: snappedPoint,
    stageWidth,
    stageHeight,
    artworkWidth,
    artworkHeight,
    placementBounds,
  });
}

function addRoomPoint(point: RoomViewPoint, delta: RoomViewPoint): RoomViewPoint {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
  };
}

function getClampedRulerMoveDelta({
  start,
  end,
  delta,
}: {
  start: RoomViewPoint;
  end: RoomViewPoint;
  delta: RoomViewPoint;
}): RoomViewPoint {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  return {
    x: Math.max(-minX, Math.min(1 - maxX, delta.x)),
    y: Math.max(-minY, Math.min(1 - maxY, delta.y)),
  };
}

function getDisplayedImageRect({
  stageSize,
  imageWidth,
  imageHeight,
}: {
  stageSize: { width: number; height: number };
  imageWidth: number | null | undefined;
  imageHeight: number | null | undefined;
}): DisplayedImageRect {
  if (stageSize.width <= 0 || stageSize.height <= 0 || !imageWidth || !imageHeight) {
    return {
      left: 0,
      top: 0,
      width: stageSize.width,
      height: stageSize.height,
    };
  }

  const stageAspectRatio = stageSize.width / stageSize.height;
  const imageAspectRatio = imageWidth / imageHeight;

  if (stageAspectRatio > imageAspectRatio) {
    const height = stageSize.height;
    const width = height * imageAspectRatio;

    return {
      left: (stageSize.width - width) / 2,
      top: 0,
      width,
      height,
    };
  }

  const width = stageSize.width;
  const height = width / imageAspectRatio;

  return {
    left: 0,
    top: (stageSize.height - height) / 2,
    width,
    height,
  };
}

function roomPointToDisplayPoint(point: RoomViewPoint, imageRect: DisplayedImageRect) {
  return {
    x: imageRect.left + point.x * imageRect.width,
    y: imageRect.top + point.y * imageRect.height,
  };
}

function gestureTranslationToRoomDelta(
  gestureState: PanResponderGestureState,
  imageRect: DisplayedImageRect
): RoomViewPoint {
  if (imageRect.width <= 0 || imageRect.height <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: gestureState.dx / imageRect.width,
    y: gestureState.dy / imageRect.height,
  };
}

function roomPointsAreClose(first: RoomViewPoint, second: RoomViewPoint) {
  return Math.abs(first.x - second.x) < 0.0001 && Math.abs(first.y - second.y) < 0.0001;
}

function getLoupePosition({
  point,
  stageSize,
}: {
  point: { x: number; y: number };
  stageSize: { width: number; height: number };
}) {
  const margin = 8;
  const preferredLeft = point.x - CALIBRATION_LOUPE_SIZE / 2;
  const preferredTop = point.y - CALIBRATION_LOUPE_SIZE - 14;
  const fallbackTop = point.y + 14;
  const top = preferredTop >= margin ? preferredTop : fallbackTop;

  return {
    left: Math.max(
      margin,
      Math.min(stageSize.width - CALIBRATION_LOUPE_SIZE - margin, preferredLeft)
    ),
    top: Math.max(margin, Math.min(stageSize.height - CALIBRATION_LOUPE_SIZE - margin, top)),
  };
}

type CalibrationDragTarget = "start" | "end" | "body";

function CalibrationLoupe({
  imageUri,
  displayPoint,
  normalizedPoint,
  imageRect,
  stageSize,
}: {
  imageUri: string;
  displayPoint: { x: number; y: number };
  normalizedPoint: RoomViewPoint;
  imageRect: DisplayedImageRect;
  stageSize: { width: number; height: number };
}) {
  const { colors } = useAppTheme();
  const position = getLoupePosition({ point: displayPoint, stageSize });
  const cropSize = CALIBRATION_LOUPE_SIZE / CALIBRATION_LOUPE_ZOOM;
  const imageLocalPoint = {
    x: normalizedPoint.x * imageRect.width,
    y: normalizedPoint.y * imageRect.height,
  };
  const maxCropLeft = Math.max(0, imageRect.width - cropSize);
  const maxCropTop = Math.max(0, imageRect.height - cropSize);
  const cropLeft = Math.max(0, Math.min(maxCropLeft, imageLocalPoint.x - cropSize / 2));
  const cropTop = Math.max(0, Math.min(maxCropTop, imageLocalPoint.y - cropSize / 2));
  const cropScale = CALIBRATION_LOUPE_SIZE / cropSize;
  const crosshairPoint = {
    x: (imageLocalPoint.x - cropLeft) * cropScale,
    y: (imageLocalPoint.y - cropTop) * cropScale,
  };

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: position.left,
        top: position.top,
        width: CALIBRATION_LOUPE_SIZE,
        height: CALIBRATION_LOUPE_SIZE,
        borderRadius: CALIBRATION_LOUPE_SIZE / 2,
        borderWidth: 2,
        borderColor: colors.white,
        backgroundColor: colors.backgroundCard,
        overflow: "hidden",
        zIndex: 140,
        shadowColor: "#000",
        shadowOpacity: 0.26,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Image
        source={{ uri: imageUri }}
        resizeMode="stretch"
        style={{
          position: "absolute",
          width: imageRect.width * cropScale,
          height: imageRect.height * cropScale,
          left: -cropLeft * cropScale,
          top: -cropTop * cropScale,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: crosshairPoint.x - 0.5,
          top: 10,
          bottom: 10,
          width: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: crosshairPoint.y - 0.5,
          left: 10,
          right: 10,
          height: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: crosshairPoint.x - 3,
          top: crosshairPoint.y - 3,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: "#F3C94A",
          borderWidth: 1,
          borderColor: "#2D2508",
        }}
      />
    </View>
  );
}

function CalibrationRuler({
  start,
  end,
  imageRect,
  stageSize,
  wallPhotoUri,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  start: RoomViewPoint;
  end: RoomViewPoint;
  imageRect: DisplayedImageRect;
  stageSize: { width: number; height: number };
  wallPhotoUri: string;
  onChange: (start: RoomViewPoint, end: RoomViewPoint) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { colors } = useAppTheme();
  const [liveStart, setLiveStart] = useState(start);
  const [liveEnd, setLiveEnd] = useState(end);
  const [loupePoint, setLoupePoint] = useState<RoomViewPoint | null>(null);
  const liveStartRef = useRef(start);
  const liveEndRef = useRef(end);
  const dragStartRef = useRef({ start, end });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }

    liveStartRef.current = start;
    liveEndRef.current = end;
    setLiveStart(start);
    setLiveEnd(end);
  }, [end, start]);

  const updateLiveRuler = useCallback(
    (nextStart: RoomViewPoint, nextEnd: RoomViewPoint, activePoint: RoomViewPoint) => {
      const clampedStart = clampRoomPoint(nextStart);
      const clampedEnd = clampRoomPoint(nextEnd);
      const clampedActivePoint = clampRoomPoint(activePoint);

      liveStartRef.current = clampedStart;
      liveEndRef.current = clampedEnd;
      setLiveStart(clampedStart);
      setLiveEnd(clampedEnd);
      setLoupePoint(clampedActivePoint);
    },
    []
  );

  const finishDrag = useCallback(() => {
    onChange(liveStartRef.current, liveEndRef.current);
    setLoupePoint(null);
    isDraggingRef.current = false;
    onDragEnd();
  }, [onChange, onDragEnd]);

  const makePanResponder = useCallback(
    (target: CalibrationDragTarget) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStartRef.current = {
            start: liveStartRef.current,
            end: liveEndRef.current,
          };
          isDraggingRef.current = true;
          onDragStart();

          const activePoint =
            target === "end"
              ? liveEndRef.current
              : target === "body"
                ? {
                    x: (liveStartRef.current.x + liveEndRef.current.x) / 2,
                    y: (liveStartRef.current.y + liveEndRef.current.y) / 2,
                  }
                : liveStartRef.current;

          setLoupePoint(activePoint);
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          if (imageRect.width <= 0 || imageRect.height <= 0) {
            return;
          }

          const delta = gestureTranslationToRoomDelta(gestureState, imageRect);
          const dragStart = dragStartRef.current;

          if (target === "start") {
            const nextStart = clampRoomPoint(addRoomPoint(dragStart.start, delta));
            updateLiveRuler(nextStart, dragStart.end, nextStart);
            return;
          }

          if (target === "end") {
            const nextEnd = clampRoomPoint(addRoomPoint(dragStart.end, delta));
            updateLiveRuler(dragStart.start, nextEnd, nextEnd);
            return;
          }

          const clampedDelta = getClampedRulerMoveDelta({
            start: dragStart.start,
            end: dragStart.end,
            delta,
          });
          const nextStart = addRoomPoint(dragStart.start, clampedDelta);
          const nextEnd = addRoomPoint(dragStart.end, clampedDelta);

          updateLiveRuler(nextStart, nextEnd, {
            x: (nextStart.x + nextEnd.x) / 2,
            y: (nextStart.y + nextEnd.y) / 2,
          });
        },
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
      }),
    [finishDrag, imageRect, onDragStart, updateLiveRuler]
  );

  const startPanResponder = useMemo(() => makePanResponder("start"), [makePanResponder]);
  const endPanResponder = useMemo(() => makePanResponder("end"), [makePanResponder]);
  const bodyPanResponder = useMemo(() => makePanResponder("body"), [makePanResponder]);

  if (stageSize.width <= 0 || stageSize.height <= 0 || imageRect.width <= 0 || imageRect.height <= 0) {
    return null;
  }

  const startPoint = roomPointToDisplayPoint(liveStart, imageRect);
  const endPoint = roomPointToDisplayPoint(liveEnd, imageRect);
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const midpoint = {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  };
  const tickCount = Math.max(6, Math.min(18, Math.floor(length / 20)));

  return (
    <>
      <View
        {...bodyPanResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Calibration ruler"
        style={{
          position: "absolute",
          left: midpoint.x - length / 2,
          top: midpoint.y - CALIBRATION_RULER_HIT_HEIGHT / 2,
          width: length,
          height: CALIBRATION_RULER_HIT_HEIGHT,
          justifyContent: "center",
          zIndex: 120,
          transform: [{ rotate: `${angle}rad` }],
        }}
      >
        <View
          style={{
            height: CALIBRATION_RULER_HEIGHT,
            borderWidth: 1,
            borderColor: "#31280A",
            backgroundColor: "#F3C94A",
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              backgroundColor: "rgba(49,40,10,0.22)",
            }}
          />
          {Array.from({ length: tickCount + 1 }).map((_, index) => {
            const isMajorTick = index === 0 || index === tickCount || index % 4 === 0;
            const isMidTick = index % 2 === 0;

            return (
              <View
                key={index}
                style={{
                  position: "absolute",
                  left: `${(index / tickCount) * 100}%`,
                  top: 1,
                  width: isMajorTick ? 2 : 1,
                  height: isMajorTick ? 17 : isMidTick ? 13 : 9,
                  backgroundColor: "#31280A",
                }}
              />
            );
          })}
        </View>
      </View>

      {[
        { point: startPoint, panHandlers: startPanResponder.panHandlers, label: "Calibration ruler start" },
        { point: endPoint, panHandlers: endPanResponder.panHandlers, label: "Calibration ruler end" },
      ].map(({ point, panHandlers, label }) => (
        <View
          key={label}
          {...panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          style={{
            position: "absolute",
            left: point.x - CALIBRATION_HANDLE_SIZE / 2,
            top: point.y - CALIBRATION_HANDLE_SIZE / 2,
            width: CALIBRATION_HANDLE_SIZE,
            height: CALIBRATION_HANDLE_SIZE,
            borderRadius: CALIBRATION_HANDLE_SIZE / 2,
            borderWidth: 3,
            borderColor: colors.white,
            backgroundColor: "#F3C94A",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 130,
            shadowColor: "#000",
            shadowOpacity: 0.26,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View
            style={{
              width: 9,
              height: 9,
              backgroundColor: "#31280A",
            }}
          />
        </View>
      ))}

      {loupePoint ? (
        <CalibrationLoupe
          imageUri={wallPhotoUri}
          displayPoint={roomPointToDisplayPoint(loupePoint, imageRect)}
          normalizedPoint={loupePoint}
          imageRect={imageRect}
          stageSize={stageSize}
        />
      ) : null}
    </>
  );
}

function SavedFramedArtworkPickerRow({
  artwork,
  selected,
  unit,
  imperialPrecision,
  onPress,
}: {
  artwork: SavedFramedArtwork;
  selected: boolean;
  unit: MeasurementUnit;
  imperialPrecision: FractionDenominator;
  onPress: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const preview = artwork.draft.preview;
  const frameColorHex = resolveFrameColorHex(
    preview.frameProfileId,
    preview.frameFinishId,
    preview.frameColorHex
  );
  const thumbnailGeometry = useMemo(() => {
    const derived = buildDerivedGeometry(artwork.draft);
    const finalOuterSize = getSavedArtworkFinalOuterSizeInches(artwork, derived);

    if (!derived.isValidGeometry || !finalOuterSize) {
      return null;
    }

    const finalWidth = inchesToMeasurementUnit(finalOuterSize.width, unit);
    const finalHeight = inchesToMeasurementUnit(finalOuterSize.height, unit);
    const physicalScale = Math.min(
      (ARTWORK_THUMBNAIL_WIDTH - 12) / Math.max(finalWidth, 1),
      (ARTWORK_THUMBNAIL_HEIGHT - 12) / Math.max(finalHeight, 1)
    );

    return {
      artworkSize: convertSizeToUnit(derived.artworkSize, artwork.unit, unit),
      openingSize: convertSizeToUnit(derived.openingSize, artwork.unit, unit),
      outerMatSize: convertSizeToUnit(derived.outerMatSize, artwork.unit, unit),
      offsetX: convertMeasurementToUnit(preview.offsetX, artwork.unit, unit),
      offsetY: convertMeasurementToUnit(preview.offsetY, artwork.unit, unit),
      physicalScale,
    };
  }, [artwork, preview.offsetX, preview.offsetY, unit]);
  const sizeLabel = getSavedArtworkSizeLabel(artwork, unit, imperialPrecision);
  const summaryLabel = getSavedArtworkSummary(artwork);

  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 84,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.borderStrong,
        borderRadius: radii.md,
        backgroundColor: selected ? colors.accentSoft : colors.backgroundInput,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: ARTWORK_THUMBNAIL_WIDTH,
          height: ARTWORK_THUMBNAIL_HEIGHT,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          borderRadius: radii.sm,
          backgroundColor: colors.backgroundCard,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {thumbnailGeometry ? (
          <FinishedFramedArtwork
            artworkSize={thumbnailGeometry.artworkSize}
            openingSize={thumbnailGeometry.openingSize}
            outerMatSize={thumbnailGeometry.outerMatSize}
            frameProfileId={preview.frameProfileId}
            frameColorHex={frameColorHex}
            matThicknessPly={preview.matThicknessPly}
            matColorHex={preview.matColorHex}
            matCoreColor={preview.matCoreColor}
            mountingBoardColorHex={preview.mountingBoardColorHex}
            offsetX={thumbnailGeometry.offsetX}
            offsetY={thumbnailGeometry.offsetY}
            artworkSourceMode={preview.artworkSourceMode}
            artworkImageUri={preview.artworkImageUri}
            artworkCrop={preview.artworkCrop}
            physicalScale={thumbnailGeometry.physicalScale}
            showShadow={false}
          />
        ) : (
          <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}
          numberOfLines={1}
        >
          {artwork.name || "Untitled framed artwork"}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={1}>
          {sizeLabel}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={1}>
          {summaryLabel}
        </Text>
      </View>

      <Ionicons name="add-circle-outline" size={21} color={colors.textSecondary} />
    </Pressable>
  );
}

function PlacedWallArtwork({
  placedArtwork,
  selected,
  stageSize,
  stageOffset,
  placementBounds,
  snapGridSizePixels,
  sceneDefaultShadow,
  roomShadowOverride,
  materialRealism,
  environment,
  artworkBrightness,
  onSelect,
  onMoveEnd,
  onDragStart,
  onDragEnd,
}: {
  placedArtwork: WallArtworkRenderItem;
  selected: boolean;
  stageSize: { width: number; height: number };
  stageOffset: { x: number; y: number };
  placementBounds: RoomViewRect;
  snapGridSizePixels: number | null;
  sceneDefaultShadow?: RegisteredRoomPresetScene["defaultShadow"] | null;
  roomShadowOverride?: RoomWallShadowDraft | null;
  materialRealism: ResolvedRoomMaterialRealism;
  environment: RoomEnvironmentLighting | null;
  artworkBrightness: number;
  onSelect: (placementId: string) => void;
  onMoveEnd: (placementId: string, center: RoomViewPoint) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { colors } = useAppTheme();
  const preview = placedArtwork.preview;
  const dragOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragStartCenterRef = useRef<RoomViewPoint>(placedArtwork.placement.center);
  const pendingCenterRef = useRef<RoomViewPoint | null>(null);
  const isDraggingRef = useRef(false);
  const wallShadow = resolveWallShadow(sceneDefaultShadow, roomShadowOverride);
  const brightnessOverlayOpacity =
    artworkBrightness < 1
      ? clampNumber(1 - artworkBrightness, 0, 0.5)
      : clampNumber((artworkBrightness - 1) * 0.5, 0, 0.125);
  const brightnessOverlayColor = artworkBrightness < 1 ? "#000000" : "#FFFFFF";

  useLayoutEffect(() => {
    const pendingCenter = pendingCenterRef.current;

    if (
      pendingCenter &&
      !isDraggingRef.current &&
      roomPointsAreClose(pendingCenter, placedArtwork.placement.center)
    ) {
      dragOffset.setValue({ x: 0, y: 0 });
      pendingCenterRef.current = null;
    }
  }, [dragOffset, placedArtwork.placement.center]);

  const getNextCenter = useCallback(
    (gestureState: PanResponderGestureState) => {
      if (stageSize.width <= 0 || stageSize.height <= 0) {
        return placedArtwork.placement.center;
      }

      return snapArtworkCenterToGrid({
        point: {
          x: dragStartCenterRef.current.x + gestureState.dx / stageSize.width,
          y: dragStartCenterRef.current.y + gestureState.dy / stageSize.height,
        },
        stageWidth: stageSize.width,
        stageHeight: stageSize.height,
        artworkWidth: placedArtwork.displaySize.width,
        artworkHeight: placedArtwork.displaySize.height,
        placementBounds,
        snapGridSizePixels,
      });
    },
    [
      placedArtwork.displaySize.height,
      placedArtwork.displaySize.width,
      placedArtwork.placement.center,
      placementBounds,
      snapGridSizePixels,
      stageSize.height,
      stageSize.width,
    ]
  );

  const finishDrag = useCallback(
    (gestureState: PanResponderGestureState) => {
      const nextCenter = getNextCenter(gestureState);

      pendingCenterRef.current = nextCenter;
      isDraggingRef.current = false;
      onMoveEnd(placedArtwork.placement.id, nextCenter);
      onDragEnd();
    },
    [getNextCenter, onDragEnd, onMoveEnd, placedArtwork.placement.id]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          pendingCenterRef.current = null;
          isDraggingRef.current = true;
          dragOffset.stopAnimation();
          dragOffset.setValue({ x: 0, y: 0 });
          dragStartCenterRef.current = placedArtwork.placement.center;
          onSelect(placedArtwork.placement.id);
          onDragStart();
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          const nextCenter = getNextCenter(gestureState);

          dragOffset.setValue({
            x: (nextCenter.x - dragStartCenterRef.current.x) * stageSize.width,
            y: (nextCenter.y - dragStartCenterRef.current.y) * stageSize.height,
          });
        },
        onPanResponderRelease: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          finishDrag(gestureState);
        },
        onPanResponderTerminate: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          finishDrag(gestureState);
        },
      }),
    [
      dragOffset,
      finishDrag,
      getNextCenter,
      onDragStart,
      onSelect,
      placedArtwork.placement.center,
      placedArtwork.placement.id,
      stageSize.height,
      stageSize.width,
    ]
  );

  const left =
    stageOffset.x +
    placedArtwork.placement.center.x * stageSize.width -
    placedArtwork.displaySize.width / 2;
  const top =
    stageOffset.y +
    placedArtwork.placement.center.y * stageSize.height -
    placedArtwork.displaySize.height / 2;
  const cornerMarkers = [
    { left: -2, top: -2, borderLeftWidth: 2, borderTopWidth: 2 },
    { right: -2, top: -2, borderRightWidth: 2, borderTopWidth: 2 },
    { left: -2, bottom: -2, borderLeftWidth: 2, borderBottomWidth: 2 },
    { right: -2, bottom: -2, borderRightWidth: 2, borderBottomWidth: 2 },
  ];

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Placed framed artwork ${placedArtwork.artwork.name}`}
      style={{
        position: "absolute",
        left,
        top,
        width: placedArtwork.displaySize.width,
        height: placedArtwork.displaySize.height,
        overflow: "visible",
        zIndex: 10 + placedArtwork.placement.zIndex,
        transform: [
          ...dragOffset.getTranslateTransform(),
          {
            rotate: `${placedArtwork.placement.rotationDegrees}deg`,
          },
        ],
      }}
    >
      <WallCastShadow
        width={placedArtwork.displaySize.width}
        height={placedArtwork.displaySize.height}
        shadow={wallShadow}
      />

      <FinishedFramedArtwork
        artworkSize={placedArtwork.renderGeometry.artworkSize}
        openingSize={placedArtwork.renderGeometry.openingSize}
        outerMatSize={placedArtwork.renderGeometry.outerMatSize}
        frameProfileId={preview.frameProfileId}
        frameColorHex={placedArtwork.frameColorHex}
        matThicknessPly={preview.matThicknessPly}
        matColorHex={preview.matColorHex}
        matCoreColor={preview.matCoreColor}
        mountingBoardColorHex={preview.mountingBoardColorHex}
        offsetX={placedArtwork.renderGeometry.offsetX}
        offsetY={placedArtwork.renderGeometry.offsetY}
        artworkSourceMode={preview.artworkSourceMode}
        artworkImageUri={preview.artworkImageUri}
        artworkCrop={preview.artworkCrop}
        physicalScale={placedArtwork.physicalScale}
        showShadow={false}
        depthMode="roomMockup"
        shadowDirection={{ x: wallShadow.offsetX, y: wallShadow.offsetY }}
        materialRealism={materialRealism}
        environment={environment ?? undefined}
        style={{ opacity: 0.992 }}
      />

      {Math.abs(artworkBrightness - 1) > 0.005 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: placedArtwork.displaySize.width,
            height: placedArtwork.displaySize.height,
            backgroundColor: brightnessOverlayColor,
            opacity: brightnessOverlayOpacity,
            zIndex: 1,
          }}
        />
      ) : null}

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: "rgba(255,255,255,0.1)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: "rgba(0,0,0,0.16)",
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 1,
            backgroundColor: "rgba(0,0,0,0.13)",
          }}
        />
      </View>

      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 3,
          }}
        >
          {cornerMarkers.map((cornerStyle, index) => (
            <View
              key={index}
              style={{
                position: "absolute",
                width: 14,
                height: 14,
                borderColor: colors.accent,
                ...cornerStyle,
              }}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function RoomShadowSlider({
  label,
  value,
  min,
  max,
  step,
  disabled = false,
  formatValue,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  formatValue: (value: number) => string;
  onChange?: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);

  useEffect(() => {
    setDraftValue(value);
    draftValueRef.current = value;
  }, [value]);

  const updateFromLocation = useCallback(
    (locationX: number) => {
      if (disabled || trackWidth <= 0) {
        return;
      }

      const percent = clampNumber(locationX / trackWidth, 0, 1);
      const nextValue = roundToStep(min + percent * (max - min), step);
      const clampedValue = clampNumber(nextValue, min, max);

      if (Math.abs(draftValueRef.current - clampedValue) < step / 2) {
        return;
      }

      draftValueRef.current = clampedValue;
      setDraftValue(clampedValue);
      onChange?.(clampedValue);
    },
    [disabled, max, min, onChange, step, trackWidth]
  );

  const commitDraftValue = useCallback(() => {
    if (disabled) {
      return;
    }

    onCommit(draftValueRef.current);
  }, [disabled, onCommit]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          updateFromLocation(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          updateFromLocation(event.nativeEvent.locationX);
        },
        onPanResponderRelease: commitDraftValue,
        onPanResponderTerminate: commitDraftValue,
      }),
    [commitDraftValue, disabled, updateFromLocation]
  );

  const percent = max > min ? clampNumber((draftValue - min) / (max - min), 0, 1) : 0;

  return (
    <View style={{ gap: spacing.xs, opacity: disabled ? 0.48 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
        <Text style={{ ...typography.small, color: colors.textPrimary, fontWeight: "700" }}>
          {label}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          {formatValue(draftValue)}
        </Text>
      </View>

      <View
        {...panResponder.panHandlers}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        style={{
          height: 28,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            height: 5,
            borderRadius: radii.pill,
            backgroundColor: colors.backgroundMuted,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${percent * 100}%`,
              height: "100%",
              backgroundColor: disabled ? colors.textPlaceholder : colors.accent,
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${percent * 100}%`,
            width: 18,
            height: 18,
            marginLeft: -9,
            borderRadius: radii.pill,
            borderWidth: 2,
            borderColor: colors.backgroundCard,
            backgroundColor: disabled ? colors.textPlaceholder : colors.accent,
          }}
        />
      </View>
    </View>
  );
}

function RoomShadowDirectionDial({
  angleRadians,
  disabled = false,
  onChange,
}: {
  angleRadians: number;
  disabled?: boolean;
  onChange: (angleRadians: number) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();
  const dialSize = 82;
  const center = dialSize / 2;
  const knobRadius = 8;
  const pointerRadius = 27;
  const knobX = center + Math.cos(angleRadians) * pointerRadius;
  const knobY = center + Math.sin(angleRadians) * pointerRadius;

  const updateFromLocation = useCallback(
    (locationX: number, locationY: number) => {
      if (disabled) {
        return;
      }

      const dx = locationX - center;
      const dy = locationY - center;

      if (Math.hypot(dx, dy) < 4) {
        return;
      }

      onChange(Math.atan2(dy, dx));
    },
    [center, disabled, onChange]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          updateFromLocation(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderMove: (event) => {
          updateFromLocation(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
      }),
    [disabled, updateFromLocation]
  );

  return (
    <View style={{ alignItems: "center", gap: spacing.xs, opacity: disabled ? 0.48 : 1 }}>
      <Text style={{ ...typography.small, color: colors.textPrimary, fontWeight: "700" }}>
        Direction
      </Text>
      <View
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Shadow direction"
        style={{
          width: dialSize,
          height: dialSize,
          borderRadius: dialSize / 2,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.backgroundInput,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          pointerEvents="none"
          width={dialSize}
          height={dialSize}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
          }}
        >
          <SvgLine
            x1={center}
            y1={center}
            x2={knobX}
            y2={knobY}
            stroke={disabled ? colors.textPlaceholder : colors.accent}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <SvgCircle
            cx={center}
            cy={center}
            r={4.5}
            fill={colors.borderStrong}
            opacity={0.65}
          />
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: knobX - knobRadius,
            top: knobY - knobRadius,
            width: knobRadius * 2,
            height: knobRadius * 2,
            borderRadius: knobRadius,
            borderWidth: 2,
            borderColor: colors.backgroundCard,
            backgroundColor: disabled ? colors.textPlaceholder : colors.accent,
          }}
        />
      </View>
    </View>
  );
}

function RoomShadowAdjustmentPanel({
  shadow,
  baseShadow,
  materialRealism,
  activeRealismTab,
  artworkBrightness,
  enabled,
  artworkCount,
  bottomSafePadding,
  maxWidth,
  onClose,
  onToggle,
  onOpacityChange,
  onBlurRadiusChange,
  onDistanceChange,
  onDirectionChange,
  onMaterialRealismChange,
  onActiveRealismTabChange,
  onArtworkBrightnessChange,
}: {
  shadow: ResolvedWallShadow;
  baseShadow: ResolvedWallShadow;
  materialRealism: ResolvedRoomMaterialRealism;
  activeRealismTab: RoomRealismControlTab;
  artworkBrightness: number;
  enabled: boolean;
  artworkCount: number;
  bottomSafePadding: number;
  maxWidth?: number;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
  onOpacityChange: (opacity: number) => void;
  onBlurRadiusChange: (blurRadius: number) => void;
  onDistanceChange: (distance: number) => void;
  onDirectionChange: (angleRadians: number) => void;
  onMaterialRealismChange: (updates: RoomMaterialRealismDraft) => void;
  onActiveRealismTabChange: (tab: RoomRealismControlTab) => void;
  onArtworkBrightnessChange: (brightness: number) => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const slideProgress = useRef(new Animated.Value(1)).current;
  const panelDisabled = artworkCount === 0;
  const shadowDistance = getWallShadowDistance(shadow);
  const shadowAngle =
    shadowDistance > 0.1 ? getWallShadowAngle(shadow) : getWallShadowAngle(baseShadow);
  const controlsDisabled = panelDisabled || !enabled;

  useEffect(() => {
    Animated.timing(slideProgress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [slideProgress]);

  return (
    <Animated.View
      style={{
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.08)",
        backgroundColor: colors.headerBackground,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xs,
        paddingBottom: Math.max(bottomSafePadding, spacing.sm),
        transform: [
          {
            translateY: slideProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 280],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth,
          alignSelf: "center",
          borderWidth: 2,
          borderColor: colors.borderStrong,
          borderRadius: radii.xl,
          backgroundColor: colors.backgroundCard,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
          shadowColor: "#000000",
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
              Realism
            </Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={1}>
              {artworkCount === 0
                ? "Add artwork to adjust shadows."
                : artworkCount === 1
                  ? "Adjusts the placed artwork."
                  : `Adjusts all ${artworkCount} placed artworks.`}
            </Text>
          </View>

          {activeRealismTab === "wall" ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled, disabled: panelDisabled }}
              accessibilityLabel="Enable wall shadow"
              disabled={panelDisabled}
              onPress={() => onToggle(!enabled)}
              style={{
                minWidth: 62,
                height: 30,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: enabled ? colors.accent : colors.borderStrong,
                backgroundColor: enabled ? colors.accentSoft : colors.backgroundInput,
                alignItems: "center",
                justifyContent: "center",
                opacity: panelDisabled ? 0.45 : 1,
                paddingHorizontal: spacing.xs,
              }}
            >
              <Text
                style={{
                  ...typography.small,
                  color: enabled ? colors.accent : colors.textSecondary,
                  fontWeight: "800",
                }}
              >
                {enabled ? "On" : "Off"}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close wall shadow controls"
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 34,
              height: 30,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: radii.lg,
            overflow: "hidden",
          }}
        >
          {ROOM_REALISM_TABS.map((tab) => {
            const isActive = activeRealismTab === tab.value;

            return (
              <Pressable
                key={tab.value}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => onActiveRealismTabChange(tab.value)}
                style={{
                  flex: 1,
                  minHeight: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isActive ? colors.accent : colors.backgroundInput,
                }}
              >
                <Text
                  style={{
                    ...typography.small,
                    color: isActive ? "#FFFFFF" : colors.textSecondary,
                    fontWeight: "800",
                  }}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            height: ROOM_REALISM_CONTROL_CONTENT_HEIGHT,
            justifyContent: "center",
          }}
        >
          {activeRealismTab === "wall" ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <RoomShadowDirectionDial
                angleRadians={shadowAngle}
                disabled={controlsDisabled}
                onChange={onDirectionChange}
              />

              <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                <RoomShadowSlider
                  label="Strength"
                  value={shadow.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={controlsDisabled}
                  formatValue={(shadowOpacity) => `${Math.round(shadowOpacity * 100)}%`}
                  onChange={onOpacityChange}
                  onCommit={onOpacityChange}
                />

                <RoomShadowSlider
                  label="Softness"
                  value={shadow.blurRadius}
                  min={0}
                  max={WALL_SHADOW_MAX_SOFTNESS}
                  step={1}
                  disabled={controlsDisabled}
                  formatValue={(blurRadius) => `${Math.round(blurRadius)} px`}
                  onChange={onBlurRadiusChange}
                  onCommit={onBlurRadiusChange}
                />

                <RoomShadowSlider
                  label="Distance"
                  value={shadowDistance}
                  min={0}
                  max={72}
                  step={1}
                  disabled={controlsDisabled}
                  formatValue={(distance) => `${Math.round(distance)} px`}
                  onChange={onDistanceChange}
                  onCommit={onDistanceChange}
                />
              </View>
            </View>
          ) : activeRealismTab === "mat" ? (
            <View style={{ gap: spacing.xs }}>
              <RoomShadowSlider
                label="Bevel Depth"
                value={materialRealism.bevelDepth}
                min={0}
                max={3}
                step={0.01}
                disabled={panelDisabled}
                formatValue={(value) => `${Math.round(value * 100)}%`}
                onChange={(bevelDepth) => onMaterialRealismChange({ bevelDepth })}
                onCommit={(bevelDepth) => onMaterialRealismChange({ bevelDepth })}
              />

              <RoomShadowSlider
                label="Bevel Softness"
                value={materialRealism.bevelSoftness}
                min={0}
                max={1}
                step={0.01}
                disabled={panelDisabled}
                formatValue={(value) => `${Math.round(value * 100)}%`}
                onChange={(bevelSoftness) => onMaterialRealismChange({ bevelSoftness })}
                onCommit={(bevelSoftness) => onMaterialRealismChange({ bevelSoftness })}
              />
            </View>
          ) : activeRealismTab === "frame" ? (
            <View style={{ gap: spacing.xs }}>
              <RoomShadowSlider
                label="Frame Depth"
                value={materialRealism.frameDepth}
                min={0}
                max={3}
                step={0.01}
                disabled={panelDisabled}
                formatValue={(value) => `${Math.round(value * 100)}%`}
                onChange={(frameDepth) => onMaterialRealismChange({ frameDepth })}
                onCommit={(frameDepth) => onMaterialRealismChange({ frameDepth })}
              />

              <RoomShadowSlider
                label="Inner Lip Contrast"
                value={materialRealism.innerLipContrast}
                min={0}
                max={4}
                step={0.01}
                disabled={panelDisabled}
                formatValue={(value) => `${Math.round(value * 100)}%`}
                onChange={(innerLipContrast) => onMaterialRealismChange({ innerLipContrast })}
                onCommit={(innerLipContrast) => onMaterialRealismChange({ innerLipContrast })}
              />

              <RoomShadowSlider
                label="Artwork Brightness"
                value={artworkBrightness}
                min={0.5}
                max={1.25}
                step={0.01}
                disabled={panelDisabled}
                formatValue={(brightness) => `${Math.round(brightness * 100)}%`}
                onChange={onArtworkBrightnessChange}
                onCommit={onArtworkBrightnessChange}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <View
                style={{
                  minHeight: 34,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ ...typography.small, color: colors.textPrimary, fontWeight: "800" }}
                    numberOfLines={1}
                  >
                    Glass / Acrylic
                  </Text>
                  <Text
                    style={{
                      ...typography.small,
                      fontSize: 11,
                      lineHeight: 14,
                      color: colors.textSecondary,
                    }}
                    numberOfLines={1}
                  >
                    Subtle surface reflection
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{
                    checked: materialRealism.glassEnabled,
                    disabled: panelDisabled,
                  }}
                  accessibilityLabel="Enable glass or acrylic reflection"
                  disabled={panelDisabled}
                  onPress={() =>
                    onMaterialRealismChange({ glassEnabled: !materialRealism.glassEnabled })
                  }
                  style={{
                    minWidth: 62,
                    height: 30,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: materialRealism.glassEnabled ? colors.accent : colors.borderStrong,
                    backgroundColor: materialRealism.glassEnabled
                      ? colors.accentSoft
                      : colors.backgroundInput,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: panelDisabled ? 0.45 : 1,
                    paddingHorizontal: spacing.xs,
                  }}
                >
                  <Text
                    style={{
                      ...typography.small,
                      color: materialRealism.glassEnabled ? colors.accent : colors.textSecondary,
                      fontWeight: "800",
                    }}
                  >
                    {materialRealism.glassEnabled ? "On" : "Off"}
                  </Text>
                </Pressable>
              </View>

              <RoomShadowSlider
                label="Reflection Strength"
                value={materialRealism.reflectionStrength}
                min={0}
                max={1}
                step={0.01}
                disabled={panelDisabled || !materialRealism.glassEnabled}
                formatValue={(value) => `${Math.round(value * 100)}%`}
                onChange={(reflectionStrength) => onMaterialRealismChange({ reflectionStrength })}
                onCommit={(reflectionStrength) => onMaterialRealismChange({ reflectionStrength })}
              />
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function RoomSwitchRow({
  label,
  accessibilityLabel,
  value,
  disabled = false,
  onValueChange,
}: {
  label: string;
  accessibilityLabel?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{
        minHeight: 38,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radii.md,
        backgroundColor: colors.backgroundInput,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>{label}</Text>

      <View
        style={{
          width: 42,
          height: 24,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: value ? colors.accent : colors.borderStrong,
          backgroundColor: value ? colors.accent : colors.backgroundMuted,
          padding: 3,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: radii.pill,
            backgroundColor: colors.white,
            alignSelf: value ? "flex-end" : "flex-start",
          }}
        />
      </View>
    </Pressable>
  );
}

export default function RoomViewScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const canGoBack = navigation.canGoBack();
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const draft = useFramingFlowStore((state) => state.draft);
  const setRoomView = useFramingFlowStore((state) => state.setRoomView);
  const resetDraft = useFramingFlowStore((state) => state.resetDraft);
  const projectFolders = useSavedProjectsStore((state) => state.projectFolders);
  const framedArtworks = useSavedProjectsStore((state) => state.framedArtworks);
  const { colors, radii, spacing, typography, isDark } = useAppTheme();
  const exportSvgRef = useRef<SvgElementRef | null>(null);
  const shortcutInputRef = useRef<TextInput | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [previewAreaSize, setPreviewAreaSize] = useState({ width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [wallPhotoSourceSheetVisible, setWallPhotoSourceSheetVisible] = useState(false);
  const [framedArtworkSheetVisible, setFramedArtworkSheetVisible] = useState(false);
  const [activeSheet, setActiveSheet] = useState<RoomViewDockSheet | null>(null);
  const [activeRealismTab, setActiveRealismTab] = useState<RoomRealismControlTab>("wall");
  const [selectedArtworkProjectFolderId, setSelectedArtworkProjectFolderId] = useState<string | null>(null);
  const [artworkSortMode, setArtworkSortMode] = useState<ArtworkSortMode>("recent");
  const [artworkSortMenuVisible, setArtworkSortMenuVisible] = useState(false);
  const [isArtworkDragging, setIsArtworkDragging] = useState(false);
  const [isCalibrationDragging, setIsCalibrationDragging] = useState(false);

  const roomView = draft.roomView;
  const wallPhoto = roomView.wallPhoto;
  const calibration = roomView.calibration;
  const activePresetScene = getPresetRoomSceneById(roomView.presetSceneId);
  const activeSourceId =
    getRoomSourceId(roomView.sourceMode, activePresetScene?.id ?? null) ??
    MY_WALL_SCENE_SOURCE_ID;
  const activeSourcePlacements = useMemo(
    () =>
      roomView.placements.filter(
        (placement) =>
          placement.sourceMode === roomView.sourceMode &&
          placement.sourceId === activeSourceId
      ),
    [activeSourceId, roomView.placements, roomView.sourceMode]
  );
  const activePlacement =
    activeSourcePlacements.find((placement) => placement.id === roomView.activePlacementId) ?? null;
  const selectedFramedArtwork =
    framedArtworks.find((artwork) => artwork.id === activePlacement?.framedArtworkId) ?? null;
  const selectedDraft = selectedFramedArtwork?.draft ?? null;
  const selectedDerived = selectedDraft ? buildDerivedGeometry(selectedDraft) : null;
  const activeSourceSceneDefaultShadow =
    roomView.sourceMode === "presetRoom" ? activePresetScene.defaultShadow : null;
  const activeSourceWallShadowOverride = roomView.sourceWallShadows?.[activeSourceId] ?? null;
  const activeSourceBaseWallShadow = resolveWallShadow(activeSourceSceneDefaultShadow, null);
  const activeSourceWallShadow = resolveWallShadow(
    activeSourceSceneDefaultShadow,
    activeSourceWallShadowOverride
  );
  const activeSourceShadowEnabled = activeSourceWallShadow.opacity > 0.001;
  const activeSourceShadowDistance = getWallShadowDistance(activeSourceWallShadow);
  const activeSourceArtworkBrightness = clampNumber(
    roomView.sourceArtworkBrightness?.[activeSourceId] ?? 1,
    0.5,
    1.25
  );
  const activeSourceMaterialRealism = resolveRoomMaterialRealism(
    roomView.sourceMaterialRealism?.[activeSourceId] ?? null
  );
  const activeSourceEnvironment =
    roomView.sourceMode === "presetRoom" ? activePresetScene.environment ?? null : null;
  const isTabletLandscape =
    Math.min(windowWidth, windowHeight) >= TABLET_WIDTH_BREAKPOINT && windowWidth > windowHeight;
  const isPhoneWorkspace = Math.min(windowWidth, windowHeight) < TABLET_WIDTH_BREAKPOINT;
  const isTabletWorkspace = !isPhoneWorkspace;
  const sceneImageWidth =
    roomView.sourceMode === "presetRoom"
      ? activePresetScene.sourceImageDimensions.width
      : wallPhoto?.imageWidth;
  const sceneImageHeight =
    roomView.sourceMode === "presetRoom"
      ? activePresetScene.sourceImageDimensions.height
      : wallPhoto?.imageHeight;
  const presetSceneAsset =
    roomView.sourceMode === "presetRoom"
      ? Image.resolveAssetSource(activePresetScene.imageSource)
      : null;
  const presetScenePixelsPerInch = getPresetScenePixelsPerInch(activePresetScene);
  const wallAspectRatio =
    sceneImageWidth && sceneImageHeight
      ? sceneImageWidth / sceneImageHeight
      : getWallPhotoAspectRatio(wallPhoto);
  const fittedStageSize = useMemo(
    () =>
      getFittedStageSize({
        containerWidth: previewAreaSize.width,
        containerHeight: previewAreaSize.height,
        aspectRatio: wallAspectRatio,
      }),
    [previewAreaSize.height, previewAreaSize.width, wallAspectRatio]
  );
  const placementBounds = useMemo(
    () =>
      roomView.sourceMode === "presetRoom"
        ? activePresetScene.wallRegion
        : { x: 0, y: 0, width: 1, height: 1 },
    [activePresetScene.wallRegion, roomView.sourceMode]
  );
  const displayedImageRect = useMemo(
    () =>
      getDisplayedImageRect({
        stageSize,
        imageWidth: sceneImageWidth,
        imageHeight: sceneImageHeight,
      }),
    [sceneImageHeight, sceneImageWidth, stageSize]
  );
  const knownMeasurementOptions = useMemo(
    () => getRoomKnownMeasurementOptions(unit),
    [unit]
  );
  const sortedProjectFolders = useMemo(
    () =>
      [...projectFolders].sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
      ),
    [projectFolders]
  );
  const selectedArtworkProjectFolder =
    sortedProjectFolders.find((folder) => folder.id === selectedArtworkProjectFolderId) ??
    sortedProjectFolders[0] ??
    null;
  const selectedFolderFramedArtworks = useMemo(
    () =>
      selectedArtworkProjectFolder
        ? framedArtworks.filter(
            (artwork) => artwork.projectFolderId === selectedArtworkProjectFolder.id
          )
        : [],
    [framedArtworks, selectedArtworkProjectFolder]
  );
  const sortedFramedArtworks = useMemo(
    () => sortFramedArtworks(selectedFolderFramedArtworks, artworkSortMode),
    [artworkSortMode, selectedFolderFramedArtworks]
  );
  const displayPixelsPerInch = getDisplayPixelsPerInch({
    sourceImageWidth: sceneImageWidth,
    stageWidth: displayedImageRect.width,
    pixelsPerInch:
      roomView.sourceMode === "presetRoom"
        ? presetScenePixelsPerInch
        : calibration.pixelsPerInch,
  });
  const gridSizeInches = getRoomGridSizeInches({
    gridSize: roomView.gridSize,
    gridSizeUnit: roomView.gridSizeUnit,
  });
  const snapGridSizePixels =
    roomView.snapToGridEnabled && displayPixelsPerInch !== null && gridSizeInches !== null
      ? displayPixelsPerInch * gridSizeInches
      : null;
  const framedArtworkScale =
    displayPixelsPerInch === null
      ? null
      : unit === "cm"
        ? displayPixelsPerInch / 2.54
        : displayPixelsPerInch;
  const placedArtworks = useMemo<WallArtworkRenderItem[]>(() => {
    if (!sceneImageWidth || !displayPixelsPerInch || !framedArtworkScale) {
      return [];
    }

    return activeSourcePlacements
      .map((placement, index) => {
        if (!placement.framedArtworkId) {
          return null;
        }

        const artwork = framedArtworks.find((saved) => saved.id === placement.framedArtworkId);

        if (!artwork) {
          return null;
        }

        const preview = getPlacementPreview(artwork, placement);
        const derived = buildDerivedGeometry(artwork.draft);
        const finalOuterSize = getSavedArtworkFinalOuterSizeInches(artwork, derived);

        if (!derived.isValidGeometry || !finalOuterSize) {
          return null;
        }

        const placementScale = getPlacementScale(placement);
        const displaySize = {
          width: finalOuterSize.width * displayPixelsPerInch * placementScale,
          height: finalOuterSize.height * displayPixelsPerInch * placementScale,
        };

        return {
          placement: {
            ...placement,
            zIndex: placement.zIndex ?? index,
          },
          artwork,
          preview,
          displaySize,
          frameColorHex: resolveFrameColorHex(
            preview.frameProfileId,
            preview.frameFinishId,
            preview.frameColorHex
          ),
          physicalScale: framedArtworkScale * placementScale,
          renderGeometry: {
            artworkSize: convertSizeToUnit(derived.artworkSize, artwork.unit, unit),
            openingSize: convertSizeToUnit(derived.openingSize, artwork.unit, unit),
            outerMatSize: convertSizeToUnit(derived.outerMatSize, artwork.unit, unit),
            offsetX: convertMeasurementToUnit(preview.offsetX, artwork.unit, unit),
            offsetY: convertMeasurementToUnit(preview.offsetY, artwork.unit, unit),
          },
        };
      })
      .filter((item): item is WallArtworkRenderItem => item !== null)
      .sort((first, second) => first.placement.zIndex - second.placement.zIndex);
  }, [
    activeSourcePlacements,
    displayPixelsPerInch,
    framedArtworkScale,
    framedArtworks,
    sceneImageWidth,
    unit,
  ]);
  const selectedPlacedArtwork =
    placedArtworks.find((item) => item.placement.id === roomView.activePlacementId) ?? null;
  const selectedArtworkToolbarPosition = getSelectedArtworkToolbarPosition({
    selectedArtwork: selectedPlacedArtwork,
    imageRect: displayedImageRect,
  });
  const selectedSizeLabel = selectedFramedArtwork
    ? getSavedArtworkSizeLabel(selectedFramedArtwork, unit, imperialPrecision)
    : "Not selected";
  const placedArtworkCount = placedArtworks.length;
  const customMeasurementUnitLabel = unit === "cm" ? "cm" : "in";
  const customMeasurementUnitName = unit === "cm" ? "centimeters" : "inches";
  const standardCalibrationMeasurementLabel = getStandardCalibrationMeasurementLabel(unit);
  const standardCalibrationPaperLabel = getStandardCalibrationPaperLabel(unit);
  const wallPhotoEmptyStageHeight = fittedStageSize?.height ?? previewAreaSize.height;
  const useCompactWallPhotoEmptyState =
    isPhoneWorkspace && roomView.sourceMode === "myWall" && !wallPhoto;
  const showWallPhotoEmptyHelper =
    !useCompactWallPhotoEmptyState || wallPhotoEmptyStageHeight >= 340;
  const wallPhotoEmptyIconSize = useCompactWallPhotoEmptyState ? 46 : 64;
  const wallPhotoEmptyIconRadius = wallPhotoEmptyIconSize / 2;
  const wallPhotoEmptyIconGlyphSize = useCompactWallPhotoEmptyState ? 22 : 28;
  const paperPhotoHelperText =
    unit === "cm"
      ? "Use a straight-on photo with the long edge of standard A4 paper (29.7 cm) or another known object on the wall for accurate scale."
      : "Use a straight-on photo with the long edge of standard U.S. letter paper (11 in) or another known object on the wall for accurate scale.";
  const calibrationHelperText = `Drag the ruler handles across a known measurement on the wall. Use the long edge of ${standardCalibrationPaperLabel} (${standardCalibrationMeasurementLabel}), or enter a custom measurement.`;
  const hasActiveScene =
    roomView.sourceMode === "presetRoom"
      ? Boolean(activePresetScene)
      : Boolean(wallPhoto);
  const canPlaceFramedArtwork =
    framedArtworks.length > 0 &&
    (roomView.sourceMode === "presetRoom"
      ? Boolean(activePresetScene)
      : Boolean(wallPhoto && calibration.pixelsPerInch));
  const gridSizeHelperText =
    gridSizeInches === null
      ? `Enter a grid size greater than 0 ${customMeasurementUnitLabel}.`
      : calibration.pixelsPerInch === null
        ? "Snapping starts after the wall scale is calibrated."
        : `Snaps artwork centers every ${formatMeasurement(
            inchesToMeasurementUnit(gridSizeInches, unit),
            unit,
            imperialPrecision
          )}.`;

  useEffect(() => {
    if (!selectedArtworkProjectFolderId && sortedProjectFolders[0]) {
      setSelectedArtworkProjectFolderId(sortedProjectFolders[0].id);
      return;
    }

    if (
      selectedArtworkProjectFolderId &&
      !sortedProjectFolders.some((folder) => folder.id === selectedArtworkProjectFolderId)
    ) {
      setSelectedArtworkProjectFolderId(sortedProjectFolders[0]?.id ?? null);
    }
  }, [selectedArtworkProjectFolderId, sortedProjectFolders]);

  useEffect(() => {
    if (roomView.sourceMode !== "myWall") {
      return;
    }

    if (!wallPhoto?.imageUri || (wallPhoto.imageWidth && wallPhoto.imageHeight)) {
      return;
    }

    Image.getSize(
      wallPhoto.imageUri,
      (imageWidth, imageHeight) => {
        setRoomView({
          wallPhoto: {
            ...wallPhoto,
            imageWidth,
            imageHeight,
          },
        });
      },
      () => undefined
    );
  }, [roomView.sourceMode, setRoomView, wallPhoto]);

  useEffect(() => {
    if (roomView.sourceMode !== "myWall") {
      return;
    }

    const nextPixelsPerInch = calculateCalibrationPixelsPerInch({
      wallPhoto,
      calibration,
      unit,
    });
    const currentPixelsPerInch = calibration.pixelsPerInch;
    const bothEmpty = nextPixelsPerInch === null && currentPixelsPerInch === null;

    if (
      bothEmpty ||
      (nextPixelsPerInch !== null &&
        currentPixelsPerInch !== null &&
        Math.abs(nextPixelsPerInch - currentPixelsPerInch) < 0.01)
    ) {
      return;
    }

    setRoomView({
      calibration: {
        pixelsPerInch: nextPixelsPerInch,
      },
    });
  }, [
    calibration,
    calibration.pixelsPerInch,
    roomView.sourceMode,
    setRoomView,
    unit,
    wallPhoto,
  ]);

  useEffect(() => {
    if (calibration.customMeasurementUnit === unit) {
      return;
    }

    const customMeasurement = parseMeasurement(calibration.customMeasurement);

    if (customMeasurement === null) {
      setRoomView({
        calibration: {
          customMeasurementUnit: unit,
        },
      });
      return;
    }

    const customMeasurementInches = measurementToInches(
      customMeasurement,
      calibration.customMeasurementUnit
    );

    setRoomView({
      calibration: {
        customMeasurement: roundMeasurementString(
          inchesToMeasurementUnit(customMeasurementInches, unit)
        ),
        customMeasurementUnit: unit,
      },
    });
  }, [
    calibration.customMeasurement,
    calibration.customMeasurementUnit,
    setRoomView,
    unit,
  ]);

  useEffect(() => {
    if (roomView.gridSizeUnit === unit) {
      return;
    }

    const parsedGridSize = parseMeasurement(roomView.gridSize);
    const currentDefaultGridSize = getDefaultRoomGridSize(roomView.gridSizeUnit);
    const nextDefaultGridSize = getDefaultRoomGridSize(unit);
    const shouldUseNextDefault =
      parsedGridSize === null ||
      Math.abs(parsedGridSize - currentDefaultGridSize) < 0.0001;
    let nextGridSize = nextDefaultGridSize;

    if (!shouldUseNextDefault && parsedGridSize !== null) {
      nextGridSize = inchesToMeasurementUnit(
        roomView.gridSizeUnit === "cm" ? parsedGridSize / 2.54 : parsedGridSize,
        unit
      );
    }

    setRoomView({
      gridSize: roundMeasurementString(nextGridSize),
      gridSizeUnit: unit,
    });
  }, [
    roomView.gridSize,
    roomView.gridSizeUnit,
    setRoomView,
    unit,
  ]);

  const handleCalibrationRulerChange = useCallback(
    (start: RoomViewPoint, end: RoomViewPoint) => {
      setRoomView({
        calibration: {
          start,
          end,
        },
      });
    },
    [setRoomView]
  );

  const handlePreviewAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setPreviewAreaSize((currentSize) =>
      Math.abs(currentSize.width - width) < 1 && Math.abs(currentSize.height - height) < 1
        ? currentSize
        : { width, height }
    );
  }, []);

  const handleSourceModeChange = useCallback(
    (sourceMode: RoomViewSourceMode) => {
      setRoomView({
        sourceMode,
        presetSceneId:
          sourceMode === "presetRoom"
            ? roomView.presetSceneId ?? DEFAULT_PRESET_ROOM_SCENE_ID
            : roomView.presetSceneId,
        activePlacementId: null,
      });
    },
    [roomView.presetSceneId, setRoomView]
  );

  const handleSelectPresetScene = useCallback(
    (sceneId: string) => {
      setRoomView({
        sourceMode: "presetRoom",
        presetSceneId: sceneId,
        activePlacementId: null,
      });
    },
    [setRoomView]
  );

  const selectWallPhoto = useCallback(
    (selection: { imageUri: string; imageWidth: number | null; imageHeight: number | null }) => {
      const initialRoomView = createInitialRoomViewDraft(unit);

      setRoomView({
        sourceMode: "myWall",
        wallPhoto: {
          imageUri: selection.imageUri,
          imageWidth: selection.imageWidth,
          imageHeight: selection.imageHeight,
        },
        calibration: initialRoomView.calibration,
        isCalibrationRulerVisible: true,
        snapToGridEnabled: initialRoomView.snapToGridEnabled,
        gridSize: initialRoomView.gridSize,
        gridSizeUnit: initialRoomView.gridSizeUnit,
        placements: roomView.placements.filter((placement) => placement.sourceMode !== "myWall"),
        activePlacementId: null,
      });
    },
    [roomView.placements, setRoomView, unit]
  );

  const handlePickWallPhotoFromLibrary = useCallback(async () => {
    await importWallPhotoFromLibrary(selectWallPhoto);
  }, [selectWallPhoto]);

  const handleTakeWallPhoto = useCallback(async () => {
    await importWallPhotoFromCamera(selectWallPhoto);
  }, [selectWallPhoto]);

  const openWallPhotoSourceChooser = useCallback(() => {
    setActiveSheet(null);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Photo Library"],
          cancelButtonIndex: 0,
          userInterfaceStyle: isDark ? "dark" : "light",
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            void handleTakeWallPhoto();
          }

          if (buttonIndex === 2) {
            void handlePickWallPhotoFromLibrary();
          }
        }
      );
      return;
    }

    setWallPhotoSourceSheetVisible(true);
  }, [handlePickWallPhotoFromLibrary, handleTakeWallPhoto, isDark]);

  const openFramedArtworkChooser = useCallback(() => {
    if (roomView.sourceMode === "presetRoom") {
      if (!activePresetScene) {
        Alert.alert("Preset room needed", "Choose a preset room before placing framed artwork.");
        return;
      }

      setSelectedArtworkProjectFolderId(
        (current) => current ?? sortedProjectFolders[0]?.id ?? null
      );
      setActiveSheet(null);
      setFramedArtworkSheetVisible(true);
      return;
    }

    if (!wallPhoto) {
      Alert.alert("Wall photo needed", "Add a wall photo before placing framed artwork.");
      return;
    }

    if (!calibration.pixelsPerInch) {
      Alert.alert("Calibrate scale", "Calibrate the wall scale before placing framed artwork.");
      return;
    }

    setSelectedArtworkProjectFolderId(
      (current) => current ?? sortedProjectFolders[0]?.id ?? null
    );
    setActiveSheet(null);
    setFramedArtworkSheetVisible(true);
  }, [
    activePresetScene,
    calibration.pixelsPerInch,
    roomView.sourceMode,
    sortedProjectFolders,
    wallPhoto,
  ]);

  const handleSelectFramedArtwork = useCallback(
    (framedArtwork: SavedFramedArtwork) => {
      const nextZIndex =
        activeSourcePlacements.reduce(
          (maxZIndex, placement) => Math.max(maxZIndex, placement.zIndex ?? 0),
          -1
        ) + 1;
      const defaultCenter =
        roomView.sourceMode === "presetRoom"
          ? {
              x: placementBounds.x + placementBounds.width / 2,
              y: placementBounds.y + placementBounds.height / 2,
            }
          : { x: 0.5, y: 0.48 };
      const placement = createRoomArtworkPlacement(
        framedArtwork.id,
        defaultCenter,
        nextZIndex,
        roomView.sourceMode,
        activeSourceId
      );

      setRoomView({
        placements: [...roomView.placements, placement],
        activePlacementId: placement.id,
      });
      setArtworkSortMenuVisible(false);
      setFramedArtworkSheetVisible(false);
    },
    [
      activeSourceId,
      activeSourcePlacements,
      placementBounds,
      roomView.placements,
      roomView.sourceMode,
      setRoomView,
    ]
  );

  const handleSelectPlacement = useCallback(
    (placementId: string) => {
      setRoomView({
        activePlacementId: placementId,
      });
    },
    [setRoomView]
  );

  const handleClearPlacementSelection = useCallback(() => {
    if (!roomView.activePlacementId) {
      return;
    }

    setRoomView({
      activePlacementId: null,
    });
  }, [roomView.activePlacementId, setRoomView]);

  const handleMovePlacement = useCallback(
    (placementId: string, center: RoomViewPoint) => {
      setRoomView({
        placements: roomView.placements.map((placement) =>
          placement.id === placementId ? { ...placement, center } : placement
        ),
      });
    },
    [roomView.placements, setRoomView]
  );

  const updateActiveSourceWallShadow = useCallback(
    (wallShadowPatch: RoomWallShadowDraft) => {
      const currentSourceWallShadows = roomView.sourceWallShadows ?? {};
      const currentSourceShadow = currentSourceWallShadows[activeSourceId] ?? {};

      setRoomView({
        sourceWallShadows: {
          ...currentSourceWallShadows,
          [activeSourceId]: {
            ...currentSourceShadow,
            ...wallShadowPatch,
          },
        },
      });
    },
    [activeSourceId, roomView.sourceWallShadows, setRoomView]
  );

  const handleSourceWallShadowToggle = useCallback(
    (enabled: boolean) => {
      updateActiveSourceWallShadow({
        opacity: enabled ? activeSourceBaseWallShadow.opacity : 0,
      });
    },
    [activeSourceBaseWallShadow.opacity, updateActiveSourceWallShadow]
  );

  const handleSourceWallShadowDistanceChange = useCallback(
    (distance: number) => {
      const direction = getWallShadowDirection(
        activeSourceWallShadow,
        activeSourceBaseWallShadow
      );

      updateActiveSourceWallShadow({
        offsetX: roundToStep(direction.x * distance, 0.1),
        offsetY: roundToStep(direction.y * distance, 0.1),
      });
    },
    [
      activeSourceBaseWallShadow,
      activeSourceWallShadow,
      updateActiveSourceWallShadow,
    ]
  );

  const handleSourceWallShadowDirectionChange = useCallback(
    (angleRadians: number) => {
      const distance = activeSourceShadowDistance > 0.1
        ? activeSourceShadowDistance
        : getWallShadowDistance(activeSourceBaseWallShadow);

      updateActiveSourceWallShadow({
        offsetX: roundToStep(Math.cos(angleRadians) * distance, 0.1),
        offsetY: roundToStep(Math.sin(angleRadians) * distance, 0.1),
      });
    },
    [
      activeSourceBaseWallShadow,
      activeSourceShadowDistance,
      updateActiveSourceWallShadow,
    ]
  );

  const handleSourceArtworkBrightnessChange = useCallback(
    (brightness: number) => {
      const currentSourceArtworkBrightness = roomView.sourceArtworkBrightness ?? {};

      setRoomView({
        sourceArtworkBrightness: {
          ...currentSourceArtworkBrightness,
          [activeSourceId]: roundToStep(clampNumber(brightness, 0.5, 1.25), 0.01),
        },
      });
    },
    [activeSourceId, roomView.sourceArtworkBrightness, setRoomView]
  );

  const updateActiveSourceMaterialRealism = useCallback(
    (materialRealismPatch: RoomMaterialRealismDraft) => {
      const currentSourceMaterialRealism = roomView.sourceMaterialRealism ?? {};
      const currentSourceRealism = currentSourceMaterialRealism[activeSourceId] ?? {};

      setRoomView({
        sourceMaterialRealism: {
          ...currentSourceMaterialRealism,
          [activeSourceId]: {
            ...currentSourceRealism,
            ...materialRealismPatch,
          },
        },
      });
    },
    [activeSourceId, roomView.sourceMaterialRealism, setRoomView]
  );

  const deleteSelectedPlacement = useCallback(() => {
    if (!activePlacement) {
      return;
    }

    setRoomView({
      placements: roomView.placements.filter(
        (placement) => placement.id !== activePlacement.id
      ),
      activePlacementId: null,
    });
  }, [activePlacement, roomView.placements, setRoomView]);

  const handleRemoveSelectedPlacement = useCallback(() => {
    if (!activePlacement) {
      return;
    }

    const selectedName = selectedFramedArtwork?.name ?? "this framed artwork";

    Alert.alert(
      "Remove Artwork",
      `Remove "${selectedName}" from this wall layout?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: deleteSelectedPlacement,
        },
      ]
    );
  }, [activePlacement, deleteSelectedPlacement, selectedFramedArtwork?.name]);

  const handleDuplicateSelectedPlacement = useCallback(() => {
    if (!activePlacement) {
      return;
    }

    const nextZIndex =
      activeSourcePlacements.reduce(
        (maxZIndex, placement) => Math.max(maxZIndex, placement.zIndex ?? 0),
        -1
      ) + 1;
    const duplicateBase = createRoomArtworkPlacement(
      activePlacement.framedArtworkId,
      clampRoomPointToRect(
        {
          x: activePlacement.center.x + 0.035,
          y: activePlacement.center.y + 0.035,
        },
        placementBounds
      ),
      nextZIndex,
      activePlacement.sourceMode,
      activePlacement.sourceId
    );
    const duplicatePlacement: RoomArtworkPlacementDraft = {
      ...duplicateBase,
      scale: activePlacement.scale,
      rotationDegrees: activePlacement.rotationDegrees,
      wallShadow: activePlacement.wallShadow ? { ...activePlacement.wallShadow } : undefined,
      artworkSourceModeOverride: activePlacement.artworkSourceModeOverride,
      artworkImageUriOverride: activePlacement.artworkImageUriOverride,
      artworkCropOverride: activePlacement.artworkCropOverride
        ? { ...activePlacement.artworkCropOverride }
        : undefined,
    };

    setRoomView({
      placements: [...roomView.placements, duplicatePlacement],
      activePlacementId: duplicatePlacement.id,
    });
    void Haptics.selectionAsync();
  }, [activePlacement, activeSourcePlacements, placementBounds, roomView.placements, setRoomView]);

  const handleSelectedArtworkReplacement = useCallback(
    (selection: ArtworkImportSelection) => {
      if (!activePlacement || !selectedDerived?.artworkSize) {
        return;
      }

      const artworkCrop = createDefaultArtworkCrop(selection, selectedDerived.artworkSize);

      setRoomView({
        placements: roomView.placements.map((placement) =>
          placement.id === activePlacement.id
            ? {
                ...placement,
                artworkSourceModeOverride: "import",
                artworkImageUriOverride: selection.imageUri,
                artworkCropOverride: artworkCrop,
              }
            : placement
        ),
        activePlacementId: activePlacement.id,
      });
      void Haptics.selectionAsync();
    },
    [activePlacement, roomView.placements, selectedDerived?.artworkSize, setRoomView]
  );

  const handleReplaceSelectedArtwork = useCallback(() => {
    if (!activePlacement) {
      return;
    }

    const pickFromLibrary = () => {
      void importArtworkFromLibrary(handleSelectedArtworkReplacement);
    };
    const takePhoto = () => {
      void importArtworkFromCamera(handleSelectedArtworkReplacement);
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Choose from Photo Library", "Take Photo"],
          cancelButtonIndex: 0,
          userInterfaceStyle: isDark ? "dark" : "light",
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickFromLibrary();
          }

          if (buttonIndex === 2) {
            takePhoto();
          }
        }
      );
      return;
    }

    Alert.alert("Replace Artwork", "Choose a source for the replacement artwork image.", [
      { text: "Cancel", style: "cancel" },
      { text: "Photo Library", onPress: pickFromLibrary },
      { text: "Take Photo", onPress: takePhoto },
    ]);
  }, [activePlacement, handleSelectedArtworkReplacement, isDark]);

  const handleEditSelectedArtwork = useCallback(() => {
    if (!activePlacement) {
      return;
    }

    setActiveSheet("settings");
    setActiveRealismTab("frame");
  }, [activePlacement]);

  useEffect(() => {
    if (!activePlacement || !isTabletWorkspace || framedArtworkSheetVisible || wallPhotoSourceSheetVisible) {
      return;
    }

    const focusTimer = setTimeout(() => {
      shortcutInputRef.current?.focus();
    }, 120);

    return () => clearTimeout(focusTimer);
  }, [
    activePlacement,
    framedArtworkSheetVisible,
    isTabletWorkspace,
    wallPhotoSourceSheetVisible,
  ]);

  const exportGeometry = useMemo(() => {
    const sourcePixelsPerInch =
      roomView.sourceMode === "presetRoom"
        ? presetScenePixelsPerInch
        : calibration.pixelsPerInch;

    if (!sceneImageWidth || !sceneImageHeight || !sourcePixelsPerInch) {
      return null;
    }

    const sourceWidth = sceneImageWidth;
    const sourceHeight = sceneImageHeight;
    const exportScale = Math.min(1, MAX_EXPORT_WIDTH / sourceWidth);
    const placements = activeSourcePlacements
      .map((placement, index) => {
        if (!placement.framedArtworkId) {
          return null;
        }

        const artwork = framedArtworks.find((saved) => saved.id === placement.framedArtworkId);

        if (!artwork) {
          return null;
        }

        const preview = getPlacementPreview(artwork, placement);
        const derived = buildDerivedGeometry(artwork.draft);
        const finalOuterSize = getSavedArtworkFinalOuterSizeInches(artwork, derived);

        if (
          !derived.outerMatSize ||
          !derived.openingSize ||
          !derived.artworkSize ||
          !derived.isValidGeometry ||
          !finalOuterSize
        ) {
          return null;
        }

        const placementPixelsPerInch = sourcePixelsPerInch * getPlacementScale(placement);
        const frameProfile = getFrameProfile(preview.frameProfileId);
        const frameFaceWidthInches =
          frameProfile.renderStyle === "none" ? 0 : frameProfile.faceWidthInches;
        const frameThickness = frameFaceWidthInches * placementPixelsPerInch;
        const frameWidth = finalOuterSize.width * placementPixelsPerInch;
        const frameHeight = finalOuterSize.height * placementPixelsPerInch;
        const matWidth =
          measurementToInches(derived.outerMatSize.width, artwork.unit) * placementPixelsPerInch;
        const matHeight =
          measurementToInches(derived.outerMatSize.height, artwork.unit) * placementPixelsPerInch;
        const openingWidth =
          measurementToInches(derived.openingSize.width, artwork.unit) * placementPixelsPerInch;
        const openingHeight =
          measurementToInches(derived.openingSize.height, artwork.unit) * placementPixelsPerInch;
        const artworkWidth =
          measurementToInches(derived.artworkSize.width, artwork.unit) * placementPixelsPerInch;
        const artworkHeight =
          measurementToInches(derived.artworkSize.height, artwork.unit) * placementPixelsPerInch;
        const openingOffsetX =
          measurementToInches(preview.offsetX, artwork.unit) * placementPixelsPerInch;
        const openingOffsetY =
          measurementToInches(preview.offsetY, artwork.unit) * placementPixelsPerInch;
        const frameX = placement.center.x * sourceWidth - frameWidth / 2;
        const frameY = placement.center.y * sourceHeight - frameHeight / 2;
        const matX = frameX + frameThickness;
        const matY = frameY + frameThickness;
        const openingX = matX + (matWidth - openingWidth) / 2 + openingOffsetX;
        const openingY = matY + (matHeight - openingHeight) / 2 + openingOffsetY;

        return {
          id: placement.id,
          zIndex: placement.zIndex ?? index,
          preview,
          frameColorHex: resolveFrameColorHex(
            preview.frameProfileId,
            preview.frameFinishId,
            preview.frameColorHex
          ),
          frameX,
          frameY,
          frameWidth,
          frameHeight,
          matX,
          matY,
          matWidth,
          matHeight,
          openingX,
          openingY,
          openingWidth,
          openingHeight,
          artworkX: openingX + (openingWidth - artworkWidth) / 2,
          artworkY: openingY + (openingHeight - artworkHeight) / 2,
          artworkWidth,
          artworkHeight,
        };
      })
      .filter(isNonNullable)
      .sort((first, second) => first.zIndex - second.zIndex);

    if (placements.length === 0) {
      return null;
    }

    return {
      exportWidth: Math.max(1, Math.round(sourceWidth * exportScale)),
      exportHeight: Math.max(1, Math.round(sourceHeight * exportScale)),
      sourceWidth,
      sourceHeight,
      placements,
    };
  }, [
    activeSourcePlacements,
    calibration.pixelsPerInch,
    framedArtworks,
    presetScenePixelsPerInch,
    roomView.sourceMode,
    sceneImageHeight,
    sceneImageWidth,
  ]);

  const handleExportMockup = useCallback(() => {
    if (!exportGeometry || !hasActiveScene || !exportSvgRef.current?.toDataURL) {
      Alert.alert(
        "Mockup not ready",
        roomView.sourceMode === "presetRoom"
          ? "Choose a preset room and place framed artwork before exporting."
          : "Add a wall photo, calibrate the scale, and place the artwork before exporting."
      );
      return;
    }

    setIsExporting(true);
    exportSvgRef.current.toDataURL(
      (base64) => {
        void (async () => {
          try {
            const cacheDirectory = FileSystem.cacheDirectory;

            if (!cacheDirectory) {
              await Share.share({
                message: `data:image/png;base64,${base64}`,
              });
              return;
            }

            const fileUri = `${cacheDirectory}room-view-${Date.now()}.png`;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            await Share.share({
              url: fileUri,
              message: "Room View mockup",
            });
          } catch {
            Alert.alert(
              "Export failed",
              "Framing Assistant couldn't export the mockup image. Please try again."
            );
          } finally {
            setIsExporting(false);
          }
        })();
      },
      {
        width: exportGeometry.exportWidth,
        height: exportGeometry.exportHeight,
      }
    );
  }, [exportGeometry, hasActiveScene, roomView.sourceMode]);

  const hiddenExportSvg = hasActiveScene && exportGeometry ? (
    <Svg
      ref={exportSvgRef}
      width={exportGeometry.exportWidth}
      height={exportGeometry.exportHeight}
      viewBox={`0 0 ${exportGeometry.sourceWidth} ${exportGeometry.sourceHeight}`}
      style={{
        position: "absolute",
        left: -10000,
        top: -10000,
      }}
    >
      {roomView.sourceMode === "presetRoom" && presetSceneAsset?.uri ? (
        <SvgImage
          href={{ uri: presetSceneAsset.uri }}
          x={0}
          y={0}
          width={exportGeometry.sourceWidth}
          height={exportGeometry.sourceHeight}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : wallPhoto ? (
        <SvgImage
          href={{ uri: wallPhoto.imageUri }}
          x={0}
          y={0}
          width={exportGeometry.sourceWidth}
          height={exportGeometry.sourceHeight}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : null}
      {exportGeometry.placements.map((placement) => (
        <React.Fragment key={placement.id}>
          <SvgRect
            x={placement.frameX + 12}
            y={placement.frameY + 18}
            width={placement.frameWidth}
            height={placement.frameHeight}
            fill="rgba(0,0,0,0.24)"
          />
          <SvgRect
            x={placement.frameX}
            y={placement.frameY}
            width={placement.frameWidth}
            height={placement.frameHeight}
            fill={normalizeHex(placement.frameColorHex, "#050505")}
          />
          <SvgRect
            x={placement.matX}
            y={placement.matY}
            width={placement.matWidth}
            height={placement.matHeight}
            fill={normalizeHex(placement.preview.matColorHex, "#FFFFFF")}
          />
          {placement.preview.artworkSourceMode === "import" && placement.preview.artworkImageUri ? (
            <SvgImage
              href={{ uri: placement.preview.artworkImageUri }}
              x={placement.openingX}
              y={placement.openingY}
              width={placement.openingWidth}
              height={placement.openingHeight}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <SvgRect
              x={placement.openingX}
              y={placement.openingY}
              width={placement.openingWidth}
              height={placement.openingHeight}
              fill="#DDD6CC"
            />
          )}
        </React.Fragment>
      ))}
    </Svg>
  ) : null;

  const wallGeometryWarningSection = selectedFramedArtwork && !selectedDerived?.isValidGeometry ? (
    <Text style={{ ...typography.small, color: colors.warning }}>
      This saved framed artwork needs valid dimensions before Room View can place it.
    </Text>
  ) : null;

  const wallPhotoStageSection = (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setStageSize({ width, height });
      }}
      style={{
        ...(fittedStageSize
          ? {
              width: fittedStageSize.width,
              height: fittedStageSize.height,
              alignSelf: "center" as const,
            }
          : {
              width: "100%" as const,
              aspectRatio: wallAspectRatio,
            }),
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        backgroundColor: isDark ? "#111111" : "#E7EBF0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {hasActiveScene ? (
        <>
          {roomView.sourceMode === "presetRoom" ? (
            <PresetRoomSceneImage
              scene={activePresetScene}
              style={{
                position: "absolute",
                left: displayedImageRect.left,
                top: displayedImageRect.top,
                width: displayedImageRect.width,
                height: displayedImageRect.height,
              }}
            />
          ) : wallPhoto ? (
            <Image
              source={{ uri: wallPhoto.imageUri }}
              resizeMode="stretch"
              style={{
                position: "absolute",
                left: displayedImageRect.left,
                top: displayedImageRect.top,
                width: displayedImageRect.width,
                height: displayedImageRect.height,
              }}
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deselect framed artwork"
            disabled={isArtworkDragging || isCalibrationDragging}
            onPress={handleClearPlacementSelection}
            style={{
              position: "absolute",
              left: displayedImageRect.left,
              top: displayedImageRect.top,
              width: displayedImageRect.width,
              height: displayedImageRect.height,
              zIndex: 1,
            }}
          />

          {placedArtworks.map((placedArtwork) => (
            <PlacedWallArtwork
              key={placedArtwork.placement.id}
              placedArtwork={placedArtwork}
              selected={placedArtwork.placement.id === roomView.activePlacementId}
              stageSize={{
                width: displayedImageRect.width,
                height: displayedImageRect.height,
              }}
              stageOffset={{
                x: displayedImageRect.left,
                y: displayedImageRect.top,
              }}
              placementBounds={placementBounds}
              snapGridSizePixels={snapGridSizePixels}
              sceneDefaultShadow={
                roomView.sourceMode === "presetRoom"
                  ? activePresetScene.defaultShadow
                  : null
              }
              roomShadowOverride={activeSourceWallShadowOverride}
              materialRealism={activeSourceMaterialRealism}
              environment={activeSourceEnvironment}
              artworkBrightness={activeSourceArtworkBrightness}
              onSelect={handleSelectPlacement}
              onMoveEnd={handleMovePlacement}
              onDragStart={() => setIsArtworkDragging(true)}
              onDragEnd={() => setIsArtworkDragging(false)}
            />
          ))}

          {roomView.sourceMode === "myWall" && wallPhoto && roomView.isCalibrationRulerVisible ? (
            <CalibrationRuler
              start={calibration.start}
              end={calibration.end}
              imageRect={displayedImageRect}
              stageSize={stageSize}
              wallPhotoUri={wallPhoto.imageUri}
              onChange={handleCalibrationRulerChange}
              onDragStart={() => setIsCalibrationDragging(true)}
              onDragEnd={() => setIsCalibrationDragging(false)}
            />
          ) : null}

          {selectedArtworkToolbarPosition ? (
            <SelectedArtworkToolbar
              position={selectedArtworkToolbarPosition}
              onDuplicate={handleDuplicateSelectedPlacement}
              onReplace={handleReplaceSelectedArtwork}
              onEdit={handleEditSelectedArtwork}
              onDelete={deleteSelectedPlacement}
            />
          ) : null}
        </>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: useCompactWallPhotoEmptyState ? spacing.md : spacing.xl,
            paddingVertical: useCompactWallPhotoEmptyState ? spacing.md : spacing.xxl,
          }}
        >
          <View
            style={{
              width: wallPhotoEmptyIconSize,
              height: wallPhotoEmptyIconSize,
              borderRadius: wallPhotoEmptyIconRadius,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: colors.backgroundCard,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: useCompactWallPhotoEmptyState ? spacing.sm : spacing.lg,
            }}
          >
            <Ionicons
              name="home-outline"
              size={wallPhotoEmptyIconGlyphSize}
              color={colors.textPrimary}
            />
          </View>
          <Text
            style={{
              ...(useCompactWallPhotoEmptyState ? typography.sectionTitle : typography.screenTitle),
              color: colors.textPrimary,
              textAlign: "center",
              marginBottom: useCompactWallPhotoEmptyState ? 2 : spacing.xs,
            }}
          >
            Wall Photo
          </Text>
          <Text
            style={{
              ...(useCompactWallPhotoEmptyState ? typography.small : typography.body),
              color: colors.textSecondary,
              textAlign: "center",
              maxWidth: useCompactWallPhotoEmptyState ? 260 : 320,
            }}
            numberOfLines={useCompactWallPhotoEmptyState ? 2 : undefined}
          >
            Add a photo of the wall where you want to preview your framed artwork.
          </Text>
          {!isTabletLandscape ? (
            <>
              <AppButton
                label="Add Photo"
                onPress={openWallPhotoSourceChooser}
                style={{
                  width: useCompactWallPhotoEmptyState ? "70%" : "64%",
                  maxWidth: useCompactWallPhotoEmptyState ? 190 : 220,
                  marginTop: useCompactWallPhotoEmptyState ? spacing.md : spacing.lg,
                }}
              />
              {showWallPhotoEmptyHelper ? (
                <Text
                  style={{
                    ...typography.small,
                    color: colors.textSecondary,
                    textAlign: "center",
                    maxWidth: useCompactWallPhotoEmptyState ? 280 : 360,
                    marginTop: useCompactWallPhotoEmptyState ? spacing.sm : spacing.md,
                  }}
                  numberOfLines={useCompactWallPhotoEmptyState ? 2 : undefined}
                >
                  {paperPhotoHelperText}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      )}
    </View>
  );

  const wallPhotoPreviewTitle =
    isTabletLandscape
      ? undefined
      : roomView.sourceMode === "presetRoom"
        ? activePresetScene.title
        : wallPhoto
          ? "Wall photo"
          : undefined;
  const wallPhotoPreviewSubtitle =
    isTabletLandscape
      ? undefined
      : roomView.sourceMode === "presetRoom"
        ? activePresetScene.description
        : wallPhoto
          ? paperPhotoHelperText
          : undefined;
  const wallPhotoCardSection = (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: colors.backgroundCard,
        borderWidth: 2,
        borderColor: colors.borderStrong,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      {wallPhotoPreviewTitle ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
          }}
        >
          <Text style={{ ...typography.sectionTitle, color: colors.textPrimary, flex: 1 }}>
            {wallPhotoPreviewTitle}
          </Text>
        </View>
      ) : null}
      {wallPhotoPreviewSubtitle ? (
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          {wallPhotoPreviewSubtitle}
        </Text>
      ) : null}
      <View
        onLayout={handlePreviewAreaLayout}
        style={{
          flex: 1,
          minHeight: 0,
          justifyContent: "center",
        }}
      >
        {wallPhotoStageSection}
      </View>
      {!isTabletLandscape ? wallGeometryWarningSection : null}
    </View>
  );

  const sourceControlsSection = (
    <AppCard title="Scene source">
      <AppSegmentedControl<RoomViewSourceMode>
        options={ROOM_SOURCE_OPTIONS}
        value={roomView.sourceMode}
        onChange={handleSourceModeChange}
      />
    </AppCard>
  );

  const wallPhotoControlsSection = (
    <AppCard
      title="Wall photo"
      subtitle="Add a photo of the wall where you want to preview your framed artwork."
    >
      <AppButton
        label={wallPhoto ? "Change Photo" : "Add Photo"}
        onPress={openWallPhotoSourceChooser}
        style={{ width: "64%", alignSelf: "center" }}
      />
      <Text style={{ ...typography.small, color: colors.textSecondary }}>
        {paperPhotoHelperText}
      </Text>
    </AppCard>
  );

  const presetRoomControlsSection = (
    <AppCard
      title="Preset Rooms"
      subtitle="Choose a built-in mockup scene for saved framed artworks."
    >
      <ScrollView
        style={{ maxHeight: isTabletLandscape ? 280 : 360 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xs }}
        showsVerticalScrollIndicator={PRESET_ROOM_SCENES.length > 3}
      >
        {(["landscape", "portrait"] as const).map((orientation) => {
          const scenes = getPresetRoomScenesByOrientation(orientation);

          if (scenes.length === 0) {
            return null;
          }

          return (
            <View key={orientation} style={{ gap: spacing.sm }}>
              <Text
                style={{
                  ...typography.small,
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                  fontWeight: "700",
                }}
              >
                {ROOM_SCENE_ORIENTATION_LABELS[orientation]}
              </Text>
              {scenes.map((scene) => (
                <PresetRoomSceneOption
                  key={scene.id}
                  scene={scene}
                  selected={scene.id === activePresetScene.id}
                  onPress={() => handleSelectPresetScene(scene.id)}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </AppCard>
  );

  const calibrationCardSection = (
    <AppCard title="Scale calibration">
      <AppSegmentedControl<RoomKnownMeasurementMode>
        label="Known measurement"
        options={knownMeasurementOptions}
        value={calibration.measurementMode}
        onChange={(measurementMode) => {
          setRoomView({
            calibration: {
              measurementMode,
            },
          });
        }}
      />

      {calibration.measurementMode === "custom" ? (
        <AppTextField
          label={`Custom measurement (${customMeasurementUnitLabel})`}
          helperText={`Enter the known length in ${customMeasurementUnitName}.`}
          placeholder={unit === "cm" ? "29.7" : "11"}
          keyboardType="decimal-pad"
          value={calibration.customMeasurement}
          onChangeText={(customMeasurement) => {
            setRoomView({
              calibration: {
                customMeasurement,
                customMeasurementUnit: unit,
              },
            });
          }}
        />
      ) : null}

      <Text style={{ ...typography.small, color: colors.textSecondary }}>
        {calibrationHelperText}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          alignSelf: "flex-start",
        }}
      >
        <Ionicons
          name={calibration.pixelsPerInch === null ? "ellipse-outline" : "checkmark-circle"}
          size={16}
          color={calibration.pixelsPerInch === null ? colors.textSecondary : colors.success}
        />
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          {calibration.pixelsPerInch === null
            ? "Calibrate the wall to view artwork at accurate scale."
            : "Viewing at accurate scale"}
        </Text>
      </View>
    </AppCard>
  );

  const framedArtworkControlsSection = (
    <AppCard
      title="Framed artworks"
      subtitle={
        roomView.sourceMode === "presetRoom"
          ? "Add saved framed artworks into the selected preset room."
          : "Add saved framed artworks after the wall photo is added and the scale is calibrated."
      }
    >
      {placedArtworkCount > 0 ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            borderRadius: radii.md,
            backgroundColor: colors.backgroundInput,
            padding: spacing.md,
            gap: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
                {placedArtworkCount === 1
                  ? "1 artwork placed"
                  : `${placedArtworkCount} artworks placed`}
              </Text>
              <Text style={{ ...typography.small, color: colors.textSecondary }}>
                {selectedFramedArtwork
                  ? `${selectedFramedArtwork.name} · ${selectedSizeLabel}`
                  : "Tap an artwork on the wall to select it."}
              </Text>
            </View>

            {activePlacement ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove selected framed artwork"
                onPress={handleRemoveSelectedPlacement}
                hitSlop={8}
                style={{
                  minWidth: 120,
                  height: 38,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.backgroundCard,
                  flexDirection: "row",
                  gap: spacing.xs,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.warning} />
                <Text
                  style={{ ...typography.small, color: colors.warning, fontWeight: "700" }}
                  numberOfLines={1}
                >
                  Delete Selected
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {framedArtworks.length === 0 ? (
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          No artwork saved yet. Use Save Artwork from Final Specs first, then return here to place it on the wall.
        </Text>
      ) : roomView.sourceMode === "myWall" && !wallPhoto ? (
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          Add a wall photo before placing framed artwork.
        </Text>
      ) : roomView.sourceMode === "myWall" && !calibration.pixelsPerInch ? (
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          Calibrate the wall scale before placing framed artwork.
        </Text>
      ) : null}

      <AppButton
        label="Add Framed Artwork"
        onPress={openFramedArtworkChooser}
        disabled={!canPlaceFramedArtwork}
        style={{ width: "72%", alignSelf: "center" }}
      />
    </AppCard>
  );

  const layoutControlsSection = (
    <AppCard title="Layouts" subtitle="Use alignment tools while arranging artwork on the wall.">
      {roomView.sourceMode === "myWall" ? (
        <>
          <RoomSwitchRow
            label="Calibration Ruler"
            accessibilityLabel="Show calibration ruler"
            value={roomView.isCalibrationRulerVisible}
            disabled={!wallPhoto}
            onValueChange={(isCalibrationRulerVisible) => {
              setRoomView({
                isCalibrationRulerVisible,
              });
            }}
          />

          <Text style={{ ...typography.small, color: colors.textSecondary }}>
            Hide the ruler after calibration to keep the wall preview clear.
          </Text>

          <View
            style={{
              height: 1,
              backgroundColor: colors.borderSubtle,
            }}
          />
        </>
      ) : null}

      <RoomSwitchRow
        label="Snap to Grid"
        value={roomView.snapToGridEnabled}
        onValueChange={(snapToGridEnabled) => {
          setRoomView({
            snapToGridEnabled,
          });
        }}
      />

      {roomView.snapToGridEnabled ? (
        <AppTextField
          label={`Grid size (${customMeasurementUnitLabel})`}
          helperText={gridSizeHelperText}
          placeholder={unit === "cm" ? "2.5" : "1"}
          keyboardType="decimal-pad"
          value={roomView.gridSize}
          onChangeText={(gridSize) => {
            setRoomView({
              gridSize,
              gridSizeUnit: unit,
            });
          }}
        />
      ) : null}
    </AppCard>
  );

  const exportCardSection = (
    <AppCard title="Export">
      <Text style={{ ...typography.small, color: colors.textSecondary }}>
        {roomView.sourceMode === "presetRoom"
          ? "The exported mockup uses the preset scene scale and the final outer frame dimensions."
          : "The exported mockup uses the wall photo source pixels, the stored pixels-per-inch calibration, and the final outer frame dimensions."}
      </Text>
      <AppButton
        label={isExporting ? "Exporting..." : "Export Mockup"}
        onPress={handleExportMockup}
        disabled={!exportGeometry || isExporting}
        style={{ width: "60%", alignSelf: "center" }}
      />
    </AppCard>
  );

  const roomScaleSettingsSection =
    roomView.sourceMode === "myWall" ? (
      calibrationCardSection
    ) : (
      <AppCard title="Settings">
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          Preset rooms use their saved room scale. Switch to My Wall to calibrate a wall photo.
        </Text>
      </AppCard>
    );

  const roomViewDockSection = (
    <RoomViewBottomDock
      activeSheet={activeSheet}
      onOpenSheet={(sheet) => setActiveSheet(sheet)}
    />
  );

  const activeSheetTitle =
    activeSheet === "artwork"
      ? "Artwork"
      : activeSheet === "interiors"
        ? "Interiors"
        : activeSheet === "layouts"
          ? "Layouts"
          : activeSheet === "settings"
            ? "Settings"
            : activeSheet === "export"
              ? "Export"
              : "";

  const activeSheetContent =
    activeSheet === "artwork" ? (
      framedArtworkControlsSection
    ) : activeSheet === "interiors" ? (
      <>
        {sourceControlsSection}
        {roomView.sourceMode === "presetRoom"
          ? presetRoomControlsSection
          : wallPhotoControlsSection}
      </>
    ) : activeSheet === "layouts" ? (
      layoutControlsSection
    ) : activeSheet === "settings" ? (
      roomScaleSettingsSection
    ) : activeSheet === "export" ? (
      exportCardSection
    ) : null;

  const closeFramedArtworkSheet = () => {
    setArtworkSortMenuVisible(false);
    setFramedArtworkSheetVisible(false);
  };

  const isShadowSheetOpen = activeSheet === "settings";
  const roomShadowPanelBottomSafePadding = Math.max(insets.bottom, spacing.md);
  const roomShadowPanelMaxWidth = isTabletLandscape ? 560 : 720;

  const framedArtworkSheetHeaderActions = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        position: "relative",
      }}
    >
      <Pressable
        onPress={() => setArtworkSortMenuVisible((visible) => !visible)}
        accessibilityRole="button"
        accessibilityLabel="Sort framed artworks"
        hitSlop={8}
        style={{
          width: 34,
          height: 34,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="swap-vertical-outline" size={21} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        onPress={closeFramedArtworkSheet}
        accessibilityRole="button"
        accessibilityLabel="Close add framed artwork"
        hitSlop={8}
        style={{
          width: 34,
          height: 34,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="close" size={24} color={colors.textPrimary} />
      </Pressable>

      {artworkSortMenuVisible ? (
        <View
          style={{
            position: "absolute",
            top: 40,
            right: 38,
            width: 174,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.backgroundCard,
            overflow: "hidden",
            zIndex: 30,
            shadowColor: "#000000",
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },
            elevation: 6,
          }}
        >
          {ARTWORK_SORT_OPTIONS.map((option, index) => {
            const active = option.value === artworkSortMode;

            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setArtworkSortMode(option.value);
                  setArtworkSortMenuVisible(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${option.label}`}
                style={{
                  minHeight: 40,
                  paddingHorizontal: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                  backgroundColor: active ? colors.accentSoft : colors.backgroundCard,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: "700",
                    color: active ? colors.accent : colors.textPrimary,
                  }}
                >
                  {option.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={16} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
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
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
        }}
      >
        <View
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            maxWidth: isTabletLandscape ? LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH : undefined,
            alignSelf: "center",
          }}
        >
          <View style={{ flex: 1, minHeight: 0, gap: spacing.md }}>
            {wallPhotoCardSection}
            {isTabletLandscape ? wallGeometryWarningSection : null}
            {isShadowSheetOpen ? null : roomViewDockSection}
          </View>
        </View>
      </View>

      {isShadowSheetOpen ? (
        <RoomShadowAdjustmentPanel
          shadow={activeSourceWallShadow}
          baseShadow={activeSourceBaseWallShadow}
          materialRealism={activeSourceMaterialRealism}
          activeRealismTab={activeRealismTab}
          artworkBrightness={activeSourceArtworkBrightness}
          enabled={activeSourceShadowEnabled}
          artworkCount={activeSourcePlacements.length}
          bottomSafePadding={roomShadowPanelBottomSafePadding}
          maxWidth={roomShadowPanelMaxWidth}
          onClose={() => setActiveSheet(null)}
          onToggle={handleSourceWallShadowToggle}
          onOpacityChange={(opacity) => updateActiveSourceWallShadow({ opacity })}
          onBlurRadiusChange={(blurRadius) => updateActiveSourceWallShadow({ blurRadius })}
          onDistanceChange={handleSourceWallShadowDistanceChange}
          onDirectionChange={handleSourceWallShadowDirectionChange}
          onMaterialRealismChange={updateActiveSourceMaterialRealism}
          onActiveRealismTabChange={setActiveRealismTab}
          onArtworkBrightnessChange={handleSourceArtworkBrightnessChange}
        />
      ) : (
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
              maxWidth: isTabletLandscape ? LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH : undefined,
              alignSelf: "center",
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: isTabletLandscape ? LANDSCAPE_CONTROLS_COLUMN_WIDTH : undefined,
                alignSelf: "center",
                minHeight: 44,
                justifyContent: "center",
                position: "relative",
              }}
            >
              {canGoBack ? (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.goBack();
                  }}
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

              <AppButton
                label="Start New Draft"
                onPress={() => {
                  resetDraft();
                  navigation.navigate("Setup");
                }}
                style={{ width: "52%", maxWidth: 360, alignSelf: "center" }}
              />
            </View>
          </View>
        </View>
      )}

      {activePlacement && isTabletWorkspace ? (
        <TextInput
          ref={shortcutInputRef}
          value=""
          onChangeText={() => {}}
          onKeyPress={(event) => {
            if (event.nativeEvent.key === "Backspace" || event.nativeEvent.key === "Delete") {
              deleteSelectedPlacement();
            }
          }}
          showSoftInputOnFocus={false}
          caretHidden
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel="Room View keyboard shortcuts"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            opacity: 0,
            left: -10,
            top: -10,
          }}
        />
      ) : null}

      <RoomViewBottomSheet
        visible={activeSheet !== null && activeSheet !== "settings"}
        title={activeSheetTitle}
        maxHeight={Math.min(windowHeight * 0.78, isTabletLandscape ? 720 : 620)}
        onClose={() => setActiveSheet(null)}
      >
        {activeSheetContent}
      </RoomViewBottomSheet>

      <AppSheetModal
        visible={wallPhotoSourceSheetVisible}
        title="Add Photo"
        onClose={() => setWallPhotoSourceSheetVisible(false)}
      >
        <WallPhotoSourceOption
          icon="camera-outline"
          label="Take Photo"
          onPress={() => {
            setWallPhotoSourceSheetVisible(false);
            setTimeout(() => {
              void handleTakeWallPhoto();
            }, 220);
          }}
        />
        <WallPhotoSourceOption
          icon="images-outline"
          label="Choose from Photo Library"
          onPress={() => {
            setWallPhotoSourceSheetVisible(false);
            setTimeout(() => {
              void handlePickWallPhotoFromLibrary();
            }, 220);
          }}
        />
      </AppSheetModal>

      <AppSheetModal
        visible={framedArtworkSheetVisible}
        title="Add Framed Artwork"
        onClose={closeFramedArtworkSheet}
        headerActions={framedArtworkSheetHeaderActions}
      >
        {framedArtworks.length === 0 ? (
          <Text style={{ ...typography.small, color: colors.textSecondary }}>
            No artwork saved yet. Use Save Artwork from Final Specs first.
          </Text>
        ) : (
          <>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.eyebrow, color: colors.textPrimary }}>
                Project folder
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.xs }}
              >
                {sortedProjectFolders.map((folder) => {
                  const selected = folder.id === selectedArtworkProjectFolder?.id;
                  const artworkCount = framedArtworks.filter(
                    (artwork) => artwork.projectFolderId === folder.id
                  ).length;

                  return (
                    <Pressable
                      key={folder.id}
                      onPress={() => setSelectedArtworkProjectFolderId(folder.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${folder.name}`}
                      style={{
                        minHeight: 36,
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        borderColor: selected ? colors.accent : colors.borderStrong,
                        backgroundColor: selected ? colors.accentSoft : colors.backgroundCard,
                        paddingHorizontal: spacing.sm,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          ...typography.small,
                          color: selected ? colors.accent : colors.textPrimary,
                          fontWeight: "700",
                        }}
                        numberOfLines={1}
                      >
                        {folder.name} ({artworkCount})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView
              style={{ maxHeight: Math.min(windowHeight * 0.55, 520) }}
              contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xs }}
              showsVerticalScrollIndicator
            >
              {sortedFramedArtworks.length === 0 ? (
                <Text style={{ ...typography.small, color: colors.textSecondary }}>
                  No artwork saved in this project folder yet.
                </Text>
              ) : (
                sortedFramedArtworks.map((artwork) => (
                  <SavedFramedArtworkPickerRow
                    key={artwork.id}
                    artwork={artwork}
                    selected={artwork.id === selectedFramedArtwork?.id}
                    unit={unit}
                    imperialPrecision={imperialPrecision}
                    onPress={() => handleSelectFramedArtwork(artwork)}
                  />
                ))
              )}
            </ScrollView>
          </>
        )}
      </AppSheetModal>

      {hiddenExportSvg}
    </ScreenContainer>
  );
}
