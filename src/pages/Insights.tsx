// src/pages/Insights.tsx
// Insights = moteur de prochaine action (pas un clone d'analytics).
// YouTube : données réelles. Autres réseaux : démo en attendant leur API.
//
// Responsive aligné sur Schedule / Home / Create :
//  - 100dvh, padding haut = barre mobile de la sidebar (safe-area incluse)
//  - AUCUN décalage gauche sur mobile (la sidebar y est un tiroir)
//  - un seul breakpoint de bascule : md (768px) <-> useIsMobile()
//  - cibles tactiles >= 40px sur mobile
//  - mobile : feuilles glissables (BottomSheet) pour le canal, la plage de
//    dates, les infobulles « i » et le détail horaire d'un jour
//  - mobile : « Meilleur moment » = 7 lignes (une par jour) au lieu d'une
//    grille 24 colonnes illisible ; un tap ouvre les 24 heures en grandes cases
//  - tableau des posts : cartes sous md, grille 6 colonnes dès md

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Info,
  Layers,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Send,
  Tag,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import { navigateToSettingsSection } from "../utils/settingsNavigation";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, {
  useSidebarOffset,
  useFavorites,
} from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import HelpChatButton from "../components/Helpchatbutton";
import ChannelMenu from "../components/ChannelMenu";
import { CalendarPicker } from "../components/CalendarPicker";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import {
  useConnectedChannels,
  type ConnectedChannel,
} from "../hooks/useConnectedChannels";
import {
  XIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
} from "../components/IntegrationIcons";
import { createPosts } from "../services/posts";
import { fetchYouTubeVideos, useYouTubeInsights } from "../services/youtube";
import { readPostingGoal } from "../components/OnboardingModals";
import { useNewPostRequest } from "../services/NewPostBus";

/** Route de cette page dans la sidebar (section Favoris). */
const PAGE_ROUTE = "insights";
const ALL_KEY = "all";

/** Rangée scrollable sans scrollbar visible. */
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Délai avant d'exécuter une action lancée depuis une feuille (laisse finir l'animation de fermeture). */
const SHEET_ACTION_DELAY = 280;

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
   RESPONSIVE
============================================================ */

