import { apiRequest, getCurrentUser } from "./supabase";
import type { NewPostPayload, SocialNetworkId } from "../components/Newpostmodal";

export type CalendarPostStatus =
  | "scheduled"
  | "external"
  | "published"
  | "failed"
  | "draft";

export type CalendarPostMedia = {
  url: string;
  kind: "image" | "video";
  path?: string;
};

export type CalendarPost = {
  id: string;
  network: SocialNetworkId;
  channelKey?: string;
  title?: string;
  content: string;
  scheduledAt: string;
  status: CalendarPostStatus;
  media: CalendarPostMedia[];
  tagIds: string[];
};

/** Extrait la couleur hexadécimale d'un tag. */
export const tagHex = (color: string): string =>
  color?.match(/#[0-9a-f]{6}/i)?.[0] ?? "#6366f1";

export function isPostPosted(post: CalendarPost, now: Date): boolean {
  return (
    post.status === "published" ||
    post.status === "external" ||
    new Date(post.scheduledAt).getTime() <= now.getTime()
  );
}

/* ------------------------------------------------------------------ */
/* Normalisation : accepte camelCase (API) et snake_case (table brute) */
/* ------------------------------------------------------------------ */

type RawPost = Record<string, unknown>;

function normalizeMedia(raw: unknown): CalendarPostMedia[] {
  let list: unknown = raw;

  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  return list
    .map((m): CalendarPostMedia | null => {
      if (!m || typeof m !== "object") return null;
      const item = m as Record<string, unknown>;
      const url = typeof item.url === "string" ? item.url : "";
      if (!url || url.startsWith("blob:")) return null;

      const kind: "image" | "video" =
        item.kind === "video" || item.type === "video" ? "video" : "image";

      return {
        url,
        kind,
        path: typeof item.path === "string" ? item.path : undefined,
      };
    })
    .filter((m): m is CalendarPostMedia => m !== null);
}

function normalizePost(raw: RawPost): CalendarPost | null {
  const scheduledAt = (raw.scheduledAt ?? raw.scheduled_at) as string | null | undefined;
  // On accepte les posts sans date s'ils sont déjà publiés ou externes
  if (!scheduledAt && raw.status !== "published" && raw.status !== "external") return null;

  const tagIds = (raw.tagIds ?? raw.tag_ids) as unknown;
  const channelKey = (raw.channelKey ?? raw.channel_key) as string | null | undefined;

  return {
    id: String(raw.id),
    network: raw.network as SocialNetworkId,
    channelKey: channelKey ?? undefined,
    title: typeof raw.title === "string" ? raw.title : undefined,
    content: typeof raw.content === "string" ? raw.content : "",
    scheduledAt: scheduledAt || new Date().toISOString(), // Fallback pour les posts immédiats
    status: (raw.status as CalendarPostStatus) ?? "scheduled",
    media: normalizeMedia(raw.media),
    tagIds: Array.isArray(tagIds) ? (tagIds as string[]) : [],
  };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export async function updatePostSchedule(
  id: string,
  scheduledAt: string
): Promise<void> {
  await apiRequest("/api/posts/schedule", {
    method: "PUT",
    body: JSON.stringify({ id, scheduledAt }),
  });
}

export async function createPosts(payload: NewPostPayload): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Utilisateur non authentifié");
  }

  // MODIFICATION : Vérification plus souple
  // On vérifie si l'utilisateur a sélectionné des réseaux, même s'ils sont marqués comme externes
  const hasNetworks = payload.networks.length > 0;
  
  if (!hasNetworks) {
    throw new Error("At least one network is required");
  }

  if (payload.scheduleMode === "later" && !payload.scheduledAt) {
    throw new Error("A date is required to schedule a post.");
  }

  const formData = new FormData();

  formData.append("title", payload.title ?? "");
  formData.append("content", payload.content ?? "");
  formData.append("scheduleMode", payload.scheduleMode);
  if (payload.scheduledAt) {
    formData.append("scheduledAt", payload.scheduledAt);
  }

  // On envoie TOUS les réseaux sélectionnés
  formData.append("networks", JSON.stringify(payload.networks));
  
  // On envoie les réseaux externes (ceux déjà publiés par le frontend)
  formData.append("externalNetworks", JSON.stringify(payload.externalNetworks ?? []));
  
  formData.append("contents", JSON.stringify(payload.contents ?? {}));
  formData.append("channelKeys", JSON.stringify(payload.channelKeys ?? {}));
  formData.append("tagIds", JSON.stringify(payload.tagIds ?? []));
  formData.append("hashtags", JSON.stringify(payload.hashtags ?? []));
  if (payload.youtube) {
    formData.append("youtube", JSON.stringify(payload.youtube));
  }

  payload.media.forEach((file) => {
    formData.append("media", file);
  });

  if (payload.mediaByNetwork) {
    for (const [network, files] of Object.entries(payload.mediaByNetwork)) {
      (files ?? []).forEach((file) => {
        formData.append(`media_${network}`, file);
      });
    }
  }

  await apiRequest("/api/posts", {
    method: "POST",
    body: formData,
  });
}

export async function listPosts(from: Date, to: Date): Promise<CalendarPost[]> {
  const data = await apiRequest<{ posts?: RawPost[] } | RawPost[]>(
    `/api/posts?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    { method: "GET" }
  );

  const rows = Array.isArray(data) ? data : data?.posts ?? [];

  return rows
    .map(normalizePost)
    .filter((p): p is CalendarPost => p !== null);
}

export async function deletePost(id: string): Promise<void> {
  await apiRequest(`/api/posts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}