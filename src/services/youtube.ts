// src/services/youtube.ts
// Service YouTube unifié : connexion, publication, commentaires (Community)
// et statistiques / vidéos (Insights).

import { useEffect, useState } from "react";
import { API_BASE_URL, apiRequest } from "./supabase";

/* ═════════════════════════════════════════════════════════════
   1. CLIENT HTTP JSON (avec refresh automatique du token)
   Utilisé par les commentaires, les vidéos et les insights.
═════════════════════════════════════════════════════════════ */

const ACCESS_KEY = "crossflow_access_token";
const REFRESH_KEY = "crossflow_refresh_token";
const BASE_URL = API_BASE_URL;

function readSession() {
  return {
    access: localStorage.getItem(ACCESS_KEY) ?? "",
    refresh: localStorage.getItem(REFRESH_KEY) ?? "",
  };
}

async function parseJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Réponse non-JSON de ${res.url} (HTTP ${res.status}) : ${text.slice(0, 80)}`
    );
  }
}

// Un seul refresh à la fois, même si plusieurs requêtes échouent en parallèle
let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const { refresh } = readSession();
    if (!refresh) throw new Error("Session expirée, reconnecte-toi.");

    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    const data = await parseJson(res);

    if (!res.ok || !data.session?.access_token) {
      throw new Error("Session expirée, reconnecte-toi.");
    }

    localStorage.setItem(ACCESS_KEY, data.session.access_token);
    if (data.session.refresh_token) {
      localStorage.setItem(REFRESH_KEY, data.session.refresh_token);
    }
    return data.session.access_token as string;
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

type CallInit = { method?: "GET" | "POST"; body?: unknown };

function send(path: string, token: string, init: CallInit): Promise<Response> {
  const hasBody = init.body !== undefined;

  return fetch(`${BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
}

