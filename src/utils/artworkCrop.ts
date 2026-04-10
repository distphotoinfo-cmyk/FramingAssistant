import type { ArtworkCropState, SizeInput } from "../types/framing";
import type { NumericSize } from "./framingGeometry";
import { parseMeasurement } from "./formatters";

const ARTWORK_CROP_ASPECT_PRECISION = 6;
const ARTWORK_CROP_ASPECT_EPSILON = 0.001;

export const MAX_ARTWORK_CROP_ZOOM = 5;

export interface ArtworkCropViewport {
  width: number;
  height: number;
}

export interface ArtworkCropRenderMetrics {
  imageWidth: number;
  imageHeight: number;
  zoomScale: number;
  offsetX: number;
  offsetY: number;
}

function roundRatio(value: number) {
  return Number(value.toFixed(ARTWORK_CROP_ASPECT_PRECISION));
}

export function getArtworkAspectRatio(artworkSize: NumericSize | null) {
  if (!artworkSize || artworkSize.width <= 0 || artworkSize.height <= 0) {
    return null;
  }

  return roundRatio(artworkSize.width / artworkSize.height);
}

export function getArtworkAspectRatioFromInput(size: SizeInput) {
  const width = parseMeasurement(size.width);
  const height = parseMeasurement(size.height);

  if (width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }

  return roundRatio(width / height);
}

export function isArtworkCropCompatible(
  crop: ArtworkCropState | null | undefined,
  aspectRatio: number | null
) {
  if (!crop || aspectRatio === null) {
    return false;
  }

  return Math.abs(crop.aspectRatio - roundRatio(aspectRatio)) <= ARTWORK_CROP_ASPECT_EPSILON;
}

export function getCoverImageSize(
  sourceWidth: number,
  sourceHeight: number,
  viewportWidth: number,
  viewportHeight: number
) {
  "worklet";
  const imageAspectRatio = sourceWidth / sourceHeight;
  const viewportAspectRatio = viewportWidth / viewportHeight;

  if (imageAspectRatio > viewportAspectRatio) {
    const height = viewportHeight;
    return {
      width: height * imageAspectRatio,
      height,
    };
  }

  const width = viewportWidth;
  return {
    width,
    height: width / imageAspectRatio,
  };
}

export function clampArtworkCropTransform({
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  zoomScale,
  offsetX,
  offsetY,
}: {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  zoomScale: number;
  offsetX: number;
  offsetY: number;
}) {
  "worklet";
  const clampedZoomScale = Math.max(1, Math.min(MAX_ARTWORK_CROP_ZOOM, zoomScale));
  const coverSize = getCoverImageSize(sourceWidth, sourceHeight, viewportWidth, viewportHeight);
  const displayedWidth = coverSize.width * clampedZoomScale;
  const displayedHeight = coverSize.height * clampedZoomScale;
  const maxOffsetX = Math.max((displayedWidth - viewportWidth) / 2, 0);
  const maxOffsetY = Math.max((displayedHeight - viewportHeight) / 2, 0);

  return {
    imageWidth: coverSize.width,
    imageHeight: coverSize.height,
    zoomScale: clampedZoomScale,
    offsetX: Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX)),
    offsetY: Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY)),
  };
}

export function resolveArtworkCropMetrics({
  crop,
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  aspectRatio,
}: {
  crop: ArtworkCropState | null | undefined;
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: number | null;
}) {
  const activeCrop = isArtworkCropCompatible(crop, aspectRatio) ? crop : null;

  return clampArtworkCropTransform({
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    zoomScale: activeCrop?.zoomScale ?? 1,
    offsetX: (activeCrop?.offsetXRatio ?? 0) * viewportWidth,
    offsetY: (activeCrop?.offsetYRatio ?? 0) * viewportHeight,
  });
}

export function buildStoredArtworkCrop({
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  zoomScale,
  offsetX,
  offsetY,
  aspectRatio,
}: {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  zoomScale: number;
  offsetX: number;
  offsetY: number;
  aspectRatio: number;
}): ArtworkCropState {
  const clamped = clampArtworkCropTransform({
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    zoomScale,
    offsetX,
    offsetY,
  });

  return {
    sourceWidth,
    sourceHeight,
    aspectRatio: roundRatio(aspectRatio),
    zoomScale: Number(clamped.zoomScale.toFixed(4)),
    offsetXRatio:
      viewportWidth > 0 ? Number((clamped.offsetX / viewportWidth).toFixed(6)) : 0,
    offsetYRatio:
      viewportHeight > 0 ? Number((clamped.offsetY / viewportHeight).toFixed(6)) : 0,
  };
}
