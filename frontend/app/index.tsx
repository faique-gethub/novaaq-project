import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useLang } from "@/src/i18n/context";
import { authService } from "@/src/services/auth";
import { colors } from "@/src/theme";
import { TriangleLogo } from "@/src/components/TriangleLogo";

// Bootstrap: on every open, decide where to send the user.
// Language is asked EVERY app open per problem statement, so we always route
// to /language first, and let /language forward to auth/home based on state.
export default function Index() {
  const router = useRouter();
  const { ready } = useLang();

  useEffect(() => {
    if (!ready) return;
    // Force language screen on each open (per requirement).
    (async () => {
      const _u = await authService.currentUser(); // preload
      router.replace("/language");
    })();
  }, [ready, router]);

  return (
    <View style={styles.center} testID="boot-screen">
      <TriangleLogo size={140} />
      <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
});
