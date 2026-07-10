import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, TextInput, Modal, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PostFeed } from "@/src/components/PostFeed";
import { authService } from "@/src/services/auth";
import { api, Ad, Category, Post, User } from "@/src/services/api";
import { uploadMedia } from "@/src/services/upload";
import { useLang } from "@/src/i18n/context";
import { BigButton } from "@/src/components/ui";
import { ConfirmModal } from "@/src/components/ConfirmModal";
import { NotificationBell } from "@/src/components/NotificationBell";
import { colors, font, radius, spacing, tap } from "@/src/theme";

type Tab = "feed" | "categories" | "ads" | "settings" | "notify";

export default function AdminHome() {
  const { t, lang, setLang } = useLang();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("feed");

  useEffect(() => {
    authService.currentUser().then(setUser);
  }, []);

  const logout = async () => {
    await authService.logout();
    router.replace("/language" as any);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="admin-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t("admin_dashboard")}</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <NotificationBell user={user} />
          <TouchableOpacity onPress={() => setLang(lang === "en" ? "ur" : "en")} style={styles.pillBtn} testID="admin-lang-toggle">
            <Ionicons name="language" size={20} color={colors.white} />
            <Text style={styles.pillTxt}>{lang === "en" ? "اردو" : "EN"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.pillBtn} testID="logout-button">
            <Ionicons name="log-out-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 64 }} contentContainerStyle={styles.tabsRow}>
        <TabBtn label={t("manage_posts")} active={tab === "feed"} onPress={() => setTab("feed")} testID="admin-tab-feed" />
        <TabBtn label={t("manage_categories")} active={tab === "categories"} onPress={() => setTab("categories")} testID="admin-tab-categories" />
        <TabBtn label={t("manage_ads")} active={tab === "ads"} onPress={() => setTab("ads")} testID="admin-tab-ads" />
        <TabBtn label={t("ad_frequency")} active={tab === "settings"} onPress={() => setTab("settings")} testID="admin-tab-settings" />
        <TabBtn label="Notifications" active={tab === "notify"} onPress={() => setTab("notify")} testID="admin-tab-notify" />
      </ScrollView>

      {tab === "feed" && <AdminFeedPane user={user} />}
      {tab === "categories" && <CategoriesPane />}
      {tab === "ads" && <AdsPane user={user} />}
      {tab === "settings" && <SettingsPane />}
      {tab === "notify" && <NotifyPane />}
    </SafeAreaView>
  );
}

const TabBtn: React.FC<{ label: string; active: boolean; onPress: () => void; testID?: string }> = ({ label, active, onPress, testID }) => (
  <TouchableOpacity onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]} testID={testID}>
    <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{label}</Text>
  </TouchableOpacity>
);

