import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FinishedFramedArtwork } from "../components/preview/MatPreviewCanvas";
import PresetRoomSceneImage from "../components/room/PresetRoomSceneImage";
import AppButton from "../components/ui/AppButton";
import AppCard from "../components/ui/AppCard";
import AppSegmentedControl from "../components/ui/AppSegmentedControl";
import AppSheetModal from "../components/ui/AppSheetModal";
import AppTextField from "../components/ui/AppTextField";
import {
  DEFAULT_PRESET_ROOM_SCENE_ID,
  getPresetRoomSceneById,
} from "../data/presetRoomScenes";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { useFramingFlowStore } from "../state/framingFlowStore";
import {
  useSavedProjectsStore,
  type SavedFramedArtwork,
  type SavedRoomLayout,
} from "../state/savedProjectsStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type {
  FramingProjectDraft,
  RoomViewDraft,
} from "../types/framing";
import type { FramingRootStackParamList } from "../types/navigation";
import {
  buildDerivedGeometry,
  inchesToMeasurementUnit,
} from "../utils/framingGeometry";
import { resolveFrameColorHex } from "../utils/frameProfiles";

function formatArtworkSize(width: number, height: number) {
  return `${width.toFixed(1).replace(/\.0$/, "")} in x ${height.toFixed(1).replace(/\.0$/, "")} in`;
}

type LibraryContentTab = "artwork" | "layouts";
type LibrarySortMode = "manual" | "updatedDesc" | "nameAsc" | "nameDesc";
type FullscreenPreviewTarget =
  | { type: "artwork"; artwork: SavedFramedArtwork }
  | { type: "layout"; layout: SavedRoomLayout };

const LIBRARY_SORT_LABELS: Record<LibrarySortMode, string> = {
  manual: "Manual",
  updatedDesc: "Newest",
  nameAsc: "Name A-Z",
  nameDesc: "Name Z-A",
};

const LIBRARY_SORT_SEQUENCE: LibrarySortMode[] = ["manual", "updatedDesc", "nameAsc", "nameDesc"];

function getNextLibrarySortMode(sortMode: LibrarySortMode) {
  const currentIndex = LIBRARY_SORT_SEQUENCE.indexOf(sortMode);
  return LIBRARY_SORT_SEQUENCE[(currentIndex + 1) % LIBRARY_SORT_SEQUENCE.length] ?? "updatedDesc";
}

function sortByLibraryMode<T extends { name: string; updatedAt: string }>(
  items: T[],
  sortMode: LibrarySortMode
) {
  const sorted = [...items];

  switch (sortMode) {
    case "nameAsc":
      return sorted.sort((first, second) => first.name.localeCompare(second.name));
    case "nameDesc":
      return sorted.sort((first, second) => second.name.localeCompare(first.name));
    case "manual":
      return sorted;
    case "updatedDesc":
    default:
      return sorted.sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
      );
  }
}

function getCopyName(name: string) {
  const trimmedName = name.trim() || "Untitled";
  return /\bcopy\b/i.test(trimmedName) ? `${trimmedName} 2` : `${trimmedName} Copy`;
}

