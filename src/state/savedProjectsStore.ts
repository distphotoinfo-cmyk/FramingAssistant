import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FramingProjectDraft, MeasurementUnit } from "../types/framing";
import { normalizeDraftArtworkImageReference } from "../utils/persistentArtworkImages";

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
  artworkImageStoragePath?: string | null;
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

export interface SavedRoomLayout {
  id: string;
  projectFolderId: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  savedAt: string;
  unit: MeasurementUnit;
  roomView: FramingProjectDraft["roomView"];
  sourceMode: FramingProjectDraft["roomView"]["sourceMode"];
  sourceId: string;
  presetSceneId: string | null;
  wallPhoto: FramingProjectDraft["roomView"]["wallPhoto"];
  placementCount: number;
  placedFramedArtworkIds: string[];
}

type SavedFramedArtworkInput = Omit<
  SavedFramedArtwork,
  "id" | "createdAt" | "updatedAt" | "savedAt" | "renderData"
> &
  Partial<Pick<SavedFramedArtwork, "renderData">>;

type SavedRoomLayoutInput = Omit<
  SavedRoomLayout,
  "id" | "createdAt" | "updatedAt" | "savedAt" | "placementCount" | "placedFramedArtworkIds"
>;

interface SavedProjectsState {
  projects: SavedFramingProject[];
  projectFolders: ProjectFolder[];
  framedArtworks: SavedFramedArtwork[];
  roomLayouts: SavedRoomLayout[];
  createProjectFolder: (name: string) => ProjectFolder;
  saveProject: (project: Omit<SavedFramingProject, "id" | "savedAt">) => SavedFramingProject;
  saveFramedArtwork: (artwork: SavedFramedArtworkInput) => SavedFramedArtwork;
  saveRoomLayout: (layout: SavedRoomLayoutInput) => SavedRoomLayout;
  updateFramedArtwork: (
    id: string,
    artwork: SavedFramedArtworkInput
  ) => SavedFramedArtwork | null;
  reorderFramedArtworksInFolder: (projectFolderId: string, orderedIds: string[]) => void;
  reorderRoomLayoutsInFolder: (projectFolderId: string, orderedIds: string[]) => void;
  deleteProject: (id: string) => void;
  deleteFramedArtwork: (id: string) => void;
  deleteRoomLayout: (id: string) => void;
}

function reorderItemsInFolder<T extends { id: string; projectFolderId: string }>(
  items: T[],
  projectFolderId: string,
  orderedIds: string[]
) {
  const rankById = new Map(orderedIds.map((id, index) => [id, index]));
  const folderItems = items
    .filter((item) => item.projectFolderId === projectFolderId)
    .sort(
      (first, second) =>
        (rankById.get(first.id) ?? Number.MAX_SAFE_INTEGER) -
        (rankById.get(second.id) ?? Number.MAX_SAFE_INTEGER)
    );
  let folderIndex = 0;

  return items.map((item) => {
    if (item.projectFolderId !== projectFolderId) {
      return item;
    }

    const reorderedItem = folderItems[folderIndex];
    folderIndex += 1;
    return reorderedItem ?? item;
  });
}

function buildRenderData(
  draft: FramingProjectDraft,
  finalOuterSizeInches: SavedFramedArtwork["finalOuterSizeInches"]
): SavedFramedArtworkRenderData {
  return {
    artworkImageUri: draft.preview.artworkImageUri,
    artworkImageStoragePath: draft.preview.artworkImageStoragePath,
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
  const persistedRoomLayouts = typedState?.roomLayouts ?? [];
  const needsDefaultFolder =
    (persistedArtworks.some((artwork) => !artwork.projectFolderId) ||
      persistedRoomLayouts.some((layout) => !layout.projectFolderId)) &&
    persistedFolders.length === 0;
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
    const draft = normalizeDraftArtworkImageReference(artwork.draft);

    return {
      ...artwork,
      draft,
      projectFolderId: artwork.projectFolderId ?? fallbackFolderId,
      createdAt,
      updatedAt,
      savedAt: artwork.savedAt ?? createdAt,
      notes: artwork.notes ?? "",
      renderData: buildRenderData(draft, finalOuterSizeInches),
    };
  });
  const roomLayouts = persistedRoomLayouts.map((layout) => {
    const createdAt = layout.createdAt ?? layout.savedAt ?? now;
    const updatedAt = layout.updatedAt ?? layout.savedAt ?? createdAt;
    const roomView = {
      ...layout.roomView,
      savedRoomLayoutId: layout.roomView?.savedRoomLayoutId ?? layout.id,
    };
    const placedFramedArtworkIds =
      layout.placedFramedArtworkIds ??
      roomView.placements
        .map((placement) => placement.framedArtworkId)
        .filter((id): id is string => Boolean(id));

    return {
      ...layout,
      projectFolderId: layout.projectFolderId ?? fallbackFolderId,
      createdAt,
      updatedAt,
      savedAt: layout.savedAt ?? createdAt,
      notes: layout.notes ?? "",
      roomView,
      placementCount: layout.placementCount ?? roomView.placements.length,
      placedFramedArtworkIds,
    };
  });

  return {
    ...currentState,
    ...typedState,
    projects: typedState?.projects ?? currentState.projects,
    projectFolders,
    framedArtworks,
    roomLayouts,
  };
}

