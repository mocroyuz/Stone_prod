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
  CalendarDays,
  CheckCheck,
  MessageCircle,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
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
const asideSurface = (d: boolean) =>
  d
    ? "border-white/[0.07] bg-white/[0.025]"
    : "border-black/[0.06] bg-[#f6f4f0]";
const hair = (d: boolean) => (d ? "border-white/[0.08]" : "border-black/[0.08]");
const divide = (d: boolean) => (d ? "divide-white/[0.08]" : "divide-black/[0.08]");
const rowHover = (d: boolean) => (d ? "hover:bg-white/[0.03]" : "hover:bg-black/[0.025]");
const track = (d: boolean) => (d ? "bg-white/10" : "bg-black/10");
const fill = (d: boolean) => (d ? "bg-white" : "bg-neutral-900");
const ringCls = (d: boolean) => (d ? "ring-[#0a0a0c]" : "ring-white");
const muted = (d: boolean) => (d ? "text-neutral-600" : "text-neutral-400");
const strong = (d: boolean) => (d ? "text-white" : "text-neutral-900");
const soft = (d: boolean) => (d ? "text-neutral-400" : "text-neutral-500");
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

EOF
cat > /tmp/tail.tsx <<'EOF'
/* ============================================================
   PRIMITIVES
============================================================ */

function Avatar({
  src,
  fallback,
  isDark,
  className,
}: {
  src?: string | null;
  fallback: string;
  isDark: boolean;
  className: string;
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
        className={cx(className, "rounded-full object-cover")}
      />
    );
  }
  return (
    <div
      className={cx(
        className,
        "flex items-center justify-center rounded-full font-semibold",
        isDark ? "bg-[#242428] text-white" : "bg-neutral-900 text-white"
      )}
    >
      {fallback}
    </div>
  );
}

function NetworkBadge({ network, isDark }: { network: SocialNetworkKey; isDark: boolean }) {
  const Icon = NETWORK_ICONS[network];
  return (
    <span
      className={cx(
        "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2",
        network === "youtube" ? "bg-[#ff0000]" : "bg-white text-black",
        ringCls(isDark)
      )}
    >
      {network === "youtube" ? (
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="4.5" fill="#fff" />
          <path d="M10 9v6l5-3-5-3Z" fill="#ff0000" />
        </svg>
      ) : (
        <Icon className="h-2 w-2" />
      )}
    </span>
  );
}

function SectionTitle({
  isDark,
  children,
  action,
}: {
  isDark: boolean;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className={cx("text-[12px] font-semibold", soft(isDark))}>{children}</h2>
      {action}
    </div>
  );
}

function TextButton({
  isDark,
  onClick,
  children,
}: {
  isDark: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1 rounded-md text-[11px] font-semibold transition",
        focusRing(isDark),
        isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900"
      )}
    >
      {children}
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

/* ============================================================
   HEADER
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
        "flex h-10 w-full items-center gap-2 rounded-full border px-4 sm:w-[240px]",
        hair(isDark),
        isDark ? "focus-within:border-white/25" : "focus-within:border-black/25"
      )}
    >
      <Search className={cx("h-3.5 w-3.5 shrink-0", muted(isDark))} aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search"
        aria-label="Search"
        className={cx(
          "min-w-0 flex-1 bg-transparent text-[12px] outline-none",
          strong(isDark),
          isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400"
        )}
      />
    </label>
  );
}

/* ============================================================
   METRICS (exemple)
============================================================ */

function Metric({
  isDark,
  label,
  value,
  change,
  hint,
}: {
  isDark: boolean;
  label: string;
  value: string;
  change: string;
  hint: string;
}) {
  const up = change.startsWith("+");
  const Trend = up ? TrendingUp : TrendingDown;

  return (
    <div title={hint} className="min-w-0 px-5 first:pl-0 last:pr-0">
      <p className={cx("text-[11px] font-medium", soft(isDark))}>{label}</p>
      <p
        className={cx(
          "mt-1 text-[clamp(26px,3vw,36px)] font-semibold leading-none tracking-[-0.04em] tabular-nums",
          strong(isDark)
        )}
      >
        {value}
      </p>
      <p
        className={cx(
          "mt-2 inline-flex items-center gap-1 text-[11px] font-semibold",
          up
            ? isDark ? "text-emerald-400" : "text-emerald-600"
            : isDark ? "text-rose-400" : "text-rose-600"
        )}
      >
        <Trend className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">{up ? "Up " : "Down "}</span>
        {change}
      </p>
    </div>
  );
}

/* ============================================================
   INBOX (commentaires)
============================================================ */

function formatDate(value: string | null): string {
  return formatCommentTime(value);
}

