import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ExperimentalFeatureKey =
  | "aiWallEnhancement"
  | "importedAIRooms"
  | "aiRoomGeneration";

export interface ExperimentalFeatureToggles {
  aiWallEnhancement: boolean;
  importedAIRooms: boolean;
  aiRoomGeneration: boolean;
}

export interface ExperimentalEntitlements {
  canUseAIWallEnhancement: boolean;
  canImportCustomRooms: boolean;
  canGenerateAIRooms: boolean;
  canUsePremiumScenes: boolean;
  source: "localDev" | "subscription";
  updatedAt: string | null;
}

export interface AIUsageTracking {
  aiWallEnhancementsUsed: number;
  aiRoomsGenerated: number;
  monthlyResetDate: string;
}

interface ExperimentalFeaturesState {
  featureToggles: ExperimentalFeatureToggles;
  entitlements: ExperimentalEntitlements;
  usage: AIUsageTracking;
  setFeatureEnabled: (feature: ExperimentalFeatureKey, enabled: boolean) => void;
  setEntitlements: (entitlements: Partial<Omit<ExperimentalEntitlements, "updatedAt">>) => void;
  incrementAIWallEnhancementsUsed: () => void;
  incrementAIRoomsGenerated: () => void;
  resetMonthlyUsage: (resetDate?: string) => void;
}

const DEFAULT_FEATURE_TOGGLES: ExperimentalFeatureToggles = {
  aiWallEnhancement: false,
  importedAIRooms: false,
  aiRoomGeneration: false,
};

const DEFAULT_ENTITLEMENTS: ExperimentalEntitlements = {
  canUseAIWallEnhancement: true,
  canImportCustomRooms: true,
  canGenerateAIRooms: false,
  canUsePremiumScenes: false,
  source: "localDev",
  updatedAt: null,
};

function getCurrentMonthResetDate() {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function normalizeFeatureToggles(
  featureToggles: Partial<ExperimentalFeatureToggles> | undefined
): ExperimentalFeatureToggles {
  return {
    ...DEFAULT_FEATURE_TOGGLES,
    ...featureToggles,
    aiRoomGeneration: false,
  };
}

function normalizeEntitlements(
  entitlements: Partial<ExperimentalEntitlements> | undefined
): ExperimentalEntitlements {
  return {
    ...DEFAULT_ENTITLEMENTS,
    ...entitlements,
    canGenerateAIRooms: false,
  };
}

function normalizeUsage(usage: Partial<AIUsageTracking> | undefined): AIUsageTracking {
  return {
    aiWallEnhancementsUsed: Math.max(0, usage?.aiWallEnhancementsUsed ?? 0),
    aiRoomsGenerated: Math.max(0, usage?.aiRoomsGenerated ?? 0),
    monthlyResetDate: usage?.monthlyResetDate ?? getCurrentMonthResetDate(),
  };
}

export function canUseExperimentalFeature(
  feature: ExperimentalFeatureKey,
  entitlements: ExperimentalEntitlements
) {
  switch (feature) {
    case "aiWallEnhancement":
      return entitlements.canUseAIWallEnhancement;
    case "importedAIRooms":
      return entitlements.canImportCustomRooms;
    case "aiRoomGeneration":
      return entitlements.canGenerateAIRooms;
  }
}

export const useExperimentalFeaturesStore = create<ExperimentalFeaturesState>()(
  persist(
    (set) => ({
      featureToggles: DEFAULT_FEATURE_TOGGLES,
      entitlements: DEFAULT_ENTITLEMENTS,
      usage: {
        aiWallEnhancementsUsed: 0,
        aiRoomsGenerated: 0,
        monthlyResetDate: getCurrentMonthResetDate(),
      },
      setFeatureEnabled: (feature, enabled) =>
        set((state) => ({
          featureToggles: {
            ...state.featureToggles,
            [feature]:
              enabled &&
              feature !== "aiRoomGeneration" &&
              canUseExperimentalFeature(feature, state.entitlements),
          },
        })),
      setEntitlements: (entitlements) =>
        set((state) => {
          const nextEntitlements = normalizeEntitlements({
            ...state.entitlements,
            ...entitlements,
            updatedAt: new Date().toISOString(),
          });

          return {
            entitlements: nextEntitlements,
            featureToggles: {
              aiWallEnhancement:
                state.featureToggles.aiWallEnhancement &&
                nextEntitlements.canUseAIWallEnhancement,
              importedAIRooms:
                state.featureToggles.importedAIRooms &&
                nextEntitlements.canImportCustomRooms,
              aiRoomGeneration: false,
            },
          };
        }),
      incrementAIWallEnhancementsUsed: () =>
        set((state) => ({
          usage: {
            ...state.usage,
            aiWallEnhancementsUsed: state.usage.aiWallEnhancementsUsed + 1,
          },
        })),
      incrementAIRoomsGenerated: () =>
        set((state) => ({
          usage: {
            ...state.usage,
            aiRoomsGenerated: state.usage.aiRoomsGenerated + 1,
          },
        })),
      resetMonthlyUsage: (resetDate = getCurrentMonthResetDate()) =>
        set({
          usage: {
            aiWallEnhancementsUsed: 0,
            aiRoomsGenerated: 0,
            monthlyResetDate: resetDate,
          },
        }),
    }),
    {
      name: "framing-experimental-features",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        featureToggles: state.featureToggles,
        entitlements: state.entitlements,
        usage: state.usage,
      }),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as
          | Partial<Pick<ExperimentalFeaturesState, "featureToggles" | "entitlements" | "usage">>
          | undefined;
        const entitlements = normalizeEntitlements(typedState?.entitlements);

        return {
          ...currentState,
          featureToggles: normalizeFeatureToggles(typedState?.featureToggles),
          entitlements,
          usage: normalizeUsage(typedState?.usage),
        };
      },
    }
  )
);
