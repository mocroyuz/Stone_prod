import { apiRequest } from "./supabase";
import type { NewPostPayload, SocialNetworkId } from "../components/Newpostmodal";

export type CalendarPost = {
  id: string;
  network: SocialNetworkId;
  channelKey?: string;
  content: string;
  scheduledAt: string;
  status: "scheduled" | "external" | "published" | "failed" | "draft";
  media: { url: string; kind: "image" | "video" }[];
  tagIds: string[];
};

/** "bg-[#6366f1]" → "#6366f1". Les classes Tailwind construites à l'exécution
 *  ne sont pas générées, donc on passe la couleur en style inline. */
export const tagHex = (color: string): string =>
  color?.match(/#[0-9a-f]{6}/i)?.[0] ?? "#6366f1";

export function isPostPosted(post: CalendarPost, now: Date): boolean {
  return post.status === "published" || new Date(post.scheduledAt).getTime() <= now.getTime();
}

export async function createPosts(payload: NewPostPayload): Promise<void> {
  const form = new FormData();
  form.append(
    "data",
    JSON.stringify({
      title: payload.title,
      contents: payload.contents,
      scheduleMode: payload.scheduleMode,
      scheduledAt: payload.scheduledAt,
      networks: payload.networks,
      externalNetworks: payload.externalNetworks ?? [],
      channelKeys: payload.channelKeys ?? {},
      tagIds: payload.tagIds ?? [],
      youtube: payload.youtube,
    })
  );
  payload.media.forEach((f) => form.append("media", f));
  for (const [network, files] of Object.entries(payload.mediaByNetwork ?? {})) {
    files?.forEach((f) => form.append(`media_${network}`, f));
  }
  await apiRequest("/api/posts", { method: "POST", body: form });
}

export async function listPosts(from: Date, to: Date): Promise<CalendarPost[]> {
  const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  const data = await apiRequest<{ posts?: any[] }>(`/api/posts?${q}`, { method: "GET" });
  return (data.posts ?? [])
    .filter((p) => p.scheduled_at)
    .map((p) => ({
      id: p.id,
      network: p.network,
      channelKey: p.channel_key ?? undefined,
      content: p.content ?? "",
      scheduledAt: p.scheduled_at,
      status: p.status,
      media: Array.isArray(p.media) ? p.media : [],
      tagIds: p.tag_ids ?? [],
    }));
}

export async function deletePost(id: string): Promise<void> {
  await apiRequest(`/api/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}