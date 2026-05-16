export interface ReplicateProviderConfig {
  model?: string;
  version?: string;
  supportsAsyncProcessing?: boolean;
}

export interface ReplicatePredictionRequest {
  model?: string;
  version?: string;
  input: Record<string, unknown>;
  webhookUrl?: string;
  waitForCompletion?: boolean;
}

export interface ReplicatePredictionResult {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
}

export class ReplicateProvider {
  private readonly config: ReplicateProviderConfig;

  constructor(config: ReplicateProviderConfig = {}) {
    this.config = config;
  }

  async createPrediction(
    _request: ReplicatePredictionRequest
  ): Promise<ReplicatePredictionResult> {
    throw new Error(
      "Replicate predictions must be created by the backend. The mobile app should call the AI backend endpoint instead of storing a Replicate API token."
    );
  }
}
