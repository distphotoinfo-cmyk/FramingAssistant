import type { FrameFamily, FrameFinishId, FrameProfileId, PreviewDraft } from "../types/framing";
import { normalizeHex } from "./color";

export interface FramePresetOption {
  label: string;
  value: FrameProfileId;
}

export interface FrameFinishDefinition {
  id: FrameFinishId;
  label: string;
  colorHex: string;
}

export interface FrameProfileDefinition {
  id: FrameProfileId;
  family: FrameFamily;
  label: string;
  selectorLabel: string;
  profileCode: string | null;
  faceWidthInches: number;
  heightInches: number;
  rabbetInches: number | null;
  finishIds: FrameFinishId[];
  defaultFinishId: FrameFinishId | null;
  renderStyle: "none" | "basic" | "florentine" | "monochrome";
}

export const FRAME_FINISHES: Record<FrameFinishId, FrameFinishDefinition> = {
  basicBlack: {
    id: "basicBlack",
    label: "Black",
    colorHex: "#050505",
  },
  basicGrey: {
    id: "basicGrey",
    label: "Grey",
    colorHex: "#6D7178",
  },
  basicSilver: {
    id: "basicSilver",
    label: "Silver",
    colorHex: "#CDD2D8",
  },
  florentineBlack: {
    id: "florentineBlack",
    label: "Florentine Black",
    colorHex: "#050505",
  },
  florentineGrey: {
    id: "florentineGrey",
    label: "Florentine Grey",
    colorHex: "#6D7178",
  },
  florentineSilver: {
    id: "florentineSilver",
    label: "Florentine Silver",
    colorHex: "#CDD2D8",
  },
  monochromeMatteWhite: {
    id: "monochromeMatteWhite",
    label: "Matte White",
    colorHex: "#F3F1EC",
  },
  monochromePaintedBlack: {
    id: "monochromePaintedBlack",
    label: "Painted Black",
    colorHex: "#111111",
  },
};

export const FRAME_SELECTOR_OPTIONS: FramePresetOption[] = [
  {
    label: "None",
    value: "basicNone",
  },
  {
    label: "Basic Thin",
    value: "basicThin",
  },
  {
    label: "Basic Gallery",
    value: "basicGallery",
  },
  {
    label: "Nielsen Florentine",
    value: "nielsenFlorentine93",
  },
  {
    label: "Nielsen Monochrome",
    value: "nielsenMonochrome97",
  },
];

export const FRAME_PROFILES: Record<FrameProfileId, FrameProfileDefinition> = {
  basicNone: {
    id: "basicNone",
    family: "basic",
    label: "None",
    selectorLabel: "None",
    profileCode: null,
    faceWidthInches: 0,
    heightInches: 0,
    rabbetInches: null,
    finishIds: [],
    defaultFinishId: null,
    renderStyle: "none",
  },
  basicThin: {
    id: "basicThin",
    family: "basic",
    label: "Basic Thin",
    selectorLabel: "Basic Thin",
    profileCode: null,
    faceWidthInches: 0.4375,
    heightInches: 0.875,
    rabbetInches: null,
    finishIds: ["basicBlack", "basicGrey", "basicSilver"],
    defaultFinishId: "basicBlack",
    renderStyle: "basic",
  },
  basicGallery: {
    id: "basicGallery",
    family: "basic",
    label: "Basic Gallery",
    selectorLabel: "Basic Gallery",
    profileCode: null,
    faceWidthInches: 0.75,
    heightInches: 1.25,
    rabbetInches: null,
    finishIds: ["basicBlack", "basicGrey", "basicSilver"],
    defaultFinishId: "basicBlack",
    renderStyle: "basic",
  },
  nielsenFlorentine93: {
    id: "nielsenFlorentine93",
    family: "nielsenFlorentine",
    label: "Profile 93",
    selectorLabel: "Profile 93 - 7/16 in",
    profileCode: "93",
    faceWidthInches: 0.4375,
    heightInches: 1,
    rabbetInches: null,
    finishIds: ["florentineBlack", "florentineGrey", "florentineSilver"],
    defaultFinishId: "florentineGrey",
    renderStyle: "florentine",
  },
  nielsenMonochrome95: {
    id: "nielsenMonochrome95",
    family: "nielsenMonochrome",
    label: "Profile 95",
    selectorLabel: "Profile 95 - 7/8 in",
    profileCode: "95",
    faceWidthInches: 0.875,
    heightInches: 0.6875,
    rabbetInches: 0.5,
    finishIds: ["monochromeMatteWhite"],
    defaultFinishId: "monochromeMatteWhite",
    renderStyle: "monochrome",
  },
  nielsenMonochrome97: {
    id: "nielsenMonochrome97",
    family: "nielsenMonochrome",
    label: "Profile 97",
    selectorLabel: "Profile 97 - 7/8 in",
    profileCode: "97",
    faceWidthInches: 0.875,
    heightInches: 0.6875,
    rabbetInches: 0.5,
    finishIds: ["monochromePaintedBlack", "monochromeMatteWhite"],
    defaultFinishId: "monochromePaintedBlack",
    renderStyle: "monochrome",
  },
};

