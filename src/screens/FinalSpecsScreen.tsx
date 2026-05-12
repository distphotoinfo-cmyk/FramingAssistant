import React, { useMemo } from "react";
import { Alert, Share, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import FlowStepLayout from "../components/FlowStepLayout";
import AppCard from "../components/ui/AppCard";
import AppButton from "../components/ui/AppButton";
import AppTextField from "../components/ui/AppTextField";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { useFramingFlowStore } from "../state/framingFlowStore";
import { useSavedProjectsStore } from "../state/savedProjectsStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FramingRootStackParamList } from "../types/navigation";
import { buildDerivedGeometry, getFinishedFrameOuterSizeInches } from "../utils/framingGeometry";
import { formatMeasurement, formatSize } from "../utils/formatters";

function SpecRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ ...typography.small, color: colors.textSecondary }}>
        {label}
      </Text>
      <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}

export default function FinalSpecsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const unit = useAppSettingsStore((state) => state.unit);
  const imperialPrecision = useAppSettingsStore((state) => state.imperialPrecision);
  const draft = useFramingFlowStore((state) => state.draft);
  const setMeta = useFramingFlowStore((state) => state.setMeta);
  const resetDraft = useFramingFlowStore((state) => state.resetDraft);
  const saveFramedArtwork = useSavedProjectsStore((state) => state.saveFramedArtwork);
  const { colors, typography, spacing } = useAppTheme();

  const derived = buildDerivedGeometry(draft);
  const finalOuterSizeInches = getFinishedFrameOuterSizeInches(
    derived.outerMatSize,
    draft.preview.frameProfileId,
    unit
  );
  const specSummary = useMemo(
    () =>
      [
        `Artwork: ${formatSize(draft.artwork.artworkSize, unit, imperialPrecision)}`,
        `Opening: ${formatSize(draft.reveal.matOpeningSize, unit, imperialPrecision)}`,
        `Outer mat: ${formatSize(draft.outerMat.outerMatSize, unit, imperialPrecision)}`,
        `Top: ${formatMeasurement(derived.margins?.top ?? null, unit, imperialPrecision)}`,
        `Right: ${formatMeasurement(derived.margins?.right ?? null, unit, imperialPrecision)}`,
        `Bottom: ${formatMeasurement(derived.margins?.bottom ?? null, unit, imperialPrecision)}`,
        `Left: ${formatMeasurement(derived.margins?.left ?? null, unit, imperialPrecision)}`,
      ].join("\n"),
    [derived.margins?.bottom, derived.margins?.left, derived.margins?.right, derived.margins?.top, draft.artwork.artworkSize, draft.outerMat.outerMatSize, draft.reveal.matOpeningSize, imperialPrecision, unit]
  );

  const handleSaveFramedArtwork = () => {
    if (!derived.isValidGeometry || !finalOuterSizeInches) {
      Alert.alert(
        "Specs not ready",
        "Finish valid artwork and mat dimensions before saving this framed artwork."
      );
      return;
    }

    const artworkName = draft.meta.projectName.trim() || "Untitled framed artwork";
    const savedArtwork = saveFramedArtwork({
      name: artworkName,
      notes: draft.meta.notes,
      draft: JSON.parse(JSON.stringify(draft)),
      unit,
      finalOuterSizeInches,
    });
    Alert.alert(
      "Framed Artwork Saved",
      `"${savedArtwork.name}" is now available in Room View.`
    );
  };

  return (
    <FlowStepLayout
      route="FinalSpecs"
      title="Final Specs"
      intro="Review the final cut numbers, add a project name if you want one, and save or export the summary from here."
      nextLabel="View on Wall"
      footerVariant="compactBackArrow"
      onNext={() => {
        navigation.navigate("RoomView");
      }}
    >
      <AppCard title="Final cut dimensions">
        <SpecRow label="Opening size" value={formatSize(draft.reveal.matOpeningSize, unit, imperialPrecision)} />
        <SpecRow label="Outer mat size" value={formatSize(draft.outerMat.outerMatSize, unit, imperialPrecision)} />
        <SpecRow label="Top margin" value={formatMeasurement(derived.margins?.top ?? null, unit, imperialPrecision)} />
        <SpecRow label="Right margin" value={formatMeasurement(derived.margins?.right ?? null, unit, imperialPrecision)} />
        <SpecRow label="Bottom margin" value={formatMeasurement(derived.margins?.bottom ?? null, unit, imperialPrecision)} />
        <SpecRow label="Left margin" value={formatMeasurement(derived.margins?.left ?? null, unit, imperialPrecision)} />
      </AppCard>

      <AppCard title="Save or export">
        <AppTextField
          label="Project name"
          placeholder="Untitled project"
          value={draft.meta.projectName}
          onChangeText={(projectName) => setMeta({ projectName })}
        />
        <AppTextField
          label="Notes"
          placeholder="Optional notes for the cut or framing plan"
          multiline
          value={draft.meta.notes}
          onChangeText={(notes) => setMeta({ notes })}
        />

        <View style={{ gap: spacing.sm }}>
          <AppButton
            label="Save Framed Artwork"
            onPress={handleSaveFramedArtwork}
            style={{ width: "60%", alignSelf: "center" }}
          />
          <AppButton
            variant="secondary"
            label="Export Summary"
            onPress={() => {
              void Share.share({
                message: specSummary,
              });
            }}
            style={{ width: "60%", alignSelf: "center" }}
          />
          <AppButton
            variant="secondary"
            label="Start New Draft"
            onPress={() => {
              resetDraft();
              navigation.navigate("Setup");
            }}
            style={{ width: "60%", alignSelf: "center" }}
          />
        </View>
      </AppCard>

      {!derived.isValidGeometry ? (
        <Text style={{ ...typography.small, color: colors.warning, textAlign: "center" }}>
          These specs need a larger outer mat size before they can be cut accurately.
        </Text>
      ) : null}
    </FlowStepLayout>
  );
}
