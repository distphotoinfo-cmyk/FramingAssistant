import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
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
  notifyAnchorLayout: (id: string) => void;
  measureAnchor: (id: string) => Promise<GuidanceAnchorRect | null>;
  layoutRevision: number;
};

const GuidanceContext = createContext<GuidanceContextValue | null>(null);

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  const anchorRefs = useRef(new Map<string, View | null>());
  const [layoutRevision, setLayoutRevision] = useState(0);

  const bumpLayoutRevision = useCallback(() => {
    setLayoutRevision((current) => current + 1);
  }, []);

  const registerAnchor = useCallback(
    (id: string, ref: View | null) => {
      const current = anchorRefs.current.get(id) ?? null;

      if (current === ref) {
        return;
      }

      if (ref) {
        anchorRefs.current.set(id, ref);
      } else {
        anchorRefs.current.delete(id);
      }

      bumpLayoutRevision();
    },
    [bumpLayoutRevision]
  );

  const unregisterAnchor = useCallback(
    (id: string) => {
      if (!anchorRefs.current.has(id)) {
        return;
      }

      anchorRefs.current.delete(id);
      bumpLayoutRevision();
    },
    [bumpLayoutRevision]
  );

  const notifyAnchorLayout = useCallback(
    (id: string) => {
      if (!anchorRefs.current.has(id)) {
        return;
      }

      bumpLayoutRevision();
    },
    [bumpLayoutRevision]
  );

  const measureAnchor = useCallback(async (id: string) => {
    const ref = anchorRefs.current.get(id);

    if (!ref) {
      return null;
    }

    return new Promise<GuidanceAnchorRect | null>((resolve) => {
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
  }, []);

  const value = useMemo<GuidanceContextValue>(
    () => ({
      registerAnchor,
      unregisterAnchor,
      notifyAnchorLayout,
      measureAnchor,
      layoutRevision,
    }),
    [layoutRevision, measureAnchor, notifyAnchorLayout, registerAnchor, unregisterAnchor]
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
