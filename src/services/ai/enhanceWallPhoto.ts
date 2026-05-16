import { useExperimentalFeaturesStore } from "../../state/experimentalFeaturesStore";

export interface EnhanceWallPhotoInput {
  imageUri: string;
  enhancementMode?: "cleanWall" | "relight" | "perspectiveAssist";
}

export interface EnhanceWallPhotoResult {
  imageUri: string;
  provider: "placeholder";
  metadata: {
    enhancementMode: NonNullable<EnhanceWallPhotoInput["enhancementMode"]>;
    enhancedAt: string;
  };
}

export async function enhanceWallPhoto({
  imageUri,
  enhancementMode = "cleanWall",
}: EnhanceWallPhotoInput): Promise<EnhanceWallPhotoResult> {
  const { entitlements, featureToggles, incrementAIWallEnhancementsUsed } =
    useExperimentalFeaturesStore.getState();

  if (!entitlements.canUseAIWallEnhancement || !featureToggles.aiWallEnhancement) {
    throw new Error("AI Wall Enhancement is not enabled.");
  }

  incrementAIWallEnhancementsUsed();

  return {
    imageUri,
    provider: "placeholder",
    metadata: {
      enhancementMode,
      enhancedAt: new Date().toISOString(),
    },
  };
}
