import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStepNavigation } from "../hooks/useStepNavigation";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FramingFlowRouteName, FramingRootStackParamList } from "../types/navigation";
import AppHeader from "./AppHeader";
import ScreenContainer from "./ScreenContainer";
import StepProgress from "./StepProgress";
import GuideBubbleOverlay from "./guidance/GuideBubbleOverlay";
import AppButton from "./ui/AppButton";

interface FlowStepLayoutProps {
  route: FramingFlowRouteName;
  title: string;
  intro?: string;
  nextLabel?: string;
  onNext?: () => void;
  children: React.ReactNode;
  footerNote?: string;
  footerVariant?: "default" | "compactBackArrow";
  scrollEnabled?: boolean;
  disableScrollViewPanResponder?: boolean;
  shellBubble?: {
    visible: boolean;
    title: string;
    body: string;
    stepLabel?: string;
    onDismiss: () => void;
  };
}

export default function FlowStepLayout(props: FlowStepLayoutProps) {
  const {
    route,
    nextLabel,
    onNext,
    children,
    footerNote,
    footerVariant = "default",
    scrollEnabled = true,
    disableScrollViewPanResponder = false,
    shellBubble,
  } = props;
  const insets = useSafeAreaInsets();
  const { colors, layout, radii, spacing, typography } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const { currentStep, totalSteps, previousStep, goBack, goNext } = useStepNavigation(route);
  const compactBackArrowFooter = footerVariant === "compactBackArrow";

  return (
    <ScreenContainer>
      <AppHeader
        onOpenProjects={() => navigation.navigate("SavedProjects")}
        onOpenSettings={() => navigation.navigate("Settings")}
      />

      <GuideBubbleOverlay
        visible={Boolean(shellBubble?.visible)}
        title={shellBubble?.title ?? ""}
        body={shellBubble?.body ?? ""}
        stepLabel={shellBubble?.stepLabel}
        onDismiss={shellBubble?.onDismiss ?? (() => undefined)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
        scrollEnabled={scrollEnabled}
        disableScrollViewPanResponder={disableScrollViewPanResponder}
      >
        <View style={{ width: "100%", maxWidth: layout.contentMaxWidth, alignSelf: "center" }}>
          <StepProgress
            currentStep={currentStep.stepNumber}
            totalSteps={totalSteps}
            label={currentStep.shortLabel}
          />

          <View style={{ gap: spacing.xl }}>
            {children}
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.08)",
          backgroundColor: colors.headerBackground,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xxl,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        }}
      >
        <View style={{ width: "100%", maxWidth: layout.contentMaxWidth, alignSelf: "center" }}>
          {footerNote && !compactBackArrowFooter ? (
            <Text style={{ ...typography.small, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.sm }}>
              {footerNote}
            </Text>
          ) : null}

          {compactBackArrowFooter ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
              }}
            >
              {previousStep ? (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    goBack();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
                    backgroundColor: "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.72)" />
                </Pressable>
              ) : null}

              <AppButton
                label={nextLabel ?? "Continue"}
                onPress={onNext ?? goNext}
                style={{ width: "52%" }}
              />
            </View>
          ) : (
            <>
              <AppButton
                label={nextLabel ?? "Continue"}
                onPress={onNext ?? goNext}
                style={{ width: "52%", alignSelf: "center" }}
              />

              {previousStep ? (
                <AppButton
                  variant="secondary"
                  label="Back"
                  onPress={goBack}
                  style={{ width: "42%", alignSelf: "center", marginTop: spacing.sm }}
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
