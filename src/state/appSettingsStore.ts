import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppColorMode, FractionDenominator, MeasurementUnit } from "../types/framing";
import { normalizeHex } from "../utils/color";
import {
  DEFAULT_PREVIEW_SNAP_INCREMENT_INCHES,
  sanitizePreviewSnapIncrementInches,
} from "../utils/formatters";

type GuideTipKey =
  | "artwork"
  | "crop"
  | "reveal"
  | "outerMat"
  | "weighting"
  | "review";

type DismissedGuideTips = Partial<Record<GuideTipKey, boolean>>;

const MAX_CUSTOM_COLOR_PRESETS = 5;
const DEFAULT_IMPERIAL_PRECISION: FractionDenominator = 8;

function normalizeImperialPrecision(
  imperialPrecision: FractionDenominator | number | null | undefined
): FractionDenominator {
  if (imperialPrecision === 16 || imperialPrecision === 32) {
    return imperialPrecision;
  }

  return DEFAULT_IMPERIAL_PRECISION;
}

function buildGuidanceSessionState({
  guidanceTestingEnabled,
  alwaysShowGuidanceOnLaunch,
  hasSeenSetupIntro,
  hasSeenPreviewAdjustIntro,
  dismissedGuideTips,
}: {
  guidanceTestingEnabled: boolean;
  alwaysShowGuidanceOnLaunch: boolean;
  hasSeenSetupIntro: boolean;
  hasSeenPreviewAdjustIntro: boolean;
  dismissedGuideTips: DismissedGuideTips;
}) {
  if (guidanceTestingEnabled && alwaysShowGuidanceOnLaunch) {
    return {
      sessionHasSeenSetupIntro: false,
      sessionHasSeenPreviewAdjustIntro: false,
      sessionDismissedGuideTips: {} as DismissedGuideTips,
    };
  }

  return {
    sessionHasSeenSetupIntro: hasSeenSetupIntro,
    sessionHasSeenPreviewAdjustIntro: hasSeenPreviewAdjustIntro,
    sessionDismissedGuideTips: { ...dismissedGuideTips },
  };
}

function savePresetValue(currentValues: string[], nextHex: string) {
  const normalized = normalizeHex(nextHex);
  const deduped = currentValues
    .map((value) => normalizeHex(value))
    .filter((value) => value !== normalized);

  return [normalized, ...deduped].slice(0, MAX_CUSTOM_COLOR_PRESETS);
}

interface AppSettingsState {
  colorMode: AppColorMode;
  unit: MeasurementUnit;
  imperialPrecision: FractionDenominator;
  previewSnapIncrementInches: number;
  matColorPresets: string[];
  frameColorPresets: string[];
  guidanceTestingEnabled: boolean;
  alwaysShowGuidanceOnLaunch: boolean;
  hasSeenSetupIntro: boolean;
  hasSeenPreviewAdjustIntro: boolean;
  dismissedGuideTips: DismissedGuideTips;
  sessionHasSeenSetupIntro: boolean;
  sessionHasSeenPreviewAdjustIntro: boolean;
  sessionDismissedGuideTips: DismissedGuideTips;
  hasHydrated: boolean;
  setColorMode: (colorMode: AppColorMode) => void;
  setUnit: (unit: MeasurementUnit) => void;
  setImperialPrecision: (imperialPrecision: FractionDenominator) => void;
  setPreviewSnapIncrementInches: (previewSnapIncrementInches: number | string) => void;
  saveMatColorPreset: (hex: string) => void;
  saveFrameColorPreset: (hex: string) => void;
  setGuidanceTestingEnabled: (guidanceTestingEnabled: boolean) => void;
  setAlwaysShowGuidanceOnLaunch: (alwaysShowGuidanceOnLaunch: boolean) => void;
  markSetupIntroSeen: () => void;
  markPreviewAdjustIntroSeen: () => void;
  dismissGuideTip: (key: GuideTipKey) => void;
  completeHydration: () => void;
}

type PersistedAppSettingsState = Pick<
  AppSettingsState,
  | "colorMode"
  | "unit"
  | "imperialPrecision"
  | "previewSnapIncrementInches"
  | "matColorPresets"
  | "frameColorPresets"
  | "guidanceTestingEnabled"
  | "alwaysShowGuidanceOnLaunch"
  | "hasSeenSetupIntro"
  | "hasSeenPreviewAdjustIntro"
  | "dismissedGuideTips"
