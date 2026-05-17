const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_REPLICATE_MODEL,
  ReplicateError,
  enhanceWallPhotoWithReplicate,
  getReplicateDebugConfig,
} = require("./replicateClient");
const {
  ImagePreprocessError,
  getImagePreprocessDebugConfig,
  preprocessDataImageForReplicate,
} = require("./imagePreprocess");
const {
  WALL_ENHANCEMENT_GOAL,
  WALL_ENHANCEMENT_PIPELINE_PLAN,
  buildWallEnhancementSettings,
  normalizeWallEnhancementIntent,
} = require("./wallEnhancementIntent");

const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const ALLOWED_ENHANCEMENT_MODES = new Set([
  "cleanWall",
  "relight",
  "perspectiveAssist",
]);
const LOG_PREFIX = "[AI backend]";
let nextRequestSequence = 1;

function createRequestId() {
  const sequence = nextRequestSequence;

  nextRequestSequence += 1;

  return `wall-enhance-${Date.now().toString(36)}-${sequence}`;
}

function logInfo(requestId, message, details) {
  const prefix = `${LOG_PREFIX}${requestId ? ` [${requestId}]` : ""}`;

  if (details === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }

  console.log(`${prefix} ${message}`, details);
}

function logError(requestId, message, details) {
  const prefix = `${LOG_PREFIX}${requestId ? ` [${requestId}]` : ""}`;

  if (details === undefined) {
    console.error(`${prefix} ${message}`);
    return;
  }

  console.error(`${prefix} ${message}`, details);
}

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

class RequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "RequestError";
    this.status = options.status ?? 400;
    this.code = options.code ?? "bad_request";
    this.details = options.details;
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");

  contents.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function loadLocalEnv() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), "server", ".env"));
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.AI_BACKEND_CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
  });
  response.end(JSON.stringify(payload));
}

function sendNoContent(response) {
  response.writeHead(204, {
    "Access-Control-Allow-Origin": process.env.AI_BACKEND_CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
  });
  response.end();
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > MAX_BODY_BYTES) {
        reject(
          new RequestError("Image upload is too large.", {
            status: 413,
            code: "upload_too_large",
          })
        );
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    request.on("error", (error) => {
      reject(
        new RequestError("Could not read request body.", {
          status: 400,
          code: "bad_request_body",
          details: error.message,
        })
      );
    });
  });
}

function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }

  parts.push(buffer.subarray(start));

  return parts;
}

function trimBoundaryPart(part) {
  let trimmed = part;

  if (trimmed[0] === 13 && trimmed[1] === 10) {
    trimmed = trimmed.subarray(2);
  }

  if (trimmed[0] === 45 && trimmed[1] === 45) {
    return null;
  }

  if (
    trimmed.length >= 2 &&
    trimmed[trimmed.length - 2] === 13 &&
    trimmed[trimmed.length - 1] === 10
  ) {
    trimmed = trimmed.subarray(0, trimmed.length - 2);
  }

  return trimmed.length > 0 ? trimmed : null;
}

function parseHeaderMap(headerBlock) {
  const headers = new Map();

  headerBlock.split(/\r?\n/).forEach((line) => {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      return;
    }

    headers.set(
      line.slice(0, separatorIndex).trim().toLowerCase(),
      line.slice(separatorIndex + 1).trim()
    );
  });

  return headers;
}

function parseContentDisposition(value) {
  const result = {};

  value.split(";").forEach((part) => {
    const [rawKey, ...rawValueParts] = part.trim().split("=");
    const key = rawKey.trim();
    let parsedValue = rawValueParts.join("=").trim();

    if (!key || !parsedValue) {
      return;
    }

    if (
      (parsedValue.startsWith("\"") && parsedValue.endsWith("\"")) ||
      (parsedValue.startsWith("'") && parsedValue.endsWith("'"))
    ) {
      parsedValue = parsedValue.slice(1, -1);
    }

    result[key] = parsedValue;
  });

  return result;
}

