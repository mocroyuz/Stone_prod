// src/hooks/useFeeds.ts
//
// Hook de lecture de flux RSS/Atom — backend rss2json uniquement.
//
//   - fetchViaRss2Json : convertit un flux en JSON côté rss2json (CORS ouvert),
//     gère count, clé API optionnelle (VITE_RSS2JSON_KEY), retry réseau.
//   - loadFeed         : point d'entrée unique, rss2json uniquement.
//   - enrichImages     : SUPPRIMÉ — rss2json renvoie déjà thumbnail/enclosure.
//   - refresh / addFeed: plus d'appel à enrichImages.

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// TYPES
// ============================================================

export interface FeedArticle {
  id: string;
  title: string;
  link: string;
  date: number; // timestamp ms, 0 si inconnu
  summary: string;
  imageUrl?: string;
}

export interface LoadedFeed {
  title: string;
  siteUrl: string;
  articles: FeedArticle[];
}

export interface FeedSource {
  id: string;
  url: string;
  title?: string;
  siteUrl?: string;
}

export type FeedStatus = "idle" | "loading" | "ready" | "error";

interface UseFeedsOptions {
  /** Nombre maximum d'articles conservés par flux. Défaut : 20. */
  maxPerFeed?: number;
  /** Nombre maximum de flux affichés au total. Défaut : 200. */
  maxArticlesTotal?: number;
}

// ============================================================
// CONSTANTES
// ============================================================

const DEFAULT_MAX_PER_FEED = 20;
const DEFAULT_MAX_ARTICLES_TOTAL = 200;
const RSS2JSON_FETCH_TIMEOUT_MS = 12_000;
const RSS2JSON_RETRY_ATTEMPTS = 2;

// ============================================================
// UTILITAIRES
// ============================================================

