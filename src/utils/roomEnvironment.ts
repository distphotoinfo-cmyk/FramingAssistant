import type { RoomEnvironmentLighting } from "../types/framing";
import { hexToRgb, mixHexColors } from "./color";

export interface ResolvedRoomEnvironment {
  wallBrightness: number;
  warmth: number;
  ambientLight: number;
  contrast: number;
  edgeBlend: number;
  highlightScale: number;
  shadowScale: number;
  contrastScale: number;
  ambientOcclusionScale: number;
  ambientTintColor: string;
  ambientTintOpacity: number;
  ambientDimmingColor: string;
  ambientDimmingOpacity: number;
  edgeBlendColor: string;
  edgeBlendOpacity: number;
}

export const DEFAULT_ROOM_ENVIRONMENT: ResolvedRoomEnvironment = {
  wallBrightness: 0.62,
  warmth: 0,
  ambientLight: 0.6,
  contrast: 0.55,
  edgeBlend: 0.35,
  highlightScale: 1,
  shadowScale: 1,
  contrastScale: 1,
  ambientOcclusionScale: 1,
  ambientTintColor: "rgba(255,255,255,0)",
  ambientTintOpacity: 0,
  ambientDimmingColor: "rgba(0,0,0,0)",
  ambientDimmingOpacity: 0,
  edgeBlendColor: "rgba(255,255,255,0)",
  edgeBlendOpacity: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  return clamp(
    typeof value === "number" && Number.isFinite(value) ? value : fallback,
    min,
    max
  );
}

function rgbaFromHex(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);

  return `rgba(${r},${g},${b},${clamp(opacity, 0, 1)})`;
}

export function resolveRoomEnvironment(
  environment: RoomEnvironmentLighting | null | undefined
): ResolvedRoomEnvironment {
  const wallBrightness = resolveNumber(
    environment?.wallBrightness,
    DEFAULT_ROOM_ENVIRONMENT.wallBrightness,
    0,
    1
  );
  const warmth = resolveNumber(environment?.warmth, DEFAULT_ROOM_ENVIRONMENT.warmth, -1, 1);
  const ambientLight = resolveNumber(
    environment?.ambientLight,
    DEFAULT_ROOM_ENVIRONMENT.ambientLight,
    0,
    1
  );
  const contrast = resolveNumber(environment?.contrast, DEFAULT_ROOM_ENVIRONMENT.contrast, 0, 1);
  const edgeBlend = resolveNumber(
    environment?.edgeBlend,
    DEFAULT_ROOM_ENVIRONMENT.edgeBlend,
    0,
    1
  );
  const darkness = 1 - wallBrightness;
  const warmthMagnitude = Math.abs(warmth);
  const highlightScale = clamp(
    1 + (wallBrightness - 0.62) * 0.22 + (ambientLight - 0.6) * 0.12 - Math.max(0, darkness - 0.55) * 0.16,
    0.74,
    1.14
  );
  const shadowScale = clamp(
    1 + (0.62 - wallBrightness) * 0.24 + (contrast - 0.55) * 0.18 - (ambientLight - 0.6) * 0.08,
    0.78,
    1.24
  );
  const contrastScale = clamp(
    1 + (contrast - 0.55) * 0.22 + (0.58 - ambientLight) * 0.08 - Math.max(0, wallBrightness - 0.72) * 0.1,
    0.82,
    1.18
  );
  const ambientOcclusionScale = clamp(
    1 + (0.6 - wallBrightness) * 0.2 + (contrast - 0.55) * 0.16,
    0.78,
    1.22
  );
  const tintTarget = warmth >= 0 ? "#F2DEC0" : "#B9C8DA";
  const tintBase = warmth >= 0 ? "#FFF7EB" : "#EEF4FB";
  const ambientTintHex = mixHexColors(tintBase, tintTarget, warmthMagnitude);
  const ambientTintOpacity = clamp(
    0.008 + warmthMagnitude * 0.02 + Math.abs(wallBrightness - 0.62) * 0.018 + Math.max(0, 0.58 - ambientLight) * 0.018,
    0.006,
    0.055
  );
  const ambientDimmingOpacity = clamp(
    Math.max(0, 0.52 - wallBrightness) * 0.09 + Math.max(0, 0.54 - ambientLight) * 0.05,
    0,
    0.07
  );
  const edgeBlendHex = warmth >= 0
    ? mixHexColors("#F4E3C8", "#D4B58B", warmthMagnitude)
    : mixHexColors("#D7E0EA", "#8190A1", warmthMagnitude);
  const edgeBlendOpacity = clamp(
    edgeBlend * (0.018 + darkness * 0.032 + warmthMagnitude * 0.008),
    0,
    0.065
  );

  return {
    wallBrightness,
    warmth,
    ambientLight,
    contrast,
    edgeBlend,
    highlightScale,
    shadowScale,
    contrastScale,
    ambientOcclusionScale,
    ambientTintColor: rgbaFromHex(ambientTintHex, ambientTintOpacity),
    ambientTintOpacity,
    ambientDimmingColor: rgbaFromHex("#111111", ambientDimmingOpacity),
    ambientDimmingOpacity,
    edgeBlendColor: rgbaFromHex(edgeBlendHex, edgeBlendOpacity),
    edgeBlendOpacity,
  };
}