function parseMultipartBody(contentType, body) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];

  if (!boundary) {
    throw new RequestError("Multipart upload is missing a boundary.", {
      code: "missing_multipart_boundary",
    });
  }

  const delimiter = Buffer.from(`--${boundary}`);
  const rawParts = splitBuffer(body, delimiter);
  const fields = {};
  const files = {};

  rawParts.forEach((rawPart) => {
    const part = trimBoundaryPart(rawPart);

    if (!part) {
      return;
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));

    if (headerEnd === -1) {
      return;
    }

    const headerBlock = part.subarray(0, headerEnd).toString("utf8");
    const headers = parseHeaderMap(headerBlock);
    const disposition = parseContentDisposition(
      headers.get("content-disposition") || ""
    );
    const fieldName = disposition.name;

    if (!fieldName) {
      return;
    }

    let data = part.subarray(headerEnd + 4);

    if (
      data.length >= 2 &&
      data[data.length - 2] === 13 &&
      data[data.length - 1] === 10
    ) {
      data = data.subarray(0, data.length - 2);
    }

    if (disposition.filename) {
      files[fieldName] = {
        filename: disposition.filename,
        mimeType: headers.get("content-type") || "application/octet-stream",
        buffer: data,
      };
      return;
    }

    fields[fieldName] = data.toString("utf8");
  });

  return { fields, files };
}

function normalizeBase64Image(value, mimeType = "image/jpeg") {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (value.startsWith("data:image/")) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `data:${mimeType};base64,${value}`;
}

function estimateBase64Bytes(value) {
  const base64 = value.includes(",") ? value.split(",")[1] ?? "" : value;

  return Math.round(base64.length * 0.75);
}

function describeImageInput(imageInput, fallbackMimeType) {
  if (!imageInput) {
    return {
      present: false,
    };
  }

  if (/^https?:\/\//i.test(imageInput)) {
    return {
      present: true,
      source: "url",
      urlPreview:
        imageInput.length > 180 ? `${imageInput.slice(0, 180)}...` : imageInput,
    };
  }

  if (imageInput.startsWith("data:image/")) {
    const mimeType = imageInput.slice(5, imageInput.indexOf(";base64,"));

    return {
      present: true,
      source: "base64",
      mimeType,
      approxBytes: estimateBase64Bytes(imageInput),
    };
  }

  return {
    present: true,
    source: "string",
    mimeType: fallbackMimeType,
    length: imageInput.length,
  };
}

function parseSettings(rawSettings) {
  if (!rawSettings) {
    return {};
  }

  if (typeof rawSettings === "object") {
    return rawSettings;
  }

  try {
    return JSON.parse(rawSettings);
  } catch {
    throw new RequestError("settings must be valid JSON.", {
      code: "bad_settings_json",
    });
  }
}

function normalizeEnhancementMode(rawMode) {
  const mode = typeof rawMode === "string" && rawMode.trim()
    ? rawMode.trim()
    : "cleanWall";

  if (!ALLOWED_ENHANCEMENT_MODES.has(mode)) {
    throw new RequestError("Unsupported enhancementMode.", {
      code: "bad_enhancement_mode",
      details: {
        enhancementMode: mode,
        allowed: Array.from(ALLOWED_ENHANCEMENT_MODES),
      },
    });
  }

  return mode;
}

function getImageInputFromMultipart(parsedBody) {
  const imageFieldName = parsedBody.files.image
    ? "image"
    : parsedBody.files.wallPhoto
      ? "wallPhoto"
      : parsedBody.files.file
        ? "file"
        : null;
  const imageFile = imageFieldName ? parsedBody.files[imageFieldName] : null;

  if (imageFile?.buffer?.length) {
    const imageInput = `data:${imageFile.mimeType};base64,${imageFile.buffer.toString("base64")}`;

    return {
      imageInput,
      sourceMimeType: imageFile.mimeType,
      debug: {
        transport: "multipart",
        fieldName: imageFieldName,
        filename: imageFile.filename,
        mimeType: imageFile.mimeType,
        sizeBytes: imageFile.buffer.length,
        fileFields: Object.keys(parsedBody.files),
        fieldNames: Object.keys(parsedBody.fields),
      },
    };
  }

  const base64Image =
    parsedBody.fields.imageBase64 ||
    parsedBody.fields.enhancedImageBase64 ||
    parsedBody.fields.image;
  const imageUri =
    parsedBody.fields.imageUri ||
    parsedBody.fields.imageUrl ||
    parsedBody.fields.wallPhotoUri;
  const mimeType = parsedBody.fields.mimeType || "image/jpeg";
  const imageInput = normalizeBase64Image(imageUri || base64Image, mimeType);

  return {
    imageInput,
    sourceMimeType: mimeType,
    debug: {
      transport: "multipart",
      fieldName: imageUri ? "imageUri/imageUrl/wallPhotoUri" : "imageBase64/image",
      mimeType,
      sizeBytes: imageInput ? estimateBase64Bytes(imageInput) : 0,
      fileFields: Object.keys(parsedBody.files),
      fieldNames: Object.keys(parsedBody.fields),
      imageInput: describeImageInput(imageInput, mimeType),
    },
  };
}