export const useSavedProjectsStore = create<SavedProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      projectFolders: [],
      framedArtworks: [],
      roomLayouts: [],
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
        const id = createId("framed-artwork");
        const draft = {
          ...artwork.draft,
          meta: {
            ...artwork.draft.meta,
            projectName: artwork.name,
            savedFramedArtworkId: id,
            sourceFramedArtworkId: id,
          },
        };
        const renderData = artwork.renderData ?? buildRenderData(draft, artwork.finalOuterSizeInches);
        const savedArtwork: SavedFramedArtwork = {
          ...artwork,
          id,
          createdAt: timestamp,
          updatedAt: timestamp,
          savedAt: timestamp,
          draft,
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
      saveRoomLayout: (layout) => {
        const timestamp = new Date().toISOString();
        const id = createId("room-layout");
        const roomView = {
          ...layout.roomView,
          savedRoomLayoutId: id,
        };
        const savedLayout: SavedRoomLayout = {
          ...layout,
          id,
          createdAt: timestamp,
          updatedAt: timestamp,
          savedAt: timestamp,
          roomView,
          placementCount: roomView.placements.length,
          placedFramedArtworkIds: roomView.placements
            .map((placement) => placement.framedArtworkId)
            .filter((framedArtworkId): framedArtworkId is string => Boolean(framedArtworkId)),
        };

        set((state) => ({
          roomLayouts: [savedLayout, ...state.roomLayouts],
          projectFolders: state.projectFolders.map((folder) =>
            folder.id === layout.projectFolderId ? { ...folder, updatedAt: timestamp } : folder
          ),
        }));

        return savedLayout;
      },
      updateFramedArtwork: (id, artwork) => {
        const timestamp = new Date().toISOString();
        const draft = {
          ...artwork.draft,
          meta: {
            ...artwork.draft.meta,
            projectName: artwork.name,
            savedFramedArtworkId: id,
            sourceFramedArtworkId: id,
          },
        };
        const renderData = artwork.renderData ?? buildRenderData(draft, artwork.finalOuterSizeInches);
        let updatedArtwork: SavedFramedArtwork | null = null;
        let previousProjectFolderId: string | null = null;

        set((state) => {
          const existingArtwork = state.framedArtworks.find((item) => item.id === id);

          if (!existingArtwork) {
            return state;
          }

          previousProjectFolderId = existingArtwork.projectFolderId;
          updatedArtwork = {
            ...existingArtwork,
            ...artwork,
            id: existingArtwork.id,
            createdAt: existingArtwork.createdAt,
            savedAt: existingArtwork.savedAt,
            updatedAt: timestamp,
            draft,
            renderData,
          };

          return {
            framedArtworks: state.framedArtworks.map((item) =>
              item.id === id ? updatedArtwork! : item
            ),
            projectFolders: state.projectFolders.map((folder) =>
              folder.id === artwork.projectFolderId || folder.id === previousProjectFolderId
                ? { ...folder, updatedAt: timestamp }
                : folder
            ),
          };
        });

        return updatedArtwork;
      },
      reorderFramedArtworksInFolder: (projectFolderId, orderedIds) => {
        const timestamp = new Date().toISOString();

        set((state) => ({
          framedArtworks: reorderItemsInFolder(
            state.framedArtworks,
            projectFolderId,
            orderedIds
          ),
          projectFolders: state.projectFolders.map((folder) =>
            folder.id === projectFolderId ? { ...folder, updatedAt: timestamp } : folder
          ),
        }));
      },
      reorderRoomLayoutsInFolder: (projectFolderId, orderedIds) => {
        const timestamp = new Date().toISOString();

        set((state) => ({
          roomLayouts: reorderItemsInFolder(
            state.roomLayouts,
            projectFolderId,
            orderedIds
          ),
          projectFolders: state.projectFolders.map((folder) =>
            folder.id === projectFolderId ? { ...folder, updatedAt: timestamp } : folder
          ),
        }));
      },
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
        })),
      deleteFramedArtwork: (id) =>
        set((state) => ({
          framedArtworks: state.framedArtworks.filter((artwork) => artwork.id !== id),
        })),
      deleteRoomLayout: (id) =>
        set((state) => ({
          roomLayouts: state.roomLayouts.filter((layout) => layout.id !== id),
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
