import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FramingProjectDraft } from "../types/framing";

export interface SavedFramingProject {
  id: string;
  name: string;
  notes: string;
  savedAt: string;
  draft: FramingProjectDraft;
}

interface SavedProjectsState {
  projects: SavedFramingProject[];
  saveProject: (project: Omit<SavedFramingProject, "id" | "savedAt">) => SavedFramingProject;
  deleteProject: (id: string) => void;
}

export const useSavedProjectsStore = create<SavedProjectsState>()(
  persist(
    (set) => ({
      projects: [],
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
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
        })),
    }),
    {
      name: "framing-saved-projects",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