>;

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      colorMode: "dark",
      unit: "in",
      imperialPrecision: DEFAULT_IMPERIAL_PRECISION,
      previewSnapIncrementInches: DEFAULT_PREVIEW_SNAP_INCREMENT_INCHES,
      matColorPresets: [],
      frameColorPresets: [],
      guidanceTestingEnabled: false,
      alwaysShowGuidanceOnLaunch: false,
      hasSeenSetupIntro: false,
      hasSeenPreviewAdjustIntro: false,
      dismissedGuideTips: {},
      sessionHasSeenSetupIntro: false,
      sessionHasSeenPreviewAdjustIntro: false,
      sessionDismissedGuideTips: {},
      hasHydrated: false,
      setColorMode: (colorMode) => set({ colorMode }),
      setUnit: (unit) => set({ unit }),
      setImperialPrecision: (imperialPrecision) =>
        set({ imperialPrecision: normalizeImperialPrecision(imperialPrecision) }),
      setPreviewSnapIncrementInches: (previewSnapIncrementInches) =>
        set({
          previewSnapIncrementInches: sanitizePreviewSnapIncrementInches(previewSnapIncrementInches),
        }),
      saveMatColorPreset: (hex) =>
        set((state) => ({
          matColorPresets: savePresetValue(state.matColorPresets, hex),
        })),
      saveFrameColorPreset: (hex) =>
        set((state) => ({
          frameColorPresets: savePresetValue(state.frameColorPresets, hex),
        })),
      setGuidanceTestingEnabled: (guidanceTestingEnabled) =>
        set((state) => {
          const nextAlwaysShowGuidanceOnLaunch = guidanceTestingEnabled
            ? state.alwaysShowGuidanceOnLaunch
            : false;

          return {
            guidanceTestingEnabled,
            alwaysShowGuidanceOnLaunch: nextAlwaysShowGuidanceOnLaunch,
            ...buildGuidanceSessionState({
              guidanceTestingEnabled,
              alwaysShowGuidanceOnLaunch: nextAlwaysShowGuidanceOnLaunch,
              hasSeenSetupIntro: state.hasSeenSetupIntro,
              hasSeenPreviewAdjustIntro: state.hasSeenPreviewAdjustIntro,
              dismissedGuideTips: state.dismissedGuideTips,
            }),
          };
        }),
      setAlwaysShowGuidanceOnLaunch: (alwaysShowGuidanceOnLaunch) =>
        set((state) => ({
          alwaysShowGuidanceOnLaunch,
          ...buildGuidanceSessionState({
            guidanceTestingEnabled: state.guidanceTestingEnabled,
            alwaysShowGuidanceOnLaunch,
            hasSeenSetupIntro: state.hasSeenSetupIntro,
            hasSeenPreviewAdjustIntro: state.hasSeenPreviewAdjustIntro,
            dismissedGuideTips: state.dismissedGuideTips,
          }),
        })),
      markSetupIntroSeen: () =>
        set({
          hasSeenSetupIntro: true,
          sessionHasSeenSetupIntro: true,
        }),
      markPreviewAdjustIntroSeen: () =>
        set({
          hasSeenPreviewAdjustIntro: true,
          sessionHasSeenPreviewAdjustIntro: true,
        }),
      dismissGuideTip: (key) =>
        set((state) => ({
          dismissedGuideTips: {
            ...state.dismissedGuideTips,
            [key]: true,
          },
          sessionDismissedGuideTips: {
            ...state.sessionDismissedGuideTips,
            [key]: true,
          },
        })),
      completeHydration: () =>
        set((state) => ({
          hasHydrated: true,
          ...buildGuidanceSessionState({
            guidanceTestingEnabled: state.guidanceTestingEnabled,
            alwaysShowGuidanceOnLaunch: state.alwaysShowGuidanceOnLaunch,
            hasSeenSetupIntro: state.hasSeenSetupIntro,
            hasSeenPreviewAdjustIntro: state.hasSeenPreviewAdjustIntro,
            dismissedGuideTips: state.dismissedGuideTips,
          }),
        })),
    }),
    {
      name: "framing-app-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedAppSettingsState => ({
        colorMode: state.colorMode,
        unit: state.unit,
        imperialPrecision: state.imperialPrecision,
        previewSnapIncrementInches: state.previewSnapIncrementInches,
        matColorPresets: state.matColorPresets,
        frameColorPresets: state.frameColorPresets,
        guidanceTestingEnabled: state.guidanceTestingEnabled,
        alwaysShowGuidanceOnLaunch: state.alwaysShowGuidanceOnLaunch,
        hasSeenSetupIntro: state.hasSeenSetupIntro,
        hasSeenPreviewAdjustIntro: state.hasSeenPreviewAdjustIntro,
        dismissedGuideTips: state.dismissedGuideTips,
      }),
      merge: (persistedState, currentState) => {
        const typedState =
          (persistedState as
            | (Partial<PersistedAppSettingsState> & {
                previewSnapDenominator?: FractionDenominator;
              })
            | undefined) ?? {};
        const { previewSnapDenominator: legacyPreviewSnapDenominator, ...restPersisted } = typedState;

        return {
          ...currentState,
          ...restPersisted,
          imperialPrecision: normalizeImperialPrecision(typedState.imperialPrecision),
          previewSnapIncrementInches: sanitizePreviewSnapIncrementInches(
            typedState.previewSnapIncrementInches ??
              (legacyPreviewSnapDenominator ? 1 / legacyPreviewSnapDenominator : undefined)
          ),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.completeHydration();
      },
    }
  )
);

export type { GuideTipKey };
