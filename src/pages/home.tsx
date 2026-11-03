import { useEffect, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, { useSidebarOffset } from "../components/DashboardSidebar";
import HelpChatButton from "../components/Helpchatbutton";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import NewPostModal, { type NewPostPayload, unavailablePostActionMessage } from "../components/Newpostmodal";
import { getCurrentUser, type UserProfile } from "../services/supabase";
import { createPosts } from "../services/posts";
import {
  FileText,
  CheckSquare,
  Folder as FolderIcon,
  Clock,
  Search,
  PlayCircle,
  Share2,
  Edit3,
  Calendar,
  ArrowUpRight,
} from "lucide-react";

/* ============================================================
   THEME HELPERS
============================================================ */

const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#050505]" : "bg-[#f5f3ef]";

const mainPanelClass = (isDark: boolean) =>
  isDark ? "border-white/[0.07] bg-[#0a0a0c]" : "border-black/[0.06] bg-white";

const cardClass = (isDark: boolean) =>
  isDark ? "border-white/[0.07] bg-[#0f0f11]" : "border-black/[0.06] bg-white";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const softClass = (isDark: boolean) =>
  isDark ? "text-neutral-400" : "text-neutral-500";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ============================================================
   MOCK DATA
============================================================ */

const RECENT_VIDEOS = [
  { id: 1, title: "Growth Plan", user: "James Walker", avatar: "https://i.pravatar.cc/150?u=1", date: "May 15, 2024" },
  { id: 2, title: "Marketing Strategy", user: "Sarah Chen", avatar: "https://i.pravatar.cc/150?u=2", date: "May 14, 2024" },
  { id: 3, title: "Product Launch", user: "Michael Johnson", avatar: "https://i.pravatar.cc/150?u=3", date: "May 13, 2024" },
  { id: 4, title: "User Research", user: "Emily Davis", avatar: "https://i.pravatar.cc/150?u=4", date: "May 12, 2024" },
  { id: 5, title: "Budget Review", user: "David Lee", avatar: "https://i.pravatar.cc/150?u=5", date: "May 11, 2024" },
];

const BLOG_POSTS = [
  {
    title: "NDA Agreement",
    description: "To make sure our data is secure when we build",
    icon: FileText,
    avatars: ["https://i.pravatar.cc/150?u=6", "https://i.pravatar.cc/150?u=7"],
    count: "240+",
  },
  {
    title: "Service Level Agreement",
    description: "Defines the expected level of service performance",
    icon: CheckSquare,
    avatars: ["https://i.pravatar.cc/150?u=8", "https://i.pravatar.cc/150?u=9"],
    count: "50+",
  },
  {
    title: "User Onboarding Guide",
    description: "A comprehensive guide to help new users start",
    icon: FolderIcon,
    avatars: ["https://i.pravatar.cc/150?u=10", "https://i.pravatar.cc/150?u=11"],
    count: "89+",
  },
  {
    title: "Privacy Policy",
    description: "Details on how we handle user data and privacy",
    icon: FolderIcon,
    avatars: ["https://i.pravatar.cc/150?u=12", "https://i.pravatar.cc/150?u=13"],
    count: "350+",
  },
];

/* ============================================================
   COMPONENTS
============================================================ */

function StatCard({ isDark, title, value, icon }: { isDark: boolean; title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className={["flex items-center justify-between rounded-xl border p-4 shadow-sm", cardClass(isDark)].join(" ")}>
      <div>
        <p className={["text-[13px] font-medium", softClass(isDark)].join(" ")}>{title}</p>
        <p className={["mt-1 text-2xl font-bold", strongClass(isDark)].join(" ")}>{value}</p>
      </div>
      <div className={["flex h-12 w-12 items-center justify-center rounded-lg", isDark ? "bg-white/[0.06] text-white" : "bg-gray-50 text-gray-500"].join(" ")}>
        {icon}
      </div>
    </div>
  );
}

function SmoothChart({ isDark }: { isDark: boolean }) {
  const W = 600;
  const H = 240;
  const pad = { l: 40, r: 12, t: 20, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const points = [
    { x: 0, y: 100 }, { x: 1, y: 120 }, { x: 2, y: 110 }, { x: 3, y: 200 }, { x: 4, y: 180 },
    { x: 5, y: 250 }, { x: 6, y: 220 }, { x: 7, y: 280 }, { x: 8, y: 230 }, { x: 9, y: 150 }, { x: 10, y: 160 },
  ];

  const maxY = 400;
  const x = (val: number) => pad.l + (val / 10) * iw;
  const y = (val: number) => pad.t + ih - (val / maxY) * ih;

  const linePath = `M ${points.map((p) => `${x(p.x)},${y(p.y)}`).join(" L ")}`;
  const areaPath = `${linePath} L ${x(10)},${pad.t + ih} L ${x(0)},${pad.t + ih} Z`;

  const gridColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const axisColor = isDark ? "#6b6b72" : "#a3a3a3";
  const lineColor = isDark ? "#ffffff" : "#111111";
  const fillColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";

  return (
    <div className={["rounded-2xl border p-4", cardClass(isDark)].join(" ")}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={["text-[14px] font-semibold", strongClass(isDark)].join(" ")}>Signed over time</h3>
        <button className={["flex items-center gap-2 rounded-md border px-2.5 py-1 text-[12px] font-medium", cardClass(isDark), softClass(isDark)].join(" ")}>
          <Calendar className="h-3.5 w-3.5" /> Jan - Jun
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {[0, 100, 200, 300, 400].map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tick)} y2={y(tick)} stroke={gridColor} strokeWidth="1" />
            <text x={pad.l - 8} y={y(tick) + 4} fontSize="10" fill={axisColor} textAnchor="end">{tick}</text>
          </g>
        ))}
        {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, i) => (
          <text key={month} x={x(i * 2)} y={H - 8} fontSize="10" fill={axisColor} textAnchor="middle">{month}</text>
        ))}
        <path d={areaPath} fill={fillColor} />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round" />
        <path
          d={`M ${pad.l},${y(200)} L ${x(2)},${y(200)} L ${x(3)},${y(150)} L ${x(4)},${y(150)} L ${x(5)},${y(220)} L ${x(6)},${y(180)} L ${x(7)},${y(180)} L ${x(8)},${y(140)} L ${x(9)},${y(140)} L ${W - pad.r},${y(160)}`}
          fill="none"
          stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function RecentList({ isDark }: { isDark: boolean }) {
  return (
    <div className={["flex flex-col rounded-2xl border", cardClass(isDark)].join(" ")}>
      <div className="flex items-center justify-between border-b p-4 border-black/[0.06] dark:border-white/[0.07]">
        <h3 className={["text-[14px] font-semibold", strongClass(isDark)].join(" ")}>Recent videos</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            className={[
              "h-8 rounded-md border pl-8 pr-3 text-[12px] outline-none transition-colors",
              isDark ? "border-white/10 bg-white/5 text-white focus:border-white/20" : "border-gray-200 bg-gray-50 text-gray-900 focus:border-gray-300",
            ].join(" ")}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-[2fr,1fr,auto] gap-4 px-3 py-2 text-[11px] font-medium text-gray-400">
          <span>Paper name</span>
          <span>Recipient</span>
          <span className="text-right">Due date</span>
        </div>

        {RECENT_VIDEOS.map((video) => (
          <div key={video.id} className="grid grid-cols-[2fr,1fr,auto] items-center gap-4 rounded-lg px-3 py-2.5 transition hover:bg-gray-50 dark:hover:bg-white/5">
            <div className="flex items-center gap-2 overflow-hidden">
              <PlayCircle className="h-4 w-4 shrink-0 text-gray-400" />
              <span className={["truncate text-[13px] font-medium", strongClass(isDark)].join(" ")}>{video.title}</span>
            </div>
            <div className="flex items-center gap-2 overflow-hidden">
              <img src={video.avatar} alt="" className="h-5 w-5 rounded-full" />
              <span className="truncate text-[12px] text-gray-500">{video.user}</span>
            </div>
            <span className="text-right text-[11px] text-gray-400">{video.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlogCard({ isDark, post }: { isDark: boolean; post: (typeof BLOG_POSTS)[0] }) {
  const Icon = post.icon;

  return (
    <div className={["flex flex-col rounded-2xl border p-4 shadow-sm", cardClass(isDark)].join(" ")}>
      <div className="mb-4 flex items-start justify-between">
        <div className={["flex h-16 w-16 items-center justify-center rounded-xl", isDark ? "bg-white/5" : "bg-gray-50"].join(" ")}>
          <Icon className={["h-6 w-6", softClass(isDark)].join(" ")} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-400">{post.count}</span>
          <div className="flex -space-x-1.5">
            {post.avatars.map((src, i) => (
              <img key={i} src={src} alt="" className="h-5 w-5 rounded-full ring-2 ring-white dark:ring-[#0f0f11]" />
            ))}
          </div>
        </div>
      </div>

      <h4 className={["text-[15px] font-semibold", strongClass(isDark)].join(" ")}>{post.title}</h4>
      <p className={["mt-1 flex-1 text-[12px] leading-snug", softClass(isDark)].join(" ")}>{post.description}</p>

      <div className="mt-5 flex items-center gap-2">
        <button className={["flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition", isDark ? "bg-white text-black hover:bg-gray-200" : "bg-[#111] text-white hover:bg-black"].join(" ")}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
        <button className={["flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition", isDark ? "border-white/10 text-white hover:bg-white/5" : "border-gray-200 text-gray-700 hover:bg-gray-50"].join(" ")}>
          <Edit3 className="h-3.5 w-3.5" /> Edit
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE COMPONENT
============================================================ */

export default function Home() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();

  const [query, setQuery] = useState("");
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    getCurrentUser().then((u) => mounted && setUser(u)).catch(console.error);
    return () => { mounted = false; };
  }, []);

  const displayName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "adamnolke";
  const initials = `${(user?.first_name || "")[0] || ""}${(user?.last_name || "")[0] || ""}`.toUpperCase() || "U";

  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }
    throw new Error(unavailablePostActionMessage(payload));
  };

  const handleBottomBarChange = (id: BottomBarTab) => {
    switch (id) {
      case "add": setIsFolderOpen(false); setIsNewPostOpen(true); break;
      case "files": setIsFolderOpen((o) => !o); break;
      default: break;
    }
  };

  return (
    <main className={["relative h-screen w-full overflow-hidden transition-colors duration-300", pageBgClass(isDark)].join(" ")}>
      <DashboardSidebar theme={theme} />

      <div
        className="h-full py-3 pr-3 transition-[padding-left] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
        style={{ paddingLeft: sidebarOffset }}
      >
        <div className={["h-full overflow-y-auto overflow-x-hidden rounded-[28px] border transition-colors duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", mainPanelClass(isDark)].join(" ")}>
          
          <div className="mx-auto flex w-full max-w-[1400px] flex-col px-6 pb-24 pt-8">
            
            {/* Header */}
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h1 className={["text-2xl font-semibold tracking-tight", strongClass(isDark)].join(" ")}>
                  Dashboard, {displayName}
                </h1>
                <p className={["text-sm", softClass(isDark)].join(" ")}>
                  {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className={["text-right text-sm font-medium tabular-nums", strongClass(isDark)].join(" ")}>
                  {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </div>
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white dark:bg-white dark:text-black">
                    {initials}
                  </div>
                )}
              </div>
            </header>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard isDark={isDark} title="Active Contracts" value="150" icon={<FileText className="h-5 w-5" />} />
              <StatCard isDark={isDark} title="Pending signatures" value="267" icon={<CheckSquare className="h-5 w-5" />} />
              <StatCard isDark={isDark} title="Total contracts" value="680" icon={<FolderIcon className="h-5 w-5" />} />
              <StatCard isDark={isDark} title="Expiring soon" value="22" icon={<Clock className="h-5 w-5" />} />
            </div>

            {/* Middle Row: Chart + Recent List */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SmoothChart isDark={isDark} />
              </div>
              <div className="lg:col-span-1">
                <RecentList isDark={isDark} />
              </div>
            </div>

            {/* Bottom Row: Blog Articles */}
            <div className="mt-8">
              <h2 className={["mb-4 text-[16px] font-semibold", strongClass(isDark)].join(" ")}>
                Your Contacts
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {BLOG_POSTS.map((post) => (
                  <BlogCard key={post.title} isDark={isDark} post={post} />
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      <Folder isOpen={isFolderOpen} onClose={() => setIsFolderOpen(false)} isDark={isDark} offsetLeft={sidebarOffset} />
      <BottomBar isDark={isDark} offsetLeft={sidebarOffset} active={isFolderOpen ? "files" : null} onChange={handleBottomBarChange} onCreatePost={() => handleBottomBarChange("add")} query={query} onQueryChange={setQuery} />
      <NewPostModal isOpen={isNewPostOpen} onClose={() => setIsNewPostOpen(false)} isDark={isDark} onSubmit={handleCreatePost} onRequestOpen={() => setIsNewPostOpen(true)} />
      <HelpChatButton isDark={isDark} />
    </main>
  );
}