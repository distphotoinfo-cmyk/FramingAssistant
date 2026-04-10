import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppCard from "../components/ui/AppCard";
import { useFramingFlowStore } from "../state/framingFlowStore";
import { useSavedProjectsStore } from "../state/savedProjectsStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { FramingRootStackParamList } from "../types/navigation";

export default function SavedProjectsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<FramingRootStackParamList>>();
  const { colors } = useAppTheme();
  const projects = useSavedProjectsStore((state) => state.projects);
  const deleteProject = useSavedProjectsStore((state) => state.deleteProject);
  const replaceDraft = useFramingFlowStore((state) => state.replaceDraft);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomWidth: 2,
          borderBottomColor: colors.borderStrong,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>
            Saved Projects
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {projects.length === 0 ? (
          <AppCard title="No saved projects yet" subtitle="Save a setup from Final Specs and it will appear here.">
            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
              Saved Projects now lives outside the guided flow so users can start planning immediately and decide later which drafts are worth keeping.
            </Text>
          </AppCard>
        ) : (
          projects.map((project) => (
            <Pressable
              key={project.id}
              onPress={() => {
                replaceDraft(project.draft);
                navigation.navigate("Setup");
              }}
              onLongPress={() => {
                Alert.alert(
                  "Delete Project",
                  `Remove "${project.name}" from Saved Projects?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => deleteProject(project.id),
                    },
                  ]
                );
              }}
              style={{
                backgroundColor: colors.backgroundCard,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary }}>
                    {project.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                    Saved {new Date(project.savedAt).toLocaleDateString()}
                  </Text>
                  {project.notes ? (
                    <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 8 }}>
                      {project.notes}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
