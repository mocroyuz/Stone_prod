// src/pages/Insights.tsx
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
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FileType,
  FlaskConical,
  Image as ImageIcon,
  Info,
  LineChart,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Send,
  Tag,
  TrendingUp,
  UserPlus,
  Users,
  BarChart3,
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

const PAGE_ROUTE = "insights";
const PAGE_SIZE = 10;

/* ============================================================
   TYPES
============================================================ */

type IconComponent = ComponentType<{ className?: string; size?: number }>;

type Range = "7d" | "30d" | "mtd" | "custom";
type ChartView = "this" | "comparison" | "both";
type ChartType = "line" | "bar";
type PostsPeriod = "this" | "previous";
type MetricCategory = "posts" | "impact" | "growth" | "visibility" | "follower_growth_rate";
type SubMetric = "followers" | "video_views" | "posts_count" | "net_new_followers";
type SortKey = "reactions" | "comments" | "engRate" | "videoViews";

type Point = {
  date: Date;
  posts: number;
  reactions: number;
  comments: number;
  followers: number;
  profileViews: number;
  netNewFollowers: number;
  followerGrowthRate: number;
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
  status?: string;
  publishAt?: string | null;
};

type SeriesDef = { 
  key: keyof Point; 
  label: string; 
  tone: 0 | 1 | 2; 
  agg: "sum" | "last" | "avg" 
};

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "mtd", label: "Month to Date" },
  { key: "custom", label: "Custom" },
];

/* ============================================================
   STYLE
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
   FILTRE
============================================================ */

const SCHEDULED_STATUSES = new Set([
  "scheduled", "pending", "draft", "queued", "future", "unpublished", "processing",
]);

const isOnlinePost = (p: PostRow): boolean => {
  const status = String((p as { status?: unknown }).status ?? "").trim().toLowerCase();
  if (SCHEDULED_STATUSES.has(status)) return false;

  const raw = (p as { publishAt?: unknown }).publishAt ?? (p as { publish_at?: unknown }).publish_at;
  if (raw) {
    const ms = typeof raw === "string" ? Date.parse(raw) : raw instanceof Date ? raw.getTime() : NaN;
    if (Number.isFinite(ms) && ms > Date.now()) return false;
  }

  if (p.date instanceof Date && p.date.getTime() > Date.now()) return false;
  return true;
};

/* ============================================================
   DONNÉES D'EXEMPLE
============================================================ */

function useInsights(start: Date, end: Date, sample: boolean) {
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
        netNewFollowers: 0,
        followerGrowthRate: 0,
      }));

    const current = build(new Date(s), sample);
    const previous = build(addDays(new Date(s), -days), false);

    const postDate = addDays(new Date(e), -2);
    const posts: PostRow[] = sample ? [{
      id: "1", label: "Media only", date: postDate < new Date(s) ? new Date(s) : postDate, media: "image", reactions: 0, comments: 0, engRate: 0, videoViews: 0, status: "published",
    }] : [];

    return {
      current,
      previous,
      summary: { followers: 0, posts: posts.length, reactions: 0, comments: 0, engRate: 0, videoViews: 0, shares: 0, reach: 0, watchMin: 0, avgWatchSec: 0 },
      posts,
      previousPosts: [] as PostRow[],
    };
  }, [s, e, sample]);
}

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

/* ============================================================
   EXPORT HELPERS
============================================================ */

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   COURBE LISSÉE & CHART
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
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
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

type ChartSeries = { label: string; color: string; values: number[]; prev: number[]; format?: (v: number) => string };

