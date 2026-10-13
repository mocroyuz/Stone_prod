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
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Flame,
  Heart,
  Link2,
  MessageCircle,
  Plus,
  Sparkles,
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
   DESIGN — dashboard premium : coins très arrondis, cartes
   douces, dégradés subtils, icônes en pastilles, détails
   partout (badges, hairlines, mini graphes, métadonnées).
============================================================ */

const surface = {
  page: (isDark: boolean) => (isDark ? "bg-[#0b0b0d]" : "bg-[#f7f6f3]"),

  card: (isDark: boolean) =>
    isDark
      ? "border-white/[0.07] bg-[#141416]"
      : "border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]",

  inset: (isDark: boolean) =>
    isDark ? "bg-white/[0.04]" : "bg-black/[0.03]",

  hairline: (isDark: boolean) =>
    isDark ? "bg-white/[0.07]" : "bg-black/[0.06]",

  title: (isDark: boolean) => (isDark ? "text-[#f3f3f0]" : "text-[#181816]"),
  body: (isDark: boolean) => (isDark ? "text-[#a3a3a0]" : "text-[#5c5c58]"),
  faint: (isDark: boolean) => (isDark ? "text-[#6f6f6c]" : "text-[#9a9a94]"),

  /* pastille d'icône : douce, teintée */
  chip: (isDark: boolean) =>
    isDark
      ? "bg-white/[0.07] text-[#e7e7e3] ring-1 ring-white/[0.06]"
      : "bg-[#f2f1ec] text-[#3f3f3b] ring-1 ring-black/[0.04]",

  avatarRing: (isDark: boolean) => (isDark ? "ring-[#141416]" : "ring-white"),

  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
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
   BLOG
============================================================ */

type BlogPost = {
  title: string;
  label: string;
  date: string;
  readTime: string;
  image?: string;
  url: string;
};

const BLOG_URL = "#";

const BLOG_POSTS: BlogPost[] = [
  {
    title: "The Best Time to Post on TikTok in 2026",
    label: "Guide",
    date: "Jul 20, 2026",
    readTime: "8 min",
    image: "/images/blog/best-time-tiktok.jpg",
    url: BLOG_URL,
  },
  {
    title: "The 11 Best AI Video Editors: I Tested Them All",
    label: "Comparison",
    date: "Jul 22, 2026",
    readTime: "12 min",
    image: "/images/blog/ai-video-editors.jpg",
    url: BLOG_URL,
  },
  {
    title: "How to Create a Social Media Content Calendar",
    label: "Tutorial",
    date: "Jul 24, 2026",
    readTime: "6 min",
    image: "/images/blog/content-calendar.jpg",
    url: BLOG_URL,
  },
  {
    title: "17 Best AI Tools for Social Media Content",
    label: "Roundup",
    date: "Aug 3, 2026",
    readTime: "10 min",
    image: "/images/blog/ai-tools.jpg",
    url: BLOG_URL,
  },
];

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
   SECTION HEADER — titre, sous-titre, action
============================================================ */

function SectionHeader({
  isDark,
  eyebrow,
  title,
  subtitle,
  action,
}: {
  isDark: boolean;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p
            className={[
              "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
              isDark ? "text-emerald-400/90" : "text-emerald-600",
            ].join(" ")}
          >
            <Sparkles className="h-3 w-3" />
            {eyebrow}
          </p>
        )}

        <h2
          className={[
            "text-[15px] font-semibold tracking-[-0.01em]",
            surface.title(isDark),
          ].join(" ")}
        >
          {title}
        </h2>

        {subtitle && (
          <p className={["mt-0.5 text-[11.5px]", surface.faint(isDark)].join(" ")}>
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={[
            "flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5",
            "text-[11px] font-semibold transition-all",
            "active:scale-[0.97]",
            surface.focusRing,
            isDark
              ? "bg-white/[0.06] text-[#e7e7e3] hover:bg-white/[0.11]"
              : "bg-black/[0.04] text-[#3f3f3b] hover:bg-black/[0.08]",
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
        className="h-12 w-12 rounded-2xl object-cover ring-2 ring-emerald-500/20"
      />
    );
  }

  return (
    <div
      className={[
        "flex h-12 w-12 items-center justify-center rounded-2xl",
        "bg-gradient-to-br from-emerald-500 to-emerald-600",
        "text-[14px] font-semibold text-white",
      ].join(" ")}
    >
      {initials}
    </div>
  );
}

/* ============================================================
   CLOCK — carte avec icône horloge
============================================================ */

function ClockDisplay({ isDark, now }: { isDark: boolean; now: Date }) {
  const time = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const date = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl border px-4 py-2.5",
        surface.card(isDark),
      ].join(" ")}
    >
      <span
        className={[
          "flex h-8 w-8 items-center justify-center rounded-xl",
          surface.chip(isDark),
        ].join(" ")}
      >
        <Clock className="h-4 w-4" />
      </span>

      <div className="text-right">
        <p
          className={[
            "text-[15px] font-semibold tabular-nums leading-none",
            surface.title(isDark),
          ].join(" ")}
        >
          {time}
        </p>

        <p
          className={[
            "mt-1 text-[10.5px] font-medium capitalize",
            surface.faint(isDark),
          ].join(" ")}
        >
          {date}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   STAT CARD — pastille icône, variation, mini barre de tendance
============================================================ */

function StatCard({
  isDark,
  icon,
  label,
  value,
  change,
  trend,
}: {
  isDark: boolean;
  icon: ReactNode;
  label: string;
  value: string;
  change: string;
  trend: number[];
}) {
  const positive = change.startsWith("+");
  const max = Math.max(...trend, 1);

  return (
    <div
      className={[
        "group relative flex flex-col gap-3 rounded-2xl border p-4",
        "transition-all duration-200 hover:-translate-y-0.5",
        surface.card(isDark),
        isDark ? "hover:border-white/[0.13]" : "hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <span
          className={[
            "flex h-9 w-9 items-center justify-center rounded-xl",
            surface.chip(isDark),
          ].join(" ")}
        >
          {icon}
        </span>

        <span
          className={[
            "flex items-center gap-1 rounded-full px-2 py-0.5",
            "text-[10px] font-semibold",
            positive
              ? isDark
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-emerald-500/10 text-emerald-600"
              : isDark
                ? "bg-rose-500/15 text-rose-400"
                : "bg-rose-500/10 text-rose-600",
          ].join(" ")}
        >
          {positive ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5" />
          )}
          {change}
        </span>
      </div>

      <div>
        <p className={["text-[11px] font-medium", surface.faint(isDark)].join(" ")}>
          {label}
        </p>

        <p
          className={[
            "mt-0.5 text-[24px] font-bold tracking-[-0.03em]",
            surface.title(isDark),
          ].join(" ")}
        >
          {value}
        </p>
      </div>

      {/* mini graphe en barres */}
      <div className="flex h-8 items-end gap-1">
        {trend.map((point, index) => (
          <span
            key={index}
            className={[
              "flex-1 rounded-full transition-opacity",
              index === trend.length - 1
                ? positive
                  ? "bg-emerald-500/80"
                  : "bg-rose-500/80"
                : surface.hairline(isDark),
            ].join(" ")}
            style={{ height: `${Math.max(15, (point / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   STREAK — carte avec flamme, cases rondes, légende
============================================================ */

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Streak({
  isDark,
  completedDays = [0],
}: {
  isDark: boolean;
  completedDays?: number[];
}) {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const streakCount = completedDays.length;

  return (
    <div
      className={[
        "relative flex flex-col overflow-hidden rounded-2xl border p-4",
        surface.card(isDark),
      ].join(" ")}
    >
      {/* halo dégradé décoratif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl"
      />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={[
              "flex h-9 w-9 items-center justify-center rounded-xl",
              surface.chip(isDark),
            ].join(" ")}
          >
            <Flame className="h-4 w-4 text-orange-500" />
          </span>

          <div>
            <p
              className={[
                "text-[13px] font-semibold",
                surface.title(isDark),
              ].join(" ")}
            >
              {streakCount} day streak
            </p>

            <p className={["text-[10.5px]", surface.faint(isDark)].join(" ")}>
              Keep it going
            </p>
          </div>
        </div>

        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            isDark
              ? "bg-orange-500/15 text-orange-400"
              : "bg-orange-500/10 text-orange-600",
          ].join(" ")}
        >
          This week
        </span>
      </div>

      <div className={["my-3.5 h-px w-full", surface.hairline(isDark)].join(" ")} />

      <div className="relative grid grid-cols-7 gap-1.5">
        {WEEK_LABELS.map((label, index) => {
          const done = completedDays.includes(index);
          const isToday = index === todayIndex;

          return (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "relative flex h-9 w-9 items-center justify-center rounded-full",
                  "transition-all duration-200",
                  done
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
                    : [
                        "border",
                        isDark
                          ? "border-white/[0.08] bg-white/[0.04]"
                          : "border-black/[0.06] bg-black/[0.03]",
                      ],
                  isToday && !done
                    ? isDark
                      ? "ring-2 ring-emerald-500/40"
                      : "ring-2 ring-emerald-500/30"
                    : "",
                ].join(" ")}
                aria-label={`${label}${done ? " completed" : ""}`}
              >
                {done && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
                {isToday && !done && (
                  <span
                    className={[
                      "h-1.5 w-1.5 rounded-full",
                      isDark ? "bg-[#6f6f6c]" : "bg-[#9a9a94]",
                    ].join(" ")}
                  />
                )}
              </div>

              <span
                className={[
                  "text-[9.5px]",
                  isToday ? "font-semibold" : "font-normal",
                  isToday
                    ? surface.title(isDark)
                    : surface.faint(isDark),
                ].join(" ")}
              >
                {label.slice(0, 1)}
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
            "h-full w-full rounded-xl object-cover ring-2",
            "transition-transform duration-200 hover:z-10 hover:scale-110",
            surface.avatarRing(isDark),
          ].join(" ")}
        />
      ) : (
        <div
          className={[
            "flex h-full w-full items-center justify-center rounded-xl",
            "text-[11px] font-semibold ring-2",
            isDark ? "bg-[#29292c] text-white" : "bg-neutral-900 text-white",
            surface.avatarRing(isDark),
          ].join(" ")}
        >
          {initial}
        </div>
      )}

      {NetworkIcon && (
        <span
          className={[
            "absolute -bottom-1 -right-1 flex h-4 w-4 items-center",
            "justify-center rounded-full ring-2",
            isDark ? "bg-[#0b0b0d] text-white" : "bg-white text-black",
            surface.avatarRing(isDark),
          ].join(" ")}
        >
          <NetworkIcon className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
}

/* ============================================================
   CHANNELS — grande carte : avatars empilés + stats + actions
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
  const remaining = Math.max(0, PLAN.maxChannels - channels.length);

  return (
    <div
      className={[
        "flex min-h-[92px] items-center justify-between gap-5 rounded-2xl border px-5 py-4",
        surface.card(isDark),
      ].join(" ")}
    >
      {channels.length === 0 ? (
        <div className="flex items-center gap-4">
          <span
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              surface.chip(isDark),
            ].join(" ")}
          >
            <Link2 className="h-5 w-5" />
          </span>

          <div>
            <p
              className={[
                "text-[13px] font-semibold",
                surface.title(isDark),
              ].join(" ")}
            >
              Connect your first channel
            </p>

            <p className={["mt-0.5 text-[11.5px]", surface.body(isDark)].join(" ")}>
              Link Instagram, TikTok, YouTube… to start scheduling.
            </p>
          </div>

          <button
            type="button"
            onClick={onAdd}
            className={[
              "ml-2 flex items-center gap-1.5 rounded-xl px-3.5 py-2",
              "text-[12px] font-semibold transition-all active:scale-[0.97]",
              surface.focusRing,
              "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
              "shadow-[0_4px_14px_rgba(16,185,129,0.35)] hover:brightness-110",
            ].join(" ")}
          >
            <Plus className="h-3.5 w-3.5" />
            Connect
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-5">
          <div className="group flex shrink-0 items-center pl-1">
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
                "-ml-2 flex h-9 w-9 shrink-0 items-center justify-center",
                "relative z-10 rounded-xl border transition-all duration-200",
                "ring-2 active:scale-[0.95]",
                surface.avatarRing(isDark),
                isDark
                  ? "border-white/[0.14] bg-[#1b1b1e] text-white hover:bg-[#242428]"
                  : "border-black/[0.10] bg-white text-neutral-700 hover:bg-neutral-50",
              ].join(" ")}
            >
              <Plus
                className="h-[15px] w-[15px] transition-transform duration-200 group-hover:rotate-90"
                strokeWidth={1.8}
              />
            </button>
          </div>

          <div className={["hidden h-10 w-px sm:block", surface.hairline(isDark)].join(" ")} />

          <div className="min-w-0">
            <p
              className={[
                "text-[13px] font-semibold",
                surface.title(isDark),
              ].join(" ")}
            >
              {channels.length}{" "}
              {channels.length === 1 ? "channel" : "channels"} connected
            </p>

            <p className={["mt-0.5 text-[11px]", surface.faint(isDark)].join(" ")}>
              {remaining > 0
                ? `${remaining} slot${remaining === 1 ? "" : "s"} left on your plan`
                : "Plan limit reached — upgrade for more"}
            </p>
          </div>
        </div>
      )}

      {channels.length > 0 && (
        <button
          type="button"
          onClick={() => navigate("channels")}
          className={[
            "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2",
            "text-[12px] font-semibold transition-all active:scale-[0.97]",
            surface.focusRing,
            isDark
              ? "bg-white/[0.06] text-[#e7e7e3] hover:bg-white/[0.11]"
              : "bg-black/[0.04] text-[#3f3f3b] hover:bg-black/[0.08]",
          ].join(" ")}
        >
          Manage
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ============================================================
   PANEL — carte d'état vide détaillée avec CTA
============================================================ */

function Panel({
  isDark,
  icon,
  title,
  meta,
  line1,
  line2,
  action,
}: {
  isDark: boolean;
  icon: ReactNode;
  title: string;
  meta: string;
  line1: string;
  line2: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className={[
        "relative flex min-h-[210px] flex-col items-center justify-center",
        "gap-1 overflow-hidden rounded-2xl border px-5 py-8 text-center",
        surface.card(isDark),
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-1/2 h-28 w-44 -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-2xl"
      />

      <div
        className={[
          "relative mb-3 flex h-12 w-12 items-center justify-center rounded-2xl",
          surface.chip(isDark),
        ].join(" ")}
      >
        {icon}
      </div>

      <p className={["relative text-[13px] font-semibold", surface.title(isDark)].join(" ")}>
        {line1}
      </p>

      <p className={["relative text-[12px]", surface.body(isDark)].join(" ")}>
        {line2}
      </p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={[
            "relative mt-4 flex items-center gap-1.5 rounded-xl px-4 py-2",
            "text-[12px] font-semibold transition-all active:scale-[0.97]",
            surface.focusRing,
            "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
            "shadow-[0_4px_14px_rgba(16,185,129,0.35)] hover:brightness-110",
          ].join(" ")}
        >
          <Plus className="h-3.5 w-3.5" />
          {action.label}
        </button>
      )}

      <div
        className={[
          "absolute right-4 top-4 rounded-full px-2 py-0.5",
          "text-[10px] font-semibold",
          isDark
            ? "bg-white/[0.06] text-[#8f8f8c]"
            : "bg-black/[0.04] text-[#8a8a84]",
        ].join(" ")}
      >
        {title} · {meta}
      </div>
    </div>
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
          "flex h-[150px] w-full items-center justify-center rounded-xl",
          surface.inset(isDark),
          surface.faint(isDark),
        ].join(" ")}
      >
        <Sparkles className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className="h-[150px] w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.03]"
    />
  );
}

/* ============================================================
   BLOG SECTION
============================================================ */

function BlogSection({ isDark }: { isDark: boolean }) {
  return (
    <section>
      <SectionHeader
        isDark={isDark}
        eyebrow="Resources"
        title="From the Blog"
        subtitle="Tips and guides to grow your audience"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BLOG_POSTS.map((post) => (
          <a
            key={post.title}
            href={post.url}
            {...linkProps(post.url)}
            className={[
              "group flex flex-col rounded-2xl border p-3 transition-all duration-200",
              "hover:-translate-y-1",
              surface.card(isDark),
              isDark
                ? "hover:border-white/[0.13] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                : "hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
            ].join(" ")}
          >
            <div className="overflow-hidden rounded-xl">
              <BlogImage src={post.image} isDark={isDark} />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 px-1">
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  isDark
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-emerald-500/10 text-emerald-600",
                ].join(" ")}
              >
                {post.label}
              </span>

              <span
                className={["text-[10px] font-medium", surface.faint(isDark)].join(" ")}
              >
                {post.readTime} read
              </span>
            </div>

            <h3
              className={[
                "mt-2 px-1 text-[13.5px] font-semibold leading-snug",
                "tracking-[-0.01em]",
                surface.title(isDark),
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

            <div
              className={[
                "mt-2.5 flex items-center justify-between px-1 pb-1",
              ].join(" ")}
            >
              <span className={["text-[10px]", surface.faint(isDark)].join(" ")}>
                {post.date}
              </span>

              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full",
                  "transition-all duration-200 group-hover:translate-x-0.5",
                  surface.inset(isDark),
                  surface.body(isDark),
                ].join(" ")}
              >
                <ArrowRight className="h-3 w-3" />
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
        surface.page(isDark),
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
          {/* HEADER — avatar dégradé, salutation, horloge en carte */}

          <header className="flex shrink-0 items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <GreetingAvatar
                avatarUrl={user?.avatar_url}
                initials={initials}
                isDark={isDark}
              />

              <div>
                <p className={["text-[11px] font-medium", surface.faint(isDark)].join(" ")}>
                  {greeting} 👋
                </p>

                <h1
                  className={[
                    "mt-0.5 text-[24px] font-bold tracking-[-0.03em]",
                    surface.title(isDark),
                  ].join(" ")}
                >
                  {fullName || "Welcome"}
                </h1>

                <p className={["mt-1 text-[11.5px]", surface.body(isDark)].join(" ")}>
                  Here's what's happening across your channels today.
                </p>
              </div>
            </div>

            <ClockDisplay isDark={isDark} now={now} />
          </header>

          {/* OVERVIEW — 3 cartes stats détaillées + streak */}

          <section className="mt-8 shrink-0">
            <SectionHeader
              isDark={isDark}
              eyebrow="Overview"
              title="Your activity at a glance"
              subtitle="Compared to the last 7 days"
              action={{
                label: "Full insights",
                onClick: () => navigate("insights"),
              }}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_340px]">
              <StatCard
                isDark={isDark}
                label="Followers"
                value="27K"
                change="-2%"
                trend={[8, 7, 9, 6, 7, 5, 6]}
                icon={<Users className="h-4 w-4" />}
              />

              <StatCard
                isDark={isDark}
                label="Likes"
                value="12.4K"
                change="+16%"
                trend={[4, 6, 5, 8, 7, 9, 12]}
                icon={<Heart className="h-4 w-4" />}
              />

              <StatCard
                isDark={isDark}
                label="Comments"
                value="342"
                change="+5%"
                trend={[5, 4, 6, 5, 7, 6, 8]}
                icon={<MessageCircle className="h-4 w-4" />}
              />

              <Streak isDark={isDark} completedDays={[0]} />
            </div>
          </section>

          {/* CHANNELS */}

          <section className="mt-9 shrink-0">
            <SectionHeader
              isDark={isDark}
              eyebrow="Workspace"
              title="Channels"
              subtitle="Your connected accounts"
              action={{ label: "Open channels", onClick: () => navigate("channels") }}
            />

            <Channels
              isDark={isDark}
              channels={connectedChannels}
              onAdd={openConnectModal}
            />
          </section>

          {/* COMMENTS + UP NEXT */}

          <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-2">
            <section>
              <SectionHeader
                isDark={isDark}
                title="Comments"
                subtitle="0 unanswered"
                action={{ label: "View all", onClick: handleViewAllComments }}
              />

              <Panel
                isDark={isDark}
                icon={<MessageCircle className="h-5 w-5" />}
                title="Comments"
                meta="0 unanswered"
                line1="No comments yet."
                line2="You'll see the latest comments here."
              />
            </section>

            <section>
              <SectionHeader
                isDark={isDark}
                title="Up Next"
                subtitle="0 posts scheduled"
                action={{ label: "View calendar", onClick: () => navigate("calendar") }}
              />

              <Panel
                isDark={isDark}
                icon={<CalendarDays className="h-5 w-5" />}
                title="Up Next"
                meta="0 scheduled"
                line1="No posts scheduled yet."
                line2="You'll see upcoming posts here."
                action={{
                  label: "Create Post",
                  onClick: () => setIsNewPostOpen(true),
                }}
              />
            </section>
          </div>

          {/* BLOG */}

          <div className="mt-10">
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