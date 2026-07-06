import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { colors, font, radius, spacing, tap } from "@/src/theme";

type Variant = "primary" | "secondary" | "outline" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
};

export const BigButton: React.FC<Props> = ({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  testID,
  style,
  fullWidth = true,
}) => {
  const s = styles[variant];
  const txt = variant === "outline" ? styles.textDark : styles.textLight;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.base, s, disabled && styles.disabled, fullWidth && { alignSelf: "stretch" }, style]}
    >
      <Text style={[styles.textBase, txt]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle; testID?: string }> = ({
  children,
  style,
  testID,
}) => (
  <View testID={testID} style={[styles.card, style]}>{children}</View>
);

export const ScreenTitle: React.FC<{ children: string; testID?: string }> = ({ children, testID }) => (
  <Text style={styles.title} testID={testID}>{children}</Text>
);

const styles = StyleSheet.create({
  base: {
    minHeight: tap.min,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  outline: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.primary },
  danger: { backgroundColor: colors.error },
  disabled: { opacity: 0.5 },
  textBase: { fontSize: font.button, fontWeight: "700" },
  textLight: { color: colors.white },
  textDark: { color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
  },
  title: {
    fontSize: font.h1,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.md,
  },
});
