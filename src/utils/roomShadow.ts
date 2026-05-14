import type { RoomPresetScene, RoomWallShadowDraft } from "../types/framing";

export interface ResolvedWallShadow {
  opacity: number;
  offsetX: number;
  offsetY: number;
  blurRadius: number;
}

export const DEFAULT_WALL_SHADOW: ResolvedWallShadow = {
  opacity: 0.1,
  offsetX: 8,
  offsetY: 11,
  blurRadius: 20,
};

const WALL_SHADOW_LIMITS = {
  opacity: { min: 0, max: 0.8 },
  offsetX: { min: -80, max: 80 },
  offsetY: { min: -80, max: 80 },
  blurRadius: { min: 0, max: 120 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveShadowValue(
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

export function resolveWallShadow(
  sceneDefaultShadow: RoomPresetScene["defaultShadow"] | null | undefined,
  placementOverride: RoomWallShadowDraft | null | undefined
): ResolvedWallShadow {
  const base = sceneDefaultShadow ?? DEFAULT_WALL_SHADOW;

  return {
    opacity: resolveShadowValue(
      placementOverride?.opacity,
      base.opacity,
      WALL_SHADOW_LIMITS.opacity.min,
      WALL_SHADOW_LIMITS.opacity.max
    ),
    offsetX: resolveShadowValue(
      placementOverride?.offsetX,
      base.offsetX,
      WALL_SHADOW_LIMITS.offsetX.min,
      WALL_SHADOW_LIMITS.offsetX.max
    ),
    offsetY: resolveShadowValue(
      placementOverride?.offsetY,
      base.offsetY,
      WALL_SHADOW_LIMITS.offsetY.min,
      WALL_SHADOW_LIMITS.offsetY.max
    ),
    blurRadius: resolveShadowValue(
      placementOverride?.blurRadius,
      base.blurRadius,
      WALL_SHADOW_LIMITS.blurRadius.min,
      WALL_SHADOW_LIMITS.blurRadius.max
    ),
  };
}
