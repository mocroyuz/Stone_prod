import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import { useUser } from "../contexts/UserContext";

import {
  useConnectedChannels,
  type ConnectedChannel,
} from "../hooks/useConnectedChannels";

import DashboardSidebar, {
  useSidebarOffset,
} from "../components/DashboardSidebar";

import NewPostModal, {
  type NewPostPayload,
} from "../components/Newpostmodal";

import ConnectChannelModal from "../components/ConnectChannelModal";
import HelpChatButton from "../components/Helpchatbutton";
import BottomBar, {
  type BottomBarTab,
} from "../components/Bottombar";

import Folder from "../components/Folder";

import {
  getCurrentUser,
  type UserProfile,
} from "../services/supabase";

import {
  CHANNELS,
  PLAN,
  REAL_OAUTH,
  type ChannelKey,
  type ConnectionState,
} from "./channels";

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

import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  MessageSquare,
  Plus,
} from "lucide-react";

import {
  XIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
} from "../components/IntegrationIcons";

/* ============================================================
   DESIGN TOKENS — style Linear/Vercel : monochrome, sections
   nettes, typographie fine, hairlines. Dark: #09090b / #0f0f11.
============================================================ */

const ink = {
  page: (isDark: boolean) => (isDark ? "bg-[#09090b]" : "bg-[#fcfcfc]"),

  card: (isDark: boolean) =>
    isDark ? "border-[#1c1c1f] bg-[#0f0f11]" : "border-black/[0.08] bg-white",

  hairline: (isDark: boolean) =>
    isDark ? "border-[#1c1c1f]" : "border-black/[0.08]",

  title: (isDark: boolean) => (isDark ? "text-[#ededed]" : "text-[#171717]"),
  body: (isDark: boolean) => (isDark ? "text-[#a0a0a3]" : "text-[#525252]"),
  faint: (isDark: boolean) => (isDark ? "text-[#5c5c5f]" : "text-[#8f8f8f]"),

  avatarRing: (isDark: boolean) =>
    isDark ? "ring-[#0f0f11]" : "ring-white",
};

/* ============================================================
   USER CACHE
============================================================ */

const userProfileCache = {
  profile: null as UserProfile | null,
};

/* ============================================================
   CHANNEL CONNECTIONS (même logique que la page Channels)
============================================================ */

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

const initialConnections: ConnectionState = {
  instagram: { connected: false },
  tiktok: { connected: false },
  youtube: { connected: false },
  facebook: { connected: false },
  pinterest: { connected: false },
  threads: { connected: false },
};

const OAUTH_PROVIDERS: Record<
  CacheProvider,
  {
    label: string;
    getStatus: () => Promise<StatusResponse>;
    login: () => Promise<unknown>;
    disconnect: () => Promise<unknown>;
  }
> = {
  tiktok: {
    label: "TikTok",
    getStatus: getTikTokStatus,
    login: startTikTokLogin,
    disconnect: disconnectTikTok,
  },
  pinterest: {
    label: "Pinterest",
    getStatus: getPinterestStatus,
    login: startPinterestLogin,
    disconnect: disconnectPinterest,
  },
  youtube: {
    label: "YouTube",
    getStatus: getYouTubeStatus,
    login: startYouTubeLogin,
    disconnect: disconnectYouTube,
  },
};

const PROVIDER_KEYS = Object.keys(OAUTH_PROVIDERS) as CacheProvider[];

function formatOAuthError(provider: string, error: unknown): string {
  const raw = error instanceof Error ? error.message : "";

  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Unable to reach the server (network or CORS error). Check that the backend is running and that VITE_API_URL is correct.";
  }

  return raw
    ? `Unable to connect to ${provider}. ${raw}`
    : `Unable to connect to ${provider}.`;
}

function toConnection(status: StatusResponse): Connection {
  if (!status.connected) return { connected: false };

  const account = status.account;

  return {
    connected: true,
    handle: account?.display_name ?? undefined,
    avatarUrl: account?.avatar_url ?? account?.avatarUrl ?? undefined,
  };
}

/* ============================================================
   NETWORKS
============================================================ */

type SocialNetworkKey =
  | "x"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest";

