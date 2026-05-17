const sharp = require("sharp");

const MAX_REPLICATE_IMAGE_TOTAL_PIXELS = 1900000;
const REPLICATE_IMAGE_JPEG_QUALITY = 92;

class ImagePreprocessError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ImagePreprocessError";
    this.status = options.status ?? 400;
    this.code = options.code ?? "bad_image_upload";
    this.details = options.details;
  }
}

function getImagePreprocessDebugConfig() {
  return {
    maxTotalPixels: MAX_REPLICATE_IMAGE_TOTAL_PIXELS,
    jpegQuality: REPLICATE_IMAGE_JPEG_QUALITY,
  };
}

function parseDataImageUri(imageInput) {
  if (typeof imageInput !== "string") {
    return null;
  }

  const match = imageInput.match(/^data:([^;,]+);base64,(.+)$/s);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function getOrientedDimensions(metadata) {
  if (!metadata.width || !metadata.height) {
    return null;
  }

  const shouldSwapDimensions = [5, 6, 7, 8].includes(metadata.orientation ?? 1);

  return {
    width: shouldSwapDimensions ? metadata.height : metadata.width,
    height: shouldSwapDimensions ? metadata.width : metadata.height,
  };
}

function getResizeDimensions({ width, height, maxTotalPixels }) {
  const totalPixels = width * height;

  if (totalPixels <= maxTotalPixels) {
    return {
      width,
      height,
      resized: false,
      scale: 1,
    };
  }

  const scale = Math.sqrt(maxTotalPixels / totalPixels);

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    resized: true,
    scale,
  };
}

async function preprocessDataImageForReplicate({
  imageInput,
  maxTotalPixels = MAX_REPLICATE_IMAGE_TOTAL_PIXELS,
  jpegQuality = REPLICATE_IMAGE_JPEG_QUALITY,
}) {
  const dataImage = parseDataImageUri(imageInput);

  if (!dataImage) {
    if (/^https?:\/\//i.test(imageInput ?? "")) {
      return {
        imageInput,
        metadata: {
          skipped: true,
          reason: "remote-url",
          maxTotalPixels,
          jpegQuality,
        },
      };
    }

    throw new ImagePreprocessError("Image must be a data URI or uploaded image file.", {
      code: "unsupported_image_input",
    });
  }

  let metadata;

  try {
    metadata = await sharp(dataImage.buffer, { limitInputPixels: false }).metadata();
  } catch (error) {
    throw new ImagePreprocessError("Could not read uploaded image dimensions.", {
      code: "image_metadata_failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const orientedDimensions = getOrientedDimensions(metadata);

  if (!orientedDimensions) {
    throw new ImagePreprocessError("Uploaded image is missing readable dimensions.", {
      code: "missing_image_dimensions",
      details: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        orientation: metadata.orientation,
      },
    });
  }

  const originalTotalPixels = orientedDimensions.width * orientedDimensions.height;
  const resizeDimensions = getResizeDimensions({
    width: orientedDimensions.width,
    height: orientedDimensions.height,
    maxTotalPixels,
  });

  let outputBuffer;
  let outputMetadata;

  try {
    outputBuffer = await sharp(dataImage.buffer, { limitInputPixels: false })
      .rotate()
      .resize({
        width: resizeDimensions.width,
        height: resizeDimensions.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: jpegQuality,
        mozjpeg: true,
      })
      .toBuffer();
    outputMetadata = await sharp(outputBuffer).metadata();
  } catch (error) {
    throw new ImagePreprocessError("Could not resize uploaded image for AI processing.", {
      code: "image_resize_failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const resizedWidth = outputMetadata.width ?? resizeDimensions.width;
  const resizedHeight = outputMetadata.height ?? resizeDimensions.height;
  const resizedTotalPixels = resizedWidth * resizedHeight;

  return {
    imageInput: `data:image/jpeg;base64,${outputBuffer.toString("base64")}`,
    metadata: {
      skipped: false,
      originalMimeType: dataImage.mimeType,
      outputMimeType: "image/jpeg",
      originalWidth: orientedDimensions.width,
      originalHeight: orientedDimensions.height,
      originalTotalPixels,
      resizedWidth,
      resizedHeight,
      resizedTotalPixels,
      resized: resizeDimensions.resized,
      scale: Number(resizeDimensions.scale.toFixed(6)),
      maxTotalPixels,
      jpegQuality,
      originalBytes: dataImage.buffer.length,
      resizedBytes: outputBuffer.length,
    },
  };
}

module.exports = {
  MAX_REPLICATE_IMAGE_TOTAL_PIXELS,
  REPLICATE_IMAGE_JPEG_QUALITY,
  ImagePreprocessError,
  getImagePreprocessDebugConfig,
  preprocessDataImageForReplicate,
};
