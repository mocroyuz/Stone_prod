// src/services/tiktok.ts
import { apiRequest } from "./supabase";
import {
  clearCache,
  isAvatarStale,
  readCache,
  writeCache,
  type Connection,
} from "./channelsCache";

// ── Types ────────────────────────────────────────────────────

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
  brand_content_toggle?: boolean;
  brand_organic_toggle?: boolean;
}

export type TikTokPublishStatus =
  | "PROCESSING_UPLOAD"
  | "PROCESSING_DOWNLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

export interface TikTokCapabilities {
  audited: boolean;
  sandbox: boolean;
  force_draft: boolean;
  can_direct_post: boolean;
  forced_privacy_level: string | null;
  photos_mode: string;
  testers_only_auth: boolean;
}

export interface TikTokStatusResponse {
  success?: boolean;
  connected: boolean;
  account: TikTokAccount | null;
  needs_reconnect?: boolean;
  capabilities?: TikTokCapabilities;
}

// ── Connexion ────────────────────────────────────────────────

export async function getTikTokStatus(
  options: { force?: boolean } = {}
): Promise<TikTokStatusResponse> {
  const qs = options.force ? "?refresh=1" : "";
  return apiRequest(`/api/tiktok/status${qs}`, { method: "GET" });
}

export async function startTikTokLogin(): Promise<void> {
  const data = await apiRequest<{ url?: string }>("/api/tiktok/auth/url", {
    method: "POST",
  });

  if (!data?.url) throw new Error("Le backend n'a pas renvoyé d'URL TikTok.");

  let target: URL;
  try {
    target = new URL(data.url);
  } catch {
    throw new Error(`URL TikTok invalide : ${data.url}`);
  }

  if (target.protocol !== "https:" || !target.hostname.endsWith("tiktok.com")) {
    throw new Error(`URL inattendue (hôte ${target.hostname}).`);
  }

  window.location.assign(target.toString());
}

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

// ── Anti-martèlement des avatars ────────────────────────────

const INITIAL_FAILURE_COOLDOWN_MS = 10_000;
const MAX_FAILURE_COOLDOWN_MS = 5 * 60_000;
const MAX_AUTO_RETRIES = 5;

const avatarFailureCount = new Map<string, number>();
const avatarFailureAt = new Map<string, number>();

function failureCooldown(count: number): number {
  if (count <= 0) return 0;
  if (count >= MAX_AUTO_RETRIES) return MAX_FAILURE_COOLDOWN_MS;
  // 1→10s, 2→20s, 3→40s, 4→80s, 5+→5min
  const exp = Math.pow(2, count - 1);
  return Math.min(INITIAL_FAILURE_COOLDOWN_MS * exp, MAX_FAILURE_COOLDOWN_MS);
}

/**
 * Peut-on retenter un refresh forcé ?
 * - jamais échoué → oui
 * - 1..4 échecs → cooldown exponentiel 10s/20s/40s/80s
 * - 5+ échecs → cooldown 5 min (retry occasionnel, pas de blocage définitif)
 */
export function canRetryTikTokAvatar(userId: string): boolean {
  if (!userId) return false;
  const count = avatarFailureCount.get(userId) || 0;
  if (count === 0) return true;
  const at = avatarFailureAt.get(userId) || 0;
  return Date.now() - at >= failureCooldown(count);
}

/** Incrémente le compteur (appelé UNIQUEMENT par handleTikTokAvatarError). */
function markFailure(userId: string): number {
  const count = (avatarFailureCount.get(userId) || 0) + 1;
  avatarFailureCount.set(userId, count);
  avatarFailureAt.set(userId, Date.now());
  return count;
}

/** Remet à zéro — login, reconnexion, clic « réessayer ». */
export function resetTikTokAvatarFailures(userId: string): void {
  if (!userId) return;
  avatarFailureCount.delete(userId);
  avatarFailureAt.delete(userId);
}

// ── Cache du profil ──────────────────────────────────────────

// Clé = `${userId}:${force ? "force" : "normal"}` pour ne pas écraser
// un refresh forcé par un refresh non-forcé en cours (et vice-versa).
const inflightRefresh = new Map<string, Promise<Connection | null>>();

async function doRefresh(
  userId: string,
  force: boolean
): Promise<Connection | null> {
  try {
    const status = await getTikTokStatus({ force });

    // Log console (DevTools) — indispensable pour diagnostiquer.
    console.debug("[Stone:tiktok] refresh", {
      userId,
      force,
      connected: status.connected,
      hasAvatar: Boolean(status.account?.avatar_url),
      avatarPrefix: status.account?.avatar_url?.slice(0, 48),
      needsReconnect: status.needs_reconnect,
    });

    if (!status.connected) {
      clearCache(userId, "tiktok");

      if (status.needs_reconnect) {
        return { connected: false, needsReconnect: true };
      }
      return { connected: false };
    }

    const connection: Connection = {
      connected: true,
      handle: status.account?.display_name ?? undefined,
      avatarUrl: status.account?.avatar_url ?? undefined,
    };

    writeCache(userId, connection, "tiktok");

    // Succès (même partiel) : on remet le compteur à zéro.
    resetTikTokAvatarFailures(userId);

    return connection;
  } catch (error) {
    // Panne réseau / 5xx / timeout : on NE vide PAS le cache.
    console.warn("[Stone:tiktok] refresh network error:", error);
    return null;
  }
}

