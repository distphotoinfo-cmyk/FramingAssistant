import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "../theme/AppThemeProvider";

interface AppHeaderProps {
  onOpenProjects: () => void;
  onOpenSettings: () => void;
}

export default function AppHeader({ onOpenProjects, onOpenSettings }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const trigger = (callback: () => void) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    callback();
  };

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.headerBackground,
      }}
    >
      <View
        style={{
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 10,
          paddingBottom: 14,
          paddingHorizontal: 16,
          position: "relative",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            flexDirection: "row",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          <Pressable onPress={() => trigger(onOpenProjects)} style={{ padding: 6 }} hitSlop={8}>
            <Ionicons name="folder-open-outline" size={20} color={colors.headerText} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => trigger(onOpenSettings)}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: 6,
            zIndex: 10,
          }}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={20} color={colors.headerText} />
        </Pressable>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("../../assets/icons/framing-icon.png")}
            style={{
              width: 30,
              height: 30,
              marginRight: 7,
              alignSelf: "center",
            }}
            resizeMode="contain"
          />
          <View
            style={{
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                lineHeight: 12,
                fontWeight: "600",
                letterSpacing: 1.8,
                textTransform: "uppercase",
                color: colors.headerText,
              }}
            >
              Framing
            </Text>
            <Text
              style={{
                fontSize: 11,
                lineHeight: 12,
                fontWeight: "600",
                letterSpacing: 1.8,
                textTransform: "uppercase",
                color: colors.headerText,
                marginTop: 1,
              }}
            >
              Assistant
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
