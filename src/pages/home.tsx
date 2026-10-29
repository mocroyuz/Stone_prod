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
import DashboardSidebar, { useSidebarOffset } from "../components/DashboardSidebar";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import ConnectChannelModal from "../components/ConnectChannelModal";
import HelpChatButton from "../components/Helpchatbutton";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import { getCurrentUser, type UserProfile } from "../services/supabase";
import { createPosts } from "../services/posts";
import {
  fetchYouTubeComments,
  fetchYouTubeVideos,
} from "../services/youtubeComments";
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
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Heart,
  MessageCircle,
  Plus,
  TrendingDown,
  TrendingUp,
  Users,
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
   LAYOUT
============================================================ */

/* Fond de la page (visible autour du panneau arrondi + derrière la sidebar) */
const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#09090a]" : "bg-[#f5f3ef]";

/* Grand panneau arrondi qui contient toute la page */
const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";

const cardClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#141416]"
    : "border-black/[0.06] bg-white";

/* Fond partagé : panneaux Comments / Up Next, Overview, Channels.
   Sur le panneau blanc, ils prennent la teinte beige du fond de page. */
const panelSurfaceClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-white/[0.03]"
    : "border-black/[0.06] bg-[#f6f4f0]";

/* Couleur des anneaux d'avatar = couleur effective du fond panelSurfaceClass */
const panelRingClass = (isDark: boolean) =>
  isDark ? "ring-[#151517]" : "ring-[#f6f4f0]";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-600" : "text-neutral-400";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

/* Anneau de focus clavier commun à tous les boutons / liens */
const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

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

/* Réseaux branchés sur un vrai OAuth */
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
    label: "YouTube Shorts",
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