const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(
    () =>
      typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
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
   TYPES
============================================================ */

type Range = "7d" | "30d" | "mtd" | "custom";
type ChartView = "this" | "comparison" | "both";
type PostsPeriod = "this" | "previous";
type SortKey = "reactions" | "comments" | "engRate" | "videoViews";
type NumKey = "posts" | "reactions" | "comments" | "followers" | "profileViews";
type SummaryBoxKey =
  | "followers"
  | "posts"
  | "reactions"
  | "comments"
  | "engRate"
  | "videoViews";

type Point = {
  date: Date;
  posts: number;
  reactions: number;
  comments: number;
  followers: number;
  profileViews: number;
};

type Summary = {
  followers: number;
  posts: number;
  reactions: number;
  comments: number;
  engRate: number;
  videoViews: number;
  shares: number;
  reach: number;
  watchMin: number;
  avgWatchSec: number;
};

type PostRow = {
  id: string;
  label: string;
  date: Date;
  media: "image" | "video" | "text";
  thumbnailUrl?: string;
  status?: string;
  reactions: number;
  comments: number;
  engRate: number;
  videoViews: number;
  platform?: string;
};

type InsightsData = {
  current: Point[];
  previous: Point[];
  summary: Summary;
  posts: PostRow[];
  previousPosts: PostRow[];
};

type SeriesDef = {
  key: NumKey;
  label: string;
  tone: 0 | 1;
  agg: "sum" | "last";
};

type ChartRow = {
  date: string;
  fullDate: string;
  left_this: number;
  left_prev: number;
  right_this?: number;
  right_prev?: number;
};

type ChartSeries = {
  label: string;
  color: string;
  values: number[];
  prev: number[];
};

type ComposerContext = {
  scheduledAt?: Date;
  channelKey?: string;
  duplicateFrom?: PostRow;
  reason?: "heatmap" | "duplicate" | "insight" | "manual";
};

/* ============================================================
   TRANSLATIONS
============================================================ */

type Copy = {
  header: {
    title: string;
    export: string;
    refresh: string;
    addFavorite: string;
    removeFavorite: string;
  };
  noChannels: {
    title: string;
    description: string;
    connect: string;
  };
  errors: {
    youtube: (msg: string) => string;
    retry: string;
    loading: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  overview: {
    title: string;
    subtitle: string;
    dateRangeAria: string;
  };
  ranges: Record<Range, string>;
  summary: {
    title: string;
    periodSeparator: string;
    comparedTo: (range: string) => string;
    goalProgress: (done: number, goal: number) => string;
    goalAria: (done: number, goal: number) => string;
    glance: (posts: number, reactions: number, comments: number) => string;
    labels: Record<SummaryBoxKey, string>;
    info: Record<SummaryBoxKey, string>;
    vsPreviousShort: string;
    vsPreviousLong: string;
  };
  trends: {
    title: string;
    subtitle: (period: string) => string;
    compareToggle: string;
    metricAria: string;
    thisPeriod: string;
    previousPeriod: string;
    total: string;
    ending: string;
    prevSuffix: string;
  };
  metricOptions: {
    posts: string;
    reactions: string;
    comments: string;
    followers: string;
    profileViews: string;
    channelViews: string;
  };
  bestTime: {
    title: string;
    emptySubhead: string;
    filledSubhead: (label: string) => string;
    noteBaseline: string;
    noteEarly: (n: number) => string;
    noteSolid: (n: number) => string;
    useLabel: (label: string) => string;
    bestOfDaySuffix: string;
    scheduleAria: (day: string, hour: string) => string;
    low: string;
    high: string;
    pickHour: string;
    bestOfDay: string;
  };
  recycle: {
    title: string;
    subtitle: string;
    emptyHint: string;
    rank: (n: number) => string;
    duplicate: string;
    engagement: (reactions: number, rate: string) => string;
  };
  performance: {
    title: string;
    periodThis: string;
    periodPrevious: string;
    periodAria: string;
    hiddenScheduled: (n: number) => string;
    postsCount: (n: number) => string;
    sortBy: (label: string) => string;
    emptyLoading: string;
    emptyNoMatch: string;
    emptyNoPost: string;
    emptyLongerPeriod: string;
    showLast30Days: string;
    openYouTube: string;
    duplicatePost: string;
    showMore: (n: number) => string;
    showLess: string;
    columns: Record<SortKey, string>;
    top: string;
  };
  media: {
    video: string;
    image: string;
    text: string;
  };
  days: string[];
  daysLong: string[];
  calendar: {
    from: string;
    to: string;
    helpFrom: string;
    helpTo: string;
    next: string;
    back: string;
    done: string;
    rangeAria: string;
  };
  sheets: {
    channels: string;
    dateRange: string;
  };
  tagsButton: string;
  allNetworks: string;
  demo: {
    tiktok: string[];
    pinterest: string[];
    youtube: string[];
    default: string[];
  };
};

const COPY: Record<Lang, Copy> = {
  en: {
    header: {
      title: "Insights",
      export: "Export",
      refresh: "Refresh insights",
      addFavorite: "Add to favorites",
      removeFavorite: "Remove from favorites",
    },
    noChannels: {
      title: "Connect a channel to see insights",
      description:
        "Followers, reach, and engagement appear here once a social account is connected.",
      connect: "Connect a channel",
    },
    errors: {
      youtube: (msg) => `Couldn't load YouTube insights: ${msg}`,
      retry: "Retry",
      loading: "Loading YouTube insights…",
    },
    hero: {
      eyebrow: "Insights",
      title: "Know what's working best.",
      subtitle:
        "Insights show which posts, formats, and times perform best, so your next publish is a decision — not a bet.",
    },
    overview: {
      title: "Overview",
      subtitle: "Pick a period — everything below updates",
      dateRangeAria: "Date range",
    },
    ranges: {
      "7d": "7 days",
      "30d": "30 days",
      mtd: "Month to date",
      custom: "Custom",
    },
    summary: {
      title: "Summary",
      periodSeparator: " · ",
      comparedTo: (range) => `Compared to ${range}`,
      goalProgress: (done, goal) => `${done}/${goal} this week`,
      goalAria: (done, goal) => `Goal: ${done} of ${goal} this week`,
      glance: (posts, reactions, comments) => {
        const p = `${posts} post${posts === 1 ? "" : "s"}`;
        const r = `${reactions} reaction${reactions === 1 ? "" : "s"}`;
        const c = `${comments} comment${comments === 1 ? "" : "s"}`;
        return `You published ${p} and received ${r} and ${c}.`;
      },
      labels: {
        followers: "Total followers",
        posts: "Posts",
        reactions: "Reactions",
        comments: "Comments",
        engRate: "Eng. rate",
        videoViews: "Video views",
      },
      info: {
        followers: "How many people follow you at the end of the period.",
        posts: "Posts published during the period (scheduled posts excluded).",
        reactions: "Likes and other reactions received on your posts.",
        comments: "Comments received on your posts.",
        engRate:
          "Share of views that turned into a like or comment. Higher is better.",
        videoViews: "How many times your videos were viewed.",
      },
      vsPreviousShort: "vs previous period",
      vsPreviousLong: "vs previous period",
    },
    trends: {
      title: "Trends",
      subtitle: (period) =>
        `Pick a metric to see its day-by-day trend · ${period}`,
      compareToggle: "Compare to previous period",
      metricAria: "Metric to display",
      thisPeriod: "This period",
      previousPeriod: "Previous period",
      total: "total for period",
      ending: "end of period",
      prevSuffix: "(prev.)",
    },
    metricOptions: {
      posts: "Posts",
      reactions: "Reactions",
      comments: "Comments",
      followers: "Followers",
      profileViews: "Profile views",
      channelViews: "Channel views",
    },
    bestTime: {
      title: "Best time to post",
      emptySubhead:
        "Once a few posts arrive, we'll map the time that actually works for you — and hand it to your calendar.",
      filledSubhead: (label) =>
        `Your best window is ${label}. Don't guess the slot — fill it.`,
      noteBaseline:
        "Based on typical audience activity — refines as you publish",
      noteEarly: (n) => `Typical activity combined with your ${n} posts`,
      noteSolid: (n) =>
        `Based on your ${n} posts, smoothed by hour and weekday`,
      useLabel: (label) => `Use ${label}`,
      bestOfDaySuffix: " · best of day",
      scheduleAria: (day, hour) => `Schedule ${day} at ${hour}`,
      low: "Low",
      high: "High",
      pickHour: "Tap an hour to schedule a post there.",
      bestOfDay: "Best of the day",
    },
    recycle: {
      title: "Posts to recycle",
      subtitle: "Posts that are still outperforming — duplicate the angle",
      emptyHint:
        "After a few published posts, the ones worth redoing will appear here.",
      rank: (n) => `#${n}`,
      duplicate: "Duplicate →",
      engagement: (reactions, rate) =>
        `${reactions} reactions · ${rate}% eng.`,
    },
    performance: {
      title: "All your posts",
      periodThis: "This period",
      periodPrevious: "Previous period",
      periodAria: "Posts period",
      hiddenScheduled: (n) => `${n} scheduled not shown`,
      postsCount: (n) => `Posts · ${n}`,
      sortBy: (label) => `Sort by ${label}`,
      emptyLoading: "Loading videos…",
      emptyNoMatch: "No post matches your search",
      emptyNoPost: "No post in this period",
      emptyLongerPeriod:
        "Pick a longer range to see how your previous posts performed.",
      showLast30Days: "Show last 30 days",
      openYouTube: "Open on YouTube",
      duplicatePost: "Duplicate this post",
      showMore: (n) => `Show all ${n} posts`,
      showLess: "Show fewer posts",
      columns: {
        reactions: "Reactions",
        comments: "Comments",
        engRate: "Eng. rate",
        videoViews: "Video views",
      },
      top: "Top",
    },
    media: {
      video: "video",
      image: "image",
      text: "text",
    },
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    daysLong: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    calendar: {
      from: "From",
      to: "To",
      helpFrom: "Pick the first day of the period.",
      helpTo: "Pick the last day of the period (today max).",
      next: "Next: To",
      back: "Back: From",
      done: "Done",
      rangeAria: "Custom date range",
    },
    sheets: {
      channels: "Channels",
      dateRange: "Date range",
    },
    tagsButton: "Tags",
    allNetworks: "All networks",
    demo: {
      tiktok: [
        "3-second hook",
        "Behind the scenes",
        "Before / after",
        "The sound that stuck",
        "Day in the queue",
      ],
      pinterest: [
        "Moodboard: quiet luxury",
        "The pin that saves",
        "Colors story",
        "Shelf arrangement",
        "Close-up texture",
      ],
      youtube: [
        "Short: one idea",
        "Cut the intro",
        "What I'd redo",
        "90s of proof",
        "The clip that's left",
      ],
      default: [
        "Quiet release",
        "The one people saved",
        "Studio note",
        "Ambition, shorter",
        "Still in progress",
      ],
    },
  },
  fr: {
    header: {
      title: "Insights",
      export: "Exporter",
      refresh: "Rafraîchir les insights",
      addFavorite: "Ajouter aux favoris",
      removeFavorite: "Retirer des favoris",
    },
    noChannels: {
      title: "Connectez un canal pour voir les insights",
      description:
        "Les abonnés, la portée et l'engagement apparaissent ici une fois un compte social connecté.",
      connect: "Connecter un canal",
    },
    errors: {
      youtube: (msg) => `Impossible de charger les insights YouTube : ${msg}`,
      retry: "Réessayer",
      loading: "Chargement des insights YouTube…",
    },
    hero: {
      eyebrow: "Insights",
      title: "Sachez ce qui fonctionne le mieux.",
      subtitle:
        "Les insights montrent quels posts, formats et horaires performent le mieux, pour que votre prochaine publication soit une décision, pas un pari.",
    },
    overview: {
      title: "Aperçu",
      subtitle: "Choisissez une période — tout ci-dessous se met à jour",
      dateRangeAria: "Plage de dates",
    },
    ranges: {
      "7d": "7 jours",
      "30d": "30 jours",
      mtd: "Mois en cours",
      custom: "Personnalisé",
    },
    summary: {
      title: "Résumé",
      periodSeparator: " · ",
      comparedTo: (range) => `Comparé à ${range}`,
      goalProgress: (done, goal) => `${done}/${goal} cette semaine`,
      goalAria: (done, goal) => `Objectif : ${done} sur ${goal} cette semaine`,
      glance: (posts, reactions, comments) => {
        const p = `${posts} post${posts > 1 ? "s" : ""}`;
        const r = `${reactions} réaction${reactions === 1 ? "" : "s"}`;
        const c = `${comments} commentaire${comments === 1 ? "" : "s"}`;
        return `Vous avez publié ${p} et reçu ${r} et ${c}.`;
      },
      labels: {
        followers: "Abonnés totaux",
        posts: "Posts",
        reactions: "Réactions",
        comments: "Commentaires",
        engRate: "Taux d'eng.",
        videoViews: "Vues vidéo",
      },
      info: {
        followers: "Combien de personnes vous suivent à la fin de la période.",
        posts:
          "Posts publiés sur la période (les posts programmés ne sont pas comptés).",
        reactions: "Likes et autres réactions reçues sur vos posts.",
        comments: "Commentaires reçus sur vos posts.",
        engRate:
          "Part des vues transformées en like ou commentaire. Plus c'est haut, mieux c'est.",
        videoViews: "Combien de fois vos vidéos ont été vues.",
      },
      vsPreviousShort: "vs période précédente",
      vsPreviousLong: "vs période précédente",
    },
    trends: {
      title: "Tendances",
      subtitle: (period) =>
        `Choisissez un indicateur pour voir son évolution jour par jour · ${period}`,
      compareToggle: "Comparer avec la période précédente",
      metricAria: "Indicateur à afficher",
      thisPeriod: "Cette période",
      previousPeriod: "Période précédente",
      total: "total sur la période",
      ending: "à la fin de la période",
      prevSuffix: "(préc.)",
    },
    metricOptions: {
      posts: "Posts",
      reactions: "Réactions",
      comments: "Commentaires",
      followers: "Abonnés",
      profileViews: "Vues du profil",
      channelViews: "Vues de la chaîne",
    },
    bestTime: {
      title: "Meilleur moment pour publier",
      emptySubhead:
        "Dès que quelques posts arrivent, nous cartographions l'heure qui fonctionne vraiment pour vous — puis l'envoyons au calendrier.",
      filledSubhead: (label) =>
        `Votre meilleure fenêtre est ${label}. Ne devinez pas le créneau — remplissez-le.`,
      noteBaseline:
        "Basé sur l'activité typique de l'audience — s'affine au fur et à mesure que vous publiez",
      noteEarly: (n) => `Activité typique combinée à vos ${n} posts`,
      noteSolid: (n) =>
        `Basé sur vos ${n} posts, lissés par heure et jour de la semaine`,
      useLabel: (label) => `Utiliser ${label}`,
      bestOfDaySuffix: " · meilleur du jour",
      scheduleAria: (day, hour) => `Programmer ${day} à ${hour}`,
      low: "Faible",
      high: "Élevé",
      pickHour: "Touchez une heure pour y programmer un post.",
      bestOfDay: "Meilleur moment du jour",
    },
    recycle: {
      title: "Posts à recycler",
      subtitle: "Posts qui surperforment encore — dupliquez l'angle",
      emptyHint:
        "Après quelques posts publiés, ceux qui valent la peine d'être refaits apparaissent ici.",
      rank: (n) => `#${n}`,
      duplicate: "Dupliquer →",
      engagement: (reactions, rate) =>
        `${reactions} réactions · ${rate}% eng.`,
    },
    performance: {
      title: "Tous vos posts",
      periodThis: "Cette période",
      periodPrevious: "Période précédente",
      periodAria: "Période des posts",
      hiddenScheduled: (n) =>
        `${n} programmé${n > 1 ? "s" : ""} non affiché${n > 1 ? "s" : ""}`,
      postsCount: (n) => `Posts · ${n}`,
      sortBy: (label) => `Trier par ${label}`,
      emptyLoading: "Chargement des vidéos…",
      emptyNoMatch: "Aucun post ne correspond à votre recherche",
      emptyNoPost: "Aucun post sur cette période",
      emptyLongerPeriod:
        "Choisissez une plage plus longue pour voir comment vos posts précédents ont performé.",
      showLast30Days: "Afficher les 30 derniers jours",
      openYouTube: "Ouvrir sur YouTube",
      duplicatePost: "Dupliquer ce post",
      showMore: (n) => `Afficher les ${n} posts`,
      showLess: "Afficher moins de posts",
      columns: {
        reactions: "Réactions",
        comments: "Commentaires",
        engRate: "Taux d'eng.",
        videoViews: "Vues vidéo",
      },
      top: "Top",
    },
    media: {
      video: "vidéo",
      image: "image",
      text: "texte",
    },
    days: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    daysLong: [
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
      "Dimanche",
    ],
    calendar: {
      from: "Du",
      to: "Au",
      helpFrom: "Choisissez le premier jour de la période.",
      helpTo: "Choisissez le dernier jour de la période (aujourd'hui max).",
      next: "Suivant : Au",
      back: "Retour : Du",
      done: "Terminé",
      rangeAria: "Plage de dates personnalisée",
    },
    sheets: {
      channels: "Canaux",
      dateRange: "Plage de dates",
    },
    tagsButton: "Tags",
    allNetworks: "Tous les réseaux",
    demo: {
      tiktok: [
        "Accroche en 3 secondes",
        "Dans les coulisses",
        "Avant / après",
        "Le son qui est resté",
        "Journée dans la file",
      ],
      pinterest: [
        "Moodboard : luxe discret",
        "Le pin qui sauve",
        "Histoire de couleurs",
        "Aménagement d'étagère",
        "Gros plan texture",
      ],
      youtube: [
        "Short : une idée",
        "Coupe l'intro",
        "Ce que je referais",
        "90s de preuve",
        "Le clip restant",
      ],
      default: [
        "Sortie discrète",
        "Celui que les gens ont sauvegardé",
        "Note de studio",
        "Ambition, plus court",
        "Toujours en cours",
      ],
    },
  },
};

/* ============================================================
   STYLE — tokens alignés sur le shell Home (dark plus profond)
============================================================ */

type Tokens = {
  page: string;
  text: string;
  muted: string;
  soft: string;
  card: string;
  panel: string;
  inner: string;
  tile: string;
  border: string;
  head: string;
  primaryBtn: string;
  outlineBtn: string;
  iconBox: string;
  ring: string;
  hover: string;
  sel: string;
  idle: string;
  popover: string;
  tip: string;
};

const tokens = (isDark: boolean): Tokens =>
  isDark
    ? {
        page: "bg-[#050505]",
        text: "text-white",
        muted: "text-neutral-600",
        soft: "text-neutral-400",
        card: "border-white/[0.06] bg-white/[0.02]",
        panel: "border-white/[0.06] bg-white/[0.03]",
        inner: "border-white/[0.05] bg-white/[0.02]",
        tile: "border-white/[0.04] bg-white/[0.045]",
        border: "border-white/[0.05]",
        head: "bg-white/[0.02]",
        primaryBtn: "bg-white text-black hover:bg-neutral-200",
        outlineBtn: "border border-white/10 text-white hover:bg-white/[0.07]",
        iconBox: "bg-white/[0.07] text-neutral-300",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        hover: "hover:bg-white/[0.06]",
        sel: "bg-white text-black",
        idle: "text-neutral-400 hover:text-white",
        popover: "border-white/10 bg-[#101012]",
        tip: "bg-[#2e2e31]",
      }
    : {
        page: "bg-[#f5f3ef]",
        text: "text-neutral-900",
        muted: "text-neutral-400",
        soft: "text-neutral-500",
        card: "border-black/[0.05] bg-neutral-50/70",
        panel: "border-black/[0.05] bg-white",
        inner: "border-black/[0.05] bg-white",
        tile: "border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        border: "border-black/[0.05]",
        head: "bg-neutral-50",
        primaryBtn: "bg-neutral-900 text-white hover:bg-neutral-700",
        outlineBtn:
          "border border-black/10 text-neutral-900 hover:bg-neutral-100",
        iconBox: "bg-neutral-200/70 text-neutral-600",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25",
        hover: "hover:bg-black/[0.04]",
        sel: "bg-neutral-900 text-white",
        idle: "text-neutral-500 hover:text-neutral-900",
        popover: "border-black/10 bg-white",
        tip: "bg-neutral-900",
      };

/* ============================================================
   DATES & FORMAT
============================================================ */

const DAY = 86_400_000;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const toInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const fmt = (d: Date, lang: Lang) =>
  d.toLocaleDateString(intlLocale(lang), { day: "numeric", month: "short" });
const fmtFull = (d: Date, lang: Lang) =>
  d.toLocaleDateString(intlLocale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const fmtRange = (a: Date, b: Date, lang: Lang) =>
  `${fmt(a, lang)} - ${fmtFull(b, lang)}`;
const nf = (n: number, lang: Lang) =>
  (Number.isFinite(n) ? n : 0).toLocaleString(numLocale(lang));

function resolveRange(range: Range, customStart: Date, customEnd: Date) {
  const today = startOfDay(new Date());
  if (range === "7d") return { start: addDays(today, -6), end: today };
  if (range === "30d") return { start: addDays(today, -29), end: today };
  if (range === "mtd")
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: today,
    };

  let s = startOfDay(customStart);
  let e = startOfDay(customEnd);
  if (isNaN(s.getTime())) s = addDays(today, -29);
  if (isNaN(e.getTime())) e = today;
  if (s > e) [s, e] = [e, s];
  if (e > today) e = today;
  if (s > e) s = e;
  if ((e.getTime() - s.getTime()) / DAY > 365) s = addDays(e, -365);
  return { start: s, end: e };
}

function nextDateForSlot(dayIdxMon: number, hour: number): Date {
  const now = new Date();
  const today = startOfDay(now);
  const todayIdx = (today.getDay() + 6) % 7;
  const slotHour = hour;
  let delta = (dayIdxMon - todayIdx + 7) % 7;
  if (delta === 0 && now.getHours() >= slotHour) delta = 7;
  const date = addDays(today, delta);
  date.setHours(slotHour, 0, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 7);
  return date;
}

/* ============================================================
   CANAUX
============================================================ */

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

function isYouTubeChannel(c?: ConnectedChannel): boolean {
  if (!c) return false;
  return c.platform === "youtube" || c.key.toLowerCase().startsWith("youtube");
}

const channelLabel = (ch: ConnectedChannel) =>
  (ch.handle || ch.name || "Channel").replace(/^@/, "");

type NetIcon = (props: { className?: string }) => ReactNode;

const NETWORK_ICONS: Record<string, NetIcon> = {
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
};

function channelNetwork(ch: ConnectedChannel): string | null {
  const raw = String(ch.platform ?? ch.key).toLowerCase().trim();
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
   POSTS PROGRAMMÉS
============================================================ */

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

type ScheduledEntry = { ids: ReadonlySet<string>; at: number };

const scheduledCache = new Map<string, ScheduledEntry>();
const SCHEDULED_FRESH_MS = 2 * 60_000;
const SCHEDULED_TIMEOUT_MS = 10_000;

function useScheduledVideoIds(
  channelKey: string | undefined,
  enabled: boolean,
  reloadKey: number
): { ids: ReadonlySet<string>; ready: boolean } {
  const active = enabled && Boolean(channelKey);

  const [ids, setIds] = useState<ReadonlySet<string>>(() =>
    active && channelKey
      ? scheduledCache.get(channelKey)?.ids ?? EMPTY_IDS
      : EMPTY_IDS
  );
  const [ready, setReady] = useState<boolean>(
    () => !active || (channelKey ? scheduledCache.has(channelKey) : true)
  );
  const lastReloadRef = useRef(reloadKey);

  useEffect(() => {
    const forceReload = reloadKey !== lastReloadRef.current;
    lastReloadRef.current = reloadKey;

    if (!active || !channelKey) {
      setIds(EMPTY_IDS);
      setReady(true);
      return;
    }

    const key = channelKey;
    const cached = scheduledCache.get(key);

    if (cached) {
      setIds(cached.ids);
      setReady(true);
    } else {
      setIds(EMPTY_IDS);
      setReady(false);
    }

    const stale = !cached || Date.now() - cached.at >= SCHEDULED_FRESH_MS;
    if (!forceReload && !stale) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    fetchYouTubeVideos()
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r?.videos) ? r.videos : [];
        const next = new Set<string>(
          list
            .filter((v) => (v as { status?: string }).status === "scheduled")
            .map((v) => v.id)
        );
        scheduledCache.set(key, { ids: next, at: Date.now() });
        setIds(next);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });

    timer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, SCHEDULED_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, channelKey, reloadKey]);

  return { ids, ready };
}

