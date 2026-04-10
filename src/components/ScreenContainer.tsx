import React from "react";
import { View } from "react-native";
import { useAppTheme } from "../theme/AppThemeProvider";

export default function ScreenContainer({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {children}
    </View>
  );
}
