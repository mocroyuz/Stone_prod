import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
import { useYouTubeInsights } from "../services/youtube";
import { navigateToSettingsSection } from "../utils/settingsNavigation";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
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
LANGUAGE / I18N
============================================================ */
type Lang = "fr" | "en";
const LANGUAGE_STORAGE_KEY = "stone:language";

/** Lit la langue dans le localStorage. Anglais par défaut si absent. */
function detectLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* stockage indisponible */
  }
  return "en";
}

/** Hook réactif : se resynchronise sur storage / focus / hashchange. */
function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(() => detectLanguage());
  useEffect(() => {
    const refresh = () => setLang(detectLanguage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("hashchange", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", refresh);
    };
  }, []);
  return lang;
}

const intlLocale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");
const numLocale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-US");

/* ============================================================
MOBILE
============================================================ */
const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/* ============================================================
BOTTOM SHEET (mobile) — feuille glissable, comme dans Schedule
============================================================ */
function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
}

/**
 * Feuille glissable (mobile) / dialogue centré (desktop).
 * Glisser la poignée ou le titre vers le bas pour fermer.
 * `children` reçoit `close` : fermeture animée.
 */
function BottomSheet({
  isDark,
  isMobile,
  title,
  onClose,
  children,
}: {
  isDark: boolean;
  isMobile: boolean;
  title: string;
  onClose: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startT: number } | null>(null);

  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setDragging(false);
    window.setTimeout(onClose, 300);
  }, [closing, onClose]);

  useEscape(requestClose);

  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMobile || closing) return;
    drag.current = { startY: e.clientY, startT: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setDragY(Math.max(0, e.clientY - d.startY));
  };

  const onDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);

    const dy = Math.max(0, e.clientY - d.startY);
    const velocity = dy / Math.max(1, performance.now() - d.startT);
    const height = sheetRef.current?.offsetHeight ?? 500;

    if (dy > height * 0.25 || velocity > 0.5) requestClose();
    else setDragY(0);
  };

  const hidden = closing || !shown;
  const height = sheetRef.current?.offsetHeight ?? 600;
  const backdropOpacity = hidden ? 0 : 1 - Math.min(1, dragY / height);
  const ease = "cubic-bezier(0.32, 0.72, 0, 1)";

  // Portail : échappe aux overflow / z-index des cartes parentes.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        style={{
          opacity: backdropOpacity,
          transition: dragging ? "none" : `opacity 300ms ${ease}`,
        }}
        onClick={requestClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={
          isMobile
            ? {
                transform: hidden
                  ? "translateY(100%)"
                  : `translateY(${dragY}px)`,
                transition: dragging ? "none" : `transform 300ms ${ease}`,
                willChange: "transform",
              }
            : {
                opacity: hidden ? 0 : 1,
                transition: "opacity 200ms ease-out",
              }
        }
        className={[
          "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-y-auto overscroll-contain border p-4 shadow-2xl",
          "rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))]",
          "md:max-w-sm md:rounded-2xl md:pb-4",
          isDark
            ? "border-white/[0.08] bg-[#101012]"
            : "border-black/[0.06] bg-[#f6f4f0]",
        ].join(" ")}
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="-mx-4 -mt-4 mb-1 shrink-0 cursor-grab touch-none select-none px-4 pb-3 pt-3 active:cursor-grabbing md:mx-0 md:mt-0 md:cursor-default md:touch-auto md:px-0 md:pb-2 md:pt-0"
        >
          <div
            className={[
              "mx-auto mb-3 h-1.5 w-12 rounded-full md:hidden",
              isDark ? "bg-white/25" : "bg-black/15",
            ].join(" ")}
          />
          <h2
            className={[
              "truncate text-center text-[17px] font-semibold tracking-[-0.02em]",
              strongClassBase(isDark),
            ].join(" ")}
          >
            {title}
          </h2>
        </div>

        {children(requestClose)}
      </div>
    </div>,
    document.body
  );
}

// Utilisé par BottomSheet (défini avant `strongClass` plus bas dans le fichier).
const strongClassBase = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

/** Explication d'un indicateur (remplace l'info-bulle au survol sur mobile). */
function HintSheet({
  isDark,
  title,
  text,
  onClose,
}: {
  isDark: boolean;
  title: string;
  text: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet isDark={isDark} isMobile title={title} onClose={onClose}>
      {() => (
        <p
          className={[
            "px-1 pb-2 pt-1 text-center text-[14.5px] leading-relaxed",
            isDark ? "text-neutral-300" : "text-neutral-600",
          ].join(" ")}
        >
          {text}
        </p>
      )}
    </BottomSheet>
  );
}

/* ============================================================
TRANSLATIONS
============================================================ */
type GreetingKey = "morning" | "afternoon" | "evening" | "night";
type Copy = {
  greeting: Record<GreetingKey, string>;
  goals: {
    weekStreak: string;
    postingGoals: string;
    commentScore: string;
  };
  hints: {
    weekStreak: string;
    postingGoals: string;
    commentScore: string;
    followers: string;
    likes: string;
    comments: string;
  };
  subtitle: {
    streakHit: string;
    streakEmpty: string;
    goalReached: string;
    goalProgress: (done: number, target: number) => string;
    fromLastWeek: string;
  };
  overview: {
    title: string;
    subtitle: string;
    goToInsights: string;
    vsLastWeek: string;
    followers: string;
    likes: string;
    comments: string;
  };
  channels: {
    title: string;
    subtitle: string;
    connectFirst: string;
    connectFirstHint: string;
    connected: (n: number) => string;
    readyToPublish: string;
    connect: string;
    manage: string;
    connectAria: string;
    connectAnotherAria: string;
  };
  upNext: {
    title: string;
    meta: (n: number) => string;
    line1: string;
    line2: string;
    createPost: string;
    viewAll: string;
  };
  insights: {
    metricTabs: {
      posts: string;
      impact: string;
      growth: string;
      visibility: string;
    };
    labels: {
      channelViews: string;
      reactions: string;
      followers: string;
      posts: string;
    };
    units: {
      views: string;
      reactions: string;
      followers: string;
      posts: string;
    };
    lastDays: (n: number) => string;
    loading: string;
    noData: string;
    nothingConnected: string;
    publishHint: (channel: string, unit: string) => string;
    connectHint: string;
    connectChannel: string;
    viewAll: string;
    switchChannel: (name: string) => string;
    ariaChart: (unit: string, days: number) => string;
  };
  blog: {
    title: string;
    viewAll: string;
    label: string;
  };
};