function dropFromPoints(points: Point[], dropped: PostRow[]): Point[] {
  if (dropped.length === 0) return points;
  const perDay = new Map<number, number>();
  for (const p of dropped) {
    const k = startOfDay(p.date).getTime();
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  return points.map((pt) => {
    const n = perDay.get(startOfDay(pt.date).getTime());
    return n ? { ...pt, posts: Math.max(0, pt.posts - n) } : pt;
  });
}

function withoutScheduled(
  data: InsightsData,
  scheduledIds: ReadonlySet<string>
): { data: InsightsData; skipped: { current: number; previous: number } } {
  const isScheduled = (p: PostRow) =>
    p.status === "scheduled" || scheduledIds.has(p.id);

  const droppedCurrent = data.posts.filter(isScheduled);
  const droppedPrevious = data.previousPosts.filter(isScheduled);

  if (droppedCurrent.length === 0 && droppedPrevious.length === 0) {
    return { data, skipped: { current: 0, previous: 0 } };
  }

  return {
    data: {
      current: dropFromPoints(data.current, droppedCurrent),
      previous: dropFromPoints(data.previous, droppedPrevious),
      summary: {
        ...data.summary,
        posts: Math.max(0, data.summary.posts - droppedCurrent.length),
      },
      posts: data.posts.filter((p) => !isScheduled(p)),
      previousPosts: data.previousPosts.filter((p) => !isScheduled(p)),
    },
    skipped: {
      current: droppedCurrent.length,
      previous: droppedPrevious.length,
    },
  };
}

/* ============================================================
   DONNÉES D'EXEMPLE
============================================================ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++)
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

function emptyInsights(start: Date, end: Date): InsightsData {
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / DAY) + 1
  );
  const build = (from: Date): Point[] =>
    Array.from({ length: days }, (_, i) => ({
      date: addDays(from, i),
      posts: 0,
      reactions: 0,
      comments: 0,
      followers: 0,
      profileViews: 0,
    }));
  return {
    current: build(start),
    previous: build(addDays(start, -days)),
    summary: {
      followers: 0,
      posts: 0,
      reactions: 0,
      comments: 0,
      engRate: 0,
      videoViews: 0,
      shares: 0,
      reach: 0,
      watchMin: 0,
      avgWatchSec: 0,
    },
    posts: [],
    previousPosts: [],
  };
}

function ratePct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 10_000) / 100 : 0;
}

function buildSampleInsights(
  start: Date,
  end: Date,
  platform: string,
  lang: Lang
): InsightsData {
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / DAY) + 1
  );
  const rnd = mulberry32(seedFrom(`${platform}:${toInput(start)}:${days}`));
  const demos = COPY[lang].demo;
  const titles =
    (demos as Record<string, string[]>)[platform] ?? demos.default;
  const mediaCycle: PostRow["media"][] = [
    "video",
    "image",
    "video",
    "text",
    "image",
  ];
  const peakHour =
    platform === "tiktok" ? 19 : platform === "pinterest" ? 10 : 18;

  const makePoints = (from: Date, scale: number): Point[] => {
    let followers = 800 + Math.floor(rnd() * 4200);
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      const dow = date.getDay();
      const weekend = dow === 0 || dow === 6;
      const posts =
        rnd() > (weekend ? 0.72 : 0.55) ? 1 : rnd() > 0.92 ? 2 : 0;
      const reactions = Math.round((12 + rnd() * 90) * (posts + 0.15) * scale);
      const comments = Math.round(reactions * (0.08 + rnd() * 0.12));
      followers += Math.round((rnd() - 0.42) * 18 * scale);
      return {
        date,
        posts,
        reactions,
        comments,
        followers: Math.max(120, followers),
        profileViews: Math.round(reactions * (3.2 + rnd()) * scale),
      };
    });
  };

  const current = makePoints(start, 1);
  const previous = makePoints(addDays(start, -days), 0.82);
  const posts: PostRow[] = [];

  current.forEach((pt, i) => {
    for (let n = 0; n < pt.posts; n++) {
      const hour =
        (peakHour + Math.floor(rnd() * 5) - 1 + (n === 1 ? 4 : 0) + 24) % 24;
      const date = new Date(pt.date);
      date.setHours(hour, Math.floor(rnd() * 50), 0, 0);
      const reactions = Math.max(
        4,
        Math.round((pt.reactions / Math.max(1, pt.posts)) * (0.6 + rnd()))
      );
      const comments = Math.max(
        0,
        Math.round(reactions * (0.06 + rnd() * 0.14))
      );
      const videoViews = Math.round(reactions * (18 + rnd() * 40));
      const media = mediaCycle[(i + n) % mediaCycle.length];
      posts.push({
        id: `${platform}-${toInput(pt.date)}-${n}`,
        label: titles[(i + n) % titles.length],
        date,
        media,
        reactions,
        comments,
        engRate: ratePct(reactions + comments, videoViews),
        videoViews,
        platform,
      });
    }
  });

  const sumR = current.reduce((a, p) => a + p.reactions, 0);
  const sumC = current.reduce((a, p) => a + p.comments, 0);
  const views = posts.reduce((a, p) => a + p.videoViews, 0);

  return {
    current,
    previous,
    summary: {
      followers: current[days - 1]?.followers ?? 0,
      posts: posts.length,
      reactions: sumR,
      comments: sumC,
      engRate: ratePct(
        sumR + sumC,
        views || current.reduce((a, p) => a + p.profileViews, 0)
      ),
      videoViews: views,
      shares: Math.round(sumC * 0.7),
      reach: current.reduce((a, p) => a + p.profileViews, 0),
      watchMin: Math.round(views / 12),
      avgWatchSec: 18 + Math.round(rnd() * 22),
    },
    posts: posts.sort((a, b) => +b.date - +a.date),
    previousPosts: [],
  };
}

function mergeInsights(parts: InsightsData[]): InsightsData {
  if (parts.length === 0)
    return emptyInsights(startOfDay(new Date()), startOfDay(new Date()));
  if (parts.length === 1) return parts[0];
  const current = parts[0].current.map((pt, i) => ({
    date: pt.date,
    posts: parts.reduce((a, p) => a + (p.current[i]?.posts ?? 0), 0),
    reactions: parts.reduce((a, p) => a + (p.current[i]?.reactions ?? 0), 0),
    comments: parts.reduce((a, p) => a + (p.current[i]?.comments ?? 0), 0),
    followers: parts.reduce((a, p) => a + (p.current[i]?.followers ?? 0), 0),
    profileViews: parts.reduce(
      (a, p) => a + (p.current[i]?.profileViews ?? 0),
      0
    ),
  }));
  const previous = parts[0].previous.map((pt, i) => ({
    date: pt.date,
    posts: parts.reduce((a, p) => a + (p.previous[i]?.posts ?? 0), 0),
    reactions: parts.reduce((a, p) => a + (p.previous[i]?.reactions ?? 0), 0),
    comments: parts.reduce((a, p) => a + (p.previous[i]?.comments ?? 0), 0),
    followers: parts.reduce((a, p) => a + (p.previous[i]?.followers ?? 0), 0),
    profileViews: parts.reduce(
      (a, p) => a + (p.previous[i]?.profileViews ?? 0),
      0
    ),
  }));
  const posts = parts.flatMap((p) => p.posts).sort((a, b) => +b.date - +a.date);
  const previousPosts = parts.flatMap((p) => p.previousPosts);
  const sum = (key: keyof Summary) =>
    parts.reduce((a, p) => a + p.summary[key], 0);
  const reactions = sum("reactions");
  const comments = sum("comments");
  const videoViews = sum("videoViews");
  return {
    current,
    previous,
    posts,
    previousPosts,
    summary: {
      followers: sum("followers"),
      posts: posts.length,
      reactions,
      comments,
      engRate: ratePct(reactions + comments, videoViews || sum("reach")),
      videoViews,
      shares: sum("shares"),
      reach: sum("reach"),
      watchMin: sum("watchMin"),
      avgWatchSec: Math.round(sum("avgWatchSec") / parts.length),
    },
  };
}

function dayIndexMon(d: Date) {
  return (d.getDay() + 6) % 7;
}

function postScore(p: PostRow) {
  return p.reactions + p.comments * 2.4 + p.videoViews * 0.02;
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/* ── Best time to post ────────────────────────────────────── */

type Peak = [hour: number, weight: number, spread: number];
type Curve = { weekday: Peak[]; weekend: Peak[] };

const BASELINE: Record<string, Curve> = {
  default: {
    weekday: [
      [8, 0.4, 1.5],
      [12.5, 0.5, 1.5],
      [19, 0.9, 2],
    ],
    weekend: [
      [10.5, 0.6, 2],
      [19.5, 0.8, 2.5],
    ],
  },
  youtube: {
    weekday: [
      [12, 0.35, 1.5],
      [16.5, 0.8, 2],
      [20, 0.6, 2],
    ],
    weekend: [
      [10, 0.7, 2],
      [17, 0.6, 2.5],
    ],
  },
  tiktok: {
    weekday: [
      [12.5, 0.4, 1.5],
      [19.5, 0.9, 2],
      [22, 0.5, 1.5],
    ],
    weekend: [
      [11, 0.5, 2],
      [20, 0.8, 2.5],
    ],
  },
  instagram: {
    weekday: [
      [8, 0.3, 1.2],
      [12, 0.6, 1.5],
      [19, 0.8, 2],
    ],
    weekend: [
      [10, 0.6, 2],
      [19, 0.6, 2.5],
    ],
  },
  pinterest: {
    weekday: [
      [14, 0.4, 2],
      [20.5, 0.8, 2],
    ],
    weekend: [
      [11, 0.5, 2],
      [15, 0.5, 2],
      [21, 0.7, 2],
    ],
  },
  linkedin: {
    weekday: [
      [8, 0.7, 1.2],
      [12, 0.6, 1.3],
      [17.5, 0.5, 1.5],
    ],
    weekend: [[10, 0.2, 2]],
  },
  facebook: {
    weekday: [
      [9, 0.4, 1.5],
      [13, 0.6, 2],
      [19, 0.6, 2],
    ],
    weekend: [
      [10, 0.6, 2],
      [14, 0.4, 2],
    ],
  },
};

function priorLift(platform: string, dayIdx: number, hour: number): number {
  const curve = BASELINE[platform] ?? BASELINE.default;
  const peaks = dayIdx >= 5 ? curve.weekend : curve.weekday;
  let v = 0.3;
  for (const [h, w, s] of peaks) {
    const raw = Math.abs(hour - h);
    const d = Math.min(raw, 24 - raw);
    v += w * Math.exp(-(d * d) / (2 * s * s));
  }
  return v;
}

const PRIOR_STRENGTH = 2.5;
const HOUR_KERNEL = [1, 0.5, 0.2];
const CROSS_DAY_SHARE = 0.15;

type BestTimes = {
  grid: { value: number; norm: number; count: number }[][];
  bestByDay: { day: number; hour: number }[];
  best: { day: number; hour: number };
  label: string;
  sample: number;
  confidence: "baseline" | "early" | "solid";
};

function buildBestTimes(
  posts: PostRow[],
  platform: string,
  lang: Lang
): BestTimes {
  const n = posts.length;
  const scores = posts.map(postScore).sort((a, b) => a - b);
  const median = n ? scores[Math.floor(n / 2)] : 0;
  const mean = n ? scores.reduce((a, s) => a + s, 0) / n : 0;
  const ref = median > 0 ? median : mean > 0 ? mean : 1;

  const mk = () => Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const sum = mk();
  const wt = mk();
  const raw = mk();

  for (const p of posts) {
    const d = dayIndexMon(p.date);
    const h = p.date.getHours();
    const lift = Math.min(4, postScore(p) / ref);
    raw[d][h] += 1;
    HOUR_KERNEL.forEach((w, o) => {
      const offsets = o === 0 ? [0] : [-o, o];
      for (const off of offsets) {
        const hh = (h + off + 24) % 24;
        sum[d][hh] += lift * w;
        wt[d][hh] += w;
      }
    });
  }

  const hourSum = new Array<number>(24).fill(0);
  const hourWt = new Array<number>(24).fill(0);
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      hourSum[h] += sum[d][h];
      hourWt[h] += wt[d][h];
    }
  }

  let min = Infinity;
  let max = -Infinity;
  const values = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const s = sum[d][h] + CROSS_DAY_SHARE * (hourSum[h] - sum[d][h]);
      const c = wt[d][h] + CROSS_DAY_SHARE * (hourWt[h] - wt[d][h]);
      const v =
        (PRIOR_STRENGTH * priorLift(platform, d, h) + s) /
        (PRIOR_STRENGTH + c);
      if (v < min) min = v;
      if (v > max) max = v;
      return v;
    })
  );

  const span = max - min || 1;
  const grid = values.map((row, d) =>
    row.map((value, h) => ({
      value,
      norm: (value - min) / span,
      count: raw[d][h],
    }))
  );

  const days = COPY[lang].days;
  const bestByDay = grid.map((row, day) => {
    let hour = 0;
    row.forEach((cell, h) => {
      if (cell.value > row[hour].value) hour = h;
    });
    return { day, hour };
  });
  const best = bestByDay.reduce((a, b) =>
    grid[b.day][b.hour].value > grid[a.day][a.hour].value ? b : a
  );

  return {
    grid,
    bestByDay,
    best,
    label: `${days[best.day]} ${hourLabel(best.hour)}`,
    sample: n,
    confidence: n < 5 ? "baseline" : n < 15 ? "early" : "solid",
  };
}

