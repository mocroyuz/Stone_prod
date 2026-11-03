import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import {
  fetchYouTubeComments,
  fetchYouTubeVideos,
} from "../services/youtube";
import { navigateToSettingsSection } from "../utils/settingsNavigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
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
   DESIGN TOKENS
   ------------------------------------------------------------
   Direction : plus arrondie et conventionnelle. Surfaces
   arrondies, boutons en pilule, filets fins conservés pour la
   lisibilité, accent cobalt utilisé avec parcimonie.
============================================================ */

const SERIF =
  'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, Cambria, "Times New Roman", serif';

const serif = (fontSize?: string): CSSProperties =>
  fontSize ? { fontFamily: SERIF, fontSize } : { fontFamily: SERIF };

const tone = (isDark: boolean) => ({
  page: isDark ? "bg-[#050505]" : "bg-[#f5f3ef]",
  panel: isDark
    ? "border-white/[0.07] bg-[#0b0b0d]"
    : "border-black/[0.07] bg-[#fcfbf9]",
  rule: isDark ? "border-white/[0.08]" : "border-black/[0.09]",
  divide: isDark ? "divide-white/[0.08]" : "divide-black/[0.09]",
  tint: isDark ? "bg-white/[0.035]" : "bg-[#f4f2ed]",
  track: isDark ? "bg-white/[0.10]" : "bg-black/[0.08]",
  ink: isDark ? "text-[#f4f3f0]" : "text-[#17160f]",
  inkBg: isDark ? "bg-[#f4f3f0]" : "bg-[#17160f]",
  body: isDark ? "text-neutral-300" : "text-neutral-700",
  soft: isDark ? "text-neutral-400" : "text-neutral-600",
  faint: "text-neutral-500",
  accentText: isDark ? "text-[#a3afff]" : "text-[#3447c9]",
  accentBg: isDark ? "bg-[#a3afff]" : "bg-[#3447c9]",
  accentOn: isDark ? "text-[#0b0b0d]" : "text-white",
  avatarRing: isDark ? "ring-[#0b0b0d]" : "ring-[#fcfbf9]",
});

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

const primaryButtonClass = (isDark: boolean) =>
  [
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4",
    "text-[12.5px] font-semibold transition",
    focusRingClass(isDark),
    isDark
      ? "bg-[#f4f3f0] text-[#0b0b0d] hover:bg-white"
      : "bg-[#17160f] text-[#fcfbf9] hover:bg-black",
  ].join(" ");

const secondaryButtonClass = (isDark: boolean) =>
  [
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5",
    "text-[12px] font-semibold transition",
    focusRingClass(isDark),
    isDark
      ? "border-white/[0.14] text-[#f4f3f0] hover:bg-white/[0.06]"
      : "border-black/[0.14] text-[#17160f] hover:bg-black/[0.04]",
  ].join(" ");

const actionLinkClass = (isDark: boolean) =>
  [
    "inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1",
    "text-[12px] font-medium transition",
    focusRingClass(isDark),
    isDark
      ? "text-neutral-400 enabled:hover:text-white"
      : "text-neutral-600 enabled:hover:text-neutral-900",
  ].join(" ");

/* ============================================================
   USER CACHE
============================================================ */

const userProfileCache = {
  profile: null as UserProfile | null,
};

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
   LATEST COMMENTS
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

const youtubeThumbnail = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

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

/* ───────── Cache module-level des commentaires ─────────
 *
 * - Survit aux unmount/remount (navigation hash).
 * - Clé = sourceKey (combinaison des channels connectés).
 * - Au mount :
 *     • cache absent       → fetch avec loading (1ʳᵉ visite)
 *     • cache frais (<60s) → utilisé tel quel, aucun fetch
 *     • cache périmé (>60s)→ utilisé puis refresh silencieux en arrière-plan
 * - Le polling (60s) + visibilitychange mettent le cache à jour en continu.
 */