const COPY: Record<Lang, Copy> = {
  en: {
    greeting: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
      night: "Good night",
    },
    goals: {
      weekStreak: "Week Streak",
      postingGoals: "Posting Goals",
      commentScore: "Comment Score",
    },
    hints: {
      weekStreak: "Consecutive weeks in which you reached your posting goal.",
      postingGoals: "Posts published this week compared to your weekly goal.",
      commentScore: "Your engagement score based on the comments you answer.",
      followers:
        "Total followers across all your connected channels, compared to the previous period.",
      likes:
        "Total likes received on your posts across all channels, compared to the previous period.",
      comments:
        "Total comments received on your posts across all channels, compared to the previous period.",
    },
    subtitle: {
      streakHit: "Streak hit, keep going!",
      streakEmpty: "Hit your goal to start a streak.",
      goalReached: "Goal reached, great work!",
      goalProgress: (done, target) => `${done} of ${target}, so close!`,
      fromLastWeek: "from last week",
    },
    overview: {
      title: "Overview",
      subtitle: "Example metrics · not connected to live channels",
      goToInsights: "Go to Insights",
      vsLastWeek: "vs last week",
      followers: "Followers",
      likes: "Likes",
      comments: "Comments",
    },
    channels: {
      title: "Channels",
      subtitle: "Your connected accounts",
      connectFirst: "Connect your first channel",
      connectFirstHint: "Start publishing to social networks.",
      connected: (n) => `${n} ${n === 1 ? "channel" : "channels"} connected`,
      readyToPublish: "Ready to publish",
      connect: "Connect",
      manage: "Manage",
      connectAria: "Connect a channel",
      connectAnotherAria: "Connect another channel",
    },
    upNext: {
      title: "Up Next",
      meta: (n) => `${n} posts scheduled`,
      line1: "No posts scheduled yet.",
      line2: "You'll see upcoming posts here.",
      createPost: "Create Post",
      viewAll: "View All",
    },
    insights: {
      metricTabs: {
        posts: "Posts",
        impact: "Impact",
        growth: "Growth",
        visibility: "Visibility",
      },
      labels: {
        channelViews: "Channel Views",
        reactions: "Reactions",
        followers: "Followers",
        posts: "Posts",
      },
      units: {
        views: "views",
        reactions: "reactions",
        followers: "followers",
        posts: "posts",
      },
      lastDays: (n) => `Last ${n} days`,
      loading: "Loading insights",
      noData: "No data yet",
      nothingConnected: "Nothing connected",
      publishHint: (channel, unit) =>
        `Publish a post on ${channel} and your ${unit} will appear here.`,
      connectHint: "Connect a channel to see your insights here.",
      connectChannel: "Connect a channel",
      viewAll: "View all",
      switchChannel: (name) => `Switch channel (${name})`,
      ariaChart: (unit, days) => `${unit} over the last ${days} days`,
    },
    blog: {
      title: "From the Blog",
      viewAll: "View All Articles",
      label: "Blog post",
    },
  },
  fr: {
    greeting: {
      morning: "Bonjour",
      afternoon: "Bonne après-midi",
      evening: "Bonsoir",
      night: "Bonne soirée",
    },
    goals: {
      weekStreak: "Série actuelle",
      postingGoals: "Objectifs de publication",
      commentScore: "Score de commentaires",
    },
    hints: {
      weekStreak:
        "Nombre de semaines consécutives où vous avez atteint votre objectif de publication.",
      postingGoals:
        "Publications de cette semaine comparées à votre objectif hebdomadaire.",
      commentScore:
        "Votre score d'engagement basé sur les commentaires auxquels vous répondez.",
      followers:
        "Total d'abonnés sur tous vos canaux connectés, comparé à la période précédente.",
      likes:
        "Total de mentions J'aime reçues sur vos publications, comparé à la période précédente.",
      comments:
        "Total de commentaires reçus sur vos publications, comparé à la période précédente.",
    },
    subtitle: {
      streakHit: "Série en cours, continuez !",
      streakEmpty: "Atteignez votre objectif pour lancer une série.",
      goalReached: "Objectif atteint, excellent travail !",
      goalProgress: (done, target) => `${done} sur ${target}, presque là !`,
      fromLastWeek: "depuis la semaine dernière",
    },
    overview: {
      title: "Aperçu",
      subtitle: "Métriques d'exemple · non connectées aux canaux actifs",
      goToInsights: "Voir les statistiques",
      vsLastWeek: "vs semaine dernière",
      followers: "Abonnés",
      likes: "J'aime",
      comments: "Commentaires",
    },
    channels: {
      title: "Canaux",
      subtitle: "Vos comptes connectés",
      connectFirst: "Connectez votre premier canal",
      connectFirstHint: "Commencez à publier sur les réseaux sociaux.",
      connected: (n) =>
        `${n} ${n === 1 ? "canal connecté" : "canaux connectés"}`,
      readyToPublish: "Prêt à publier",
      connect: "Connecter",
      manage: "Gérer",
      connectAria: "Connecter un canal",
      connectAnotherAria: "Connecter un autre canal",
    },
    upNext: {
      title: "À venir",
      meta: (n) =>
        `${n} publication${n === 1 ? "" : "s"} planifiée${n === 1 ? "" : "s"}`,
      line1: "Aucune publication planifiée pour l'instant.",
      line2: "Vos prochaines publications apparaîtront ici.",
      createPost: "Créer une publication",
      viewAll: "Tout voir",
    },
    insights: {
      metricTabs: {
        posts: "Publications",
        impact: "Impact",
        growth: "Croissance",
        visibility: "Visibilité",
      },
      labels: {
        channelViews: "Vues du canal",
        reactions: "Réactions",
        followers: "Abonnés",
        posts: "Publications",
      },
      units: {
        views: "vues",
        reactions: "réactions",
        followers: "abonnés",
        posts: "publications",
      },
      lastDays: (n) => `${n} derniers jours`,
      loading: "Chargement des statistiques",
      noData: "Aucune donnée pour l'instant",
      nothingConnected: "Aucun canal connecté",
      publishHint: (channel, unit) =>
        `Publiez sur ${channel} et vos ${unit} apparaîtront ici.`,
      connectHint: "Connectez un canal pour voir vos statistiques ici.",
      connectChannel: "Connecter un canal",
      viewAll: "Tout voir",
      switchChannel: (name) => `Changer de canal (${name})`,
      ariaChart: (unit, days) => `${unit} sur les ${days} derniers jours`,
    },
    blog: {
      title: "Sur le blog",
      viewAll: "Tous les articles",
      label: "Article",
    },
  },
};

/* ============================================================
LAYOUT
============================================================ */
const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#050505]" : "bg-[#f5f3ef]";
const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0a0a0c]"
    : "border-black/[0.06] bg-white";
const cardClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";
const panelSurfaceClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-white/[0.025]"
    : "border-black/[0.06] bg-[#f6f4f0]";
const panelRingClass = (isDark: boolean) =>
  isDark ? "ring-[#101012]" : "ring-[#f6f4f0]";
const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-600" : "text-neutral-400";
const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";
const softClass = (isDark: boolean) =>
  isDark ? "text-neutral-400" : "text-neutral-500";
const subtleTitleClass = (isDark: boolean) =>
  isDark ? "text-neutral-500" : "text-neutral-400";
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
BLOG
============================================================ */
type BlogPost = {
  title: string;
  date: string;
  image?: string;
  url: string;
};

