import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BigButton } from "@/src/components/ui";
import { TriangleLogo } from "@/src/components/TriangleLogo";
import { useLang } from "@/src/i18n/context";
import { authService } from "@/src/services/auth";
import { colors, font, radius, spacing, tap } from "@/src/theme";

const OTP_LEN = 4;

export default function VerifyScreen() {
  const { t } = useLang();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: "customer" | "seller" }>();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [countdown, setCountdown] = useState(30);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const setDigit = (i: number, v: string) => {
    const val = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
  };

 const submit = async () => {
  setErr("");

  const code = digits.join("");

  if (code.length < 4) {
    setErr(t("err_fill_all"));
    return;
  }

  setBusy(true);

  try {
    const user = await authService.confirmPhoneOtp(
      code,
      (role as "customer" | "seller") || "customer"
    );

    router.replace(("/(app)/" + user.role) as any);
  } catch (e: any) {
    setErr(e?.message || t("err_generic"));
  } finally {
    setBusy(false);
  }
};

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="verify-screen">
      <View style={{ alignItems: "center", marginTop: spacing.lg }}>
        <TriangleLogo size={80} />
      </View>
      <Text style={styles.title}>{t("verify_title")}</Text>
      <Text style={styles.hint}>{t("verify_hint")}</Text>

      <View style={styles.row}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => {
              refs.current[i] = r;
            }}
            testID={`otp-input-${i}`}
            style={styles.otp}
            value={d}
            onChangeText={(v) => setDigit(i, v)}
            keyboardType="number-pad"
            maxLength={1}
            returnKeyType={i === OTP_LEN - 1 ? "done" : "next"}
          />
        ))}
      </View>

      {!!err && <Text style={styles.err} testID="verify-error">{err}</Text>}

      <BigButton
        label={busy ? "..." : t("verify")}
        onPress={submit}
        disabled={busy}
        testID="verify-submit-button"
      />

      <TouchableOpacity
        disabled={countdown > 0}
        onPress={() => setCountdown(30)}
        style={styles.resend}
        testID="verify-resend-button"
      >
        <Text style={[styles.resendTxt, countdown > 0 && { color: colors.text_secondary }]}>
          {t("resend")}{countdown > 0 ? ` (${countdown}${t("seconds")})` : ""}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.lg },
  title: { fontSize: font.h1, fontWeight: "800", color: colors.text, marginTop: spacing.lg, textAlign: "center" },
  hint: { fontSize: font.body, color: colors.text_secondary, textAlign: "center", marginVertical: spacing.md },
  row: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginVertical: spacing.lg },
  otp: {
    width: 64, height: 64,
    borderWidth: 2, borderColor: colors.border,
    borderRadius: radius.input,
    textAlign: "center",
    fontSize: 28, fontWeight: "800",
    color: colors.text,
    backgroundColor: colors.white,
  },
  err: { color: colors.error, fontSize: font.body, textAlign: "center", marginTop: spacing.sm, fontWeight: "600" },
  resend: { minHeight: tap.min, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  resendTxt: { fontSize: font.body, fontWeight: "700", color: colors.primary },
});
