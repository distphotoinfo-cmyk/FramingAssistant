import React, { createContext, useContext, useMemo, useRef } from "react";
import { View } from "react-native";

export type GuidanceAnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GuidanceContextValue = {
  registerAnchor: (id: string, ref: View | null) => void;
  unregisterAnchor: (id: string) => void;
  measureAnchor: (id: string) => Promise<GuidanceAnchorRect | null>;
};

const GuidanceContext = createContext<GuidanceContextValue | null>(null);

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  const anchorRefs = useRef(new Map<string, View | null>());

  const value = useMemo<GuidanceContextValue>(
    () => ({
      registerAnchor: (id, ref) => {
        anchorRefs.current.set(id, ref);
      },
      unregisterAnchor: (id) => {
        anchorRefs.current.delete(id);
      },
      measureAnchor: async (id) => {
        const ref = anchorRefs.current.get(id);

        if (!ref) {
          return null;
        }

        return new Promise((resolve) => {
          requestAnimationFrame(() => {
            ref.measureInWindow((x, y, width, height) => {
              if (!width && !height) {
                resolve(null);
                return;
              }

              resolve({ x, y, width, height });
            });
          });
        });
      },
    }),
    []
  );

  return <GuidanceContext.Provider value={value}>{children}</GuidanceContext.Provider>;
}

export function useGuidance() {
  const context = useContext(GuidanceContext);

  if (!context) {
    throw new Error("useGuidance must be used within a GuidanceProvider");
  }

  return context;
}