function Chart({ 
  dates, 
  series, 
  view, 
  type,
  isDark 
}: { 
  dates: Date[]; 
  series: ChartSeries[]; 
  view: ChartView; 
  type: ChartType;
  isDark: boolean 
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");
  const W = 900, H = 300;
  const pad = { l: 52, r: series.length > 1 ? 52 : 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = dates.length;

  const showThis = view === "this" || view === "both";
  const showPrev = view === "comparison" || view === "both";
  const axis = isDark ? "#6b6b72" : "#a3a3a3";
  const grid = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  const maxes = series.map((s) => Math.max(4, ...(showThis ? s.values : []), ...(showPrev ? s.prev : [])));
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (si: number, v: number) => pad.t + ih - (v / (maxes[si] || 1)) * ih;
  const path = (si: number, vals: number[]) => smoothPath(vals.map((v, i) => [x(i), y(si, v)] as [number, number]));

  const ticks = [0, 1, 2, 3, 4];
  const labelIdx = Array.from(new Set([0, 0.5, 1].map((r) => Math.round(r * (n - 1)))));
  const area = `${path(0, series[0].values)} L${x(n - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z`;

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = n === 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  // Bar width calculation: thin bars
  const barW = Math.max(2, (iw / n) * (series.length > 1 ? 0.2 : 0.4));

  return (
    <div className={`relative rounded-lg focus-visible:outline-none focus-visible:ring-2 ${isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25"}`} tabIndex={0} role="group" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y" onPointerMove={onPointer} onPointerDown={onPointer} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <text x={12} y={pad.t + ih / 2} fontSize="11" fill={axis} textAnchor="middle" transform={`rotate(-90 12 ${pad.t + ih / 2})`}>{series[0].label}</text>
        {series.length > 1 && <text x={W - 12} y={pad.t + ih / 2} fontSize="11" fill={axis} textAnchor="middle" transform={`rotate(90 ${W - 12} ${pad.t + ih / 2})`}>{series[1].label}</text>}
        
        {ticks.map((tk) => {
          const yy = pad.t + ih - (tk / 4) * ih;
          return (
            <g key={tk}>
              <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke={grid} />
              <text x={pad.l - 10} y={yy + 3.5} fontSize="11" fill={axis} textAnchor="end" className="tabular-nums">{Math.round((tk / 4) * maxes[0])}</text>
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="11" fill={axis} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{fmt(dates[i])}</text>
        ))}

        {/* PREVIOUS PERIOD */}
        {showPrev && series.map((s, si) => (
          type === "line" ? (
            <path key={`p-${s.label}`} d={path(si, s.prev)} fill="none" stroke={s.color} strokeOpacity="0.3" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
          ) : (
            <g key={`p-${s.label}`} opacity="0.3">
              {s.prev.map((v, i) => (
                <rect
                  key={i}
                  x={x(i) - (series.length > 1 ? (si === 0 ? barW + 1 : 0) : barW / 2)}
                  y={y(si, v)}
                  width={barW}
                  height={ih - (y(si, v) - pad.t)}
                  fill={s.color}
                  rx={2}
                />
              ))}
            </g>
          )
        ))}

        {/* CURRENT PERIOD */}
        {showThis && type === "line" && (
          <>
            <path d={area} fill={`url(#${gradId})`} />
            {series.map((s, si) => (
              <path key={s.label} d={path(si, s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </>
        )}

        {showThis && type === "bar" && series.map((s, si) => (
          <g key={s.label}>
            {s.values.map((v, i) => (
              <rect
                key={i}
                x={x(i) - (series.length > 1 ? (si === 0 ? barW + 1 : 0) : barW / 2)}
                y={y(si, v)}
                width={barW}
                height={Math.max(1, ih - (y(si, v) - pad.t))}
                fill={s.color}
                rx={2}
                className="transition-all duration-300"
              />
            ))}
          </g>
        ))}

        {/* HOVER EFFECT */}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={axis} strokeOpacity="0.6" strokeDasharray="3 3" />
            {showThis && series.map((s, si) => (
              type === "line" ? (
                <circle key={s.label} cx={x(hover)} cy={y(si, s.values[hover])} r="4.5" fill={isDark ? "#0f0f11" : "#fff"} stroke={s.color} strokeWidth="2.5" />
              ) : (
                <rect 
                  key={s.label} 
                  x={x(hover) - (series.length > 1 ? (si === 0 ? barW + 1 : 0) : barW / 2) - 2} 
                  y={y(si, s.values[hover]) - 2} 
                  width={barW + 4} 
                  height={Math.max(1, ih - (y(si, s.values[hover]) - pad.t)) + 4} 
                  fill="none" 
                  stroke={s.color} 
                  strokeWidth="2"
                  rx={2}
                />
              )
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className={`pointer-events-none absolute top-1 z-10 min-w-[160px] rounded-xl px-3.5 py-2.5 text-[12px] shadow-2xl ${isDark ? "bg-[#101012] text-white ring-1 ring-white/10" : "bg-white text-neutral-900 ring-1 ring-black/10"}`} style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "-110%" : "10%"})` }}>
          <div className="mb-1 text-[11px] opacity-50">{fmtFull(dates[hover])}</div>
          {showThis && series.map((s) => (
            <div key={s.label} className="flex justify-between gap-5">
              <span>{s.label}</span>
              <b className="tabular-nums">{s.format ? s.format(s.values[hover]) : nf(s.values[hover])}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   COMPOSANTS UI (Dropdowns & Menus)
============================================================ */

function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [ref, onOutside]);
}

function Segmented<T extends string>({ value, options, onChange, t, label }: { value: T; options: { key: T; label: string; icon?: ReactNode }[]; onChange: (k: T) => void; t: Tokens; label: string; }) {
  return (
    <div role="group" aria-label={label} className={`inline-flex flex-wrap items-center gap-0.5 rounded-xl border p-1 ${t.panel}`}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button key={o.key} type="button" aria-pressed={active} onClick={() => onChange(o.key)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all ${t.ring} ${active ? t.sel : t.idle}`}>
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function IconBtn({ label, onClick, children, t, boxed = false }: { label: string; onClick?: () => void; children: ReactNode; t: Tokens; boxed?: boolean; }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${t.ring} ${t.soft} ${boxed ? `border ${t.inner} ${t.hover}` : t.hover}`}>
      {children}
    </button>
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

export default function Insights() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = useMemo(() => tokens(isDark), [isDark]);
  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();
  const channelKey = useHashChannel();
  const channel = channels.find((c) => c.key === channelKey) ?? channels[0];
  const isYouTube = channel?.platform === "youtube";

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const [range, setRange] = useState<Range>("30d");
  const [customStart, setCustomStart] = useState(() => addDays(startOfDay(new Date()), -29));
  const [customEnd, setCustomEnd] = useState(() => startOfDay(new Date()));
  const [chartView, setChartView] = useState<ChartView>("this");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [postsPeriod, setPostsPeriod] = useState<PostsPeriod>("this");
  
  // Metric selections
  const [metricCategory, setMetricCategory] = useState<MetricCategory>("posts");
  const [subMetric, setSubMetric] = useState<SubMetric>("posts_count");
  const [isMetricMenuOpen, setIsMetricMenuOpen] = useState(false);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Pagination & Export
  const [page, setPage] = useState(1);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useClickOutside(exportRef, () => setIsExportOpen(false));

  useEffect(() => { setPage(1); }, [postsPeriod, range, query, sort, metricCategory, subMetric]);

  const { start, end } = useMemo(() => resolveRange(range, customStart, customEnd), [range, customStart, customEnd]);
  const yt = useYouTubeInsights(start, end, isYouTube && Boolean(channel), reloadKey);
  const fallback = useInsights(start, end, !isYouTube);
  const raw = isYouTube && yt.data ? yt.data : fallback;

  const posts = useMemo(() => raw.posts.filter(isOnlinePost), [raw.posts]);
  const previousPosts = useMemo(() => raw.previousPosts.filter(isOnlinePost), [raw.previousPosts]);
  const summary = useMemo<Summary>(() => ({ ...raw.summary, posts: posts.length }), [raw.summary, posts.length]);

  // Enrich current/previous with Net New Followers & Growth Rate
  const enrichedCurrent = useMemo(() => {
    return raw.current.map((p, i) => {
      const prevF = i > 0 ? raw.current[i - 1].followers : (raw.previous[raw.previous.length - 1]?.followers ?? p.followers);
      const net = Math.max(0, p.followers - prevF);
      const rate = prevF > 0 ? ((p.followers - prevF) / prevF) * 100 : 0;
      return { ...p, netNewFollowers: net, followerGrowthRate: rate };
    });
  }, [raw.current, raw.previous]);

  const enrichedPrevious = useMemo(() => {
    return raw.previous.map((p, i) => {
      const prevF = i > 0 ? raw.previous[i - 1].followers : p.followers;
      const net = Math.max(0, p.followers - prevF);
      const rate = prevF > 0 ? ((p.followers - prevF) / prevF) * 100 : 0;
      return { ...p, netNewFollowers: net, followerGrowthRate: rate };
    });
  }, [raw.previous]);

  const current = enrichedCurrent;
  const previous = enrichedPrevious;

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

  const TONES = [isDark ? "#ffffff" : "#111111", isDark ? "#7c7c85" : "#a3a3a3", isDark ? "#5b5b63" : "#d4d4d4"];
  
  // Data mapping based on metric selections
  const getSeries = (): SeriesDef[] => {
    if (metricCategory === "posts") {
      if (subMetric === "followers") return [{ key: "followers", label: "Followers", tone: 0, agg: "last" }];
      if (subMetric === "video_views") return [{ key: "profileViews", label: "Video Views", tone: 0, agg: "sum" }];
      if (subMetric === "net_new_followers") return [{ key: "netNewFollowers", label: "Net New Followers", tone: 0, agg: "sum" }];
      return [{ key: "posts", label: "Posts", tone: 0, agg: "sum" }, { key: "reactions", label: "Reactions", tone: 1, agg: "sum" }];
    }
    if (metricCategory === "impact") return [{ key: "reactions", label: "Reactions", tone: 0, agg: "sum" }, { key: "comments", label: "Comments", tone: 1, agg: "sum" }];
    if (metricCategory === "growth") return [{ key: "followers", label: "Followers", tone: 0, agg: "last" }];
    if (metricCategory === "follower_growth_rate") return [{ key: "followerGrowthRate", label: "Growth Rate", tone: 0, agg: "avg" }];
    // visibility
    return [{ key: "profileViews", label: isYouTube ? "Channel Views" : "Profile Views", tone: 0, agg: "sum" }, { key: "followers", label: "Followers", tone: 1, agg: "last" }];
  };

  const activeSeries = getSeries();
  const chartSeries: ChartSeries[] = activeSeries.map((s) => ({
    label: s.label,
    color: TONES[s.tone],
    values: current.map((p) => p[s.key] as number),
    prev: previous.map((p) => p[s.key] as number),
    format: s.key === "followerGrowthRate" ? (v) => `${v.toFixed(2)}%` : undefined
  }));
  
  const seriesTotal = (s: SeriesDef) => {
    if (s.agg === "sum") return current.reduce((a, p) => a + (p[s.key] as number), 0);
    if (s.agg === "avg") return current.reduce((a, p) => a + (p[s.key] as number), 0) / (current.length || 1);
    return current[days - 1]?.[s.key] as number ?? 0;
  };

  const rows = postsPeriod === "this" ? posts : previousPosts;
  const needle = query.trim().toLowerCase();
  const sortedRows = useMemo(() => {
    const matchingRows = needle ? rows.filter((post) => post.label.toLowerCase().includes(needle)) : rows;
    if (!sort) return matchingRows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...matchingRows].sort((a, b) => (a[sort.key] - b[sort.key]) * dir);
  }, [rows, sort, needle]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const paginatedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const columns: { key: SortKey; label: string; render: (p: PostRow) => string }[] = [
    { key: "reactions", label: "Reactions", render: (p) => nf(p.reactions) },
    { key: "comments", label: "Comments", render: (p) => nf(p.comments) },
    { key: "engRate", label: "Eng. Rate", render: (p) => `${p.engRate.toFixed(2)}%` },
    { key: "videoViews", label: "Video Views", render: (p) => nf(p.videoViews) },
  ];

  // ── EXPORT LOGIC ──
  const triggerExport = (format: "csv" | "md" | "pdf") => {
    setIsExportOpen(false);
    if (format === "pdf") {
      window.print();
      return;
    }

    const filename = `insights-${toInput(start)}-${toInput(end)}`;
    if (format === "csv") {
      const rowsCsv: (string | number)[][] = [["Date", "Followers", "Posts", "Reactions", "Comments", "Profile Views"]];
      current.forEach((p) => rowsCsv.push([toInput(p.date), p.followers, p.posts, p.reactions, p.comments, p.profileViews]));
      downloadFile(`${filename}.csv`, rowsCsv.map((r) => r.join(",")).join("\n"), "text/csv");
    } else if (format === "md") {
      let md = `# Insights Report\n\n**Period:** ${periodLabel}\n\n`;
      md += `## Summary\n\n| Metric | Value |\n|---|---|\n`;
      summaryBoxes.forEach((b) => { md += `| ${b.label} | ${b.value} |\n`; });
      md += `\n## Daily Data\n\n| Date | Followers | Posts | Reactions | Comments | Profile Views |\n|---|---|---|---|---|---|\n`;
      current.forEach((p) => {
        md += `| ${toInput(p.date)} | ${p.followers} | ${p.posts} | ${p.reactions} | ${p.comments} | ${p.profileViews} |\n`;
      });
      downloadFile(`${filename}.md`, md, "text/markdown");
    }
  };

  const handleBottomBarChange = (id: BottomBarTab) => {
    if (id === "add") { setIsFolderOpen(false); setIsNewPostOpen(true); } 
    else if (id === "files") { setIsFolderOpen((open) => !open); }
  };

  const mediaIcon = (m: PostRow["media"]) => m === "video" ? <Play className="h-4 w-4" /> : m === "text" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />;
  const sectionCard = `rounded-2xl border p-4 ${t.card}`;
  const sectionTitle = `text-[15px] font-semibold tracking-[-0.02em] ${t.text}`;
  const sectionSub = `mt-1 text-[11px] ${t.muted}`;

  const METRIC_TABS: { key: MetricCategory; label: string; icon: ReactNode; hasDropdown?: boolean }[] = [
    { key: "posts", label: "Posts", icon: <Copy className="h-4 w-4" aria-hidden="true" />, hasDropdown: true },
    { key: "impact", label: "Content Impact", icon: <Zap className="h-4 w-4" aria-hidden="true" /> },
    { key: "growth", label: "Audience Growth", icon: <TrendingUp className="h-4 w-4" aria-hidden="true" /> },
    { key: "visibility", label: "Visibility", icon: <Eye className="h-4 w-4" aria-hidden="true" /> },
    { key: "follower_growth_rate", label: "Follower Growth Rate", icon: <Activity className="h-4 w-4" aria-hidden="true" /> },
  ];

  const SUB_METRICS: { key: SubMetric; label: string; icon: ReactNode }[] = [
    { key: "followers", label: "Followers", icon: <Users className="h-4 w-4" /> },
    { key: "video_views", label: "Video Views", icon: <Eye className="h-4 w-4" /> },
    { key: "posts_count", label: "Posts", icon: <Copy className="h-4 w-4" /> },
    { key: "net_new_followers", label: "Net New Followers", icon: <UserPlus className="h-4 w-4" /> },
  ];

  return (
    <main className={`relative h-screen w-full overflow-hidden transition-colors duration-300 ${t.page}`}>
      {/* CSS d'impression pour l'export PDF parfait */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print-card { border: 1px solid #e5e5e5 !important; background: white !important; break-inside: avoid; }
          .print-text { color: black !important; }
        }
      `}</style>

      <DashboardSidebar theme={theme} />

      <div className="h-full py-3 pr-3 transition-[padding-left] duration-300 ease-in-out motion-reduce:transition-none" style={{ paddingLeft: sidebarOffset }}>
        <div className={`h-full overflow-y-auto overflow-x-hidden rounded-[28px] border transition-colors duration-300 ${isDark ? "border-white/[0.07] bg-[#0a0a0c]" : "border-black/[0.06] bg-white"}`}>
          
          <div id="print-area" className="mx-auto flex w-full max-w-[1720px] flex-col gap-6 px-[clamp(18px,3vw,48px)] pb-[120px] pt-[clamp(18px,3vw,30px)]">
            
            {/* HEADER */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${t.inner} ${t.soft}`}>
                  <Activity className="h-5 w-5" />
                </span>
                <h1 className={`truncate text-[20px] font-semibold tracking-[-0.03em] ${t.text}`}>Insights</h1>
              </div>
              
              <div className="flex flex-wrap items-center gap-2.5">
                {isYouTube && (
                  <IconBtn label="Refresh insights" t={t} onClick={() => setReloadKey((k) => k + 1)}>
                    <RefreshCw className={`h-4 w-4 ${yt.loading ? "animate-spin" : ""}`} />
                  </IconBtn>
                )}

                {/* BOUTON EXPORT AVEC DROPDOWN */}
                <div ref={exportRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsExportOpen((o) => !o)}
                    className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold transition-all ${t.ring} ${t.outlineBtn}`}
                  >
                    <Download className="h-4 w-4" />
                    Export
                    <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${isExportOpen ? "rotate-180" : ""}`} />
                  </button>
                  
                  {isExportOpen && (
                    <div className={`absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border p-1 shadow-2xl ${t.popover}`}>
                      <button onClick={() => triggerExport("csv")} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${t.text} ${t.hover}`}>
                        <FileText className="h-4 w-4 opacity-50" /> CSV Table
                      </button>
                      <button onClick={() => triggerExport("md")} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${t.text} ${t.hover}`}>
                        <FileType className="h-4 w-4 opacity-50" /> Markdown
                      </button>
                      <button onClick={() => triggerExport("pdf")} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${t.text} ${t.hover}`}>
                        <Download className="h-4 w-4 opacity-50" /> PDF (Print)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${t.ring} ${t.soft} ${t.hover}`}
                >
                  <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>

            {!channel ? (
              <section className={`flex flex-col items-center gap-3 rounded-2xl border px-6 py-20 text-center ${t.panel}`}>
                <Activity className={`h-8 w-8 ${t.soft}`} />
                <h2 className={`text-[14px] font-semibold ${t.text}`}>Connect a channel to see insights</h2>
                <button type="button" onClick={() => navigateToSettingsSection("channels")} className={`mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold ${t.ring} ${t.primaryBtn}`}>
                  <Plus className="h-3.5 w-3.5" /> Connect a channel
                </button>
              </section>
            ) : (
              <>
                {isYouTube && yt.error && (
                  <div role="alert" className={`flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-500`}>
                    <p className="text-[12.5px]">Could not load YouTube insights: {yt.error}</p>
                    <button onClick={() => setReloadKey((k) => k + 1)} className="text-[11px] font-semibold underline">Retry</button>
                  </div>
                )}

                {/* ALL INSIGHTS HEADER (RANGES) */}
                <section className="flex flex-col gap-4 print:hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div role="tablist" className={`inline-flex flex-wrap items-center gap-0.5 rounded-xl border p-1 ${t.panel}`}>
                      {RANGES.map((o) => {
                        const active = range === o.key;
                        return (
                          <button key={o.key} onClick={() => setRange(o.key)} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all ${active ? t.sel : t.idle}`}>
                            {o.label}
                            {o.key === "custom" && <Zap className="h-3 w-3 fill-current" />}
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => navigate("tags")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold ${t.text} ${t.hover}`}>
                      <Tag className="h-4 w-4" /> Tags
                    </button>
                  </div>
                </section>

                {/* SUMMARY */}
                <section className={sectionCard}>
                  <div className="flex items-start justify-between gap-3 px-1">
                    <div>
                      <h3 className={sectionTitle}>Summary</h3>
                      <p className={sectionSub}>{periodLabel} · {compareLabel}</p>
                    </div>
                  </div>
                  <div className={`mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border p-3 sm:grid-cols-3 lg:grid-cols-6 ${t.panel}`}>
                    {summaryBoxes.map((b) => (
                      <div key={b.label} className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${t.inner}`}>
                        <span className={`text-[10px] font-medium ${t.soft}`}>{b.label}</span>
                        <span className={`text-[20px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>{b.value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* METRICS CHART & TABS */}
                <section className={sectionCard}>
                  {/* Segmented Tabs with Dropdown */}
                  <div className="flex flex-wrap items-center gap-2">
                    {METRIC_TABS.map((tab) => {
                      const active = metricCategory === tab.key;
                      
                      if (tab.hasDropdown) {
                        const selectedSub = SUB_METRICS.find((s) => s.key === subMetric);
                        return (
                          <div key={tab.key} className="relative">
                            <div className={`flex items-center rounded-xl border transition-all ${active ? `${t.sel} border-transparent` : `${t.panel} ${t.idle}`}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setMetricCategory(tab.key);
                                  if (!active) setSubMetric("posts_count");
                                  setIsMetricMenuOpen(false);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold rounded-l-xl`}
                              >
                                {selectedSub?.icon || tab.icon}
                                {active ? selectedSub?.label : tab.label}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMetricCategory(tab.key);
                                  setIsMetricMenuOpen((o) => !o);
                                }}
                                className={`px-2 py-2 rounded-r-xl border-l transition-colors ${active ? "border-black/10 hover:bg-black/5" : "border-white/10 hover:bg-white/5"}`}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Dropdown Menu pour Posts */}
                            {isMetricMenuOpen && active && (
                              <div className={`absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border p-1.5 shadow-2xl ${t.popover}`}>
                                {SUB_METRICS.map((sm) => (
                                  <button
                                    key={sm.key}
                                    onClick={() => {
                                      setSubMetric(sm.key);
                                      setIsMetricMenuOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${t.text} ${t.hover}`}
                                  >
                                    <span className="flex items-center gap-2.5">
                                      <span className="opacity-50">{sm.icon}</span>
                                      {sm.label}
                                    </span>
                                    {subMetric === sm.key && <Check className="h-4 w-4" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={tab.key}
                          onClick={() => { setMetricCategory(tab.key); setIsMetricMenuOpen(false); }}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-all ${active ? `${t.sel} border-transparent` : `${t.panel} ${t.idle}`}`}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Chart Area */}
                  <div className={`mt-6 rounded-2xl border p-4 ${t.panel}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap gap-x-10 gap-y-3 pl-2">
                        {activeSeries.map((s) => (
                          <div key={s.key}>
                            <p className={`text-[11px] font-medium ${t.soft}`}>{s.label}</p>
                            <p className={`mt-1.5 flex items-center gap-2 text-[28px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>
                              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TONES[s.tone] }} />
                              {s.key === "followerGrowthRate" ? `${seriesTotal(s).toFixed(2)}%` : nf(seriesTotal(s))}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* CHART TYPE TOGGLE */}
                        <Segmented<ChartType>
                          label="Chart type"
                          value={chartType}
                          onChange={setChartType}
                          t={t}
                          options={[
                            { key: "line", label: "Line", icon: <LineChart className="h-3.5 w-3.5" /> },
                            { key: "bar", label: "Bar", icon: <BarChart3 className="h-3.5 w-3.5" /> },
                          ]}
                        />

                        <Segmented<ChartView>
                          label="Chart view"
                          value={chartView}
                          onChange={setChartView}
                          t={t}
                          options={[
                            { key: "this", label: "This Period" },
                            { key: "comparison", label: "Comparison" },
                            { key: "both", label: "Both" },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="mt-6">
                      <Chart dates={dates} series={chartSeries} view={chartView} type={chartType} isDark={isDark} />
                    </div>
                  </div>
                </section>

                {/* PERFORMANCE PER POST (TABLE) */}
                <section className={`${sectionCard} print-card`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 px-1">
                    <div>
                      <h3 className={sectionTitle}>Performance per Post</h3>
                      <p className={sectionSub}>{postsPeriod === "this" ? periodLabel : fmtRange(prevStart, prevEnd)}</p>
                    </div>
                    <div className="print:hidden">
                      <Segmented<PostsPeriod>
                        label="Posts period"
                        value={postsPeriod}
                        onChange={setPostsPeriod}
                        t={t}
                        options={[
                          { key: "this", label: "This Period" },
                          { key: "previous", label: "Previous Period" },
                        ]}
                      />
                    </div>
                  </div>

                  <div className={`mt-4 overflow-hidden rounded-2xl border ${t.panel}`}>
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px]">
                        <div className={`grid grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_1fr_44px] items-center gap-2 px-4 py-3 text-[12px] font-semibold ${t.head} ${t.text}`}>
                          <span>Posts · {rows.length}</span>
                          {columns.map((c) => (
                            <button key={c.key} onClick={() => toggleSort(c.key)} className={`flex w-fit items-center gap-1 text-left ${t.ring}`}>
                              {c.label}
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sort?.key === c.key && sort.dir === "asc" ? "rotate-180" : ""}`} />
                            </button>
                          ))}
                          <div className="print:hidden" />
                        </div>

                        {paginatedRows.length === 0 ? (
                          <div className={`flex flex-col items-center gap-2 border-t px-6 py-10 text-center ${t.border}`}>
                            <p className={`text-[12px] font-medium ${t.text}`}>No published posts in this period</p>
                          </div>
                        ) : (
                          paginatedRows.map((p, idx) => {
                            const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
                            return (
                              <div key={p.id} className={`grid grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_1fr_44px] items-center gap-2 border-t px-4 py-3 text-[13px] ${t.border} ${t.text}`}>
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className={`w-5 shrink-0 text-[12px] ${t.muted}`}>#{globalIdx}</span>
                                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${t.iconBox}`}>
                                    {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : mediaIcon(p.media)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className={`truncate text-[14px] font-medium ${t.soft}`}>{p.label}</p>
                                    <p className={`text-[11px] ${t.muted}`}>{fmtFull(p.date)}</p>
                                  </div>
                                </div>
                                {columns.map((c) => <span key={c.key} className="tabular-nums">{c.render(p)}</span>)}
                                <button className={`flex h-8 w-8 items-center justify-center rounded-lg print:hidden ${t.soft} ${t.hover}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PAGINATION */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-1.5 print:hidden">
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30 ${t.soft} ${t.hover}`}>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pg = i + 1;
                        return (
                          <button key={pg} onClick={() => setPage(pg)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-semibold transition-colors ${page === pg ? t.sel : `${t.soft} ${t.hover}`}`}>
                            {pg}
                          </button>
                        );
                      })}
                      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30 ${t.soft} ${t.hover}`}>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      <Folder isOpen={isFolderOpen} onClose={() => setIsFolderOpen(false)} isDark={isDark} offsetLeft={sidebarOffset} />
      <BottomBar isDark={isDark} offsetLeft={sidebarOffset} active={isFolderOpen ? "files" : null} onChange={handleBottomBarChange} onCreatePost={() => handleBottomBarChange("add")} query={query} onQueryChange={setQuery} />
      <NewPostModal isOpen={isNewPostOpen} onClose={() => setIsNewPostOpen(false)} isDark={isDark} onSubmit={async (p) => { if(p.scheduleMode === "later") await createPosts(p); else throw new Error(unavailablePostActionMessage(p)); }} onRequestOpen={() => setIsNewPostOpen(true)} />
      <HelpChatButton isDark={isDark} />
    </main>
  );
}