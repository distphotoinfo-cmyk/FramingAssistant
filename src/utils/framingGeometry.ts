import type {
  FrameProfileId,
  FramingProjectDraft,
  MeasurementUnit,
  SizeInput,
} from "../types/framing";
import { parseMeasurement, roundMeasurementString } from "./formatters";
import { getFrameProfile } from "./frameProfiles";

export interface NumericSize {
  width: number;
  height: number;
}

export interface MatMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DerivedFramingGeometry {
  artworkSize: NumericSize | null;
  openingSize: NumericSize | null;
  outerMatSize: NumericSize | null;
  margins: MatMargins | null;
  isValidGeometry: boolean;
}

export function parseSizeInput(size: SizeInput): NumericSize | null {
  const width = parseMeasurement(size.width);
  const height = parseMeasurement(size.height);

  if (width === null || height === null) {
    return null;
  }

  return { width, height };
}

export function calculateOpeningSize(
  artworkSize: NumericSize | null,
  openingBehavior: FramingProjectDraft["reveal"]["openingBehavior"],
  openingAmount: string
) {
  const amount = parseMeasurement(openingAmount);
  if (!artworkSize || amount === null) {
    return null;
  }

  const direction = openingBehavior === "overlap" ? -1 : 1;
  return {
    width: Math.max(artworkSize.width + direction * amount * 2, 0),
    height: Math.max(artworkSize.height + direction * amount * 2, 0),
  };
}

export function getOffsetBounds(outerMatSize: NumericSize | null, openingSize: NumericSize | null) {
  if (!outerMatSize || !openingSize) {
    return { maxOffsetX: 0, maxOffsetY: 0 };
  }

  return {
    maxOffsetX: Math.max((outerMatSize.width - openingSize.width) / 2, 0),
    maxOffsetY: Math.max((outerMatSize.height - openingSize.height) / 2, 0),
  };
}

export function clampOffsets(
  outerMatSize: NumericSize | null,
  openingSize: NumericSize | null,
  offsetX: number,
  offsetY: number
) {
  const { maxOffsetX, maxOffsetY } = getOffsetBounds(outerMatSize, openingSize);
  return {
    offsetX: Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX)),
    offsetY: Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY)),
  };
}

export function calculateMargins(
  outerMatSize: NumericSize | null,
  openingSize: NumericSize | null,
  offsetX: number,
  offsetY: number
): MatMargins | null {
  if (!outerMatSize || !openingSize) {
    return null;
  }

  const clamped = clampOffsets(outerMatSize, openingSize, offsetX, offsetY);
  const baseLeft = (outerMatSize.width - openingSize.width) / 2;
  const baseTop = (outerMatSize.height - openingSize.height) / 2;

  return {
    left: baseLeft + clamped.offsetX,
    right: baseLeft - clamped.offsetX,
    top: baseTop + clamped.offsetY,
    bottom: baseTop - clamped.offsetY,
  };
}

export function buildDerivedGeometry(draft: FramingProjectDraft): DerivedFramingGeometry {
  const artworkSize = parseSizeInput(draft.artwork.artworkSize);
  const outerMatSize = parseSizeInput(draft.outerMat.outerMatSize);
  const openingSize = calculateOpeningSize(artworkSize, draft.reveal.openingBehavior, draft.reveal.openingAmount);
  const offsetX = draft.preview?.offsetX ?? 0;
  const offsetY = draft.preview?.offsetY ?? 0;
  const margins = calculateMargins(outerMatSize, openingSize, offsetX, offsetY);

  const isValidGeometry = Boolean(
    outerMatSize &&
      openingSize &&
      outerMatSize.width >= openingSize.width &&
      outerMatSize.height >= openingSize.height
  );

  return {
    artworkSize,
    openingSize,
    outerMatSize,
    margins,
    isValidGeometry,
  };
}

export function toStoredSize(size: NumericSize | null): SizeInput {
  if (!size) {
    return { width: "", height: "" };
  }

  return {
    width: roundMeasurementString(size.width),
    height: roundMeasurementString(size.height),
  };
}

export function getDefaultOpeningAmount(unit: MeasurementUnit) {
  return unit === "in" ? "0.125" : "0.3";
}

export function measurementToInches(value: number, unit: MeasurementUnit) {
  return unit === "cm" ? value / 2.54 : value;
}

export function inchesToMeasurementUnit(value: number, unit: MeasurementUnit) {
  return unit === "cm" ? value * 2.54 : value;
}

export function getFinishedFrameOuterSizeInches(
  outerMatSize: NumericSize | null,
  frameProfileId: FrameProfileId,
  unit: MeasurementUnit
): NumericSize | null {
  if (!outerMatSize) {
    return null;
  }

  const frameProfile = getFrameProfile(frameProfileId);
  const frameFaceWidth = frameProfile.renderStyle === "none" ? 0 : frameProfile.faceWidthInches;

  return {
    width: measurementToInches(outerMatSize.width, unit) + frameFaceWidth * 2,
    height: measurementToInches(outerMatSize.height, unit) + frameFaceWidth * 2,
  };
}
