import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FramingRootStackParamList } from "../types/navigation";
import FinalSpecsScreen from "../screens/FinalSpecsScreen";
import ArtworkCropScreen from "../screens/ArtworkCropScreen";
import PreviewAdjustScreen from "../screens/PreviewAdjustScreen";
import RoomViewScreen from "../screens/RoomViewScreen";
import SavedProjectsScreen from "../screens/SavedProjectsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SetupScreen from "../screens/SetupScreen";

const Stack = createNativeStackNavigator<FramingRootStackParamList>();

export default function FramingFlowNavigator() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName="Setup"
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="PreviewAdjust" component={PreviewAdjustScreen} />
      <Stack.Screen name="FinalSpecs" component={FinalSpecsScreen} />
      <Stack.Screen name="RoomView" component={RoomViewScreen} />
      <Stack.Screen
        name="ArtworkCrop"
        component={ArtworkCropScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="SavedProjects"
        component={SavedProjectsScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </Stack.Navigator>
  );
}