const NETWORK_ICONS: Record<
  SocialNetworkKey,
  (props: { className?: string }) => ReactElement
> = {
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
};

function getNetworkId(
  channel: ConnectedChannel
): SocialNetworkKey | null {
  const c = channel as unknown as Record<string, unknown>;

  const raw = String(
    c.platform ?? c.network ?? c.provider ?? channel.key
  )
    .toLowerCase()
    .trim();

  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("insta")) return "instagram";
  if (raw.includes("youtube") || raw === "yt") return "youtube";
  if (raw.includes("facebook") || raw === "fb") return "facebook";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("pinterest")) return "pinterest";
  if (raw === "x" || raw.includes("twitter")) return "x";

  return null;
}

/* ============================================================
   GREETING
============================================================ */

function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  if (hour >= 18 && hour < 22) return "Good evening";

  return "Good night";
}

/* ============================================================
   SECTION HEADER — étiquette fine type Linear
============================================================ */

function SectionHeader({
  isDark,
  title,
  action,
}: {
  isDark: boolean;
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2
        className={[
          "text-[11px] font-medium uppercase tracking-[0.08em]",
          ink.faint(isDark),
        ].join(" ")}
      >
        {title}
      </h2>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={[
            "flex items-center gap-1 text-[11px] font-medium transition-colors",
            ink.body(isDark),
            isDark ? "hover:text-white" : "hover:text-black",
          ].join(" ")}
        >
          {action.label}
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ============================================================
   AVATAR
============================================================ */

function GreetingAvatar({
  avatarUrl,
  initials,
  isDark,
}: {
  avatarUrl?: string | null;
  initials: string;
  isDark: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        onError={() => setFailed(true)}
        className="h-8 w-8 rounded-lg object-cover"
      />
    );
  }

  return (
    <div
      className={[
        "flex h-8 w-8 items-center justify-center rounded-lg border",
        "text-[11px] font-medium",
        ink.hairline(isDark),
        isDark
          ? "bg-[#161618] text-[#d4d4d4]"
          : "bg-[#f4f4f5] text-[#3f3f3f]",
      ].join(" ")}
    >
      {initials}
    </div>
  );
}

/* ============================================================
   CLOCK — texte fin aligné à droite
============================================================ */

function ClockDisplay({ isDark, now }: { isDark: boolean; now: Date }) {
  const time = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const date = now.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="text-right">
      <p
        className={[
          "text-[13px] font-normal tabular-nums tracking-tight",
          ink.title(isDark),
        ].join(" ")}
      >
        {time}
      </p>

      <p className={["mt-0.5 text-[11px]", ink.faint(isDark)].join(" ")}>
        {date}
      </p>
    </div>
  );
}

/* ============================================================
   STAT — pas d'icône, gros chiffre, hairline
============================================================ */

