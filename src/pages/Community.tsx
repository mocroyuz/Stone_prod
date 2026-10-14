// src/pages/Community.tsx
// Page Community (route "community") : boîte de réception des commentaires et mentions.
// Noir et blanc, même thème que la page Insights.
// Les données (posts / commentaires) sont fournies par `useCommunity` : branche-le sur ton backend.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import DashboardSidebar, {
  useSidebarOffset,
} from "../components/DashboardSidebar";
import {
  useConnectedChannels,
  type ConnectedChannel,
} from "../hooks/useConnectedChannels";
import {
  XIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "../components/IntegrationIcons";

/* ───────── Types ───────── */

type Tab = "comments" | "mentions";
type Layout = "post" | "list";
type Filter = "all" | "unanswered" | "answered";

type Post = {
  id: string;
  title: string;
  commentCount: number;
};

type IconProps = { className?: string };
type IconComponent = (props: IconProps) => React.ReactElement;

const TABS: { key: Tab; label: string }[] = [
  { key: "comments", label: "Comments" },
  { key: "mentions", label: "Mentions" },
];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unanswered", label: "Unanswered" },
  { key: "answered", label: "Answered" },
];

/* ───────── Données (à remplacer par ton API) ───────── */

function useCommunity(_channelKey: string | undefined, _tab: Tab, _filter: Filter) {
  // Branche ici ton backend : renvoie les posts qui ont reçu des commentaires / mentions.
  const posts: Post[] = [];
  return { posts };
}

/* ───────── Helpers ───────── */

/** Canal demandé via /#/community?channel=<key> (re-rendu à chaque navigation). */
function useHashChannel(): string | null {
  useHashRoute();
  const hash = window.location.hash;
  const i = hash.indexOf("?");
  return i === -1 ? null : new URLSearchParams(hash.slice(i + 1)).get("channel");
}

const NETWORK_ICONS: Record<string, IconComponent> = {
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
  threads: ThreadsIcon as IconComponent,
};

function getNetworkIcon(channel: ConnectedChannel): IconComponent | undefined {
  const c = channel as unknown as Record<string, unknown>;
  const raw = String(c.platform ?? c.network ?? c.provider ?? channel.key)
    .toLowerCase()
    .trim();

  if (raw.includes("tiktok")) return NETWORK_ICONS.tiktok;
  if (raw.includes("insta")) return NETWORK_ICONS.instagram;
  if (raw.includes("youtube") || raw === "yt") return NETWORK_ICONS.youtube;
  if (raw.includes("facebook") || raw === "fb") return NETWORK_ICONS.facebook;
  if (raw.includes("linkedin")) return NETWORK_ICONS.linkedin;
  if (raw.includes("pinterest")) return NETWORK_ICONS.pinterest;
  if (raw.includes("threads")) return NETWORK_ICONS.threads;
  if (raw === "x" || raw.includes("twitter")) return NETWORK_ICONS.x;
  return undefined;
}

/* ───────── Icônes ───────── */

function Svg({
  className = "h-4 w-4",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ChatHeartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20.5a8.5 8.5 0 1 0-7.4-4.3L3.5 20.5l4.5-1.1a8.4 8.4 0 0 0 4 1.1Z" />
    <path d="M12 14.6s-2.8-1.6-2.8-3.4a1.6 1.6 0 0 1 2.8-1 1.6 1.6 0 0 1 2.8 1c0 1.8-2.8 3.4-2.8 3.4Z" />
  </Svg>
);
const SyncIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 0 1-13.7 5.7M4 12A8 8 0 0 1 17.7 6.3" />
    <path d="M18 3v4h-4M6 21v-4h4" />
  </Svg>
);
/** Cercle en pointillés avec flèche vers le haut (« remonter les posts »). */
const BringToTopIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" strokeDasharray="3 3.2" />
    <path d="M12 16V8.5M8.5 12 12 8.5 15.5 12" />
  </Svg>
);
const PanelIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M9.5 4.5v15" />
  </Svg>
);
const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h.01M4 12h.01M4 17.5h.01" />
  </Svg>
);
const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7.5" cy="7.5" r="2.5" />
    <circle cx="16.5" cy="7.5" r="2.5" />
    <circle cx="7.5" cy="16.5" r="2.5" />
    <circle cx="16.5" cy="16.5" r="2.5" />
  </Svg>
);
const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
const BubbleIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="12.5" rx="2.5" />
    <path d="M8 20v-3M8 10.5h.01M12 10.5h.01M16 10.5h.01" />
  </Svg>
);
const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </Svg>
);
const CheckCircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 12.5A8.5 8.5 0 1 1 15 4.5" />
    <path d="m8.5 11.5 3.5 3.5 8-8.5" />
  </Svg>
);
const StackIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="4.5" width="14" height="4" rx="1.2" />
    <path d="M4 12h16v6.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V12Z" />
  </Svg>
);
const ListenIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="1.8" />
    <path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8M5.8 5.8a8.8 8.8 0 0 0 0 12.4M18.2 5.8a8.8 8.8 0 0 1 0 12.4" />
  </Svg>
);
const EditIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    <path d="M17.5 3.5a1.8 1.8 0 0 1 2.5 2.5L12 14l-3.5 1 1-3.5 8-8Z" />
  </Svg>
);
const ChatsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 8H12.5A2.5 2.5 0 0 1 15 10.5V15.5A2.5 2.5 0 0 1 12.5 18H9L5.5 21V18A2.5 2.5 0 0 1 3 15.5V10.5A2.5 2.5 0 0 1 5.5 8Z" />
    <path d="M8 8V5.5A2.5 2.5 0 0 1 10.5 3H18.5A2.5 2.5 0 0 1 21 5.5V10.5A2.5 2.5 0 0 1 18.5 13H18V16L15 13" />
  </Svg>
);
const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

