import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ArtworkSetupDraft,
  FramingProjectDraft,
  MeasurementUnit,
  OuterMatSetupDraft,
  PreviewDraft,
  ProjectMeta,
  RevealSetupDraft,
  RoomArtworkPlacementDraft,
  RoomScaleCalibrationDraft,
  RoomViewDraft,
  RoomViewPoint,
  RoomViewSourceMode,
} from "../types/framing";
import { DEFAULT_PRESET_ROOM_SCENE_ID } from "../data/presetRoomScenes";
import { FRAME_FINISHES, normalizeFrameSelection } from "../utils/frameProfiles";
import { MY_WALL_SCENE_SOURCE_ID } from "../utils/roomView";

const DEFAULT_SETUP_DIMENSIONS = {
  artworkWidth: "10",
  artworkHeight: "13",
  outerMatWidth: "16",
  outerMatHeight: "20",
  visibleBorder: "0.5",
  matOpeningWidth: "11",
  matOpeningHeight: "14",
};

function isBlank(value: string | null | undefined) {
  return value === undefined || value === null || value.trim() === "";
}

function valueOrDefault(value: string | null | undefined, fallback: string): string {
  return isBlank(value) ? fallback : value!;
}

function isLegacyUntouchedBlankSetupDraft(draft: Partial<FramingProjectDraft> | null | undefined) {
  return Boolean(
    draft &&
      isBlank(draft.artwork?.artworkSize?.width) &&
      isBlank(draft.artwork?.artworkSize?.height) &&
      isBlank(draft.outerMat?.outerMatSize?.width) &&
      isBlank(draft.outerMat?.outerMatSize?.height) &&
      isBlank(draft.reveal?.visibleReveal?.top) &&
      isBlank(draft.reveal?.visibleReveal?.right) &&
      isBlank(draft.reveal?.visibleReveal?.bottom) &&
      isBlank(draft.reveal?.visibleReveal?.left) &&
      isBlank(draft.reveal?.matOpeningSize?.width) &&
      isBlank(draft.reveal?.matOpeningSize?.height) &&
      (draft.reveal?.openingBehavior === undefined || draft.reveal.openingBehavior === "overlap") &&
      (isBlank(draft.reveal?.openingAmount) || draft.reveal?.openingAmount === "0.125")
  );
}

export function createInitialPreviewDraft(): PreviewDraft {
  return {
    matThicknessPly: 4,
    matCoreColor: "white",
    mountingBoardColorHex: "#FFFFFF",
    frameFamily: "nielsenFlorentine",
    frameProfileId: "nielsenFlorentine93",
    frameFinishId: "florentineGrey",
    matColorHex: "#FFFFFF",
    frameColorHex: FRAME_FINISHES.florentineGrey.colorHex,
    offsetX: 0,
    offsetY: 0,
    artworkSourceMode: "placeholder",
    artworkImageUri: null,
    artworkCrop: null,
  };
}

export function createInitialRoomViewDraft(unit: MeasurementUnit = "in"): RoomViewDraft {
  return {
    sourceMode: "myWall",
    wallPhoto: null,
    presetSceneId: DEFAULT_PRESET_ROOM_SCENE_ID,
    calibration: {
      start: { x: 0.35, y: 0.5 },
      end: { x: 0.65, y: 0.5 },
      measurementMode: "letterLongEdge",
      customMeasurement: "11",
      customMeasurementUnit: "in",
      pixelsPerInch: null,
    },
    isCalibrationRulerVisible: true,
    snapToGridEnabled: true,
    gridSize: unit === "cm" ? "2.5" : "1",
    gridSizeUnit: unit,
    sourceWallShadows: {},
    sourceArtworkBrightness: {},
    sourceMaterialRealism: {},
    placements: [],
    activePlacementId: null,
  };
}