function Stat({
  isDark,
  label,
  value,
  change,
}: {
  isDark: boolean;
  label: string;
  value: string;
  change: string;
}) {
  const positive = change.startsWith("+");

  return (
    <div className="min-w-0">
      <p className={["text-[11px] font-normal", ink.faint(isDark)].join(" ")}>
        {label}
      </p>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={[
            "text-[24px] font-semibold tracking-[-0.03em]",
            ink.title(isDark),
          ].join(" ")}
        >
          {value}
        </span>

        <span
          className={[
            "text-[11px] font-medium tabular-nums",
            positive
              ? isDark
                ? "text-[#4ade80]"
                : "text-emerald-600"
              : isDark
                ? "text-[#f87171]"
                : "text-rose-600",
          ].join(" ")}
        >
          {change}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   STREAK — cases carrées, traits nets
============================================================ */

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function Streak({
  isDark,
  completedDays = [0],
}: {
  isDark: boolean;
  completedDays?: number[];
}) {
  const todayIndex = (new Date().getDay() + 6) % 7;

  return (
    <div
      className={["rounded-lg border px-4 py-3", ink.card(isDark)].join(" ")}
    >
      <p
        className={[
          "text-[11px] font-medium uppercase tracking-[0.08em]",
          ink.faint(isDark),
        ].join(" ")}
      >
        Streak
      </p>

      <div className="mt-3 flex items-end justify-between">
        {WEEK_LABELS.map((label, index) => {
          const done = completedDays.includes(index);
          const isToday = index === todayIndex;

          return (
            <div key={index} className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-[6px] border transition-colors",
                  done
                    ? isDark
                      ? "border-[#ededed] bg-[#ededed] text-[#09090b]"
                      : "border-black bg-black text-white"
                    : [
                        ink.hairline(isDark),
                        isToday ? (isDark ? "bg-[#1c1c1f]" : "bg-[#f4f4f5]") : "",
                      ],
                ].join(" ")}
                aria-label={`Day ${index + 1}${done ? " completed" : ""}`}
              >
                {done && <Check className="h-3 w-3" strokeWidth={2.5} />}
              </div>

              <span
                className={[
                  "text-[10px]",
                  isToday ? "font-medium" : "font-normal",
                  isToday ? ink.title(isDark) : ink.faint(isDark),
                ].join(" ")}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   CHANNEL AVATAR
============================================================ */

function ChannelAvatar({
  channel,
  isDark,
  overlap,
}: {
  channel: ConnectedChannel;
  isDark: boolean;
  overlap: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [channel.avatarUrl]);

  const label = channel.handle || channel.name || "Channel";

  const initial =
    label.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  const networkId = getNetworkId(channel);

  const NetworkIcon = networkId ? NETWORK_ICONS[networkId] : null;

  return (
    <div
      className="relative h-7 w-7 shrink-0"
      style={{ marginLeft: overlap ? -6 : 0 }}
      title={label}
    >
      {channel.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={[
            "h-full w-full rounded-md object-cover ring-2",
            ink.avatarRing(isDark),
          ].join(" ")}
        />
      ) : (
        <div
          className={[
            "flex h-full w-full items-center justify-center rounded-md border",
            "text-[10px] font-medium ring-2",
            ink.hairline(isDark),
            ink.avatarRing(isDark),
            isDark ? "bg-[#161618] text-[#d4d4d4]" : "bg-[#f4f4f5] text-[#3f3f3f]",
          ].join(" ")}
        >
          {initial}
        </div>
      )}

      {NetworkIcon && (
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center",
            "justify-center rounded-full ring-2",
            isDark ? "bg-[#ededed] text-black" : "bg-black text-white",
            ink.avatarRing(isDark),
          ].join(" ")}
        >
          <NetworkIcon className="h-2 w-2" />
        </span>
      )}
    </div>
  );
}

/* ============================================================
   CHANNELS ROW — rangée fine
============================================================ */

function Channels({
  isDark,
  channels,
  onAdd,
}: {
  isDark: boolean;
  channels: ConnectedChannel[];
  onAdd: () => void;
}) {
  return (
    <div
      className={[
        "flex min-h-[56px] items-center justify-between gap-4 rounded-lg border px-4",
        ink.card(isDark),
      ].join(" ")}
    >
      {channels.length === 0 ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Connect a channel"
            onClick={onAdd}
            className={[
              "flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
              ink.hairline(isDark),
              isDark
                ? "bg-[#161618] text-[#d4d4d4] hover:bg-[#1c1c1f]"
                : "bg-[#f4f4f5] text-[#3f3f3f] hover:bg-[#ebebeb]",
            ].join(" ")}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <div>
            <p className={["text-[12px] font-medium", ink.title(isDark)].join(" ")}>
              Connect your first channel
            </p>

            <p className={["mt-0.5 text-[11px]", ink.faint(isDark)].join(" ")}>
              Start publishing to social networks.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            {channels.slice(0, 6).map((channel, index) => (
              <ChannelAvatar
                key={channel.key}
                channel={channel}
                isDark={isDark}
                overlap={index > 0}
              />
            ))}

            <button
              type="button"
              aria-label="Connect another channel"
              title="Connect another channel"
              onClick={onAdd}
              className={[
                "-ml-1.5 flex h-7 w-7 shrink-0 items-center justify-center",
                "relative z-10 rounded-md border transition-colors ring-2",
                ink.hairline(isDark),
                ink.avatarRing(isDark),
                isDark
                  ? "bg-[#161618] text-[#a0a0a3] hover:text-white"
                  : "bg-white text-[#525252] hover:text-black",
              ].join(" ")}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <p className={["text-[12px]", ink.body(isDark)].join(" ")}>
            {channels.length} {channels.length === 1 ? "channel" : "channels"} connected
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => (channels.length === 0 ? onAdd() : navigate("channels"))}
        className={[
          "flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5",
          "text-[11px] font-medium transition-colors",
          ink.body(isDark),
          isDark
            ? "hover:bg-[#161618] hover:text-white"
            : "hover:bg-[#f4f4f5] hover:text-black",
        ].join(" ")}
      >
        {channels.length === 0 ? "Connect" : "Manage"}
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ============================================================
   EMPTY PANEL — état vide discret
============================================================ */

function EmptyPanel({
  isDark,
  icon,
  line,
  hint,
  action,
}: {
  isDark: boolean;
  icon: ReactNode;
  line: string;
  hint: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className={[
        "flex min-h-[180px] flex-col items-center justify-center gap-1",
        "rounded-lg border px-4 py-8 text-center",
        ink.card(isDark),
      ].join(" ")}
    >
      <div className={["mb-2", ink.faint(isDark)].join(" ")}>{icon}</div>

      <p className={["text-[12px] font-medium", ink.title(isDark)].join(" ")}>
        {line}
      </p>

      <p className={["text-[11px]", ink.faint(isDark)].join(" ")}>{hint}</p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={[
            "mt-4 flex items-center gap-1.5 rounded-md px-3 py-1.5",
            "text-[11px] font-medium transition-colors",
            isDark
              ? "bg-[#ededed] text-black hover:bg-white"
              : "bg-black text-white hover:bg-black/85",
          ].join(" ")}
        >
          <Plus className="h-3 w-3" />
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ============================================================
   HOME
============================================================ */

export default function Home() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const sidebarOffset = useSidebarOffset();

  const { user: authUser } = useUser();
  const userId = authUser?.id ?? null;

  const [query, setQuery] = useState("");
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(
    userProfileCache.profile
  );

  const [now, setNow] = useState(() => new Date());

  const connectedChannels = useConnectedChannels();

  /* ----------------------------------------------------------
     CONNECT CHANNEL MODAL (état identique à la page Channels)
  ---------------------------------------------------------- */

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [pendingKey, setPendingKey] = useState<ChannelKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [connections, setConnections] = useState<ConnectionState>(() => {
    if (!userId) return initialConnections;

    const fromCache: Partial<ConnectionState> = {};

    PROVIDER_KEYS.forEach((provider) => {
      const cached = readCache(userId, provider);
      if (cached) fromCache[provider] = cached.connection;
    });

    return { ...initialConnections, ...fromCache };
  });

  // Empêche un double clic de lancer deux OAuth en parallèle.
  const busy = useRef<Set<ChannelKey>>(new Set());

  const connectedCount = useMemo(
    () =>
      CHANNELS.filter((channel) => connections[channel.key].connected).length,
    [connections]
  );

  const limitReached = connectedCount >= PLAN.maxChannels;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    PROVIDER_KEYS.forEach((provider) => {
      const cached = readCache(userId, provider);

      if (cached) {
        setConnections((current) => ({
          ...current,
          [provider]: cached.connection,
        }));

        if (Date.now() - cached.savedAt < CACHE_MAX_AGE_MS) return;
      }

      void (async () => {
        try {
          const status = await OAUTH_PROVIDERS[provider].getStatus();
          if (cancelled) return;

          const connection = toConnection(status);

          if (connection.connected) {
            writeCache(userId, connection, provider);
          } else {
            clearCache(userId, provider);
          }

          setConnections((current) => ({
            ...current,
            [provider]: connection,
          }));
        } catch (error) {
          console.warn(`[Stone] Could not load ${provider} status:`, error);
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleOAuth = async (provider: CacheProvider) => {
    if (busy.current.has(provider)) return;
    busy.current.add(provider);

    const { label, login, disconnect } = OAUTH_PROVIDERS[provider];

    setPendingKey(provider);

    let redirecting = false;

    try {
      if (connections[provider].connected) {
        await disconnect();

        if (userId) clearCache(userId, provider);

        setConnections((current) => ({
          ...current,
          [provider]: { connected: false },
        }));
      } else if (
        provider === "pinterest" &&
        import.meta.env.VITE_PINTEREST_MANUAL_TOKEN === "true"
      ) {
        const token = window.prompt(
          "Pinterest access token (généré dans le portail développeur) :"
        );

        if (!token?.trim()) return;

        const account = await connectPinterestWithToken(token.trim());

        const connection: Connection = {
          connected: true,
          handle: account?.display_name ?? undefined,
          avatarUrl: account?.avatar_url ?? undefined,
        };

        if (userId) writeCache(userId, connection, "pinterest");

        setConnections((current) => ({
          ...current,
          pinterest: connection,
        }));
      } else {
        await login();
        redirecting = true;
      }
    } catch (error) {
      console.error(`[Stone] ${label} OAuth error:`, error);
      setErrorMessage(formatOAuthError(label, error));
    } finally {
      if (!redirecting) {
        setPendingKey(null);
        busy.current.delete(provider);
      }
    }
  };

  const togglePlaceholder = (key: ChannelKey) => {
    // TODO: implement Instagram / Facebook / Threads OAuth
    setPendingKey(key);

    window.setTimeout(() => {
      setConnections((current) => ({
        ...current,
        [key]: current[key].connected
          ? { connected: false }
          : { connected: true, handle: CHANNELS.find((c) => c.key === key)?.name },
      }));
      setPendingKey(null);
    }, 500);
  };

  const handleToggleChannel = (key: ChannelKey) => {
    setErrorMessage(null);

    if (!connections[key].connected && limitReached) {
      setErrorMessage(
        `Your ${PLAN.name} plan allows up to ${PLAN.maxChannels} channels. Upgrade to connect more.`
      );
      return;
    }

    if ((REAL_OAUTH as ChannelKey[]).includes(key)) {
      void toggleOAuth(key as CacheProvider);
      return;
    }

    togglePlaceholder(key);
  };

  const openConnectModal = () => {
    setErrorMessage(null);
    setShowConnectModal(true);
  };

  const closeConnectModal = () => setShowConnectModal(false);

  /* ----------------------------------------------------------
     CLOCK
  ---------------------------------------------------------- */

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15000);

    return () => clearInterval(interval);
  }, []);

  /* ----------------------------------------------------------
     USER
  ---------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const userData = await getCurrentUser();

        if (mounted && userData) {
          userProfileCache.profile = userData;
          setUser(userData);
        }
      } catch (error) {
        console.error("Error loading user on Home:", error);
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const fullName = `${user?.first_name || ""} ${
    user?.last_name || ""
  }`.trim();

  const initials =
    `${(user?.first_name || "")[0] || ""}${
      (user?.last_name || "")[0] || ""
    }`.toUpperCase() || "U";

  const greeting = getGreeting(now);

  /* ----------------------------------------------------------
     CREATE POST
  ---------------------------------------------------------- */

  const handleCreatePost = async (payload: NewPostPayload) => {
    console.log("Nouveau post à envoyer :", payload);
  };

  /* ----------------------------------------------------------
     NAVIGATION
  ---------------------------------------------------------- */

  const handleViewAllComments = () => {
    const first = connectedChannels[0];

    navigate(
      first
        ? `community?channel=${encodeURIComponent(first.key)}`
        : "community"
    );
  };

  /* ----------------------------------------------------------
     BOTTOM BAR
  ---------------------------------------------------------- */

  const handleBottomBarChange = (id: BottomBarTab) => {
    switch (id) {
      case "add":
        setIsFolderOpen(false);
        setIsNewPostOpen(true);
        break;

      case "files":
        setIsFolderOpen((open) => !open);
        break;

      default:
        break;
    }
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <main
      className={[
        "relative h-screen w-full overflow-hidden",
        "transition-colors duration-300",
        ink.page(isDark),
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      <div
        className={[
          "h-full overflow-y-auto overflow-x-hidden",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        <div className="mx-auto flex w-full max-w-[1720px] flex-col px-[clamp(18px,3vw,48px)] pb-[120px] pt-[clamp(20px,3vw,36px)]">
          {/* HEADER — ligne unique avec hairline, sans carte */}

          <header
            className={[
              "flex shrink-0 items-center justify-between border-b pb-5",
              ink.hairline(isDark),
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <GreetingAvatar
                avatarUrl={user?.avatar_url}
                initials={initials}
                isDark={isDark}
              />

              <div>
                <p className={["text-[11px]", ink.faint(isDark)].join(" ")}>
                  {greeting}
                </p>

                <h1
                  className={[
                    "mt-0.5 text-[18px] font-semibold tracking-[-0.02em]",
                    ink.title(isDark),
                  ].join(" ")}
                >
                  {fullName || "Welcome"}
                </h1>
              </div>
            </div>

            <ClockDisplay isDark={isDark} now={now} />
          </header>

          {/* OVERVIEW — stats + streak sur une ligne */}

          <section className="mt-8 shrink-0">
            <SectionHeader
              isDark={isDark}
              title="Overview"
              action={{
                label: "Insights",
                onClick: () => navigate("insights"),
              }}
            />

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
              <div
                className={[
                  "grid grid-cols-1 content-center gap-6 rounded-lg border p-5",
                  "sm:grid-cols-3 sm:gap-0 sm:divide-x",
                  ink.card(isDark),
                  isDark ? "sm:divide-[#1c1c1f]" : "sm:divide-black/[0.08]",
                ].join(" ")}
              >
                <div className="sm:pr-6">
                  <Stat isDark={isDark} label="Followers" value="27K" change="-2%" />
                </div>

                <div className="sm:px-6">
                  <Stat isDark={isDark} label="Likes" value="12.4K" change="+16%" />
                </div>

                <div className="sm:pl-6">
                  <Stat isDark={isDark} label="Comments" value="342" change="+5%" />
                </div>
              </div>

              <Streak isDark={isDark} completedDays={[0]} />
            </div>
          </section>

          {/* CHANNELS */}

          <section className="mt-8 shrink-0">
            <SectionHeader
              isDark={isDark}
              title="Channels"
              action={{ label: "Manage", onClick: () => navigate("channels") }}
            />

            <Channels
              isDark={isDark}
              channels={connectedChannels}
              onAdd={openConnectModal}
            />
          </section>

          {/* COMMENTS + UP NEXT */}

          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            <section>
              <SectionHeader
                isDark={isDark}
                title="Comments"
                action={{ label: "View all", onClick: handleViewAllComments }}
              />

              <EmptyPanel
                isDark={isDark}
                icon={<MessageSquare className="h-4 w-4" />}
                line="No comments yet."
                hint="You'll see the latest comments here."
              />
            </section>

            <section>
              <SectionHeader
                isDark={isDark}
                title="Up Next"
                action={{ label: "View all", onClick: () => navigate("calendar") }}
              />

              <EmptyPanel
                isDark={isDark}
                icon={<CalendarDays className="h-4 w-4" />}
                line="No posts scheduled yet."
                hint="You'll see upcoming posts here."
                action={{
                  label: "Create Post",
                  onClick: () => setIsNewPostOpen(true),
                }}
              />
            </section>
          </div>
        </div>
      </div>

      {/* FOLDER */}

      <Folder
        isOpen={isFolderOpen}
        onClose={() => setIsFolderOpen(false)}
        isDark={isDark}
        offsetLeft={sidebarOffset}
      />

      {/* BOTTOM BAR */}

      <BottomBar
        isDark={isDark}
        offsetLeft={sidebarOffset}
        active={isFolderOpen ? "files" : null}
        onChange={handleBottomBarChange}
        query={query}
        onQueryChange={setQuery}
      />

      {/* NEW POST */}

      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={() => setIsNewPostOpen(false)}
        isDark={isDark}
        onSubmit={handleCreatePost}
      />

      {/* CONNECT CHANNEL */}

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
          onToggle={handleToggleChannel}
          onClose={closeConnectModal}
        />
      )}

      {/* HELP */}

      <HelpChatButton isDark={isDark} />
    </main>
  );
}