const AdminFeedPane: React.FC<{ user: User | null }> = ({ user }) => {
  const { t } = useLang();
  const [target, setTarget] = useState<Post | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleAction = (p: Post) => setTarget(p);

  const togglePin = async () => {
    if (!target) return;
    try { await api.updatePost(target.id, { pinned: !target.pinned }); } catch {}
    setTarget(null);
  };
  const del = async () => {
    if (!target) return;
    try {
      await api.deletePost(target.id);
    } catch (e) {
      console.error("Delete post failed:", e);
    }
    setConfirmDelete(false);
    setTarget(null);
  };
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState("");
  const saveEdit = async () => {
    if (!target) return;
    try { await api.updatePost(target.id, { description: desc }); } catch {}
    setEditing(false); setTarget(null);
  };

  return (
    <>
      <PostFeed user={user} onAdminAction={handleAction} />
      <Modal visible={!!target && !editing && !confirmDelete} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View style={styles.sheetBg}>
          <View style={styles.sheet} testID="admin-action-sheet">
            <BigButton label={target?.pinned ? t("unpin") : t("pin")} onPress={togglePin} testID="admin-pin-toggle" />
            <BigButton label={t("edit")} onPress={() => { setDesc(target?.description || ""); setEditing(true); }} variant="outline" testID="admin-edit-button" />
            <BigButton label={t("delete")} onPress={() => setConfirmDelete(true)} variant="danger" testID="admin-delete-button" />
            <BigButton label={t("cancel")} onPress={() => setTarget(null)} variant="outline" testID="admin-cancel-button" />
          </View>
        </View>
      </Modal>
      <ConfirmModal
        visible={confirmDelete}
        message="Delete this post permanently?"
        onConfirm={del}
        onCancel={() => setConfirmDelete(false)}
      />
      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("edit")}</Text>
            <TouchableOpacity onPress={() => setEditing(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: spacing.md }}>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              multiline
              style={styles.textarea}
              testID="admin-edit-description-input"
            />
            <BigButton label={t("save")} onPress={saveEdit} testID="admin-edit-save-button" />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const CategoriesPane: React.FC = () => {
  const { t, lang } = useLang();
  const [cats, setCats] = useState<Category[]>([]);
  const [nameEn, setNameEn] = useState("");
  const [nameUr, setNameUr] = useState("");
  const [maxSec, setMaxSec] = useState("60");
  const [parentId, setParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => setCats(await api.listCategories()), []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!nameEn.trim() || !nameUr.trim()) return;
    await api.createCategory({
      name_en: nameEn.trim(),
      name_ur: nameUr.trim(),
      max_video_seconds: parseInt(maxSec) || 60,
      parent_id: parentId,
    });
    setNameEn(""); setNameUr(""); setMaxSec("60"); setParentId(null);
    load();
  };
  const confirmDel = async () => {
    if (!deleteTarget) return;
    try { await api.deleteCategory(deleteTarget); } catch (e) { console.error("Delete category failed:", e); }
    setDeleteTarget(null);
    load();
  };

  const mains = cats.filter((c) => !c.parent_id);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{t("new_category")}</Text>
      <TextInput style={styles.input} placeholder={t("name_en")} placeholderTextColor={colors.text_secondary} value={nameEn} onChangeText={setNameEn} testID="cat-name-en-input" />
      <TextInput style={styles.input} placeholder={t("name_ur")} placeholderTextColor={colors.text_secondary} value={nameUr} onChangeText={setNameUr} testID="cat-name-ur-input" />
      <TextInput style={styles.input} placeholder={t("max_seconds")} placeholderTextColor={colors.text_secondary} value={maxSec} onChangeText={setMaxSec} keyboardType="number-pad" testID="cat-max-seconds-input" />
      <Text style={styles.label}>{t("parent")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
        <TouchableOpacity onPress={() => setParentId(null)} style={[styles.chipSm, !parentId && styles.chipActive]} testID="cat-parent-none">
          <Text style={[styles.chipTxtSm, !parentId && { color: colors.white }]}>—</Text>
        </TouchableOpacity>
        {mains.map((m) => (
          <TouchableOpacity key={m.id} onPress={() => setParentId(m.id)} style={[styles.chipSm, parentId === m.id && styles.chipActive]} testID={`cat-parent-${m.id}`}>
            <Text style={[styles.chipTxtSm, parentId === m.id && { color: colors.white }]}>{lang === "ur" ? m.name_ur : m.name_en}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <BigButton label={t("add")} onPress={add} testID="cat-add-button" />

      <Text style={styles.sectionTitle}>{t("manage_categories")}</Text>
      {cats.map((c) => (
        <View key={c.id} style={styles.row} testID={`cat-row-${c.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{lang === "ur" ? c.name_ur : c.name_en} {c.parent_id ? "•" : ""}</Text>
            <Text style={styles.rowSub}>Max {c.max_video_seconds}s {c.parent_id ? "(subcategory)" : "(main)"}</Text>
          </View>
          <TouchableOpacity onPress={() => setDeleteTarget(c.id)} style={styles.dangerBtn} testID={`cat-delete-${c.id}`}>
            <Ionicons name="trash" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      ))}
      <ConfirmModal
        visible={!!deleteTarget}
        message="Delete this category? Its subcategories and posts will also be deleted."
        onConfirm={confirmDel}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScrollView>
  );
};

const AdsPane: React.FC<{ user: User | null }> = ({ user }) => {
  const { t } = useLang();
  const [ads, setAds] = useState<Ad[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [skipAfter, setSkipAfter] = useState("5");
  const [media, setMedia] = useState<{ uri: string; base64?: string | null; kind: "video" | "image"; duration: number } | null>(null);
  const [err, setErr] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const fresh = await api.listAds();
      setAds(fresh);
    } catch (e) {
      console.error("Load ads failed:", e);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"] });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setMedia({ uri: a.uri, kind: "video", duration: (a.duration || 0) / 1000 });
    }
  };
  const pickImage = async () => {
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
    if (!user || !media) { setErr(t("err_fill_all")); return; }
    if (media.kind === "video" && media.duration > 120) { setErr("Ad video max 120s"); return; }
    const skipVal = Math.max(0, parseFloat(skipAfter) || 5);
    setUploading(true);
    try {
      let uploaderId = user.id;
      if (sellerEmail.trim()) {
        const found = await api.lookupUser(sellerEmail.trim());
        if (!found) {
          setErr("No user found with that email/phone");
          setUploading(false);
          return;
        }
        uploaderId = found.id;
      }
      const url = await uploadMedia({ uri: media.uri, base64: media.base64, kind: media.kind });
      await api.createAd({
        uploader_id: uploaderId,
        media_type: media.kind,
        media_url: url,
        duration_seconds: media.duration,
        title: title.trim(),
        skip_after_seconds: skipVal,
      });
      setMedia(null); setTitle(""); setSellerEmail(""); setSkipAfter("5");
      load();
    } catch (e: any) {
      setErr(e?.message || t("err_generic"));
    } finally {
      setUploading(false);
    }
  };

  const toggle = async (id: string) => {
    try { await api.toggleAd(id); load(); } catch (e) { console.error("Toggle ad failed:", e); }
  };

  const confirmDel = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.deleteAd(id);
      setAds((prev) => prev.filter((a) => a.id !== id)); // instant UI feedback
    } catch (e) {
      console.error("Delete ad failed:", e);
    }
    load(); // reconcile with backend either way
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{t("upload_ad")}</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <TouchableOpacity style={styles.smallBtn} onPress={pickVideo} testID="ad-pick-video">
          <Ionicons name="film" size={20} color={colors.white} />
          <Text style={styles.smallBtnTxt}>Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.secondary }]} onPress={pickImage} testID="ad-pick-image">
          <Ionicons name="image" size={20} color={colors.white} />
          <Text style={styles.smallBtnTxt}>Image</Text>
        </TouchableOpacity>
      </View>
      {media && (
        <View style={{ marginVertical: spacing.md }}>
          <Text style={{ fontSize: font.caption, color: colors.text_secondary }}>{media.kind.toUpperCase()} {media.duration ? `(${Math.round(media.duration)}s)` : ""}</Text>
        </View>
      )}
      <TextInput style={styles.input} placeholder="Seller email or phone (optional)" placeholderTextColor={colors.text_secondary} value={sellerEmail} onChangeText={setSellerEmail} testID="ad-seller-email-input" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Title (optional)" placeholderTextColor={colors.text_secondary} value={title} onChangeText={setTitle} testID="ad-title-input" />
      <Text style={styles.label}>Skip button appears after (seconds)</Text>
      <TextInput
        style={styles.input}
        placeholder="5"
        placeholderTextColor={colors.text_secondary}
        value={skipAfter}
        onChangeText={setSkipAfter}
        keyboardType="number-pad"
        testID="ad-skip-after-input"
      />
      {!!err && <Text style={styles.err}>{err}</Text>}
      <BigButton label={uploading ? "..." : t("upload_ad")} onPress={submit} disabled={uploading} testID="ad-upload-submit" />

      <Text style={styles.sectionTitle}>{t("manage_ads")}</Text>
      {ads.map((a) => (
        <View key={a.id} style={styles.row} testID={`ad-row-${a.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{a.title || a.media_type.toUpperCase()}</Text>
            <Text style={styles.rowSub}>{t("views")}: {a.views} • @{a.uploader_identifier || a.uploader_id.slice(0,6)} • skip after {a.skip_after_seconds ?? 5}s</Text>
            <Text style={[styles.rowSub, { color: a.active ? colors.success : colors.error, fontWeight: "700" }]}>
              {a.active ? t("active") : t("inactive")}
            </Text>
          </View>
          <TouchableOpacity onPress={() => toggle(a.id)} style={[styles.smallBtn, { backgroundColor: a.active ? colors.text : colors.success }]} testID={`ad-toggle-${a.id}`}>
            <Text style={styles.smallBtnTxt}>{a.active ? t("deactivate") : t("activate")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDeleteTarget(a.id)} style={styles.dangerBtn} testID={`ad-delete-${a.id}`}>
            <Ionicons name="trash" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      ))}
      <ConfirmModal
        visible={!!deleteTarget}
        message="Delete this ad permanently?"
        onConfirm={confirmDel}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScrollView>
  );
};

const SettingsPane: React.FC = () => {
  const { t } = useLang();
  const [val, setVal] = useState("5");
  useEffect(() => { api.getAdConfig().then((c) => setVal(String(c.screens_per_ad))); }, []);
  const save = async () => { try { await api.setAdConfig(parseInt(val) || 5); } catch {} };
  return (
    <View style={{ padding: spacing.md }}>
      <Text style={styles.label}>{t("ad_frequency")}</Text>
      <TextInput style={styles.input} value={val} onChangeText={setVal} keyboardType="number-pad" testID="ad-frequency-input" />
      <BigButton label={t("save")} onPress={save} testID="ad-frequency-save" />
    </View>
  );
};

const NotifyPane: React.FC = () => {
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState(""); // empty = all users
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    setStatus("");
    try {
      await api.sendNotification(message.trim(), target.trim() || null);
      setStatus(target.trim() ? `Sent to ${target.trim()}.` : "Sent to all users.");
      setMessage("");
      setTarget("");
    } catch (e: any) {
      setStatus(e?.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ padding: spacing.md }}>
      <Text style={styles.sectionTitle}>Send Notification</Text>
      <Text style={styles.label}>Message</Text>
      <TextInput
        style={styles.textarea}
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder="Type your announcement..."
        placeholderTextColor={colors.text_secondary}
        testID="notify-message-input"
      />
      <Text style={styles.label}>Send to (leave empty for all users)</Text>
      <TextInput
        style={styles.input}
        value={target}
        onChangeText={setTarget}
        placeholder="specific email or phone, or leave blank"
        placeholderTextColor={colors.text_secondary}
        autoCapitalize="none"
        testID="notify-target-input"
      />
      {!!status && <Text style={{ color: colors.text_secondary, marginBottom: spacing.sm }}>{status}</Text>}
      <BigButton label={sending ? "..." : "Send"} onPress={send} disabled={sending} testID="notify-send-button" />
      <Text style={{ fontSize: font.caption, color: colors.text_secondary, marginTop: spacing.md }}>
        Note: this sends an in-app notification (bell icon) to logged-in users. Sending real emails
        requires a separate email service to be connected — ask if you'd like that set up too.
      </Text>
    </View>
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
  tabsRow: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  tabBtn: {
    minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.button,
    borderWidth: 2, borderColor: colors.primary, justifyContent: "center",
    backgroundColor: colors.white, flexShrink: 0,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabTxt: { fontSize: font.caption, fontWeight: "700", color: colors.primary },
  tabTxtActive: { color: colors.white },
  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, padding: spacing.md, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sectionTitle: { fontSize: font.h2, fontWeight: "800", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  label: { fontSize: font.body, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    minHeight: tap.min, borderWidth: 2, borderColor: colors.border, borderRadius: radius.input,
    paddingHorizontal: spacing.md, fontSize: font.body, color: colors.text,
    marginVertical: spacing.sm, backgroundColor: colors.white,
  },
  chipSm: {
    minHeight: 36, paddingHorizontal: spacing.md,
    borderRadius: radius.button, borderWidth: 2, borderColor: colors.border,
    justifyContent: "center", backgroundColor: colors.white, flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxtSm: { fontSize: font.caption, fontWeight: "700", color: colors.text },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.card,
    marginBottom: spacing.sm,
  },
  rowTitle: { fontSize: font.body, fontWeight: "700", color: colors.text },
  rowSub: { fontSize: font.caption, color: colors.text_secondary },
  smallBtn: {
    minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.button,
    backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
  },
  smallBtnTxt: { color: colors.white, fontWeight: "700", fontSize: font.caption },
  dangerBtn: {
    minWidth: 44, minHeight: 44, borderRadius: radius.button,
    backgroundColor: colors.error, justifyContent: "center", alignItems: "center",
  },
  err: { color: colors.error, fontSize: font.body, marginVertical: spacing.sm, fontWeight: "600" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  closeBtn: { minWidth: tap.min, minHeight: tap.min, justifyContent: "center", alignItems: "center" },
  textarea: {
    minHeight: 120, borderWidth: 2, borderColor: colors.border, borderRadius: radius.input,
    padding: spacing.md, fontSize: font.body, color: colors.text, textAlignVertical: "top",
    backgroundColor: colors.white, marginVertical: spacing.sm,
  },
});
