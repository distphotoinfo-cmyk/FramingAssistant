export interface ReplicateProviderConfig {
  apiToken?: string;
  baseUrl?: string;
}

export interface ReplicatePredictionRequest {
  model: string;
  input: Record<string, unknown>;
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
    if (!this.config.apiToken) {
      throw new Error("Replicate provider is not configured.");
    }

    throw new Error("Replicate integration is not implemented yet.");
  }
}
