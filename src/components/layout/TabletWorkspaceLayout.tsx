import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export const TABLET_WORKSPACE_BREAKPOINT = 768;
export const TABLET_LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH = 1180;
export const TABLET_LANDSCAPE_CONTROLS_COLUMN_WIDTH = 408;
export const TABLET_PORTRAIT_WORKSPACE_CONTENT_MAX_WIDTH = 900;

export type TabletWorkspaceMode = "phone" | "tabletPortrait" | "tabletLandscape";

export function getTabletWorkspaceMode(width: number, height: number): TabletWorkspaceMode {
  const isTablet = Math.min(width, height) >= TABLET_WORKSPACE_BREAKPOINT;

  if (!isTablet) {
    return "phone";
  }

  return width > height ? "tabletLandscape" : "tabletPortrait";
}

export function getTabletWorkspaceContentMaxWidth(
  mode: TabletWorkspaceMode,
  phoneContentMaxWidth: number
) {
  if (mode === "tabletLandscape") {
    return TABLET_LANDSCAPE_WORKSPACE_CONTENT_MAX_WIDTH;
  }

  if (mode === "tabletPortrait") {
    return TABLET_PORTRAIT_WORKSPACE_CONTENT_MAX_WIDTH;
  }

  return phoneContentMaxWidth;
}

export function getTabletWorkspacePreviewCanvasHeight({
  mode,
  measuredPreviewHeight,
  isShortViewport,
}: {
  mode: TabletWorkspaceMode;
  measuredPreviewHeight: number;
  isShortViewport: boolean;
}) {
  if (mode === "tabletLandscape") {
    return Math.max(isShortViewport ? 100 : 180, Math.min(620, measuredPreviewHeight - 66));
  }

  if (mode === "tabletPortrait") {
    return Math.max(260, Math.min(720, measuredPreviewHeight - 34));
  }

  return Math.max(isShortViewport ? 100 : 180, Math.min(360, measuredPreviewHeight - 58));
}

export function TabletWorkspaceContent({
  mode,
  phoneContentMaxWidth,
  children,
  style,
}: {
  mode: TabletWorkspaceMode;
  phoneContentMaxWidth: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flex: 1,
          minHeight: 0,
          width: "100%",
          maxWidth: getTabletWorkspaceContentMaxWidth(mode, phoneContentMaxWidth),
          alignSelf: "center",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