/** Nettoie un fragment HTML pour obtenir du texte brut. */
function htmlToText(html: string): string {
  if (!html) return "";

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&#0*34;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise une URL image éventuellement protocol-relative (`//`) ou déjà absolue.
 * Retourne "" si la valeur est vide ou non http(s).
 */
function normalizeUrl(value?: string | null): string {
  if (!value) return "";
  const s = String(value).trim();
  if (!s) return "";

  if (s.startsWith("//")) return `https:${s}`;
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

/**
 * Extrait la première <img src> d'un fragment HTML et la résout par
 * rapport à `baseUrl` si elle est relative.
 */
function firstImage(html: string, baseUrl: string): string {
  if (!html) return "";

  const match = /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(html);
  if (!match) return "";

  const raw = match[1];
  const absolute = normalizeUrl(raw);
  if (absolute) return absolute;

  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return "";
  }
}

/**
 * `fetch` avec timeout + propagation d'un éventuel signal parent.
 */
async function fetchWithTimeout(
  url: string,
  signal: AbortSignal | undefined,
  timeoutMs: number
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// ============================================================
// RSS2JSON — CHARGEMENT
// ============================================================

/**
 * rss2json : renvoie le flux déjà converti en JSON, avec CORS activé.
 *
 * - `count` limite le nombre d'articles renvoyés côté service
 * - `VITE_RSS2JSON_KEY` est optionnel (lève la limite de requêtes du plan gratuit)
 * - 2 tentatives pour absorber un hoquet réseau
 */
async function fetchViaRss2Json(
  url: string,
  signal?: AbortSignal,
  maxPerFeed: number = DEFAULT_MAX_PER_FEED
): Promise<LoadedFeed> {
  const params = new URLSearchParams({
    rss_url: url,
    count: String(maxPerFeed),
  });

  // Optionnel : clé gratuite sur rss2json.com (VITE_RSS2JSON_KEY)
  const apiKey = import.meta.env.VITE_RSS2JSON_KEY;
  if (apiKey) {
    params.set("api_key", apiKey);
  }

  const endpoint = `https://api.rss2json.com/v1/api.json?${params.toString()}`;

  let res: Response | null = null;
  let lastError: unknown;

  // 2 tentatives : un timeout ou un hoquet réseau ne doit pas suffire à échouer
  for (let attempt = 0; attempt < RSS2JSON_RETRY_ATTEMPTS; attempt++) {
    try {
      res = await fetchWithTimeout(endpoint, signal, RSS2JSON_FETCH_TIMEOUT_MS);
      break;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e;
    }
  }

  if (!res) {
    throw lastError instanceof Error
      ? lastError
      : new Error("rss2json injoignable");
  }
  if (!res.ok) {
    throw new Error(`rss2json HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    message?: string;
    feed?: { title?: string; link?: string };
    items?: {
      title?: string;
      link?: string;
      pubDate?: string;
      description?: string;
      content?: string;
      thumbnail?: string;
      enclosure?: { link?: string; type?: string };
    }[];
  };

  if (data.status !== "ok" || !data.items) {
    throw new Error(data.message || "rss2json error");
  }

  const articles = data.items.slice(0, maxPerFeed).map<FeedArticle>((it) => {
    const html = it.content || it.description || "";
    const summary = htmlToText(it.description || it.content || "");

    const iso = it.pubDate ? `${it.pubDate.replace(" ", "T")}Z` : "";
    const parsed = Date.parse(iso) || Date.parse(it.pubDate ?? "");

    const enclosureImg = it.enclosure?.type?.startsWith("image")
      ? it.enclosure.link
      : undefined;

    return {
      id: it.link || `${url}#${it.title ?? ""}`,
      title: htmlToText(it.title ?? "") || "Untitled",
      link: it.link ?? "",
      date: Number.isNaN(parsed) ? 0 : parsed,
      summary:
        summary.length > 200
          ? `${summary.slice(0, 200).trimEnd()}…`
          : summary,
      imageUrl:
        normalizeUrl(it.thumbnail) ||
        normalizeUrl(enclosureImg) ||
        firstImage(html, it.link || url),
    };
  });

  return {
    title: data.feed?.title?.trim() ?? "",
    siteUrl: data.feed?.link ?? "",
    articles,
  };
}

// ============================================================
// LOADFEED — rss2json uniquement
// ============================================================

async function loadFeed(
  url: string,
  signal?: AbortSignal,
  maxPerFeed: number = DEFAULT_MAX_PER_FEED
): Promise<LoadedFeed> {
  try {
    return await fetchViaRss2Json(url, signal, maxPerFeed);
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn(`[Feeds] rss2json failed for ${url}`, e);
    throw new Error(`rss2json: ${(e as Error).message}`);
  }
}

// ============================================================
// HOOK
// ============================================================

interface FeedState {
  sources: FeedSource[];
  articles: Record<string, FeedArticle[]>; // par id de source
  meta: Record<string, { title: string; siteUrl: string }>;
  status: Record<string, FeedStatus>;
}

export function useFeeds(options: UseFeedsOptions = {}) {
  const maxPerFeed = options.maxPerFeed ?? DEFAULT_MAX_PER_FEED;
  const maxArticlesTotal =
    options.maxArticlesTotal ?? DEFAULT_MAX_ARTICLES_TOTAL;

  const [state, setState] = useState<FeedState>({
    sources: [],
    articles: {},
    meta: {},
    status: {},
  });

  const abortRefs = useRef(new Map<string, AbortController>());

  // Aucun `enrichImages` — supprimé.

  // ----------------------------------------------------------
  // refresh(feed)
  // ----------------------------------------------------------
  const refresh = useCallback(
    async (feed: FeedSource) => {
      const previous = abortRefs.current.get(feed.id);
      previous?.abort();

      const ctrl = new AbortController();
      abortRefs.current.set(feed.id, ctrl);

      setState((s) => ({
        ...s,
        status: { ...s.status, [feed.id]: "loading" },
      }));

      try {
        const parsed = await loadFeed(feed.url, ctrl.signal, maxPerFeed);
        if (ctrl.signal.aborted) return;

        setState((s) => {
          const capped = parsed.articles.slice(0, maxPerFeed);

          return {
            ...s,
            articles: { ...s.articles, [feed.id]: capped },
            meta: {
              ...s.meta,
              [feed.id]: {
                title: parsed.title || feed.title || feed.url,
                siteUrl: parsed.siteUrl || feed.siteUrl || "",
              },
            },
            status: { ...s.status, [feed.id]: "ready" },
          };
        });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        // ⚠️ correction : plus de throw silencieux, on marque l'erreur.
        void e;
        setState((s) => ({
          ...s,
          status: { ...s.status, [feed.id]: "error" },
        }));
      } finally {
        if (abortRefs.current.get(feed.id) === ctrl) {
          abortRefs.current.delete(feed.id);
        }
      }
    },
    [maxPerFeed]
  );

  // ----------------------------------------------------------
  // addFeed(feed)
  // ----------------------------------------------------------
  const addFeed = useCallback(
    async (feed: FeedSource) => {
      setState((s) => {
        if (s.sources.some((f) => f.id === feed.id)) return s;
        if (s.sources.length >= maxArticlesTotal) return s;
        return {
          ...s,
          sources: [...s.sources, feed],
        };
      });

      await refresh(feed);
    },
    [maxArticlesTotal, refresh]
  );

  // ----------------------------------------------------------
  // removeFeed(id)
  // ----------------------------------------------------------
  const removeFeed = useCallback((id: string) => {
    abortRefs.current.get(id)?.abort();
    abortRefs.current.delete(id);

    setState((s) => {
      const { [id]: _a, ...restArticles } = s.articles;
      const { [id]: _m, ...restMeta } = s.meta;
      const { [id]: _s, ...restStatus } = s.status;

      return {
        sources: s.sources.filter((f) => f.id !== id),
        articles: restArticles,
        meta: restMeta,
        status: restStatus,
      };
    });
  }, []);

  // ----------------------------------------------------------
  // refreshAll()
  // ----------------------------------------------------------
  const refreshAll = useCallback(async () => {
    await Promise.all(state.sources.map((f) => refresh(f)));
  }, [refresh, state.sources]);

  // ----------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------
  useEffect(() => {
    const refs = abortRefs.current;
    return () => {
      for (const ctrl of refs.values()) ctrl.abort();
      refs.clear();
    };
  }, []);

  return {
    sources: state.sources,
    articles: state.articles,
    meta: state.meta,
    status: state.status,
    refresh,
    refreshAll,
    addFeed,
    removeFeed,
  } as const;
}