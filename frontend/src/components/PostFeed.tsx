import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, RefreshControl, Modal, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { api, Category, Post, User } from "@/src/services/api";
import { colors, font, radius, spacing, tap } from "@/src/theme";
import { useLang } from "@/src/i18n/context";
import { useAds } from "@/src/ads/context";
import { AdOverlay } from "@/src/ads/AdOverlay";

type Props = {
  user: User | null;
  onAdminAction?: (post: Post) => void;
  onSellerAction?: (post: Post) => void;
};

const screenWidth = Dimensions.get("window").width;
const CARD_MAX_WIDTH = 420;
const cardWidth = Math.min(screenWidth - spacing.md * 2, CARD_MAX_WIDTH);

export const PostFeed: React.FC<Props> = ({ user, onAdminAction }) => {
  const { lang, t } = useLang();
  const { maybeShow } = useAds();
  const [cats, setCats] = useState<Category[]>([]);
  const [selectedMain, setSelectedMain] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [ad, setAd] = useState<any>(null);
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);

  const load = useCallback(async () => {
    const list = await api.listCategories();
    setCats(list);
    if (!selectedMain) {
      const firstMain = list.find((c) => !c.parent_id);
      if (firstMain) setSelectedMain(firstMain.id);
    }
  }, [selectedMain]);

  useEffect(() => {
    load();
  }, [load]);

  const mains = cats.filter((c) => !c.parent_id);
  const subs = cats.filter((c) => c.parent_id === selectedMain);
  const currentCatId = selectedSub || selectedMain;

  const loadPosts = useCallback(async () => {
    if (!currentCatId) return;
    setRefreshing(true);
    try {
      const list = await api.listPosts({ category_id: currentCatId });
      setPosts(list);
      const a = await maybeShow();
      if (a) setAd(a);
    } finally {
      setRefreshing(false);
    }
  }, [currentCatId, maybeShow]);

  useEffect(() => {
    setSelectedSub(null);
  }, [selectedMain]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const toggleLike = async (p: Post) => {
    if (!user) return;
    const res = await api.likePost(p.id, user.id);
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, likes: res.liked ? [...x.likes, user.id] : x.likes.filter((u) => u !== user.id) }
          : x,
      ),
    );
    if (expandedPost && expandedPost.id === p.id) {
      setExpandedPost((prev) =>
        prev
          ? { ...prev, likes: res.liked ? [...prev.likes, user.id] : prev.likes.filter((u) => u !== user.id) }
          : prev,
      );
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={{ maxHeight: 64 }}
        testID="main-category-chips"
      >
        {mains.map((c) => {
          const active = c.id === selectedMain;
          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => setSelectedMain(c.id)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`main-cat-${c.id}`}
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                {lang === "ur" ? c.name_ur : c.name_en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {subs.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ maxHeight: 56 }}
          testID="sub-category-chips"
        >
          <TouchableOpacity
            onPress={() => setSelectedSub(null)}
            style={[styles.chipSm, !selectedSub && styles.chipActive]}
            testID="sub-cat-all"
          >
            <Text style={[styles.chipTxtSm, !selectedSub && styles.chipTxtActive]}>All</Text>
          </TouchableOpacity>
          {subs.map((c) => {
            const active = c.id === selectedSub;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setSelectedSub(c.id)}
                style={[styles.chipSm, active && styles.chipActive]}
                testID={`sub-cat-${c.id}`}
              >
                <Text style={[styles.chipTxtSm, active && styles.chipTxtActive]}>
                  {lang === "ur" ? c.name_ur : c.name_en}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadPosts} />}
        testID="post-feed-scroll"
      >
        {posts.length === 0 && (
          <Text style={styles.empty} testID="empty-feed">{t("no_posts")}</Text>
        )}
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            liked={!!user && p.likes.includes(user.id)}
            onToggleLike={() => toggleLike(p)}
            onAdminAction={onAdminAction ? () => onAdminAction(p) : undefined}
            pinnedLabel={t("pinned")}
            onPress={() => setExpandedPost(p)}
          />
        ))}
      </ScrollView>

      <AdOverlay ad={ad} onClose={() => setAd(null)} />

      <Modal
        visible={!!expandedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedPost(null)}
      >
        {expandedPost && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setExpandedPost(null)}
              testID="close-expanded-post"
            >
              <Ionicons name="close" size={28} color={colors.white} />
            </TouchableOpacity>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalMediaWrap}>
                <ExpandedMedia post={expandedPost} />
              </View>
              <View style={styles.modalFooter}>
                <Text style={styles.modalDesc}>{expandedPost.description}</Text>

                <TouchableOpacity
                  style={styles.likeBtn}
                  onPress={() => toggleLike(expandedPost)}
                  testID="like-button-expanded"
                >
                  <Ionicons
                    name={!!user && expandedPost.likes.includes(user.id) ? "heart" : "heart-outline"}
                    size={28}
                    color={!!user && expandedPost.likes.includes(user.id) ? colors.error : colors.text}
                  />
                  <Text style={styles.likeCount}>{expandedPost.likes.length}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
};

