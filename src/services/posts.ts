import { apiRequest, getCurrentUser } from "./supabase";
import type { NewPostPayload, SocialNetworkId } from "../components/Newpostmodal";

export type CalendarPost = {
  id: string;
  network: SocialNetworkId;
  channelKey?: string;
  content: string;
  scheduledAt: string;
  status: "scheduled" | "external" | "published" | "failed" | "draft";
  media: { url: string; kind: "image" | "video"; path?: string }[];
  tagIds: string[];
};

/** 
 * Extrait la couleur hexadécimale d'une classe Tailwind.
 */
export const tagHex = (color: string): string =>
  color?.match(/#[0-9a-f]{6}/i)?.[0] ?? "#6366f1";

export function isPostPosted(post: CalendarPost, now: Date): boolean {
  return post.status === "published" || new Date(post.scheduledAt).getTime() <= now.getTime();
}

/**
 * Met à jour la date de programmation d'un post (utilisé pour le Drag & Drop)
 */
export async function updatePostSchedule(id: string, scheduledAt: string): Promise<void> {
  await apiRequest("/api/posts/schedule", {
    method: "PUT",
    body: JSON.stringify({ id, scheduledAt }),
  });
}

/**
 * Crée les posts en base de données via ton API backend.
 * Le backend sera responsable de l'upload des médias et de l'insertion en base.
 */
export async function createPosts(payload: NewPostPayload): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Utilisateur non authentifié");
  }

  const formData = new FormData();

  // 1. Données de base (sérialisées en JSON car ce sont des objets/tableaux)
  formData.append("networks", JSON.stringify(payload.networks));
  if (payload.externalNetworks) {
    formData.append("externalNetworks", JSON.stringify(payload.externalNetworks));
  }
  if (payload.channelKeys) {
    formData.append("channelKeys", JSON.stringify(payload.channelKeys));
  }
  if (payload.contents) {
    formData.append("contents", JSON.stringify(payload.contents));
  }
  if (payload.content) {
    formData.append("content", payload.content);
  }
  if (payload.tagIds) {
    formData.append("tagIds", JSON.stringify(payload.tagIds));
  }
  formData.append("scheduledAt", payload.scheduledAt);

  // 2. Gestion des fichiers (le backend devra les uploader et renvoyer les URLs)
  // Fichiers généraux
  if (payload.media) {
    payload.media.forEach((file) => {
      formData.append("media", file);
    });
  }

  // Fichiers spécifiques par réseau (si utilisés)
  if (payload.mediaByNetwork) {
    Object.entries(payload.mediaByNetwork).forEach(([network, files]) => {
      files.forEach((file) => {
        formData.append(`media_${network}`, file);
      });
    });
  }

  // 3. Envoi à l'API (apiRequest gère automatiquement l'omission du header Content-Type pour FormData)
  await apiRequest("/api/posts", {
    method: "POST",
    body: formData,
  });
}

/**
 * Récupère les posts programmés entre deux dates.
 */
export async function listPosts(from: Date, to: Date): Promise<CalendarPost[]> {
  const data = await apiRequest<{ posts: CalendarPost[] }>(
    `/api/posts?from=${from.toISOString()}&to=${to.toISOString()}`,
    { method: "GET" }
  );
  return data?.posts ?? [];
}

/**
 * Supprime un post programmé (le backend doit aussi gérer la suppression du fichier dans le storage).
 */
export async function deletePost(id: string): Promise<void> {
  await apiRequest(`/api/posts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}