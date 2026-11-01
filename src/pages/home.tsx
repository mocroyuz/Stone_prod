import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import {
  useConnectedChannels,
  type ConnectedChannel,
} from "../hooks/useConnectedChannels";
import DashboardSidebar, { useSidebarOffset } from "../components/DashboardSidebar";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import HelpChatButton from "../components/Helpchatbutton";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import { getCurrentUser, type UserProfile } from "../services/supabase";
import { createPosts } from "../services/posts";
import {
  fetchYouTubeComments,
  fetchYouTubeVideos,
} from "../services/youtubeComments";
import { navigateToSettingsSection } from "../utils/settingsNavigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  XIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
} from "../components/IntegrationIcons";

/* ============================================================
   THEME & STYLES (DESIGN SYSTEM GLASSMORPHISM)
============================================================ */

const pageBgClass = (isDark: boolean) =>
  isDark
    ? "bg-[#050508] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050508] to-black"
    : "bg-[#f8fafc] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/40 via-[#f8fafc] to-white";

const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "bg-black/40 backdrop-blur-xl border-white/5 shadow-2xl shadow-black/50"
    : "bg-white/60 backdrop-blur-xl border-white/60 shadow-xl shadow-blue-900/5";

const cardClass = (isDark: boolean) =>
  isDark
    ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-300"
    : "bg-white/80 border-white/60 hover:bg-white hover:shadow-lg hover:shadow-blue-900/5 transition-all duration-300";

const textPrimary = (isDark: boolean) => (isDark ? "text-white" : "text-slate-900");
const textSecondary = (isDark: boolean) => (isDark ? "text-slate-400" : "text-slate-500");

/* ============================================================
   LOGIC & DATA HELPERS
============================================================ */

// Cache utilisateur
const userProfileCache = {
  profile: null as UserProfile | null,
};

type SocialNetworkKey =
  | "x"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest";

const NETWORK_ICONS: Record<
  SocialNetworkKey,
  (props: { className?: string }) => ReactElement
> = {
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
};

function getNetworkId(channel: ConnectedChannel): SocialNetworkKey | null {
  const c = channel as unknown as Record<string, unknown>;
  const raw = String(c.platform ?? c.network ?? c.provider ?? channel.key)
    .toLowerCase()
    .trim();

  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("insta")) return "instagram";
  if (raw.includes("youtube") || raw === "yt") return "youtube";
  if (raw.includes("facebook") || raw === "fb") return "facebook";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("pinterest")) return "pinterest";
  if (raw === "x" || raw.includes("twitter")) return "x";
  return null;
}

/* ============================================================
   COMMENTS LOGIC (FULL IMPLEMENTATION)
============================================================ */

type RawComment = {
  id: string;
  author: string;
  authorAvatar: string | null;
  text: string;
  publishedAt: string | null;
  answered: boolean;
  isRead: boolean;
  videoId: string | null;
  videoTitle: string | null;
  videoThumbnail: string | null;
};

type HomeComment = RawComment & {
  channel: ConnectedChannel;
  network: SocialNetworkKey;
};

type VideoInfo = { title: string; thumbnail: string | null };

const VIDEO_CACHE_MS = 5 * 60_000;
let youtubeVideoCache: { at: number; map: Map<string, VideoInfo> } | null = null;

async function getYouTubeVideoMap(): Promise<Map<string, VideoInfo>> {
  if (youtubeVideoCache && Date.now() - youtubeVideoCache.at < VIDEO_CACHE_MS) {
    return youtubeVideoCache.map;
  }
  try {
    const { videos } = await fetchYouTubeVideos();
    const map = new Map<string, VideoInfo>(
      videos.map((v) => [v.id, { title: v.title, thumbnail: v.thumbnail }])
    );
    youtubeVideoCache = { at: Date.now(), map };
    return map;
  } catch {
    return youtubeVideoCache?.map ?? new Map<string, VideoInfo>();
  }
}

const youtubeThumbnail = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

const COMMENT_SOURCES: Partial<
  Record<SocialNetworkKey, () => Promise<RawComment[]>>
