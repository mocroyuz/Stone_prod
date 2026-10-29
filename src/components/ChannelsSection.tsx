// src/components/ChannelsSection.tsx
//
// Section « Channels » affichée dans Settings > Utils.
// Remplace l'ancienne page Channels (sidebar, bottom bar, etc.) :
// on ne garde ici que la logique de connexion des comptes.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";

import {
  ConfirmAccountModal,
  openFrequencyOnboarding,
  type OnboardingAccount,
} from "./OnboardingModals";
import { useUser } from "../contexts/UserContext";
import { navigate } from "../hooks/useHashRoute";

import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "./IntegrationIcons";

import {
  getTikTokStatus,
  startTikTokLogin,
  disconnectTikTok,
} from "../services/tiktok";
import {
  getPinterestStatus,
  startPinterestLogin,
  disconnectPinterest,
  connectPinterestWithToken,
} from "../services/pinterest";
import {
  getYouTubeStatus,
  startYouTubeLogin,
  disconnectYouTube,
} from "../services/youtube";
import {
  CHANNELS_CHANGED_EVENT,
  CACHE_MAX_AGE_MS,
  clearCache,
  readCache,
  writeCache,
  type CacheProvider,
  type Connection,
} from "../services/channelsCache";

/* ============================================================================
   TYPES
============================================================================ */

export type ChannelKey =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "threads";

export type IconComponent = ComponentType<{
  className?: string;
  size?: number;
}>;

export type Channel = {
  key: ChannelKey;
  name: string;
  subtitle: string;
  accountLabel: string;
  icon: IconComponent;
};

export type ConnectionState = Record<ChannelKey, Connection>;

type IconProps = { className?: string };

type StatusResponse = {
  connected: boolean;
  account:
    | {
        display_name?: string | null;
        avatar_url?: string | null;
        avatarUrl?: string | null;
      }
    | null
    | undefined;
};

/** Même signature que `Notify` de Settings. */
type Notify = (message: string, kind?: "success" | "error") => void;

/** Tokens de Settings (on n'a besoin que des classes, pas de la forme exacte). */
type SettingsTokens = Record<string, string>;

/* ============================================================================
   CONFIG
============================================================================ */

export const PLAN = {
  name: "Free",
  maxChannels: 3,
};

export const INSIGHT_ROUTE = "/insights";

export const REAL_OAUTH: ChannelKey[] = ["tiktok", "pinterest", "youtube"];

export const CHANNELS: Channel[] = [
  {
    key: "instagram",
    name: "Instagram",
    subtitle: "Business or Creator",
    accountLabel: "Instagram Account",
    icon: InstagramIcon,
  },
  {
    key: "facebook",
    name: "Facebook",
    subtitle: "Page",
    accountLabel: "Facebook Page",
    icon: FacebookIcon,
  },
  {
    key: "threads",
    name: "Threads",
    subtitle: "Profile",
    accountLabel: "Threads Profile",
    icon: ThreadsIcon,
  },
  {
    key: "youtube",
    name: "YouTube Shorts",
    subtitle: "Channel",
    accountLabel: "YouTube Shorts Channel",
    icon: YouTubeIcon,
  },
  {
    key: "tiktok",
    name: "TikTok",
    subtitle: "Business or Personal",
    accountLabel: "TikTok Account",
    icon: TikTokIcon,
  },
  {
    key: "pinterest",
    name: "Pinterest",
    subtitle: "Business or Profile",
    accountLabel: "Pinterest Account",
    icon: PinterestIcon,
  },
];

const initialConnections: ConnectionState = {
  instagram: { connected: false },
  facebook: { connected: false },
  tiktok: { connected: false },
  youtube: { connected: false },
  pinterest: { connected: false },
  threads: { connected: false },
};

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* ============================================================================
   ICONS
============================================================================ */

function Svg({
  className = "h-4 w-4",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Icône utilisée dans la sidebar de Settings. */
export function ChannelsIcon({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="7.5" r="2.5" />
      <circle cx="7.5" cy="16.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </Svg>
  );
}

function MoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function DisconnectIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </Svg>
  );
}

function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21v-5h5" />
    </Svg>
  );
}

function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </Svg>
  );
}

function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

function BoltIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2.5 5 13.2h5.6L9.5 21.5l8-10.7h-5.6L13 2.5Z" />
    </Svg>
  );
}

