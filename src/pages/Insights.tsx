// src/pages/Insights.tsx
// Page Insights — même shell arrondi que Home / Community.
// Données YouTube réelles via useYouTubeInsights (services/youtube.ts).
// Les autres réseaux conservent les données d'exemple en attendant leur API.
//
// Graphiques rendus avec **Recharts** (npm i recharts) : plus de SVG
// artisanal, gestion du survol / clavier / axes / tooltips prise en charge
// par la librairie. Le thème clair/sombre est respecté via un Tooltip custom.
//
// Comme dans Community, les posts dont le statut est "scheduled" sont ignorés :
//   • le statut est lu sur le post s'il est fourni par le hook,
//   • sinon il est déduit de fetchYouTubeVideos() (le backend renvoie `status`),
//   • un post sans statut est considéré comme publié (compat ancien backend).
// Les compteurs (Posts) et la courbe « Posts » sont corrigés en conséquence.

import {
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
  Columns,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Info,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Send,
  Tag,
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
import { createPosts } from "../services/posts";
import { fetchYouTubeVideos, useYouTubeInsights } from "../services/youtube";

/** Route de cette page dans la sidebar (section Favorite). */
const PAGE_ROUTE = "insights";

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
        page: "bg-[#080809]",
        text: "text-white",
        muted: "text-neutral-600",
        soft: "text-neutral-400",
        card: "border-white/[0.07] bg-[#121214]",
        panel: "border-white/[0.07] bg-[#0d0d0f]",
        inner: "border-white/[0.07] bg-[#171719]",
        border: "border-white/[0.07]",
        head: "bg-white/[0.03]",
        primaryBtn: "bg-[#7667f5] text-white hover:bg-[#887bff]",
        outlineBtn: "border border-white/10 text-white hover:bg-white/[0.07]",
        iconBox: "bg-white/[0.07] text-neutral-300",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        hover: "hover:bg-white/[0.06]",
        sel: "bg-[#7667f5] text-white",
        idle: "text-neutral-400 hover:text-white",
        popover: "border-white/10 bg-[#141416]",
        tip: "bg-[#2e2e31]",
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

/** Cache module (survit aux navigations SPA), comme dans Community. */
const scheduledCache = new Map<string, ScheduledEntry>();
const SCHEDULED_FRESH_MS = 2 * 60_000;

/**
 * Renvoie les ids des vidéos encore programmées.
 * `ready` reste false tant que la première réponse n'est pas arrivée
 * (évite d'afficher un instant des posts programmés avant de les filtrer).
 */
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
        // Impossible de connaître les statuts : on n'empêche pas l'affichage.
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [active, channelKey, reloadKey]);

  return { ids, ready };
}

/** Retire `dropped` des compteurs « posts » par jour. */
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
   `sample = false` renvoie un squelette vide (zéros) : utilisé
   pour YouTube tant que les vraies données ne sont pas arrivées.
============================================================ */

