import React, { useCallback } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { useGuidance } from "./GuidanceProvider";
import useGuidanceAnchorRef from "./useGuidanceAnchorRef";

interface GuidanceAnchorProps {
  id: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function GuidanceAnchor({ id, children, style }: GuidanceAnchorProps) {
  const { notifyAnchorLayout } = useGuidance();
  const ref = useGuidanceAnchorRef<View>(id);
  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      notifyAnchorLayout(id);
    },
    [id, notifyAnchorLayout]
  );

  return (
    <View ref={ref} collapsable={false} onLayout={handleLayout} style={style}>
      {children}
    </View>
  );
}
