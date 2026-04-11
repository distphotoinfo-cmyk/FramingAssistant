import React from "react";
import { Modal, Pressable, Text } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

interface AppSheetModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  showDoneButton?: boolean;
}

export default function AppSheetModal({
  visible,
  title,
  onClose,
  children,
  showDoneButton = false,
}: AppSheetModalProps) {
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
          <Pressable
            onPress={() => undefined}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
              paddingHorizontal: showDoneButton ? spacing.sm : 0,
            }}
          >
            <Text style={{ ...typography.screenTitle, color: colors.textPrimary, flex: 1 }}>
              {title}
            </Text>
            {showDoneButton ? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={`Done with ${title}`}
                hitSlop={8}
              >
                <Text style={{ ...typography.sectionTitle, color: colors.accent }}>
                  Done
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
