import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import useGuidanceAnchorRef from "./useGuidanceAnchorRef";

interface GuidanceAnchorProps {
  id: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function GuidanceAnchor({ id, children, style }: GuidanceAnchorProps) {
  const ref = useGuidanceAnchorRef<View>(id);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
