import { useExperimentalFeaturesStore } from "../../state/experimentalFeaturesStore";

export interface GenerateRoomInput {
  prompt: string;
  orientation?: "landscape" | "portrait";
  referenceImageUri?: string | null;
}

export interface GeneratedRoomResult {
  imageUri: string;
  provider: "placeholder";
  metadata: {
    prompt: string;
    orientation: NonNullable<GenerateRoomInput["orientation"]>;
    generatedAt: string;
  };
}

export async function generateRoom({
  prompt,
  orientation = "landscape",
}: GenerateRoomInput): Promise<GeneratedRoomResult> {
  const { entitlements, featureToggles, incrementAIRoomsGenerated } =
    useExperimentalFeaturesStore.getState();

  if (!entitlements.canGenerateAIRooms || !featureToggles.aiRoomGeneration) {
    throw new Error("AI Room Generation is not available yet.");
  }

  incrementAIRoomsGenerated();

  return {
    imageUri: "",
    provider: "placeholder",
    metadata: {
      prompt,
      orientation,
      generatedAt: new Date().toISOString(),
    },
  };
}
