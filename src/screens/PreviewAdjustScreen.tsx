import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { requireOptionalNativeModule } from "expo-modules-core";
import FlowStepLayout from "../components/FlowStepLayout";
import MatPreviewCanvas from "../components/preview/MatPreviewCanvas";
import AppCard from "../components/ui/AppCard";
import AppSheetModal from "../components/ui/AppSheetModal";
import ColorPickerField from "../components/ui/ColorPickerField";
import CompactOptionPicker from "../components/ui/CompactOptionPicker";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { useFramingFlowStore } from "../state/framingFlowStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FrameFinishId, FrameProfileId } from "../types/framing";
import type { FramingRootStackParamList } from "../types/navigation";
import { getArtworkAspectRatio, isArtworkCropCompatible } from "../utils/artworkCrop";
import {
  FRAME_SELECTOR_OPTIONS,
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

async function loadImagePickerModule() {
  const nativeImagePicker = requireOptionalNativeModule("ExponentImagePicker");

  if (!nativeImagePicker) {
    Alert.alert(
      "Rebuild required",
      "Image import was added as a native module. Rebuild and reinstall Framing Assistant before using the photo library or camera."
    );
    return null;
  }

  try {
    return await import("expo-image-picker");
  } catch {
    Alert.alert(
      "Rebuild required",
      "Image import was added as a native module. Rebuild and reinstall Framing Assistant before using the photo library or camera."
    );
    return null;
  }
}

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

export default function PreviewAdjustScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const previewSnapIncrementInches = useAppSettingsStore((state) => state.previewSnapIncrementInches);
  const matColorPresets = useAppSettingsStore((state) => state.matColorPresets);
  const saveMatColorPreset = useAppSettingsStore((state) => state.saveMatColorPreset);
  const draft = useFramingFlowStore((state) => state.draft);
  const setPreview = useFramingFlowStore((state) => state.setPreview);
  const { colors, radii, spacing, typography } = useAppTheme();
  const [liveDragOffsets, setLiveDragOffsets] = useState<{ offsetX: number; offsetY: number } | null>(null);
  const [artworkSourceSheetVisible, setArtworkSourceSheetVisible] = useState(false);
  const lastLiveOffsetsUpdateRef = useRef(0);
  const preview = draft.preview ?? {
    matThicknessPly: 4 as const,
    frameFamily: "nielsenFlorentine" as const,
    frameProfileId: "nielsenFlorentine93" as const,
    frameFinishId: "florentineBlack" as const,
    matColorHex: "#F4F0E8",
    frameColorHex: "#050505",
    offsetX: 0,
    offsetY: 0,
    artworkSourceMode: "placeholder" as const,
    artworkImageUri: null,
    artworkCrop: null,
  };

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
    "florentineBlack") as FrameFinishId;
  const selectedFrameColorValue =
    preview.frameProfileId === "basicNone" ? "notApplicable" : selectedFrameFinishId;

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
    try {
      const ImagePicker = await loadImagePickerModule();

      if (!ImagePicker) {
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo library access to place an artwork image into the preview."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      openCropEditor(
        result.assets[0].uri,
        result.assets[0].width ?? null,
        result.assets[0].height ?? null,
        "import"
      );
    } catch {
      Alert.alert(
        "Unable to open photo library",
        "Framing Assistant couldn't open the photo library. Please try again."
      );
    }
  }, [openCropEditor]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const ImagePicker = await loadImagePickerModule();

      if (!ImagePicker) {
        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera access needed",
          "Allow camera access to capture an artwork image for the preview."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
        cameraType: ImagePicker.CameraType.back,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      openCropEditor(
        result.assets[0].uri,
        result.assets[0].width ?? null,
        result.assets[0].height ?? null,
        "import"
      );
    } catch {
      Alert.alert(
        "Unable to open camera",
        "Framing Assistant couldn't open the camera. Please try again."
      );
    }
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

  const handleFrameFinishChange = useCallback(
    (frameFinishId: FrameFinishId) => {
      setPreview({
        frameFinishId,
        frameColorHex: resolveFrameColorHex(preview.frameProfileId, frameFinishId, preview.frameColorHex),
      });
    },
    [preview.frameColorHex, preview.frameProfileId, setPreview]
  );

  return (
    <FlowStepLayout
      route="PreviewAdjust"
      title="Preview and Adjust"
      nextLabel="View Final Specs"
      footerVariant="compactBackArrow"
    >
      <MatPreviewCanvas
        artworkSize={derived.artworkSize}
        openingSize={derived.openingSize}
        outerMatSize={derived.outerMatSize}
        frameProfileId={preview.frameProfileId}
        frameColorHex={resolvedFrameColorHex}
        matThicknessPly={preview.matThicknessPly}
        matColorHex={preview.matColorHex}
        offsetX={preview.offsetX}
        offsetY={preview.offsetY}
        snapIncrement={snapIncrement}
        artworkSourceMode={preview.artworkSourceMode}
        artworkImageUri={preview.artworkImageUri}
        artworkCrop={preview.artworkCrop}
        onAdjustOffsets={handleCommittedOffsets}
        onLiveOffsetsChange={handleLiveOffsetsChange}
      />

      {!derived.isValidGeometry ? (
        <Text style={{ ...typography.small, color: colors.warning, textAlign: "center" }}>
          Outer mat size needs to be larger than the opening size before the preview can be trusted.
        </Text>
      ) : null}

      <AppCard
        title="Artwork"
        headerAccessory={
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
        }
      >
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
      </AppCard>

      <AppCard title="Preview options">
        <View style={{ flexDirection: "row", gap: spacing.md }}>
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

          <CompactOptionPicker
            label="Frame"
            title="Frame"
            value={preview.frameProfileId}
            onChange={handleFramePresetChange}
            options={FRAME_SELECTOR_OPTIONS}
          />
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <ColorPickerField
            label="Mat color"
            title="Mat color"
            value={preview.matColorHex}
            defaultColors={MAT_DEFAULT_COLORS}
            customPresets={matColorPresets}
            onChange={(matColorHex) => setPreview({ matColorHex })}
            onSavePreset={saveMatColorPreset}
          />

          <CompactOptionPicker
            label="Frame color"
            title="Frame color"
            value={selectedFrameColorValue}
            onChange={(value) => {
              if (preview.frameProfileId === "basicNone") {
                return;
              }

              handleFrameFinishChange(value as FrameFinishId);
            }}
            options={frameColorPickerOptions}
            disabled={preview.frameProfileId === "basicNone"}
          />
        </View>
      </AppCard>

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
    </FlowStepLayout>
  );
}
