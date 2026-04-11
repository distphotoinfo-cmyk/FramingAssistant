import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ArtworkSetupDraft,
  FramingProjectDraft,
  OuterMatSetupDraft,
  PreviewDraft,
  ProjectMeta,
  RevealSetupDraft,
} from "../types/framing";
import { FRAME_FINISHES, normalizeFrameSelection } from "../utils/frameProfiles";

export function createInitialPreviewDraft(): PreviewDraft {
  return {
    matThicknessPly: 4,
    matCoreColor: "white",
    mountingBoardColorHex: "#FFFFFF",
    frameFamily: "nielsenFlorentine",
    frameProfileId: "nielsenFlorentine93",
    frameFinishId: "florentineSilver",
    matColorHex: "#FFFFFF",
    frameColorHex: FRAME_FINISHES.florentineSilver.colorHex,
    offsetX: 0,
    offsetY: 0,
    artworkSourceMode: "placeholder",
    artworkImageUri: null,
    artworkCrop: null,
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
        width: "",
        height: "",
      },
    },
    reveal: {
      mountStyle: "window",
      openingBehavior: "overlap",
      openingAmount: "0.125",
      visibleReveal: {
        top: "",
        right: "",
        bottom: "",
        left: "",
      },
      matOpeningSize: {
        width: "",
        height: "",
      },
    },
    outerMat: {
      outerMatSize: {
        width: "",
        height: "",
      },
    },
    preview: createInitialPreviewDraft(),
  };
}

function mergeDraftWithDefaults(
  draft: Partial<FramingProjectDraft> | null | undefined
): FramingProjectDraft {
  const base = createInitialDraft();
  const normalizedFrameSelection = normalizeFrameSelection(draft?.preview);

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
      },
    },
    reveal: {
      ...base.reveal,
      ...draft?.reveal,
      visibleReveal: {
        ...base.reveal.visibleReveal,
        ...draft?.reveal?.visibleReveal,
      },
      matOpeningSize: {
        ...base.reveal.matOpeningSize,
        ...draft?.reveal?.matOpeningSize,
      },
    },
    outerMat: {
      ...base.outerMat,
      ...draft?.outerMat,
      outerMatSize: {
        ...base.outerMat.outerMatSize,
        ...draft?.outerMat?.outerMatSize,
      },
    },
    preview: {
      ...base.preview,
      ...draft?.preview,
      ...normalizedFrameSelection,
    },
  };
}

export const initialDraft: FramingProjectDraft = createInitialDraft();

interface FramingFlowState {
  draft: FramingProjectDraft;
  setMeta: (updates: Partial<ProjectMeta>) => void;
  setArtwork: (updates: Partial<ArtworkSetupDraft>) => void;
  setReveal: (updates: Partial<RevealSetupDraft>) => void;
  setOuterMat: (updates: Partial<OuterMatSetupDraft>) => void;
  setPreview: (updates: Partial<PreviewDraft>) => void;
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