export function createRoomArtworkPlacement(
  framedArtworkId: string | null,
  center: RoomViewPoint = { x: 0.5, y: 0.48 },
  zIndex = 0,
  sourceMode: RoomViewSourceMode = "myWall",
  sourceId = MY_WALL_SCENE_SOURCE_ID
): RoomArtworkPlacementDraft {
  return {
    id: `room-placement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    framedArtworkId,
    sourceMode,
    sourceId,
    center,
    scale: 1,
    rotationDegrees: 0,
    zIndex,
  };
}

function createInitialDraft(): FramingProjectDraft {
  return {
    meta: {
      projectName: "",
      notes: "",
    },
    artwork: {
      artworkSize: {
        width: DEFAULT_SETUP_DIMENSIONS.artworkWidth,
        height: DEFAULT_SETUP_DIMENSIONS.artworkHeight,
      },
    },
    reveal: {
      mountStyle: "float",
      openingBehavior: "border",
      openingAmount: DEFAULT_SETUP_DIMENSIONS.visibleBorder,
      visibleReveal: {
        top: DEFAULT_SETUP_DIMENSIONS.visibleBorder,
        right: DEFAULT_SETUP_DIMENSIONS.visibleBorder,
        bottom: DEFAULT_SETUP_DIMENSIONS.visibleBorder,
        left: DEFAULT_SETUP_DIMENSIONS.visibleBorder,
      },
      matOpeningSize: {
        width: DEFAULT_SETUP_DIMENSIONS.matOpeningWidth,
        height: DEFAULT_SETUP_DIMENSIONS.matOpeningHeight,
      },
    },
    outerMat: {
      outerMatSize: {
        width: DEFAULT_SETUP_DIMENSIONS.outerMatWidth,
        height: DEFAULT_SETUP_DIMENSIONS.outerMatHeight,
      },
    },
    preview: createInitialPreviewDraft(),
    roomView: createInitialRoomViewDraft(),
  };
}

function mergeDraftWithDefaults(
  draft: Partial<FramingProjectDraft> | null | undefined
): FramingProjectDraft {
  const base = createInitialDraft();
  const useDefaultSetup = isLegacyUntouchedBlankSetupDraft(draft);
  const normalizedFrameSelection = normalizeFrameSelection(draft?.preview);
  const persistedCalibration = draft?.roomView?.calibration as
    | (Partial<RoomScaleCalibrationDraft> & {
        knownMeasurementInches?: string | null;
      })
    | undefined;
  const legacyKnownMeasurementInches = persistedCalibration?.knownMeasurementInches;
  const persistedSourceMode = draft?.roomView?.sourceMode ?? base.roomView.sourceMode;
  const persistedPresetSceneId =
    draft?.roomView?.presetSceneId ?? base.roomView.presetSceneId;
  const legacyArtworkPlacement = draft?.roomView as
    | (Partial<RoomViewDraft> & {
        artworkPlacement?: {
          center?: Partial<RoomViewPoint>;
        };
      })
    | undefined;
  const persistedPlacements =
    draft?.roomView?.placements ??
    (legacyArtworkPlacement?.artworkPlacement
      ? [
          createRoomArtworkPlacement(null, {
            ...base.roomView.placements[0]?.center,
            ...legacyArtworkPlacement.artworkPlacement.center,
            x: legacyArtworkPlacement.artworkPlacement.center?.x ?? 0.5,
            y: legacyArtworkPlacement.artworkPlacement.center?.y ?? 0.48,
          }),
        ]
      : base.roomView.placements);

  return {
    ...base,
    ...draft,
    meta: {
      ...base.meta,
      ...draft?.meta,
    },
    artwork: {
      ...base.artwork,
      ...draft?.artwork,
      artworkSize: {
        ...base.artwork.artworkSize,
        ...draft?.artwork?.artworkSize,
        width: valueOrDefault(draft?.artwork?.artworkSize?.width, base.artwork.artworkSize.width),
        height: valueOrDefault(draft?.artwork?.artworkSize?.height, base.artwork.artworkSize.height),
      },
    },
    reveal: {
      ...base.reveal,
      ...draft?.reveal,
      mountStyle: useDefaultSetup ? base.reveal.mountStyle : draft?.reveal?.mountStyle ?? base.reveal.mountStyle,
      openingBehavior: useDefaultSetup
        ? base.reveal.openingBehavior
        : draft?.reveal?.openingBehavior ?? base.reveal.openingBehavior,
      openingAmount:
        useDefaultSetup || isBlank(draft?.reveal?.openingAmount)
          ? base.reveal.openingAmount
          : valueOrDefault(draft?.reveal?.openingAmount, base.reveal.openingAmount),
      visibleReveal: {
        ...base.reveal.visibleReveal,
        ...draft?.reveal?.visibleReveal,
        top:
          useDefaultSetup || isBlank(draft?.reveal?.visibleReveal?.top)
            ? base.reveal.visibleReveal.top
            : valueOrDefault(draft?.reveal?.visibleReveal?.top, base.reveal.visibleReveal.top),
        right:
          useDefaultSetup || isBlank(draft?.reveal?.visibleReveal?.right)
            ? base.reveal.visibleReveal.right
            : valueOrDefault(draft?.reveal?.visibleReveal?.right, base.reveal.visibleReveal.right),
        bottom:
          useDefaultSetup || isBlank(draft?.reveal?.visibleReveal?.bottom)
            ? base.reveal.visibleReveal.bottom
            : valueOrDefault(draft?.reveal?.visibleReveal?.bottom, base.reveal.visibleReveal.bottom),
        left:
          useDefaultSetup || isBlank(draft?.reveal?.visibleReveal?.left)
            ? base.reveal.visibleReveal.left
            : valueOrDefault(draft?.reveal?.visibleReveal?.left, base.reveal.visibleReveal.left),
      },
      matOpeningSize: {
        ...base.reveal.matOpeningSize,
        ...draft?.reveal?.matOpeningSize,
        width:
          useDefaultSetup || isBlank(draft?.reveal?.matOpeningSize?.width)
            ? base.reveal.matOpeningSize.width
            : valueOrDefault(draft?.reveal?.matOpeningSize?.width, base.reveal.matOpeningSize.width),
        height:
          useDefaultSetup || isBlank(draft?.reveal?.matOpeningSize?.height)
            ? base.reveal.matOpeningSize.height
            : valueOrDefault(draft?.reveal?.matOpeningSize?.height, base.reveal.matOpeningSize.height),
      },
    },
    outerMat: {
      ...base.outerMat,
      ...draft?.outerMat,
      outerMatSize: {
        ...base.outerMat.outerMatSize,
        ...draft?.outerMat?.outerMatSize,
        width: valueOrDefault(draft?.outerMat?.outerMatSize?.width, base.outerMat.outerMatSize.width),
        height: valueOrDefault(draft?.outerMat?.outerMatSize?.height, base.outerMat.outerMatSize.height),
      },
    },
    preview: {
      ...base.preview,
      ...draft?.preview,
      ...normalizedFrameSelection,
    },
    roomView: {
      ...base.roomView,
      ...draft?.roomView,
      wallPhoto: draft?.roomView?.wallPhoto ?? base.roomView.wallPhoto,
      calibration: {
        ...base.roomView.calibration,
        ...persistedCalibration,
        measurementMode:
          persistedCalibration?.measurementMode ??
          (legacyKnownMeasurementInches && legacyKnownMeasurementInches !== "11"
            ? "custom"
            : base.roomView.calibration.measurementMode),
        customMeasurement:
          persistedCalibration?.customMeasurement ??
          (legacyKnownMeasurementInches && legacyKnownMeasurementInches !== "11"
            ? legacyKnownMeasurementInches
            : base.roomView.calibration.customMeasurement),
        customMeasurementUnit: persistedCalibration?.customMeasurementUnit ?? "in",
        start: {
          ...base.roomView.calibration.start,
          ...persistedCalibration?.start,
        },
        end: {
          ...base.roomView.calibration.end,
          ...persistedCalibration?.end,
        },
      },
      placements: persistedPlacements.map((placement, index) => ({
        id: placement.id,
        framedArtworkId: placement.framedArtworkId ?? null,
        sourceMode: placement.sourceMode ?? persistedSourceMode,
        sourceId:
          placement.sourceId ??
          ((placement.sourceMode ?? persistedSourceMode) === "presetRoom"
            ? persistedPresetSceneId ?? DEFAULT_PRESET_ROOM_SCENE_ID
            : MY_WALL_SCENE_SOURCE_ID),
        center: {
          x: placement.center?.x ?? 0.5,
          y: placement.center?.y ?? 0.48,
        },
        scale: placement.scale ?? 1,
        rotationDegrees: placement.rotationDegrees ?? 0,
        zIndex: placement.zIndex ?? index,
        wallShadow: placement.wallShadow,
      })),
      activePlacementId:
        draft?.roomView?.activePlacementId ??
        persistedPlacements.find((placement) => placement.framedArtworkId)?.id ??
        null,
      isCalibrationRulerVisible:
        draft?.roomView?.isCalibrationRulerVisible ?? base.roomView.isCalibrationRulerVisible,
      sourceMode: persistedSourceMode,
      presetSceneId: persistedPresetSceneId,
      snapToGridEnabled: draft?.roomView?.snapToGridEnabled ?? base.roomView.snapToGridEnabled,
      gridSize: valueOrDefault(draft?.roomView?.gridSize, base.roomView.gridSize),
      gridSizeUnit: draft?.roomView?.gridSizeUnit ?? base.roomView.gridSizeUnit,
      sourceWallShadows: draft?.roomView?.sourceWallShadows ?? base.roomView.sourceWallShadows,
      sourceArtworkBrightness:
        draft?.roomView?.sourceArtworkBrightness ?? base.roomView.sourceArtworkBrightness,
      sourceMaterialRealism:
        draft?.roomView?.sourceMaterialRealism ?? base.roomView.sourceMaterialRealism,
    },
  };
}

export const initialDraft: FramingProjectDraft = createInitialDraft();

type RoomViewDraftUpdate = Partial<Omit<RoomViewDraft, "calibration" | "placements">> & {
  calibration?: Partial<Omit<RoomScaleCalibrationDraft, "start" | "end">> & {
    start?: Partial<RoomViewPoint>;
    end?: Partial<RoomViewPoint>;
  };
  placements?: RoomArtworkPlacementDraft[];
};

interface FramingFlowState {
  draft: FramingProjectDraft;
  setMeta: (updates: Partial<ProjectMeta>) => void;
  setArtwork: (updates: Partial<ArtworkSetupDraft>) => void;
  setReveal: (updates: Partial<RevealSetupDraft>) => void;
  setOuterMat: (updates: Partial<OuterMatSetupDraft>) => void;
  setPreview: (updates: Partial<PreviewDraft>) => void;
  setRoomView: (updates: RoomViewDraftUpdate) => void;
  replaceDraft: (draft: FramingProjectDraft) => void;
  resetDraft: () => void;
}

export const useFramingFlowStore = create<FramingFlowState>()(
  persist(
    (set) => ({
      draft: initialDraft,
      setMeta: (updates) =>
        set((state) => ({
          draft: {
            ...state.draft,
            meta: {
              ...state.draft.meta,
              ...updates,
            },
          },
        })),
      setArtwork: (updates) =>
        set((state) => ({
          draft: {
            ...state.draft,
            artwork: {
              ...state.draft.artwork,
              ...updates,
            },
          },
        })),
      setReveal: (updates) =>
        set((state) => ({
          draft: {
            ...state.draft,
            reveal: {
              ...state.draft.reveal,
              ...updates,
            },
          },
        })),
      setOuterMat: (updates) =>
        set((state) => ({
          draft: {
            ...state.draft,
            outerMat: {
              ...state.draft.outerMat,
              ...updates,
            },
          },
        })),
      setPreview: (updates) =>
        set((state) => ({
          draft: {
            ...state.draft,
            preview: {
              ...createInitialPreviewDraft(),
              ...state.draft.preview,
              ...updates,
            },
          },
        })),
      setRoomView: (updates) =>
        set((state) => ({
          draft: {
            ...state.draft,
            roomView: {
              ...state.draft.roomView,
              ...updates,
              calibration: {
                ...state.draft.roomView.calibration,
                ...updates.calibration,
                start: {
                  ...state.draft.roomView.calibration.start,
                  ...updates.calibration?.start,
                },
                end: {
                  ...state.draft.roomView.calibration.end,
                  ...updates.calibration?.end,
                },
              },
              placements: updates.placements ?? state.draft.roomView.placements,
            },
          },
        })),
      replaceDraft: (draft) => set({ draft: mergeDraftWithDefaults(draft) }),
      resetDraft: () => set({ draft: createInitialDraft() }),
    }),
    {
      name: "framing-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        draft: state.draft,
      }),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<FramingFlowState> | undefined;

        return {
          ...currentState,
          ...typedState,
          draft: mergeDraftWithDefaults(typedState?.draft),
        };
      },
    }
  )
);
