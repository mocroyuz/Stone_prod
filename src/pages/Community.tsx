// src/pages/Community.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";
import { useUser } from "../contexts/UserContext";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import { navigateToSettingsSection } from "../utils/settingsNavigation";
import DashboardSidebar, {
  useSidebarOffset,
  useFavorites,
  setChannelUnreadCount,
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
} from "../services/youtube";

/* ───────── Language ───────── */

type Lang = "fr" | "en";

const LANGUAGE_STORAGE_KEY = "stone:language";
const LANGUAGE_CHANGED_EVENT = "stone:language-changed";

function detectLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* stockage indisponible */
  }
  return "en";
}

function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(() => detectLanguage());

  useEffect(() => {
    const refresh = () => setLang(detectLanguage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("hashchange", refresh);
    window.addEventListener(LANGUAGE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", refresh);
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, refresh);
    };
  }, []);

  return lang;
}

const intlLocale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");

/* ───────── Mobile ───────── */

const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return mobile;
}

/* ───────── Copy ───────── */

type Copy = {
  page: {
    title: string;
  };
  header: {
    autoReplies: string;
    refresh: string;
    layoutAria: string;
    byPost: string;
    list: string;
    addFavorite: string;
    removeFavorite: string;
  };
  tabs: {
    ariaLabel: string;
    comments: string;
    mentions: string;
  };
  filters: {
    ariaLabel: string;
    all: string;
    unread: string;
    unanswered: string;
    answered: string;
    sortFilter: string;
    markAllRead: (n: number) => string;
    markAllReadPlain: string;
    closeMenu: string;
  };
  posts: {
    title: string;
    bringToTop: string;
    onlyWithComments: string;
    showAll: string;
    hidePanel: string;
    showPanel: string;
    loadError: (err: string) => string;
    unavailableTitle: string;
    unavailableHint: string;
    emptyTitle: string;
    emptyHint: string;
    showAllCta: string;
  };
  sheet: {
    close: string;
    noComments: string;
    dragHint: string;
  };
  inbox: {
    selectedVideo: string;
    commentsCount: (n: number) => string;
    loading: string;
    loadMore: string;
    loadingMore: string;
  };
  comment: {
    unread: string;
    you: string;
    answered: string;
    likes: (n: number) => string;
    replies: (n: number) => string;
    reply: string;
    markRead: string;
    markUnread: string;
    openOnYouTube: string;
    replyTo: (name: string) => string;
    ctrlEnter: string;
    cancel: string;
    sendReply: string;
    sending: string;
  };
  empty: {
    listeningComments: string;
    listeningMentions: string;
    listeningCommentsHint: string;
    listeningMentionsHint: string;
    meanwhile: string;
    postNewTitle: string;
    postNewHint: string;
    connectTitle: string;
    connectHint: string;
  };
};

