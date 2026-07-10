import React from "react";
import { TouchableOpacity, StyleSheet, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const WHATSAPP_NUMBER = "923322619928"; // +92 3322619928, no + or leading 0

export const FloatingWhatsApp: React.FC = () => {
  const openWhatsApp = async () => {
    const message = encodeURIComponent("Hi, I need help with Novaaq app.");
    const webUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    try {
      await Linking.openURL(webUrl);
    } catch {
      // Fallback: try the native app scheme if the web link somehow fails.
      try {
        await Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${message}`);
      } catch {
        // Silently ignore if neither is available.
      }
    }
  };

  return (
    <TouchableOpacity
      onPress={openWhatsApp}
      style={styles.button}
      testID="floating-whatsapp-button"
      accessibilityRole="button"
      accessibilityLabel="Contact us on WhatsApp"
      activeOpacity={0.8}
    >
      <Ionicons name="logo-whatsapp" size={30} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 8,
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.3)", cursor: "pointer" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
    }),
  },
});
