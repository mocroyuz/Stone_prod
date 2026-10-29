// src/pages/Community.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import DashboardSidebar, {
  useSidebarOffset,
  useFavorites,
  setChannelUnreadCount, // ✅ AJOUT — synchronise les non-lus vers la sidebar
} from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import ChannelMenu from "../components/ChannelMenu";
import { useConnectedChannels } from "../hooks/useConnectedChannels";
import HelpChatButton from "../components/Helpchatbutton";
import { createPosts } from "../services/posts";
import {
  fetchYouTubeComments,
  fetchYouTubeVideos,
  replyToYouTubeComment,
  setYouTubeCommentsRead,
  type YouTubeComment,
  type YouTubeFilter,
  type YouTubeReply,
} from "../services/youtubeComments";

/* ───────── Types ───────── */

type Tab = "comments" | "mentions";
type Layout = "post" | "list";
type Filter = YouTubeFilter;

type Post = {
  id: string;
  title: string;
  commentCount: number;
  thumbnail: string | null;
};

type IconProps = { className?: string };

const TABS: { key: Tab; label: string }[] = [
  { key: "comments", label: "Comments" },
  { key: "mentions", label: "Mentions" },
];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "unanswered", label: "Unanswered" },
  { key: "answered", label: "Answered" },
];

/** Route de cette page dans la sidebar (section Favorite). */
const PAGE_ROUTE = "community";

/** Actualisation automatique (onglet visible uniquement). */
const COMMENTS_POLL_MS = 60_000;
const VIDEOS_POLL_MS = 5 * 60_000;

const REPLY_MAX = 10_000;

/* ───────── Shell (identique à Home) ───────── */

const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#09090a]" : "bg-[#f5f3ef]";

const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ───────── Helpers ───────── */

/** Miniature YouTube : fonctionne pour n'importe quelle vidéo, même hors liste chargée. */
const thumbnailFor = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

/**
 * Fusionne la première page fraîche (polling) dans la liste affichée :
 * - les nouveaux commentaires sont ajoutés en haut ;
 * - les commentaires déjà connus sont mis à jour (likes, réponses, lu / non lu…) ;
 * - les pages déjà chargées via « Load more » sont conservées.
 */
function mergeComments(
  prev: YouTubeComment[],
  fresh: YouTubeComment[]
): YouTubeComment[] {
  const freshById = new Map(fresh.map((c) => [c.id, c]));
  const known = new Set(prev.map((c) => c.id));
  const added = fresh.filter((c) => !known.has(c.id));
  const updated = prev.map((c) => freshById.get(c.id) ?? c);

  return added.length > 0 ? [...added, ...updated] : updated;
}

/* ───────── Données ───────── */

