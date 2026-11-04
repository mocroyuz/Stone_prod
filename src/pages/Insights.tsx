// src/pages/Insights.tsx
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as RKey, type PointerEvent as RPtr, type ReactNode } from "react";
import {
  Activity, BarChart3, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Eye, FileText,
  FileType, Flame, Image as ImageIcon, LineChart, Lightbulb, Play, Plus, RefreshCw, Tag, Target, TrendingUp,
  UserPlus, Users, Zap,
} from "lucide-react";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import { navigateToSettingsSection } from "../utils/settingsNavigation";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, { useSidebarOffset, useFavorites } from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import HelpChatButton from "../components/Helpchatbutton";
import NewPostModal, { unavailablePostActionMessage } from "../components/Newpostmodal";
import { useConnectedChannels } from "../hooks/useConnectedChannels";
import { createPosts } from "../services/posts";
import { useYouTubeInsights } from "../services/youtube";

const PAGE_ROUTE = "insights";
const PAGE_SIZE = 10;
const DAY = 86_400_000;

/* ───────── TYPES ───────── */
type Range = "7d" | "30d" | "mtd" | "custom";
type ChartView = "this" | "comparison" | "both";
type ChartType = "line" | "bar";
type PostsPeriod = "this" | "previous";
type Cat = "posts" | "impact" | "growth" | "visibility" | "rate";
type Sub = "followers" | "video_views" | "posts_count" | "net_new";
type SortKey = "reactions" | "comments" | "engRate" | "videoViews";

type Point = {
  date: Date; posts: number; reactions: number; comments: number; followers: number;
  profileViews: number; netNewFollowers: number; followerGrowthRate: number;
};
type Summary = {
  followers: number; posts: number; reactions: number; comments: number; engRate: number;
  videoViews: number; shares: number; reach: number; watchMin: number; avgWatchSec: number;
};
type PostRow = {
  id: string; label: string; date: Date; media: "image" | "video" | "text"; thumbnailUrl?: string;
  reactions: number; comments: number; engRate: number; videoViews: number; status?: string; publishAt?: string | null;
};
type SeriesDef = { key: keyof Point; label: string; tone: 0 | 1; agg: "sum" | "last" | "avg" };
type ChartSeries = { label: string; color: string; values: number[]; prev: number[]; format?: (v: number) => string };

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 Days" }, { key: "30d", label: "30 Days" }, { key: "mtd", label: "Month to Date" }, { key: "custom", label: "Custom" },
];

/* ───────── STYLE ───────── */
const tokens = (d: boolean) =>
  d
    ? {
        page: "bg-[#050505]", text: "text-white", muted: "text-neutral-500", soft: "text-neutral-400",
        card: "border-white/[0.07] bg-[#0f0f11]", panel: "border-white/[0.07] bg-white/[0.025]", inner: "border-white/[0.07] bg-white/[0.03]",
        border: "border-white/[0.07]", head: "bg-white/[0.03]", primaryBtn: "bg-white text-black hover:bg-neutral-200",
        outlineBtn: "border border-white/10 text-white hover:bg-white/[0.07]", iconBox: "bg-white/[0.07] text-neutral-300",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30", hover: "hover:bg-white/[0.06]",
        sel: "bg-white text-black", idle: "text-neutral-400 hover:text-white", popover: "border-white/10 bg-[#101012]",
        up: "text-emerald-400", down: "text-rose-400",
      }
    : {
        page: "bg-[#f5f3ef]", text: "text-neutral-900", muted: "text-neutral-500", soft: "text-neutral-600",
        card: "border-black/[0.06] bg-white", panel: "border-black/[0.06] bg-[#f6f4f0]", inner: "border-black/[0.06] bg-white",
        border: "border-black/[0.06]", head: "bg-[#f6f4f0]", primaryBtn: "bg-neutral-900 text-white hover:bg-neutral-700",
        outlineBtn: "border border-black/10 text-neutral-900 hover:bg-neutral-100", iconBox: "bg-neutral-200/70 text-neutral-600",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25", hover: "hover:bg-black/[0.04]",
        sel: "bg-neutral-900 text-white", idle: "text-neutral-500 hover:text-neutral-900", popover: "border-black/10 bg-white",
        up: "text-emerald-700", down: "text-rose-700",
      };
type Tokens = ReturnType<typeof tokens>;

/* ───────── DATES & FORMAT ───────── */
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromInput = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
const fmtFull = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const fmtRange = (a: Date, b: Date) => `${fmt(a)} - ${fmtFull(b)}`;
const nf = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("en-US");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function resolveRange(range: Range, cs: Date, ce: Date) {
  const today = startOfDay(new Date());
  if (range === "7d") return { start: addDays(today, -6), end: today };
  if (range === "30d") return { start: addDays(today, -29), end: today };
  if (range === "mtd") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  let s = startOfDay(cs), e = startOfDay(ce);
  if (isNaN(s.getTime())) s = addDays(today, -29);
  if (isNaN(e.getTime())) e = today;
  if (s > e) [s, e] = [e, s];
  if (e > today) e = today;
  if (s > e) s = e;
  if ((e.getTime() - s.getTime()) / DAY > 365) s = addDays(e, -365);
  return { start: s, end: e };
}

/** Variation en % ; null si non comparable. */
const pct = (cur: number, prev: number): number | null => (prev === 0 ? (cur === 0 ? 0 : null) : ((cur - prev) / prev) * 100);

/* ───────── STORAGE SÉCURISÉ ───────── */
const readJSON = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const writeJSON = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

