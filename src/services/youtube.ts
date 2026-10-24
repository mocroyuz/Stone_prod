// src/services/youtube.ts
import { apiRequest } from "./supabase";

export interface YouTubeAccount {
  display_name: string | null; // titre de la chaîne
  avatar_url: string | null;
  custom_url?: string | null; // ex. "@machaine"
  scope?: string | null;
}

// ── Connexion ────────────────────────────────────────────────

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

// ── Publication ──────────────────────────────────────────────

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