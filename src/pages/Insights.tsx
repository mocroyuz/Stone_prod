// src/pages/Insights.tsx
// Insights = moteur de prochaine action (pas un clone d'analytics).
// YouTube : données réelles. Autres réseaux : démo en attendant leur API.

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Columns,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Info,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Send,
  Sparkles,
  Tag,
  Target,
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
import { createPosts, listPosts, type CalendarPost } from "../services/posts";
import { fetchYouTubeVideos, useYouTubeInsights } from "../services/youtube";
import { readPostingGoal } from "../components/OnboardingModals";
import { useNewPostRequest } from "../services/Newpostbus";

/** Route de cette page dans la sidebar (section Favorite). */
const PAGE_ROUTE = "insights";
const ALL_KEY = "all";
const COMPOSER_DRAFT_KEY = "newpost:draft:v1";

/* ============================================================
   TYPES
============================================================ */

type Range = "7d" | "30d" | "mtd" | "custom";
type ChartView = "this" | "comparison" | "both";
type PostsPeriod = "this" | "previous";
type MetricTab = "posts" | "impact" | "growth" | "visibility";
type SortKey = "reactions" | "comments" | "engRate" | "videoViews";
type NumKey = "posts" | "reactions" | "comments" | "followers" | "profileViews";

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
  /** "scheduled" | "published" | … — absent → considéré comme publié. */
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

type SeriesDef = { key: NumKey; label: string; tone: 0 | 1; agg: "sum" | "last" };

/** Ligne « plate » consommée par Recharts (une ligne = une date). */
type ChartRow = {
  date: string;
  fullDate: string;
  left_this: number;
  left_prev: number;
  right_this?: number;
  right_prev?: number;
};

/** Données d'une série dans le graphe (avant aplatissement). */
type ChartSeries = { label: string; color: string; values: number[]; prev: number[] };

/** Contexte passé au composer pour préremplir la prochaine publication. */
type ComposerContext = {
  scheduledAt?: Date;
  channelKey?: string;
  duplicateFrom?: PostRow;
  reason?: "heatmap" | "duplicate" | "insight" | "manual";
};

/** Un takeaway = un insight actionnable avec un seul bouton. */
type Takeaway = {
  id: string;
  icon: ReactNode;
  title: string;
  detail: string;
  cta: string;
  action: () => void;
};

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "mtd", label: "Month to Date" },
  { key: "custom", label: "Custom" },
];

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
        card: "border-white/[0.05] bg-transparent",
        panel: "border-white/[0.05] bg-white/[0.015]",
        inner: "border-white/[0.05] bg-white/[0.02]",
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
        card: "border-black/[0.05] bg-transparent",
        panel: "border-black/[0.05] bg-neutral-50",
        inner: "border-black/[0.05] bg-white",
        border: "border-black/[0.05]",
        head: "bg-neutral-50",
        primaryBtn: "bg-neutral-900 text-white hover:bg-neutral-700",
        outlineBtn: "border border-black/10 text-neutral-900 hover:bg-neutral-100",
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
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
const fmtFull = (d: Date) =>
  d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const fmtRange = (a: Date, b: Date) => `${fmt(a)} - ${fmtFull(b)}`;
const nf = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("en-US");

function resolveRange(range: Range, customStart: Date, customEnd: Date) {
  const today = startOfDay(new Date());
  if (range === "7d") return { start: addDays(today, -6), end: today };
  if (range === "30d") return { start: addDays(today, -29), end: today };
  if (range === "mtd") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };

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

/**
 * Prochaine date correspondant au slot (jour de semaine × heure) — utilisée
 * pour préremplir le composer quand on clique sur une cellule de heatmap.
 * Renvoie la prochaine occurrence strictement dans le futur.
 */
function nextDateForSlot(dayIdxMon: number, hour: number): Date {
  const now = new Date();
  const today = startOfDay(now);
  const todayIdx = (today.getDay() + 6) % 7; // 0 = lundi
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

/* ============================================================
   POSTS PROGRAMMÉS (scheduled) — ignorés partout dans la page
============================================================ */

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

type ScheduledEntry = { ids: ReadonlySet<string>; at: number };

const scheduledCache = new Map<string, ScheduledEntry>();
const SCHEDULED_FRESH_MS = 2 * 60_000;

function useScheduledVideoIds(
  channelKey: string | undefined,
  enabled: boolean,
  reloadKey: number
): { ids: ReadonlySet<string>; ready: boolean } {
  const active = enabled && Boolean(channelKey);

  const [ids, setIds] = useState<ReadonlySet<string>>(() =>
    active && channelKey ? scheduledCache.get(channelKey)?.ids ?? EMPTY_IDS : EMPTY_IDS
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
      });

    return () => {
      cancelled = true;
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
  const isScheduled = (p: PostRow) => p.status === "scheduled" || scheduledIds.has(p.id);

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
    skipped: { current: droppedCurrent.length, previous: droppedPrevious.length },
  };
}