const ExpandedMedia: React.FC<{ post: Post }> = ({ post }) => {
  const [rotation, setRotation] = useState(0);
  const player = useVideoPlayer(post.media_type === "video" ? post.media_url : null, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  return (
    <View style={{ alignItems: "center" }}>
      {post.media_type === "video" ? (
        <View style={[{ width: screenWidth, height: screenWidth * 1.1, maxHeight: 600 }, { transform: [{ rotate: `${rotation}deg` }] }]}>
          <VideoView style={{ width: "100%", height: "100%" }} player={player} contentFit="contain" nativeControls />
        </View>
      ) : (
        <Image source={{ uri: post.media_url }} style={[styles.modalMedia, { transform: [{ rotate: `${rotation}deg` }] }]} contentFit="contain" />
      )}
      <TouchableOpacity
        style={styles.rotateBtnLarge}
        onPress={() => setRotation((r) => (r + 90) % 360)}
        testID="rotate-btn-expanded"
      >
        <Ionicons name="reload" size={22} color={colors.white} />
        <Text style={{ color: colors.white, fontWeight: "700", marginLeft: 6 }}>Rotate</Text>
      </TouchableOpacity>
    </View>
  );
};

const PostCard: React.FC<{
  post: Post;
  liked: boolean;
  onToggleLike: () => void;
  onAdminAction?: () => void;
  pinnedLabel: string;
  onPress: () => void;
}> = ({ post, liked, onToggleLike, onAdminAction, pinnedLabel, onPress }) => {
  const [rotation, setRotation] = useState(0);
  const player = useVideoPlayer(post.media_type === "video" ? post.media_url : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
      testID={`post-card-${post.id}`}
    >
      {post.pinned && (
        <View style={styles.pinBadge}>
          <Ionicons name="star" size={16} color={colors.white} />
          <Text style={styles.pinBadgeTxt}>{pinnedLabel}</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.rotateBtn}
        onPress={(e) => { e.stopPropagation?.(); setRotation((r) => (r + 90) % 360); }}
        testID={`rotate-btn-${post.id}`}
      >
        <Ionicons name="reload" size={18} color={colors.white} />
      </TouchableOpacity>
      <View style={styles.mediaWrap}>
        {post.media_type === "video" ? (
          <View style={[{ width: "100%", height: "100%" }, { transform: [{ rotate: `${rotation}deg` }] }]}>
            <VideoView
              style={styles.media}
              player={player}
              contentFit="cover"
              nativeControls={false}
            />
          </View>
        ) : (
          <Image source={{ uri: post.media_url }} style={[styles.media, { transform: [{ rotate: `${rotation}deg` }] }]} contentFit="cover" />
        )}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.desc} numberOfLines={2}>{post.description}</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.likeBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleLike();
            }}
            testID={`like-button-${post.id}`}
          >
            <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? colors.error : colors.text} />
            <Text style={styles.likeCount}>{post.likes.length}</Text>
          </TouchableOpacity>
          {onAdminAction && (
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onAdminAction();
              }}
              testID={`admin-actions-${post.id}`}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  chipRow: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  chip: {
    minHeight: 44, paddingHorizontal: spacing.md,
    borderRadius: radius.button, borderWidth: 2, borderColor: colors.primary,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
    backgroundColor: colors.white,
  },
  chipSm: {
    minHeight: 36, paddingHorizontal: spacing.md,
    borderRadius: radius.button, borderWidth: 2, borderColor: colors.border,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: font.body, fontWeight: "700", color: colors.primary },
  chipTxtSm: { fontSize: font.caption, fontWeight: "700", color: colors.text },
  chipTxtActive: { color: colors.white },
  empty: { textAlign: "center", color: colors.text_secondary, fontSize: font.body, marginTop: spacing.xl },
  feedContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: "center",
  },
  card: {
    width: cardWidth,
    backgroundColor: colors.surface,
    borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, overflow: "hidden",
  },
  pinBadge: {
    position: "absolute", top: spacing.sm, left: spacing.sm, zIndex: 5,
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.button, flexDirection: "row", alignItems: "center", gap: 4,
  },
  pinBadgeTxt: { color: colors.white, fontWeight: "800", fontSize: 14 },
  mediaWrap: { width: "100%", aspectRatio: 3 / 4, backgroundColor: colors.black },
  media: { width: "100%", height: "100%" },
  cardFooter: { padding: spacing.md },
  desc: { fontSize: font.body, color: colors.text, marginBottom: spacing.sm },
  sellerTxt: { fontSize: font.caption, color: colors.text_secondary, marginBottom: spacing.sm },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, justifyContent: "space-between" },
  likeBtn: {
    minHeight: tap.min, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  likeCount: { fontSize: font.button, fontWeight: "700", color: colors.text },
  adminBtn: {
    minWidth: tap.min, minHeight: tap.min, borderRadius: radius.button,
    backgroundColor: colors.text, justifyContent: "center", alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  modalCloseBtn: {
    position: "absolute", top: spacing.xl, right: spacing.md, zIndex: 10,
    minWidth: tap.min, minHeight: tap.min,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.button,
    justifyContent: "center", alignItems: "center",
  },
  modalScroll: { flexGrow: 1, justifyContent: "center", paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  modalMediaWrap: { width: "100%", alignItems: "center" },
  modalMedia: { width: screenWidth, height: screenWidth * 1.1, maxHeight: 600 },
  modalFooter: { padding: spacing.lg },
  modalDesc: { fontSize: font.body, color: colors.white, marginBottom: spacing.md, lineHeight: 22 },
  rotateBtn: {
    position: "absolute", top: spacing.sm, right: spacing.sm, zIndex: 5,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center",
  },
  rotateBtnLarge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.button, marginTop: spacing.sm,
    minHeight: tap.min,
  },
});