/* ============================================================================
   NAVIGATION HELPERS (utilisés par Settings et par la redirection Channels)
============================================================================ */

const RETURN_KEY = "stone:oauth-returned";
const SECTION_REQUEST_KEY = "stone:settings-section";
const OAUTH_PARAMS = [
  "tiktok",
  "tiktok_error",
  "pinterest",
  "pinterest_error",
  "youtube",
  "youtube_error",
];

/** Demande à Settings de s'ouvrir directement sur la section Channels. */
export function requestChannelsSection() {
  try {
    sessionStorage.setItem(SECTION_REQUEST_KEY, "channels");
  } catch {
    /* storage indisponible */
  }
}

/** Efface la demande une fois Settings monté. */
export function clearChannelsSectionRequest() {
  try {
    sessionStorage.removeItem(SECTION_REQUEST_KEY);
  } catch {
    /* storage indisponible */
  }
}

/**
 * Vrai si Settings doit s'ouvrir sur « Channels » :
 * - demande explicite depuis les liens vers Settings > Channels
 * - retour d'un OAuth (paramètres d'URL ou connexion en attente)
 * Fonction pure (aucun effet de bord) : sûre dans un initialiseur de state.
 */
export function shouldOpenChannelsSection(): boolean {
  try {
    if (sessionStorage.getItem(SECTION_REQUEST_KEY) === "channels") return true;
    const params = new URLSearchParams(window.location.search);
    if (OAUTH_PARAMS.some((key) => params.has(key))) return true;
    const pending = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? "[]");
    return Array.isArray(pending) && pending.length > 0;
  } catch {
    return false;
  }
}

/* ============================================================================
   HELPERS
============================================================================ */

function formatOAuthError(provider: string, error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Unable to reach the server. Check that the backend is running and VITE_API_URL is correct.";
  }
  return raw
    ? `Unable to connect to ${provider}. ${raw}`
    : `Unable to connect to ${provider}.`;
}

function mockHandleFor(key: ChannelKey): string {
  const handles: Record<ChannelKey, string> = {
    instagram: "@ronan.studio",
    facebook: "Ronan Studio",
    threads: "@ronan.studio",
    tiktok: "",
    youtube: "",
    pinterest: "",
  };
  return handles[key];
}

function toConnection(status: StatusResponse): Connection {
  if (!status.connected) {
    return { connected: false };
  }
  const account = status.account;
  return {
    connected: true,
    handle: account?.display_name ?? undefined,
    avatarUrl: account?.avatar_url ?? account?.avatarUrl ?? undefined,
  };
}

function readReturned(): CacheProvider[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as CacheProvider[]) : [];
  } catch {
    return [];
  }
}

function writeReturned(list: CacheProvider[]) {
  try {
    if (list.length === 0) sessionStorage.removeItem(RETURN_KEY);
    else sessionStorage.setItem(RETURN_KEY, JSON.stringify(list));
  } catch {
    /* storage indisponible */
  }
}

function markReturning(provider: CacheProvider) {
  writeReturned(Array.from(new Set([...readReturned(), provider])));
}

function buildAccount(
  channel: Channel,
  connection: Connection
): OnboardingAccount {
  return {
    key: channel.key,
    name: channel.name,
    accountLabel: channel.accountLabel,
    handle: connection.handle,
    avatarUrl: connection.avatarUrl,
  };
}

/* ============================================================================
   CHANNEL ICON
============================================================================ */