/* ───────── Petits composants ───────── */

/** Logo du réseau dans une pastille blanche (même rendu que sur l'avatar du header). */
function NetworkBadge({ Icon }: { Icon: IconComponent }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-black ring-1 ring-black/10">
      <Icon className="h-3 w-3" />
    </span>
  );
}

function Menu<T extends string>({
  value,
  options,
  onChange,
  icon,
  isDark,
  ghost,
}: {
  value: T;
  options: { key: T; label: string; icon?: ReactNode }[];
  onChange: (k: T) => void;
  icon: ReactNode;
  isDark: boolean;
  ghost: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ghost} ${
          isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30"
        }`}
      >
        {current?.icon ?? icon}
        {current?.label}
        <ChevronDownIcon className="h-4 w-4 opacity-60" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className={`absolute right-0 z-40 mt-2 min-w-[200px] overflow-hidden rounded-xl border p-1 shadow-lg ${
              isDark ? "border-white/10 bg-[#0c0c0c]" : "border-black/10 bg-white"
            }`}
          >
            {options.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.key === value}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                    o.key === value
                      ? isDark
                        ? "bg-white/10"
                        : "bg-black/[0.06]"
                      : isDark
                      ? "hover:bg-white/[0.06]"
                      : "hover:bg-black/[0.04]"
                  }`}
                >
                  {o.icon}
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  ghost,
  isDark,
  className = "h-9 w-9",
  align = "center",
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  ghost: string;
  isDark: boolean;
  className?: string;
  /** "end" : l'infobulle s'aligne sur le bord droit (boutons proches du bord de l'écran). */
  align?: "center" | "end";
}) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={`flex items-center justify-center rounded-xl transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ghost} ${
          isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30"
        } ${className}`}
      >
        {children}
      </button>

      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[240px] rounded-lg px-3 py-2 text-[13px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100 ${
          isDark ? "bg-neutral-700" : "bg-neutral-900"
        } ${align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"}`}
      >
        {label}
      </span>
    </span>
  );
}

/* ───────── Page ───────── */

