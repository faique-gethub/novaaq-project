import React, { useCallback, useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, Notification, User } from "@/src/services/api";
import { colors, font, radius, spacing, tap } from "@/src/theme";

export const NotificationBell: React.FC<{ user: User | null }> = ({ user }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.listNotifications(user.identifier);
      setItems(list);
    } catch {
      // ignore transient errors
    }
  }, [user]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000); // poll every 20s for new notifications
    return () => clearInterval(iv);
  }, [load]);

  const unreadCount = items.filter((n) => user && !n.read_by.includes(user.id)).length;

  const openList = async () => {
    setOpen(true);
    if (!user) return;
    // Mark all currently-unread as read.
    const unread = items.filter((n) => !n.read_by.includes(user.id));
    for (const n of unread) {
      try { await api.markNotificationRead(n.id, user.id); } catch {}
    }
    load();
  };

  if (!user) return null;

  return (
    <>
      <TouchableOpacity onPress={openList} style={styles.bellBtn} testID="notification-bell-button">
        <Ionicons name="notifications" size={20} color={colors.white} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Notifications</Text>
              <TouchableOpacity onPress={() => setOpen(false)} testID="notification-close-button">
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {items.length === 0 && (
                <Text style={{ color: colors.text_secondary, textAlign: "center", padding: spacing.lg }}>No notifications yet.</Text>
              )}
              {items.map((n) => (
                <View key={n.id} style={styles.item} testID={`notification-item-${n.id}`}>
                  <Text style={styles.msg}>{n.message}</Text>
                  <Text style={styles.date}>{new Date(n.created_at).toLocaleString()}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellBtn: {
    minWidth: tap.min - 8, minHeight: tap.min - 8, borderRadius: radius.button,
    backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
    position: "relative",
  },
  badge: {
    position: "absolute", top: -4, right: -4, backgroundColor: colors.error,
    borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeTxt: { color: colors.white, fontSize: 11, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.md, maxHeight: "70%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  item: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.sm },
  msg: { fontSize: font.body, color: colors.text, marginBottom: 4 },
  date: { fontSize: font.caption, color: colors.text_secondary },
});
