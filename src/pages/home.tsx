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
import {
  useConnectedChannels,
  type ConnectedChannel,
} from "../hooks/useConnectedChannels";
import DashboardSidebar, { useSidebarOffset } from "../components/DashboardSidebar";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import HelpChatButton from "../components/Helpchatbutton";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import { getCurrentUser, type UserProfile } from "../services/supabase";
import { createPosts } from "../services/posts";
import { fetchYouTubeComments, fetchYouTubeVideos } from "../services/youtube";
import { navigateToSettingsSection } from "../utils/settingsNavigation";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  Heart,
  MessageCircle,
  Plus,
  Search,
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
   STYLES
============================================================ */

const pageBg = (d: boolean) => (d ? "bg-[#050505]" : "bg-[#f5f3ef]");
const mainPanel = (d: boolean) =>
  d ? "border-white/[0.07] bg-[#0a0a0c]" : "border-black/[0.06] bg-white";
const surface = (d: boolean) =>
  d
    ? "border-white/[0.07] bg-white/[0.025]"
    : "border-black/[0.06] bg-[#f6f4f0]";
const inner = (d: boolean) =>
  d
    ? "border-white/[0.07] bg-[#101012] hover:bg-[#141417]"
    : "border-black/[0.06] bg-white hover:bg-[#fcfbf9]";
const ring = (d: boolean) => (d ? "ring-[#101012]" : "ring-[#f6f4f0]");
const muted = (d: boolean) => (d ? "text-neutral-600" : "text-neutral-400");
const strong = (d: boolean) => (d ? "text-white" : "text-neutral-900");
const soft = (d: boolean) => (d ? "text-neutral-400" : "text-neutral-500");
const subtle = (d: boolean) => (d ? "text-neutral-500" : "text-neutral-400");
const faint = (d: boolean) => (d ? "text-neutral-700" : "text-neutral-400");
const focusRing = (d: boolean) =>
  d
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";
const primaryBtn = (d: boolean) =>
  d
    ? "bg-white text-black hover:bg-neutral-200"
    : "bg-neutral-900 text-white hover:bg-neutral-700";
const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

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
   LATEST COMMENTS (logique inchangée)
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
    return youtubeVideoCache?.map ?? new Map<string, VideoInfo>();
  }
}

const youtubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

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

type CommentsCacheEntry = { comments: HomeComment[]; error: string | null; at: number };
const commentsCache = new Map<string, CommentsCacheEntry>();

const commentTime = (c: { publishedAt: string | null }) =>
  c.publishedAt ? new Date(c.publishedAt).getTime() || 0 : 0;

function useLatestComments(channels: ConnectedChannel[]) {
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

  const sourceKey = sources.map((s) => `${s.network}:${s.channel.key}`).join("|");
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const [comments, setComments] = useState<HomeComment[]>(
    () => commentsCache.get(sourceKey)?.comments ?? []
  );
  const [loading, setLoading] = useState<boolean>(
    () => !commentsCache.has(sourceKey) && channels.length > 0
  );
  const [error, setError] = useState<string | null>(
    () => commentsCache.get(sourceKey)?.error ?? null
  );

  useEffect(() => {
    const list = sourcesRef.current;

    if (list.length === 0) {
      setComments([]);
      setError(null);
      setLoading(false);
      return;
    }

    const cacheEntry = commentsCache.get(sourceKey);
    setComments(cacheEntry?.comments ?? []);
    setError(cacheEntry?.error ?? null);
    setLoading(!cacheEntry);

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
        for (const r of results) {
          if (r.status === "fulfilled") merged.push(...r.value);
          else
            errors.push(
              r.reason instanceof Error ? r.reason.message : "Could not load comments."
            );
        }

        const allFailed = errors.length === results.length;
        if (allFailed && !initial) return;

        merged.sort((a, b) => commentTime(b) - commentTime(a));
        setComments(merged);
        setError(allFailed ? errors[0] : null);
        commentsCache.set(sourceKey, {
          comments: merged,
          error: allFailed ? errors[0] : null,
          at: Date.now(),
        });
      } finally {
        busy = false;
        if (initial && !cancelled) setLoading(false);
      }
    };

    const cacheFresh = cacheEntry && Date.now() - cacheEntry.at < COMMENTS_POLL_MS;
    if (!cacheFresh) void load(!cacheEntry);

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
   DATA
============================================================ */

type BlogPost = { title: string; label: string; date: string; image?: string; url: string };

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

const linkProps = (url: string) =>
  /^https?:\/\//.test(url) ? { target: "_blank", rel: "noreferrer" } : {};

function getGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  if (h >= 18 && h < 22) return "Good evening";
  return "Good night";
}

