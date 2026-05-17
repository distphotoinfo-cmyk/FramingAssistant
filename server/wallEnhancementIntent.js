const WALL_ENHANCEMENT_GOAL =
  "Improve the real wall photo while preserving geometry and object scale.";

const DEFAULT_WALL_ENHANCEMENT_INTENT = {
  preserveGeometry: true,
  preserveScaleRelationships: true,
  preserveReferenceObjects: true,
  preservePerspectiveConsistency: true,
  preserveWallCalibration: true,
  cleanupLighting: true,
  cleanupNoise: true,
  mildPerspectiveCorrection: false,
};

const WALL_ENHANCEMENT_PIPELINE_PLAN = [
  {
    id: "perspectiveCleanup",
    status: "planned",
    enabled: false,
    description:
      "Analyze wall plane and apply only calibration-safe correction when it will not distort scale references.",
  },
  {
    id: "lightingCleanup",
    status: "planned",
    enabled: false,
    description:
      "Normalize uneven lighting and color casts while preserving room geometry, furniture, trim, windows, doors, and reference objects.",
  },
  {
    id: "detailEnhancement",
    status: "prototype",
    enabled: true,
    description:
      "Current Real-ESRGAN prototype improves image detail after server-side resizing, but does not understand room geometry.",
  },
];

function resolveBoolean(value, fallback) {
  return value === undefined ? fallback : Boolean(value);
}

function normalizeWallEnhancementIntent(settings = {}, enhancementMode = "cleanWall") {
  return {
    preserveGeometry: resolveBoolean(
      settings.preserveGeometry,
      DEFAULT_WALL_ENHANCEMENT_INTENT.preserveGeometry
    ),
    preserveScaleRelationships: resolveBoolean(
      settings.preserveScaleRelationships ?? settings.preserveScaleReferences,
      DEFAULT_WALL_ENHANCEMENT_INTENT.preserveScaleRelationships
    ),
    preserveReferenceObjects: resolveBoolean(
      settings.preserveReferenceObjects ?? settings.preserveScaleReferences,
      DEFAULT_WALL_ENHANCEMENT_INTENT.preserveReferenceObjects
    ),
    preservePerspectiveConsistency: resolveBoolean(
      settings.preservePerspectiveConsistency ?? settings.preservePerspective,
      DEFAULT_WALL_ENHANCEMENT_INTENT.preservePerspectiveConsistency
    ),
    preserveWallCalibration: resolveBoolean(
      settings.preserveWallCalibration,
      DEFAULT_WALL_ENHANCEMENT_INTENT.preserveWallCalibration
    ),
    cleanupLighting: resolveBoolean(
      settings.cleanupLighting ?? settings.balanceLighting,
      DEFAULT_WALL_ENHANCEMENT_INTENT.cleanupLighting
    ),
    cleanupNoise: resolveBoolean(
      settings.cleanupNoise ?? settings.cleanupWallMarks,
      DEFAULT_WALL_ENHANCEMENT_INTENT.cleanupNoise
    ),
    mildPerspectiveCorrection: resolveBoolean(
      settings.mildPerspectiveCorrection,
      enhancementMode === "perspectiveAssist"
    ),
  };
}

function buildWallEnhancementSettings(settings = {}, enhancementMode = "cleanWall") {
  const intent = normalizeWallEnhancementIntent(settings, enhancementMode);

  return {
    ...intent,
    preservePerspective: intent.preservePerspectiveConsistency,
    preserveScaleReferences:
      intent.preserveScaleRelationships && intent.preserveReferenceObjects,
    cleanupWallMarks: intent.cleanupNoise,
    balanceLighting: intent.cleanupLighting,
  };
}

function buildWallEnhancementPrompt({
  enhancementMode = "cleanWall",
  intent = DEFAULT_WALL_ENHANCEMENT_INTENT,
} = {}) {
  const constraints = [
    WALL_ENHANCEMENT_GOAL,
    "Do not redesign, restyle, stage, or generate a different room.",
    "Do not hallucinate missing furniture, walls, windows, doors, trim, outlets, artwork, or decor.",
    "Keep wall proportions, object scale, furniture placement, windows, doors, trim, and camera perspective relationships intact.",
    "Preserve reference objects used for calibration, including 8.5 x 11 paper or A4 paper, with the same visible proportions.",
  ];

  const cleanupGoals = [];

  if (intent.cleanupLighting) {
    cleanupGoals.push("Gently even out lighting and color casts without changing the room.");
  }

  if (intent.cleanupNoise) {
    cleanupGoals.push("Reduce sensor noise, compression artifacts, and minor wall blemishes naturally.");
  }

  if (intent.mildPerspectiveCorrection) {
    cleanupGoals.push(
      "Apply only mild perspective cleanup that keeps calibration and scale relationships trustworthy."
    );
  } else {
    cleanupGoals.push("Do not warp or reshape the wall plane.");
  }

  if (enhancementMode === "relight") {
    cleanupGoals.push("Prioritize believable lighting cleanup over detail enhancement.");
  }

  if (enhancementMode === "perspectiveAssist") {
    cleanupGoals.push("Keep perspective correction subtle and calibration-safe.");
  }

  return `${constraints.join(" ")} ${cleanupGoals.join(" ")}`;
}

module.exports = {
  WALL_ENHANCEMENT_GOAL,
  DEFAULT_WALL_ENHANCEMENT_INTENT,
  WALL_ENHANCEMENT_PIPELINE_PLAN,
  buildWallEnhancementPrompt,
  buildWallEnhancementSettings,
  normalizeWallEnhancementIntent,
};