export default function Community() {
  const { theme, toggle: onToggleTheme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();

  // Le channel sélectionné vit dans un state local : le changement est instantané
  // et ne dépend plus du routeur (qui ne gère pas le "?channel=…" dans le hash).
  const hashChannel = useHashChannel();
  const [selectedKey, setSelectedKey] = useState<string | null>(hashChannel);

  // Si l'URL change de l'extérieur (lien, bouton retour), on suit.
  useEffect(() => {
    if (hashChannel) setSelectedKey(hashChannel);
  }, [hashChannel]);

  const channel = channels.find((c) => c.key === selectedKey) ?? channels[0];

  const [tab, setTab] = useState<Tab>("comments");
  const [layout, setLayout] = useState<Layout>("post");
  const [filter, setFilter] = useState<Filter>("all");
  const [postsOpen, setPostsOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const { posts } = useCommunity(channel?.key, tab, filter);

  const page = isDark ? "bg-black text-white" : "bg-white text-black";
  const card = isDark ? "border-white/10 bg-[#0c0c0c]" : "border-black/10 bg-[#fafafa]";
  const line = isDark ? "border-white/10" : "border-black/10";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const ghost = isDark ? "hover:bg-neutral-700/70" : "hover:bg-neutral-200";
  const outline = isDark ? "border-white/15 hover:bg-white/10" : "border-black/15 hover:bg-black/5";
  const ring = isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30";

  const channelOptions = channels.map((c) => {
    const Icon = getNetworkIcon(c);
    return {
      key: c.key,
      label: (c.handle || c.name).replace(/^@/, ""),
      icon: Icon ? <NetworkBadge Icon={Icon} /> : undefined,
    };
  });

  const goChannel = (key: string) => {
    setSelectedKey(key);
    // Met l'URL à jour sans déclencher le routeur ni remonter la page.
    window.history.replaceState(
      null,
      "",
      `#/community?channel=${encodeURIComponent(key)}`
    );
  };

  const visiblePosts = showAll ? posts : posts.filter((p) => p.commentCount > 0);

  return (
    <main
      className={`relative h-screen w-full overflow-hidden transition-colors duration-300 ${page}`}
    >
      {/* Sidebar (animée : ouverture / fermeture fluide via useSidebarOffset) */}
      <DashboardSidebar theme={theme} onToggleTheme={onToggleTheme} />

      {/* Le padding-left suit l'ouverture/fermeture de la sidebar avec la même
          courbe et la même durée que sur la page Channels. */}
      <div
        className="flex h-full flex-col transition-[padding-left] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none will-change-[padding-left]"
        style={{ paddingLeft: sidebarOffset }}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col px-[clamp(12px,1.5vw,24px)] pb-8 pt-[clamp(16px,2vw,28px)]">
          {/* Header */}
          <header className="flex items-center justify-between gap-4 pb-4">
            {/* Titre de la page : en haut à gauche */}
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                  isDark
                    ? "border-white/10 bg-white/[0.03] text-white"
                    : "border-black/[0.08] bg-white text-neutral-900 shadow-sm"
                }`}
              >
                <ChatsIcon className="h-[17px] w-[17px]" />
              </div>
              <h1 className="font-display text-[clamp(17px,1.5vw,20px)] font-semibold tracking-[-0.01em]">
                Community
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <IconButton label="Auto-replies" ghost={ghost} isDark={isDark}>
                <ChatHeartIcon className="h-5 w-5" />
              </IconButton>
              <IconButton label="Refresh comments" ghost={ghost} isDark={isDark}>
                <SyncIcon className="h-5 w-5" />
              </IconButton>

              <div
                role="tablist"
                aria-label="Layout"
                className={`ml-2 inline-flex gap-1 rounded-xl border p-1 ${line}`}
              >
                {(
                  [
                    { key: "post", label: "By post", icon: <PanelIcon className="h-4 w-4" /> },
                    { key: "list", label: "List", icon: <ListIcon className="h-4 w-4" /> },
                  ] as { key: Layout; label: string; icon: ReactNode }[]
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    role="tab"
                    aria-selected={layout === o.key}
                    onClick={() => setLayout(o.key)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                      layout === o.key
                        ? isDark
                          ? "bg-white text-black"
                          : "bg-black text-white"
                        : isDark
                        ? "text-neutral-400 hover:text-white"
                        : "text-neutral-500 hover:text-black"
                    }`}
                  >
                    {o.icon}
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {/* Tabs + toolbar */}
          <div className={`flex items-center justify-between gap-4 border-b ${line}`}>
            <div role="tablist" aria-label="Inbox" className="flex gap-6">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px border-b-2 px-1 pb-3 pt-2 text-[15px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                    tab === t.key
                      ? isDark
                        ? "border-white text-white"
                        : "border-black text-black"
                      : `border-transparent ${muted} ${isDark ? "hover:text-white" : "hover:text-black"}`
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 pb-2">
              <Menu
                value={channel?.key ?? ""}
                options={
                  channelOptions.length
                    ? channelOptions
                    : [{ key: "", label: "Channels" }]
                }
                onChange={(k) => k && goChannel(k)}
                icon={<GridIcon className="h-4 w-4" />}
                isDark={isDark}
                ghost={ghost}
              />
              <Menu
                value={filter}
                options={FILTERS}
                onChange={setFilter}
                icon={<BubbleIcon className="h-4 w-4" />}
                isDark={isDark}
                ghost={ghost}
              />
              <IconButton label="Sort and filter" ghost={ghost} isDark={isDark}>
                <FilterIcon className="h-5 w-5" />
              </IconButton>
              <IconButton label="Mark all as read" ghost={ghost} isDark={isDark} align="end">
                <CheckCircleIcon className="h-5 w-5" />
              </IconButton>
            </div>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1">
            {/* Posts panel */}
            {layout === "post" && postsOpen && (
              <aside className={`flex w-[300px] shrink-0 flex-col border-r pr-4 pt-4 ${line}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-[15px] font-medium ${muted}`}>Posts</h2>
                  <div className="flex items-center">
                    <IconButton
                      label="Bring posts with the newest unanswered comments to the top."
                      ghost={ghost}
                      isDark={isDark}
                      className="h-8 w-8"
                    >
                      <BringToTopIcon className="h-[18px] w-[18px]" />
                    </IconButton>
                    <IconButton
                      label={showAll ? "Only posts with comments" : "Show all posts"}
                      onClick={() => setShowAll((v) => !v)}
                      ghost={ghost}
                      isDark={isDark}
                      className="h-8 w-8"
                    >
                      <StackIcon className="h-[18px] w-[18px]" />
                    </IconButton>
                    <IconButton
                      label="Hide posts panel"
                      onClick={() => setPostsOpen(false)}
                      ghost={ghost}
                      isDark={isDark}
                      className="h-8 w-8"
                    >
                      <PanelIcon className="h-[18px] w-[18px]" />
                    </IconButton>
                  </div>
                </div>

                {visiblePosts.length === 0 ? (
                  <div className="mt-16 flex flex-col items-center gap-3 px-2 text-center">
                    <h3 className="text-[20px] font-semibold tracking-tight">No posts found</h3>
                    <p className={`text-[14px] leading-relaxed ${muted}`}>
                      When your posts receive comments, they&rsquo;ll appear here. Want to see all
                      your posts?
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className={`mt-2 rounded-xl border px-4 py-2 text-[14px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${outline} ${ring}`}
                    >
                      Show all posts
                    </button>
                  </div>
                ) : (
                  <ul className="mt-4 flex min-h-0 flex-col gap-1 overflow-y-auto">
                    {visiblePosts.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${ghost}`}
                        >
                          <span className="truncate">{p.title}</span>
                          <span className={`tabular-nums ${muted}`}>{p.commentCount}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            )}

            {layout === "post" && !postsOpen && (
              <div className="pt-4 pr-3">
                <IconButton
                  label="Show posts panel"
                  onClick={() => setPostsOpen(true)}
                  ghost={ghost}
                  isDark={isDark}
                  className="h-8 w-8"
                >
                  <PanelIcon className="h-[18px] w-[18px]" />
                </IconButton>
              </div>
            )}

            {/* Inbox */}
            <section className="flex min-w-0 flex-1 flex-col items-center overflow-y-auto px-6 py-10">
              <div className="my-auto flex w-full max-w-[560px] flex-col items-center gap-10">
                <div className="flex flex-col items-center gap-3 text-center">
                  <span
                    className={`flex h-20 w-20 items-center justify-center rounded-full ${
                      isDark ? "bg-white/10" : "bg-black/[0.06]"
                    }`}
                  >
                    <ListenIcon className="h-9 w-9" />
                  </span>
                  <h2 className="text-[22px] font-semibold tracking-tight">
                    {tab === "comments"
                      ? "We\u2019re listening for new comments"
                      : "We\u2019re listening for new mentions"}
                  </h2>
                  <p className={`max-w-[420px] text-[15px] leading-relaxed ${muted}`}>
                    {tab === "comments"
                      ? "We\u2019ll let you know when someone comments on your posts."
                      : "We\u2019ll let you know when someone mentions you."}
                  </p>
                </div>

                <div className="flex w-full flex-col gap-3">
                  <p className={`text-center text-[14px] ${muted}`}>
                    In the meantime, keep exploring:
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate("create")}
                    className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${card} ${ring} ${
                      isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]"
                    }`}
                  >
                    <EditIcon className={`mt-0.5 h-5 w-5 shrink-0 ${muted}`} />
                    <span>
                      <span className="block text-[16px] font-semibold">Post something new</span>
                      <span className={`mt-1 block text-[14px] leading-relaxed ${muted}`}>
                        Use templates to create content that starts conversations. Pro tip: ask a
                        question.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("channels")}
                    className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${card} ${ring} ${
                      isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]"
                    }`}
                  >
                    <PlusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${muted}`} />
                    <span>
                      <span className="block text-[16px] font-semibold">Connect more channels</span>
                      <span className={`mt-1 block text-[14px] leading-relaxed ${muted}`}>
                        Manage conversations from all your channels in a single, distraction-free
                        inbox.
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}