function ChannelIcon({
  channel,
  connection,
  isDark,
}: {
  channel: Channel;
  connection: Connection;
  isDark: boolean;
}) {
  const Icon = channel.icon;
  const [imageFailed, setImageFailed] = useState(false);
  const hasAvatar = Boolean(connection.avatarUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [connection.avatarUrl]);

  if (connection.connected && hasAvatar) {
    return (
      <span className="relative h-11 w-11 shrink-0">
        <img
          src={connection.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="h-11 w-11 select-none rounded-[14px] object-cover"
        />
        <span
          className={cx(
            "absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-[5px] ring-2",
            isDark
              ? "bg-[#0a0a0a] text-white ring-[#0a0a0a]"
              : "bg-white text-black ring-white"
          )}
        >
          <Icon className="h-[11px] w-[11px]" size={11} />
        </span>
      </span>
    );
  }

  const idle = isDark
    ? "border-white/[0.08] bg-white/[0.04] text-neutral-300"
    : "border-black/[0.06] bg-[#f6f4f0] text-neutral-600";
  const active = isDark
    ? "border-white/20 bg-white/10 text-white"
    : "border-black/10 bg-black/[0.04] text-neutral-900";

  return (
    <div
      className={cx(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border",
        connection.connected ? active : idle
      )}
    >
      <Icon className="h-[21px] w-[21px]" size={21} />
    </div>
  );
}

/* ============================================================================
   CHANNEL ROW
============================================================================ */

function ChannelRow({
  channel,
  connection,
  pending,
  isDark,
  tokens,
  onToggle,
  onReconnect,
}: {
  channel: Channel;
  connection: Connection;
  pending: boolean;
  isDark: boolean;
  tokens: SettingsTokens;
  onToggle: () => void;
  onReconnect: () => void;
}) {
  const isConnected = connection.connected;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const clickable = !isConnected && !pending;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Connect ${channel.name}` : undefined}
      onClick={() => clickable && onToggle()}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cx(
        "group relative flex items-center gap-4 px-4 py-4 transition-colors",
        clickable && cx("cursor-pointer", tokens.itemHover, tokens.ring),
        pending && "opacity-60"
      )}
    >
      <ChannelIcon channel={channel} connection={connection} isDark={isDark} />

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cx("truncate text-[14px] font-semibold", tokens.heading)}
        >
          {isConnected ? connection.handle || channel.name : channel.name}
        </span>
        <span className={cx("truncate text-[12.5px]", tokens.subtle)}>
          {pending ? "Please wait…" : isConnected ? "Connected" : channel.subtitle}
        </span>
      </div>

      {isConnected ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-label={`Options for ${channel.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((value) => !value);
            }}
            className={cx(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              tokens.subtle,
              tokens.ghostHover,
              tokens.ring
            )}
          >
            <MoreIcon className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={cx(
                "absolute right-0 top-10 z-50 w-44 rounded-xl border p-1 shadow-xl",
                tokens.card,
                tokens.cardBorder
              )}
            >
              <button
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onReconnect();
                }}
                className={cx(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium disabled:opacity-40",
                  tokens.heading,
                  tokens.itemHover
                )}
              >
                <RefreshIcon className="h-4 w-4" />
                Reconnect
              </button>

              <div className={cx("my-1 h-px", isDark ? "bg-white/[0.08]" : "bg-black/[0.06]")} />

              <button
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onToggle();
                }}
                className={cx(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium hover:bg-red-500/[0.08] disabled:opacity-40",
                  isDark ? "text-red-400" : "text-red-600"
                )}
              >
                <DisconnectIcon className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : (
        <ChevronRightIcon
          className={cx(
            "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
            tokens.subtle
          )}
        />
      )}
    </div>
  );
}

/* ============================================================================
   SECTION
============================================================================ */

