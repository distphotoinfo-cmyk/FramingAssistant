import * as FileSystem from "expo-file-system";
import type { FramingProjectDraft } from "../types/framing";

const PERSISTENT_ARTWORK_IMAGE_DIRECTORY = "framing-assistant/artwork-images";
const DEFAULT_IMAGE_EXTENSION = "jpg";

function getPersistentArtworkImageDirectory() {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${PERSISTENT_ARTWORK_IMAGE_DIRECTORY}/`
    : null;
}

function getPersistentArtworkImageUri(storagePath: string | null | undefined) {
  if (!storagePath || !FileSystem.documentDirectory) {
    return null;
  }

  return `${FileSystem.documentDirectory}${storagePath}`;
}

function getStoragePathFromArtworkImageUri(uri: string | null | undefined) {
  if (!uri) {
    return null;
  }

  const marker = `${PERSISTENT_ARTWORK_IMAGE_DIRECTORY}/`;
  const markerIndex = uri.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  return uri.slice(markerIndex);
}

function isAppOwnedArtworkImageUri(uri: string) {
  return Boolean(getStoragePathFromArtworkImageUri(uri));
}

function getImageExtension(uri: string) {
  const uriWithoutQuery = uri.split("?")[0] ?? uri;
  const extensionMatch = uriWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
  const extension = extensionMatch?.[1]?.toLowerCase();

  if (!extension || extension.length > 8) {
    return DEFAULT_IMAGE_EXTENSION;
  }

  if (extension === "jpeg" || extension === "jpg" || extension === "png" || extension === "webp") {
    return extension;
  }

  if (extension === "heic" || extension === "heif") {
    return extension;
  }

  return DEFAULT_IMAGE_EXTENSION;
}

function createPersistentArtworkImageTarget(sourceUri: string) {
  const directory = getPersistentArtworkImageDirectory();

  if (!directory) {
    return null;
  }

  const extension = getImageExtension(sourceUri);
  const filename = `artwork-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const storagePath = `${PERSISTENT_ARTWORK_IMAGE_DIRECTORY}/${filename}`;

  return {
    uri: `${directory}${filename}`,
    storagePath,
  };
}

export function resolveArtworkImageUriForDisplay(
  imageUri: string | null | undefined,
  storagePath?: string | null
) {
  return getPersistentArtworkImageUri(storagePath) ??
    getPersistentArtworkImageUri(getStoragePathFromArtworkImageUri(imageUri)) ??
    imageUri ??
    null;
}

export function normalizeDraftArtworkImageReference(
  draft: FramingProjectDraft
): FramingProjectDraft {
  const storagePath =
    draft.preview.artworkImageStoragePath ??
    getStoragePathFromArtworkImageUri(draft.preview.artworkImageUri);
  const resolvedArtworkImageUri = resolveArtworkImageUriForDisplay(
    draft.preview.artworkImageUri,
    storagePath
  );

  if (
    storagePath === draft.preview.artworkImageStoragePath &&
    resolvedArtworkImageUri === draft.preview.artworkImageUri
  ) {
    return draft;
  }

  return {
    ...draft,
    preview: {
      ...draft.preview,
      artworkImageUri: resolvedArtworkImageUri,
      artworkImageStoragePath: storagePath,
    },
  };
}

export async function persistArtworkImageUriForSave(
  imageUri: string | null,
  storagePath?: string | null
) {
  if (!imageUri) {
    return { imageUri, storagePath: storagePath ?? null };
  }

  const existingStoragePath = storagePath ?? getStoragePathFromArtworkImageUri(imageUri);
  const existingPersistentUri = getPersistentArtworkImageUri(existingStoragePath);

  if (existingStoragePath && existingPersistentUri) {
    const existingImageInfo = await FileSystem.getInfoAsync(existingPersistentUri);

    if (existingImageInfo.exists) {
      return { imageUri: existingPersistentUri, storagePath: existingStoragePath };
    }
  }

  if (isAppOwnedArtworkImageUri(imageUri) && existingStoragePath) {
    return { imageUri: existingPersistentUri ?? imageUri, storagePath: existingStoragePath };
  }

  const target = createPersistentArtworkImageTarget(imageUri);
  const directory = getPersistentArtworkImageDirectory();

  if (!target || !directory) {
    return { imageUri, storagePath: existingStoragePath ?? null };
  }

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({ from: imageUri, to: target.uri });

  const copiedImageInfo = await FileSystem.getInfoAsync(target.uri);

  if (!copiedImageInfo.exists) {
    throw new Error("Saved artwork image copy was not created.");
  }

  return { imageUri: target.uri, storagePath: target.storagePath };
}

export async function prepareDraftForSavedArtwork(
  draft: FramingProjectDraft
): Promise<FramingProjectDraft> {
  if (draft.preview.artworkSourceMode !== "import" || !draft.preview.artworkImageUri) {
    return draft;
  }

  const persistentArtworkImage = await persistArtworkImageUriForSave(
    draft.preview.artworkImageUri,
    draft.preview.artworkImageStoragePath
  );

  if (
    persistentArtworkImage.imageUri === draft.preview.artworkImageUri &&
    persistentArtworkImage.storagePath === draft.preview.artworkImageStoragePath
  ) {
    return draft;
  }

  return {
    ...draft,
    preview: {
      ...draft.preview,
      artworkImageUri: persistentArtworkImage.imageUri,
      artworkImageStoragePath: persistentArtworkImage.storagePath,
    },
  };
}
