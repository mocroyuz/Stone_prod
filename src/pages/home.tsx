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
  clearCache,
  isAvatarStale,
  readCache,
  writeCache,
  type CacheProvider,
  type Connection,
} from "../services/channelsCache";

import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Link2,
  MessageCircle,
  Plus,
  Send,
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
   DESIGN TOKENS
   Palette sobre : fonds neutres, bordures fines, aucun effet
   décoratif. Une seule couleur d'accent (bleu) pour les actions.
============================================================ */

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const ui = (isDark: boolean) => ({
  page: isDark ? "bg-[#09090b]" : "bg-[#f7f8fa]",
  card: isDark
    ? "border-white/[0.08] bg-[#101012]"
    : "border-zinc-200 bg-white",
  cardHover: isDark ? "hover:bg-white/[0.025]" : "hover:bg-zinc-50/80",
  head: isDark ? "bg-white/[0.02]" : "bg-zinc-50/70",
  line: isDark ? "border-white/[0.07]" : "border-zinc-200",
  divide: isDark ? "divide-white/[0.07]" : "divide-zinc-200",
  strong: isDark ? "text-zinc-50" : "text-zinc-900",
  body: isDark ? "text-zinc-300" : "text-zinc-700",
  muted: isDark ? "text-zinc-500" : "text-zinc-500",
  iconBox: isDark
    ? "border border-white/[0.08] text-zinc-300"
    : "border border-zinc-200 bg-zinc-50 text-zinc-600",
  ring: isDark ? "ring-[#101012]" : "ring-white",
});

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60 focus-visible:ring-offset-0";

const primaryButton = cx(
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5",
  "bg-blue-700 text-[13px] font-medium text-white",
  "transition-colors hover:bg-blue-600 active:bg-blue-800",
  FOCUS
);

const secondaryButton = (isDark: boolean) =>
  cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5",
    "text-[13px] font-medium transition-colors",
    isDark
      ? "border-white/10 text-zinc-200 hover:bg-white/[0.05]"
      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
    FOCUS
  );

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
    getStatus: () => getTikTokStatus(),
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

const NETWORK_LABELS: Record<SocialNetworkKey, string> = {
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
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
   OVERVIEW (valeurs de démonstration : à brancher sur l'API)
============================================================ */

// TODO: remplacer par les vraies métriques des comptes connectés.
const OVERVIEW_STATS = [
  { key: "followers", label: "Followers", value: "27K", change: "-2%" },
  { key: "likes", label: "Likes", value: "12.4K", change: "+16%" },
  { key: "comments", label: "Comments", value: "342", change: "+5%" },
] as const;

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
  /^https?:\/\//.test(url)
    ? { target: "_blank", rel: "noreferrer" }
    : {};

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
   PRIMITIVES
============================================================ */

function Card({
  isDark,
  className,
  children,
}: {
  isDark: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx("min-w-0 rounded-lg border", ui(isDark).card, className)}
    >
      {children}
    </section>
  );
}

/* En-tête de carte : titre + action, séparé du contenu par un filet */
function CardHeader({
  isDark,
  title,
  description,
  action,
  bordered = true,
}: {
  isDark: boolean;
  title: string;
  description?: string;
  action?: ReactNode;
  bordered?: boolean;
}) {
  const t = ui(isDark);

  return (
    <div
      className={cx(
        "flex min-h-[56px] items-center justify-between gap-4 px-5 py-3",
        bordered && cx("border-b", t.line)
      )}
    >
      <div className="min-w-0">
        <h2
          className={cx(
            "text-[14px] font-semibold tracking-[-0.005em]",
            t.strong
          )}
        >
          {title}
        </h2>

        {description && (
          <p className={cx("mt-0.5 text-[12px]", t.muted)}>{description}</p>
        )}
      </div>

      {action}
    </div>
  );
}

function TextLink({
  isDark,
  onClick,
  children,
}: {
  isDark: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cx(
        "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5",
        "text-[12px] font-medium transition-colors",
        "disabled:cursor-default disabled:opacity-40",
        isDark
          ? "text-blue-400 enabled:hover:text-blue-300"
          : "text-blue-700 enabled:hover:text-blue-900",
        FOCUS
      )}
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  );
}

/* ============================================================
   AVATARS
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
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className={cx(
        "flex h-10 w-10 items-center justify-center rounded-full",
        "text-[13px] font-semibold",
        isDark ? "bg-white/10 text-zinc-100" : "bg-zinc-200 text-zinc-700"
      )}
    >
      {initials}
    </div>
  );
}

/* Avatar d'un compte connecté. Quand l'image échoue (URL signée
   expirée), on affiche la lettre et on demande UNE fois par URL un
   rafraîchissement du profil au serveur. */