function createRoomViewLaunchId() {
  return `room-view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function cloneFramingProjectDraft(draft: FramingProjectDraft): FramingProjectDraft {
  return JSON.parse(JSON.stringify(draft)) as FramingProjectDraft;
}

function cloneRoomViewDraft(roomView: RoomViewDraft): RoomViewDraft {
  return JSON.parse(JSON.stringify(roomView)) as RoomViewDraft;
}

function getArtworkThumbnailGeometry(
  artwork: SavedFramedArtwork,
  maxWidth: number,
  maxHeight: number
) {
  const preview = artwork.draft.preview;
  const derived = buildDerivedGeometry(artwork.draft);

  if (!derived.isValidGeometry || !derived.artworkSize || !derived.openingSize || !derived.outerMatSize) {
    return null;
  }

  const finalWidth = inchesToMeasurementUnit(artwork.finalOuterSizeInches.width, artwork.unit);
  const finalHeight = inchesToMeasurementUnit(artwork.finalOuterSizeInches.height, artwork.unit);
  const physicalScale = Math.min(
    maxWidth / Math.max(finalWidth, 1),
    maxHeight / Math.max(finalHeight, 1)
  );

  return {
    artworkSize: derived.artworkSize,
    openingSize: derived.openingSize,
    outerMatSize: derived.outerMatSize,
    offsetX: preview.offsetX,
    offsetY: preview.offsetY,
    physicalScale,
    frameColorHex: resolveFrameColorHex(
      preview.frameProfileId,
      preview.frameFinishId,
      preview.frameColorHex
    ),
  };
}

type LibraryAction = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  accessibilityLabel?: string;
  destructive?: boolean;
};

function LibraryCardActionButton({
  action,
  showLabel,
}: {
  action: LibraryAction;
  showLabel: boolean;
}) {
  const { colors } = useAppTheme();
  const tintColor = action.destructive ? colors.warning : colors.textSecondary;

  return (
    <Pressable
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      hitSlop={6}
      style={({ pressed }) => ({
        minWidth: showLabel ? 58 : 42,
        minHeight: 42,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: showLabel ? 6 : 0,
        paddingHorizontal: showLabel ? 7 : 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={action.icon} size={showLabel ? 17 : 20} color={tintColor} />
      {showLabel ? (
        <Text
          style={{
            fontSize: 11,
            lineHeight: 15,
            fontWeight: "600",
            color: tintColor,
          }}
          numberOfLines={1}
        >
          {action.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function LibraryCardActionRow({
  actions,
  showLabels,
}: {
  actions: LibraryAction[];
  showLabels: boolean;
}) {
  const { colors, spacing } = useAppTheme();

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        flexDirection: "row",
        flexWrap: showLabels ? "wrap" : "nowrap",
        alignItems: "center",
        justifyContent: showLabels ? "space-between" : "space-around",
        gap: showLabels ? 4 : 0,
      }}
    >
      {actions.map((action) => (
        <LibraryCardActionButton key={action.label} action={action} showLabel={showLabels} />
      ))}
    </View>
  );
}

function ReorderControls({
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 3,
        flexDirection: "row",
        gap: 6,
      }}
    >
      {[
        { icon: "chevron-up" as const, onPress: onMoveUp, disabled: index <= 0, label: "Move up" },
        {
          icon: "chevron-down" as const,
          onPress: onMoveDown,
          disabled: index >= total - 1,
          label: "Move down",
        },
      ].map((control) => (
        <Pressable
          key={control.label}
          onPress={control.onPress}
          disabled={control.disabled}
          accessibilityRole="button"
          accessibilityLabel={control.label}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.backgroundModal,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            opacity: control.disabled ? 0.38 : 0.95,
          }}
        >
          <Ionicons name={control.icon} size={18} color={colors.textPrimary} />
        </Pressable>
      ))}
    </View>
  );
}

function SavedArtworkThumbnail({
  artwork,
  thumbnailWidth,
  thumbnailHeight,
}: {
  artwork: SavedFramedArtwork;
  thumbnailWidth: number;
  thumbnailHeight: number;
}) {
  const { colors } = useAppTheme();
  const preview = artwork.draft.preview;
  const thumbnailGeometry = useMemo(
    () => getArtworkThumbnailGeometry(artwork, thumbnailWidth - 42, thumbnailHeight - 34),
    [artwork, thumbnailHeight, thumbnailWidth]
  );

  return (
    <View
      style={{
        height: thumbnailHeight,
        width: "100%",
        backgroundColor: colors.backgroundInput,
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
          frameColorHex={thumbnailGeometry.frameColorHex}
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
        <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
      )}
    </View>
  );
}

function SavedArtworkLibraryCard({
  artwork,
  width,
  thumbnailWidth,
  thumbnailHeight,
  actions,
  showActionLabels,
  reorderIndex,
  reorderTotal,
  onMoveUp,
  onMoveDown,
}: {
  artwork: SavedFramedArtwork;
  width: ViewStyle["width"];
  thumbnailWidth: number;
  thumbnailHeight: number;
  actions: LibraryAction[];
  showActionLabels: boolean;
  reorderIndex?: number;
  reorderTotal?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        width,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        backgroundColor: colors.backgroundCard,
        overflow: "hidden",
      }}
    >
      <View style={{ position: "relative" }}>
        {typeof reorderIndex === "number" &&
        typeof reorderTotal === "number" &&
        onMoveUp &&
        onMoveDown ? (
          <ReorderControls
            index={reorderIndex}
            total={reorderTotal}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        ) : null}
        <SavedArtworkThumbnail
          artwork={artwork}
          thumbnailWidth={thumbnailWidth}
          thumbnailHeight={thumbnailHeight}
        />
      </View>
      <View
        style={{
          minHeight: 68,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          justifyContent: "center",
          backgroundColor: colors.backgroundCard,
        }}
      >
        <Text
          style={{ ...typography.sectionTitle, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {artwork.name || "Untitled framed artwork"}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 3 }} numberOfLines={1}>
          {formatArtworkSize(artwork.finalOuterSizeInches.width, artwork.finalOuterSizeInches.height)}
        </Text>
      </View>
      <LibraryCardActionRow actions={actions} showLabels={showActionLabels} />
    </View>
  );
}

function RoomLayoutThumbnailArtwork({
  artwork,
  center,
  scale,
  thumbnailWidth,
  thumbnailHeight,
}: {
  artwork: SavedFramedArtwork | null;
  center: { x: number; y: number };
  scale: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
}) {
  const { colors } = useAppTheme();
  const aspectRatio = artwork
    ? artwork.finalOuterSizeInches.width / Math.max(artwork.finalOuterSizeInches.height, 1)
    : 0.78;
  const overlayWidth = Math.max(34, Math.min(92, thumbnailWidth * 0.17 * scale));
  const overlayHeight = Math.max(42, Math.min(thumbnailHeight * 0.48, overlayWidth / Math.max(aspectRatio, 0.4)));
  const preview = artwork?.draft.preview;
  const thumbnailGeometry = artwork
    ? getArtworkThumbnailGeometry(artwork, overlayWidth - 8, overlayHeight - 8)
    : null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: `${center.x * 100}%`,
        top: `${center.y * 100}%`,
        width: overlayWidth,
        height: overlayHeight,
        marginLeft: -overlayWidth / 2,
        marginTop: -overlayHeight / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {artwork && thumbnailGeometry && preview ? (
        <FinishedFramedArtwork
          artworkSize={thumbnailGeometry.artworkSize}
          openingSize={thumbnailGeometry.openingSize}
          outerMatSize={thumbnailGeometry.outerMatSize}
          frameProfileId={preview.frameProfileId}
          frameColorHex={thumbnailGeometry.frameColorHex}
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
          showShadow
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#F8F7F2",
            borderWidth: 2,
            borderColor: colors.borderStrong,
          }}
        />
      )}
    </View>
  );
}

function RoomLayoutThumbnail({
  layout,
  artworksById,
  thumbnailWidth,
  thumbnailHeight,
}: {
  layout: SavedRoomLayout;
  artworksById: Map<string, SavedFramedArtwork>;
  thumbnailWidth: number;
  thumbnailHeight: number;
}) {
  const { colors } = useAppTheme();
  const scene = layout.sourceMode === "presetRoom" ? getPresetRoomSceneById(layout.presetSceneId) : null;
  const placements = [...layout.roomView.placements]
    .filter((placement) => Boolean(placement.framedArtworkId))
    .sort((first, second) => (first.zIndex ?? 0) - (second.zIndex ?? 0));

  return (
    <View
      style={{
        height: thumbnailHeight,
        width: "100%",
        backgroundColor: colors.backgroundInput,
        overflow: "hidden",
      }}
    >
      {scene ? (
        <PresetRoomSceneImage
          scene={scene}
          resizeMode="cover"
          style={{ width: "100%", height: "100%" }}
        />
      ) : layout.wallPhoto?.imageUri ? (
        <Image
          source={{ uri: layout.wallPhoto.imageUri }}
          resizeMode="cover"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.backgroundMuted,
          }}
        >
          <Ionicons name="home-outline" size={30} color={colors.textSecondary} />
        </View>
      )}

      {placements.map((placement) => (
        <RoomLayoutThumbnailArtwork
          key={placement.id}
          artwork={placement.framedArtworkId ? artworksById.get(placement.framedArtworkId) ?? null : null}
          center={placement.center}
          scale={placement.scale ?? 1}
          thumbnailWidth={thumbnailWidth}
          thumbnailHeight={thumbnailHeight}
        />
      ))}
    </View>
  );
}

function RoomLayoutLibraryCard({
  layout,
  artworksById,
  width,
  thumbnailWidth,
  thumbnailHeight,
  actions,
  showActionLabels,
  reorderIndex,
  reorderTotal,
  onMoveUp,
  onMoveDown,
}: {
  layout: SavedRoomLayout;
  artworksById: Map<string, SavedFramedArtwork>;
  width: ViewStyle["width"];
  thumbnailWidth: number;
  thumbnailHeight: number;
  actions: LibraryAction[];
  showActionLabels: boolean;
  reorderIndex?: number;
  reorderTotal?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const pieceLabel = `${layout.placementCount} artwork ${layout.placementCount === 1 ? "piece" : "pieces"}`;

  return (
    <View
      style={{
        width,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        backgroundColor: colors.backgroundCard,
        overflow: "hidden",
      }}
    >
      <View style={{ position: "relative" }}>
        {typeof reorderIndex === "number" &&
        typeof reorderTotal === "number" &&
        onMoveUp &&
        onMoveDown ? (
          <ReorderControls
            index={reorderIndex}
            total={reorderTotal}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        ) : null}
        <RoomLayoutThumbnail
          layout={layout}
          artworksById={artworksById}
          thumbnailWidth={thumbnailWidth}
          thumbnailHeight={thumbnailHeight}
        />
      </View>

      <View
        style={{
          minHeight: 64,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          justifyContent: "center",
          backgroundColor: colors.backgroundCard,
        }}
      >
        <Text
          style={{ ...typography.sectionTitle, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {layout.name}
        </Text>
        <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 3 }} numberOfLines={1}>
          {pieceLabel}
        </Text>
      </View>
      <LibraryCardActionRow actions={actions} showLabels={showActionLabels} />
    </View>
  );
}

function FullscreenPreviewModal({
  target,
  artworksById,
  windowWidth,
  windowHeight,
  bottomInset,
  onClose,
}: {
  target: FullscreenPreviewTarget | null;
  artworksById: Map<string, SavedFramedArtwork>;
  windowWidth: number;
  windowHeight: number;
  bottomInset: number;
  onClose: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();

  if (!target) {
    return null;
  }

  const previewWidth = Math.min(windowWidth - 48, 820);
  const previewHeight = Math.min(windowHeight * 0.62, 620);
  const title = target.type === "artwork" ? target.artwork.name : target.layout.name;
  const subtitle =
    target.type === "artwork"
      ? formatArtworkSize(
          target.artwork.finalOuterSizeInches.width,
          target.artwork.finalOuterSizeInches.height
        )
      : `${target.layout.placementCount} artwork ${target.layout.placementCount === 1 ? "piece" : "pieces"}`;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingTop: 24,
          paddingBottom: bottomInset + 24,
        }}
      >
        <Pressable
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Close fullscreen preview"
          onPress={onClose}
        />
        <View
          style={{
            width: previewWidth,
            maxWidth: "100%",
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: radii.lg,
            backgroundColor: colors.backgroundCard,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }} numberOfLines={1}>
                {title}
              </Text>
              <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.backgroundInput,
              }}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          {target.type === "artwork" ? (
            <SavedArtworkThumbnail
              artwork={target.artwork}
              thumbnailWidth={previewWidth}
              thumbnailHeight={previewHeight}
            />
          ) : (
            <RoomLayoutThumbnail
              layout={target.layout}
              artworksById={artworksById}
              thumbnailWidth={previewWidth}
              thumbnailHeight={previewHeight}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function SavedProjectsScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const { colors, radii, spacing, typography } = useAppTheme();
  const setAppUnit = useAppSettingsStore((state) => state.setUnit);
  const replaceDraft = useFramingFlowStore((state) => state.replaceDraft);
  const setRoomView = useFramingFlowStore((state) => state.setRoomView);
  const projectFolders = useSavedProjectsStore((state) => state.projectFolders);
  const framedArtworks = useSavedProjectsStore((state) => state.framedArtworks);
  const roomLayouts = useSavedProjectsStore((state) => state.roomLayouts);
  const createProjectFolder = useSavedProjectsStore((state) => state.createProjectFolder);
  const saveFramedArtwork = useSavedProjectsStore((state) => state.saveFramedArtwork);
  const saveRoomLayout = useSavedProjectsStore((state) => state.saveRoomLayout);
  const deleteFramedArtwork = useSavedProjectsStore((state) => state.deleteFramedArtwork);
  const deleteRoomLayout = useSavedProjectsStore((state) => state.deleteRoomLayout);
  const reorderFramedArtworksInFolder = useSavedProjectsStore(
    (state) => state.reorderFramedArtworksInFolder
  );
  const reorderRoomLayoutsInFolder = useSavedProjectsStore(
    (state) => state.reorderRoomLayoutsInFolder
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryContentTab>("artwork");
  const [createFolderSheetVisible, setCreateFolderSheetVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [sortMode, setSortMode] = useState<LibrarySortMode>("updatedDesc");
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState<FullscreenPreviewTarget | null>(null);
  const isTabletLayout = windowWidth >= 768;
  const isLandscapeLayout = windowWidth > windowHeight;
  const artworkColumnCount = isTabletLayout ? (isLandscapeLayout ? 4 : 3) : 1;
  const roomLayoutColumnCount = isTabletLayout ? 2 : 1;
  const gridGap = spacing.md;
  const gridContentWidth = Math.max(0, windowWidth - 32);
  const getGridCardWidth = (columns: number): ViewStyle["width"] =>
    columns <= 1 ? "100%" : (gridContentWidth - gridGap * (columns - 1)) / columns;
  const artworkCardWidth = getGridCardWidth(artworkColumnCount);
  const roomLayoutCardWidth = getGridCardWidth(roomLayoutColumnCount);
  const thumbnailHeight = isTabletLayout ? 230 : 220;
  const artworkThumbnailWidthEstimate =
    typeof artworkCardWidth === "number" ? artworkCardWidth : Math.min(windowWidth - 64, 360);
  const roomLayoutThumbnailWidthEstimate =
    typeof roomLayoutCardWidth === "number" ? roomLayoutCardWidth : Math.min(windowWidth - 64, 360);

  const sortedProjectFolders = useMemo(
    () =>
      [...projectFolders].sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
      ),
    [projectFolders]
  );
  const selectedFolder = sortedProjectFolders.find((folder) => folder.id === selectedFolderId) ?? null;
  const selectedFolderArtworkItems = useMemo(
    () =>
      framedArtworks.filter((artwork) => artwork.projectFolderId === selectedFolderId),
    [framedArtworks, selectedFolderId]
  );
  const selectedFolderRoomLayoutItems = useMemo(
    () =>
      roomLayouts.filter((layout) => layout.projectFolderId === selectedFolderId),
    [roomLayouts, selectedFolderId]
  );
  const sortedFolderArtworks = useMemo(
    () => sortByLibraryMode(selectedFolderArtworkItems, sortMode),
    [selectedFolderArtworkItems, sortMode]
  );
  const sortedFolderRoomLayouts = useMemo(
    () => sortByLibraryMode(selectedFolderRoomLayoutItems, sortMode),
    [selectedFolderRoomLayoutItems, sortMode]
  );
  const selectedFolderArtworks = sortedFolderArtworks;
  const selectedFolderRoomLayouts = sortedFolderRoomLayouts;
  const artworksById = useMemo(
    () => new Map(framedArtworks.map((artwork) => [artwork.id, artwork])),
    [framedArtworks]
  );
  const visibleItemsCount =
    activeTab === "artwork" ? selectedFolderArtworkItems.length : selectedFolderRoomLayoutItems.length;
  const showCardActionLabels =
    isTabletLayout &&
    (activeTab === "artwork"
      ? typeof artworkCardWidth === "number" && artworkCardWidth >= 300
      : typeof roomLayoutCardWidth === "number" && roomLayoutCardWidth >= 340);

  useEffect(() => {
    if (!selectedFolder) {
      return;
    }

    if (activeTab === "artwork" && selectedFolderArtworkItems.length === 0 && selectedFolderRoomLayoutItems.length > 0) {
      setActiveTab("layouts");
    }

    if (activeTab === "layouts" && selectedFolderRoomLayoutItems.length === 0 && selectedFolderArtworkItems.length > 0) {
      setActiveTab("artwork");
    }
  }, [activeTab, selectedFolder, selectedFolderArtworkItems.length, selectedFolderRoomLayoutItems.length]);

  useEffect(() => {
    setIsReorderMode(false);
  }, [activeTab, selectedFolderId]);

  const handleCreateFolder = () => {
    const folderName = newFolderName.trim();

    if (!folderName) {
      return;
    }

    const folder = createProjectFolder(folderName);
    setSelectedFolderId(folder.id);
    setNewFolderName("");
    setCreateFolderSheetVisible(false);
  };

  const handleOpenArtwork = (artwork: SavedFramedArtwork) => {
    const draftForEdit = cloneFramingProjectDraft(artwork.draft);

    draftForEdit.meta = {
      ...draftForEdit.meta,
      projectName: artwork.name,
      savedFramedArtworkId: artwork.id,
      sourceFramedArtworkId: artwork.id,
    };

    setAppUnit(artwork.unit);
    replaceDraft(draftForEdit);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "PreviewAdjust" }],
      })
    );
  };

  const handleOpenRoomLayout = (layout: SavedRoomLayout) => {
    setAppUnit(layout.unit);
    setRoomView(cloneRoomViewDraft(layout.roomView));
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "RoomView" }],
      })
    );
  };

  const handlePlaceArtworkOnWall = (artwork: SavedFramedArtwork) => {
    setAppUnit(artwork.unit);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "RoomView",
            params: {
              autoPlaceArtworkId: artwork.id,
              sourceMode: "presetRoom",
              presetSceneId: DEFAULT_PRESET_ROOM_SCENE_ID,
              launchId: createRoomViewLaunchId(),
            },
          },
        ],
      })
    );
  };

  const handleDuplicateArtwork = (artwork: SavedFramedArtwork) => {
    const name = getCopyName(artwork.name);
    const draft = cloneFramingProjectDraft(artwork.draft);

    draft.meta = {
      ...draft.meta,
      projectName: name,
      savedFramedArtworkId: null,
      sourceFramedArtworkId: artwork.id,
    };

    saveFramedArtwork({
      projectFolderId: artwork.projectFolderId,
      name,
      notes: artwork.notes ?? "",
      draft,
      unit: artwork.unit,
      finalOuterSizeInches: artwork.finalOuterSizeInches,
    });
  };

  const handleDeleteArtwork = (artwork: SavedFramedArtwork) => {
    Alert.alert(
      "Delete Artwork",
      `Delete "${artwork.name || "Untitled framed artwork"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteFramedArtwork(artwork.id);
            setFullscreenPreview((current) =>
              current?.type === "artwork" && current.artwork.id === artwork.id ? null : current
            );
          },
        },
      ]
    );
  };

  const handleDuplicateRoomLayout = (layout: SavedRoomLayout) => {
    const name = getCopyName(layout.name);
    const roomView = cloneRoomViewDraft(layout.roomView);

    roomView.savedRoomLayoutId = null;

    saveRoomLayout({
      projectFolderId: layout.projectFolderId,
      name,
      notes: layout.notes ?? "",
      unit: layout.unit,
      roomView,
      sourceMode: layout.sourceMode,
      sourceId: layout.sourceId,
      presetSceneId: layout.presetSceneId,
      wallPhoto: layout.wallPhoto,
    });
  };

  const handleDeleteRoomLayout = (layout: SavedRoomLayout) => {
    Alert.alert(
      "Delete Wall Layout",
      `Delete "${layout.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteRoomLayout(layout.id);
            setFullscreenPreview((current) =>
              current?.type === "layout" && current.layout.id === layout.id ? null : current
            );
          },
        },
      ]
    );
  };

  const handleToggleReorderMode = () => {
    if (!selectedFolderId) {
      return;
    }

    if (isReorderMode) {
      setIsReorderMode(false);
      return;
    }

    setSortMode("manual");
    setIsReorderMode(true);
  };

  const moveDisplayItem = (itemId: string, direction: -1 | 1) => {
    if (!selectedFolderId) {
      return;
    }

    const currentItems = activeTab === "artwork" ? selectedFolderArtworks : selectedFolderRoomLayouts;
    const currentOrder = currentItems.map((item) => item.id);
    const currentIndex = currentOrder.indexOf(itemId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentOrder.length) {
      return;
    }

    const nextOrder = [...currentOrder];
    const [movedId] = nextOrder.splice(currentIndex, 1);
    if (!movedId) {
      return;
    }
    nextOrder.splice(targetIndex, 0, movedId);

    if (activeTab === "artwork") {
      reorderFramedArtworksInFolder(selectedFolderId, nextOrder);
    } else {
      reorderRoomLayoutsInFolder(selectedFolderId, nextOrder);
    }
  };

  const getArtworkActions = (artwork: SavedFramedArtwork): LibraryAction[] => [
    {
      label: "View",
      accessibilityLabel: "View fullscreen",
      icon: "expand-outline",
      onPress: () => setFullscreenPreview({ type: "artwork", artwork }),
    },
    {
      label: "Wall",
      icon: "home-outline",
      onPress: () => handlePlaceArtworkOnWall(artwork),
    },
    {
      label: "Copy",
      icon: "copy-outline",
      onPress: () => handleDuplicateArtwork(artwork),
    },
    {
      label: "Edit",
      icon: "create-outline",
      onPress: () => handleOpenArtwork(artwork),
    },
    {
      label: "Delete",
      icon: "trash-outline",
      destructive: true,
      onPress: () => handleDeleteArtwork(artwork),
    },
  ];

  const getRoomLayoutActions = (layout: SavedRoomLayout): LibraryAction[] => [
    {
      label: "View",
      accessibilityLabel: "View fullscreen",
      icon: "expand-outline",
      onPress: () => setFullscreenPreview({ type: "layout", layout }),
    },
    {
      label: "Wall",
      icon: "home-outline",
      onPress: () => handleOpenRoomLayout(layout),
    },
    {
      label: "Copy",
      icon: "copy-outline",
      onPress: () => handleDuplicateRoomLayout(layout),
    },
    {
      label: "Edit",
      icon: "create-outline",
      onPress: () => handleOpenRoomLayout(layout),
    },
    {
      label: "Delete",
      icon: "trash-outline",
      destructive: true,
      onPress: () => handleDeleteRoomLayout(layout),
    },
  ];

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
          <Pressable
            onPress={() => {
              if (selectedFolder) {
                setSelectedFolderId(null);
                return;
              }

              navigation.goBack();
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={{ padding: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text
            style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary, flex: 1, textAlign: "center" }}
            numberOfLines={1}
          >
            {selectedFolder ? selectedFolder.name : "Project Library"}
          </Text>
          <Pressable
            onPress={() => setCreateFolderSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Create project folder"
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {selectedFolder ? (
          selectedFolderArtworkItems.length === 0 && selectedFolderRoomLayoutItems.length === 0 ? (
            <AppCard
              title="No saved items in this folder"
              subtitle="Save framed artwork and wall layouts into this project folder."
            >
              <Text style={{ ...typography.small, color: colors.textSecondary }}>
                Saved artwork and wall layouts will be organized here.
              </Text>
            </AppCard>
          ) : (
            <>
              <AppSegmentedControl<LibraryContentTab>
                options={[
                  { label: `Artwork (${selectedFolderArtworkItems.length})`, value: "artwork" },
                  { label: `Wall Layouts (${selectedFolderRoomLayoutItems.length})`, value: "layouts" },
                ]}
                value={activeTab}
                onChange={setActiveTab}
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                  marginTop: spacing.md,
                }}
              >
                <Pressable
                  onPress={() => {
                    if (isReorderMode) {
                      return;
                    }
                    setSortMode((current) => getNextLibrarySortMode(current));
                  }}
                  disabled={isReorderMode}
                  accessibilityRole="button"
                  accessibilityLabel={`Sort saved items: ${LIBRARY_SORT_LABELS[sortMode]}`}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 44,
                    paddingHorizontal: spacing.md,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.backgroundCard,
                    opacity: isReorderMode ? 0.45 : pressed ? 0.72 : 1,
                  })}
                >
                  <Ionicons name="funnel-outline" size={17} color={colors.textSecondary} />
                  <Text
                    style={{
                      ...typography.small,
                      color: colors.textSecondary,
                      fontWeight: "600",
                      marginLeft: 7,
                    }}
                    numberOfLines={1}
                  >
                    Sort: {LIBRARY_SORT_LABELS[sortMode]}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleToggleReorderMode}
                  disabled={visibleItemsCount < 2}
                  accessibilityRole="button"
                  accessibilityLabel={isReorderMode ? "Done reordering" : "Reorder saved items"}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 44,
                    paddingHorizontal: spacing.md,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: isReorderMode ? colors.accent : colors.borderStrong,
                    backgroundColor: isReorderMode ? colors.accent : colors.backgroundCard,
                    opacity: visibleItemsCount < 2 ? 0.45 : pressed ? 0.72 : 1,
                  })}
                >
                  <Ionicons
                    name={isReorderMode ? "checkmark-outline" : "swap-vertical-outline"}
                    size={18}
                    color={isReorderMode ? colors.white : colors.textSecondary}
                  />
                  <Text
                    style={{
                      ...typography.small,
                      color: isReorderMode ? colors.white : colors.textSecondary,
                      fontWeight: "600",
                      marginLeft: 7,
                    }}
                    numberOfLines={1}
                  >
                    {isReorderMode ? "Done" : "Reorder"}
                  </Text>
                </Pressable>
              </View>

              {visibleItemsCount === 0 ? (
                <AppCard
                  title={activeTab === "artwork" ? "No saved artwork" : "No saved wall layouts"}
                  subtitle={
                    activeTab === "artwork"
                      ? "Saved framed artwork will appear here."
                      : "Saved Room View layouts will appear here."
                  }
                >
                  <Text style={{ ...typography.small, color: colors.textSecondary }}>
                    Switch tabs to view other saved items in this project folder.
                  </Text>
                </AppCard>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.md,
                    marginTop: spacing.md,
                  }}
                >
                  {activeTab === "artwork"
                    ? selectedFolderArtworks.map((artwork, index) => (
                        <SavedArtworkLibraryCard
                          key={artwork.id}
                          artwork={artwork}
                          width={artworkCardWidth}
                          thumbnailWidth={artworkThumbnailWidthEstimate}
                          thumbnailHeight={thumbnailHeight}
                          actions={getArtworkActions(artwork)}
                          showActionLabels={showCardActionLabels}
                          reorderIndex={isReorderMode ? index : undefined}
                          reorderTotal={isReorderMode ? selectedFolderArtworks.length : undefined}
                          onMoveUp={isReorderMode ? () => moveDisplayItem(artwork.id, -1) : undefined}
                          onMoveDown={isReorderMode ? () => moveDisplayItem(artwork.id, 1) : undefined}
                        />
                      ))
                    : selectedFolderRoomLayouts.map((layout, index) => (
                        <RoomLayoutLibraryCard
                          key={layout.id}
                          layout={layout}
                          artworksById={artworksById}
                          width={roomLayoutCardWidth}
                          thumbnailWidth={roomLayoutThumbnailWidthEstimate}
                          thumbnailHeight={thumbnailHeight}
                          actions={getRoomLayoutActions(layout)}
                          showActionLabels={showCardActionLabels}
                          reorderIndex={isReorderMode ? index : undefined}
                          reorderTotal={isReorderMode ? selectedFolderRoomLayouts.length : undefined}
                          onMoveUp={isReorderMode ? () => moveDisplayItem(layout.id, -1) : undefined}
                          onMoveDown={isReorderMode ? () => moveDisplayItem(layout.id, 1) : undefined}
                        />
                      ))}
                </View>
              )}
            </>
          )
        ) : sortedProjectFolders.length === 0 ? (
          <AppCard
            title="No project folders yet"
            subtitle="Create a project folder to organize saved artwork and wall layouts."
          >
            <AppButton
              label="Create Project Folder"
              onPress={() => setCreateFolderSheetVisible(true)}
              style={{ width: "72%", alignSelf: "center" }}
            />
          </AppCard>
        ) : (
          sortedProjectFolders.map((folder) => {
            const artworkCount = framedArtworks.filter(
              (artwork) => artwork.projectFolderId === folder.id
            ).length;
            const layoutCount = roomLayouts.filter((layout) => layout.projectFolderId === folder.id).length;

            return (
              <Pressable
                key={folder.id}
                onPress={() => setSelectedFolderId(folder.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${folder.name}`}
                style={{
                  backgroundColor: colors.backgroundCard,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons name="folder-outline" size={22} color={colors.textSecondary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }} numberOfLines={1}>
                      {folder.name}
                    </Text>
                    <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 3 }}>
                      {artworkCount} {artworkCount === 1 ? "artwork" : "artworks"} - {layoutCount}{" "}
                      {layoutCount === 1 ? "wall layout" : "wall layouts"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <FullscreenPreviewModal
        target={fullscreenPreview}
        artworksById={artworksById}
        windowWidth={windowWidth}
        windowHeight={windowHeight}
        bottomInset={insets.bottom}
        onClose={() => setFullscreenPreview(null)}
      />

      <AppSheetModal
        visible={createFolderSheetVisible}
        title="New Project Folder"
        onClose={() => setCreateFolderSheetVisible(false)}
      >
        <AppTextField
          label="Folder name"
          placeholder="Client or project name"
          value={newFolderName}
          onChangeText={setNewFolderName}
        />
        <AppButton
          label="Create Folder"
          onPress={handleCreateFolder}
          disabled={!newFolderName.trim()}
          style={{ width: "64%", alignSelf: "center" }}
        />
      </AppSheetModal>
    </View>
  );
}
