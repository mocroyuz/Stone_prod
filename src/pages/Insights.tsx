// src/pages/Insights.tsx
// Page Insights — même shell arrondi que Home (fond de page + panneau rounded-[28px]).
// Toute la logique métier est conservée : useInsights, Chart, Segmented, RangePicker,
// useHashChannel, useConnectedChannels, CalendarPicker, DashboardSidebar, HelpChatButton.

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
  Repeat2,
  Send,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, { useSidebarOffset } from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import HelpChatButton from "../components/Helpchatbutton";
import { CalendarPicker } from "../components/CalendarPicker";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import { useConnectedChannels, type ConnectedChannel } from "../hooks/useConnectedChannels";
import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "../components/IntegrationIcons";

/* ============================================================
   TYPES
============================================================ */

type IconComponent = ComponentType<{ className?: string; size?: number }>;

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
  reactions: number;
  comments: number;
  engRate: number;
  videoViews: number;
};

type SeriesDef = { key: NumKey; label: string; tone: 0 | 1; agg: "sum" | "last" };

const RANGES: { key: Range; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "mtd", label: "Month to Date" },
  { key: "custom", label: "Custom" },
];

/* ============================================================
   STYLE — tokens alignés sur le shell Home
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
        page: "bg-[#09090a]",
        text: "text-white",
        muted: "text-neutral-600",
        soft: "text-neutral-400",
        card: "border-white/[0.07] bg-[#141416]",
        panel: "border-white/[0.07] bg-white/[0.03]",
        inner: "border-white/[0.07] bg-white/[0.04]",
        border: "border-white/[0.07]",
        head: "bg-white/[0.03]",
        primaryBtn: "bg-white text-black hover:bg-neutral-200",
        outlineBtn: "border border-white/10 text-white hover:bg-white/[0.07]",
        iconBox: "bg-white/[0.07] text-neutral-300",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        hover: "hover:bg-white/[0.06]",
        sel: "bg-white text-black",
        idle: "text-neutral-400 hover:text-white",
        popover: "border-white/10 bg-[#1b1b1e]",
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
   DONNÉES (à remplacer par ton API)
============================================================ */

function useInsights(
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
    const build = (from: Date, withPost: boolean): Point[] =>
      Array.from({ length: days }, (_, i) => ({
        date: addDays(from, i),
        posts: withPost && i === Math.max(0, days - 3) ? 1 : 0,
        reactions: 0,
        comments: 0,
        followers: 0,
        profileViews: 0,
      }));

    const current = build(new Date(s), true);
    const previous = build(addDays(new Date(s), -days), false);

    const postDate = addDays(new Date(e), -2);
    const posts: PostRow[] = [
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
    ];

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
  }, [s, e]);
}