function AccountAvatar({
  channel,
  isDark,
  onBroken,
}: {
  channel: ConnectedChannel;
  isDark: boolean;
  onBroken?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const retriedFor = useRef<string | null>(null);

  useEffect(() => {
    setFailed(false);
  }, [channel.avatarUrl]);

  const t = ui(isDark);

  const label = channel.handle || channel.name || "Channel";
  const initial = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  const networkId = getNetworkId(channel);
  const NetworkIcon = networkId ? NETWORK_ICONS[networkId] : null;

  return (
    <div className="relative h-9 w-9 shrink-0">
      {channel.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => {
            setFailed(true);

            const url = channel.avatarUrl ?? null;

            if (url && retriedFor.current !== url) {
              retriedFor.current = url;
              onBroken?.();
            }
          }}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className={cx(
            "flex h-full w-full items-center justify-center rounded-full",
            "text-[13px] font-semibold",
            isDark ? "bg-white/10 text-zinc-100" : "bg-zinc-200 text-zinc-700"
          )}
        >
          {initial}
        </div>
      )}

      {NetworkIcon && (
        <span
          className={cx(
            "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center",
            "justify-center rounded-full bg-white text-black ring-2",
            t.ring
          )}
        >
          <NetworkIcon className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
}

/* ============================================================
   KPI
   Une seule carte, trois colonnes séparées par des filets.
============================================================ */

function StatsOverview({ isDark }: { isDark: boolean }) {
  const t = ui(isDark);

  return (
    <Card isDark={isDark}>
      <CardHeader
        isDark={isDark}
        title="Performance overview"
        description="Compared with the previous period · sample data"
      />

      <dl
        className={cx(
          "grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0",
          t.divide
        )}
      >
        {OVERVIEW_STATS.map((stat) => {
          const positive = stat.change.startsWith("+");
          const Trend = positive ? TrendingUp : TrendingDown;

          return (
            <div key={stat.key} className="px-5 py-4">
              <dt className={cx("text-[12px] font-medium", t.muted)}>
                {stat.label}
              </dt>

              <dd className="mt-2 flex items-baseline justify-between gap-3">
                <span
                  className={cx(
                    "text-[26px] font-semibold leading-none tracking-[-0.025em] tabular-nums",
                    t.strong
                  )}
                >
                  {stat.value}
                </span>

                <span
                  className={cx(
                    "inline-flex items-center gap-1 text-[12px] font-medium tabular-nums",
                    positive
                      ? isDark
                        ? "text-emerald-400"
                        : "text-emerald-700"
                      : isDark
                        ? "text-rose-400"
                        : "text-rose-700"
                  )}
                >
                  <Trend className="h-3.5 w-3.5" strokeWidth={2.2} />
                  {stat.change}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

/* ============================================================
   STREAK
   Semaine du lundi au dimanche. `completedDays` = index (0 = Mon)
   des jours validés.
============================================================ */

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Streak({
  isDark,
  completedDays = [0],
}: {
  isDark: boolean;
  completedDays?: number[];
}) {
  const t = ui(isDark);

  /* getDay(): 0 = dimanche → on ramène à 0 = lundi */
  const todayIndex = (new Date().getDay() + 6) % 7;

  return (
    <Card isDark={isDark}>
      <CardHeader
        isDark={isDark}
        title="Posting streak"
        description={`${completedDays.length} of 7 days this week`}
      />

      <div className="grid grid-cols-7 gap-1.5 px-5 py-4">
        {WEEK_LABELS.map((label, index) => {
          const done = completedDays.includes(index);
          const isToday = index === todayIndex;

          return (
            <div key={label} className="flex flex-col items-center gap-2">
              <span
                className={cx(
                  "text-[11px]",
                  isToday ? cx("font-semibold", t.strong) : t.muted
                )}
              >
                {label}
              </span>

              <div
                aria-label={`${label}${done ? " completed" : ""}`}
                className={cx(
                  "flex h-7 w-7 items-center justify-center rounded-md",
                  done
                    ? "bg-blue-700 text-white"
                    : isDark
                      ? "bg-white/[0.05]"
                      : "bg-zinc-100",
                  isToday && !done && "ring-1 ring-blue-600/70"
                )}
              >
                {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============================================================
   CHANNELS
============================================================ */

function ChannelsCard({
  isDark,
  channels,
  used,
  max,
  planName,
  onAdd,
  onManage,
}: {
  isDark: boolean;
  channels: ConnectedChannel[];
  used: number;
  max: number;
  planName: string;
  onAdd: () => void;
  onManage: () => void;
}) {
  const t = ui(isDark);

  const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const atLimit = max > 0 && used >= max;

  return (
    <Card isDark={isDark}>
      <CardHeader
        isDark={isDark}
        title="Channels"
        description="Accounts you can publish to"
        action={
          channels.length > 0 ? (
            <button
              type="button"
              onClick={onAdd}
              className={secondaryButton(isDark)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add channel
            </button>
          ) : undefined
        }
      />

      {channels.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <div
            className={cx(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              t.iconBox
            )}
          >
            <Link2 className="h-4 w-4" />
          </div>

          <p className={cx("mt-4 text-[14px] font-semibold", t.strong)}>
            No channel connected
          </p>

          <p className={cx("mt-1 max-w-[340px] text-[13px]", t.muted)}>
            Connect TikTok, YouTube or Pinterest to publish and schedule
            content from one place.
          </p>

          <button type="button" onClick={onAdd} className={cx(primaryButton, "mt-5")}>
            <Plus className="h-3.5 w-3.5" />
            Connect channel
          </button>
        </div>
      ) : (
        <>
          {/* En-têtes de colonnes (≥ sm) */}
          <div
            className={cx(
              "hidden items-center gap-3 border-b px-5 py-2 sm:flex",
              "text-[11px] font-medium uppercase tracking-[0.06em]",
              t.line,
              t.head,
              t.muted
            )}
          >
            <span className="flex-1">Account</span>
            <span className="w-28">Network</span>
            <span className="w-24 text-right">Status</span>
          </div>

          <ul>
            {channels.map((channel) => {
              const networkId = getNetworkId(channel);
              const name = channel.handle || channel.name || "Channel";
              const networkLabel = networkId
                ? NETWORK_LABELS[networkId]
                : "Social account";

              return (
                <li
                  key={channel.key}
                  className={cx("border-t first:border-t-0", t.line)}
                >
                  <button
                    type="button"
                    onClick={onManage}
                    className={cx(
                      "flex w-full items-center gap-3 px-5 py-2.5 text-left",
                      "transition-colors",
                      t.cardHover,
                      FOCUS
                    )}
                  >
                    <AccountAvatar channel={channel} isDark={isDark} />

                    <div className="min-w-0 flex-1">
                      <p
                        className={cx(
                          "truncate text-[13.5px] font-medium",
                          t.strong
                        )}
                      >
                        {name}
                      </p>

                      <p
                        className={cx(
                          "truncate text-[12px] sm:hidden",
                          t.muted
                        )}
                      >
                        {networkLabel}
                      </p>
                    </div>

                    <span
                      className={cx(
                        "hidden w-28 truncate text-[13px] sm:block",
                        t.body
                      )}
                    >
                      {networkLabel}
                    </span>

                    <span
                      className={cx(
                        "inline-flex w-24 shrink-0 items-center justify-end gap-1.5",
                        "text-[12px] font-medium",
                        isDark ? "text-emerald-400" : "text-emerald-700"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      Connected
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={cx("border-t px-5 py-3.5", t.line, t.head)}>
            <div className="flex items-center justify-between gap-3">
              <p className={cx("text-[12px] font-medium", t.body)}>
                {used} of {max} channels used
                <span className={cx("ml-1.5 font-normal", t.muted)}>
                  · {planName} plan
                </span>
              </p>

              <TextLink isDark={isDark} onClick={onManage}>
                Manage
              </TextLink>
            </div>

            <div
              className={cx(
                "mt-2 h-1 w-full overflow-hidden rounded-full",
                isDark ? "bg-white/10" : "bg-zinc-200"
              )}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={used}
              aria-label="Channels used"
            >
              <div
                className={cx(
                  "h-full rounded-full transition-[width] duration-500",
                  atLimit ? "bg-amber-500" : "bg-blue-700"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>

            {atLimit && (
              <p
                className={cx(
                  "mt-2 text-[12px]",
                  isDark ? "text-amber-400" : "text-amber-700"
                )}
              >
                You reached the channel limit of your plan.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/* ============================================================
   ACTIVITY PANEL (Comments / Up Next)
============================================================ */

function ActivityPanel({
  isDark,
  title,
  meta,
  onViewAll,
  icon,
  emptyTitle,
  emptyText,
  action,
}: {
  isDark: boolean;
  title: string;
  meta: string;
  onViewAll?: () => void;
  icon: ReactNode;
  emptyTitle: string;
  emptyText: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  const t = ui(isDark);

  return (
    <Card isDark={isDark} className="flex flex-col">
      <CardHeader
        isDark={isDark}
        title={title}
        description={meta}
        action={
          <TextLink isDark={isDark} onClick={onViewAll}>
            View all
          </TextLink>
        }
      />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <div
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            t.iconBox
          )}
        >
          {icon}
        </div>

        <p className={cx("mt-3 text-[13.5px] font-medium", t.strong)}>
          {emptyTitle}
        </p>

        <p className={cx("mt-1 max-w-[260px] text-[12.5px]", t.muted)}>
          {emptyText}
        </p>

        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cx(secondaryButton(isDark), "mt-4")}
          >
            <Plus className="h-3.5 w-3.5" />
            {action.label}
          </button>
        )}
      </div>
    </Card>
  );
}

/* ============================================================
   QUICK ACTIONS
============================================================ */

type QuickAction = {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
};

function QuickActions({
  isDark,
  actions,
}: {
  isDark: boolean;
  actions: QuickAction[];
}) {
  const t = ui(isDark);

  return (
    <Card isDark={isDark} className="overflow-hidden">
      <CardHeader isDark={isDark} title="Quick actions" />

      <ul>
        {actions.map((action) => (
          <li key={action.key} className={cx("border-t first:border-t-0", t.line)}>
            <button
              type="button"
              onClick={action.onClick}
              className={cx(
                "group flex w-full items-center gap-3 px-5 py-3 text-left",
                "transition-colors",
                t.cardHover,
                FOCUS
              )}
            >
              <span
                className={cx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  t.iconBox
                )}
              >
                {action.icon}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cx("block text-[13.5px] font-medium", t.strong)}
                >
                  {action.label}
                </span>

                <span className={cx("block truncate text-[12px]", t.muted)}>
                  {action.hint}
                </span>
              </span>

              <ArrowRight
                className={cx(
                  "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                  t.muted
                )}
              />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ============================================================
   BLOG
============================================================ */

function BlogImage({
  src,
  isDark,
}: {
  src?: string;
  isDark: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={cx(
          "aspect-[16/9] w-full",
          isDark ? "bg-white/[0.05]" : "bg-zinc-100"
        )}
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
      className="aspect-[16/9] w-full object-cover"
    />
  );
}

function BlogSection({ isDark }: { isDark: boolean }) {
  const t = ui(isDark);

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2
            className={cx(
              "text-[14px] font-semibold tracking-[-0.005em]",
              t.strong
            )}
          >
            Resources
          </h2>

          <p className={cx("mt-0.5 text-[12px]", t.muted)}>
            Guides and best practices from the Stone blog
          </p>
        </div>

        <a
          href={BLOG_URL}
          {...linkProps(BLOG_URL)}
          className={cx(
            "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5",
            "text-[12px] font-medium transition-colors",
            isDark
              ? "text-blue-400 hover:text-blue-300"
              : "text-blue-700 hover:text-blue-900",
            FOCUS
          )}
        >
          All articles
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BLOG_POSTS.map((post) => (
          <a
            key={post.title}
            href={post.url}
            {...linkProps(post.url)}
            className={cx(
              "group flex min-w-0 flex-col overflow-hidden rounded-lg border transition-colors",
              t.card,
              t.cardHover,
              FOCUS
            )}
          >
            <BlogImage src={post.image} isDark={isDark} />

            <div className="flex flex-1 flex-col p-4">
              <p
                className={cx(
                  "text-[11px] font-medium uppercase tracking-[0.06em]",
                  t.muted
                )}
              >
                {post.label} · {post.date}
              </p>

              <h3
                className={cx(
                  "mt-2 text-[14px] font-semibold leading-snug",
                  "tracking-[-0.005em]",
                  t.strong
                )}
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {post.title}
              </h3>

              <span
                className={cx(
                  "mt-3 inline-flex items-center gap-1 text-[12px] font-medium",
                  isDark ? "text-blue-400" : "text-blue-700"
                )}
              >
                Read article
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
              </span>
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
  const t = ui(isDark);

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
      CHANNELS.filter((channel) => connections[channel.key].connected)
        .length,
    [connections]
  );

  const limitReached = connectedCount >= PLAN.maxChannels;

  /* Statut des comptes : cache affiché tout de suite, rechargement
     silencieux dès que l'avatar a plus d'1 h (les URLs d'avatar des
     réseaux expirent en quelques heures). */
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

        if (!isAvatarStale(cached)) return;
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

  /* Autres réseaux : PLACEHOLDER uniquement (pas de vrai OAuth) */
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
     CLOCK (salutation + date)
  ---------------------------------------------------------- */

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);

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

  const dateLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  /* ----------------------------------------------------------
     CREATE POST
  ---------------------------------------------------------- */

  const handleCreatePost = async (payload: NewPostPayload) => {
    console.log("Nouveau post à envoyer :", payload);
  };

  const openNewPost = () => {
    setIsFolderOpen(false);
    setIsNewPostOpen(true);
  };

  /* ----------------------------------------------------------
     COMMUNITY
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
        openNewPost();
        break;

      case "files":
        setIsFolderOpen((open) => !open);
        break;

      default:
        break;
    }
  };

  const quickActions: QuickAction[] = [
    {
      key: "post",
      label: "Create a post",
      hint: "Write and publish to your channels",
      icon: <Send className="h-4 w-4" />,
      onClick: openNewPost,
    },
    {
      key: "calendar",
      label: "Open the calendar",
      hint: "Plan and schedule your content",
      icon: <CalendarDays className="h-4 w-4" />,
      onClick: () => navigate("calendar"),
    },
    {
      key: "comments",
      label: "Reply to comments",
      hint: "Stay close to your community",
      icon: <MessageCircle className="h-4 w-4" />,
      onClick: handleViewAllComments,
    },
    {
      key: "channels",
      label: "Manage channels",
      hint: "Connect or disconnect accounts",
      icon: <Link2 className="h-4 w-4" />,
      onClick: () => navigate("channels"),
    },
  ];

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <main
      className={cx(
        "relative h-screen w-full overflow-hidden",
        "transition-colors duration-300",
        t.page
      )}
    >
      <DashboardSidebar theme={theme} />

      <div
        className={cx(
          "h-full overflow-y-auto overflow-x-hidden",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none"
        )}
        style={{ paddingLeft: sidebarOffset }}
      >
        <div
          className={cx(
            "mx-auto flex w-full max-w-[1200px] flex-col gap-6",
            "px-[clamp(16px,3vw,40px)]",
            "pb-[120px] pt-[clamp(20px,3vw,32px)]"
          )}
        >
          {/* HEADER */}

          <header
            className={cx(
              "flex flex-wrap items-center justify-between gap-4 border-b pb-5",
              t.line
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <GreetingAvatar
                avatarUrl={user?.avatar_url}
                initials={initials}
                isDark={isDark}
              />

              <div className="min-w-0">
                <h1
                  className={cx(
                    "truncate text-[20px] font-semibold leading-tight",
                    "tracking-[-0.02em]",
                    t.strong
                  )}
                >
                  {fullName || "Welcome"}
                </h1>

                <p className={cx("mt-0.5 text-[12.5px]", t.muted)}>
                  {greeting} · <span className="capitalize">{dateLabel}</span>
                </p>
              </div>
            </div>

            <button type="button" onClick={openNewPost} className={primaryButton}>
              <Plus className="h-4 w-4" />
              Create post
            </button>
          </header>

          {/* KPI */}

          <StatsOverview isDark={isDark} />

          {/* MAIN GRID */}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-6">
              <ChannelsCard
                isDark={isDark}
                channels={connectedChannels}
                used={connectedCount}
                max={PLAN.maxChannels}
                planName={PLAN.name}
                onAdd={openConnectModal}
                onManage={() => navigate("channels")}
              />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ActivityPanel
                  isDark={isDark}
                  title="Up next"
                  meta="0 posts scheduled"
                  onViewAll={() => navigate("calendar")}
                  icon={<CalendarDays className="h-4 w-4" />}
                  emptyTitle="Nothing scheduled"
                  emptyText="Schedule a post and it will show up here."
                  action={{
                    label: "Create post",
                    onClick: openNewPost,
                  }}
                />

                <ActivityPanel
                  isDark={isDark}
                  title="Comments"
                  meta="0 unanswered"
                  onViewAll={handleViewAllComments}
                  icon={<MessageCircle className="h-4 w-4" />}
                  emptyTitle="No comments yet"
                  emptyText="The latest comments on your posts will appear here."
                />
              </div>
            </div>

            <aside className="flex min-w-0 flex-col gap-6">
              <Streak isDark={isDark} completedDays={[0]} />

              <QuickActions isDark={isDark} actions={quickActions} />
            </aside>
          </div>

          {/* BLOG */}

          <div className="mt-2">
            <BlogSection isDark={isDark} />
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