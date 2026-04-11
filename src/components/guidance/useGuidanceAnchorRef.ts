import { useCallback } from "react";
import type { View } from "react-native";
import { useGuidance } from "./GuidanceProvider";

export default function useGuidanceAnchorRef<T extends View = View>(id: string) {
  const { registerAnchor, unregisterAnchor } = useGuidance();

  return useCallback(
    (node: T | null) => {
      if (node) {
        registerAnchor(id, node as View);
        return;
      }

      unregisterAnchor(id);
    },
    [id, registerAnchor, unregisterAnchor]
  );
}
