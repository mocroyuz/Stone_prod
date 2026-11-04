// src/pages/Insights.tsx
// Page Insights — même shell arrondi que Home (fond de page + panneau rounded-[28px]).
// Données YouTube réelles via useYouTubeInsights (services/youtube.ts).
//
// ⚠️  Aucun nombre inventé : toute valeur affichée provient d'une donnée réelle.
//     Quand une métrique n'est pas disponible, on affiche « — » (jamais un 0 trompeur).
//
// ⚠️  Les posts encore programmés ne sont PAS affichés : la page ne montre
//     que les contenus réellement en ligne. Le filtre est appliqué deux fois :
//       - dans `buildPosts` (services/youtube.ts)
//       - dans `isOnlinePost` ci-dessous (défense en profondeur)
//
// Direction UI : minimaliste.
//   • sections séparées par de l'espace et des filets très fins
//   • onglets soulignés (texte seul)
//   • statistiques : grandes stats + mini-courbes réelles, puis stats secondaires
//   • tableau en lignes simples, barre relative sur les réactions
//   • graphique responsive, graduations « rondes »

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
  BarChart3,
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LineChart,
  Play,
  Plus,
  RefreshCw,
  Search,
  Tag,
  X,
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
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "mtd", label: "Month to date" },
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
   STYLE — tokens alignés sur le shell Home
============================================================ */

type Tokens = {
  page: string;
  text: string;
  muted: string;
  soft: string;
  border: string;
  track: string;
  thumb: string;
  hover: string;
  ring: string;
  sel: string;
  idle: string;
  underline: string;
  popover: string;
  primaryBtn: string;
  outlineBtn: string;
};

