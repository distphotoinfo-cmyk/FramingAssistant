const REPLICATE_API_BASE_URL = "https://api.replicate.com/v1";
const DEFAULT_REPLICATE_MODEL = "nightmareai/real-esrgan";
const DEFAULT_REPLICATE_TIMEOUT_MS = 120000;
const DEFAULT_REPLICATE_POLL_INTERVAL_MS = 1200;

class ReplicateError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ReplicateError";
    this.status = options.status ?? 502;
    this.code = options.code ?? "replicate_error";
    this.details = options.details;
  }
}

class ReplicateTimeoutError extends ReplicateError {
  constructor(message = "Replicate prediction timed out.") {
    super(message, {
      status: 504,
      code: "replicate_timeout",
    });
    this.name = "ReplicateTimeoutError";
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJsonEnv(name, fallback) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    throw new ReplicateError(`${name} must be valid JSON.`, {
      status: 500,
      code: "bad_replicate_env_json",
    });
  }
}

function resolveModelConfig() {
  return {
    model: process.env.REPLICATE_MODEL?.trim() || DEFAULT_REPLICATE_MODEL,
    version: process.env.REPLICATE_VERSION?.trim() || "",
    imageInputKey: process.env.REPLICATE_IMAGE_INPUT_KEY?.trim() || "image",
    promptInputKey: process.env.REPLICATE_PROMPT_INPUT_KEY?.trim() || "",
    timeoutMs: parsePositiveInteger(
      process.env.REPLICATE_TIMEOUT_MS,
      DEFAULT_REPLICATE_TIMEOUT_MS
    ),
    pollIntervalMs: parsePositiveInteger(
      process.env.REPLICATE_POLL_INTERVAL_MS,
      DEFAULT_REPLICATE_POLL_INTERVAL_MS
    ),
  };
}

function getEnhancementPrompt(enhancementMode, settings) {
  const basePrompt =
    "Enhance this interior wall photo for framed artwork mockups. Preserve the room geometry, camera perspective, wall scale, furniture, windows, outlets, trim, and any calibration references.";

  if (enhancementMode === "relight") {
    return `${basePrompt} Balance the wall lighting naturally and reduce harsh color casts without changing the room.`;
  }

  if (enhancementMode === "perspectiveAssist") {
    return `${basePrompt} Keep the wall plane realistic and visually straight while preserving the original camera perspective.`;
  }

  const cleanup = settings?.cleanupWallMarks === false
    ? "Keep existing wall texture and marks natural."
    : "Subtly clean small wall marks, noise, and uneven patches.";
  const lighting = settings?.balanceLighting === false
    ? "Keep the existing lighting character."
    : "Balance lighting gently so the wall remains believable.";

  return `${basePrompt} ${cleanup} ${lighting}`;
}

function buildPredictionInput({ imageInput, enhancementMode, settings }) {
  const config = resolveModelConfig();
  const configuredInput = parseJsonEnv("REPLICATE_INPUT_JSON", {});
  const input = {
    [config.imageInputKey]: imageInput,
    ...configuredInput,
  };

  if (config.model === DEFAULT_REPLICATE_MODEL && !process.env.REPLICATE_VERSION) {
    input.scale = input.scale ?? 2;
    input.face_enhance = input.face_enhance ?? false;
  }

  if (config.promptInputKey) {
    input[config.promptInputKey] = getEnhancementPrompt(enhancementMode, settings);
  }

  if (process.env.REPLICATE_FORWARD_SETTINGS === "true") {
    input.enhancement_mode = enhancementMode;
    input.wall_enhancement_settings = settings ?? {};
  }

  return input;
}

function getCreatePredictionUrl(config) {
  if (config.version) {
    return `${REPLICATE_API_BASE_URL}/predictions`;
  }

  const modelParts = config.model.split("/");

  if (modelParts.length !== 2 || !modelParts[0] || !modelParts[1]) {
    throw new ReplicateError(
      "REPLICATE_MODEL must look like owner/model when REPLICATE_VERSION is not set.",
      {
        status: 500,
        code: "bad_replicate_model",
      }
    );
  }

  return `${REPLICATE_API_BASE_URL}/models/${modelParts[0]}/${modelParts[1]}/predictions`;
}

function getCreatePredictionBody(config, input) {
  if (config.version) {
    return {
      version: config.version,
      input,
    };
  }

  return { input };
}