function parseJsonBody(body) {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new RequestError("JSON request body is invalid.", {
      code: "bad_json_body",
    });
  }
}

function getImageInputFromJson(json) {
  const mimeType = json.mimeType || "image/jpeg";
  const imageInput = normalizeBase64Image(
    json.imageUri ||
      json.imageUrl ||
      json.wallPhotoUri ||
      json.imageBase64 ||
      json.image,
    mimeType
  );

  return {
    imageInput,
    sourceMimeType: mimeType,
    debug: {
      transport: "json",
      fieldName:
        json.imageUri || json.imageUrl || json.wallPhotoUri
          ? "imageUri/imageUrl/wallPhotoUri"
          : "imageBase64/image",
      mimeType,
      sizeBytes: imageInput ? estimateBase64Bytes(imageInput) : 0,
      imageInput: describeImageInput(imageInput, mimeType),
    },
  };
}

async function parseEnhanceWallPhotoRequest(request) {
  const contentType = request.headers["content-type"] || "";
  const declaredContentLength = request.headers["content-length"] || null;
  const body = await readBody(request);

  if (contentType.includes("multipart/form-data")) {
    const parsedBody = parseMultipartBody(contentType, body);
    const { imageInput, sourceMimeType, debug } = getImageInputFromMultipart(parsedBody);

    if (!imageInput) {
      throw new RequestError("Upload an image file or provide imageBase64/imageUri.", {
        code: "missing_wall_image",
      });
    }

    return {
      imageInput,
      sourceMimeType,
      enhancementMode: normalizeEnhancementMode(parsedBody.fields.enhancementMode),
      settings: parseSettings(parsedBody.fields.settings),
      debug: {
        ...debug,
        contentType: "multipart/form-data",
        bodyBytes: body.length,
        declaredContentLength,
      },
    };
  }

  if (contentType.includes("application/json")) {
    const json = parseJsonBody(body);
    const { imageInput, sourceMimeType, debug } = getImageInputFromJson(json);

    if (!imageInput) {
      throw new RequestError("Provide imageBase64, imageUri, imageUrl, or image.", {
        code: "missing_wall_image",
      });
    }

    return {
      imageInput,
      sourceMimeType,
      enhancementMode: normalizeEnhancementMode(json.enhancementMode),
      settings: parseSettings(json.settings),
      debug: {
        ...debug,
        contentType: "application/json",
        bodyBytes: body.length,
        declaredContentLength,
      },
    };
  }

  throw new RequestError("Use multipart/form-data or application/json.", {
    code: "unsupported_content_type",
  });
}

