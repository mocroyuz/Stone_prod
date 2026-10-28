// src/services/youtubeComments.ts

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

/* ──────────────────────────────────────────────────────────
 *  apiGet — robuste aux réponses non-JSON (fallback SPA,
 *  502 HTML, proxy mal configuré, etc.)
 *  ⚠️ Remplace-le par ton helper existant si tu en as un,
 *  mais conserve la validation JSON + success === false.
 *
 *  ⚠️  Plus de VITE_API_BASE_URL côté frontend :
 *  les appels passent par des URLs relatives (`/api/...`),
 *  ce qui suppose que le frontend et l'API partagent la
 *  même origine (rewrite Vercel, reverse-proxy, etc.).
 *  La valeur VITE_API_BASE_URL reste lue côté backend
 *  (fallback de PUBLIC_API_URL pour TikTok).
 * ────────────────────────────────────────────────────────── */

async function apiGet<T>(path: string): Promise<T> {
  // ⚠️ Remplace par ton access token réel (celui de services/posts.ts)
  const token = "";

  const res = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const raw = await res.text();
  let data: unknown;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        `Invalid JSON response from API (HTTP ${res.status}) — check that /api is proxied to the backend`
      );
    }
  } else {
    data = {};
  }

  if (
    !res.ok ||
    (data &&
      typeof data === "object" &&
      "success" in data &&
      (data as { success?: unknown }).success === false)
  ) {
    const message =
      (data &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

/* ──────────────────────────────────────────────────────────
 *  Videos
 * ────────────────────────────────────────────────────────── */

export async function fetchYouTubeVideos(pageToken?: string): Promise<{
  videos: YouTubeVideo[];
  next_page_token: string | null;
}> {
  const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";

  const response = await apiGet<{
    videos?: unknown;
    next_page_token?: unknown;
  }>(`/api/youtube/videos${query}`);

  if (!Array.isArray(response.videos)) {
    throw new Error(
      "Invalid response from YouTube videos API: videos must be an array."
    );
  }

  if (
    response.next_page_token !== undefined &&
    response.next_page_token !== null &&
    typeof response.next_page_token !== "string"
  ) {
    throw new Error(
      "Invalid response from YouTube videos API: next_page_token must be a string or null."
    );
  }

  return {
    videos: response.videos as YouTubeVideo[],
    next_page_token: response.next_page_token ?? null,
  };
}

/* ──────────────────────────────────────────────────────────
 *  Comments
 * ────────────────────────────────────────────────────────── */

export async function fetchYouTubeComments(opts: {
  filter: "all" | "unanswered" | "answered";
  videoId?: string | null;
  pageToken?: string | null;
}): Promise<{
  comments: YouTubeComment[];
  next_page_token: string | null;
}> {
  const q = new URLSearchParams({ filter: opts.filter });
  if (opts.videoId) q.set("videoId", opts.videoId);
  if (opts.pageToken) q.set("pageToken", opts.pageToken);

  const response = await apiGet<{
    comments?: unknown;
    next_page_token?: unknown;
  }>(`/api/youtube/comments?${q.toString()}`);

  if (!Array.isArray(response.comments)) {
    throw new Error(
      "Invalid response from YouTube comments API: comments must be an array."
    );
  }

  if (
    response.next_page_token !== undefined &&
    response.next_page_token !== null &&
    typeof response.next_page_token !== "string"
  ) {
    throw new Error(
      "Invalid response from YouTube comments API: next_page_token must be a string or null."
    );
  }

  return {
    comments: response.comments as YouTubeComment[],
    next_page_token: response.next_page_token ?? null,
  };
}