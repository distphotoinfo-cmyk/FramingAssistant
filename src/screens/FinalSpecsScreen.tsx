import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import FlowStepLayout from "../components/FlowStepLayout";
import { FinishedFramedArtwork } from "../components/preview/MatPreviewCanvas";
import AppCard from "../components/ui/AppCard";
import AppButton from "../components/ui/AppButton";
import AppTextField from "../components/ui/AppTextField";
import AppSheetModal from "../components/ui/AppSheetModal";
import Svg, { Line, Polygon } from "react-native-svg";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { useFramingFlowStore } from "../state/framingFlowStore";
import { useSavedProjectsStore } from "../state/savedProjectsStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FractionDenominator, FramingProjectDraft, MeasurementUnit } from "../types/framing";
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function DiagramLabel({
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
}: {
  draft: FramingProjectDraft;
  derived: DerivedFramingGeometry;
  finalOuterSizeInches: NumericSize | null;
  unit: MeasurementUnit;
  imperialPrecision: FractionDenominator;
}) {
  const { colors, radii, spacing, typography, isDark } = useAppTheme();
  const [canvasWidth, setCanvasWidth] = useState(0);

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
          minHeight: 260,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.backgroundInput,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <Text style={{ ...typography.small, color: colors.warning, textAlign: "center" }}>
          Finish valid artwork, mat, and frame dimensions to see the final cut diagram.
        </Text>
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
  const maxPreviewHeight = isCompact ? 310 : 430;
  const physicalScale = Math.max(
    1,
    Math.min(
      availableWidth / finalOuterSize.width,
      maxPreviewHeight / finalOuterSize.height
    )
  );
  const previewWidth = finalOuterSize.width * physicalScale;
  const previewHeight = finalOuterSize.height * physicalScale;
  const diagramHeight = topGutter + previewHeight + bottomGutter;
  const previewLeft = leftGutter + Math.max(0, (availableWidth - previewWidth) / 2);
  const previewTop = topGutter;
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
  const frameWidthLabel = formatMeasurement(finalOuterSize.width, unit, imperialPrecision);
  const frameHeightLabel = formatMeasurement(finalOuterSize.height, unit, imperialPrecision);
  const formatMarginLabel = (shortLabel: string, value: MatMargins[keyof MatMargins]) =>
    `${shortLabel} ${formatMeasurement(value, unit, imperialPrecision)}`;

  return (
    <View style={{ gap: spacing.md }}>
      <View
        onLayout={(event) => setCanvasWidth(event.nativeEvent.layout.width)}
        style={{
          minHeight: 280,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: isDark ? "#111111" : colors.backgroundInput,
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
              label={`Frame width ${frameWidthLabel}`}
              left={labelLeft(previewLeft + previewWidth / 2, isCompact ? 96 : 132)}
              top={Math.max(2, widthLineY - 27)}
              maxWidth={isCompact ? 96 : 132}
            />
            <DiagramLabel
              label={`Frame height ${frameHeightLabel}`}
              left={clampNumber(heightLineX + 8, 0, Math.max(0, canvasWidth - labelWidth))}
              top={clampNumber(previewTop + previewHeight / 2 - 16, 0, diagramHeight - 36)}
              maxWidth={labelWidth}
            />
            <DiagramLabel
              label={formatMarginLabel("Left", margins.left)}
              left={labelLeft(matLeft + (openingLeft - matLeft) / 2)}
              top={clampNumber(openingCenterY - 25, previewTop + 2, previewTop + previewHeight - 28)}
              maxWidth={labelWidth}
            />
            <DiagramLabel
              label={formatMarginLabel("Right", margins.right)}
              left={labelLeft(openingRight + (matRight - openingRight) / 2)}
              top={clampNumber(openingCenterY - 25, previewTop + 2, previewTop + previewHeight - 28)}
              maxWidth={labelWidth}
            />
            <DiagramLabel
              label={formatMarginLabel("Top", margins.top)}
              left={labelLeft(openingCenterX)}
              top={clampNumber(matTop + (openingTop - matTop) / 2 - 15, previewTop + 2, previewTop + previewHeight - 28)}
              maxWidth={labelWidth}
            />
            <DiagramLabel
              label={formatMarginLabel("Bottom", margins.bottom)}
              left={labelLeft(openingCenterX)}
              top={clampNumber(openingBottom + (matBottom - openingBottom) / 2 - 15, previewTop + 2, previewTop + previewHeight - 28)}
              maxWidth={labelWidth}
            />
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <SummaryPill
          label="Opening"
          value={`${formatMeasurement(derived.openingSize.width, unit, imperialPrecision).replace(` ${unit}`, "")} × ${formatMeasurement(derived.openingSize.height, unit, imperialPrecision)}`}
        />
        <SummaryPill
          label="Outer mat"
          value={formatSize(draft.outerMat.outerMatSize, unit, imperialPrecision)}
        />
      </View>
    </View>
  );
}

export default function FinalSpecsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const draft = useFramingFlowStore((state) => state.draft);
  const projectFolders = useSavedProjectsStore((state) => state.projectFolders);
  const createProjectFolder = useSavedProjectsStore((state) => state.createProjectFolder);
  const saveFramedArtwork = useSavedProjectsStore((state) => state.saveFramedArtwork);
  const { colors, radii, typography, spacing } = useAppTheme();
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);
  const [artworkName, setArtworkName] = useState("");
  const [selectedProjectFolderId, setSelectedProjectFolderId] = useState<string | null>(null);
  const [newProjectFolderName, setNewProjectFolderName] = useState("");

  const derived = buildDerivedGeometry(draft);
  const finalOuterSizeInches = getFinishedFrameOuterSizeInches(
    derived.outerMatSize,
    draft.preview.frameProfileId,
    unit
  );
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

  const openSaveArtworkSheet = () => {
    if (!derived.isValidGeometry || !finalOuterSizeInches) {
      Alert.alert(
        "Specs not ready",
        "Finish valid artwork and mat dimensions before saving this artwork."
      );
      return;
    }

    setArtworkName(draft.meta.projectName.trim() || "Untitled artwork");
    setSelectedProjectFolderId((current) => current ?? sortedProjectFolders[0]?.id ?? null);
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

  const handleSaveArtwork = () => {
    if (!derived.isValidGeometry || !finalOuterSizeInches) {
      Alert.alert(
        "Specs not ready",
        "Finish valid artwork and mat dimensions before saving this artwork."
      );
      return;
    }

    const trimmedArtworkName = artworkName.trim();

    if (!trimmedArtworkName) {
      Alert.alert("Artwork name needed", "Enter a name for this artwork.");
      return;
    }

    if (!selectedProjectFolderId) {
      Alert.alert("Project folder needed", "Select or create a project folder.");
      return;
    }

    const savedArtwork = saveFramedArtwork({
      projectFolderId: selectedProjectFolderId,
      name: trimmedArtworkName,
      draft: JSON.parse(JSON.stringify(draft)),
      unit,
      finalOuterSizeInches,
    });
    setSaveSheetVisible(false);
    Alert.alert(
      "Artwork Saved",
      `"${savedArtwork.name}" is now available in Room View.`
    );
  };

  return (
    <FlowStepLayout
      route="FinalSpecs"
      title="Final Specs"
      intro="Review the final cut diagram and save this framed artwork into a project folder."
      nextLabel="View on Wall"
      footerVariant="compactBackArrow"
      onNext={() => {
        navigation.navigate("RoomView");
      }}
    >
      <AppCard title="Final cut diagram">
        <FinalCutDiagram
          draft={draft}
          derived={derived}
          finalOuterSizeInches={finalOuterSizeInches}
          unit={unit}
          imperialPrecision={imperialPrecision}
        />
      </AppCard>

      <AppCard title="Save Artwork">
        <Text style={{ ...typography.small, color: colors.textSecondary }}>
          Save this framed artwork into a project folder so it can be placed in Room View.
        </Text>
        <AppButton
          label="Save Artwork"
          onPress={openSaveArtworkSheet}
          style={{ width: "60%", alignSelf: "center" }}
        />
      </AppCard>

      {!derived.isValidGeometry ? (
        <Text style={{ ...typography.small, color: colors.warning, textAlign: "center" }}>
          These specs need a larger outer mat size before they can be cut accurately.
        </Text>
      ) : null}

      <AppSheetModal
        visible={saveSheetVisible}
        title="Save Artwork"
        onClose={() => setSaveSheetVisible(false)}
      >
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
            style={{ maxHeight: 176 }}
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
                      minHeight: 42,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: selected ? colors.accent : colors.borderStrong,
                      backgroundColor: selected ? colors.accentSoft : colors.backgroundCard,
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
                      }}
                      numberOfLines={1}
                    >
                      {folder.name}
                    </Text>
                    {selected ? (
                      <Text style={{ ...typography.small, color: colors.accent, fontWeight: "700" }}>
                        Selected
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppTextField
            label="Create new project folder"
            placeholder="Client or project name"
            value={newProjectFolderName}
            onChangeText={setNewProjectFolderName}
          />
          <AppButton
            variant="secondary"
            label="Create Folder"
            onPress={handleCreateProjectFolder}
            style={{ width: "56%", alignSelf: "center" }}
          />
        </View>

        <AppButton
          label="Save Artwork"
          onPress={handleSaveArtwork}
          disabled={!selectedProjectFolderId || !artworkName.trim()}
          style={{ width: "60%", alignSelf: "center" }}
        />
      </AppSheetModal>
    </FlowStepLayout>
  );
}
