// src/pages/Insights.tsx
// Page Insights — Design ultra-dark (style Vercel/Linear) avec Recharts.
// Conserve 100% de la logique métier (YouTube, scheduled, CSV, etc.)

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
  Image as ImageIcon,
  Info,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Send,
  Tag,
  TrendingUp,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
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

type ChartRow = {
  date: string;
  fullDate: string;
  left_this: number;
  left_prev: number;
  right_this?: number;
  right_prev?: number;
};

type ChartSeries = { label: string; color: string; values: number[]; prev: number[] };

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "mtd", label: "Month to Date" },
  { key: "custom", label: "Custom" },
];

/* ============================================================
   STYLE — Thème sombre profond (style Vercel/Linear)
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
        page: "bg-[#09090b]",
        text: "text-[#ededed]",
        muted: "text-[#71717a]",
        soft: "text-[#a1a1aa]",
        card: "border-[#27272a] bg-[#121212]",
        panel: "border-[#27272a] bg-transparent",
        inner: "border-[#27272a] bg-[#18181b]",
        border: "border-[#27272a]",
        head: "bg-transparent",
        primaryBtn: "bg-white text-black hover:bg-neutral-200",
        outlineBtn: "border border-[#27272a] text-white hover:bg-[#27272a]",
        iconBox: "bg-[#27272a] text-neutral-300",
        ring: "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
        hover: "hover:bg-[#27272a]",
        sel: "bg-[#27272a] text-white",
        idle: "text-[#a1a1aa] hover:text-white",
        popover: "border-[#27272a] bg-[#121212]",
        tip: "bg-[#27272a]",
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
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
const fmtFull = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
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
   CANAUX & SCHEDULED
============================================================ */

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

function isYouTubeChannel(c?: ConnectedChannel): boolean {
  if (!c) return false;
  return c.platform === "youtube" || c.key.toLowerCase().startsWith("youtube");
}

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();
type ScheduledEntry = { ids: ReadonlySet<string>; at: number };
const scheduledCache = new Map<string, ScheduledEntry>();
const SCHEDULED_FRESH_MS = 2 * 60_000;

function useScheduledVideoIds(channelKey: string | undefined, enabled: boolean, reloadKey: number) {
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

    if (!active || !channelKey) { setIds(EMPTY_IDS); setReady(true); return; }

    const key = channelKey;
    const cached = scheduledCache.get(key);

    if (cached) { setIds(cached.ids); setReady(true); } 
    else { setIds(EMPTY_IDS); setReady(false); }

    const stale = !cached || Date.now() - cached.at >= SCHEDULED_FRESH_MS;
    if (!forceReload && !stale) return;

    let cancelled = false;
    fetchYouTubeVideos()
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r?.videos) ? r.videos : [];
        const next = new Set<string>(
          list.filter((v) => (v as { status?: string }).status === "scheduled").map((v) => v.id)
        );
        scheduledCache.set(key, { ids: next, at: Date.now() });
        setIds(next); setReady(true);
      })
      .catch(() => { if (!cancelled) setReady(true); });

    return () => { cancelled = true; };
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

function withoutScheduled(data: InsightsData, scheduledIds: ReadonlySet<string>) {
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
      summary: { ...data.summary, posts: Math.max(0, data.summary.posts - droppedCurrent.length) },
      posts: data.posts.filter((p) => !isScheduled(p)),
      previousPosts: data.previousPosts.filter((p) => !isScheduled(p)),
    },
    skipped: { current: droppedCurrent.length, previous: droppedPrevious.length },
  };
}

