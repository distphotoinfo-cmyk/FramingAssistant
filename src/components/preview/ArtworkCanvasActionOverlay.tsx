import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../theme/AppThemeProvider";
import GuidanceAnchor from "../guidance/GuidanceAnchor";

type ArtworkCanvasActionOverlayProps = {
  label: string;
  guidanceId?: string;
  compact?: boolean;
  cornerInset?: number;
  onPress: () => void;
};

export default function ArtworkCanvasActionOverlay({
  label,
  guidanceId,
  compact = false,
  cornerInset,
  onPress,
}: ArtworkCanvasActionOverlayProps) {
  const { colors, spacing } = useAppTheme();
  const resolvedCornerInset = cornerInset ?? spacing.xl;
  const containerStyle = {
    position: "absolute" as const,
    right: resolvedCornerInset,
    bottom: resolvedCornerInset,
    zIndex: 6,
  };
  const button = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: pressed ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.66)",
        paddingHorizontal: compact ? spacing.sm : spacing.md,
        paddingVertical: compact ? 6 : spacing.sm,
      })}
    >
      <Ionicons name="image-outline" size={compact ? 15 : 16} color={colors.white} />
      <Text style={{ fontSize: compact ? 13 : 14, fontWeight: "600", color: colors.white }}>
        {label}
      </Text>
    </Pressable>
  );

  if (guidanceId) {
    return (
      <GuidanceAnchor id={guidanceId} style={containerStyle}>
        {button}
      </GuidanceAnchor>
    );
  }

  return <View style={containerStyle}>{button}</View>;
}
