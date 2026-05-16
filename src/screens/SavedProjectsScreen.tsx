import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
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
import { getPresetRoomSceneById } from "../data/presetRoomScenes";
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

function SavedArtworkLibraryCard({
  artwork,
  width,
  thumbnailWidth,
  thumbnailHeight,
  onPress,
}: {
  artwork: SavedFramedArtwork;
  width: ViewStyle["width"];
  thumbnailWidth: number;
  thumbnailHeight: number;
  onPress: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const preview = artwork.draft.preview;
  const thumbnailGeometry = useMemo(
    () => getArtworkThumbnailGeometry(artwork, thumbnailWidth - 42, thumbnailHeight - 34),
    [artwork, thumbnailHeight, thumbnailWidth]
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${artwork.name || "framed artwork"}`}
      style={{
        width,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        backgroundColor: colors.backgroundCard,
        overflow: "hidden",
      }}
    >
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
    </Pressable>
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

function RoomLayoutLibraryCard({
  layout,
  artworksById,
  width,
  thumbnailWidth,
  thumbnailHeight,
  onPress,
}: {
  layout: SavedRoomLayout;
  artworksById: Map<string, SavedFramedArtwork>;
  width: ViewStyle["width"];
  thumbnailWidth: number;
  thumbnailHeight: number;
  onPress: () => void;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const scene = layout.sourceMode === "presetRoom" ? getPresetRoomSceneById(layout.presetSceneId) : null;
  const placements = [...layout.roomView.placements]
    .filter((placement) => Boolean(placement.framedArtworkId))
    .sort((first, second) => (first.zIndex ?? 0) - (second.zIndex ?? 0));
  const pieceLabel = `${layout.placementCount} artwork ${layout.placementCount === 1 ? "piece" : "pieces"}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${layout.name}`}
      style={{
        width,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        backgroundColor: colors.backgroundCard,
        overflow: "hidden",
      }}
    >
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
            artwork={
              placement.framedArtworkId ? artworksById.get(placement.framedArtworkId) ?? null : null
            }
            center={placement.center}
            scale={placement.scale ?? 1}
            thumbnailWidth={thumbnailWidth}
            thumbnailHeight={thumbnailHeight}
          />
        ))}
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
    </Pressable>
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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryContentTab>("artwork");
  const [createFolderSheetVisible, setCreateFolderSheetVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
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
  const selectedFolderArtworks = useMemo(
    () =>
      framedArtworks
        .filter((artwork) => artwork.projectFolderId === selectedFolderId)
        .sort(
          (first, second) =>
            new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
        ),
    [framedArtworks, selectedFolderId]
  );
  const selectedFolderRoomLayouts = useMemo(
    () =>
      roomLayouts
        .filter((layout) => layout.projectFolderId === selectedFolderId)
        .sort(
          (first, second) =>
            new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
        ),
    [roomLayouts, selectedFolderId]
  );
  const artworksById = useMemo(
    () => new Map(framedArtworks.map((artwork) => [artwork.id, artwork])),
    [framedArtworks]
  );
  const visibleItemsCount =
    activeTab === "artwork" ? selectedFolderArtworks.length : selectedFolderRoomLayouts.length;

  useEffect(() => {
    if (!selectedFolder) {
      return;
    }

    if (activeTab === "artwork" && selectedFolderArtworks.length === 0 && selectedFolderRoomLayouts.length > 0) {
      setActiveTab("layouts");
    }

    if (activeTab === "layouts" && selectedFolderRoomLayouts.length === 0 && selectedFolderArtworks.length > 0) {
      setActiveTab("artwork");
    }
  }, [activeTab, selectedFolder, selectedFolderArtworks.length, selectedFolderRoomLayouts.length]);

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
          selectedFolderArtworks.length === 0 && selectedFolderRoomLayouts.length === 0 ? (
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
                  { label: `Artwork (${selectedFolderArtworks.length})`, value: "artwork" },
                  { label: `Wall Layouts (${selectedFolderRoomLayouts.length})`, value: "layouts" },
                ]}
                value={activeTab}
                onChange={setActiveTab}
              />

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
                    ? selectedFolderArtworks.map((artwork) => (
                        <SavedArtworkLibraryCard
                          key={artwork.id}
                          artwork={artwork}
                          width={artworkCardWidth}
                          thumbnailWidth={artworkThumbnailWidthEstimate}
                          thumbnailHeight={thumbnailHeight}
                          onPress={() => handleOpenArtwork(artwork)}
                        />
                      ))
                    : selectedFolderRoomLayouts.map((layout) => (
                        <RoomLayoutLibraryCard
                          key={layout.id}
                          layout={layout}
                          artworksById={artworksById}
                          width={roomLayoutCardWidth}
                          thumbnailWidth={roomLayoutThumbnailWidthEstimate}
                          thumbnailHeight={thumbnailHeight}
                          onPress={() => handleOpenRoomLayout(layout)}
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
