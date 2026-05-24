import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
import {
  TABLET_LANDSCAPE_CONTROLS_COLUMN_WIDTH,
  TABLET_LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH,
  TabletWorkspaceContent,
  getTabletWorkspaceMode,
  getTabletWorkspacePreviewCanvasHeight,
} from "../components/layout/TabletWorkspaceLayout";
import CanvasBackgroundColorPicker from "../components/preview/CanvasBackgroundColorPicker";
import { FinishedFramedArtwork } from "../components/preview/MatPreviewCanvas";
import PresetRoomSceneImage from "../components/room/PresetRoomSceneImage";
import AppButton from "../components/ui/AppButton";
import AppSegmentedControl from "../components/ui/AppSegmentedControl";
import AppTextField from "../components/ui/AppTextField";
import AppSheetModal from "../components/ui/AppSheetModal";
import { useStepNavigation } from "../hooks/useStepNavigation";
import Svg, { Line, Polygon } from "react-native-svg";
import { getPresetRoomScenesByOrientation } from "../data/presetRoomScenes";
import {
  DEFAULT_CANVAS_BACKGROUND_COLOR_HEX,
  useAppSettingsStore,
} from "../state/appSettingsStore";
import { useFramingFlowStore } from "../state/framingFlowStore";
import { useSavedProjectsStore } from "../state/savedProjectsStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type {
  FractionDenominator,
  FramingProjectDraft,
  MeasurementUnit,
  RoomPresetSceneOrientation,
  RoomViewSourceMode,
} from "../types/framing";
import type { FramingRootStackParamList } from "../types/navigation";
import {
  buildDerivedGeometry,
  getFinishedFrameOuterSizeInches,
  inchesToMeasurementUnit,
  type DerivedFramingGeometry,
  type MatMargins,
  type NumericSize,
} from "../utils/framingGeometry";
import { formatMeasurement, formatSize } from "../utils/formatters";
import { getFrameProfile } from "../utils/frameProfiles";
import { normalizeHex } from "../utils/color";
import { prepareDraftForSavedArtwork } from "../utils/persistentArtworkImages";

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type SaveArtworkIntent = "manual" | "viewOnWall";
type SaveArtworkMode = "normal" | "newCopy" | "updateOriginal";