async function apiCall<T>(path: string, init: CallInit = {}): Promise<T> {
  let { access } = readSession();
  if (!access) throw new Error("Non connecté : aucun token trouvé (vérifie ACCESS_KEY).");

  let res = await send(path, access, init);

  // Token expiré → refresh puis une seule nouvelle tentative
  if (res.status === 401) {
    access = await refreshAccessToken();
    res = await send(path, access, init);
  }

  const data = await parseJson(res);

  if (!res.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

/* ═════════════════════════════════════════════════════════════
   2. CONNEXION
═════════════════════════════════════════════════════════════ */

export interface YouTubeAccount {
  display_name: string | null; // titre de la chaîne
  avatar_url: string | null;
  custom_url?: string | null; // ex. "@machaine"
  scope?: string | null;
}

export async function getYouTubeStatus(): Promise<{
  connected: boolean;
  account: YouTubeAccount | null;
}> {
  return apiRequest("/api/youtube/status", { method: "GET" });
}

/**
 * Demande l'URL d'autorisation au backend (POST /api/youtube/auth/url),
 * vérifie qu'elle pointe bien vers accounts.google.com, puis redirige
 * le navigateur.
 *
 * Si tout va bien, la page quitte l'application : la promesse ne sert
 * qu'à remonter les erreurs (réseau, 401, URL manquante...).
 */
export async function startYouTubeLogin(): Promise<void> {
  console.log("[Stone] YouTube Shorts : demande de l'URL d'autorisation");

  const data = await apiRequest<{ url?: string }>("/api/youtube/auth/url", {
    method: "POST",
  });

  console.log("[Stone] YouTube Shorts : réponse du backend", data);

  if (!data || typeof data.url !== "string" || !data.url) {
    throw new Error(
      `Le backend n'a pas renvoyé d'URL YouTube Shorts (réponse : ${JSON.stringify(data)})`
    );
  }

  let target: URL;

  try {
    target = new URL(data.url);
  } catch {
    throw new Error(`URL YouTube Shorts invalide : ${data.url}`);
  }

  if (target.protocol !== "https:" || target.hostname !== "accounts.google.com") {
    throw new Error(`URL inattendue (hôte ${target.hostname}).`);
  }

  console.log("[Stone] YouTube Shorts : redirection vers", target.toString());

  window.location.assign(target.toString());
}

/**
 * Appelé par la page /youtube/callback avec les paramètres de l'URL.
 * Envoie le `code` et le `state` au backend, qui échange le code
 * contre des tokens auprès de Google.
 */
export async function completeYouTubeLogin(
  code: string,
  state: string
): Promise<YouTubeAccount | null> {
  const data = await apiRequest<{
    connected?: boolean;
    account?: YouTubeAccount | null;
  }>("/api/youtube/auth/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });

  return data?.account ?? null;
}

export async function disconnectYouTube(): Promise<void> {
  await apiRequest("/api/youtube/disconnect", { method: "DELETE" });
}

/* ═════════════════════════════════════════════════════════════
   3. PUBLICATION
═════════════════════════════════════════════════════════════ */

export type YouTubeVisibilityLevel = "public" | "unlisted" | "private";

export interface YouTubePublishParams {
  video: File;
  title: string;
  description: string;
  categoryId: string;
  visibility: YouTubeVisibilityLevel;
  madeForKids: boolean;
  tags?: string[];
  /** Date ISO de publication programmée (la vidéo est alors envoyée en privé). */
  publishAt?: string | null;
}

export interface YouTubePublishResult {
  success?: boolean;
  video_id: string;
  url: string;
  privacy_status: string | null;
  requested_privacy: string;
  publish_at: string | null;
  upload_status: string | null;
  /**
   * true si la vidéo a été demandée publique/non répertoriée mais que
   * YouTube l'a forcée en privé (projet API non audité).
   */
  privacy_locked: boolean;
}

/**
 * Envoie une vidéo vers POST /api/youtube/publish.
 * YouTube classe automatiquement la vidéo en Short si elle est verticale
 * (ou carrée) et dure moins de 3 minutes.
 */
export async function publishToYouTube(
  params: YouTubePublishParams
): Promise<YouTubePublishResult> {
  const form = new FormData();
  form.append("title", params.title);
  form.append("description", params.description);
  form.append("category_id", params.categoryId);
  form.append("privacy_level", params.visibility);
  form.append("made_for_kids", String(params.madeForKids)); // obligatoire côté backend
  if (params.tags && params.tags.length > 0) {
    form.append("tags", JSON.stringify(params.tags));
  }
  if (params.publishAt) form.append("publish_at", params.publishAt);
  form.append("video", params.video);

  return apiRequest<YouTubePublishResult>("/api/youtube/publish", {
    method: "POST",
    body: form,
  });
}

/* ═════════════════════════════════════════════════════════════
   4. VIDÉOS & COMMENTAIRES (page Community)
═════════════════════════════════════════════════════════════ */

export type YouTubeFilter = "all" | "unanswered" | "answered" | "unread";

export type YouTubeVideo = {
  id: string;
  title: string;
  thumbnail: string | null;
  published_at: string | null;
  comment_count: number;
  /** Statut backend ("scheduled" | "published" | …). Absent = inconnu. */
  status?: string;
};

export type YouTubeReply = {
  id: string;
  text: string;
  author_name: string;
  author_avatar: string | null;
  published_at: string | null;
  is_own: boolean;
};

export type YouTubeComment = {
  id: string;
  video_id: string | null;
  text: string;
  author_name: string;
  author_avatar: string | null;
  author_channel_id?: string | null;
  is_own: boolean;
  is_read: boolean;
  published_at: string | null;
  like_count: number;
  reply_count: number;
  answered: boolean;
  can_reply: boolean;
  replies: YouTubeReply[];
};

export async function fetchYouTubeVideos(pageToken?: string) {
  const data = await apiCall<{ videos: YouTubeVideo[]; next_page_token: string | null }>(
    `/api/youtube/videos${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ""}`
  );

  if (!Array.isArray(data.videos)) {
    throw new Error(`Format inattendu : ${JSON.stringify(data).slice(0, 120)}`);
  }
  return data;
}

export async function fetchYouTubeComments(opts: {
  filter: YouTubeFilter;
  videoId?: string | null;
  pageToken?: string | null;
}) {
  const q = new URLSearchParams({ filter: opts.filter });
  if (opts.videoId) q.set("videoId", opts.videoId);
  if (opts.pageToken) q.set("pageToken", opts.pageToken);

  const data = await apiCall<{
    comments: YouTubeComment[];
    next_page_token: string | null;
  }>(`/api/youtube/comments?${q.toString()}`);

  if (!Array.isArray(data.comments)) {
    throw new Error(`Format inattendu : ${JSON.stringify(data).slice(0, 120)}`);
  }
  return data;
}

/** Répond à un commentaire (parentId = id du fil de discussion). */
export async function replyToYouTubeComment(parentId: string, text: string) {
  const data = await apiCall<{ reply: YouTubeReply }>(`/api/youtube/comments/reply`, {
    method: "POST",
    body: { parentId, text },
  });

  if (!data.reply?.id) {
    throw new Error(`Format inattendu : ${JSON.stringify(data).slice(0, 120)}`);
  }
  return data.reply;
}

/** Marque des commentaires comme lus (read = true) ou non lus (read = false). */
export async function setYouTubeCommentsRead(ids: string[], read: boolean) {
  // Le serveur accepte 200 ids max par appel
  for (let i = 0; i < ids.length; i += 200) {
    await apiCall<{ success: true }>(`/api/youtube/comments/read`, {
      method: "POST",
      body: { ids: ids.slice(i, i + 200), read },
    });
  }
}

/* ═════════════════════════════════════════════════════════════
   5. INSIGHTS (page Insights)
   GET /api/youtube/insights?start=YYYY-MM-DD&end=YYYY-MM-DD
═════════════════════════════════════════════════════════════ */

export interface YouTubeInsightsDay {
  date: string; // "YYYY-MM-DD"
  views: number;
  likes: number;
  comments: number;
  shares: number;
  subscribers_gained: number;
  subscribers_lost: number;
  watch_minutes: number;
}

export interface YouTubeInsightsVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  published_at: string;
  is_short?: boolean;
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  /** Statut backend ("scheduled" | "published" | …). */
  status?: string;
  /** Date de publication programmée (YouTube status.publishAt). */
  publish_at?: string | null;
}

export interface YouTubeInsightsResponse {
  /** Nombre d'abonnés à la fin de la période. */
  subscribers: number;
  /** Impressions (portée). Optionnel : 0 si absent. */
  impressions?: number;
  days: YouTubeInsightsDay[];
  videos: YouTubeInsightsVideo[];
}

export async function fetchYouTubeInsights(
  start: string,
  end: string
): Promise<YouTubeInsightsResponse> {
  const data = await apiCall<YouTubeInsightsResponse>(
    `/api/youtube/insights?start=${start}&end=${end}`
  );

  if (!Array.isArray(data.days) || !Array.isArray(data.videos)) {
    throw new Error(`Format inattendu : ${JSON.stringify(data).slice(0, 120)}`);
  }
  return data;
}

/* ───────── Types alignés sur Insights.tsx ───────── */

export type InsightsPoint = {
  date: Date;
  posts: number;
  reactions: number;
  comments: number;
  followers: number;
  profileViews: number;
};

export type InsightsSummary = {
  followers: number;
  posts: number;
  reactions: number;
  comments: number;
  engRate: number;
  videoViews: number;
  shares: number;
  reach: number;
  watchMin: number;
  avgWatchSec: number;
};

export type InsightsPostRow = {
  id: string;
  label: string;
  date: Date;
  media: "image" | "video" | "text";
  thumbnailUrl?: string;
  reactions: number;
  comments: number;
  engRate: number;
  videoViews: number;
  /** Statut backend. Absent = inconnu (compat ancien backend). */
  status?: string;
  /** Date de publication programmée si exposée par le backend. */
  publishAt?: string | null;
};

export type YouTubeInsightsData = {
  current: InsightsPoint[];
  previous: InsightsPoint[];
  summary: InsightsSummary;
  posts: InsightsPostRow[];
  previousPosts: InsightsPostRow[];
};

/* ───────── Mapping ───────── */

const DAY_MS = 86_400_000;

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const thumbnailFor = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

const rate = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 10_000) / 100 : 0;

/* ───────── Filtre « en ligne uniquement » ─────────
   Exclut les vidéos programmées AVANT même qu'elles n'arrivent
   dans Insights.tsx. Deux critères indépendants :
     - status explicite "scheduled"/"pending"/… (fiable, backend patché)
     - publish_at dans le futur (fallback si status absent) */

const SCHEDULED_STATUSES = new Set([
  "scheduled",
  "pending",
  "draft",
  "queued",
  "future",
  "unpublished",
  "processing",
]);

function isOnlineVideo(v: YouTubeInsightsVideo): boolean {
  const status = String((v as { status?: unknown }).status ?? "")
    .trim()
    .toLowerCase();
  if (SCHEDULED_STATUSES.has(status)) return false;

  const raw =
    (v as { publish_at?: unknown }).publish_at ??
    (v as { publishAt?: unknown }).publishAt;
  if (raw) {
    const ms =
      typeof raw === "string"
        ? Date.parse(raw)
        : raw instanceof Date
        ? raw.getTime()
        : NaN;
    if (Number.isFinite(ms) && ms > Date.now()) return false;
  }

  return true;
}

/* ───────── Constructeurs ───────── */

function buildPoints(
  from: Date,
  days: number,
  res: YouTubeInsightsResponse
): InsightsPoint[] {
  const byDay = new Map(res.days.map((d) => [d.date.slice(0, 10), d]));
  const videosByDay = new Map<string, number>();
  for (const v of res.videos) {
    if (!isOnlineVideo(v)) continue; // on ne compte que les vidéos en ligne
    const k = dayKey(new Date(v.published_at));
    videosByDay.set(k, (videosByDay.get(k) ?? 0) + 1);
  }

  // Abonnés : on part du total final et on remonte avec le net quotidien.
  const net = Array.from({ length: days }, (_, i) => {
    const d = byDay.get(dayKey(addDays(from, i)));
    return d ? d.subscribers_gained - d.subscribers_lost : 0;
  });
  const followers = new Array<number>(days).fill(0);
  let running = res.subscribers ?? 0;
  for (let i = days - 1; i >= 0; i--) {
    followers[i] = Math.max(0, running);
    running -= net[i];
  }

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const k = dayKey(date);
    const d = byDay.get(k);
    return {
      date,
      posts: videosByDay.get(k) ?? 0,
      reactions: d?.likes ?? 0,
      comments: d?.comments ?? 0,
      followers: followers[i],
      profileViews: d?.views ?? 0, // vues de la chaîne
    };
  });
}

