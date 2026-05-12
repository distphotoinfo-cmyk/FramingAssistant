import type { FramingFlowRouteName } from "../types/navigation";

export interface FlowStepDefinition {
  route: FramingFlowRouteName;
  stepNumber: number;
  title: string;
  shortLabel: string;
}

export const FRAMING_FLOW_STEPS: FlowStepDefinition[] = [
  { route: "Setup", stepNumber: 1, title: "Setup", shortLabel: "Setup" },
  { route: "PreviewAdjust", stepNumber: 2, title: "Adjust", shortLabel: "Adjust" },
  { route: "FinalSpecs", stepNumber: 3, title: "Save", shortLabel: "Save" },
];

export function getStepDefinition(route: FramingFlowRouteName) {
  return FRAMING_FLOW_STEPS.find((step) => step.route === route) ?? FRAMING_FLOW_STEPS[0];
}
