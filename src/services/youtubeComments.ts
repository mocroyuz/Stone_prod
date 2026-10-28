// src/services/youtubeComments.ts

import { API_BASE_URL } from "./supabase";

const ACCESS_KEY = "crossflow_access_token";
const REFRESH_KEY = "crossflow_refresh_token";

/* ───────── Types ───────── */

export type YouTubeVideo = {
  id: string;
  title: string;
  thumbnail: string | null;
  published_at: string | null;
  comment_count: number;
};

export type YouTubeComment = {
  id: string;
  video_id: string | null;
  text: string;
  author_name: string;
  author_avatar: string | null;
  published_at: string | null;
  like_count: number;
  reply_count: number;
  answered: boolean;
  can_reply: boolean;
};

/* ───────── Client HTTP ───────── */

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

async function request(path: string, token: string): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiGet<T>(path: string): Promise<T> {
  let { access } = readSession();
  if (!access) throw new Error("Non connecté : aucun token trouvé (vérifie ACCESS_KEY).");

  let res = await request(path, access);

  // Token expiré → refresh puis une seule nouvelle tentative
  if (res.status === 401) {
    access = await refreshAccessToken();
    res = await request(path, access);
  }

  const data = await parseJson(res);

  if (!res.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

/* ───────── API ───────── */

export async function fetchYouTubeVideos(pageToken?: string) {
  const data = await apiGet<{ videos: YouTubeVideo[]; next_page_token: string | null }>(
    `/api/youtube/videos${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ""}`
  );

  if (!Array.isArray(data.videos)) {
    throw new Error(`Format inattendu : ${JSON.stringify(data).slice(0, 120)}`);
  }
  return data;
}

export async function fetchYouTubeComments(opts: {
  filter: "all" | "unanswered" | "answered";
  videoId?: string | null;
  pageToken?: string | null;
}) {
  const q = new URLSearchParams({ filter: opts.filter });
  if (opts.videoId) q.set("videoId", opts.videoId);
  if (opts.pageToken) q.set("pageToken", opts.pageToken);

  const data = await apiGet<{
    comments: YouTubeComment[];
    next_page_token: string | null;
  }>(`/api/youtube/comments?${q.toString()}`);

  if (!Array.isArray(data.comments)) {
    throw new Error(`Format inattendu : ${JSON.stringify(data).slice(0, 120)}`);
  }
  return data;
}