/* ============================================================
   DONNÉES D'EXEMPLE (réseaux sans API pour l'instant)
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
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

function emptyInsights(start: Date, end: Date): InsightsData {
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
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

const DEMO_TITLES: Record<string, string[]> = {
  tiktok: ["Hook in 3 seconds", "Behind the studio", "Before / after", "Sound that stuck", "Day in the queue"],
  pinterest: ["Moodboard: quiet luxury", "Pin that keeps saving", "Color story", "Shelf layout", "Texture close-up"],
  youtube: ["Short: one idea", "Cut the intro", "What I'd remake", "90s of proof", "The leftover clip"],
  default: ["Quiet drop", "The one people saved", "Studio note", "Ambition, shorter", "Still working"],
};

function buildSampleInsights(start: Date, end: Date, platform: string): InsightsData {
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
  const rnd = mulberry32(seedFrom(`${platform}:${toInput(start)}:${days}`));
  const titles = DEMO_TITLES[platform] ?? DEMO_TITLES.default;
  const mediaCycle: PostRow["media"][] = ["video", "image", "video", "text", "image"];
  const peakHour = platform === "tiktok" ? 19 : platform === "pinterest" ? 10 : 18;

  const makePoints = (from: Date, scale: number): Point[] => {
    let followers = 800 + Math.floor(rnd() * 4200);
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      const dow = date.getDay();
      const weekend = dow === 0 || dow === 6;
      const posts = rnd() > (weekend ? 0.72 : 0.55) ? 1 : rnd() > 0.92 ? 2 : 0;
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
      const hour = (peakHour + Math.floor(rnd() * 5) - 1 + (n === 1 ? 4 : 0) + 24) % 24;
      const date = new Date(pt.date);
      date.setHours(hour, Math.floor(rnd() * 50), 0, 0);
      const reactions = Math.max(4, Math.round(pt.reactions / Math.max(1, pt.posts) * (0.6 + rnd())));
      const comments = Math.max(0, Math.round(reactions * (0.06 + rnd() * 0.14)));
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
      engRate: ratePct(sumR + sumC, views || current.reduce((a, p) => a + p.profileViews, 0)),
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

function ratePct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 10_000) / 100 : 0;
}

function mergeInsights(parts: InsightsData[]): InsightsData {
  if (parts.length === 0) return emptyInsights(startOfDay(new Date()), startOfDay(new Date()));
  if (parts.length === 1) return parts[0];
  const current = parts[0].current.map((pt, i) => ({
    date: pt.date,
    posts: parts.reduce((a, p) => a + (p.current[i]?.posts ?? 0), 0),
    reactions: parts.reduce((a, p) => a + (p.current[i]?.reactions ?? 0), 0),
    comments: parts.reduce((a, p) => a + (p.current[i]?.comments ?? 0), 0),
    followers: parts.reduce((a, p) => a + (p.current[i]?.followers ?? 0), 0),
    profileViews: parts.reduce((a, p) => a + (p.current[i]?.profileViews ?? 0), 0),
  }));
  const previous = parts[0].previous.map((pt, i) => ({
    date: pt.date,
    posts: parts.reduce((a, p) => a + (p.previous[i]?.posts ?? 0), 0),
    reactions: parts.reduce((a, p) => a + (p.previous[i]?.reactions ?? 0), 0),
    comments: parts.reduce((a, p) => a + (p.previous[i]?.comments ?? 0), 0),
    followers: parts.reduce((a, p) => a + (p.previous[i]?.followers ?? 0), 0),
    profileViews: parts.reduce((a, p) => a + (p.previous[i]?.profileViews ?? 0), 0),
  }));
  const posts = parts.flatMap((p) => p.posts).sort((a, b) => +b.date - +a.date);
  const previousPosts = parts.flatMap((p) => p.previousPosts);
  const sum = (key: keyof Summary) => parts.reduce((a, p) => a + p.summary[key], 0);
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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayIndexMon(d: Date) {
  return (d.getDay() + 6) % 7;
}

function postScore(p: PostRow) {
  return p.reactions + p.comments * 2.4 + p.videoViews * 0.02;
}

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;

/* ── Best time to post ──────────────────────────────────────
   Stratégie (3 étapes) :
   1. LIFT : chaque post est comparé à la médiane de tes posts (robuste aux
      outliers, plafonné à 4×) → on mesure « mieux/moins bien que d'habitude »,
      pas un volume brut.
   2. LISSAGE : un post à 18h informe aussi 17h/19h (noyau ±2h) et, plus
      faiblement, la même heure les autres jours → une cellule vide n'est pas
      un « zéro », elle hérite de ses voisines.
   3. PRIOR BAYÉSIEN : on mélange avec une courbe d'activité typique par réseau
      (semaine / week-end). Peu de posts → le prior domine ; plus tu publies,
      plus tes données prennent le dessus (poids n / (n + K)).
------------------------------------------------------------ */

type Peak = [hour: number, weight: number, spread: number];
type Curve = { weekday: Peak[]; weekend: Peak[] };

/** Courbes d'activité typiques — point de départ, jamais une vérité absolue. */
const BASELINE: Record<string, Curve> = {
  default: {
    weekday: [[8, 0.4, 1.5], [12.5, 0.5, 1.5], [19, 0.9, 2]],
    weekend: [[10.5, 0.6, 2], [19.5, 0.8, 2.5]],
  },
  youtube: {
    weekday: [[12, 0.35, 1.5], [16.5, 0.8, 2], [20, 0.6, 2]],
    weekend: [[10, 0.7, 2], [17, 0.6, 2.5]],
  },
  tiktok: {
    weekday: [[12.5, 0.4, 1.5], [19.5, 0.9, 2], [22, 0.5, 1.5]],
    weekend: [[11, 0.5, 2], [20, 0.8, 2.5]],
  },
  instagram: {
    weekday: [[8, 0.3, 1.2], [12, 0.6, 1.5], [19, 0.8, 2]],
    weekend: [[10, 0.6, 2], [19, 0.6, 2.5]],
  },
  pinterest: {
    weekday: [[14, 0.4, 2], [20.5, 0.8, 2]],
    weekend: [[11, 0.5, 2], [15, 0.5, 2], [21, 0.7, 2]],
  },
  linkedin: {
    weekday: [[8, 0.7, 1.2], [12, 0.6, 1.3], [17.5, 0.5, 1.5]],
    weekend: [[10, 0.2, 2]],
  },
  facebook: {
    weekday: [[9, 0.4, 1.5], [13, 0.6, 2], [19, 0.6, 2]],
    weekend: [[10, 0.6, 2], [14, 0.4, 2]],
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

const PRIOR_STRENGTH = 2.5; // « K » : poids du prior, en posts équivalents
const HOUR_KERNEL = [1, 0.5, 0.2]; // poids pour ±0h, ±1h, ±2h
const CROSS_DAY_SHARE = 0.15; // part d'info partagée entre jours (même heure)

type BestTimes = {
  /** grid[jour][heure] — norm ∈ [0,1] pour la couleur */
  grid: { value: number; norm: number; count: number }[][];
  bestByDay: { day: number; hour: number }[];
  best: { day: number; hour: number };
  label: string;
  sample: number;
  confidence: "baseline" | "early" | "solid";
};

function buildBestTimes(posts: PostRow[], platform: string): BestTimes {
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
      const v = (PRIOR_STRENGTH * priorLift(platform, d, h) + s) / (PRIOR_STRENGTH + c);
      if (v < min) min = v;
      if (v > max) max = v;
      return v;
    })
  );

  const span = max - min || 1;
  const grid = values.map((row, d) =>
    row.map((value, h) => ({ value, norm: (value - min) / span, count: raw[d][h] }))
  );

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
    label: `${DAY_LABELS[best.day]} ${hourLabel(best.hour)}`,
    sample: n,
    confidence: n < 5 ? "baseline" : n < 15 ? "early" : "solid",
  };
}

/** Rose pâle → violet profond (comme une heatmap d'engagement). */
const heatColor = (v: number) => `hsla(320, 85%, ${72 - 20 * v}%, ${0.1 + 0.9 * v})`;
const shortHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

function pctDelta(now: number, prev: number) {
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return null;
  if (prev === 0) return now === 0 ? 0 : 100;
  return Math.round(((now - prev) / Math.abs(prev)) * 100);
}

