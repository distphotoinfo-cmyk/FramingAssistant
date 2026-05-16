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

export default function CanvasBackgroundColorPicker() {
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
        top: spacing.lg,
        right: spacing.lg,
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
      />
    </View>
  );
}
