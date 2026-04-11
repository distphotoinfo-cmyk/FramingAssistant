import React from "react";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

export type GuidePlacement = "top" | "bottom" | "left" | "right";

interface GuideBubbleProps {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  pointerPlacement: GuidePlacement;
  pointerOffset: number;
  width?: number;
  accentColor?: string;
  accentText?: string;
}

function Pointer({
  placement,
  offset,
  surfaceBg,
  surfaceBorder,
}: {
  placement: GuidePlacement;
  offset: number;
  surfaceBg: string;
  surfaceBorder: string;
}) {
  const wrapperBase = {
    position: "absolute" as const,
    width: 12,
    height: 12,
    overflow: "hidden" as const,
    backgroundColor: "transparent",
  };

  const diamondBase = {
    position: "absolute" as const,
    width: 12,
    height: 12,
    backgroundColor: surfaceBg,
    borderWidth: 1,
    borderColor: surfaceBorder,
    transform: [{ rotate: "45deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  };

  switch (placement) {
    case "top":
      return (
        <View pointerEvents="none" style={[wrapperBase, { bottom: -12, left: offset }]}>
          <View style={[diamondBase, { top: -6, left: 0 }]} />
        </View>
      );
    case "bottom":
      return (
        <View pointerEvents="none" style={[wrapperBase, { top: -12, left: offset }]}>
          <View style={[diamondBase, { top: 6, left: 0 }]} />
        </View>
      );
    case "left":
      return (
        <View pointerEvents="none" style={[wrapperBase, { right: -12, top: offset }]}>
          <View style={[diamondBase, { top: 0, left: -6 }]} />
        </View>
      );
    case "right":
      return (
        <View pointerEvents="none" style={[wrapperBase, { left: -12, top: offset }]}>
          <View style={[diamondBase, { top: 0, left: 6 }]} />
        </View>
      );
  }
}

export default function GuideBubble({
  text,
  actionLabel,
  onAction,
  onClose,
  pointerPlacement,
  pointerOffset,
  width = 230,
  accentColor,
  accentText,
}: GuideBubbleProps) {
  const { colors, radii } = useAppTheme();
  const hasCloseButton = Boolean(onClose);
  const hasAction = Boolean(actionLabel && onAction);
  const actionBg = accentColor ?? colors.accent;
  const actionTextColor = accentText ?? colors.white;

  return (
    <View
      style={{
        width,
        backgroundColor: colors.guideSurface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.guideBorder,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 14,
        shadowColor: "#000",
        shadowOpacity: 0.34,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 9,
      }}
    >
      <Pointer
        placement={pointerPlacement}
        offset={pointerOffset}
        surfaceBg={colors.guideSurface}
        surfaceBorder={colors.guideBorder}
      />
      <View style={{ width: "100%", alignSelf: "stretch", paddingHorizontal: 8 }}>
        {hasCloseButton ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.guideTextSecondary }}>
              {text}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={{ padding: 2 }}>
              <Text style={{ fontSize: 14, lineHeight: 16, color: "rgba(255,255,255,0.55)" }}>x</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.guideTextSecondary, textAlign: "left" }}>
            {text}
          </Text>
        )}
        {hasAction ? (
          <View style={{ width: "100%", alignItems: "flex-start" }}>
            <Pressable
              onPress={onAction}
              style={{
                marginTop: 14,
                minHeight: 40,
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: radii.md,
                backgroundColor: actionBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: actionTextColor }}>
                {actionLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