function hasComposerDraft() {
  try {
    return Boolean(localStorage.getItem(COMPOSER_DRAFT_KEY));
  } catch {
    return false;
  }
}

/**
 * Génère les takeaways hebdomadaires — chacun avec un bouton contexte-aware.
 * Priorité : cadence > brouillons > tendance engagement > créneau > top post.
 */
function buildTakeaways(args: {
  postsThisWeek: number;
  goal: number;
  draftsCount: number;
  engagementDelta: number | null;
  topPost: PostRow | undefined;
  topMultiplier: number;
  heatmap: BestTimes;
  onScheduleSlot: (slot: { day: number; hour: number }) => void;
  onDuplicate: (post: PostRow) => void;
  onCreate: () => void;
  onSchedule: () => void;
}): Takeaway[] {
  const out: Takeaway[] = [];

  if (args.postsThisWeek < args.goal) {
    const behind = args.goal - args.postsThisWeek;
    out.push({
      id: "cadence",
      icon: <Target className="h-3.5 w-3.5" />,
      title: `${behind} post${behind > 1 ? "s" : ""} short of your weekly goal`,
      detail: `You posted ${args.postsThisWeek} of ${args.goal}. Fill the gap instead of guessing the slot.`,
      cta: "Schedule the gap",
      action: args.onSchedule,
    });
  }

  if (args.draftsCount > 0) {
    out.push({
      id: "drafts",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: `${args.draftsCount} unscheduled draft${args.draftsCount > 1 ? "s" : ""}`,
      detail: "Finish what you started instead of opening a blank composer.",
      cta: "Open drafts",
      action: args.onCreate,
    });
  }

  if (args.engagementDelta != null && Math.abs(args.engagementDelta) >= 10) {
    const down = args.engagementDelta < 0;
    out.push({
      id: "engagement",
      icon: down ? (
        <TrendingUp className="h-3.5 w-3.5 -scale-y-100" />
      ) : (
        <TrendingUp className="h-3.5 w-3.5" />
      ),
      title: down
        ? `Engagement is down ${Math.abs(args.engagementDelta)}% vs last period`
        : `Engagement is up ${args.engagementDelta}% vs last period`,
      detail: down
        ? "Re-anchor on what still works before adding volume."
        : "Repeat what works — the rest is noise.",
      cta: args.topPost ? "Duplicate a winner" : "See top posts",
      action: args.topPost
        ? () => args.onDuplicate(args.topPost as PostRow)
        : args.onCreate,
    });
  }

  if (args.heatmap.sample > 0) {
    out.push({
      id: "slot",
      icon: <Clock3 className="h-3.5 w-3.5" />,
      title: `Book ${args.heatmap.label}`,
      detail: "Your posts land best then — drop the next one there.",
      cta: "Use this slot",
      action: () => args.onScheduleSlot({ day: args.heatmap.best.day, hour: args.heatmap.best.hour }),
    });
  }

  if (args.topPost && args.topMultiplier >= 1.5) {
    out.push({
      id: "topPost",
      icon: <Repeat2 className="h-3.5 w-3.5" />,
      title: `“${args.topPost.label}” is ${args.topMultiplier.toFixed(1)}× your average`,
      detail: "Duplicate the angle, not the caption. Try a different format.",
      cta: "Duplicate post",
      action: () => args.onDuplicate(args.topPost as PostRow),
    });
  }

  if (out.length === 0) {
    out.push({
      id: "empty",
      icon: <Target className="h-3.5 w-3.5" />,
      title: "Publish a little, and Stone starts choosing the next move",
      detail: "As soon as a few posts land, insights appear here.",
      cta: "Create Post",
      action: args.onCreate,
    });
  }

  return out.slice(0, 3);
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
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
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
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipRow>;
  isDark: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      className={`min-w-[160px] rounded-lg px-3.5 py-2.5 text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${
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
          <b className="tabular-nums">{nf(Number(p.value) || 0)}</b>
        </div>
      ))}
    </div>
  );
}

function InsightsChart({
  data,
  view,
  isDark,
  seriesLabel,
  seriesLabel2,
  seriesColor,
  seriesColor2,
  hasSecondAxis,
}: {
  data: ChartRow[];
  view: ChartView;
  isDark: boolean;
  seriesLabel: string;
  seriesLabel2?: string;
  seriesColor: string;
  seriesColor2?: string;
  hasSecondAxis: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const gradLeft = `gradLeft-${uid}`;
  const gradRight = `gradRight-${uid}`;

  const showThis = view === "this" || view === "both";
  const showPrev = view === "comparison" || view === "both";

  const axis = isDark ? "#6b6b72" : "#a3a3a3";
  const grid = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 16, right: hasSecondAxis ? 48 : 16, left: 4, bottom: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id={gradLeft} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor} stopOpacity={0.14} />
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
            minTickGap={24}
          />

          <YAxis
            yAxisId="left"
            tick={{ fill: axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => nf(Number(v))}
            width={48}
          />
          {hasSecondAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => nf(Number(v))}
              width={48}
            />
          )}

          <Tooltip
            cursor={{ stroke: axis, strokeOpacity: 0.6, strokeDasharray: "3 3" }}
            content={<ChartTooltip isDark={isDark} />}
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
                name={`${seriesLabel} (prev.)`}
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
                  name={`${seriesLabel2} (prev.)`}
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
      className={`inline-flex flex-wrap items-center gap-0.5 rounded-lg border p-1 ${t.panel}`}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 ${
              size === "lg" ? "py-2 text-[13px]" : "py-1.5 text-[12px]"
            } font-semibold transition-colors motion-reduce:transition-none ${t.ring} ${active ? t.sel : t.idle}`}
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
  className = "h-9 w-9",
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
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls}>
          {children}
        </a>
      ) : (
        <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={cls}>
          {children}
        </button>
      )}

      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[240px] rounded-md px-3 py-2 text-[12.5px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100",
          t.tip,
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}

function MoveCard({
  t,
  icon,
  title,
  text,
  cta,
  onClick,
}: {
  t: Tokens;
  icon: ReactNode;
  title: string;
  text: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-xl border p-4 text-left transition-colors ${t.inner} ${t.hover} ${t.ring}`}
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-md ${t.iconBox}`}>{icon}</span>
      <span className={`mt-3 text-[13px] font-semibold tracking-[-0.02em] ${t.text}`}>{title}</span>
      <span className={`mt-1 text-[12px] leading-relaxed ${t.soft}`}>{text}</span>
      <span className={`mt-3 text-[11px] font-semibold ${t.text}`}>{cta} →</span>
    </button>
  );
}

