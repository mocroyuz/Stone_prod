// src/pages/Channels.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";

import DashboardSidebar, {
  useSidebarOffset,
} from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import ConnectChannelModal from "../components/ConnectChannelModal";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import {
  ConfirmAccountModal,
  openFrequencyOnboarding,
  type OnboardingAccount,
} from "../components/OnboardingModals";
import HelpChatButton from "../components/Helpchatbutton";
import { useTheme } from "../hooks/useTheme";
import { useUser } from "../contexts/UserContext";

import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "../components/IntegrationIcons";

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

type ToastState = {
  id: number;
  message: string;
  type: "success" | "error";
};

/* ============================================================================
   SHELL (identique à Home)
============================================================================ */

const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#09090a]" : "bg-[#f5f3ef]";

const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";

const panelSurfaceClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-white/[0.03]"
    : "border-black/[0.06] bg-[#f6f4f0]";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-500" : "text-neutral-400";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ============================================================================
   THEME TOKENS (alignés sur le panneau Home)
============================================================================ */

type ThemeTokens = {
  text: string;
  muted: string;
  card: string;
  cardHover: string;
  border: string;
  borderHover: string;
  icon: string;
  iconConnected: string;
  button: string;
  danger: string;
  ring: string;
  avatarBadgeBg: string;
};

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
    name: "YouTube",
    subtitle: "Channel",
    accountLabel: "YouTube Channel",
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

function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

function MoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function DisconnectIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h11" />
      <path d="M15 7h3v10h-3" />
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

function BoltIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2.5 5 13.2h5.6L9.5 21.5l8-10.7h-5.6L13 2.5Z" />
    </Svg>
  );
}

function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12.5 3 3 5-6" />
    </Svg>
  );
}

function AlertCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </Svg>
  );
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

const RETURN_KEY = "stone:oauth-returned";

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
   TOAST
============================================================================ */