function getNetworkId(channel: ConnectedChannel): SocialNetworkKey | null {
  const c = channel as unknown as Record<string, unknown>;
  const raw = String(c.platform ?? c.network ?? c.provider ?? channel.key)
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
   LATEST COMMENTS (tous les canaux mélangés)
============================================================ */

type RawComment = {
  id: string;
  author: string;
  authorAvatar: string | null;
  text: string;
  publishedAt: string | null;
  answered: boolean;
  isRead: boolean;
  videoId: string | null;
  videoTitle: string | null;
  videoThumbnail: string | null;
};

type HomeComment = RawComment & {
  channel: ConnectedChannel;
  network: SocialNetworkKey;
};

/* Titres / miniatures des vidéos : mis en cache pour ne pas coûter
   de quota YouTube à chaque actualisation des commentaires. */
type VideoInfo = { title: string; thumbnail: string | null };

const VIDEO_CACHE_MS = 5 * 60_000;
let youtubeVideoCache: { at: number; map: Map<string, VideoInfo> } | null = null;

async function getYouTubeVideoMap(): Promise<Map<string, VideoInfo>> {
  if (youtubeVideoCache && Date.now() - youtubeVideoCache.at < VIDEO_CACHE_MS) {
    return youtubeVideoCache.map;
  }

  try {
    const { videos } = await fetchYouTubeVideos();
    const map = new Map<string, VideoInfo>(
      videos.map((v) => [v.id, { title: v.title, thumbnail: v.thumbnail }])
    );
    youtubeVideoCache = { at: Date.now(), map };
    return map;
  } catch {
    // Les commentaires restent affichés même si la liste des vidéos échoue.
    return youtubeVideoCache?.map ?? new Map<string, VideoInfo>();
  }
}

const youtubeThumbnail = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

/* Réseaux dont les commentaires sont branchés côté serveur.
   Pour en ajouter un : une entrée ici suffit, ses commentaires seront
   mélangés aux autres automatiquement. */
const COMMENT_SOURCES: Partial<
  Record<SocialNetworkKey, () => Promise<RawComment[]>>
> = {
  youtube: async () => {
    const [{ comments }, videos] = await Promise.all([
      fetchYouTubeComments({ filter: "all" }),
      getYouTubeVideoMap(),
    ]);

    return comments
      .filter((c) => !c.is_own)
      .map((c) => {
        const video = c.video_id ? videos.get(c.video_id) : undefined;

        return {
          id: `youtube:${c.id}`,
          author: c.author_name,
          authorAvatar: c.author_avatar,
          text: c.text,
          publishedAt: c.published_at,
          answered: c.answered,
          isRead: c.is_read,
          videoId: c.video_id,
          videoTitle: video?.title ?? null,
          videoThumbnail:
            video?.thumbnail ?? (c.video_id ? youtubeThumbnail(c.video_id) : null),
        };
      });
  },
};

const COMMENTS_POLL_MS = 60_000;
const HOME_COMMENTS_LIMIT = 3;

const commentTime = (c: { publishedAt: string | null }) =>
  c.publishedAt ? new Date(c.publishedAt).getTime() || 0 : 0;

function timeAgo(iso: string | null, now: Date): string {
  if (!iso) return "";

  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const minutes = Math.floor(Math.max(0, now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function useLatestComments(channels: ConnectedChannel[]) {
  const [comments, setComments] = useState<HomeComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Un canal par réseau : le serveur gère un compte par réseau. */
  const sources = useMemo(() => {
    const seen = new Set<SocialNetworkKey>();
    const list: { channel: ConnectedChannel; network: SocialNetworkKey }[] = [];

    for (const channel of channels) {
      const network = getNetworkId(channel);
      if (!network || !COMMENT_SOURCES[network] || seen.has(network)) continue;

      seen.add(network);
      list.push({ channel, network });
    }

    return list;
  }, [channels]);

  /* Signature stable : évite de relancer l'effet si le tableau change de référence. */
  const sourceKey = sources.map((s) => `${s.network}:${s.channel.key}`).join("|");
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  useEffect(() => {
    const list = sourcesRef.current;

    if (list.length === 0) {
      setComments([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let busy = false;

    const load = async (initial: boolean) => {
      if (busy || (!initial && document.hidden)) return;
      busy = true;

      if (initial) setLoading(true);

      try {
        const results = await Promise.allSettled(
          list.map(async ({ channel, network }) => {
            const raw = await COMMENT_SOURCES[network]!();
            return raw.map((c): HomeComment => ({ ...c, channel, network }));
          })
        );

        if (cancelled) return;

        const merged: HomeComment[] = [];
        const errors: string[] = [];

        for (const result of results) {
          if (result.status === "fulfilled") {
            merged.push(...result.value);
          } else {
            errors.push(
              result.reason instanceof Error
                ? result.reason.message
                : "Could not load comments."
            );
          }
        }

        const allFailed = errors.length === results.length;

        // Échec d'une actualisation automatique : on garde ce qui est affiché.
        if (allFailed && !initial) return;

        merged.sort((a, b) => commentTime(b) - commentTime(a));
        setComments(merged);
        setError(allFailed ? errors[0] : null);
      } finally {
        busy = false;
        if (initial && !cancelled) setLoading(false);
      }
    };

    void load(true);

    const timer = window.setInterval(() => void load(false), COMMENTS_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void load(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sourceKey]);

  return { comments, loading, error };
}

/* ============================================================
   BLOG
============================================================ */

type BlogPost = {
  title: string;
  label: string;
  date: string;
  image?: string;
  url: string;
};

const BLOG_URL = "#";

const BLOG_POSTS: BlogPost[] = [
  {
    title: "The Best Time to Post on TikTok in 2026",
    label: "Blog post",
    date: "Jul 20, 2026",
    image: "/images/blog/best-time-tiktok.jpg",
    url: BLOG_URL,
  },
  {
    title: "The 11 Best AI Video Editors: I Tested Them All",
    label: "Blog post",
    date: "Jul 22, 2026",
    image: "/images/blog/ai-video-editors.jpg",
    url: BLOG_URL,
  },
  {
    title: "How to Create a Social Media Content Calendar",
    label: "Blog post",
    date: "Jul 24, 2026",
    image: "/images/blog/content-calendar.jpg",
    url: BLOG_URL,
  },
  {
    title: "17 Best AI Tools for Social Media Content",
    label: "Blog post",
    date: "Aug 3, 2026",
    image: "/images/blog/ai-tools.jpg",
    url: BLOG_URL,
  },
];

/* Ouvre un nouvel onglet uniquement pour une vraie URL externe */
const linkProps = (url: string) =>
  /^https?:\/\//.test(url) ? { target: "_blank", rel: "noreferrer" } : {};

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
   AVATAR
============================================================ */

function GreetingAvatar({
  avatarUrl,
  initials,
  isDark,
  loading = false,
}: {
  avatarUrl?: string | null;
  initials: string;
  isDark: boolean;
  loading?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  /* Évite le flash « U » avant l'arrivée du vrai profil. */
  if (loading) {
    return (
      <div
        aria-hidden="true"
        className="h-11 w-11 animate-pulse rounded-full bg-neutral-500/20"
      />
    );
  }

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        onError={() => setFailed(true)}
        className="h-11 w-11 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className={[
        "flex h-11 w-11 items-center justify-center rounded-full",
        "text-[14px] font-semibold",
        isDark ? "bg-white text-black" : "bg-neutral-900 text-white",
      ].join(" ")}
    >
      {initials}
    </div>
  );
}

/* ============================================================
   CLOCK
============================================================ */

function ClockDisplay({ isDark, now }: { isDark: boolean; now: Date }) {
  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const date = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="text-right">
      <p
        className={[
          "text-[16px] font-semibold tabular-nums",
          strongClass(isDark),
        ].join(" ")}
      >
        {time}
      </p>
      <p
        className={[
          "text-[11px] font-medium capitalize",
          mutedClass(isDark),
        ].join(" ")}
      >
        {date}
      </p>
    </div>
  );
}

/* ============================================================
   STAT
============================================================ */

/* Petit « ! » cerclé : explique en infobulle ce que montre la statistique.
   Visible au survol ET au focus clavier. */
function InfoHint({ isDark, text }: { isDark: boolean; text: string }) {
  return (
    <span className="group relative flex shrink-0 items-center">
      <button
        type="button"
        aria-label={text}
        className={[
          "flex h-3.5 w-3.5 items-center justify-center rounded-full transition",
          "focus-visible:outline-none focus-visible:ring-1",
          isDark
            ? "text-neutral-600 hover:text-neutral-300 focus-visible:ring-white/30"
            : "text-neutral-400 hover:text-neutral-700 focus-visible:ring-black/30",
        ].join(" ")}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-full w-full"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 7.5v5.5" />
          <path d="M12 16.6v.1" strokeWidth="2.6" />
        </svg>
      </button>

      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[210px]",
          "-translate-x-1/2 rounded-lg px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug",
          "opacity-0 shadow-lg transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          isDark ? "bg-[#2e2e31] text-white" : "bg-neutral-900 text-white",
        ].join(" ")}
      >
        {text}
      </span>
    </span>
  );
}

function Stat({
  isDark,
  icon,
  label,
  value,
  change,
  hint,
}: {
  isDark: boolean;
  icon: ReactNode;
  label: string;
  value: string;
  change: string;
  hint: string;
}) {
  const positive = change.startsWith("+");

  return (
    <div
      className={[
        "flex min-w-0 items-center gap-3",
        /* Mobile : séparateur horizontal ; desktop : séparateur vertical. */
        "border-b pb-3 last:border-b-0 last:pb-0 sm:border-b-0 sm:pb-0",
        "sm:border-r sm:last:border-r-0 sm:pr-5 sm:last:pr-0",
        isDark ? "border-white/[0.07]" : "border-black/[0.07]",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          isDark
            ? "bg-white/[0.06] text-white"
            : "bg-white text-neutral-700 shadow-sm ring-1 ring-black/[0.05]",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="min-w-0">
        {/* L'infobulle est hors du <p> tronqué pour ne pas être coupée. */}
        <div className="flex items-center gap-1">
          <p
            className={[
              "truncate text-[10px] font-medium",
              isDark ? "text-neutral-500" : "text-neutral-400",
            ].join(" ")}
          >
            {label}
          </p>
          <InfoHint isDark={isDark} text={hint} />
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span
            className={[
              "text-[17px] font-bold tracking-tight",
              strongClass(isDark),
            ].join(" ")}
          >
            {value}
          </span>
          {/* Pastille + flèche : la tendance ne repose plus uniquement sur la couleur. */}
          <span
            className={[
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
              positive
                ? isDark
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-emerald-500/10 text-emerald-600"
                : isDark
                  ? "bg-rose-500/10 text-rose-400"
                  : "bg-rose-500/10 text-rose-600",
            ].join(" ")}
          >
            {positive ? (
              <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />
            )}
            <span className="sr-only">{positive ? "Up " : "Down "}</span>
            {change}
          </span>
        </div>
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
  const initial = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const networkId = getNetworkId(channel);
  const NetworkIcon = networkId ? NETWORK_ICONS[networkId] : null;

  return (
    <div
      className="relative h-9 w-9 shrink-0"
      style={{ marginLeft: overlap ? -8 : 0 }}
      title={label}
    >
      {channel.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={[
            "h-full w-full rounded-full object-cover ring-2",
            panelRingClass(isDark),
          ].join(" ")}
        />
      ) : (
        <div
          className={[
            "flex h-full w-full items-center justify-center rounded-full",
            "text-[11px] font-semibold ring-2",
            isDark ? "bg-[#29292c] text-white" : "bg-neutral-900 text-white",
            panelRingClass(isDark),
          ].join(" ")}
        >
          {initial}
        </div>
      )}

      {NetworkIcon && (
        <span
          className={[
            "absolute -bottom-1 -right-1 flex h-4 w-4 items-center",
            "justify-center rounded-full bg-white text-black ring-1",
            panelRingClass(isDark),
          ].join(" ")}
        >
          <NetworkIcon className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
}

/* ============================================================
   CHANNELS
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
        "flex min-h-[74px] items-center justify-between gap-4 rounded-2xl border px-4",
        panelSurfaceClass(isDark),
      ].join(" ")}
    >
      {channels.length === 0 ? (
        <div className="flex items-center gap-3">
          {/* + : ouvre ConnectChannelModal */}
          <button
            type="button"
            aria-label="Connect a channel"
            onClick={onAdd}
            className={[
              "flex h-9 w-9 items-center justify-center rounded-xl transition",
              focusRingClass(isDark),
              isDark
                ? "bg-white/[0.06] hover:bg-white/[0.12]"
                : "bg-white shadow-sm ring-1 ring-black/[0.05] hover:bg-neutral-100",
            ].join(" ")}
          >
            <Plus
              className={[
                "h-4 w-4",
                isDark ? "text-white" : "text-neutral-700",
              ].join(" ")}
            />
          </button>
          <div>
            <p
              className={[
                "text-[11px] font-semibold",
                strongClass(isDark),
              ].join(" ")}
            >
              Connect your first channel
            </p>
            <p
              className={["mt-0.5 text-[10px]", mutedClass(isDark)].join(" ")}
            >
              Start publishing to social networks.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center pl-1">
            {channels.slice(0, 6).map((channel, index) => (
              <ChannelAvatar
                key={channel.key}
                channel={channel}
                isDark={isDark}
                overlap={index > 0}
              />
            ))}

            {/* Canaux au-delà des 6 premiers avatars */}
            {channels.length > 6 && (
              <span
                title={`${channels.length - 6} more ${
                  channels.length - 6 === 1 ? "channel" : "channels"
                }`}
                className={[
                  "-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  "text-[10px] font-semibold ring-2",
                  isDark ? "bg-[#29292c] text-white" : "bg-neutral-200 text-neutral-700",
                  panelRingClass(isDark),
                ].join(" ")}
              >
                +{channels.length - 6}
              </span>
            )}

            {/* + : même forme que les avatars, légèrement imbriqué */}
            <button
              type="button"
              aria-label="Connect another channel"
              title="Connect another channel"
              onClick={onAdd}
              className={[
                "-ml-2 flex h-9 w-9 shrink-0 items-center justify-center",
                "relative z-10 rounded-full border transition-all duration-200",
                focusRingClass(isDark),
                "ring-2",
                panelRingClass(isDark),
                isDark
                  ? "border-white/[0.14] bg-[#1b1b1e] text-white hover:bg-[#242428] hover:border-white/25"
                  : "border-black/[0.10] bg-white text-neutral-700 shadow-sm hover:bg-neutral-50 hover:border-black/20",
              ].join(" ")}
            >
              <Plus className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </button>
          </div>

          <div>
            <p
              className={[
                "text-[11px] font-semibold",
                strongClass(isDark),
              ].join(" ")}
            >
              {channels.length}{" "}
              {channels.length === 1 ? "channel" : "channels"} connected
            </p>
            <p className={["text-[10px]", mutedClass(isDark)].join(" ")}>
              Ready to publish
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => (channels.length === 0 ? onAdd() : navigate("channels"))}
        className={[
          "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2",
          "text-[10px] font-semibold transition",
          focusRingClass(isDark),
          isDark
            ? "text-white hover:bg-white/[0.06]"
            : "text-neutral-900 hover:bg-black/[0.04]",
        ].join(" ")}
      >
        {channels.length === 0 ? "Connect" : "Manage"}
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ============================================================
   PANEL
============================================================ */

function Panel({
  isDark,
  title,
  meta,
  onViewAll,
  icon,
  line1,
  line2,
  action,
}: {
  isDark: boolean;
  title: string;
  meta: string;
  onViewAll?: () => void;
  icon: ReactNode;
  line1: string;
  line2: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <p
          className={[
            "text-[12px] font-semibold",
            isDark ? "text-neutral-300" : "text-neutral-700",
          ].join(" ")}
        >
          {title}
          <span
            className={["ml-1.5 font-normal", mutedClass(isDark)].join(" ")}
          >
            · {meta}
          </span>
        </p>

        <button
          type="button"
          disabled={!onViewAll}
          onClick={onViewAll}
          className={[
            "flex items-center gap-0.5 rounded-md text-[11px] font-semibold transition",
            focusRingClass(isDark),
            "disabled:cursor-default disabled:opacity-40",
            isDark
              ? "text-neutral-400 enabled:hover:text-white"
              : "text-neutral-500 enabled:hover:text-neutral-900",
          ].join(" ")}
        >
          View All
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className={[
          "flex min-h-[190px] flex-col items-center justify-center",
          "gap-1 rounded-3xl border px-4 py-6 text-center",
          panelSurfaceClass(isDark),
        ].join(" ")}
      >
        <div
          className={[
            "mb-2 flex h-11 w-11 items-center justify-center rounded-full",
            isDark
              ? "bg-white/[0.07] text-neutral-300"
              : "bg-neutral-200/70 text-neutral-600",
          ].join(" ")}
        >
          {icon}
        </div>

        <p
          className={["text-[12px] font-medium", strongClass(isDark)].join(" ")}
        >
          {line1}
        </p>
        <p className="text-[12px] text-neutral-500">{line2}</p>

        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={[
              "mt-3 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5",
              "text-[11px] font-semibold transition",
              focusRingClass(isDark),
              isDark
                ? "border-white/10 text-white hover:bg-white/[0.07]"
                : "border-black/10 text-neutral-900 hover:bg-black/[0.04]",
            ].join(" ")}
          >
            <Plus className="h-3.5 w-3.5" />
            {action.label}
          </button>
        )}
      </div>
    </section>
  );
}

/* Photo de profil de la personne qui a écrit le commentaire,
   avec l'icône du réseau en badge. */
function CommentAvatar({
  src,
  name,
  network,
  isDark,
}: {
  src: string | null;
  name: string;
  network: SocialNetworkKey;
  isDark: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const NetworkIcon = NETWORK_ICONS[network];

  /* L'anneau du badge reprend la couleur de la carte */
  const badgeRing = isDark ? "ring-[#18181b]" : "ring-white";

  return (
    <div className="relative h-10 w-10 shrink-0">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className={[
            "flex h-full w-full items-center justify-center rounded-full",
            "text-[13px] font-semibold",
            isDark ? "bg-[#29292c] text-white" : "bg-neutral-900 text-white",
          ].join(" ")}
        >
          {initial}
        </div>
      )}

      <span
        className={[
          "absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center",
          "justify-center rounded-full bg-white text-black shadow-sm ring-2",
          badgeRing,
        ].join(" ")}
      >
        <NetworkIcon className="h-2.5 w-2.5" />
      </span>
    </div>
  );
}

/* Petit avatar du canal qui a reçu le commentaire. */
function ChannelMini({
  channel,
  isDark,
}: {
  channel: ConnectedChannel;
  isDark: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [channel.avatarUrl]);

  const label = channel.handle || channel.name || "Channel";
  const initial = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return (
    <span className="ml-auto flex shrink-0 items-center" title={label}>
      {channel.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <span
          className={[
            "flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold",
            isDark ? "bg-[#29292c] text-white" : "bg-neutral-900 text-white",
          ].join(" ")}
        >
          {initial}
        </span>
      )}
    </span>
  );
}

/* ============================================================
   COMMENTS PANEL
============================================================ */

function CommentsPanel({
  isDark,
  comments,
  unanswered,
  now,
  onOpen,
  onViewMore,
}: {
  isDark: boolean;
  comments: HomeComment[];
  unanswered: number;
  now: Date;
  onOpen: (channelKey: string) => void;
  onViewMore: () => void;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <p
          className={[
            "text-[12px] font-semibold",
            isDark ? "text-neutral-300" : "text-neutral-700",
          ].join(" ")}
        >
          Comments
          <span className={["ml-1.5 font-normal", mutedClass(isDark)].join(" ")}>
            · {unanswered} unanswered
          </span>
        </p>
      </div>

      {/* Panneau : coins très arrondis, les commentaires sont des cartes à l'intérieur */}
      <div
        className={[
          "flex min-h-[190px] flex-col gap-1.5 rounded-3xl border p-2",
          panelSurfaceClass(isDark),
        ].join(" ")}
      >
        <ul className="flex flex-1 flex-col gap-1.5">
          {comments.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpen(c.channel.key)}
                className={[
                  "group flex w-full items-start gap-3 rounded-2xl border p-3 text-left",
                  "transition-all duration-200 motion-reduce:transition-none",
                  focusRingClass(isDark),
                  isDark
                    ? "border-white/[0.06] bg-[#18181b] hover:border-white/[0.12] hover:bg-[#1d1d21]"
                    : "border-black/[0.05] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-black/[0.10] hover:shadow-[0_4px_14px_rgba(0,0,0,0.06)]",
                ].join(" ")}
              >
                <CommentAvatar
                  src={c.authorAvatar}
                  name={c.author}
                  network={c.network}
                  isDark={isDark}
                />

                <div className="min-w-0 flex-1">
                  <span className="sr-only">
                    {c.channel.handle || c.channel.name} on {c.network}.
                  </span>

                  <div className="flex items-center gap-1.5">
                    {!c.isRead && (
                      <span
                        role="img"
                        aria-label="Unread"
                        className="h-2 w-2 shrink-0 rounded-full bg-blue-500"
                      />
                    )}
                    <span
                      className={[
                        "truncate text-[12.5px] font-semibold",
                        strongClass(isDark),
                      ].join(" ")}
                    >
                      {c.author}
                    </span>
                    <span
                      className={["shrink-0 text-[10.5px]", mutedClass(isDark)].join(" ")}
                    >
                      · {timeAgo(c.publishedAt, now)}
                    </span>
                    <ChannelMini channel={c.channel} isDark={isDark} />
                  </div>

                  <p
                    className={[
                      "mt-1 break-words text-[12px] leading-snug",
                      c.isRead
                        ? "text-neutral-500"
                        : isDark
                          ? "text-neutral-200"
                          : "text-neutral-800",
                    ].join(" ")}
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {c.text}
                  </p>

                  {c.videoTitle && (
                    <p
                      className={[
                        "mt-2 inline-flex max-w-full items-center rounded-full px-2 py-0.5",
                        "text-[10px] font-medium",
                        isDark
                          ? "bg-white/[0.05] text-neutral-400"
                          : "bg-black/[0.04] text-neutral-500",
                      ].join(" ")}
                      title={c.videoTitle}
                    >
                      <span className="sr-only">On video: </span>
                      <span className="truncate">{c.videoTitle}</span>
                    </p>
                  )}
                </div>

                {c.videoThumbnail && (
                  <img
                    src={c.videoThumbnail}
                    alt={c.videoTitle ? `Video: ${c.videoTitle}` : ""}
                    loading="lazy"
                    draggable={false}
                    referrerPolicy="no-referrer"
                    className={[
                      "aspect-video w-[76px] shrink-0 rounded-xl object-cover ring-1",
                      "transition-transform duration-200 group-hover:scale-[1.03]",
                      "motion-reduce:transition-none",
                      isDark ? "ring-white/[0.08]" : "ring-black/[0.06]",
                    ].join(" ")}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onViewMore}
          className={[
            "flex w-full items-center justify-center gap-0.5 rounded-2xl px-3.5 py-2.5",
            "text-[11px] font-semibold transition-colors motion-reduce:transition-none",
            focusRingClass(isDark),
            isDark
              ? "text-neutral-400 hover:bg-white/[0.05] hover:text-white"
              : "text-neutral-500 hover:bg-black/[0.04] hover:text-neutral-900",
          ].join(" ")}
        >
          View more
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

/* ============================================================
   BLOG IMAGE
============================================================ */

function BlogImage({ src, isDark }: { src?: string; isDark: boolean }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={[
          "h-[140px] w-full rounded-xl",
          isDark ? "bg-white/[0.06]" : "bg-neutral-200/70",
        ].join(" ")}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className="h-[140px] w-full rounded-xl object-cover"
    />
  );
}

/* ============================================================
   BLOG SECTION
============================================================ */

function BlogSection({ isDark }: { isDark: boolean }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p
          className={[
            "text-[12px] font-semibold",
            isDark ? "text-neutral-300" : "text-neutral-700",
          ].join(" ")}
        >
          From the Blog
        </p>

        <a
          href={BLOG_URL}
          {...linkProps(BLOG_URL)}
          className={[
            "flex items-center gap-0.5 rounded-md text-[11px] font-semibold transition",
            focusRingClass(isDark),
            isDark
              ? "text-neutral-400 hover:text-white"
              : "text-neutral-500 hover:text-neutral-900",
          ].join(" ")}
        >
          View All Articles
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {BLOG_POSTS.map((post) => (
          <a
            key={post.title}
            href={post.url}
            {...linkProps(post.url)}
            className={[
              "group flex flex-col rounded-2xl border p-3.5 transition",
              focusRingClass(isDark),
              cardClass(isDark),
              isDark ? "hover:bg-[#1a1a1d]" : "hover:bg-[#f6f4f0]",
            ].join(" ")}
          >
            <BlogImage src={post.image} isDark={isDark} />

            <div className="mt-3.5 flex items-center justify-between gap-2 px-0.5">
              <span
                className={[
                  "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                  isDark
                    ? "bg-[#16304f] text-[#a9cdf5]"
                    : "bg-blue-50 text-blue-700",
                ].join(" ")}
              >
                {post.label}
              </span>
              <span
                className={["text-[10px]", mutedClass(isDark)].join(" ")}
              >
                {post.date}
              </span>
            </div>

            <h3
              className={[
                "mt-2.5 px-0.5 text-[14px] font-semibold leading-snug",
                "tracking-[-0.01em]",
                strongClass(isDark),
              ].join(" ")}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {post.title}
            </h3>

            <div className="mt-3 flex justify-end px-0.5">
              <ArrowRight
                className={[
                  "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                  strongClass(isDark),
                ].join(" ")}
              />
            </div>
          </a>
        ))}
      </div>
    </section>
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
  const [user, setUser] = useState<UserProfile | null>(userProfileCache.profile);
  const [userLoaded, setUserLoaded] = useState(
    userProfileCache.profile !== null
  );
  const [now, setNow] = useState(() => new Date());
  const connectedChannels = useConnectedChannels();
  const latestComments = useLatestComments(connectedChannels);

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

  /* Statut des comptes : cache affiché tout de suite, rechargement
     silencieux si le cache est ancien. */
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

  /* Connexion / déconnexion d'un réseau avec vrai OAuth */
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
        // Mode dev : pas de redirect URI tant que l'app n'est pas approuvée.
        const token = window.prompt(
          "Pinterest access token (généré dans le portail développeur) :"
        );

        if (!token?.trim()) return; // le finally réinitialise l'état

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
        // POST /api/<provider>/auth/url puis window.location.assign(url).
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

  /* Les réseaux sans OAuth ne doivent pas être marqués comme connectés fictivement. */
  const togglePlaceholder = (key: ChannelKey) => {
    const channel = CHANNELS.find((item) => item.key === key);
    const label = channel?.name ?? key;

    setErrorMessage(
      `${label} is not available yet. Its official authentication flow must be implemented first.`
    );
  };

  const handleToggleChannel = (key: ChannelKey) => {
    setErrorMessage(null);

    // Limite du plan : on bloque uniquement les NOUVELLES connexions.
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
      } finally {
        if (mounted) setUserLoaded(true);
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();

  const initials =
    `${(user?.first_name || "")[0] || ""}${
      (user?.last_name || "")[0] || ""
    }`.toUpperCase() || "U";

  const greeting = getGreeting(now);

  /* Formatage de la date : "Wed, Oct 14 2026" */
  const formattedDate = `${now.toLocaleDateString("en-US", {
    weekday: "short",
  })}, ${now.toLocaleDateString("en-US", {
    month: "short",
  })} ${now.getDate()} ${now.getFullYear()}`;

  /* Nom affiché : on utilise le nom complet, ou un fallback */
  const displayName = fullName || "adamnolke";

  /* ----------------------------------------------------------
     CREATE POST
  ---------------------------------------------------------- */

  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }

    throw new Error(unavailablePostActionMessage(payload));
  };

  /* ----------------------------------------------------------
     COMMUNITY
  ---------------------------------------------------------- */

  const handleViewAllComments = (channelKey?: string) => {
    const channel =
      connectedChannels.find((item) => item.key === channelKey) ??
      connectedChannels.find((item) => item.platform === "youtube");
    navigate(
      channel
        ? `community?channel=${encodeURIComponent(channel.key)}`
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
        pageBgClass(isDark),
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      {/* Zone à droite de la sidebar : laisse une marge autour du panneau
          (haut / droite / bas) pour faire ressortir ses coins arrondis. */}
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
              "mx-auto flex w-full max-w-[1720px]",
              "flex-col px-[clamp(18px,3vw,48px)]",
              "pb-[120px] pt-[clamp(18px,3vw,30px)]",
            ].join(" ")}
          >
            <header className="flex shrink-0 items-start justify-between">
              <div className="flex items-center gap-4">
                <GreetingAvatar
                  avatarUrl={user?.avatar_url}
                  initials={initials}
                  isDark={isDark}
                  loading={!userLoaded}
                />
                <div className="flex min-w-0 flex-col">
                  <h1
                    className={[
                      "truncate text-[24px] font-semibold tracking-[-0.035em]",
                      strongClass(isDark),
                    ].join(" ")}
                  >
                    {greeting.charAt(0).toUpperCase() + greeting.slice(1)},{" "}
                    {displayName}!
                  </h1>
                  <p
                    className={[
                      "mt-0.5 text-[13px] font-medium",
                      mutedClass(isDark),
                    ].join(" ")}
                  >
                    {formattedDate}
                  </p>
                </div>
              </div>
              <ClockDisplay isDark={isDark} now={now} />
            </header>

            {/* OVERVIEW */}
            <section className="mt-7 shrink-0">
              <div className="mb-3">
                <p
                  className={[
                    "text-[11px] font-semibold",
                    isDark ? "text-neutral-500" : "text-neutral-400",
                  ].join(" ")}
                >
                  Overview
                </p>
                <p
                  className={[
                    "mt-0.5 text-[11px]",
                    isDark ? "text-neutral-400" : "text-neutral-500",
                  ].join(" ")}
                >
                  Example metrics · not connected to live channels
                </p>
              </div>

              <div
                className={[
                  "grid grid-cols-1 gap-3 rounded-2xl border p-4",
                  "sm:grid-cols-3",
                  panelSurfaceClass(isDark),
                ].join(" ")}
              >
                <Stat
                  isDark={isDark}
                  label="Followers"
                  value="27K"
                  change="-2%"
                  hint="Total followers across all your connected channels, compared to the previous period."
                  icon={<Users className="h-4 w-4" />}
                />
                <Stat
                  isDark={isDark}
                  label="Likes"
                  value="12.4K"
                  change="+16%"
                  hint="Total likes received on your posts across all channels, compared to the previous period."
                  icon={<Heart className="h-4 w-4" />}
                />
                <Stat
                  isDark={isDark}
                  label="Comments"
                  value="342"
                  change="+5%"
                  hint="Total comments received on your posts across all channels, compared to the previous period."
                  icon={<MessageCircle className="h-4 w-4" />}
                />
              </div>
            </section>

            {/* CHANNELS */}
            <section className="mt-5 shrink-0">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p
                    className={[
                      "text-[11px] font-semibold",
                      isDark ? "text-neutral-500" : "text-neutral-400",
                    ].join(" ")}
                  >
                    Channels
                  </p>
                  <p
                    className={[
                      "mt-0.5 text-[10px]",
                      isDark ? "text-neutral-700" : "text-neutral-400",
                    ].join(" ")}
                  >
                    Your connected accounts
                  </p>
                </div>
              </div>

              <Channels
                isDark={isDark}
                channels={connectedChannels}
                onAdd={openConnectModal}
              />
            </section>

            {/* COMMENTS + UP NEXT */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {latestComments.comments.length > 0 ? (
                <CommentsPanel
                  isDark={isDark}
                  comments={latestComments.comments.slice(0, HOME_COMMENTS_LIMIT)}
                  unanswered={
                    latestComments.comments.filter((c) => !c.answered).length
                  }
                  now={now}
                  onOpen={(key) =>
                    navigate(`community?channel=${encodeURIComponent(key)}`)
                  }
                  onViewMore={() =>
                    handleViewAllComments(latestComments.comments[0]?.channel.key)
                  }
                />
              ) : (
                <Panel
                  isDark={isDark}
                  title="Comments"
                  meta="0 unanswered"
                  onViewAll={handleViewAllComments}
                  icon={<MessageCircle className="h-5 w-5" />}
                  line1={
                    latestComments.loading
                      ? "Loading comments…"
                      : latestComments.error
                        ? "Couldn't load comments."
                        : "No comments yet."
                  }
                  line2={
                    latestComments.error && !latestComments.loading
                      ? latestComments.error
                      : connectedChannels.length === 0
                        ? "Connect a channel to start receiving comments."
                        : "You'll see the latest comments here."
                  }
                  action={
                    connectedChannels.length === 0
                      ? { label: "Connect a channel", onClick: openConnectModal }
                      : undefined
                  }
                />
              )}
              <Panel
                isDark={isDark}
                title="Up Next"
                meta="0 posts scheduled"
                onViewAll={() => navigate("calendar")}
                icon={<CalendarDays className="h-5 w-5" />}
                line1="No posts scheduled yet."
                line2="You'll see upcoming posts here."
                action={{
                  label: "Create Post",
                  onClick: () => setIsNewPostOpen(true),
                }}
              />
            </div>

            {/* BLOG */}
            <div className="mt-8">
              <BlogSection isDark={isDark} />
            </div>
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
        onCreatePost={() => handleBottomBarChange("add")}
        query={query}
        onQueryChange={setQuery}
      />

      {/* NEW POST */}
      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={() => setIsNewPostOpen(false)}
        isDark={isDark}
        onSubmit={handleCreatePost}
        onRequestOpen={() => setIsNewPostOpen(true)}
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