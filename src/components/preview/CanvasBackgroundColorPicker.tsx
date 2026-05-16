import React from "react";
import { View } from "react-native";
import {
  DEFAULT_CANVAS_BACKGROUND_COLOR_HEX,
  useAppSettingsStore,
} from "../../state/appSettingsStore";
import { useAppTheme } from "../../theme/AppThemeProvider";
import ColorPickerField from "../ui/ColorPickerField";

const CANVAS_BACKGROUND_DEFAULT_COLORS = [
  DEFAULT_CANVAS_BACKGROUND_COLOR_HEX,
  "#171717",
  "#1A1A1A",
  "#202020",
  "#4A4A4A",
  "#808080",
  "#FFFFFF",
  "#F3EEE6",
  "#E7DED2",
];

type CanvasBackgroundColorPickerProps = {
  compact?: boolean;
};

export default function CanvasBackgroundColorPicker({
  compact = false,
}: CanvasBackgroundColorPickerProps) {
  const { spacing } = useAppTheme();
  const canvasBackgroundColorHex = useAppSettingsStore(
    (state) => state.canvasBackgroundColorHex
  );
  const canvasBackgroundColorPresets = useAppSettingsStore(
    (state) => state.canvasBackgroundColorPresets
  );
  const setCanvasBackgroundColorHex = useAppSettingsStore(
    (state) => state.setCanvasBackgroundColorHex
  );
  const saveCanvasBackgroundColorPreset = useAppSettingsStore(
    (state) => state.saveCanvasBackgroundColorPreset
  );

  return (
    <View
      style={{
        position: "absolute",
        top: compact ? spacing.sm : spacing.lg,
        right: compact ? spacing.sm : spacing.lg,
        zIndex: 8,
      }}
    >
      <ColorPickerField
        variant="swatch"
        label="Canvas background"
        title="Canvas Background"
        value={canvasBackgroundColorHex}
        defaultColors={CANVAS_BACKGROUND_DEFAULT_COLORS}
        customPresets={canvasBackgroundColorPresets}
        onChange={setCanvasBackgroundColorHex}
        onSavePreset={saveCanvasBackgroundColorPreset}
        accessibilityLabel="Change canvas background color"
        swatchSize={compact ? 24 : undefined}
        swatchInnerSize={compact ? 10 : undefined}
        swatchHitSlop={compact ? 10 : undefined}
      />
    </View>
  );
}
