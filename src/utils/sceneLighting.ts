import type { RoomSceneLightingZone, RoomViewPoint, RoomViewRect } from "../types/framing";

export interface ResolvedSceneLightingEffect {
  brightnessMultiplier: number;
  warmthOffset: number;
  reflectionBoost: number;
}

export const NEUTRAL_SCENE_LIGHTING_EFFECT: ResolvedSceneLightingEffect = {
  brightnessMultiplier: 1,
  warmthOffset: 0,
  reflectionBoost: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeRect(rect: RoomViewRect): RoomViewRect {
  const x = clamp(rect.x, 0, 1);
  const y = clamp(rect.y, 0, 1);
  const width = clamp(rect.width, 0, 1 - x);
  const height = clamp(rect.height, 0, 1 - y);

  return { x, y, width, height };
}

function getRectSamplePoints(rect: RoomViewRect): RoomViewPoint[] {
  const normalizedRect = normalizeRect(rect);
  const left = normalizedRect.x;
  const centerX = normalizedRect.x + normalizedRect.width / 2;
  const right = normalizedRect.x + normalizedRect.width;
  const top = normalizedRect.y;
  const centerY = normalizedRect.y + normalizedRect.height / 2;
  const bottom = normalizedRect.y + normalizedRect.height;

  return [
    { x: centerX, y: centerY },
    { x: left, y: top },
    { x: centerX, y: top },
    { x: right, y: top },
    { x: left, y: centerY },
    { x: right, y: centerY },
    { x: left, y: bottom },
    { x: centerX, y: bottom },
    { x: right, y: bottom },
  ];
}

function getRectOverlapRatio(firstRect: RoomViewRect, secondRect: RoomViewRect) {
  const first = normalizeRect(firstRect);
  const second = normalizeRect(secondRect);
  const firstArea = first.width * first.height;

  if (firstArea <= 0) {
    return 0;
  }

  const overlapLeft = Math.max(first.x, second.x);
  const overlapTop = Math.max(first.y, second.y);
  const overlapRight = Math.min(first.x + first.width, second.x + second.width);
  const overlapBottom = Math.min(first.y + first.height, second.y + second.height);
  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const overlapHeight = Math.max(0, overlapBottom - overlapTop);

  return clamp((overlapWidth * overlapHeight) / firstArea, 0, 1);
}

function resolveSpotlightInfluence(zone: RoomSceneLightingZone, artworkRect: RoomViewRect) {
  if (!zone.center) {
    return 0;
  }

  const center = {
    x: clamp(zone.center.x, 0, 1),
    y: clamp(zone.center.y, 0, 1),
  };
  const radius = isFiniteNumber(zone.radius) ? zone.radius : 0.16;
  const radiusX = Math.max(0.001, isFiniteNumber(zone.radiusX) ? zone.radiusX : radius);
  const radiusY = Math.max(0.001, isFiniteNumber(zone.radiusY) ? zone.radiusY : radius);
  const softness = clamp(zone.softness ?? 0.55, 0, 1);
  const exponent = 1 + softness * 1.6;
  const sampleInfluences = getRectSamplePoints(artworkRect).map((point) => {
    const distance = Math.hypot(
      (point.x - center.x) / radiusX,
      (point.y - center.y) / radiusY
    );
    return Math.pow(clamp(1 - distance, 0, 1), exponent);
  });
  const maxInfluence = Math.max(...sampleInfluences);
  const averageInfluence =
    sampleInfluences.reduce((sum, value) => sum + value, 0) / sampleInfluences.length;

  return clamp(maxInfluence * 0.68 + averageInfluence * 0.32, 0, 1);
}

function resolveBoundsInfluence(zone: RoomSceneLightingZone, artworkRect: RoomViewRect) {
  if (!zone.bounds) {
    return 0;
  }

  const overlapRatio = getRectOverlapRatio(artworkRect, zone.bounds);
  const softness = clamp(zone.softness ?? 0.45, 0, 1);

  return clamp(Math.pow(overlapRatio, 1 - softness * 0.45), 0, 1);
}

function resolveZoneInfluence(zone: RoomSceneLightingZone, artworkRect: RoomViewRect) {
  const spotlightInfluence =
    zone.type === "spotlight" || zone.center
      ? resolveSpotlightInfluence(zone, artworkRect)
      : 0;
  const boundsInfluence = resolveBoundsInfluence(zone, artworkRect);

  return clamp(Math.max(spotlightInfluence, boundsInfluence), 0, 1);
}

export function resolveSceneLightingEffect(
  zones: RoomSceneLightingZone[] | null | undefined,
  artworkRect: RoomViewRect
): ResolvedSceneLightingEffect {
  if (!zones?.length || artworkRect.width <= 0 || artworkRect.height <= 0) {
    return NEUTRAL_SCENE_LIGHTING_EFFECT;
  }

  let brightnessDelta = 0;
  let warmthOffset = 0;
  let reflectionBoost = 0;

  zones.forEach((zone) => {
    const influence = resolveZoneInfluence(zone, artworkRect);

    if (influence <= 0.001) {
      return;
    }

    const intensity = clamp(zone.intensity ?? 0, -0.35, 0.35);
    const warmth = clamp(zone.warmth ?? 0, -1, 1);

    brightnessDelta += intensity * influence;
    warmthOffset += warmth * influence * 0.22;

    if (intensity > 0) {
      reflectionBoost += intensity * influence * 0.24;
    }
  });

  return {
    brightnessMultiplier: clamp(1 + brightnessDelta, 0.82, 1.18),
    warmthOffset: clamp(warmthOffset, -0.18, 0.18),
    reflectionBoost: clamp(reflectionBoost, 0, 0.12),
  };
}
