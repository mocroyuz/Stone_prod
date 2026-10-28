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

// ⚠️ Remplace par ton helper existant (celui utilisé dans services/posts.ts)
async function apiGet<T>(path: string): Promise<T> {
  const token = /* ton access token */ "";
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const fetchYouTubeVideos = (pageToken?: string) =>
  apiGet<{ videos: YouTubeVideo[]; next_page_token: string | null }>(
    `/api/youtube/videos${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ""}`
  );

export const fetchYouTubeComments = async (opts: {
  filter: "all" | "unanswered" | "answered";
  videoId?: string | null;
  pageToken?: string | null;
}): Promise<{
  comments: YouTubeComment[];
  next_page_token: string | null;
}> => {
  const q = new URLSearchParams({ filter: opts.filter });
  if (opts.videoId) q.set("videoId", opts.videoId);
  if (opts.pageToken) q.set("pageToken", opts.pageToken);
  const response = await apiGet<{
    comments?: unknown;
    next_page_token?: unknown;
  }>(
    `/api/youtube/comments?${q.toString()}`
  );

  if (!Array.isArray(response.comments)) {
    throw new Error("Invalid response from YouTube comments API: comments must be an array.");
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
    comments: response.comments,
    next_page_token: response.next_page_token ?? null,
  };
};