function useHashChannel(): string | null {
  const [, force] = useState(0);
  useHashRoute();
  useEffect(() => {
    const onHash = () => force((v) => v + 1);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const hash = window.location.hash;
  const i = hash.indexOf("?");
  return i === -1 ? null : new URLSearchParams(hash.slice(i + 1)).get("channel");
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   COURBE LISSÉE
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

/* ============================================================
   CHART
============================================================ */

type ChartSeries = { label: string; color: string; values: number[]; prev: number[] };

function Chart({
  dates,
  series,
  view,
  isDark,
}: {
  dates: Date[];
  series: ChartSeries[];
  view: ChartView;
  isDark: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");
  const W = 900;
  const H = 300;
  const pad = { l: 52, r: series.length > 1 ? 52 : 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = dates.length;

  const showThis = view === "this" || view === "both";
  const showPrev = view === "comparison" || view === "both";

  const axis = isDark ? "#6b6b72" : "#a3a3a3";
  const grid = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  const maxes = series.map((s) =>
    Math.max(4, ...(showThis ? s.values : []), ...(showPrev ? s.prev : []))
  );

  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (si: number, v: number) => pad.t + ih - (v / maxes[si]) * ih;

  const path = (si: number, vals: number[]) =>
    smoothPath(vals.map((v, i) => [x(i), y(si, v)] as [number, number]));

  const ticks = [0, 1, 2, 3, 4];
  const labelIdx = Array.from(new Set([0, 0.5, 1].map((r) => Math.round(r * (n - 1))))); 
  const area = `${path(0, series[0].values)} L${x(n - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z`;

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = n === 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1));
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
      aria-label="Metrics chart. Use the left and right arrow keys to inspect each day."
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
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          >
            {fmt(dates[i])}
          </text>
        ))}

        {showPrev &&
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

        {showThis && (
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

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={axis} strokeOpacity="0.6" strokeDasharray="3 3" />
            {showThis &&
              series.map((s, si) => (
                <circle
                  key={s.label}
                  cx={x(hover)}
                  cy={y(si, s.values[hover])}
                  r="4.5"
                  fill={isDark ? "#141416" : "#fff"}
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
            isDark ? "bg-[#1b1b1e] text-white ring-1 ring-white/10" : "bg-white text-neutral-900 ring-1 ring-black/10"
          }`}
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > n / 2 ? "-110%" : "10%"})`,
          }}
        >
          <div className="mb-1 text-[11px] opacity-50">{fmtFull(dates[hover])}</div>
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
          ? `${fmtFull(dates[hover])}: ${series.map((s) => `${s.values[hover]} ${s.label}`).join(", ")}`
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
  boxed = false,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  t: Tokens;
  boxed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${t.ring} ${t.soft} ${
        boxed ? `border ${t.inner} ${t.hover}` : t.hover
      }`}
    >
      {children}
    </button>
  );
}

function MetricBox({ label, value, info, t }: { label: string; value: string; info: string; t: Tokens }) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${t.inner}`}>
      <span className={`flex items-center justify-between gap-2 text-[10px] font-medium ${t.soft}`}>
        <span className="truncate">{label}</span>
        <span title={info} className={`shrink-0 ${t.muted}`}>
          <Info className="h-3.5 w-3.5" aria-label={info} />
        </span>
      </span>
      <span className={`text-[20px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>{value}</span>
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

function NetworkIcon({ channel, isDark }: { channel?: ConnectedChannel; isDark: boolean }) {
  const key = channelNetwork(channel);
  const Icon = Object.entries(NETWORK_ICONS).find(([k]) => key.includes(k))?.[1];
  if (!Icon) return null;
  return (
    <span
      className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black ring-1 ${
        isDark ? "ring-[#0f0f11]" : "ring-white"
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
  const [saved, setSaved] = useState(false);
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
        <IconBtn label={saved ? "Remove bookmark" : "Bookmark"} onClick={() => setSaved((s) => !s)} t={t}>
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
        </IconBtn>
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
            onClick={() => navigate("channels")}
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
    <div className={`absolute w-[176px] rounded-xl bg-white p-3 text-black shadow-[0_6px_22px_rgba(0,0,0,0.35)] ring-1 ring-black/5 ${className}`}>
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
  Posts: "Posts published during the period.",
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

  const { start, end } = useMemo(
    () => resolveRange(range, customStart, customEnd),
    [range, customStart, customEnd]
  );
  const { current, previous, summary, posts, previousPosts } = useInsights(start, end);

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
      { key: "profileViews", label: "Profile Views", tone: 0, agg: "sum" },
      { key: "followers", label: "Followers", tone: 1, agg: "last" },
    ],
  };
  const activeSeries = SERIES[metricTab];
  const chartSeries: ChartSeries[] = activeSeries.map((s) => ({
    label: s.label,
    color: TONES[s.tone],
    values: current.map((p) => p[s.key]),
    prev: previous.map((p) => p[s.key]),
  }));
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
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const columns: { key: SortKey; label: string; render: (p: PostRow) => string }[] = [
    { key: "reactions", label: "Reactions", render: (p) => nf(p.reactions) },
    { key: "comments", label: "Comments", render: (p) => nf(p.comments) },
    { key: "engRate", label: "Eng. Rate", render: (p) => `${p.engRate.toFixed(2)}%` },
    { key: "videoViews", label: "Video Views", render: (p) => nf(p.videoViews) },
  ];
  const TABLE_GRID = "grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_1fr_44px]";

  const exportCsv = () => {
    const rowsCsv: (string | number)[][] = [
      ["date", "followers", "posts", "reactions", "comments", "profile_views", "previous_followers"],
    ];
    current.forEach((p, i) =>
      rowsCsv.push([toInput(p.date), p.followers, p.posts, p.reactions, p.comments, p.profileViews, previous[i].followers])
    );
    downloadCsv(`insights-${toInput(start)}-${toInput(end)}.csv`, rowsCsv);
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
    throw new Error(unavailablePostActionMessage(payload));
  };

  const mediaIcon = (m: PostRow["media"]) =>
    m === "video" ? <Play className="h-4 w-4" /> : m === "text" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />;

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
            isDark
              ? "border-white/[0.07] bg-[#0f0f11]"
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
            {/* TOP BAR */}
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                    isDark
                      ? "border-white/[0.08] bg-white/[0.04] text-white"
                      : "border-black/[0.06] bg-white text-neutral-900 shadow-sm",
                  ].join(" ")}
                >
                  <InsightsIcon />
                </div>
                <h1 className={`text-[24px] font-semibold tracking-[-0.035em] ${t.text}`}>
                  Insights
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                <ChannelMenu channels={channels} current={channel} t={t} isDark={isDark} />
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!channel}
                  className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold transition-colors disabled:opacity-40 ${t.ring} ${t.outlineBtn}`}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                </button>
              </div>
            </header>

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
                  onClick={() => navigate("channels")}
                  className={`mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold ${t.ring} ${t.primaryBtn}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Connect a channel
                </button>
              </section>
            ) : (
              <>
                {/* BANNIÈRE */}
                <section className={`relative overflow-hidden rounded-2xl border ${t.card}`}>
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${
                      isDark
                        ? "from-white/[0.06] via-transparent to-transparent"
                        : "from-black/[0.04] via-transparent to-transparent"
                    }`}
                  />
                  <div className="relative z-10 flex min-h-[168px] flex-col justify-center gap-4 px-6 py-6 lg:max-w-[58%]">
                    <div>
                      <h2 className={`text-[22px] font-semibold tracking-[-0.035em] ${t.text}`}>
                        A Path to Growth with Weekly Takeaways
                      </h2>
                      <p className={`mt-2 max-w-[400px] text-[13px] leading-relaxed ${t.soft}`}>
                        The more you post, the better your takeaways. Share a few posts and
                        we'll start showing you weekly insights to help you grow.
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

                  <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[430px] lg:block">
                    <div className="absolute left-[134px] top-[30px] h-[90px] w-[120px] -rotate-[4deg] rounded-xl bg-neutral-300/90 shadow-[0_6px_22px_rgba(0,0,0,0.3)]">
                      <span className="ml-3 mt-3 flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-white">
                        <FlaskConical className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <TipCard
                      className="left-[70px] top-[74px] -rotate-[9deg]"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      title="Use Your Drafts"
                      text="You have 3 unsaved drafts to schedule."
                      cta="Open Drafts"
                    />
                    <TipCard
                      className="left-[168px] top-[4px] -rotate-[5deg]"
                      icon={<Repeat2 className="h-3.5 w-3.5" />}
                      title="Repost Your Popular Post"
                      text="Repost your post about your ambitious project. It rated well, with a reach of 1.2K."
                      cta="Create Post"
                    />
                    <TipCard
                      className="left-[272px] top-[66px] rotate-[6deg]"
                      icon={<Send className="h-3.5 w-3.5" />}
                      title="Evergreen Ideas"
                      text="Reshare last year's top post, still pulling engagement."
                      cta="Duplicate Post"
                    />
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
                        <h3 className={sectionTitle}>Summary</h3>
                        <p className={sectionSub}>
                          {periodLabel} · {compareLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 print:hidden">
                        <IconBtn label="Share summary" boxed t={t}>
                          <Send className="h-4 w-4" aria-hidden="true" />
                        </IconBtn>
                        <IconBtn label="Open summary" boxed t={t}>
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </IconBtn>
                      </div>
                    </div>
                    <div className={`mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border p-3 sm:grid-cols-3 lg:grid-cols-6 ${t.panel}`}>
                      {summaryBoxes.map((b) => (
                        <MetricBox key={b.label} label={b.label} value={b.value} info={SUMMARY_INFO[b.label] ?? b.label} t={t} />
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

                  <div className={`mt-4 overflow-x-auto rounded-2xl border ${t.panel}`}>
                    <div className="min-w-[720px]">
                      <div
                        className={`grid ${TABLE_GRID} items-center gap-2 px-4 py-3 text-[12px] font-semibold ${t.head} ${t.text}`}
                      >
                        <span>Posts · {rows.length}</span>
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
                          className={`flex h-9 w-9 items-center justify-center rounded-xl border ${t.inner} ${t.soft} ${t.hover} ${t.ring}`}
                        >
                          <Columns className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      {sortedRows.length === 0 ? (
                        <div className={`flex flex-col items-center gap-2 border-t px-6 py-10 text-center ${t.border}`}>
                          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${t.iconBox}`}>
                            <Activity className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <p className={`text-[12px] font-medium ${t.text}`}>No posts in this period</p>
                          <p className={`max-w-[360px] text-[12px] ${t.soft}`}>
                            Choose a longer range to see how your earlier posts performed.
                          </p>
                          {days < 30 && (
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
                              <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${t.iconBox}`}>
                                {p.thumbnailUrl ? (
                                  <img src={p.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                                ) : (
                                  mediaIcon(p.media)
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className={`truncate text-[14px] font-medium ${t.soft}`}>{p.label}</p>
                                <p className={`text-[11px] ${t.muted}`}>{fmtFull(p.date)}</p>
                              </div>
                            </div>
                            {columns.map((c) => (
                              <span key={c.key} className="tabular-nums">
                                {c.render(p)}
                              </span>
                            ))}
                            <button
                              type="button"
                              aria-label="Post actions"
                              className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.soft} ${t.hover} ${t.ring}`}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
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
                        Metrics
                      </h3>
                      <p className={sectionSub}>
                        {periodLabel} · {compareLabel}
                      </p>
                    </div>
                    <IconBtn label="Share metrics" boxed t={t}>
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
                            <p className={`mt-1.5 flex items-center gap-2 text-[28px] font-bold leading-none tracking-tight tabular-nums ${t.text}`}>
                              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TONES[s.tone] }} aria-hidden="true" />
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
                      <Chart dates={dates} series={chartSeries} view={chartView} isDark={isDark} />
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
        onCreatePost={() => handleBottomBarChange("add")}
        onCreateIdea={() => navigate("create")}
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