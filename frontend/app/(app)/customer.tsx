import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PostFeed } from "@/src/components/PostFeed";
import { authService } from "@/src/services/auth";
import { api, Category, User } from "@/src/services/api";
import { useLang } from "@/src/i18n/context";
import { colors, font, radius, spacing, tap } from "@/src/theme";
import { UploadModal, AdStatsModal } from "@/src/components/SellerModals";
import { NotificationBell } from "@/src/components/NotificationBell";

export default function CustomerHome() {
  const { t } = useLang();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    authService.currentUser().then(setUser);
    api.listCategories().then(setCats);
  }, []);

  const logout = async () => {
    await authService.logout();
    router.replace("/language" as any);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="customer-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t("browse")}</Text>
        <View style={styles.actionsRow}>
          <NotificationBell user={user} />
          <TouchableOpacity onPress={() => setUploadOpen(true)} style={styles.iconBtn} testID="open-upload-button">
            <Ionicons name="add-circle" size={20} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStatsOpen(true)} style={[styles.iconBtn, { backgroundColor: colors.secondary }]} testID="open-ad-stats-button">
            <Ionicons name="stats-chart" size={20} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.iconBtn} testID="logout-button">
            <Ionicons name="log-out-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <PostFeed user={user} />

      <UploadModal
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        cats={cats}
        user={user}
        onDone={() => setUploadOpen(false)}
      />
      <AdStatsModal visible={statsOpen} onClose={() => setStatsOpen(false)} user={user} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.text, flexShrink: 1 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, flexShrink: 0 },
  iconBtn: {
    minWidth: tap.min - 8, minHeight: tap.min - 8, paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.button,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
});