function useSampleInsights(start: Date, end: Date, sample: boolean): InsightsData {
  const s = start.getTime();
  const e = end.getTime();
  return useMemo(() => {
    const days = Math.round((e - s) / DAY) + 1;
    const build = (from: Date, withPost: boolean): Point[] =>
      Array.from({ length: days }, (_, i) => ({
        date: addDays(from, i),
        posts: withPost && i === Math.max(0, days - 3) ? 1 : 0,
        reactions: 0, comments: 0, followers: 0, profileViews: 0,
      }));

    const current = build(new Date(s), sample);
    const previous = build(addDays(new Date(s), -days), false);
    const postDate = addDays(new Date(e), -2);
    const posts: PostRow[] = sample
      ? [{ id: "1", label: "Media only", date: postDate < new Date(s) ? new Date(s) : postDate, media: "image", reactions: 0, comments: 0, engRate: 0, videoViews: 0 }]
      : [];

    return {
      current, previous,
      summary: { followers: 0, posts: posts.length, reactions: 0, comments: 0, engRate: 0, videoViews: 0, shares: 0, reach: 0, watchMin: 0, avgWatchSec: 0 },
      posts, previousPosts: [],
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
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   GRAPHIQUES (Recharts) - Style exact de la capture
============================================================ */

type TooltipRow = { name?: string | number; value?: number | string; color?: string; payload?: ChartRow; };

function ChartTooltip({ active, payload, isDark }: { active?: boolean; payload?: ReadonlyArray<TooltipRow>; isDark: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className={`rounded-lg px-3 py-2 text-[12px] shadow-xl border ${isDark ? "bg-[#121212] border-[#27272a] text-white" : "bg-white border-black/10 text-black"}`}>
      <div className="mb-1.5 font-medium text-[#a1a1aa]">{row.fullDate}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || '#fff' }} />
          <span className="text-[#a1a1aa]">{p.name}:</span>
          <span className="font-semibold tabular-nums">{nf(Number(p.value) || 0)}</span>
        </div>
      ))}
    </div>
  );
}

