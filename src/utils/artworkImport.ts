import { Alert } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

export interface ArtworkImportSelection {
  imageUri: string;
  imageWidth: number | null;
  imageHeight: number | null;
}

interface ImageImportCopy {
  mediaLibraryPermissionTitle: string;
  mediaLibraryPermissionMessage: string;
  cameraPermissionTitle: string;
  cameraPermissionMessage: string;
  libraryErrorTitle: string;
  libraryErrorMessage: string;
  cameraErrorTitle: string;
  cameraErrorMessage: string;
}

const ARTWORK_IMPORT_COPY: ImageImportCopy = {
  mediaLibraryPermissionTitle: "Photo access needed",
  mediaLibraryPermissionMessage: "Allow photo library access to place an artwork image into the preview.",
  cameraPermissionTitle: "Camera access needed",
  cameraPermissionMessage: "Allow camera access to capture an artwork image for the preview.",
  libraryErrorTitle: "Unable to open photo library",
  libraryErrorMessage: "Framing Assistant couldn't open the photo library. Please try again.",
  cameraErrorTitle: "Unable to open camera",
  cameraErrorMessage: "Framing Assistant couldn't open the camera. Please try again.",
};

const WALL_PHOTO_IMPORT_COPY: ImageImportCopy = {
  mediaLibraryPermissionTitle: "Photo access needed",
  mediaLibraryPermissionMessage: "Allow photo library access to choose a wall photo for Room View.",
  cameraPermissionTitle: "Camera access needed",
  cameraPermissionMessage: "Allow camera access to capture a wall photo for Room View.",
  libraryErrorTitle: "Unable to open photo library",
  libraryErrorMessage: "Framing Assistant couldn't open the photo library. Please try again.",
  cameraErrorTitle: "Unable to open camera",
  cameraErrorMessage: "Framing Assistant couldn't open the camera. Please try again.",
};

async function loadImagePickerModule() {
  const nativeImagePicker = requireOptionalNativeModule("ExponentImagePicker");

  if (!nativeImagePicker) {
    Alert.alert(
      "Rebuild required",
      "Image import was added as a native module. Rebuild and reinstall Framing Assistant before using the photo library or camera."
    );
    return null;
  }

  try {
    return await import("expo-image-picker");
  } catch {
    Alert.alert(
      "Rebuild required",
      "Image import was added as a native module. Rebuild and reinstall Framing Assistant before using the photo library or camera."
    );
    return null;
  }
}

async function importImageFromLibrary({
  copy,
  onSelect,
}: {
  copy: ImageImportCopy;
  onSelect: (selection: ArtworkImportSelection) => void;
}) {
  try {
    const ImagePicker = await loadImagePickerModule();

    if (!ImagePicker) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        copy.mediaLibraryPermissionTitle,
        copy.mediaLibraryPermissionMessage
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    onSelect({
      imageUri: result.assets[0].uri,
      imageWidth: result.assets[0].width ?? null,
      imageHeight: result.assets[0].height ?? null,
    });
  } catch {
    Alert.alert(
      copy.libraryErrorTitle,
      copy.libraryErrorMessage
    );
  }
}

async function importImageFromCamera({
  copy,
  onSelect,
}: {
  copy: ImageImportCopy;
  onSelect: (selection: ArtworkImportSelection) => void;
}) {
  try {
    const ImagePicker = await loadImagePickerModule();

    if (!ImagePicker) {
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        copy.cameraPermissionTitle,
        copy.cameraPermissionMessage
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    onSelect({
      imageUri: result.assets[0].uri,
      imageWidth: result.assets[0].width ?? null,
      imageHeight: result.assets[0].height ?? null,
    });
  } catch {
    Alert.alert(
      copy.cameraErrorTitle,
      copy.cameraErrorMessage
    );
  }
}

export async function importArtworkFromLibrary(
  onSelect: (selection: ArtworkImportSelection) => void
) {
  return importImageFromLibrary({ copy: ARTWORK_IMPORT_COPY, onSelect });
}

export async function importArtworkFromCamera(
  onSelect: (selection: ArtworkImportSelection) => void
) {
  return importImageFromCamera({ copy: ARTWORK_IMPORT_COPY, onSelect });
}

export async function importWallPhotoFromLibrary(
  onSelect: (selection: ArtworkImportSelection) => void
) {
  return importImageFromLibrary({ copy: WALL_PHOTO_IMPORT_COPY, onSelect });
}

export async function importWallPhotoFromCamera(
  onSelect: (selection: ArtworkImportSelection) => void
) {
  return importImageFromCamera({ copy: WALL_PHOTO_IMPORT_COPY, onSelect });
}