const COPY: Record<Lang, Copy> = {
  en: {
    page: { title: "Community" },
    header: {
      autoReplies: "Auto-replies",
      refresh: "Refresh comments",
      layoutAria: "Layout",
      byPost: "By post",
      list: "List",
      addFavorite: "Add to favorites",
      removeFavorite: "Remove from favorites",
    },
    tabs: {
      ariaLabel: "Inbox",
      comments: "Comments",
      mentions: "Mentions",
    },
    filters: {
      ariaLabel: "Filter",
      all: "All",
      unread: "Unread",
      unanswered: "Unanswered",
      answered: "Answered",
      sortFilter: "Sort and filter",
      markAllRead: (n) => `Mark all as read (${n})`,
      markAllReadPlain: "Mark all as read",
      closeMenu: "Close menu",
    },
    posts: {
      title: "Posts",
      bringToTop:
        "Bring posts with the newest unanswered comments to the top.",
      onlyWithComments: "Only posts with comments",
      showAll: "Show all posts",
      hidePanel: "Hide posts panel",
      showPanel: "Show posts panel",
      loadError: (err) => `Could not load videos: ${err}`,
      unavailableTitle: "Videos unavailable",
      unavailableHint: "We couldn't load your videos. Try refreshing.",
      emptyTitle: "No posts found",
      emptyHint:
        "When your posts receive comments, they'll appear here. Want to see all your posts?",
      showAllCta: "Show all posts",
    },
    sheet: {
      close: "Close comments",
      noComments: "No comments to show",
      dragHint: "Drag down to close",
    },
    inbox: {
      selectedVideo: "Selected video",
      commentsCount: (n) => `${n} comments`,
      loading: "Loading comments…",
      loadMore: "Load more",
      loadingMore: "Loading…",
    },
    comment: {
      unread: "Unread",
      you: "You",
      answered: "Answered",
      likes: (n) => `${n} ${n === 1 ? "like" : "likes"}`,
      replies: (n) => `${n} ${n === 1 ? "reply" : "replies"}`,
      reply: "Reply",
      markRead: "Mark as read",
      markUnread: "Mark as unread",
      openOnYouTube: "Open on YouTube",
      replyTo: (name) => `Reply to ${name}…`,
      ctrlEnter: "Ctrl/⌘ + Enter to send",
      cancel: "Cancel",
      sendReply: "Send reply",
      sending: "Sending…",
    },
    empty: {
      listeningComments: "We're listening for new comments",
      listeningMentions: "We're listening for new mentions",
      listeningCommentsHint:
        "We'll let you know when someone comments on your posts.",
      listeningMentionsHint: "We'll let you know when someone mentions you.",
      meanwhile: "In the meantime, keep exploring:",
      postNewTitle: "Post something new",
      postNewHint:
        "Use templates to create content that starts conversations. Pro tip: ask a question.",
      connectTitle: "Connect more channels",
      connectHint:
        "Manage conversations from all your channels in a single, distraction-free inbox.",
    },
  },
  fr: {
    page: { title: "Communauté" },
    header: {
      autoReplies: "Réponses auto",
      refresh: "Rafraîchir les commentaires",
      layoutAria: "Disposition",
      byPost: "Par publication",
      list: "Liste",
      addFavorite: "Ajouter aux favoris",
      removeFavorite: "Retirer des favoris",
    },
    tabs: {
      ariaLabel: "Boîte de réception",
      comments: "Commentaires",
      mentions: "Mentions",
    },
    filters: {
      ariaLabel: "Filtre",
      all: "Tous",
      unread: "Non lus",
      unanswered: "Sans réponse",
      answered: "Répondus",
      sortFilter: "Trier et filtrer",
      markAllRead: (n) => `Tout marquer comme lu (${n})`,
      markAllReadPlain: "Tout marquer comme lu",
      closeMenu: "Fermer le menu",
    },
    posts: {
      title: "Publications",
      bringToTop:
        "Faire remonter les publications avec les commentaires sans réponse les plus récents.",
      onlyWithComments: "Seulement les publications avec commentaires",
      showAll: "Afficher toutes les publications",
      hidePanel: "Masquer le panneau des publications",
      showPanel: "Afficher le panneau des publications",
      loadError: (err) => `Impossible de charger les vidéos : ${err}`,
      unavailableTitle: "Vidéos indisponibles",
      unavailableHint:
        "Impossible de charger vos vidéos. Essayez de rafraîchir.",
      emptyTitle: "Aucune publication trouvée",
      emptyHint:
        "Lorsque vos publications reçoivent des commentaires, ils apparaîtront ici. Voulez-vous voir toutes vos publications ?",
      showAllCta: "Afficher toutes les publications",
    },
    sheet: {
      close: "Fermer les commentaires",
      noComments: "Aucun commentaire à afficher",
      dragHint: "Glissez vers le bas pour fermer",
    },
    inbox: {
      selectedVideo: "Vidéo sélectionnée",
      commentsCount: (n) => `${n} commentaire${n === 1 ? "" : "s"}`,
      loading: "Chargement des commentaires…",
      loadMore: "Charger plus",
      loadingMore: "Chargement…",
    },
    comment: {
      unread: "Non lu",
      you: "Vous",
      answered: "Répondu",
      likes: (n) => `${n} mention${n === 1 ? "" : "s"} J'aime`,
      replies: (n) => `${n} réponse${n === 1 ? "" : "s"}`,
      reply: "Répondre",
      markRead: "Marquer comme lu",
      markUnread: "Marquer comme non lu",
      openOnYouTube: "Ouvrir sur YouTube",
      replyTo: (name) => `Répondre à ${name}…`,
      ctrlEnter: "Ctrl/⌘ + Entrée pour envoyer",
      cancel: "Annuler",
      sendReply: "Envoyer la réponse",
      sending: "Envoi…",
    },
    empty: {
      listeningComments: "Nous guettons les nouveaux commentaires",
      listeningMentions: "Nous guettons les nouvelles mentions",
      listeningCommentsHint:
        "Nous vous préviendrons quand quelqu'un commentera vos publications.",
      listeningMentionsHint:
        "Nous vous préviendrons quand quelqu'un vous mentionnera.",
      meanwhile: "En attendant, continuez à explorer :",
      postNewTitle: "Publier quelque chose de nouveau",
      postNewHint:
        "Utilisez des modèles pour créer du contenu qui lance des conversations. Astuce : posez une question.",
      connectTitle: "Connecter plus de canaux",
      connectHint:
        "Gérez les conversations de tous vos canaux dans une seule boîte de réception sans distraction.",
    },
  },
};

/* ───────── Types ───────── */

type Tab = "comments" | "mentions";
type Layout = "post" | "list";
type Filter = YouTubeFilter;

type Post = {
  id: string;
  title: string;
  commentCount: number;
  thumbnail: string | null;
  status?: string;
};

type IconProps = { className?: string };

const PAGE_ROUTE = "community";
const COMMENTS_POLL_MS = 60_000;
const VIDEOS_POLL_MS = 5 * 60_000;
const REPLY_MAX = 10_000;
const SHEET_CLOSE_DRAG_PX = 120;
const SHEET_ANIM_MS = 240;

/* ───────── Shell ───────── */

const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#050505]" : "bg-[#f5f3ef]";

const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0a0a0c]"
    : "border-black/[0.06] bg-white";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ───────── Helpers ───────── */

const thumbnailFor = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

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

/* ───────── Cache module (survit aux navigations SPA) ───────── */

type VideosCacheEntry = { posts: Post[]; at: number };
type CommentsCacheEntry = {
  comments: YouTubeComment[];
  nextPageToken: string | null;
  at: number;
};

const videosCache = new Map<string, VideosCacheEntry>();
const commentsCache = new Map<string, CommentsCacheEntry>();

const VIDEOS_FRESH_MS = 2 * 60_000;
const COMMENTS_FRESH_MS = 30_000;

const commentsCacheKey = (
  userId: string,
  channelKey: string,
  tab: Tab,
  filter: Filter,
  postId: string | null
) => `${userId}|${channelKey}|${tab}|${filter}|${postId ?? "all"}`;

/* ───────── Données ───────── */

