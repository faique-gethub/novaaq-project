import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BigButton } from "@/src/components/ui";
import { TriangleLogo } from "@/src/components/TriangleLogo";
import { useLang } from "@/src/i18n/context";
import { authService } from "@/src/services/auth";
import { Role } from "@/src/services/api";
import { colors, font, radius, spacing, tap } from "@/src/theme";

const ROLES: Role[] = ["admin", "seller", "customer"];

export default function SignupScreen() {
  const { t } = useLang();
  const router = useRouter();
  const [identifier, setId] = useState("");
  const [password, setPw] = useState("");
  const [role, setRole] = useState<Role>("customer");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Email verification waiting state
  const [waitingVerify, setWaitingVerify] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const user = await authService.checkVerificationAndLogin();
        if (user) {
          if (pollRef.current) clearInterval(pollRef.current);
          router.replace(`/(app)/${user.role}` as any);
        }
      } catch {
        // ignore transient errors while polling
      }
    }, 3000);
  };

  const submit = async () => {
    setErr("");
    if (!identifier || !password) {
      setErr(t("err_fill_all"));
      return;
    }
    setBusy(true);
    try {
      const trimmedId = identifier.trim();
      const res = await authService.signup(trimmedId, password, role);
      if (trimmedId.includes("@")) {
        // Email signup: verification email sent. Show waiting screen and poll.
        setWaitingVerify(true);
        startPolling();
      } else {
        // Phone signup: keep the existing mock OTP verify flow.
        router.replace({ pathname: "/verify", params: { user_id: (res as any).user_id } } as any);
      }
    } catch (e: any) {
      setErr(e?.message || t("err_generic"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResendMsg("");
    try {
      await authService.resendVerificationEmail();
      setResendMsg("Verification email resent. Check your inbox (and spam).");
    } catch (e: any) {
      setResendMsg(e?.message || t("err_generic"));
    }
  };

  if (waitingVerify) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="signup-verify-wait-screen">
        <View style={styles.scroll}>
          <View style={{ alignItems: "center", marginBottom: spacing.md }}>
            <TriangleLogo size={80} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.info}>
            We sent a verification link to {"\n"}
            <Text style={{ fontWeight: "700" }}>{identifier.trim()}</Text>
            {"\n\n"}Check your inbox — and your spam folder — and tap the link.
            This screen will move on automatically once it's verified.
          </Text>

          {!!resendMsg && <Text style={styles.info}>{resendMsg}</Text>}

          <BigButton label="Resend verification email" onPress={resend} testID="resend-verify-button" />

          <TouchableOpacity
            style={styles.switch}
            onPress={() => {
              if (pollRef.current) clearInterval(pollRef.current);
              setWaitingVerify(false);
              router.replace("/login" as any);
            }}
            testID="back-to-login-button"
          >
            <Text style={styles.switchTxt}>
              Back to <Text style={{ color: colors.primary, fontWeight: "700" }}>{t("login")}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="signup-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginBottom: spacing.md }}>
            <TriangleLogo size={80} />
          </View>
          <Text style={styles.title}>{t("signup")}</Text>

          <TextInput
            testID="signup-identifier-input"
            placeholder={t("email_or_phone")}
            placeholderTextColor={colors.text_secondary}
            style={styles.input}
            value={identifier}
            onChangeText={setId}
            autoCapitalize="none"
          />
          <TextInput
            testID="signup-password-input"
            placeholder={t("password")}
            placeholderTextColor={colors.text_secondary}
            style={styles.input}
            value={password}
            onChangeText={setPw}
            secureTextEntry
          />

          <Text style={styles.roleTitle}>{t("role")}</Text>
          <View style={styles.rolesRow}>
            {ROLES.map((r) => {
              const active = r === role;
              return (
                <TouchableOpacity
                  key={r}
                  testID={`role-${r}-button`}
                  onPress={() => setRole(r)}
                  style={[styles.roleBtn, active && styles.roleBtnActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.roleTxt, active && styles.roleTxtActive]}>{t(r as any)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!err && <Text style={styles.err} testID="signup-error">{err}</Text>}

          <BigButton
            label={busy ? "..." : t("signup")}
            onPress={submit}
            disabled={busy}
            testID="signup-submit-button"
          />

          <TouchableOpacity
            style={styles.switch}
            onPress={() => router.replace("/login" as any)}
            testID="go-to-login-button"
          >
            <Text style={styles.switchTxt}>{t("have_account")} <Text style={{ color: colors.primary, fontWeight: "700" }}>{t("login")}</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.lg },
  scroll: { paddingVertical: spacing.xl, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: font.h1, fontWeight: "800", color: colors.text, marginBottom: spacing.lg, textAlign: "center" },
  info: { fontSize: font.body, color: colors.text_secondary, textAlign: "center", marginBottom: spacing.lg, lineHeight: 22 },
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
  roleTitle: { fontSize: font.body, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  rolesRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  roleBtn: {
    minHeight: tap.min,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
    backgroundColor: colors.white,
  },
  roleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleTxt: { fontSize: font.button, fontWeight: "700", color: colors.text },
  roleTxtActive: { color: colors.white },
  err: { color: colors.error, fontSize: font.body, marginVertical: spacing.sm, fontWeight: "600" },
  switch: { paddingVertical: spacing.md, alignItems: "center" },
  switchTxt: { fontSize: font.body, color: colors.text },
});