const heatColor = (v: number) =>
  `hsla(320, 85%, ${72 - 20 * v}%, ${0.1 + 0.9 * v})`;

/** Couleur de chaleur posée par-dessus la couleur de fond de la classe. */
const heatLayer = (v: number) => {
  const c = heatColor(v);
  return { backgroundImage: `linear-gradient(${c}, ${c})` };
};

function pctDelta(now: number, prev: number) {
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return null;
  if (now === 0 && prev === 0) return null;
  if (prev === 0) return 100;
  return Math.round(((now - prev) / Math.abs(prev)) * 100);
}

/* ============================================================
   EXPORT CSV
============================================================ */

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   CHART — Recharts
============================================================ */

type TooltipRow = {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: ChartRow;
};

function ChartTooltip({
  active,
  payload,
  isDark,
  lang,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipRow>;
  isDark: boolean;
  lang: Lang;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      className={`min-w-[140px] max-w-[calc(100vw-48px)] rounded-lg px-3 py-2 text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.35)] md:min-w-[160px] md:px-3.5 md:py-2.5 ${
        isDark
          ? "bg-[#101012] text-white ring-1 ring-white/10"
          : "bg-white text-neutral-900 ring-1 ring-black/10"
      }`}
    >
      <div className="mb-1 text-[11px] opacity-50">{row.fullDate}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-5">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: p.color }}
              aria-hidden="true"
            />
            {p.name}
          </span>
          <b className="tabular-nums">{nf(Number(p.value) || 0, lang)}</b>
        </div>
      ))}
    </div>
  );
}

