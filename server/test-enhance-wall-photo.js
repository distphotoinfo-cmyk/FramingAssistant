const fs = require("node:fs");
const path = require("node:path");
const {
  enhanceWallPhotoWithReplicate,
  getReplicateDebugConfig,
} = require("./replicateClient");
const { preprocessDataImageForReplicate } = require("./imagePreprocess");
const {
  WALL_ENHANCEMENT_GOAL,
  buildWallEnhancementSettings,
  normalizeWallEnhancementIntent,
} = require("./wallEnhancementIntent");

const DEFAULT_OUTPUT_DIR = path.join(__dirname, "test-output");
const DEFAULT_ENHANCEMENT_MODE = "cleanWall";
const ALLOWED_ENHANCEMENT_MODES = new Set([
  "cleanWall",
  "relight",
  "perspectiveAssist",
]);

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

function printUsage() {
  console.log(`Usage:
  npm run ai:test -- path/to/image.jpg

Optional:
  --mode cleanWall|relight|perspectiveAssist
  --settings '{"cleanupLighting":true,"preserveWallCalibration":true}'
  --model owner/model
  --version replicate-version-id
  --image-input-key image
  --prompt-input-key prompt
  --output-dir server/test-output

Model settings may also be supplied with REPLICATE_MODEL, REPLICATE_VERSION,
REPLICATE_IMAGE_INPUT_KEY, REPLICATE_PROMPT_INPUT_KEY, and REPLICATE_INPUT_JSON.`);
}

function parseArgs(argv) {
  const result = {
    imagePath: null,
    mode: DEFAULT_ENHANCEMENT_MODE,
    settings: {},
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
      continue;
    }

    if (arg === "--mode") {
      result.mode = argv[index + 1] || DEFAULT_ENHANCEMENT_MODE;
      index += 1;
      continue;
    }

    if (arg === "--settings") {
      const rawSettings = argv[index + 1] || "{}";

      try {
        result.settings = JSON.parse(rawSettings);
      } catch {
        throw new Error("--settings must be valid JSON.");
      }

      index += 1;
      continue;
    }

    if (arg === "--model") {
      process.env.REPLICATE_MODEL = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--version") {
      process.env.REPLICATE_VERSION = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--image-input-key") {
      process.env.REPLICATE_IMAGE_INPUT_KEY = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--prompt-input-key") {
      process.env.REPLICATE_PROMPT_INPUT_KEY = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--output-dir") {
      result.outputDir = path.resolve(argv[index + 1] || DEFAULT_OUTPUT_DIR);
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (!result.imagePath) {
      result.imagePath = path.resolve(arg);
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return result;
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".heic") return "image/heic";
  if (extension === ".heif") return "image/heif";

  return "image/jpeg";
}

function getExtensionFromMimeType(mimeType) {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("heic")) return ".heic";
  if (mimeType.includes("heif")) return ".heif";

  return ".jpg";
}

