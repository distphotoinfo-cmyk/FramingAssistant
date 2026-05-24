import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, PixelRatio, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Polygon, Rect as SvgRect, Stop } from "react-native-svg";
import type {
  ArtworkCropState,
  ArtworkPreviewSourceMode,
  FrameProfileId,
  MatCoreColor,
  MatThicknessPly,
  RoomEnvironmentLighting,
  RoomMaterialRealismDraft,
} from "../../types/framing";
import {
  DEFAULT_CANVAS_BACKGROUND_COLOR_HEX,
  useAppSettingsStore,
} from "../../state/appSettingsStore";
import { getArtworkAspectRatio, resolveArtworkCropMetrics } from "../../utils/artworkCrop";
import { getFrameProfile } from "../../utils/frameProfiles";
import { getOffsetBounds, type NumericSize } from "../../utils/framingGeometry";
import { hexToHsl, mixHexColors, normalizeHex } from "../../utils/color";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { resolveRoomEnvironment } from "../../utils/roomEnvironment";
import { resolveRoomMaterialRealism } from "../../utils/roomRealism";

interface MatPreviewCanvasProps {
  artworkSize: NumericSize | null;
  openingSize: NumericSize | null;
  outerMatSize: NumericSize | null;
  frameProfileId: FrameProfileId;
  frameColorHex: string;
  matThicknessPly: MatThicknessPly;
  matColorHex: string;
  matCoreColor: MatCoreColor;
  mountingBoardColorHex: string;
  offsetX: number;
  offsetY: number;
  snapIncrement: number;
  artworkSourceMode: ArtworkPreviewSourceMode;
  artworkImageUri: string | null;
  artworkCrop: ArtworkCropState | null;
  onAdjustOffsets: (offsetX: number, offsetY: number) => void;
  onLiveOffsetsChange?: (offsetX: number, offsetY: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  canvasHeight?: number;
  layoutVariant?: "default" | "workspace";
}

export interface FinishedFramedArtworkProps {
  artworkSize: NumericSize | null;
  openingSize: NumericSize | null;
  outerMatSize: NumericSize | null;
  frameProfileId: FrameProfileId;
  frameColorHex: string;
  matThicknessPly: MatThicknessPly;
  matColorHex: string;
  matCoreColor: MatCoreColor;
  mountingBoardColorHex: string;
  offsetX: number;
  offsetY: number;
  artworkSourceMode: ArtworkPreviewSourceMode;
  artworkImageUri: string | null;
  artworkCrop: ArtworkCropState | null;
  physicalScale: number;
  showShadow?: boolean;
  depthMode?: "standard" | "roomMockup";
  shadowDirection?: { x: number; y: number };
  materialRealism?: RoomMaterialRealismDraft;
  environment?: RoomEnvironmentLighting;
  style?: ViewStyle;
}

interface FrameFacePalette {
  base: string;
  outerLight: string;
  outerShadow: string;
  innerLight: string;
  innerShadow: string;
  brushedHighlight: string;
  brushedShadow: string;
}

interface MatBevelSidePalette {
  outer: string;
  inner: string;
  midOffset: string;
}

interface MatBevelPalette {
  face: string;
  top: MatBevelSidePalette;
  left: MatBevelSidePalette;
  right: MatBevelSidePalette;
  bottom: MatBevelSidePalette;
}

function roundToPixel(value: number) {
  return Number(PixelRatio.roundToNearestPixel(value).toFixed(2));
}

type FrameOrientation = "top" | "right" | "bottom" | "left";

const FRAME_ORIENTATIONS: FrameOrientation[] = ["top", "right", "bottom", "left"];
const FRAME_EDGE_NORMALS: Record<FrameOrientation, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const STANDARD_PREVIEW_LIGHT_DIRECTION = {
  x: 1 / Math.SQRT2,
  y: 1 / Math.SQRT2,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function scaleOpacity(value: number, intensity: number, max = 0.5) {
  return clamp(value * intensity, 0, max);
}

function normalizeLightingVector(
  vector: { x: number; y: number } | null | undefined,
  fallback = STANDARD_PREVIEW_LIGHT_DIRECTION
) {
  if (!vector || !Number.isFinite(vector.x) || !Number.isFinite(vector.y)) {
    return fallback;
  }

  const length = Math.hypot(vector.x, vector.y);

  if (length <= 0.001) {
    return fallback;
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function getLightDirectionFromShadowDirection(shadowDirection?: { x: number; y: number }) {
  const normalizedShadowDirection = normalizeLightingVector(shadowDirection, {
    x: 0.5,
    y: 0.866,
  });

  return {
    x: -normalizedShadowDirection.x,
    y: -normalizedShadowDirection.y,
  };
}

function getEdgeLightValues(
  lightDirection: { x: number; y: number },
  orientation: FrameOrientation
) {
  const normal = FRAME_EDGE_NORMALS[orientation];
  const dot = clamp(normal.x * lightDirection.x + normal.y * lightDirection.y, -1, 1);

  return {
    light: Math.max(0, dot),
    shadow: Math.max(0, -dot),
  };
}

function getDirectionalSurfaceValues(
  lightDirection: { x: number; y: number },
  orientation: FrameOrientation,
  recessed = false
) {
  const edge = getEdgeLightValues(lightDirection, orientation);

  if (recessed) {
    const useLight = edge.shadow > edge.light;

    return {
      useLight,
      amount: useLight ? edge.shadow : edge.light,
    };
  }

  const useLight = edge.light >= edge.shadow;

  return {
    useLight,
    amount: useLight ? edge.light : edge.shadow,
  };
}

function buildDirectionalFrameBandStyle({
  lightDirection,
  lightColor,
  shadowColor,
  baseLightOpacity,
  baseShadowOpacity,
  depthIntensity,
  maxOpacity,
  recessed = false,
}: {
  lightDirection: { x: number; y: number };
  lightColor: string;
  shadowColor: string;
  baseLightOpacity: number;
  baseShadowOpacity: number;
  depthIntensity: number;
  maxOpacity: number;
  recessed?: boolean;
}) {
  const fillByOrientation = {} as Record<FrameOrientation, string>;
  const opacityByOrientation = {} as Record<FrameOrientation, number>;

  FRAME_ORIENTATIONS.forEach((orientation) => {
    const { useLight, amount } = getDirectionalSurfaceValues(
      lightDirection,
      orientation,
      recessed
    );
    const baseOpacity = useLight ? baseLightOpacity : baseShadowOpacity;

    fillByOrientation[orientation] = useLight ? lightColor : shadowColor;
    opacityByOrientation[orientation] = scaleOpacity(
      baseOpacity * (0.3 + amount * 0.7),
      depthIntensity,
      maxOpacity
    );
  });

  return {
    fillByOrientation,
    opacityByOrientation,
  };
}

function getDirectionalEdgeColor({
  orientation,
  lightDirection,
  shadowAlpha,
  highlightAlpha,
  recessed = false,
}: {
  orientation: FrameOrientation;
  lightDirection: { x: number; y: number };
  shadowAlpha: number;
  highlightAlpha: number;
  recessed?: boolean;
}) {
  const { useLight, amount } = getDirectionalSurfaceValues(
    lightDirection,
    orientation,
    recessed
  );

  if (useLight) {
    return `rgba(255,255,255,${clamp(highlightAlpha * (0.28 + amount * 0.72), 0, highlightAlpha)})`;
  }

  return `rgba(0,0,0,${clamp(shadowAlpha * (0.32 + amount * 0.68), 0, shadowAlpha)})`;
}

function buildDirectionalEdgeColors(
  lightDirection: { x: number; y: number },
  shadowAlpha: number,
  highlightAlpha: number,
  recessed = false
) {
  return {
    top: getDirectionalEdgeColor({ orientation: "top", lightDirection, shadowAlpha, highlightAlpha, recessed }),
    right: getDirectionalEdgeColor({ orientation: "right", lightDirection, shadowAlpha, highlightAlpha, recessed }),
    bottom: getDirectionalEdgeColor({ orientation: "bottom", lightDirection, shadowAlpha, highlightAlpha, recessed }),
    left: getDirectionalEdgeColor({ orientation: "left", lightDirection, shadowAlpha, highlightAlpha, recessed }),
  };
}

function buildPolygonPoints(points: [number, number][]) {
  return points.map(([x, y]) => `${roundToPixel(x)},${roundToPixel(y)}`).join(" ");
}

function getMiterBandPoints(
  orientation: FrameOrientation,
  width: number,
  height: number,
  startOffset: number,
  endOffset: number
) {
  switch (orientation) {
    case "top":
      return buildPolygonPoints([
        [startOffset, startOffset],
        [width - startOffset, startOffset],
        [width - endOffset, endOffset],
        [endOffset, endOffset],
      ]);
    case "right":
      return buildPolygonPoints([
        [width - startOffset, startOffset],
        [width - startOffset, height - startOffset],
        [width - endOffset, height - endOffset],
        [width - endOffset, endOffset],
      ]);
    case "bottom":
      return buildPolygonPoints([
        [startOffset, height - startOffset],
        [width - startOffset, height - startOffset],
        [width - endOffset, height - endOffset],
        [endOffset, height - endOffset],
      ]);
    case "left":
      return buildPolygonPoints([
        [startOffset, startOffset],
        [startOffset, height - startOffset],
        [endOffset, height - endOffset],
        [endOffset, endOffset],
      ]);
  }
}

function FrameBandLayer({
  width,
  height,
  startOffset,
  endOffset,
  fillByOrientation,
  opacityByOrientation,
}: {
  width: number;
  height: number;
  startOffset: number;
  endOffset: number;
  fillByOrientation: Record<FrameOrientation, string>;
  opacityByOrientation?: Partial<Record<FrameOrientation, number>>;
}) {
  if (endOffset <= startOffset) {
    return null;
  }

  return (
    <>
      {FRAME_ORIENTATIONS.map((orientation) => (
        <Polygon
          key={`${orientation}-${startOffset}-${endOffset}-${fillByOrientation[orientation]}`}
          points={getMiterBandPoints(orientation, width, height, startOffset, endOffset)}
          fill={fillByOrientation[orientation]}
          opacity={opacityByOrientation?.[orientation] ?? 1}
        />
      ))}
    </>
  );
}

function FrameFaceOverlay({
  width,
  height,
  thickness,
  palette,
  renderStyle,
  depthIntensity = 1,
  lightDirection,
  innerLipContrast = 1,
}: {
  width: number;
  height: number;
  thickness: number;
  palette: FrameFacePalette;
  renderStyle: "none" | "basic" | "florentine" | "monochrome";
  depthIntensity?: number;
  lightDirection?: { x: number; y: number };
  innerLipContrast?: number;
}) {
  if (thickness <= 0) {
    return null;
  }

  const onePixel = roundToPixel(Math.max(1 / PixelRatio.get(), PixelRatio.roundToNearestPixel(1)));
  const outerBand = roundToPixel(
    clamp(
      thickness * (renderStyle === "florentine" ? 0.18 : renderStyle === "monochrome" ? 0.14 : 0.12),
      onePixel,
      Math.max(onePixel, thickness - onePixel)
    )
  );
  const innerBand = roundToPixel(
    clamp(
      thickness * (renderStyle === "florentine" ? 0.16 : 0.14),
      onePixel,
      Math.max(onePixel, thickness - outerBand)
    )
  );
  const innerBandStart = roundToPixel(Math.max(0, thickness - innerBand));
  const showMetalLines = renderStyle === "florentine" && thickness >= onePixel * 4;
  const accentWidth = roundToPixel(Math.max(onePixel, thickness * 0.08));
  const accentOneStart = roundToPixel(
    clamp(
      thickness * 0.34,
      outerBand + onePixel * 0.35,
      Math.max(outerBand + onePixel * 0.35, innerBandStart - accentWidth * 2)
    )
  );
  const accentTwoStart = roundToPixel(
    clamp(
      thickness * 0.62,
      accentOneStart + accentWidth + onePixel * 0.35,
      Math.max(accentOneStart + accentWidth + onePixel * 0.35, innerBandStart - accentWidth)
    )
  );
  const effectiveInnerLipContrast = clamp(innerLipContrast, 0, 4);
  const innerLipOverdrive = Math.max(0, effectiveInnerLipContrast - 2);
  const innerLipMaxOpacity = clamp(0.48 + innerLipOverdrive * 0.18, 0.48, 0.86);
  const innerLipAccentMaxOpacity = clamp(0.5 + innerLipOverdrive * 0.2, 0.5, 0.9);
  const outerBandStyle = lightDirection
    ? buildDirectionalFrameBandStyle({
        lightDirection,
        lightColor: palette.outerLight,
        shadowColor: palette.outerShadow,
        baseLightOpacity: renderStyle === "florentine" ? 0.18 : renderStyle === "monochrome" ? 0.13 : 0.11,
        baseShadowOpacity: renderStyle === "florentine" ? 0.22 : renderStyle === "monochrome" ? 0.17 : 0.13,
        depthIntensity,
        maxOpacity: 0.4,
      })
    : null;
  const accentOneBandStyle = lightDirection
    ? buildDirectionalFrameBandStyle({
        lightDirection,
        lightColor: palette.brushedHighlight,
        shadowColor: palette.brushedShadow,
        baseLightOpacity: 0.1,
        baseShadowOpacity: 0.1,
        depthIntensity,
        maxOpacity: 0.24,
      })
    : null;
  const accentTwoBandStyle = lightDirection
    ? buildDirectionalFrameBandStyle({
        lightDirection,
        lightColor: palette.brushedHighlight,
        shadowColor: palette.brushedShadow,
        baseLightOpacity: 0.11,
        baseShadowOpacity: 0.09,
        depthIntensity,
        maxOpacity: 0.25,
      })
    : null;
  const innerBandStyle = lightDirection
    ? buildDirectionalFrameBandStyle({
        lightDirection,
        lightColor: palette.innerLight,
        shadowColor: palette.innerShadow,
        baseLightOpacity:
          (renderStyle === "florentine" ? 0.17 : renderStyle === "monochrome" ? 0.13 : 0.1) *
          effectiveInnerLipContrast,
        baseShadowOpacity:
          (renderStyle === "florentine" ? 0.25 : renderStyle === "monochrome" ? 0.2 : 0.15) *
          effectiveInnerLipContrast,
        depthIntensity,
        maxOpacity: innerLipMaxOpacity,
        recessed: true,
      })
    : null;
  const innerLipAccentWidth = roundToPixel(
    clamp(
      thickness * (0.035 + effectiveInnerLipContrast * 0.012),
      onePixel,
      Math.max(onePixel, innerBand * 0.42)
    )
  );
  const innerLipAccentStart = roundToPixel(Math.max(innerBandStart, thickness - innerLipAccentWidth));
  const innerLipAccentStyle = lightDirection
    ? buildDirectionalFrameBandStyle({
        lightDirection,
        lightColor: palette.innerLight,
        shadowColor: palette.innerShadow,
        baseLightOpacity:
          (renderStyle === "florentine" ? 0.16 : renderStyle === "monochrome" ? 0.12 : 0.1) *
          effectiveInnerLipContrast,
        baseShadowOpacity:
          (renderStyle === "florentine" ? 0.28 : renderStyle === "monochrome" ? 0.23 : 0.17) *
          effectiveInnerLipContrast,
        depthIntensity,
        maxOpacity: innerLipAccentMaxOpacity,
        recessed: true,
      })
    : null;

  return (
    <Svg
      pointerEvents="none"
      style={{
        position: "absolute",
        inset: 0,
      }}
      width={width}
      height={height}
    >
      <FrameBandLayer
        width={width}
        height={height}
        startOffset={0}
        endOffset={outerBand}
        fillByOrientation={
          outerBandStyle?.fillByOrientation ?? {
            top: palette.outerShadow,
            right: palette.outerLight,
            bottom: palette.outerLight,
            left: palette.outerShadow,
          }
        }
        opacityByOrientation={
          outerBandStyle?.opacityByOrientation ?? {
            top: scaleOpacity(renderStyle === "florentine" ? 0.2 : renderStyle === "monochrome" ? 0.16 : 0.12, depthIntensity, 0.38),
            right: scaleOpacity(renderStyle === "florentine" ? 0.16 : renderStyle === "monochrome" ? 0.12 : 0.1, depthIntensity, 0.34),
            bottom: scaleOpacity(renderStyle === "florentine" ? 0.18 : renderStyle === "monochrome" ? 0.14 : 0.1, depthIntensity, 0.36),
            left: scaleOpacity(renderStyle === "florentine" ? 0.16 : renderStyle === "monochrome" ? 0.12 : 0.1, depthIntensity, 0.34),
          }
        }
      />
      {showMetalLines ? (
        <>
          <FrameBandLayer
            width={width}
            height={height}
            startOffset={accentOneStart}
            endOffset={accentOneStart + accentWidth}
            fillByOrientation={
              accentOneBandStyle?.fillByOrientation ?? {
                top: palette.brushedShadow,
                right: palette.brushedHighlight,
                bottom: palette.brushedHighlight,
                left: palette.brushedShadow,
              }
            }
            opacityByOrientation={
              accentOneBandStyle?.opacityByOrientation ?? {
                top: scaleOpacity(0.1, depthIntensity, 0.24),
                right: scaleOpacity(0.09, depthIntensity, 0.22),
                bottom: scaleOpacity(0.08, depthIntensity, 0.2),
                left: scaleOpacity(0.08, depthIntensity, 0.2),
              }
            }
          />
          <FrameBandLayer
            width={width}
            height={height}
            startOffset={accentTwoStart}
            endOffset={accentTwoStart + accentWidth}
            fillByOrientation={
              accentTwoBandStyle?.fillByOrientation ?? {
                top: palette.brushedShadow,
                right: palette.brushedHighlight,
                bottom: palette.brushedHighlight,
                left: palette.brushedShadow,
              }
            }
            opacityByOrientation={
              accentTwoBandStyle?.opacityByOrientation ?? {
                top: scaleOpacity(0.08, depthIntensity, 0.2),
                right: scaleOpacity(0.11, depthIntensity, 0.24),
                bottom: scaleOpacity(0.12, depthIntensity, 0.26),
                left: scaleOpacity(0.07, depthIntensity, 0.18),
              }
            }
          />
        </>
      ) : null}
      <FrameBandLayer
        width={width}
        height={height}
        startOffset={innerBandStart}
        endOffset={thickness}
        fillByOrientation={
          innerBandStyle?.fillByOrientation ?? {
            top: palette.innerShadow,
            right: palette.innerLight,
            bottom: palette.innerLight,
            left: palette.innerShadow,
          }
        }
        opacityByOrientation={
          innerBandStyle?.opacityByOrientation ?? {
            top: scaleOpacity(renderStyle === "florentine" ? 0.1 : renderStyle === "monochrome" ? 0.08 : 0.06, depthIntensity, 0.28),
            right: scaleOpacity(renderStyle === "florentine" ? 0.14 : renderStyle === "monochrome" ? 0.1 : 0.08, depthIntensity, 0.32),
            bottom: scaleOpacity(renderStyle === "florentine" ? 0.16 : renderStyle === "monochrome" ? 0.12 : 0.08, depthIntensity, 0.34),
            left: scaleOpacity(renderStyle === "florentine" ? 0.08 : renderStyle === "monochrome" ? 0.06 : 0.05, depthIntensity, 0.24),
          }
        }
      />
      {innerLipAccentStyle ? (
        <FrameBandLayer
          width={width}
          height={height}
          startOffset={innerLipAccentStart}
          endOffset={thickness}
          fillByOrientation={innerLipAccentStyle.fillByOrientation}
          opacityByOrientation={innerLipAccentStyle.opacityByOrientation}
        />
      ) : null}
    </Svg>
  );
}

function GlassReflectionOverlay({
  width,
  height,
  lightDirection,
  strength,
  warmth,
  highlightScale,
}: {
  width: number;
  height: number;
  lightDirection: { x: number; y: number };
  strength: number;
  warmth: number;
  highlightScale: number;
}) {
  const gradientIdPrefixRef = useRef(`glass-reflection-${Math.random().toString(36).slice(2)}`);
  const gradientIdPrefix = gradientIdPrefixRef.current;
  const reflectionStrength = clamp(strength, 0, 1);

  if (width <= 0 || height <= 0 || reflectionStrength <= 0.001) {
    return null;
  }

  const normalizedLightDirection = normalizeLightingVector(lightDirection);
  const x1 = clamp((0.5 - normalizedLightDirection.x * 0.72) * 100, -24, 124);
  const y1 = clamp((0.5 - normalizedLightDirection.y * 0.72) * 100, -24, 124);
  const x2 = clamp((0.5 + normalizedLightDirection.x * 0.72) * 100, -24, 124);
  const y2 = clamp((0.5 + normalizedLightDirection.y * 0.72) * 100, -24, 124);
  const warmthMagnitude = Math.abs(warmth);
  const reflectionColor = warmth >= 0
    ? mixHexColors("#FFFFFF", "#F9E4C0", warmthMagnitude * 0.42)
    : mixHexColors("#FFFFFF", "#DCEAFF", warmthMagnitude * 0.46);
  const bandOpacity = clamp(reflectionStrength * 0.105 * highlightScale, 0, 0.14);
  const secondaryBandOpacity = clamp(reflectionStrength * 0.052 * highlightScale, 0, 0.072);
  const hairlineOpacity = clamp(reflectionStrength * 0.034 * highlightScale, 0, 0.052);
  const secondaryBandStart = normalizedLightDirection.x * normalizedLightDirection.y > 0 ? 70 : 30;

  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
      }}
    >
      <Defs>
        <LinearGradient
          id={`${gradientIdPrefix}-band`}
          x1={`${x1}%`}
          y1={`${y1}%`}
          x2={`${x2}%`}
          y2={`${y2}%`}
        >
          <Stop offset="0%" stopColor={reflectionColor} stopOpacity={0} />
          <Stop offset="42%" stopColor={reflectionColor} stopOpacity={0} />
          <Stop offset="49%" stopColor={reflectionColor} stopOpacity={bandOpacity * 0.18} />
          <Stop offset="53%" stopColor={reflectionColor} stopOpacity={bandOpacity} />
          <Stop offset="57%" stopColor={reflectionColor} stopOpacity={hairlineOpacity} />
          <Stop offset="64%" stopColor={reflectionColor} stopOpacity={0} />
          <Stop offset={`${secondaryBandStart - 5}%`} stopColor={reflectionColor} stopOpacity={0} />
          <Stop offset={`${secondaryBandStart}%`} stopColor={reflectionColor} stopOpacity={secondaryBandOpacity} />
          <Stop offset={`${secondaryBandStart + 4}%`} stopColor={reflectionColor} stopOpacity={0} />
          <Stop offset="100%" stopColor={reflectionColor} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <SvgRect x={0} y={0} width={width} height={height} fill={`url(#${gradientIdPrefix}-band)`} />
    </Svg>
  );
}

function MatBevelOverlay({
  width,
  height,
  inset,
  palette,
}: {
  width: number;
  height: number;
  inset: number;
  palette: MatBevelPalette;
}) {
  const gradientIdPrefixRef = useRef(`mat-bevel-${Math.random().toString(36).slice(2)}`);
  const gradientIdPrefix = gradientIdPrefixRef.current;
  const topMidColor = mixHexColors(palette.top.inner, palette.top.outer, 0.58);
  const leftMidColor = mixHexColors(palette.left.inner, palette.left.outer, 0.56);
  const rightMidColor = mixHexColors(palette.right.inner, palette.right.outer, 0.62);
  const bottomMidColor = mixHexColors(palette.bottom.inner, palette.bottom.outer, 0.64);

  return (
    <Svg
      pointerEvents="none"
      style={{
        position: "absolute",
        inset: 0,
      }}
      width={width}
      height={height}
    >
      <Defs>
        <LinearGradient id={`${gradientIdPrefix}-top`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={palette.top.outer} />
          <Stop offset={palette.top.midOffset} stopColor={topMidColor} />
          <Stop offset="100%" stopColor={palette.top.inner} />
        </LinearGradient>
        <LinearGradient id={`${gradientIdPrefix}-left`} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={palette.left.outer} />
          <Stop offset={palette.left.midOffset} stopColor={leftMidColor} />
          <Stop offset="100%" stopColor={palette.left.inner} />
        </LinearGradient>
        <LinearGradient id={`${gradientIdPrefix}-right`} x1="100%" y1="0%" x2="0%" y2="0%">
          <Stop offset="0%" stopColor={palette.right.outer} />
          <Stop offset={palette.right.midOffset} stopColor={rightMidColor} />
          <Stop offset="100%" stopColor={palette.right.inner} />
        </LinearGradient>
        <LinearGradient id={`${gradientIdPrefix}-bottom`} x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%" stopColor={palette.bottom.outer} />
          <Stop offset={palette.bottom.midOffset} stopColor={bottomMidColor} />
          <Stop offset="100%" stopColor={palette.bottom.inner} />
        </LinearGradient>
      </Defs>

      <Polygon
        points={`0,0 ${width},0 ${width - inset},${inset} ${inset},${inset}`}
        fill={`url(#${gradientIdPrefix}-top)`}
      />
      <Polygon
        points={`0,0 0,${height} ${inset},${height - inset} ${inset},${inset}`}
        fill={`url(#${gradientIdPrefix}-left)`}
      />
      <Polygon
        points={`${width},0 ${width},${height} ${width - inset},${height - inset} ${width - inset},${inset}`}
        fill={`url(#${gradientIdPrefix}-right)`}
      />
      <Polygon
        points={`0,${height} ${width},${height} ${width - inset},${height - inset} ${inset},${height - inset}`}
        fill={`url(#${gradientIdPrefix}-bottom)`}
      />
    </Svg>
  );
}

function snapToIncrement(value: number, increment: number) {
  "worklet";
  if (increment <= 0) {
    return value;
  }

  return Math.round(value / increment) * increment;
}

export function FinishedFramedArtwork({
  artworkSize,
  openingSize,
  outerMatSize,
  frameProfileId,
  frameColorHex,
  matThicknessPly,
  matColorHex,
  matCoreColor,
  mountingBoardColorHex,
  offsetX,
  offsetY,
  artworkSourceMode,
  artworkImageUri,
  artworkCrop,
  physicalScale,
  showShadow = true,
  depthMode = "standard",
  shadowDirection,
  materialRealism,
  environment,
  style,
}: FinishedFramedArtworkProps) {
  const { isDark } = useAppTheme();
  const unit = useAppSettingsStore((state) => state.unit);
  const frameProfile = getFrameProfile(frameProfileId);
  const frameFaceWidth =
    unit === "cm" ? frameProfile.faceWidthInches * 2.54 : frameProfile.faceWidthInches;
  const frameColor = normalizeHex(frameColorHex, "#050505");
  const matColor = normalizeHex(matColorHex, "#F4F0E8");
  const mountingBoardColor = normalizeHex(mountingBoardColorHex, "#FFFFFF");
  const matLightness = hexToHsl(matColor).l;
  const isDarkMat = matLightness < 0.24;
  const isWhiteCore = matCoreColor === "white";
  const coreFaceColor = isWhiteCore ? "#F8F7F2" : isDarkMat ? "#1D1D1D" : "#161616";
  const blackCoreLiftRatio = isWhiteCore ? 0 : clamp((0.42 - matLightness) / 0.42, 0, 1);
  const isFlorentineFrame = frameProfile.renderStyle === "florentine";
  const isMonochromeFrame = frameProfile.renderStyle === "monochrome";
  const isRoomMockupDepth = depthMode === "roomMockup";
  const frameLightness = hexToHsl(frameColor).l;
  const darkFrameLiftRatio = isRoomMockupDepth ? clamp((0.62 - frameLightness) / 0.62, 0, 1) : 0;
  const roomLightDirection = isRoomMockupDepth
    ? getLightDirectionFromShadowDirection(shadowDirection)
    : STANDARD_PREVIEW_LIGHT_DIRECTION;
  const roomMaterialRealism = resolveRoomMaterialRealism(materialRealism);
  const roomEnvironment = resolveRoomEnvironment(isRoomMockupDepth ? environment : null);
  const environmentHighlightScale = isRoomMockupDepth ? roomEnvironment.highlightScale : 1;
  const environmentShadowScale = isRoomMockupDepth ? roomEnvironment.shadowScale : 1;
  const environmentContrastScale = isRoomMockupDepth ? roomEnvironment.contrastScale : 1;
  const environmentAmbientOcclusionScale = isRoomMockupDepth
    ? roomEnvironment.ambientOcclusionScale
    : 1;
  const roomBevelDepth = isRoomMockupDepth ? roomMaterialRealism.bevelDepth : 1;
  const roomBevelSoftness = isRoomMockupDepth ? roomMaterialRealism.bevelSoftness : 0;
  const roomFrameDepth = isRoomMockupDepth ? roomMaterialRealism.frameDepth : 1;
  const roomInnerLipContrast = isRoomMockupDepth ? roomMaterialRealism.innerLipContrast : 1;
  const roomFrameOverdrive = Math.max(0, roomFrameDepth - 1.5);
  const roomFrameOverdriveRatio = clamp(roomFrameOverdrive / 1.5, 0, 1);
  const roomBevelOverdrive = Math.max(0, roomBevelDepth - 1.5);
  const roomBevelOverdriveRatio = clamp(roomBevelOverdrive / 1.5, 0, 1);
  const lightMatBevelReadabilityRatio = isRoomMockupDepth
    ? clamp((matLightness - 0.66) / 0.34, 0, 1)
    : 0;
  const roomBevelReadabilityScale = isRoomMockupDepth
    ? 1.12 + lightMatBevelReadabilityRatio * 0.12
    : 1;
  const roomBevelContrast = clamp(
    (clamp(0.62 + roomBevelDepth * 0.4, 0, 1.16) + roomBevelOverdrive * 0.55) *
      environmentContrastScale *
      roomBevelReadabilityScale,
    0,
    2.32
  );
  const matShadowBoost = isRoomMockupDepth
    ? (1 + roomBevelDepth * 0.6) * environmentShadowScale
    : 1;
  const matHighlightBoost = isRoomMockupDepth
    ? (1 + roomBevelDepth * 0.42) * environmentHighlightScale
    : 1;
  const frameShadowBoost = isRoomMockupDepth
    ? (1 + roomFrameDepth * (0.5 + darkFrameLiftRatio * 0.34)) * environmentShadowScale
    : 1;
  const frameHighlightBoost = isRoomMockupDepth
    ? (1 + roomFrameDepth * (0.28 + darkFrameLiftRatio * 0.26)) * environmentHighlightScale
    : 1;
  const frameFaceDepthIntensity = isRoomMockupDepth
    ? (1 + roomFrameDepth * (0.56 + darkFrameLiftRatio * 0.22)) *
      clamp(environmentContrastScale, 0.84, 1.14)
    : 1;
  const frameInnerLipContrast = isRoomMockupDepth
    ? roomInnerLipContrast *
      (1 + darkFrameLiftRatio * 0.62 + roomFrameOverdrive * (0.18 + darkFrameLiftRatio * 0.24)) *
      clamp(environmentContrastScale * environmentShadowScale, 0.82, 1.22)
    : roomInnerLipContrast;
  const bevelUnitScale = unit === "cm" ? 2.54 : 1;
  const bevelVisualScale = 1.5625;
  const bevelThicknessMultiplier = {
    2: 1,
    4: 1,
    6: 1,
    8: 1,
  }[matThicknessPly];
  const bevelProfile = {
    2: { physicalWidth: 0.045 * bevelUnitScale * bevelVisualScale * bevelThicknessMultiplier, apertureEdgeAlpha: 0.045 },
    4: { physicalWidth: 0.08 * bevelUnitScale * bevelVisualScale * bevelThicknessMultiplier, apertureEdgeAlpha: 0.06 },
    6: { physicalWidth: 0.11 * bevelUnitScale * bevelVisualScale * bevelThicknessMultiplier, apertureEdgeAlpha: 0.07 },
    8: { physicalWidth: 0.14 * bevelUnitScale * bevelVisualScale * bevelThicknessMultiplier, apertureEdgeAlpha: 0.08 },
  }[matThicknessPly];
  const minimumBevelInset = isRoomMockupDepth ? 1.12 : 0.85;
  const darkMatShadowLiftRatio =
    !isWhiteCore && matLightness < 0.18 ? (0.18 - matLightness) / 0.18 : 0;
  const useDarkMatShadowLift = darkMatShadowLiftRatio > 0;
  const topShadowMixAmount = clamp(
    (isWhiteCore ? 0.2 : 0.5 - darkMatShadowLiftRatio * 0.22) * matShadowBoost,
    0,
    0.72
  );
  const leftShadowMixAmount = clamp(
    (isWhiteCore ? 0.14 : 0.38 - darkMatShadowLiftRatio * 0.16) * matShadowBoost,
    0,
    0.64
  );
  const darkMatTopOuterColor = mixHexColors(
    matColor,
    "#FFFFFF",
    clamp((0.08 + darkMatShadowLiftRatio * 0.1) * matHighlightBoost, 0, 0.28)
  );
  const darkMatLeftOuterColor = mixHexColors(
    matColor,
    "#FFFFFF",
    clamp((0.06 + darkMatShadowLiftRatio * 0.08) * matHighlightBoost, 0, 0.24)
  );
  const topShadowEdgeColor = useDarkMatShadowLift
    ? darkMatTopOuterColor
    : mixHexColors(coreFaceColor, "#000000", topShadowMixAmount);
  const leftShadowEdgeColor = useDarkMatShadowLift
    ? darkMatLeftOuterColor
    : mixHexColors(coreFaceColor, "#000000", leftShadowMixAmount);
  const rightHighlightEdgeColor = mixHexColors(
    coreFaceColor,
    "#FFFFFF",
    clamp((isWhiteCore ? 0.16 : 0.26) * matHighlightBoost, 0, 0.42)
  );
  const bottomHighlightEdgeColor = mixHexColors(
    coreFaceColor,
    "#FFFFFF",
    clamp((isWhiteCore ? 0.24 : 0.34) * matHighlightBoost, 0, 0.5)
  );
  const baseBevelPalette = {
    face: coreFaceColor,
    top: {
      outer: topShadowEdgeColor,
      inner: useDarkMatShadowLift
        ? mixHexColors(coreFaceColor, topShadowEdgeColor, 0.28 + darkMatShadowLiftRatio * 0.12)
        : mixHexColors(coreFaceColor, topShadowEdgeColor, isWhiteCore ? 0.48 : 0.64),
      midOffset: useDarkMatShadowLift ? "48%" : "40%",
    },
    left: {
      outer: leftShadowEdgeColor,
      inner: useDarkMatShadowLift
        ? mixHexColors(coreFaceColor, leftShadowEdgeColor, 0.24 + darkMatShadowLiftRatio * 0.1)
        : mixHexColors(coreFaceColor, leftShadowEdgeColor, isWhiteCore ? 0.42 : 0.58),
      midOffset: useDarkMatShadowLift ? "46%" : "42%",
    },
    right: {
      outer: rightHighlightEdgeColor,
      inner: mixHexColors(coreFaceColor, rightHighlightEdgeColor, isWhiteCore ? 0.34 : 0.46),
      midOffset: "60%",
    },
    bottom: {
      outer: bottomHighlightEdgeColor,
      inner: mixHexColors(coreFaceColor, bottomHighlightEdgeColor, isWhiteCore ? 0.44 : 0.56),
      midOffset: "62%",
    },
  };
  const roomMatShadowEdgeColor = !isWhiteCore
    ? mixHexColors(
        coreFaceColor,
        "#030303",
        clamp(
          (0.2 + blackCoreLiftRatio * 0.18) * roomBevelContrast,
          0,
          0.48 + roomBevelOverdriveRatio * 0.16
        )
      )
    : useDarkMatShadowLift
      ? darkMatTopOuterColor
      : mixHexColors(
          coreFaceColor,
          "#000000",
          clamp(0.17 * roomBevelContrast, 0, 0.48 + roomBevelOverdriveRatio * 0.1)
        );
  const roomMatHighlightEdgeColor = !isWhiteCore
    ? mixHexColors(
        coreFaceColor,
        mixHexColors("#5A5A5A", "#747474", roomBevelOverdriveRatio * 0.35),
        clamp(
          (0.16 + blackCoreLiftRatio * 0.14) * roomBevelContrast,
          0,
          0.36 + roomBevelOverdriveRatio * 0.16
        )
      )
    : mixHexColors(
        coreFaceColor,
        "#FFFFFF",
        clamp(0.2 * roomBevelContrast, 0, 0.42 + roomBevelOverdriveRatio * 0.12)
      );
  const buildRoomBevelSide = (orientation: FrameOrientation): MatBevelSidePalette => {
    const { useLight, amount } = getDirectionalSurfaceValues(
      roomLightDirection,
      orientation,
      true
    );
    const edgeMixAmount = clamp(
      (isWhiteCore ? 0.36 + amount * 0.25 : 0.45 + amount * 0.25) * roomBevelContrast,
      0,
      isWhiteCore ? 0.68 + roomBevelOverdriveRatio * 0.18 : 0.72 + roomBevelOverdriveRatio * 0.16
    );
    const edgeColor = useLight
      ? mixHexColors(coreFaceColor, roomMatHighlightEdgeColor, edgeMixAmount)
      : mixHexColors(coreFaceColor, roomMatShadowEdgeColor, edgeMixAmount);
    const innerMixAmount = clamp(
      (useLight
        ? isWhiteCore ? 0.29 + amount * 0.11 : 0.39 + amount * 0.12
        : isWhiteCore ? 0.35 + amount * 0.14 : 0.48 + amount * 0.16) * roomBevelContrast,
      0,
      isWhiteCore ? 0.7 + roomBevelOverdriveRatio * 0.14 : 0.8 + roomBevelOverdriveRatio * 0.12
    );
    const midOffset = useLight
      ? `${Math.round(54 + (1 - roomBevelSoftness) * 10)}%`
      : `${Math.round(46 - (1 - roomBevelSoftness) * 10)}%`;

    return {
      outer: edgeColor,
      inner: mixHexColors(coreFaceColor, edgeColor, innerMixAmount),
      midOffset,
    };
  };
  const bevelPalette: MatBevelPalette = isRoomMockupDepth
    ? {
        face: coreFaceColor,
        top: buildRoomBevelSide("top"),
        right: buildRoomBevelSide("right"),
        bottom: buildRoomBevelSide("bottom"),
        left: buildRoomBevelSide("left"),
      }
    : baseBevelPalette;
  const frameMatOcclusionColors = buildDirectionalEdgeColors(
    roomLightDirection,
    (0.1 + roomFrameDepth * 0.08 + frameInnerLipContrast * 0.02) *
      environmentAmbientOcclusionScale,
    (0.06 + roomFrameDepth * 0.04 + frameInnerLipContrast * 0.015) *
      environmentAmbientOcclusionScale,
    true
  );
  const apertureOcclusionColors = buildDirectionalEdgeColors(
    roomLightDirection,
    ((isWhiteCore ? 0.07 : 0.085) +
      roomBevelDepth * (isWhiteCore ? 0.1 : 0.12) +
      roomBevelOverdrive * (isWhiteCore ? 0.045 : 0.06)) *
      environmentAmbientOcclusionScale,
    ((isWhiteCore ? 0.044 : 0.058) +
      roomBevelDepth * (isWhiteCore ? 0.06 : 0.07) +
      roomBevelOverdrive * (isWhiteCore ? 0.028 : 0.038)) *
      environmentAmbientOcclusionScale,
    true
  );
  const apertureEdgeAlpha = clamp(
    bevelProfile.apertureEdgeAlpha *
      (isRoomMockupDepth
        ? (0.78 + roomBevelDepth * 0.52 + roomBevelOverdrive * 0.26) *
          environmentAmbientOcclusionScale
        : 1),
    0,
    isRoomMockupDepth ? 0.2 : 0.18
  );
  const apertureEdgeColor = `rgba(0,0,0,${apertureEdgeAlpha})`;
  const frameFinishPalette: FrameFacePalette = {
    base: frameColor,
    outerLight: mixHexColors(
      frameColor,
      "#FFFFFF",
      clamp((isFlorentineFrame
        ? frameLightness > 0.55 ? 0.08 : 0.06 + darkFrameLiftRatio * 0.025
        : isMonochromeFrame
          ? 0.05 + darkFrameLiftRatio * 0.025
          : 0.04 + darkFrameLiftRatio * 0.02) * frameHighlightBoost,
        0,
        0.24 + roomFrameOverdriveRatio * 0.1)
    ),
    outerShadow: mixHexColors(
      frameColor,
      "#000000",
      clamp((isFlorentineFrame
        ? frameLightness > 0.55 ? 0.14 : 0.18 + darkFrameLiftRatio * 0.04
        : isMonochromeFrame
          ? 0.16 + darkFrameLiftRatio * 0.04
          : 0.12 + darkFrameLiftRatio * 0.035) * frameShadowBoost,
        0,
        0.42 + roomFrameOverdriveRatio * 0.12)
    ),
    innerLight: mixHexColors(
      frameColor,
      "#FFFFFF",
      clamp((isFlorentineFrame
        ? frameLightness > 0.55 ? 0.18 : 0.16 + darkFrameLiftRatio * 0.08
        : isMonochromeFrame
          ? 0.1 + darkFrameLiftRatio * 0.08
          : 0.1 + darkFrameLiftRatio * 0.07) * frameHighlightBoost,
        0,
        0.44 + roomFrameOverdriveRatio * 0.24)
    ),
    innerShadow: mixHexColors(
      frameColor,
      "#000000",
      clamp((isFlorentineFrame
        ? frameLightness > 0.55 ? 0.08 : 0.1 + darkFrameLiftRatio * 0.07
        : isMonochromeFrame
          ? 0.08 + darkFrameLiftRatio * 0.07
          : 0.06 + darkFrameLiftRatio * 0.06) * frameShadowBoost,
        0,
        0.34 + roomFrameOverdriveRatio * 0.2)
    ),
    brushedHighlight: mixHexColors(
      frameColor,
      "#FFFFFF",
      clamp((isFlorentineFrame
        ? frameLightness > 0.55 ? 0.08 : 0.12 + darkFrameLiftRatio * 0.04
        : isMonochromeFrame
          ? 0.03 + darkFrameLiftRatio * 0.04
          : 0.04 + darkFrameLiftRatio * 0.035) * frameHighlightBoost,
        0,
        0.3 + roomFrameOverdriveRatio * 0.16)
    ),
    brushedShadow: mixHexColors(
      frameColor,
      "#000000",
      clamp((isFlorentineFrame
        ? frameLightness > 0.55 ? 0.08 : 0.1 + darkFrameLiftRatio * 0.04
        : isMonochromeFrame
          ? 0.04 + darkFrameLiftRatio * 0.04
          : 0.05 + darkFrameLiftRatio * 0.035) * frameShadowBoost,
        0,
        0.28 + roomFrameOverdriveRatio * 0.14)
    ),
  };

  const geometry = useMemo(() => {
    if (!artworkSize || !openingSize || !outerMatSize || physicalScale <= 0) {
      return null;
    }

    const frameThickness =
      frameProfile.renderStyle === "none"
        ? 0
        : roundToPixel(Math.max(frameFaceWidth * physicalScale, 0));
    const matWidth = roundToPixel(outerMatSize.width * physicalScale);
    const matHeight = roundToPixel(outerMatSize.height * physicalScale);
    const openingWidth = roundToPixel(openingSize.width * physicalScale);
    const openingHeight = roundToPixel(openingSize.height * physicalScale);
    const openingBaseLeft = roundToPixel(((outerMatSize.width - openingSize.width) / 2) * physicalScale);
    const openingBaseTop = roundToPixel(((outerMatSize.height - openingSize.height) / 2) * physicalScale);
    const scaledBevelInset = bevelProfile.physicalWidth * physicalScale;
    const bevelInset = roundToPixel(Math.max(
      minimumBevelInset,
      Math.min(
        scaledBevelInset,
        openingWidth / 8,
        openingHeight / 8,
        openingBaseLeft,
        openingBaseTop
      )
    ));
    const artworkWidth = roundToPixel(artworkSize.width * physicalScale);
    const artworkHeight = roundToPixel(artworkSize.height * physicalScale);

    return {
      frameThickness,
      frameOuterWidth: roundToPixel(matWidth + frameThickness * 2),
      frameOuterHeight: roundToPixel(matHeight + frameThickness * 2),
      matWidth,
      matHeight,
      openingWidth,
      openingHeight,
      bevelOuterWidth: openingWidth + bevelInset * 2,
      bevelOuterHeight: openingHeight + bevelInset * 2,
      artworkWidth,
      artworkHeight,
      openingBaseLeft,
      openingBaseTop,
      bevelBaseLeft: openingBaseLeft - bevelInset,
      bevelBaseTop: openingBaseTop - bevelInset,
      bevelInset,
      apertureWidth: openingWidth,
      apertureHeight: openingHeight,
    };
  }, [
    artworkSize,
    bevelProfile.physicalWidth,
    frameFaceWidth,
    frameProfile.renderStyle,
    minimumBevelInset,
    openingSize,
    outerMatSize,
    physicalScale,
  ]);

  const artworkAspectRatio = getArtworkAspectRatio(artworkSize);
  const importedArtworkMetrics = useMemo(() => {
    if (
      !geometry ||
      artworkSourceMode !== "import" ||
      !artworkImageUri ||
      !artworkCrop?.sourceWidth ||
      !artworkCrop?.sourceHeight
    ) {
      return null;
    }

    return resolveArtworkCropMetrics({
      crop: artworkCrop,
      sourceWidth: artworkCrop.sourceWidth,
      sourceHeight: artworkCrop.sourceHeight,
      viewportWidth: geometry.artworkWidth,
      viewportHeight: geometry.artworkHeight,
      aspectRatio: artworkAspectRatio,
    });
  }, [
    artworkAspectRatio,
    artworkCrop,
    artworkImageUri,
    artworkSourceMode,
    geometry,
  ]);

  const renderArtworkContent = useCallback(() => {
    if (!geometry) {
      return null;
    }

    if (artworkSourceMode === "import" && artworkImageUri) {
      return (
        <View
          style={{
            width: geometry.artworkWidth,
            height: geometry.artworkHeight,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri: artworkImageUri }}
            style={
              importedArtworkMetrics
                ? {
                    width: importedArtworkMetrics.imageWidth * importedArtworkMetrics.zoomScale,
                    height: importedArtworkMetrics.imageHeight * importedArtworkMetrics.zoomScale,
                    transform: [
                      { translateX: importedArtworkMetrics.offsetX },
                      { translateY: importedArtworkMetrics.offsetY },
                    ],
                  }
                : {
                    width: geometry.artworkWidth,
                    height: geometry.artworkHeight,
                  }
            }
            resizeMode="cover"
          />
        </View>
      );
    }

    return (
      <View
        style={{
          width: geometry.artworkWidth,
          height: geometry.artworkHeight,
          backgroundColor: "#DDD6CC",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.08)",
        }}
      >
        <Ionicons name="image-outline" size={Math.max(12, Math.min(24, geometry.artworkWidth / 5))} color="#857B70" />
      </View>
    );
  }, [artworkImageUri, artworkSourceMode, geometry, importedArtworkMetrics]);

  if (!geometry) {
    return null;
  }

  const glassReflectionStrength =
    isRoomMockupDepth && roomMaterialRealism.glassEnabled
      ? roomMaterialRealism.reflectionStrength
      : 0;
  const glassReflectionOverlay =
    glassReflectionStrength > 0.001 ? (
      <GlassReflectionOverlay
        width={geometry.matWidth}
        height={geometry.matHeight}
        lightDirection={roomLightDirection}
        strength={glassReflectionStrength}
        warmth={roomEnvironment.warmth}
        highlightScale={environmentHighlightScale}
      />
    ) : null;

  const bevelOpeningContent = (
    <View
      style={{
        position: "absolute",
        left: geometry.bevelBaseLeft + offsetX * physicalScale,
        top: geometry.bevelBaseTop + offsetY * physicalScale,
        width: geometry.bevelOuterWidth,
        height: geometry.bevelOuterHeight,
        backgroundColor: bevelPalette.face,
        overflow: "hidden",
      }}
    >
      <MatBevelOverlay
        width={geometry.bevelOuterWidth}
        height={geometry.bevelOuterHeight}
        inset={geometry.bevelInset}
        palette={bevelPalette}
      />

      <View
        style={{
          position: "absolute",
          left: geometry.bevelInset,
          top: geometry.bevelInset,
          width: geometry.apertureWidth,
          height: geometry.apertureHeight,
          backgroundColor: mountingBoardColor,
          overflow: "hidden",
          borderWidth: isRoomMockupDepth ? 0 : 1,
          borderColor: apertureEdgeColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {renderArtworkContent()}
        {isRoomMockupDepth ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderBottomWidth: 1,
              borderRightWidth: 1,
              borderTopColor: apertureOcclusionColors.top,
              borderLeftColor: apertureOcclusionColors.left,
              borderBottomColor: apertureOcclusionColors.bottom,
              borderRightColor: apertureOcclusionColors.right,
            }}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <View
      pointerEvents="none"
      style={[
        {
          width: geometry.frameOuterWidth,
          height: geometry.frameOuterHeight,
          backgroundColor: geometry.frameThickness > 0 ? frameFinishPalette.base : "transparent",
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: showShadow
            ? isRoomMockupDepth
              ? isDark ? 0.38 : 0.3
              : isDark ? 0.28 : 0.18
            : 0,
          shadowRadius: showShadow ? (isRoomMockupDepth ? 18 : 12) : 0,
          shadowOffset: {
            width: isRoomMockupDepth ? 3 : 0,
            height: showShadow ? (isRoomMockupDepth ? 9 : 6) : 0,
          },
        },
        style,
      ]}
    >
      {geometry.frameThickness > 0 ? (
        <>
          <FrameFaceOverlay
            width={geometry.frameOuterWidth}
            height={geometry.frameOuterHeight}
            thickness={geometry.frameThickness}
            palette={frameFinishPalette}
            renderStyle={frameProfile.renderStyle}
            depthIntensity={frameFaceDepthIntensity}
            lightDirection={isRoomMockupDepth ? roomLightDirection : undefined}
            innerLipContrast={frameInnerLipContrast}
          />
          <View
            style={{
              position: "absolute",
              left: geometry.frameThickness,
              top: geometry.frameThickness,
              width: geometry.matWidth,
              height: geometry.matHeight,
              backgroundColor: matColor,
              overflow: "hidden",
            }}
          >
            {bevelOpeningContent}
            {isRoomMockupDepth ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  borderTopWidth: 2,
                  borderLeftWidth: 2,
                  borderBottomWidth: 1,
                  borderRightWidth: 1,
                  borderTopColor: frameMatOcclusionColors.top,
                  borderLeftColor: frameMatOcclusionColors.left,
                  borderBottomColor: frameMatOcclusionColors.bottom,
                  borderRightColor: frameMatOcclusionColors.right,
                }}
              />
            ) : null}
            {glassReflectionOverlay}
          </View>
        </>
      ) : (
        <View
          style={{
            width: geometry.matWidth,
            height: geometry.matHeight,
            backgroundColor: matColor,
            overflow: "hidden",
          }}
        >
          {bevelOpeningContent}
          {glassReflectionOverlay}
        </View>
      )}
      {isRoomMockupDepth && roomEnvironment.ambientTintOpacity > 0.001 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: roomEnvironment.ambientTintColor,
          }}
        />
      ) : null}
      {isRoomMockupDepth && roomEnvironment.ambientDimmingOpacity > 0.001 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: roomEnvironment.ambientDimmingColor,
          }}
        />
      ) : null}
      {isRoomMockupDepth && roomEnvironment.edgeBlendOpacity > 0.001 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            borderWidth: Math.max(1, PixelRatio.roundToNearestPixel(1)),
            borderColor: roomEnvironment.edgeBlendColor,
          }}
        />
      ) : null}
    </View>
  );
}

