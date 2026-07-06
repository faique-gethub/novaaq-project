import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Modal} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BigButton } from "@/src/components/ui";
import { TriangleLogo } from "@/src/components/TriangleLogo";
import { useLang } from "@/src/i18n/context";
import { authService } from "@/src/services/auth";
import { colors, font, radius, spacing, tap } from "@/src/theme";

export default function LoginScreen() {
  const { t } = useLang();
  const router = useRouter();
  const [identifier, setId] = useState("");
  const [password, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Forgot password modal state
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!identifier || !password) {
      setErr(t("err_fill_all"));
      return;
    }
    setBusy(true);
    try {
      const user = await authService.login(identifier.trim(), password);
      if (!user.verified) {
        router.replace({ pathname: "/verify", params: { user_id: user.id } } as any);
      } else {
        router.replace(("/(app)/" + user.role) as any);
      }
    } catch (e: any) {
      setErr(e?.message || t("err_generic"));
    } finally {
      setBusy(false);
    }
  };

  const openReset = () => {
    setResetEmail(identifier.includes("@") ? identifier.trim() : "");
    setResetMsg("");
    setShowReset(true);
  };

  const submitReset = async () => {
    setResetMsg("");
    if (!resetEmail.trim() || !resetEmail.includes("@")) {
      setResetMsg("Please enter a valid email address.");
      return;
    }
    setResetBusy(true);
    try {
      await authService.requestPasswordReset(resetEmail.trim());
      setResetMsg("If that email exists, a reset link has been sent. Check your inbox and spam folder.");
    } catch (e: any) {
      setResetMsg(e?.message || t("err_generic"));
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
            <TriangleLogo size={96} />
            <Text style={styles.brand}>Novaaq</Text>
          </View>
          <Text style={styles.title}>{t("login")}</Text>

          <TextInput
            testID="login-identifier-input"
            placeholder={t("email_or_phone")}
            placeholderTextColor={colors.text_secondary}
            style={styles.input}
            value={identifier}
            onChangeText={setId}
            autoCapitalize="none"
            keyboardType="default"
          />
          <TextInput
            testID="login-password-input"
            placeholder={t("password")}
            placeholderTextColor={colors.text_secondary}
            style={styles.input}
            value={password}
            onChangeText={setPw}
            secureTextEntry
          />

          <TouchableOpacity onPress={openReset} testID="forgot-password-button" style={{ alignSelf: "flex-end", marginBottom: spacing.sm }}>
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: font.body }}>Forgot password?</Text>
          </TouchableOpacity>

          {!!err && <Text style={styles.err} testID="login-error">{err}</Text>}

          <BigButton
            label={busy ? "..." : t("login")}
            onPress={submit}
            disabled={busy}
            testID="login-submit-button"
          />

          <TouchableOpacity
            style={styles.switch}
            onPress={() => router.replace("/signup" as any)}
            testID="go-to-signup-button"
          >
            <Text style={styles.switchTxt}>{t("no_account")} <Text style={{ color: colors.primary, fontWeight: "700" }}>{t("signup")}</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showReset} animationType="slide" transparent onRequestClose={() => setShowReset(false)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <Text style={styles.title}>Reset password</Text>
            <Text style={{ fontSize: font.body, color: colors.text_secondary, marginBottom: spacing.md, textAlign: "center" }}>
              Enter your email and we'll send you a reset link.
            </Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={colors.text_secondary}
              style={styles.input}
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              testID="reset-email-input"
            />
            {!!resetMsg && <Text style={{ color: colors.text, fontSize: font.body, marginBottom: spacing.sm, textAlign: "center" }}>{resetMsg}</Text>}
            <BigButton label={resetBusy ? "..." : "Send reset link"} onPress={submitReset} disabled={resetBusy} testID="send-reset-button" />
            <TouchableOpacity style={styles.switch} onPress={() => setShowReset(false)} testID="close-reset-modal">
              <Text style={styles.switchTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.lg },
  scroll: { paddingVertical: spacing.xl, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: font.h1, fontWeight: "800", color: colors.text, marginBottom: spacing.lg, textAlign: "center" },
  brand: { fontSize: font.h2, fontWeight: "800", color: colors.text, marginTop: spacing.sm },
  input: {
    minHeight: tap.min,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    fontSize: font.body,
    color: colors.text,
    marginVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  err: { color: colors.error, fontSize: font.body, marginVertical: spacing.sm, fontWeight: "600" },
  switch: { paddingVertical: spacing.md, alignItems: "center" },
  switchTxt: { fontSize: font.body, color: colors.text },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.input, padding: spacing.lg },
});