/**
 * Refresh « bas niveau », sans throttle. Utilisable pour un refresh de
 * fond ou un bouton « réessayer » manuel. Pour l'`onError` d'une image,
 * utilise `handleTikTokAvatarError`.
 */
export async function refreshTikTokCache(
  userId: string,
  options: { force?: boolean } = {}
): Promise<Connection | null> {
  if (!userId) return null;

  // Refresh de fond : ne touche au serveur que si le cache a > 1 h.
  if (!options.force) {
    const cached = readCache(userId, "tiktok");
    if (cached && !isAvatarStale(cached)) return cached.connection;
  }

  const key = `${userId}:${options.force ? "force" : "normal"}`;
  const pending = inflightRefresh.get(key);
  if (pending) return pending;

  const task = doRefresh(userId, Boolean(options.force)).finally(() => {
    inflightRefresh.delete(key);
  });

  inflightRefresh.set(key, task);
  return task;
}

/**
 * À appeler DEPUIS onError de l'<img> avatar. Encapsule tout le cycle :
 *   1. vérifie le cooldown AVANT d'incrémenter le compteur
 *   2. incrémente le compteur
 *   3. déclenche un refresh forcé (dédupliqué)
 *   4. renvoie la Connection à afficher (ou null si bloqué)
 *
 * Retourne :
 *   - Connection { connected: true, avatarUrl }  → nouvelle URL à afficher
 *   - Connection { connected: false, needsReconnect: true } → bannière
 *   - Connection { connected: false }            → pas connecté
 *   - null                                        → panne transitoire
 *   - Connection (depuis le cache)               → cooldown actif, rien fait
 */
export async function handleTikTokAvatarError(
  userId: string
): Promise<Connection | null> {
  if (!userId) return null;

  // 1) Déduplication : si un refresh est déjà en cours, on attend.
  const pending = inflightRefresh.get(`${userId}:force`);
  if (pending) return pending;

  // 2) Cooldown — vérifié AVANT markFailure (c'était le bug).
  if (!canRetryTikTokAvatar(userId)) {
    return readCache(userId, "tiktok")?.connection ?? null;
  }

  // 3) Incrémente le compteur.
  markFailure(userId);

  // 4) Refresh forcé.
  return refreshTikTokCache(userId, { force: true });
}

// ── Publication ──────────────────────────────────────────────

export async function getTikTokCreatorInfo(): Promise<
  TikTokCreatorInfo & { capabilities?: TikTokCapabilities }
> {
  const data = await apiRequest<{
    creator: TikTokCreatorInfo;
    capabilities?: TikTokCapabilities;
  }>("/api/tiktok/creator-info", { method: "GET" });
  return { ...data.creator, capabilities: data.capabilities };
}

export async function publishToTikTok(params: {
  video: File;
  caption: string;
  mode: "direct" | "draft";
  options: TikTokPostOptions;
}): Promise<string> {
  const form = new FormData();
  form.append("mode", params.mode);
  form.append("title", params.caption);
  form.append("privacy_level", params.options.privacy_level || "SELF_ONLY");
  form.append("disable_comment", String(params.options.disable_comment));
  form.append("disable_duet", String(params.options.disable_duet));
  form.append("disable_stitch", String(params.options.disable_stitch));
  form.append("brand_content_toggle", String(Boolean(params.options.brand_content_toggle)));
  form.append("brand_organic_toggle", String(Boolean(params.options.brand_organic_toggle)));
  form.append("video", params.video);

  const data = await apiRequest<{ publish_id: string }>("/api/tiktok/publish", {
    method: "POST",
    body: form,
  });
  return data.publish_id;
}

export async function publishPhotosToTikTok(params: {
  photos: File[];
  caption: string;
  mode: "direct" | "draft";
  options: TikTokPostOptions;
}): Promise<string> {
  if (params.photos.length === 0) throw new Error("No photos to publish.");

  const form = new FormData();
  form.append("mode", params.mode);
  form.append("title", params.caption);
  form.append("cover_index", "1");
  form.append("privacy_level", params.options.privacy_level || "SELF_ONLY");
  form.append("disable_comment", String(params.options.disable_comment));
  form.append("brand_content_toggle", String(Boolean(params.options.brand_content_toggle)));
  form.append("brand_organic_toggle", String(Boolean(params.options.brand_organic_toggle)));
  for (const photo of params.photos) form.append("photos", photo);

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

export async function waitForTikTokPublish(
  publishId: string,
  onProgress?: (status: TikTokPublishStatus) => void
): Promise<TikTokPublishStatus> {
  for (let i = 0; i < 40; i++) {
    const { status, fail_reason } = await getTikTokPublishStatus(publishId);
    onProgress?.(status);
    if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") return status;
    if (status === "FAILED") throw new Error(fail_reason || "TikTok publication failed");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("TikTok is taking too long to process your content");
}