function buildPosts(res: YouTubeInsightsResponse): InsightsPostRow[] {
  return [...res.videos]
    .filter(isOnlineVideo) // ← on retire les scheduled avant le rendu
    .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at))
    .map((v) => ({
      id: v.id,
      label: v.title,
      date: new Date(v.published_at),
      media: "video" as const,
      thumbnailUrl: v.thumbnail ?? thumbnailFor(v.id),
      reactions: v.likes,
      comments: v.comments,
      engRate: rate(v.likes + v.comments + (v.shares ?? 0), v.views),
      videoViews: v.views,
      status: v.status,
      publishAt: v.publish_at ?? null,
    }));
}

function buildSummary(
  res: YouTubeInsightsResponse,
  points: InsightsPoint[],
  postCount: number
): InsightsSummary {
  const sum = (f: (d: YouTubeInsightsDay) => number) =>
    res.days.reduce((a, d) => a + f(d), 0);

  const views = sum((d) => d.views);
  const likes = sum((d) => d.likes);
  const comments = sum((d) => d.comments);
  const shares = sum((d) => d.shares);
  const watchMin = Math.round(sum((d) => d.watch_minutes));

  return {
    followers: points[points.length - 1]?.followers ?? res.subscribers ?? 0,
    posts: postCount,
    reactions: likes,
    comments,
    engRate: rate(likes + comments + shares, views),
    videoViews: views,
    shares,
    reach: res.impressions ?? 0,
    watchMin,
    avgWatchSec: views > 0 ? Math.round((watchMin * 60) / views) : 0,
  };
}

