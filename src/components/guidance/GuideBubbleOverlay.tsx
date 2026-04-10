import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../theme/AppThemeProvider";

type GuidePlacement = "top" | "bottom" | "left" | "right";

interface GuideBubbleOverlayProps {
  visible: boolean;
  title: string;
  body: string;
  stepLabel?: string;
  actionLabel?: string;
  onDismiss: () => void;
  top?: number;
  pointerPlacement?: GuidePlacement;
  pointerOffset?: number;
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
    width: 14,
    height: 14,
    overflow: "hidden" as const,
    backgroundColor: "transparent",
  };

  const diamondBase = {
    position: "absolute" as const,
    width: 14,
    height: 14,
    backgroundColor: surfaceBg,
    borderWidth: 1,
    borderColor: surfaceBorder,
    transform: [{ rotate: "45deg" }],
  };

  switch (placement) {
    case "top":
      return (
        <View pointerEvents="none" style={[wrapperBase, { bottom: -14, left: offset }]}>
          <View style={[diamondBase, { top: -7, left: 0 }]} />
        </View>
      );
    case "bottom":
      return (
        <View pointerEvents="none" style={[wrapperBase, { top: -14, left: offset }]}>
          <View style={[diamondBase, { top: 7, left: 0 }]} />
        </View>
      );
    case "left":
      return (
        <View pointerEvents="none" style={[wrapperBase, { right: -14, top: offset }]}>
          <View style={[diamondBase, { top: 0, left: -7 }]} />
        </View>
      );
    case "right":
      return (
        <View pointerEvents="none" style={[wrapperBase, { left: -14, top: offset }]}>
          <View style={[diamondBase, { top: 0, left: 7 }]} />
        </View>
      );
  }
}

export default function GuideBubbleOverlay({
  visible,
  title,
  body,
  stepLabel,
  actionLabel = "Got it",
  onDismiss,
  top = 108,
  pointerPlacement = "bottom",
  pointerOffset = 232,
}: GuideBubbleOverlayProps) {
  const { colors } = useAppTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onDismiss}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.overlay,
          }}
        />

        <View
          style={{
            position: "absolute",
            top,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              alignSelf: "center",
              backgroundColor: colors.guideSurface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.guideBorder,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 14,
              shadowColor: "#000",
              shadowOpacity: 0.32,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 12 },
              elevation: 8,
            }}
          >
            <Pointer
              placement={pointerPlacement}
              offset={pointerOffset}
              surfaceBg={colors.guideSurface}
              surfaceBorder={colors.guideBorder}
            />

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              {stepLabel ? (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "rgba(255,255,255,0.48)",
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    flex: 1,
                  }}
                >
                  {stepLabel}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <Pressable onPress={onDismiss} hitSlop={10}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.62)" />
              </Pressable>
            </View>

            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.guideTextPrimary, marginBottom: 8 }}>
              {title}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.guideTextSecondary, marginBottom: 14 }}>
              {body}
            </Text>
            <View style={{ alignItems: "flex-start" }}>
              <Pressable
                onPress={onDismiss}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 11,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.white }}>
                  {actionLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