function InsightsChart({
  data,
  view,
  isDark,
  isMobile,
  lang,
  seriesLabel,
  seriesLabel2,
  seriesColor,
  seriesColor2,
  hasSecondAxis,
}: {
  data: ChartRow[];
  view: ChartView;
  isDark: boolean;
  isMobile: boolean;
  lang: Lang;
  seriesLabel: string;
  seriesLabel2?: string;
  seriesColor: string;
  seriesColor2?: string;
  hasSecondAxis: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const gradLeft = `gradLeft-${uid}`;
  const gradRight = `gradRight-${uid}`;
  const c = COPY[lang];

  const showThis = view === "this" || view === "both";
  const showPrev = view === "comparison" || view === "both";

  const axis = isDark ? "#6b6b72" : "#a3a3a3";
  const grid = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const axisWidth = isMobile ? 34 : 40;

  return (
    <div className="h-[220px] w-full md:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 12,
            right: hasSecondAxis ? 40 : 8,
            left: 0,
            bottom: 0,
          }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id={gradLeft} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor} stopOpacity={0.22} />
              <stop offset="100%" stopColor={seriesColor} stopOpacity={0} />
            </linearGradient>
            {hasSecondAxis && seriesColor2 && (
              <linearGradient id={gradRight} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={seriesColor2} stopOpacity={0.14} />
                <stop offset="100%" stopColor={seriesColor2} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>

          <CartesianGrid stroke={grid} vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fill: axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={isMobile ? 36 : 24}
          />

          <YAxis
            yAxisId="left"
            tick={{ fill: axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => nf(Number(v), lang)}
            width={axisWidth}
          />
          {hasSecondAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => nf(Number(v), lang)}
              width={axisWidth}
            />
          )}

          <Tooltip
            cursor={{ stroke: axis, strokeOpacity: 0.6, strokeDasharray: "3 3" }}
            content={<ChartTooltip isDark={isDark} lang={lang} />}
          />

          {showPrev && (
            <>
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="left_prev"
                stroke={seriesColor}
                strokeOpacity={0.5}
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
                name={`${seriesLabel} ${c.trends.prevSuffix}`}
                isAnimationActive={false}
              />
              {hasSecondAxis && seriesColor2 && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="right_prev"
                  stroke={seriesColor2}
                  strokeOpacity={0.5}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name={`${seriesLabel2} ${c.trends.prevSuffix}`}
                  isAnimationActive={false}
                />
              )}
            </>
          )}

          {showThis && (
            <>
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="left_this"
                stroke={seriesColor}
                strokeWidth={2.5}
                fill={`url(#${gradLeft})`}
                name={seriesLabel}
                isAnimationActive={false}
              />
              {hasSecondAxis && seriesColor2 && (
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="right_this"
                  stroke={seriesColor2}
                  strokeWidth={2.5}
                  fill={`url(#${gradRight})`}
                  name={seriesLabel2}
                  isAnimationActive={false}
                />
              )}
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============================================================
   FEUILLE GLISSABLE (mobile) — identique à Schedule / Create
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
 * Feuille glissable (mobile) / dialogue centré (si la fenêtre est élargie).
 * Glisser la poignée ou le titre vers le bas pour fermer.
 * `children` reçoit `close` : fermeture animée.
 * Rendue dans document.body (portail) : échappe aux overflow / z-index.
 */
function BottomSheet({
  isDark,
  title,
  onClose,
  children,
}: {
  isDark: boolean;
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

  const onDragStart = (e: RPointerEvent<HTMLDivElement>) => {
    if (closing) return;
    drag.current = { startY: e.clientY, startT: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onDragMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setDragY(Math.max(0, e.clientY - d.startY));
  };

  const onDragEnd = (e: RPointerEvent<HTMLDivElement>) => {
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

  return createPortal(
    <div
      // Les événements React remontent à travers les portails : on les arrête.
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
    >
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
        style={{
          transform: hidden ? "translateY(100%)" : `translateY(${dragY}px)`,
          transition: dragging ? "none" : `transform 300ms ${ease}`,
          willChange: "transform",
        }}
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
              isDark ? "text-white" : "text-neutral-900",
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
    <BottomSheet isDark={isDark} title={title} onClose={onClose}>
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

/** Avatar de canal avec pastille du réseau. */
function ChannelAvatar({
  channel,
  isDark,
  size = 32,
  ringClass,
}: {
  channel: ConnectedChannel;
  isDark: boolean;
  size?: number;
  ringClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [channel.avatarUrl]);

  const net = channelNetwork(channel);
  const Icon = net ? NETWORK_ICONS[net] : null;
  const badge = Math.max(12, Math.round(size * 0.45));

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {channel.avatarUrl && !failed ? (
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
            "flex h-full w-full items-center justify-center rounded-full text-[12px] font-semibold",
            isDark ? "bg-[#242428] text-white" : "bg-neutral-900 text-white",
          ].join(" ")}
        >
          {channelLabel(channel).charAt(0).toUpperCase() || "?"}
        </span>
      )}
      {Icon && (
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white text-black ring-2",
            ringClass ?? (isDark ? "ring-[#101012]" : "ring-[#f6f4f0]"),
          ].join(" ")}
          style={{ width: badge, height: badge }}
        >
          <Icon className="h-[8px] w-[8px]" />
        </span>
      )}
    </span>
  );
}

/** Pastille « tous les réseaux ». */
function AllNetworksBadge({
  isDark,
  size = 32,
}: {
  isDark: boolean;
  size?: number;
}) {
  return (
    <span
      className={[
        "flex shrink-0 items-center justify-center rounded-full",
        isDark ? "bg-white/[0.1] text-white" : "bg-neutral-900 text-white",
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      <Layers className="h-[55%] w-[55%]" aria-hidden="true" />
    </span>
  );
}

/** Sélecteur de canal en feuille glissable (mobile), avec « tous les réseaux ». */
function ChannelSheet({
  isDark,
  title,
  channels,
  selectedKey,
  allLabel,
  onSelect,
  onClose,
}: {
  isDark: boolean;
  title: string;
  channels: ConnectedChannel[];
  selectedKey?: string;
  allLabel?: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const row = (active: boolean) =>
    [
      "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition",
      "focus-visible:outline-none focus-visible:ring-2",
      isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25",
      active
        ? isDark
          ? "bg-white/[0.08]"
          : "bg-white shadow-sm"
        : isDark
          ? "active:bg-white/[0.06]"
          : "active:bg-black/[0.04]",
    ].join(" ");

  const titleCls = [
    "block truncate text-[15px] font-semibold",
    isDark ? "text-white" : "text-neutral-900",
  ].join(" ");
  const subCls = [
    "block truncate text-[12.5px]",
    isDark ? "text-neutral-400" : "text-neutral-500",
  ].join(" ");
  const check = (
    <Check
      className={[
        "h-5 w-5 shrink-0",
        isDark ? "text-white" : "text-neutral-900",
      ].join(" ")}
      strokeWidth={2.2}
    />
  );

  return (
    <BottomSheet isDark={isDark} title={title} onClose={onClose}>
      {(close) => (
        <ul role="menu" className="flex flex-col gap-1 pt-1">
          {allLabel && (
            <li>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selectedKey === ALL_KEY}
                onClick={() => {
                  onSelect(ALL_KEY);
                  close();
                }}
                className={row(selectedKey === ALL_KEY)}
              >
                <AllNetworksBadge isDark={isDark} size={38} />
                <span className="min-w-0 flex-1">
                  <span className={titleCls}>{allLabel}</span>
                </span>
                {selectedKey === ALL_KEY && check}
              </button>
            </li>
          )}
          {channels.map((ch) => {
            const active = ch.key === selectedKey;
            const name = ch.name || channelLabel(ch);
            const handle = ch.handle ? ch.handle.replace(/^@/, "") : "";
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
                  className={row(active)}
                >
                  <ChannelAvatar channel={ch} isDark={isDark} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className={titleCls}>{name}</span>
                    {handle && handle !== name && (
                      <span className={subCls}>@{handle}</span>
                    )}
                  </span>
                  {active && check}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}

/* ============================================================
   PETITS COMPOSANTS
============================================================ */

function Segmented<T extends string>({
  value,
  options,
  onChange,
  t,
  label,
  size = "md",
}: {
  value: T;
  options: { key: T; label: string; icon?: ReactNode; trailing?: ReactNode }[];
  onChange: (k: T) => void;
  t: Tokens;
  label: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto rounded-full border p-1 ${NO_SCROLLBAR} ${t.panel}`}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 md:px-3.5 ${
              size === "lg"
                ? "py-2 text-[12px] md:text-[13px]"
                : "py-2 text-[12px] md:py-1.5"
            } font-semibold transition-colors motion-reduce:transition-none ${t.ring} ${
              active ? t.sel : t.idle
            }`}
          >
            {o.icon}
            {o.label}
            {o.trailing}
          </button>
        );
      })}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  href,
  children,
  t,
  boxed = false,
  align = "center",
  disabled = false,
  className = "h-10 w-10 md:h-9 md:w-9",
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
  t: Tokens;
  boxed?: boolean;
  align?: "center" | "end";
  disabled?: boolean;
  className?: string;
}) {
  const cls = [
    "flex shrink-0 items-center justify-center rounded-lg transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40",
    t.ring,
    t.soft,
    boxed ? `border ${t.inner} ${t.hover}` : t.hover,
    className,
  ].join(" ");

  return (
    <span className="group relative inline-flex shrink-0">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={cls}
        >
          {children}
        </a>
      ) : (
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className={cls}
        >
          {children}
        </button>
      )}

      {/* Tooltip : survol uniquement (masqué sur tactile / mobile) */}
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[240px] rounded-md px-3 py-2 text-[12.5px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none max-md:hidden group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100 [@media(hover:none)]:hidden",
          t.tip,
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}

function MetricBox({
  label,
  value,
  info,
  t,
  delta,
  isDark,
  isMobile,
  lang,
}: {
  label: string;
  value: string;
  info: string;
  t: Tokens;
  delta?: number | null;
  isDark: boolean;
  isMobile: boolean;
  lang: Lang;
}) {
  const c = COPY[lang];
  const [hint, setHint] = useState(false);
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <div
      className={`flex h-full min-w-0 flex-col gap-2 rounded-2xl border px-3.5 py-3.5 md:gap-2.5 md:px-4 md:py-4 ${t.tile}`}
    >
      <span
        className={`flex items-center justify-between gap-2 text-[12px] font-medium md:text-[11px] ${t.soft}`}
      >
        <span className="truncate">{label}</span>
        <button
          type="button"
          aria-label={info}
          title={isMobile ? undefined : info}
          onClick={() => {
            if (isMobile) setHint(true);
          }}
          className={`-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:-mr-0.5 md:h-6 md:w-6 ${t.muted} ${t.ring}`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </span>
      <span
        className={`text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums md:text-[30px] ${t.text}`}
      >
        {value}
      </span>
      {delta != null && (
        <span
          className={[
            "inline-flex w-fit max-w-full items-center gap-0.5 rounded-full px-1.5 py-0.5",
            "text-[10px] font-semibold tabular-nums md:text-[9px]",
            up
              ? isDark
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-emerald-500/10 text-emerald-600"
              : down
                ? isDark
                  ? "bg-rose-500/10 text-rose-400"
                  : "bg-rose-500/10 text-rose-600"
                : t.muted,
          ].join(" ")}
        >
          {up ? (
            <TrendingUp className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          ) : down ? (
            <TrendingDown className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          ) : null}
          <span className="sr-only">{up ? "↑ " : down ? "↓ " : ""}</span>
          {up ? "+" : ""}
          {delta}%<span className="max-md:sr-only"> {c.summary.vsPreviousShort}</span>
        </span>
      )}

      {hint && isMobile && (
        <HintSheet
          isDark={isDark}
          title={label}
          text={info}
          onClose={() => setHint(false)}
        />
      )}
    </div>
  );
}

type MetricOption = {
  key: NumKey;
  label: string;
  icon: ReactNode;
  agg: "sum" | "last";
};

/* ============================================================
   RANGE PICKER — popover (desktop) / feuille glissable (mobile)
============================================================ */

function RangePicker({
  range,
  start,
  end,
  onStartChange,
  onEndChange,
  t,
  isDark,
  isMobile,
  lang,
}: {
  range: Range;
  start: Date;
  end: Date;
  onStartChange: (d: Date) => void;
  onEndChange: (d: Date) => void;
  t: Tokens;
  isDark: boolean;
  isMobile: boolean;
  lang: Lang;
}) {
  const c = COPY[lang];
  const [field, setField] = useState<"from" | "to">("from");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Desktop : fermeture au clic extérieur / Échap. Sur mobile, la feuille
  // (portail) gère sa propre fermeture.
  useEffect(() => {
    if (!open || isMobile) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  const label =
    range === "custom"
      ? `${fmt(start, lang)} – ${fmt(end, lang)}`
      : c.ranges[range];

  const pickDate = (d: Date) => {
    if (field === "from") {
      onStartChange(d);
      if (startOfDay(d).getTime() > startOfDay(end).getTime()) onEndChange(d);
      setField("to");
    } else {
      onEndChange(d);
      if (startOfDay(d).getTime() < startOfDay(start).getTime()) {
        onStartChange(d);
        setField("from");
      }
    }
  };

  const openPicker = (nextField: "from" | "to") => {
    setField(nextField);
    setOpen(true);
  };

  const fieldTab = (id: "from" | "to") => {
    const active = open && field === id;
    const value = id === "from" ? start : end;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={active}
        onClick={() => setField(id)}
        className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors motion-reduce:transition-none md:min-h-0 md:text-[11px] ${t.ring} ${
          active ? t.sel : t.idle
        }`}
      >
        {id === "from" ? c.calendar.from : c.calendar.to} · {fmt(value, lang)}
      </button>
    );
  };

  const panel = (done: () => void) => (
    <>
      <div className={`flex gap-1 border-b p-2 ${t.border}`}>
        {fieldTab("from")}
        {fieldTab("to")}
      </div>

      <div className="p-3">
        <p className={`mb-2 text-[12px] ${t.soft}`}>
          {field === "from" ? c.calendar.helpFrom : c.calendar.helpTo}
        </p>
        <CalendarPicker
          key={field}
          value={field === "from" ? start : end}
          onChange={pickDate}
          isDark={isDark}
          disablePast={false}
          max={today}
          min={field === "to" ? startOfDay(start) : undefined}
        />
      </div>

      <div
        className={`flex items-center justify-between border-t px-3 py-2.5 ${t.border}`}
      >
        <button
          type="button"
          onClick={() => setField((f) => (f === "from" ? "to" : "from"))}
          className={`min-h-10 rounded px-2 text-[13px] font-semibold transition-colors md:min-h-0 md:px-1 md:text-[12px] ${t.ring} ${t.hover} ${t.text}`}
        >
          {field === "from" ? c.calendar.next : c.calendar.back}
        </button>
        <button
          type="button"
          onClick={done}
          className={`flex min-h-10 items-center gap-1.5 rounded px-2 text-[13px] font-semibold transition-colors md:min-h-0 md:px-1 md:text-[12px] ${t.ring} ${t.hover} ${t.text}`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
          {c.calendar.done}
        </button>
      </div>
    </>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup={isMobile ? "dialog" : "menu"}
        aria-expanded={open}
        aria-label={c.calendar.rangeAria}
        onClick={() => (open ? setOpen(false) : openPicker("from"))}
        className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors md:min-h-0 ${t.ring} ${t.panel} ${t.hover} ${t.text}`}
      >
        <CalendarClock className={`h-3.5 w-3.5 ${t.muted}`} aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          } ${t.muted}`}
          aria-hidden="true"
        />
      </button>

      {open && isMobile && (
        <BottomSheet
          isDark={isDark}
          title={c.sheets.dateRange}
          onClose={() => setOpen(false)}
        >
          {(close) => (
            <div
              className={`overflow-hidden rounded-2xl border ${t.panel}`}
            >
              {panel(close)}
            </div>
          )}
        </BottomSheet>
      )}

      {open && !isMobile && (
        <div
          className={`absolute left-0 top-full z-30 mt-2 w-[300px] overflow-hidden rounded-xl border shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${t.popover}`}
        >
          {panel(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function InsightsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

/* ============================================================
   MEILLEUR MOMENT — version mobile
   7 lignes (une par jour) : bande de chaleur + meilleure heure.
   Un tap ouvre les 24 heures en grandes cases tactiles.
============================================================ */

function BestTimeMobile({
  heatmap,
  c,
  t,
  isDark,
  onSchedule,
}: {
  heatmap: BestTimes;
  c: Copy;
  t: Tokens;
  isDark: boolean;
  onSchedule: (slot: { day: number; hour: number }) => void;
}) {
  const [openDay, setOpenDay] = useState<number | null>(null);
  const base = isDark ? "bg-white/[0.05]" : "bg-black/[0.04]";

  return (
    <>
      <div className="mt-4 flex flex-col gap-1.5">
        {c.days.map((day, d) => {
          const best = heatmap.bestByDay[d];
          return (
            <button
              key={day}
              type="button"
              onClick={() => setOpenDay(d)}
              aria-label={`${c.daysLong[d]} · ${hourLabel(best.hour)}`}
              className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 text-left transition-colors ${t.ring} ${t.inner} ${t.hover}`}
            >
              <span
                className={`w-9 shrink-0 text-[12px] font-semibold ${t.soft}`}
              >
                {day}
              </span>
              <span
                className={`flex h-6 min-w-0 flex-1 items-stretch gap-px overflow-hidden rounded-md ${base}`}
                aria-hidden="true"
              >
                {heatmap.grid[d].map((cell, h) => (
                  <span
                    key={h}
                    className="flex-1"
                    style={heatLayer(cell.norm)}
                  />
                ))}
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${t.sel}`}
              >
                {hourLabel(best.hour)}
              </span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 ${t.muted}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      {openDay !== null && (
        <BottomSheet
          isDark={isDark}
          title={c.daysLong[openDay]}
          onClose={() => setOpenDay(null)}
        >
          {(close) => {
            const d = openDay;
            const bestHour = heatmap.bestByDay[d].hour;
            return (
              <div className="flex flex-col gap-3 pt-1">
                <p className={`text-center text-[13px] ${t.soft}`}>
                  {c.bestTime.bestOfDay} ·{" "}
                  <span className={`font-semibold ${t.text}`}>
                    {hourLabel(bestHour)}
                  </span>
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = heatmap.grid[d][h];
                    const isBest = h === bestHour;
                    return (
                      <button
                        key={h}
                        type="button"
                        aria-label={c.bestTime.scheduleAria(
                          c.daysLong[d],
                          hourLabel(h)
                        )}
                        onClick={() => {
                          close();
                          window.setTimeout(
                            () => onSchedule({ day: d, hour: h }),
                            SHEET_ACTION_DELAY
                          );
                        }}
                        className={`flex aspect-[4/3] min-h-11 items-center justify-center rounded-xl text-[13px] font-semibold tabular-nums transition-transform active:scale-95 ${t.ring} ${base} ${
                          cell.norm > 0.5 ? "text-white" : t.soft
                        } ${
                          isBest
                            ? `ring-2 ring-offset-2 ${
                                isDark
                                  ? "ring-white ring-offset-[#101012]"
                                  : "ring-neutral-900 ring-offset-[#f6f4f0]"
                              }`
                            : ""
                        }`}
                        style={heatLayer(cell.norm)}
                      >
                        {String(h).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
                <p className={`text-center text-[12px] ${t.muted}`}>
                  {c.bestTime.pickHour}
                </p>
              </div>
            );
          }}
        </BottomSheet>
      )}
    </>
  );
}

/* ============================================================
   PAGE
============================================================ */

/** Tableau des posts : cartes sous md, grille 6 colonnes dès md. */
const TABLE_GRID = "md:grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_1fr_44px]";
const HEAT_COLS = "grid-cols-[repeat(24,minmax(0,1fr))]";

export default function Insights() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = useMemo(() => tokens(isDark), [isDark]);
  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();
  const isMobile = useIsMobile();

  const lang = useLanguage();
  const c = COPY[lang];

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const hashChannel = useHashChannel();
  const [selectedKey, setSelectedKey] = useState<string | null>(hashChannel);

  useEffect(() => {
    if (hashChannel) setSelectedKey(hashChannel);
  }, [hashChannel]);

  const viewingAll =
    selectedKey === ALL_KEY || (selectedKey == null && channels.length > 1);
  const channel = viewingAll
    ? undefined
    : channels.find((ch) => ch.key === selectedKey) ??
      channels.find((ch) => isYouTubeChannel(ch)) ??
      channels[0];
  const youtubeConnected = channels.some(isYouTubeChannel);
  const isYouTube = Boolean(channel && isYouTubeChannel(channel));
  const fetchYouTube = youtubeConnected && (viewingAll || isYouTube);

  const goChannel = (key: string) => {
    setSelectedKey(key);
    window.history.replaceState(
      null,
      "",
      `/insights?channel=${encodeURIComponent(key)}`
    );
  };

  const [range, setRange] = useState<Range>("30d");
  const [customStart, setCustomStart] = useState(() =>
    addDays(startOfDay(new Date()), -29)
  );
  const [customEnd, setCustomEnd] = useState(() => startOfDay(new Date()));
  const [compare, setCompare] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [postsPeriod, setPostsPeriod] = useState<PostsPeriod>("this");
  const [metricA, setMetricA] = useState<NumKey>("posts");
  const [sort, setSort] = useState<{
    key: SortKey;
    dir: "asc" | "desc";
  } | null>(null);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [composerContext, setComposerContext] =
    useState<ComposerContext | null>(null);
  const [query] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  /* ── Composer ── */

  const openComposer = useCallback((ctx?: ComposerContext) => {
    setIsFolderOpen(false);
    setComposerContext(ctx ?? null);
    setIsNewPostOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setIsNewPostOpen(false);
    setComposerContext(null);
  }, []);

  useNewPostRequest(() => openComposer({ reason: "manual" }));

  const scheduleFromSlot = useCallback(
    (slot: { day: number; hour: number }) => {
      openComposer({
        scheduledAt: nextDateForSlot(slot.day, slot.hour),
        channelKey: channel?.key,
        reason: "heatmap",
      });
    },
    [openComposer, channel?.key]
  );

  const duplicatePost = useCallback(
    (post: PostRow) => {
      openComposer({
        duplicateFrom: post,
        channelKey: channel?.key,
        reason: "duplicate",
      });
    },
    [openComposer, channel?.key]
  );

  /* ── Data ── */

  const { start, end } = useMemo(
    () => resolveRange(range, customStart, customEnd),
    [range, customStart, customEnd]
  );

  const yt = useYouTubeInsights(start, end, fetchYouTube, reloadKey);
  const scheduled = useScheduledVideoIds(
    channel?.key ?? channels.find(isYouTubeChannel)?.key,
    fetchYouTube,
    reloadKey
  );

  const perChannel = useMemo(() => {
    const map: Record<string, InsightsData> = {};
    for (const ch of channels) {
      if (isYouTubeChannel(ch)) {
        map[ch.key] =
          yt.data && scheduled.ready
            ? {
                ...yt.data,
                posts: yt.data.posts.map((p) => ({
                  ...p,
                  platform: "youtube",
                })),
              }
            : emptyInsights(start, end);
      } else {
        map[ch.key] = buildSampleInsights(start, end, ch.platform, lang);
      }
    }
    return map;
  }, [channels, yt.data, scheduled.ready, start, end, lang]);

  const source: InsightsData = useMemo(() => {
    if (!channels.length) return emptyInsights(start, end);
    if (viewingAll)
      return mergeInsights(
        channels.map((ch) => perChannel[ch.key]).filter(Boolean)
      );
    if (channel && perChannel[channel.key]) return perChannel[channel.key];
    return emptyInsights(start, end);
  }, [channels, viewingAll, channel, perChannel, start, end]);

  const { data, skipped } = useMemo(
    () => withoutScheduled(source, scheduled.ids),
    [source, scheduled.ids]
  );
  const { current, previous, summary, posts, previousPosts } = data;

  const youtubeLoading =
    fetchYouTube && ((yt.loading && !yt.data) || !scheduled.ready);

  const days = current.length;
  const dates = current.map((p) => p.date);
  const prevStart = previous[0]?.date ?? addDays(start, -days);
  const prevEnd = previous[days - 1]?.date ?? addDays(start, -1);
  const periodLabel = fmtRange(start, end, lang);
  const compareLabel = c.summary.comparedTo(
    fmtRange(prevStart, prevEnd, lang)
  );

  const prevTotals = useMemo(() => {
    const sum = (key: NumKey) => previous.reduce((a, p) => a + p[key], 0);
    return {
      posts: sum("posts"),
      reactions: sum("reactions"),
      comments: sum("comments"),
      followers: previous[previous.length - 1]?.followers ?? 0,
      profileViews: sum("profileViews"),
    };
  }, [previous]);

  const summaryBoxes: {
    key: SummaryBoxKey;
    value: string;
    delta?: number | null;
  }[] = [
    {
      key: "followers",
      value: nf(summary.followers, lang),
      delta: pctDelta(summary.followers, prevTotals.followers),
    },
    {
      key: "posts",
      value: nf(summary.posts, lang),
      delta: pctDelta(summary.posts, prevTotals.posts),
    },
    {
      key: "reactions",
      value: nf(summary.reactions, lang),
      delta: pctDelta(summary.reactions, prevTotals.reactions),
    },
    {
      key: "comments",
      value: nf(summary.comments, lang),
      delta: pctDelta(summary.comments, prevTotals.comments),
    },
    {
      key: "engRate",
      value: `${summary.engRate}%`,
    },
    {
      key: "videoViews",
      value: nf(summary.videoViews, lang),
    },
  ];

  const weekStart = addDays(startOfDay(new Date()), -6);
  const postsThisWeek = posts.filter((p) => p.date >= weekStart).length;
  const goalKey = channel?.key ?? channels[0]?.key ?? "youtube";
  const goal = readPostingGoal(goalKey) ?? readPostingGoal("youtube") ?? 3;
  const goalPct =
    goal > 0 ? Math.min(100, Math.round((postsThisWeek / goal) * 100)) : 0;
  const goalReached = postsThisWeek >= goal;

  const platformKey = (channel?.platform ?? "default").toLowerCase();
  const heatmap = useMemo(
    () => buildBestTimes(posts, platformKey, lang),
    [posts, platformKey, lang]
  );
  const bestTimesNote =
    heatmap.confidence === "baseline"
      ? c.bestTime.noteBaseline
      : heatmap.confidence === "early"
        ? c.bestTime.noteEarly(heatmap.sample)
        : c.bestTime.noteSolid(heatmap.sample);

  const ranked = useMemo(
    () => [...posts].sort((a, b) => postScore(b) - postScore(a)),
    [posts]
  );
  const topPost = ranked[0];
  const avgScore = posts.length
    ? posts.reduce((a, p) => a + postScore(p), 0) / posts.length
    : 0;
  const remixable = ranked
    .filter((p) => postScore(p) >= avgScore * 1.25)
    .slice(0, 3);

  const subhead =
    heatmap.sample === 0
      ? c.bestTime.emptySubhead
      : c.bestTime.filledSubhead(heatmap.label);

  const glance =
    summary.posts === 0
      ? null
      : c.summary.glance(summary.posts, summary.reactions, summary.comments);

  const TONES: [string, string] = [
    isDark ? "#ffffff" : "#111111",
    isDark ? "#7c7c85" : "#a3a3a3",
  ];

  const METRIC_OPTIONS: MetricOption[] = [
    {
      key: "posts",
      label: c.metricOptions.posts,
      icon: <Copy className="h-4 w-4" aria-hidden="true" />,
      agg: "sum",
    },
    {
      key: "reactions",
      label: c.metricOptions.reactions,
      icon: <Zap className="h-4 w-4" aria-hidden="true" />,
      agg: "sum",
    },
    {
      key: "comments",
      label: c.metricOptions.comments,
      icon: <Send className="h-4 w-4" aria-hidden="true" />,
      agg: "sum",
    },
    {
      key: "followers",
      label: c.metricOptions.followers,
      icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />,
      agg: "last",
    },
    {
      key: "profileViews",
      label: isYouTube
        ? c.metricOptions.channelViews
        : c.metricOptions.profileViews,
      icon: <Eye className="h-4 w-4" aria-hidden="true" />,
      agg: "sum",
    },
  ];
  const chartView: ChartView = compare ? "both" : "this";

  const activeSeries: SeriesDef[] = useMemo(() => {
    const o =
      METRIC_OPTIONS.find((m) => m.key === metricA) ?? METRIC_OPTIONS[0];
    return [{ key: o.key, label: o.label, tone: 0, agg: o.agg }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricA, isYouTube, lang]);

  const chartSeries: ChartSeries[] = useMemo(
    () =>
      activeSeries.map((s) => ({
        label: s.label,
        color: TONES[s.tone],
        values: current.map((p) => p[s.key]),
        prev: previous.map((p) => p[s.key]),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSeries, current, previous, isDark, lang]
  );

  const chartData: ChartRow[] = useMemo(
    () =>
      dates.map((d, i) => ({
        date: fmt(d, lang),
        fullDate: fmtFull(d, lang),
        left_this: chartSeries[0]?.values[i] ?? 0,
        left_prev: chartSeries[0]?.prev[i] ?? 0,
      })),
    [dates, chartSeries, lang]
  );

  const seriesTotal = (s: SeriesDef) =>
    s.agg === "sum"
      ? current.reduce((a, p) => a + p[s.key], 0)
      : current[days - 1]?.[s.key] ?? 0;
  const prevSeriesTotal = (s: SeriesDef) =>
    s.agg === "sum"
      ? previous.reduce((a, p) => a + p[s.key], 0)
      : previous[previous.length - 1]?.[s.key] ?? 0;
  const mainSeries = activeSeries[0];
  const mainDelta = pctDelta(
    seriesTotal(mainSeries),
    prevSeriesTotal(mainSeries)
  );

  /* ── Tableau des posts ── */
  const rows = postsPeriod === "this" ? posts : previousPosts;
  const hiddenScheduled =
    postsPeriod === "this" ? skipped.current : skipped.previous;
  const needle = query.trim().toLowerCase();

  const sortedRows = useMemo(() => {
    const matching = needle
      ? rows.filter((post) => post.label.toLowerCase().includes(needle))
      : rows;
    if (!sort) return matching;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...matching].sort((a, b) => (a[sort.key] - b[sort.key]) * dir);
  }, [rows, sort, needle]);

  const POSTS_PREVIEW = 5;
  const visibleRows = showAllPosts
    ? sortedRows
    : sortedRows.slice(0, POSTS_PREVIEW);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );

  const columns: { key: SortKey; render: (p: PostRow) => string }[] = [
    { key: "reactions", render: (p) => nf(p.reactions, lang) },
    { key: "comments", render: (p) => nf(p.comments, lang) },
    { key: "engRate", render: (p) => `${p.engRate.toFixed(2)}%` },
    { key: "videoViews", render: (p) => nf(p.videoViews, lang) },
  ];

  const mediaLabel = (m: PostRow["media"]) => c.media[m];

  const exportCsv = () => {
    const rowsCsv: (string | number)[][] = [
      [
        "date",
        "followers",
        "posts",
        "reactions",
        "comments",
        "profile_views",
        "previous_followers",
      ],
    ];
    current.forEach((p, i) =>
      rowsCsv.push([
        toInput(p.date),
        p.followers,
        p.posts,
        p.reactions,
        p.comments,
        p.profileViews,
        previous[i]?.followers ?? 0,
      ])
    );
    downloadCsv(`insights-${toInput(start)}-${toInput(end)}.csv`, rowsCsv);
  };

  /* ── Barre du bas / nouveau post ── */
  const handleBottomBarChange = (id: BottomBarTab) => {
    switch (id) {
      case "add":
        openComposer({ reason: "manual", channelKey: channel?.key });
        break;
      case "files":
        setIsFolderOpen((open) => !open);
        break;
    }
  };

  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }
    throw new Error(unavailablePostActionMessage(payload));
  };

  const mediaIcon = (m: PostRow["media"]) =>
    m === "video" ? (
      <Play className="h-4 w-4" />
    ) : m === "text" ? (
      <FileText className="h-4 w-4" />
    ) : (
      <ImageIcon className="h-4 w-4" />
    );

  const sectionCard = `rounded-3xl border p-4 md:p-6 ${t.card}`;
  const sectionTitle = `text-[16px] font-semibold tracking-[-0.02em] md:text-[17px] ${t.text}`;
  const sectionSub = `mt-1 text-[12px] ${t.muted}`;

  const heroUid = useId().replace(/[:]/g, "");
  const heroId = (name: string) => `hero-${name}-${heroUid}`;

  const canSwitchChannel = channels.length > 1;
  const channelTriggerLabel = viewingAll
    ? c.allNetworks
    : channel
      ? channelLabel(channel)
      : "";

  return (
    <main
      className={[
        "relative h-dvh min-h-dvh w-full overflow-hidden overscroll-none",
        "transition-colors duration-300",
        t.page,
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
            NO_SCROLLBAR,
            "transition-colors duration-300",
            isDark
              ? "border-white/[0.05] bg-[#0a0a0c]"
              : "border-black/[0.05] bg-white",
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto flex w-full min-w-0 max-w-[1720px]",
              "flex-col gap-6 px-[clamp(14px,3vw,48px)] md:gap-8",
              "pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[clamp(16px,3vw,30px)]",
            ].join(" ")}
          >
            {/* HEADER COMPACT */}
            <div className="flex flex-col gap-3">
              <div className="relative z-20 flex shrink-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border md:h-9 md:w-9 ${t.inner} ${t.soft}`}
                  >
                    <InsightsIcon />
                  </span>
                  <h1
                    className={`truncate text-[24px] font-semibold tracking-[-0.03em] md:text-[20px] ${t.text}`}
                  >
                    {c.header.title}
                  </h1>
                </div>

                <div className="flex min-w-0 items-center gap-1.5 md:gap-2.5 print:hidden">
                  <div className="max-md:hidden">
                    <ChannelMenu
                      channels={channels}
                      current={channel}
                      isDark={isDark}
                      onSelect={goChannel}
                      allOption={
                        channels.length > 1
                          ? { key: ALL_KEY, label: c.allNetworks }
                          : undefined
                      }
                      selectedKey={viewingAll ? ALL_KEY : channel?.key}
                    />
                  </div>

                  <div className="flex items-center gap-0.5 md:gap-2">
                    {fetchYouTube && (
                      <IconBtn
                        label={c.header.refresh}
                        t={t}
                        align="end"
                        onClick={() => setReloadKey((k) => k + 1)}
                      >
                        <RefreshCw
                          className={`h-[18px] w-[18px] ${
                            yt.loading
                              ? "animate-spin motion-reduce:animate-none"
                              : ""
                          }`}
                          aria-hidden="true"
                        />
                      </IconBtn>
                    )}

                    <button
                      type="button"
                      onClick={exportCsv}
                      disabled={!channels.length}
                      aria-label={c.header.export}
                      title={c.header.export}
                      className={`flex h-10 items-center justify-center gap-2 rounded-full text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 max-md:w-10 md:h-9 md:px-4 ${t.ring} ${t.outlineBtn}`}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      <span className="max-md:sr-only">{c.header.export}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label={
                      saved ? c.header.removeFavorite : c.header.addFavorite
                    }
                    aria-pressed={saved}
                    title={saved ? c.header.removeFavorite : c.header.addFavorite}
                    onClick={() => toggleFavorite(PAGE_ROUTE)}
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors motion-reduce:transition-none md:ml-1 md:h-9 md:w-9",
                      t.ring,
                      t.soft,
                      t.hover,
                    ].join(" ")}
                  >
                    <Bookmark
                      className={`h-5 w-5 ${saved ? "fill-current" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              {/* Mobile : sélecteur de canal pleine largeur → feuille glissable */}
              {channels.length > 0 && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={c.sheets.channels}
                  disabled={!canSwitchChannel}
                  onClick={() => setChannelsOpen(true)}
                  className={[
                    "flex min-h-12 w-full items-center gap-2.5 rounded-2xl border px-2.5 text-left transition active:scale-[0.99] disabled:active:scale-100 md:hidden",
                    t.ring,
                    t.panel,
                  ].join(" ")}
                >
                  {viewingAll ? (
                    <AllNetworksBadge isDark={isDark} size={32} />
                  ) : channel ? (
                    <ChannelAvatar
                      channel={channel}
                      isDark={isDark}
                      size={32}
                      ringClass={isDark ? "ring-[#0a0a0c]" : "ring-white"}
                    />
                  ) : null}
                  <span
                    className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${t.text}`}
                  >
                    {channelTriggerLabel}
                  </span>
                  {canSwitchChannel && (
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 ${t.soft}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              )}
            </div>

            {!channels.length ? (
              <section
                className={`flex flex-col items-center gap-3 rounded-2xl border px-6 py-16 text-center md:rounded-xl md:py-20 ${t.panel}`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${t.iconBox}`}
                >
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className={`text-[15px] font-semibold md:text-[14px] ${t.text}`}>
                  {c.noChannels.title}
                </h2>
                <p className={`max-w-[360px] text-[13px] md:text-[12px] ${t.soft}`}>
                  {c.noChannels.description}
                </p>
                <button
                  type="button"
                  onClick={() => navigateToSettingsSection("channels")}
                  className={`mt-2 flex min-h-11 items-center gap-1.5 rounded-xl px-5 py-2 text-[13px] font-semibold md:min-h-0 md:rounded-md md:px-4 md:text-[11px] ${t.ring} ${t.primaryBtn}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {c.noChannels.connect}
                </button>
              </section>
            ) : (
              <>
                {fetchYouTube && yt.error && (
                  <div
                    role="alert"
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${t.panel}`}
                  >
                    <p className="min-w-0 break-words text-[12.5px] text-red-500">
                      {c.errors.youtube(yt.error)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setReloadKey((k) => k + 1)}
                      className={`min-h-10 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors md:min-h-0 md:text-[11px] ${t.ring} ${t.outlineBtn}`}
                    >
                      {c.errors.retry}
                    </button>
                  </div>
                )}
                {youtubeLoading && (
                  <p
                    className={`text-[12.5px] ${t.soft}`}
                    role="status"
                    aria-live="polite"
                  >
                    {c.errors.loading}
                  </p>
                )}

                {/* ── HERO ── */}
                <section
                  aria-label={c.hero.eyebrow}
                  className={`relative isolate h-[230px] overflow-hidden rounded-3xl ring-1 ring-inset md:h-[340px] md:rounded-[36px] ${
                    isDark ? "bg-white ring-black/10" : "bg-black ring-white/10"
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-60 [mask-image:linear-gradient(to_right,transparent,black_35%)] md:w-[72%] md:opacity-100"
                    style={isDark ? { filter: "invert(1)" } : undefined}
                  >
                    <svg
                      viewBox="0 0 600 340"
                      preserveAspectRatio="xMaxYMid slice"
                      className="h-full w-full"
                    >
                      <defs>
                        <linearGradient
                          id={heroId("ring")}
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#ffffff" />
                          <stop offset="55%" stopColor="#a3a3a3" />
                          <stop offset="100%" stopColor="#262626" />
                        </linearGradient>
                        <linearGradient
                          id={heroId("ring-2")}
                          x1="1"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#525252" />
                          <stop offset="50%" stopColor="#f5f5f5" />
                          <stop offset="100%" stopColor="#404040" />
                        </linearGradient>
                        <radialGradient
                          id={heroId("glow")}
                          cx="70%"
                          cy="50%"
                          r="55%"
                        >
                          <stop
                            offset="0%"
                            stopColor="#ffffff"
                            stopOpacity="0.22"
                          />
                          <stop
                            offset="60%"
                            stopColor="#737373"
                            stopOpacity="0.07"
                          />
                          <stop offset="100%" stopColor="#000" stopOpacity="0" />
                        </radialGradient>
                        <filter
                          id={heroId("blur")}
                          x="-30%"
                          y="-30%"
                          width="160%"
                          height="160%"
                        >
                          <feGaussianBlur stdDeviation="10" />
                        </filter>
                        <filter
                          id={heroId("soft")}
                          x="-30%"
                          y="-30%"
                          width="160%"
                          height="160%"
                        >
                          <feGaussianBlur stdDeviation="1.6" />
                        </filter>
                      </defs>

                      <rect
                        width="600"
                        height="340"
                        fill={`url(#${heroId("glow")})`}
                      />

                      <g transform="translate(440 170)" fill="none">
                        <g filter={`url(#${heroId("blur")})`} opacity="0.85">
                          <ellipse
                            rx="170"
                            ry="120"
                            transform="rotate(-28)"
                            stroke={`url(#${heroId("ring")})`}
                            strokeWidth="44"
                          />
                          <ellipse
                            rx="125"
                            ry="84"
                            transform="rotate(-28)"
                            stroke={`url(#${heroId("ring-2")})`}
                            strokeWidth="36"
                          />
                          <ellipse
                            rx="80"
                            ry="50"
                            transform="rotate(-28)"
                            stroke={`url(#${heroId("ring")})`}
                            strokeWidth="28"
                          />
                        </g>
                        <g filter={`url(#${heroId("soft")})`}>
                          <ellipse
                            rx="170"
                            ry="120"
                            transform="rotate(-28)"
                            stroke={`url(#${heroId("ring")})`}
                            strokeWidth="8"
                          />
                          <ellipse
                            rx="148"
                            ry="102"
                            transform="rotate(-28)"
                            stroke="#ffffff"
                            strokeOpacity="0.7"
                            strokeWidth="2.5"
                          />
                          <ellipse
                            rx="125"
                            ry="84"
                            transform="rotate(-28)"
                            stroke={`url(#${heroId("ring-2")})`}
                            strokeWidth="7"
                          />
                          <ellipse
                            rx="102"
                            ry="67"
                            transform="rotate(-28)"
                            stroke="#d4d4d4"
                            strokeOpacity="0.7"
                            strokeWidth="2.5"
                          />
                          <ellipse
                            rx="80"
                            ry="50"
                            transform="rotate(-28)"
                            stroke={`url(#${heroId("ring")})`}
                            strokeWidth="6"
                          />
                        </g>
                      </g>
                    </svg>
                  </div>

                  <div className="absolute bottom-0 left-0 z-10 flex max-w-[480px] flex-col gap-1.5 p-5 md:p-10">
                    <p
                      className={`text-[11px] font-medium ${
                        isDark ? "text-neutral-500" : "text-white/60"
                      }`}
                    >
                      {c.hero.eyebrow}
                    </p>
                    <h2
                      className={`text-[clamp(24px,3vw,38px)] font-semibold leading-[1.05] tracking-[-0.035em] ${
                        isDark ? "text-neutral-900" : "text-white"
                      }`}
                    >
                      {c.hero.title}
                    </h2>
                    <p
                      className={`max-w-[380px] text-[12.5px] leading-relaxed max-md:line-clamp-3 ${
                        isDark ? "text-neutral-500" : "text-white/60"
                      }`}
                    >
                      {c.hero.subtitle}
                    </p>
                  </div>
                </section>

                {/* ── NUMBERS ── */}
                <section
                  aria-labelledby="all-title"
                  className="flex min-w-0 flex-col gap-4"
                >
                  <div>
                    <h2
                      id="all-title"
                      className={`text-[24px] font-semibold tracking-[-0.03em] md:text-[28px] ${t.text}`}
                    >
                      {c.overview.title}
                    </h2>
                    <p className={`mt-0.5 text-[12px] ${t.muted}`}>
                      {c.overview.subtitle}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
                      <div
                        role="tablist"
                        aria-label={c.overview.dateRangeAria}
                        className={`inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border p-1 ${NO_SCROLLBAR} ${t.panel}`}
                      >
                        {(["7d", "30d", "mtd", "custom"] as Range[]).map(
                          (key) => {
                            const active = range === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setRange(key)}
                                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-semibold transition-colors md:px-4 md:text-[13px] ${t.ring} ${
                                  active ? t.sel : t.idle
                                }`}
                              >
                                {c.ranges[key]}
                                {key === "custom" && (
                                  <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                      active
                                        ? isDark
                                          ? "bg-black/15 text-black"
                                          : "bg-white/20 text-white"
                                        : isDark
                                          ? "bg-white/15 text-white"
                                          : "bg-black/10 text-black"
                                    }`}
                                    aria-hidden="true"
                                  >
                                    <Zap className="h-3 w-3 fill-current" />
                                  </span>
                                )}
                              </button>
                            );
                          }
                        )}
                      </div>
                      {range === "custom" && (
                        <RangePicker
                          range={range}
                          start={start}
                          end={end}
                          onStartChange={setCustomStart}
                          onEndChange={setCustomEnd}
                          t={t}
                          isDark={isDark}
                          isMobile={isMobile}
                          lang={lang}
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate("tags")}
                      className={`flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors md:min-h-0 ${t.ring} ${t.hover} ${t.text}`}
                    >
                      <Tag className="h-4 w-4" aria-hidden="true" />
                      {c.tagsButton}
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className={sectionCard}>
                    <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                      <div className="min-w-0">
                        <h3 className={sectionTitle}>{c.summary.title}</h3>
                        <p className={sectionSub}>
                          {periodLabel} · {compareLabel}
                        </p>
                      </div>
                      <div
                        className="flex w-full items-center gap-2 md:w-auto"
                        aria-label={c.summary.goalAria(postsThisWeek, goal)}
                      >
                        <div
                          className={`h-1.5 w-full overflow-hidden rounded-full md:w-24 ${t.inner}`}
                        >
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 ${
                              goalReached ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${goalPct}%` }}
                          />
                        </div>
                        <span
                          className={`shrink-0 text-[11px] font-semibold tabular-nums ${t.soft}`}
                        >
                          {c.summary.goalProgress(postsThisWeek, goal)}
                        </span>
                      </div>
                    </div>

                    {glance && (
                      <p
                        className={`mt-3 px-1 text-[13px] leading-relaxed ${t.soft}`}
                      >
                        {glance}
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
                      {summaryBoxes.map((b) => (
                        <MetricBox
                          key={b.key}
                          label={c.summary.labels[b.key]}
                          value={b.value}
                          info={c.summary.info[b.key]}
                          t={t}
                          delta={b.delta}
                          isDark={isDark}
                          isMobile={isMobile}
                          lang={lang}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── TRENDS ── */}
                <section
                  className={`${sectionCard} min-w-0`}
                  aria-labelledby="metrics-title"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <h3 id="metrics-title" className={sectionTitle}>
                        {c.trends.title}
                      </h3>
                      <p className={sectionSub}>
                        {c.trends.subtitle(periodLabel)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={compare}
                      onClick={() => setCompare((cv) => !cv)}
                      className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors md:min-h-0 ${t.ring} ${
                        compare
                          ? `border-transparent ${t.sel}`
                          : `${t.inner} ${t.hover} ${t.text}`
                      }`}
                    >
                      <span
                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-current"
                        aria-hidden="true"
                      >
                        {compare && (
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        )}
                      </span>
                      {c.trends.compareToggle}
                    </button>
                  </div>

                  <div
                    className={`mt-4 max-w-full overflow-x-auto ${NO_SCROLLBAR}`}
                  >
                    <Segmented<NumKey>
                      label={c.trends.metricAria}
                      value={metricA}
                      onChange={setMetricA}
                      t={t}
                      options={METRIC_OPTIONS.map((m) => ({
                        key: m.key,
                        label: m.label,
                        icon: m.icon,
                      }))}
                    />
                  </div>

                  <div
                    className={`mt-3 rounded-2xl border p-3 md:p-5 ${t.panel}`}
                  >
                    <div className="flex flex-wrap items-end justify-between gap-3 pl-1 md:gap-4 md:pl-2">
                      <div className="min-w-0">
                        <p className={`text-[11px] font-medium ${t.soft}`}>
                          {mainSeries.label} ·{" "}
                          {mainSeries.agg === "sum"
                            ? c.trends.total
                            : c.trends.ending}
                        </p>
                        <p
                          className={`mt-1.5 flex flex-wrap items-center gap-2 text-[26px] font-bold leading-none tracking-tight tabular-nums md:gap-3 md:text-[28px] ${t.text}`}
                        >
                          {nf(seriesTotal(mainSeries), lang)}
                          {mainDelta != null && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                                mainDelta > 0
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : mainDelta < 0
                                    ? "bg-rose-500/10 text-rose-500"
                                    : `${t.tile} ${t.muted}`
                              }`}
                            >
                              {mainDelta > 0 ? "+" : ""}
                              {mainDelta}%
                              <span className="max-md:sr-only">
                                {" "}
                                {c.summary.vsPreviousShort}
                              </span>
                            </span>
                          )}
                        </p>
                      </div>
                      {compare && (
                        <div
                          className={`flex items-center gap-4 text-[11px] ${t.soft}`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-0.5 w-5 bg-current"
                              aria-hidden="true"
                            />
                            {c.trends.thisPeriod}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-5 border-t-2 border-dashed border-current"
                              aria-hidden="true"
                            />
                            {c.trends.previousPeriod}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 md:mt-6">
                      <InsightsChart
                        data={chartData}
                        view={chartView}
                        isDark={isDark}
                        isMobile={isMobile}
                        lang={lang}
                        seriesLabel={mainSeries.label}
                        seriesColor={TONES[0]}
                        hasSecondAxis={false}
                      />
                    </div>
                  </div>
                </section>

                {/* ── BEST TIME + RECYCLE ── */}
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  <section
                    className={`${sectionCard} min-w-0`}
                    aria-labelledby="besttime-title"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                      <div className="min-w-0">
                        <h3 id="besttime-title" className={sectionTitle}>
                          {c.bestTime.title}
                        </h3>
                        <p className={sectionSub}>{subhead}</p>
                        <p className={`mt-1 text-[10.5px] ${t.muted}`}>
                          {bestTimesNote}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => scheduleFromSlot(heatmap.best)}
                        className={`min-h-11 shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold max-md:w-full md:min-h-0 md:text-[11px] ${t.ring} ${t.outlineBtn}`}
                      >
                        {c.bestTime.useLabel(heatmap.label)}
                      </button>
                    </div>

                    {isMobile ? (
                      <BestTimeMobile
                        heatmap={heatmap}
                        c={c}
                        t={t}
                        isDark={isDark}
                        onSchedule={scheduleFromSlot}
                      />
                    ) : (
                      <div
                        className={`mt-4 overflow-x-auto overscroll-x-contain px-1 pb-1 ${NO_SCROLLBAR}`}
                      >
                        <div className="min-w-[480px]">
                          <div className="mb-1.5 flex items-end gap-2">
                            <span className="w-9 shrink-0" />
                            <div
                              className={`grid flex-1 gap-[5px] ${HEAT_COLS}`}
                            >
                              {Array.from({ length: 24 }, (_, h) => (
                                <span
                                  key={h}
                                  title={hourLabel(h)}
                                  className={`text-center text-[10px] leading-none tabular-nums ${t.muted}`}
                                >
                                  {h % 3 === 0
                                    ? String(h).padStart(2, "0")
                                    : ""}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            {c.days.map((day, d) => (
                              <div key={day} className="flex items-center gap-2">
                                <span
                                  className={`w-9 shrink-0 text-[10px] ${t.muted}`}
                                >
                                  {day}
                                </span>
                                <div
                                  className={`grid flex-1 gap-[5px] ${HEAT_COLS}`}
                                >
                                  {Array.from({ length: 24 }, (_, h) => {
                                    const cell = heatmap.grid[d][h];
                                    const isBest =
                                      heatmap.bestByDay[d].hour === h;
                                    return (
                                      <button
                                        key={h}
                                        type="button"
                                        title={`${day} ${hourLabel(h)}${
                                          isBest
                                            ? c.bestTime.bestOfDaySuffix
                                            : ""
                                        }`}
                                        aria-label={c.bestTime.scheduleAria(
                                          day,
                                          hourLabel(h)
                                        )}
                                        onClick={() =>
                                          scheduleFromSlot({ day: d, hour: h })
                                        }
                                        className={`aspect-square w-full rounded-[6px] transition-transform hover:scale-125 ${t.ring} ${
                                          isBest
                                            ? `ring-[1.5px] ring-offset-1 ${
                                                isDark
                                                  ? "ring-white ring-offset-[#0a0a0c]"
                                                  : "ring-neutral-900 ring-offset-white"
                                              }`
                                            : ""
                                        }`}
                                        style={{
                                          background: heatColor(cell.norm),
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex items-center justify-end gap-1.5">
                            <span className={`mr-1 text-[10px] ${t.muted}`}>
                              {c.bestTime.low}
                            </span>
                            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                              <span
                                key={v}
                                className="h-3 w-3 rounded-[3px]"
                                style={{ background: heatColor(v) }}
                                aria-hidden="true"
                              />
                            ))}
                            <span className={`ml-1 text-[10px] ${t.muted}`}>
                              {c.bestTime.high}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <section
                    className={`${sectionCard} min-w-0`}
                    aria-labelledby="recycle-title"
                  >
                    <div className="px-1">
                      <h3 id="recycle-title" className={sectionTitle}>
                        {c.recycle.title}
                      </h3>
                      <p className={sectionSub}>{c.recycle.subtitle}</p>
                    </div>
                    {remixable.length === 0 ? (
                      <p className={`mt-4 text-[12px] ${t.soft}`}>
                        {c.recycle.emptyHint}
                      </p>
                    ) : (
                      <div className="mt-4 flex flex-col gap-2.5">
                        {remixable.map((p, i) => (
                          <div
                            key={p.id}
                            className={`flex gap-3 rounded-2xl border p-3 md:p-3.5 ${t.inner}`}
                          >
                            <span
                              className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${t.iconBox}`}
                            >
                              {p.thumbnailUrl ? (
                                <img
                                  src={p.thumbnailUrl}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                mediaIcon(p.media)
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[10px] font-semibold uppercase tracking-wide ${t.muted}`}
                              >
                                {c.recycle.rank(i + 1)} · {mediaLabel(p.media)}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                                <p
                                  className={`min-w-0 max-w-full flex-1 truncate text-[13px] font-semibold ${t.text}`}
                                >
                                  {p.label}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => duplicatePost(p)}
                                  className={`min-h-10 shrink-0 rounded-md border px-3 py-1 text-[12px] font-semibold transition-colors motion-reduce:transition-none md:min-h-0 md:px-2.5 md:text-[11px] ${t.ring} ${
                                    isDark
                                      ? "border-white/10 text-white hover:border-white/25 hover:bg-white/[0.08]"
                                      : "border-black/10 text-neutral-900 hover:border-black/25 hover:bg-black/[0.06]"
                                  }`}
                                >
                                  {c.recycle.duplicate}
                                </button>
                              </div>
                              <p className={`mt-1 text-[11px] ${t.soft}`}>
                                {c.recycle.engagement(
                                  p.reactions,
                                  p.engRate.toFixed(1)
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* ── PERFORMANCE PER POST ── */}
                <section
                  className={`${sectionCard} min-w-0`}
                  aria-labelledby="perf-title"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <h3 id="perf-title" className={sectionTitle}>
                        {c.performance.title}
                      </h3>
                      <p className={sectionSub}>
                        {postsPeriod === "this"
                          ? periodLabel
                          : fmtRange(prevStart, prevEnd, lang)}
                        {hiddenScheduled > 0 &&
                          ` · ${c.performance.hiddenScheduled(hiddenScheduled)}`}
                      </p>
                    </div>
                    <Segmented<PostsPeriod>
                      label={c.performance.periodAria}
                      value={postsPeriod}
                      onChange={setPostsPeriod}
                      t={t}
                      size="lg"
                      options={[
                        { key: "this", label: c.performance.periodThis },
                        {
                          key: "previous",
                          label: c.performance.periodPrevious,
                        },
                      ]}
                    />
                  </div>

                  <div
                    className={`mt-4 overflow-hidden rounded-2xl border ${t.panel}`}
                  >
                    {/* Mobile (< md) : compteur + tri en puces scrollables */}
                    <div className="md:hidden">
                      <p
                        className={`px-4 pt-3 text-[12px] font-semibold ${t.text}`}
                      >
                        {c.performance.postsCount(sortedRows.length)}
                      </p>
                      <div
                        className={`flex gap-1.5 overflow-x-auto px-4 pb-3 pt-2 ${NO_SCROLLBAR}`}
                      >
                        {columns.map((col) => {
                          const active = sort?.key === col.key;
                          return (
                            <button
                              key={col.key}
                              type="button"
                              onClick={() => toggleSort(col.key)}
                              aria-pressed={active}
                              aria-label={c.performance.sortBy(
                                c.performance.columns[col.key]
                              )}
                              className={`flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${t.ring} ${
                                active
                                  ? `border-transparent ${t.sel}`
                                  : `${t.inner} ${t.hover} ${t.text}`
                              }`}
                            >
                              {c.performance.columns[col.key]}
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${
                                  active && sort?.dir === "asc"
                                    ? "rotate-180"
                                    : ""
                                } ${active ? "opacity-100" : "opacity-60"}`}
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Desktop (≥ md) : en-tête de colonnes */}
                    <div
                      className={`hidden items-center gap-2 px-4 py-3 text-[12px] font-semibold md:grid ${TABLE_GRID} ${t.head} ${t.text}`}
                    >
                      <span>{c.performance.postsCount(sortedRows.length)}</span>
                      {columns.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          aria-label={c.performance.sortBy(
                            c.performance.columns[col.key]
                          )}
                          className={`flex w-fit items-center gap-1 rounded text-left ${t.ring}`}
                        >
                          {c.performance.columns[col.key]}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${
                              t.muted
                            } ${
                              sort?.key === col.key && sort.dir === "asc"
                                ? "rotate-180"
                                : ""
                            } ${
                              sort?.key === col.key
                                ? "opacity-100"
                                : "opacity-70"
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                      <span />
                    </div>

                    {sortedRows.length === 0 ? (
                      <div
                        className={`flex flex-col items-center gap-2 border-t px-6 py-10 text-center ${t.border}`}
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-full ${t.iconBox}`}
                        >
                          <Activity className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <p
                          className={`text-[13px] font-medium md:text-[12px] ${t.text}`}
                        >
                          {youtubeLoading
                            ? c.performance.emptyLoading
                            : needle
                              ? c.performance.emptyNoMatch
                              : c.performance.emptyNoPost}
                        </p>
                        {!youtubeLoading && !needle && (
                          <p className={`max-w-[360px] text-[12px] ${t.soft}`}>
                            {c.performance.emptyLongerPeriod}
                          </p>
                        )}
                        {!youtubeLoading && !needle && days < 30 && (
                          <button
                            type="button"
                            onClick={() => setRange("30d")}
                            className={`mt-2 min-h-11 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors md:min-h-0 md:px-3.5 md:text-[11px] ${t.ring} ${t.outlineBtn}`}
                          >
                            {c.performance.showLast30Days}
                          </button>
                        )}
                      </div>
                    ) : (
                      visibleRows.map((p, idx) => (
                        <div
                          key={p.id}
                          className={`relative grid grid-cols-2 gap-x-3 gap-y-2.5 border-t px-4 py-3 text-[13px] transition-colors md:items-center md:gap-2 ${TABLE_GRID} ${t.border} ${t.text} ${t.hover}`}
                        >
                          <div className="col-span-2 flex min-w-0 items-center gap-3 pr-10 md:col-span-1 md:pr-0">
                            <span
                              className={`w-5 shrink-0 text-[12px] ${t.muted}`}
                            >
                              #{idx + 1}
                            </span>
                            <span
                              className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg ${t.iconBox}`}
                            >
                              {p.thumbnailUrl ? (
                                <img
                                  src={p.thumbnailUrl}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                mediaIcon(p.media)
                              )}
                            </span>
                            <div className="min-w-0">
                              {isYouTube ? (
                                <a
                                  href={`https://www.youtube.com/watch?v=${p.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`block truncate rounded text-[14px] font-medium hover:underline ${t.soft} ${t.ring}`}
                                >
                                  {p.label}
                                </a>
                              ) : (
                                <p
                                  className={`truncate text-[14px] font-medium ${t.soft}`}
                                >
                                  {p.label}
                                </p>
                              )}
                              <p
                                className={`flex items-center gap-1.5 text-[11px] ${t.muted}`}
                              >
                                {fmtFull(p.date, lang)}
                                {postsPeriod === "this" &&
                                  p.id === topPost?.id && (
                                    <span
                                      className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${t.sel}`}
                                    >
                                      {c.performance.top}
                                    </span>
                                  )}
                              </p>
                            </div>
                          </div>
                          {columns.map((col) => (
                            <span
                              key={col.key}
                              className="flex items-baseline justify-between gap-2 tabular-nums md:block"
                            >
                              <span
                                className={`text-[11px] md:hidden ${t.muted}`}
                              >
                                {c.performance.columns[col.key]}
                              </span>
                              <span className="font-medium md:font-normal">
                                {col.render(p)}
                              </span>
                            </span>
                          ))}
                          <div className="absolute right-3 top-3 md:static">
                            {isYouTube ? (
                              <a
                                href={`https://www.youtube.com/watch?v=${p.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={c.performance.openYouTube}
                                title={c.performance.openYouTube}
                                className={`flex h-10 w-10 items-center justify-center rounded-md md:h-8 md:w-8 ${t.soft} ${t.hover} ${t.ring}`}
                              >
                                <ExternalLink
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : (
                              <button
                                type="button"
                                aria-label={c.performance.duplicatePost}
                                title={c.performance.duplicatePost}
                                onClick={() => duplicatePost(p)}
                                className={`flex h-10 w-10 items-center justify-center rounded-md md:h-8 md:w-8 ${t.soft} ${t.hover} ${t.ring}`}
                              >
                                <MoreVertical
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    {sortedRows.length > POSTS_PREVIEW && (
                      <div
                        className={`flex justify-center border-t px-4 py-3 ${t.border}`}
                      >
                        <button
                          type="button"
                          onClick={() => setShowAllPosts((v) => !v)}
                          className={`min-h-11 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors md:min-h-0 md:px-3.5 md:text-[11px] ${t.ring} ${t.outlineBtn}`}
                        >
                          {showAllPosts
                            ? c.performance.showLess
                            : c.performance.showMore(sortedRows.length)}
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feuille « Canaux » (mobile) */}
      {channelsOpen && isMobile && (
        <ChannelSheet
          isDark={isDark}
          title={c.sheets.channels}
          channels={channels}
          selectedKey={viewingAll ? ALL_KEY : channel?.key}
          allLabel={channels.length > 1 ? c.allNetworks : undefined}
          onSelect={goChannel}
          onClose={() => setChannelsOpen(false)}
        />
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
        onCreatePost={() =>
          openComposer({ reason: "manual", channelKey: channel?.key })
        }
      />
      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={closeComposer}
        isDark={isDark}
        onSubmit={handleCreatePost}
        onRequestOpen={() => setIsNewPostOpen(true)}
        {...({ initialContext: composerContext } as Record<string, unknown>)}
      />
      <HelpChatButton isDark={isDark} />
    </main>
  );
}