import { Alert } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

export interface ArtworkImportSelection {
  imageUri: string;
  imageWidth: number | null;
  imageHeight: number | null;
}

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

export async function importArtworkFromLibrary(
  onSelect: (selection: ArtworkImportSelection) => void
) {
  try {
    const ImagePicker = await loadImagePickerModule();

    if (!ImagePicker) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access to place an artwork image into the preview."
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
      "Unable to open photo library",
      "Framing Assistant couldn't open the photo library. Please try again."
    );
  }
}

export async function importArtworkFromCamera(
  onSelect: (selection: ArtworkImportSelection) => void
) {
  try {
    const ImagePicker = await loadImagePickerModule();

    if (!ImagePicker) {
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access to capture an artwork image for the preview."
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
      "Unable to open camera",
      "Framing Assistant couldn't open the camera. Please try again."
    );
  }
}