function Toast({
  toast,
  isDark,
  onClose,
}: {
  toast: ToastState;
  isDark: boolean;
  onClose: () => void;
}) {
  const Icon = toast.type === "success" ? CheckCircleIcon : AlertCircleIcon;

  return (
    <>
      <style>{`
        @keyframes stone-toast-in {
          from { opacity: 0; transform: translate(-50%, 12px) scale(0.98); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stone-toast { animation-duration: 0.01ms !important; }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        className={[
          "stone-toast fixed bottom-6 left-1/2 z-[110] flex max-w-[calc(100vw-32px)] items-center gap-3.5 rounded-2xl border py-3.5 pl-4 pr-3 shadow-2xl",
          isDark
            ? "border-white/[0.08] bg-[#16161a] text-white"
            : "border-black/[0.06] bg-white text-neutral-900",
        ].join(" ")}
        style={{
          animation: "stone-toast-in 0.28s cubic-bezier(.2,.9,.25,1) both",
        }}
      >
        <Icon
          className={[
            "h-[22px] w-[22px] shrink-0",
            toast.type === "error"
              ? "text-rose-400"
              : isDark
                ? "text-white"
                : "text-neutral-900",
          ].join(" ")}
        />
        <span className="text-[14px] font-medium tracking-[-0.01em]">
          {toast.message}
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className={[
            "ml-1 flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            isDark
              ? "text-neutral-500 hover:bg-white/[0.07] hover:text-white"
              : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900",
          ].join(" ")}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

/* ============================================================================
   CHANNEL ICON
============================================================================ */

function ChannelIcon({
  channel,
  connection,
  t,
}: {
  channel: Channel;
  connection: Connection;
  t: ThemeTokens;
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
          className={[
            "absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center",
            "rounded-[5px] text-black ring-2",
            t.avatarBadgeBg,
          ].join(" ")}
        >
          <Icon className="h-[11px] w-[11px]" size={11} />
        </span>
      </span>
    );
  }

  return (
    <div
      className={[
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border",
        connection.connected ? t.iconConnected : t.icon,
      ].join(" ")}
    >
      <Icon className="h-[21px] w-[21px]" size={21} />
    </div>
  );
}

/* ============================================================================
   CHANNEL CARD
============================================================================ */

type ChannelCardProps = {
  channel: Channel;
  connection: Connection;
  pending: boolean;
  disabled: boolean;
  t: ThemeTokens;
  isDark: boolean;
  onToggle: () => void;
};

function ChannelCard({
  channel,
  connection,
  pending,
  disabled,
  t,
  isDark,
  onToggle,
}: ChannelCardProps) {
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

  return (
    <article
      className={[
        "group relative rounded-2xl border px-4 py-4 transition-all duration-200",
        t.card,
        t.border,
        
        !disabled && t.cardHover,
        !disabled && t.borderHover,
        !disabled && "hover:shadow-[0_12px_35px_rgba(0,0,0,0.18)]",
      ].join(" ")}
    >
      <div className="flex items-center gap-3.5">
        <ChannelIcon channel={channel} connection={connection} t={t} />

        <div className="min-w-0 flex-1">
          <p
            className={[
              "truncate text-[13px] font-semibold tracking-[-0.01em]",
              t.text,
            ].join(" ")}
          >
            {isConnected ? connection.handle || channel.name : channel.name}
          </p>
          {!isConnected && (
            <p className={["mt-0.5 truncate text-[10.5px]", t.muted].join(" ")}>
              {channel.subtitle}
            </p>
          )}
        </div>

        {isConnected && (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              aria-label={`Options for ${channel.name}`}
              onClick={() => setMenuOpen((value) => !value)}
              className={[
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                t.muted,
                isDark
                  ? "hover:bg-white/[0.06] hover:text-white"
                  : "hover:bg-black/[0.05] hover:text-neutral-900",
                t.ring,
              ].join(" ")}
            >
              <MoreIcon className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                className={[
                  "absolute right-0 top-10 z-50 w-40 rounded-xl border p-1 shadow-xl",
                  isDark
                    ? "border-white/[0.08] bg-[#16161a]"
                    : "border-black/[0.06] bg-white",
                ].join(" ")}
              >
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMenuOpen(false);
                    onToggle();
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-medium disabled:opacity-40",
                    isDark
                      ? "text-rose-400 hover:bg-rose-500/[0.07]"
                      : "text-rose-600 hover:bg-rose-500/[0.07]",
                  ].join(" ")}
                >
                  <DisconnectIcon className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* ============================================================================
   PAGE
============================================================================ */

export default function Channels() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();
  const { user } = useUser();
  const userId = user?.id ?? null;

  /* ------------------------------------------------------------------------
     STATE
  ------------------------------------------------------------------------ */

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
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [onboardingAccount, setOnboardingAccount] =
    useState<OnboardingAccount | null>(null);
  const [confirming, setConfirming] = useState(false);

  const tiktokBusy = useRef(false);
  const pinterestBusy = useRef(false);
  const youtubeBusy = useRef(false);
  const toastTimer = useRef<number | null>(null);

  /* ------------------------------------------------------------------------
     TOAST
  ------------------------------------------------------------------------ */

  const showNotification = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const dismissToast = () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(null);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  /* ------------------------------------------------------------------------
     ONBOARDING
  ------------------------------------------------------------------------ */

  const startOnboarding = (key: ChannelKey, connection: Connection) => {
    const channel = CHANNELS.find((c) => c.key === key);
    if (!channel) return;
    setShowConnectModal(false);
    setConfirming(false);
    setOnboardingAccount(buildAccount(channel, connection));
    showNotification(`${channel.name} connected successfully!`);
  };

  const handleConfirmAccount = () => {
    if (!onboardingAccount || confirming) return;
    const account = onboardingAccount;
    setConfirming(true);

    window.setTimeout(() => {
      setOnboardingAccount(null);
      setConfirming(false);
      window.location.hash = `#${INSIGHT_ROUTE}`;
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

  const connectedChannels = useMemo(
    () => CHANNELS.filter((channel) => connections[channel.key].connected),
    [connections]
  );

  const connectedCount = connectedChannels.length;
  const limitReached = connectedCount >= PLAN.maxChannels;
  const slotsLeft = Math.max(0, PLAN.maxChannels - connectedCount);
  const visibleChannels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return connectedChannels;
    return connectedChannels.filter((channel) =>
      `${channel.name} ${channel.accountLabel} ${connections[channel.key].handle ?? ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [connectedChannels, connections, query]);

  const handleBottomBarChange = (id: BottomBarTab) => {
    switch (id) {
      case "add":
        setIsFolderOpen(false);
        setIsNewPostOpen(true);
        break;
      case "files":
        setIsFolderOpen((open) => !open);
        break;
    }
  };

  const handleCreatePost = async (payload: NewPostPayload) => {
    throw new Error(unavailablePostActionMessage(payload));
  };

  /* ------------------------------------------------------------------------
     SYNC OAUTH
  ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!userId) return;
    const hash = window.location.hash;
    const queryIndex = hash.indexOf("?");
    const basePath = queryIndex === -1 ? hash : hash.slice(0, queryIndex);
    const params = new URLSearchParams(
      queryIndex === -1 ? "" : hash.slice(queryIndex + 1)
    );

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
      setErrorMessage(`Unable to connect to YouTube. ${youtubeError}`);

    if (returned.tiktok) clearCache(userId, "tiktok");
    if (returned.pinterest) clearCache(userId, "pinterest");
    if (returned.youtube) clearCache(userId, "youtube");

    if (fromUrl.tiktok || fromUrl.pinterest || fromUrl.youtube) {
      [
        "tiktok",
        "tiktok_error",
        "pinterest",
        "pinterest_error",
        "youtube",
        "youtube_error",
      ].forEach((key) => params.delete(key));
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${basePath}${
          query ? `?${query}` : ""
        }`
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

  /* ------------------------------------------------------------------------
     THEME TOKENS
  ------------------------------------------------------------------------ */

  const t = useMemo<ThemeTokens>(
    () =>
      isDark
        ? {
            text: "text-white",
            muted: "text-neutral-500",
            card: "bg-[#141416]",
            cardHover: "hover:bg-[#19191c]",
            border: "border-white/[0.07]",
            borderHover: "hover:border-white/[0.12]",
            icon: "border-white/[0.08] bg-white/[0.04] text-neutral-300",
            iconConnected: "border-white/20 bg-white/10 text-white",
            button: "bg-white/[0.06] hover:bg-white/[0.12]",
            danger: "text-rose-400",
            ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
            avatarBadgeBg: "bg-[#0f0f11] text-white ring-[#0f0f11]",
          }
        : {
            text: "text-neutral-900",
            muted: "text-neutral-500",
            card: "bg-white",
            cardHover: "hover:bg-[#f6f4f0]",
            border: "border-black/[0.06]",
            borderHover: "hover:border-black/[0.12]",
            icon: "border-black/[0.06] bg-[#f6f4f0] text-neutral-600",
            iconConnected: "border-black/10 bg-black/[0.04] text-neutral-900",
            button: "bg-black/[0.04] hover:bg-black/[0.07]",
            danger: "text-rose-600",
            ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25",
            avatarBadgeBg: "bg-white text-black ring-white",
          },
    [isDark]
  );

  /* ------------------------------------------------------------------------
     OAUTH
  ------------------------------------------------------------------------ */

  const handleTikTokToggle = async () => {
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
        showNotification("TikTok disconnected successfully!");
      } else {
        markReturning("tiktok");
        await startTikTokLogin();
        redirecting = true;
      }
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

  const handlePinterestToggle = async () => {
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
        showNotification("Pinterest disconnected successfully!");
      } else if (import.meta.env.VITE_PINTEREST_MANUAL_TOKEN === "true") {
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

  const handleYouTubeToggle = async () => {
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
        showNotification("YouTube disconnected successfully!");
      } else {
        markReturning("youtube");
        await startYouTubeLogin();
        redirecting = true;
      }
    } catch (error) {
      console.error("[Stone] YouTube OAuth error:", error);
      setErrorMessage(formatOAuthError("YouTube", error));
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
        showNotification(`${name} disconnected successfully!`);
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

  const handleUpgrade = () => console.log("[Stone] Upgrade clicked");
  const openModal = () => {
    setErrorMessage(null);
    setShowConnectModal(true);
  };
  const closeModal = () => setShowConnectModal(false);

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <main
      className={[
        "relative h-screen w-full overflow-hidden",
        "transition-colors duration-300",
        pageBgClass(isDark),
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      {/* Zone à droite de la sidebar : marge autour du panneau arrondi */}
      <div
        className={[
          "h-full py-3 pr-3",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        {/* PANNEAU ARRONDI : c'est lui qui scrolle */}
        <div
          className={[
            "h-full overflow-y-auto overflow-x-hidden",
            "rounded-[28px] border",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "transition-colors duration-300",
            mainPanelClass(isDark),
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto flex w-full max-w-[1100px]",
              "flex-col px-[clamp(18px,3vw,48px)]",
              "pb-[120px] pt-[clamp(18px,3vw,30px)]",
            ].join(" ")}
          >
            {/* HEADER */}
            <header className="flex shrink-0 items-center justify-between gap-4">
              <div>
                <h1
                  className={[
                    "text-[24px] font-semibold tracking-[-0.035em]",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  Channels
                </h1>
                <p
                  className={[
                    "mt-0.5 text-[13px] font-medium",
                    mutedClass(isDark),
                  ].join(" ")}
                >
                  Your connected accounts at a glance.
                </p>
              </div>
              <button
                type="button"
                onClick={openModal}
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-150 hover:-translate-y-px active:scale-[0.98]",
                  focusRingClass(isDark),
                  isDark
                    ? "bg-white text-neutral-900 hover:bg-neutral-200"
                    : "bg-neutral-900 text-white hover:bg-neutral-800",
                ].join(" ")}
              >
                Connect Channel
              </button>
            </header>

            {/* PLAN BANNER */}
            <div
              className={[
                "mt-6 flex items-start gap-4 rounded-2xl border p-5",
                panelSurfaceClass(isDark),
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isDark
                    ? "bg-white/[0.06] text-neutral-300"
                    : "bg-white text-neutral-600 shadow-sm ring-1 ring-black/[0.05]",
                ].join(" ")}
              >
                <BoltIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3
                  className={[
                    "text-[13px] font-semibold",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  Get to know your plan
                </h3>
                <p className={["mt-1 text-[12px]", mutedClass(isDark)].join(" ")}>
                  You are on the {PLAN.name} plan and can connect up to{" "}
                  {PLAN.maxChannels} channels.
                </p>
                <button
                  type="button"
                  onClick={handleUpgrade}
                  className={[
                    "mt-3 rounded-lg px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
                    focusRingClass(isDark),
                    isDark
                      ? "bg-white/[0.06] text-white hover:bg-white/[0.12]"
                      : "bg-white text-neutral-900 shadow-sm ring-1 ring-black/[0.05] hover:bg-neutral-50",
                  ].join(" ")}
                >
                  Upgrade Plan
                </button>
              </div>
            </div>

            {/* ERROR */}
            {errorMessage && (
              <div
                role="alert"
                className={[
                  "mt-4 flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-3 text-[12px]",
                  isDark
                    ? "border-rose-500/20 bg-rose-500/[0.06] text-rose-400"
                    : "border-rose-500/20 bg-rose-500/[0.06] text-rose-600",
                ].join(" ")}
              >
                <span className="flex-1">{errorMessage}</span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setErrorMessage(null)}
                  className={[
                    "rounded-md p-1",
                    isDark ? "hover:bg-rose-500/10" : "hover:bg-rose-500/10",
                  ].join(" ")}
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* CONTENT */}
            {connectedChannels.length === 0 ? (
              <div
                className={[
                  "mt-5 flex min-h-[380px] flex-col items-center justify-center",
                  "rounded-2xl border px-6 py-12 text-center",
                  panelSurfaceClass(isDark),
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={openModal}
                  className={[
                    "group flex h-16 w-16 items-center justify-center rounded-full transition-colors",
                    focusRingClass(isDark),
                    isDark
                      ? "border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]"
                      : "border border-black/[0.06] bg-white shadow-sm hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <PlusIcon
                    className={[
                      "h-7 w-7 transition-colors",
                      isDark
                        ? "text-neutral-400 group-hover:text-white"
                        : "text-neutral-500 group-hover:text-neutral-900",
                    ].join(" ")}
                  />
                </button>
                <h2
                  className={[
                    "mt-5 text-[16px] font-semibold tracking-[-0.01em]",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  Connect a channel to get started
                </h2>
                <p
                  className={[
                    "mt-2 max-w-sm text-[12.5px]",
                    mutedClass(isDark),
                  ].join(" ")}
                >
                  Once connected, you'll see your channels listed here.
                </p>
                <button
                  type="button"
                  onClick={openModal}
                  className={[
                    "mt-6 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-colors",
                    focusRingClass(isDark),
                    isDark
                      ? "bg-white text-neutral-900 hover:bg-neutral-200"
                      : "bg-neutral-900 text-white hover:bg-neutral-800",
                  ].join(" ")}
                >
                  Connect Channel
                </button>
              </div>
            ) : visibleChannels.length === 0 ? (
              <div
                className={[
                  "mt-5 flex min-h-[280px] flex-col items-center justify-center gap-3",
                  "rounded-2xl border px-4 py-10 text-center",
                  panelSurfaceClass(isDark),
                ].join(" ")}
              >
                <p className={["text-[13px]", mutedClass(isDark)].join(" ")}>
                  No channels match your search.
                </p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={[
                    "rounded-full border px-4 py-1.5 text-[12px] font-semibold transition",
                    focusRingClass(isDark),
                    isDark
                      ? "border-white/10 text-white hover:bg-white/[0.07]"
                      : "border-black/10 text-neutral-900 hover:bg-neutral-100",
                  ].join(" ")}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleChannels.map((channel) => (
                  <ChannelCard
                    key={channel.key}
                    channel={channel}
                    connection={connections[channel.key]}
                    pending={pendingKey === channel.key}
                    disabled={false}
                    t={t}
                    isDark={isDark}
                    onToggle={() => handleToggle(channel.key)}
                  />
                ))}
              </div>
            )}

            {/* FOOTER */}
            <div
              className={[
                "mt-5 flex shrink-0 items-center justify-between text-[10.5px]",
                mutedClass(isDark),
              ].join(" ")}
            >
              <span>
                {slotsLeft > 0
                  ? `${slotsLeft} ${slotsLeft === 1 ? "slot" : "slots"} remaining`
                  : "Plan limit reached"}
              </span>
              <span>Secure OAuth connections</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CONNECT CHANNEL */}
      {showConnectModal && (
        <ConnectChannelModal
          channels={CHANNELS}
          connections={connections}
          pendingKey={pendingKey}
          limitReached={limitReached}
          planName={PLAN.name}
          realOAuthKeys={REAL_OAUTH}
          errorMessage={errorMessage}
          isDark={isDark}
          onToggle={handleToggle}
          onClose={closeModal}
        />
      )}

      {/* ONBOARDING ÉTAPE 1 */}
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

      {/* TOAST */}
      {toast && (
        <Toast key={toast.id} toast={toast} isDark={isDark} onClose={dismissToast} />
      )}

      <Folder
        isOpen={isFolderOpen}
        onClose={() => setIsFolderOpen(false)}
        isDark={isDark}
        offsetLeft={sidebarOffset}
      />
      <BottomBar
        isDark={isDark}
        offsetLeft={sidebarOffset}
        active={isFolderOpen ? "files" : null}
        onChange={handleBottomBarChange}
        query={query}
        onQueryChange={setQuery}
      />
      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={() => setIsNewPostOpen(false)}
        isDark={isDark}
        onSubmit={handleCreatePost}
        onRequestOpen={() => setIsNewPostOpen(true)}
      />

      {/* HELP — même bouton que sur Home */}
      <HelpChatButton isDark={isDark} />
    </main>
  );
}