/* ───────── FILTRE PUBLIÉ ───────── */
const SCHEDULED = new Set(["scheduled", "pending", "draft", "queued", "future", "unpublished", "processing"]);
const isOnlinePost = (p: PostRow): boolean => {
  if (SCHEDULED.has(String(p.status ?? "").trim().toLowerCase())) return false;
  if (p.publishAt) { const ms = Date.parse(p.publishAt); if (Number.isFinite(ms) && ms > Date.now()) return false; }
  return !(p.date instanceof Date && p.date.getTime() > Date.now());
};

/* ───────── DONNÉES D'EXEMPLE ───────── */
function useInsights(start: Date, end: Date, sample: boolean) {
  const s = start.getTime(), e = end.getTime();
  return useMemo(() => {
    const days = Math.round((e - s) / DAY) + 1;
    const build = (from: Date, withPost: boolean): Point[] =>
      Array.from({ length: days }, (_, i) => ({
        date: addDays(from, i), posts: withPost && i === Math.max(0, days - 3) ? 1 : 0, reactions: 0, comments: 0,
        followers: 0, profileViews: 0, netNewFollowers: 0, followerGrowthRate: 0,
      }));
    const postDate = addDays(new Date(e), -2);
    const posts: PostRow[] = sample
      ? [{ id: "1", label: "Media only", date: postDate < new Date(s) ? new Date(s) : postDate, media: "image", reactions: 0, comments: 0, engRate: 0, videoViews: 0, status: "published" }]
      : [];
    return {
      current: build(new Date(s), sample), previous: build(addDays(new Date(s), -days), false),
      summary: { followers: 0, posts: posts.length, reactions: 0, comments: 0, engRate: 0, videoViews: 0, shares: 0, reach: 0, watchMin: 0, avgWatchSec: 0 } as Summary,
      posts, previousPosts: [] as PostRow[],
    };
  }, [s, e, sample]);
}

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

