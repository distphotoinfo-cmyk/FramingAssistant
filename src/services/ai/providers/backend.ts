import type { AIWallEnhancementMode } from "../../../types/framing";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const DEFAULT_ENHANCE_WALL_PHOTO_PATH = "/api/ai/enhance-wall-photo";
const DEFAULT_TIMEOUT_MS = 120000;

export interface AIBackendProviderConfig {
  baseUrl?: string;
  enhanceWallPhotoPath?: string;
  timeoutMs?: number;
}

export interface AIWallEnhancementSettings {
  preservePerspective?: boolean;
  preserveScaleReferences?: boolean;
  cleanupWallMarks?: boolean;
  balanceLighting?: boolean;
}

export interface AIBackendEnhanceWallPhotoRequest {
  imageUri: string;
  enhancementMode: AIWallEnhancementMode;
  settings?: AIWallEnhancementSettings;
}

export interface AIBackendEnhanceWallPhotoResult {
  imageUri: string;
  provider?: "backend" | "replicate";
  metadata?: {
    displayAdjustments?: {
      brightness?: number;
      warmth?: number;
      contrast?: number;
    };
    model?: string;
    predictionId?: string;
    processingStatus?: "succeeded" | "processing";
  };
}

type EnhanceWallPhotoResponse = {
  enhancedImageUrl?: string;
  enhancedImageUri?: string;
  imageUrl?: string;
  imageUri?: string;
  enhancedImageBase64?: string;
  mimeType?: string;
  provider?: "backend" | "replicate";
  metadata?: AIBackendEnhanceWallPhotoResult["metadata"];
};

type AIBackendErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

function readPublicEnv(name: string) {
  try {
    return typeof process !== "undefined" ? process.env?.[name]?.trim() : undefined;
  } catch {
    return undefined;
  }
}

function getDefaultBaseUrl() {
  return readPublicEnv("EXPO_PUBLIC_AI_BACKEND_URL") ?? "";
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function resolveEndpoint(config: AIBackendProviderConfig) {
  const baseUrl = (config.baseUrl ?? getDefaultBaseUrl()).trim();

  if (!baseUrl) {
    throw new Error(
      "AI Wall Enhancement needs a backend URL before it can run. Set EXPO_PUBLIC_AI_BACKEND_URL for this app build."
    );
  }

  const path = config.enhanceWallPhotoPath ?? DEFAULT_ENHANCE_WALL_PHOTO_PATH;

  return `${trimTrailingSlash(baseUrl)}${ensureLeadingSlash(path)}`;
}

function getFileName(uri: string) {
  const cleanUri = uri.split("?")[0] ?? uri;
  const rawName = cleanUri.split("/").filter(Boolean).pop();

  return rawName?.includes(".") ? rawName : "wall-photo.jpg";
}

function getMimeType(uri: string) {
  const cleanUri = uri.split("?")[0]?.toLowerCase() ?? "";

  if (cleanUri.endsWith(".png")) return "image/png";
  if (cleanUri.endsWith(".webp")) return "image/webp";
  if (cleanUri.endsWith(".heic")) return "image/heic";
  if (cleanUri.endsWith(".heif")) return "image/heif";

  return "image/jpeg";
}

function buildWallPhotoFormData(request: AIBackendEnhanceWallPhotoRequest) {
  const formData = new FormData();

  formData.append("enhancementMode", request.enhancementMode);
  formData.append(
    "settings",
    JSON.stringify({
      preservePerspective: true,
      preserveScaleReferences: true,
      cleanupWallMarks: true,
      balanceLighting: true,
      ...request.settings,
    })
  );
  formData.append("image", {
    uri: request.imageUri,
    name: getFileName(request.imageUri),
    type: getMimeType(request.imageUri),
  } as unknown as Blob);

  return formData;
}

function resolveEnhancedImageUri(response: EnhanceWallPhotoResponse) {
  if (response.enhancedImageBase64) {
    return `data:${response.mimeType ?? "image/jpeg"};base64,${response.enhancedImageBase64}`;
  }

  return (
    response.enhancedImageUrl ??
    response.enhancedImageUri ??
    response.imageUrl ??
    response.imageUri ??
    null
  );
}

async function readBackendErrorMessage(response: Response) {
  try {
    const json = (await response.json()) as AIBackendErrorResponse;

    return json.error?.message ?? null;
  } catch {
    return null;
  }
}

export class AIBackendProvider {
  private readonly config: AIBackendProviderConfig;

  constructor(config: AIBackendProviderConfig = {}) {
    this.config = config;
  }

  async enhanceWallPhoto(
    request: AIBackendEnhanceWallPhotoRequest
  ): Promise<AIBackendEnhanceWallPhotoResult> {
    const endpoint = resolveEndpoint(this.config);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: buildWallPhotoFormData(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const backendMessage = await readBackendErrorMessage(response);

        throw new Error(
          backendMessage ??
          (response.status === 404
            ? "The AI Wall Enhancement endpoint was not found."
            : "AI Wall Enhancement is temporarily unavailable.")
        );
      }

      const json = (await response.json()) as EnhanceWallPhotoResponse;
      const imageUri = resolveEnhancedImageUri(json);

      if (!imageUri) {
        throw new Error("The AI service did not return an enhanced image.");
      }

      return {
        imageUri,
        provider: json.provider ?? "backend",
        metadata: json.metadata,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("AI Wall Enhancement took too long. Please try again.");
      }

      if (error instanceof TypeError) {
        throw new Error(
          "Could not reach the AI Wall Enhancement backend. Check the backend URL and try again."
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
