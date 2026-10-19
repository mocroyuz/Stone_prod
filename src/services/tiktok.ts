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
  /** true uniquement si la connexion est UTILISABLE (jeton frais). */
  connected: boolean;
  account: TikTokAccount | null;
  /**
   * Présent et true si le serveur a détecté un refresh token mort
   * (session TikTok expirée côté provider, ou compte déconnecté
   * depuis TikTok). L'utilisateur doit reconnecter.
   */
  needs_reconnect?: boolean;
  capabilities?: TikTokCapabilities;
}

// ── Connexion ────────────────────────────────────────────────

/**
 * Récupère l'état TikTok courant.
 *
 * @param options.force  Envoie ?refresh=1 pour demander au serveur
 *                       d'ignorer son throttle de 30 min (utilisé
 *                       quand une image vient d'échouer). Le serveur
 *                       applique quand même son anti-martèlement court.
 */
export async function getTikTokStatus(
  options: { force?: boolean } = {}
): Promise<TikTokStatusResponse> {
  const qs = options.force ? "?refresh=1" : "";
  return apiRequest(`/api/tiktok/status${qs}`, { method: "GET" });
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
 *
 * ⚠️  Côté page callback, après un login réussi, appeler :
 *     resetTikTokAvatarFailures(userId)             ← repart à zéro
 *     refreshTikTokCache(userId, { force: true })   ← récupère l'avatar frais
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

// ── Anti-martèlement des avatars (onError) ──────────────────
//
// Quand l'<img> d'avatar échoue (URL expirée, CDN lent, réseau),
// le composant appelle markTikTokAvatarFailed(userId) puis
// refreshTikTokCache(userId, { force: true }).
//
// Les tentatives sont espacées de façon exponentielle :
//   1er échec  → 10 s
//   2e         → 20 s
//   3e         → 40 s
//   4e         → 80 s
//   5e et +    → 5 min (plafond)
//
// Après 5 échecs, le composant devrait afficher l'avatar de secours
// (initiale) et attendre une action manuelle (clic « réessayer » →
// resetTikTokAvatarFailures + refresh forcé).

const INITIAL_FAILURE_COOLDOWN_MS = 10_000;
const MAX_FAILURE_COOLDOWN_MS = 5 * 60_000;
const MAX_AUTO_RETRIES = 5;

const avatarFailureCount = new Map<string, number>();
const avatarFailureAt = new Map<string, number>();

function failureCooldown(count: number): number {
  if (count <= 0) return 0;
  const exp = Math.pow(2, count - 1);
  const raw = INITIAL_FAILURE_COOLDOWN_MS * exp;
  // Si exp déborde (Infinity), Math.min renvoie le plafond.
  return Math.min(raw, MAX_FAILURE_COOLDOWN_MS);
}

/**
 * À appeler depuis onError de l'<img> AVANT refreshTikTokCache.
 * Renvoie le nombre d'échecs consécutifs pour cet utilisateur (1 = premier).
 * Le composant peut afficher l'avatar de secours dès que count >= 5.
 */
export function markTikTokAvatarFailed(userId: string): number {
  if (!userId) return 0;
  const count = (avatarFailureCount.get(userId) || 0) + 1;
  avatarFailureCount.set(userId, count);
  avatarFailureAt.set(userId, Date.now());
  return count;
}

/** Remet le compteur à zéro (login, reconnexion, clic « réessayer »). */
export function resetTikTokAvatarFailures(userId: string): void {
  if (!userId) return;
  avatarFailureCount.delete(userId);
  avatarFailureAt.delete(userId);
}

/**
 * Vrai si on peut retenter un refresh forcé pour cet utilisateur.
 * Faux pendant le cooldown exponentiel après des échecs successifs,
 * et faux définitivement une fois MAX_AUTO_RETRIES atteint (il faut
 * alors un resetTikTokAvatarFailures explicite).
 */
export function canRetryTikTokAvatar(userId: string): boolean {
  const count = avatarFailureCount.get(userId) || 0;
  if (count === 0) return true;
  if (count >= MAX_AUTO_RETRIES) return false;
  const at = avatarFailureAt.get(userId) || 0;
  return Date.now() - at >= failureCooldown(count);
}

// ── Cache du profil ──────────────────────────────────────────

// Déduplication des requêtes en cours. Deux clés par utilisateur
// (force / normal) : un force ne se fait plus écraser par un normal
// en cours, et vice-versa.
const inflightRefresh = new Map<string, Promise<Connection | null>>();

/**
 * Recharge le profil TikTok depuis le backend et met à jour le cache local.
 * Utile quand l'URL de l'avatar a expiré (les URLs signées TikTok durent
 * quelques heures).
 *
 * - sans option     : ne fait rien tant que le cache a moins d'1 h
 * - { force: true } : appelle le serveur avec ?refresh=1 (ignore son
 *                     throttle 30 min), mais respecte le cooldown
 *                     exponentiel côté client.
 *
 * Renvoie :
 *   - Connection (connected: true)                       → avatar frais
 *   - Connection { connected: false }                    → pas connecté
 *   - Connection { connected: false, needsReconnect: true } → reconnexion requise
 *   - null                                               → erreur transitoire
 */
export async function refreshTikTokCache(
  userId: string,
  options: { force?: boolean } = {}
): Promise<Connection | null> {
  if (!userId) return null;

  // Anti-martèlement côté client : même un force respecte le cooldown
  // exponentiel. Le serveur a son propre throttle, mais on évite les
  // requêtes inutiles quand l'URL renvoyée reste cassée.
  if (options.force && !canRetryTikTokAvatar(userId)) {
    const cached = readCache(userId, "tiktok");
    return cached?.connection ?? null;
  }

  // Refresh de fond : ne touche au serveur que si le cache a > 1 h.
  if (!options.force) {
    const cached = readCache(userId, "tiktok");
    if (cached && !isAvatarStale(cached)) return cached.connection;
  }

  const key = `${userId}:${options.force ? "force" : "normal"}`;
  const pending = inflightRefresh.get(key);
  if (pending) return pending;

  const task = (async (): Promise<Connection | null> => {
    try {
      const status = await getTikTokStatus({ force: options.force });

      if (!status.connected) {
        // Session morte OU jamais connecté : on vide le cache.
        clearCache(userId, "tiktok");

        if (status.needs_reconnect) {
          // Le serveur a explicitement signalé un refresh token mort.
          // On arme un cooldown long côté client pour ne pas marteler
          // un serveur qui répondra toujours connected: false tant
          // que l'utilisateur n'a pas reconnecté.
          avatarFailureCount.set(userId, MAX_AUTO_RETRIES);
          avatarFailureAt.set(userId, Date.now());

          return { connected: false, needsReconnect: true };
        }

        // Simple absence de connexion : cooldown court pour éviter
        // une boucle si le composant insiste.
        if (!avatarFailureCount.has(userId)) {
          avatarFailureCount.set(userId, 1);
          avatarFailureAt.set(userId, Date.now());
        }

        return { connected: false };
      }

      const connection: Connection = {
        connected: true,
        handle: status.account?.display_name ?? undefined,
        avatarUrl: status.account?.avatar_url ?? undefined,
      };

      writeCache(userId, connection, "tiktok");

      // Succès : on repart à zéro pour la prochaine fois.
      resetTikTokAvatarFailures(userId);

      return connection;
    } catch (error) {
      // Erreur réseau / 5xx / timeout : panne transitoire.
      // On NE vide PAS le cache (l'avatar précédent reste affiché),
      // on arme juste le cooldown via le compteur existant.
      console.warn("[Stone] Could not refresh TikTok cache:", error);
      return null;
    } finally {
      inflightRefresh.delete(key);
    }
  })();

  inflightRefresh.set(key, task);
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