type CommentsCacheEntry = {
  comments: HomeComment[];
  error: string | null;
  at: number;
};
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

  // Initial state SYNCHRONE depuis le cache s'il existe : pas de flash
  // "loading" quand on revient sur la page.
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

    // Sync l'état avec le cache pour ce sourceKey.
    // Nécessaire si sourceKey a changé (les useState init ne rejouent pas).
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
        if (allFailed && !initial) return;

        merged.sort((a, b) => commentTime(b) - commentTime(a));

        setComments(merged);
        setError(allFailed ? errors[0] : null);

        // Met à jour le cache pour les prochains mounts
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

    // Au mount :
    //  - pas de cache       → load(true) : loading visible
    //  - cache périmé (>60s)→ load(false) : refresh silencieux
    //  - cache frais        → aucun fetch, le polling prend le relais
    const cacheFresh =
      cacheEntry && Date.now() - cacheEntry.at < COMMENTS_POLL_MS;
    if (!cacheFresh) {
      void load(!cacheEntry);
    }

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
   SHARED PRIMITIVES
============================================================ */

function SectionHeader({
  isDark,
  id,
  title,
  meta,
  subtitle,
  right,
}: {
  isDark: boolean;
  id?: string;
  title: string;
  meta?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const t = tone(isDark);

  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2
          id={id}
          style={serif()}
          className={["text-[20px] leading-tight tracking-[-0.01em]", t.ink].join(" ")}
        >
          {title}
          {meta && (
            <span
              className={["ml-2 font-sans text-[12px] tracking-normal", t.faint].join(
                " "
              )}
            >
              · {meta}
            </span>
          )}
        </h2>
        {subtitle && (
          <p className={["mt-1 text-[12px]", t.faint].join(" ")}>{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

function ActionLink({
  isDark,
  onClick,
  disabled,
  children,
  icon = <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />,
}: {
  isDark: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        actionLinkClass(isDark),
        "disabled:cursor-default disabled:opacity-40",
      ].join(" ")}
    >
      {children}
      {icon}
    </button>
  );
}

function InfoHint({
  isDark,
  text,
  align = "start",
}: {
  isDark: boolean;
  text: string;
  align?: "start" | "end";
}) {
  return (
    <span className="group relative inline-flex shrink-0 items-center">
      <button
        type="button"
        aria-label={text}
        className={[
          "inline-flex h-4 w-4 items-center justify-center rounded-full transition",
          focusRingClass(isDark),
          isDark
            ? "text-neutral-500 hover:text-neutral-200"
            : "text-neutral-500 hover:text-neutral-900",
        ].join(" ")}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 11v5.5" />
          <path d="M12 7.6v.1" strokeWidth="2.6" />
        </svg>
      </button>

      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute bottom-full z-30 mb-2 w-max max-w-[220px]",
          "rounded-lg px-2.5 py-1.5 text-[11px] font-medium normal-case leading-snug tracking-normal",
          "opacity-0 shadow-lg transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          align === "end" ? "right-0 text-right" : "left-0 text-left",
          isDark ? "bg-[#26262a] text-white" : "bg-neutral-900 text-white",
        ].join(" ")}
      >
        {text}
      </span>
    </span>
  );
}

function Delta({ isDark, value }: { isDark: boolean; value: string }) {
  const positive = !value.trim().startsWith("-");
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums",
        positive
          ? isDark
            ? "text-emerald-400"
            : "text-emerald-700"
          : isDark
            ? "text-rose-400"
            : "text-rose-700",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">{positive ? "Up " : "Down "}</span>
      {value}
    </span>
  );
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

  if (loading) {
    return (
      <div
        aria-hidden="true"
        className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-neutral-500/20"
      />
    );
  }

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        onError={() => setFailed(true)}
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className={[
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
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
  const t = tone(isDark);
  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="text-left sm:text-right">
      <p
        style={serif("28px")}
        className={["leading-none tracking-[-0.01em] tabular-nums", t.ink].join(" ")}
      >
        {time}
      </p>
      <p
        className={[
          "mt-1.5 text-[10px] font-medium uppercase tracking-[0.1em]",
          t.faint,
        ].join(" ")}
      >
        Local time
      </p>
    </div>
  );
}

/* ============================================================
   WEEK GOALS
============================================================ */

function GoalItem({
  isDark,
  title,
  hint,
  value,
  unit,
  progress,
  reached = false,
  subtitle,
  hintAlign,
}: {
  isDark: boolean;
  title: string;
  hint: string;
  value: ReactNode;
  unit?: string;
  progress: number;
  reached?: boolean;
  subtitle: ReactNode;
  hintAlign?: "start" | "end";
}) {
  const t = tone(isDark);
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className="min-w-0 px-5 py-4">
      <div className="flex items-center gap-1.5">
        <p
          className={[
            "text-[11px] font-semibold uppercase tracking-[0.08em]",
            t.soft,
          ].join(" ")}
        >
          {title}
        </p>
        <InfoHint isDark={isDark} text={hint} align={hintAlign} />
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span
          style={serif("30px")}
          className={["leading-none tracking-[-0.02em] tabular-nums", t.ink].join(" ")}
        >
          {value}
        </span>
        {unit && <span className={["text-[12px]", t.faint].join(" ")}>{unit}</span>}
      </div>

      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={["mt-3.5 h-[3px] w-full overflow-hidden rounded-full", t.track].join(
          " "
        )}
      >
        <div
          className={[
            "h-full rounded-full transition-[width] duration-700 ease-out",
            "motion-reduce:transition-none",
            reached ? t.accentBg : t.inkBg,
          ].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className={["mt-2.5 flex items-center gap-1.5 text-[12px]", t.soft].join(" ")}>
        {subtitle}
      </p>
    </div>
  );
}

type WeekGoalsProps = {
  isDark: boolean;
  weekStreak: number;
  postingGoal: { done: number; target: number };
  commentScore: { value: number; changePct: number };
};

function WeekGoals({
  isDark,
  weekStreak,
  postingGoal,
  commentScore,
}: WeekGoalsProps) {
  const t = tone(isDark);
  const goalRatio =
    postingGoal.target > 0 ? postingGoal.done / postingGoal.target : 0;
  const goalReached =
    postingGoal.target > 0 && postingGoal.done >= postingGoal.target;

  return (
    <section aria-label="Weekly goals" className="mt-7 shrink-0">
      <div
        className={[
          "grid grid-cols-1 divide-y rounded-2xl border",
          "sm:grid-cols-3 sm:divide-x sm:divide-y-0",
          t.tint,
          t.rule,
          t.divide,
        ].join(" ")}
      >
        <GoalItem
          isDark={isDark}
          title="Week Streak"
          hint="Consecutive weeks in which you reached your posting goal."
          value={weekStreak}
          unit={weekStreak === 1 ? "week" : "weeks"}
          progress={weekStreak > 0 ? 1 : 0}
          subtitle={
            weekStreak > 0
              ? "Streak hit, keep going!"
              : "Hit your goal to start a streak."
          }
        />

        <GoalItem
          isDark={isDark}
          title="Posting Goals"
          hint="Posts published this week compared to your weekly goal."
          value={`${Math.round(goalRatio * 100)}%`}
          progress={goalRatio}
          reached={goalReached}
          subtitle={
            goalReached
              ? "Goal reached, great work!"
              : `${postingGoal.done} of ${postingGoal.target}, so close!`
          }
        />

        <GoalItem
          isDark={isDark}
          title="Comment Score"
          hint="Your engagement score based on the comments you answer."
          hintAlign="end"
          value={commentScore.value}
          progress={commentScore.value / 100}
          subtitle={
            <>
              <Delta
                isDark={isDark}
                value={`${commentScore.changePct >= 0 ? "+" : ""}${commentScore.changePct}%`}
              />
              <span>from last week</span>
            </>
          }
        />
      </div>
    </section>
  );
}

/* ============================================================
   OVERVIEW (Followers / Likes / Comments)
============================================================ */

function Stat({
  isDark,
  icon,
  label,
  value,
  change,
  hint,
  hintAlign,
}: {
  isDark: boolean;
  icon: ReactNode;
  label: string;
  value: string;
  change: string;
  hint: string;
  hintAlign?: "start" | "end";
}) {
  const t = tone(isDark);

  return (
    <div
      className={[
        "min-w-0 py-5 first:pt-0 last:pb-0",
        "sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className={["flex h-4 w-4 items-center justify-center", t.faint].join(" ")}>
          {icon}
        </span>
        <p className={["text-[12px] font-medium", t.soft].join(" ")}>{label}</p>
        <InfoHint isDark={isDark} text={hint} align={hintAlign} />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          style={serif("clamp(36px, 4vw, 50px)")}
          className={["leading-none tracking-[-0.025em] tabular-nums", t.ink].join(" ")}
        >
          {value}
        </span>
        <Delta isDark={isDark} value={change} />
      </div>

      <p className={["mt-2 text-[11px]", t.faint].join(" ")}>vs previous period</p>
    </div>
  );
}

function OverviewSection({ isDark }: { isDark: boolean }) {
  const t = tone(isDark);

  return (
    <section
      aria-labelledby="home-overview-title"
      className={["mt-8 border-t pb-8 pt-6", t.rule].join(" ")}
    >
      <SectionHeader
        isDark={isDark}
        id="home-overview-title"
        title="Overview"
        subtitle="Example metrics · not connected to live channels"
      />

      <div
        className={[
          "mt-5 grid grid-cols-1 divide-y",
          "sm:grid-cols-3 sm:divide-x sm:divide-y-0",
          t.divide,
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
          hintAlign="end"
          icon={<MessageCircle className="h-4 w-4" />}
        />
      </div>
    </section>
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
  const t = tone(isDark);
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
            t.avatarRing,
          ].join(" ")}
        />
      ) : (
        <div
          className={[
            "flex h-full w-full items-center justify-center rounded-full",
            "text-[11px] font-semibold ring-2",
            isDark ? "bg-[#242428] text-white" : "bg-neutral-900 text-white",
            t.avatarRing,
          ].join(" ")}
        >
          {initial}
        </div>
      )}

      {NetworkIcon && (
        <span
          className={[
            "absolute -bottom-1 -right-1 flex h-4 w-4 items-center",
            "justify-center rounded-full bg-white text-black ring-2",
            t.avatarRing,
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
  const t = tone(isDark);
  const extra = channels.length - 6;

  return (
    <section
      aria-labelledby="home-channels-title"
      className={["min-w-0 lg:border-t lg:pt-6", t.rule].join(" ")}
    >
      <SectionHeader
        isDark={isDark}
        id="home-channels-title"
        title="Channels"
        subtitle="Your connected accounts"
        right={
          <ActionLink
            isDark={isDark}
            onClick={() =>
              channels.length === 0
                ? onAdd()
                : navigateToSettingsSection("channels")
            }
            icon={<ArrowUpRight className="h-3 w-3" aria-hidden="true" />}
          >
            {channels.length === 0 ? "Connect" : "Manage"}
          </ActionLink>
        }
      />

      {channels.length === 0 ? (
        <div className="mt-4 flex items-center gap-3.5">
          <button
            type="button"
            aria-label="Connect a channel"
            onClick={onAdd}
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              "border border-dashed transition",
              focusRingClass(isDark),
              isDark
                ? "border-white/25 text-white hover:bg-white/[0.07]"
                : "border-black/25 text-neutral-800 hover:bg-black/[0.04]",
            ].join(" ")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <div>
            <p className={["text-[12.5px] font-semibold", t.ink].join(" ")}>
              Connect your first channel
            </p>
            <p className={["mt-0.5 text-[11.5px]", t.faint].join(" ")}>
              Start publishing to social networks.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-3">
          <div className="flex shrink-0 items-center pl-1">
            {channels.slice(0, 6).map((channel, index) => (
              <ChannelAvatar
                key={channel.key}
                channel={channel}
                isDark={isDark}
                overlap={index > 0}
              />
            ))}

            {extra > 0 && (
              <span
                title={`${extra} more ${extra === 1 ? "channel" : "channels"}`}
                className={[
                  "-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  "text-[10px] font-semibold ring-2",
                  isDark
                    ? "bg-[#242428] text-white"
                    : "bg-neutral-200 text-neutral-700",
                  t.avatarRing,
                ].join(" ")}
              >
                +{extra}
              </span>
            )}

            <button
              type="button"
              aria-label="Connect another channel"
              title="Connect another channel"
              onClick={onAdd}
              className={[
                "relative z-10 -ml-2 flex h-9 w-9 shrink-0 items-center justify-center",
                "rounded-full border ring-2 transition-colors duration-200",
                focusRingClass(isDark),
                t.avatarRing,
                isDark
                  ? "border-white/[0.18] bg-[#161618] text-white hover:bg-[#1f1f22]"
                  : "border-black/[0.14] bg-white text-neutral-700 hover:bg-neutral-50",
              ].join(" ")}
            >
              <Plus className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </button>
          </div>

          <div className="min-w-0">
            <p className={["text-[12.5px] font-semibold", t.ink].join(" ")}>
              {channels.length} {channels.length === 1 ? "channel" : "channels"}{" "}
              connected
            </p>
            <p className={["text-[11.5px]", t.faint].join(" ")}>Ready to publish</p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   UP NEXT
============================================================ */

function getWeekDays(now: Date): Date[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offsetFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offsetFromMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function UpNext({
  isDark,
  title,
  meta,
  onViewAll,
  icon,
  line1,
  line2,
  action,
  now,
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
  now: Date;
}) {
  const t = tone(isDark);
  const days = getWeekDays(now);
  const today = now.toDateString();

  return (
    <section aria-labelledby="home-upnext-title" className="min-w-0">
      <SectionHeader
        isDark={isDark}
        id="home-upnext-title"
        title={title}
        meta={meta}
        right={
          <ActionLink isDark={isDark} disabled={!onViewAll} onClick={onViewAll}>
            View All
          </ActionLink>
        }
      />

      <p className={["mt-4 text-[12px] font-medium", t.soft].join(" ")}>
        {now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
      </p>

      <ol aria-label="This week" className="mt-3 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isToday = day.toDateString() === today;

          return (
            <li key={day.getTime()} className="flex flex-col items-center gap-1.5">
              <span
                className={[
                  "text-[10px] font-medium uppercase tracking-[0.08em]",
                  isToday ? t.ink : t.faint,
                ].join(" ")}
              >
                {day.toLocaleDateString("en-GB", { weekday: "short" })}
              </span>
              <span
                aria-current={isToday ? "date" : undefined}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  "text-[13px] font-medium tabular-nums",
                  isToday ? [t.accentBg, t.accentOn].join(" ") : t.body,
                ].join(" ")}
              >
                {day.getDate()}
              </span>
            </li>
          );
        })}
      </ol>

      <div className={["mt-5 flex items-start gap-3.5 border-t pt-5", t.rule].join(" ")}>
        <span
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            t.rule,
            t.soft,
          ].join(" ")}
        >
          {icon}
        </span>

        <div className="min-w-0">
          <p className={["text-[13px] font-semibold", t.ink].join(" ")}>{line1}</p>
          <p className={["mt-0.5 text-[12px]", t.soft].join(" ")}>{line2}</p>

          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className={[secondaryButtonClass(isDark), "mt-3.5"].join(" ")}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {action.label}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   COMMENTS
============================================================ */

function formatCommentTime(value: string | null): string {
  if (!value) return "Date inconnue";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Date inconnue";

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSeconds, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diffSeconds / 86400), "day");
  return new Date(timestamp).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}

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
  const t = tone(isDark);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const NetworkIcon = NETWORK_ICONS[network];

  return (
    <div className="relative h-9 w-9 shrink-0">
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
            "text-[12px] font-semibold",
            isDark ? "bg-[#242428] text-white" : "bg-neutral-900 text-white",
          ].join(" ")}
        >
          {initial}
        </div>
      )}

      <span
        className={[
          "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center",
          "justify-center rounded-full ring-2",
          network === "youtube" ? "bg-[#ff0000]" : "bg-white text-black",
          t.avatarRing,
        ].join(" ")}
      >
        {network === "youtube" ? (
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="4.5" fill="#fff" />
            <path d="M10 9v6l5-3-5-3Z" fill="#ff0000" />
          </svg>
        ) : (
          <NetworkIcon className="h-2.5 w-2.5" />
        )}
      </span>
    </div>
  );
}

