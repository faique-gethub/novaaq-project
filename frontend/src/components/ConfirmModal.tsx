import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, font, radius, spacing } from "@/src/theme";

export const ConfirmModal: React.FC<{
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ visible, message, onConfirm, onCancel }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.msg}>{message}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onCancel} testID="confirm-modal-cancel">
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.okBtn]} onPress={onConfirm} testID="confirm-modal-ok">
            <Text style={styles.okTxt}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: spacing.lg, width: "100%", maxWidth: 380 },
  msg: { fontSize: font.body, color: colors.text, marginBottom: spacing.lg, textAlign: "center" },
  row: { flexDirection: "row", gap: spacing.sm },
  btn: { flex: 1, minHeight: 48, borderRadius: radius.button, justifyContent: "center", alignItems: "center" },
  cancelBtn: { backgroundColor: colors.surface },
  cancelTxt: { color: colors.text, fontWeight: "700" },
  okBtn: { backgroundColor: colors.error },
  okTxt: { color: colors.white, fontWeight: "700" },
});
