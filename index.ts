import React from "react";
import { registerRootComponent } from "expo";
import { ScrollView, Text, View } from "react-native";

type AppModule = {
  default: React.ComponentType;
};

function StartupErrorScreen({
  message,
  stack,
}: {
  message: string;
  stack?: string;
}) {
  return React.createElement(
    ScrollView,
    {
      contentContainerStyle: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 48,
        backgroundColor: "#111111",
      },
    },
    React.createElement(
      View,
      {
        style: {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#3B3B3B",
          backgroundColor: "#1B1B1B",
          padding: 20,
          gap: 12,
        },
      },
      React.createElement(
        Text,
        {
          style: {
            fontSize: 24,
            fontWeight: "700",
            color: "#F5F5F5",
          },
        },
        "App startup failed"
      ),
      React.createElement(
        Text,
        {
          style: {
            fontSize: 15,
            lineHeight: 22,
            color: "#E2E2E2",
          },
        },
        message
      ),
      React.createElement(
        Text,
        {
          style: {
            fontSize: 14,
            lineHeight: 20,
            color: "#B6B6B6",
          },
        },
        "If this mentions a missing native module, rebuild and reinstall the iOS app, then restart Metro with a cleared cache."
      ),
      stack
        ? React.createElement(
            Text,
            {
              selectable: true,
              style: {
                fontSize: 12,
                lineHeight: 18,
                color: "#9CC8FF",
              },
            },
            stack
          )
        : null
    )
  );
}

function loadApp() {
  require("react-native-gesture-handler");
  require("react-native-reanimated");

  return (require("./App") as AppModule).default;
}

let RootComponent: React.ComponentType;

if (__DEV__) {
  try {
    RootComponent = loadApp();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("Failed to initialize app entry.", error);

    RootComponent = function StartupFailureBoundary() {
      return React.createElement(StartupErrorScreen, { message, stack });
    };
  }
} else {
  RootComponent = loadApp();
}

registerRootComponent(RootComponent);
