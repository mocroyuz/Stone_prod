// src/pages/Insights.tsx
// Insights — refonte complète, alignée sur home / schedule :
//  - même coque (fond de page, panneau principal arrondi, sidebar, BottomBar)
//  - mêmes tokens de couleur (src/components/insights/theme.ts)
//  - composants dédiés dans src/components/insights/
// YouTube : données réelles. Autres réseaux : démo en attendant leur API.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Download, Plus, RefreshCw } from "lucide-react";
import HeaderButton from "../components/insights/HeaderButton";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, {
  useFavorites,
  useSidebarOffset,
} from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import HelpChatButton from "../components/Helpchatbutton";
import ChannelMenu from "../components/ChannelMenu";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import { useConnectedChannels } from "../hooks/useConnectedChannels";
import { navigateToSettingsSection } from "../utils/settingsNavigation";
import { createPosts } from "../services/posts";
import { useYouTubeInsights } from "../services/youtube";
import { readPostingGoal } from "../components/OnboardingModals";
import { useNewPostRequest } from "../services/NewPostBus";
import {
  COPY,
  numLocale,
  useIsMobile,
  useLanguage,
  type InsightsData,
  type NumKey,
  type PostRow,
  type Range,
  type SummaryBoxKey,
} from "../components/insights/copy";
import {
  addDays,
  buildBestTimes,
  buildSampleInsights,
  dayIndexMon,
  downloadCsv,
  emptyInsights,
  fmt,
  fmtFull,
  fmtRange,
  isYouTubeChannel,
  mergeInsights,
  nextDateForSlot,
  nf,
  pctDelta,
  postScore,
  resolveRange,
  startOfDay,
  toInput,
  useHashChannel,
  useScheduledVideoIds,
  withoutScheduled,
} from "../components/insights/data";
import { ink as inkFor } from "../components/insights/theme";
import RangeControl from "../components/insights/RangeControl";
import KpiStrip, { type Kpi } from "../components/insights/KpiStrip";
import TrendCard from "../components/insights/TrendCard";
import GoalCard from "../components/insights/GoalCard";
import WeekdayCard, {
  type WeekdayRow,
} from "../components/insights/WeekdayCard";
import BestTimeCard from "../components/insights/BestTimeCard";
import RecycleCard from "../components/insights/RecycleCard";
import PostsCard from "../components/insights/PostsCard";

/** Route de cette page dans la sidebar (section Favoris). */
const PAGE_ROUTE = "insights";
const ALL_KEY = "all";

type Slot = { day: number; hour: number };

