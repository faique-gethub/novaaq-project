// Thin fetch wrapper around Novaaq FastAPI backend.
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : ({} as any);
  if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
  return data as T;
}

export type Role = "admin" | "seller" | "customer";

export type User = {
  id: string;
  identifier: string;
  role: Role;
  verified: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name_en: string;
  name_ur: string;
  max_video_seconds: number;
  parent_id: string | null;
};

export type Post = {
  id: string;
  seller_id: string;
  seller_identifier?: string;
  category_id: string;
  media_type: "video" | "image";
  media_url: string;
  description: string;
  duration_seconds: number;
  pinned: boolean;
  pinned_at?: string | null;
  likes: string[];
  created_at: string;
};

export type Ad = {
  id: string;
  uploader_id: string;
  uploader_identifier?: string;
  media_type: "video" | "image";
  media_url: string;
  duration_seconds: number;
  title: string;
  active: boolean;
  views: number;
  created_at: string;
  skip_after_seconds: number;
};

export const api = {
  // auth
  signup: (identifier: string, password: string, role: Role) =>
    request<{ user_id: string; verification_code: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ identifier, password, role }),
    }),
  verify: (user_id: string, code: string) =>
    request<User>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ user_id, code }),
    }),
  login: (identifier: string, password: string) =>
    request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  firebaseLogin: (id_token: string, role?: Role) =>
    request<User>("/auth/firebase-login", {
      method: "POST",
      body: JSON.stringify({ id_token, role }),
    }),
  firebasePhoneLogin: (id_token: string, role: Role) =>
    request<User>("/auth/firebase-phone-login", {
      method: "POST",
      body: JSON.stringify({ id_token, role }),
    }),
  getUser: (id: string) => request<User>(`/auth/user/${id}`),

  // categories
  listCategories: () => request<Category[]>("/categories"),
  createCategory: (data: Omit<Category, "id">) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: string, data: Omit<Category, "id">) =>
    request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/categories/${id}`, { method: "DELETE" }),

  // posts
  listPosts: (params: { category_id?: string; seller_id?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.category_id) q.set("category_id", params.category_id);
    if (params.seller_id) q.set("seller_id", params.seller_id);
    return request<Post[]>(`/posts${q.toString() ? "?" + q.toString() : ""}`);
  },
  createPost: (data: {
    seller_id: string;
    category_id: string;
    media_type: "video" | "image";
    media_url: string;
    description: string;
    duration_seconds?: number;
  }) => request<Post>("/posts", { method: "POST", body: JSON.stringify(data) }),
  updatePost: (id: string, data: { description?: string; pinned?: boolean }) =>
    request<Post>(`/posts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePost: (id: string) => request<{ ok: boolean }>(`/posts/${id}`, { method: "DELETE" }),
  likePost: (id: string, user_id: string) =>
    request<{ likes: number; liked: boolean }>(`/posts/${id}/like`, {
      method: "POST",
      body: JSON.stringify({ user_id }),
    }),

  // ads
  listAds: (params: { active_only?: boolean; uploader_id?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.active_only) q.set("active_only", "true");
    if (params.uploader_id) q.set("uploader_id", params.uploader_id);
    return request<Ad[]>(`/ads${q.toString() ? "?" + q.toString() : ""}`);
  },
  lookupUser: (identifier: string) =>
    request<{ id: string; identifier: string; role: string }>(
      `/users/lookup?identifier=${encodeURIComponent(identifier)}`
    ).catch(() => null),
  createAd: (data: {
    uploader_id: string;
    media_type: "video" | "image";
    media_url: string;
    duration_seconds?: number;
    title?: string;
    skip_after_seconds?: number;
  }) => request<Ad>("/ads", { method: "POST", body: JSON.stringify(data) }),
  toggleAd: (id: string) =>
    request<{ ok: boolean; active: boolean }>(`/ads/${id}/toggle`, { method: "PUT" }),
  deleteAd: (id: string) => request<{ ok: boolean }>(`/ads/${id}`, { method: "DELETE" }),
  viewAd: (id: string) => request<{ ok: boolean }>(`/ads/${id}/view`, { method: "POST" }),
  getAdConfig: () => request<{ screens_per_ad: number }>("/ad-config"),
  setAdConfig: (n: number) =>
    request<{ screens_per_ad: number }>("/ad-config", {
      method: "PUT",
      body: JSON.stringify({ screens_per_ad: n }),
    }),
};
