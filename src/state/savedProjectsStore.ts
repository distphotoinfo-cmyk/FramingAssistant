import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FramingProjectDraft, MeasurementUnit } from "../types/framing";

export interface SavedFramedArtwork {
  id: string;
  name: string;
  notes: string;
  savedAt: string;
  draft: FramingProjectDraft;
  unit: MeasurementUnit;
  finalOuterSizeInches: {
    width: number;
    height: number;
  };
}

export interface SavedFramingProject {
  id: string;
  name: string;
  notes: string;
  savedAt: string;
  draft: FramingProjectDraft;
}

interface SavedProjectsState {
  projects: SavedFramingProject[];
  framedArtworks: SavedFramedArtwork[];
  saveProject: (project: Omit<SavedFramingProject, "id" | "savedAt">) => SavedFramingProject;
  saveFramedArtwork: (artwork: Omit<SavedFramedArtwork, "id" | "savedAt">) => SavedFramedArtwork;
  deleteProject: (id: string) => void;
  deleteFramedArtwork: (id: string) => void;
}

export const useSavedProjectsStore = create<SavedProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      framedArtworks: [],
      saveProject: (project) => {
        const savedProject: SavedFramingProject = {
          ...project,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          savedAt: new Date().toISOString(),
        };

        set((state) => ({
          projects: [savedProject, ...state.projects.filter((existing) => existing.name !== project.name)],
        }));

        return savedProject;
      },
      saveFramedArtwork: (artwork) => {
        const savedArtwork: SavedFramedArtwork = {
          ...artwork,
          id: `framed-artwork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          savedAt: new Date().toISOString(),
        };

        set((state) => ({
          framedArtworks: [
            savedArtwork,
            ...state.framedArtworks.filter((existing) => existing.name !== artwork.name),
          ],
        }));

        return savedArtwork;
      },
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
        })),
      deleteFramedArtwork: (id) =>
        set((state) => ({
          framedArtworks: state.framedArtworks.filter((artwork) => artwork.id !== id),
        })),
    }),
    {
      name: "framing-saved-projects",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<SavedProjectsState> | undefined;

        return {
          ...currentState,
          ...typedState,
          projects: typedState?.projects ?? currentState.projects,
          framedArtworks: typedState?.framedArtworks ?? currentState.framedArtworks,
        };
      },
    }
  )
);
