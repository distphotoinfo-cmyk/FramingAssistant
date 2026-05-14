import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FramingProjectDraft, MeasurementUnit } from "../types/framing";

const DEFAULT_PROJECT_FOLDER_NAME = "General";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ProjectFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedFramedArtworkRenderData {
  artworkImageUri: string | null;
  artworkDimensions: FramingProjectDraft["artwork"]["artworkSize"];
  outerMatDimensions: FramingProjectDraft["outerMat"]["outerMatSize"];
  matWindowSettings: FramingProjectDraft["reveal"];
  matColorHex: string;
  matCoreColor: FramingProjectDraft["preview"]["matCoreColor"];
  mountBoardColorHex: string;
  frameFamily: FramingProjectDraft["preview"]["frameFamily"];
  frameProfileId: FramingProjectDraft["preview"]["frameProfileId"];
  frameFinishId: FramingProjectDraft["preview"]["frameFinishId"];
  frameColorHex: string;
  finalOuterSizeInches: {
    width: number;
    height: number;
  };
}

export interface SavedFramedArtwork {
  id: string;
  projectFolderId: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  savedAt: string;
  draft: FramingProjectDraft;
  unit: MeasurementUnit;
  finalOuterSizeInches: {
    width: number;
    height: number;
  };
  renderData: SavedFramedArtworkRenderData;
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
  projectFolders: ProjectFolder[];
  framedArtworks: SavedFramedArtwork[];
  createProjectFolder: (name: string) => ProjectFolder;
  saveProject: (project: Omit<SavedFramingProject, "id" | "savedAt">) => SavedFramingProject;
  saveFramedArtwork: (
    artwork: Omit<SavedFramedArtwork, "id" | "createdAt" | "updatedAt" | "savedAt" | "renderData"> &
      Partial<Pick<SavedFramedArtwork, "renderData">>
  ) => SavedFramedArtwork;
  deleteProject: (id: string) => void;
  deleteFramedArtwork: (id: string) => void;
}

function buildRenderData(
  draft: FramingProjectDraft,
  finalOuterSizeInches: SavedFramedArtwork["finalOuterSizeInches"]
): SavedFramedArtworkRenderData {
  return {
    artworkImageUri: draft.preview.artworkImageUri,
    artworkDimensions: draft.artwork.artworkSize,
    outerMatDimensions: draft.outerMat.outerMatSize,
    matWindowSettings: draft.reveal,
    matColorHex: draft.preview.matColorHex,
    matCoreColor: draft.preview.matCoreColor,
    mountBoardColorHex: draft.preview.mountingBoardColorHex,
    frameFamily: draft.preview.frameFamily,
    frameProfileId: draft.preview.frameProfileId,
    frameFinishId: draft.preview.frameFinishId,
    frameColorHex: draft.preview.frameColorHex,
    finalOuterSizeInches,
  };
}

function normalizePersistedState(
  typedState: Partial<SavedProjectsState> | undefined,
  currentState: SavedProjectsState
) {
  const now = new Date().toISOString();
  const persistedFolders = typedState?.projectFolders ?? [];
  const persistedArtworks = typedState?.framedArtworks ?? [];
  const needsDefaultFolder =
    persistedArtworks.some((artwork) => !artwork.projectFolderId) && persistedFolders.length === 0;
  const defaultFolder: ProjectFolder = {
    id: "project-folder-general",
    name: DEFAULT_PROJECT_FOLDER_NAME,
    createdAt: now,
    updatedAt: now,
  };
  const projectFolders = needsDefaultFolder ? [defaultFolder] : persistedFolders;
  const fallbackFolderId = projectFolders[0]?.id ?? defaultFolder.id;
  const framedArtworks = persistedArtworks.map((artwork) => {
    const createdAt = artwork.createdAt ?? artwork.savedAt ?? now;
    const updatedAt = artwork.updatedAt ?? artwork.savedAt ?? createdAt;
    const finalOuterSizeInches = artwork.finalOuterSizeInches;

    return {
      ...artwork,
      projectFolderId: artwork.projectFolderId ?? fallbackFolderId,
      createdAt,
      updatedAt,
      savedAt: artwork.savedAt ?? createdAt,
      notes: artwork.notes ?? "",
      renderData: artwork.renderData ?? buildRenderData(artwork.draft, finalOuterSizeInches),
    };
  });

  return {
    ...currentState,
    ...typedState,
    projects: typedState?.projects ?? currentState.projects,
    projectFolders,
    framedArtworks,
  };
}

export const useSavedProjectsStore = create<SavedProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      projectFolders: [],
      framedArtworks: [],
      createProjectFolder: (name) => {
        const trimmedName = name.trim() || DEFAULT_PROJECT_FOLDER_NAME;
        const timestamp = new Date().toISOString();
        const folder: ProjectFolder = {
          id: createId("project-folder"),
          name: trimmedName,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set((state) => ({
          projectFolders: [folder, ...state.projectFolders],
        }));

        return folder;
      },
      saveProject: (project) => {
        const savedProject: SavedFramingProject = {
          ...project,
          id: createId("project"),
          savedAt: new Date().toISOString(),
        };

        set((state) => ({
          projects: [savedProject, ...state.projects.filter((existing) => existing.name !== project.name)],
        }));

        return savedProject;
      },
      saveFramedArtwork: (artwork) => {
        const timestamp = new Date().toISOString();
        const renderData = artwork.renderData ?? buildRenderData(artwork.draft, artwork.finalOuterSizeInches);
        const savedArtwork: SavedFramedArtwork = {
          ...artwork,
          id: createId("framed-artwork"),
          createdAt: timestamp,
          updatedAt: timestamp,
          savedAt: timestamp,
          renderData,
        };

        set((state) => ({
          framedArtworks: [savedArtwork, ...state.framedArtworks],
          projectFolders: state.projectFolders.map((folder) =>
            folder.id === artwork.projectFolderId ? { ...folder, updatedAt: timestamp } : folder
          ),
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
        return normalizePersistedState(typedState, currentState);
      },
    }
  )
);
