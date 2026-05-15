import type { RoomMaterialRealismDraft } from "../types/framing";

export interface ResolvedRoomMaterialRealism {
  bevelDepth: number;
  bevelSoftness: number;
  frameDepth: number;
  innerLipContrast: number;
  glassEnabled: boolean;
  reflectionStrength: number;
}

export const DEFAULT_ROOM_MATERIAL_REALISM: ResolvedRoomMaterialRealism = {
  bevelDepth: 0.55,
  bevelSoftness: 0.45,
  frameDepth: 1,
  innerLipContrast: 1.2,
  glassEnabled: false,
  reflectionStrength: 0.18,
};

const ROOM_MATERIAL_REALISM_LIMITS = {
  bevelDepth: { min: 0, max: 3 },
  bevelSoftness: { min: 0, max: 1 },
  frameDepth: { min: 0, max: 3 },
  innerLipContrast: { min: 0, max: 4 },
  reflectionStrength: { min: 0, max: 1 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveRealismValue(
  override: number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const value = typeof override === "number" && Number.isFinite(override)
    ? override
    : fallback;

  return clamp(value, min, max);
}

export function resolveRoomMaterialRealism(
  override: RoomMaterialRealismDraft | null | undefined
): ResolvedRoomMaterialRealism {
  return {
    bevelDepth: resolveRealismValue(
      override?.bevelDepth,
      DEFAULT_ROOM_MATERIAL_REALISM.bevelDepth,
      ROOM_MATERIAL_REALISM_LIMITS.bevelDepth.min,
      ROOM_MATERIAL_REALISM_LIMITS.bevelDepth.max
    ),
    bevelSoftness: resolveRealismValue(
      override?.bevelSoftness,
      DEFAULT_ROOM_MATERIAL_REALISM.bevelSoftness,
      ROOM_MATERIAL_REALISM_LIMITS.bevelSoftness.min,
      ROOM_MATERIAL_REALISM_LIMITS.bevelSoftness.max
    ),
    frameDepth: resolveRealismValue(
      override?.frameDepth,
      DEFAULT_ROOM_MATERIAL_REALISM.frameDepth,
      ROOM_MATERIAL_REALISM_LIMITS.frameDepth.min,
      ROOM_MATERIAL_REALISM_LIMITS.frameDepth.max
    ),
    innerLipContrast: resolveRealismValue(
      override?.innerLipContrast,
      DEFAULT_ROOM_MATERIAL_REALISM.innerLipContrast,
      ROOM_MATERIAL_REALISM_LIMITS.innerLipContrast.min,
      ROOM_MATERIAL_REALISM_LIMITS.innerLipContrast.max
    ),
    glassEnabled:
      typeof override?.glassEnabled === "boolean"
        ? override.glassEnabled
        : DEFAULT_ROOM_MATERIAL_REALISM.glassEnabled,
    reflectionStrength: resolveRealismValue(
      override?.reflectionStrength,
      DEFAULT_ROOM_MATERIAL_REALISM.reflectionStrength,
      ROOM_MATERIAL_REALISM_LIMITS.reflectionStrength.min,
      ROOM_MATERIAL_REALISM_LIMITS.reflectionStrength.max
    ),
  };
}
