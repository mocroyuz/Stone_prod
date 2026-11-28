// src/components/insights/data.ts
// Données et calculs de la page Insights : dates, canaux, posts programmés,
// données de démonstration, fusion multi-canaux, « meilleur moment » et CSV.

import { useEffect, useRef, useState } from "react";
import { useHashRoute } from "../../hooks/useHashRoute";
import type { ConnectedChannel } from "../../hooks/useConnectedChannels";
import { fetchYouTubeVideos } from "../../services/youtube";
import {
  COPY,
  intlLocale,
  numLocale,
  type InsightsData,
  type Lang,
  type Point,
  type PostRow,
  type Range,
  type Summary,
} from "./copy";

export const DAY = 86_400_000;

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const toInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export const fmt = (d: Date, lang: Lang) =>
  d.toLocaleDateString(intlLocale(lang), { day: "numeric", month: "short" });
export const fmtFull = (d: Date, lang: Lang) =>
  d.toLocaleDateString(intlLocale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const fmtRange = (a: Date, b: Date, lang: Lang) =>
  `${fmt(a, lang)} - ${fmtFull(b, lang)}`;
export const nf = (n: number, lang: Lang) =>
  (Number.isFinite(n) ? n : 0).toLocaleString(numLocale(lang));

export function resolveRange(range: Range, customStart: Date, customEnd: Date) {
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

export function nextDateForSlot(dayIdxMon: number, hour: number): Date {
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

export function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

export function isYouTubeChannel(c?: ConnectedChannel): boolean {
  if (!c) return false;
  return c.platform === "youtube" || c.key.toLowerCase().startsWith("youtube");
}

export const channelLabel = (ch: ConnectedChannel) =>
  (ch.handle || ch.name || "Channel").replace(/^@/, "");

export const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

export type ScheduledEntry = { ids: ReadonlySet<string>; at: number };

export const scheduledCache = new Map<string, ScheduledEntry>();
export const SCHEDULED_FRESH_MS = 2 * 60_000;
export const SCHEDULED_TIMEOUT_MS = 10_000;

export function useScheduledVideoIds(
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

    const timer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, SCHEDULED_TIMEOUT_MS);

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
        clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, channelKey, reloadKey]);

  return { ids, ready };
}

export function dropFromPoints(points: Point[], dropped: PostRow[]): Point[] {
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

export function withoutScheduled(
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

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++)
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function emptyInsights(start: Date, end: Date): InsightsData {
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

export function ratePct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 10_000) / 100 : 0;
}

export function buildSampleInsights(
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

export function mergeInsights(parts: InsightsData[]): InsightsData {
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

export function dayIndexMon(d: Date) {
  return (d.getDay() + 6) % 7;
}

export function postScore(p: PostRow) {
  return p.reactions + p.comments * 2.4 + p.videoViews * 0.02;
}

export const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/* ── Best time to post ────────────────────────────────────── */

export type Peak = [hour: number, weight: number, spread: number];
export type Curve = { weekday: Peak[]; weekend: Peak[] };

export const BASELINE: Record<string, Curve> = {
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

export function priorLift(platform: string, dayIdx: number, hour: number): number {
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

export const PRIOR_STRENGTH = 2.5;
export const HOUR_KERNEL = [1, 0.5, 0.2];
export const CROSS_DAY_SHARE = 0.15;

export type BestTimes = {
  grid: { value: number; norm: number; count: number }[][];
  bestByDay: { day: number; hour: number; norm: number }[];
  best: { day: number; hour: number };
  recommendations: { day: number; hour: number; norm: number }[];
  label: string;
  sample: number;
  confidence: "baseline" | "early" | "solid";
};

export function buildBestTimes(
  posts: PostRow[],
  platform: string,
  lang: Lang
): BestTimes {
  const validPosts = posts.filter(
    (p) => p.date instanceof Date && Number.isFinite(p.date.getTime())
  );
  const n = validPosts.length;
  const scores = validPosts
    .map((p) => Math.max(0, postScore(p)))
    .sort((a, b) => a - b);
  const median = n ? scores[Math.floor(n / 2)] : 0;
  const ref = median > 0 ? median : 1;
  const mk = () =>
    Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const sum = mk();
  const wt = mk();
  const raw = mk();

  for (const p of validPosts) {
    const d = dayIndexMon(p.date);
    const h = p.date.getHours();
    const lift = Math.min(
      2.5,
      Math.log1p(Math.max(0, postScore(p))) / Math.log1p(ref)
    );
    raw[d][h] += 1;
    HOUR_KERNEL.forEach((weight, offset) => {
      for (const shift of offset === 0 ? [0] : [-offset, offset]) {
        const hour = (h + shift + 24) % 24;
        sum[d][hour] += lift * weight;
        wt[d][hour] += weight;
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
      const observed = sum[d][h] + CROSS_DAY_SHARE * (hourSum[h] - sum[d][h]);
      const evidence = wt[d][h] + CROSS_DAY_SHARE * (hourWt[h] - wt[d][h]);
      const priorWeight =
        n === 0 ? 1 : Math.max(0.35, PRIOR_STRENGTH / (1 + n * 0.22));
      const value =
        (priorWeight * priorLift(platform, d, h) + observed) /
        (priorWeight + evidence);
      min = Math.min(min, value);
      max = Math.max(max, value);
      return value;
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
    return { day, hour, norm: row[hour].norm };
  });
  const ranked = grid
    .flatMap((row, day) =>
      row.map((cell, hour) => ({
        day,
        hour,
        norm: cell.norm,
        value: cell.value,
      }))
    )
    .sort((a, b) => b.value - a.value);
  const recommendations: BestTimes["recommendations"] = [];
  for (const candidate of ranked) {
    if (
      recommendations.every(
        (picked) =>
          picked.day !== candidate.day ||
          Math.min(
            Math.abs(picked.hour - candidate.hour),
            24 - Math.abs(picked.hour - candidate.hour)
          ) >= 3
      )
    ) {
      recommendations.push({
        day: candidate.day,
        hour: candidate.hour,
        norm: candidate.norm,
      });
      if (recommendations.length === 3) break;
    }
  }
  const best = recommendations[0] ?? { day: 0, hour: 12, norm: 0 };
  return {
    grid,
    bestByDay,
    best,
    recommendations,
    label: `${days[best.day]} ${hourLabel(best.hour)}`,
    sample: n,
    confidence: n < 5 ? "baseline" : n < 15 ? "early" : "solid",
  };
}


export function pctDelta(now: number, prev: number) {
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return null;
  if (now === 0 && prev === 0) return null;
  if (prev === 0) return 100;
  return Math.round(((now - prev) / Math.abs(prev)) * 100);
}

/* ============================================================
   EXPORT CSV
============================================================ */

export const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, rows: (string | number)[][]) {
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
