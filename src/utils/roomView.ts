import type {
  MeasurementUnit,
  RoomPresetScene,
  RoomKnownMeasurementMode,
  RoomScaleCalibrationDraft,
  RoomViewPoint,
  RoomViewSourceMode,
  RoomWallPhotoDraft,
} from "../types/framing";
import { parseMeasurement } from "./formatters";

const US_LETTER_LONG_EDGE_INCHES = 11;
const A4_LONG_EDGE_CENTIMETERS = 29.7;
const DEFAULT_GRID_SIZE_INCHES = 1;
const DEFAULT_GRID_SIZE_CENTIMETERS = 2.5;
export const MY_WALL_SCENE_SOURCE_ID = "my-wall";

export function getRoomKnownMeasurementOptions(unit: MeasurementUnit): {
  label: string;
  value: RoomKnownMeasurementMode;
}[] {
  return [
    {
      label: unit === "cm" ? "29.7 cm" : "11 in",
      value: "letterLongEdge",
    },
    { label: "Custom", value: "custom" },
  ];
}

export function getStandardCalibrationMeasurementLabel(unit: MeasurementUnit) {
  return unit === "cm" ? "29.7 cm" : "11 in";
}

export function getStandardCalibrationPaperLabel(unit: MeasurementUnit) {
  return unit === "cm" ? "standard A4 paper" : "standard U.S. letter paper";
}

export function getStandardCalibrationMeasurementInches(unit: MeasurementUnit) {
  return unit === "cm"
    ? A4_LONG_EDGE_CENTIMETERS / 2.54
    : US_LETTER_LONG_EDGE_INCHES;
}

export function getDefaultRoomGridSize(unit: MeasurementUnit) {
  return unit === "cm" ? DEFAULT_GRID_SIZE_CENTIMETERS : DEFAULT_GRID_SIZE_INCHES;
}

export function getRoomGridSizeInches({
  gridSize,
  gridSizeUnit,
}: {
  gridSize: string;
  gridSizeUnit: MeasurementUnit;
}) {
  const parsedGridSize = parseMeasurement(gridSize);

  if (
    parsedGridSize === null ||
    !Number.isFinite(parsedGridSize) ||
    parsedGridSize <= 0
  ) {
    return null;
  }

  return gridSizeUnit === "cm" ? parsedGridSize / 2.54 : parsedGridSize;
}

export function clampRoomPoint(point: RoomViewPoint): RoomViewPoint {
  return {
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y)),
  };
}

export function calculateCalibrationPixelsPerInch({
  wallPhoto,
  calibration,
  unit,
}: {
  wallPhoto: RoomWallPhotoDraft | null;
  calibration: Omit<RoomScaleCalibrationDraft, "pixelsPerInch">;
  unit: MeasurementUnit;
}) {
  if (!wallPhoto?.imageWidth || !wallPhoto.imageHeight) {
    return null;
  }

  const startX = calibration.start.x * wallPhoto.imageWidth;
  const startY = calibration.start.y * wallPhoto.imageHeight;
  const endX = calibration.end.x * wallPhoto.imageWidth;
  const endY = calibration.end.y * wallPhoto.imageHeight;
  const pixelDistance = Math.hypot(endX - startX, endY - startY);
  const knownMeasurement = getCalibrationKnownMeasurementInches(calibration, unit);

  if (
    !Number.isFinite(pixelDistance) ||
    pixelDistance <= 0.5 ||
    knownMeasurement === null ||
    !Number.isFinite(knownMeasurement) ||
    knownMeasurement <= 0
  ) {
    return null;
  }

  return pixelDistance / knownMeasurement;
}

export function getCalibrationKnownMeasurementInches(
  calibration: Omit<RoomScaleCalibrationDraft, "pixelsPerInch">,
  unit: MeasurementUnit
) {
  if (calibration.measurementMode !== "custom") {
    return getStandardCalibrationMeasurementInches(unit);
  }

  const customMeasurement = parseMeasurement(calibration.customMeasurement);

  if (customMeasurement === null) {
    return null;
  }

  const sourceUnit = calibration.customMeasurementUnit ?? unit;
  return sourceUnit === "cm" ? customMeasurement / 2.54 : customMeasurement;
}

export function getDisplayPixelsPerInch({
  wallPhoto,
  sourceImageWidth,
  stageWidth,
  pixelsPerInch,
}: {
  wallPhoto?: RoomWallPhotoDraft | null;
  sourceImageWidth?: number | null;
  stageWidth: number;
  pixelsPerInch: number | null;
}) {
  const imageWidth = sourceImageWidth ?? wallPhoto?.imageWidth;

  if (!imageWidth || !pixelsPerInch || stageWidth <= 0) {
    return null;
  }

  return pixelsPerInch * (stageWidth / imageWidth);
}

export function getPresetScenePixelsPerInch(scene: RoomPresetScene) {
  const wallPhysicalWidthInches = scene.wallPhysicalWidthInches;
  const wallRegionPixelWidth = scene.sourceImageDimensions.width * scene.wallRegion.width;

  if (
    wallPhysicalWidthInches &&
    Number.isFinite(wallPhysicalWidthInches) &&
    wallPhysicalWidthInches > 0 &&
    Number.isFinite(wallRegionPixelWidth) &&
    wallRegionPixelWidth > 0
  ) {
    return wallRegionPixelWidth / wallPhysicalWidthInches;
  }

  return scene.pixelsPerInch;
}

export function getRoomSourceId(
  sourceMode: RoomViewSourceMode,
  presetSceneId: string | null
) {
  return sourceMode === "presetRoom"
    ? presetSceneId
    : MY_WALL_SCENE_SOURCE_ID;
}

export function getWallPhotoAspectRatio(wallPhoto: RoomWallPhotoDraft | null) {
  if (!wallPhoto?.imageWidth || !wallPhoto.imageHeight) {
    return 4 / 3;
  }

  return wallPhoto.imageWidth / wallPhoto.imageHeight;
}
