// src/services/channelsCache.ts
//
// Cache partagé du profil des réseaux connectés (Channels + Home + NewPostModal).
// Mémoire (navigation dans l'app) + localStorage (rechargement de page),
// séparé par utilisateur ET par réseau.
// Préfixe "stone_" : volontairement différent de "crossflow_" pour ne pas
// déclencher la synchro de session de UserContext.

export type Connection = {
  connected: boolean;
  handle?: string;
  avatarUrl?: string;
};

export type CacheProvider = "tiktok" | "pinterest" | "youtube";

export type CachedProfile = { connection: Connection; savedAt: number };

// Alias conservé pour ne pas casser les imports existants.
export type CachedTikTok = CachedProfile;

// Durée de validité du statut "connecté / déconnecté".
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h

// Durée après laquelle l'AVATAR doit être revalidé auprès du serveur.
// Les URLs d'avatar TikTok / Pinterest expirent en quelques heures :
// on garde le cache pour l'affichage instantané, mais on reconsulte
// le serveur au moins toutes les heures.
export const AVATAR_MAX_AGE_MS = 60 * 60 * 1000; // 1 h

// Liste de tous les réseaux qui ont un cache (utile pour les hooks).
export const CACHE_PROVIDERS: CacheProvider[] = ["tiktok", "youtube", "pinterest"];

// Événement émis à chaque écriture / suppression du cache : les hooks
// (useConnectedChannels) s'y abonnent pour se mettre à jour sans recharger.
export const CHANNELS_CHANGED_EVENT = "stone:channels-changed";

// Le préfixe TikTok est inchangé : les caches existants restent valides.
const CACHE_PREFIXES: Record<CacheProvider, string> = {
  tiktok: "stone_tiktok_profile_",
  pinterest: "stone_pinterest_profile_",
  youtube: "stone_youtube_profile_",
};

const memoryCache = new Map<string, CachedProfile>();

const memoryKey = (provider: CacheProvider, userId: string) =>
  `${provider}:${userId}`;

const storageKey = (provider: CacheProvider, userId: string) =>
  CACHE_PREFIXES[provider] + userId;

function notifyChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANNELS_CHANGED_EVENT));
}

// `provider` vaut "tiktok" par défaut : le code existant continue
// de fonctionner sans modification.

export function readCache(
  userId: string,
  provider: CacheProvider = "tiktok"
): CachedProfile | null {
  const inMemory = memoryCache.get(memoryKey(provider, userId));
  if (inMemory) return inMemory;

  try {
    const raw = localStorage.getItem(storageKey(provider, userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedProfile;
    memoryCache.set(memoryKey(provider, userId), parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache(
  userId: string,
  connection: Connection,
  provider: CacheProvider = "tiktok"
): void {
  const entry: CachedProfile = { connection, savedAt: Date.now() };
  memoryCache.set(memoryKey(provider, userId), entry);

  try {
    localStorage.setItem(storageKey(provider, userId), JSON.stringify(entry));
  } catch {
    // localStorage indisponible : le cache mémoire suffit
  }

  notifyChange();
}

export function clearCache(
  userId: string,
  provider: CacheProvider = "tiktok"
): void {
  memoryCache.delete(memoryKey(provider, userId));

  try {
    localStorage.removeItem(storageKey(provider, userId));
  } catch {
    // ignore
  }

  notifyChange();
}

// ── Fraîcheur ────────────────────────────────────────────────

/** Le statut connecté / déconnecté est-il encore valable (24 h) ? */
export function isCacheFresh(entry: CachedProfile | null): boolean {
  return Boolean(entry && Date.now() - entry.savedAt < CACHE_MAX_AGE_MS);
}

/**
 * L'avatar doit-il être revalidé auprès du serveur (> 1 h) ?
 * À utiliser dans le hook à la place de CACHE_MAX_AGE_MS pour décider
 * s'il faut rappeler getTikTokStatus() en arrière-plan.
 */
export function isAvatarStale(entry: CachedProfile | null): boolean {
  return !entry || Date.now() - entry.savedAt >= AVATAR_MAX_AGE_MS;
}