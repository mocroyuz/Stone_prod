// src/pages/Insights.tsx
// Page Insights — même shell arrondi que Home (fond de page + panneau rounded-[28px]).
// Données YouTube réelles via useYouTubeInsights (services/youtube.ts).
//
// ⚠️  Les posts encore programmés ne sont PAS affichés : la page ne montre
//     que les contenus réellement en ligne. Le filtre est appliqué deux fois :
//       - dans `buildPosts` (services/youtube.ts)
//       - dans `isOnlinePost` ci-dessous (défense en profondeur)
//
// ✨ Nouveautés de cette version
//   Demandées :
//     • Variations (deltas) vs période précédente dans le Summary
//     • Nettoyage des éléments factices (fausses cartes, boutons sans action,
//       données d'exemple des autres réseaux)
//   Ajoutées :
//     1. Graphique Line / Bar au choix
//     2. Regroupement automatique par semaine / 30 jours sur les longues périodes
//     3. Préférences mémorisées (période, type de graphique, vue, onglet)
//     4. Champ de recherche visible au-dessus du tableau des posts
//     5. Pagination avec ellipses (1 … 4 5 6 … 50)
//     6. Menu Export (métriques quotidiennes / posts) avec CSV correctement échappé

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Info,
  LineChart,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Search,
  Tag,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
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
import { CalendarPicker } from "../components/CalendarPicker";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import { useConnectedChannels, type ConnectedChannel } from "../hooks/useConnectedChannels";
import { createPosts } from "../services/posts";
import { useYouTubeInsights } from "../services/youtube";
import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "../components/IntegrationIcons";

/** Route de cette page dans la sidebar (section Favorite). */
const PAGE_ROUTE = "insights";

/* ============================================================
   TYPES
============================================================ */

type IconComponent = ComponentType<{ className?: string; size?: number }>;

type Range = "7d" | "30d" | "mtd" | "custom";
type ChartView = "this" | "comparison" | "both";
type ChartType = "line" | "bar";
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
  reactions: number;
  comments: number;
  engRate: number;
  videoViews: number;
  /** Statut backend. Absent = inconnu (compat ancien backend). */
  status?: string;
  /** Date de publication programmée si exposée par le backend. */
  publishAt?: string | null;
};

type SeriesDef = { key: NumKey; label: string; tone: 0 | 1; agg: "sum" | "last" };

type Delta = { text: string; tone: "up" | "down" | "flat" } | null;

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "mtd", label: "Month to Date" },
  { key: "custom", label: "Custom" },
];

const PAGE_SIZE = 10;

/* ============================================================
   PRÉFÉRENCES MÉMORISÉES
============================================================ */

const PREFS_KEY = "insights:prefs:v1";

type Prefs = {
  range: Range;
  chartType: ChartType;
  chartView: ChartView;
  metricTab: MetricTab;
};

const DEFAULT_PREFS: Prefs = {
  range: "30d",
  chartType: "line",
  chartView: "this",
  metricTab: "visibility",
};

const oneOf = <T extends string>(value: unknown, list: readonly T[], fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      // « custom » n'est jamais restauré : les dates personnalisées ne sont pas sauvegardées.
      range: oneOf(p.range, ["7d", "30d", "mtd"] as const, DEFAULT_PREFS.range),
      chartType: oneOf(p.chartType, ["line", "bar"] as const, DEFAULT_PREFS.chartType),
      chartView: oneOf(p.chartView, ["this", "comparison", "both"] as const, DEFAULT_PREFS.chartView),
      metricTab: oneOf(
        p.metricTab,
        ["posts", "impact", "growth", "visibility"] as const,
        DEFAULT_PREFS.metricTab
      ),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

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
};

