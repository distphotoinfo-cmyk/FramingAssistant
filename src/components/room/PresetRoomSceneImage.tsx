import React from "react";
import {
  Image,
  View,
  type ImageResizeMode,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { RegisteredRoomPresetScene } from "../../data/presetRoomScenes";

export default function PresetRoomSceneImage({
  scene,
  resizeMode = "stretch",
  style,
}: {
  scene: RegisteredRoomPresetScene;
  resizeMode?: ImageResizeMode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={style}>
      <Image
        source={scene.imageSource}
        resizeMode={resizeMode}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </View>
  );
}
