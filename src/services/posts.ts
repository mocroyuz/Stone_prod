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
    new Date(post.scheduledAt).getTime() <= now.getTime()
  );
}

/* ------------------------------------------------------------------ */
/* Normalisation : accepte camelCase (API) et snake_case (table brute) */
/* ------------------------------------------------------------------ */

type RawPost = Record<string, unknown>;

function normalizeMedia(raw: unknown): CalendarPostMedia[] {
  let list: unknown = raw;

  // jsonb renvoyé parfois sous forme de chaîne
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
      if (!url || url.startsWith("blob:")) return null; // une URL blob: est morte après un refresh

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
  if (!scheduledAt) return null; // brouillons sans date : absents du calendrier

  const tagIds = (raw.tagIds ?? raw.tag_ids) as unknown;
  const channelKey = (raw.channelKey ?? raw.channel_key) as string | null | undefined;

  return {
    id: String(raw.id),
    network: raw.network as SocialNetworkId,
    channelKey: channelKey ?? undefined,
    title: typeof raw.title === "string" ? raw.title : undefined,
    content: typeof raw.content === "string" ? raw.content : "",
    scheduledAt,
    status: (raw.status as CalendarPostStatus) ?? "scheduled",
    media: normalizeMedia(raw.media),
    tagIds: Array.isArray(tagIds) ? (tagIds as string[]) : [],
  };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

/** Met à jour la date de programmation d'un post (drag & drop). */
export async function updatePostSchedule(
  id: string,
  scheduledAt: string
): Promise<void> {
  await apiRequest("/api/posts/schedule", {
    method: "PUT",
    body: JSON.stringify({ id, scheduledAt }),
  });
}

/**
 * Envoie le post au backend (multipart).
 *
 * `networks` contient les réseaux à programmer ET ceux déjà programmés ailleurs
 * (YouTube), pour qu'un backend qui exige « au moins un réseau » accepte la requête.
 * `externalNetworks` indique lesquels ne doivent PAS être republiés : le backend
 * doit les enregistrer avec le statut "external".
 */
export async function createPosts(payload: NewPostPayload): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Utilisateur non authentifié");
  }

  const external = payload.externalNetworks ?? [];
  
  // CORRECTION : On utilise payload.networks (la sélection originale) si allNetworks est vide.
  // Cela arrive quand le frontend filtre les réseaux "immédiats" (TikTok/YouTube Now) 
  // avant d'appeler cette fonction, laissant le tableau networks vide.
  const allNetworks = Array.from(new Set([...payload.networks, ...external]));
  
  // Validation plus souple : on accepte la requête si l'utilisateur avait sélectionné des réseaux,
  // même si ils ont été filtrés par le frontend pour traitement immédiat séparé.
  if (allNetworks.length === 0 && payload.networks.length === 0) {
    throw new Error("At least one network is required");
  }

  if (payload.scheduleMode === "later" && !payload.scheduledAt) {
    throw new Error("A date is required to schedule a post.");
  }

  const formData = new FormData();

  // Champs simples
  formData.append("title", payload.title ?? "");
  formData.append("content", payload.content ?? "");
  formData.append("scheduleMode", payload.scheduleMode);
  if (payload.scheduledAt) {
    formData.append("scheduledAt", payload.scheduledAt);
  }

  // Champs structurés (JSON)
  // On envoie allNetworks s'il n'est pas vide, sinon on envoie payload.networks pour satisfaire le backend
  const networksToSend = allNetworks.length > 0 ? allNetworks : payload.networks;
  
  formData.append("networks", JSON.stringify(networksToSend));
  formData.append("externalNetworks", JSON.stringify(external));
  formData.append("contents", JSON.stringify(payload.contents ?? {}));
  formData.append("channelKeys", JSON.stringify(payload.channelKeys ?? {}));
  formData.append("tagIds", JSON.stringify(payload.tagIds ?? []));
  formData.append("hashtags", JSON.stringify(payload.hashtags ?? []));
  if (payload.youtube) {
    formData.append("youtube", JSON.stringify(payload.youtube));
  }

  // Médias partagés
  payload.media.forEach((file) => {
    formData.append("media", file);
  });

  // Médias propres à un réseau (le nom du champ porte le réseau : media_tiktok…)
  if (payload.mediaByNetwork) {
    for (const [network, files] of Object.entries(payload.mediaByNetwork)) {
      (files ?? []).forEach((file) => {
        formData.append(`media_${network}`, file);
      });
    }
  }

  // apiRequest omet automatiquement Content-Type pour un FormData
  await apiRequest("/api/posts", {
    method: "POST",
    body: formData,
  });
}

/** Récupère les posts programmés entre deux dates. */
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

/** Supprime un post programmé (le backend supprime aussi les fichiers du Storage). */
export async function deletePost(id: string): Promise<void> {
  await apiRequest(`/api/posts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}