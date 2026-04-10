import { useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { FramingFlowRouteName, FramingRootStackParamList } from "../types/navigation";
import { FRAMING_FLOW_STEPS, getStepDefinition } from "../utils/flowSteps";

export function useStepNavigation(route: FramingFlowRouteName) {
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();

  return useMemo(() => {
    const currentStep = getStepDefinition(route);
    const currentIndex = FRAMING_FLOW_STEPS.findIndex((step) => step.route === route);
    const previousStep = currentIndex > 0 ? FRAMING_FLOW_STEPS[currentIndex - 1] : null;
    const nextStep = currentIndex >= 0 && currentIndex < FRAMING_FLOW_STEPS.length - 1
      ? FRAMING_FLOW_STEPS[currentIndex + 1]
      : null;

    return {
      currentStep,
      totalSteps: FRAMING_FLOW_STEPS.length,
      previousStep,
      nextStep,
      goBack: () => {
        if (previousStep) {
          navigation.navigate(previousStep.route);
        }
      },
      goNext: () => {
        if (nextStep) {
          navigation.navigate(nextStep.route);
        }
      },
      goTo: (target: FramingFlowRouteName) => navigation.navigate(target),
    };
  }, [navigation, route]);
}