function useCommunity(
  channelKey: string | undefined,
  tab: Tab,
  filter: Filter,
  postId: string | null,
  reloadKey: number
) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<YouTubeComment[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Deux états d'erreur séparés :
  //   - `error`      : erreurs de chargement des COMMENTAIRES
  //   - `postsError` : erreurs de chargement des VIDÉOS
  const [error, setError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);

  const commentsRef = useRef<YouTubeComment[]>([]);
  commentsRef.current = comments;

  const isYouTube = Boolean(channelKey?.toLowerCase().startsWith("youtube"));

  /* ── Posts (vidéos) : chargement + actualisation lente ── */
  useEffect(() => {
    if (!isYouTube) {
      setPosts([]);
      setPostsError(null);
      return;
    }

    let cancelled = false;

    const load = () => {
      fetchYouTubeVideos()
        .then((r) => {
          if (cancelled) return;
          setPostsError(null);
          const list = Array.isArray(r?.videos) ? r.videos : [];
          setPosts(
            list.map((v) => ({
              id: v.id,
              title: v.title,
              commentCount: v.comment_count,
              thumbnail: v.thumbnail,
            }))
          );
        })
        .catch((e: Error) => {
          if (cancelled) return;
          setPosts([]);
          setPostsError(e.message);
        });
    };

    setPostsError(null);
    load();

    const timer = window.setInterval(() => {
      if (!document.hidden) load();
    }, VIDEOS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isYouTube, channelKey, reloadKey]);

  /* ── Commentaires : chargement initial ── */
  useEffect(() => {
    if (!isYouTube || tab !== "comments") {
      setComments([]);
      setNextPageToken(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchYouTubeComments({ filter, videoId: postId })
      .then((r) => {
        if (cancelled) return;
        setComments(Array.isArray(r?.comments) ? r.comments : []);
        setNextPageToken(r?.next_page_token ?? null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setComments([]);
        setNextPageToken(null);
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isYouTube, channelKey, tab, filter, postId, reloadKey]);

  /* ── Commentaires : actualisation automatique (sans refresh manuel) ── */
  useEffect(() => {
    if (!isYouTube || tab !== "comments") return;

    let cancelled = false;
    let busy = false;

    const poll = async () => {
      if (busy || document.hidden) return;
      busy = true;

      try {
        const r = await fetchYouTubeComments({ filter, videoId: postId });
        if (cancelled) return;

        const fresh = Array.isArray(r?.comments) ? r.comments : [];

        // Liste vide au départ : on reprend aussi le jeton de pagination
        if (commentsRef.current.length === 0) {
          setNextPageToken(r?.next_page_token ?? null);
        }

        setComments((prev) => mergeComments(prev, fresh));
      } catch {
        // Erreur silencieuse : on garde ce qui est déjà affiché
      } finally {
        busy = false;
      }
    };

    const timer = window.setInterval(poll, COMMENTS_POLL_MS);

    // Retour sur l'onglet : actualisation immédiate
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isYouTube, channelKey, tab, filter, postId]);

  const loadMore = async () => {
    if (!nextPageToken) return;
    setLoading(true);
    try {
      const r = await fetchYouTubeComments({
        filter,
        videoId: postId,
        pageToken: nextPageToken,
      });
      const incoming = Array.isArray(r?.comments) ? r.comments : [];
      setComments((prev) => {
        const known = new Set(prev.map((c) => c.id));
        return [...prev, ...incoming.filter((c) => !known.has(c.id))];
      });
      setNextPageToken(r?.next_page_token ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /** Lu / non lu : mise à jour immédiate, annulée si le serveur refuse. */
  const markRead = useCallback(async (ids: string[], read: boolean) => {
    if (ids.length === 0) return;
    const targets = new Set(ids);

    setComments((prev) =>
      prev.map((c) => (targets.has(c.id) ? { ...c, is_read: read } : c))
    );

    try {
      await setYouTubeCommentsRead(ids, read);
    } catch (e) {
      setComments((prev) =>
        prev.map((c) => (targets.has(c.id) ? { ...c, is_read: !read } : c))
      );
      throw e;
    }
  }, []);

  /** Ajoute une réponse envoyée à la discussion affichée. */
  const addReply = useCallback((commentId: string, reply: YouTubeReply) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              answered: true,
              is_read: true,
              reply_count: c.reply_count + 1,
              replies: [...(c.replies ?? []), reply],
            }
          : c
      )
    );
  }, []);

  return {
    posts,
    postsError,
    comments,
    loading,
    error,
    hasMore: Boolean(nextPageToken),
    loadMore,
    markRead,
    addReply,
  };
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

function BookmarkIcon({
  className,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-4 w-4"}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1Z" />
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
const ReplyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6 4 11.5 9.5 17" />
    <path d="M4 11.5h9a7 7 0 0 1 7 7V19" />
  </Svg>
);
const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
);

/* ───────── Petits composants ───────── */

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
        className={[
          "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors motion-reduce:transition-none",
          focusRingClass(isDark),
          ghost,
        ].join(" ")}
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
            className={[
              "absolute right-0 z-40 mt-2 min-w-[200px] overflow-hidden rounded-xl border p-1 shadow-lg",
              isDark
                ? "border-white/[0.08] bg-[#16161a]"
                : "border-black/[0.06] bg-white",
            ].join(" ")}
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
                  className={[
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium transition-colors",
                    o.key === value
                      ? isDark
                        ? "bg-white/[0.08]"
                        : "bg-black/[0.05]"
                      : isDark
                        ? "hover:bg-white/[0.05]"
                        : "hover:bg-black/[0.04]",
                  ].join(" ")}
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
  disabled = false,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  ghost: string;
  isDark: boolean;
  className?: string;
  align?: "center" | "end";
  disabled?: boolean;
}) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={[
          "flex items-center justify-center rounded-xl transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40",
          focusRingClass(isDark),
          ghost,
          className,
        ].join(" ")}
      >
        {children}
      </button>

      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[240px] rounded-lg px-3 py-2 text-[13px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100",
          isDark ? "bg-[#2e2e31]" : "bg-neutral-900",
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}

/** Bouton d'action minimaliste : icône seule, libellé en infobulle au survol. */
function ActionIcon({
  label,
  onClick,
  href,
  active = false,
  isDark,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  isDark: boolean;
  children: ReactNode;
}) {
  const cls = [
    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors motion-reduce:transition-none",
    focusRingClass(isDark),
    active
      ? isDark
        ? "bg-white/[0.08] text-white"
        : "bg-black/[0.06] text-neutral-900"
      : isDark
        ? "text-neutral-500 hover:bg-white/[0.06] hover:text-white"
        : "text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-900",
  ].join(" ");

  return (
    <span className="group relative inline-flex shrink-0">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={cls}
        >
          {children}
        </a>
      ) : (
        <button type="button" aria-label={label} onClick={onClick} className={cls}>
          {children}
        </button>
      )}

      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max -translate-x-1/2 rounded-md px-2 py-1 text-[11.5px] font-medium leading-none text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100",
          isDark ? "bg-[#2e2e31]" : "bg-neutral-900",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}

/* ───────── Page ───────── */

export default function Community() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();

  // Favoris partagés avec la sidebar : le marque-page du header ajoute /
  // retire cette page de la section « Favorite ».
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const hashChannel = useHashChannel();
  const [selectedKey, setSelectedKey] = useState<string | null>(hashChannel);

  useEffect(() => {
    if (hashChannel) setSelectedKey(hashChannel);
  }, [hashChannel]);

  const channel =
    channels.find((c) => c.key === selectedKey) ??
    channels.find((c) => c.platform === "youtube") ??
    channels[0];

  const [tab, setTab] = useState<Tab>("comments");
  const [layout, setLayout] = useState<Layout>("post");
  const [filter, setFilter] = useState<Filter>("all");
  const [postsOpen, setPostsOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Réponse en cours de rédaction
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    posts,
    postsError,
    comments,
    loading,
    error,
    hasMore,
    loadMore,
    markRead,
    addReply,
  } = useCommunity(channel?.key, tab, filter, selectedPostId, reloadKey);

  // ✅ SYNCHRO SIDEBAR : pousse le nombre de commentaires non lus vers le
  //    localStorage (lu par DashboardSidebar → badge + pastille sur l'avatar).
  useEffect(() => {
    if (!channel?.key) return;
    // On attend la fin du chargement initial pour ne pas écraser un badge
    // existant avec "0" avant que la 1ʳᵉ page n'arrive.
    if (loading) return;

    const unread = comments.filter((c) => !c.is_read).length;
    setChannelUnreadCount(channel.key, unread);
  }, [channel?.key, comments, loading]);

  // Index des vidéos par id : sert aux miniatures / titres dans les commentaires
  const postById = useMemo(
    () => new Map(posts.map((p) => [p.id, p])),
    [posts]
  );
  const selectedPost = selectedPostId
    ? postById.get(selectedPostId) ?? null
    : null;

  // Dans la vue « Unread », un commentaire marqué lu disparaît tout de suite
  const shownComments = useMemo(
    () => (filter === "unread" ? comments.filter((c) => !c.is_read) : comments),
    [comments, filter]
  );
  const unreadIds = useMemo(
    () => comments.filter((c) => !c.is_read).map((c) => c.id),
    [comments]
  );

  const needle = query.trim().toLowerCase();

  const line = isDark ? "border-white/[0.07]" : "border-black/[0.06]";
  const muted = isDark ? "text-neutral-500" : "text-neutral-400";
  const ghost = isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]";
  const outline = isDark
    ? "border-white/[0.10] hover:bg-white/[0.06]"
    : "border-black/[0.08] hover:bg-black/[0.03]";
  const card = isDark
    ? "border-white/[0.07] bg-[#141416] hover:bg-[#19191c]"
    : "border-black/[0.06] bg-white hover:bg-[#f6f4f0]";
  const cardStatic = isDark
    ? "border-white/[0.07] bg-[#141416]"
    : "border-black/[0.06] bg-white";
  const fieldClass = isDark
    ? "border-white/[0.10] bg-[#0f0f11] text-white placeholder:text-neutral-600"
    : "border-black/[0.10] bg-white text-neutral-900 placeholder:text-neutral-400";

  const goChannel = (key: string) => {
    setSelectedKey(key);
    setSelectedPostId(null);
    setReplyingId(null);
    window.history.replaceState(
      null,
      "",
      `/community?channel=${encodeURIComponent(key)}`
    );
  };

  const visiblePosts = (
    showAll ? posts : posts.filter((p) => p.commentCount > 0)
  ).filter((post) => post.title.toLowerCase().includes(needle));

  /* ── Actions ── */

  const handleMarkRead = async (ids: string[], read: boolean) => {
    setActionError(null);
    try {
      await markRead(ids, read);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const openReply = (commentId: string) => {
    setReplyError(null);
    setReplyText("");
    setReplyingId((cur) => (cur === commentId ? null : commentId));
  };

  const closeReply = () => {
    setReplyingId(null);
    setReplyText("");
    setReplyError(null);
  };

  const submitReply = async (commentId: string) => {
    const text = replyText.trim();
    if (!text || sendingReply) return;

    setSendingReply(true);
    setReplyError(null);

    try {
      const reply = await replyToYouTubeComment(commentId, text);
      addReply(commentId, reply);
      closeReply();
    } catch (e) {
      setReplyError((e as Error).message);
    } finally {
      setSendingReply(false);
    }
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
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }

    throw new Error(unavailablePostActionMessage(payload));
  };

  return (
    <main
      className={[
        "relative h-screen w-full overflow-hidden",
        "transition-colors duration-300",
        pageBgClass(isDark),
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
        {/* PANNEAU ARRONDI */}
        <div
          className={[
            "flex h-full flex-col overflow-hidden",
            "rounded-[28px] border",
            "transition-colors duration-300",
            mainPanelClass(isDark),
          ].join(" ")}
        >
          <div
            className={[
              "flex min-h-0 w-full flex-1 flex-col",
              "px-[clamp(18px,3vw,48px)]",
              "pb-6 pt-[clamp(18px,3vw,30px)]",
            ].join(" ")}
          >
            {/* HEADER COMPACT */}
            <div className="relative z-40 flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                    isDark
                      ? "border-white/[0.07] bg-white/[0.04] text-neutral-400"
                      : "border-black/[0.06] bg-white text-neutral-500",
                  ].join(" ")}
                >
                  <ChatsIcon />
                </span>
                <h1
                  className={[
                    "truncate text-[20px] font-semibold tracking-[-0.03em]",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  Community
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <ChannelMenu
                  channels={channels}
                  current={channel}
                  isDark={isDark}
                  onSelect={goChannel}
                />

                <div className="flex items-center gap-2">
                  <IconButton
                    label="Auto-replies"
                    ghost={ghost}
                    isDark={isDark}
                    className="h-9 w-9"
                  >
                    <ChatHeartIcon className="h-5 w-5" />
                  </IconButton>
                  <IconButton
                    label="Refresh comments"
                    onClick={() => setReloadKey((k) => k + 1)}
                    ghost={ghost}
                    isDark={isDark}
                    className="h-9 w-9"
                  >
                    <SyncIcon className="h-5 w-5" />
                  </IconButton>

                  <div
                    role="tablist"
                    aria-label="Layout"
                    className={[
                      "ml-2 inline-flex gap-1 rounded-xl border p-1",
                      line,
                    ].join(" ")}
                  >
                    {(
                      [
                        {
                          key: "post",
                          label: "By post",
                          icon: <PanelIcon className="h-4 w-4" />,
                        },
                        {
                          key: "list",
                          label: "List",
                          icon: <ListIcon className="h-4 w-4" />,
                        },
                      ] as { key: Layout; label: string; icon: ReactNode }[]
                    ).map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        role="tab"
                        aria-selected={layout === o.key}
                        onClick={() => setLayout(o.key)}
                        className={[
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors motion-reduce:transition-none",
                          focusRingClass(isDark),
                          layout === o.key
                            ? isDark
                              ? "bg-white text-black"
                              : "bg-neutral-900 text-white"
                            : isDark
                              ? "text-neutral-400 hover:text-white"
                              : "text-neutral-500 hover:text-neutral-900",
                        ].join(" ")}
                      >
                        {o.icon}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Marque-page : ajoute / retire cette page des favoris de la sidebar */}
                <button
                  type="button"
                  aria-label={saved ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={saved}
                  title={saved ? "Remove from favorites" : "Add to favorites"}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={[
                    "ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none",
                    focusRingClass(isDark),
                    isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  <BookmarkIcon className="h-5 w-5" filled={saved} />
                </button>
              </div>
            </div>

            {/* Tabs + toolbar */}
            <div
              className={[
                "flex shrink-0 items-center justify-between gap-4 border-b",
                line,
              ].join(" ")}
            >
              <div role="tablist" aria-label="Inbox" className="flex gap-6">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={[
                      "-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 pt-2 text-[14px] font-medium transition-colors motion-reduce:transition-none",
                      focusRingClass(isDark),
                      tab === t.key
                        ? isDark
                          ? "border-white text-white"
                          : "border-neutral-900 text-neutral-900"
                        : `border-transparent ${muted} ${isDark ? "hover:text-white" : "hover:text-neutral-900"}`,
                    ].join(" ")}
                  >
                    {t.label}
                    {t.key === "comments" && unreadIds.length > 0 && (
                      <span
                        className={[
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                          isDark ? "bg-white text-black" : "bg-neutral-900 text-white",
                        ].join(" ")}
                      >
                        {unreadIds.length > 99 ? "99+" : unreadIds.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 pb-2">
                <Menu
                  value={filter}
                  options={FILTERS}
                  onChange={setFilter}
                  icon={<BubbleIcon className="h-4 w-4" />}
                  isDark={isDark}
                  ghost={ghost}
                />
                <IconButton
                  label="Sort and filter"
                  ghost={ghost}
                  isDark={isDark}
                  className="h-9 w-9"
                >
                  <FilterIcon className="h-5 w-5" />
                </IconButton>
                <IconButton
                  label={
                    unreadIds.length > 0
                      ? `Mark all as read (${unreadIds.length})`
                      : "Mark all as read"
                  }
                  onClick={() => void handleMarkRead(unreadIds, true)}
                  disabled={unreadIds.length === 0}
                  ghost={ghost}
                  isDark={isDark}
                  align="end"
                  className="h-9 w-9"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                </IconButton>
              </div>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1">
              {layout === "post" && postsOpen && (
                <aside
                  className={[
                    "flex w-[300px] shrink-0 flex-col border-r pr-4 pt-4",
                    line,
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <h2 className={["text-[14px] font-medium", muted].join(" ")}>
                      Posts
                    </h2>
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

                  {/* Erreur de chargement des vidéos : affichée ICI, pas dans la zone commentaires */}
                  {postsError && (
                    <p
                      className="mt-3 px-1 text-[12px] leading-snug text-red-500"
                      role="alert"
                    >
                      Could not load videos: {postsError}
                    </p>
                  )}

                  {visiblePosts.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center gap-3 px-2 text-center">
                      <h3
                        className={[
                          "text-[18px] font-semibold tracking-[-0.02em]",
                          strongClass(isDark),
                        ].join(" ")}
                      >
                        {postsError ? "Videos unavailable" : "No posts found"}
                      </h3>
                      <p className={["text-[13px] leading-relaxed", muted].join(" ")}>
                        {postsError
                          ? "We couldn't load your videos. Try refreshing."
                          : "When your posts receive comments, they\u2019ll appear here. Want to see all your posts?"}
                      </p>
                      {!postsError && (
                        <button
                          type="button"
                          onClick={() => setShowAll(true)}
                          className={[
                            "mt-2 rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors motion-reduce:transition-none",
                            focusRingClass(isDark),
                            outline,
                          ].join(" ")}
                        >
                          Show all posts
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul className="mt-4 flex min-h-0 flex-col gap-1 overflow-y-auto">
                      {visiblePosts.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPostId((cur) => (cur === p.id ? null : p.id))
                            }
                            aria-pressed={selectedPostId === p.id}
                            className={[
                              "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[13px] font-medium transition-colors",
                              ghost,
                              selectedPostId === p.id
                                ? isDark
                                  ? "bg-white/[0.08]"
                                  : "bg-black/[0.05]"
                                : "",
                            ].join(" ")}
                          >
                            <img
                              src={p.thumbnail ?? thumbnailFor(p.id)}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="aspect-video w-[72px] shrink-0 rounded-md object-cover"
                            />
                            <span className="min-w-0 flex-1 truncate">{p.title}</span>
                            <span className={["tabular-nums", muted].join(" ")}>
                              {p.commentCount}
                            </span>
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
              <section className="flex min-w-0 flex-1 flex-col overflow-y-auto">
                {/* Bandeau « affiche » de la vidéo sélectionnée */}
                {tab === "comments" && selectedPostId && (
                  <div
                    className={[
                      "mx-6 mt-4 flex shrink-0 items-center gap-4 rounded-2xl border p-3",
                      line,
                    ].join(" ")}
                  >
                    <img
                      src={selectedPost?.thumbnail ?? thumbnailFor(selectedPostId)}
                      alt=""
                      className="h-[72px] w-[128px] shrink-0 rounded-xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <p
                        className={[
                          "truncate text-[14px] font-semibold",
                          strongClass(isDark),
                        ].join(" ")}
                      >
                        {selectedPost?.title ?? "Selected video"}
                      </p>
                      {selectedPost && (
                        <p className={["text-[12px]", muted].join(" ")}>
                          {selectedPost.commentCount} comments
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Erreur de chargement des COMMENTAIRES */}
                {error && (
                  <p className="px-6 pt-4 text-[13px] text-red-500" role="alert">
                    {error}
                  </p>
                )}

                {/* Erreur d'une action (marquer comme lu) */}
                {actionError && (
                  <p className="px-6 pt-4 text-[13px] text-red-500" role="alert">
                    {actionError}
                  </p>
                )}

                {tab === "comments" && loading && comments.length === 0 ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
                    <p className={["text-[13px]", muted].join(" ")}>
                      Loading comments…
                    </p>
                  </div>
                ) : tab === "comments" && shownComments.length > 0 ? (
                  <ul className="flex flex-col gap-2 px-6 py-4">
                    {shownComments.map((c) => {
                      const video = c.video_id ? postById.get(c.video_id) : undefined;
                      const replies = c.replies ?? [];
                      const isReplying = replyingId === c.id;
                      const youtubeUrl = `https://www.youtube.com/watch?v=${c.video_id}&lc=${c.id}`;

                      return (
                        <li key={c.id}>
                          <article
                            className={[
                              "rounded-2xl border p-4",
                              cardStatic,
                            ].join(" ")}
                          >
                            <div className="flex items-start gap-3">
                              {c.author_avatar ? (
                                <img
                                  src={c.author_avatar}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-full"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="h-9 w-9 shrink-0 rounded-full bg-neutral-500/30" />
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {!c.is_read && (
                                    <span
                                      className={[
                                        "h-2 w-2 shrink-0 rounded-full",
                                        isDark ? "bg-white" : "bg-neutral-900",
                                      ].join(" ")}
                                      role="img"
                                      aria-label="Unread"
                                    />
                                  )}
                                  <span
                                    className={[
                                      "truncate text-[13px] font-semibold",
                                      strongClass(isDark),
                                    ].join(" ")}
                                  >
                                    {c.author_name}
                                  </span>
                                  {c.is_own && (
                                    <span
                                      className={[
                                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                        isDark
                                          ? "bg-white/[0.08] text-neutral-300"
                                          : "bg-black/[0.06] text-neutral-600",
                                      ].join(" ")}
                                    >
                                      You
                                    </span>
                                  )}
                                  {c.published_at && (
                                    <span className={["text-[12px]", muted].join(" ")}>
                                      {new Date(c.published_at).toLocaleDateString()}
                                    </span>
                                  )}
                                  {c.answered && (
                                    <span
                                      className={["text-[11px] font-medium", muted].join(" ")}
                                    >
                                      · Answered
                                    </span>
                                  )}
                                </div>

                                <p
                                  className={[
                                    "mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed",
                                    strongClass(isDark),
                                  ].join(" ")}
                                >
                                  {c.text}
                                </p>

                                <p className={["mt-1 text-[12px]", muted].join(" ")}>
                                  {c.like_count} likes · {c.reply_count} replies
                                </p>

                                {/* Réponses déjà publiées */}
                                {replies.length > 0 && (
                                  <ul
                                    className={[
                                      "mt-3 flex flex-col gap-3 border-l pl-3",
                                      line,
                                    ].join(" ")}
                                  >
                                    {replies.map((r) => (
                                      <li key={r.id} className="flex items-start gap-2.5">
                                        {r.author_avatar ? (
                                          <img
                                            src={r.author_avatar}
                                            alt=""
                                            className="h-6 w-6 shrink-0 rounded-full"
                                            referrerPolicy="no-referrer"
                                          />
                                        ) : (
                                          <span className="h-6 w-6 shrink-0 rounded-full bg-neutral-500/30" />
                                        )}
                                        <div className="min-w-0">
                                          <p className="flex flex-wrap items-center gap-1.5">
                                            <span
                                              className={[
                                                "text-[12px] font-semibold",
                                                strongClass(isDark),
                                              ].join(" ")}
                                            >
                                              {r.author_name}
                                            </span>
                                            {r.is_own && (
                                              <span
                                                className={[
                                                  "rounded px-1 py-0.5 text-[9px] font-semibold",
                                                  isDark
                                                    ? "bg-white/[0.08] text-neutral-300"
                                                    : "bg-black/[0.06] text-neutral-600",
                                                ].join(" ")}
                                              >
                                                You
                                              </span>
                                            )}
                                          </p>
                                          <p
                                            className={[
                                              "whitespace-pre-wrap break-words text-[12.5px] leading-relaxed",
                                              strongClass(isDark),
                                            ].join(" ")}
                                          >
                                            {r.text}
                                          </p>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {/* Actions : icônes seules, libellé au survol */}
                                <div className="mt-2 -ml-1.5 flex flex-wrap items-center gap-0.5">
                                  {c.can_reply && !c.is_own && (
                                    <ActionIcon
                                      label="Reply"
                                      onClick={() => openReply(c.id)}
                                      active={isReplying}
                                      isDark={isDark}
                                    >
                                      <ReplyIcon className="h-[17px] w-[17px]" />
                                    </ActionIcon>
                                  )}

                                  {!c.is_own && (
                                    <ActionIcon
                                      label={c.is_read ? "Mark as unread" : "Mark as read"}
                                      onClick={() => void handleMarkRead([c.id], !c.is_read)}
                                      active={c.is_read}
                                      isDark={isDark}
                                    >
                                      <CheckCircleIcon className="h-[17px] w-[17px]" />
                                    </ActionIcon>
                                  )}

                                  {c.video_id && (
                                    <ActionIcon
                                      label="Open on YouTube"
                                      href={youtubeUrl}
                                      isDark={isDark}
                                    >
                                      <ExternalIcon className="h-[17px] w-[17px]" />
                                    </ActionIcon>
                                  )}
                                </div>

                                {/* Zone de réponse */}
                                {isReplying && (
                                  <div className="mt-3 flex flex-col gap-2">
                                    <textarea
                                      autoFocus
                                      value={replyText}
                                      onChange={(e) =>
                                        setReplyText(e.target.value.slice(0, REPLY_MAX))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") closeReply();
                                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                          e.preventDefault();
                                          void submitReply(c.id);
                                        }
                                      }}
                                      rows={3}
                                      placeholder={`Reply to ${c.author_name}…`}
                                      disabled={sendingReply}
                                      className={[
                                        "w-full resize-y rounded-xl border px-3 py-2 text-[13px] leading-relaxed",
                                        focusRingClass(isDark),
                                        fieldClass,
                                      ].join(" ")}
                                    />

                                    {replyError && (
                                      <p className="text-[12px] text-red-500" role="alert">
                                        {replyError}
                                      </p>
                                    )}

                                    <div className="flex items-center justify-between gap-3">
                                      <span className={["text-[11px]", muted].join(" ")}>
                                        Ctrl/⌘ + Enter to send
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={closeReply}
                                          disabled={sendingReply}
                                          className={[
                                            "rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                                            focusRingClass(isDark),
                                            outline,
                                          ].join(" ")}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void submitReply(c.id)}
                                          disabled={sendingReply || replyText.trim().length === 0}
                                          className={[
                                            "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
                                            focusRingClass(isDark),
                                            isDark
                                              ? "bg-white text-black"
                                              : "bg-neutral-900 text-white",
                                          ].join(" ")}
                                        >
                                          {sendingReply ? "Sending…" : "Send reply"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Affiche de la vidéo */}
                              {c.video_id && (
                                <span className="hidden w-[120px] shrink-0 flex-col gap-1.5 sm:flex">
                                  <img
                                    src={video?.thumbnail ?? thumbnailFor(c.video_id)}
                                    alt=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    className="aspect-video w-full rounded-lg object-cover"
                                  />
                                  {video && (
                                    <span
                                      className={[
                                        "line-clamp-2 text-[11px] leading-snug",
                                        muted,
                                      ].join(" ")}
                                    >
                                      {video.title}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </article>
                        </li>
                      );
                    })}

                    {hasMore && (
                      <li className="flex justify-center pt-2">
                        <button
                          type="button"
                          onClick={loadMore}
                          disabled={loading}
                          className={[
                            "rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors",
                            focusRingClass(isDark),
                            outline,
                          ].join(" ")}
                        >
                          {loading ? "Loading…" : "Load more"}
                        </button>
                      </li>
                    )}
                  </ul>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col items-center px-6 py-10">
                    <div className="my-auto flex w-full max-w-[560px] flex-col items-center gap-10">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <span
                          className={[
                            "flex h-20 w-20 items-center justify-center rounded-full",
                            isDark
                              ? "bg-white/[0.07] text-neutral-300"
                              : "bg-black/[0.05] text-neutral-600",
                          ].join(" ")}
                        >
                          <ListenIcon className="h-9 w-9" />
                        </span>
                        <h2
                          className={[
                            "text-[22px] font-semibold tracking-[-0.03em]",
                            strongClass(isDark),
                          ].join(" ")}
                        >
                          {tab === "comments"
                            ? "We\u2019re listening for new comments"
                            : "We\u2019re listening for new mentions"}
                        </h2>
                        <p
                          className={[
                            "max-w-[420px] text-[14px] leading-relaxed",
                            muted,
                          ].join(" ")}
                        >
                          {tab === "comments"
                            ? "We\u2019ll let you know when someone comments on your posts."
                            : "We\u2019ll let you know when someone mentions you."}
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3">
                        <p className={["text-center text-[13px]", muted].join(" ")}>
                          In the meantime, keep exploring:
                        </p>

                        <button
                          type="button"
                          onClick={() => navigate("create")}
                          className={[
                            "flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors motion-reduce:transition-none",
                            focusRingClass(isDark),
                            card,
                          ].join(" ")}
                        >
                          <EditIcon
                            className={["mt-0.5 h-5 w-5 shrink-0", muted].join(" ")}
                          />
                          <span>
                            <span
                              className={[
                                "block text-[15px] font-semibold",
                                strongClass(isDark),
                              ].join(" ")}
                            >
                              Post something new
                            </span>
                            <span
                              className={[
                                "mt-1 block text-[13px] leading-relaxed",
                                muted,
                              ].join(" ")}
                            >
                              Use templates to create content that starts conversations.
                              Pro tip: ask a question.
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("channels")}
                          className={[
                            "flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors motion-reduce:transition-none",
                            focusRingClass(isDark),
                            card,
                          ].join(" ")}
                        >
                          <PlusIcon
                            className={["mt-0.5 h-5 w-5 shrink-0", muted].join(" ")}
                          />
                          <span>
                            <span
                              className={[
                                "block text-[15px] font-semibold",
                                strongClass(isDark),
                              ].join(" ")}
                            >
                              Connect more channels
                            </span>
                            <span
                              className={[
                                "mt-1 block text-[13px] leading-relaxed",
                                muted,
                              ].join(" ")}
                            >
                              Manage conversations from all your channels in a single,
                              distraction-free inbox.
                            </span>
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
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

      {/* HELP — même bouton que sur Home */}
      <HelpChatButton isDark={isDark} />
    </main>
  );
}