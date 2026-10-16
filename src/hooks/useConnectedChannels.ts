// src/hooks/useConnectedChannels.ts
import { useEffect, useState } from "react";
import { useUser } from "../contexts/UserContext";
import {
  CACHE_PROVIDERS,
  CHANNELS_CHANGED_EVENT,
  readCache,
  type CacheProvider,
} from "../services/channelsCache";

export type ConnectedChannel = {
  key: string;
  name: string;
  platform: CacheProvider;
  handle?: string;
  avatarUrl?: string;
};

const PROVIDER_NAMES: Record<CacheProvider, string> = {
  tiktok: "TikTok",
  youtube: "YouTube Shorts",
  pinterest: "Pinterest",
};

function readAll(userId: string | null): ConnectedChannel[] {
  if (!userId) return [];

  const channels: ConnectedChannel[] = [];

  for (const provider of CACHE_PROVIDERS) {
    const cached = readCache(userId, provider);
    if (!cached?.connection.connected) continue;

    channels.push({
      key: provider,
      name: PROVIDER_NAMES[provider],
      platform: provider,
      handle: cached.connection.handle,
      avatarUrl: cached.connection.avatarUrl,
    });
  }

  return channels;
}

export function useConnectedChannels(): ConnectedChannel[] {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [channels, setChannels] = useState<ConnectedChannel[]>(() =>
    readAll(userId)
  );

  useEffect(() => {
    const refresh = () => setChannels(readAll(userId));

    refresh();

    // Mise à jour quand Channels écrit / vide le cache (même onglet)...
    window.addEventListener(CHANNELS_CHANGED_EVENT, refresh);
    // ...ou quand un autre onglet le modifie.
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(CHANNELS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);

  return channels;
}