export default function Insights() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const ink = useMemo(() => inkFor(isDark), [isDark]);
  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();
  const isMobile = useIsMobile();
  const lang = useLanguage();
  const c = COPY[lang];
  const locale = numLocale(lang);

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  /* ── Canal ── */

  const hashChannel = useHashChannel();
  const [selectedKey, setSelectedKey] = useState<string | null>(hashChannel);
  useEffect(() => {
    if (hashChannel) setSelectedKey(hashChannel);
  }, [hashChannel]);

  const viewingAll =
    selectedKey === ALL_KEY || (selectedKey == null && channels.length > 1);
  const channel = viewingAll
    ? undefined
    : (channels.find((ch) => ch.key === selectedKey) ??
      channels.find((ch) => isYouTubeChannel(ch)) ??
      channels[0]);
  const youtubeConnected = channels.some(isYouTubeChannel);
  const isYouTube = Boolean(channel && isYouTubeChannel(channel));
  const fetchYouTube = youtubeConnected && (viewingAll || isYouTube);

  const goChannel = (key: string) => {
    setSelectedKey(key);
    window.history.replaceState(
      null,
      "",
      `/insights?channel=${encodeURIComponent(key)}`,
    );
  };

  /* ── État ── */

  const [range, setRange] = useState<Range>("30d");
  const [customStart, setCustomStart] = useState(() =>
    addDays(startOfDay(new Date()), -29),
  );
  const [customEnd, setCustomEnd] = useState(() => startOfDay(new Date()));
  const [metric, setMetric] = useState<NumKey>("reactions");
  const [compare, setCompare] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  /* ── Composer ── */

  const openComposer = useCallback((at?: Date) => {
    setIsFolderOpen(false);
    setScheduledAt(at ?? null);
    setIsNewPostOpen(true);
  }, []);
  const closeComposer = useCallback(() => {
    setIsNewPostOpen(false);
    setScheduledAt(null);
  }, []);
  useNewPostRequest(() => openComposer());

  const scheduleSlot = useCallback(
    (slot: Slot) => openComposer(nextDateForSlot(slot.day, slot.hour)),
    [openComposer],
  );
  const duplicatePost = useCallback(
    (_post: PostRow) => openComposer(),
    [openComposer],
  );

  const handleBottomBar = (id: BottomBarTab) => {
    if (id === "add") openComposer();
    else if (id === "files") setIsFolderOpen((o) => !o);
  };

  /* ── Données ── */

  const { start, end } = useMemo(
    () => resolveRange(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  const yt = useYouTubeInsights(start, end, fetchYouTube, reloadKey);
  const scheduled = useScheduledVideoIds(
    channel?.key ?? channels.find(isYouTubeChannel)?.key,
    fetchYouTube,
    reloadKey,
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
        channels.map((ch) => perChannel[ch.key]).filter(Boolean),
      );
    if (channel && perChannel[channel.key]) return perChannel[channel.key];
    return emptyInsights(start, end);
  }, [channels, viewingAll, channel, perChannel, start, end]);

  const { data, skipped } = useMemo(
    () => withoutScheduled(source, scheduled.ids),
    [source, scheduled.ids],
  );
  const { current, previous, summary, posts, previousPosts } = data;
  const loading =
    fetchYouTube && ((yt.loading && !yt.data) || !scheduled.ready);
  const periodLabel = fmtRange(start, end, lang);

  /* ── Indicateurs ── */

  const prev = useMemo(() => {
    const sum = (k: NumKey) => previous.reduce((a, p) => a + p[k], 0);
    return {
      posts: sum("posts"),
      reactions: sum("reactions"),
      comments: sum("comments"),
      followers: previous[previous.length - 1]?.followers ?? 0,
    };
  }, [previous]);

  const kpiOrder: SummaryBoxKey[] = [
    "followers",
    "posts",
    "reactions",
    "comments",
    "engRate",
    "videoViews",
  ];
  const kpis: Kpi[] = kpiOrder.map((key) => {
    const value =
      key === "engRate" ? `${summary.engRate}%` : nf(summary[key], lang);
    const delta =
      key === "followers" ||
      key === "posts" ||
      key === "reactions" ||
      key === "comments"
        ? pctDelta(summary[key], prev[key])
        : undefined;
    return {
      key,
      label: c.summary.labels[key],
      value,
      info: c.summary.info[key],
      delta,
    };
  });

  /* ── Objectif hebdo ── */

  const weekStart = addDays(startOfDay(new Date()), -6);
  const postsThisWeek = posts.filter((p) => p.date >= weekStart).length;
  const goalKey = channel?.key ?? channels[0]?.key ?? "youtube";
  const goal = readPostingGoal(goalKey) ?? readPostingGoal("youtube") ?? 3;

  /* ── Tendances ── */

  const metrics = useMemo(
    () => [
      { key: "reactions" as NumKey, label: c.metricOptions.reactions },
      { key: "comments" as NumKey, label: c.metricOptions.comments },
      { key: "posts" as NumKey, label: c.metricOptions.posts },
      { key: "followers" as NumKey, label: c.metricOptions.followers },
      {
        key: "profileViews" as NumKey,
        label: isYouTube
          ? c.metricOptions.channelViews
          : c.metricOptions.profileViews,
      },
    ],
    [c, isYouTube],
  );
  const metricLabel = metrics.find((m) => m.key === metric)?.label ?? "";

  const chartData = useMemo(
    () =>
      current.map((p, i) => ({
        label: fmt(p.date, lang),
        full: fmtFull(p.date, lang),
        value: p[metric],
        prev: previous[i]?.[metric] ?? 0,
      })),
    [current, previous, metric, lang],
  );

  const weekdayData: WeekdayRow[] = useMemo(() => {
    const acc: WeekdayRow[] = c.days.map((day) => ({ day, a: 0, b: 0 }));
    for (const p of current) {
      const i = dayIndexMon(p.date);
      if (acc[i]) {
        acc[i].a += p.reactions;
        acc[i].b += p.comments;
      }
    }
    return acc;
  }, [current, c.days]);

  /* ── Meilleur moment ── */

  const platformKey = (channel?.platform ?? "default").toLowerCase();
  const heatmap = useMemo(
    () => buildBestTimes(posts, platformKey, lang),
    [posts, platformKey, lang],
  );
  const bestNote =
    heatmap.confidence === "baseline"
      ? c.bestTime.noteBaseline
      : heatmap.confidence === "early"
        ? c.bestTime.noteEarly(heatmap.sample)
        : c.bestTime.noteSolid(heatmap.sample);

  /* ── Posts à refaire ── */

  const remixable = useMemo(() => {
    const ranked = [...posts].sort((a, b) => postScore(b) - postScore(a));
    const avg = posts.length
      ? posts.reduce((a, p) => a + postScore(p), 0) / posts.length
      : 0;
    return ranked.filter((p) => postScore(p) >= avg * 1.25).slice(0, 4);
  }, [posts]);

  /* ── Export ── */

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Period", periodLabel],
      ["Range", range],
      [],
      ["Metric", "Value"],
      ...kpis.map((k) => [k.label, k.value]),
      [],
      ["Post", "Date", "Reactions", "Comments", "Eng. rate %", "Video views"],
      ...posts.map((p) => [
        p.label,
        fmtFull(p.date, lang),
        p.reactions,
        p.comments,
        p.engRate,
        p.videoViews,
      ]),
    ];
    downloadCsv(`insights-${toInput(start)}-${toInput(end)}.csv`, rows);
  };

  return (
    <main
      className={`relative h-dvh min-h-dvh w-full overflow-hidden overscroll-none compact-window transition-colors duration-300 ${ink.page}`}
    >
      <DashboardSidebar theme={theme} />

      <div
        className="h-full min-h-0 px-2 py-2 transition-[padding-left] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] max-md:pt-[calc(3.5rem+env(safe-area-inset-top))] motion-reduce:transition-none md:py-3 md:pl-0 md:pr-3"
        style={isMobile ? undefined : { paddingLeft: sidebarOffset }}
      >
        <div
          className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border transition-colors duration-300 md:rounded-[28px] ${ink.panel}`}
        >
          {/* En-tête : même gabarit que Create / Publish / Community */}
          <div className="compact-content w-full shrink-0 px-[clamp(14px,3vw,48px)] pt-[clamp(16px,3vw,30px)]">
            <header
              className={`relative z-20 mx-auto flex w-full max-w-[1720px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b pb-3 md:pb-4 ${ink.hairline}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border md:h-9 md:w-9 ${
                    isDark
                      ? "border-white/[0.07] bg-white/[0.04] text-neutral-400"
                      : "border-black/[0.06] bg-white text-neutral-500"
                  }`}
                >
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
                </span>
                <h1
                  className={`truncate text-[24px] font-semibold tracking-[-0.03em] md:text-[20px] ${ink.strong}`}
                >
                  {c.header.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
                {channels.length > 0 && (
                  <ChannelMenu
                    channels={channels}
                    current={channel}
                    isDark={isDark}
                    onSelect={goChannel}
                  />
                )}
                <RangeControl
                  range={range}
                  start={start}
                  end={end}
                  onPreset={setRange}
                  onCustom={(s, e) => {
                    setCustomStart(s);
                    setCustomEnd(e);
                    setRange("custom");
                  }}
                  ink={ink}
                  isDark={isDark}
                  isMobile={isMobile}
                  lang={lang}
                />
                <div className="flex items-center gap-1 md:gap-2">
                  <HeaderButton
                    label={c.header.export}
                    onClick={handleExport}
                    ink={ink}
                    isDark={isDark}
                  >
                    <Download className="h-5 w-5" aria-hidden="true" />
                  </HeaderButton>
                  <HeaderButton
                    label={
                      saved ? c.header.removeFavorite : c.header.addFavorite
                    }
                    onClick={() => toggleFavorite(PAGE_ROUTE)}
                    pressed={saved}
                    ink={ink}
                    isDark={isDark}
                  >
                    <Bookmark
                      className={`h-5 w-5 ${saved ? "fill-current" : ""}`}
                      aria-hidden="true"
                    />
                  </HeaderButton>
                  <HeaderButton
                    label={c.header.refresh}
                    onClick={() => setReloadKey((k) => k + 1)}
                    disabled={loading}
                    ink={ink}
                    isDark={isDark}
                  >
                    <RefreshCw
                      className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                  </HeaderButton>
                </div>
              </div>
            </header>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mx-auto flex w-full min-w-0 max-w-[1720px] flex-col gap-4 px-[clamp(14px,3vw,48px)] pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-4 md:pt-5">
              {/* Aucun canal */}
              {channels.length === 0 && (
                <section
                  className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${ink.card}`}
                >
                  <div className="min-w-0">
                    <h2 className={`text-[15px] font-semibold ${ink.strong}`}>
                      {c.noChannels.title}
                    </h2>
                    <p className={`mt-1 max-w-[56ch] text-[13px] ${ink.soft}`}>
                      {c.noChannels.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToSettingsSection("channels")}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold ${ink.focus} ${ink.solid}`}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {c.noChannels.connect}
                  </button>
                </section>
              )}

              {/* Erreur YouTube */}
              {fetchYouTube && yt.error && (
                <div
                  role="alert"
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-[12.5px] ${ink.card} ${ink.soft}`}
                >
                  <span>{c.errors.youtube(yt.error)}</span>
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className={`rounded-md px-1 text-[12.5px] font-semibold underline underline-offset-4 ${ink.focus} ${ink.strong}`}
                  >
                    {c.errors.retry}
                  </button>
                </div>
              )}

              <div
                aria-busy={loading}
                className={`flex flex-col gap-4 transition-opacity duration-300 motion-reduce:transition-none ${
                  loading ? "opacity-60" : "opacity-100"
                }`}
              >
                <KpiStrip
                  items={kpis}
                  ink={ink}
                  isDark={isDark}
                  versus={c.summary.vsPreviousShort}
                />

                <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                  <TrendCard
                    title={c.trends.title}
                    subtitle={c.trends.subtitle(periodLabel)}
                    metrics={metrics}
                    metric={metric}
                    onMetric={setMetric}
                    metricAria={c.trends.metricAria}
                    compare={compare}
                    onCompare={setCompare}
                    compareLabel={c.trends.compareToggle}
                    data={chartData}
                    seriesLabel={metricLabel}
                    prevLabel={c.trends.previousPeriod}
                    ink={ink}
                    isDark={isDark}
                    locale={locale}
                  />
                  <div className="flex min-w-0 flex-col gap-4">
                    <GoalCard
                      title={c.summary.goalProgress(postsThisWeek, goal)}
                      done={postsThisWeek}
                      goal={goal}
                      caption={c.summary.goalAria(postsThisWeek, goal)}
                      aria={c.summary.goalAria(postsThisWeek, goal)}
                      ink={ink}
                      isDark={isDark}
                    />
                    <WeekdayCard
                      title={c.bestTime.activityByDay}
                      subtitle={periodLabel}
                      labelA={c.summary.labels.reactions}
                      labelB={c.summary.labels.comments}
                      data={weekdayData}
                      ink={ink}
                      locale={locale}
                    />
                  </div>
                </div>

                <BestTimeCard
                  heatmap={heatmap}
                  c={c}
                  note={bestNote}
                  ink={ink}
                  isDark={isDark}
                  isMobile={isMobile}
                  onSchedule={scheduleSlot}
                />

                <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                  <PostsCard
                    posts={posts}
                    previousPosts={previousPosts}
                    hiddenScheduled={skipped.current}
                    loading={loading}
                    c={c}
                    lang={lang}
                    ink={ink}
                    isDark={isDark}
                    onDuplicate={duplicatePost}
                    onShowLast30={() => setRange("30d")}
                  />
                  <RecycleCard
                    posts={remixable}
                    c={c}
                    lang={lang}
                    ink={ink}
                    isDark={isDark}
                    onDuplicate={duplicatePost}
                  />
                </div>
              </div>
            </div>
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
        onChange={handleBottomBar}
        onCreatePost={() => handleBottomBar("add")}
      />
      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={closeComposer}
        isDark={isDark}
        initialScheduledAt={scheduledAt}
        onRequestOpen={() => setIsNewPostOpen(true)}
        onSubmit={async (payload: NewPostPayload) => {
          try {
            await createPosts(payload);
          } catch (err) {
            if (err instanceof Error) {
              console.warn(unavailablePostActionMessage, err.message);
            }
          }
        }}
      />
      <HelpChatButton isDark={isDark} />
    </main>
  );
}