> = {
  youtube: async () => {
    const [{ comments }, videos] = await Promise.all([
      fetchYouTubeComments({ filter: "all" }),
      getYouTubeVideoMap(),
    ]);
    return comments
      .filter((c) => !c.is_own)
      .map((c) => {
        const video = c.video_id ? videos.get(c.video_id) : undefined;
        return {
          id: `youtube:${c.id}`,
          author: c.author_name,
          authorAvatar: c.author_avatar,
          text: c.text,
          publishedAt: c.published_at,
          answered: c.answered,
          isRead: c.is_read,
          videoId: c.video_id,
          videoTitle: video?.title ?? null,
          videoThumbnail:
            video?.thumbnail ?? (c.video_id ? youtubeThumbnail(c.video_id) : null),
        };
      });
  },
};

const COMMENTS_POLL_MS = 60_000;
const HOME_COMMENTS_LIMIT = 5; // Augmenté un peu pour le nouveau design liste

type CommentsCacheEntry = {
  comments: HomeComment[];
  error: string | null;
  at: number;
};
const commentsCache = new Map<string, CommentsCacheEntry>();

const commentTime = (c: { publishedAt: string | null }) =>
  c.publishedAt ? new Date(c.publishedAt).getTime() || 0 : 0;

function useLatestComments(channels: ConnectedChannel[]) {
  const sources = useMemo(() => {
    const seen = new Set<SocialNetworkKey>();
    const list: { channel: ConnectedChannel; network: SocialNetworkKey }[] = [];
    for (const channel of channels) {
      const network = getNetworkId(channel);
      if (!network || !COMMENT_SOURCES[network] || seen.has(network)) continue;
      seen.add(network);
      list.push({ channel, network });
    }
    return list;
  }, [channels]);

  const sourceKey = sources.map((s) => `${s.network}:${s.channel.key}`).join("|");
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const [comments, setComments] = useState<HomeComment[]>(
    () => commentsCache.get(sourceKey)?.comments ?? []
  );
  const [loading, setLoading] = useState<boolean>(
    () => !commentsCache.has(sourceKey) && channels.length > 0
  );
  const [error, setError] = useState<string | null>(
    () => commentsCache.get(sourceKey)?.error ?? null
  );

  useEffect(() => {
    const list = sourcesRef.current;
    if (list.length === 0) {
      setComments([]);
      setError(null);
      setLoading(false);
      return;
    }

    const cacheEntry = commentsCache.get(sourceKey);
    setComments(cacheEntry?.comments ?? []);
    setError(cacheEntry?.error ?? null);
    setLoading(!cacheEntry);

    let cancelled = false;
    let busy = false;

    const load = async (initial: boolean) => {
      if (busy || (!initial && document.hidden)) return;
      busy = true;
      if (initial) setLoading(true);

      try {
        const results = await Promise.allSettled(
          list.map(async ({ channel, network }) => {
            const raw = await COMMENT_SOURCES[network]!();
            return raw.map((c): HomeComment => ({ ...c, channel, network }));
          })
        );
        if (cancelled) return;

        const merged: HomeComment[] = [];
        const errors: string[] = [];
        for (const result of results) {
          if (result.status === "fulfilled") merged.push(...result.value);
          else errors.push(result.reason instanceof Error ? result.reason.message : "Error");
        }

        const allFailed = errors.length === results.length;
        if (allFailed && !initial) return;

        merged.sort((a, b) => commentTime(b) - commentTime(a));
        setComments(merged);
        setError(allFailed ? errors[0] : null);

        commentsCache.set(sourceKey, {
          comments: merged,
          error: allFailed ? errors[0] : null,
          at: Date.now(),
        });
      } finally {
        busy = false;
        if (initial && !cancelled) setLoading(false);
      }
    };

    const cacheFresh = cacheEntry && Date.now() - cacheEntry.at < COMMENTS_POLL_MS;
    if (!cacheFresh) void load(!cacheEntry);

    const timer = window.setInterval(() => void load(false), COMMENTS_POLL_MS);
    const onVisible = () => { if (!document.hidden) void load(false); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sourceKey]);

  return { comments, loading, error };
}

/* ============================================================
   BLOG DATA
============================================================ */

type BlogPost = {
  title: string;
  label: string;
  date: string;
  image?: string;
  url: string;
};

const BLOG_URL = "#";
const BLOG_POSTS: BlogPost[] = [
  {
    title: "The Best Time to Post on TikTok in 2026",
    label: "Strategy",
    date: "Jul 20, 2026",
    image: "/images/blog/best-time-tiktok.jpg",
    url: BLOG_URL,
  },
  {
    title: "The 11 Best AI Video Editors: I Tested Them All",
    label: "Tools",
    date: "Jul 22, 2026",
    image: "/images/blog/ai-video-editors.jpg",
    url: BLOG_URL,
  },
  {
    title: "How to Create a Social Media Content Calendar",
    label: "Guide",
    date: "Jul 24, 2026",
    image: "/images/blog/content-calendar.jpg",
    url: BLOG_URL,
  },
  {
    title: "17 Best AI Tools for Social Media Content",
    label: "Resources",
    date: "Aug 3, 2026",
    image: "/images/blog/ai-tools.jpg",
    url: BLOG_URL,
  },
];

const linkProps = (url: string) =>
  /^https?:\/\//.test(url) ? { target: "_blank", rel: "noreferrer" } : {};

/* ============================================================
   UI COMPONENTS
============================================================ */

function GreetingAvatar({
  avatarUrl,
  initials,
  isDark,
  loading = false,
}: {
  avatarUrl?: string | null;
  initials: string;
  isDark: boolean;
  loading?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatarUrl]);

  if (loading) {
    return <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />;
  }

  return (
    <div className="relative group">
      <div className={`absolute inset-0 rounded-full blur opacity-40 group-hover:opacity-70 transition-opacity ${isDark ? 'bg-indigo-500' : 'bg-blue-400'}`} />
      <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/20 bg-black/20 backdrop-blur-md">
        {avatarUrl && !failed ? (
          <img src={avatarUrl} alt="Profile" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

function GlassCard({ children, className = "", glow = false }: { children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-3xl border 
        backdrop-blur-md transition-all duration-300
        ${className}
        ${glow ? 'border-indigo-500/30 shadow-[0_0_30px_-10px_rgba(99,102,241,0.2)]' : ''}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function StatPill({ label, value, change, icon, isDark }: { label: string; value: string; change: string; icon: ReactNode; isDark: boolean }) {
  const isPositive = change.startsWith("+");
  return (
    <div className="flex flex-col gap-1 p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-60">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-end gap-3 mt-2">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {change}
        </span>
      </div>
    </div>
  );
}

function ChannelBadge({ channel, isDark }: { channel: ConnectedChannel; isDark: boolean }) {
  const networkId = getNetworkId(channel);
  const NetworkIcon = networkId ? NETWORK_ICONS[networkId] : null;
  
  return (
    <div className="group relative flex items-center gap-2 pr-3 pl-1 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors cursor-pointer">
      <div className="h-7 w-7 rounded-full overflow-hidden relative">
         {channel.avatarUrl ? (
           <img src={channel.avatarUrl} className="h-full w-full object-cover" alt="" />
         ) : (
           <div className="h-full w-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold">
             {channel.name?.[0]}
           </div>
         )}
      </div>
      <span className="text-xs font-medium max-w-[80px] truncate">{channel.handle || channel.name}</span>
      {NetworkIcon && (
        <div className="absolute -right-1 -bottom-1 bg-black border border-white/10 rounded-full p-0.5">
           <NetworkIcon className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment, isDark, onClick }: { comment: HomeComment; isDark: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full group flex items-start gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors text-left border border-transparent hover:border-white/5"
    >
      <div className="relative shrink-0">
        <div className="h-10 w-10 rounded-xl overflow-hidden bg-white/10">
          {comment.authorAvatar ? (
            <img src={comment.authorAvatar} className="h-full w-full object-cover" alt="" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs font-bold">{comment.author[0]}</div>
          )}
        </div>
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-black ${comment.network === 'youtube' ? 'bg-red-600' : 'bg-blue-500'}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-sm font-semibold truncate pr-2">{comment.author}</span>
          <span className="text-[10px] opacity-50 whitespace-nowrap">{formatCommentTime(comment.publishedAt)}</span>
        </div>
        <p className="text-xs opacity-70 line-clamp-2 leading-relaxed mb-1">{comment.text}</p>
        
        <div className="flex items-center gap-2 mt-1">
           {comment.answered ? (
             <span className="text-[10px] flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md">
               <CheckCheck className="w-3 h-3" /> Replied
             </span>
           ) : (
             <span className="text-[10px] flex items-center gap-1 text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md">
               Needs reply
             </span>
           )}
           {comment.videoTitle && (
             <span className="text-[10px] opacity-40 truncate max-w-[120px]">on {comment.videoTitle}</span>
           )}
        </div>
      </div>
      
      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity self-center" />
    </button>
  );
}

function formatCommentTime(value: string | null): string {
  if (!value) return "";
  const diff = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  if (Math.abs(diff) < 60) return "Just now";
  if (Math.abs(diff) < 3600) return `${Math.round(Math.abs(diff) / 60)}m ago`;
  if (Math.abs(diff) < 86400) return `${Math.round(Math.abs(diff) / 3600)}h ago`;
  return new Date(value).toLocaleDateString();
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function Home() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();

  const [query, setQuery] = useState("");
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(userProfileCache.profile);
  const [userLoaded, setUserLoaded] = useState(userProfileCache.profile !== null);
  const [now, setNow] = useState(() => new Date());
  const connectedChannels = useConnectedChannels();
  const latestComments = useLatestComments(connectedChannels);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      try {
        const userData = await getCurrentUser();
        if (mounted && userData) {
          userProfileCache.profile = userData;
          setUser(userData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setUserLoaded(true);
      }
    }
    loadUser();
    return () => { mounted = false; };
  }, []);

  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  const initials = `${(user?.first_name || "")[0] || ""}${(user?.last_name || "")[0] || ""}`.toUpperCase() || "U";
  const displayName = fullName || "Creator";
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }
    throw new Error(unavailablePostActionMessage(payload));
  };

  const handleViewAllComments = (channelKey?: string) => {
    const channel = connectedChannels.find((item) => item.key === channelKey) || connectedChannels[0];
    navigate(channel ? `community?channel=${encodeURIComponent(channel.key)}` : "community");
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

  return (
    <main className={`relative h-screen w-full overflow-hidden transition-colors duration-500 ${pageBgClass(isDark)}`}>
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

      <DashboardSidebar theme={theme} />

      <div
        className={[
          "h-full py-4 pr-4 transition-[padding-left] duration-300 ease-out",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        <div
          className={[
            "h-full overflow-y-auto overflow-x-hidden rounded-[32px]",
            "scrollbar-hide",
            mainPanelClass(isDark),
          ].join(" ")}
        >
          <div className="mx-auto flex w-full max-w-[1600px] flex-col px-8 py-8 pb-32">
            
            {/* HEADER */}
            <header className="flex items-end justify-between mb-10">
              <div className="flex items-center gap-5">
                <GreetingAvatar avatarUrl={user?.avatar_url} initials={initials} isDark={isDark} loading={!userLoaded} />
                <div>
                  <h1 className={`text-3xl font-light tracking-tight ${textPrimary(isDark)}`}>
                    {greeting}, <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">{displayName}</span>
                  </h1>
                  <p className={`text-sm mt-1 flex items-center gap-2 ${textSecondary(isDark)}`}>
                    <Sparkles className="w-3 h-3" />
                    {now.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsNewPostOpen(true)}
                className={`
                  hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full 
                  bg-white text-black font-semibold text-sm shadow-lg shadow-white/10
                  hover:scale-105 active:scale-95 transition-transform
                `}
              >
                <Plus className="w-4 h-4" />
                Create Post
              </button>
            </header>

            {/* STATS GRID */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: "Total Followers", value: "27.4K", change: "+12%", icon: <Users className="w-4 h-4" /> },
                { label: "Engagement Rate", value: "4.8%", change: "+0.5%", icon: <Heart className="w-4 h-4" /> },
                { label: "Avg. Views", value: "12.1K", change: "-2%", icon: <Zap className="w-4 h-4" /> },
              ].map((stat, i) => (
                <GlassCard key={i} className={cardClass(isDark)}>
                  <StatPill {...stat} isDark={isDark} />
                </GlassCard>
              ))}
            </section>

            {/* MAIN CONTENT SPLIT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: Channels & Quick Actions */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Channels Widget */}
                <GlassCard className={`${cardClass(isDark)} p-5`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${textSecondary(isDark)}`}>Active Channels</h3>
                    <button onClick={() => navigateToSettingsSection("channels")} className="text-xs hover:text-white transition-colors">Manage</button>
                  </div>
                  
                  <div className="space-y-3">
                    {connectedChannels.length > 0 ? (
                      connectedChannels.slice(0, 4).map(ch => (
                        <ChannelBadge key={ch.key} channel={ch} isDark={isDark} />
                      ))
                    ) : (
                      <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
                        <p className="text-sm opacity-50 mb-2">No channels connected</p>
                        <button onClick={() => navigateToSettingsSection("channels")} className="text-xs text-indigo-400 hover:underline">Connect now</button>
                      </div>
                    )}
                    {connectedChannels.length > 4 && (
                      <button className="w-full text-xs text-center py-2 opacity-50 hover:opacity-100 transition-opacity">
                        +{connectedChannels.length - 4} more
                      </button>
                    )}
                  </div>
                </GlassCard>

                {/* Up Next / Calendar Mini */}
                <GlassCard className={`${cardClass(isDark)} p-5 flex-1 flex flex-col justify-between min-h-[200px]`}>
                   <div>
                     <div className="flex items-center gap-2 mb-4">
                       <CalendarDays className="w-4 h-4 text-indigo-400" />
                       <h3 className={`text-sm font-semibold ${textPrimary(isDark)}`}>Schedule</h3>
                     </div>
                     <div className="space-y-3">
                       <div className="flex gap-3 items-center opacity-40">
                         <div className="w-1 h-8 bg-white/20 rounded-full" />
                         <div>
                           <p className="text-xs font-medium">No upcoming posts</p>
                           <p className="text-[10px]">Your calendar is empty</p>
                         </div>
                       </div>
                     </div>
                   </div>
                   <button 
                    onClick={() => setIsNewPostOpen(true)}
                    className="w-full py-2 mt-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-medium transition-colors"
                   >
                     Schedule a post
                   </button>
                </GlassCard>

              </div>

              {/* RIGHT COLUMN: Comments Feed */}
              <div className="lg:col-span-8">
                <GlassCard className={`${cardClass(isDark)} min-h-[500px] flex flex-col`} glow>
                  <div className="p-5 border-b border-white/5 flex justify-between items-center sticky top-0 bg-inherit z-10 backdrop-blur-xl rounded-t-3xl">
                    <div>
                      <h2 className={`text-lg font-semibold ${textPrimary(isDark)}`}>Community Pulse</h2>
                      <p className={`text-xs ${textSecondary(isDark)}`}>Recent interactions across your networks</p>
                    </div>
                    <button 
                      onClick={() => handleViewAllComments()}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5 opacity-50" />
                    </button>
                  </div>

                  <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
                    {latestComments.loading && latestComments.comments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 opacity-30">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                        <span className="text-xs">Syncing...</span>
                      </div>
                    ) : latestComments.comments.length > 0 ? (
                      <div className="space-y-1">
                        {latestComments.comments.slice(0, HOME_COMMENTS_LIMIT).map((comment) => (
                          <CommentRow 
                            key={comment.id} 
                            comment={comment} 
                            isDark={isDark} 
                            onClick={() => handleViewAllComments(comment.channel.key)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-center px-10">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                          <MessageCircle className="w-8 h-8 opacity-20" />
                        </div>
                        <h3 className="text-sm font-medium mb-1">All caught up!</h3>
                        <p className="text-xs opacity-50 max-w-xs">
                          You have no unread comments. Connect more channels to see more activity here.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none absolute bottom-0 left-0 right-0 rounded-b-3xl" />
                </GlassCard>
              </div>

            </div>

            {/* BLOG SECTION */}
            <section className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-light ${textPrimary(isDark)}`}>Inspiration <span className="font-bold text-indigo-400">.</span></h3>
                <a href={BLOG_URL} className="text-xs font-medium hover:text-indigo-400 transition-colors flex items-center gap-1">
                  Read all articles <ArrowRight className="w-3 h-3" />
                </a>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {BLOG_POSTS.map((post) => (
                  <a 
                    key={post.title} 
                    href={post.url} 
                    {...linkProps(post.url)}
                    className={`group block p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 hover:-translate-y-1`}
                  >
                    <div className="aspect-video w-full rounded-xl bg-white/5 mb-3 overflow-hidden relative">
                       {post.image ? (
                         <img src={post.image} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center"><Sparkles className="opacity-20" /></div>
                       )}
                       <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/50 backdrop-blur-md text-[10px] font-bold uppercase tracking-wide">
                         {post.label}
                       </div>
                    </div>
                    <h4 className={`text-sm font-medium leading-snug mb-1 group-hover:text-indigo-300 transition-colors ${textPrimary(isDark)}`}>
                      {post.title}
                    </h4>
                    <p className="text-[10px] opacity-40">{post.date}</p>
                  </a>
                ))}
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* OVERLAYS */}
      <Folder isOpen={isFolderOpen} onClose={() => setIsFolderOpen(false)} isDark={isDark} offsetLeft={sidebarOffset} />
      
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