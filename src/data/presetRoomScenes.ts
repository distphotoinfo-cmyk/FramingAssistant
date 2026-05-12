import type { ImageSourcePropType } from "react-native";
import type { RoomPresetScene, RoomPresetSceneOrientation } from "../types/framing";

const landscapeLivingRoomMetadata = require("../../assets/mockups/landscape/Calm and cozy modern living room.json") as RoomPresetScene;
const portraitLivingRoomMetadata = require("../../assets/mockups/portrait/Serene minimalist living room interior.json") as RoomPresetScene;

export type RegisteredRoomPresetScene = RoomPresetScene & {
  imageSource: ImageSourcePropType;
};

export const DEFAULT_PRESET_ROOM_SCENE_ID = landscapeLivingRoomMetadata.id;

export const PRESET_ROOM_SCENES: RegisteredRoomPresetScene[] = [
  {
    ...landscapeLivingRoomMetadata,
    imageSource: require("../../assets/mockups/landscape/Calm and cozy modern living room.png"),
  },
  {
    ...portraitLivingRoomMetadata,
    imageSource: require("../../assets/mockups/portrait/Serene minimalist living room interior.png"),
  },
];

export const ROOM_SCENE_ORIENTATION_LABELS: Record<RoomPresetSceneOrientation, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
};

export function getPresetRoomSceneById(sceneId: string | null | undefined) {
  return PRESET_ROOM_SCENES.find((scene) => scene.id === sceneId) ?? PRESET_ROOM_SCENES[0];
}

export function getPresetRoomScenesByOrientation(orientation: RoomPresetSceneOrientation) {
  return PRESET_ROOM_SCENES.filter((scene) => scene.orientation === orientation);
}
