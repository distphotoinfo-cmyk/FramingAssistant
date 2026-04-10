export type FramingFlowParamList = {
  Setup: undefined;
  PreviewAdjust: undefined;
  FinalSpecs: undefined;
};

export type FramingRootStackParamList = FramingFlowParamList & {
  Settings: undefined;
  SavedProjects: undefined;
  ArtworkCrop: {
    imageUri: string;
    imageWidth?: number | null;
    imageHeight?: number | null;
    mode: "import" | "edit";
  };
};

export type FramingFlowRouteName = keyof FramingFlowParamList;
export type FramingRootRouteName = keyof FramingRootStackParamList;
