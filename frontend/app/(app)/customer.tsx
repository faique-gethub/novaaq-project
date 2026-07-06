import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PostFeed } from "@/src/components/PostFeed";
import { authService } from "@/src/services/auth";
import { User } from "@/src/services/api";
import { useLang } from "@/src/i18n/context";
import { colors, font, radius, spacing, tap } from "@/src/theme";

export default function CustomerHome() {
  const { t } = useLang();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    authService.currentUser().then(setUser);
  }, []);

  const logout = async () => {
    await authService.logout();
    router.replace("/language" as any);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="customer-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t("browse")}</Text>
        <TouchableOpacity onPress={logout} style={styles.iconBtn} testID="logout-button">
          <Ionicons name="log-out-outline" size={24} color={colors.white} />
          <Text style={styles.iconBtnTxt}>{t("logout")}</Text>
        </TouchableOpacity>
      </View>
      <PostFeed user={user} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  iconBtn: {
    minHeight: tap.min - 12, paddingHorizontal: spacing.md,
    backgroundColor: colors.primary, borderRadius: radius.button,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  iconBtnTxt: { color: colors.white, fontWeight: "700", fontSize: font.caption },
});
