import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, TextInput, Modal, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { PostFeed } from "@/src/components/PostFeed";
import { authService } from "@/src/services/auth";
import { api, Category, User } from "@/src/services/api";
import { uploadMedia } from "@/src/services/upload";
import { useLang } from "@/src/i18n/context";
import { BigButton } from "@/src/components/ui";
import { colors, font, radius, spacing, tap } from "@/src/theme";

export default function SellerHome() {
  const { t, lang, setLang } = useLang();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    authService.currentUser().then(setUser);
    api.listCategories().then(setCats);
  }, []);

  const logout = async () => {
    await authService.logout();
    router.replace("/language" as any);
  };

  const toggleLang = async () => {
    await setLang(lang === "en" ? "ur" : "en");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="seller-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t("seller_home")}</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <NotificationBell user={user} />
          <TouchableOpacity onPress={toggleLang} style={styles.pillBtn} testID="seller-lang-toggle">
            <Ionicons name="language" size={20} color={colors.white} />
            <Text style={styles.pillTxt}>{lang === "en" ? "اردو" : "EN"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.pillBtn} testID="logout-button">
            <Ionicons name="log-out-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.action} onPress={() => setUploadOpen(true)} testID="open-upload-button">
          <Ionicons name="cloud-upload" size={28} color={colors.white} />
          <Text style={styles.actionTxt}>{t("upload_post")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, { backgroundColor: colors.secondary }]} onPress={() => setStatsOpen(true)} testID="open-ad-stats-button">
          <Ionicons name="stats-chart" size={28} color={colors.white} />
          <Text style={styles.actionTxt}>{t("my_ad_stats")}</Text>
        </TouchableOpacity>
      </View>

      <PostFeed user={user} />

      <UploadModal
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        cats={cats}
        user={user}
        onDone={() => setUploadOpen(false)}
      />
      <AdStatsModal visible={statsOpen} onClose={() => setStatsOpen(false)} user={user} />
    </SafeAreaView>
  );
}

const UploadModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  cats: Category[];
  user: User | null;
  onDone: () => void;
}> = ({ visible, onClose, cats, user, onDone }) => {
  const { t, lang } = useLang();
  const [media, setMedia] = useState<{ uri: string; base64?: string | null; kind: "video" | "image"; duration: number } | null>(null);
  const [uploadRotation, setUploadRotation] = useState(0);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMedia(null); setDescription(""); setCategoryId(null); setErr(""); setUploadRotation(0);
    } else if (cats.length === 0) {
      // Belt-and-suspenders: parent loads categories on mount; if modal
      // opens before that resolves, this ensures chips render.
      api.listCategories().catch(() => {});
    }
  }, [visible, cats.length]);

  const pickVideoCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setErr("Camera permission denied"); return; }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      base64: false,
      videoMaxDuration: 60,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setMedia({ uri: a.uri, kind: "video", duration: (a.duration || 0) / 1000 });
    }
  };
  const pickVideoGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      base64: false,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setMedia({ uri: a.uri, kind: "video", duration: (a.duration || 0) / 1000 });
    }
  };
  const pickImageGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: Platform.OS !== "web",
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setMedia({ uri: a.uri, base64: a.base64, kind: "image", duration: 0 });
    }
  };

  const submit = async () => {
    setErr("");
    if (!user || !media || !categoryId || !description.trim()) { setErr(t("err_fill_all")); return; }
    const cat = cats.find((c) => c.id === categoryId);
    if (media.kind === "video" && cat && media.duration && media.duration > cat.max_video_seconds) {
      setErr(t("err_video_too_long") + ` (${cat.max_video_seconds}s)`); return;
    }
    setBusy(true);
    try {
      const url = await uploadMedia({ uri: media.uri, base64: media.base64, kind: media.kind });
      await api.createPost({
        seller_id: user.id,
        category_id: categoryId,
        media_type: media.kind,
        media_url: url,
        description: description.trim(),
        duration_seconds: media.duration || 0,
      });
      onDone();
    } catch (e: any) {
      setErr(e?.message || t("err_generic"));
    } finally {
      setBusy(false);
    }
  };

  const videoPlayer = useVideoPlayer(media?.kind === "video" ? media.uri : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top", "bottom"]} testID="upload-modal">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t("upload_post")}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="upload-close-button">
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <View style={styles.pickerRow}>
            <TouchableOpacity style={styles.pickBtn} onPress={pickVideoCamera} testID="pick-video-camera">
              <Ionicons name="videocam" size={22} color={colors.white} />
              <Text style={styles.pickBtnTxt}>{t("pick_video_camera")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickBtn} onPress={pickVideoGallery} testID="pick-video-gallery">
              <Ionicons name="film" size={22} color={colors.white} />
              <Text style={styles.pickBtnTxt}>{t("pick_video_gallery")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pickBtn, { backgroundColor: colors.secondary }]} onPress={pickImageGallery} testID="pick-image-gallery">
              <Ionicons name="image" size={22} color={colors.white} />
              <Text style={styles.pickBtnTxt}>{t("pick_image_gallery")}</Text>
            </TouchableOpacity>
          </View>

          {media && (
            <View style={styles.preview} testID="upload-preview">
              {media.kind === "video" ? (
                <View style={[{ width: "100%", height: "100%" }, { transform: [{ rotate: `${uploadRotation}deg` }] }]}>
                  <VideoView style={{ width: "100%", height: "100%" }} player={videoPlayer} contentFit="contain" nativeControls={false} />
                </View>
              ) : (
                <Image source={{ uri: media.uri }} style={[styles.previewMedia, { transform: [{ rotate: `${uploadRotation}deg` }] }]} contentFit="contain" />
              )}
              <TouchableOpacity
                style={styles.rotatePreviewBtn}
                onPress={() => setUploadRotation((r) => (r + 90) % 360)}
                testID="rotate-upload-preview"
              >
                <Ionicons name="reload" size={20} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: "700", marginLeft: 6 }}>{t("rotate") || "Rotate"}</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>{t("category")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {cats.map((c) => {
              const active = c.id === categoryId;
              return (
                <TouchableOpacity key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[styles.catChip, active && styles.catChipActive]}
                  testID={`upload-cat-${c.id}`}
                >
                  <Text style={[styles.catChipTxt, active && { color: colors.white }]}>
                    {lang === "ur" ? c.name_ur : c.name_en} ({c.max_video_seconds}s)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>{t("description")}</Text>
          <TextInput
            testID="upload-description-input"
            multiline
            value={description}
            onChangeText={setDescription}
            style={styles.textarea}
            placeholder={t("description")}
            placeholderTextColor={colors.text_secondary}
          />

          {!!err && <Text style={styles.err} testID="upload-error">{err}</Text>}

          <BigButton
            label={busy ? "..." : t("submit")}
            onPress={submit}
            disabled={busy}
            testID="upload-submit-button"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const AdStatsModal: React.FC<{ visible: boolean; onClose: () => void; user: User | null }> = ({ visible, onClose, user }) => {
  const { t } = useLang();
  const [ads, setAds] = useState<any[]>([]);
  useEffect(() => {
    if (visible && user) api.listAds({ uploader_id: user.id }).then(setAds);
  }, [visible, user]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top", "bottom"]} testID="seller-stats-modal">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t("my_ad_stats")}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="ad-stats-close">
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          {ads.length === 0 && <Text style={{ fontSize: font.body, color: colors.text_secondary, textAlign: "center" }}>—</Text>}
          {ads.map((a) => (
            <View key={a.id} style={styles.adRow} testID={`seller-ad-${a.id}`}>
              <Text style={{ fontSize: font.body, fontWeight: "700", color: colors.text }}>{a.title || a.media_type.toUpperCase()}</Text>
              <Text style={{ fontSize: font.body, color: colors.text_secondary }}>{t("views")}: {a.views}</Text>
              <Text style={{ fontSize: font.caption, color: a.active ? colors.success : colors.error, fontWeight: "700" }}>
                {a.active ? t("active") : t("inactive")}
              </Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  pillBtn: {
    minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.button,
    backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 6,
  },
  pillTxt: { color: colors.white, fontWeight: "800", fontSize: font.caption },
  actionsRow: {
    flexDirection: "row", padding: spacing.md, gap: spacing.md,
  },
  action: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radius.card,
    padding: spacing.md, alignItems: "center", gap: spacing.sm,
    minHeight: 80,
  },
  actionTxt: { color: colors.white, fontWeight: "800", fontSize: font.button },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  closeBtn: { minWidth: tap.min, minHeight: tap.min, justifyContent: "center", alignItems: "center" },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  pickBtn: {
    minHeight: tap.min, paddingHorizontal: spacing.md, borderRadius: radius.button,
    backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    flexGrow: 1, justifyContent: "center",
  },
  pickBtnTxt: { color: colors.white, fontWeight: "700", fontSize: font.caption },
  preview: {
    width: "100%", aspectRatio: 1, backgroundColor: colors.black,
    borderRadius: radius.card, overflow: "hidden", marginBottom: spacing.md,
    position: "relative",
  },
  previewMedia: { width: "100%", height: "100%" },
  rotatePreviewBtn: {
    position: "absolute", bottom: spacing.sm, right: spacing.sm, zIndex: 5,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.button, minHeight: tap.min,
  },
  label: { fontSize: font.body, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  catChip: {
    minHeight: 44, paddingHorizontal: spacing.md,
    borderRadius: radius.button, borderWidth: 2, borderColor: colors.border,
    justifyContent: "center", backgroundColor: colors.white,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipTxt: { fontSize: font.caption, fontWeight: "700", color: colors.text },
  textarea: {
    minHeight: 120, borderWidth: 2, borderColor: colors.border, borderRadius: radius.input,
    padding: spacing.md, fontSize: font.body, color: colors.text, textAlignVertical: "top",
    backgroundColor: colors.white,
  },
  err: { color: colors.error, fontSize: font.body, marginVertical: spacing.sm, fontWeight: "600" },
  adRow: {
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.card,
    marginBottom: spacing.sm, gap: 4,
  },
});