function parseDataImageOutput(imageOutput) {
  const match = imageOutput.match(/^data:([^;,]+);base64,(.+)$/s);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function readOutputImage(imageOutput) {
  const dataImage = parseDataImageOutput(imageOutput);

  if (dataImage) {
    return dataImage;
  }

  if (!/^https?:\/\//i.test(imageOutput)) {
    return {
      mimeType: "text/plain",
      buffer: Buffer.from(String(imageOutput)),
    };
  }

  const response = await fetch(imageOutput);

  if (!response.ok) {
    throw new Error(`Could not download Replicate output: HTTP ${response.status}`);
  }

  return {
    mimeType: response.headers.get("content-type") || "image/jpeg",
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

function createOutputBaseName({ imagePath, mode, model }) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
  const imageName = path.basename(imagePath, path.extname(imagePath));
  const safeModel = model.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");

  return `${timestamp}-${mode}-${safeModel}-${imageName}`;
}

function logSummary(label, value) {
  console.log(`${label}:`, value);
}

async function run() {
  loadLocalEnv();

  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.imagePath) {
    printUsage();
    throw new Error("Provide a local wall photo path.");
  }

  if (!fs.existsSync(args.imagePath)) {
    throw new Error(`Image file not found: ${args.imagePath}`);
  }

  if (!ALLOWED_ENHANCEMENT_MODES.has(args.mode)) {
    throw new Error(
      `Unsupported mode "${args.mode}". Use ${Array.from(ALLOWED_ENHANCEMENT_MODES).join(", ")}.`
    );
  }

  if (typeof fetch !== "function") {
    throw new Error("This script needs Node 18+ so fetch is available.");
  }

  const startedAt = Date.now();
  const imageBuffer = fs.readFileSync(args.imagePath);
  const sourceMimeType = getMimeType(args.imagePath);
  const imageInput = `data:${sourceMimeType};base64,${imageBuffer.toString("base64")}`;
  const settings = buildWallEnhancementSettings(args.settings, args.mode);
  const intent = normalizeWallEnhancementIntent(settings, args.mode);
  const replicateConfig = getReplicateDebugConfig();
  const requestId = `local-test-${Date.now().toString(36)}`;

  logSummary("Input path", args.imagePath);
  logSummary("Output folder", args.outputDir);
  logSummary("Model", replicateConfig.replicateModel);
  logSummary("Version set", replicateConfig.replicateVersionPresent);
  logSummary("Enhancement mode", args.mode);
  logSummary("Enhancement goal", WALL_ENHANCEMENT_GOAL);
  logSummary("Resolved intent", intent);

  const preprocessedImage = await preprocessDataImageForReplicate({ imageInput });

  logSummary("Original size", {
    width: preprocessedImage.metadata.originalWidth,
    height: preprocessedImage.metadata.originalHeight,
    totalPixels: preprocessedImage.metadata.originalTotalPixels,
    bytes: preprocessedImage.metadata.originalBytes,
  });
  logSummary("Replicate input size", {
    width: preprocessedImage.metadata.resizedWidth,
    height: preprocessedImage.metadata.resizedHeight,
    totalPixels: preprocessedImage.metadata.resizedTotalPixels,
    bytes: preprocessedImage.metadata.resizedBytes,
    resized: preprocessedImage.metadata.resized,
  });

  const result = await enhanceWallPhotoWithReplicate({
    imageInput: preprocessedImage.imageInput,
    enhancementMode: args.mode,
    settings,
    requestId,
  });
  const outputImage = await readOutputImage(result.imageOutput);
  const outputBaseName = createOutputBaseName({
    imagePath: args.imagePath,
    mode: args.mode,
    model: replicateConfig.replicateModel,
  });
  const outputExtension = getExtensionFromMimeType(outputImage.mimeType);

  fs.mkdirSync(args.outputDir, { recursive: true });

  const outputPath = path.join(args.outputDir, `${outputBaseName}${outputExtension}`);
  const metadataPath = path.join(args.outputDir, `${outputBaseName}.json`);
  const runtimeMs = Date.now() - startedAt;
  const metadata = {
    inputPath: args.imagePath,
    outputPath,
    requestId,
    runtimeMs,
    model: replicateConfig.replicateModel,
    versionPresent: replicateConfig.replicateVersionPresent,
    enhancementMode: args.mode,
    enhancementGoal: WALL_ENHANCEMENT_GOAL,
    settings,
    intent,
    preprocessing: preprocessedImage.metadata,
    replicateMetadata: result.metadata,
  };

  fs.writeFileSync(outputPath, outputImage.buffer);
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  logSummary("Runtime ms", runtimeMs);
  logSummary("Output image", outputPath);
  logSummary("Output metadata", metadataPath);
}

run().catch((error) => {
  console.error("[AI test] Failed:", error instanceof Error ? error.message : error);

  if (error instanceof Error && error.stack && process.env.NODE_ENV !== "production") {
    console.error(error.stack);
  }

  process.exitCode = 1;
});
