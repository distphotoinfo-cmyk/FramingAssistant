import { useExperimentalFeaturesStore } from "../../state/experimentalFeaturesStore";
import type { AIWallEnhancementMode } from "../../types/framing";
import {
  AIBackendProvider,
  type AIWallEnhancementSettings,
} from "./providers/backend";

export interface EnhanceWallPhotoInput {
  imageUri: string;
  enhancementMode?: AIWallEnhancementMode;
  settings?: AIWallEnhancementSettings;
}

export interface EnhanceWallPhotoResult {
  imageUri: string;
  provider: "backend" | "replicate";
  metadata: {
    enhancementMode: NonNullable<EnhanceWallPhotoInput["enhancementMode"]>;
    enhancedAt: string;
    displayAdjustments?: {
      brightness?: number;
      warmth?: number;
      contrast?: number;
    };
    model?: string;
    predictionId?: string;
  };
}

export async function enhanceWallPhoto({
  imageUri,
  enhancementMode = "cleanWall",
  settings,
}: EnhanceWallPhotoInput): Promise<EnhanceWallPhotoResult> {
  const { entitlements, featureToggles, incrementAIWallEnhancementsUsed } =
    useExperimentalFeaturesStore.getState();

  if (!entitlements.canUseAIWallEnhancement || !featureToggles.aiWallEnhancement) {
    throw new Error("AI Wall Enhancement is not enabled.");
  }

  const provider = new AIBackendProvider();
  const result = await provider.enhanceWallPhoto({
    imageUri,
    enhancementMode,
    settings,
  });

  incrementAIWallEnhancementsUsed();

  return {
    imageUri: result.imageUri,
    provider: result.provider ?? "backend",
    metadata: {
      enhancementMode,
      enhancedAt: new Date().toISOString(),
      displayAdjustments: result.metadata?.displayAdjustments,
      model: result.metadata?.model,
      predictionId: result.metadata?.predictionId,
    },
  };
}
