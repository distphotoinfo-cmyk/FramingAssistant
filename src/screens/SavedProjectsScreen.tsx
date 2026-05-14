import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../components/ui/AppButton";
import AppCard from "../components/ui/AppCard";
import AppSheetModal from "../components/ui/AppSheetModal";
import AppTextField from "../components/ui/AppTextField";
import { useSavedProjectsStore } from "../state/savedProjectsStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FramingRootStackParamList } from "../types/navigation";

function formatArtworkSize(width: number, height: number) {
  return `${width.toFixed(1).replace(/\.0$/, "")} in x ${height.toFixed(1).replace(/\.0$/, "")} in`;
}

export default function SavedProjectsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const { colors, radii, spacing, typography } = useAppTheme();
  const projectFolders = useSavedProjectsStore((state) => state.projectFolders);
  const framedArtworks = useSavedProjectsStore((state) => state.framedArtworks);
  const createProjectFolder = useSavedProjectsStore((state) => state.createProjectFolder);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [createFolderSheetVisible, setCreateFolderSheetVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

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
          selectedFolderArtworks.length === 0 ? (
            <AppCard
              title="No artwork in this folder"
              subtitle="Save artwork from Final Specs into this project folder."
            >
              <Text style={{ ...typography.small, color: colors.textSecondary }}>
                Artwork in this folder will be available from Room View.
              </Text>
            </AppCard>
          ) : (
            selectedFolderArtworks.map((artwork) => (
              <View
                key={artwork.id}
                style={{
                  backgroundColor: colors.backgroundCard,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                }}
              >
                <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }} numberOfLines={1}>
                  {artwork.name}
                </Text>
                <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 3 }}>
                  {formatArtworkSize(artwork.finalOuterSizeInches.width, artwork.finalOuterSizeInches.height)}
                </Text>
                <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 3 }}>
                  Saved {new Date(artwork.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          )
        ) : sortedProjectFolders.length === 0 ? (
          <AppCard
            title="No project folders yet"
            subtitle="Create a project folder to organize saved framed artworks."
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
                      {artworkCount} {artworkCount === 1 ? "artwork" : "artworks"}
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