export default function ChannelsSection({
  tokens,
  notify,
  isDark,
}: {
  tokens: SettingsTokens;
  notify: Notify;
  isDark: boolean;
}) {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [connections, setConnections] = useState<ConnectionState>(() => {
    if (!userId) return initialConnections;
    const tiktok = readCache(userId, "tiktok");
    const pinterest = readCache(userId, "pinterest");
    const youtube = readCache(userId, "youtube");
    return {
      ...initialConnections,
      ...(tiktok ? { tiktok: tiktok.connection } : {}),
      ...(pinterest ? { pinterest: pinterest.connection } : {}),
      ...(youtube ? { youtube: youtube.connection } : {}),
    };
  });

  const [pendingKey, setPendingKey] = useState<ChannelKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [onboardingAccount, setOnboardingAccount] =
    useState<OnboardingAccount | null>(null);
  const [confirming, setConfirming] = useState(false);

  const tiktokBusy = useRef(false);
  const pinterestBusy = useRef(false);
  const youtubeBusy = useRef(false);

  /* ------------------------------------------------------------------------
     ONBOARDING
  ------------------------------------------------------------------------ */

  const startOnboarding = (key: ChannelKey, connection: Connection) => {
    const channel = CHANNELS.find((c) => c.key === key);
    if (!channel) return;
    setConfirming(false);
    setOnboardingAccount(buildAccount(channel, connection));
    notify(`${channel.name} connected successfully!`, "success");
  };

  const handleConfirmAccount = () => {
    if (!onboardingAccount || confirming) return;
    const account = onboardingAccount;
    setConfirming(true);

    window.setTimeout(() => {
      setOnboardingAccount(null);
      setConfirming(false);
      navigate(INSIGHT_ROUTE);
      window.setTimeout(() => openFrequencyOnboarding(account, isDark), 150);
    }, 300);
  };

  const handleRejectAccount = () => {
    if (!onboardingAccount) return;
    const key = onboardingAccount.key;
    setOnboardingAccount(null);
    handleToggle(key);
  };

  const handleCloseOnboarding = () => {
    setOnboardingAccount(null);
    setConfirming(false);
  };

  /* ------------------------------------------------------------------------
     DERIVED
  ------------------------------------------------------------------------ */

  const connectedCount = useMemo(
    () => CHANNELS.filter((channel) => connections[channel.key].connected).length,
    [connections]
  );

  const limitReached = connectedCount >= PLAN.maxChannels;
  const slotsLeft = Math.max(0, PLAN.maxChannels - connectedCount);

  /* ------------------------------------------------------------------------
     SYNC OAUTH
  ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!userId) return;
    const basePath = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    const tiktokError = params.get("tiktok_error");
    const pinterestError = params.get("pinterest_error");
    const youtubeError = params.get("youtube_error");

    const fromUrl: Record<CacheProvider, boolean> = {
      tiktok: params.has("tiktok") || Boolean(tiktokError),
      pinterest: params.has("pinterest") || Boolean(pinterestError),
      youtube: params.has("youtube") || Boolean(youtubeError),
    };
    const oauthErrors: Record<CacheProvider, string | null> = {
      tiktok: tiktokError,
      pinterest: pinterestError,
      youtube: youtubeError,
    };

    const providers: CacheProvider[] = ["tiktok", "pinterest", "youtube"];
    const pendingReturn = new Set<CacheProvider>(readReturned());
    providers.forEach((p) => {
      if (fromUrl[p]) pendingReturn.add(p);
      if (oauthErrors[p]) pendingReturn.delete(p);
    });
    writeReturned([...pendingReturn]);

    const returned: Record<CacheProvider, boolean> = {
      tiktok: pendingReturn.has("tiktok"),
      pinterest: pendingReturn.has("pinterest"),
      youtube: pendingReturn.has("youtube"),
    };

    if (tiktokError)
      setErrorMessage(`Unable to connect to TikTok. ${tiktokError}`);
    if (pinterestError)
      setErrorMessage(`Unable to connect to Pinterest. ${pinterestError}`);
    if (youtubeError)
      setErrorMessage(`Unable to connect to YouTube Shorts. ${youtubeError}`);

    if (returned.tiktok) clearCache(userId, "tiktok");
    if (returned.pinterest) clearCache(userId, "pinterest");
    if (returned.youtube) clearCache(userId, "youtube");

    if (fromUrl.tiktok || fromUrl.pinterest || fromUrl.youtube) {
      OAUTH_PARAMS.forEach((key) => params.delete(key));
      const search = params.toString();
      window.history.replaceState(
        null,
        "",
        `${basePath}${search ? `?${search}` : ""}${window.location.hash}`
      );
    }

    let cancelled = false;

    const sync = (
      provider: CacheProvider,
      justReturned: boolean,
      fetchStatus: () => Promise<StatusResponse>
    ) => {
      const cached = justReturned ? null : readCache(userId, provider);
      if (cached) {
        setConnections((current) => ({
          ...current,
          [provider]: cached.connection,
        }));
        if (Date.now() - cached.savedAt < CACHE_MAX_AGE_MS) return;
      }

      void (async () => {
        try {
          const status = await fetchStatus();
          if (cancelled) return;
          if (justReturned) {
            writeReturned(readReturned().filter((p) => p !== provider));
          }
          const connection = toConnection(status);
          if (connection.connected) writeCache(userId, connection, provider);
          else clearCache(userId, provider);
          setConnections((current) => ({
            ...current,
            [provider]: connection,
          }));

          if (justReturned && connection.connected) {
            startOnboarding(provider, connection);
          }
        } catch (error) {
          console.warn(`[Stone] Could not load ${provider} status:`, error);
        }
      })();
    };

    sync("tiktok", returned.tiktok, getTikTokStatus);
    sync("pinterest", returned.pinterest, getPinterestStatus);
    sync("youtube", returned.youtube, getYouTubeStatus);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const refreshConnections = () => {
      setConnections((current) => ({
        ...current,
        tiktok:
          readCache(userId, "tiktok")?.connection ?? { connected: false },
        pinterest:
          readCache(userId, "pinterest")?.connection ?? { connected: false },
        youtube:
          readCache(userId, "youtube")?.connection ?? { connected: false },
      }));
    };

    window.addEventListener(CHANNELS_CHANGED_EVENT, refreshConnections);
    return () =>
      window.removeEventListener(CHANNELS_CHANGED_EVENT, refreshConnections);
  }, [userId]);

  /* ------------------------------------------------------------------------
     OAUTH
  ------------------------------------------------------------------------ */

  const handleTikTokToggle = async (isReconnect = false) => {
    if (tiktokBusy.current) return;
    tiktokBusy.current = true;
    setPendingKey("tiktok");
    let redirecting = false;
    try {
      if (connections.tiktok.connected) {
        await disconnectTikTok();
        if (userId) clearCache(userId, "tiktok");
        setConnections((current) => ({
          ...current,
          tiktok: { connected: false },
        }));
        if (!isReconnect) {
          notify("TikTok disconnected successfully!", "success");
          return;
        }
      }
      markReturning("tiktok");
      await startTikTokLogin();
      redirecting = true;
    } catch (error) {
      console.error("[Stone] TikTok OAuth error:", error);
      setErrorMessage(formatOAuthError("TikTok", error));
    } finally {
      if (!redirecting) {
        setPendingKey(null);
        tiktokBusy.current = false;
      }
    }
  };

  const handlePinterestToggle = async (isReconnect = false) => {
    if (pinterestBusy.current) return;
    pinterestBusy.current = true;
    setPendingKey("pinterest");
    let redirecting = false;
    try {
      if (connections.pinterest.connected) {
        await disconnectPinterest();
        if (userId) clearCache(userId, "pinterest");
        setConnections((current) => ({
          ...current,
          pinterest: { connected: false },
        }));
        if (!isReconnect) {
          notify("Pinterest disconnected successfully!", "success");
          return;
        }
      }
      if (import.meta.env.VITE_PINTEREST_MANUAL_TOKEN === "true") {
        const token = window.prompt("Pinterest access token:");
        if (!token?.trim()) {
          setPendingKey(null);
          return;
        }
        const account = await connectPinterestWithToken(token.trim());
        const connection: Connection = {
          connected: true,
          handle: account?.display_name ?? undefined,
          avatarUrl: account?.avatar_url ?? undefined,
        };
        if (userId) writeCache(userId, connection, "pinterest");
        setConnections((current) => ({ ...current, pinterest: connection }));
        startOnboarding("pinterest", connection);
      } else {
        markReturning("pinterest");
        await startPinterestLogin();
        redirecting = true;
      }
    } catch (error) {
      console.error("[Stone] Pinterest OAuth error:", error);
      setErrorMessage(formatOAuthError("Pinterest", error));
    } finally {
      if (!redirecting) {
        setPendingKey(null);
        pinterestBusy.current = false;
      }
    }
  };

  const handleYouTubeToggle = async (isReconnect = false) => {
    if (youtubeBusy.current) return;
    youtubeBusy.current = true;
    setPendingKey("youtube");
    let redirecting = false;
    try {
      if (connections.youtube.connected) {
        await disconnectYouTube();
        if (userId) clearCache(userId, "youtube");
        setConnections((current) => ({
          ...current,
          youtube: { connected: false },
        }));
        if (!isReconnect) {
          notify("YouTube Shorts disconnected successfully!", "success");
          return;
        }
      }
      markReturning("youtube");
      await startYouTubeLogin();
      redirecting = true;
    } catch (error) {
      console.error("[Stone] YouTube OAuth error:", error);
      setErrorMessage(formatOAuthError("YouTube Shorts", error));
    } finally {
      if (!redirecting) {
        setPendingKey(null);
        youtubeBusy.current = false;
      }
    }
  };

  const handlePlaceholderToggle = (key: ChannelKey) => {
    const wasConnected = connections[key].connected;
    const name = CHANNELS.find((c) => c.key === key)?.name ?? key;
    setPendingKey(key);
    window.setTimeout(() => {
      if (wasConnected) {
        setConnections((current) => ({
          ...current,
          [key]: { connected: false },
        }));
        notify(`${name} disconnected successfully!`, "success");
      } else {
        const connection: Connection = {
          connected: true,
          handle: mockHandleFor(key),
        };
        setConnections((current) => ({ ...current, [key]: connection }));
        startOnboarding(key, connection);
      }
      setPendingKey(null);
    }, 450);
  };

  const handlePlaceholderReconnect = (key: ChannelKey) => {
    setPendingKey(key);
    window.setTimeout(() => {
      const connection: Connection = {
        connected: true,
        handle: mockHandleFor(key),
      };
      setConnections((current) => ({ ...current, [key]: connection }));
      startOnboarding(key, connection);
      setPendingKey(null);
    }, 450);
  };

  function handleToggle(key: ChannelKey) {
    setErrorMessage(null);
    if (!connections[key].connected && limitReached) {
      setErrorMessage(
        `Your ${PLAN.name} plan allows up to ${PLAN.maxChannels} channels. Upgrade to connect more.`
      );
      return;
    }
    if (key === "tiktok") return void handleTikTokToggle();
    if (key === "pinterest") return void handlePinterestToggle();
    if (key === "youtube") return void handleYouTubeToggle();
    handlePlaceholderToggle(key);
  }

  function handleReconnect(key: ChannelKey) {
    setErrorMessage(null);
    if (key === "tiktok") return void handleTikTokToggle(true);
    if (key === "pinterest") return void handlePinterestToggle(true);
    if (key === "youtube") return void handleYouTubeToggle(true);
    handlePlaceholderReconnect(key);
  }

  const handleUpgrade = () => notify("Billing isn't available yet", "error");

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <>
      <p className={cx("text-[13.5px] leading-relaxed", tokens.body)}>
        Your connected accounts at a glance. Click on a channel to connect it.
      </p>

      {/* PLAN */}
      <section
        className={cx(
          "flex flex-col justify-between gap-5 rounded-2xl border p-[clamp(18px,2.4vw,28px)] shadow-sm sm:flex-row sm:items-center",
          tokens.card,
          tokens.cardBorder
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cx(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              tokens.muted,
              tokens.heading
            )}
          >
            <BoltIcon className="h-6 w-6" />
          </div>
          <div>
            <h3
              className={cx(
                "font-display text-[17px] font-semibold tracking-[-0.01em]",
                tokens.heading
              )}
            >
              {PLAN.name} plan
            </h3>
            <p className={cx("mt-1 text-[13px] leading-relaxed", tokens.body)}>
              You can connect up to {PLAN.maxChannels} channels.{" "}
              {slotsLeft > 0
                ? `${slotsLeft} ${slotsLeft === 1 ? "slot" : "slots"} remaining.`
                : "Limit reached."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUpgrade}
          className={cx(
            "shrink-0 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition",
            tokens.ring,
            tokens.primary
          )}
        >
          Upgrade plan
        </button>
      </section>

      {/* ERREUR */}
      {errorMessage && (
        <div
          role="alert"
          className={cx(
            "flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px]",
            isDark ? "text-red-400" : "text-red-600"
          )}
        >
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setErrorMessage(null)}
            className="rounded-md p-1 hover:bg-red-500/10"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* LISTE DES CHANNELS */}
      <div
        className={cx(
          "rounded-2xl border divide-y shadow-sm",
          tokens.card,
          tokens.cardBorder,
          tokens.divide
        )}
      >
        {CHANNELS.map((channel, index) => (
          <div
            key={channel.key}
            className={cx(
              index === 0 && "rounded-t-2xl",
              index === CHANNELS.length - 1 && "rounded-b-2xl"
            )}
          >
            <ChannelRow
              channel={channel}
              connection={connections[channel.key]}
              pending={pendingKey === channel.key}
              isDark={isDark}
              tokens={tokens}
              onToggle={() => handleToggle(channel.key)}
              onReconnect={() => handleReconnect(channel.key)}
            />
          </div>
        ))}
      </div>

      <p className={cx("text-[12px]", tokens.subtle)}>Secure OAuth connections</p>

      {onboardingAccount && (
        <ConfirmAccountModal
          account={onboardingAccount}
          isDark={isDark}
          loading={confirming}
          onConfirm={handleConfirmAccount}
          onReject={handleRejectAccount}
          onClose={handleCloseOnboarding}
        />
      )}
    </>
  );
}