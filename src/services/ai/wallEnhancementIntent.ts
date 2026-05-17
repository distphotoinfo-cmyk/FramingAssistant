import type {
  AIWallEnhancementIntent,
  AIWallEnhancementMode,
} from "../../types/framing";

export type ResolvedAIWallEnhancementIntent = AIWallEnhancementIntent;

export interface AIWallEnhancementSettings extends Partial<AIWallEnhancementIntent> {
  preservePerspective?: boolean;
  preserveScaleReferences?: boolean;
  cleanupWallMarks?: boolean;
  balanceLighting?: boolean;
}

export const AI_WALL_ENHANCEMENT_GOAL =
  "Improve the real wall photo while preserving geometry and object scale.";

export const DEFAULT_AI_WALL_ENHANCEMENT_INTENT: ResolvedAIWallEnhancementIntent = {
  preserveGeometry: true,
  preserveScaleRelationships: true,
  preserveReferenceObjects: true,
  preservePerspectiveConsistency: true,
  preserveWallCalibration: true,
  cleanupLighting: true,
  cleanupNoise: true,
  mildPerspectiveCorrection: false,
};

export const AI_WALL_ENHANCEMENT_PIPELINE_PLAN = [
  {
    id: "perspectiveCleanup",
    status: "planned",
    description:
      "Detect wall plane and apply only calibration-safe correction when it will not distort scale references.",
  },
  {
    id: "lightingCleanup",
    status: "planned",
    description:
      "Normalize uneven lighting and color casts while preserving the original room and wall geometry.",
  },
  {
    id: "detailEnhancement",
    status: "prototype",
    description:
      "Current Real-ESRGAN prototype improves image detail after server-side resizing, but does not understand room geometry.",
  },
] as const;

function resolveBoolean(
  value: boolean | undefined,
  fallback: boolean
) {
  return value === undefined ? fallback : value;
}

export function resolveAIWallEnhancementIntent(
  settings: AIWallEnhancementSettings | undefined,
  enhancementMode: AIWallEnhancementMode
): ResolvedAIWallEnhancementIntent {
  const cleanupLighting = resolveBoolean(
    settings?.cleanupLighting ?? settings?.balanceLighting,
    DEFAULT_AI_WALL_ENHANCEMENT_INTENT.cleanupLighting
  );
  const cleanupNoise = resolveBoolean(
    settings?.cleanupNoise ?? settings?.cleanupWallMarks,
    DEFAULT_AI_WALL_ENHANCEMENT_INTENT.cleanupNoise
  );

  return {
    preserveGeometry: resolveBoolean(
      settings?.preserveGeometry,
      DEFAULT_AI_WALL_ENHANCEMENT_INTENT.preserveGeometry
    ),
    preserveScaleRelationships: resolveBoolean(
      settings?.preserveScaleRelationships ?? settings?.preserveScaleReferences,
      DEFAULT_AI_WALL_ENHANCEMENT_INTENT.preserveScaleRelationships
    ),
    preserveReferenceObjects: resolveBoolean(
      settings?.preserveReferenceObjects ?? settings?.preserveScaleReferences,
      DEFAULT_AI_WALL_ENHANCEMENT_INTENT.preserveReferenceObjects
    ),
    preservePerspectiveConsistency: resolveBoolean(
      settings?.preservePerspectiveConsistency ?? settings?.preservePerspective,
      DEFAULT_AI_WALL_ENHANCEMENT_INTENT.preservePerspectiveConsistency
    ),
    preserveWallCalibration: resolveBoolean(
      settings?.preserveWallCalibration,
      DEFAULT_AI_WALL_ENHANCEMENT_INTENT.preserveWallCalibration
    ),
    cleanupLighting,
    cleanupNoise,
    mildPerspectiveCorrection: resolveBoolean(
      settings?.mildPerspectiveCorrection,
      enhancementMode === "perspectiveAssist"
    ),
  };
}

export function buildAIWallEnhancementSettings(
  settings: AIWallEnhancementSettings | undefined,
  enhancementMode: AIWallEnhancementMode
): AIWallEnhancementSettings {
  const intent = resolveAIWallEnhancementIntent(settings, enhancementMode);

  return {
    ...intent,
    preservePerspective: intent.preservePerspectiveConsistency,
    preserveScaleReferences:
      intent.preserveScaleRelationships && intent.preserveReferenceObjects,
    cleanupWallMarks: intent.cleanupNoise,
    balanceLighting: intent.cleanupLighting,
  };
}
