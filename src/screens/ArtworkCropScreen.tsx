import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image as RNImage, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../components/ui/AppButton";
import ScreenContainer from "../components/ScreenContainer";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { useFramingFlowStore } from "../state/framingFlowStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FramingRootStackParamList } from "../types/navigation";
import {
  buildStoredArtworkCrop,
  clampArtworkCropTransform,
  getArtworkAspectRatio,
  getCoverImageSize,
  resolveArtworkCropMetrics,
} from "../utils/artworkCrop";
import { parseSizeInput } from "../utils/framingGeometry";

type Props = NativeStackScreenProps<FramingRootStackParamList, "ArtworkCrop">;

export default function ArtworkCropScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, radii, spacing, typography } = useAppTheme();
  const shouldShowCropGuide = useAppSettingsStore(
    (state) => state.hasHydrated && !Boolean(state.sessionDismissedGuideTips.crop)
  );
  const dismissGuideTip = useAppSettingsStore((state) => state.dismissGuideTip);
  const draft = useFramingFlowStore((state) => state.draft);
  const setPreview = useFramingFlowStore((state) => state.setPreview);
  const [sourceSize, setSourceSize] = useState<null | { width: number; height: number }>(() => {
    if (
      route.params.imageWidth &&
      route.params.imageHeight &&
      route.params.imageWidth > 0 &&
      route.params.imageHeight > 0
    ) {
      return {
        width: route.params.imageWidth,
        height: route.params.imageHeight,
      };
    }

    if (route.params.mode === "edit" && draft.preview.artworkCrop) {
      return {
        width: draft.preview.artworkCrop.sourceWidth,
        height: draft.preview.artworkCrop.sourceHeight,
      };
    }

    return null;
  });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCropGuideVisible, setIsCropGuideVisible] = useState(false);
  const artworkSize = useMemo(() => parseSizeInput(draft.artwork.artworkSize), [draft.artwork.artworkSize]);
  const artworkAspectRatio = getArtworkAspectRatio(artworkSize);
  const existingCrop = route.params.mode === "edit" ? draft.preview.artworkCrop : null;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const zoomScale = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartZoom = useSharedValue(1);

  useEffect(() => {
    if (sourceSize) {
      return;
    }

    let cancelled = false;

    RNImage.getSize(
      route.params.imageUri,
      (width, height) => {
        if (cancelled) {
          return;
        }

        setSourceSize({ width, height });
      },
      () => {
        if (cancelled) {
          return;
        }

        setLoadError("Framing Assistant couldn't load this artwork image.");
      }
    );

    return () => {
      cancelled = true;
    };
  }, [route.params.imageUri, sourceSize]);

  const cropViewport = useMemo(() => {
    if (!artworkAspectRatio || stageSize.width <= 0 || stageSize.height <= 0) {
      return null;
    }

    const maxWidth = Math.max(stageSize.width - spacing.xl * 2, 1);
    const maxHeight = Math.max(stageSize.height - spacing.xl * 2, 1);

    let width = maxWidth;
    let height = width / artworkAspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * artworkAspectRatio;
    }

    return { width, height };
  }, [artworkAspectRatio, spacing.xl, stageSize.height, stageSize.width]);

  const baseImageSize = useMemo(() => {
    if (!sourceSize || !cropViewport) {
      return null;
    }

    return getCoverImageSize(
      sourceSize.width,
      sourceSize.height,
      cropViewport.width,
      cropViewport.height
    );
  }, [cropViewport, sourceSize]);

  const applyDefaultCrop = useCallback(() => {
    if (!sourceSize || !cropViewport) {
      return;
    }

    const next = clampArtworkCropTransform({
      sourceWidth: sourceSize.width,
      sourceHeight: sourceSize.height,
      viewportWidth: cropViewport.width,
      viewportHeight: cropViewport.height,
      zoomScale: 1,
      offsetX: 0,
      offsetY: 0,
    });

    zoomScale.value = next.zoomScale;
    translateX.value = next.offsetX;
    translateY.value = next.offsetY;
  }, [cropViewport, sourceSize, translateX, translateY, zoomScale]);

  useEffect(() => {
    if (!sourceSize || !cropViewport || !artworkAspectRatio) {
      return;
    }

    const next = resolveArtworkCropMetrics({
      crop: existingCrop,
      sourceWidth: sourceSize.width,
      sourceHeight: sourceSize.height,
      viewportWidth: cropViewport.width,
      viewportHeight: cropViewport.height,
      aspectRatio: artworkAspectRatio,
    });

    zoomScale.value = next.zoomScale;
    translateX.value = next.offsetX;
    translateY.value = next.offsetY;
  }, [
    artworkAspectRatio,
    cropViewport,
    existingCrop,
    sourceSize,
    translateX,
    translateY,
    zoomScale,
  ]);

  const viewportWidth = cropViewport?.width ?? 0;
  const viewportHeight = cropViewport?.height ?? 0;
  const sourceWidth = sourceSize?.width ?? 0;
  const sourceHeight = sourceSize?.height ?? 0;
  const baseImageWidth = baseImageSize?.width ?? 0;
  const baseImageHeight = baseImageSize?.height ?? 0;
  const cropGuideReady =
    shouldShowCropGuide &&
    !loadError &&
    Boolean(artworkAspectRatio && sourceSize && cropViewport && baseImageSize);

  useEffect(() => {
    if (!cropGuideReady || isCropGuideVisible) {
      return;
    }

    setIsCropGuideVisible(true);
  }, [cropGuideReady, isCropGuideVisible]);

  const handleDismissCropGuide = useCallback(() => {
    setIsCropGuideVisible(false);
    dismissGuideTip("crop");
  }, [dismissGuideTip]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Boolean(sourceSize && cropViewport))
        .shouldCancelWhenOutside(false)
        .onStart(() => {
          panStartX.value = translateX.value;
          panStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          const next = clampArtworkCropTransform({
            sourceWidth,
            sourceHeight,
            viewportWidth,
            viewportHeight,
            zoomScale: zoomScale.value,
            offsetX: panStartX.value + event.translationX,
            offsetY: panStartY.value + event.translationY,
          });

          translateX.value = next.offsetX;
          translateY.value = next.offsetY;
        }),
    [
      cropViewport,
      panStartX,
      panStartY,
      sourceHeight,
      sourceSize,
      sourceWidth,
      translateX,
      translateY,
      viewportHeight,
      viewportWidth,
      zoomScale,
    ]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(Boolean(sourceSize && cropViewport))
        .shouldCancelWhenOutside(false)
        .onStart(() => {
          pinchStartZoom.value = zoomScale.value;
        })
        .onUpdate((event) => {
          const next = clampArtworkCropTransform({
            sourceWidth,
            sourceHeight,
            viewportWidth,
            viewportHeight,
            zoomScale: pinchStartZoom.value * event.scale,
            offsetX: translateX.value,
            offsetY: translateY.value,
          });

          zoomScale.value = next.zoomScale;
          translateX.value = next.offsetX;
          translateY.value = next.offsetY;
        }),
    [
      cropViewport,
      pinchStartZoom,
      sourceHeight,
      sourceSize,
      sourceWidth,
      translateX,
      translateY,
      viewportHeight,
      viewportWidth,
      zoomScale,
    ]
  );

  const combinedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture]
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    width: baseImageWidth * zoomScale.value,
    height: baseImageHeight * zoomScale.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const handleApplyCrop = useCallback(() => {
    if (!sourceSize || !cropViewport || !artworkAspectRatio) {
      Alert.alert(
        "Artwork size needed",
        "Framing Assistant needs the artwork dimensions before it can lock and save the crop."
      );
      return;
    }

    const nextCrop = buildStoredArtworkCrop({
      sourceWidth: sourceSize.width,
      sourceHeight: sourceSize.height,
      viewportWidth: cropViewport.width,
      viewportHeight: cropViewport.height,
      zoomScale: zoomScale.value,
      offsetX: translateX.value,
      offsetY: translateY.value,
      aspectRatio: artworkAspectRatio,
    });

    setPreview({
      artworkSourceMode: "import",
      artworkImageUri: route.params.imageUri,
      artworkImageStoragePath: null,
      artworkCrop: nextCrop,
    });

    navigation.goBack();
  }, [
    artworkAspectRatio,
    cropViewport,
    navigation,
    route.params.imageUri,
    setPreview,
    sourceSize,
    translateX,
    translateY,
    zoomScale,
  ]);

  return (
    <ScreenContainer>
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderStrong,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={{ minHeight: 36, justifyContent: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary }}>
              Cancel
            </Text>
          </Pressable>

          <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
            Crop Artwork
          </Text>

          <View style={{ width: 56 }} />
        </View>

        <View
          style={{
            flex: 1,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.lg,
          }}
        >
          <View
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setStageSize({ width, height });
            }}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              borderRadius: radii.xl,
              backgroundColor: colors.backgroundCard,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {loadError ? (
              <View style={{ alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                <Ionicons name="warning-outline" size={26} color={colors.warning} />
                <Text style={{ ...typography.body, color: colors.textPrimary, textAlign: "center" }}>
                  {loadError}
                </Text>
              </View>
            ) : !artworkAspectRatio ? (
              <View style={{ alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                <Ionicons name="resize-outline" size={26} color={colors.warning} />
                <Text style={{ ...typography.body, color: colors.textPrimary, textAlign: "center" }}>
                  Set the artwork width and height first so the crop can lock to the artwork ratio.
                </Text>
              </View>
            ) : !sourceSize || !cropViewport || !baseImageSize ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <View
                style={{
                  width: cropViewport.width,
                  height: cropViewport.height,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.8)",
                  backgroundColor: "#000000",
                  overflow: "hidden",
                }}
              >
                <GestureDetector gesture={combinedGesture}>
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Animated.Image
                      source={{ uri: route.params.imageUri }}
                      resizeMode="cover"
                      style={[
                        {
                          position: "absolute",
                        },
                        animatedImageStyle,
                      ]}
                    />
                  </View>
                </GestureDetector>
              </View>
            )}
          </View>
        </View>

        <View
          style={{
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.borderStrong,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <AppButton
              label="Reset"
              variant="secondary"
              onPress={applyDefaultCrop}
              disabled={!sourceSize || !cropViewport || !artworkAspectRatio}
              style={{ flex: 0 }}
            />
            <AppButton
              label="Apply Crop"
              onPress={handleApplyCrop}
              disabled={!sourceSize || !cropViewport || !artworkAspectRatio}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {isCropGuideVisible ? (
          <Pressable
            onPress={handleDismissCropGuide}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.overlay,
              paddingTop: insets.top + spacing.xxl * 3,
              paddingHorizontal: spacing.lg,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: "100%",
                maxWidth: 340,
                backgroundColor: colors.guideSurface,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.guideBorder,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                shadowColor: "#000",
                shadowOpacity: 0.28,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.guideTextPrimary,
                  marginBottom: 6,
                }}
              >
                Pinch to zoom and drag to adjust your crop
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.guideTextSecondary,
                }}
              >
                The crop is locked to your artwork size
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
