export type MeasurementUnit = "in" | "cm";
export type AppColorMode = "dark" | "light";
export type MountStyle = "window" | "float" | "hinged";
export type OpeningEdgeMode = "overlap" | "border";
export type FractionDenominator = 8 | 16 | 32;
export type MatThicknessPly = 2 | 4 | 6 | 8;
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

export interface FramingProjectDraft {
  meta: ProjectMeta;
  artwork: ArtworkSetupDraft;
  reveal: RevealSetupDraft;
  outerMat: OuterMatSetupDraft;
  preview: PreviewDraft;
}