const BLOG_URL = "#";
const BLOG_POSTS: BlogPost[] = [
  {
    title: "The Best Time to Post on TikTok in 2026",
    date: "Jul 20, 2026",
    image: "/images/blog/best-time-tiktok.jpg",
    url: BLOG_URL,
  },
  {
    title: "The 11 Best AI Video Editors: I Tested Them All",
    date: "Jul 22, 2026",
    image: "/images/blog/ai-video-editors.jpg",
    url: BLOG_URL,
  },
  {
    title: "How to Create a Social Media Content Calendar",
    date: "Jul 24, 2026",
    image: "/images/blog/content-calendar.jpg",
    url: BLOG_URL,
  },
  {
    title: "17 Best AI Tools for Social Media Content",
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
function getGreetingKey(date: Date = new Date()): GreetingKey {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
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
function ClockDisplay({
  isDark,
  now,
  lang,
}: {
  isDark: boolean;
  now: Date;
  lang: Lang;
}) {
  const locale = intlLocale(lang);
  const time = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = now.toLocaleDateString(locale, {
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
OVERVIEW
============================================================ */
function GoalInfoHint({
  isDark,
  text,
  title,
}: {
  isDark: boolean;
  text: string;
  title: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative flex shrink-0 items-center">
      <button
        type="button"
        aria-label={text}
        aria-haspopup={isMobile ? "dialog" : undefined}
        onClick={() => {
          if (isMobile) setOpen(true);
        }}
        className={[
          "flex h-5 w-5 items-center justify-center rounded-full transition sm:h-3.5 sm:w-3.5",
          "focus-visible:outline-none focus-visible:ring-1",
          isDark
            ? "text-neutral-500 hover:text-white focus-visible:ring-white/30"
            : "text-neutral-400 hover:text-neutral-900 focus-visible:ring-black/30",
        ].join(" ")}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 sm:h-full sm:w-full"
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
          "pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max max-w-[min(220px,70vw)] max-md:hidden",
          "rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug sm:left-1/2 sm:-translate-x-1/2 sm:text-center",
          "opacity-0 shadow-lg transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          isDark ? "bg-white text-black" : "bg-neutral-900 text-white",
        ].join(" ")}
      >
        {text}
      </span>
      {open && isMobile && (
        <HintSheet
          isDark={isDark}
          title={title}
          text={text}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function Ring({
  isDark,
  progress,
  children,
  size = 52,
  stroke = 3.5,
}: {
  isDark: boolean;
  progress: number;
  children: ReactNode;
  size?: number;
  stroke?: number;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped * 100)}% complete`}
    >
      <div
        className={[
          "absolute rounded-full",
          isDark ? "bg-white/[0.06]" : "bg-white shadow-sm",
        ].join(" ")}
        style={{ inset: stroke }}
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={isDark ? "stroke-white/[0.14]" : "stroke-black/[0.10]"}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={[
            isDark ? "stroke-white" : "stroke-neutral-900",
            "transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none",
          ].join(" ")}
        />
      </svg>
      <div
        className={[
          "absolute inset-0 flex items-center justify-center",
          strongClass(isDark),
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

function Trend({ isDark, change }: { isDark: boolean; change: number }) {
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={["inline-flex items-center gap-1", strongClass(isDark)].join(
        " "
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">{up ? "Up " : "Down "}</span>
      {up ? "+" : ""}
      {change}%
    </span>
  );
}

function GoalItem({
  isDark,
  ring,
  title,
  hint,
  subtitle,
}: {
  isDark: boolean;
  ring: ReactNode;
  title: string;
  hint: string;
  subtitle: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 sm:gap-3">
      {ring}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={[
              "min-w-0 text-[15px] font-semibold leading-tight sm:text-[12px]",
              strongClass(isDark),
            ].join(" ")}
          >
            {title}
          </p>
          <GoalInfoHint isDark={isDark} text={hint} title={title} />
        </div>
        <p
          className={[
            "mt-1 flex flex-wrap items-center gap-x-1 text-[13px] leading-snug sm:mt-0.5 sm:text-[11px]",
            softClass(isDark),
          ].join(" ")}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function InfoHint({
  isDark,
  text,
  title,
  alignEndOnMobile = false,
}: {
  isDark: boolean;
  text: string;
  title: string;
  /** Ancre le tooltip à droite sur mobile pour éviter qu'il déborde de l'écran. */
  alignEndOnMobile?: boolean;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative flex shrink-0 items-center">
      <button
        type="button"
        aria-label={text}
        aria-haspopup={isMobile ? "dialog" : undefined}
        onClick={() => {
          if (isMobile) setOpen(true);
        }}
        className={[
          "flex h-5 w-5 items-center justify-center rounded-full transition sm:h-3.5 sm:w-3.5",
          "focus-visible:outline-none focus-visible:ring-1",
          isDark
            ? "text-neutral-600 hover:text-neutral-300 focus-visible:ring-white/30"
            : "text-neutral-400 hover:text-neutral-700 focus-visible:ring-black/30",
        ].join(" ")}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 sm:h-full sm:w-full"
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
          "pointer-events-none absolute bottom-full z-30 mb-2 w-max max-w-[min(210px,70vw)] max-md:hidden",
          alignEndOnMobile
            ? "right-0 max-sm:text-right sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
            : "left-1/2 -translate-x-1/2",
          "rounded-lg px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug",
          "opacity-0 shadow-lg transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          isDark ? "bg-[#2e2e31] text-white" : "bg-neutral-900 text-white",
        ].join(" ")}
      >
        {text}
      </span>
      {open && isMobile && (
        <HintSheet
          isDark={isDark}
          title={title}
          text={text}
          onClose={() => setOpen(false)}
        />
      )}
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
  vsLabel,
}: {
  isDark: boolean;
  icon: ReactNode;
  label: string;
  value: string;
  change: string;
  hint: string;
  vsLabel: string;
}) {
  const positive = change.startsWith("+");
  return (
    <div
      className={[
        "flex min-w-0 items-center gap-3",
        // Mobile : chaque stat devient une carte
        "max-sm:rounded-2xl max-sm:border max-sm:p-4",
        isDark ? "max-sm:bg-white/[0.025]" : "max-sm:bg-[#f6f4f0]",
        // Desktop : colonnes séparées par un filet
        "sm:border-r sm:pr-5 sm:last:border-r-0 sm:last:pr-0",
        isDark ? "border-white/[0.07]" : "border-black/[0.07]",
      ].join(" ")}
    >
      <div
        className={[
          "hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex",
          isDark
            ? "bg-white/[0.06] text-white"
            : "bg-white text-neutral-700 shadow-sm ring-1 ring-black/[0.05]",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1 sm:justify-start">
          <p
            className={[
              "truncate text-[14px] font-medium sm:text-[10px]",
              isDark
                ? "text-neutral-400 sm:text-neutral-500"
                : "text-neutral-500 sm:text-neutral-400",
            ].join(" ")}
          >
            {label}
          </p>
          <InfoHint isDark={isDark} text={hint} title={label} alignEndOnMobile />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mt-0.5 sm:gap-1.5">
          <span
            className={[
              "text-[28px] font-bold leading-none tracking-tight sm:text-[17px]",
              strongClass(isDark),
            ].join(" ")}
          >
            {value}
          </span>
          <span
            className={[
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold sm:text-[9px]",
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
              <TrendingUp
                className="h-3 w-3 sm:h-2.5 sm:w-2.5"
                aria-hidden="true"
              />
            ) : (
              <TrendingDown
                className="h-3 w-3 sm:h-2.5 sm:w-2.5"
                aria-hidden="true"
              />
            )}
            <span className="sr-only">{positive ? "Up " : "Down "}</span>
            {change}
          </span>
          <span
            className={["text-[12px] sm:hidden", softClass(isDark)].join(" ")}
          >
            · {vsLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

type HomeOverviewProps = {
  isDark: boolean;
  lang: Lang;
  weekStreak: number;
  postingGoal: { done: number; target: number };
  commentScore: { value: number; changePct: number };
};

function HomeOverview({
  isDark,
  lang,
  weekStreak,
  postingGoal,
  commentScore,
}: HomeOverviewProps) {
  const c = COPY[lang];
  const goalRatio =
    postingGoal.target > 0 ? postingGoal.done / postingGoal.target : 0;
  const goalReached =
    postingGoal.target > 0 && postingGoal.done >= postingGoal.target;

  return (
    <section className="mt-5 shrink-0 sm:mt-6">
      <div
        className={[
          "grid grid-cols-1 gap-5 rounded-3xl border p-4",
          "sm:grid-cols-3 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3",
          panelSurfaceClass(isDark),
        ].join(" ")}
      >
        <GoalItem
          isDark={isDark}
          title={c.goals.weekStreak}
          hint={c.hints.weekStreak}
          subtitle={
            weekStreak > 0 ? c.subtitle.streakHit : c.subtitle.streakEmpty
          }
          ring={
            <Ring isDark={isDark} progress={weekStreak > 0 ? 1 : 0}>
              <span className="text-[20px] font-semibold tabular-nums leading-none">
                {weekStreak}
              </span>
            </Ring>
          }
        />
        <GoalItem
          isDark={isDark}
          title={c.goals.postingGoals}
          hint={c.hints.postingGoals}
          subtitle={
            goalReached
              ? c.subtitle.goalReached
              : c.subtitle.goalProgress(postingGoal.done, postingGoal.target)
          }
          ring={
            <Ring isDark={isDark} progress={goalRatio}>
              <span className="text-[18px] font-bold tabular-nums leading-none">
                {Math.round(goalRatio * 100)}
                <span className="text-[11px] font-semibold">%</span>
              </span>
            </Ring>
          }
        />
        <GoalItem
          isDark={isDark}
          title={c.goals.commentScore}
          hint={c.hints.commentScore}
          subtitle={
            <>
              <Trend isDark={isDark} change={commentScore.changePct} />
              <span>{c.subtitle.fromLastWeek}</span>
            </>
          }
          ring={
            <Ring isDark={isDark} progress={commentScore.value / 100}>
              <span
                className={[
                  "text-[20px] font-semibold tabular-nums leading-none",
                  softClass(isDark),
                ].join(" ")}
              >
                {commentScore.value}
              </span>
            </Ring>
          }
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
      className="relative h-8 w-8 shrink-0 sm:h-9 sm:w-9"
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
            isDark ? "bg-[#242428] text-white" : "bg-neutral-900 text-white",
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
  lang,
  channels,
  onAdd,
}: {
  isDark: boolean;
  lang: Lang;
  channels: ConnectedChannel[];
  onAdd: () => void;
}) {
  const c = COPY[lang];
  return (
    <div
      className={[
        "flex min-h-[64px] flex-nowrap items-center justify-between gap-2.5 rounded-2xl border px-3 py-2.5 sm:min-h-[74px] sm:gap-x-4 sm:px-4 sm:py-0",
        panelSurfaceClass(isDark),
      ].join(" ")}
    >
      {channels.length === 0 ? (
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label={c.channels.connectAria}
            onClick={onAdd}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition sm:h-9 sm:w-9",
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
          <div className="min-w-0">
            <p
              className={[
                "text-[13px] font-semibold sm:text-[11px]",
                strongClass(isDark),
              ].join(" ")}
            >
              {c.channels.connectFirst}
            </p>
            <p
              className={[
                "mt-0.5 text-[11px] sm:text-[10px]",
                mutedClass(isDark),
              ].join(" ")}
            >
              {c.channels.connectFirstHint}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center pl-1">
            {channels.slice(0, 6).map((channel, index) => (
              <ChannelAvatar
                key={channel.key}
                channel={channel}
                isDark={isDark}
                overlap={index > 0}
              />
            ))}
            {channels.length > 6 && (
              <span
                title={`${channels.length - 6} more ${
                  channels.length - 6 === 1 ? "channel" : "channels"
                }`}
                className={[
                  "-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9",
                  "text-[10px] font-semibold ring-2",
                  isDark
                    ? "bg-[#242428] text-white"
                    : "bg-neutral-200 text-neutral-700",
                  panelRingClass(isDark),
                ].join(" ")}
              >
                +{channels.length - 6}
              </span>
            )}
            <button
              type="button"
              aria-label={c.channels.connectAnotherAria}
              title={c.channels.connectAnotherAria}
              onClick={onAdd}
              className={[
                "-ml-2 flex h-8 w-8 shrink-0 items-center justify-center sm:h-9 sm:w-9",
                "relative z-10 rounded-full border transition-all duration-200",
                focusRingClass(isDark),
                "ring-2",
                panelRingClass(isDark),
                isDark
                  ? "border-white/[0.14] bg-[#161618] text-white hover:border-white/25 hover:bg-[#1f1f22]"
                  : "border-black/[0.10] bg-white text-neutral-700 shadow-sm hover:border-black/20 hover:bg-neutral-50",
              ].join(" ")}
            >
              <Plus className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </button>
          </div>
          <div className="min-w-0">
            <p
              className={[
                "text-[12px] font-semibold leading-tight sm:text-[11px]",
                strongClass(isDark),
              ].join(" ")}
            >
              {c.channels.connected(channels.length)}
            </p>
            <p
              className={[
                "text-[11px] sm:text-[10px]",
                mutedClass(isDark),
              ].join(" ")}
            >
              {c.channels.readyToPublish}
            </p>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() =>
          channels.length === 0
            ? onAdd()
            : navigateToSettingsSection("channels")
        }
        className={[
          "flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 sm:gap-1.5 sm:px-3",
          "text-[11.5px] font-semibold transition sm:text-[10px]",
          focusRingClass(isDark),
          isDark
            ? "text-white hover:bg-white/[0.06]"
            : "text-neutral-900 hover:bg-black/[0.04]",
        ].join(" ")}
      >
        {channels.length === 0 ? c.channels.connect : c.channels.manage}
        <ArrowUpRight className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
      </button>
    </div>
  );
}

/* ============================================================
PANEL (Up Next / Calendar)
============================================================ */
function Panel({
  isDark,
  title,
  meta,
  viewAllLabel,
  onViewAll,
  icon,
  line1,
  line2,
  action,
}: {
  isDark: boolean;
  title: string;
  meta: string;
  viewAllLabel: string;
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
    <section className="flex h-full min-w-0 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <p
          className={[
            "min-w-0 text-[13px] font-semibold sm:text-[12px]",
            subtleTitleClass(isDark),
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
            "flex shrink-0 items-center gap-0.5 rounded-md py-1 text-[12px] font-semibold transition sm:py-0 sm:text-[11px]",
            focusRingClass(isDark),
            "disabled:cursor-default disabled:opacity-40",
            isDark
              ? "text-neutral-400 enabled:hover:text-white"
              : "text-neutral-500 enabled:hover:text-neutral-900",
          ].join(" ")}
        >
          {viewAllLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className={[
          "flex min-h-[170px] flex-1 flex-col items-center justify-center sm:min-h-[130px]",
          "gap-1 rounded-3xl border px-4 py-5 text-center sm:py-3",
          panelSurfaceClass(isDark),
        ].join(" ")}
      >
        <div
          className={[
            "mb-1.5 flex h-10 w-10 items-center justify-center rounded-full",
            isDark
              ? "bg-white/[0.07] text-neutral-300"
              : "bg-neutral-200/70 text-neutral-600",
          ].join(" ")}
        >
          {icon}
        </div>
        <p
          className={[
            "text-[13px] font-medium sm:text-[12px]",
            strongClass(isDark),
          ].join(" ")}
        >
          {line1}
        </p>
        <p className="text-[13px] text-neutral-500 sm:text-[12px]">{line2}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={[
              "mt-2.5 flex min-h-11 items-center gap-1.5 rounded-full border px-5 py-1.5 sm:min-h-0 sm:px-3.5",
              "text-[12px] font-semibold transition sm:text-[11px]",
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

/* ============================================================
INSIGHTS PANEL
============================================================ */
const INSIGHTS_DAYS = 30;
const insightsStartOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const insightsAddDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const insightsFmt = (d: Date, lang: Lang) =>
  d.toLocaleDateString(numLocale(lang), { day: "numeric", month: "short" });
const insightsNf = (n: number, lang: Lang) => n.toLocaleString(numLocale(lang));

function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;

  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }

  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  t.push(m[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const q = a * a + b * b;
    if (q > 9) {
      const k = 3 / Math.sqrt(q);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }

  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(
      pts[i + 1][0] - h
    ).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(
      1
    )},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

function InsightsMiniChart({
  dates,
  values,
  isDark,
  lang,
  unit = "views",
}: {
  dates: Date[];
  values: number[];
  isDark: boolean;
  lang: Lang;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");

  const W = 600;
  const H = 200;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = dates.length;
  const max = Math.max(4, ...values);
  const color = isDark ? "#ffffff" : "#111111";
  const axis = isDark ? "#6b6b72" : "#a3a3a3";
  const grid = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  const line = smoothPath(values.map((v, i) => [x(i), y(v)] as [number, number]));
  const area = `${line} L${x(n - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(
    1
  )},${pad.t + ih} Z`;

  const labelIdx = Array.from(
    new Set([0, 0.5, 1].map((r) => Math.round(r * (n - 1))))
  );

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = n === 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const c = COPY[lang];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
        onPointerUp={(e) => {
          if (e.pointerType !== "mouse") setHover(null);
        }}
        role="img"
        aria-label={c.insights.ariaChart(unit, INSIGHTS_DAYS)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4].map((tk) => {
          const yy = pad.t + ih - (tk / 4) * ih;
          return (
            <g key={tk}>
              <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke={grid} />
              <text
                x={pad.l - 8}
                y={yy + 3.5}
                fontSize="10"
                fill={axis}
                textAnchor="end"
                className="tabular-nums"
              >
                {Math.round((tk / 4) * max)}
              </text>
            </g>
          );
        })}

        {labelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            fontSize="10"
            fill={axis}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          >
            {insightsFmt(dates[i], lang)}
          </text>
        ))}

        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={pad.t + ih}
              stroke={axis}
              strokeOpacity="0.6"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover)}
              cy={y(values[hover])}
              r="4"
              fill={isDark ? "#0f0f11" : "#fff"}
              stroke={color}
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className={[
            "pointer-events-none absolute top-1 rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg",
            isDark
              ? "bg-[#101012] text-white ring-1 ring-white/10"
              : "bg-white text-neutral-900 ring-1 ring-black/10",
          ].join(" ")}
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > n / 2 ? "-110%" : "10%"})`,
          }}
        >
          <div className="opacity-50">{insightsFmt(dates[hover], lang)}</div>
          <b className="tabular-nums">{insightsNf(values[hover], lang)}</b>{" "}
          {unit}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
MiniChannelAvatar
------------------------------------------------------------------ */
function MiniChannelAvatar({
  channel,
  isDark,
  size = 22,
}: {
  channel?: ConnectedChannel;
  isDark: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [channel?.avatarUrl]);

  const label = (channel?.handle || channel?.name || "?").replace(/^@/, "");
  const initial = label.charAt(0).toUpperCase() || "?";
  const networkId = channel ? getNetworkId(channel) : null;
  const NetworkIcon = networkId ? NETWORK_ICONS[networkId] : null;
  const badge = Math.max(10, Math.round(size * 0.45));

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {channel?.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className={[
            "flex h-full w-full items-center justify-center rounded-full text-[10px] font-semibold",
            isDark ? "bg-[#242428] text-white" : "bg-neutral-900 text-white",
          ].join(" ")}
        >
          {initial}
        </span>
      )}
      {NetworkIcon && (
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white text-black ring-1",
            panelRingClass(isDark),
          ].join(" ")}
          style={{ width: badge, height: badge }}
        >
          <NetworkIcon className="h-[7px] w-[7px]" />
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------
ChannelSheet : sélecteur de canal en feuille glissable (mobile)
------------------------------------------------------------------ */
function ChannelSheet({
  isDark,
  title,
  channels,
  currentKey,
  onSelect,
  onClose,
}: {
  isDark: boolean;
  title: string;
  channels: ConnectedChannel[];
  currentKey?: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet isDark={isDark} isMobile title={title} onClose={onClose}>
      {(close) => (
        <ul role="menu" className="flex flex-col gap-1 pt-1">
          {channels.map((ch) => {
            const active = ch.key === currentKey;
            const handle = (ch.handle || "").replace(/^@/, "");
            const name = ch.name || handle || "Channel";
            return (
              <li key={ch.key}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onSelect(ch.key);
                    close();
                  }}
                  className={[
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition",
                    focusRingClass(isDark),
                    active
                      ? isDark
                        ? "bg-white/[0.08]"
                        : "bg-white shadow-sm"
                      : isDark
                        ? "active:bg-white/[0.06]"
                        : "active:bg-black/[0.04]",
                  ].join(" ")}
                >
                  <MiniChannelAvatar channel={ch} isDark={isDark} size={38} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        "block truncate text-[15px] font-semibold",
                        strongClass(isDark),
                      ].join(" ")}
                    >
                      {name}
                    </span>
                    {handle && handle !== name && (
                      <span
                        className={[
                          "block truncate text-[12.5px]",
                          softClass(isDark),
                        ].join(" ")}
                      >
                        @{handle}
                      </span>
                    )}
                  </span>
                  {active && (
                    <span
                      className={[
                        "h-2 w-2 shrink-0 rounded-full",
                        isDark ? "bg-white" : "bg-neutral-900",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------
Persistance de l'état Insights (onglet + canal)
------------------------------------------------------------------ */
const HOME_METRIC_TAB_KEYS = [
  "posts",
  "impact",
  "growth",
  "visibility",
] as const;
type HomeMetricTab = (typeof HOME_METRIC_TAB_KEYS)[number];

const HOME_METRIC_TAB_STORAGE_KEY = "home.insights.metricTab";
const HOME_CHANNEL_STORAGE_KEY = "home.insights.channelKey";

function readStoredMetricTab(): HomeMetricTab {
  if (typeof window === "undefined") return "visibility";
  try {
    const raw = window.localStorage.getItem(HOME_METRIC_TAB_STORAGE_KEY);
    if (raw && (HOME_METRIC_TAB_KEYS as readonly string[]).includes(raw)) {
      return raw as HomeMetricTab;
    }
  } catch {
    /* ignore */
  }
  return "visibility";
}

function readStoredChannelKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(HOME_CHANNEL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function InsightsPanel({
  isDark,
  lang,
  channels,
  onConnect,
}: {
  isDark: boolean;
  lang: Lang;
  channels: ConnectedChannel[];
  onConnect: () => void;
}) {
  const c = COPY[lang];
  const isMobile = useIsMobile();
  const [selectedKey, setSelectedKey] = useState<string | null>(
    readStoredChannelKey
  );
  const [metricTab, setMetricTab] = useState<HomeMetricTab>(
    readStoredMetricTab
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(HOME_METRIC_TAB_STORAGE_KEY, metricTab);
    } catch {
      /* ignore */
    }
  }, [metricTab]);

  useEffect(() => {
    try {
      if (selectedKey) {
        window.localStorage.setItem(HOME_CHANNEL_STORAGE_KEY, selectedKey);
      } else {
        window.localStorage.removeItem(HOME_CHANNEL_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [selectedKey]);

  useEffect(() => {
    // Sur mobile, la feuille (portail) gère sa propre fermeture.
    if (!menuOpen || isMobile) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, isMobile]);

  const selectedChannel = useMemo(() => {
    if (channels.length === 0) return undefined;
    if (selectedKey) {
      return channels.find((c) => c.key === selectedKey) ?? channels[0];
    }
    return channels[0];
  }, [channels, selectedKey]);

  const isYouTube = selectedChannel
    ? getNetworkId(selectedChannel) === "youtube"
    : false;

  const { start, end } = useMemo(() => {
    const today = insightsStartOfDay(new Date());
    return { start: insightsAddDays(today, -(INSIGHTS_DAYS - 1)), end: today };
  }, []);

  const yt = useYouTubeInsights(start, end, isYouTube, 0);
  const data = isYouTube ? yt.data : null;

  const hasActivity = useMemo(() => {
    if (!data) return false;
    const { current, summary, posts } = data;
    return (
      posts.length > 0 ||
      summary.posts > 0 ||
      current.some(
        (p) =>
          p.posts > 0 || p.reactions > 0 || p.comments > 0 || p.profileViews > 0
      )
    );
  }, [data]);

  const loading = isYouTube && yt.loading && !yt.data;
  const showChart = Boolean(data) && hasActivity;

  const metricData = useMemo(() => {
    if (!data) return null;
    const current = data.current;
    const last = current[current.length - 1];
    switch (metricTab) {
      case "visibility":
        return {
          label: c.insights.labels.channelViews,
          unit: c.insights.units.views,
          values: current.map((p) => p.profileViews),
          total: current.reduce((acc, p) => acc + p.profileViews, 0),
        };
      case "impact":
        return {
          label: c.insights.labels.reactions,
          unit: c.insights.units.reactions,
          values: current.map((p) => p.reactions),
          total: current.reduce((acc, p) => acc + p.reactions, 0),
        };
      case "growth":
        return {
          label: c.insights.labels.followers,
          unit: c.insights.units.followers,
          values: current.map((p) => p.followers),
          total: last?.followers ?? 0,
        };
      case "posts":
        return {
          label: c.insights.labels.posts,
          unit: c.insights.units.posts,
          values: current.map((p) => p.posts),
          total: current.reduce((acc, p) => acc + p.posts, 0),
        };
    }
  }, [data, metricTab, c]);

  const channelName = selectedChannel
    ? (selectedChannel.handle || selectedChannel.name || "Channel").replace(
        /^@/,
        ""
      )
    : "No channel";
  const canSwitch = channels.length > 1;

  return (
    <section
      className="flex h-full min-h-[260px] min-w-0 flex-col"
      aria-labelledby="home-insights-title"
    >
      <h2 id="home-insights-title" className="sr-only">
        Insights
      </h2>
      <div className="relative mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-center gap-1.5">
          {selectedChannel ? (
            <>
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  disabled={!canSwitch}
                  title={
                    canSwitch
                      ? c.insights.switchChannel(channelName)
                      : channelName
                  }
                  onClick={() => setMenuOpen((o) => !o)}
                  className={[
                    "flex min-h-10 items-center gap-1.5 rounded-lg py-1 pl-1 pr-2 transition-colors sm:min-h-0",
                    focusRingClass(isDark),
                    canSwitch
                      ? isDark
                        ? "hover:bg-white/[0.06]"
                        : "hover:bg-black/[0.04]"
                      : "disabled:cursor-default",
                  ].join(" ")}
                >
                  <MiniChannelAvatar
                    channel={selectedChannel}
                    isDark={isDark}
                  />
                  <span
                    className={[
                      "max-w-[140px] truncate text-[12.5px] font-semibold sm:max-w-[110px] sm:text-[11.5px]",
                      subtleTitleClass(isDark),
                    ].join(" ")}
                  >
                    {channelName}
                  </span>
                  {canSwitch && (
                    <ArrowLeftRight
                      className={["h-3 w-3", mutedClass(isDark)].join(" ")}
                      aria-hidden="true"
                    />
                  )}
                </button>
                {menuOpen && isMobile && (
                  <ChannelSheet
                    isDark={isDark}
                    title={c.channels.title}
                    channels={channels}
                    currentKey={selectedChannel?.key}
                    onSelect={setSelectedKey}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
                {menuOpen && !isMobile && (
                  <div
                    role="menu"
                    className={[
                      "absolute left-0 top-full z-30 mt-1 w-56 max-w-[calc(100vw-48px)] rounded-xl border p-1 shadow-xl",
                      isDark
                        ? "border-white/10 bg-[#101012]"
                        : "border-black/10 bg-white",
                    ].join(" ")}
                  >
                    {channels.map((ch) => {
                      const active = ch.key === selectedChannel?.key;
                      const name = (ch.handle || ch.name || "Channel").replace(
                        /^@/,
                        ""
                      );
                      return (
                        <button
                          key={ch.key}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            setSelectedKey(ch.key);
                            setMenuOpen(false);
                          }}
                          className={[
                            "flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors sm:min-h-0",
                            focusRingClass(isDark),
                            isDark
                              ? "hover:bg-white/[0.06]"
                              : "hover:bg-black/[0.04]",
                          ].join(" ")}
                        >
                          <MiniChannelAvatar
                            channel={ch}
                            isDark={isDark}
                            size={20}
                          />
                          <span
                            className={[
                              "min-w-0 flex-1 truncate text-[12px] font-medium sm:text-[11px]",
                              strongClass(isDark),
                            ].join(" ")}
                          >
                            {name}
                          </span>
                          {active && (
                            <span
                              className={[
                                "h-1.5 w-1.5 rounded-full",
                                isDark ? "bg-white" : "bg-neutral-900",
                              ].join(" ")}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <span
                className={[
                  "hidden h-4 w-px shrink-0 sm:block",
                  isDark ? "bg-white/10" : "bg-black/10",
                ].join(" ")}
                aria-hidden="true"
              />
              <div
                role="tablist"
                aria-label="Insight metric"
                className="flex min-w-0 max-w-full gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:order-last max-sm:basis-full"
              >
                {HOME_METRIC_TAB_KEYS.map((tabKey) => {
                  const active = metricTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setMetricTab(tabKey)}
                      className={[
                        "whitespace-nowrap rounded-lg px-2 py-1.5 text-[11.5px] font-semibold transition-colors max-sm:flex-1 max-sm:text-center sm:px-2 sm:py-1 sm:text-[10.5px]",
                        focusRingClass(isDark),
                        active
                          ? isDark
                            ? "bg-white text-black"
                            : "bg-neutral-900 text-white"
                          : isDark
                            ? "text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                            : "text-neutral-500 hover:bg-black/[0.04] hover:text-neutral-900",
                      ].join(" ")}
                    >
                      {c.insights.metricTabs[tabKey]}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              className={[
                "flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-semibold transition sm:min-h-0 sm:px-2 sm:text-[11px]",
                focusRingClass(isDark),
                isDark
                  ? "bg-white text-black hover:bg-neutral-200"
                  : "bg-neutral-900 text-white hover:bg-neutral-700",
              ].join(" ")}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {c.insights.connectChannel}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            navigate(
              selectedChannel
                ? `insights?channel=${encodeURIComponent(selectedChannel.key)}`
                : "insights"
            )
          }
          className={[
            "flex shrink-0 items-center gap-0.5 rounded-md py-1 text-[12px] font-semibold transition max-sm:absolute max-sm:right-0 max-sm:top-2 sm:py-0 sm:text-[11px]",
            focusRingClass(isDark),
            isDark
              ? "text-neutral-400 hover:text-white"
              : "text-neutral-500 hover:text-neutral-900",
          ].join(" ")}
        >
          {c.insights.viewAll}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div
          className={[
            "flex min-h-[200px] flex-1 animate-pulse rounded-2xl border",
            panelSurfaceClass(isDark),
          ].join(" ")}
          role="status"
          aria-label={c.insights.loading}
        />
      ) : showChart && data && metricData ? (
        <div
          className={[
            "flex min-h-[200px] flex-1 flex-col rounded-2xl border p-3",
            panelSurfaceClass(isDark),
          ].join(" ")}
        >
          <div className="mb-2 px-1">
            <p
              className={[
                "text-[11px] font-medium sm:text-[10px]",
                softClass(isDark),
              ].join(" ")}
            >
              {metricData.label}
              <span className="ml-1 opacity-60">
                · {c.insights.lastDays(INSIGHTS_DAYS)}
              </span>
            </p>
            <p
              className={[
                "text-[26px] font-bold leading-none tracking-tight tabular-nums sm:text-[20px]",
                strongClass(isDark),
              ].join(" ")}
            >
              {insightsNf(metricData.total, lang)}
            </p>
          </div>
          <InsightsMiniChart
            dates={data.current.map((p) => p.date)}
            values={metricData.values}
            isDark={isDark}
            lang={lang}
            unit={metricData.unit}
          />
        </div>
      ) : (
        <div
          className={[
            "flex min-h-[200px] flex-1 flex-col items-center justify-center",
            "rounded-2xl border px-5 py-5 text-center sm:py-3",
            panelSurfaceClass(isDark),
          ].join(" ")}
        >
          <div
            className={[
              "mb-1.5 flex h-9 w-9 items-center justify-center rounded-2xl",
              isDark
                ? "bg-white/[0.07] text-neutral-300"
                : "bg-white text-neutral-600 shadow-sm ring-1 ring-black/[0.04]",
            ].join(" ")}
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          </div>
          <p
            className={[
              "text-[13px] font-semibold sm:text-[12px]",
              strongClass(isDark),
            ].join(" ")}
          >
            {selectedChannel
              ? c.insights.noData
              : c.insights.nothingConnected}
          </p>
          <p
            className={[
              "mt-1 max-w-[280px] text-[12px] leading-snug sm:text-[11px]",
              softClass(isDark),
            ].join(" ")}
          >
            {selectedChannel
              ? c.insights.publishHint(
                  channelName,
                  metricData?.unit ?? c.insights.units.views
                )
              : c.insights.connectHint}
          </p>
          {!selectedChannel && (
            <button
              type="button"
              onClick={onConnect}
              className={[
                "mt-2.5 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[12px] font-semibold transition sm:min-h-8 sm:px-3 sm:text-[11px]",
                focusRingClass(isDark),
                isDark
                  ? "bg-white text-black hover:bg-neutral-200"
                  : "bg-neutral-900 text-white hover:bg-neutral-700",
              ].join(" ")}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {c.insights.connectChannel}
            </button>
          )}
        </div>
      )}
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

  // Mobile : image 16/9 pleine largeur. sm+ : hauteur fixe.
  const sizeClass = "aspect-[16/9] w-full sm:aspect-auto sm:h-[140px]";

  if (!src || failed) {
    return (
      <div
        className={[
          sizeClass,
          "rounded-xl",
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
      className={[sizeClass, "rounded-xl object-cover"].join(" ")}
    />
  );
}

/* ============================================================
BLOG SECTION
============================================================ */
function BlogSection({ isDark, lang }: { isDark: boolean; lang: Lang }) {
  const c = COPY[lang];
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p
          className={[
            "text-[16px] font-semibold sm:text-[12px]",
            isDark ? "text-neutral-300" : "text-neutral-700",
          ].join(" ")}
        >
          {c.blog.title}
        </p>
        <a
          href={BLOG_URL}
          {...linkProps(BLOG_URL)}
          className={[
            "flex shrink-0 items-center gap-0.5 rounded-md py-1 text-[12px] font-semibold transition sm:py-0 sm:text-[11px]",
            focusRingClass(isDark),
            isDark
              ? "text-neutral-400 hover:text-white"
              : "text-neutral-500 hover:text-neutral-900",
          ].join(" ")}
        >
          {c.blog.viewAll}
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Mobile : cartes empilées verticalement, pleine largeur.
          sm : 2 colonnes · xl : 4 colonnes. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {BLOG_POSTS.map((post) => (
          <a
            key={post.title}
            href={post.url}
            {...linkProps(post.url)}
            className={[
              "group flex min-w-0 flex-col rounded-2xl border p-3 transition sm:p-3.5",
              focusRingClass(isDark),
              cardClass(isDark),
              isDark ? "hover:bg-[#141416]" : "hover:bg-[#f6f4f0]",
            ].join(" ")}
          >
            <BlogImage src={post.image} isDark={isDark} />
            <div className="mt-3.5 flex items-center justify-between gap-2 px-0.5">
              <span
                className={[
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold sm:text-[10px]",
                  isDark
                    ? "bg-[#16304f] text-[#a9cdf5]"
                    : "bg-blue-50 text-blue-700",
                ].join(" ")}
              >
                {c.blog.label}
              </span>
              <span
                className={[
                  "text-[11px] sm:text-[10px]",
                  mutedClass(isDark),
                ].join(" ")}
              >
                {post.date}
              </span>
            </div>
            <h3
              className={[
                "mt-2.5 px-0.5 text-[15px] font-semibold leading-snug sm:text-[14px]",
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
const WEEK_STREAK = 1;

export default function Home() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();
  const lang = useLanguage();
  const c = COPY[lang];
  const isMobile = useIsMobile();

  const [query, setQuery] = useState("");
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(userProfileCache.profile);
  const [userLoaded, setUserLoaded] = useState(
    userProfileCache.profile !== null
  );
  const [now, setNow] = useState(() => new Date());
  const connectedChannels = useConnectedChannels();

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
  const greeting = c.greeting[getGreetingKey(now)];
  const formattedDate = now.toLocaleDateString(intlLocale(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Période affichée sous "Overview" sur mobile : 7 derniers jours.
  const weekRange = useMemo(() => {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(intlLocale(lang), { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [now, lang]);

  const displayName = fullName || "adamnolke";
  const compact = (n: number) =>
    new Intl.NumberFormat(numLocale(lang), {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);

  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }
    throw new Error(unavailablePostActionMessage(payload));
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
        "relative h-dvh min-h-dvh w-full overflow-hidden overscroll-none",
        "transition-colors duration-300",
        pageBgClass(isDark),
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />
      <div
        className={[
          "h-full min-h-0 px-2 py-2 md:py-3 md:pl-0 md:pr-3",
          "max-md:pt-[calc(3.5rem+env(safe-area-inset-top))]",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        // Sur mobile la sidebar est un tiroir : aucun décalage à gauche.
        style={isMobile ? undefined : { paddingLeft: sidebarOffset }}
      >
        <div
          className={[
            "h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain",
            "rounded-2xl border md:rounded-[28px]",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "transition-colors duration-300",
            mainPanelClass(isDark),
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto flex w-full min-w-0 max-w-[1720px]",
              "flex-col px-[clamp(14px,3vw,48px)]",
              "pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[clamp(16px,3vw,30px)]",
            ].join(" ")}
          >
            <header className="flex min-w-0 shrink-0 items-center justify-between gap-3 sm:items-start">
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <GreetingAvatar
                  avatarUrl={user?.avatar_url}
                  initials={initials}
                  isDark={isDark}
                  loading={!userLoaded}
                />
                <div className="flex min-w-0 flex-col">
                  <h1
                    className={[
                      "break-words text-[clamp(18px,5vw,24px)] font-semibold leading-[1.15] tracking-[-0.035em] sm:truncate",
                      strongClass(isDark),
                    ].join(" ")}
                  >
                    {greeting}, {displayName}!
                  </h1>
                  <p
                    className={[
                      "mt-1 text-[13px] font-medium sm:mt-0.5",
                      mutedClass(isDark),
                    ].join(" ")}
                  >
                    {formattedDate}
                  </p>
                </div>
              </div>
              <div className="ml-auto hidden shrink-0 sm:block">
                <ClockDisplay isDark={isDark} now={now} lang={lang} />
              </div>
            </header>

            <HomeOverview
              isDark={isDark}
              lang={lang}
              weekStreak={WEEK_STREAK}
              postingGoal={{ done: 1, target: 2 }}
              commentScore={{ value: 13, changePct: 100 }}
            />

            <section className="mt-8 min-w-0 shrink-0 sm:mt-7">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={[
                      "text-[18px] font-semibold tracking-[-0.02em] sm:text-[11px] sm:tracking-normal",
                      isDark
                        ? "text-white sm:text-neutral-500"
                        : "text-neutral-900 sm:text-neutral-400",
                    ].join(" ")}
                  >
                    {c.overview.title}
                  </p>
                  <p
                    className={[
                      "mt-0.5 text-[12px] leading-snug sm:text-[11px]",
                      isDark ? "text-neutral-400" : "text-neutral-500",
                    ].join(" ")}
                  >
                    <span className="sm:hidden">{weekRange} · </span>
                    {c.overview.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("insights")}
                  className={[
                    "flex shrink-0 items-center gap-0.5 rounded-md py-1 text-[13px] font-semibold transition sm:hidden",
                    focusRingClass(isDark),
                    isDark
                      ? "text-neutral-200 hover:text-white"
                      : "text-neutral-700 hover:text-neutral-900",
                  ].join(" ")}
                >
                  {c.overview.goToInsights}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div
                className={[
                  "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2",
                  // 3 cartes en 2 colonnes : la dernière occupe toute la largeur
                  "min-[420px]:max-sm:[&>*:last-child:nth-child(odd)]:col-span-2",
                  "sm:grid-cols-3 sm:rounded-2xl sm:border sm:p-4",
                  isDark
                    ? "sm:border-white/[0.07] sm:bg-white/[0.025]"
                    : "sm:border-black/[0.06] sm:bg-[#f6f4f0]",
                ].join(" ")}
              >
                <Stat
                  isDark={isDark}
                  label={c.overview.followers}
                  value={compact(27000)}
                  change="-2%"
                  hint={c.hints.followers}
                  vsLabel={c.overview.vsLastWeek}
                  icon={<Users className="h-4 w-4" />}
                />
                <Stat
                  isDark={isDark}
                  label={c.overview.likes}
                  value={compact(12400)}
                  change="+16%"
                  hint={c.hints.likes}
                  vsLabel={c.overview.vsLastWeek}
                  icon={<Heart className="h-4 w-4" />}
                />
                <Stat
                  isDark={isDark}
                  label={c.overview.comments}
                  value={compact(342)}
                  change="+5%"
                  hint={c.hints.comments}
                  vsLabel={c.overview.vsLastWeek}
                  icon={<MessageCircle className="h-4 w-4" />}
                />
              </div>
            </section>

            <section className="mt-7 min-w-0 shrink-0 sm:mt-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p
                    className={[
                      "text-[14px] font-semibold sm:text-[11px]",
                      isDark
                        ? "text-neutral-300 sm:text-neutral-500"
                        : "text-neutral-700 sm:text-neutral-400",
                    ].join(" ")}
                  >
                    {c.channels.title}
                  </p>
                  <p
                    className={[
                      "mt-0.5 text-[12px] sm:text-[10px]",
                      isDark
                        ? "text-neutral-500 sm:text-neutral-700"
                        : "text-neutral-400",
                    ].join(" ")}
                  >
                    {c.channels.subtitle}
                  </p>
                </div>
              </div>
              <Channels
                isDark={isDark}
                lang={lang}
                channels={connectedChannels}
                onAdd={() => navigateToSettingsSection("channels")}
              />
            </section>

            <div className="mt-8 grid min-w-0 grid-cols-1 gap-7 md:mt-6 md:grid-cols-2 md:gap-4 xl:gap-6">
              <InsightsPanel
                isDark={isDark}
                lang={lang}
                channels={connectedChannels}
                onConnect={() => navigateToSettingsSection("channels")}
              />
              <Panel
                isDark={isDark}
                title={c.upNext.title}
                meta={c.upNext.meta(0)}
                viewAllLabel={c.upNext.viewAll}
                onViewAll={() => navigate("calendar")}
                icon={<CalendarDays className="h-5 w-5" />}
                line1={c.upNext.line1}
                line2={c.upNext.line2}
                action={{
                  label: c.upNext.createPost,
                  onClick: () => setIsNewPostOpen(true),
                }}
              />
            </div>

            <div className="mt-9 min-w-0 md:mt-8">
              <BlogSection isDark={isDark} lang={lang} />
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