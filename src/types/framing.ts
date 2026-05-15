export type MeasurementUnit = "in" | "cm";
export type AppColorMode = "dark" | "light";
export type MountStyle = "window" | "float" | "hinged";
export type OpeningEdgeMode = "overlap" | "border";
export type FractionDenominator = 8 | 16 | 32;
export type MatThicknessPly = 2 | 4 | 6 | 8;
export type MatCoreColor = "white" | "black";
export type FrameFamily = "basic" | "nielsenFlorentine" | "nielsenMonochrome";
export type FrameProfileId =
  | "basicNone"
  | "basicThin"
  | "basicGallery"
  | "nielsenFlorentine93"
  | "nielsenMonochrome95"
  | "nielsenMonochrome97";
export type FrameFinishId =
  | "basicBlack"
  | "basicGrey"
  | "basicSilver"
  | "florentineBlack"
  | "florentineGrey"
  | "florentineSilver"
  | "monochromeMatteWhite"
  | "monochromePaintedBlack";
export type ArtworkPreviewSourceMode = "placeholder" | "import";
export type RoomViewSourceMode = "myWall" | "presetRoom";
export type RoomPresetSceneOrientation = "landscape" | "portrait";
export type RoomSceneLightingDirection =
  | "left"
  | "right"
  | "center"
  | "upperLeft"
  | "upperRight";

export interface ArtworkCropState {
  sourceWidth: number;
  sourceHeight: number;
  aspectRatio: number;
  zoomScale: number;
  offsetXRatio: number;
  offsetYRatio: number;
}

export interface SizeInput {
  width: string;
  height: string;
}

export interface EdgeMeasurements {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export interface ProjectMeta {
  projectName: string;
  notes: string;
}

export interface ArtworkSetupDraft {
  // Physical artwork dimensions only.
  artworkSize: SizeInput;
}

export interface RevealSetupDraft {
  mountStyle: MountStyle;
  openingBehavior: OpeningEdgeMode;
  openingAmount: string;
  // Visible artwork reveal around the piece.
  visibleReveal: EdgeMeasurements;
  // Mat opening is its own field and should not be conflated with artwork size.
  matOpeningSize: SizeInput;
}

export interface OuterMatSetupDraft {
  // Final outside dimension of the mat board.
  outerMatSize: SizeInput;
}

export interface PreviewDraft {
  matThicknessPly: MatThicknessPly;
  matCoreColor: MatCoreColor;
  mountingBoardColorHex: string;
  frameFamily: FrameFamily;
  frameProfileId: FrameProfileId;
  frameFinishId: FrameFinishId | null;
  matColorHex: string;
  frameColorHex: string;
  offsetX: number;
  offsetY: number;
  artworkSourceMode: ArtworkPreviewSourceMode;
  artworkImageUri: string | null;
  artworkCrop: ArtworkCropState | null;
}

export type RoomKnownMeasurementMode = "letterLongEdge" | "custom";

export interface RoomViewPoint {
  x: number;
  y: number;
}

export interface RoomViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomViewLine {
  start: RoomViewPoint;
  end: RoomViewPoint;
}

export interface RoomPresetScene {
  id: string;
  title: string;
  description: string;
  orientation: RoomPresetSceneOrientation;
  imagePath: string;
  sourceImageDimensions: {
    width: number;
    height: number;
  };
  wallRegion: RoomViewRect;
  safePlacementRegion?: RoomViewRect;
  wallPhysicalWidthInches?: number;
  wallPhysicalHeightInches?: number;
  artworkScaleMultiplier?: number;
  floorLine?: RoomViewLine;
  lightingDirection?: RoomSceneLightingDirection;
  environment?: RoomEnvironmentLighting;
  defaultShadow?: {
    opacity: number;
    offsetX: number;
    offsetY: number;
    blurRadius: number;
  };
  pixelsPerInch: number;
}

export interface RoomEnvironmentLighting {
  wallBrightness?: number;
  warmth?: number;
  ambientLight?: number;
  contrast?: number;
  edgeBlend?: number;
}

export interface RoomWallShadowDraft {
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  blurRadius?: number;
}

export interface RoomMaterialRealismDraft {
  bevelDepth?: number;
  bevelSoftness?: number;
  frameDepth?: number;
  innerLipContrast?: number;
}

export interface RoomWallPhotoDraft {
  imageUri: string;
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface RoomScaleCalibrationDraft {
  start: RoomViewPoint;
  end: RoomViewPoint;
  measurementMode: RoomKnownMeasurementMode;
  customMeasurement: string;
  customMeasurementUnit: MeasurementUnit;
  pixelsPerInch: number | null;
}

export interface RoomArtworkPlacementDraft {
  id: string;
  framedArtworkId: string | null;
  sourceMode: RoomViewSourceMode;
  sourceId: string;
  center: RoomViewPoint;
  scale: number;
  rotationDegrees: number;
  zIndex: number;
  wallShadow?: RoomWallShadowDraft;
}

export interface RoomViewDraft {
  sourceMode: RoomViewSourceMode;
  wallPhoto: RoomWallPhotoDraft | null;
  presetSceneId: string | null;
  calibration: RoomScaleCalibrationDraft;
  isCalibrationRulerVisible: boolean;
  snapToGridEnabled: boolean;
  gridSize: string;
  gridSizeUnit: MeasurementUnit;
  sourceWallShadows?: Record<string, RoomWallShadowDraft>;
  sourceArtworkBrightness?: Record<string, number>;
  sourceMaterialRealism?: Record<string, RoomMaterialRealismDraft>;
  placements: RoomArtworkPlacementDraft[];
  activePlacementId: string | null;
}

export interface FramingProjectDraft {
  meta: ProjectMeta;
  artwork: ArtworkSetupDraft;
  reveal: RevealSetupDraft;
  outerMat: OuterMatSetupDraft;
  preview: PreviewDraft;
  roomView: RoomViewDraft;
}