function useCommunity(
  channelKey: string | undefined,
  tab: Tab,
  filter: Filter,
  postId: string | null,
  reloadKey: number
) {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const isYouTube = Boolean(channelKey?.toLowerCase().startsWith("youtube"));
  const isCommentsTab =
    Boolean(userId) && tab === "comments" && isYouTube && Boolean(channelKey);
  const videoCacheKey = userId && channelKey ? `${userId}|${channelKey}` : "";
  const activeCommentsKey =
    userId && channelKey && isCommentsTab
      ? commentsCacheKey(userId, channelKey, tab, filter, postId)
      : null;
  const activeCommentsKeyRef = useRef(activeCommentsKey);
  activeCommentsKeyRef.current = activeCommentsKey;

  const [posts, setPosts] = useState<Post[]>(() =>
    userId && channelKey && isYouTube
      ? videosCache.get(`${userId}|${channelKey}`)?.posts ?? []
      : []
  );
  const [postsError, setPostsError] = useState<string | null>(null);

  const [comments, setComments] = useState<YouTubeComment[]>(() => {
    if (!isCommentsTab) return [];
    return (
      commentsCache.get(commentsCacheKey(userId ?? "", channelKey!, tab, filter, postId))
        ?.comments ?? []
    );
  });
  const [nextPageToken, setNextPageToken] = useState<string | null>(() => {
    if (!isCommentsTab) return null;
    return (
      commentsCache.get(commentsCacheKey(userId ?? "", channelKey!, tab, filter, postId))
        ?.nextPageToken ?? null
    );
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!isCommentsTab) return false;
    return !commentsCache.has(
      commentsCacheKey(userId ?? "", channelKey!, tab, filter, postId)
    );
  });
  const [error, setError] = useState<string | null>(null);

  const commentsRef = useRef<YouTubeComment[]>([]);
  commentsRef.current = comments;

  const lastVideosReloadRef = useRef(reloadKey);
  const lastCommentsReloadRef = useRef(reloadKey);

  useEffect(() => {
    const forceReload = reloadKey !== lastVideosReloadRef.current;
    lastVideosReloadRef.current = reloadKey;

    if (!userId || !isYouTube || !channelKey) {
      setPosts([]);
      setPostsError(null);
      return;
    }

    const key = videoCacheKey;
    const cached = videosCache.get(key);
    const stale = !cached || Date.now() - cached.at >= VIDEOS_FRESH_MS;
    const shouldFetch = forceReload || stale;

    if (cached) {
      setPosts(cached.posts);
      setPostsError(null);
    }

    let cancelled = false;

    const load = () => {
      fetchYouTubeVideos()
        .then((r) => {
          if (cancelled) return;
          const list = Array.isArray(r?.videos) ? r.videos : [];
          const mapped = list.map((v) => ({
            id: v.id,
            title: v.title,
            commentCount: v.comment_count,
            thumbnail: v.thumbnail,
            status: (v as { status?: string }).status,
          }));
          setPosts(mapped);
          setPostsError(null);
          videosCache.set(key, { posts: mapped, at: Date.now() });
        })
        .catch((e: Error) => {
          if (cancelled) return;
          if (!cached) {
            setPosts([]);
            setPostsError(e.message);
          }
        });
    };

    if (shouldFetch) load();

    const timer = window.setInterval(() => {
      if (!document.hidden) load();
    }, VIDEOS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isYouTube, channelKey, videoCacheKey, userId, reloadKey]);

  useEffect(() => {
    const forceReload = reloadKey !== lastCommentsReloadRef.current;
    lastCommentsReloadRef.current = reloadKey;

    if (!userId || !isYouTube || tab !== "comments" || !channelKey) {
      setComments([]);
      setNextPageToken(null);
      setLoading(false);
      setError(null);
      return;
    }

    const key = commentsCacheKey(userId ?? "", channelKey, tab, filter, postId);
    const cached = commentsCache.get(key);
    const stale = !cached || Date.now() - cached.at >= COMMENTS_FRESH_MS;
    const shouldFetch = forceReload || stale;

    if (cached) {
      setComments(cached.comments);
      setNextPageToken(cached.nextPageToken);
      setError(null);
    }

    let cancelled = false;

    if (shouldFetch) {
      setLoading(!cached);
      setError(null);

      fetchYouTubeComments({ filter, videoId: postId })
        .then((r) => {
          if (cancelled) return;
          const fresh = Array.isArray(r?.comments) ? r.comments : [];
          const token = r?.next_page_token ?? null;
          setComments(fresh);
          setNextPageToken(token);
          setError(null);
          commentsCache.set(key, {
            comments: fresh,
            nextPageToken: token,
            at: Date.now(),
          });
        })
        .catch((e: Error) => {
          if (cancelled) return;
          if (!cached) {
            setComments([]);
            setNextPageToken(null);
            setError(e.message);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [userId, isYouTube, channelKey, tab, filter, postId, reloadKey]);

  useEffect(() => {
    if (!userId || !isYouTube || tab !== "comments" || !channelKey) return;

    const key = commentsCacheKey(userId ?? "", channelKey, tab, filter, postId);
    let cancelled = false;
    let busy = false;

    const poll = async () => {
      if (busy || document.hidden) return;
      busy = true;

      try {
        const r = await fetchYouTubeComments({ filter, videoId: postId });
        if (cancelled) return;

        const fresh = Array.isArray(r?.comments) ? r.comments : [];
        const prev = commentsRef.current;
        const wasEmpty = prev.length === 0;

        const merged = mergeComments(prev, fresh);
        setComments(merged);

        if (wasEmpty) {
          setNextPageToken(r?.next_page_token ?? null);
        }

        const existing = commentsCache.get(key);
        const token = wasEmpty
          ? r?.next_page_token ?? existing?.nextPageToken ?? null
          : existing?.nextPageToken ?? null;

        commentsCache.set(key, {
          comments: merged,
          nextPageToken: token,
          at: Date.now(),
        });
      } catch {
        /* silencieux */
      } finally {
        busy = false;
      }
    };

    const timer = window.setInterval(poll, COMMENTS_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, isYouTube, channelKey, tab, filter, postId]);

  const loadMore = async () => {
    const requestKey = activeCommentsKey;
    const pageToken = nextPageToken;
    if (!pageToken || !channelKey || !requestKey) return;
    setLoading(true);
    try {
      const r = await fetchYouTubeComments({
        filter,
        videoId: postId,
        pageToken,
      });
      if (activeCommentsKeyRef.current !== requestKey) return;

      const incoming = Array.isArray(r?.comments) ? r.comments : [];
      const newToken = r?.next_page_token ?? null;
      const prev = commentsRef.current;
      const known = new Set(prev.map((c) => c.id));
      const merged = [...prev, ...incoming.filter((c) => !known.has(c.id))];

      setComments(merged);
      setNextPageToken(newToken);

      const existing = commentsCache.get(requestKey);
      commentsCache.set(requestKey, {
        comments: merged,
        nextPageToken: newToken,
        at: existing?.at ?? Date.now(),
      });
    } catch (e) {
      if (activeCommentsKeyRef.current === requestKey) {
        setError(e instanceof Error ? e.message : "Unable to load more comments.");
      }
    } finally {
      if (activeCommentsKeyRef.current === requestKey) setLoading(false);
    }
  };

  const markRead = useCallback(
    async (ids: string[], read: boolean) => {
      if (ids.length === 0 || !userId || !channelKey) return;
      const targets = new Set(ids);
      const key = commentsCacheKey(userId, channelKey, tab, filter, postId);

      const apply = (list: YouTubeComment[]) =>
        list.map((c) => (targets.has(c.id) ? { ...c, is_read: read } : c));

      setComments(apply);
      {
        const entry = commentsCache.get(key);
        if (entry)
          commentsCache.set(key, { ...entry, comments: apply(entry.comments) });
      }

      try {
        await setYouTubeCommentsRead(ids, read);
      } catch (e) {
        if (activeCommentsKeyRef.current !== key) throw e;
        const revert = (list: YouTubeComment[]) =>
          list.map((c) => (targets.has(c.id) ? { ...c, is_read: !read } : c));
        setComments(revert);
        const entry = commentsCache.get(key);
        if (entry)
          commentsCache.set(key, {
            ...entry,
            comments: revert(entry.comments),
          });
        throw e;
      }
    },
    [channelKey, tab, filter, postId]
  );

  const addReply = useCallback(
    (commentId: string, reply: YouTubeReply) => {
      const mutate = (list: YouTubeComment[]) =>
        list.map((c) =>
          c.id === commentId
            ? {
                ...c,
                answered: true,
                is_read: true,
                reply_count: c.reply_count + 1,
                replies: [...(c.replies ?? []), reply],
              }
            : c
        );

      setComments(mutate);
      if (userId && channelKey) {
        const key = commentsCacheKey(userId, channelKey, tab, filter, postId);
        const entry = commentsCache.get(key);
        if (entry)
          commentsCache.set(key, { ...entry, comments: mutate(entry.comments) });
      }
    },
    [channelKey, tab, filter, postId]
  );

  const visiblePosts = videoCacheKey
    ? videosCache.get(videoCacheKey)?.posts ?? []
    : [];
  const visibleCommentsEntry = activeCommentsKey
    ? commentsCache.get(activeCommentsKey)
    : undefined;

  return {
    posts: visiblePosts,
    postsError,
    comments: visibleCommentsEntry?.comments ?? [],
    loading,
    error,
    hasMore: Boolean(visibleCommentsEntry?.nextPageToken),
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
const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
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
  closeLabel,
}: {
  value: T;
  options: { key: T; label: string; icon?: ReactNode }[];
  onChange: (k: T) => void;
  icon: ReactNode;
  isDark: boolean;
  ghost: string;
  closeLabel: string;
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
            aria-label={closeLabel}
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className={[
              "absolute right-0 z-40 mt-2 min-w-[200px] overflow-hidden rounded-xl border p-1 shadow-lg",
              isDark
                ? "border-white/[0.08] bg-[#101012]"
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
  const lang = useLanguage();
  const c = COPY[lang];
  const isMobile = useIsMobile();

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const hashChannel = useHashChannel();
  const [selectedKey, setSelectedKey] = useState<string | null>(hashChannel);

  useEffect(() => {
    if (hashChannel) setSelectedKey(hashChannel);
  }, [hashChannel]);

  const channel =
    channels.find((ch) => ch.key === selectedKey) ??
    channels.find((ch) => ch.platform === "youtube") ??
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

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* Feuille glissable (mobile) */
  const [sheetEntered, setSheetEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!channel?.key) return;
    if (loading) return;
    if (filter !== "all" || selectedPostId) return;
    const unread = comments.filter((cm) => !cm.is_read && !cm.is_own).length;
    setChannelUnreadCount(channel.key, unread);
  }, [channel?.key, comments, loading, filter, selectedPostId]);

  const postById = useMemo(
    () => new Map(posts.map((p) => [p.id, p])),
    [posts]
  );
  const selectedPost = selectedPostId
    ? postById.get(selectedPostId) ?? null
    : null;

  const shownComments = useMemo(
    () =>
      (filter === "unread" ? comments.filter((cm) => !cm.is_read) : comments)
        .filter((cm) => !cm.is_own),
    [comments, filter]
  );

  const unreadIds = useMemo(
    () => comments.filter((cm) => !cm.is_read && !cm.is_own).map((cm) => cm.id),
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
    ? "border-white/[0.07] bg-[#0f0f11] hover:bg-[#141417]"
    : "border-black/[0.06] bg-white hover:bg-[#f6f4f0]";
  const cardStatic = isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";
  const fieldClass = isDark
    ? "border-white/[0.10] bg-[#0a0a0c] text-white placeholder:text-neutral-600"
    : "border-black/[0.10] bg-white text-neutral-900 placeholder:text-neutral-400";

  const TABS: { key: Tab; label: string }[] = [
    { key: "comments", label: c.tabs.comments },
    { key: "mentions", label: c.tabs.mentions },
  ];

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: c.filters.all },
    { key: "unread", label: c.filters.unread },
    { key: "unanswered", label: c.filters.unanswered },
    { key: "answered", label: c.filters.answered },
  ];

  /* Mobile : toujours la vue « par publication », panneau toujours ouvert */
  const effLayout: Layout = isMobile ? "post" : layout;
  const showPostsPane =
    effLayout === "post" &&
    (isMobile ? tab === "comments" : postsOpen);
  const showCollapsedToggle = effLayout === "post" && !isMobile && !postsOpen;

  /* Feuille : ouverte seulement sur mobile, onglet commentaires, vidéo choisie */
  const sheetMode = isMobile && tab === "comments" && selectedPostId !== null;
  const inboxHiddenOnMobile =
    isMobile && tab === "comments" && selectedPostId === null;

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

  /* Sur mobile : toutes les vidéos (hors programmées) avec leur compteur */
  const visiblePosts = (
    showAll || isMobile
      ? posts.filter((p) => p.status !== "scheduled")
      : posts.filter((p) => p.commentCount > 0)
  ).filter((post) => post.title.toLowerCase().includes(needle));

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

  /* ── Feuille : animation d'ouverture / fermeture / glisser ── */

  useEffect(() => {
    if (!sheetMode) {
      setSheetEntered(false);
      setDragY(0);
      setDragging(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setSheetEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, [sheetMode, selectedPostId]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  const closeSheet = useCallback(() => {
    closeReply();
    setDragging(false);
    setDragY(window.innerHeight);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedPostId(null);
      setDragY(0);
    }, SHEET_ANIM_MS);
  }, []);

  useEffect(() => {
    if (!sheetMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetMode, closeSheet]);

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStartRef.current));
  };

  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return;
    const delta = e.clientY - dragStartRef.current;
    dragStartRef.current = null;
    setDragging(false);
    if (delta > SHEET_CLOSE_DRAG_PX) closeSheet();
    else setDragY(0);
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

  const inboxClassName = sheetMode
    ? [
        "fixed inset-x-0 bottom-0 z-[35] flex h-[88dvh] flex-col overflow-y-auto overscroll-contain",
        "rounded-t-[28px] border-t shadow-[0_-12px_40px_rgba(0,0,0,0.35)]",
        "pb-[env(safe-area-inset-bottom)]",
        line,
        isDark ? "bg-[#0a0a0c]" : "bg-white",
        dragging
          ? ""
          : "transition-transform duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
      ].join(" ")
    : inboxHiddenOnMobile
      ? "hidden"
      : "flex min-w-0 flex-1 flex-col overflow-y-auto";

  const inboxStyle: React.CSSProperties | undefined = sheetMode
    ? {
        transform: sheetEntered
          ? `translateY(${dragY}px)`
          : "translateY(100%)",
      }
    : undefined;

  return (
    <main
      className={[
        "relative h-[100dvh] w-full overflow-hidden",
        "transition-colors duration-300",
        pageBgClass(isDark),
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      <div
        className={[
          "h-full py-3 pr-3 max-md:pt-14",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
          "max-md:pl-3",
        ].join(" ")}
        style={isMobile ? undefined : { paddingLeft: sidebarOffset }}
      >
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
              "px-[clamp(14px,3vw,48px)]",
              "pb-[104px] pt-[clamp(14px,3vw,30px)] sm:pb-6",
            ].join(" ")}
          >
            {/* HEADER COMPACT — z-20 pour passer SOUS le tiroir mobile (z-40)
                et SOUS la barre mobile (z-30), tout en restant AU-DESSUS
                des sections de page (z-auto). */}
            <div className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3 md:pb-4">
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
                  {c.page.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
                <ChannelMenu
                  channels={channels}
                  current={channel}
                  isDark={isDark}
                  onSelect={goChannel}
                />

                <div className="flex items-center gap-1 md:gap-2">
                  <IconButton
                    label={c.header.autoReplies}
                    ghost={ghost}
                    isDark={isDark}
                    className="h-9 w-9"
                  >
                    <ChatHeartIcon className="h-5 w-5" />
                  </IconButton>
                  <IconButton
                    label={c.header.refresh}
                    onClick={() => setReloadKey((k) => k + 1)}
                    ghost={ghost}
                    isDark={isDark}
                    className="h-9 w-9"
                  >
                    <SyncIcon className="h-5 w-5" />
                  </IconButton>

                  {/* Choix de disposition : inutile sur mobile (toujours « par publication ») */}
                  <div
                    role="tablist"
                    aria-label={c.header.layoutAria}
                    className={[
                      "ml-2 inline-flex gap-1 rounded-xl border p-1 max-md:hidden",
                      line,
                    ].join(" ")}
                  >
                    {(
                      [
                        {
                          key: "post",
                          label: c.header.byPost,
                          icon: <PanelIcon className="h-4 w-4" />,
                        },
                        {
                          key: "list",
                          label: c.header.list,
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

                <button
                  type="button"
                  aria-label={
                    saved ? c.header.removeFavorite : c.header.addFavorite
                  }
                  aria-pressed={saved}
                  title={saved ? c.header.removeFavorite : c.header.addFavorite}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none md:ml-1",
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
                "flex shrink-0 items-center justify-between gap-2 border-b md:gap-4",
                line,
              ].join(" ")}
            >
              <div
                role="tablist"
                aria-label={c.tabs.ariaLabel}
                className="flex gap-5 md:gap-6"
              >
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
                        : `border-transparent ${muted} ${
                            isDark
                              ? "hover:text-white"
                              : "hover:text-neutral-900"
                          }`,
                    ].join(" ")}
                  >
                    {t.label}
                    {t.key === "comments" && unreadIds.length > 0 && (
                      <span
                        className={[
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                          isDark
                            ? "bg-white text-black"
                            : "bg-neutral-900 text-white",
                        ].join(" ")}
                      >
                        {unreadIds.length > 99 ? "99+" : unreadIds.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-0.5 pb-2 md:gap-1">
                <Menu
                  value={filter}
                  options={FILTERS}
                  onChange={setFilter}
                  icon={<BubbleIcon className="h-4 w-4" />}
                  isDark={isDark}
                  ghost={ghost}
                  closeLabel={c.filters.closeMenu}
                />
                <IconButton
                  label={c.filters.sortFilter}
                  ghost={ghost}
                  isDark={isDark}
                  className="h-9 w-9 max-md:hidden"
                >
                  <FilterIcon className="h-5 w-5" />
                </IconButton>
                <IconButton
                  label={
                    unreadIds.length > 0
                      ? c.filters.markAllRead(unreadIds.length)
                      : c.filters.markAllReadPlain
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
              {showPostsPane && (
                <aside
                  className={[
                    "flex shrink-0 flex-col pt-4",
                    isMobile
                      ? "w-full min-w-0 flex-1"
                      : ["w-[300px] border-r pr-4", line].join(" "),
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <h2
                      className={["text-[14px] font-medium", muted].join(" ")}
                    >
                      {c.posts.title}
                      {isMobile && posts.length > 0 && (
                        <span className="ml-2 tabular-nums">
                          {visiblePosts.length}
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center">
                      <IconButton
                        label={c.posts.bringToTop}
                        ghost={ghost}
                        isDark={isDark}
                        className="h-8 w-8"
                        align={isMobile ? "end" : "center"}
                      >
                        <BringToTopIcon className="h-[18px] w-[18px]" />
                      </IconButton>
                      {!isMobile && (
                        <>
                          <IconButton
                            label={
                              showAll
                                ? c.posts.onlyWithComments
                                : c.posts.showAll
                            }
                            onClick={() => setShowAll((v) => !v)}
                            ghost={ghost}
                            isDark={isDark}
                            className="h-8 w-8"
                          >
                            <StackIcon className="h-[18px] w-[18px]" />
                          </IconButton>
                          <IconButton
                            label={c.posts.hidePanel}
                            onClick={() => setPostsOpen(false)}
                            ghost={ghost}
                            isDark={isDark}
                            className="h-8 w-8"
                          >
                            <PanelIcon className="h-[18px] w-[18px]" />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>

                  {postsError && (
                    <p
                      className="mt-3 px-1 text-[12px] leading-snug text-red-500"
                      role="alert"
                    >
                      {c.posts.loadError(postsError)}
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
                        {postsError
                          ? c.posts.unavailableTitle
                          : c.posts.emptyTitle}
                      </h3>
                      <p
                        className={[
                          "text-[13px] leading-relaxed",
                          muted,
                        ].join(" ")}
                      >
                        {postsError ? c.posts.unavailableHint : c.posts.emptyHint}
                      </p>
                      {!postsError && !isMobile && (
                        <button
                          type="button"
                          onClick={() => setShowAll(true)}
                          className={[
                            "mt-2 rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors motion-reduce:transition-none",
                            focusRingClass(isDark),
                            outline,
                          ].join(" ")}
                        >
                          {c.posts.showAllCta}
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul className="mt-4 flex min-h-0 flex-col gap-1 overflow-y-auto">
                      {visiblePosts.map((p) => {
                        const noComments = p.commentCount === 0;
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              disabled={isMobile && noComments}
                              onClick={() =>
                                setSelectedPostId((cur) =>
                                  isMobile ? p.id : cur === p.id ? null : p.id
                                )
                              }
                              aria-pressed={selectedPostId === p.id}
                              className={[
                                "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[13px] font-medium transition-colors",
                                "disabled:cursor-default disabled:opacity-55",
                                isMobile ? "py-2.5" : "",
                                focusRingClass(isDark),
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
                                className={[
                                  "aspect-video shrink-0 rounded-md object-cover",
                                  isMobile ? "w-[96px]" : "w-[72px]",
                                ].join(" ")}
                              />
                              <span
                                className={[
                                  "min-w-0 flex-1",
                                  isMobile
                                    ? "line-clamp-2 leading-snug"
                                    : "truncate",
                                ].join(" ")}
                              >
                                {p.title}
                              </span>
                              <span
                                className={[
                                  "tabular-nums",
                                  muted,
                                  isMobile
                                    ? "flex shrink-0 items-center gap-1 text-[12.5px]"
                                    : "",
                                ].join(" ")}
                                aria-label={c.inbox.commentsCount(
                                  p.commentCount
                                )}
                              >
                                {isMobile && (
                                  <BubbleIcon className="h-4 w-4" />
                                )}
                                {p.commentCount}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </aside>
              )}

              {showCollapsedToggle && (
                <div className="pt-4 pr-3">
                  <IconButton
                    label={c.posts.showPanel}
                    onClick={() => setPostsOpen(true)}
                    ghost={ghost}
                    isDark={isDark}
                    className="h-8 w-8"
                  >
                    <PanelIcon className="h-[18px] w-[18px]" />
                  </IconButton>
                </div>
              )}

              {/* Voile derrière la feuille (mobile) */}
              {sheetMode && (
                <button
                  type="button"
                  aria-label={c.sheet.close}
                  tabIndex={-1}
                  onClick={closeSheet}
                  className={[
                    "fixed inset-0 z-[34] cursor-default bg-black/50 transition-opacity duration-[240ms] motion-reduce:transition-none",
                    sheetEntered ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                />
              )}

              {/* Inbox (sur mobile : feuille glissable quand une vidéo est choisie) */}
              <section className={inboxClassName} style={inboxStyle}>
                {sheetMode && (
                  <div
                    className={[
                      "sticky top-0 z-10 shrink-0 border-b",
                      line,
                      isDark ? "bg-[#0a0a0c]" : "bg-white",
                    ].join(" ")}
                  >
                    {/* Poignée + titre : zone de glissement */}
                    <div
                      onPointerDown={onDragStart}
                      onPointerMove={onDragMove}
                      onPointerUp={onDragEnd}
                      onPointerCancel={onDragEnd}
                      className="cursor-grab touch-none select-none px-4 pb-3 pt-2.5 active:cursor-grabbing"
                      aria-label={c.sheet.dragHint}
                    >
                      <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-500/40" />
                      <div className="mt-3 flex items-center gap-3">
                        <img
                          src={
                            selectedPost?.thumbnail ??
                            thumbnailFor(selectedPostId!)
                          }
                          alt=""
                          referrerPolicy="no-referrer"
                          className="aspect-video w-[72px] shrink-0 rounded-md object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={[
                              "line-clamp-2 text-[14px] font-semibold leading-snug",
                              strongClass(isDark),
                            ].join(" ")}
                          >
                            {selectedPost?.title ?? c.inbox.selectedVideo}
                          </p>
                          {selectedPost && (
                            <p className={["text-[12px]", muted].join(" ")}>
                              {c.inbox.commentsCount(selectedPost.commentCount)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={c.sheet.close}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={closeSheet}
                          className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                            focusRingClass(isDark),
                            ghost,
                          ].join(" ")}
                        >
                          <CloseIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Filtres dans la feuille */}
                    <div
                      role="tablist"
                      aria-label={c.filters.ariaLabel}
                      className="flex items-center gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {FILTERS.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          role="tab"
                          aria-selected={filter === f.key}
                          onClick={() => setFilter(f.key)}
                          className={[
                            "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                            focusRingClass(isDark),
                            filter === f.key
                              ? isDark
                                ? "border-white bg-white text-black"
                                : "border-neutral-900 bg-neutral-900 text-white"
                              : [
                                  outline,
                                  isDark
                                    ? "text-neutral-300"
                                    : "text-neutral-600",
                                ].join(" "),
                          ].join(" ")}
                        >
                          {f.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(unreadIds, true)}
                        disabled={unreadIds.length === 0}
                        className={[
                          "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                          focusRingClass(isDark),
                          outline,
                          isDark ? "text-neutral-300" : "text-neutral-600",
                        ].join(" ")}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        {unreadIds.length > 0
                          ? c.filters.markAllRead(unreadIds.length)
                          : c.filters.markAllReadPlain}
                      </button>
                    </div>
                  </div>
                )}

                {tab === "comments" && selectedPostId && !isMobile && (
                  <div
                    className={[
                      "mx-6 mt-4 flex shrink-0 items-center gap-4 rounded-2xl border p-3",
                      line,
                    ].join(" ")}
                  >
                    <img
                      src={
                        selectedPost?.thumbnail ??
                        thumbnailFor(selectedPostId)
                      }
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
                        {selectedPost?.title ?? c.inbox.selectedVideo}
                      </p>
                      {selectedPost && (
                        <p className={["text-[12px]", muted].join(" ")}>
                          {c.inbox.commentsCount(selectedPost.commentCount)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <p
                    className="px-4 pt-4 text-[13px] text-red-500 md:px-6"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                {actionError && (
                  <p
                    className="px-4 pt-4 text-[13px] text-red-500 md:px-6"
                    role="alert"
                  >
                    {actionError}
                  </p>
                )}

                {tab === "comments" && loading && comments.length === 0 ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
                    <p className={["text-[13px]", muted].join(" ")}>
                      {c.inbox.loading}
                    </p>
                  </div>
                ) : tab === "comments" && shownComments.length > 0 ? (
                  <ul className="flex flex-col gap-2 px-3 py-4 md:px-6">
                    {shownComments.map((cm) => {
                      const video = cm.video_id
                        ? postById.get(cm.video_id)
                        : undefined;
                      const replies = cm.replies ?? [];
                      const isReplying = replyingId === cm.id;
                      const youtubeUrl = `https://www.youtube.com/watch?v=${cm.video_id}&lc=${cm.id}`;

                      const bodyColor = cm.is_read
                        ? muted
                        : strongClass(isDark);
                      const nameColor = cm.is_read
                        ? muted
                        : strongClass(isDark);

                      const imageStyle: React.CSSProperties = cm.is_read
                        ? { filter: "grayscale(1)", opacity: 0.55 }
                        : { filter: "none", opacity: 1 };

                      const articleBg = cardStatic;

                      return (
                        <li key={cm.id}>
                          <article
                            className={[
                              "rounded-2xl border p-3.5 transition-colors md:p-4",
                              articleBg,
                            ].join(" ")}
                          >
                            <div className="flex items-start gap-3">
                              {cm.author_avatar ? (
                                <img
                                  src={cm.author_avatar}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-full transition-[filter,opacity] duration-200"
                                  style={imageStyle}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="h-9 w-9 shrink-0 rounded-full bg-neutral-500/30" />
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {!cm.is_read && (
                                    <span
                                      className={[
                                        "h-2 w-2 shrink-0 rounded-full",
                                        isDark ? "bg-white" : "bg-neutral-900",
                                      ].join(" ")}
                                      role="img"
                                      aria-label={c.comment.unread}
                                    />
                                  )}
                                  <span
                                    className={[
                                      "truncate text-[13px] font-semibold",
                                      nameColor,
                                    ].join(" ")}
                                  >
                                    {cm.author_name}
                                  </span>
                                  {cm.is_own && (
                                    <span
                                      className={[
                                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                        isDark
                                          ? "bg-white/[0.08] text-neutral-300"
                                          : "bg-black/[0.06] text-neutral-600",
                                      ].join(" ")}
                                    >
                                      {c.comment.you}
                                    </span>
                                  )}
                                  {cm.published_at && (
                                    <span
                                      className={[
                                        "text-[12px]",
                                        muted,
                                      ].join(" ")}
                                    >
                                      {new Date(
                                        cm.published_at
                                      ).toLocaleDateString(intlLocale(lang))}
                                    </span>
                                  )}
                                  {cm.answered && (
                                    <span
                                      className={[
                                        "text-[11px] font-medium",
                                        muted,
                                      ].join(" ")}
                                    >
                                      · {c.comment.answered}
                                    </span>
                                  )}
                                </div>

                                <p
                                  className={[
                                    "mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed",
                                    bodyColor,
                                  ].join(" ")}
                                >
                                  {cm.text}
                                </p>

                                <p
                                  className={[
                                    "mt-1 text-[12px]",
                                    muted,
                                  ].join(" ")}
                                >
                                  {c.comment.likes(cm.like_count)} ·{" "}
                                  {c.comment.replies(cm.reply_count)}
                                </p>

                                {replies.length > 0 && (
                                  <ul
                                    className={[
                                      "mt-3 flex flex-col gap-3 border-l pl-3",
                                      line,
                                    ].join(" ")}
                                  >
                                    {replies.map((r) => (
                                      <li
                                        key={r.id}
                                        className="flex items-start gap-2.5"
                                      >
                                        {r.author_avatar ? (
                                          <img
                                            src={r.author_avatar}
                                            alt=""
                                            className="h-6 w-6 shrink-0 rounded-full transition-[filter,opacity] duration-200"
                                            style={imageStyle}
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
                                                nameColor,
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
                                                {c.comment.you}
                                              </span>
                                            )}
                                          </p>
                                          <p
                                            className={[
                                              "whitespace-pre-wrap break-words text-[12.5px] leading-relaxed",
                                              bodyColor,
                                            ].join(" ")}
                                          >
                                            {r.text}
                                          </p>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                <div className="mt-2 -ml-1.5 flex flex-wrap items-center gap-0.5">
                                  {cm.can_reply && !cm.is_own && (
                                    <ActionIcon
                                      label={c.comment.reply}
                                      onClick={() => openReply(cm.id)}
                                      active={isReplying}
                                      isDark={isDark}
                                    >
                                      <ReplyIcon className="h-[17px] w-[17px]" />
                                    </ActionIcon>
                                  )}

                                  {!cm.is_own && (
                                    <ActionIcon
                                      label={
                                        cm.is_read
                                          ? c.comment.markUnread
                                          : c.comment.markRead
                                      }
                                      onClick={() =>
                                        void handleMarkRead(
                                          [cm.id],
                                          !cm.is_read
                                        )
                                      }
                                      active={cm.is_read}
                                      isDark={isDark}
                                    >
                                      <CheckCircleIcon className="h-[17px] w-[17px]" />
                                    </ActionIcon>
                                  )}

                                  {cm.video_id && (
                                    <ActionIcon
                                      label={c.comment.openOnYouTube}
                                      href={youtubeUrl}
                                      isDark={isDark}
                                    >
                                      <ExternalIcon className="h-[17px] w-[17px]" />
                                    </ActionIcon>
                                  )}
                                </div>

                                {isReplying && (
                                  <div className="mt-3 flex flex-col gap-2">
                                    <textarea
                                      autoFocus
                                      value={replyText}
                                      onChange={(e) =>
                                        setReplyText(
                                          e.target.value.slice(0, REPLY_MAX)
                                        )
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          e.stopPropagation();
                                          closeReply();
                                        }
                                        if (
                                          e.key === "Enter" &&
                                          (e.metaKey || e.ctrlKey)
                                        ) {
                                          e.preventDefault();
                                          void submitReply(cm.id);
                                        }
                                      }}
                                      rows={3}
                                      placeholder={c.comment.replyTo(
                                        cm.author_name
                                      )}
                                      disabled={sendingReply}
                                      className={[
                                        "w-full resize-y rounded-xl border px-3 py-2 text-[16px] leading-relaxed md:text-[13px]",
                                        focusRingClass(isDark),
                                        fieldClass,
                                      ].join(" ")}
                                    />

                                    {replyError && (
                                      <p
                                        className="text-[12px] text-red-500"
                                        role="alert"
                                      >
                                        {replyError}
                                      </p>
                                    )}

                                    <div className="flex items-center justify-between gap-3">
                                      <span
                                        className={[
                                          "text-[11px] max-md:hidden",
                                          muted,
                                        ].join(" ")}
                                      >
                                        {c.comment.ctrlEnter}
                                      </span>
                                      <div className="flex items-center gap-2 max-md:ml-auto">
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
                                          {c.comment.cancel}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void submitReply(cm.id)}
                                          disabled={
                                            sendingReply ||
                                            replyText.trim().length === 0
                                          }
                                          className={[
                                            "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
                                            focusRingClass(isDark),
                                            isDark
                                              ? "bg-white text-black"
                                              : "bg-neutral-900 text-white",
                                          ].join(" ")}
                                        >
                                          {sendingReply
                                            ? c.comment.sending
                                            : c.comment.sendReply}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {cm.video_id && !isMobile && (
                                <span className="hidden w-[120px] shrink-0 flex-col gap-1.5 sm:flex">
                                  <img
                                    src={
                                      video?.thumbnail ??
                                      thumbnailFor(cm.video_id)
                                    }
                                    alt=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    className="aspect-video w-full rounded-lg object-cover transition-[filter,opacity] duration-200"
                                    style={imageStyle}
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
                          {loading
                            ? c.inbox.loadingMore
                            : c.inbox.loadMore}
                        </button>
                      </li>
                    )}
                  </ul>
                ) : sheetMode ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                    <span
                      className={[
                        "flex h-14 w-14 items-center justify-center rounded-full",
                        isDark
                          ? "bg-white/[0.07] text-neutral-300"
                          : "bg-black/[0.05] text-neutral-600",
                      ].join(" ")}
                    >
                      <BubbleIcon className="h-6 w-6" />
                    </span>
                    <p className={["text-[14px]", muted].join(" ")}>
                      {c.sheet.noComments}
                    </p>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col items-center px-4 py-10 md:px-6">
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
                            ? c.empty.listeningComments
                            : c.empty.listeningMentions}
                        </h2>
                        <p
                          className={[
                            "max-w-[420px] text-[14px] leading-relaxed",
                            muted,
                          ].join(" ")}
                        >
                          {tab === "comments"
                            ? c.empty.listeningCommentsHint
                            : c.empty.listeningMentionsHint}
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3">
                        <p
                          className={[
                            "text-center text-[13px]",
                            muted,
                          ].join(" ")}
                        >
                          {c.empty.meanwhile}
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
                            className={[
                              "mt-0.5 h-5 w-5 shrink-0",
                              muted,
                            ].join(" ")}
                          />
                          <span>
                            <span
                              className={[
                                "block text-[15px] font-semibold",
                                strongClass(isDark),
                              ].join(" ")}
                            >
                              {c.empty.postNewTitle}
                            </span>
                            <span
                              className={[
                                "mt-1 block text-[13px] leading-relaxed",
                                muted,
                              ].join(" ")}
                            >
                              {c.empty.postNewHint}
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigateToSettingsSection("channels")}
                          className={[
                            "flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors motion-reduce:transition-none",
                            focusRingClass(isDark),
                            card,
                          ].join(" ")}
                        >
                          <PlusIcon
                            className={[
                              "mt-0.5 h-5 w-5 shrink-0",
                              muted,
                            ].join(" ")}
                          />
                          <span>
                            <span
                              className={[
                                "block text-[15px] font-semibold",
                                strongClass(isDark),
                              ].join(" ")}
                            >
                              {c.empty.connectTitle}
                            </span>
                            <span
                              className={[
                                "mt-1 block text-[13px] leading-relaxed",
                                muted,
                              ].join(" ")}
                            >
                              {c.empty.connectHint}
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

      <HelpChatButton isDark={isDark} />
    </main>
  );
}