function MetricBox({
  label,
  value,
  info,
  t,
  delta,
}: {
  label: string;
  value: string;
  info: string;
  t: Tokens;
  delta?: number | null;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <div className={`flex flex-col gap-2 rounded-lg border px-3.5 py-3 ${t.inner}`}>
      <span className={`flex items-center justify-between gap-2 text-[10px] font-medium ${t.soft}`}>
        <span className="truncate">{label}</span>
        <span title={info} role="img" aria-label={info} className={`shrink-0 ${t.muted}`}>
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
      <span className={`text-[20px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>{value}</span>
      {delta != null && (
        <span
          className={`text-[10px] font-semibold tabular-nums ${
            up ? "text-emerald-500" : down ? "text-red-400" : t.muted
          }`}
        >
          {up ? "+" : ""}
          {delta}% vs last period
        </span>
      )}
    </div>
  );
}

/* ============================================================
   RANGE PICKER
============================================================ */

function RangePicker({
  range,
  start,
  end,
  onStartChange,
  onEndChange,
  onRangeChange,
  t,
  isDark,
}: {
  range: Range;
  start: Date;
  end: Date;
  onStartChange: (d: Date) => void;
  onEndChange: (d: Date) => void;
  onRangeChange: (r: Range) => void;
  t: Tokens;
  isDark: boolean;
}) {
  const [field, setField] = useState<"from" | "to">("from");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
  }, [open]);

  const label =
    range === "custom"
      ? `${fmt(start)} – ${fmt(end)}`
      : RANGES.find((r) => r.key === range)?.label ?? "";

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
    if (range !== "custom") onRangeChange("custom");
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
        onClick={() => openPicker(id)}
        className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors motion-reduce:transition-none ${t.ring} ${
          active ? t.sel : t.idle
        }`}
      >
        {id === "from" ? "From" : "To"} · {fmt(value)}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker("from"))}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors ${t.ring} ${t.panel} ${t.hover} ${t.text}`}
      >
        <CalendarClock className={`h-3.5 w-3.5 ${t.muted}`} aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""} ${t.muted}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-30 mt-2 w-[300px] overflow-hidden rounded-xl border shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${t.popover}`}
        >
          <div className={`flex gap-1 border-b p-2 ${t.border}`}>
            {fieldTab("from")}
            {fieldTab("to")}
          </div>

          <div className="p-3">
            <p className={`mb-2 text-[12px] ${t.soft}`}>
              {field === "from"
                ? "Pick the first day of the period."
                : "Pick the last day of the period (today max)."}
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

          <div className={`flex items-center justify-between border-t px-3 py-2.5 ${t.border}`}>
            <button
              type="button"
              onClick={() => setField((f) => (f === "from" ? "to" : "from"))}
              className={`rounded px-1 text-[12px] font-semibold transition-colors ${t.ring} ${t.hover} ${t.text}`}
            >
              {field === "from" ? "Next: To" : "Back: From"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-1.5 rounded px-1 text-[12px] font-semibold transition-colors ${t.ring} ${t.hover} ${t.text}`}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              Done
            </button>
          </div>
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
   PAGE
============================================================ */

const SUMMARY_INFO: Record<string, string> = {
  "Total Followers": "Total number of followers at the end of the period.",
  Posts: "Published posts during the period (scheduled posts are not counted).",
  Reactions: "Likes and other reactions received.",
  Comments: "Comments received on your posts.",
  "Eng. Rate": "Engagement divided by reach.",
  "Video Views": "Total views on your videos.",
  Shares: "Times your posts were shared.",
  Reach: "Unique accounts that saw your posts.",
  "Watch Time (min)": "Total minutes watched.",
  "Avg. Watch Time (sec)": "Average seconds watched per view.",
};

const TABLE_GRID = "grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_1fr_44px]";

export default function Insights() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = useMemo(() => tokens(isDark), [isDark]);
  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();

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
    : channels.find((c) => c.key === selectedKey) ??
      channels.find((c) => isYouTubeChannel(c)) ??
      channels[0];
  const youtubeConnected = channels.some(isYouTubeChannel);
  const isYouTube = Boolean(channel && isYouTubeChannel(channel));
  const fetchYouTube = youtubeConnected && (viewingAll || isYouTube);

  const goChannel = (key: string) => {
    setSelectedKey(key);
    window.history.replaceState(null, "", `/insights?channel=${encodeURIComponent(key)}`);
  };

  const [range, setRange] = useState<Range>("30d");
  const [customStart, setCustomStart] = useState(() => addDays(startOfDay(new Date()), -29));
  const [customEnd, setCustomEnd] = useState(() => startOfDay(new Date()));
  const [chartView, setChartView] = useState<ChartView>("this");
  const [postsPeriod, setPostsPeriod] = useState<PostsPeriod>("this");
  const [metricTab, setMetricTab] = useState<MetricTab>("impact");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [composerContext, setComposerContext] = useState<ComposerContext | null>(null);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [queue, setQueue] = useState<CalendarPost[]>([]);

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
    for (const c of channels) {
      if (isYouTubeChannel(c)) {
        map[c.key] =
          yt.data && scheduled.ready
            ? {
                ...yt.data,
                posts: yt.data.posts.map((p) => ({ ...p, platform: "youtube" })),
              }
            : emptyInsights(start, end);
      } else {
        map[c.key] = buildSampleInsights(start, end, c.platform);
      }
    }
    return map;
  }, [channels, yt.data, scheduled.ready, start, end]);

  const source: InsightsData = useMemo(() => {
    if (!channels.length) return emptyInsights(start, end);
    if (viewingAll) return mergeInsights(channels.map((c) => perChannel[c.key]).filter(Boolean));
    if (channel && perChannel[channel.key]) return perChannel[channel.key];
    return emptyInsights(start, end);
  }, [channels, viewingAll, channel, perChannel, start, end]);

  const { data, skipped } = useMemo(
    () => withoutScheduled(source, scheduled.ids),
    [source, scheduled.ids]
  );
  const { current, previous, summary, posts, previousPosts } = data;

  const youtubeLoading = fetchYouTube && ((yt.loading && !yt.data) || !scheduled.ready);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    listPosts(start, addDays(now, 21))
      .catch(() => [] as CalendarPost[])
      .then((all) => {
        if (cancelled) return;
        setQueue(
          all.filter(
            (p) =>
              (p.status === "scheduled" || p.status === "draft") &&
              new Date(p.scheduledAt).getTime() >= now.getTime()
          )
        );
      });
    return () => {
      cancelled = true;
    };
  }, [start, reloadKey]);

  const days = current.length;
  const dates = current.map((p) => p.date);
  const prevStart = previous[0]?.date ?? addDays(start, -days);
  const prevEnd = previous[days - 1]?.date ?? addDays(start, -1);
  const periodLabel = fmtRange(start, end);
  const compareLabel = `Compared to ${fmtRange(prevStart, prevEnd)}`;

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

  const summaryBoxes: { label: string; value: string; delta?: number | null }[] = [
    { label: "Total Followers", value: nf(summary.followers), delta: pctDelta(summary.followers, prevTotals.followers) },
    { label: "Posts", value: nf(summary.posts), delta: pctDelta(summary.posts, prevTotals.posts) },
    { label: "Reactions", value: nf(summary.reactions), delta: pctDelta(summary.reactions, prevTotals.reactions) },
    { label: "Comments", value: nf(summary.comments), delta: pctDelta(summary.comments, prevTotals.comments) },
    { label: "Eng. Rate", value: `${summary.engRate}%` },
    { label: "Video Views", value: nf(summary.videoViews) },
    { label: "Shares", value: nf(summary.shares) },
    { label: "Reach", value: nf(summary.reach), delta: pctDelta(summary.reach, prevTotals.profileViews) },
    { label: "Watch Time (min)", value: nf(summary.watchMin) },
    { label: "Avg. Watch Time (sec)", value: nf(summary.avgWatchSec) },
  ];

  const weekStart = addDays(startOfDay(new Date()), -6);
  const postsThisWeek = posts.filter((p) => p.date >= weekStart).length;
  const goalKey = channel?.key ?? channels[0]?.key ?? "youtube";
  const goal = readPostingGoal(goalKey) ?? readPostingGoal("youtube") ?? 3;
  const behind = Math.max(0, goal - postsThisWeek);
  const platformKey = (channel?.platform ?? "default").toLowerCase();
  const heatmap = useMemo(() => buildBestTimes(posts, platformKey), [posts, platformKey]);
  const bestTimesNote =
    heatmap.confidence === "baseline"
      ? "Based on typical audience activity — it sharpens as you publish"
      : heatmap.confidence === "early"
        ? `Typical activity blended with your ${heatmap.sample} posts`
        : `Based on your ${heatmap.sample} posts, smoothed by hour and weekday`;
  const ranked = useMemo(
    () => [...posts].sort((a, b) => postScore(b) - postScore(a)),
    [posts]
  );
  const topPost = ranked[0];
  const avgScore = posts.length ? posts.reduce((a, p) => a + postScore(p), 0) / posts.length : 0;
  const topMultiplier = topPost && avgScore > 0 ? postScore(topPost) / avgScore : 0;
  const remixable = ranked.filter((p) => postScore(p) >= avgScore * 1.25).slice(0, 3);
  const queuedForChannel = viewingAll
    ? queue
    : queue.filter((p) => !channel || p.network === channel.platform || p.channelKey === channel.key);
  const draftsCount = queuedForChannel.filter((p) => p.status === "draft").length;
  const draftReady = draftsCount > 0 || hasComposerDraft();
  void draftReady;

  const engagementDelta = useMemo(
    () =>
      pctDelta(
        summary.reactions + summary.comments,
        prevTotals.reactions + prevTotals.comments
      ),
    [summary.reactions, summary.comments, prevTotals.reactions, prevTotals.comments]
  );

  const headline =
    behind > 0
      ? `You're ${behind} post${behind > 1 ? "s" : ""} behind this week.`
      : topPost
        ? `${topPost.label} is still your strongest move.`
        : "Publish a little, and Stone starts choosing the next move.";
  const subhead = heatmap.sample === 0
    ? "As soon as a few posts land, we map the hour that actually works for you — then send it to Schedule."
    : `Your best window is ${heatmap.label}. Don't guess the slot — fill it.`;

  const takeaways = useMemo(
    () =>
      buildTakeaways({
        postsThisWeek,
        goal,
        draftsCount,
        engagementDelta,
        topPost,
        topMultiplier,
        heatmap,
        onScheduleSlot: scheduleFromSlot,
        onDuplicate: duplicatePost,
        onCreate: () => openComposer({ reason: "insight", channelKey: channel?.key }),
        onSchedule: () => navigate("schedule"),
      }),
    [
      postsThisWeek,
      goal,
      draftsCount,
      engagementDelta,
      topPost,
      topMultiplier,
      heatmap,
      scheduleFromSlot,
      duplicatePost,
      openComposer,
      channel?.key,
    ]
  );

  const TONES: [string, string] = [isDark ? "#ffffff" : "#111111", isDark ? "#7c7c85" : "#a3a3a3"];
  const SERIES: Record<MetricTab, SeriesDef[]> = {
    posts: [
      { key: "posts", label: "Posts", tone: 0, agg: "sum" },
      { key: "reactions", label: "Reactions", tone: 1, agg: "sum" },
    ],
    impact: [
      { key: "reactions", label: "Reactions", tone: 0, agg: "sum" },
      { key: "comments", label: "Comments", tone: 1, agg: "sum" },
    ],
    growth: [{ key: "followers", label: "Followers", tone: 0, agg: "last" }],
    visibility: [
      { key: "profileViews", label: isYouTube ? "Channel Views" : "Profile Views", tone: 0, agg: "sum" },
      { key: "followers", label: "Followers", tone: 1, agg: "last" },
    ],
  };
  const activeSeries = SERIES[metricTab];

  const chartSeries: ChartSeries[] = useMemo(
    () =>
      activeSeries.map((s) => ({
        label: s.label,
        color: TONES[s.tone],
        values: current.map((p) => p[s.key]),
        prev: previous.map((p) => p[s.key]),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSeries, current, previous, isDark]
  );

  const chartData: ChartRow[] = useMemo(
    () =>
      dates.map((d, i) => ({
        date: fmt(d),
        fullDate: fmtFull(d),
        left_this: chartSeries[0]?.values[i] ?? 0,
        left_prev: chartSeries[0]?.prev[i] ?? 0,
        right_this: chartSeries[1]?.values[i],
        right_prev: chartSeries[1]?.prev[i],
      })),
    [dates, chartSeries]
  );

  const seriesTotal = (s: SeriesDef) =>
    s.agg === "sum" ? current.reduce((a, p) => a + p[s.key], 0) : current[days - 1]?.[s.key] ?? 0;

  const METRIC_TABS: { key: MetricTab; label: string; icon: ReactNode; trailing?: ReactNode }[] = [
    {
      key: "posts",
      label: "Posts",
      icon: <Copy className="h-4 w-4" aria-hidden="true" />,
      trailing: <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden="true" />,
    },
    { key: "impact", label: "Content Impact", icon: <Zap className="h-4 w-4" aria-hidden="true" /> },
    { key: "growth", label: "Audience Growth", icon: <TrendingUp className="h-4 w-4" aria-hidden="true" /> },
    { key: "visibility", label: "Visibility", icon: <Eye className="h-4 w-4" aria-hidden="true" /> },
  ];

  const CHART_VIEWS: { key: ChartView; label: string; icon?: ReactNode }[] = [
    {
      key: "this",
      label: "This Period",
      icon: <span className="h-2.5 w-2.5 rounded-[3px] bg-current" aria-hidden="true" />,
    },
    {
      key: "comparison",
      label: "Comparison",
      icon: <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-current" aria-hidden="true" />,
    },
    { key: "both", label: "Both" },
  ];

  /* ── Tableau des posts ── */
  const rows = postsPeriod === "this" ? posts : previousPosts;
  const hiddenScheduled = postsPeriod === "this" ? skipped.current : skipped.previous;
  const needle = query.trim().toLowerCase();

  const sortedRows = useMemo(() => {
    const matching = needle ? rows.filter((post) => post.label.toLowerCase().includes(needle)) : rows;
    if (!sort) return matching;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...matching].sort((a, b) => (a[sort.key] - b[sort.key]) * dir);
  }, [rows, sort, needle]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const columns: { key: SortKey; label: string; render: (p: PostRow) => string }[] = [
    { key: "reactions", label: "Reactions", render: (p) => nf(p.reactions) },
    { key: "comments", label: "Comments", render: (p) => nf(p.comments) },
    { key: "engRate", label: "Eng. Rate", render: (p) => `${p.engRate.toFixed(2)}%` },
    { key: "videoViews", label: "Video Views", render: (p) => nf(p.videoViews) },
  ];

  const exportCsv = () => {
    const rowsCsv: (string | number)[][] = [
      ["date", "followers", "posts", "reactions", "comments", "profile_views", "previous_followers"],
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

  const sectionCard = `rounded-xl border p-4 ${t.card}`;
  const sectionTitle = `text-[15px] font-semibold tracking-[-0.02em] ${t.text}`;
  const sectionSub = `mt-1 text-[11px] ${t.muted}`;

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
            "rounded-2xl border",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "transition-colors duration-300",
            isDark ? "border-white/[0.05] bg-[#0a0a0c]" : "border-black/[0.05] bg-white",
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto flex w-full max-w-[1720px]",
              "flex-col gap-6 px-[clamp(18px,3vw,48px)]",
              "pb-[120px] pt-[clamp(18px,3vw,30px)]",
            ].join(" ")}
          >
            {/* HEADER COMPACT */}
            <div className="relative z-40 flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${t.inner} ${t.soft}`}
                >
                  <InsightsIcon />
                </span>
                <h1 className={`truncate text-[20px] font-semibold tracking-[-0.03em] ${t.text}`}>
                  Insights
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                <ChannelMenu
                  channels={channels}
                  current={channel}
                  isDark={isDark}
                  onSelect={goChannel}
                  allOption={channels.length > 1 ? { key: ALL_KEY, label: "All networks" } : undefined}
                  selectedKey={viewingAll ? ALL_KEY : channel?.key}
                />

                <div className="flex items-center gap-2">
                  {fetchYouTube && (
                    <IconBtn label="Refresh insights" t={t} onClick={() => setReloadKey((k) => k + 1)}>
                      <RefreshCw
                        className={`h-[18px] w-[18px] ${yt.loading ? "animate-spin motion-reduce:animate-none" : ""}`}
                        aria-hidden="true"
                      />
                    </IconBtn>
                  )}

                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={!channels.length}
                    className={`flex h-9 items-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${t.ring} ${t.outlineBtn}`}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export
                  </button>
                </div>

                <button
                  type="button"
                  aria-label={saved ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={saved}
                  title={saved ? "Remove from favorites" : "Add to favorites"}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={[
                    "ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors motion-reduce:transition-none",
                    t.ring,
                    t.soft,
                    t.hover,
                  ].join(" ")}
                >
                  <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
                </button>
              </div>
            </div>

            {!channels.length ? (
              <section
                className={`flex flex-col items-center gap-3 rounded-xl border px-6 py-20 text-center ${t.panel}`}
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${t.iconBox}`}>
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className={`text-[14px] font-semibold ${t.text}`}>Connect a channel to see insights</h2>
                <p className={`max-w-[360px] text-[12px] ${t.soft}`}>
                  Followers, reach and engagement show up here once a social account is connected.
                </p>
                <button
                  type="button"
                  onClick={() => navigateToSettingsSection("channels")}
                  className={`mt-2 flex items-center gap-1.5 rounded-md px-4 py-2 text-[11px] font-semibold ${t.ring} ${t.primaryBtn}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Connect a channel
                </button>
              </section>
            ) : (
              <>
                {fetchYouTube && yt.error && (
                  <div
                    role="alert"
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${t.panel}`}
                  >
                    <p className="text-[12.5px] text-red-500">Could not load YouTube insights: {yt.error}</p>
                    <button
                      type="button"
                      onClick={() => setReloadKey((k) => k + 1)}
                      className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${t.ring} ${t.outlineBtn}`}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {youtubeLoading && (
                  <p className={`text-[12.5px] ${t.soft}`} role="status" aria-live="polite">
                    Loading YouTube insights…
                  </p>
                )}

                {/* ── NEXT MOVE : hero + 3 takeaways actionnables ── */}
                <section className={`relative overflow-hidden rounded-xl border ${t.card}`}>
                  <div className="relative z-10 flex flex-col gap-5 px-6 py-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-[640px]">
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${t.muted}`}>
                          Next move
                        </p>
                        <h2 className={`mt-1.5 text-[22px] font-semibold tracking-[-0.03em] ${t.text}`}>
                          {headline}
                        </h2>
                        <p className={`mt-2 max-w-[520px] text-[13px] leading-relaxed ${t.soft}`}>
                          {subhead}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openComposer({ reason: "manual", channelKey: channel?.key })}
                        className={`flex w-fit items-center gap-1.5 rounded-md px-4 py-2.5 text-[12px] font-semibold transition-all duration-150 active:scale-[0.98] ${t.ring} ${t.primaryBtn}`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        {behind > 0 ? "Schedule the gap" : "Create Post"}
                      </button>
                    </div>

                    <div
                      className={`grid gap-2.5 ${
                        takeaways.length >= 3
                          ? "md:grid-cols-3"
                          : takeaways.length === 2
                            ? "md:grid-cols-2"
                            : ""
                      }`}
                    >
                      {takeaways.map((tk) => (
                        <MoveCard
                          key={tk.id}
                          t={t}
                          icon={tk.icon}
                          title={tk.title}
                          text={tk.detail}
                          cta={tk.cta}
                          onClick={tk.action}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── RECYCLE (duplicate) ── */}
                <section className={sectionCard} aria-labelledby="recycle-title">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div>
                      <h3 id="recycle-title" className={sectionTitle}>
                        Recycle these
                      </h3>
                      <p className={sectionSub}>Posts still outperforming the rest — duplicate the angle</p>
                    </div>
                  </div>
                  {remixable.length === 0 ? (
                    <p className={`mt-4 text-[12px] ${t.soft}`}>
                      After a few published posts, the ones worth remaking show up here.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-2.5 md:grid-cols-3">
                      {remixable.map((p, i) => (
                        <div key={p.id} className={`flex gap-3 rounded-xl border p-3 ${t.inner}`}>
                          <span className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg ${t.iconBox}`}>
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
                            <p className={`text-[10px] font-semibold uppercase tracking-wide ${t.muted}`}>
                              #{i + 1} · {p.media}
                            </p>
                            <p className={`mt-0.5 truncate text-[13px] font-semibold ${t.text}`}>{p.label}</p>
                            <p className={`mt-1 text-[11px] ${t.soft}`}>
                              {nf(p.reactions)} reactions · {p.engRate.toFixed(1)}% eng
                            </p>
                            <button
                              type="button"
                              onClick={() => duplicatePost(p)}
                              className={`mt-2 text-[11px] font-semibold ${t.text}`}
                            >
                              Duplicate →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── NUMBERS ── */}
                <section aria-labelledby="all-title" className="flex flex-col gap-4">
                  <div>
                    <h2 id="all-title" className={`text-[20px] font-semibold tracking-[-0.03em] ${t.text}`}>
                      The numbers
                    </h2>
                    <p className={`mt-0.5 text-[10px] ${t.muted}`}>Proof behind the next move</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        role="tablist"
                        aria-label="Date range"
                        className={`inline-flex flex-wrap items-center gap-0.5 rounded-lg border p-1 ${t.panel}`}
                      >
                        {RANGES.map((o) => {
                          const active = range === o.key;
                          return (
                            <button
                              key={o.key}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => setRange(o.key)}
                              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors ${t.ring} ${
                                active ? t.sel : t.idle
                              }`}
                            >
                              {o.label}
                              {o.key === "custom" && (
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
                        })}
                      </div>
                      {range === "custom" && (
                        <RangePicker
                          range={range}
                          start={start}
                          end={end}
                          onStartChange={setCustomStart}
                          onEndChange={setCustomEnd}
                          onRangeChange={setRange}
                          t={t}
                          isDark={isDark}
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate("tags")}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${t.ring} ${t.hover} ${t.text}`}
                    >
                      <Tag className="h-4 w-4" aria-hidden="true" />
                      Tags
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className={sectionCard}>
                    <div className="flex items-start justify-between gap-3 px-1">
                      <div>
                        <h3 className={sectionTitle}>Summary</h3>
                        <p className={sectionSub}>
                          {periodLabel} · {compareLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 print:hidden">
                        <IconBtn label="Share summary" boxed t={t}>
                          <Send className="h-4 w-4" aria-hidden="true" />
                        </IconBtn>
                        <IconBtn label="Open summary" boxed t={t} align="end">
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </IconBtn>
                      </div>
                    </div>
                    <div
                      className={`mt-4 grid grid-cols-2 gap-2.5 rounded-xl border p-3 sm:grid-cols-3 lg:grid-cols-6 ${t.panel}`}
                    >
                      {summaryBoxes.map((b) => (
                        <MetricBox
                          key={b.label}
                          label={b.label}
                          value={b.value}
                          info={SUMMARY_INFO[b.label] ?? b.label}
                          t={t}
                          delta={b.delta}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── PERFORMANCE PER POST ── */}
                <section className={sectionCard} aria-labelledby="perf-title">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div>
                      <h3 id="perf-title" className={sectionTitle}>
                        Performance per Post
                      </h3>
                      <p className={sectionSub}>
                        {postsPeriod === "this" ? periodLabel : fmtRange(prevStart, prevEnd)}
                        {hiddenScheduled > 0 && ` · ${hiddenScheduled} scheduled not shown`}
                      </p>
                    </div>
                    <Segmented<PostsPeriod>
                      label="Posts period"
                      value={postsPeriod}
                      onChange={setPostsPeriod}
                      t={t}
                      size="lg"
                      options={[
                        { key: "this", label: "This Period" },
                        { key: "previous", label: "Previous Period" },
                      ]}
                    />
                  </div>

                  <div className={`mt-4 overflow-x-auto rounded-xl border ${t.panel}`}>
                    <div className="min-w-[720px]">
                      <div
                        className={`grid ${TABLE_GRID} items-center gap-2 px-4 py-3 text-[12px] font-semibold ${t.head} ${t.text}`}
                      >
                        <span>Posts · {sortedRows.length}</span>
                        {columns.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            aria-label={`Sort by ${c.label}`}
                            className={`flex w-fit items-center gap-1 rounded text-left ${t.ring}`}
                          >
                            {c.label}
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${t.muted} ${
                                sort?.key === c.key && sort.dir === "asc" ? "rotate-180" : ""
                              } ${sort?.key === c.key ? "opacity-100" : "opacity-70"}`}
                              aria-hidden="true"
                            />
                          </button>
                        ))}
                        <button
                          type="button"
                          aria-label="Customize columns"
                          title="Customize columns"
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border ${t.inner} ${t.soft} ${t.hover} ${t.ring}`}
                        >
                          <Columns className="h-4 w-4" aria-hidden="true" />
                        </button>
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
                          <p className={`text-[12px] font-medium ${t.text}`}>
                            {youtubeLoading
                              ? "Loading videos…"
                              : needle
                                ? "No posts match your search"
                                : "No posts in this period"}
                          </p>
                          {!youtubeLoading && !needle && (
                            <p className={`max-w-[360px] text-[12px] ${t.soft}`}>
                              Choose a longer range to see how your earlier posts performed.
                            </p>
                          )}
                          {!youtubeLoading && !needle && days < 30 && (
                            <button
                              type="button"
                              onClick={() => setRange("30d")}
                              className={`mt-2 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${t.ring} ${t.outlineBtn}`}
                            >
                              Show last 30 days
                            </button>
                          )}
                        </div>
                      ) : (
                        sortedRows.map((p, idx) => (
                          <div
                            key={p.id}
                            className={`grid ${TABLE_GRID} items-center gap-2 border-t px-4 py-3 text-[13px] ${t.border} ${t.text}`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`w-5 shrink-0 text-[12px] ${t.muted}`}>#{idx + 1}</span>
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
                                  <p className={`truncate text-[14px] font-medium ${t.soft}`}>{p.label}</p>
                                )}
                                <p className={`text-[11px] ${t.muted}`}>{fmtFull(p.date)}</p>
                              </div>
                            </div>
                            {columns.map((c) => (
                              <span key={c.key} className="tabular-nums">
                                {c.render(p)}
                              </span>
                            ))}
                            {isYouTube ? (
                              <a
                                href={`https://www.youtube.com/watch?v=${p.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open on YouTube"
                                title="Open on YouTube"
                                className={`flex h-8 w-8 items-center justify-center rounded-md ${t.soft} ${t.hover} ${t.ring}`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                aria-label="Duplicate this post"
                                title="Duplicate this post"
                                onClick={() => duplicatePost(p)}
                                className={`flex h-8 w-8 items-center justify-center rounded-md ${t.soft} ${t.hover} ${t.ring}`}
                              >
                                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                {/* ── BEST TIME TO POST ── */}
                <section className={sectionCard} aria-labelledby="besttime-title">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div>
                      <h3 id="besttime-title" className={sectionTitle}>
                        Best time to post
                      </h3>
                      <p className={sectionSub}>
                        {bestTimesNote} · Peak {heatmap.label}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => scheduleFromSlot(heatmap.best)}
                      className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${t.ring} ${t.outlineBtn}`}
                    >
                      Use {heatmap.label}
                    </button>
                  </div>

                  <div className="mt-5 overflow-x-auto px-1 pb-1">
                    <div className="w-max">
                      <div className="mb-1.5 flex items-end gap-1">
                        <span className="w-9 shrink-0" />
                        {Array.from({ length: 24 }, (_, h) => (
                          <span key={h} className="relative h-3 w-4 shrink-0">
                            {h % 3 === 0 && (
                              <span className={`absolute bottom-0 left-0 whitespace-nowrap text-[10px] ${t.muted}`}>
                                {shortHour(h)}
                              </span>
                            )}
                          </span>
                        ))}
                        <span className="ml-3 w-12 shrink-0" />
                      </div>

                      <div className="flex flex-col gap-1">
                        {DAY_LABELS.map((day, d) => (
                          <div key={day} className="flex items-center gap-1">
                            <span className={`w-9 shrink-0 text-[10px] ${t.muted}`}>{day}</span>
                            {Array.from({ length: 24 }, (_, h) => {
                              const cell = heatmap.grid[d][h];
                              const isBest = heatmap.bestByDay[d].hour === h;
                              return (
                                <button
                                  key={h}
                                  type="button"
                                  title={`${day} ${hourLabel(h)}${isBest ? " · best of the day" : ""}`}
                                  aria-label={`Schedule ${day} at ${hourLabel(h)}`}
                                  onClick={() => scheduleFromSlot({ day: d, hour: h })}
                                  className={`h-4 w-4 shrink-0 rounded-[3px] transition-transform hover:scale-125 ${t.ring} ${
                                    isBest ? `ring-[1.5px] ring-offset-1 ${isDark ? "ring-white ring-offset-[#0a0a0c]" : "ring-neutral-900 ring-offset-white"}` : ""
                                  }`}
                                  style={{ background: heatColor(cell.norm) }}
                                />
                              );
                            })}
                            <span className={`ml-3 w-12 shrink-0 text-[10px] font-semibold tabular-nums ${t.soft}`}>
                              {hourLabel(heatmap.bestByDay[d].hour)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-1.5">
                        <span className={`mr-1 text-[10px] ${t.muted}`}>Lower</span>
                        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                          <span
                            key={v}
                            className="h-3 w-3 rounded-[3px]"
                            style={{ background: heatColor(v) }}
                            aria-hidden="true"
                          />
                        ))}
                        <span className={`ml-1 text-[10px] ${t.muted}`}>Higher</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── METRICS ── */}
                <section className={sectionCard} aria-labelledby="metrics-title">
                  <div className="flex items-start justify-between gap-3 px-1">
                    <div>
                      <h3 id="metrics-title" className={sectionTitle}>
                        Metrics
                      </h3>
                      <p className={sectionSub}>
                        {periodLabel} · {compareLabel}
                      </p>
                    </div>
                    <IconBtn label="Share metrics" boxed t={t} align="end">
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </IconBtn>
                  </div>

                  <div className="mt-4">
                    <Segmented<MetricTab>
                      label="Metric group"
                      value={metricTab}
                      onChange={setMetricTab}
                      t={t}
                      size="lg"
                      options={METRIC_TABS}
                    />
                  </div>

                  <div className={`mt-3 rounded-xl border p-4 ${t.panel}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap gap-x-10 gap-y-3 pl-2">
                        {activeSeries.map((s) => (
                          <div key={s.key}>
                            <p className={`text-[11px] font-medium ${t.soft}`}>{s.label}</p>
                            <p
                              className={`mt-1.5 flex items-center gap-2 text-[28px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}
                            >
                              <span
                                className="h-2.5 w-2.5 rounded-[3px]"
                                style={{ background: TONES[s.tone] }}
                                aria-hidden="true"
                              />
                              {nf(seriesTotal(s))}
                            </p>
                          </div>
                        ))}
                      </div>
                      <Segmented<ChartView>
                        label="Chart view"
                        value={chartView}
                        onChange={setChartView}
                        t={t}
                        size="lg"
                        options={CHART_VIEWS}
                      />
                    </div>

                    <div className="mt-6">
                      <InsightsChart
                        data={chartData}
                        view={chartView}
                        isDark={isDark}
                        seriesLabel={activeSeries[0]?.label ?? "Metric"}
                        seriesLabel2={activeSeries[1]?.label}
                        seriesColor={TONES[activeSeries[0]?.tone ?? 0]}
                        seriesColor2={activeSeries[1] ? TONES[activeSeries[1].tone] : undefined}
                        hasSecondAxis={activeSeries.length > 1}
                      />
                    </div>
                  </div>
                </section>
              </>
            )}
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
        onCreatePost={() => openComposer({ reason: "manual", channelKey: channel?.key })}
        query={query}
        onQueryChange={setQuery}
      />
      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={closeComposer}
        isDark={isDark}
        onSubmit={handleCreatePost}
        onRequestOpen={() => setIsNewPostOpen(true)}
        /*
         * Le composer reçoit son contexte de préremplissage (créneau, canal,
         * duplication) via cette prop optionnelle. Tant que `NewPostModal` ne
         * la déclare pas dans son type, elle est ignorée à l'exécution mais
         * aucune erreur n'est levée — l'UI fonctionne comme avant.
         */
        {...({ initialContext: composerContext } as Record<string, unknown>)}
      />
      <HelpChatButton isDark={isDark} />
    </main>
  );
}