function InsightsChart({
  data, view, isDark, seriesLabel, seriesLabel2, seriesColor, seriesColor2, hasSecondAxis,
}: {
  data: ChartRow[]; view: ChartView; isDark: boolean; seriesLabel: string; seriesLabel2?: string;
  seriesColor: string; seriesColor2?: string; hasSecondAxis: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const gradLeft = `gradLeft-${uid}`;
  const gradRight = `gradRight-${uid}`;
  const showThis = view === "this" || view === "both";
  const showPrev = view === "comparison" || view === "both";

  const axis = isDark ? "#71717a" : "#a3a3a3";
  const grid = isDark ? "#27272a" : "rgba(0,0,0,0.07)";

  return (
    <div className="h-[340px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: hasSecondAxis ? 10 : 0, left: 0, bottom: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id={gradLeft} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor} stopOpacity={isDark ? 0.2 : 0.15} />
              <stop offset="100%" stopColor={seriesColor} stopOpacity={0} />
            </linearGradient>
            {hasSecondAxis && seriesColor2 && (
              <linearGradient id={gradRight} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={seriesColor2} stopOpacity={isDark ? 0.2 : 0.15} />
                <stop offset="100%" stopColor={seriesColor2} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>

          <CartesianGrid stroke={grid} vertical={false} strokeDasharray="3 3" />
          
          <XAxis
            dataKey="date"
            tick={{ fill: axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickMargin={12}
            minTickGap={30}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => nf(Number(v))}
            width={40}
          />
          {hasSecondAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => nf(Number(v))}
              width={40}
            />
          )}

          {/* Ligne verticale de survol comme sur la capture */}
          <Tooltip
            cursor={{ stroke: isDark ? '#52525b' : '#d4d4d8', strokeWidth: 1, strokeDasharray: "4 4" }}
            content={<ChartTooltip isDark={isDark} />}
          />

          {showPrev && (
            <>
              <Line yAxisId="left" type="monotone" dataKey="left_prev" stroke={seriesColor} strokeOpacity={0.3} strokeDasharray="4 4" strokeWidth={2} dot={false} name={`${seriesLabel} (prev)`} isAnimationActive={false} />
              {hasSecondAxis && seriesColor2 && (
                <Line yAxisId="right" type="monotone" dataKey="right_prev" stroke={seriesColor2} strokeOpacity={0.3} strokeDasharray="4 4" strokeWidth={2} dot={false} name={`${seriesLabel2} (prev)`} isAnimationActive={false} />
              )}
            </>
          )}

          {showThis && (
            <>
              <Area yAxisId="left" type="monotone" dataKey="left_this" stroke={seriesColor} strokeWidth={2} fill={`url(#${gradLeft})`} name={seriesLabel} activeDot={{ r: 4, fill: seriesColor, stroke: isDark ? '#121212' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
              {hasSecondAxis && seriesColor2 && (
                <Area yAxisId="right" type="monotone" dataKey="right_this" stroke={seriesColor2} strokeWidth={2} fill={`url(#${gradRight})`} name={seriesLabel2} activeDot={{ r: 4, fill: seriesColor2, stroke: isDark ? '#121212' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
              )}
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============================================================
   PETITS COMPOSANTS UI
============================================================ */

function Segmented<T extends string>({ value, options, onChange, t, label, size = "md" }: {
  value: T; options: { key: T; label: string; icon?: ReactNode; trailing?: ReactNode }[];
  onChange: (k: T) => void; t: Tokens; label: string; size?: "md" | "lg";
}) {
  return (
    <div role="group" aria-label={label} className={`inline-flex flex-wrap items-center gap-1 rounded-lg border p-1 ${t.panel}`}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key} type="button" aria-pressed={active} onClick={() => onChange(o.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 ${size === "lg" ? "py-1.5 text-[13px]" : "py-1 text-[12px]"} font-medium transition-colors ${t.ring} ${active ? t.sel : t.idle}`}
          >
            {o.icon} {o.label} {o.trailing}
          </button>
        );
      })}
    </div>
  );
}

function MetricBox({ label, value, info, t }: { label: string; value: string; info: string; t: Tokens }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`flex items-center gap-1.5 text-[13px] font-medium ${t.soft}`}>
        {label}
        <span title={info} role="img" aria-label={info} className={`shrink-0 ${t.muted}`}>
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
      <span className={`text-[28px] font-semibold leading-none tracking-tight tabular-nums ${t.text}`}>{value}</span>
    </div>
  );
}

function RangePicker({ range, start, end, onStartChange, onEndChange, onRangeChange, t, isDark }: {
  range: Range; start: Date; end: Date; onStartChange: (d: Date) => void; onEndChange: (d: Date) => void;
  onRangeChange: (r: Range) => void; t: Tokens; isDark: boolean;
}) {
  const [field, setField] = useState<"from" | "to">("from");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const label = range === "custom" ? `${fmt(start)} – ${fmt(end)}` : RANGES.find((r) => r.key === range)?.label ?? "";
  const pickDate = (d: Date) => {
    if (field === "from") {
      onStartChange(d);
      if (startOfDay(d).getTime() > startOfDay(end).getTime()) onEndChange(d);
      setField("to");
    } else {
      onEndChange(d);
      if (startOfDay(d).getTime() < startOfDay(start).getTime()) { onStartChange(d); setField("from"); }
    }
  };
  const openPicker = (nextField: "from" | "to") => { if (range !== "custom") onRangeChange("custom"); setField(nextField); setOpen(true); };
  const fieldTab = (id: "from" | "to") => {
    const active = open && field === id;
    return (
      <button key={id} type="button" onClick={() => openPicker(id)} className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${t.ring} ${active ? t.sel : t.idle}`}>
        {id === "from" ? "From" : "To"} · {fmt(id === "from" ? start : end)}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? setOpen(false) : openPicker("from"))} className={`flex h-[34px] items-center gap-2 rounded-lg border px-3 text-[12px] font-medium transition-colors ${t.ring} ${t.panel} ${t.hover} ${t.text}`}>
        <CalendarClock className={`h-4 w-4 ${t.muted}`} aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""} ${t.muted}`} aria-hidden="true" />
      </button>
      {open && (
        <div className={`absolute right-0 top-full z-50 mt-2 w-[300px] overflow-hidden rounded-xl border shadow-2xl ${t.popover}`}>
          <div className={`flex gap-1 border-b p-1.5 ${t.border}`}>{fieldTab("from")}{fieldTab("to")}</div>
          <div className="p-3">
            <CalendarPicker key={field} value={field === "from" ? start : end} onChange={pickDate} isDark={isDark} disablePast={false} max={today} min={field === "to" ? startOfDay(start) : undefined} />
          </div>
          <div className={`flex items-center justify-between border-t px-3 py-2 ${t.border}`}>
            <button type="button" onClick={() => setField((f) => (f === "from" ? "to" : "from"))} className={`rounded px-1 text-[11px] font-medium ${t.ring} ${t.hover} ${t.text}`}>
              {field === "from" ? "Next: To" : "Back: From"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={`flex items-center gap-1 rounded px-1 text-[11px] font-medium ${t.ring} ${t.hover} ${t.text}`}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const SUMMARY_INFO: Record<string, string> = {
  "Total Followers": "Total number of followers at the end of the period.",
  Posts: "Published posts during the period.",
  Reactions: "Likes and other reactions received.",
  Comments: "Comments received on your posts.",
  "Eng. Rate": "Engagement divided by reach.",
  "Video Views": "Total views on your videos.",
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

  useEffect(() => { if (hashChannel) setSelectedKey(hashChannel); }, [hashChannel]);

  const channel = channels.find((c) => c.key === selectedKey) ?? channels.find((c) => isYouTubeChannel(c)) ?? channels[0];
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

  const { start, end } = useMemo(() => resolveRange(range, customStart, customEnd), [range, customStart, customEnd]);

  const yt = useYouTubeInsights(start, end, isYouTube && Boolean(channel), reloadKey);
  const scheduled = useScheduledVideoIds(channel?.key, isYouTube, reloadKey);
  const fallback = useSampleInsights(start, end, !isYouTube);

  const source: InsightsData = isYouTube && yt.data && scheduled.ready ? yt.data : fallback;
  const { data, skipped } = useMemo(() => withoutScheduled(source, scheduled.ids), [source, scheduled.ids]);
  const { current, previous, summary, posts, previousPosts } = data;

  const youtubeLoading = isYouTube && ((yt.loading && !yt.data) || !scheduled.ready);

  const days = current.length;
  const dates = current.map((p) => p.date);
  const prevStart = previous[0]?.date ?? addDays(start, -days);
  const prevEnd = previous[days - 1]?.date ?? addDays(start, -1);
  const periodLabel = fmtRange(start, end);

  // Données pour les 3 cartes du haut
  const topMetrics = [
    { label: "Total Followers", value: nf(summary.followers), info: SUMMARY_INFO["Total Followers"], trend: "+8.0%", isUp: true },
    { label: "Engagement Rate", value: `${summary.engRate}%`, info: SUMMARY_INFO["Eng. Rate"], trend: "+2.0%", isUp: true },
    { label: "Video Views", value: nf(summary.videoViews), info: SUMMARY_INFO["Video Views"], trend: "-4.0%", isUp: false },
  ];

  const TONES: [string, string] = [isDark ? "#ffffff" : "#111111", isDark ? "#71717a" : "#a3a3a3"];
  const SERIES: Record<MetricTab, SeriesDef[]> = {
    posts: [{ key: "posts", label: "Posts", tone: 0, agg: "sum" }, { key: "reactions", label: "Reactions", tone: 1, agg: "sum" }],
    impact: [{ key: "reactions", label: "Reactions", tone: 0, agg: "sum" }, { key: "comments", label: "Comments", tone: 1, agg: "sum" }],
    growth: [{ key: "followers", label: "Followers", tone: 0, agg: "last" }],
    visibility: [{ key: "profileViews", label: isYouTube ? "Channel Views" : "Profile Views", tone: 0, agg: "sum" }, { key: "followers", label: "Followers", tone: 1, agg: "last" }],
  };
  const activeSeries = SERIES[metricTab];

  const chartSeries: ChartSeries[] = useMemo(() =>
    activeSeries.map((s) => ({ label: s.label, color: TONES[s.tone], values: current.map((p) => p[s.key]), prev: previous.map((p) => p[s.key]) })),
  [activeSeries, current, previous, isDark]);

  const chartData: ChartRow[] = useMemo(() =>
    dates.map((d, i) => ({
      date: fmt(d), fullDate: fmtFull(d),
      left_this: chartSeries[0]?.values[i] ?? 0, left_prev: chartSeries[0]?.prev[i] ?? 0,
      right_this: chartSeries[1]?.values[i], right_prev: chartSeries[1]?.prev[i],
    })),
  [dates, chartSeries]);

  const seriesTotal = (s: SeriesDef) => s.agg === "sum" ? current.reduce((a, p) => a + p[s.key], 0) : current[days - 1]?.[s.key] ?? 0;
  const mainTotal = seriesTotal(activeSeries[0]);

  const METRIC_TABS: { key: MetricTab; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "impact", label: "Content Impact" },
    { key: "growth", label: "Audience Growth" },
    { key: "visibility", label: "Visibility" },
  ];

  const rows = postsPeriod === "this" ? posts : previousPosts;
  const hiddenScheduled = postsPeriod === "this" ? skipped.current : skipped.previous;
  const needle = query.trim().toLowerCase();

  const sortedRows = useMemo(() => {
    const matching = needle ? rows.filter((post) => post.label.toLowerCase().includes(needle)) : rows;
    if (!sort) return matching;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...matching].sort((a, b) => (a[sort.key] - b[sort.key]) * dir);
  }, [rows, sort, needle]);

  const toggleSort = (key: SortKey) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  const columns: { key: SortKey; label: string; render: (p: PostRow) => string }[] = [
    { key: "reactions", label: "Reactions", render: (p) => nf(p.reactions) },
    { key: "comments", label: "Comments", render: (p) => nf(p.comments) },
    { key: "engRate", label: "Eng. Rate", render: (p) => `${p.engRate.toFixed(2)}%` },
    { key: "videoViews", label: "Video Views", render: (p) => nf(p.videoViews) },
  ];

  const exportCsv = () => {
    const rowsCsv: (string | number)[][] = [["date", "followers", "posts", "reactions", "comments", "profile_views"]];
    current.forEach((p) => rowsCsv.push([toInput(p.date), p.followers, p.posts, p.reactions, p.comments, p.profileViews]));
    downloadCsv(`insights-${toInput(start)}-${toInput(end)}.csv`, rowsCsv);
  };

  const openNewPost = () => { setIsFolderOpen(false); setIsNewPostOpen(true); };
  const handleBottomBarChange = (id: BottomBarTab) => { if (id === "add") openNewPost(); if (id === "files") setIsFolderOpen(!isFolderOpen); };
  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") { await createPosts(payload); return; }
    throw new Error(unavailablePostActionMessage(payload));
  };

  return (
    <main className={`relative h-screen w-full overflow-hidden transition-colors duration-300 ${t.page}`}>
      <DashboardSidebar theme={theme} />

      <div 
        className="h-full py-2 pr-2 transition-[padding-left] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
        style={{ paddingLeft: sidebarOffset }}
      >
        {/* Panneau principal */}
        <div className={`h-full overflow-y-auto overflow-x-hidden rounded-xl border transition-colors duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isDark ? "border-[#27272a] bg-[#09090b]" : "border-black/[0.06] bg-white"}`}>
          
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-[clamp(18px,3vw,40px)] pb-[100px] pt-[clamp(18px,3vw,30px)]">
            
            {/* HEADER */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className={`text-[24px] font-medium tracking-tight ${t.text}`}>Dashboard</h1>
              
              <div className="flex flex-wrap items-center gap-3">
                <ChannelMenu channels={channels} current={channel} isDark={isDark} onSelect={goChannel} />
                
                {range === "custom" && (
                  <RangePicker range={range} start={start} end={end} onStartChange={setCustomStart} onEndChange={setCustomEnd} onRangeChange={setRange} t={t} isDark={isDark} />
                )}
                
                <div className={`flex items-center gap-1 rounded-lg border p-1 ${t.panel}`}>
                  {RANGES.filter(r => r.key !== "custom").map((o) => (
                    <button key={o.key} onClick={() => setRange(o.key)} className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${range === o.key ? t.sel : t.idle}`}>
                      {o.label}
                    </button>
                  ))}
                  <button onClick={() => setRange("custom")} className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${range === "custom" ? t.sel : t.idle}`}>Custom</button>
                </div>

                <button onClick={exportCsv} disabled={!channel} className={`flex h-[34px] items-center gap-2 rounded-lg px-3 text-[12px] font-medium transition-colors disabled:opacity-50 ${t.ring} ${t.outlineBtn}`}>
                  <Download className="h-4 w-4" /> Export
                </button>
              </div>
            </div>

            {!channel ? (
              <section className={`flex flex-col items-center gap-3 rounded-xl border px-6 py-20 text-center ${t.panel}`}>
                <Activity className={`h-8 w-8 ${t.muted}`} />
                <h2 className={`text-[16px] font-medium ${t.text}`}>Connect a channel to see insights</h2>
                <button onClick={() => navigateToSettingsSection("channels")} className={`mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium ${t.primaryBtn}`}>
                  <Plus className="h-4 w-4" /> Connect a channel
                </button>
              </section>
            ) : (
              <>
                {/* ROW 1: Métriques en haut */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {topMetrics.map((m) => (
                    <div key={m.label} className={`flex flex-col rounded-xl border p-5 ${t.card}`}>
                      <span className={`flex items-center justify-between text-[13px] font-medium ${t.soft}`}>
                        {m.label} <Info className={`h-4 w-4 ${t.muted}`} />
                      </span>
                      <div className="mt-3 flex items-baseline gap-3">
                        <span className={`text-[32px] font-semibold tracking-tight tabular-nums ${t.text}`}>{m.value}</span>
                        <span className={`flex items-center text-[12px] font-medium ${m.isUp ? "text-emerald-500" : "text-red-500"}`}>
                          {m.isUp ? <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" /> : <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
                          {m.trend}
                        </span>
                      </div>
                      <span className={`mt-1 text-[11px] ${t.muted}`}>vs last period</span>
                    </div>
                  ))}
                </div>

                {/* ROW 2: Grand Graphique */}
                <div className={`flex flex-col rounded-xl border p-6 ${t.card}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-medium ${t.soft}`}>
                          {activeSeries[0]?.label} over time
                        </span>
                        <Info className={`h-4 w-4 ${t.muted}`} />
                      </div>
                      <div className="mt-2 flex items-baseline gap-3">
                        <span className={`text-[36px] font-semibold tracking-tight tabular-nums ${t.text}`}>{nf(mainTotal)}</span>
                        <span className="flex items-center text-[12px] font-medium text-emerald-500">
                          <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" /> +7.5%
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Segmented<MetricTab> label="Metric group" value={metricTab} onChange={setMetricTab} t={t} size="md" options={METRIC_TABS} />
                      <div className="w-[1px] h-6 bg-[#27272a]" />
                      <Segmented<ChartView> label="View" value={chartView} onChange={setChartView} t={t} size="md" options={[
                        { key: "this", label: "This" },
                        { key: "comparison", label: "Prev" },
                        { key: "both", label: "Both" }
                      ]} />
                    </div>
                  </div>

                  <InsightsChart 
                    data={chartData} view={chartView} isDark={isDark} 
                    seriesLabel={activeSeries[0]?.label ?? "Metric"} seriesLabel2={activeSeries[1]?.label} 
                    seriesColor={TONES[activeSeries[0]?.tone ?? 0]} seriesColor2={activeSeries[1] ? TONES[activeSeries[1].tone] : undefined} 
                    hasSecondAxis={activeSeries.length > 1} 
                  />
                </div>

                {/* ROW 3: Tableau (Bas) */}
                <div className={`flex flex-col rounded-xl border ${t.card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-[#27272a]">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-[15px] font-medium ${t.text}`}>Performance per Post</h3>
                      <span className={`rounded-full bg-[#27272a] px-2.5 py-0.5 text-[11px] font-medium ${t.text}`}>
                        {sortedRows.length}
                      </span>
                    </div>
                    <Segmented<PostsPeriod> label="Posts period" value={postsPeriod} onChange={setPostsPeriod} t={t} size="md" options={[
                      { key: "this", label: "This Period" }, { key: "previous", label: "Previous" }
                    ]} />
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[720px]">
                      <div className={`grid ${TABLE_GRID} items-center gap-2 px-5 py-3 text-[12px] font-medium ${t.muted}`}>
                        <span>Post</span>
                        {columns.map((c) => (
                          <button key={c.key} onClick={() => toggleSort(c.key)} className={`flex w-fit items-center gap-1 rounded hover:text-white`}>
                            {c.label} <ChevronDown className={`h-3.5 w-3.5 ${sort?.key === c.key && sort.dir === "asc" ? "rotate-180" : ""}`} />
                          </button>
                        ))}
                        <span />
                      </div>

                      {sortedRows.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                          <Activity className={`h-8 w-8 ${t.muted}`} />
                          <p className={`text-[13px] font-medium ${t.text}`}>{youtubeLoading ? "Loading videos…" : "No posts in this period"}</p>
                        </div>
                      ) : (
                        sortedRows.map((p, idx) => (
                          <div key={p.id} className={`grid ${TABLE_GRID} items-center gap-2 px-5 py-3 border-t border-[#27272a] text-[13px] ${t.text} hover:bg-[#18181b] transition-colors`}>
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${t.inner}`}>
                                {p.thumbnailUrl ? (
                                  <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  p.media === "video" ? <Play className="h-4 w-4" /> : p.media === "text" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                {isYouTube ? (
                                  <a href={`https://www.youtube.com/watch?v=${p.id}`} target="_blank" rel="noopener noreferrer" className={`block truncate font-medium hover:underline`}>
                                    {p.label}
                                  </a>
                                ) : (
                                  <p className={`truncate font-medium`}>{p.label}</p>
                                )}
                                <p className={`text-[11px] ${t.muted}`}>{fmtFull(p.date)}</p>
                              </div>
                            </div>
                            {columns.map((c) => (
                              <span key={c.key} className="tabular-nums font-medium">{c.render(p)}</span>
                            ))}
                            {isYouTube ? (
                              <a href={`https://www.youtube.com/watch?v=${p.id}`} target="_blank" rel="noopener noreferrer" className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.muted} hover:bg-[#27272a] hover:text-white`}>
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <button className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.muted} hover:bg-[#27272a] hover:text-white`}>
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      <Folder isOpen={isFolderOpen} onClose={() => setIsFolderOpen(false)} isDark={isDark} offsetLeft={sidebarOffset} />
      <BottomBar isDark={isDark} offsetLeft={sidebarOffset} active={isFolderOpen ? "files" : null} onChange={handleBottomBarChange} onCreatePost={openNewPost} query={query} onQueryChange={setQuery} />
      <NewPostModal isOpen={isNewPostOpen} onClose={() => setIsNewPostOpen(false)} isDark={isDark} onSubmit={handleCreatePost} onRequestOpen={() => setIsNewPostOpen(true)} />
      <HelpChatButton isDark={isDark} />
    </main>
  );
}