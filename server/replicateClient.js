const REPLICATE_API_BASE_URL = "https://api.replicate.com/v1";
const DEFAULT_REPLICATE_MODEL = "nightmareai/real-esrgan";
const DEFAULT_REPLICATE_TIMEOUT_MS = 120000;
const DEFAULT_REPLICATE_POLL_INTERVAL_MS = 1200;
const LOG_PREFIX = "[AI backend][Replicate]";
const {
  WALL_ENHANCEMENT_GOAL,
  WALL_ENHANCEMENT_PIPELINE_PLAN,
  buildWallEnhancementPrompt,
  buildWallEnhancementSettings,
  normalizeWallEnhancementIntent,
} = require("./wallEnhancementIntent");

function logInfo(message, details) {
  if (details === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, details);
}

function logError(message, details) {
  if (details === undefined) {
    console.error(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.error(`${LOG_PREFIX} ${message}`, details);
}

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

function getReplicateDebugConfig() {
  const config = resolveModelConfig();

  return {
    hasReplicateToken: Boolean(process.env.REPLICATE_API_TOKEN?.trim()),
    replicateModel: config.model,
    replicateVersionPresent: Boolean(config.version),
    timeoutMs: config.timeoutMs,
    pollIntervalMs: config.pollIntervalMs,
    imageInputKey: config.imageInputKey,
    promptInputKeyPresent: Boolean(config.promptInputKey),
    forwardSettings: process.env.REPLICATE_FORWARD_SETTINGS === "true",
    wallEnhancementGoal: WALL_ENHANCEMENT_GOAL,
    wallEnhancementPipeline: WALL_ENHANCEMENT_PIPELINE_PLAN,
  };
}

function getEnhancementPrompt(enhancementMode, settings) {
  return buildWallEnhancementPrompt({
    enhancementMode,
    intent: normalizeWallEnhancementIntent(settings, enhancementMode),
  });
}

function buildPredictionInput({ imageInput, enhancementMode, settings }) {
  const config = resolveModelConfig();
  const configuredInput = parseJsonEnv("REPLICATE_INPUT_JSON", {});
  const wallEnhancementSettings = buildWallEnhancementSettings(
    settings,
    enhancementMode
  );
  const input = {
    [config.imageInputKey]: imageInput,
    ...configuredInput,
  };

  if (config.model === DEFAULT_REPLICATE_MODEL && !process.env.REPLICATE_VERSION) {
    input.scale = input.scale ?? 2;
    input.face_enhance = input.face_enhance ?? false;
  }

  if (config.promptInputKey) {
    input[config.promptInputKey] = getEnhancementPrompt(
      enhancementMode,
      wallEnhancementSettings
    );
  }

  if (process.env.REPLICATE_FORWARD_SETTINGS === "true") {
    input.enhancement_mode = enhancementMode;
    input.wall_enhancement_goal = WALL_ENHANCEMENT_GOAL;
    input.wall_enhancement_settings = wallEnhancementSettings;
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

function truncateText(value, maxLength = 1200) {
  if (typeof value !== "string") {
    return value;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function getReplicateResponseMessage(json) {
  if (!json || typeof json !== "object") {
    return null;
  }

  return (
    json.detail ||
    json.error ||
    json.message ||
    json.title ||
    null
  );
}

function sanitizeReplicateInputForLog(input, imageInputKey) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (key === imageInputKey && typeof value === "string") {
        if (value.startsWith("data:image/")) {
          const mimeType = value.slice(5, value.indexOf(";base64,"));
          const base64 = value.split(",")[1] ?? "";

          return [
            key,
            {
              type: "data-uri",
              mimeType,
              approxBytes: Math.round(base64.length * 0.75),
            },
          ];
        }

        if (/^https?:\/\//i.test(value)) {
          return [
            key,
            {
              type: "url",
              value: truncateText(value, 180),
            },
          ];
        }

        return [
          key,
          {
            type: "string",
            length: value.length,
          },
        ];
      }

      if (typeof value === "string" && value.length > 240) {
        return [key, `${value.slice(0, 240)}...`];
      }

      return [key, value];
    })
  );
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
    let json = {};

    if (text) {
      try {
        json = JSON.parse(text);
      } catch (error) {
        if (!response.ok) {
          throw new ReplicateError(
            `Replicate request failed with HTTP ${response.status} and a non-JSON response.`,
            {
              status: response.status >= 500 ? 502 : response.status,
              code: "replicate_http_error",
              details: {
                httpStatus: response.status,
                bodyPreview: truncateText(text),
              },
            }
          );
        }

        throw error;
      }
    }

    if (!response.ok) {
      const replicateMessage = getReplicateResponseMessage(json);

      throw new ReplicateError(
        replicateMessage
          ? `Replicate request failed with HTTP ${response.status}: ${replicateMessage}`
          : `Replicate request failed with HTTP ${response.status}.`,
        {
          status: response.status >= 500 ? 502 : response.status,
          code: "replicate_http_error",
          details: {
            httpStatus: response.status,
            responseBody: json,
          },
        }
      );
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

async function waitForPrediction(prediction, token, timeoutMs, pollIntervalMs, requestId) {
  if (isTerminalStatus(prediction.status)) {
    logInfo("Prediction returned terminal status without polling.", {
      requestId,
      predictionId: prediction.id,
      status: prediction.status,
    });
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
  let lastLoggedStatus = currentPrediction.status;

  logInfo("Prediction polling started.", {
    requestId,
    predictionId: currentPrediction.id,
    status: currentPrediction.status,
  });

  while (!isTerminalStatus(currentPrediction.status)) {
    if (Date.now() - startedAt > timeoutMs) {
      logError("Prediction polling timed out.", {
        requestId,
        predictionId: currentPrediction.id,
        lastStatus: currentPrediction.status,
        timeoutMs,
      });
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

    if (currentPrediction.status !== lastLoggedStatus) {
      lastLoggedStatus = currentPrediction.status;
      logInfo("Prediction status changed.", {
        requestId,
        predictionId: currentPrediction.id,
        status: currentPrediction.status,
      });
    }
  }

  logInfo("Prediction polling finished.", {
    requestId,
    predictionId: currentPrediction.id,
    status: currentPrediction.status,
  });

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

function describeImageOutput(output) {
  if (typeof output !== "string") {
    return {
      type: typeof output,
      present: Boolean(output),
    };
  }

  if (output.startsWith("data:image/")) {
    const mimeType = output.slice(5, output.indexOf(";base64,"));
    const base64 = output.split(",")[1] ?? "";

    return {
      type: "data-uri",
      mimeType,
      approxBytes: Math.round(base64.length * 0.75),
    };
  }

  if (/^https?:\/\//i.test(output)) {
    return {
      type: "url",
      value: truncateText(output, 180),
    };
  }

  return {
    type: "string",
    length: output.length,
  };
}

function resolveDisplayAdjustments(enhancementMode, settings) {
  const intent = normalizeWallEnhancementIntent(settings, enhancementMode);

  if (enhancementMode === "relight" || intent.cleanupLighting) {
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
  requestId,
}) {
  const token = process.env.REPLICATE_API_TOKEN?.trim();

  if (!token) {
    logError("Missing REPLICATE_API_TOKEN.", { requestId });
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
  const wallEnhancementSettings = buildWallEnhancementSettings(
    settings,
    enhancementMode
  );
  const wallEnhancementIntent = normalizeWallEnhancementIntent(
    wallEnhancementSettings,
    enhancementMode
  );
  const input = buildPredictionInput({
    imageInput,
    enhancementMode,
    settings: wallEnhancementSettings,
  });
  const createUrl = getCreatePredictionUrl(config);
  const createBody = getCreatePredictionBody(config, input);
  const waitSeconds = Math.max(1, Math.min(60, Math.floor(config.timeoutMs / 1000)));

  logInfo("Starting prediction.", {
    requestId,
    model: config.model,
    versionPresent: Boolean(config.version),
    createUrl,
    timeoutMs: config.timeoutMs,
    waitSeconds,
    enhancementGoal: WALL_ENHANCEMENT_GOAL,
    enhancementIntent: wallEnhancementIntent,
    input: sanitizeReplicateInputForLog(input, config.imageInputKey),
  });

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

  logInfo("Prediction created.", {
    requestId,
    predictionId: createdPrediction.id,
    status: createdPrediction.status,
    hasPollUrl: Boolean(createdPrediction.urls?.get),
  });

  const prediction = await waitForPrediction(
    createdPrediction,
    token,
    config.timeoutMs,
    config.pollIntervalMs,
    requestId
  );

  if (prediction.status !== "succeeded") {
    logError("Prediction failed.", {
      requestId,
      predictionId: prediction.id,
      status: prediction.status,
      error: prediction.error,
    });
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
    logError("Prediction output did not contain an image.", {
      requestId,
      predictionId: prediction.id,
      outputType: Array.isArray(prediction.output) ? "array" : typeof prediction.output,
      output: prediction.output,
    });
    throw new ReplicateError("Replicate succeeded but did not return an image output.", {
      status: 502,
      code: "replicate_missing_image_output",
      details: {
        id: prediction.id,
        output: prediction.output,
      },
    });
  }

  logInfo("Prediction output received.", {
    requestId,
    predictionId: prediction.id,
    output: describeImageOutput(imageOutput),
  });

  return {
    imageOutput,
    metadata: {
      model: config.version ? config.version : config.model,
      predictionId: prediction.id,
      processingStatus: prediction.status,
      intent: wallEnhancementIntent,
      displayAdjustments: resolveDisplayAdjustments(
        enhancementMode,
        wallEnhancementSettings
      ),
    },
  };
}

module.exports = {
  DEFAULT_REPLICATE_MODEL,
  ReplicateError,
  ReplicateTimeoutError,
  enhanceWallPhotoWithReplicate,
  getReplicateDebugConfig,
};