function formatCommentTime(value: string | null): string {
  if (!value) return "Unknown date";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "Unknown date";

  const diff = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diff, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/* ============================================================
   PRIMITIVES
============================================================ */

function Card({
  isDark,
  title,
  sub,
  action,
  className,
  children,
}: {
  isDark: boolean;
  title?: string;
  sub?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        "flex min-w-0 flex-col rounded-2xl border p-4",
        surface(isDark),
        className
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={cx("text-[12px] font-semibold", subtle(isDark))}>{title}</h2>
            {sub && <p className={cx("mt-0.5 text-[10px]", faint(isDark))}>{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function ViewAll({
  isDark,
  label = "View all",
  onClick,
  href,
}: {
  isDark: boolean;
  label?: string;
  onClick?: () => void;
  href?: string;
}) {
  const cls = cx(
    "flex shrink-0 items-center gap-0.5 rounded-md text-[11px] font-semibold transition",
    focusRing(isDark),
    isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900"
  );
  const content = (
    <>
      {label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
    </>
  );
  return href ? (
    <a href={href} {...linkProps(href)} className={cls}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}

function Avatar({
  src,
  fallback,
  isDark,
  className,
  rounded = "rounded-full",
}: {
  src?: string | null;
  fallback: string;
  isDark: boolean;
  className: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cx(className, rounded, "object-cover")}
      />
    );
  }
  return (
    <div
      className={cx(
        className,
        rounded,
        "flex items-center justify-center font-semibold",
        isDark ? "bg-[#242428] text-white" : "bg-neutral-900 text-white"
      )}
    >
      {fallback}
    </div>
  );
}

function ClockDisplay({ isDark, now }: { isDark: boolean; now: Date }) {
  return (
    <div className="text-right">
      <p className={cx("text-[16px] font-semibold tabular-nums", strong(isDark))}>
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className={cx("text-[11px] font-medium", muted(isDark))}>
        {now.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

function Ring({
  isDark,
  progress,
  children,
  size = 48,
  stroke = 3.5,
}: {
  isDark: boolean;
  progress: number;
  children: ReactNode;
  size?: number;
  stroke?: number;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(p * 100)}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={isDark ? "stroke-white/[0.14]" : "stroke-black/[0.10]"} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          className={cx(
            isDark ? "stroke-white" : "stroke-neutral-900",
            "transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
          )}
        />
      </svg>
      <div className={cx("absolute inset-0 flex items-center justify-center", strong(isDark))}>
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   LEFT COLUMN
============================================================ */

function SearchBar({
  isDark,
  value,
  onChange,
}: {
  isDark: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className={cx(
        "flex h-11 items-center gap-2 rounded-2xl border px-4",
        surface(isDark),
        isDark ? "focus-within:border-white/20" : "focus-within:border-black/20"
      )}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        aria-label="Search"
        className={cx(
          "min-w-0 flex-1 bg-transparent text-[13px] outline-none",
          strong(isDark),
          isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400"
        )}
      />
      <Search className={cx("h-4 w-4", muted(isDark))} aria-hidden="true" />
    </label>
  );
}

function Hero({
  isDark,
  greeting,
  name,
  avatarUrl,
  initials,
  loading,
  onCreate,
}: {
  isDark: boolean;
  greeting: string;
  name: string;
  avatarUrl?: string | null;
  initials: string;
  loading: boolean;
  onCreate: () => void;
}) {
  return (
    <Card isDark={isDark} className="min-h-[170px] justify-center !p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={cx("text-[12px] font-medium", soft(isDark))}>Welcome back</p>
          <h1
            className={cx(
              "mt-1 text-[clamp(22px,2.4vw,30px)] font-semibold leading-tight tracking-[-0.035em]",
              strong(isDark)
            )}
          >
            {greeting},
            <br />
            {name}!
          </h1>
          <button
            type="button"
            onClick={onCreate}
            className={cx(
              "mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold transition",
              focusRing(isDark),
              primaryBtn(isDark)
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create Post
          </button>
        </div>

        {loading ? (
          <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-neutral-500/20" aria-hidden="true" />
        ) : (
          <Avatar
            src={avatarUrl}
            fallback={initials}
            isDark={isDark}
            className="h-24 w-24 shrink-0 text-[28px]"
          />
        )}
      </div>
    </Card>
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
  const Trend = positive ? TrendingUp : TrendingDown;

  return (
    <div title={hint} className={cx("flex min-w-0 flex-col gap-3 rounded-xl border p-3", inner(isDark))}>
      <div
        className={cx(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          isDark ? "bg-white/[0.06] text-white" : "bg-neutral-100 text-neutral-700"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className={cx("truncate text-[11px] font-semibold", strong(isDark))}>{label}</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className={cx("text-[17px] font-bold tracking-tight", strong(isDark))}>{value}</span>
          <span
            className={cx(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
              positive
                ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-500/10 text-emerald-600"
                : isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-500/10 text-rose-600"
            )}
          >
            <Trend className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="sr-only">{positive ? "Up " : "Down "}</span>
            {change}
          </span>
        </div>
      </div>
    </div>
  );
}

function CommentsPanel({
  isDark,
  comments,
  loading,
  error,
  connectedChannelsCount,
  onOpen,
  onViewMore,
  onConnect,
}: {
  isDark: boolean;
  comments: HomeComment[];
  loading: boolean;
  error: string | null;
  connectedChannelsCount: number;
  onOpen: (channelKey: string) => void;
  onViewMore: () => void;
  onConnect: () => void;
}) {
  const visible = comments.slice(0, HOME_COMMENTS_LIMIT);

  return (
    <Card
      isDark={isDark}
      title="Comments"
      sub="Keep up with your community"
      className="flex-1"
      action={visible.length > 0 ? <ViewAll isDark={isDark} onClick={onViewMore} /> : undefined}
    >
      {loading && visible.length === 0 ? (
        <div className="flex flex-col gap-2" aria-label="Loading comments" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cx("flex animate-pulse gap-2.5 rounded-xl border p-3", inner(isDark))} aria-hidden="true">
              <div className={cx("h-6 w-6 rounded-lg", isDark ? "bg-white/10" : "bg-black/[0.07]")} />
              <div className="flex-1 space-y-1.5">
                <div className={cx("h-2.5 w-1/3 rounded", isDark ? "bg-white/10" : "bg-black/[0.07]")} />
                <div className={cx("h-2.5 w-full rounded", isDark ? "bg-white/[0.07]" : "bg-black/[0.05]")} />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <div
            className={cx(
              "mb-2 flex h-9 w-9 items-center justify-center rounded-2xl",
              isDark ? "bg-white/[0.07] text-neutral-300" : "bg-white text-neutral-600 shadow-sm ring-1 ring-black/[0.04]"
            )}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className={cx("text-[12px] font-semibold", strong(isDark))}>
            {error
              ? "Comments couldn't be loaded"
              : connectedChannelsCount === 0
                ? "Connect a channel to get started"
                : "You're all caught up"}
          </p>
          <p className={cx("mt-1 max-w-[280px] text-[11px] leading-snug", soft(isDark))}>
            {error
              ? "We couldn't retrieve your latest comments. Please try again later."
              : connectedChannelsCount === 0
                ? "Connect your YouTube account to see and manage comments here."
                : "When new comments arrive, they'll appear here."}
          </p>
          {connectedChannelsCount === 0 && !error && (
            <button
              type="button"
              onClick={onConnect}
              className={cx(
                "mt-3 inline-flex min-h-8 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold transition",
                focusRing(isDark),
                primaryBtn(isDark)
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Connect a channel
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {error && (
            <p
              role="status"
              className={cx(
                "rounded-xl border px-2.5 py-1.5 text-[11px]",
                isDark
                  ? "border-amber-200/10 bg-amber-200/[0.05] text-amber-100/80"
                  : "border-amber-700/10 bg-amber-50 text-amber-800"
              )}
            >
              Some comments may be missing because a source couldn't be reached.
            </p>
          )}

          {visible.map((c) => {
            const NetworkIcon = NETWORK_ICONS[c.network];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpen(c.channel.key)}
                aria-label={`Open conversation with ${c.author}`}
                className={cx(
                  "group w-full rounded-xl border px-3 py-2.5 text-left transition duration-200 motion-reduce:transition-none",
                  focusRing(isDark),
                  inner(isDark)
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className="relative h-7 w-7 shrink-0">
                    <Avatar
                      src={c.authorAvatar}
                      fallback={c.author.replace(/^@/, "").charAt(0).toUpperCase() || "?"}
                      isDark={isDark}
                      rounded="rounded-lg"
                      className="h-full w-full text-[10px]"
                    />
                    <span
                      className={cx(
                        "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2",
                        c.network === "youtube" ? "bg-[#ff0000]" : "bg-white text-black",
                        ring(isDark)
                      )}
                    >
                      {c.network === "youtube" ? (
                        <svg viewBox="0 0 24 24" className="h-2 w-2" aria-hidden="true">
                          <rect x="2" y="5" width="20" height="14" rx="4.5" fill="#fff" />
                          <path d="M10 9v6l5-3-5-3Z" fill="#ff0000" />
                        </svg>
                      ) : (
                        <NetworkIcon className="h-1.5 w-1.5" />
                      )}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cx("truncate text-[12px] font-semibold", strong(isDark))}>
                          {c.author}
                        </p>
                        <p className={cx("truncate text-[10px]", soft(isDark))}>
                          {c.channel.handle || c.channel.name || c.network}
                          {c.videoTitle ? ` · ${c.videoTitle}` : ""}
                        </p>
                      </div>
                      <span className={cx("inline-flex shrink-0 items-center gap-1 text-[10px]", muted(isDark))}>
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {formatCommentTime(c.publishedAt)}
                      </span>
                    </div>

                    <p
                      className={cx("mt-1 text-[12px] leading-[1.35]", isDark ? "text-neutral-300" : "text-neutral-700")}
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {c.text || "This comment has no text."}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {c.answered ? (
                        <span
                          className={cx(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            isDark ? "bg-emerald-400/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          <CheckCheck className="h-2.5 w-2.5" aria-hidden="true" />
                          Replied
                        </span>
                      ) : (
                        <span />
                      )}
                      <span
                        className={cx(
                          "inline-flex items-center gap-1 text-[10px] font-semibold opacity-80 transition group-hover:translate-x-0.5 group-hover:opacity-100",
                          strong(isDark)
                        )}
                      >
                        Open conversation
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </div>
                <span className="sr-only">{c.isRead ? "Read." : "Unread."}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   MIDDLE COLUMN
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
  const label = channel.handle || channel.name || "Channel";
  const networkId = getNetworkId(channel);
  const NetworkIcon = networkId ? NETWORK_ICONS[networkId] : null;

  return (
    <div className="relative h-9 w-9 shrink-0" style={{ marginLeft: overlap ? -8 : 0 }} title={label}>
      <Avatar
        src={channel.avatarUrl}
        fallback={label.replace(/^@/, "").charAt(0).toUpperCase() || "?"}
        isDark={isDark}
        className={cx("h-full w-full text-[11px] ring-2", ring(isDark))}
      />
      {NetworkIcon && (
        <span
          className={cx(
            "absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black ring-1",
            ring(isDark)
          )}
        >
          <NetworkIcon className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
}

function Channels({
  isDark,
  channels,
  onAdd,
}: {
  isDark: boolean;
  channels: ConnectedChannel[];
  onAdd: () => void;
}) {
  const empty = channels.length === 0;
  const extra = channels.length - 5;

  return (
    <Card
      isDark={isDark}
      title="Channels"
      sub="Your connected accounts"
      action={
        <ViewAll
          isDark={isDark}
          label={empty ? "Connect" : "Manage"}
          onClick={() => (empty ? onAdd() : navigateToSettingsSection("channels"))}
        />
      }
    >
      <div className={cx("flex items-center gap-3 rounded-xl border p-3", inner(isDark))}>
        {empty ? (
          <>
            <button
              type="button"
              aria-label="Connect a channel"
              onClick={onAdd}
              className={cx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                focusRing(isDark),
                isDark ? "bg-white/[0.06] text-white hover:bg-white/[0.12]" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              )}
            >
              <Plus className="h-4 w-4" />
            </button>
            <div>
              <p className={cx("text-[11px] font-semibold", strong(isDark))}>Connect your first channel</p>
              <p className={cx("mt-0.5 text-[10px]", muted(isDark))}>Start publishing to social networks.</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center pl-1">
              {channels.slice(0, 5).map((ch, i) => (
                <ChannelAvatar key={ch.key} channel={ch} isDark={isDark} overlap={i > 0} />
              ))}
              {extra > 0 && (
                <span
                  className={cx(
                    "-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2",
                    isDark ? "bg-[#242428] text-white" : "bg-neutral-200 text-neutral-700",
                    ring(isDark)
                  )}
                >
                  +{extra}
                </span>
              )}
              <button
                type="button"
                aria-label="Connect another channel"
                onClick={onAdd}
                className={cx(
                  "relative z-10 -ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ring-2 transition",
                  focusRing(isDark),
                  ring(isDark),
                  isDark
                    ? "border-white/[0.14] bg-[#161618] text-white hover:bg-[#1f1f22]"
                    : "border-black/[0.10] bg-white text-neutral-700 hover:bg-neutral-50"
                )}
              >
                <Plus className="h-[15px] w-[15px]" strokeWidth={1.8} />
              </button>
            </div>
            <div className="min-w-0">
              <p className={cx("text-[11px] font-semibold", strong(isDark))}>
                {channels.length} {channels.length === 1 ? "channel" : "channels"} connected
              </p>
              <p className={cx("text-[10px]", muted(isDark))}>Ready to publish</p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function Goals({
  isDark,
  weekStreak,
  postingGoal,
  commentScore,
}: {
  isDark: boolean;
  weekStreak: number;
  postingGoal: { done: number; target: number };
  commentScore: { value: number; changePct: number };
}) {
  const ratio = postingGoal.target > 0 ? postingGoal.done / postingGoal.target : 0;
  const reached = postingGoal.target > 0 && postingGoal.done >= postingGoal.target;
  const up = commentScore.changePct >= 0;
  const Trend = up ? TrendingUp : TrendingDown;

  const rows: {
    title: string;
    hint: string;
    ring: ReactNode;
    sub: ReactNode;
  }[] = [
    {
      title: "Week Streak",
      hint: "Consecutive weeks in which you reached your posting goal.",
      ring: (
        <Ring isDark={isDark} progress={weekStreak > 0 ? 1 : 0}>
          <span className="text-[17px] font-semibold tabular-nums">{weekStreak}</span>
        </Ring>
      ),
      sub: weekStreak > 0 ? "Streak hit, keep going!" : "Hit your goal to start a streak.",
    },
    {
      title: "Posting Goals",
      hint: "Posts published this week compared to your weekly goal.",
      ring: (
        <Ring isDark={isDark} progress={ratio}>
          <span className="text-[15px] font-bold tabular-nums">
            {Math.round(ratio * 100)}
            <span className="text-[10px]">%</span>
          </span>
        </Ring>
      ),
      sub: reached ? "Goal reached, great work!" : `${postingGoal.done} of ${postingGoal.target}, so close!`,
    },
    {
      title: "Comment Score",
      hint: "Your engagement score based on the comments you answer.",
      ring: (
        <Ring isDark={isDark} progress={commentScore.value / 100}>
          <span className={cx("text-[17px] font-semibold tabular-nums", soft(isDark))}>
            {commentScore.value}
          </span>
        </Ring>
      ),
      sub: (
        <>
          <span className={cx("inline-flex items-center gap-1", strong(isDark))}>
            <Trend className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">{up ? "Up " : "Down "}</span>
            {up ? "+" : ""}
            {commentScore.changePct}%
          </span>
          <span>from last week</span>
        </>
      ),
    },
  ];

  return (
    <Card isDark={isDark} title="Overview" sub="Your weekly goals">
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.title} title={r.hint} className={cx("flex items-center gap-3 rounded-xl border p-3", inner(isDark))}>
            {r.ring}
            <div className="min-w-0">
              <p className={cx("text-[12px] font-semibold", strong(isDark))}>{r.title}</p>
              <p className={cx("mt-0.5 flex items-center gap-1 text-[11px]", soft(isDark))}>{r.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function UpNext({
  isDark,
  onViewAll,
  onCreate,
}: {
  isDark: boolean;
  onViewAll: () => void;
  onCreate: () => void;
}) {
  return (
    <Card
      isDark={isDark}
      title="Up Next"
      sub="0 posts scheduled"
      action={<ViewAll isDark={isDark} onClick={onViewAll} />}
    >
      <div className={cx("flex items-center gap-3 rounded-xl border p-3", inner(isDark))}>
        <div
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isDark ? "bg-white/[0.07] text-neutral-300" : "bg-neutral-200/70 text-neutral-600"
          )}
        >
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cx("text-[12px] font-medium", strong(isDark))}>No posts scheduled yet.</p>
          <p className="text-[11px] text-neutral-500">You'll see upcoming posts here.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className={cx(
          "mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-semibold transition",
          focusRing(isDark),
          primaryBtn(isDark)
        )}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Create Post
      </button>
    </Card>
  );
}

/* ============================================================
   RIGHT COLUMN
============================================================ */

function BlogList({ isDark, posts }: { isDark: boolean; posts: BlogPost[] }) {
  return (
    <Card
      isDark={isDark}
      title="From the Blog"
      action={<ViewAll isDark={isDark} label="View all" href={BLOG_URL} />}
    >
      <div className="flex flex-col gap-2">
        {posts.map((post) => (
          <a
            key={post.title}
            href={post.url}
            {...linkProps(post.url)}
            className={cx(
              "group flex items-center gap-3 rounded-xl border p-3 transition",
              focusRing(isDark),
              inner(isDark)
            )}
          >
            <div
              className={cx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                isDark ? "bg-white/[0.07] text-neutral-300" : "bg-neutral-200/70 text-neutral-600"
              )}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cx("truncate text-[12px] font-semibold", strong(isDark))}>{post.title}</p>
              <p className={cx("text-[10px]", muted(isDark))}>{post.date}</p>
            </div>
            <ArrowUpRight
              className={cx("h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5", soft(isDark))}
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </Card>
  );
}

function FeaturedBlog({ isDark, post }: { isDark: boolean; post: BlogPost }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [post.image]);

  return (
    <a
      href={post.url}
      {...linkProps(post.url)}
      className={cx(
        "group flex flex-1 flex-col rounded-2xl border p-3 transition",
        focusRing(isDark),
        surface(isDark)
      )}
    >
      {post.image && !failed ? (
        <img
          src={post.image}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="min-h-[180px] w-full flex-1 rounded-xl object-cover"
        />
      ) : (
        <div className={cx("min-h-[180px] w-full flex-1 rounded-xl", isDark ? "bg-white/[0.06]" : "bg-neutral-200/70")} />
      )}
      <div className="mt-3 px-1">
        <p className={cx("text-[14px] font-semibold leading-snug tracking-[-0.01em]", strong(isDark))}>
          {post.title}
        </p>
        <p className={cx("mt-0.5 text-[11px]", muted(isDark))}>Most popular · {post.date}</p>
      </div>
    </a>
  );
}

/* ============================================================
   HOME
============================================================ */

const userProfileCache = { profile: null as UserProfile | null };

export default function Home() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();

  const [query, setQuery] = useState("");
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(userProfileCache.profile);
  const [userLoaded, setUserLoaded] = useState(userProfileCache.profile !== null);
  const [now, setNow] = useState(() => new Date());
  const connectedChannels = useConnectedChannels();
  const latestComments = useLatestComments(connectedChannels);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getCurrentUser();
        if (mounted && data) {
          userProfileCache.profile = data;
          setUser(data);
        }
      } catch (e) {
        console.error("Error loading user on Home:", e);
      } finally {
        if (mounted) setUserLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  const initials =
    `${(user?.first_name || "")[0] || ""}${(user?.last_name || "")[0] || ""}`.toUpperCase() || "U";
  const displayName = fullName || "adamnolke";

  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }
    throw new Error(unavailablePostActionMessage(payload));
  };

  const openCommunity = (channelKey?: string) => {
    const channel =
      connectedChannels.find((c) => c.key === channelKey) ??
      connectedChannels.find((c) => c.platform === "youtube");
    navigate(channel ? `community?channel=${encodeURIComponent(channel.key)}` : "community");
  };

  const handleBottomBarChange = (id: BottomBarTab) => {
    if (id === "add") {
      setIsFolderOpen(false);
      setIsNewPostOpen(true);
    } else if (id === "files") {
      setIsFolderOpen((o) => !o);
    }
  };

  const goSettingsChannels = () => navigateToSettingsSection("channels");

  return (
    <main
      className={cx(
        "relative h-screen w-full overflow-hidden transition-colors duration-300",
        pageBg(isDark)
      )}
    >
      <DashboardSidebar theme={theme} />

      <div
        className="h-full py-3 pr-3 transition-[padding-left] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
        style={{ paddingLeft: sidebarOffset }}
      >
        <div
          className={cx(
            "h-full overflow-y-auto overflow-x-hidden rounded-[28px] border",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-colors duration-300",
            mainPanel(isDark)
          )}
        >
          <div className="mx-auto w-full max-w-[1720px] px-[clamp(18px,3vw,40px)] pb-[120px] pt-[clamp(18px,3vw,30px)]">
            {/* Top bar */}
            <header className="flex items-center justify-between gap-4">
              <p className={cx("truncate text-[13px] font-medium tracking-wide", soft(isDark))}>
                Dashboard / <span className={cx("font-semibold", strong(isDark))}>{displayName}</span>
              </p>
              <ClockDisplay isDark={isDark} now={now} />
            </header>

            {/* 3 columns : gauche large / milieu / droite */}
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
              {/* LEFT */}
              <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
                <SearchBar isDark={isDark} value={query} onChange={setQuery} />

                <Hero
                  isDark={isDark}
                  greeting={getGreeting(now)}
                  name={displayName}
                  avatarUrl={user?.avatar_url}
                  initials={initials}
                  loading={!userLoaded}
                  onCreate={() => setIsNewPostOpen(true)}
                />

                <section>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className={cx("text-[12px] font-semibold", subtle(isDark))}>Stats</h2>
                    <p className={cx("text-[10px]", faint(isDark))}>
                      Example metrics · not connected to live channels
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

                <CommentsPanel
                  isDark={isDark}
                  comments={latestComments.comments}
                  loading={latestComments.loading}
                  error={latestComments.error}
                  connectedChannelsCount={connectedChannels.length}
                  onOpen={(key) => navigate(`community?channel=${encodeURIComponent(key)}`)}
                  onViewMore={() => openCommunity(latestComments.comments[0]?.channel.key)}
                  onConnect={goSettingsChannels}
                />
              </div>

              {/* MIDDLE */}
              <div className="flex min-w-0 flex-col gap-4">
                <Channels isDark={isDark} channels={connectedChannels} onAdd={goSettingsChannels} />
                <Goals
                  isDark={isDark}
                  weekStreak={1}
                  postingGoal={{ done: 1, target: 2 }}
                  commentScore={{ value: 13, changePct: 100 }}
                />
                <UpNext
                  isDark={isDark}
                  onViewAll={() => navigate("calendar")}
                  onCreate={() => setIsNewPostOpen(true)}
                />
              </div>

              {/* RIGHT */}
              <div className="flex min-w-0 flex-col gap-4">
                <BlogList isDark={isDark} posts={BLOG_POSTS.slice(1)} />
                <FeaturedBlog isDark={isDark} post={BLOG_POSTS[0]} />
              </div>
            </div>
          </div>
        </div>
      </div>

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
        onCreatePost={() => handleBottomBarChange("add")}
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

      <HelpChatButton isDark={isDark} />
    </main>
  );
}