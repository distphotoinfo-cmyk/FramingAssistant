import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppSettingsStore, type GuideTipKey } from "../../state/appSettingsStore";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface CompactGuideTipProps {
  tipKey: GuideTipKey;
  title: string;
  body: string;
}

export default function CompactGuideTip({ tipKey, title, body }: CompactGuideTipProps) {
  const { colors, radii, spacing } = useAppTheme();
  const dismissed = useAppSettingsStore((state) => Boolean(state.dismissedGuideTips[tipKey]));
  const dismissGuideTip = useAppSettingsStore((state) => state.dismissGuideTip);

  if (dismissed) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.guideSurface,
        borderWidth: 1,
        borderColor: colors.guideBorder,
        borderRadius: radii.xl,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.guideTextPrimary,
                marginLeft: 8,
                letterSpacing: 0.2,
              }}
            >
              {title}
            </Text>
          </View>
          <Text style={{ fontSize: 13, lineHeight: 18, color: colors.guideTextSecondary }}>
            {body}
          </Text>
        </View>

        <Pressable onPress={() => dismissGuideTip(tipKey)} hitSlop={10} style={{ paddingTop: 2 }}>
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.62)" />
        </Pressable>
      </View>
    </View>
  );
}