function splitDataUri(dataUri) {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

function buildEnhanceWallPhotoResponse(result, sourceMimeType) {
  const dataUriOutput = splitDataUri(result.imageOutput);

  if (dataUriOutput) {
    return {
      enhancedImageBase64: dataUriOutput.base64,
      mimeType: dataUriOutput.mimeType,
      provider: "replicate",
      metadata: result.metadata,
    };
  }

  return {
    enhancedImageUrl: result.imageOutput,
    mimeType: sourceMimeType,
    provider: "replicate",
    metadata: result.metadata,
  };
}

function getErrorStatus(error) {
  if (
    error instanceof RequestError ||
    error instanceof ReplicateError ||
    error instanceof ImagePreprocessError
  ) {
    return error.status;
  }

  return 500;
}

function getErrorCode(error) {
  if (
    error instanceof RequestError ||
    error instanceof ReplicateError ||
    error instanceof ImagePreprocessError
  ) {
    return error.code;
  }

  return "internal_server_error";
}

function getErrorMessage(error) {
  if (
    error instanceof RequestError ||
    error instanceof ReplicateError ||
    error instanceof ImagePreprocessError
  ) {
    return error.message;
  }

  return "Unexpected backend error.";
}

function getSafeErrorDetails(error) {
  if (
    error instanceof RequestError ||
    error instanceof ReplicateError ||
    error instanceof ImagePreprocessError
  ) {
    return error.details;
  }

  return undefined;
}

function logHandledError(requestId, error) {
  const status = getErrorStatus(error);
  const details = {
    name: error instanceof Error ? error.name : typeof error,
    message: getErrorMessage(error),
    status,
    code: getErrorCode(error),
    details: getSafeErrorDetails(error),
  };

  if (isDevelopment() && error instanceof Error) {
    details.stack = error.stack;
  }

  logError(requestId, "Enhance Wall Photo failed.", details);
}

async function handleEnhanceWallPhoto(request, response) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  logInfo(requestId, "Request received.", {
    method: request.method,
    contentType: request.headers["content-type"] || null,
    contentLength: request.headers["content-length"] || null,
    remoteAddress: request.socket?.remoteAddress,
  });

  try {
    const parsedRequest = await parseEnhanceWallPhotoRequest(request);
    const wallEnhancementSettings = buildWallEnhancementSettings(
      parsedRequest.settings,
      parsedRequest.enhancementMode
    );
    const wallEnhancementIntent = normalizeWallEnhancementIntent(
      wallEnhancementSettings,
      parsedRequest.enhancementMode
    );

    logInfo(requestId, "Request parsed.", {
      enhancementMode: parsedRequest.enhancementMode,
      settings: parsedRequest.settings,
      enhancementGoal: WALL_ENHANCEMENT_GOAL,
      enhancementIntent: wallEnhancementIntent,
      image: parsedRequest.debug,
    });

    const replicateConfig = getReplicateDebugConfig();
    const preprocessedImage = await preprocessDataImageForReplicate({
      imageInput: parsedRequest.imageInput,
    });

    logInfo(requestId, "Image preprocessed for Replicate.", preprocessedImage.metadata);
    logInfo(requestId, "Replicate config.", {
      ...replicateConfig,
      imagePreprocess: getImagePreprocessDebugConfig(),
    });

    const result = await enhanceWallPhotoWithReplicate({
      ...parsedRequest,
      settings: wallEnhancementSettings,
      imageInput: preprocessedImage.imageInput,
      requestId,
    });
    const responsePayload = buildEnhanceWallPhotoResponse(
      result,
      parsedRequest.sourceMimeType
    );

    logInfo(requestId, "Output prepared.", {
      hasEnhancedImageUrl: Boolean(responsePayload.enhancedImageUrl),
      hasEnhancedImageBase64: Boolean(responsePayload.enhancedImageBase64),
      mimeType: responsePayload.mimeType,
      metadata: responsePayload.metadata,
    });

    sendJson(
      response,
      200,
      responsePayload
    );
    logInfo(requestId, "Response sent.", {
      status: 200,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logHandledError(requestId, error);

    const payload = {
      error: {
        code: getErrorCode(error),
        message: getErrorMessage(error),
        requestId,
      },
    };

    if (
      isDevelopment() &&
      (error instanceof RequestError ||
        error instanceof ReplicateError ||
        error instanceof ImagePreprocessError) &&
      error.details
    ) {
      payload.error.details = error.details;
    }

    const status = getErrorStatus(error);

    sendJson(response, status, payload);
    logInfo(requestId, "Error response sent.", {
      status,
      durationMs: Date.now() - startedAt,
    });
  }
}

function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "OPTIONS") {
      sendNoContent(response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "framing-assistant-ai-backend",
        replicateModel: process.env.REPLICATE_MODEL || DEFAULT_REPLICATE_MODEL,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/debug/config") {
      sendJson(response, 200, {
        ...getReplicateDebugConfig(),
        imagePreprocess: getImagePreprocessDebugConfig(),
        wallEnhancementGoal: WALL_ENHANCEMENT_GOAL,
        wallEnhancementPipeline: WALL_ENHANCEMENT_PIPELINE_PLAN,
      });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/ai/enhance-wall-photo"
    ) {
      await handleEnhanceWallPhoto(request, response);
      return;
    }

    sendJson(response, 404, {
      error: {
        code: "not_found",
        message: "Endpoint not found.",
      },
    });
  });
}

if (require.main === module) {
  loadLocalEnv();

  const port = Number.parseInt(process.env.AI_BACKEND_PORT || "", 10) || DEFAULT_PORT;
  const server = createServer();

  server.listen(port, () => {
    console.log(`Framing Assistant AI backend listening on http://localhost:${port}`);
    console.log("Enhance endpoint: POST /api/ai/enhance-wall-photo");
    console.log(`Replicate model: ${process.env.REPLICATE_MODEL || DEFAULT_REPLICATE_MODEL}`);
  });
}

module.exports = {
  createServer,
  parseEnhanceWallPhotoRequest,
};
