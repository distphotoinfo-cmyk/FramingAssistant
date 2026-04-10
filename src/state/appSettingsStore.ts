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

const MAX_CUSTOM_COLOR_PRESETS = 5;

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
  hasSeenSetupIntro: boolean;
  dismissedGuideTips: Partial<Record<GuideTipKey, boolean>>;
  setColorMode: (colorMode: AppColorMode) => void;
  setUnit: (unit: MeasurementUnit) => void;
  setImperialPrecision: (imperialPrecision: FractionDenominator) => void;
  setPreviewSnapIncrementInches: (previewSnapIncrementInches: number | string) => void;
  saveMatColorPreset: (hex: string) => void;
  saveFrameColorPreset: (hex: string) => void;
  markSetupIntroSeen: () => void;
  dismissGuideTip: (key: GuideTipKey) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      colorMode: "dark",
      unit: "in",
      imperialPrecision: 16,
      previewSnapIncrementInches: DEFAULT_PREVIEW_SNAP_INCREMENT_INCHES,
      matColorPresets: [],
      frameColorPresets: [],
      hasSeenSetupIntro: false,
      dismissedGuideTips: {},
      setColorMode: (colorMode) => set({ colorMode }),
      setUnit: (unit) => set({ unit }),
      setImperialPrecision: (imperialPrecision) => set({ imperialPrecision }),
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
      markSetupIntroSeen: () => set({ hasSeenSetupIntro: true }),
      dismissGuideTip: (key) =>
        set((state) => ({
          dismissedGuideTips: {
            ...state.dismissedGuideTips,
            [key]: true,
          },
        })),
    }),
    {
      name: "framing-app-settings",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const typedState =
          (persistedState as
            | (Partial<AppSettingsState> & {
                previewSnapDenominator?: FractionDenominator;
              })
            | undefined) ?? {};
        const { previewSnapDenominator: legacyPreviewSnapDenominator, ...restPersisted } = typedState;

        return {
          ...currentState,
          ...restPersisted,
          previewSnapIncrementInches: sanitizePreviewSnapIncrementInches(
            typedState.previewSnapIncrementInches ??
              (legacyPreviewSnapDenominator ? 1 / legacyPreviewSnapDenominator : undefined)
          ),
        };
      },
    }
  )
);

export type { GuideTipKey };
