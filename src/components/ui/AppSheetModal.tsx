import React from "react";
import { Modal, Pressable, Text } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface AppSheetModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function AppSheetModal({ visible, title, onClose, children }: AppSheetModalProps) {
  const { colors, radii, spacing, typography } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: colors.backgroundCard,
            borderWidth: 2,
            borderColor: colors.borderStrong,
            borderRadius: radii.xl,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <Text style={{ ...typography.screenTitle, color: colors.textPrimary }}>
            {title}
          </Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