export default function MatPreviewCanvas({
  artworkSize,
  openingSize,
  outerMatSize,
  frameProfileId,
  frameColorHex,
  matThicknessPly,
  matColorHex,
  matCoreColor,
  mountingBoardColorHex,
  offsetX,
  offsetY,
  snapIncrement,
  artworkSourceMode,
  artworkImageUri,
  artworkCrop,
  onAdjustOffsets,
  onLiveOffsetsChange,
  onDragStateChange,
  canvasHeight = 420,
  layoutVariant = "default",
}: MatPreviewCanvasProps) {
  const { colors, radii, spacing, typography, isDark } = useAppTheme();
  const unit = useAppSettingsStore((state) => state.unit);
  const canvasBackgroundColorHex = useAppSettingsStore((state) => state.canvasBackgroundColorHex);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const latestOffsetsRef = useRef({ offsetX, offsetY });
  const isDraggingRef = useRef(false);
  const openingOffsetX = useSharedValue(offsetX);
  const openingOffsetY = useSharedValue(offsetY);
  const dragStartOffsetX = useSharedValue(offsetX);
  const dragStartOffsetY = useSharedValue(offsetY);
  const previewScale = useSharedValue(1);
  const maxOffsetX = useSharedValue(0);
  const maxOffsetY = useSharedValue(0);
  const liveOffsetsFrameRef = useRef<number | null>(null);
  const pendingLiveOffsetsRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  const isWorkspaceLayout = layoutVariant === "workspace";
  const previewInset = isWorkspaceLayout ? spacing.lg : spacing.md;
  const frameProfile = getFrameProfile(frameProfileId);
  const frameFaceWidth =
    unit === "cm" ? frameProfile.faceWidthInches * 2.54 : frameProfile.faceWidthInches;
  const frameColor = normalizeHex(frameColorHex, "#050505");
  const matColor = normalizeHex(matColorHex, "#F4F0E8");
  const mountingBoardColor = normalizeHex(mountingBoardColorHex, "#FFFFFF");
  const matLightness = hexToHsl(matColor).l;
  const isWhiteCore = matCoreColor === "white";
  const coreFaceColor = isWhiteCore ? "#F8F7F2" : "#161616";
  const isFlorentineFrame = frameProfile.renderStyle === "florentine";
  const isMonochromeFrame = frameProfile.renderStyle === "monochrome";
  const previewCardColor = normalizeHex(
    canvasBackgroundColorHex,
    DEFAULT_CANVAS_BACKGROUND_COLOR_HEX
  );
  const previewCardBorderColor = colors.borderStrong;
  const previewCardPaddingHorizontal = isWorkspaceLayout ? spacing.xl : spacing.lg;
  const previewCardPaddingTop = isWorkspaceLayout ? spacing.lg : spacing.md;
  const previewCardPaddingBottom = isWorkspaceLayout ? spacing.xl : spacing.lg;
  const previewStagePaddingHorizontal = isWorkspaceLayout
    ? spacing.xxxl
    : isDark
      ? spacing.xl
      : spacing.lg;
  const previewStagePaddingTop = isWorkspaceLayout ? spacing.xl : spacing.md;
  const previewStagePaddingBottom = isWorkspaceLayout
    ? spacing.xxxl
    : isDark
      ? spacing.xl
      : spacing.lg;
  const bevelUnitScale = unit === "cm" ? 2.54 : 1;
  const bevelVisualScale = 1.5625;
  const bevelThicknessMultiplier = {
    2: 1,
    4: 1,
    6: 1,
    8: 1,
  }[matThicknessPly];
  const bevelProfile = {
    2: { physicalWidth: 0.045 * bevelUnitScale * bevelVisualScale * bevelThicknessMultiplier, apertureEdgeAlpha: 0.045 },
    4: { physicalWidth: 0.08 * bevelUnitScale * bevelVisualScale * bevelThicknessMultiplier, apertureEdgeAlpha: 0.06 },
    6: { physicalWidth: 0.11 * bevelUnitScale * bevelVisualScale * bevelThicknessMultiplier, apertureEdgeAlpha: 0.07 },
    8: { physicalWidth: 0.14 * bevelUnitScale * bevelVisualScale * bevelThicknessMultiplier, apertureEdgeAlpha: 0.08 },
  }[matThicknessPly];
  const minimumBevelInset = 0.85;
  const darkMatShadowLiftRatio =
    !isWhiteCore && matLightness < 0.18 ? (0.18 - matLightness) / 0.18 : 0;
  const useDarkMatShadowLift = darkMatShadowLiftRatio > 0;
  const topShadowMixAmount = isWhiteCore ? 0.2 : 0.5 - darkMatShadowLiftRatio * 0.22;
  const leftShadowMixAmount = isWhiteCore ? 0.14 : 0.38 - darkMatShadowLiftRatio * 0.16;
  const darkMatTopOuterColor = mixHexColors(
    matColor,
    "#FFFFFF",
    0.08 + darkMatShadowLiftRatio * 0.1
  );
  const darkMatLeftOuterColor = mixHexColors(
    matColor,
    "#FFFFFF",
    0.06 + darkMatShadowLiftRatio * 0.08
  );
  const topShadowEdgeColor = useDarkMatShadowLift
    ? darkMatTopOuterColor
    : mixHexColors(coreFaceColor, "#000000", topShadowMixAmount);
  const leftShadowEdgeColor = useDarkMatShadowLift
    ? darkMatLeftOuterColor
    : mixHexColors(coreFaceColor, "#000000", leftShadowMixAmount);
  const rightHighlightEdgeColor = mixHexColors(coreFaceColor, "#FFFFFF", isWhiteCore ? 0.16 : 0.26);
  const bottomHighlightEdgeColor = mixHexColors(coreFaceColor, "#FFFFFF", isWhiteCore ? 0.24 : 0.34);
  const bevelPalette = {
    face: coreFaceColor,
    top: {
      outer: topShadowEdgeColor,
      inner: useDarkMatShadowLift
        ? mixHexColors(coreFaceColor, topShadowEdgeColor, 0.28 + darkMatShadowLiftRatio * 0.12)
        : mixHexColors(coreFaceColor, topShadowEdgeColor, isWhiteCore ? 0.48 : 0.64),
      midOffset: useDarkMatShadowLift ? "48%" : "40%",
    },
    left: {
      outer: leftShadowEdgeColor,
      inner: useDarkMatShadowLift
        ? mixHexColors(coreFaceColor, leftShadowEdgeColor, 0.24 + darkMatShadowLiftRatio * 0.1)
        : mixHexColors(coreFaceColor, leftShadowEdgeColor, isWhiteCore ? 0.42 : 0.58),
      midOffset: useDarkMatShadowLift ? "46%" : "42%",
    },
    right: {
      outer: rightHighlightEdgeColor,
      inner: mixHexColors(coreFaceColor, rightHighlightEdgeColor, isWhiteCore ? 0.34 : 0.46),
      midOffset: "60%",
    },
    bottom: {
      outer: bottomHighlightEdgeColor,
      inner: mixHexColors(coreFaceColor, bottomHighlightEdgeColor, isWhiteCore ? 0.44 : 0.56),
      midOffset: "62%",
    },
  };
  const apertureEdgeColor = `rgba(0,0,0,${bevelProfile.apertureEdgeAlpha})`;
  const frameLightness = hexToHsl(frameColor).l;
  const frameFinishPalette: FrameFacePalette = {
    base: frameColor,
    outerLight: mixHexColors(
      frameColor,
      "#FFFFFF",
      isFlorentineFrame
        ? frameLightness > 0.55 ? 0.08 : 0.06
        : isMonochromeFrame
          ? 0.05
          : 0.04
    ),
    outerShadow: mixHexColors(
      frameColor,
      "#000000",
      isFlorentineFrame
        ? frameLightness > 0.55 ? 0.14 : 0.18
        : isMonochromeFrame
          ? 0.16
          : 0.12
    ),
    innerLight: mixHexColors(
      frameColor,
      "#FFFFFF",
      isFlorentineFrame
        ? frameLightness > 0.55 ? 0.18 : 0.16
        : isMonochromeFrame
          ? 0.1
          : 0.1
    ),
    innerShadow: mixHexColors(
      frameColor,
      "#000000",
      isFlorentineFrame
        ? frameLightness > 0.55 ? 0.08 : 0.1
        : isMonochromeFrame
          ? 0.08
          : 0.06
    ),
    brushedHighlight: mixHexColors(
      frameColor,
      "#FFFFFF",
      isFlorentineFrame
        ? frameLightness > 0.55 ? 0.08 : 0.12
        : isMonochromeFrame
          ? 0.03
          : 0.04
    ),
    brushedShadow: mixHexColors(
      frameColor,
      "#000000",
      isFlorentineFrame
        ? frameLightness > 0.55 ? 0.08 : 0.1
        : isMonochromeFrame
          ? 0.04
          : 0.05
    ),
  };

  useEffect(() => {
    latestOffsetsRef.current = { offsetX, offsetY };
    if (!isDraggingRef.current) {
      openingOffsetX.value = offsetX;
      openingOffsetY.value = offsetY;
    }
  }, [offsetX, offsetY, openingOffsetX, openingOffsetY]);

  useEffect(
    () => () => {
      if (liveOffsetsFrameRef.current !== null) {
        cancelAnimationFrame(liveOffsetsFrameRef.current);
      }
    },
    []
  );

  const previewGeometry = useMemo(() => {
    if (!artworkSize || !openingSize || !outerMatSize || canvasSize.width <= 0 || canvasSize.height <= 0) {
      return null;
    }

    const safeWidth = Math.max(canvasSize.width - previewInset * 2, 1);
    const safeHeight = Math.max(canvasSize.height - previewInset * 2, 1);
    const scale = Math.min(
      safeWidth / Math.max(outerMatSize.width + frameFaceWidth * 2, 1),
      safeHeight / Math.max(outerMatSize.height + frameFaceWidth * 2, 1)
    );
    const frameThickness =
      frameProfile.renderStyle === "none"
        ? 0
        : roundToPixel(Math.max(frameFaceWidth * scale, 1 / PixelRatio.get()));
    const matWidth = roundToPixel(outerMatSize.width * scale);
    const matHeight = roundToPixel(outerMatSize.height * scale);
    const openingWidth = roundToPixel(openingSize.width * scale);
    const openingHeight = roundToPixel(openingSize.height * scale);
    const openingBaseLeft = roundToPixel(((outerMatSize.width - openingSize.width) / 2) * scale);
    const openingBaseTop = roundToPixel(((outerMatSize.height - openingSize.height) / 2) * scale);
    const scaledBevelInset = bevelProfile.physicalWidth * scale;
    const bevelInset = roundToPixel(Math.max(
      minimumBevelInset,
      Math.min(
        scaledBevelInset,
        openingWidth / 8,
        openingHeight / 8,
        openingBaseLeft,
        openingBaseTop
      )
    ));
    const apertureWidth = openingWidth;
    const apertureHeight = openingHeight;
    const artworkWidth = roundToPixel(artworkSize.width * scale);
    const artworkHeight = roundToPixel(artworkSize.height * scale);

    return {
      scale,
      frameHeightInches: frameProfile.heightInches,
      frameRabbetInches: frameProfile.rabbetInches,
      frameThickness,
      frameOuterWidth: roundToPixel(matWidth + frameThickness * 2),
      frameOuterHeight: roundToPixel(matHeight + frameThickness * 2),
      matWidth,
      matHeight,
      openingWidth,
      openingHeight,
      bevelOuterWidth: openingWidth + bevelInset * 2,
      bevelOuterHeight: openingHeight + bevelInset * 2,
      artworkWidth,
      artworkHeight,
      openingBaseLeft,
      openingBaseTop,
      bevelBaseLeft: openingBaseLeft - bevelInset,
      bevelBaseTop: openingBaseTop - bevelInset,
      bevelInset,
      apertureWidth,
      apertureHeight,
    };
  }, [
    artworkSize,
    bevelProfile.physicalWidth,
    canvasSize.height,
    canvasSize.width,
    frameFaceWidth,
    frameProfile.heightInches,
    frameProfile.rabbetInches,
    frameProfile.renderStyle,
    minimumBevelInset,
    openingSize,
    outerMatSize,
    previewInset,
  ]);

  const artworkAspectRatio = getArtworkAspectRatio(artworkSize);
  const importedArtworkMetrics = useMemo(() => {
    if (
      !previewGeometry ||
      artworkSourceMode !== "import" ||
      !artworkImageUri ||
      !artworkCrop?.sourceWidth ||
      !artworkCrop?.sourceHeight
    ) {
      return null;
    }

    return resolveArtworkCropMetrics({
      crop: artworkCrop,
      sourceWidth: artworkCrop.sourceWidth,
      sourceHeight: artworkCrop.sourceHeight,
      viewportWidth: previewGeometry.artworkWidth,
      viewportHeight: previewGeometry.artworkHeight,
      aspectRatio: artworkAspectRatio,
    });
  }, [
    artworkAspectRatio,
    artworkCrop,
    artworkImageUri,
    artworkSourceMode,
    previewGeometry,
  ]);

  useEffect(() => {
    previewScale.value = previewGeometry?.scale ?? 1;
    const bounds = getOffsetBounds(outerMatSize, openingSize);
    maxOffsetX.value = bounds.maxOffsetX;
    maxOffsetY.value = bounds.maxOffsetY;
  }, [maxOffsetX, maxOffsetY, openingSize, outerMatSize, previewGeometry?.scale, previewScale]);

  const flushLiveOffsets = useCallback(() => {
    liveOffsetsFrameRef.current = null;

    if (!pendingLiveOffsetsRef.current) {
      return;
    }

    const nextOffsets = pendingLiveOffsetsRef.current;
    pendingLiveOffsetsRef.current = null;
    onLiveOffsetsChange?.(nextOffsets.offsetX, nextOffsets.offsetY);
  }, [onLiveOffsetsChange]);

  const queueLiveOffsets = useCallback(
    (offsetX: number, offsetY: number) => {
      pendingLiveOffsetsRef.current = { offsetX, offsetY };

      if (liveOffsetsFrameRef.current !== null) {
        return;
      }

      liveOffsetsFrameRef.current = requestAnimationFrame(() => {
        flushLiveOffsets();
      });
    },
    [flushLiveOffsets]
  );

  const beginDrag = useCallback((nextOffsetX: number, nextOffsetY: number) => {
    isDraggingRef.current = true;
    latestOffsetsRef.current = { offsetX: nextOffsetX, offsetY: nextOffsetY };
    onDragStateChange?.(true);
  }, [onDragStateChange]);

  const commitDrag = useCallback(
    (nextOffsetX: number, nextOffsetY: number) => {
      if (liveOffsetsFrameRef.current !== null) {
        cancelAnimationFrame(liveOffsetsFrameRef.current);
        liveOffsetsFrameRef.current = null;
      }

      pendingLiveOffsetsRef.current = null;
      isDraggingRef.current = false;
      latestOffsetsRef.current = { offsetX: nextOffsetX, offsetY: nextOffsetY };
      onLiveOffsetsChange?.(nextOffsetX, nextOffsetY);
      onAdjustOffsets(nextOffsetX, nextOffsetY);
      onDragStateChange?.(false);
    },
    [onAdjustOffsets, onDragStateChange, onLiveOffsetsChange]
  );

  const cancelDrag = useCallback(
    (nextOffsetX: number, nextOffsetY: number) => {
      if (liveOffsetsFrameRef.current !== null) {
        cancelAnimationFrame(liveOffsetsFrameRef.current);
        liveOffsetsFrameRef.current = null;
      }

      pendingLiveOffsetsRef.current = null;
      isDraggingRef.current = false;
      latestOffsetsRef.current = { offsetX: nextOffsetX, offsetY: nextOffsetY };
      onLiveOffsetsChange?.(nextOffsetX, nextOffsetY);
      onDragStateChange?.(false);
    },
    [onDragStateChange, onLiveOffsetsChange]
  );

  const openingOffsetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: openingOffsetX.value * previewScale.value },
      { translateY: openingOffsetY.value * previewScale.value },
    ],
  }));

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Boolean(previewGeometry))
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          const startOffsetX = openingOffsetX.value;
          const startOffsetY = openingOffsetY.value;
          dragStartOffsetX.value = startOffsetX;
          dragStartOffsetY.value = startOffsetY;
          runOnJS(beginDrag)(startOffsetX, startOffsetY);
        })
        .onUpdate((event) => {
          const scale = previewScale.value;

          if (!scale) {
            return;
          }

          const rawOffsetX = dragStartOffsetX.value + event.translationX / scale;
          const rawOffsetY = dragStartOffsetY.value + event.translationY / scale;
          const clampedOffsetX = Math.max(-maxOffsetX.value, Math.min(maxOffsetX.value, rawOffsetX));
          const clampedOffsetY = Math.max(-maxOffsetY.value, Math.min(maxOffsetY.value, rawOffsetY));

          openingOffsetX.value = clampedOffsetX;
          openingOffsetY.value = clampedOffsetY;
          runOnJS(queueLiveOffsets)(clampedOffsetX, clampedOffsetY);
        })
        .onEnd(() => {
          const snappedOffsetX = Math.max(
            -maxOffsetX.value,
            Math.min(maxOffsetX.value, snapToIncrement(openingOffsetX.value, snapIncrement))
          );
          const snappedOffsetY = Math.max(
            -maxOffsetY.value,
            Math.min(maxOffsetY.value, snapToIncrement(openingOffsetY.value, snapIncrement))
          );

          openingOffsetX.value = snappedOffsetX;
          openingOffsetY.value = snappedOffsetY;
          runOnJS(commitDrag)(snappedOffsetX, snappedOffsetY);
        })
        .onFinalize((_event, success) => {
          if (success) {
            return;
          }

          const fallbackOffsets = {
            offsetX: Math.max(
              -maxOffsetX.value,
              Math.min(maxOffsetX.value, openingOffsetX.value)
            ),
            offsetY: Math.max(
              -maxOffsetY.value,
              Math.min(maxOffsetY.value, openingOffsetY.value)
            ),
          };

          openingOffsetX.value = fallbackOffsets.offsetX;
          openingOffsetY.value = fallbackOffsets.offsetY;
          runOnJS(cancelDrag)(fallbackOffsets.offsetX, fallbackOffsets.offsetY);
        }),
    [
      beginDrag,
      cancelDrag,
      commitDrag,
      dragStartOffsetX,
      dragStartOffsetY,
      maxOffsetX,
      maxOffsetY,
      openingOffsetX,
      openingOffsetY,
      previewGeometry,
      previewScale,
      queueLiveOffsets,
      snapIncrement,
    ]
  );

  const renderArtworkContent = useCallback(() => {
    if (!previewGeometry) {
      return null;
    }

    if (artworkSourceMode === "import" && artworkImageUri) {
      return (
        <View
          style={{
            width: previewGeometry.artworkWidth,
            height: previewGeometry.artworkHeight,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri: artworkImageUri }}
            style={
              importedArtworkMetrics
                ? {
                    width: importedArtworkMetrics.imageWidth * importedArtworkMetrics.zoomScale,
                    height: importedArtworkMetrics.imageHeight * importedArtworkMetrics.zoomScale,
                    transform: [
                      { translateX: importedArtworkMetrics.offsetX },
                      { translateY: importedArtworkMetrics.offsetY },
                    ],
                  }
                : {
                    width: previewGeometry.artworkWidth,
                    height: previewGeometry.artworkHeight,
                  }
            }
            resizeMode="cover"
          />
        </View>
      );
    }

    return (
      <View
        style={{
          width: previewGeometry.artworkWidth,
          height: previewGeometry.artworkHeight,
          backgroundColor: "#DDD6CC",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.08)",
        }}
      >
        <Ionicons name="image-outline" size={24} color="#857B70" />
      </View>
    );
  }, [artworkImageUri, artworkSourceMode, importedArtworkMetrics, previewGeometry]);

  const bevelOpeningContent = previewGeometry ? (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: previewGeometry.bevelBaseLeft,
            top: previewGeometry.bevelBaseTop,
            width: previewGeometry.bevelOuterWidth,
            height: previewGeometry.bevelOuterHeight,
            backgroundColor: bevelPalette.face,
            overflow: "hidden",
          },
          openingOffsetAnimatedStyle,
        ]}
      >
        <MatBevelOverlay
          width={previewGeometry.bevelOuterWidth}
          height={previewGeometry.bevelOuterHeight}
          inset={previewGeometry.bevelInset}
          palette={bevelPalette}
        />

        <View
          style={{
            position: "absolute",
            left: previewGeometry.bevelInset,
            top: previewGeometry.bevelInset,
            width: previewGeometry.apertureWidth,
            height: previewGeometry.apertureHeight,
            backgroundColor: mountingBoardColor,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: apertureEdgeColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {renderArtworkContent()}
        </View>
      </Animated.View>
    </GestureDetector>
  ) : null;

  return (
    <View
      style={{
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: previewCardBorderColor,
        backgroundColor: previewCardColor,
        paddingHorizontal: previewCardPaddingHorizontal,
        paddingTop: previewCardPaddingTop,
        paddingBottom: previewCardPaddingBottom,
      }}
    >
      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setCanvasSize({ width, height });
        }}
        style={{
          width: "100%",
          height: canvasHeight,
          borderRadius: 0,
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {!previewGeometry ? (
          <View style={{ alignItems: "center", paddingHorizontal: spacing.lg }}>
            <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
            <Text style={{ ...typography.small, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm }}>
              Add artwork size and outer mat size to see a live preview.
            </Text>
          </View>
        ) : (
          <View
            style={{
              width: previewGeometry.frameOuterWidth + previewStagePaddingHorizontal * 2,
              height:
                previewGeometry.frameOuterHeight +
                previewStagePaddingTop +
                previewStagePaddingBottom,
              position: "relative",
              backgroundColor: "transparent",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                left: previewStagePaddingHorizontal,
                top: previewStagePaddingTop,
                width: previewGeometry.frameOuterWidth,
                height: previewGeometry.frameOuterHeight,
                backgroundColor:
                  previewGeometry.frameThickness > 0 ? frameFinishPalette.base : "transparent",
                overflow: "hidden",
                shadowColor: "#000",
                shadowOpacity: isDark ? 0.2 : 0.12,
                shadowRadius: isDark ? 16 : 12,
                shadowOffset: { width: 0, height: 8 },
              }}
            >
              {previewGeometry.frameThickness > 0 ? (
                <>
                  <FrameFaceOverlay
                    width={previewGeometry.frameOuterWidth}
                    height={previewGeometry.frameOuterHeight}
                    thickness={previewGeometry.frameThickness}
                    palette={frameFinishPalette}
                    renderStyle={frameProfile.renderStyle}
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: previewGeometry.frameThickness,
                      top: previewGeometry.frameThickness,
                      width: previewGeometry.matWidth,
                      height: previewGeometry.matHeight,
                      backgroundColor: matColor,
                      overflow: "hidden",
                    }}
                  >
                    {bevelOpeningContent}
                  </View>
                </>
              ) : (
                <View
                  style={{
                    width: previewGeometry.matWidth,
                    height: previewGeometry.matHeight,
                    backgroundColor: matColor,
                    overflow: "hidden",
                  }}
                >
                  {bevelOpeningContent}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
