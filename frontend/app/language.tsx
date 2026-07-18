import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TriangleLogo } from "@/src/components/TriangleLogo";
import { BigButton } from "@/src/components/ui";
import { useLang } from "@/src/i18n/context";
import { authService, getOrCreateGuestUser } from "@/src/services/auth";
import { api } from "@/src/services/api";
import { storage } from "@/src/utils/storage";
import { colors, font, spacing } from "@/src/theme";

const USER_KEY = "novaaq_user";

export default function LanguageScreen() {
  const { setLang } = useLang();
  const router = useRouter();

  const choose = async (l: "en" | "ur") => {
    await setLang(l);
    const cached = await authService.currentUser();
    if (cached && cached.verified) {
      // Refresh from backend so role changes (e.g. admin promoting a seller)
      // take effect immediately, instead of trusting a possibly-stale local cache.
      try {
        const fresh = await api.getUser(cached.id);
        await storage.setItem(USER_KEY, JSON.stringify(fresh));
        router.replace(("/(app)/" + fresh.role) as any);
      } catch {
        // Backend unreachable or user deleted — fall back to cached role.
        router.replace(("/(app)/" + cached.role) as any);
      }
    } else {
      try {
        const guest = await getOrCreateGuestUser();
        router.replace(("/(app)/" + guest.role) as any);
      } catch {
        router.replace("/login" as any);
      }
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="language-screen">
      <View style={styles.logoWrap}>
        <TriangleLogo size={160} />
        <Text style={styles.brand} testID="app-name">Novaaq</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} testID="choose-language-title">Choose Language</Text>
        <Text style={styles.subtitle}>زبان منتخب کریں</Text>
        <BigButton
          label="English"
          onPress={() => choose("en")}
          testID="language-english-button"
        />
        <BigButton
          label="اردو"
          onPress={() => choose("ur")}
          variant="secondary"
          testID="language-urdu-button"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.lg },
  logoWrap: { alignItems: "center", marginTop: spacing.xl },
  brand: { fontSize: font.h1, fontWeight: "800", color: colors.text, marginTop: spacing.md },
  body: { flex: 1, justifyContent: "center" },
  title: { fontSize: font.h1, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: spacing.sm },
  subtitle: { fontSize: font.h2, fontWeight: "700", color: colors.text_secondary, textAlign: "center", marginBottom: spacing.xl },
});