async function requestReplicateJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new ReplicateError("Replicate request failed.", {
        status: response.status >= 500 ? 502 : response.status,
        code: "replicate_http_error",
        details: json,
      });
    }

    return json;
  } catch (error) {
    if (error instanceof ReplicateError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ReplicateTimeoutError();
    }

    if (error instanceof SyntaxError) {
      throw new ReplicateError("Replicate returned a response that was not JSON.", {
        code: "replicate_bad_json",
      });
    }

    throw new ReplicateError("Could not reach Replicate.", {
      code: "replicate_network_error",
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isTerminalStatus(status) {
  return ["succeeded", "failed", "canceled"].includes(status);
}

async function waitForPrediction(prediction, token, timeoutMs, pollIntervalMs) {
  if (isTerminalStatus(prediction.status)) {
    return prediction;
  }

  const getUrl =
    prediction.urls?.get ||
    (prediction.id ? `${REPLICATE_API_BASE_URL}/predictions/${prediction.id}` : null);

  if (!getUrl) {
    throw new ReplicateError("Replicate did not return a polling URL.", {
      code: "replicate_missing_poll_url",
      details: prediction,
    });
  }

  const startedAt = Date.now();
  let currentPrediction = prediction;

  while (!isTerminalStatus(currentPrediction.status)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new ReplicateTimeoutError();
    }

    await sleep(pollIntervalMs);

    currentPrediction = await requestReplicateJson(
      getUrl,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
      Math.min(30000, timeoutMs)
    );
  }

  return currentPrediction;
}

function findImageOutput(output) {
  if (!output) {
    return null;
  }

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const resolved = findImageOutput(item);

      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  if (typeof output === "object") {
    const possibleKeys = [
      "url",
      "image",
      "image_url",
      "output",
      "result",
      "enhanced_image",
    ];

    for (const key of possibleKeys) {
      const resolved = findImageOutput(output[key]);

      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

function resolveDisplayAdjustments(enhancementMode, settings) {
  if (enhancementMode === "relight" || settings?.balanceLighting) {
    return {
      brightness: 1.02,
      warmth: 0.02,
      contrast: 1.01,
    };
  }

  return undefined;
}

async function enhanceWallPhotoWithReplicate({
  imageInput,
  enhancementMode,
  settings,
}) {
  const token = process.env.REPLICATE_API_TOKEN?.trim();

  if (!token) {
    throw new ReplicateError(
      "Missing REPLICATE_API_TOKEN. Set it on the backend server, not in the mobile app.",
      {
        status: 500,
        code: "missing_replicate_token",
      }
    );
  }

  if (typeof fetch !== "function") {
    throw new ReplicateError("This backend needs Node 18+ so fetch is available.", {
      status: 500,
      code: "missing_fetch",
    });
  }

  const config = resolveModelConfig();
  const input = buildPredictionInput({ imageInput, enhancementMode, settings });
  const createUrl = getCreatePredictionUrl(config);
  const createBody = getCreatePredictionBody(config, input);
  const waitSeconds = Math.max(1, Math.min(60, Math.floor(config.timeoutMs / 1000)));
  const createdPrediction = await requestReplicateJson(
    createUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: `wait=${waitSeconds}`,
      },
      body: JSON.stringify(createBody),
    },
    config.timeoutMs
  );
  const prediction = await waitForPrediction(
    createdPrediction,
    token,
    config.timeoutMs,
    config.pollIntervalMs
  );

  if (prediction.status !== "succeeded") {
    throw new ReplicateError("Replicate prediction did not succeed.", {
      status: 502,
      code: "replicate_prediction_failed",
      details: {
        id: prediction.id,
        status: prediction.status,
        error: prediction.error,
      },
    });
  }

  const imageOutput = findImageOutput(prediction.output);

  if (!imageOutput) {
    throw new ReplicateError("Replicate succeeded but did not return an image output.", {
      status: 502,
      code: "replicate_missing_image_output",
      details: {
        id: prediction.id,
        output: prediction.output,
      },
    });
  }

  return {
    imageOutput,
    metadata: {
      model: config.version ? config.version : config.model,
      predictionId: prediction.id,
      processingStatus: prediction.status,
      displayAdjustments: resolveDisplayAdjustments(enhancementMode, settings),
    },
  };
}

module.exports = {
  DEFAULT_REPLICATE_MODEL,
  ReplicateError,
  ReplicateTimeoutError,
  enhanceWallPhotoWithReplicate,
};
