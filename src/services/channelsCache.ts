// src/services/channelsCache.ts
export type Connection = {
  connected: boolean;
  handle?: string;
  avatarUrl?: string;
  needsReconnect?: boolean;
};

export type CacheProvider = "tiktok" | "pinterest" | "youtube";
export type CachedProfile = { connection: Connection; savedAt: number };
export type CachedTikTok = CachedProfile;

export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const AVATAR_MAX_AGE_MS = 60 * 60 * 1000;
export const CACHE_PROVIDERS: CacheProvider[] = ["tiktok", "youtube", "pinterest"];
export const CHANNELS_CHANGED_EVENT = "stone:channels-changed";

const CACHE_PREFIXES: Record<CacheProvider, string> = {
  tiktok: "stone_tiktok_profile_",
  pinterest: "stone_pinterest_profile_",
  youtube: "stone_youtube_profile_",
};

const memoryCache = new Map<string, CachedProfile>();
const memoryKey = (p: CacheProvider, u: string) => `${p}:${u}`;
const storageKey = (p: CacheProvider, u: string) => CACHE_PREFIXES[p] + u;

function notifyChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANNELS_CHANGED_EVENT));
}

export function readCache(userId: string, provider: CacheProvider = "tiktok"): CachedProfile | null {
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
  const persistable: Connection = {
    connected: connection.connected,
    handle: connection.handle,
    avatarUrl: connection.avatarUrl,
  };
  const entry: CachedProfile = { connection: persistable, savedAt: Date.now() };
  memoryCache.set(memoryKey(provider, userId), entry);
  try {
    localStorage.setItem(storageKey(provider, userId), JSON.stringify(entry));
  } catch {
    // ignore
  }
  notifyChange();
}

export function clearCache(userId: string, provider: CacheProvider = "tiktok"): void {
  memoryCache.delete(memoryKey(provider, userId));
  try {
    localStorage.removeItem(storageKey(provider, userId));
  } catch {
    // ignore
  }
  notifyChange();
}

export function isCacheFresh(entry: CachedProfile | null): boolean {
  return Boolean(entry && Date.now() - entry.savedAt < CACHE_MAX_AGE_MS);
}

export function isAvatarStale(entry: CachedProfile | null): boolean {
  return !entry || Date.now() - entry.savedAt >= AVATAR_MAX_AGE_MS;
}