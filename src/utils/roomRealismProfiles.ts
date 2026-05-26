import type {
  RoomPresetScene,
  RoomSceneLightingDirection,
  RoomSceneLightingZone,
  RoomViewPoint,
  RoomViewSourceMode,
} from "../types/framing";

export type RoomRealismProfileId =
  | "brightLivingRoom"
  | "warmLampDarkWall"
  | "coolIndustrialGallery"
  | "softNeutralGallery"
  | "myWallNeutral";

export interface RoomRealismSliderLimit {
  min: number;
  max: number;
  step: number;
}

export interface RoomRealismSliderLimits {
  shadowStrength: RoomRealismSliderLimit;
  shadowSoftness: RoomRealismSliderLimit;
  shadowDistance: RoomRealismSliderLimit;
  frameDepth: RoomRealismSliderLimit;
  matBevelDepth: RoomRealismSliderLimit;
  matBevelSoftness: RoomRealismSliderLimit;
  innerLipContrast: RoomRealismSliderLimit;
  artworkBrightness: RoomRealismSliderLimit;
  reflectionStrength: RoomRealismSliderLimit;
}

export interface RoomRealismShadowProfile {
  direction: RoomViewPoint;
  strength: number;
  softness: number;
  distance: number;
  offsetX: number;
  offsetY: number;
}

export interface RoomRealismMaterialProfile {
  frameDepth: number;
  matBevelDepth: number;
  matBevelSoftness: number;
  innerLipContrast: number;
  artworkBrightness: number;
  glassEnabled: boolean;
  reflectionStrength: number;
}

export interface ResolvedRoomRealismProfile {
  profileId: RoomRealismProfileId;
  sourceMode: RoomViewSourceMode;
  isRoomDriven: boolean;
  sceneId: string | null;
  shadow: RoomRealismShadowProfile;
  material: RoomRealismMaterialProfile;
  sliderLimits: RoomRealismSliderLimits;
  metadataSignals: {
    wallBrightness: number;
    warmth: number;
    ambientLight: number;
    contrast: number;
    edgeBlend: number;
    lightingDirection: RoomSceneLightingDirection | null;
    positiveLightingZoneCount: number;
    negativeLightingZoneCount: number;
  };
}

interface RoomRealismProfilePreset {
  shadowStrength: number;
  shadowSoftness: number;
  shadowDistance: number;
  frameDepth: number;
  matBevelDepth: number;
  matBevelSoftness: number;
  innerLipContrast: number;
  artworkBrightness: number;
  glassEnabled: boolean;
  reflectionStrength: number;
  sliderLimits: RoomRealismSliderLimits;
}

interface RoomSceneRealismTuning {
  shadowStrength?: number;
  shadowSoftness?: number;
  shadowDistance?: number;
  shadowDirection?: RoomViewPoint;
  frameDepth?: number;
  matBevelDepth?: number;
  matBevelSoftness?: number;
  innerLipContrast?: number;
  artworkBrightness?: number;
  sliderLimits?: Partial<RoomRealismSliderLimits>;
}

const DEFAULT_WALL_BRIGHTNESS = 0.62;
const DEFAULT_WARMTH = 0;
const DEFAULT_AMBIENT_LIGHT = 0.6;
const DEFAULT_CONTRAST = 0.55;
const DEFAULT_EDGE_BLEND = 0.35;

const DEFAULT_SHADOW_DIRECTION: RoomViewPoint = { x: 0.58, y: 0.82 };

const BASE_SLIDER_LIMITS: RoomRealismSliderLimits = {
  shadowStrength: { min: 0, max: 0.82, step: 0.01 },
  shadowSoftness: { min: 0, max: 10, step: 1 },
  shadowDistance: { min: 0, max: 48, step: 1 },
  frameDepth: { min: 0.55, max: 1.55, step: 0.01 },
  matBevelDepth: { min: 0.35, max: 1.35, step: 0.01 },
  matBevelSoftness: { min: 0.25, max: 0.75, step: 0.01 },
  innerLipContrast: { min: 0.75, max: 1.75, step: 0.01 },
  artworkBrightness: { min: 0.9, max: 1.12, step: 0.01 },
  reflectionStrength: { min: 0, max: 0.38, step: 0.01 },
};

const RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS = {
  strength: 0.35,
  softness: 5.25,
  distance: 10.5,
};

const RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS = {
  frameDepth: 1,
  matBevelDepth: 0.8,
  matBevelSoftness: 0.475,
  innerLipContrast: 1.2,
  artworkBrightness: 0.95,
};

const PROFILE_PRESETS: Record<RoomRealismProfileId, RoomRealismProfilePreset> = {
  brightLivingRoom: {
    shadowStrength: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.strength,
    shadowSoftness: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.softness,
    shadowDistance: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.distance,
    frameDepth: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.frameDepth,
    matBevelDepth: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.matBevelDepth,
    matBevelSoftness: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.matBevelSoftness,
    innerLipContrast: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.innerLipContrast,
    artworkBrightness: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.artworkBrightness,
    glassEnabled: false,
    reflectionStrength: 0.12,
    sliderLimits: {
      ...BASE_SLIDER_LIMITS,
      shadowStrength: { min: 0, max: 0.74, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 0, max: 32, step: 1 },
    },
  },
  warmLampDarkWall: {
    shadowStrength: 0.34,
    shadowSoftness: 10,
    shadowDistance: 16,
    frameDepth: 1.08,
    matBevelDepth: 0.76,
    matBevelSoftness: 0.52,
    innerLipContrast: 1.22,
    artworkBrightness: 0.98,
    glassEnabled: false,
    reflectionStrength: 0.18,
    sliderLimits: {
      ...BASE_SLIDER_LIMITS,
      shadowStrength: { min: 0.04, max: 0.9, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 2, max: 36, step: 1 },
      reflectionStrength: { min: 0, max: 0.42, step: 0.01 },
    },
  },
  coolIndustrialGallery: {
    shadowStrength: 0.32,
    shadowSoftness: 10,
    shadowDistance: 14,
    frameDepth: 1.04,
    matBevelDepth: 0.7,
    matBevelSoftness: 0.46,
    innerLipContrast: 1.18,
    artworkBrightness: 1,
    glassEnabled: false,
    reflectionStrength: 0.16,
    sliderLimits: {
      ...BASE_SLIDER_LIMITS,
      shadowStrength: { min: 0.04, max: 0.84, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 0, max: 34, step: 1 },
      matBevelSoftness: { min: 0.2, max: 0.68, step: 0.01 },
    },
  },
  softNeutralGallery: {
    shadowStrength: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.strength,
    shadowSoftness: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.softness,
    shadowDistance: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.distance,
    frameDepth: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.frameDepth,
    matBevelDepth: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.matBevelDepth,
    matBevelSoftness: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.matBevelSoftness,
    innerLipContrast: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.innerLipContrast,
    artworkBrightness: RESIDENTIAL_LAUNCH_MATERIAL_DEFAULTS.artworkBrightness,
    glassEnabled: false,
    reflectionStrength: 0.13,
    sliderLimits: BASE_SLIDER_LIMITS,
  },
  myWallNeutral: {
    shadowStrength: 0.18,
    shadowSoftness: 6,
    shadowDistance: 10,
    frameDepth: 0.9,
    matBevelDepth: 0.55,
    matBevelSoftness: 0.48,
    innerLipContrast: 1.05,
    artworkBrightness: 1,
    glassEnabled: false,
    reflectionStrength: 0.1,
    sliderLimits: {
      ...BASE_SLIDER_LIMITS,
      shadowStrength: { min: 0, max: 0.74, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 0, max: 28, step: 1 },
    },
  },
};