function DiagramLabel({
  label,
  left,
  top,
  width,
}: {
  label: string;
  left: number;
  top: number;
  width: number;
}) {
  const { colors, radii } = useAppTheme();

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left,
        top,
        width,
        alignItems: "center",
      }}
    >
      <View
        style={{
          maxWidth: width,
          borderRadius: radii.pill,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          paddingHorizontal: 7,
          paddingVertical: 3,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            lineHeight: 13,
            fontWeight: "700",
            color: colors.textPrimary,
            textAlign: "center",
          }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function SideDiagramLabel({
  label,
  left,
  top,
  maxWidth,
}: {
  label: string;
  left: number;
  top: number;
  maxWidth: number;
}) {
  const { colors, radii } = useAppTheme();

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left,
        top,
        maxWidth,
        borderRadius: radii.pill,
        backgroundColor: colors.backgroundCard,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          lineHeight: 13,
          fontWeight: "700",
          color: colors.textPrimary,
          textAlign: "center",
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

function SummaryPill({
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
        minWidth: 138,
        flex: 1,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.backgroundInput,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={{ ...typography.eyebrow, color: colors.textSecondary }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ ...typography.small, color: colors.textPrimary, fontWeight: "700" }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function FinalCutDiagram({
  draft,
  derived,
  finalOuterSizeInches,
  unit,
  imperialPrecision,
  canvasHeight,
  compactCanvasControls = false,
}: {
  draft: FramingProjectDraft;
  derived: DerivedFramingGeometry;
  finalOuterSizeInches: NumericSize | null;
  unit: MeasurementUnit;
  imperialPrecision: FractionDenominator;
  canvasHeight: number;
  compactCanvasControls?: boolean;
}) {
  const { colors, radii, spacing, typography } = useAppTheme();
  const canvasBackgroundColorHex = useAppSettingsStore((state) => state.canvasBackgroundColorHex);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const canvasBackgroundColor = normalizeHex(
    canvasBackgroundColorHex,
    DEFAULT_CANVAS_BACKGROUND_COLOR_HEX
  );

  const finalOuterSize = finalOuterSizeInches
    ? {
        width: inchesToMeasurementUnit(finalOuterSizeInches.width, unit),
        height: inchesToMeasurementUnit(finalOuterSizeInches.height, unit),
      }
    : null;
  const canRenderDiagram = Boolean(
    derived.isValidGeometry &&
      derived.artworkSize &&
      derived.openingSize &&
      derived.outerMatSize &&
      derived.margins &&
      finalOuterSize
  );

  if (!canRenderDiagram || !derived.artworkSize || !derived.openingSize || !derived.outerMatSize || !derived.margins || !finalOuterSize) {
    return (
      <View
        style={{
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: canvasBackgroundColor,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          position: "relative",
        }}
      >
        <CanvasBackgroundColorPicker compact={compactCanvasControls} />
        <Text style={{ ...typography.eyebrow, color: colors.textSecondary, marginBottom: spacing.xs }}>
          Final cut diagram
        </Text>
        <View
          style={{
            height: canvasHeight,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.lg,
          }}
        >
          <Text style={{ ...typography.small, color: colors.warning, textAlign: "center" }}>
            Finish valid artwork, mat, and frame dimensions to see the final cut diagram.
          </Text>
        </View>
      </View>
    );
  }

  const frameProfile = getFrameProfile(draft.preview.frameProfileId);
  const frameFaceWidth =
    frameProfile.renderStyle === "none"
      ? 0
      : unit === "cm"
        ? frameProfile.faceWidthInches * 2.54
        : frameProfile.faceWidthInches;
  const isCompact = canvasWidth > 0 && canvasWidth < 430;
  const labelWidth = isCompact ? 70 : 104;
  const topGutter = isCompact ? 46 : 58;
  const bottomGutter = isCompact ? 62 : 74;
  const leftGutter = isCompact ? 10 : 28;
  const rightGutter = isCompact ? 66 : 92;
  const availableWidth = Math.max(220, canvasWidth - leftGutter - rightGutter);
  const availablePreviewHeight = Math.max(
    isCompact ? 150 : 180,
    canvasHeight - topGutter - bottomGutter
  );
  const physicalScale = Math.max(
    1,
    Math.min(
      availableWidth / finalOuterSize.width,
      availablePreviewHeight / finalOuterSize.height
    )
  );
  const previewWidth = finalOuterSize.width * physicalScale;
  const previewHeight = finalOuterSize.height * physicalScale;
  const diagramContentHeight = topGutter + previewHeight + bottomGutter;
  const diagramHeight = Math.max(canvasHeight, diagramContentHeight);
  const diagramTopOffset = Math.max(0, (canvasHeight - diagramContentHeight) / 2);
  const previewLeft = leftGutter + Math.max(0, (availableWidth - previewWidth) / 2);
  const previewTop = diagramTopOffset + topGutter;
  const framePx = frameFaceWidth * physicalScale;
  const matLeft = previewLeft + framePx;
  const matTop = previewTop + framePx;
  const matWidth = derived.outerMatSize.width * physicalScale;
  const matHeight = derived.outerMatSize.height * physicalScale;
  const matRight = matLeft + matWidth;
  const matBottom = matTop + matHeight;
  const margins = derived.margins;
  const openingLeft = matLeft + margins.left * physicalScale;
  const openingTop = matTop + margins.top * physicalScale;
  const openingWidth = derived.openingSize.width * physicalScale;
  const openingHeight = derived.openingSize.height * physicalScale;
  const openingRight = openingLeft + openingWidth;
  const openingBottom = openingTop + openingHeight;
  const openingCenterX = openingLeft + openingWidth / 2;
  const openingCenterY = openingTop + openingHeight / 2;
  const widthLineY = previewTop - 18;
  const heightLineX = previewLeft + previewWidth + (isCompact ? 18 : 26);
  const arrowSize = isCompact ? 4 : 5;
  const lineColor = colors.accent;
  const lineWidth = isCompact ? 1.35 : 1.6;

  const horizontalArrow = (x1: number, x2: number, y: number, key: string) => {
    if (Math.abs(x2 - x1) < 8) {
      return null;
    }

    return (
      <React.Fragment key={key}>
        <Line x1={x1} y1={y} x2={x2} y2={y} stroke={lineColor} strokeWidth={lineWidth} strokeLinecap="round" />
        <Polygon points={`${x1},${y} ${x1 + arrowSize},${y - arrowSize} ${x1 + arrowSize},${y + arrowSize}`} fill={lineColor} />
        <Polygon points={`${x2},${y} ${x2 - arrowSize},${y - arrowSize} ${x2 - arrowSize},${y + arrowSize}`} fill={lineColor} />
      </React.Fragment>
    );
  };
  const verticalArrow = (x: number, y1: number, y2: number, key: string) => {
    if (Math.abs(y2 - y1) < 8) {
      return null;
    }

    return (
      <React.Fragment key={key}>
        <Line x1={x} y1={y1} x2={x} y2={y2} stroke={lineColor} strokeWidth={lineWidth} strokeLinecap="round" />
        <Polygon points={`${x},${y1} ${x - arrowSize},${y1 + arrowSize} ${x + arrowSize},${y1 + arrowSize}`} fill={lineColor} />
        <Polygon points={`${x},${y2} ${x - arrowSize},${y2 - arrowSize} ${x + arrowSize},${y2 - arrowSize}`} fill={lineColor} />
      </React.Fragment>
    );
  };
  const labelLeft = (centerX: number, width = labelWidth) =>
    clampNumber(centerX - width / 2, 0, Math.max(0, canvasWidth - width));
  const labelHeight = 21;
  const labelGap = 8;
  const labelTop = (centerY: number) =>
    clampNumber(centerY - labelHeight / 2, 0, Math.max(0, diagramHeight - labelHeight));
  const horizontalLabelTop = (lineY: number) =>
    clampNumber(lineY - labelHeight - labelGap, 0, Math.max(0, diagramHeight - labelHeight));
  const verticalLabelLeft = (lineX: number, width = labelWidth) =>
    clampNumber(lineX + labelGap, 0, Math.max(0, canvasWidth - width));
  const frameWidthLabel = formatMeasurement(finalOuterSize.width, unit, imperialPrecision);
  const frameHeightLabel = formatMeasurement(finalOuterSize.height, unit, imperialPrecision);
  const formatMarginLabel = (value: MatMargins[keyof MatMargins]) =>
    formatMeasurement(value, unit, imperialPrecision);

  return (
    <View
      style={{
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: canvasBackgroundColor,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        position: "relative",
      }}
    >
      <CanvasBackgroundColorPicker compact={compactCanvasControls} />
      <Text style={{ ...typography.eyebrow, color: colors.textSecondary, marginBottom: spacing.xs }}>
        Final cut diagram
      </Text>
      <View
        onLayout={(event) => setCanvasWidth(event.nativeEvent.layout.width)}
        style={{
          height: canvasHeight,
          overflow: "hidden",
        }}
      >
        {canvasWidth > 0 ? (
          <View style={{ height: diagramHeight }}>
            <FinishedFramedArtwork
              artworkSize={derived.artworkSize}
              openingSize={derived.openingSize}
              outerMatSize={derived.outerMatSize}
              frameProfileId={draft.preview.frameProfileId}
              frameColorHex={draft.preview.frameColorHex}
              matThicknessPly={draft.preview.matThicknessPly}
              matColorHex={draft.preview.matColorHex}
              matCoreColor={draft.preview.matCoreColor}
              mountingBoardColorHex={draft.preview.mountingBoardColorHex}
              offsetX={draft.preview.offsetX}
              offsetY={draft.preview.offsetY}
              artworkSourceMode={draft.preview.artworkSourceMode}
              artworkImageUri={draft.preview.artworkImageUri}
              artworkCrop={draft.preview.artworkCrop}
              physicalScale={physicalScale}
              showShadow
              style={{
                position: "absolute",
                left: previewLeft,
                top: previewTop,
              }}
            />

            <Svg
              pointerEvents="none"
              width={canvasWidth}
              height={diagramHeight}
              style={{ position: "absolute", left: 0, top: 0 }}
            >
              <Line x1={previewLeft} y1={previewTop} x2={previewLeft} y2={widthLineY + 8} stroke={lineColor} strokeWidth={lineWidth} strokeOpacity={0.65} />
              <Line x1={previewLeft + previewWidth} y1={previewTop} x2={previewLeft + previewWidth} y2={widthLineY + 8} stroke={lineColor} strokeWidth={lineWidth} strokeOpacity={0.65} />
              {horizontalArrow(previewLeft, previewLeft + previewWidth, widthLineY, "frame-width")}
              <Line x1={previewLeft + previewWidth} y1={previewTop} x2={heightLineX - 8} y2={previewTop} stroke={lineColor} strokeWidth={lineWidth} strokeOpacity={0.65} />
              <Line x1={previewLeft + previewWidth} y1={previewTop + previewHeight} x2={heightLineX - 8} y2={previewTop + previewHeight} stroke={lineColor} strokeWidth={lineWidth} strokeOpacity={0.65} />
              {verticalArrow(heightLineX, previewTop, previewTop + previewHeight, "frame-height")}
              {horizontalArrow(matLeft, openingLeft, openingCenterY, "left-margin")}
              {horizontalArrow(openingRight, matRight, openingCenterY, "right-margin")}
              {verticalArrow(openingCenterX, matTop, openingTop, "top-margin")}
              {verticalArrow(openingCenterX, openingBottom, matBottom, "bottom-margin")}
            </Svg>

            <DiagramLabel
              label={frameWidthLabel}
              left={labelLeft(previewLeft + previewWidth / 2, isCompact ? 96 : 132)}
              top={horizontalLabelTop(widthLineY)}
              width={isCompact ? 96 : 132}
            />
            <SideDiagramLabel
              label={frameHeightLabel}
              left={verticalLabelLeft(heightLineX)}
              top={labelTop(previewTop + previewHeight / 2)}
              maxWidth={labelWidth}
            />
            <DiagramLabel
              label={formatMarginLabel(margins.left)}
              left={labelLeft(matLeft + (openingLeft - matLeft) / 2)}
              top={horizontalLabelTop(openingCenterY)}
              width={labelWidth}
            />
            <DiagramLabel
              label={formatMarginLabel(margins.right)}
              left={labelLeft(openingRight + (matRight - openingRight) / 2)}
              top={horizontalLabelTop(openingCenterY)}
              width={labelWidth}
            />
            <SideDiagramLabel
              label={formatMarginLabel(margins.top)}
              left={verticalLabelLeft(openingCenterX)}
              top={labelTop(matTop + (openingTop - matTop) / 2)}
              maxWidth={labelWidth}
            />
            <SideDiagramLabel
              label={formatMarginLabel(margins.bottom)}
              left={verticalLabelLeft(openingCenterX)}
              top={labelTop(openingBottom + (matBottom - openingBottom) / 2)}
              maxWidth={labelWidth}
            />
          </View>
        ) : null}
      </View>

    </View>
  );
}

export default function FinalSpecsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { currentStep, totalSteps, previousStep, goBack } = useStepNavigation("FinalSpecs");
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const draft = useFramingFlowStore((state) => state.draft);
  const setMeta = useFramingFlowStore((state) => state.setMeta);
  const setPreview = useFramingFlowStore((state) => state.setPreview);
  const projectFolders = useSavedProjectsStore((state) => state.projectFolders);
  const framedArtworks = useSavedProjectsStore((state) => state.framedArtworks);
  const createProjectFolder = useSavedProjectsStore((state) => state.createProjectFolder);
  const saveFramedArtwork = useSavedProjectsStore((state) => state.saveFramedArtwork);
  const updateFramedArtwork = useSavedProjectsStore((state) => state.updateFramedArtwork);
  const { colors, layout, radii, typography, spacing } = useAppTheme();
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);
  const [artworkName, setArtworkName] = useState("");
  const [selectedProjectFolderId, setSelectedProjectFolderId] = useState<string | null>(null);
  const [newProjectFolderName, setNewProjectFolderName] = useState("");
  const [saveArtworkIntent, setSaveArtworkIntent] = useState<SaveArtworkIntent>("manual");
  const [isSavingArtwork, setIsSavingArtwork] = useState(false);
  const [roomChoiceSheetVisible, setRoomChoiceSheetVisible] = useState(false);
  const [presetRoomPickerVisible, setPresetRoomPickerVisible] = useState(false);
  const [presetRoomOrientation, setPresetRoomOrientation] =
    useState<RoomPresetSceneOrientation>("landscape");
  const [viewOnWallArtworkId, setViewOnWallArtworkId] = useState<string | null>(null);
  const [previewAreaSize, setPreviewAreaSize] = useState({ width: 0, height: 0 });
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
  const presetRoomPickerColumns = isPhoneWorkspace ? 1 : isTabletLandscape ? 3 : 2;
  const presetRoomPickerMaxWidth = isPhoneWorkspace ? 430 : isTabletLandscape ? 1120 : 920;
  const presetRoomPickerMaxHeight = isPhoneWorkspace
    ? Math.min(windowHeight * 0.74, 620)
    : Math.min(windowHeight * 0.84, 820);
  const presetRoomTileWidth = isPhoneWorkspace
    ? "100%"
    : isTabletLandscape
      ? "32.25%"
      : "49%";
  const presetRoomImageHeight = isPhoneWorkspace ? 190 : isTabletLandscape ? 240 : 284;
  const presetRoomTitleLines = isPhoneWorkspace ? 2 : 2;
  const visiblePresetRoomScenes = getPresetRoomScenesByOrientation(presetRoomOrientation);

  const derived = buildDerivedGeometry(draft);
  const finalOuterSizeInches = getFinishedFrameOuterSizeInches(
    derived.outerMatSize,
    draft.preview.frameProfileId,
    unit
  );
  const currentSavedArtwork =
    framedArtworks.find((artwork) => artwork.id === draft.meta.savedFramedArtworkId) ?? null;
  const sourceSavedArtwork =
    framedArtworks.find((artwork) => artwork.id === draft.meta.sourceFramedArtworkId) ?? null;
  const isEditingSavedArtwork = Boolean(sourceSavedArtwork);
  const protectedSavedArtwork = sourceSavedArtwork ?? currentSavedArtwork;
  const sortedProjectFolders = useMemo(
    () =>
      [...projectFolders].sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
      ),
    [projectFolders]
  );

  useEffect(() => {
    if (!selectedProjectFolderId && sortedProjectFolders[0]) {
      setSelectedProjectFolderId(sortedProjectFolders[0].id);
    }
  }, [selectedProjectFolderId, sortedProjectFolders]);

  const handlePreviewAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setPreviewAreaSize((currentSize) =>
      Math.abs(currentSize.width - width) < 1 && Math.abs(currentSize.height - height) < 1
        ? currentSize
        : { width, height }
    );
  }, []);

  const createRoomViewLaunchId = () =>
    `room-view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const openRoomChoiceForArtwork = useCallback((artworkId: string) => {
    setViewOnWallArtworkId(artworkId);
    setRoomChoiceSheetVisible(true);
  }, []);

  const navigateToRoomView = useCallback(
    (sourceMode: RoomViewSourceMode, presetSceneId?: string) => {
      if (!viewOnWallArtworkId) {
        return;
      }

      setRoomChoiceSheetVisible(false);
      setPresetRoomPickerVisible(false);
      navigation.navigate("RoomView", {
        autoPlaceArtworkId: viewOnWallArtworkId,
        sourceMode,
        presetSceneId,
        startWallPhotoFlow: sourceMode === "myWall",
        launchId: createRoomViewLaunchId(),
      });
    },
    [navigation, viewOnWallArtworkId]
  );

  const saveOrUpdateCurrentArtwork = useCallback(
    async ({
      artworkName: nextArtworkName,
      projectFolderId,
      mode = "normal",
    }: {
      artworkName?: string;
      projectFolderId?: string | null;
      mode?: SaveArtworkMode;
    } = {}) => {
      if (!derived.isValidGeometry || !finalOuterSizeInches) {
        Alert.alert(
          "Specs not ready",
          "Finish valid artwork and mat dimensions before saving this artwork."
        );
        return null;
      }

      const updateTarget =
        mode === "updateOriginal"
          ? protectedSavedArtwork
          : mode === "normal" && !isEditingSavedArtwork
            ? currentSavedArtwork
            : null;
      const baseArtworkName =
        nextArtworkName?.trim() ||
        currentSavedArtwork?.name ||
        sourceSavedArtwork?.name ||
        draft.meta.projectName.trim() ||
        "Untitled artwork";
      const trimmedArtworkName =
        mode === "newCopy" &&
        protectedSavedArtwork &&
        baseArtworkName === protectedSavedArtwork.name
          ? `${baseArtworkName} Copy`
          : baseArtworkName;
      const nextProjectFolderId =
        projectFolderId ??
        updateTarget?.projectFolderId ??
        currentSavedArtwork?.projectFolderId ??
        sourceSavedArtwork?.projectFolderId ??
        sortedProjectFolders[0]?.id ??
        null;

      if (!nextProjectFolderId) {
        return null;
      }

      const existingSavedArtworkId = updateTarget?.id ?? null;
      const draftForSave: FramingProjectDraft = JSON.parse(
        JSON.stringify({
          ...draft,
          meta: {
            ...draft.meta,
            projectName: trimmedArtworkName,
            savedFramedArtworkId: existingSavedArtworkId,
            sourceFramedArtworkId: existingSavedArtworkId,
          },
        })
      );
      const persistentDraftForSave = await prepareDraftForSavedArtwork(draftForSave);

      const savedArtwork = existingSavedArtworkId
        ? updateFramedArtwork(existingSavedArtworkId, {
            projectFolderId: nextProjectFolderId,
            name: trimmedArtworkName,
            draft: persistentDraftForSave,
            unit,
            finalOuterSizeInches,
          })
        : saveFramedArtwork({
            projectFolderId: nextProjectFolderId,
            name: trimmedArtworkName,
            draft: persistentDraftForSave,
            unit,
            finalOuterSizeInches,
          });

      if (!savedArtwork) {
        return null;
      }

      setMeta({
        projectName: savedArtwork.name,
        savedFramedArtworkId: savedArtwork.id,
        sourceFramedArtworkId:
          mode === "normal" && !isEditingSavedArtwork ? null : savedArtwork.id,
      });

      if (persistentDraftForSave.preview.artworkImageUri !== draft.preview.artworkImageUri) {
        setPreview({
          artworkImageUri: persistentDraftForSave.preview.artworkImageUri,
        });
      }

      return savedArtwork;
    },
    [
      currentSavedArtwork,
      derived.isValidGeometry,
      draft,
      finalOuterSizeInches,
      isEditingSavedArtwork,
      protectedSavedArtwork,
      saveFramedArtwork,
      setMeta,
      setPreview,
      sourceSavedArtwork,
      sortedProjectFolders,
      unit,
      updateFramedArtwork,
    ]
  );

  const openSaveArtworkSheet = (intent: SaveArtworkIntent = "manual") => {
    if (!derived.isValidGeometry || !finalOuterSizeInches) {
      Alert.alert(
        "Specs not ready",
        "Finish valid artwork and mat dimensions before saving this artwork."
      );
      return;
    }

    setSaveArtworkIntent(intent);
    const draftProjectName = draft.meta.projectName.trim();
    const savedArtworkName =
      currentSavedArtwork?.name.trim() || sourceSavedArtwork?.name.trim();
    const initialArtworkName =
      savedArtworkName && savedArtworkName !== "Untitled artwork"
        ? savedArtworkName
        : draftProjectName && draftProjectName !== "Untitled artwork"
          ? draftProjectName
          : "";

    setArtworkName(initialArtworkName);
    setSelectedProjectFolderId(
      currentSavedArtwork?.projectFolderId ??
        sourceSavedArtwork?.projectFolderId ??
        sortedProjectFolders[0]?.id ??
        null
    );
    setNewProjectFolderName("");
    setSaveSheetVisible(true);
  };

  const handleCreateProjectFolder = () => {
    const folderName = newProjectFolderName.trim();

    if (!folderName) {
      Alert.alert("Folder name needed", "Enter a project folder name first.");
      return;
    }

    const folder = createProjectFolder(folderName);
    setSelectedProjectFolderId(folder.id);
    setNewProjectFolderName("");
  };

  const handleViewOnWall = async () => {
    if (isEditingSavedArtwork) {
      openSaveArtworkSheet("viewOnWall");
      return;
    }

    if (currentSavedArtwork) {
      if (isSavingArtwork) {
        return;
      }

      setIsSavingArtwork(true);

      try {
        const savedArtwork = await saveOrUpdateCurrentArtwork();

        if (savedArtwork) {
          openRoomChoiceForArtwork(savedArtwork.id);
        }
      } catch {
        Alert.alert(
          "Unable to save image",
          "Framing Assistant couldn't keep a permanent copy of this artwork image. Please try saving again."
        );
      } finally {
        setIsSavingArtwork(false);
      }
      return;
    }

    openSaveArtworkSheet("viewOnWall");
  };

  const completeSaveArtwork = async (mode: SaveArtworkMode) => {
    if (isSavingArtwork) {
      return;
    }

    if (!derived.isValidGeometry || !finalOuterSizeInches) {
      Alert.alert(
        "Specs not ready",
        "Finish valid artwork and mat dimensions before saving this artwork."
      );
      return;
    }

    if (!selectedProjectFolderId) {
      Alert.alert("Project folder needed", "Select or create a project folder.");
      return;
    }

    setIsSavingArtwork(true);

    try {
      const savedArtwork = await saveOrUpdateCurrentArtwork({
        artworkName,
        projectFolderId: selectedProjectFolderId,
        mode,
      });

      if (!savedArtwork) {
        Alert.alert("Unable to save", "Choose or create a project folder before saving.");
        return;
      }

      setSaveSheetVisible(false);

      if (saveArtworkIntent === "viewOnWall") {
        openRoomChoiceForArtwork(savedArtwork.id);
        return;
      }

      Alert.alert("Artwork Saved", `"${savedArtwork.name}" is now available in Room View.`);
    } catch {
      Alert.alert(
        "Unable to save image",
        "Framing Assistant couldn't keep a permanent copy of this artwork image. Please try saving again."
      );
    } finally {
      setIsSavingArtwork(false);
    }
  };

  const confirmUpdateOriginalArtwork = () => {
    if (!protectedSavedArtwork) {
      void completeSaveArtwork("normal");
      return;
    }

    Alert.alert(
      "Update Original?",
      `This will replace the saved artwork "${protectedSavedArtwork.name}". Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update Original",
          style: "destructive",
          onPress: () => {
            void completeSaveArtwork("updateOriginal");
          },
        },
      ]
    );
  };

  const handleSaveArtwork = () => {
    if (isEditingSavedArtwork && protectedSavedArtwork) {
      Alert.alert(
        "Save Artwork",
        "How would you like to save this edited artwork?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save as New Copy",
            onPress: () => {
              void completeSaveArtwork("newCopy");
            },
          },
          {
            text: "Update Original",
            style: "destructive",
            onPress: confirmUpdateOriginalArtwork,
          },
        ]
      );
      return;
    }

    void completeSaveArtwork("normal");
  };

  const formatNumericSize = (size: NumericSize | null) =>
    size
      ? `${formatMeasurement(size.width, unit, imperialPrecision).replace(` ${unit}`, "")} × ${formatMeasurement(
          size.height,
          unit,
          imperialPrecision
        )}`
      : "Not set";

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
            <View
              onLayout={handlePreviewAreaLayout}
              style={{ flex: 1, minHeight: 0, justifyContent: "center" }}
            >
              <FinalCutDiagram
                draft={draft}
                derived={derived}
                finalOuterSizeInches={finalOuterSizeInches}
                unit={unit}
                imperialPrecision={imperialPrecision}
                canvasHeight={previewCanvasHeight}
                compactCanvasControls={isPhoneWorkspace}
              />
            </View>

            {!derived.isValidGeometry ? (
              <Text style={{ ...typography.small, color: colors.warning, textAlign: "center" }}>
                These specs need a larger outer mat size before they can be cut accurately.
              </Text>
            ) : null}

            <View
              style={{
                minHeight: 58,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: radii.xl,
                backgroundColor: colors.backgroundCard,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                flexDirection: isPhoneWorkspace ? "column" : "row",
                alignItems: isPhoneWorkspace ? "stretch" : "center",
                gap: spacing.md,
              }}
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
                <Ionicons name="resize-outline" size={18} color={colors.accent} />
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: 0,
                  flexDirection: isPhoneWorkspace ? "column" : "row",
                  gap: spacing.sm,
                }}
              >
                <SummaryPill label="Inner mat" value={formatNumericSize(derived.openingSize)} />
                <SummaryPill
                  label="Outer mat"
                  value={
                    derived.outerMatSize
                      ? formatNumericSize(derived.outerMatSize)
                      : formatSize(draft.outerMat.outerMatSize, unit, imperialPrecision)
                  }
                />
              </View>
              <AppButton
                label="Save Artwork"
                onPress={() => openSaveArtworkSheet("manual")}
                style={{ width: isPhoneWorkspace ? "100%" : 164 }}
              />
            </View>
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

            <AppButton
              label={isSavingArtwork ? "Saving..." : "View on Wall"}
              onPress={handleViewOnWall}
              disabled={isSavingArtwork}
              style={{ width: "52%", maxWidth: 360, alignSelf: "center" }}
            />
          </View>
        </View>
      </View>

      <AppSheetModal
        visible={saveSheetVisible}
        title="Save Artwork"
        onClose={() => setSaveSheetVisible(false)}
      >
        <View style={{ gap: spacing.md }}>
          <AppTextField
            label="Artwork name"
            placeholder="Untitled artwork"
            value={artworkName}
            onChangeText={setArtworkName}
          />

          <View>
            <Text style={{ ...typography.eyebrow, color: colors.textPrimary, marginBottom: spacing.xs }}>
              Project folder
            </Text>
            <ScrollView
              style={{ maxHeight: 154 }}
              contentContainerStyle={{ gap: spacing.xs }}
              showsVerticalScrollIndicator={sortedProjectFolders.length > 3}
            >
              {sortedProjectFolders.length === 0 ? (
                <Text style={{ ...typography.small, color: colors.textSecondary }}>
                  Create a project folder before saving this artwork.
                </Text>
              ) : (
                sortedProjectFolders.map((folder) => {
                  const selected = folder.id === selectedProjectFolderId;

                  return (
                    <Pressable
                      key={folder.id}
                      onPress={() => setSelectedProjectFolderId(folder.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${folder.name}`}
                      style={{
                        minHeight: 40,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: selected ? colors.accent : colors.borderStrong,
                        backgroundColor: selected ? colors.accentSoft : colors.backgroundInput,
                        paddingHorizontal: spacing.md,
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={{
                          ...typography.sectionTitle,
                          color: selected ? colors.accent : colors.textPrimary,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {folder.name}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
              paddingTop: spacing.md,
              gap: spacing.xs,
            }}
          >
            <Text style={{ ...typography.eyebrow, color: colors.textPrimary }}>
              New folder
            </Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
              <TextInput
                placeholder="Client or project name"
                placeholderTextColor={colors.textPlaceholder}
                value={newProjectFolderName}
                onChangeText={setNewProjectFolderName}
                style={{
                  flex: 1,
                  minHeight: 42,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: radii.md,
                  backgroundColor: colors.backgroundInput,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  color: colors.textPrimary,
                  fontSize: 15,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create project folder"
                onPress={handleCreateProjectFolder}
                style={({ pressed }) => ({
                  minHeight: 42,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  paddingHorizontal: spacing.md,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.backgroundInput : "transparent",
                })}
              >
                <Text style={{ ...typography.small, color: colors.textPrimary, fontWeight: "700" }}>
                  Create
                </Text>
              </Pressable>
            </View>
          </View>

          <AppButton
            label={isSavingArtwork ? "Saving..." : "Save Artwork"}
            onPress={handleSaveArtwork}
            disabled={!selectedProjectFolderId || isSavingArtwork}
            style={{ width: "100%", marginTop: spacing.xs }}
          />
        </View>
      </AppSheetModal>

      <AppSheetModal
        visible={roomChoiceSheetVisible}
        title="View on Wall"
        onClose={() => setRoomChoiceSheetVisible(false)}
      >
        <Pressable
          onPress={() => {
            setRoomChoiceSheetVisible(false);
            setPresetRoomPickerVisible(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Choose Preset Room"
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
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="home-outline" size={18} color={colors.textPrimary} />
            <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
              Choose Preset Room
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={() => navigateToRoomView("myWall")}
          accessibilityRole="button"
          accessibilityLabel="Use My Wall Photo"
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
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="image-outline" size={18} color={colors.textPrimary} />
            <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
              Use My Wall Photo
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      </AppSheetModal>

      <AppSheetModal
        visible={presetRoomPickerVisible}
        title="Choose Preset Room"
        maxWidth={presetRoomPickerMaxWidth}
        onClose={() => setPresetRoomPickerVisible(false)}
      >
        <AppSegmentedControl<RoomPresetSceneOrientation>
          options={[
            { label: "Landscape Rooms", value: "landscape" },
            { label: "Portrait Rooms", value: "portrait" },
          ]}
          value={presetRoomOrientation}
          onChange={setPresetRoomOrientation}
        />
        <ScrollView
          style={{ maxHeight: presetRoomPickerMaxHeight }}
          contentContainerStyle={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: isPhoneWorkspace ? spacing.md : spacing.md,
            paddingBottom: spacing.xs,
          }}
          showsVerticalScrollIndicator={visiblePresetRoomScenes.length > presetRoomPickerColumns * 2}
        >
          {visiblePresetRoomScenes.map((scene) => (
            <Pressable
              key={scene.id}
              onPress={() => navigateToRoomView("presetRoom", scene.id)}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${scene.title}`}
              style={{
                width: presetRoomTileWidth,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: radii.md,
                backgroundColor: colors.backgroundInput,
                overflow: "hidden",
              }}
            >
              <PresetRoomSceneImage
                scene={scene}
                resizeMode="cover"
                style={{
                  height: presetRoomImageHeight,
                  width: "100%",
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  minHeight: isPhoneWorkspace ? 44 : 52,
                  justifyContent: "center",
                  backgroundColor: colors.backgroundInput,
                  paddingHorizontal: isPhoneWorkspace ? spacing.sm : spacing.md,
                  paddingVertical: isPhoneWorkspace ? 7 : 8,
                }}
              >
                <Text
                  style={{
                    ...typography.small,
                    color: colors.textPrimary,
                    fontSize: isPhoneWorkspace ? 12 : 13,
                    lineHeight: isPhoneWorkspace ? 15 : 16,
                    fontWeight: "800",
                  }}
                  numberOfLines={presetRoomTitleLines}
                  ellipsizeMode="tail"
                >
                  {scene.title}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </AppSheetModal>
    </ScreenContainer>
  );
}