function downloadFile(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* ───────── GRAPHIQUE ───────── */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1)); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b;
    if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(pts[i][0] + h)},${f(pts[i][1] + t[i] * h)} ${f(pts[i + 1][0] - h)},${f(pts[i + 1][1] - t[i + 1] * h)} ${f(pts[i + 1][0])},${f(pts[i + 1][1])}`;
  }
  return d;
}

/** Max « rond » : 4 intervalles égaux, graduations alignées sur les deux axes. */
function niceMax(v: number) {
  const m = Math.max(4, v);
  const p = 10 ** Math.floor(Math.log10(m / 4));
  const step = ([1, 2, 2.5, 5, 10].find((k) => k * p * 4 >= m) ?? 10) * p;
  return step * 4;
}
const tickLabel = (v: number) => (Number.isInteger(v) ? nf(v) : v.toFixed(1));

function Chart({ dates, series, view, type, isDark, label }: { dates: Date[]; series: ChartSeries[]; view: ChartView; type: ChartType; isDark: boolean; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");
  const W = 900, H = 300;
  const pad = { l: 52, r: series.length > 1 ? 52 : 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = dates.length;
  const showThis = view !== "comparison", showPrev = view !== "this";
  const axis = isDark ? "#8a8a93" : "#737373";
  const grid = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  if (!n || !series.length) return null;

  const maxes = series.map((s) => niceMax(Math.max(0, ...(showThis ? s.values : []), ...(showPrev ? s.prev : []))));
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (si: number, v: number) => pad.t + ih - (v / maxes[si]) * ih;
  const path = (si: number, vals: number[]) => smoothPath(vals.map((v, i) => [x(i), y(si, v)]));
  const labelIdx = Array.from(new Set([0, 0.5, 1].map((r) => Math.round(r * (n - 1)))));
  const area = `${path(0, series[0].values)} L${x(n - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z`;
  const barW = Math.max(2, (iw / n) * (series.length > 1 ? 0.2 : 0.4));
  const bx = (si: number, i: number) => x(i) - (series.length > 1 ? (si === 0 ? barW + 1 : 0) : barW / 2);
  const bh = (si: number, v: number) => Math.max(1, ih - (y(si, v) - pad.t));

  const onPointer = (e: RPtr<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1)))));
  };
  const onKey = (e: RKey<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setHover((h) => Math.min(n - 1, (h ?? -1) + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setHover((h) => Math.max(0, (h ?? n) - 1)); }
    else if (e.key === "Escape") setHover(null);
  };

  return (
    <div
      className={`relative rounded-lg focus-visible:outline-none focus-visible:ring-2 ${isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25"}`}
      tabIndex={0} role="group" aria-label={`${label}. Use left and right arrow keys to inspect days.`}
      onKeyDown={onKey} onBlur={() => setHover(null)} onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y" onPointerMove={onPointer} onPointerDown={onPointer} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((k) => {
          const yy = pad.t + ih - (k / 4) * ih;
          return (
            <g key={k}>
              <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke={grid} />
              <text x={pad.l - 10} y={yy + 3.5} fontSize="11" fill={axis} textAnchor="end">{tickLabel((k / 4) * maxes[0])}</text>
              {series.length > 1 && <text x={W - pad.r + 10} y={yy + 3.5} fontSize="11" fill={axis} textAnchor="start">{tickLabel((k / 4) * maxes[1])}</text>}
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="11" fill={axis} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{fmt(dates[i])}</text>
        ))}

        {showPrev && series.map((s, si) => type === "line"
          ? <path key={`p${si}`} d={path(si, s.prev)} fill="none" stroke={s.color} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
          : <g key={`p${si}`} opacity="0.3">{s.prev.map((v, i) => <rect key={i} x={bx(si, i)} y={y(si, v)} width={barW} height={bh(si, v)} fill={s.color} rx={2} />)}</g>)}

        {showThis && type === "line" && (
          <>
            <path d={area} fill={`url(#${gradId})`} />
            {series.map((s, si) => <path key={si} d={path(si, s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
          </>
        )}
        {showThis && type === "bar" && series.map((s, si) => (
          <g key={si}>{s.values.map((v, i) => <rect key={i} x={bx(si, i)} y={y(si, v)} width={barW} height={bh(si, v)} fill={s.color} rx={2} />)}</g>
        ))}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={axis} strokeOpacity="0.6" strokeDasharray="3 3" />
            {showThis && series.map((s, si) => type === "line"
              ? <circle key={si} cx={x(hover)} cy={y(si, s.values[hover])} r="4.5" fill={isDark ? "#0f0f11" : "#fff"} stroke={s.color} strokeWidth="2.5" />
              : <rect key={si} x={bx(si, hover) - 2} y={y(si, s.values[hover]) - 2} width={barW + 4} height={bh(si, s.values[hover]) + 4} fill="none" stroke={s.color} strokeWidth="2" rx={2} />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          role="status"
          className={`pointer-events-none absolute top-1 z-10 min-w-[160px] rounded-xl px-3.5 py-2.5 text-[12px] shadow-2xl ${isDark ? "bg-[#101012] text-white ring-1 ring-white/10" : "bg-white text-neutral-900 ring-1 ring-black/10"}`}
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "-110%" : "10%"})` }}
        >
          <div className="mb-1 text-[11px] opacity-60">{fmtFull(dates[hover])}</div>
          {series.map((s, si) => (
            <div key={si} className="flex justify-between gap-5">
              <span>{s.label}</span>
              <b className="tabular-nums">
                {showThis ? (s.format ?? nf)(s.values[hover]) : (s.format ?? nf)(s.prev[hover])}
                {showThis && showPrev && <span className="ml-1.5 font-normal opacity-50">vs {(s.format ?? nf)(s.prev[hover])}</span>}
              </b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── UI ───────── */
function useClickOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener("mousedown", h); document.addEventListener("touchstart", h);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); };
  }, [ref, cb]);
}

function Segmented<T extends string>({ value, options, onChange, t, label }: { value: T; options: { key: T; label: string; icon?: ReactNode }[]; onChange: (k: T) => void; t: Tokens; label: string }) {
  return (
    <div role="group" aria-label={label} className={`inline-flex flex-wrap items-center gap-0.5 rounded-xl border p-1 ${t.panel}`}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all ${t.ring} ${value === o.key ? t.sel : t.idle}`}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

function Delta({ cur, prev, t }: { cur: number; prev: number; t: Tokens }) {
  const p = pct(cur, prev);
  if (p === null) return <span className={`text-[11px] font-semibold ${t.up}`}>New</span>;
  const r = Math.round(p * 10) / 10;
  const cls = r > 0 ? t.up : r < 0 ? t.down : t.muted;
  return <span className={`text-[11px] font-semibold tabular-nums ${cls}`}>{r > 0 ? "▲ +" : r < 0 ? "▼ " : "• "}{r}%</span>;
}

const SUMMARY_INFO: Record<string, string> = {
  "Total Followers": "Followers at the end of the period.", Posts: "Published posts (scheduled excluded).",
  Reactions: "Likes and other reactions.", Comments: "Comments received.", "Eng. Rate": "Engagement divided by reach.",
  "Video Views": "Total video views.", Shares: "Times your posts were shared.", Reach: "Unique accounts reached.",
  "Watch Time (min)": "Total minutes watched.", "Avg. Watch Time (sec)": "Average seconds watched per view.",
};

/* ───────── PAGE ───────── */
export default function Insights() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = useMemo(() => tokens(isDark), [isDark]);
  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();
  const hashKey = useHashChannel();
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const channel = channels.find((c) => c.key === (pickedKey ?? hashKey)) ?? channels[0];
  const chanKey = channel?.key ?? "none";
  const isYouTube = channel?.platform === "youtube";
  const chanName = (c: typeof channel) => (c ? ((c as { name?: string; label?: string }).name ?? (c as { label?: string }).label ?? c.key) : "");

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const [range, setRange] = useState<Range>("30d");
  const [customStart, setCustomStart] = useState(() => addDays(startOfDay(new Date()), -29));
  const [customEnd, setCustomEnd] = useState(() => startOfDay(new Date()));
  const [chartView, setChartView] = useState<ChartView>("this");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [postsPeriod, setPostsPeriod] = useState<PostsPeriod>("this");
  const [cat, setCat] = useState<Cat>("posts");
  const [sub, setSub] = useState<Sub>("posts_count");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  useClickOutside(exportRef, () => setIsExportOpen(false));
  useEffect(() => { setPage(1); }, [postsPeriod, range, query, sort, chanKey]);

  const { start, end } = useMemo(() => resolveRange(range, customStart, customEnd), [range, customStart, customEnd]);
  const yt = useYouTubeInsights(start, end, isYouTube && Boolean(channel), reloadKey);
  const fallback = useInsights(start, end, !isYouTube);
  const raw = isYouTube && yt.data ? yt.data : fallback;

  const posts = useMemo(() => raw.posts.filter(isOnlinePost), [raw.posts]);
  const previousPosts = useMemo(() => raw.previousPosts.filter(isOnlinePost), [raw.previousPosts]);
  const summary = useMemo<Summary>(() => ({ ...raw.summary, posts: posts.length }), [raw.summary, posts.length]);

  // Enrichissement : abonnés gagnés / taux de croissance (sans historique → 0, jamais de faux pic)
  const enrich = (arr: Point[], before?: Point) =>
    arr.map((p, i) => {
      const prevF = i > 0 ? arr[i - 1].followers : before?.followers ?? 0;
      const known = prevF > 0 && p.followers > 0;
      return { ...p, netNewFollowers: known ? Math.max(0, p.followers - prevF) : 0, followerGrowthRate: known ? ((p.followers - prevF) / prevF) * 100 : 0 };
    });
  const current = useMemo(() => enrich(raw.current, raw.previous[raw.previous.length - 1]), [raw.current, raw.previous]);
  const previous = useMemo(() => enrich(raw.previous), [raw.previous]);

  const days = current.length;
  const dates = current.map((p) => p.date);
  const prevStart = previous[0]?.date ?? addDays(start, -days);
  const prevEnd = previous[previous.length - 1]?.date ?? addDays(start, -1);
  const periodLabel = fmtRange(start, end);
  const compareLabel = `vs ${fmtRange(prevStart, prevEnd)}`;

  const sum = (arr: Point[], k: keyof Point) => arr.reduce((a, p) => a + (p[k] as number), 0);
  const prevSummary = { followers: previous[previous.length - 1]?.followers ?? 0, posts: previousPosts.length, reactions: sum(previous, "reactions"), comments: sum(previous, "comments") };

  const kpis: { label: string; value: string; cur?: number; prev?: number }[] = [
    { label: "Total Followers", value: nf(summary.followers), cur: summary.followers, prev: prevSummary.followers },
    { label: "Posts", value: nf(summary.posts), cur: summary.posts, prev: prevSummary.posts },
    { label: "Reactions", value: nf(summary.reactions), cur: summary.reactions, prev: prevSummary.reactions },
    { label: "Comments", value: nf(summary.comments), cur: summary.comments, prev: prevSummary.comments },
    { label: "Eng. Rate", value: `${summary.engRate}%` },
    { label: "Video Views", value: nf(summary.videoViews) },
    { label: "Shares", value: nf(summary.shares) },
    { label: "Reach", value: nf(summary.reach) },
    { label: "Watch Time (min)", value: nf(summary.watchMin) },
    { label: "Avg. Watch Time (sec)", value: nf(summary.avgWatchSec) },
  ];

  /* ── Fidélisation : objectif hebdo, série, mémoire des visites ── */
  const goalKey = `insights:goal:${chanKey}`;
  const [goal, setGoal] = useState(3);
  useEffect(() => { setGoal(readJSON<number>(goalKey) ?? 3); }, [goalKey]);
  const changeGoal = (d: number) => setGoal((g) => { const v = Math.max(1, Math.min(21, g + d)); writeJSON(goalKey, v); return v; });

  const last7Posts = current.slice(-7).reduce((a, p) => a + p.posts, 0);
  const streak = useMemo(() => {
    let i = current.length - 1;
    if (i >= 0 && current[i].posts === 0) i--; // aujourd'hui pas encore publié : la série reste vivante
    let s = 0;
    while (i >= 0 && current[i].posts > 0) { s++; i--; }
    return s;
  }, [current]);

  const [visit, setVisit] = useState<{ t: number; followers: number } | null>(null);
  const visitDone = useRef<string>("");
  useEffect(() => {
    if (!channel || yt.loading || visitDone.current === chanKey) return;
    visitDone.current = chanKey;
    const k = `insights:visit:${chanKey}`;
    setVisit(readJSON(k));
    writeJSON(k, { t: Date.now(), followers: summary.followers });
  }, [channel, chanKey, yt.loading, summary.followers]);
  const gained = visit ? summary.followers - visit.followers : 0;
  const daysAway = visit ? Math.floor((Date.now() - visit.t) / DAY) : 0;

  const byWeekday = useMemo(() => {
    const c = Array(7).fill(0) as number[];
    posts.forEach((p) => { c[p.date.getDay()]++; });
    return c;
  }, [posts]);
  const bestDay = byWeekday.some((v) => v > 0) ? byWeekday.indexOf(Math.max(...byWeekday)) : -1;
  const bestPost = useMemo(() => posts.reduce<PostRow | null>((b, p) => (!b || p.reactions + p.comments > b.reactions + b.comments ? p : b), null), [posts]);
  const hasActivity = posts.length > 0 || summary.followers > 0 || summary.reach > 0;

  const tips = useMemo(() => {
    const out: string[] = [];
    if (last7Posts < goal) out.push(`You published ${last7Posts}/${goal} posts this week. ${goal - last7Posts} more to hit your goal.`);
    else out.push("Weekly goal reached. Keep the rhythm going.");
    if (bestDay >= 0 && posts.length >= 3) out.push(`${WEEKDAYS[bestDay]} is your most active publishing day. Test other days to compare.`);
    const f = pct(summary.reactions, prevSummary.reactions);
    if (f !== null && f < -10) out.push(`Reactions dropped ${Math.abs(Math.round(f))}% vs the previous period. Try a new format.`);
    if (f !== null && f > 10) out.push(`Reactions are up ${Math.round(f)}%. Reuse what worked in your best post.`);
    if (streak === 0 && days >= 7) out.push("No active streak. One post today starts a new one.");
    return out.slice(0, 4);
  }, [last7Posts, goal, bestDay, posts.length, summary.reactions, prevSummary.reactions, streak, days]);

  /* ── Graphique ── */
  const TONES = [isDark ? "#ffffff" : "#111111", isDark ? "#8a8a93" : "#9a9a9a"];
  const activeSeries: SeriesDef[] = (() => {
    if (cat === "posts") {
      if (sub === "followers") return [{ key: "followers", label: "Followers", tone: 0, agg: "last" }];
      if (sub === "video_views") return [{ key: "profileViews", label: "Video Views", tone: 0, agg: "sum" }];
      if (sub === "net_new") return [{ key: "netNewFollowers", label: "Net New Followers", tone: 0, agg: "sum" }];
      return [{ key: "posts", label: "Posts", tone: 0, agg: "sum" }, { key: "reactions", label: "Reactions", tone: 1, agg: "sum" }];
    }
    if (cat === "impact") return [{ key: "reactions", label: "Reactions", tone: 0, agg: "sum" }, { key: "comments", label: "Comments", tone: 1, agg: "sum" }];
    if (cat === "growth") return [{ key: "followers", label: "Followers", tone: 0, agg: "last" }];
    if (cat === "rate") return [{ key: "followerGrowthRate", label: "Growth Rate", tone: 0, agg: "avg" }];
    return [{ key: "profileViews", label: isYouTube ? "Channel Views" : "Profile Views", tone: 0, agg: "sum" }, { key: "followers", label: "Followers", tone: 1, agg: "last" }];
  })();
  const pctFmt = (v: number) => `${v.toFixed(2)}%`;
  const chartSeries: ChartSeries[] = activeSeries.map((s) => ({
    label: s.label, color: TONES[s.tone],
    values: current.map((p) => p[s.key] as number), prev: previous.map((p) => p[s.key] as number),
    format: s.key === "followerGrowthRate" ? pctFmt : undefined,
  }));
  const seriesTotal = (s: SeriesDef) => {
    if (s.agg === "sum") return sum(current, s.key);
    if (s.agg === "avg") return sum(current, s.key) / (days || 1);
    return (current[days - 1]?.[s.key] as number) ?? 0;
  };

  /* ── Tableau ── */
  const rows = postsPeriod === "this" ? posts : previousPosts;
  const needle = query.trim().toLowerCase();
  const sortedRows = useMemo(() => {
    const m = needle ? rows.filter((p) => p.label.toLowerCase().includes(needle)) : rows;
    if (!sort) return m;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...m].sort((a, b) => (a[sort.key] - b[sort.key]) * dir);
  }, [rows, sort, needle]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const toggleSort = (key: SortKey) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  const columns: { key: SortKey; label: string; render: (p: PostRow) => string }[] = [
    { key: "reactions", label: "Reactions", render: (p) => nf(p.reactions) },
    { key: "comments", label: "Comments", render: (p) => nf(p.comments) },
    { key: "engRate", label: "Eng. Rate", render: (p) => `${p.engRate.toFixed(2)}%` },
    { key: "videoViews", label: "Video Views", render: (p) => nf(p.videoViews) },
  ];

  /* ── Exports & partage ── */
  const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const triggerExport = (format: "csv" | "md" | "pdf") => {
    setIsExportOpen(false);
    if (format === "pdf") { window.print(); return; }
    const name = `insights-${toInput(start)}-${toInput(end)}`;
    const head = ["Date", "Followers", "Posts", "Reactions", "Comments", "Profile Views"];
    const line = (p: Point) => [toInput(p.date), p.followers, p.posts, p.reactions, p.comments, p.profileViews];
    if (format === "csv") {
      downloadFile(`${name}.csv`, [head, ...current.map(line)].map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv");
    } else {
      let md = `# Insights Report${channel ? ` · ${chanName(channel)}` : ""}\n\n**Period:** ${periodLabel}\n\n## Summary\n\n| Metric | Value |\n|---|---|\n`;
      kpis.forEach((b) => { md += `| ${b.label} | ${b.value} |\n`; });
      md += `\n## Daily Data\n\n| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|\n`;
      current.forEach((p) => { md += `| ${line(p).join(" | ")} |\n`; });
      downloadFile(`${name}.md`, md, "text/markdown");
    }
  };
  const shareSummary = async () => {
    const txt = `${chanName(channel)} · ${periodLabel}\nFollowers: ${nf(summary.followers)} | Posts: ${summary.posts} | Reactions: ${nf(summary.reactions)} | Comments: ${nf(summary.comments)}`;
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const onBottomBar = (id: BottomBarTab) => {
    if (id === "add") { setIsFolderOpen(false); setIsNewPostOpen(true); }
    else if (id === "files") setIsFolderOpen((o) => !o);
  };

  const mediaIcon = (m: PostRow["media"]) => (m === "video" ? <Play className="h-4 w-4" /> : m === "text" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />);
  const card = `rounded-2xl border p-4 ${t.card}`;
  const title = `text-[15px] font-semibold tracking-[-0.02em] ${t.text}`;
  const sub2 = `mt-1 text-[11px] ${t.muted}`;

  const CATS: { key: Cat; label: string; icon: ReactNode }[] = [
    { key: "posts", label: "Posts", icon: <Copy className="h-4 w-4" aria-hidden="true" /> },
    { key: "impact", label: "Content Impact", icon: <Zap className="h-4 w-4" aria-hidden="true" /> },
    { key: "growth", label: "Audience Growth", icon: <TrendingUp className="h-4 w-4" aria-hidden="true" /> },
    { key: "visibility", label: "Visibility", icon: <Eye className="h-4 w-4" aria-hidden="true" /> },
    { key: "rate", label: "Follower Growth Rate", icon: <Activity className="h-4 w-4" aria-hidden="true" /> },
  ];
  const SUBS: { key: Sub; label: string; icon: ReactNode }[] = [
    { key: "posts_count", label: "Posts", icon: <Copy className="h-3.5 w-3.5" /> },
    { key: "followers", label: "Followers", icon: <Users className="h-3.5 w-3.5" /> },
    { key: "video_views", label: "Video Views", icon: <Eye className="h-3.5 w-3.5" /> },
    { key: "net_new", label: "Net New", icon: <UserPlus className="h-3.5 w-3.5" /> },
  ];

  const gridCols = "grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_1fr]";

  return (
    <main className={`relative h-screen w-full overflow-hidden transition-colors duration-300 ${t.page}`}>
      <style>{`@media print{body *{visibility:hidden}#print-area,#print-area *{visibility:visible}#print-area{position:absolute;left:0;top:0;width:100%;padding:20px;background:#fff;color:#000!important}.print\\:hidden{display:none!important}.print-card{border:1px solid #e5e5e5!important;background:#fff!important;break-inside:avoid}}`}</style>

      <DashboardSidebar theme={theme} />

      <div className="h-full py-3 pr-3 transition-[padding-left] duration-300 ease-in-out motion-reduce:transition-none" style={{ paddingLeft: sidebarOffset }}>
        <div className={`h-full overflow-y-auto overflow-x-hidden rounded-[28px] border transition-colors duration-300 ${isDark ? "border-white/[0.07] bg-[#0a0a0c]" : "border-black/[0.06] bg-white"}`}>
          <div id="print-area" className="mx-auto flex w-full max-w-[1720px] flex-col gap-6 px-[clamp(18px,3vw,48px)] pb-[120px] pt-[clamp(18px,3vw,30px)]">

            {/* HEADER */}
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${t.inner} ${t.soft}`}><Activity className="h-5 w-5" /></span>
                <h1 className={`truncate text-[20px] font-semibold tracking-[-0.03em] ${t.text}`}>Insights</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {channels.length > 1 && (
                  <select aria-label="Channel" value={chanKey} onChange={(e) => setPickedKey(e.target.value)}
                    className={`h-10 rounded-xl border px-3 text-[12px] font-semibold ${t.ring} ${t.inner} ${t.text}`}>
                    {channels.map((c) => <option key={c.key} value={c.key}>{chanName(c)}</option>)}
                  </select>
                )}
                {isYouTube && (
                  <button type="button" aria-label="Refresh insights" onClick={() => setReloadKey((k) => k + 1)} className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.ring} ${t.soft} ${t.hover}`}>
                    <RefreshCw className={`h-4 w-4 ${yt.loading ? "animate-spin" : ""}`} />
                  </button>
                )}
                <button type="button" onClick={shareSummary} className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold ${t.ring} ${t.outlineBtn}`}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Share"}
                </button>
                <div ref={exportRef} className="relative">
                  <button type="button" aria-haspopup="menu" aria-expanded={isExportOpen} onClick={() => setIsExportOpen((o) => !o)} className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold ${t.ring} ${t.outlineBtn}`}>
                    <Download className="h-4 w-4" />Export<ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${isExportOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isExportOpen && (
                    <div role="menu" className={`absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border p-1 shadow-2xl ${t.popover}`}>
                      {([["csv", "CSV Table", FileText], ["md", "Markdown", FileType], ["pdf", "PDF (Print)", Download]] as const).map(([k, l, Ic]) => (
                        <button key={k} role="menuitem" onClick={() => triggerExport(k)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium ${t.text} ${t.hover}`}>
                          <Ic className="h-4 w-4 opacity-50" />{l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" aria-label="Bookmark page" aria-pressed={saved} onClick={() => toggleFavorite(PAGE_ROUTE)} className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.ring} ${t.soft} ${t.hover}`}>
                  <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>

            {!channel ? (
              <section className={`flex flex-col items-center gap-3 rounded-2xl border px-6 py-20 text-center ${t.panel}`}>
                <Activity className={`h-8 w-8 ${t.soft}`} />
                <h2 className={`text-[14px] font-semibold ${t.text}`}>Connect a channel to see insights</h2>
                <button type="button" onClick={() => navigateToSettingsSection("channels")} className={`mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold ${t.ring} ${t.primaryBtn}`}>
                  <Plus className="h-3.5 w-3.5" />Connect a channel
                </button>
              </section>
            ) : (
              <>
                {isYouTube && yt.error && (
                  <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-500">
                    <p className="text-[12.5px]">Could not load YouTube insights: {yt.error}</p>
                    <button onClick={() => setReloadKey((k) => k + 1)} className="text-[11px] font-semibold underline">Retry</button>
                  </div>
                )}

                {/* ACCUEIL / RETOUR */}
                <section className={`${card} print:hidden`} aria-live="polite">
                  <h2 className={title}>{visit ? `Welcome back${daysAway > 0 ? `, ${daysAway} day${daysAway > 1 ? "s" : ""} later` : ""}` : `Welcome to ${chanName(channel)}'s insights`}</h2>
                  <p className={sub2}>
                    {visit
                      ? gained > 0 ? `You gained ${nf(gained)} follower${gained > 1 ? "s" : ""} since your last visit.` : gained < 0 ? `${nf(-gained)} follower${gained < -1 ? "s" : ""} lost since your last visit.` : "Follower count is unchanged since your last visit."
                      : "Come back regularly: we'll show what changed since your last visit."}
                  </p>
                </section>

                {/* PÉRIODE */}
                <section className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                  <div className="flex flex-wrap items-center gap-3">
                    <Segmented<Range> label="Date range" value={range} onChange={setRange} t={t} options={RANGES.map((r) => ({ key: r.key, label: r.label }))} />
                    {range === "custom" && (
                      <div className="flex items-center gap-2">
                        <input type="date" aria-label="Start date" max={toInput(customEnd)} value={toInput(customStart)} onChange={(e) => e.target.value && setCustomStart(fromInput(e.target.value))} className={`rounded-lg border px-2 py-1.5 text-[12px] ${t.inner} ${t.text} ${t.ring}`} />
                        <span className={t.muted}>→</span>
                        <input type="date" aria-label="End date" min={toInput(customStart)} max={toInput(new Date())} value={toInput(customEnd)} onChange={(e) => e.target.value && setCustomEnd(fromInput(e.target.value))} className={`rounded-lg border px-2 py-1.5 text-[12px] ${t.inner} ${t.text} ${t.ring}`} />
                      </div>
                    )}
                  </div>
                  <button onClick={() => navigate("tags")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold ${t.ring} ${t.text} ${t.hover}`}><Tag className="h-4 w-4" />Tags</button>
                </section>

                {!hasActivity && !yt.loading && (
                  <section className={`flex flex-col items-center gap-2 rounded-2xl border px-6 py-12 text-center ${t.panel}`}>
                    <Activity className={`h-7 w-7 ${t.soft}`} />
                    <h2 className={`text-[14px] font-semibold ${t.text}`}>No activity on this channel yet</h2>
                    <p className={`max-w-md text-[12px] ${t.muted}`}>Publish your first post or pick a longer range to see trends here.</p>
                  </section>
                )}

                {/* OBJECTIF + SÉRIE + CONSEILS */}
                <section className="grid gap-4 lg:grid-cols-3 print:hidden">
                  <div className={card}>
                    <div className="flex items-center gap-2"><Target className={`h-4 w-4 ${t.soft}`} /><h3 className={title}>Weekly goal</h3></div>
                    <p className={`mt-3 text-[28px] font-bold leading-none tabular-nums ${t.text}`}>{last7Posts}<span className={`text-[16px] font-medium ${t.muted}`}> / {goal} posts</span></p>
                    <div className={`mt-3 h-2 overflow-hidden rounded-full ${t.panel} border`} role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(last7Posts, goal)} aria-label="Weekly goal progress">
                      <div className={`h-full rounded-full ${isDark ? "bg-white" : "bg-neutral-900"} transition-all`} style={{ width: `${Math.min(100, (last7Posts / goal) * 100)}%` }} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button aria-label="Decrease goal" onClick={() => changeGoal(-1)} className={`h-7 w-7 rounded-lg border text-[14px] font-semibold ${t.ring} ${t.inner} ${t.text} ${t.hover}`}>−</button>
                      <button aria-label="Increase goal" onClick={() => changeGoal(1)} className={`h-7 w-7 rounded-lg border text-[14px] font-semibold ${t.ring} ${t.inner} ${t.text} ${t.hover}`}>+</button>
                      <span className={`text-[11px] ${t.muted}`}>Saved for this channel</span>
                    </div>
                  </div>
                  <div className={card}>
                    <div className="flex items-center gap-2"><Flame className={`h-4 w-4 ${t.soft}`} /><h3 className={title}>Posting streak</h3></div>
                    <p className={`mt-3 text-[28px] font-bold leading-none tabular-nums ${t.text}`}>{streak}<span className={`text-[16px] font-medium ${t.muted}`}> day{streak === 1 ? "" : "s"}</span></p>
                    <p className={sub2}>{streak > 0 ? "Consecutive days with a published post." : "Post today to start a streak."}</p>
                    <div className="mt-3 flex items-end gap-1" role="img" aria-label={`Posts by weekday: ${WEEKDAYS.map((d, i) => `${d} ${byWeekday[i]}`).join(", ")}`}>
                      {byWeekday.map((v, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div className={`w-full rounded-sm ${i === bestDay ? (isDark ? "bg-white" : "bg-neutral-900") : isDark ? "bg-white/25" : "bg-black/20"}`} style={{ height: `${4 + (v / (Math.max(...byWeekday) || 1)) * 28}px` }} />
                          <span className={`text-[9px] ${t.muted}`}>{WEEKDAYS[i][0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={card}>
                    <div className="flex items-center gap-2"><Lightbulb className={`h-4 w-4 ${t.soft}`} /><h3 className={title}>Recommendations</h3></div>
                    <ul className={`mt-3 space-y-2 text-[12.5px] ${t.text}`}>{tips.map((tp) => <li key={tp} className="leading-snug">• {tp}</li>)}</ul>
                  </div>
                </section>

                {/* SUMMARY */}
                <section className={card}>
                  <h3 className={`${title} px-1`}>Summary</h3>
                  <p className={`${sub2} px-1`}>{periodLabel} · {compareLabel}</p>
                  <div className={`mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border p-3 sm:grid-cols-3 lg:grid-cols-5 ${t.panel}`}>
                    {kpis.map((b) => (
                      <div key={b.label} title={SUMMARY_INFO[b.label]} className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${t.inner}`}>
                        <span className={`text-[10px] font-medium ${t.soft}`}>{b.label}</span>
                        <span className={`text-[20px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>{b.value}</span>
                        {b.cur !== undefined && b.prev !== undefined && <Delta cur={b.cur} prev={b.prev} t={t} />}
                      </div>
                    ))}
                  </div>
                </section>

                {/* GRAPHIQUE */}
                <section className={`${card} print-card`}>
                  <div className="flex flex-wrap items-center gap-2 print:hidden" role="tablist" aria-label="Metric category">
                    {CATS.map((c) => (
                      <button key={c.key} role="tab" aria-selected={cat === c.key} onClick={() => setCat(c.key)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-all ${t.ring} ${cat === c.key ? `${t.sel} border-transparent` : `${t.panel} ${t.idle}`}`}>
                        {c.icon}{c.label}
                      </button>
                    ))}
                  </div>
                  {cat === "posts" && <div className="mt-3 print:hidden"><Segmented<Sub> label="Posts metric" value={sub} onChange={setSub} t={t} options={SUBS} /></div>}

                  <div className={`mt-5 rounded-2xl border p-4 ${t.panel}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap gap-x-10 gap-y-3 pl-2">
                        {activeSeries.map((s) => (
                          <div key={s.key}>
                            <p className={`text-[11px] font-medium ${t.soft}`}>{s.label}</p>
                            <p className={`mt-1.5 flex items-center gap-2 text-[28px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>
                              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TONES[s.tone] }} />
                              {s.key === "followerGrowthRate" ? pctFmt(seriesTotal(s)) : nf(seriesTotal(s))}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 print:hidden">
                        <Segmented<ChartType> label="Chart type" value={chartType} onChange={setChartType} t={t}
                          options={[{ key: "line", label: "Line", icon: <LineChart className="h-3.5 w-3.5" /> }, { key: "bar", label: "Bar", icon: <BarChart3 className="h-3.5 w-3.5" /> }]} />
                        <Segmented<ChartView> label="Chart view" value={chartView} onChange={setChartView} t={t}
                          options={[{ key: "this", label: "This Period" }, { key: "comparison", label: "Comparison" }, { key: "both", label: "Both" }]} />
                      </div>
                    </div>
                    <div className="mt-6">
                      <Chart dates={dates} series={chartSeries} view={chartView} type={chartType} isDark={isDark} label={`${activeSeries.map((s) => s.label).join(" and ")} over ${periodLabel}`} />
                    </div>
                  </div>
                </section>

                {/* TABLEAU */}
                <section className={`${card} print-card`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div>
                      <h3 className={title}>Performance per Post</h3>
                      <p className={sub2}>{postsPeriod === "this" ? periodLabel : fmtRange(prevStart, prevEnd)}</p>
                    </div>
                    <div className="print:hidden">
                      <Segmented<PostsPeriod> label="Posts period" value={postsPeriod} onChange={setPostsPeriod} t={t}
                        options={[{ key: "this", label: "This Period" }, { key: "previous", label: "Previous Period" }]} />
                    </div>
                  </div>

                  <div className={`mt-4 overflow-hidden rounded-2xl border ${t.panel}`}>
                    <div className="overflow-x-auto">
                      <div className="min-w-[680px]" role="table" aria-label="Performance per post">
                        <div role="row" className={`grid ${gridCols} items-center gap-2 px-4 py-3 text-[12px] font-semibold ${t.head} ${t.text}`}>
                          <span role="columnheader">Posts · {sortedRows.length}</span>
                          {columns.map((c) => (
                            <span role="columnheader" key={c.key} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                              <button onClick={() => toggleSort(c.key)} className={`flex w-fit items-center gap-1 ${t.ring}`}>
                                {c.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${sort?.key === c.key && sort.dir === "asc" ? "rotate-180" : ""}`} />
                              </button>
                            </span>
                          ))}
                        </div>
                        {pageRows.length === 0 ? (
                          <div className={`border-t px-6 py-10 text-center ${t.border}`}>
                            <p className={`text-[12px] font-medium ${t.text}`}>{needle ? "No post matches your search" : "No published posts in this period"}</p>
                          </div>
                        ) : pageRows.map((p, idx) => (
                          <div role="row" key={p.id} className={`grid ${gridCols} items-center gap-2 border-t px-4 py-3 text-[13px] ${t.border} ${t.text}`}>
                            <div role="cell" className="flex min-w-0 items-center gap-3">
                              <span className={`w-6 shrink-0 text-[12px] ${t.muted}`}>#{(safePage - 1) * PAGE_SIZE + idx + 1}</span>
                              <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${t.iconBox}`}>
                                {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : mediaIcon(p.media)}
                              </span>
                              <div className="min-w-0">
                                <p className={`flex items-center gap-2 truncate text-[14px] font-medium ${t.text}`}>
                                  <span className="truncate">{p.label}</span>
                                  {bestPost?.id === p.id && postsPeriod === "this" && posts.length > 1 && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${t.sel}`}>Best</span>}
                                </p>
                                <p className={`text-[11px] ${t.muted}`}>{fmtFull(p.date)}</p>
                              </div>
                            </div>
                            {columns.map((c) => <span role="cell" key={c.key} className="tabular-nums">{c.render(p)}</span>)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-3 print:hidden">
                      <button aria-label="Previous page" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1} className={`flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30 ${t.ring} ${t.soft} ${t.hover}`}><ChevronLeft className="h-4 w-4" /></button>
                      <span className={`text-[12px] tabular-nums ${t.soft}`}>Page {safePage} / {totalPages}</span>
                      <button aria-label="Next page" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages} className={`flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30 ${t.ring} ${t.soft} ${t.hover}`}><ChevronRight className="h-4 w-4" /></button>
                    </nav>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      <Folder isOpen={isFolderOpen} onClose={() => setIsFolderOpen(false)} isDark={isDark} offsetLeft={sidebarOffset} />
      <BottomBar isDark={isDark} offsetLeft={sidebarOffset} active={isFolderOpen ? "files" : null} onChange={onBottomBar} onCreatePost={() => onBottomBar("add")} query={query} onQueryChange={setQuery} />
      <NewPostModal isOpen={isNewPostOpen} onClose={() => setIsNewPostOpen(false)} isDark={isDark}
        onSubmit={async (p) => { if (p.scheduleMode === "later") await createPosts(p); else throw new Error(unavailablePostActionMessage(p)); }}
        onRequestOpen={() => setIsNewPostOpen(true)} />
      <HelpChatButton isDark={isDark} />
    </main>
  );
}