function VideoThumb({ src, isDark }: { src: string | null; isDark: boolean }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={[
        "hidden h-[52px] w-[92px] shrink-0 rounded-lg object-cover ring-1 sm:block",
        isDark ? "ring-white/[0.08]" : "ring-black/[0.08]",
      ].join(" ")}
    />
  );
}

function CommentRow({
  isDark,
  comment,
  onOpen,
}: {
  isDark: boolean;
  comment: HomeComment;
  onOpen: (channelKey: string) => void;
}) {
  const t = tone(isDark);

  return (
    <button
      type="button"
      onClick={() => onOpen(comment.channel.key)}
      aria-label={`Open conversation with ${comment.author}`}
      className={[
        "group relative isolate flex w-full items-start gap-3.5 py-4 text-left",
        "before:absolute before:-inset-x-3 before:inset-y-0 before:-z-10",
        "before:rounded-xl before:transition-colors before:duration-200",
        "motion-reduce:before:transition-none",
        "focus-visible:outline-none focus-visible:before:ring-2",
        isDark
          ? "hover:before:bg-white/[0.045] focus-visible:before:ring-white/30"
          : "hover:before:bg-black/[0.035] focus-visible:before:ring-black/25",
      ].join(" ")}
    >
      <CommentAvatar
        src={comment.authorAvatar}
        name={comment.author}
        network={comment.network}
        isDark={isDark}
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <p className={["truncate text-[13px] font-semibold", t.ink].join(" ")}>
              {comment.author}
            </p>
            {!comment.isRead && (
              <span
                aria-hidden="true"
                className={["h-1.5 w-1.5 shrink-0 rounded-full", t.accentBg].join(" ")}
              />
            )}
          </div>
          <span
            className={[
              "inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums",
              t.faint,
            ].join(" ")}
          >
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            {formatCommentTime(comment.publishedAt)}
          </span>
        </div>

        <p className={["mt-0.5 truncate text-[11.5px]", t.faint].join(" ")}>
          {comment.channel.handle || comment.channel.name || comment.network}
          {comment.videoTitle ? ` · ${comment.videoTitle}` : ""}
        </p>

        <p
          className={["mt-1.5 text-[13px] leading-[1.5]", t.body].join(" ")}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
          }}
        >
          {comment.text || "This comment has no text."}
        </p>

        <div className="mt-2.5 flex items-center justify-between gap-3">
          {comment.answered ? (
            <span
              className={[
                "inline-flex items-center gap-1 text-[11.5px] font-medium",
                isDark ? "text-emerald-400" : "text-emerald-700",
              ].join(" ")}
            >
              <CheckCheck className="h-3 w-3" aria-hidden="true" />
              Replied
            </span>
          ) : (
            <span />
          )}

          <span
            className={[
              "inline-flex items-center gap-1 text-[12px] font-medium transition-colors",
              t.soft,
              isDark ? "group-hover:text-white" : "group-hover:text-neutral-900",
            ].join(" ")}
          >
            Open conversation
            <ArrowUpRight
              className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px motion-reduce:transform-none"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>

      <VideoThumb src={comment.videoThumbnail} isDark={isDark} />

      <span className="sr-only">{comment.isRead ? "Read." : "Unread."}</span>
    </button>
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
  const t = tone(isDark);
  const visibleComments = comments.slice(0, HOME_COMMENTS_LIMIT);
  const skeletonBar = isDark ? "bg-white/10" : "bg-black/[0.07]";

  return (
    <section className="min-w-0" aria-labelledby="home-comments-title">
      <SectionHeader
        isDark={isDark}
        id="home-comments-title"
        title="Comments"
        subtitle="Keep up with your community"
      />

      <div className="mt-4">
        {loading && visibleComments.length === 0 ? (
          <div
            className={["divide-y border-y", t.divide, t.rule].join(" ")}
            aria-label="Loading comments"
            aria-live="polite"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="flex animate-pulse items-start gap-3.5 py-4"
                aria-hidden="true"
              >
                <div className={["h-9 w-9 shrink-0 rounded-full", skeletonBar].join(" ")} />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <div className={["h-2.5 w-1/4 rounded-full", skeletonBar].join(" ")} />
                  <div className={["h-2.5 w-full rounded-full", skeletonBar].join(" ")} />
                  <div className={["h-2.5 w-2/3 rounded-full", skeletonBar].join(" ")} />
                </div>
              </div>
            ))}
          </div>
        ) : visibleComments.length === 0 ? (
          <div className={["flex items-start gap-3.5 border-y py-8", t.rule].join(" ")}>
            <span
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                t.rule,
                t.soft,
              ].join(" ")}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <p className={["text-[13px] font-semibold", t.ink].join(" ")}>
                {error
                  ? "Comments couldn't be loaded"
                  : connectedChannelsCount === 0
                    ? "Connect a channel to get started"
                    : "You're all caught up"}
              </p>
              <p
                className={[
                  "mt-1 max-w-[380px] text-[12px] leading-relaxed",
                  t.soft,
                ].join(" ")}
              >
                {error
                  ? "We couldn't retrieve your latest comments. Please check your connection and try again later."
                  : connectedChannelsCount === 0
                    ? "Connect your YouTube account to see and manage comments from your audience here."
                    : "When new comments arrive, they'll appear here so you can respond quickly."}
              </p>

              {connectedChannelsCount === 0 && !error && (
                <button
                  type="button"
                  onClick={onConnect}
                  className={[primaryButtonClass(isDark), "mt-4"].join(" ")}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Connect a channel
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {error && (
              <p
                className={[
                  "mb-3 rounded-lg border-l-2 px-3 py-2 text-[12px]",
                  isDark
                    ? "border-amber-400/60 bg-amber-400/[0.06] text-amber-100/80"
                    : "border-amber-600/60 bg-amber-50 text-amber-800",
                ].join(" ")}
                role="status"
              >
                Some comments may be missing because a source couldn't be reached.
              </p>
            )}

            <ul className={["divide-y border-t", t.divide, t.rule].join(" ")}>
              {visibleComments.map((comment) => (
                <li key={comment.id}>
                  <CommentRow isDark={isDark} comment={comment} onOpen={onOpen} />
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onViewMore}
              className={[
                "group flex w-full items-center justify-between border-t py-3.5",
                "text-[12.5px] font-medium transition-colors",
                focusRingClass(isDark),
                t.rule,
                t.ink,
              ].join(" ")}
            >
              View all comments
              <ChevronRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   BLOG
============================================================ */

function BlogImage({
  src,
  isDark,
  className,
}: {
  src?: string;
  isDark: boolean;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={[
          className,
          "bg-gradient-to-br",
          isDark
            ? "from-white/[0.04] to-white/[0.09]"
            : "from-black/[0.04] to-black/[0.09]",
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
      className={[className, "object-cover"].join(" ")}
    />
  );
}

function BlogSection({ isDark }: { isDark: boolean }) {
  const t = tone(isDark);
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <section
      aria-labelledby="home-blog-title"
      className={["border-t pt-6", t.rule].join(" ")}
    >
      <div className="flex items-end justify-between gap-4">
        <h2
          id="home-blog-title"
          style={serif()}
          className={["text-[20px] leading-tight tracking-[-0.01em]", t.ink].join(" ")}
        >
          From the Blog
        </h2>

        <a
          href={BLOG_URL}
          {...linkProps(BLOG_URL)}
          className={[
            actionLinkClass(isDark),
            isDark ? "hover:text-white" : "hover:text-neutral-900",
          ].join(" ")}
        >
          View All Articles
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        {featured && (
          <a
            href={featured.url}
            {...linkProps(featured.url)}
            className={[
              "group block rounded-xl lg:col-span-7",
              focusRingClass(isDark),
            ].join(" ")}
          >
            <BlogImage
              src={featured.image}
              isDark={isDark}
              className="aspect-[16/9] w-full rounded-xl"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                <span className={t.accentText}>{featured.label}</span>
                <span className={t.faint}>· {featured.date}</span>
              </p>
              <ArrowRight
                className={[
                  "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                  "motion-reduce:transform-none",
                  t.ink,
                ].join(" ")}
                aria-hidden="true"
              />
            </div>

            <h3
              style={serif("clamp(22px, 2.4vw, 30px)")}
              className={["mt-2 leading-[1.2] tracking-[-0.015em]", t.ink].join(" ")}
            >
              {featured.title}
            </h3>
          </a>
        )}

        <ul className={["divide-y lg:col-span-5", t.divide].join(" ")}>
          {rest.map((post) => (
            <li key={post.title} className="py-5 first:pt-0 last:pb-0">
              <a
                href={post.url}
                {...linkProps(post.url)}
                className={[
                  "group flex items-start gap-4 rounded-lg",
                  focusRingClass(isDark),
                ].join(" ")}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]">
                    <span className={t.soft}>{post.label}</span>
                    <span className={t.faint}>· {post.date}</span>
                  </p>
                  <h3
                    style={{
                      ...serif("17px"),
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                    className={[
                      "mt-2 leading-snug tracking-[-0.01em] transition-colors",
                      t.ink,
                    ].join(" ")}
                  >
                    {post.title}
                  </h3>
                </div>

                <BlogImage
                  src={post.image}
                  isDark={isDark}
                  className="h-[76px] w-[104px] shrink-0 rounded-xl"
                />
              </a>
            </li>
          ))}
        </ul>
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
  const t = tone(isDark);
  const sidebarOffset = useSidebarOffset();

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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);

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

  const formattedDate = `${now.toLocaleDateString("en-US", {
    weekday: "short",
  })}, ${now.toLocaleDateString("en-US", {
    month: "short",
  })} ${now.getDate()} ${now.getFullYear()}`;

  const displayName = fullName || "adamnolke";

  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }

    throw new Error(unavailablePostActionMessage(payload));
  };

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

  return (
    <main
      className={[
        "relative h-screen w-full overflow-hidden",
        "transition-colors duration-300",
        t.page,
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      <div
        className={[
          "h-full py-3 pr-3",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        <div
          className={[
            "h-full overflow-y-auto overflow-x-hidden",
            "rounded-3xl border",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "transition-colors duration-300",
            t.panel,
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto flex w-full max-w-[1360px]",
              "flex-col px-[clamp(18px,3vw,48px)]",
              "pb-[120px] pt-[clamp(20px,3vw,36px)]",
            ].join(" ")}
          >
            {/* ───────── Header ───────── */}
            <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-8 gap-y-5">
              <div className="flex min-w-0 items-center gap-4">
                <GreetingAvatar
                  avatarUrl={user?.avatar_url}
                  initials={initials}
                  isDark={isDark}
                  loading={!userLoaded}
                />
                <div className="min-w-0">
                  <p
                    className={[
                      "text-[11px] font-medium uppercase tracking-[0.1em]",
                      t.faint,
                    ].join(" ")}
                  >
                    {formattedDate}
                  </p>
                  <h1
                    style={serif("clamp(24px, 3vw, 34px)")}
                    className={[
                      "mt-1 break-words leading-[1.1] tracking-[-0.02em]",
                      t.ink,
                    ].join(" ")}
                  >
                    {greeting.charAt(0).toUpperCase() + greeting.slice(1)},{" "}
                    <span>{displayName}</span>
                  </h1>
                </div>
              </div>

              <div className="flex w-full items-center justify-between gap-6 sm:w-auto sm:justify-end">
                <ClockDisplay isDark={isDark} now={now} />
                <button
                  type="button"
                  onClick={() => handleBottomBarChange("add")}
                  className={primaryButtonClass(isDark)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Create Post
                </button>
              </div>
            </header>

            {/* ───────── Objectifs de la semaine ───────── */}
            <WeekGoals
              isDark={isDark}
              weekStreak={1}
              postingGoal={{ done: 1, target: 2 }}
              commentScore={{ value: 13, changePct: 100 }}
            />

            {/* ───────── Overview ───────── */}
            <OverviewSection isDark={isDark} />

            {/* ───────── Comments | Up Next + Channels ───────── */}
            <div
              className={["grid grid-cols-1 border-t lg:grid-cols-12", t.rule].join(
                " "
              )}
            >
              <div className="pb-8 pt-6 lg:col-span-8 lg:pr-8">
                <CommentsPanel
                  isDark={isDark}
                  comments={latestComments.comments}
                  loading={latestComments.loading}
                  error={latestComments.error}
                  connectedChannelsCount={connectedChannels.length}
                  onOpen={(key) =>
                    navigate(`community?channel=${encodeURIComponent(key)}`)
                  }
                  onViewMore={() =>
                    handleViewAllComments(latestComments.comments[0]?.channel.key)
                  }
                  onConnect={() => navigateToSettingsSection("channels")}
                />
              </div>

              <div
                className={[
                  "border-t pb-8 pt-6",
                  "lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-8",
                  t.rule,
                ].join(" ")}
              >
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-1">
                  <UpNext
                    isDark={isDark}
                    title="Up Next"
                    meta="0 posts scheduled"
                    onViewAll={() => navigate("calendar")}
                    icon={<CalendarDays className="h-4 w-4" />}
                    line1="No posts scheduled yet."
                    line2="You'll see upcoming posts here."
                    action={{
                      label: "Create Post",
                      onClick: () => setIsNewPostOpen(true),
                    }}
                    now={now}
                  />

                  <Channels
                    isDark={isDark}
                    channels={connectedChannels}
                    onAdd={() => navigateToSettingsSection("channels")}
                  />
                </div>
              </div>
            </div>

            {/* ───────── Blog ───────── */}
            <BlogSection isDark={isDark} />
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