/* ───────── Cache module (survit aux navigations SPA) ───────── */

const INSIGHTS_FRESH_MS = 2 * 60_000;
const insightsCache = new Map<string, { data: YouTubeInsightsData; at: number }>();

/* ───────── Hook ───────── */

export function useYouTubeInsights(
  start: Date,
  end: Date,
  enabled: boolean,
  reloadKey = 0
): { data: YouTubeInsightsData | null; loading: boolean; error: string | null } {
  const s = start.getTime();
  const e = end.getTime();
  const key = `${s}|${e}`;

  const [data, setData] = useState<YouTubeInsightsData | null>(() =>
    enabled ? insightsCache.get(key)?.data ?? null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = insightsCache.get(key);
    setData(cached?.data ?? null);

    if (cached && Date.now() - cached.at < INSIGHTS_FRESH_MS && reloadKey === 0) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(!cached);
    setError(null);

    const from = new Date(s);
    const to = new Date(e);
    const days = Math.round((e - s) / DAY_MS) + 1;
    const prevFrom = addDays(from, -days);
    const prevTo = addDays(from, -1);

    Promise.all([
      fetchYouTubeInsights(dayKey(from), dayKey(to)),
      fetchYouTubeInsights(dayKey(prevFrom), dayKey(prevTo)),
    ])
      .then(([cur, prev]) => {
        if (cancelled) return;
        const current = buildPoints(from, days, cur);
        const previous = buildPoints(prevFrom, days, prev);
        const posts = buildPosts(cur);
        const next: YouTubeInsightsData = {
          current,
          previous,
          summary: buildSummary(cur, current, posts.length),
          posts,
          previousPosts: buildPosts(prev),
        };
        insightsCache.set(key, { data: next, at: Date.now() });
        setData(next);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (!cached) {
          setData(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, key, s, e, reloadKey]);

  return { data, loading, error };
}