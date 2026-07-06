import React, { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors, font, radius, spacing, tap } from "@/src/theme";
import { useLang } from "@/src/i18n/context";
import { Ad } from "@/src/services/api";
import { useAds } from "./context";

// Shows a full-screen interstitial ad. Auto-dismisses after `duration` seconds
// (max 15). User may also press Skip.
export const AdOverlay: React.FC<{ ad: Ad | null; onClose: () => void }> = ({ ad, onClose }) => {
  const { t } = useLang();
  const { markShown } = useAds();
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<any>(null);

  const player = useVideoPlayer(ad?.media_type === "video" ? ad.media_url : null, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    if (!ad) return;
    markShown(ad.id);
    const dur = Math.min(15, Math.max(3, Math.round(ad.duration_seconds || (ad.media_type === "video" ? 10 : 5))));
    setRemaining(dur);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          onClose();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id]);

  if (!ad) return null;

  return (
    <Modal visible={!!ad} transparent={false} animationType="fade">
      <View style={styles.root} testID="ad-overlay">
        <View style={styles.topBar}>
          <Text style={styles.label} testID="ad-label">{t("advertisement")}</Text>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={onClose}
            testID="ad-skip-button"
            accessibilityRole="button"
          >
            <Text style={styles.skipTxt}>{t("skip")} ({remaining}{t("seconds")})</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.media}>
          {ad.media_type === "video" ? (
            <VideoView
              style={styles.mediaEl}
              player={player}
              contentFit="contain"
              nativeControls={false}
            />
          ) : (
            <Image source={{ uri: ad.media_url }} style={styles.mediaEl} contentFit="contain" />
          )}
        </View>
        {!!ad.title && (
          <Text style={styles.title} numberOfLines={2}>{ad.title}</Text>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, padding: spacing.md, justifyContent: "center" },
  topBar: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  label: {
    color: colors.white,
    fontSize: font.caption,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
  },
  skipBtn: {
    minHeight: tap.min,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: colors.white,
    borderRadius: radius.button,
  },
  skipTxt: { color: colors.text, fontWeight: "700", fontSize: font.caption },
  media: { flex: 1, alignItems: "center", justifyContent: "center" },
  mediaEl: { width: "100%", height: "80%" },
  title: {
    color: colors.white,
    fontSize: font.h2,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing.md,
  },
});
