import { useEffect, useRef } from "react";
import type { View } from "react-native";
import { useGuidance } from "./GuidanceProvider";

export default function useGuidanceAnchorRef<T extends View = View>(id: string) {
  const { registerAnchor, unregisterAnchor } = useGuidance();
  const ref = useRef<T | null>(null);

  useEffect(() => {
    registerAnchor(id, ref.current as View | null);
  });

  useEffect(() => {
    return () => unregisterAnchor(id);
  }, [id, unregisterAnchor]);

  return ref;
}