export function getFrameProfile(profileId: FrameProfileId) {
  return FRAME_PROFILES[profileId];
}

export function getFinishOptionsForProfile(profileId: FrameProfileId) {
  return FRAME_PROFILES[profileId].finishIds.map((finishId) => ({
    label: FRAME_FINISHES[finishId].label,
    value: finishId,
  }));
}

export function getDefaultFinishForProfile(profileId: FrameProfileId): FrameFinishId | null {
  return FRAME_PROFILES[profileId].defaultFinishId;
}

export function getFinishColorHex(finishId: FrameFinishId | null) {
  if (!finishId) {
    return null;
  }

  return FRAME_FINISHES[finishId]?.colorHex ?? null;
}

export function resolveFrameColorHex(
  profileId: FrameProfileId,
  finishId: FrameFinishId | null,
  fallbackHex: string
) {
  const presetFinishColor = getFinishColorHex(finishId);

  if (presetFinishColor) {
    return normalizeHex(presetFinishColor, fallbackHex);
  }

  return normalizeHex(fallbackHex, "#050505");
}

function normalizeFlorentineFinishFromColor(colorHex: string | null | undefined): FrameFinishId {
  const normalized = normalizeHex(colorHex, FRAME_FINISHES.florentineGrey.colorHex);

  if (normalized === FRAME_FINISHES.florentineGrey.colorHex) {
    return "florentineGrey";
  }

  if (normalized === FRAME_FINISHES.florentineSilver.colorHex) {
    return "florentineSilver";
  }

  return "florentineBlack";
}

export function normalizeFrameSelection(
  preview:
    | Partial<
        PreviewDraft & {
          frameStyle?: string | null;
        }
      >
    | null
    | undefined
): Pick<PreviewDraft, "frameFamily" | "frameProfileId" | "frameFinishId" | "frameColorHex"> {
  if (preview?.frameFamily && preview?.frameProfileId) {
    const normalizedProfileId =
      preview.frameProfileId === "nielsenMonochrome95"
        ? "nielsenMonochrome97"
        : preview.frameProfileId;
    const profile = FRAME_PROFILES[normalizedProfileId];
    const finishId =
      profile.finishIds.length === 0
        ? null
        : profile.finishIds.includes(preview.frameFinishId as FrameFinishId)
          ? (preview.frameFinishId as FrameFinishId)
          : profile.defaultFinishId;

    return {
      frameFamily: profile.family,
      frameProfileId: normalizedProfileId,
      frameFinishId: finishId,
      frameColorHex: resolveFrameColorHex(
        normalizedProfileId,
        finishId,
        preview.frameColorHex ?? "#050505"
      ),
    };
  }

  const legacyStyle = preview?.frameStyle;

  if (legacyStyle === "none") {
    return {
      frameFamily: "basic" as const,
      frameProfileId: "basicNone" as const,
      frameFinishId: null,
      frameColorHex: "#050505",
    };
  }

  if (legacyStyle === "gallery") {
    return {
      frameFamily: "basic" as const,
      frameProfileId: "basicGallery" as const,
      frameFinishId: "basicBlack",
      frameColorHex: normalizeHex(preview?.frameColorHex, "#050505"),
    };
  }

  return {
    frameFamily: "nielsenFlorentine" as const,
    frameProfileId: "nielsenFlorentine93" as const,
    frameFinishId: normalizeFlorentineFinishFromColor(preview?.frameColorHex),
    frameColorHex: resolveFrameColorHex(
      "nielsenFlorentine93",
      normalizeFlorentineFinishFromColor(preview?.frameColorHex),
      preview?.frameColorHex ?? FRAME_FINISHES.florentineGrey.colorHex
    ),
  };
}