const tokens = (isDark: boolean): Tokens =>
  isDark
    ? {
        page: "bg-[#050505]",
        text: "text-white",
        muted: "text-neutral-500",
        soft: "text-neutral-400",
        border: "border-white/[0.07]",
        track: "bg-white/[0.05]",
        thumb: "bg-white/[0.06] text-neutral-400",
        hover: "hover:bg-white/[0.06]",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        sel: "bg-white text-black",
        idle: "text-neutral-400 hover:text-white",
        underline: "bg-white",
        popover: "border-white/10 bg-[#101012]",
        primaryBtn: "bg-white text-black hover:bg-neutral-200",
        outlineBtn: "border border-white/10 text-white hover:bg-white/[0.07]",
      }
    : {
        page: "bg-[#f5f3ef]",
        text: "text-neutral-900",
        muted: "text-neutral-500",
        soft: "text-neutral-600",
        border: "border-black/[0.07]",
        track: "bg-black/[0.04]",
        thumb: "bg-neutral-100 text-neutral-500",
        hover: "hover:bg-black/[0.04]",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25",
        sel: "bg-neutral-900 text-white",
        idle: "text-neutral-500 hover:text-neutral-900",
        underline: "bg-neutral-900",
        popover: "border-black/10 bg-white",
        primaryBtn: "bg-neutral-900 text-white hover:bg-neutral-700",
        outlineBtn: "border border-black/10 text-neutral-900 hover:bg-neutral-100",
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
const fmtRange = (a: Date, b: Date) => `${fmt(a)} – ${fmtFull(b)}`;
const nf = (n: number) => n.toLocaleString("en-US");

const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const nfc = (n: number) => (n >= 1000 ? compactFmt.format(n) : String(n));

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

/** Variation en pourcentage. Pas de variation si la période précédente vaut 0. */
function pctDelta(cur: number, prev: number): Delta {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  if (prev === 0) return null;
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
   Ces zéros ne sont JAMAIS affichés comme des mesures : l'UI
   utilise `hasData` pour afficher « — » ou un état vide.
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
   COURBE LISSÉE & CHART (ligne + barres, responsive)
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

/** Pas « rond » (1, 2, 5, 10, 20, 50…) pour 4 graduations entières. */
function niceStep(max: number): number {
  const raw = Math.max(max, 4) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return m * pow;
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [hoverRaw, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");
  const gradId = `grad-${uid}`;
  const hatchId = `hatch-${uid}`;

  // Largeur réelle du conteneur : la typographie garde sa taille sur mobile.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.round(el.clientWidth)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = W < 520;
  const H = narrow ? 240 : 320;
  const pad = { l: 40, r: series.length > 1 ? 40 : 8, t: 12, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = dates.length;
  const isBar = type === "bar";

  // Garde-fou : si les données changent (période, regroupement), l'index survolé peut dépasser.
  const hover = hoverRaw !== null && hoverRaw < n ? hoverRaw : null;

  const showThis = view === "this" || view === "both";
  const showPrev = view === "comparison" || view === "both";

  const axis = isDark ? "#6b6b72" : "#8a8a90";
  const grid = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";

  const peaks = series.map((s) =>
    Math.max(0, ...(showThis ? s.values : []), ...(showPrev ? s.prev : []))
  );
  const steps = peaks.map(niceStep);
  const maxes = steps.map((s) => s * 4);

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
  const labelCount = narrow ? 3 : 5;
  const labelIdx = Array.from(
    new Set(
      Array.from({ length: labelCount }, (_, k) =>
        n <= 1 ? 0 : Math.round((k * (n - 1)) / (labelCount - 1))
      )
    )
  );
  const area = isBar
    ? ""
    : `${path(0, series[0].values)} L${x(n - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z`;

  // Disposition des barres à l'intérieur d'une colonne.
  const slots: { si: number; kind: "this" | "prev" }[] = [];
  series.forEach((_, si) => {
    if (showThis) slots.push({ si, kind: "this" });
    if (showPrev) slots.push({ si, kind: "prev" });
  });
  const groupW = colW * 0.7;
  const barW = Math.max(1.5, Math.min(18, groupW / Math.max(1, slots.length)));
  const barGap = slots.length > 1 && barW > 6 ? 1.5 : 0;
  const totalW = barW * slots.length + barGap * Math.max(0, slots.length - 1);

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) * (W / (r.width || W));
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
      ref={wrapRef}
      className={`relative w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 ${
        isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25"
      }`}
      tabIndex={0}
      role="group"
      aria-label={`Metrics ${isBar ? "bar" : "line"} chart. Use the left and right arrow keys to inspect each point.`}
      onKeyDown={onKey}
      onBlur={() => setHover(null)}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block touch-pan-y"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity="0.12" />
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
              <rect width="5" height="5" fill={s.color} fillOpacity="0.1" />
              <line x1="0" y1="0" x2="0" y2="5" stroke={s.color} strokeOpacity="0.7" strokeWidth="2" />
            </pattern>
          ))}
        </defs>

        {ticks.map((tk) => {
          const yy = pad.t + ih - (tk / 4) * ih;
          return (
            <g key={tk}>
              <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke={grid} />
              <text x={pad.l - 8} y={yy + 3.5} fontSize="11" fill={axis} textAnchor="end" className="tabular-nums">
                {nfc(steps[0] * tk)}
              </text>
              {series.length > 1 && (
                <text x={W - pad.r + 8} y={yy + 3.5} fontSize="11" fill={axis} textAnchor="start" className="tabular-nums">
                  {nfc(steps[1] * tk)}
                </text>
              )}
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
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
              strokeWidth="1.75"
              strokeDasharray="4 5"
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
                strokeWidth="2"
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
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={axis} strokeOpacity="0.5" strokeDasharray="3 3" />
            {showThis &&
              series.map((s, si) => (
                <circle
                  key={s.label}
                  cx={x(hover)}
                  cy={y(si, s.values[hover])}
                  r="4"
                  fill={isDark ? "#0a0a0c" : "#fff"}
                  stroke={s.color}
                  strokeWidth="2"
                />
              ))}
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className={`pointer-events-none absolute top-0 min-w-[150px] rounded-lg px-3 py-2 text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.3)] ${
            isDark ? "bg-[#101012] text-white ring-1 ring-white/10" : "bg-white text-neutral-900 ring-1 ring-black/10"
          }`}
          style={{
            left: x(hover),
            transform: `translateX(${hover > n / 2 ? "calc(-100% - 12px)" : "12px"})`,
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

/** Onglets texte soulignés (plus léger visuellement qu'un groupe de boutons). */
function Tabs<T extends string>({
  value,
  options,
  onChange,
  t,
  label,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (k: T) => void;
  t: Tokens;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex flex-wrap items-center gap-x-5 border-b ${t.border}`}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={`relative -mb-px rounded-sm py-2 text-[13px] font-medium transition-colors motion-reduce:transition-none ${t.ring} ${
              active ? t.text : t.idle
            }`}
          >
            {o.label}
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 bottom-0 h-px ${active ? t.underline : "bg-transparent"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Petit sélecteur discret, pour les réglages du graphique. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  t,
  label,
}: {
  value: T;
  options: { key: T; title: string; label?: string; icon?: ReactNode }[];
  onChange: (k: T) => void;
  t: Tokens;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 ${t.track}`}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            aria-label={o.title}
            title={o.title}
            onClick={() => onChange(o.key)}
            className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12px] font-medium transition-colors motion-reduce:transition-none ${t.ring} ${
              active ? t.sel : t.idle
            }`}
          >
            {o.icon}
            {o.label}
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
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${t.ring} ${t.soft} ${t.hover}`}
    >
      {children}
    </button>
  );
}

function SectionHead({
  id,
  title,
  sub,
  right,
  t,
}: {
  id: string;
  title: string;
  sub?: string;
  right?: ReactNode;
  t: Tokens;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className={`text-[15px] font-semibold tracking-[-0.02em] ${t.text}`}>
          {title}
        </h2>
        {sub && <p className={`mt-0.5 text-[12px] ${t.muted}`}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
  t,
  tall = false,
}: {
  title: string;
  text?: string;
  action?: { label: string; onClick: () => void };
  t: Tokens;
  tall?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 text-center ${tall ? "py-24" : "py-12"}`}>
      <p className={`text-[13px] font-medium ${t.text}`}>{title}</p>
      {text && <p className={`max-w-[380px] text-[12px] leading-relaxed ${t.soft}`}>{text}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`mt-2 rounded-md px-1 text-[12px] font-semibold underline underline-offset-4 ${t.ring} ${t.text}`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Mini courbe construite uniquement à partir de la série quotidienne réelle. */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) {
    return <div className="h-8" aria-hidden="true" />;
  }
  const W = 120;
  const H = 32;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-8 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DeltaBadge({ delta, t }: { delta: Delta; t: Tokens }) {
  if (!delta) return null;
  const color =
    delta.tone === "up"
      ? "bg-emerald-500/10 text-emerald-500"
      : delta.tone === "down"
      ? "bg-red-500/10 text-red-500"
      : `${t.track} ${t.muted}`;
  const arrow = delta.tone === "up" ? "↑" : delta.tone === "down" ? "↓" : "";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${color}`}
      aria-label={`${delta.text} compared to the previous period`}
      title="Compared to the previous period"
    >
      {arrow} {delta.tone === "flat" ? delta.text : delta.text.replace(/^[+-]/, "")}
    </span>
  );
}

/** `value === null` → donnée indisponible : on affiche « — », jamais 0. */
function Stat({
  label,
  value,
  info,
  delta,
  spark,
  sparkColor,
  size = "lg",
  t,
}: {
  label: string;
  value: string | null;
  info: string;
  delta: Delta;
  spark?: number[];
  sparkColor?: string;
  size?: "lg" | "sm";
  t: Tokens;
}) {
  const unavailable = value === null;
  return (
    <div className="min-w-0" title={unavailable ? `${info} (not available)` : info}>
      <p className={`truncate text-[12px] ${t.soft}`}>{label}</p>
      <p
        className={`mt-2 font-semibold leading-none tracking-[-0.03em] tabular-nums ${
          size === "lg" ? "text-[30px]" : "text-[20px]"
        } ${unavailable ? t.muted : t.text}`}
      >
        {unavailable ? "—" : value}
      </p>
      {size === "lg" && (
        <div className="mt-3">
          <Spark values={spark ?? []} color={sparkColor ?? "currentColor"} />
        </div>
      )}
      <div className="mt-2 h-5">{!unavailable && <DeltaBadge delta={delta} t={t} />}</div>
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
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!canSwitch}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-2.5 rounded-lg pl-1.5 pr-2.5 transition-colors disabled:cursor-default ${t.ring} ${canSwitch ? t.hover : ""}`}
      >
        <Avatar channel={current} isDark={isDark} size={24} />
        <span className={`max-w-[160px] truncate text-[13px] font-medium ${t.text}`}>{name(current)}</span>
        {canSwitch && <ChevronDown className={`h-3.5 w-3.5 ${t.muted}`} aria-hidden="true" />}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 mt-2 w-64 rounded-xl border p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${t.popover}`}
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
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${t.ring} ${t.hover}`}
              >
                <Avatar channel={c} isDark={isDark} size={24} showNetwork={false} />
                <span className={`min-w-0 flex-1 truncate text-[12px] font-medium ${t.text}`}>{name(c)}</span>
                {active && <Check className={`h-4 w-4 ${t.text}`} aria-hidden="true" />}
              </button>
            );
          })}
          <div className={`my-1 border-t ${t.border}`} />
          <button
            type="button"
            role="menuitem"
            onClick={() => navigateToSettingsSection("channels")}
            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors ${t.ring} ${t.hover} ${t.soft}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
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
      className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors ${t.ring} ${t.hover}`}
    >
      <span className={`text-[12px] font-medium ${t.text}`}>{label}</span>
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
        className={`flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-medium transition-colors disabled:opacity-40 ${t.ring} ${t.outlineBtn}`}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Export
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 mt-2 w-64 rounded-xl border p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${t.popover}`}
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
        className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors motion-reduce:transition-none ${t.ring} ${
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
        className={`flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12px] font-medium transition-colors ${t.ring} ${t.track} ${t.hover} ${t.text}`}
      >
        <CalendarClock className={`h-3.5 w-3.5 ${t.muted}`} aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-30 mt-2 w-[300px] overflow-hidden rounded-xl border shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${t.popover}`}
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
              className={`rounded-md px-1 text-[12px] font-medium transition-colors ${t.ring} ${t.hover} ${t.text}`}
            >
              {field === "from" ? "Next: To" : "Back: From"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-1.5 rounded-md px-1 text-[12px] font-medium transition-colors ${t.ring} ${t.hover} ${t.text}`}
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

  // État des données : « — » ou état vide tant qu'il n'y a pas de vraies données.
  const youtubeLoading = isYouTube && yt.loading && !yt.data;
  const hasData = isYouTube && Boolean(yt.data) && !youtubeLoading;

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
  const compareLabel = `vs ${fmtRange(prevStart, prevEnd)}`;

  // Une métrique sans source réelle (0 par défaut) devient « — ».
  const real = (v: number, needsPositive = false): string | null =>
    !hasData || !Number.isFinite(v) || (needsPositive && v <= 0) ? null : nf(v);

  const primaryBoxes: { label: string; value: string | null; key: NumKey | null }[] = [
    { label: "Total Followers", value: real(summary.followers), key: "followers" },
    { label: "Posts", value: real(summary.posts), key: "posts" },
    { label: "Reactions", value: real(summary.reactions), key: "reactions" },
    { label: "Comments", value: real(summary.comments), key: "comments" },
    {
      label: "Eng. Rate",
      // Calculé uniquement s'il existe au moins un post en ligne.
      value: hasData && posts.length > 0 ? `${summary.engRate.toFixed(2)}%` : null,
      key: null,
    },
  ];

  const secondaryBoxes: { label: string; value: string | null }[] = [
    { label: "Video Views", value: real(summary.videoViews) },
    { label: "Shares", value: real(summary.shares, true) },
    { label: "Reach", value: real(summary.reach, true) },
    { label: "Watch Time (min)", value: real(summary.watchMin, true) },
    { label: "Avg. Watch Time (sec)", value: real(summary.avgWatchSec, true) },
  ];

  // Variations : uniquement pour les métriques dont on dispose réellement
  // pour la période précédente (points quotidiens + posts).
  const curEng = mean(posts.map((p) => p.engRate));
  const prevEng = mean(previousPosts.map((p) => p.engRate));
  const deltas: Record<string, Delta> = {
    "Total Followers": pctDelta(
      current[days - 1]?.followers ?? 0,
      previous[days - 1]?.followers ?? 0
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
  const SPARK_COLOR = isDark ? "#a1a1aa" : "#52525b";
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

  const METRIC_TABS: { key: MetricTab; label: string }[] = [
    { key: "visibility", label: "Visibility" },
    { key: "growth", label: "Audience growth" },
    { key: "impact", label: "Content impact" },
    { key: "posts", label: "Posts" },
  ];

  const CHART_VIEWS: { key: ChartView; title: string; label: string }[] = [
    { key: "this", title: "This period", label: "This period" },
    { key: "comparison", title: "Previous period", label: "Previous" },
    { key: "both", title: "Both periods", label: "Both" },
  ];

  const CHART_TYPES: { key: ChartType; title: string; icon: ReactNode }[] = [
    { key: "line", title: "Line chart", icon: <LineChart className="h-3.5 w-3.5" aria-hidden="true" /> },
    { key: "bar", title: "Bar chart", icon: <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> },
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

  // ── PAGINATION ──
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);

  // Barre relative : proportion réelle par rapport au meilleur post de la liste.
  const maxReactions = Math.max(1, ...sortedRows.map((r) => r.reactions));

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const columns: { key: SortKey; label: string; render: (p: PostRow) => string }[] = [
    { key: "reactions", label: "Reactions", render: (p) => nf(p.reactions) },
    { key: "comments", label: "Comments", render: (p) => nf(p.comments) },
    { key: "engRate", label: "Eng. rate", render: (p) => `${p.engRate.toFixed(2)}%` },
    { key: "videoViews", label: "Views", render: (p) => nf(p.videoViews) },
  ];
  const TABLE_GRID = "grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(72px,1fr))_32px]";

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

  // Message d'encouragement discret, seulement si la chaîne a peu publié.
  const showHint =
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
              "mx-auto flex w-full max-w-[1120px]",
              "flex-col gap-12 px-[clamp(18px,3vw,48px)]",
              "pb-[120px] pt-[clamp(18px,3vw,32px)]",
            ].join(" ")}
          >
            {/* HEADER */}
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h1 className={`text-[22px] font-semibold tracking-[-0.03em] ${t.text}`}>Insights</h1>
              <div className="flex flex-wrap items-center gap-1.5 print:hidden">
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
                  disabled={!channel || !isYouTube || !hasData}
                  onDaily={exportDailyCsv}
                  onPosts={exportPostsCsv}
                  t={t}
                />

                <IconBtn
                  label={saved ? "Remove from favorites" : "Add to favorites"}
                  t={t}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                >
                  <Bookmark
                    className={`h-4 w-4 ${saved ? "fill-current" : ""}`}
                    aria-hidden="true"
                  />
                </IconBtn>
              </div>
            </header>

            {!channel ? (
              <EmptyState
                tall
                t={t}
                title="Connect a channel to see insights"
                text="Followers, reach and engagement show up here once a social account is connected."
                action={{ label: "Connect a channel", onClick: () => navigateToSettingsSection("channels") }}
              />
            ) : !isYouTube ? (
              <EmptyState
                tall
                t={t}
                title="Insights for this network are coming soon"
                text="Real statistics are only available for YouTube channels for now. Switch to a YouTube channel from the menu above."
              />
            ) : (
              <>
                {yt.error && (
                  <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p className="text-[12.5px] text-red-500">
                      Could not load YouTube insights: {yt.error}
                    </p>
                    <button
                      type="button"
                      onClick={() => setReloadKey((k) => k + 1)}
                      className={`rounded-md px-1 text-[12px] font-semibold underline underline-offset-4 ${t.ring} ${t.text}`}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {showHint && (
                  <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ${t.track}`}>
                    <p className={`text-[13px] ${t.soft}`}>
                      Fewer than 3 videos published recently. Post a bit more and your trends will be easier to read.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("new-post")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold ${t.ring} ${t.primaryBtn}`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Create post
                    </button>
                  </div>
                )}

                <div
                  className={`flex flex-col gap-12 transition-opacity duration-200 motion-reduce:transition-none ${
                    youtubeLoading ? "pointer-events-none opacity-50" : ""
                  }`}
                  aria-busy={youtubeLoading}
                >
                  {youtubeLoading && (
                    <p className="sr-only" role="status" aria-live="polite">
                      Loading YouTube insights…
                    </p>
                  )}

                  {/* PÉRIODE */}
                  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <Tabs<Range>
                        label="Date range"
                        value={range}
                        onChange={setRange}
                        t={t}
                        options={RANGES}
                      />
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
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${t.ring} ${t.hover} ${t.soft}`}
                    >
                      <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                      Tags
                    </button>
                  </div>

                  {/* SUMMARY */}
                  <section aria-labelledby="summary-title" className="flex flex-col gap-6">
                    <SectionHead
                      id="summary-title"
                      title="Summary"
                      sub={`${periodLabel} · ${compareLabel}`}
                      t={t}
                    />

                    <div className="flex flex-col gap-8">
                      <div
                        className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-5 ${t.border} ${t.track}`}
                      >
                        {primaryBoxes.map((b) => (
                          <div key={b.label} className={`p-4 sm:p-5 ${isDark ? "bg-[#0a0a0c]" : "bg-white"}`}>
                            <Stat
                              label={b.label}
                              value={b.value}
                              info={SUMMARY_INFO[b.label] ?? b.label}
                              delta={deltas[b.label] ?? null}
                              spark={b.key ? current.map((p) => p[b.key as NumKey]) : []}
                              sparkColor={SPARK_COLOR}
                              t={t}
                            />
                          </div>
                        ))}
                      </div>

                      <div
                        className={`grid grid-cols-2 gap-x-6 gap-y-6 border-t pt-6 sm:grid-cols-3 lg:grid-cols-5 ${t.border}`}
                      >
                        {secondaryBoxes.map((b) => (
                          <Stat
                            key={b.label}
                            size="sm"
                            label={b.label}
                            value={b.value}
                            info={SUMMARY_INFO[b.label] ?? b.label}
                            delta={null}
                            t={t}
                          />
                        ))}
                      </div>

                      {hasData && secondaryBoxes.some((b) => b.value === null) && (
                        <p className={`text-[11px] ${t.muted}`}>
                          “—” means the value is not provided by YouTube for this period. Nothing is estimated.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* METRICS */}
                  <section aria-labelledby="metrics-title" className="flex flex-col gap-5">
                    <SectionHead
                      id="metrics-title"
                      title="Metrics"
                      sub={periodLabel}
                      t={t}
                      right={
                        <div className="flex flex-wrap items-center gap-2">
                          <Segmented<ChartType>
                            label="Chart type"
                            value={chartType}
                            onChange={setChartType}
                            t={t}
                            options={CHART_TYPES}
                          />
                          <Segmented<ChartView>
                            label="Chart view"
                            value={chartView}
                            onChange={setChartView}
                            t={t}
                            options={CHART_VIEWS}
                          />
                        </div>
                      }
                    />

                    <Tabs<MetricTab>
                      label="Metric group"
                      value={metricTab}
                      onChange={setMetricTab}
                      t={t}
                      options={METRIC_TABS}
                    />

                    <div className="flex flex-wrap gap-x-12 gap-y-3">
                      {activeSeries.map((s) => (
                        <div key={s.key}>
                          <p className={`flex items-center gap-2 text-[12px] ${t.soft}`}>
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: TONES[s.tone] }}
                              aria-hidden="true"
                            />
                            {s.label}
                          </p>
                          <p
                            className={`mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${
                              hasData ? t.text : t.muted
                            }`}
                          >
                            {hasData ? nf(seriesTotal(s)) : "—"}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className={`relative rounded-2xl border p-3 sm:p-5 ${t.border}`}>
                      <Chart
                        dates={chartDates}
                        series={chartSeries}
                        view={chartView}
                        type={chartType}
                        bucket={bucket}
                        isDark={isDark}
                      />
                      {!hasData && (
                        <p
                          className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[12px] ${t.muted}`}
                        >
                          {youtubeLoading ? "Loading data…" : "No data for this period"}
                        </p>
                      )}
                    </div>

                    {hasData && bucket > 1 && (
                      <p className={`text-[11px] ${t.muted}`}>
                        Grouped by {bucket === 7 ? "week" : "30-day period"}: totals are summed,
                        followers show the last value of each group.
                      </p>
                    )}
                  </section>

                  {/* POSTS */}
                  <section aria-labelledby="perf-title" className="flex flex-col gap-5">
                    <SectionHead
                      id="perf-title"
                      title="Performance per post"
                      sub={postsPeriod === "this" ? periodLabel : fmtRange(prevStart, prevEnd)}
                      t={t}
                      right={
                        <Tabs<PostsPeriod>
                          label="Posts period"
                          value={postsPeriod}
                          onChange={setPostsPeriod}
                          t={t}
                          options={[
                            { key: "this", label: "This period" },
                            { key: "previous", label: "Previous" },
                          ]}
                        />
                      }
                    />

                    {/* RECHERCHE */}
                    <div className="relative max-w-[320px]">
                      <Search
                        className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${t.muted}`}
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search posts"
                        aria-label="Search posts by title"
                        className={`h-9 w-full rounded-lg bg-transparent pl-9 pr-9 text-[12px] placeholder:text-neutral-500 ${t.track} ${t.text} ${t.ring}`}
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

                    <div className="overflow-x-auto">
                      <div className="min-w-[640px]">
                        <div className={`grid ${TABLE_GRID} items-center gap-3 pb-2 text-[11px] font-medium ${t.muted}`}>
                          <span>{nf(sortedRows.length)} {sortedRows.length === 1 ? "post" : "posts"}</span>
                          {columns.map((c) => {
                            const active = sort?.key === c.key;
                            return (
                              <button
                                key={c.key}
                                type="button"
                                onClick={() => toggleSort(c.key)}
                                aria-label={`Sort by ${c.label}`}
                                className={`ml-auto flex items-center gap-1 rounded-md ${t.ring} ${
                                  active ? t.text : "hover:opacity-80"
                                }`}
                              >
                                {c.label}
                                {active && (
                                  <ChevronDown
                                    className={`h-3 w-3 transition-transform motion-reduce:transition-none ${
                                      sort?.dir === "asc" ? "rotate-180" : ""
                                    }`}
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            );
                          })}
                          <span aria-hidden="true" />
                        </div>

                        {paginatedRows.length === 0 ? (
                          <div className={`border-t ${t.border}`}>
                            {needle && rows.length > 0 ? (
                              <EmptyState
                                t={t}
                                title={`No post matches “${query.trim()}”`}
                                action={{ label: "Clear search", onClick: () => setQuery("") }}
                              />
                            ) : (
                              <EmptyState
                                t={t}
                                title={youtubeLoading ? "Loading videos…" : "No published posts in this period"}
                                text={
                                  youtubeLoading
                                    ? undefined
                                    : "Choose a longer range to see how your earlier posts performed."
                                }
                                action={
                                  !youtubeLoading && days < 30
                                    ? { label: "Show last 30 days", onClick: () => setRange("30d") }
                                    : undefined
                                }
                              />
                            )}
                          </div>
                        ) : (
                          paginatedRows.map((p) => (
                            <div
                              key={p.id}
                              className={`grid ${TABLE_GRID} items-center gap-3 border-t py-3 text-[13px] ${t.border} ${t.text}`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${t.thumb}`}>
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
                                    className={`block truncate rounded text-[13px] font-medium hover:underline ${t.ring}`}
                                  >
                                    {p.label}
                                  </a>
                                  <p className={`text-[11px] ${t.muted}`}>{fmtFull(p.date)}</p>
                                </div>
                              </div>
                              {columns.map((c) => (
                                <span key={c.key} className="relative text-right tabular-nums">
                                  {c.key === "reactions" && p.reactions > 0 && (
                                    <span
                                      aria-hidden="true"
                                      className={`absolute inset-y-[-4px] right-0 rounded-sm ${
                                        isDark ? "bg-white/[0.06]" : "bg-black/[0.05]"
                                      }`}
                                      style={{ width: `${Math.round((p.reactions / maxReactions) * 100)}%` }}
                                    />
                                  )}
                                  <span className="relative z-10 pr-1">{c.render(p)}</span>
                                </span>
                              ))}
                              <a
                                href={ytUrl(p.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open “${p.label}” on YouTube`}
                                title="Open on YouTube"
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.muted} ${t.hover} ${t.ring}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              </a>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* PAGINATION */}
                    {totalPages > 1 && (
                      <nav aria-label="Posts pagination" className="flex items-center justify-between">
                        <p className={`text-[12px] tabular-nums ${t.muted}`} aria-live="polite">
                          {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sortedRows.length)} of {nf(sortedRows.length)}
                        </p>
                        <div className="flex items-center gap-1">
                          <IconBtn
                            label="Previous page"
                            t={t}
                            onClick={() => setPage(Math.max(1, safePage - 1))}
                          >
                            <ChevronLeft className={`h-4 w-4 ${safePage === 1 ? "opacity-30" : ""}`} aria-hidden="true" />
                          </IconBtn>
                          <IconBtn
                            label="Next page"
                            t={t}
                            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                          >
                            <ChevronRight className={`h-4 w-4 ${safePage === totalPages ? "opacity-30" : ""}`} aria-hidden="true" />
                          </IconBtn>
                        </div>
                      </nav>
                    )}
                  </section>
                </div>
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