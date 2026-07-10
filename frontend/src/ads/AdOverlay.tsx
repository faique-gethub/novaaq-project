import React, { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors, font, radius, spacing, tap } from "@/src/theme";
import { useLang } from "@/src/i18n/context";
import { Ad } from "@/src/services/api";
import { useAds } from "./context";

export const AdOverlay: React.FC<{ ad: Ad | null; onClose: () => void }> = ({ ad, onClose }) => {
  const { t } = useLang();
  const { markShown } = useAds();
  const [remaining, setRemaining] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const skipTimerRef = useRef<any>(null);
  const videoWatchRef = useRef<any>(null);

  const player = useVideoPlayer(ad?.media_type === "video" ? ad.media_url : null, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    if (!ad) return;
    markShown(ad.id);

    const skipAfter = Math.max(0, ad.skip_after_seconds ?? 5);
    setRemaining(Math.ceil(skipAfter));
    setCanSkip(skipAfter <= 0);

    if (skipAfter > 0) {
      skipTimerRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(skipTimerRef.current);
            setCanSkip(true);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }

    // For video ads, close automatically once playback finishes.
    if (ad.media_type === "video") {
      videoWatchRef.current = setInterval(() => {
        try {
          const dur = player.duration;
          const cur = player.currentTime;
          if (dur && cur && cur >= dur - 0.3) {
            clearInterval(videoWatchRef.current);
            onClose();
          }
        } catch {
          // player not ready yet; ignore
        }
      }, 500);
    }

    return () => {
      clearInterval(skipTimerRef.current);
      clearInterval(videoWatchRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id]);

  if (!ad) return null;

  return (
    <Modal visible={!!ad} transparent={false} animationType="fade">
      <View style={styles.root} testID="ad-overlay">
        <View style={styles.topBar}>
          <Text style={styles.label} testID="ad-label" numberOfLines={1}>{t("advertisement")}</Text>
          <TouchableOpacity
            style={[styles.skipBtn, !canSkip && styles.skipBtnDisabled]}
            onPress={canSkip ? onClose : undefined}
            disabled={!canSkip}
            testID="ad-skip-button"
            accessibilityRole="button"
          >
            <Text style={[styles.skipTxt, !canSkip && styles.skipTxtDisabled]} numberOfLines={1}>
              {canSkip ? t("skip") : `${t("skip")} ${remaining}${t("seconds")}`}
            </Text>
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
  root: { flex: 1, backgroundColor: colors.black, padding: spacing.md, justifyContent: "center", overflow: "hidden" },
  topBar: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
    gap: spacing.sm,
  },
  label: {
    color: colors.white,
    fontSize: font.caption,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    flexShrink: 1,
  },
  skipBtn: {
    minHeight: tap.min - 8,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    backgroundColor: colors.white,
    borderRadius: radius.button,
    flexShrink: 0,
  },
  skipBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  skipTxt: { color: colors.text, fontWeight: "700", fontSize: font.caption },
  skipTxtDisabled: { color: colors.text_secondary },
  media: { flex: 1, alignItems: "center", justifyContent: "center", width: "100%" },
  mediaEl: { width: "100%", height: "80%" },
  title: {
    color: colors.white,
    fontSize: font.h2,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing.md,
  },
});