const tokens = (isDark: boolean): Tokens =>
  isDark
    ? {
        page: "bg-[#050505]",
        text: "text-white",
        muted: "text-neutral-600",
        soft: "text-neutral-400",
        card: "border-white/[0.07] bg-[#0f0f11]",
        panel: "border-white/[0.07] bg-white/[0.025]",
        inner: "border-white/[0.07] bg-white/[0.03]",
        border: "border-white/[0.07]",
        head: "bg-white/[0.03]",
        primaryBtn: "bg-white text-black hover:bg-neutral-200",
        outlineBtn: "border border-white/10 text-white hover:bg-white/[0.07]",
        iconBox: "bg-white/[0.07] text-neutral-300",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        hover: "hover:bg-white/[0.06]",
        sel: "bg-white text-black",
        idle: "text-neutral-400 hover:text-white",
        popover: "border-white/10 bg-[#101012]",
      }
    : {
        page: "bg-[#f5f3ef]",
        text: "text-neutral-900",
        muted: "text-neutral-400",
        soft: "text-neutral-500",
        card: "border-black/[0.06] bg-white",
        panel: "border-black/[0.06] bg-[#f6f4f0]",
        inner: "border-black/[0.06] bg-white",
        border: "border-black/[0.06]",
        head: "bg-[#f6f4f0]",
        primaryBtn: "bg-neutral-900 text-white hover:bg-neutral-700",
        outlineBtn: "border border-black/10 text-neutral-900 hover:bg-neutral-100",
        iconBox: "bg-neutral-200/70 text-neutral-600",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25",
        hover: "hover:bg-black/[0.04]",
        sel: "bg-neutral-900 text-white",
        idle: "text-neutral-500 hover:text-neutral-900",
        popover: "border-black/10 bg-white",
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
const nf = (n: number) => n.toLocaleString("en-US");

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

/* ============================================================
   VARIATIONS (DELTAS)
============================================================ */

/** Variation en pourcentage. `allowNew` : afficher « New » quand la période précédente vaut 0. */
function pctDelta(cur: number, prev: number, allowNew = true): Delta {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  if (prev === 0) return cur === 0 || !allowNew ? null : { text: "New", tone: "up" };
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.05) return { text: "0%", tone: "flat" };
  const digits = Math.abs(pct) >= 10 ? 0 : 1;
  return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(digits)}%`, tone: pct > 0 ? "up" : "down" };
}

/** Variation en points (pour un taux déjà exprimé en %). */
function ptsDelta(cur: number, prev: number): Delta {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  const diff = cur - prev;
  if (Math.abs(diff) < 0.005) return { text: "0 pt", tone: "flat" };
  return { text: `${diff > 0 ? "+" : ""}${diff.toFixed(2)} pt`, tone: diff > 0 ? "up" : "down" };
}

/* ============================================================
   FILTRE « EN LIGNE UNIQUEMENT »
============================================================ */

const SCHEDULED_STATUSES = new Set([
  "scheduled",
  "pending",
  "draft",
  "queued",
  "future",
  "unpublished",
  "processing",
]);

const isOnlinePost = (p: PostRow): boolean => {
  const status = String((p as { status?: unknown }).status ?? "")
    .trim()
    .toLowerCase();
  if (SCHEDULED_STATUSES.has(status)) return false;

  const raw =
    (p as { publishAt?: unknown }).publishAt ??
    (p as { publish_at?: unknown }).publish_at;
  if (raw) {
    const ms =
      typeof raw === "string"
        ? Date.parse(raw)
        : raw instanceof Date
        ? raw.getTime()
        : NaN;
    if (Number.isFinite(ms) && ms > Date.now()) return false;
  }

  if (p.date instanceof Date && p.date.getTime() > Date.now()) return false;
  return true;
};

/* ============================================================
   DONNÉES VIDES (avant chargement / pas de données)
   — plus aucune donnée d'exemple : zéros uniquement.
============================================================ */

function useEmptyInsights(
  start: Date,
  end: Date
): {
  current: Point[];
  previous: Point[];
  summary: Summary;
  posts: PostRow[];
  previousPosts: PostRow[];
} {
  const s = start.getTime();
  const e = end.getTime();

  return useMemo(() => {
    const days = Math.round((e - s) / DAY) + 1;
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
      current: build(new Date(s)),
      previous: build(addDays(new Date(s), -days)),
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
      posts: [] as PostRow[],
      previousPosts: [] as PostRow[],
    };
  }, [s, e]);
}

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

/* ============================================================
   CSV
============================================================ */

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM UTF-8 : Excel ouvre correctement les accents.
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   PAGINATION (avec ellipses)
============================================================ */

function pageItems(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total]);
  for (let i = page - 1; i <= page + 1; i++) if (i >= 1 && i <= total) set.add(i);
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => set.add(n));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

/* ============================================================
   COURBE LISSÉE & CHART (ligne + barres)
============================================================ */

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
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
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
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${
      (pts[i + 1][1] - t[i + 1] * h).toFixed(1)
    } ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

type ChartSeries = { label: string; color: string; values: number[]; prev: number[] };

function Chart({
  dates,
  series,
  view,
  type,
  bucket,
  isDark,
}: {
  dates: Date[];
  series: ChartSeries[];
  view: ChartView;
  type: ChartType;
  /** Nombre de jours regroupés par point (1 = quotidien, 7 = hebdo, 30 = par 30 jours). */
  bucket: number;
  isDark: boolean;
}) {
  const [hoverRaw, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");
  const gradId = `grad-${uid}`;
  const hatchId = `hatch-${uid}`;
  const W = 900;
  const H = 300;
  const pad = { l: 52, r: series.length > 1 ? 52 : 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = dates.length;
  const isBar = type === "bar";

  // Garde-fou : si les données changent (période, regroupement), l'index survolé peut dépasser.
  const hover = hoverRaw !== null && hoverRaw < n ? hoverRaw : null;

  const showThis = view === "this" || view === "both";
  const showPrev = view === "comparison" || view === "both";

  const axis = isDark ? "#6b6b72" : "#a3a3a3";
  const grid = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  const maxes = series.map((s) =>
    Math.max(4, ...(showThis ? s.values : []), ...(showPrev ? s.prev : []))
  );

  // En mode barres, chaque point occupe une « colonne » et x() renvoie son centre.
  const colW = iw / Math.max(1, n);
  const x = (i: number) =>
    isBar ? pad.l + (i + 0.5) * colW : pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (si: number, v: number) => pad.t + ih - (v / maxes[si]) * ih;

  const path = (si: number, vals: number[]) =>
    smoothPath(vals.map((v, i) => [x(i), y(si, v)] as [number, number]));

  const heading = (i: number) =>
    bucket === 1
      ? fmtFull(dates[i])
      : bucket === 7
      ? `Week of ${fmtFull(dates[i])}`
      : `${bucket} days from ${fmtFull(dates[i])}`;

  const ticks = [0, 1, 2, 3, 4];
  const labelIdx = Array.from(new Set([0, 0.5, 1].map((r) => Math.round(r * (n - 1)))));
  const area = isBar
    ? ""
    : `${path(0, series[0].values)} L${x(n - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z`;

  // Disposition des barres à l'intérieur d'une colonne.
  const slots: { si: number; kind: "this" | "prev" }[] = [];
  series.forEach((_, si) => {
    if (showThis) slots.push({ si, kind: "this" });
    if (showPrev) slots.push({ si, kind: "prev" });
  });
  const groupW = colW * 0.72;
  const barW = Math.max(1.5, Math.min(22, groupW / Math.max(1, slots.length)));
  const barGap = slots.length > 1 && barW > 6 ? 1.5 : 0;
  const totalW = barW * slots.length + barGap * Math.max(0, slots.length - 1);

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = isBar
      ? Math.floor((px - pad.l) / colW)
      : n === 1
      ? 0
      : Math.round(((px - pad.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") setHover((h) => (h === null ? 0 : Math.min(n - 1, h + 1)));
    else if (e.key === "ArrowLeft") setHover((h) => (h === null ? n - 1 : Math.max(0, h - 1)));
    else if (e.key === "Home") setHover(0);
    else if (e.key === "End") setHover(n - 1);
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className={`relative rounded-lg focus-visible:outline-none focus-visible:ring-2 ${
        isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25"
      }`}
      tabIndex={0}
      role="group"
      aria-label={`Metrics ${isBar ? "bar" : "line"} chart. Use the left and right arrow keys to inspect each point.`}
      onKeyDown={onKey}
      onBlur={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
          </linearGradient>
          {/* Hachures utilisées pour les barres de la période précédente */}
          {series.map((s, si) => (
            <pattern
              key={`hatch-${si}`}
              id={`${hatchId}-${si}`}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="5" height="5" fill={s.color} fillOpacity="0.12" />
              <line x1="0" y1="0" x2="0" y2="5" stroke={s.color} strokeOpacity="0.7" strokeWidth="2" />
            </pattern>
          ))}
        </defs>

        <text
          x={12}
          y={pad.t + ih / 2}
          fontSize="11"
          fill={axis}
          textAnchor="middle"
          transform={`rotate(-90 12 ${pad.t + ih / 2})`}
        >
          {series[0].label}
        </text>
        {series.length > 1 && (
          <text
            x={W - 12}
            y={pad.t + ih / 2}
            fontSize="11"
            fill={axis}
            textAnchor="middle"
            transform={`rotate(90 ${W - 12} ${pad.t + ih / 2})`}
          >
            {series[1].label}
          </text>
        )}

        {ticks.map((tk) => {
          const yy = pad.t + ih - (tk / 4) * ih;
          return (
            <g key={tk}>
              <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke={grid} />
              <text x={pad.l - 10} y={yy + 3.5} fontSize="11" fill={axis} textAnchor="end" className="tabular-nums">
                {Math.round((tk / 4) * maxes[0])}
              </text>
              {series.length > 1 && (
                <text x={W - pad.r + 10} y={yy + 3.5} fontSize="11" fill={axis} textAnchor="start" className="tabular-nums">
                  {Math.round((tk / 4) * maxes[1])}
                </text>
              )}
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            fontSize="11"
            fill={axis}
            textAnchor={isBar ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          >
            {fmt(dates[i])}
          </text>
        ))}

        {/* ───────── MODE LIGNE ───────── */}
        {!isBar && showPrev &&
          series.map((s, si) => (
            <path
              key={`p-${s.label}`}
              d={path(si, s.prev)}
              fill="none"
              stroke={s.color}
              strokeOpacity="0.5"
              strokeWidth="2"
              strokeDasharray="5 5"
              strokeLinecap="round"
            />
          ))}

        {!isBar && showThis && (
          <>
            <path d={area} fill={`url(#${gradId})`} />
            {series.map((s, si) => (
              <path
                key={s.label}
                d={path(si, s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </>
        )}

        {/* ───────── MODE BARRES ───────── */}
        {isBar && hover !== null && (
          <rect
            x={pad.l + hover * colW}
            y={pad.t}
            width={colW}
            height={ih}
            fill={isDark ? "#ffffff" : "#000000"}
            fillOpacity="0.05"
            rx="4"
          />
        )}

        {isBar &&
          dates.map((_, i) => {
            const startX = x(i) - totalW / 2;
            return (
              <g key={i}>
                {slots.map((slot, k) => {
                  const s = series[slot.si];
                  const v = slot.kind === "this" ? s.values[i] : s.prev[i];
                  const h = Math.max(0, (v / maxes[slot.si]) * ih);
                  // Une valeur à 0 reste visible sous la forme d'un trait fin.
                  const hh = v > 0 ? Math.max(2, h) : 0;
                  const bx = startX + k * (barW + barGap);
                  const isPrev = slot.kind === "prev";
                  return (
                    <g key={`${slot.si}-${slot.kind}`}>
                      {v === 0 && !isPrev && (
                        <rect
                          x={bx}
                          y={pad.t + ih - 1.5}
                          width={barW}
                          height={1.5}
                          fill={s.color}
                          fillOpacity="0.35"
                        />
                      )}
                      {hh > 0 && (
                        <rect
                          x={bx}
                          y={pad.t + ih - hh}
                          width={barW}
                          height={hh}
                          rx={Math.min(3, barW / 2)}
                          ry={Math.min(3, barW / 2)}
                          fill={isPrev ? `url(#${hatchId}-${slot.si})` : s.color}
                          stroke={isPrev ? s.color : "none"}
                          strokeOpacity={isPrev ? 0.5 : 0}
                          strokeWidth={isPrev ? 1 : 0}
                          opacity={hover === null || hover === i ? 1 : 0.55}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

        {/* ───────── CURSEUR (ligne uniquement) ───────── */}
        {!isBar && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={axis} strokeOpacity="0.6" strokeDasharray="3 3" />
            {showThis &&
              series.map((s, si) => (
                <circle
                  key={s.label}
                  cx={x(hover)}
                  cy={y(si, s.values[hover])}
                  r="4.5"
                  fill={isDark ? "#0f0f11" : "#fff"}
                  stroke={s.color}
                  strokeWidth="2.5"
                />
              ))}
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className={`pointer-events-none absolute top-1 min-w-[160px] rounded-xl px-3.5 py-2.5 text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${
            isDark ? "bg-[#101012] text-white ring-1 ring-white/10" : "bg-white text-neutral-900 ring-1 ring-black/10"
          }`}
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > n / 2 ? "-110%" : "10%"})`,
          }}
        >
          <div className="mb-1 text-[11px] opacity-50">{heading(hover)}</div>
          {showThis &&
            series.map((s) => (
              <div key={s.label} className="flex justify-between gap-5">
                <span>{s.label}</span>
                <b className="tabular-nums">{nf(s.values[hover])}</b>
              </div>
            ))}
          {showPrev && (
            <div className="mt-1 flex justify-between gap-5 opacity-60">
              <span>Previous</span>
              <b className="tabular-nums">{series.map((s) => nf(s.prev[hover])).join(" · ")}</b>
            </div>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {hover !== null
          ? `${heading(hover)}: ${series.map((s) => `${s.values[hover]} ${s.label}`).join(", ")}`
          : ""}
      </p>
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
      className={`inline-flex flex-wrap items-center gap-0.5 rounded-xl border p-1 ${t.panel}`}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 ${
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
  children,
  t,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  t: Tokens;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${t.ring} ${t.soft} ${t.hover}`}
    >
      {children}
    </button>
  );
}

function DeltaBadge({ delta, t }: { delta: Delta; t: Tokens }) {
  if (!delta) return <span className="h-4" aria-hidden="true" />;
  const color =
    delta.tone === "up" ? "text-emerald-500" : delta.tone === "down" ? "text-red-500" : t.muted;
  const Icon = delta.tone === "up" ? ArrowUpRight : delta.tone === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={`flex h-4 items-center gap-1 text-[11px] font-semibold tabular-nums ${color}`}
      aria-label={`${delta.text} compared to the previous period`}
      title="Compared to the previous period"
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {delta.text}
    </span>
  );
}

function MetricBox({
  label,
  value,
  info,
  delta,
  t,
}: {
  label: string;
  value: string;
  info: string;
  delta: Delta;
  t: Tokens;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${t.inner}`}>
      <span className={`flex items-center justify-between gap-2 text-[10px] font-medium ${t.soft}`}>
        <span className="truncate">{label}</span>
        <span title={info} className={`shrink-0 ${t.muted}`}>
          <Info className="h-3.5 w-3.5" aria-label={info} />
        </span>
      </span>
      <span className={`text-[20px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>{value}</span>
      <DeltaBadge delta={delta} t={t} />
    </div>
  );
}

const NETWORK_ICONS: Record<string, IconComponent> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  threads: ThreadsIcon,
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  pinterest: PinterestIcon,
};

function channelNetwork(c?: ConnectedChannel): string {
  if (!c) return "";
  const extra = c as ConnectedChannel & {
    network?: string;
    platform?: string;
    provider?: string;
  };
  const raw = c.key ?? extra.network ?? extra.platform ?? extra.provider ?? "";
  return String(raw).toLowerCase();
}

function isYouTubeChannel(c?: ConnectedChannel): boolean {
  if (!c) return false;
  const extra = c as ConnectedChannel & { platform?: string };
  return channelNetwork(c).startsWith("youtube") || extra.platform === "youtube";
}

function NetworkIcon({ channel, isDark }: { channel?: ConnectedChannel; isDark: boolean }) {
  const key = channelNetwork(channel);
  const Icon = Object.entries(NETWORK_ICONS).find(([k]) => key.includes(k))?.[1];
  if (!Icon) return null;
  return (
    <span
      className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black ring-1 ${
        isDark ? "ring-[#0a0a0c]" : "ring-white"
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
    </span>
  );
}

function Avatar({
  channel,
  isDark,
  size = 36,
  showNetwork = true,
}: {
  channel?: ConnectedChannel;
  isDark: boolean;
  size?: number;
  showNetwork?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [channel?.avatarUrl]);
  const label = (channel?.handle || channel?.name || "?").replace(/^@/, "");
  const box = { width: size, height: size };

  return (
    <span className="relative inline-flex shrink-0" style={box}>
      {channel?.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={box}
          className="rounded-full object-cover"
        />
      ) : (
        <span
          style={box}
          className={`flex items-center justify-center rounded-full text-[12px] font-semibold ${
            isDark ? "bg-white text-black" : "bg-neutral-900 text-white"
          }`}
        >
          {label.charAt(0).toUpperCase() || "?"}
        </span>
      )}
      {showNetwork && <NetworkIcon channel={channel} isDark={isDark} />}
    </span>
  );
}

function ChannelMenu({
  channels,
  current,
  t,
  isDark,
}: {
  channels: ConnectedChannel[];
  current?: ConnectedChannel;
  t: Tokens;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = (c?: ConnectedChannel) => (c ? (c.handle || c.name).replace(/^@/, "") : "No channel");
  const canSwitch = channels.length > 1;

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={!canSwitch}
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-3 rounded-xl py-1 pr-2 transition-colors disabled:cursor-default ${t.ring} ${canSwitch ? t.hover : ""}`}
        >
          <Avatar channel={current} isDark={isDark} size={28} />
          <span className={`max-w-[160px] truncate text-[14px] font-semibold tracking-[-0.01em] ${t.text}`}>
            {name(current)}
          </span>
          {canSwitch && <ChevronDown className={`h-4 w-4 ${t.muted}`} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 mt-2 w-64 rounded-2xl border p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${t.popover}`}
        >
          {channels.map((c) => {
            const active = c.key === current?.key;
            return (
              <button
                key={c.key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setOpen(false);
                  navigate(`insights?channel=${encodeURIComponent(c.key)}`);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${t.ring} ${t.hover}`}
              >
                <Avatar channel={c} isDark={isDark} size={28} showNetwork={false} />
                <span className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${t.text}`}>{name(c)}</span>
                {active && <Check className={`h-4 w-4 ${t.text}`} aria-hidden="true" />}
              </button>
            );
          })}
          <div className={`my-1 border-t ${t.border}`} />
          <button
            type="button"
            role="menuitem"
            onClick={() => navigateToSettingsSection("channels")}
            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${t.ring} ${t.hover} ${t.soft}`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-current opacity-60">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            Manage channels
          </button>
        </div>
      )}
    </div>
  );
}

function ExportMenu({
  disabled,
  onDaily,
  onPosts,
  t,
}: {
  disabled: boolean;
  onDaily: () => void;
  onPosts: () => void;
  t: Tokens;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = (label: string, hint: string, action: () => void) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        action();
      }}
      className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors ${t.ring} ${t.hover}`}
    >
      <span className={`text-[12px] font-semibold ${t.text}`}>{label}</span>
      <span className={`text-[11px] ${t.muted}`}>{hint}</span>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold transition-colors disabled:opacity-40 ${t.ring} ${t.outlineBtn}`}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export
        <ChevronDown
          className={`h-3.5 w-3.5 opacity-70 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 mt-2 w-64 rounded-2xl border p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${t.popover}`}
        >
          {item("Daily metrics", "One row per day, with the previous period (.csv)", onDaily)}
          {item("Posts", "Published posts of both periods (.csv)", onPosts)}
        </div>
      )}
    </div>
  );
}

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
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
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
        className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors motion-reduce:transition-none ${t.ring} ${
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
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${t.ring} ${t.panel} ${t.hover} ${t.text}`}
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
          className={`absolute left-0 top-full z-30 mt-2 w-[300px] overflow-hidden rounded-2xl border shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${t.popover}`}
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
              className={`rounded-md px-1 text-[12px] font-semibold transition-colors ${t.ring} ${t.hover} ${t.text}`}
            >
              {field === "from" ? "Next: To" : "Back: From"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-1.5 rounded-md px-1 text-[12px] font-semibold transition-colors ${t.ring} ${t.hover} ${t.text}`}
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
      <path d="M5 18V9M12 18V5M19 18v-7M3 20h18" />
    </svg>
  );
}

/* ============================================================
   PAGE
============================================================ */

const SUMMARY_INFO: Record<string, string> = {
  "Total Followers": "Total number of followers at the end of the period.",
  Posts: "Posts published during the period (scheduled posts excluded).",
  Reactions: "Likes and other reactions received.",
  Comments: "Comments received on your posts.",
  "Eng. Rate": "Engagement divided by reach.",
  "Video Views": "Total views on your videos.",
  Shares: "Times your posts were shared.",
  Reach: "Unique accounts that saw your posts.",
  "Watch Time (min)": "Total minutes watched.",
  "Avg. Watch Time (sec)": "Average seconds watched per view.",
};

const sumKey = (pts: Point[], k: NumKey) => pts.reduce((a, p) => a + p[k], 0);
const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export default function Insights() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = useMemo(() => tokens(isDark), [isDark]);
  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();
  const channelKey = useHashChannel();
  const channel = channels.find((c) => c.key === channelKey) ?? channels[0];
  const isYouTube = isYouTubeChannel(channel);

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  // Préférences restaurées depuis le localStorage (valeurs validées).
  const [initialPrefs] = useState<Prefs>(loadPrefs);

  const [range, setRange] = useState<Range>(initialPrefs.range);
  const [customStart, setCustomStart] = useState(() => addDays(startOfDay(new Date()), -29));
  const [customEnd, setCustomEnd] = useState(() => startOfDay(new Date()));
  const [chartView, setChartView] = useState<ChartView>(initialPrefs.chartView);
  const [chartType, setChartType] = useState<ChartType>(initialPrefs.chartType);
  const [postsPeriod, setPostsPeriod] = useState<PostsPeriod>("this");
  const [metricTab, setMetricTab] = useState<MetricTab>(initialPrefs.metricTab);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // ── PAGINATION STATE ──
  const [page, setPage] = useState(1);

  // Sauvegarde des préférences
  useEffect(() => {
    try {
      const prefs: Prefs = {
        range: range === "custom" ? "30d" : range,
        chartType,
        chartView,
        metricTab,
      };
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, [range, chartType, chartView, metricTab]);

  // Reset de la page si les filtres changent
  useEffect(() => {
    setPage(1);
  }, [postsPeriod, range, query, sort]);

  const { start, end } = useMemo(
    () => resolveRange(range, customStart, customEnd),
    [range, customStart, customEnd]
  );

  const yt = useYouTubeInsights(start, end, isYouTube && Boolean(channel), reloadKey);
  const fallback = useEmptyInsights(start, end);
  const raw = isYouTube && yt.data ? yt.data : fallback;

  const posts = useMemo(() => raw.posts.filter(isOnlinePost), [raw.posts]);
  const previousPosts = useMemo(
    () => raw.previousPosts.filter(isOnlinePost),
    [raw.previousPosts]
  );
  const summary = useMemo<Summary>(
    () => ({ ...raw.summary, posts: posts.length }),
    [raw.summary, posts.length]
  );

  useEffect(() => {
    if (!isYouTube || !yt.data) return;
    const totalThis = raw.posts.length;
    const totalPrev = raw.previousPosts.length;
    const keptThis = posts.length;
    const keptPrev = previousPosts.length;
    const droppedThis = totalThis - keptThis;
    const droppedPrev = totalPrev - keptPrev;
    if (totalThis === 0 && totalPrev === 0) return;
    // eslint-disable-next-line no-console
    console.warn(
      `[Insights] period posts: ${totalThis} total → ${keptThis} kept (${droppedThis} scheduled filtered out) · previous: ${totalPrev} total → ${keptPrev} kept (${droppedPrev} scheduled filtered out)`
    );
  }, [isYouTube, yt.data, raw.posts, raw.previousPosts, posts.length, previousPosts.length]);

  const current = raw.current;
  const previous = raw.previous;

  const days = current.length;
  const dates = current.map((p) => p.date);
  const prevStart = previous[0].date;
  const prevEnd = previous[days - 1].date;
  const periodLabel = fmtRange(start, end);
  const compareLabel = `Compared to ${fmtRange(prevStart, prevEnd)}`;

  const summaryBoxes: { label: string; value: string }[] = [
    { label: "Total Followers", value: nf(summary.followers) },
    { label: "Posts", value: nf(summary.posts) },
    { label: "Reactions", value: nf(summary.reactions) },
    { label: "Comments", value: nf(summary.comments) },
    { label: "Eng. Rate", value: `${summary.engRate}%` },
    { label: "Video Views", value: nf(summary.videoViews) },
    { label: "Shares", value: nf(summary.shares) },
    { label: "Reach", value: nf(summary.reach) },
    { label: "Watch Time (min)", value: nf(summary.watchMin) },
    { label: "Avg. Watch Time (sec)", value: nf(summary.avgWatchSec) },
  ];

  // Variations : uniquement pour les métriques dont on dispose réellement
  // pour la période précédente (points quotidiens + posts).
  const curEng = mean(posts.map((p) => p.engRate));
  const prevEng = mean(previousPosts.map((p) => p.engRate));
  const deltas: Record<string, Delta> = {
    "Total Followers": pctDelta(
      current[days - 1]?.followers ?? 0,
      previous[days - 1]?.followers ?? 0,
      false
    ),
    Posts: pctDelta(posts.length, previousPosts.length),
    Reactions: pctDelta(sumKey(current, "reactions"), sumKey(previous, "reactions")),
    Comments: pctDelta(sumKey(current, "comments"), sumKey(previous, "comments")),
    "Eng. Rate": curEng !== null && prevEng !== null ? ptsDelta(curEng, prevEng) : null,
  };

  // Regroupement automatique pour garder un graphique lisible.
  const bucket = days > 180 ? 30 : days > 60 ? 7 : 1;
  const bucketValues = (vals: number[], agg: "sum" | "last"): number[] => {
    if (bucket === 1) return vals;
    const out: number[] = [];
    for (let i = 0; i < vals.length; i += bucket) {
      const slice = vals.slice(i, i + bucket);
      out.push(agg === "sum" ? slice.reduce((a, b) => a + b, 0) : slice[slice.length - 1]);
    }
    return out;
  };
  const chartDates = bucket === 1 ? dates : dates.filter((_, i) => i % bucket === 0);

  const TONES = [isDark ? "#ffffff" : "#111111", isDark ? "#7c7c85" : "#a3a3a3"];
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
  const chartSeries: ChartSeries[] = activeSeries.map((s) => ({
    label: s.label,
    color: TONES[s.tone],
    values: bucketValues(current.map((p) => p[s.key]), s.agg),
    prev: bucketValues(previous.map((p) => p[s.key]), s.agg),
  }));
  const seriesTotal = (s: SeriesDef) =>
    s.agg === "sum" ? current.reduce((a, p) => a + p[s.key], 0) : current[days - 1]?.[s.key] ?? 0;

  const METRIC_TABS: { key: MetricTab; label: string; icon: ReactNode }[] = [
    { key: "posts", label: "Posts", icon: <Copy className="h-4 w-4" aria-hidden="true" /> },
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

  const CHART_TYPES: { key: ChartType; label: string; icon: ReactNode }[] = [
    { key: "line", label: "Line", icon: <LineChart className="h-4 w-4" aria-hidden="true" /> },
    { key: "bar", label: "Bar", icon: <BarChart3 className="h-4 w-4" aria-hidden="true" /> },
  ];

  const rows = postsPeriod === "this" ? posts : previousPosts;
  const needle = query.trim().toLowerCase();
  const sortedRows = useMemo(() => {
    const matchingRows = needle
      ? rows.filter((post) => post.label.toLowerCase().includes(needle))
      : rows;
    if (!sort) return matchingRows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...matchingRows].sort((a, b) => (a[sort.key] - b[sort.key]) * dir);
  }, [rows, sort, needle]);

  // ── PAGINATION CALCULS ──
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const columns: { key: SortKey; label: string; render: (p: PostRow) => string }[] = [
    { key: "reactions", label: "Reactions", render: (p) => nf(p.reactions) },
    { key: "comments", label: "Comments", render: (p) => nf(p.comments) },
    { key: "engRate", label: "Eng. Rate", render: (p) => `${p.engRate.toFixed(2)}%` },
    { key: "videoViews", label: "Video Views", render: (p) => nf(p.videoViews) },
  ];
  const TABLE_GRID = "grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_1fr_44px]";

  const ytUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

  const exportDailyCsv = () => {
    const rowsCsv: (string | number)[][] = [
      [
        "date",
        "followers",
        "posts",
        "reactions",
        "comments",
        "profile_views",
        "previous_date",
        "previous_followers",
        "previous_posts",
        "previous_reactions",
        "previous_comments",
        "previous_profile_views",
      ],
    ];
    current.forEach((p, i) => {
      const q = previous[i];
      rowsCsv.push([
        toInput(p.date),
        p.followers,
        p.posts,
        p.reactions,
        p.comments,
        p.profileViews,
        q ? toInput(q.date) : "",
        q?.followers ?? "",
        q?.posts ?? "",
        q?.reactions ?? "",
        q?.comments ?? "",
        q?.profileViews ?? "",
      ]);
    });
    downloadCsv(`insights-daily-${toInput(start)}-${toInput(end)}.csv`, rowsCsv);
  };

  const exportPostsCsv = () => {
    const header: (string | number)[] = [
      "period",
      "id",
      "title",
      "published_at",
      "reactions",
      "comments",
      "eng_rate_pct",
      "video_views",
      "url",
    ];
    const mk = (period: string, list: PostRow[]): (string | number)[][] =>
      list.map((p) => [
        period,
        p.id,
        p.label,
        toInput(p.date),
        p.reactions,
        p.comments,
        p.engRate.toFixed(2),
        p.videoViews,
        ytUrl(p.id),
      ]);
    downloadCsv(`insights-posts-${toInput(start)}-${toInput(end)}.csv`, [
      header,
      ...mk("this", posts),
      ...mk("previous", previousPosts),
    ]);
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
    m === "video" ? <Play className="h-4 w-4" /> : m === "text" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />;

  const sectionCard = `rounded-2xl border p-4 ${t.card}`;
  const sectionTitle = `text-[15px] font-semibold tracking-[-0.02em] ${t.text}`;
  const sectionSub = `mt-1 text-[11px] ${t.muted}`;

  const youtubeLoading = isYouTube && yt.loading && !yt.data;

  // La bannière d'encouragement n'a de sens que si la chaîne a peu publié.
  const showBanner =
    isYouTube && !youtubeLoading && !yt.error && posts.length < 3 && previousPosts.length < 3;

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
            "rounded-[28px] border",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "transition-colors duration-300",
            isDark
              ? "border-white/[0.07] bg-[#0a0a0c]"
              : "border-black/[0.06] bg-white",
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
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${t.inner} ${t.soft}`}
                >
                  <InsightsIcon />
                </span>
                <h1 className={`truncate text-[20px] font-semibold tracking-[-0.03em] ${t.text}`}>
                  Insights
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                <ChannelMenu channels={channels} current={channel} t={t} isDark={isDark} />

                {isYouTube && (
                  <IconBtn label="Refresh insights" t={t} onClick={() => setReloadKey((k) => k + 1)}>
                    <RefreshCw
                      className={`h-4 w-4 ${yt.loading ? "animate-spin motion-reduce:animate-none" : ""}`}
                      aria-hidden="true"
                    />
                  </IconBtn>
                )}

                <ExportMenu
                  disabled={!channel || !isYouTube}
                  onDaily={exportDailyCsv}
                  onPosts={exportPostsCsv}
                  t={t}
                />

                <button
                  type="button"
                  aria-label={saved ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={saved}
                  title={saved ? "Remove from favorites" : "Add to favorites"}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none",
                    t.ring,
                    t.soft,
                    t.hover,
                  ].join(" ")}
                >
                  <Bookmark
                    className={`h-4 w-4 ${saved ? "fill-current" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {!channel ? (
              <section className={`flex flex-col items-center gap-3 rounded-2xl border px-6 py-20 text-center ${t.panel}`}>
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
                  className={`mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold ${t.ring} ${t.primaryBtn}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Connect a channel
                </button>
              </section>
            ) : !isYouTube ? (
              <section className={`flex flex-col items-center gap-3 rounded-2xl border px-6 py-20 text-center ${t.panel}`}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${t.iconBox}`}>
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className={`text-[14px] font-semibold ${t.text}`}>
                  Insights for this network are coming soon
                </h2>
                <p className={`max-w-[380px] text-[12px] ${t.soft}`}>
                  Real statistics are only available for YouTube channels for now. Switch to a
                  YouTube channel from the menu above to see your insights.
                </p>
              </section>
            ) : (
              <>
                {yt.error && (
                  <div
                    role="alert"
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${t.panel}`}
                  >
                    <p className="text-[12.5px] text-red-500">
                      Could not load YouTube insights: {yt.error}
                    </p>
                    <button
                      type="button"
                      onClick={() => setReloadKey((k) => k + 1)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${t.ring} ${t.outlineBtn}`}
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

                {/* BANNIÈRE — uniquement si la chaîne a peu publié */}
                {showBanner && (
                  <section className={`relative overflow-hidden rounded-2xl border ${t.card}`}>
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${
                        isDark
                          ? "from-white/[0.06] via-transparent to-transparent"
                          : "from-black/[0.04] via-transparent to-transparent"
                      }`}
                    />
                    <div className="relative z-10 flex flex-col justify-center gap-4 px-6 py-6">
                      <div>
                        <h2 className={`text-[20px] font-semibold tracking-[-0.03em] ${t.text}`}>
                          Post more to unlock weekly takeaways
                        </h2>
                        <p className={`mt-2 max-w-[460px] text-[13px] leading-relaxed ${t.soft}`}>
                          Your channel has published fewer than 3 videos in the last two periods.
                          Share a few more and your trends will become much easier to read.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("new-post")}
                        className={`flex w-fit items-center gap-1.5 rounded-lg px-4 py-2.5 text-[12px] font-semibold transition-all duration-150 active:scale-[0.98] ${t.ring} ${t.primaryBtn}`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Create Post
                      </button>
                    </div>
                  </section>
                )}

                {/* ALL INSIGHTS */}
                <section aria-labelledby="all-title" className="flex flex-col gap-4">
                  <div>
                    <h2 id="all-title" className={`text-[20px] font-semibold tracking-[-0.03em] ${t.text}`}>
                      All Insights
                    </h2>
                    <p className={`mt-0.5 text-[10px] ${t.muted}`}>Your activity at a glance</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        role="tablist"
                        aria-label="Date range"
                        className={`inline-flex flex-wrap items-center gap-0.5 rounded-xl border p-1 ${t.panel}`}
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
                              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${t.ring} ${
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
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${t.ring} ${t.hover} ${t.text}`}
                    >
                      <Tag className="h-4 w-4" aria-hidden="true" />
                      Tags
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  {/* SUMMARY */}
                  <div className={sectionCard}>
                    <div className="px-1">
                      <h3 className={sectionTitle}>Summary</h3>
                      <p className={sectionSub}>
                        {periodLabel} · {compareLabel}
                      </p>
                    </div>
                    <div className={`mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border p-3 sm:grid-cols-3 lg:grid-cols-6 ${t.panel}`}>
                      {summaryBoxes.map((b) => (
                        <MetricBox
                          key={b.label}
                          label={b.label}
                          value={b.value}
                          info={SUMMARY_INFO[b.label] ?? b.label}
                          delta={deltas[b.label] ?? null}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* PERFORMANCE PER POST */}
                <section className={sectionCard} aria-labelledby="perf-title">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div>
                      <h3 id="perf-title" className={sectionTitle}>
                        Performance per Post
                      </h3>
                      <p className={sectionSub}>
                        {postsPeriod === "this" ? periodLabel : fmtRange(prevStart, prevEnd)}
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

                  {/* RECHERCHE */}
                  <div className="relative mt-4 max-w-[340px]">
                    <Search
                      className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search posts…"
                      aria-label="Search posts by title"
                      className={`w-full rounded-xl border py-2 pl-9 pr-9 text-[12px] placeholder:text-neutral-500 ${t.panel} ${t.text} ${t.ring}`}
                    />
                    {query && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                        className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md ${t.soft} ${t.hover} ${t.ring}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className={`mt-3 overflow-x-auto rounded-2xl border ${t.panel}`}>
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
                            className={`flex w-fit items-center gap-1 rounded-md text-left ${t.ring}`}
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
                        <span aria-hidden="true" />
                      </div>

                      {paginatedRows.length === 0 ? (
                        needle && rows.length > 0 ? (
                          <div className={`flex flex-col items-center gap-2 border-t px-6 py-10 text-center ${t.border}`}>
                            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${t.iconBox}`}>
                              <Search className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <p className={`text-[12px] font-medium ${t.text}`}>
                              No post matches “{query.trim()}”
                            </p>
                            <button
                              type="button"
                              onClick={() => setQuery("")}
                              className={`mt-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${t.ring} ${t.outlineBtn}`}
                            >
                              Clear search
                            </button>
                          </div>
                        ) : (
                          <div className={`flex flex-col items-center gap-2 border-t px-6 py-10 text-center ${t.border}`}>
                            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${t.iconBox}`}>
                              <Activity className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <p className={`text-[12px] font-medium ${t.text}`}>
                              {youtubeLoading ? "Loading videos…" : "No published posts in this period"}
                            </p>
                            {!youtubeLoading && (
                              <p className={`max-w-[360px] text-[12px] ${t.soft}`}>
                                Choose a longer range to see how your earlier posts performed.
                              </p>
                            )}
                            {!youtubeLoading && days < 30 && (
                              <button
                                type="button"
                                onClick={() => setRange("30d")}
                                className={`mt-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${t.ring} ${t.outlineBtn}`}
                              >
                                Show last 30 days
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        paginatedRows.map((p, idx) => {
                          const globalIdx = (safePage - 1) * PAGE_SIZE + idx + 1;
                          return (
                            <div
                              key={p.id}
                              className={`grid ${TABLE_GRID} items-center gap-2 border-t px-4 py-3 text-[13px] ${t.border} ${t.text}`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className={`w-5 shrink-0 text-[12px] ${t.muted}`}>#{globalIdx}</span>
                                <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${t.iconBox}`}>
                                  {p.thumbnailUrl ? (
                                    <img src={p.thumbnailUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                                  ) : (
                                    mediaIcon(p.media)
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <a
                                    href={ytUrl(p.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`block truncate rounded text-[14px] font-medium hover:underline ${t.soft} ${t.ring}`}
                                  >
                                    {p.label}
                                  </a>
                                  <p className={`text-[11px] ${t.muted}`}>{fmtFull(p.date)}</p>
                                </div>
                              </div>
                              {columns.map((c) => (
                                <span key={c.key} className="tabular-nums">
                                  {c.render(p)}
                                </span>
                              ))}
                              <a
                                href={ytUrl(p.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open “${p.label}” on YouTube`}
                                title="Open on YouTube"
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.soft} ${t.hover} ${t.ring}`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              </a>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* PAGINATION UI (avec ellipses) */}
                  {totalPages > 1 && (
                    <nav aria-label="Posts pagination" className="mt-4 flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPage(Math.max(1, safePage - 1))}
                        disabled={safePage === 1}
                        aria-label="Previous page"
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${t.ring} ${t.soft} ${t.hover}`}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {pageItems(safePage, totalPages).map((item, i) => {
                        if (item === "…") {
                          return (
                            <span
                              key={`gap-${i}`}
                              aria-hidden="true"
                              className={`flex h-8 w-6 items-center justify-center text-[12px] ${t.muted}`}
                            >
                              …
                            </span>
                          );
                        }
                        const active = safePage === item;
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setPage(item)}
                            aria-current={active ? "page" : undefined}
                            aria-label={`Page ${item}`}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[12px] font-semibold tabular-nums transition-colors ${t.ring} ${
                              active ? t.sel : `${t.soft} ${t.hover}`
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                        disabled={safePage === totalPages}
                        aria-label="Next page"
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${t.ring} ${t.soft} ${t.hover}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </nav>
                  )}
                </section>

                {/* METRICS */}
                <section className={sectionCard} aria-labelledby="metrics-title">
                  <div className="px-1">
                    <h3 id="metrics-title" className={sectionTitle}>
                      Metrics
                    </h3>
                    <p className={sectionSub}>
                      {periodLabel} · {compareLabel}
                    </p>
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

                  <div className={`mt-3 rounded-2xl border p-4 ${t.panel}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap gap-x-10 gap-y-3 pl-2">
                        {activeSeries.map((s) => (
                          <div key={s.key}>
                            <p className={`text-[11px] font-medium ${t.soft}`}>{s.label}</p>
                            <p className={`mt-1.5 flex items-center gap-2 text-[28px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>
                              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TONES[s.tone] }} aria-hidden="true" />
                              {nf(seriesTotal(s))}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Choix du type de graphique + choix de la vue */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Segmented<ChartType>
                          label="Chart type"
                          value={chartType}
                          onChange={setChartType}
                          t={t}
                          size="lg"
                          options={CHART_TYPES}
                        />
                        <Segmented<ChartView>
                          label="Chart view"
                          value={chartView}
                          onChange={setChartView}
                          t={t}
                          size="lg"
                          options={CHART_VIEWS}
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      <Chart
                        dates={chartDates}
                        series={chartSeries}
                        view={chartView}
                        type={chartType}
                        bucket={bucket}
                        isDark={isDark}
                      />
                    </div>

                    {bucket > 1 && (
                      <p className={`mt-3 text-[11px] ${t.muted}`}>
                        Grouped by {bucket === 7 ? "week" : "30-day period"} to keep the chart
                        readable: totals are summed, followers show the last value of each group.
                      </p>
                    )}
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