const SCENE_REALISM_TUNING: Record<string, RoomSceneRealismTuning> = {
  "calm-cozy-modern-living-room-landscape": {
    shadowStrength: 0.25,
    shadowSoftness: 3.75,
    shadowDistance: 4.5,
    shadowDirection: { x: 0.86, y: 0.5 },
    frameDepth: 0.65,
    matBevelDepth: 0.8,
    matBevelSoftness: 0.475,
    innerLipContrast: 0.85,
    artworkBrightness: 0.95,
    sliderLimits: {
      shadowStrength: { min: 0, max: 0.5, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 0, max: 22, step: 1 },
    },
  },
  "serene-minimalist-interior-landscape": {
    shadowStrength: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.strength,
    shadowSoftness: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.softness,
    shadowDistance: RESIDENTIAL_LAUNCH_SHADOW_DEFAULTS.distance,
    sliderLimits: {
      shadowStrength: { min: 0, max: 0.5, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 0, max: 22, step: 1 },
    },
  },
  "minimalist-still-life-soft-lighting-landscape": {
    shadowStrength: 0.75,
    shadowSoftness: 11.25,
    shadowDistance: 22.5,
    frameDepth: 1.55,
    matBevelDepth: 0.8,
    matBevelSoftness: 0.475,
    innerLipContrast: 1.75,
    artworkBrightness: 0.9,
    sliderLimits: {
      shadowStrength: { min: 0, max: 0.75, step: 0.01 },
      shadowSoftness: { min: 0, max: 15, step: 1 },
      shadowDistance: { min: 0, max: 30, step: 1 },
    },
  },
  "minimalist-industrial-gallery-interior-landscape": {
    shadowStrength: 1,
    shadowSoftness: 6,
    shadowDistance: 15,
    shadowDirection: { x: 0, y: 1 },
    frameDepth: 1.55,
    matBevelDepth: 1.35,
    matBevelSoftness: 0.296,
    innerLipContrast: 1.75,
    artworkBrightness: 0.96,
    sliderLimits: {
      shadowStrength: { min: 0, max: 1, step: 0.01 },
      shadowSoftness: { min: 0, max: 15, step: 1 },
      shadowDistance: { min: 0, max: 30, step: 1 },
    },
  },
  "serene-minimalist-living-room-portrait": {
    shadowStrength: 0.25,
    shadowSoftness: 3,
    shadowDistance: 4.5,
    shadowDirection: { x: 0.53, y: 0.85 },
    frameDepth: 1,
    matBevelDepth: 0.8,
    matBevelSoftness: 0.475,
    innerLipContrast: 1.2,
    artworkBrightness: 0.96,
    sliderLimits: {
      shadowStrength: { min: 0, max: 0.5, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 0, max: 22, step: 1 },
    },
  },
  "serene-minimalist-sideboard-portrait": {
    shadowStrength: 0.35,
    shadowSoftness: 6,
    shadowDistance: 9,
    shadowDirection: { x: 0.53, y: 0.85 },
    frameDepth: 1,
    matBevelDepth: 0.8,
    matBevelSoftness: 0.475,
    innerLipContrast: 1.2,
    artworkBrightness: 0.95,
    sliderLimits: {
      shadowStrength: { min: 0, max: 0.52, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 0, max: 24, step: 1 },
    },
  },
  "modern-slate-interior-portrait": {
    shadowStrength: 0.4,
    shadowSoftness: 8.25,
    shadowDistance: 7.5,
    shadowDirection: { x: 0.53, y: 0.85 },
    frameDepth: 1.05,
    matBevelDepth: 0.7,
    matBevelSoftness: 0.488,
    innerLipContrast: 1.2,
    artworkBrightness: 0.96,
    sliderLimits: {
      shadowStrength: { min: 0, max: 0.6, step: 0.01 },
      shadowSoftness: { min: 0, max: 10, step: 1 },
      shadowDistance: { min: 0, max: 24, step: 1 },
    },
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveNumber(value: number | undefined, fallback: number, min: number, max: number) {
  return clamp(typeof value === "number" && Number.isFinite(value) ? value : fallback, min, max);
}

function clampToLimit(value: number, limit: RoomRealismSliderLimit) {
  return clamp(value, limit.min, limit.max);
}

function getSceneRealismTuning(scene: RoomPresetScene | null | undefined) {
  return scene?.id ? SCENE_REALISM_TUNING[scene.id] ?? null : null;
}

function resolveSliderLimits(
  preset: RoomRealismProfilePreset,
  sceneTuning: RoomSceneRealismTuning | null
): RoomRealismSliderLimits {
  return {
    ...preset.sliderLimits,
    ...(sceneTuning?.sliderLimits ?? {}),
  };
}

function normalizeDirection(direction: RoomViewPoint): RoomViewPoint {
  const length = Math.hypot(direction.x, direction.y);

  if (length <= 0.001) {
    return DEFAULT_SHADOW_DIRECTION;
  }

  return {
    x: direction.x / length,
    y: direction.y / length,
  };
}

function getShadowDirectionFromLightingDirection(
  lightingDirection: RoomSceneLightingDirection | null | undefined
) {
  switch (lightingDirection) {
    case "left":
      return normalizeDirection({ x: 1, y: 0.36 });
    case "right":
      return normalizeDirection({ x: -1, y: 0.36 });
    case "upperLeft":
      return normalizeDirection({ x: 0.56, y: 0.83 });
    case "upperRight":
      return normalizeDirection({ x: -0.56, y: 0.83 });
    case "center":
      return normalizeDirection({ x: 0, y: 1 });
    default:
      return DEFAULT_SHADOW_DIRECTION;
  }
}

function getShadowDirection(scene: RoomPresetScene | null | undefined) {
  const defaultShadow = scene?.defaultShadow;
  const defaultShadowDistance = defaultShadow
    ? Math.hypot(defaultShadow.offsetX, defaultShadow.offsetY)
    : 0;

  if (defaultShadow && defaultShadowDistance > 0.1) {
    return normalizeDirection({
      x: defaultShadow.offsetX,
      y: defaultShadow.offsetY,
    });
  }

  return getShadowDirectionFromLightingDirection(scene?.lightingDirection);
}

function countLightingZones(zones: RoomSceneLightingZone[] | null | undefined, isPositive: boolean) {
  return (
    zones?.filter((zone) => {
      const intensity = typeof zone.intensity === "number" ? zone.intensity : 0;

      return isPositive ? intensity > 0.001 : intensity < -0.001;
    }).length ?? 0
  );
}

function getPositiveLightingIntensity(zones: RoomSceneLightingZone[] | null | undefined) {
  return (
    zones?.reduce((sum, zone) => {
      const intensity = typeof zone.intensity === "number" ? zone.intensity : 0;

      return intensity > 0 ? sum + intensity : sum;
    }, 0) ?? 0
  );
}

function resolveMetadataSignals(scene: RoomPresetScene | null | undefined) {
  const environment = scene?.environment;

  return {
    wallBrightness: resolveNumber(environment?.wallBrightness, DEFAULT_WALL_BRIGHTNESS, 0, 1),
    warmth: resolveNumber(environment?.warmth, DEFAULT_WARMTH, -1, 1),
    ambientLight: resolveNumber(environment?.ambientLight, DEFAULT_AMBIENT_LIGHT, 0, 1),
    contrast: resolveNumber(environment?.contrast, DEFAULT_CONTRAST, 0, 1),
    edgeBlend: resolveNumber(environment?.edgeBlend, DEFAULT_EDGE_BLEND, 0, 1),
    lightingDirection: scene?.lightingDirection ?? null,
    positiveLightingZoneCount: countLightingZones(scene?.sceneLightingZones, true),
    negativeLightingZoneCount: countLightingZones(scene?.sceneLightingZones, false),
  };
}

function chooseRoomRealismProfileId(
  scene: RoomPresetScene | null | undefined,
  sourceMode: RoomViewSourceMode,
  metadata: ReturnType<typeof resolveMetadataSignals>
): RoomRealismProfileId {
  if (sourceMode === "myWall") {
    return "myWallNeutral";
  }

  const sceneText = `${scene?.id ?? ""} ${scene?.title ?? ""}`.toLowerCase();

  if (
    sceneText.includes("industrial") ||
    metadata.positiveLightingZoneCount >= 3 ||
    (metadata.warmth < -0.18 && metadata.wallBrightness < 0.5)
  ) {
    return "coolIndustrialGallery";
  }

  if (metadata.wallBrightness < 0.5 && metadata.warmth > 0.18) {
    return "warmLampDarkWall";
  }

  if (metadata.wallBrightness > 0.66 && metadata.ambientLight > 0.62) {
    return "brightLivingRoom";
  }

  return "softNeutralGallery";
}

function resolveShadowProfile(
  scene: RoomPresetScene | null | undefined,
  preset: RoomRealismProfilePreset,
  metadata: ReturnType<typeof resolveMetadataSignals>,
  sliderLimits: RoomRealismSliderLimits,
  sceneTuning: RoomSceneRealismTuning | null
): RoomRealismShadowProfile {
  const defaultShadow = scene?.defaultShadow;
  const defaultDistance = defaultShadow
    ? Math.hypot(defaultShadow.offsetX, defaultShadow.offsetY)
    : preset.shadowDistance;
  const darkness = 1 - metadata.wallBrightness;
  const direction = sceneTuning?.shadowDirection
    ? normalizeDirection(sceneTuning.shadowDirection)
    : getShadowDirection(scene);
  const strength = clampToLimit(
    sceneTuning?.shadowStrength ??
      ((defaultShadow?.opacity ?? preset.shadowStrength) +
        (darkness - 0.38) * 0.08 +
        (metadata.contrast - 0.55) * 0.06 -
        (metadata.ambientLight - 0.6) * 0.04),
    sliderLimits.shadowStrength
  );
  const softness = clampToLimit(
    sceneTuning?.shadowSoftness ??
      ((defaultShadow?.blurRadius ?? preset.shadowSoftness) +
        metadata.edgeBlend * 4 +
        Math.max(0, metadata.ambientLight - 0.6) * 8),
    sliderLimits.shadowSoftness
  );
  const distance = clampToLimit(
    sceneTuning?.shadowDistance ??
      (defaultDistance + (darkness - 0.38) * 5 + (metadata.contrast - 0.55) * 4),
    sliderLimits.shadowDistance
  );

  return {
    direction,
    strength,
    softness,
    distance,
    offsetX: direction.x * distance,
    offsetY: direction.y * distance,
  };
}

function resolveMaterialProfile(
  preset: RoomRealismProfilePreset,
  metadata: ReturnType<typeof resolveMetadataSignals>,
  lightingZoneIntensity: number,
  sliderLimits: RoomRealismSliderLimits,
  sceneTuning: RoomSceneRealismTuning | null
): RoomRealismMaterialProfile {
  const darkness = 1 - metadata.wallBrightness;
  const contrastLift = metadata.contrast - DEFAULT_CONTRAST;

  return {
    frameDepth: clampToLimit(
      sceneTuning?.frameDepth ??
        (preset.frameDepth + Math.max(0, darkness - 0.38) * 0.1 + contrastLift * 0.08),
      sliderLimits.frameDepth
    ),
    matBevelDepth: clampToLimit(
      sceneTuning?.matBevelDepth ??
        (preset.matBevelDepth + Math.max(0, darkness - 0.38) * 0.08 + contrastLift * 0.12),
      sliderLimits.matBevelDepth
    ),
    matBevelSoftness: clampToLimit(
      sceneTuning?.matBevelSoftness ??
        (preset.matBevelSoftness +
          metadata.edgeBlend * 0.03 -
          Math.max(0, metadata.contrast - 0.7) * 0.04),
      sliderLimits.matBevelSoftness
    ),
    innerLipContrast: clampToLimit(
      sceneTuning?.innerLipContrast ??
        (preset.innerLipContrast + Math.max(0, darkness - 0.4) * 0.12 + contrastLift * 0.12),
      sliderLimits.innerLipContrast
    ),
    artworkBrightness: clampToLimit(
      sceneTuning?.artworkBrightness ??
        (preset.artworkBrightness +
          (metadata.ambientLight - DEFAULT_AMBIENT_LIGHT) * 0.04 +
          lightingZoneIntensity * 0.03),
      sliderLimits.artworkBrightness
    ),
    glassEnabled: preset.glassEnabled,
    reflectionStrength: clampToLimit(
      preset.reflectionStrength +
        Math.max(0, metadata.wallBrightness - DEFAULT_WALL_BRIGHTNESS) * 0.04 +
        lightingZoneIntensity * 0.08,
      preset.sliderLimits.reflectionStrength
    ),
  };
}

// Foundation only: this resolver is intentionally not wired into Room View rendering yet.
// Future passes can use it as the source of room-aware automatic realism defaults once
// the rendering/control migration is explicitly scoped and verified.
export function resolveRoomRealismProfile(
  scene: RoomPresetScene | null | undefined,
  sourceMode: RoomViewSourceMode
): ResolvedRoomRealismProfile {
  const metadataSignals = resolveMetadataSignals(scene);
  const profileId = chooseRoomRealismProfileId(scene, sourceMode, metadataSignals);
  const preset = PROFILE_PRESETS[profileId];
  const sceneTuning = getSceneRealismTuning(scene);
  const sliderLimits = resolveSliderLimits(preset, sceneTuning);
  const lightingZoneIntensity = getPositiveLightingIntensity(scene?.sceneLightingZones);

  return {
    profileId,
    sourceMode,
    isRoomDriven: sourceMode === "presetRoom" && Boolean(scene),
    sceneId: scene?.id ?? null,
    shadow: resolveShadowProfile(scene, preset, metadataSignals, sliderLimits, sceneTuning),
    material: resolveMaterialProfile(
      preset,
      metadataSignals,
      lightingZoneIntensity,
      sliderLimits,
      sceneTuning
    ),
    sliderLimits,
    metadataSignals,
  };
}
