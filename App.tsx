import React from "react";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import FramingFlowNavigator from "./src/navigation/FramingFlowNavigator";
import { AppThemeProvider, useAppTheme } from "./src/theme/AppThemeProvider";

function AppShell() {
  const { colors, isDark } = useAppTheme();
  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      primary: colors.accent,
      card: colors.headerBackground,
      text: colors.textPrimary,
      border: colors.headerBackground,
      notification: colors.accent,
    },
  };

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationContainer theme={navigationTheme}>
        <FramingFlowNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AppShell />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