function useSampleInsights(start: Date, end: Date, sample: boolean): InsightsData {
  const s = start.getTime();
  const e = end.getTime();

  return useMemo(() => {
    const days = Math.round((e - s) / DAY) + 1;
    const build = (from: Date, withPost: boolean): Point[] =>
      Array.from({ length: days }, (_, i) => ({
        date: addDays(from, i),
        posts: withPost && i === Math.max(0, days - 3) ? 1 : 0,
        reactions: 0,
        comments: 0,
        followers: 0,
        profileViews: 0,
      }));

    const current = build(new Date(s), sample);
    const previous = build(addDays(new Date(s), -days), false);

    const postDate = addDays(new Date(e), -2);
    const posts: PostRow[] = sample
      ? [
          {
            id: "1",
            label: "Media only",
            date: postDate < new Date(s) ? new Date(s) : postDate,
            media: "image",
            reactions: 0,
            comments: 0,
            engRate: 0,
            videoViews: 0,
          },
        ]
      : [];

    return {
      current,
      previous,
      summary: {
        followers: 0,
        posts: posts.length,
        reactions: 0,
        comments: 0,
        engRate: 0,
        videoViews: 0,
        shares: 0,
        reach: 0,
        watchMin: 0,
        avgWatchSec: 0,
      },
      posts,
      previousPosts: [] as PostRow[],
    };
  }, [s, e, sample]);
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

/** Payload minimal d'une ligne du tooltip Recharts. */
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
      className={`min-w-[160px] rounded-xl px-3.5 py-2.5 text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${
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

/** Bouton icône avec infobulle (même comportement que dans Community). */
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
    "flex shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40",
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
          "pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[240px] rounded-lg px-3 py-2 text-[12.5px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100",
          t.tip,
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}

function MetricBox({ label, value, info, t }: { label: string; value: string; info: string; t: Tokens }) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${t.inner}`}>
      <span className={`flex items-center justify-between gap-2 text-[10px] font-medium ${t.soft}`}>
        <span className="truncate">{label}</span>
        <span title={info} role="img" aria-label={info} className={`shrink-0 ${t.muted}`}>
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
      <span className={`text-[20px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>{value}</span>
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

/* ============================================================
   ICÔNE INSIGHTS — identique à celle de la sidebar
============================================================ */

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
   BANNIÈRE — cartes blanches inclinées
============================================================ */

function TipCard({
  className,
  icon,
  title,
  text,
  cta,
}: {
  className: string;
  icon: ReactNode;
  title: string;
  text: string;
  cta?: string;
}) {
  return (
    <div
      className={`absolute w-[176px] rounded-xl bg-white p-3 text-black shadow-[0_6px_22px_rgba(0,0,0,0.35)] ring-1 ring-black/5 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white">
          {icon}
        </span>
        <span className="text-[10.5px] font-semibold leading-tight">{title}</span>
      </div>
      <p className="mt-2 text-[9.5px] leading-snug text-neutral-600">{text}</p>
      {cta && (
        <span className="mt-2 inline-block rounded-md border border-neutral-300 px-2 py-0.5 text-[9.5px] font-semibold">
          {cta}
        </span>
      )}
    </div>
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

  // Favoris partagés avec la sidebar : le marque-page du header ajoute /
  // retire cette page de la section « Favorite ».
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  // Sélection du canal — même logique que Community.
  const hashChannel = useHashChannel();
  const [selectedKey, setSelectedKey] = useState<string | null>(hashChannel);

  useEffect(() => {
    if (hashChannel) setSelectedKey(hashChannel);
  }, [hashChannel]);

  const channel =
    channels.find((c) => c.key === selectedKey) ??
    channels.find((c) => isYouTubeChannel(c)) ??
    channels[0];
  const isYouTube = isYouTubeChannel(channel);

  const goChannel = (key: string) => {
    setSelectedKey(key);
    window.history.replaceState(null, "", `/insights?channel=${encodeURIComponent(key)}`);
  };

  const [range, setRange] = useState<Range>("30d");
  const [customStart, setCustomStart] = useState(() => addDays(startOfDay(new Date()), -29));
  const [customEnd, setCustomEnd] = useState(() => startOfDay(new Date()));
  const [chartView, setChartView] = useState<ChartView>("this");
  const [postsPeriod, setPostsPeriod] = useState<PostsPeriod>("this");
  const [metricTab, setMetricTab] = useState<MetricTab>("visibility");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const { start, end } = useMemo(
    () => resolveRange(range, customStart, customEnd),
    [range, customStart, customEnd]
  );

  /* ── Données ──
     YouTube : vraies données (squelette vide pendant le chargement).
     Autres réseaux : données d'exemple.
     Dans tous les cas, les posts « scheduled » sont retirés. */
  const yt = useYouTubeInsights(start, end, isYouTube && Boolean(channel), reloadKey);
  const scheduled = useScheduledVideoIds(channel?.key, isYouTube, reloadKey);
  const fallback = useSampleInsights(start, end, !isYouTube);

  const source: InsightsData = isYouTube && yt.data && scheduled.ready ? yt.data : fallback;

  const { data, skipped } = useMemo(
    () => withoutScheduled(source, scheduled.ids),
    [source, scheduled.ids]
  );
  const { current, previous, summary, posts, previousPosts } = data;

  const youtubeLoading = isYouTube && ((yt.loading && !yt.data) || !scheduled.ready);

  const days = current.length;
  const dates = current.map((p) => p.date);
  const prevStart = previous[0]?.date ?? addDays(start, -days);
  const prevEnd = previous[days - 1]?.date ?? addDays(start, -1);
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

  const TONES: [string, string] = [isDark ? "#8b7cff" : "#6657e8", isDark ? "#45b8e8" : "#278dbb"];
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

  /** Aplatit les séries pour Recharts (une ligne = une date). */
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

  const totalCurrentReactions = current.reduce((sum, point) => sum + point.reactions, 0);
  const totalPreviousReactions = previous.reduce((sum, point) => sum + point.reactions, 0);
  const reactionDelta =
    totalPreviousReactions > 0
      ? ((totalCurrentReactions - totalPreviousReactions) / totalPreviousReactions) * 100
      : null;
  const bestPost = [...posts].sort((a, b) => b.engRate - a.engRate)[0];
  const averagePostEngagement = posts.length
    ? posts.reduce((sum, post) => sum + post.engRate, 0) / posts.length
    : 0;

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
  const openNewPost = () => {
    setIsFolderOpen(false);
    setIsNewPostOpen(true);
  };

  const handleBottomBarChange = (id: BottomBarTab) => {
    switch (id) {
      case "add":
        openNewPost();
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

  const sectionCard = `rounded-2xl border p-4 ${t.card}`;
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

      {/* Zone à droite de la sidebar : marge autour du panneau arrondi */}
      <div
        className={[
          "h-full py-3 pr-3",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        {/* PANNEAU ARRONDI : c'est lui qui scrolle */}
        <div
          className={[
            "h-full overflow-y-auto overflow-x-hidden",
            "rounded-[28px] border",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "transition-colors duration-300",
            isDark ? "border-white/[0.07] bg-[#0a0a0c]" : "border-black/[0.06] bg-white",
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
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${t.inner} ${t.soft}`}
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
                />

                <div className="flex items-center gap-2">
                  {isYouTube && (
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
                    disabled={!channel}
                    className={`flex h-9 items-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${t.ring} ${t.outlineBtn}`}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export
                  </button>
                </div>

                {/* Marque-page : sans contour, fond au survol uniquement
                    (même style que Channels / Community / Schedule). */}
                <button
                  type="button"
                  aria-label={saved ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={saved}
                  title={saved ? "Remove from favorites" : "Add to favorites"}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={[
                    "ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none",
                    t.ring,
                    t.soft,
                    t.hover,
                  ].join(" ")}
                >
                  <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
                </button>
              </div>
            </div>

            {!channel ? (
              <section
                className={`flex flex-col items-center gap-3 rounded-2xl border px-6 py-20 text-center ${t.panel}`}
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
                  className={`mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold ${t.ring} ${t.primaryBtn}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Connect a channel
                </button>
              </section>
            ) : (
              <>
                {/* ÉTAT YOUTUBE : erreur / chargement */}
                {isYouTube && yt.error && (
                  <div
                    role="alert"
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${t.panel}`}
                  >
                    <p className="text-[12.5px] text-red-500">Could not load YouTube insights: {yt.error}</p>
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

                {/* OVERVIEW — dashboard compact inspiré de la référence */}
                <section className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className={`text-[11px] font-medium uppercase tracking-[0.16em] ${t.muted}`}>
                        Creator analytics
                      </p>
                      <h2 className={`mt-1 text-[25px] font-semibold tracking-[-0.04em] ${t.text}`}>
                        Overview
                      </h2>
                      <p className={`mt-1 text-[12px] ${t.soft}`}>
                        {channel?.key ?? "Your channel"} · {periodLabel}
                      </p>
                    </div>
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${t.inner} ${t.soft}`}>
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      {youtubeLoading ? "Syncing data…" : "Analytics updated"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,0.9fr)]">
                    <div className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${t.card}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className={`text-[12px] font-medium ${t.soft}`}>
                            {activeSeries[0]?.label ?? "Performance"}
                          </p>
                          <p className={`mt-1 text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${t.text}`}>
                            {nf(seriesTotal(activeSeries[0] ?? { key: "profileViews", label: "Views", tone: 0, agg: "sum" }))}
                          </p>
                          <p className={`mt-2 text-[10px] ${t.muted}`}>
                            {compareLabel}
                          </p>
                        </div>
                        <Segmented<ChartView>
                          label="Overview chart view"
                          value={chartView}
                          onChange={setChartView}
                          t={t}
                          options={[
                            { key: "this", label: "Current" },
                            { key: "comparison", label: "Previous" },
                            { key: "both", label: "Both" },
                          ]}
                        />
                      </div>
                      <div className="mt-3">
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

                    <div className={`rounded-2xl border p-4 sm:p-5 ${t.card}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className={`text-[13px] font-semibold ${t.text}`}>Channel snapshot</h3>
                          <p className={`mt-1 text-[10px] ${t.muted}`}>Selected period</p>
                        </div>
                        <span className={`rounded-lg px-2 py-1 text-[10px] ${t.panel} ${t.soft}`}>Connected data</span>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        {[
                          { label: "Followers", value: nf(summary.followers), color: "#8b7cff" },
                          { label: "Published posts", value: nf(summary.posts), color: "#45b8e8" },
                          { label: "Reactions", value: nf(summary.reactions), color: "#e5a45b" },
                          { label: "Comments", value: nf(summary.comments), color: "#e879a9" },
                          { label: "Engagement rate", value: `${summary.engRate}%`, color: "#54c69a" },
                        ].map((item) => (
                          <div key={item.label} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${t.inner}`}>
                            <span className="flex min-w-0 items-center gap-2 text-[11px]">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                              <span className={t.soft}>{item.label}</span>
                            </span>
                            <strong className={`text-[14px] font-semibold tabular-nums ${t.text}`}>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

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
                    <div className="flex items-start justify-between gap-3 px-1">
                      <div>
                        <h3 className={sectionTitle}>Key metrics</h3>
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
                      className={`mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border p-3 sm:grid-cols-3 lg:grid-cols-6 ${t.panel}`}
                    >
                      {summaryBoxes.map((b) => (
                        <MetricBox
                          key={b.label}
                          label={b.label}
                          value={b.value}
                          info={SUMMARY_INFO[b.label] ?? b.label}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* SMART INSIGHTS — règles explicables, basées sur les données disponibles */}
                <section className={`rounded-2xl border p-4 sm:p-5 ${t.card}`} aria-labelledby="smart-insights-title">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#8b7cff]/20 bg-[#8b7cff]/10 text-[#9b90ff]">
                        <Zap className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 id="smart-insights-title" className={`text-[14px] font-semibold ${t.text}`}>Smart insights</h3>
                        <p className={`mt-0.5 text-[10px] ${t.muted}`}>Observations calculated from your connected channel data</p>
                      </div>
                    </div>
                    <span className={`rounded-lg border px-2.5 py-1 text-[10px] ${t.inner} ${t.soft}`}>Data-based</span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                    <div className={`rounded-xl border p-3.5 ${t.inner}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-[0.12em] ${t.muted}`}>Top content</p>
                      {bestPost ? (
                        <>
                          <p className={`mt-2 line-clamp-2 text-[12px] font-semibold ${t.text}`}>{bestPost.label}</p>
                          <p className={`mt-1 text-[11px] ${t.soft}`}>{bestPost.engRate.toFixed(2)}% engagement rate</p>
                        </>
                      ) : (
                        <p className={`mt-2 text-[12px] ${t.soft}`}>No published post to rank in this period.</p>
                      )}
                    </div>
                    <div className={`rounded-xl border p-3.5 ${t.inner}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-[0.12em] ${t.muted}`}>Reaction trend</p>
                      {reactionDelta === null ? (
                        <p className={`mt-2 text-[12px] ${t.soft}`}>A previous-period baseline is needed to calculate a trend.</p>
                      ) : (
                        <>
                          <p className={`mt-2 text-[20px] font-semibold tabular-nums ${reactionDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {reactionDelta >= 0 ? "+" : ""}{reactionDelta.toFixed(1)}%
                          </p>
                          <p className={`mt-1 text-[11px] ${t.soft}`}>Reactions versus the previous period</p>
                        </>
                      )}
                    </div>
                    <div className={`rounded-xl border p-3.5 ${t.inner}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-[0.12em] ${t.muted}`}>Average post engagement</p>
                      <p className={`mt-2 text-[20px] font-semibold tabular-nums ${t.text}`}>{posts.length ? `${averagePostEngagement.toFixed(2)}%` : "—"}</p>
                      <p className={`mt-1 text-[11px] ${t.soft}`}>{posts.length ? `Calculated across ${posts.length} published posts` : "Publish content to unlock this insight"}</p>
                    </div>
                  </div>
                </section>

                {/* PERFORMANCE PER POST */}
                <section className={sectionCard} aria-labelledby="perf-title">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div>
                      <h3 id="perf-title" className={sectionTitle}>
                        Content performance
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

                  <div className={`mt-4 overflow-x-auto rounded-2xl border ${t.panel}`}>
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
                        <button
                          type="button"
                          aria-label="Customize columns"
                          title="Customize columns"
                          className={`flex h-9 w-9 items-center justify-center rounded-xl border ${t.inner} ${t.soft} ${t.hover} ${t.ring}`}
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
                              className={`mt-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${t.ring} ${t.outlineBtn}`}
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
                                className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${t.iconBox}`}
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
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.soft} ${t.hover} ${t.ring}`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                aria-label="Post actions"
                                title="Post actions"
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.soft} ${t.hover} ${t.ring}`}
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

                {/* METRICS */}
                <section className={sectionCard} aria-labelledby="metrics-title">
                  <div className="flex items-start justify-between gap-3 px-1">
                    <div>
                      <h3 id="metrics-title" className={sectionTitle}>
                        Performance breakdown
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

                  <div className={`mt-3 rounded-2xl border p-4 ${t.panel}`}>
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
        onCreatePost={openNewPost}
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