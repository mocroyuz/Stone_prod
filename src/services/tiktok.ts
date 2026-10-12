// src/services/tiktok.ts
import { apiRequest } from "./supabase";
import {
  clearCache,
  isAvatarStale,
  readCache,
  writeCache,
  type Connection,
} from "./channelsCache";

export interface TikTokAccount {
  display_name: string | null;
  avatar_url: string | null;
  scope?: string | null;
}

export interface TikTokCreatorInfo {
  creator_nickname?: string;
  creator_username?: string;
  creator_avatar_url?: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

export type TikTokPrivacy =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

export interface TikTokPostOptions {
  privacy_level: TikTokPrivacy | "";
  disable_comment: boolean;
  disable_duet: boolean;
  disable_stitch: boolean;
  /** Contenu de marque (« Paid partnership »). Interdit avec SELF_ONLY. */
  brand_content_toggle?: boolean;
  /** Promotion de sa propre marque (« Promotional content »). */
  brand_organic_toggle?: boolean;
}

export type TikTokPublishStatus =
  | "PROCESSING_UPLOAD"
  | "PROCESSING_DOWNLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

// ── Connexion ────────────────────────────────────────────────

export async function getTikTokStatus(): Promise<{
  connected: boolean;
  account: TikTokAccount | null;
}> {
  return apiRequest("/api/tiktok/status", { method: "GET" });
}

/**
 * Demande l'URL d'autorisation au backend (POST /api/tiktok/auth/url),
 * vérifie qu'elle pointe bien vers tiktok.com, puis redirige le navigateur.
 *
 * Si tout va bien, la page quitte l'application : la promesse ne sert
 * qu'à remonter les erreurs (réseau, 401, URL manquante...).
 */
export async function startTikTokLogin(): Promise<void> {
  console.log("[Stone] TikTok : demande de l'URL d'autorisation");

  const data = await apiRequest<{ url?: string }>("/api/tiktok/auth/url", {
    method: "POST",
  });

  console.log("[Stone] TikTok : réponse du backend", data);

  if (!data || typeof data.url !== "string" || !data.url) {
    throw new Error(
      `Le backend n'a pas renvoyé d'URL TikTok (réponse : ${JSON.stringify(data)})`
    );
  }

  let target: URL;

  try {
    target = new URL(data.url);
  } catch {
    throw new Error(`URL TikTok invalide : ${data.url}`);
  }

  if (target.protocol !== "https:" || !target.hostname.endsWith("tiktok.com")) {
    throw new Error(`URL inattendue (hôte ${target.hostname}).`);
  }

  console.log("[Stone] TikTok : redirection vers", target.toString());

  window.location.assign(target.toString());
}

/**
 * Appelé par la page /tiktok/callback avec les paramètres de l'URL.
 * Envoie le `code` et le `state` au backend (Railway), qui échange le code
 * contre un access_token auprès de TikTok.
 */
export async function completeTikTokLogin(
  code: string,
  state: string
): Promise<TikTokAccount | null> {
  const data = await apiRequest<{
    connected?: boolean;
    account?: TikTokAccount | null;
  }>("/api/tiktok/auth/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });

  return data?.account ?? null;
}

export async function disconnectTikTok(): Promise<void> {
  await apiRequest("/api/tiktok/disconnect", { method: "DELETE" });
}

// ── Cache du profil ──────────────────────────────────────────

// Évite plusieurs rafraîchissements simultanés pour un même utilisateur
// (plusieurs avatars cassés qui déclenchent onError en même temps).
const inflightRefresh = new Map<string, Promise<Connection | null>>();

/**
 * Recharge le profil TikTok depuis le backend et met à jour le cache local.
 * Utile quand l'URL de l'avatar a expiré (les URLs signées TikTok durent
 * quelques heures).
 *
 * - sans option : ne fait rien tant que le cache est récent
 * - { force: true } : recharge dans tous les cas
 */
export async function refreshTikTokCache(
  userId: string,
  options: { force?: boolean } = {}
): Promise<Connection | null> {
  if (!userId) return null;

  if (!options.force) {
    const cached = readCache(userId, "tiktok");
    if (cached && !isAvatarStale(cached)) return cached.connection;
  }

  const pending = inflightRefresh.get(userId);
  if (pending) return pending;

  const task = (async () => {
    try {
      const status = await getTikTokStatus();

      if (!status.connected) {
        clearCache(userId, "tiktok");
        return { connected: false } as Connection;
      }

      const connection: Connection = {
        connected: true,
        handle: status.account?.display_name ?? undefined,
        avatarUrl: status.account?.avatar_url ?? undefined,
      };

      writeCache(userId, connection, "tiktok");
      return connection;
    } catch (error) {
      console.warn("[Stone] Could not refresh TikTok cache:", error);
      return null;
    } finally {
      inflightRefresh.delete(userId);
    }
  })();

  inflightRefresh.set(userId, task);
  return task;
}

// ── Publication ──────────────────────────────────────────────

export async function getTikTokCreatorInfo(): Promise<TikTokCreatorInfo> {
  const data = await apiRequest<{ creator: TikTokCreatorInfo }>(
    "/api/tiktok/creator-info",
    { method: "GET" }
  );

  return data.creator;
}

/**
 * Envoie la vidéo au backend, qui la transmet à TikTok.
 * mode "direct" = publication (video.publish)
 * mode "draft"  = brouillon dans l'app TikTok (video.upload)
 */
export async function publishToTikTok(params: {
  video: File;
  caption: string;
  mode: "direct" | "draft";
  options: TikTokPostOptions;
}): Promise<string> {
  const form = new FormData();

  // Les champs texte AVANT le fichier
  form.append("mode", params.mode);
  form.append("title", params.caption);
  form.append("privacy_level", params.options.privacy_level || "SELF_ONLY");
  form.append("disable_comment", String(params.options.disable_comment));
  form.append("disable_duet", String(params.options.disable_duet));
  form.append("disable_stitch", String(params.options.disable_stitch));
  form.append(
    "brand_content_toggle",
    String(Boolean(params.options.brand_content_toggle))
  );
  form.append(
    "brand_organic_toggle",
    String(Boolean(params.options.brand_organic_toggle))
  );
  form.append("video", params.video);

  const data = await apiRequest<{ publish_id: string }>(
    "/api/tiktok/publish",
    { method: "POST", body: form }
  );

  return data.publish_id;
}

/**
 * Envoie 1 à 35 photos (JPEG / WebP) au backend.
 * 1 photo = post photo, 2+ photos = carrousel TikTok.
 * mode "direct" = publication, mode "draft" = brouillon dans l'app TikTok.
 *
 * Duet / Stitch n'existent pas pour les photos : seul disable_comment est envoyé.
 */
export async function publishPhotosToTikTok(params: {
  photos: File[];
  caption: string;
  mode: "direct" | "draft";
  options: TikTokPostOptions;
}): Promise<string> {
  if (params.photos.length === 0) {
    throw new Error("No photos to publish.");
  }

  const form = new FormData();

  // Les champs texte AVANT les fichiers
  form.append("mode", params.mode);
  form.append("title", params.caption);
  form.append("cover_index", "1");
  form.append("privacy_level", params.options.privacy_level || "SELF_ONLY");
  form.append("disable_comment", String(params.options.disable_comment));
  form.append(
    "brand_content_toggle",
    String(Boolean(params.options.brand_content_toggle))
  );
  form.append(
    "brand_organic_toggle",
    String(Boolean(params.options.brand_organic_toggle))
  );

  for (const photo of params.photos) {
    form.append("photos", photo);
  }

  const data = await apiRequest<{ publish_id: string }>(
    "/api/tiktok/publish/photos",
    { method: "POST", body: form }
  );

  return data.publish_id;
}

export async function getTikTokPublishStatus(publishId: string): Promise<{
  status: TikTokPublishStatus;
  fail_reason?: string;
}> {
  return apiRequest(
    `/api/tiktok/publish/status?publish_id=${encodeURIComponent(publishId)}`,
    { method: "GET" }
  );
}

/** Attend la fin du traitement TikTok (max ~2 min). */
export async function waitForTikTokPublish(
  publishId: string,
  onProgress?: (status: TikTokPublishStatus) => void
): Promise<TikTokPublishStatus> {
  for (let i = 0; i < 40; i++) {
    const { status, fail_reason } = await getTikTokPublishStatus(publishId);

    onProgress?.(status);

    if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
      return status;
    }

    if (status === "FAILED") {
      throw new Error(fail_reason || "TikTok publication failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("TikTok is taking too long to process your content");
}