import * as FileSystem from "expo-file-system";
import type { FramingProjectDraft } from "../types/framing";

const PERSISTENT_ARTWORK_IMAGE_DIRECTORY = "framing-assistant/artwork-images";
const DEFAULT_IMAGE_EXTENSION = "jpg";

function getPersistentArtworkImageDirectory() {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${PERSISTENT_ARTWORK_IMAGE_DIRECTORY}/`
    : null;
}

function isAppOwnedArtworkImageUri(uri: string) {
  const directory = getPersistentArtworkImageDirectory();
  return Boolean(directory && uri.startsWith(directory));
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

function createPersistentArtworkImageUri(sourceUri: string) {
  const directory = getPersistentArtworkImageDirectory();

  if (!directory) {
    return null;
  }

  const extension = getImageExtension(sourceUri);
  const filename = `artwork-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  return `${directory}${filename}`;
}

export async function persistArtworkImageUriForSave(imageUri: string | null) {
  if (!imageUri || isAppOwnedArtworkImageUri(imageUri)) {
    return imageUri;
  }

  const targetUri = createPersistentArtworkImageUri(imageUri);
  const directory = getPersistentArtworkImageDirectory();

  if (!targetUri || !directory) {
    return imageUri;
  }

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({ from: imageUri, to: targetUri });

  const copiedImageInfo = await FileSystem.getInfoAsync(targetUri);

  if (!copiedImageInfo.exists) {
    throw new Error("Saved artwork image copy was not created.");
  }

  return targetUri;
}

export async function prepareDraftForSavedArtwork(
  draft: FramingProjectDraft
): Promise<FramingProjectDraft> {
  if (draft.preview.artworkSourceMode !== "import" || !draft.preview.artworkImageUri) {
    return draft;
  }

  const persistentArtworkImageUri = await persistArtworkImageUriForSave(
    draft.preview.artworkImageUri
  );

  if (persistentArtworkImageUri === draft.preview.artworkImageUri) {
    return draft;
  }

  return {
    ...draft,
    preview: {
      ...draft.preview,
      artworkImageUri: persistentArtworkImageUri,
    },
  };
}