function CommentsInbox({
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
  const [tab, setTab] = useState<"all" | "todo">("all");
  const todo = comments.filter((c) => !c.answered);
  const list = (tab === "todo" ? todo : comments).slice(0, HOME_COMMENTS_LIMIT);

  const tabs = [
    { id: "all" as const, label: "All", count: comments.length },
    { id: "todo" as const, label: "To reply", count: todo.length },
  ];

  const message = error
    ? ["Comments couldn't be loaded", "Please check your connection and try again later."]
    : connectedChannelsCount === 0
      ? ["Connect a channel to get started", "Connect your YouTube account to manage comments here."]
      : tab === "todo"
        ? ["Nothing left to reply to", "You've answered every recent comment."]
        : ["You're all caught up", "New comments will appear here."];

  return (
    <section aria-labelledby="inbox-title" className="min-w-0">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            id="inbox-title"
            className={cx("text-[20px] font-semibold tracking-[-0.03em]", strong(isDark))}
          >
            Comments
          </h2>
          <p className={cx("mt-0.5 text-[12px]", soft(isDark))}>Keep up with your community</p>
        </div>
        <TextButton isDark={isDark} onClick={onViewMore}>
          Open community
        </TextButton>
      </div>

      <div role="tablist" className={cx("mt-4 flex gap-5 border-b", hair(isDark))}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cx(
                "-mb-px border-b-2 pb-2.5 text-[12px] font-semibold transition",
                focusRing(isDark),
                active
                  ? cx(strong(isDark), isDark ? "border-white" : "border-neutral-900")
                  : cx(soft(isDark), "border-transparent hover:opacity-80")
              )}
            >
              {t.label}
              <span className={cx("ml-1.5 font-normal tabular-nums", muted(isDark))}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {loading && list.length === 0 ? (
        <div className={cx("divide-y", divide(isDark))} aria-label="Loading comments" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse gap-3 py-4" aria-hidden="true">
              <div className={cx("h-9 w-9 rounded-full", track(isDark))} />
              <div className="flex-1 space-y-2 pt-1">
                <div className={cx("h-2.5 w-1/4 rounded", track(isDark))} />
                <div className={cx("h-2.5 w-4/5 rounded", track(isDark))} />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <MessageCircle className={cx("h-5 w-5", muted(isDark))} aria-hidden="true" />
          <p className={cx("mt-3 text-[13px] font-semibold", strong(isDark))}>{message[0]}</p>
          <p className={cx("mt-1 max-w-[300px] text-[12px] leading-snug", soft(isDark))}>{message[1]}</p>
          {connectedChannelsCount === 0 && !error && (
            <button
              type="button"
              onClick={onConnect}
              className={cx(
                "mt-4 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-semibold transition",
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
        <>
          {error && (
            <p role="status" className={cx("mt-3 text-[11px]", isDark ? "text-amber-200/80" : "text-amber-700")}>
              Some comments may be missing because a source couldn't be reached.
            </p>
          )}
          <ul className={cx("divide-y", divide(isDark))}>
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpen(c.channel.key)}
                  aria-label={`Open conversation with ${c.author}`}
                  className={cx(
                    "group -mx-3 flex w-[calc(100%+1.5rem)] items-start gap-3 rounded-xl px-3 py-3.5 text-left transition motion-reduce:transition-none",
                    focusRing(isDark),
                    rowHover(isDark)
                  )}
                >
                  <div className="relative h-9 w-9 shrink-0">
                    <Avatar
                      src={c.authorAvatar}
                      fallback={c.author.replace(/^@/, "").charAt(0).toUpperCase() || "?"}
                      isDark={isDark}
                      className="h-full w-full text-[12px]"
                    />
                    <NetworkBadge network={c.network} isDark={isDark} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={cx("flex min-w-0 items-center gap-1.5 text-[13px] font-semibold", strong(isDark))}>
                        <span className="truncate">{c.author}</span>
                        {!c.isRead && (
                          <span
                            className={cx("h-1.5 w-1.5 shrink-0 rounded-full", fill(isDark))}
                            aria-label="Unread"
                          />
                        )}
                      </p>
                      <span className={cx("shrink-0 text-[11px]", muted(isDark))}>
                        {formatDate(c.publishedAt)}
                      </span>
                    </div>

                    <p
                      className={cx("mt-0.5 text-[13px] leading-[1.45]", isDark ? "text-neutral-300" : "text-neutral-700")}
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

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={cx("truncate text-[11px]", muted(isDark))}>
                        {c.videoTitle || c.channel.handle || c.channel.name || c.network}
                      </span>
                      {c.answered ? (
                        <span
                          className={cx(
                            "inline-flex shrink-0 items-center gap-1 text-[11px] font-medium",
                            isDark ? "text-emerald-300" : "text-emerald-700"
                          )}
                        >
                          <CheckCheck className="h-3 w-3" aria-hidden="true" />
                          Replied
                        </span>
                      ) : (
                        <span
                          className={cx(
                            "ml-auto shrink-0 text-[11px] font-semibold opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100",
                            strong(isDark)
                          )}
                        >
                          Reply
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ============================================================
   ASIDE
============================================================ */

function Meter({
  isDark,
  label,
  valueLabel,
  progress,
  note,
}: {
  isDark: boolean;
  label: string;
  valueLabel: string;
  progress: number;
  note?: ReactNode;
}) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cx("text-[12px] font-semibold", strong(isDark))}>{label}</p>
        <p className={cx("text-[12px] font-semibold tabular-nums", strong(isDark))}>{valueLabel}</p>
      </div>
      <div
        className={cx("mt-2 h-1.5 overflow-hidden rounded-full", track(isDark))}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
      >
        <div
          className={cx("h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none", fill(isDark))}
          style={{ width: `${p * 100}%` }}
        />
      </div>
      {note && <p className={cx("mt-1.5 text-[11px]", soft(isDark))}>{note}</p>}
    </div>
  );
}

function WeekGoals({
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

  return (
    <div className="space-y-4">
      <Meter
        isDark={isDark}
        label="Posting goal"
        valueLabel={`${postingGoal.done} / ${postingGoal.target}`}
        progress={ratio}
        note={reached ? "Goal reached, great work!" : "Posts published this week."}
      />
      <Meter
        isDark={isDark}
        label="Comment score"
        valueLabel={String(commentScore.value)}
        progress={commentScore.value / 100}
        note={`${up ? "+" : ""}${commentScore.changePct}% from last week`}
      />
      <div className="flex items-baseline justify-between gap-2">
        <p className={cx("text-[12px] font-semibold", strong(isDark))}>Week streak</p>
        <p className={cx("text-[12px] font-semibold tabular-nums", strong(isDark))}>
          {weekStreak} {weekStreak === 1 ? "week" : "weeks"}
        </p>
      </div>
    </div>
  );
}

function ChannelsRow({
  isDark,
  channels,
  onAdd,
}: {
  isDark: boolean;
  channels: ConnectedChannel[];
  onAdd: () => void;
}) {
  const extra = channels.length - 5;

  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0 items-center">
        {channels.slice(0, 5).map((ch, i) => {
          const label = ch.handle || ch.name || "Channel";
          const network = getNetworkId(ch);
          return (
            <div
              key={ch.key}
              title={label}
              className="relative h-9 w-9 shrink-0"
              style={{ marginLeft: i > 0 ? -8 : 0 }}
            >
              <Avatar
                src={ch.avatarUrl}
                fallback={label.replace(/^@/, "").charAt(0).toUpperCase() || "?"}
                isDark={isDark}
                className={cx("h-full w-full text-[11px] ring-2", isDark ? "ring-[#121214]" : "ring-[#f6f4f0]")}
              />
              {network && <NetworkBadge network={network} isDark={isDark} />}
            </div>
          );
        })}
        {extra > 0 && (
          <span
            className={cx(
              "-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-semibold ring-2",
              isDark ? "bg-[#242428] text-white ring-[#121214]" : "bg-neutral-200 text-neutral-700 ring-[#f6f4f0]"
            )}
          >
            +{extra}
          </span>
        )}
        <button
          type="button"
          aria-label="Connect a channel"
          onClick={onAdd}
          className={cx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed transition",
            channels.length > 0 && "ml-2",
            focusRing(isDark),
            isDark
              ? "border-white/25 text-white hover:bg-white/[0.07]"
              : "border-black/25 text-neutral-700 hover:bg-black/[0.04]"
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className={cx("min-w-0 text-[11px]", soft(isDark))}>
        {channels.length === 0
          ? "Connect your first channel to start publishing."
          : `${channels.length} ${channels.length === 1 ? "channel" : "channels"} ready to publish`}
      </p>
    </div>
  );
}

/* ============================================================
   BLOG
============================================================ */

function BlogTile({ post }: { post: BlogPost }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [post.image]);

  return (
    <a
      href={post.url}
      {...linkProps(post.url)}
      className="group relative flex h-[190px] flex-col justify-end overflow-hidden rounded-2xl bg-neutral-800 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {post.image && !failed && (
        <img
          src={post.image}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"
      />
      <div className="relative">
        <p className="text-[10px] font-medium text-white/65">{post.date}</p>
        <h3
          className="mt-1 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-white"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {post.title}
        </h3>
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
    const i = setInterval(() => setNow(new Date()), 60_000);
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
  const dateLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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

  const goChannels = () => navigateToSettingsSection("channels");

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
          <div className="mx-auto w-full max-w-[1320px] px-[clamp(18px,3.5vw,56px)] pb-[120px] pt-[clamp(20px,3.5vw,44px)]">
            {/* Header */}
            <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
              <div className="flex min-w-0 items-center gap-4">
                {userLoaded ? (
                  <Avatar
                    src={user?.avatar_url}
                    fallback={initials}
                    isDark={isDark}
                    className="h-14 w-14 shrink-0 text-[18px]"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-neutral-500/20" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className={cx("text-[12px] font-medium", soft(isDark))}>{dateLabel}</p>
                  <h1
                    className={cx(
                      "truncate text-[clamp(24px,3vw,34px)] font-semibold leading-tight tracking-[-0.04em]",
                      strong(isDark)
                    )}
                  >
                    {getGreeting(now)}, {displayName}
                  </h1>
                </div>
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <SearchBar isDark={isDark} value={query} onChange={setQuery} />
                <button
                  type="button"
                  onClick={() => setIsNewPostOpen(true)}
                  className={cx(
                    "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-semibold transition",
                    focusRing(isDark),
                    primaryBtn(isDark)
                  )}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Create Post
                </button>
              </div>
            </header>

            {/* Metrics */}
            <section
              aria-label="Overview"
              className={cx("mt-8 border-y py-5", hair(isDark))}
            >
              <div className={cx("grid grid-cols-3 divide-x", divide(isDark))}>
                <Metric
                  isDark={isDark}
                  label="Followers"
                  value="27K"
                  change="-2%"
                  hint="Total followers across all your connected channels, compared to the previous period."
                />
                <Metric
                  isDark={isDark}
                  label="Likes"
                  value="12.4K"
                  change="+16%"
                  hint="Total likes received on your posts across all channels, compared to the previous period."
                />
                <Metric
                  isDark={isDark}
                  label="Comments"
                  value="342"
                  change="+5%"
                  hint="Total comments received on your posts across all channels, compared to the previous period."
                />
              </div>
              <p className={cx("mt-4 text-[10px]", muted(isDark))}>
                Example metrics · not connected to live channels
              </p>
            </section>

            {/* Inbox + aside */}
            <div className="mt-8 grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
              <CommentsInbox
                isDark={isDark}
                comments={latestComments.comments}
                loading={latestComments.loading}
                error={latestComments.error}
                connectedChannelsCount={connectedChannels.length}
                onOpen={(key) => navigate(`community?channel=${encodeURIComponent(key)}`)}
                onViewMore={() => openCommunity(latestComments.comments[0]?.channel.key)}
                onConnect={goChannels}
              />

              <aside
                className={cx(
                  "h-fit self-start rounded-2xl border p-5 xl:sticky xl:top-0",
                  asideSurface(isDark)
                )}
              >
                <div className={cx("divide-y", divide(isDark))}>
                  <section className="pb-5">
                    <SectionTitle isDark={isDark}>This week</SectionTitle>
                    <WeekGoals
                      isDark={isDark}
                      weekStreak={1}
                      postingGoal={{ done: 1, target: 2 }}
                      commentScore={{ value: 13, changePct: 100 }}
                    />
                  </section>

                  <section className="py-5">
                    <SectionTitle
                      isDark={isDark}
                      action={
                        <TextButton isDark={isDark} onClick={() => navigate("calendar")}>
                          Calendar
                        </TextButton>
                      }
                    >
                      Up next
                    </SectionTitle>
                    <div className="flex items-start gap-3">
                      <CalendarDays className={cx("mt-0.5 h-4 w-4 shrink-0", soft(isDark))} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className={cx("text-[12px] font-semibold", strong(isDark))}>
                          No posts scheduled yet
                        </p>
                        <p className={cx("mt-0.5 text-[11px]", soft(isDark))}>
                          Upcoming posts will appear here.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsNewPostOpen(true)}
                          className={cx(
                            "mt-2.5 text-[11px] font-semibold underline underline-offset-4 transition",
                            focusRing(isDark),
                            strong(isDark)
                          )}
                        >
                          Schedule a post
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="pt-5">
                    <SectionTitle
                      isDark={isDark}
                      action={
                        connectedChannels.length > 0 ? (
                          <TextButton isDark={isDark} onClick={goChannels}>
                            Manage
                          </TextButton>
                        ) : undefined
                      }
                    >
                      Channels
                    </SectionTitle>
                    <ChannelsRow isDark={isDark} channels={connectedChannels} onAdd={goChannels} />
                  </section>
                </div>
              </aside>
            </div>

            {/* Blog */}
            <section className="mt-12">
              <SectionTitle
                isDark={isDark}
                action={
                  <a
                    href={BLOG_URL}
                    {...linkProps(BLOG_URL)}
                    className={cx(
                      "inline-flex items-center gap-1 rounded-md text-[11px] font-semibold transition",
                      focusRing(isDark),
                      isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900"
                    )}
                  >
                    All articles
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </a>
                }
              >
                From the blog
              </SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {BLOG_POSTS.map((post) => (
                  <BlogTile key={post.title} post={post} />
                ))}
              </div>
            </section>
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