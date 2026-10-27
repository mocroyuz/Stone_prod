// src/components/FeedsPanel.tsx

// Onglet "Feeds" de la page Create. Design aligné sur Home :
// surfaces beiges (panelSurface), cartes (card), textes 10–12px, sections « titre + meta ».

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Plus,
  RefreshCw,
  Rss,
  X as XIcon,
} from "lucide-react";

/* ============================================================
   TOKENS (identiques à Home)
   ============================================================ */

const cardClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#141416]"
    : "border-black/[0.06] bg-white";

const panelSurfaceClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-white/[0.03]"
    : "border-black/[0.06] bg-[#f6f4f0]";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-600" : "text-neutral-400";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ============================================================
   TYPES
   ============================================================ */

type Feed = { id: string; url: string; title: string; siteUrl: string };

type Article = {
  id: string;
  feedId: string;
  title: string;
  link: string;
  date: number; // timestamp ms (0 si inconnu)
  summary: string;
  imageUrl?: string;
};

type Status = "loading" | "ok" | "error";

const STORAGE_KEY = "create.feeds.v1";
const ALL = "all";
const MAX_PER_FEED = 30;
const MAX_ALL = 80;

const DEFAULT_FEEDS: Feed[] = [
  {
    id: "https://www.theverge.com/rss/index.xml",
    url: "https://www.theverge.com/rss/index.xml",
    title: "The Verge",
    siteUrl: "https://www.theverge.com",
  },
  {
    id: "https://techcrunch.com/feed/",
    url: "https://techcrunch.com/feed/",
    title: "TechCrunch",
    siteUrl: "https://techcrunch.com",
  },
];

/* ============================================================
   FETCH + PARSING
   ============================================================ */

/**
 * Endpoint serveur auto-détecté :
 *  - VITE_FEED_ENDPOINT si défini (recommandé)
 *  - sinon dérivé de VITE_API_BASE_URL (route /api/feed, publique)
 *  - sinon undefined → les proxies publics sont utilisés en secours
 */
const FEED_ENDPOINT: string | undefined = (() => {
  const explicit = import.meta.env.VITE_FEED_ENDPOINT;
  if (explicit) return explicit;

  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase) {
    return `${apiBase.replace(/\/+$/, "").replace(/\/api$/i, "")}/api/feed`;
  }
  return undefined;
})();

/**
 * Les navigateurs bloquent la plupart des flux RSS (CORS). On tente :
 *  1) notre route serveur /api/feed (publique, SSRF-safe, rate limitée)
 *  2) rss2json (JSON, CORS ouvert)
 *  3) proxys publics (peuvent être bloqués par un ad-blocker / firewall)
 */
const XML_PROXIES: ((u: string) => string)[] = [
  ...(FEED_ENDPOINT
    ? [
        (u: string) =>
          `${FEED_ENDPOINT}?url=${encodeURIComponent(u)}`,
      ]
    : []),
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

/** fetch avec timeout + propagation d'un éventuel signal parent. */
async function fetchWithTimeout(
  url: string,
  parentSignal?: AbortSignal,
  timeoutMs = 12_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const abortParent = () => controller.abort();
  if (parentSignal?.aborted) abortParent();
  else parentSignal?.addEventListener("abort", abortParent, { once: true });

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortParent);
  }
}

/** Tente chaque proxy XML dans l'ordre. Retourne le premier corps RSS/Atom valide. */
async function fetchXml(url: string, signal?: AbortSignal): Promise<string> {
  let lastError: unknown = new Error("Aucun proxy n'a pu récupérer le flux.");

  for (const proxy of XML_PROXIES) {
    const endpoint = proxy(url);
    try {
      const res = await fetchWithTimeout(endpoint, signal, 12_000);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const body = await res.text();
      const doc = new DOMParser().parseFromString(body, "application/xml");

      if (doc.querySelector("parsererror")) {
        throw new Error("La réponse n'est pas un XML valide.");
      }

      const root = doc.documentElement?.localName?.toLowerCase();
      if (["rss", "feed", "rdf"].includes(root)) return body;

      throw new Error(
        `Le contenu reçu n'est pas un flux RSS/Atom (racine : ${root || "inconnue"}).`
      );
    } catch (e) {
      if ((e as Error)?.name === "AbortError" && signal?.aborted) throw e;
      console.warn(`[Feeds] Proxy échoué : ${endpoint}`, e);
      lastError = e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const textOf = (el: Element | null | undefined) =>
  el?.textContent?.trim() ?? "";

/** Premier enfant direct portant ce nom (gère les namespaces). */
function child(parent: Element, name: string): Element | null {
  for (const c of Array.from(parent.children)) {
    if (c.tagName === name || c.localName === name) return c;
  }
  return null;
}

function htmlToText(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Rend une URL d'image utilisable : absolue, en https (sinon bloquée en mixed content). */
function normalizeUrl(src: string | null | undefined, base?: string): string | undefined {
  const s = src?.trim();
  if (!s || s.startsWith("data:")) return undefined;

  try {
    const u = new URL(s.startsWith("//") ? `https:${s}` : s, base);
    if (!/^https?:$/.test(u.protocol)) return undefined;
    u.protocol = "https:";
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Première vraie image d'un contenu HTML (ignore les pixels de tracking). */
function firstImage(html: string, base?: string): string | undefined {
  if (!html) return undefined;
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const w = Number(img.getAttribute("width"));
    if (w && w < 50) continue;

    const srcset = img
      .getAttribute("srcset")
      ?.split(",")[0]
      ?.trim()
      .split(/\s+/)[0];

    const url = normalizeUrl(
      img.getAttribute("src") || img.getAttribute("data-src") || srcset,
      base
    );
    if (url) return url;
  }
  return undefined;
}

function parseFeed(xml: string, feedUrl: string) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid XML");

  const root = doc.documentElement;
  const isAtom = root.localName === "feed";

  let title = "";
  let siteUrl = "";
  let entries: Element[] = [];

  if (isAtom) {
    title = textOf(child(root, "title"));
    const links = Array.from(root.children).filter((c) => c.localName === "link");
    const alt = links.find(
      (l) => (l.getAttribute("rel") ?? "alternate") === "alternate"
    );
    siteUrl = alt?.getAttribute("href") ?? "";
    entries = Array.from(root.children).filter((c) => c.localName === "entry");
  } else {
    const channel = child(root, "channel") ?? root;
    title = textOf(child(channel, "title"));
    siteUrl = textOf(child(channel, "link"));
    entries = Array.from(doc.getElementsByTagName("item"));
  }

  const articles: Omit<Article, "feedId">[] = entries.slice(0, MAX_PER_FEED).map((e) => {
    let link = "";
    let rawHtml = "";
    let dateStr = "";
    let imageUrl: string | undefined;

    if (isAtom) {
      const links = Array.from(e.children).filter((c) => c.localName === "link");
      link =
        (links.find((l) => (l.getAttribute("rel") ?? "alternate") === "alternate") ??
          links[0])?.getAttribute("href") ?? "";
      rawHtml = textOf(child(e, "content")) || textOf(child(e, "summary"));
      dateStr = textOf(child(e, "published")) || textOf(child(e, "updated"));
    } else {
      link = textOf(child(e, "link"));
      rawHtml = textOf(child(e, "encoded")) || textOf(child(e, "description"));
      dateStr = textOf(child(e, "pubDate")) || textOf(child(e, "date"));
    }

    // Image : enclosure, media:thumbnail / media:content, sinon 1re <img> du contenu.
    const enclosure = child(e, "enclosure");
    if (enclosure?.getAttribute("type")?.startsWith("image")) {
      imageUrl = normalizeUrl(enclosure.getAttribute("url"));
    }

    if (!imageUrl) {
      const nodes = Array.from(e.getElementsByTagName("*"));
      const media =
        nodes.find((n) => n.localName === "thumbnail" && n.getAttribute("url")) ??
        nodes.find((n) => {
          const u = n.getAttribute("url");
          return (
            n.localName === "content" &&
            !!u &&
            (n.getAttribute("medium") === "image" ||
              n.getAttribute("type")?.startsWith("image") ||
              /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u))
          );
        });
      imageUrl = normalizeUrl(media?.getAttribute("url"));
    }

    if (!imageUrl && isAtom) {
      const enc = Array.from(e.children).find(
        (c) =>
          c.localName === "link" &&
          c.getAttribute("rel") === "enclosure" &&
          c.getAttribute("type")?.startsWith("image")
      );
      imageUrl = normalizeUrl(enc?.getAttribute("href"));
    }

    if (!imageUrl) imageUrl = firstImage(rawHtml, link || feedUrl);

    const parsed = Date.parse(dateStr);
    const summary = htmlToText(rawHtml);

    return {
      id: link || `${feedUrl}#${textOf(child(e, "title"))}`,
      title: htmlToText(textOf(child(e, "title"))) || "Untitled",
      link,
      date: Number.isNaN(parsed) ? 0 : parsed,
      summary:
        summary.length > 200
          ? `${summary.slice(0, 200).trimEnd()}…`
          : summary,
      imageUrl,
    };
  });

  return { title, siteUrl, articles };
}

type LoadedFeed = {
  title: string;
  siteUrl: string;
  articles: Omit<Article, "feedId">[];
};

/**
 * rss2json : renvoie le flux déjà converti en JSON, avec CORS activé.
 *
 *  - `count` limite le nombre d'articles
 *  - `VITE_RSS2JSON_KEY` optionnelle (lève la limite du plan gratuit)
 *  - 2 tentatives pour absorber un hoquet réseau
 */
async function fetchViaRss2Json(url: string, signal?: AbortSignal): Promise<LoadedFeed> {
  const params = new URLSearchParams({
    rss_url: url,
    count: String(MAX_PER_FEED),
  });

  const apiKey = import.meta.env.VITE_RSS2JSON_KEY;
  if (apiKey) params.set("api_key", apiKey);

  const endpoint = `https://api.rss2json.com/v1/api.json?${params.toString()}`;

  let res: Response | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetchWithTimeout(endpoint, signal, 12_000);
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
  if (!res.ok) throw new Error(`rss2json HTTP ${res.status}`);

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

  const articles = data.items.slice(0, MAX_PER_FEED).map((it) => {
    const html = it.content || it.description || "";
    const summary = htmlToText(it.description || it.content || "");
    // rss2json renvoie des dates "YYYY-MM-DD HH:mm:ss" en UTC.
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

/** Essaie rss2json, puis les proxys XML. Lève une erreur détaillée si tout échoue. */
async function loadFeed(url: string, signal?: AbortSignal): Promise<LoadedFeed> {
  const errors: string[] = [];

  // 1) Endpoint serveur en priorité s'il est configuré.
  if (FEED_ENDPOINT) {
    try {
      const xml = await fetchXml(url, signal);
      return parseFeed(xml, url);
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      errors.push(`endpoint: ${(e as Error).message}`);
    }
  }

  // 2) rss2json.
  try {
    return await fetchViaRss2Json(url, signal);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    errors.push(`rss2json: ${(e as Error).message}`);
  }

  // 3) Proxys publics.
  try {
    const xml = await fetchXml(url, signal);
    return parseFeed(xml, url);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    errors.push(`proxies: ${(e as Error).message}`);
  }

  console.warn(`[Feeds] Could not load ${url}`, errors);
  throw new Error(errors.join(" | "));
}

/* ============================================================
   UTILS
   ============================================================ */

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const faviconOf = (siteUrl: string) =>
  `https://www.google.com/s2/favicons?domain=${hostOf(siteUrl)}&sz=64`;

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function timeAgo(ts: number): string {
  if (!ts) return "";
  let value = (ts - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  for (const [step, unit] of steps) {
    if (Math.abs(value) < step) return rtf.format(Math.round(value), unit);
    value /= step;
  }
  return "";
}

function loadFeeds(): Feed[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Feed[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_FEEDS;
}

/* ============================================================
   LOGO
   ============================================================ */

function Logo({ feed, isDark, size = 20 }: { feed: Feed; isDark: boolean; size?: number }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [feed.siteUrl]);

  const letter = (feed.title || hostOf(feed.siteUrl) || "?").charAt(0).toUpperCase();

  if (failed) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={[
          "flex shrink-0 items-center justify-center rounded-md text-[10px] font-semibold",
          isDark ? "bg-white/[0.10] text-white" : "bg-neutral-200 text-neutral-700",
        ].join(" ")}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={faviconOf(feed.siteUrl || feed.url)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-md bg-white object-contain"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

/* ============================================================
   FEED PILL (sélecteur de blog)
   ============================================================ */

function FeedPill({
  isDark,
  active,
  onClick,
  onRemove,
  removeLabel,
  hasError,
  children,
}: {
  isDark: boolean;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  hasError?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="group/pill relative inline-flex shrink-0">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={[
          "flex items-center gap-2 rounded-xl border py-1.5 pl-2.5 text-[11px] font-semibold transition",
          onRemove ? "pr-7" : "pr-3",
          focusRingClass(isDark),
          active
            ? isDark
              ? "border-white bg-white text-black"
              : "border-neutral-900 bg-neutral-900 text-white"
            : isDark
              ? "border-white/[0.07] bg-[#141416] text-neutral-300 hover:bg-[#1a1a1d]"
              : "border-black/[0.06] bg-white text-neutral-700 hover:bg-neutral-50",
        ].join(" ")}
      >
        {children}
        {hasError && (
          <span
            title="Couldn't load this feed"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500"
          />
        )}
      </button>

      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className={[
            "absolute right-1.5 top-1/2 flex h-4.5 w-4.5 -translate-y-1/2 items-center justify-center rounded-md p-0.5",
            "opacity-0 transition focus-visible:opacity-100 group-hover/pill:opacity-100 [@media(hover:none)]:opacity-100",
            focusRingClass(isDark),
            active
              ? isDark
                ? "hover:bg-black/10"
                : "hover:bg-white/20"
              : isDark
                ? "hover:bg-white/10"
                : "hover:bg-black/[0.06]",
          ].join(" ")}
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/* ============================================================
   ARTICLE IMAGE (même fallback que BlogImage)
   ============================================================ */

function ArticleImage({ src, isDark }: { src?: string; isDark: boolean }) {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [src]);

  if (!src || attempt >= 2) {
    return (
      <div
        className={[
          "h-[140px] w-full rounded-xl",
          isDark ? "bg-white/[0.06]" : "bg-neutral-200/70",
        ].join(" ")}
      />
    );
  }

  return (
    <img
      key={attempt}
      src={
        attempt === 0
          ? src
          : `https://images.weserv.nl/?url=${encodeURIComponent(
              src.replace(/^https?:\/\//, "")
            )}&w=640&output=jpg`
      }
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setAttempt((a) => a + 1)}
      className="h-[140px] w-full rounded-xl object-cover"
    />
  );
}

/* ============================================================
   ARTICLE CARD (même structure que les cartes « From the Blog »)
   ============================================================ */

function ArticleCard({
  isDark,
  article,
  feed,
}: {
  isDark: boolean;
  article: Article;
  feed?: Feed;
}) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noreferrer"
      className={[
        "group flex flex-col rounded-2xl border p-3.5 transition",
        focusRingClass(isDark),
        cardClass(isDark),
        isDark ? "hover:bg-[#1a1a1d]" : "hover:bg-[#f6f4f0]",
      ].join(" ")}
    >
      <ArticleImage src={article.imageUrl} isDark={isDark} />

      <div className="mt-3.5 flex items-center justify-between gap-2 px-0.5">
        {feed ? (
          <span
            className={[
              "flex min-w-0 items-center gap-1.5 rounded-md py-0.5 pl-1 pr-2 text-[10px] font-semibold",
              isDark ? "bg-white/[0.06] text-neutral-300" : "bg-neutral-100 text-neutral-700",
            ].join(" ")}
          >
            <Logo feed={feed} isDark={isDark} size={14} />
            <span className="truncate">{feed.title}</span>
          </span>
        ) : (
          <span />
        )}
        <span className={["shrink-0 text-[10px]", mutedClass(isDark)].join(" ")}>
          {timeAgo(article.date)}
        </span>
      </div>

      <h3
        className={[
          "mt-2.5 px-0.5 text-[14px] font-semibold leading-snug tracking-[-0.01em]",
          strongClass(isDark),
        ].join(" ")}
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {article.title}
      </h3>

      {article.summary && (
        <p
          className={[
            "mt-1.5 px-0.5 text-[11px] leading-relaxed",
            isDark ? "text-neutral-500" : "text-neutral-500",
          ].join(" ")}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {article.summary}
        </p>
      )}

      <div className="mt-3 flex justify-end px-0.5">
        <ArrowRight
          className={[
            "h-4 w-4 transition-transform group-hover:translate-x-0.5",
            strongClass(isDark),
          ].join(" ")}
        />
      </div>
    </a>
  );
}

/* ============================================================
   EMPTY STATE (même rendu que Panel de Home)
   ============================================================ */

function EmptyState({
  isDark,
  line1,
  line2,
}: {
  isDark: boolean;
  line1: string;
  line2: string;
}) {
  return (
    <div
      className={[
        "flex min-h-[190px] flex-col items-center justify-center",
        "gap-1 rounded-2xl border px-4 py-6 text-center",
        panelSurfaceClass(isDark),
      ].join(" ")}
    >
      <div
        className={[
          "mb-2 flex h-11 w-11 items-center justify-center rounded-full",
          isDark ? "bg-white/[0.07] text-neutral-300" : "bg-neutral-200/70 text-neutral-600",
        ].join(" ")}
      >
        <Rss className="h-5 w-5" />
      </div>
      <p className={["text-[12px] font-medium", strongClass(isDark)].join(" ")}>{line1}</p>
      <p className="max-w-[360px] text-[12px] text-neutral-500">{line2}</p>
    </div>
  );
}

/* ============================================================
   FEEDS PANEL
   ============================================================ */

export default function FeedsPanel({ isDark }: { isDark: boolean }) {
  const [feeds, setFeeds] = useState<Feed[]>(loadFeeds);
  const [articles, setArticles] = useState<Record<string, Article[]>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [selected, setSelected] = useState<string>(ALL);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds));
    } catch {
      /* ignore */
    }
  }, [feeds]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  /** Recharge une liste de flux en parallèle, sans recharger la page. */
  const refresh = useCallback(async (list: Feed[]) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus((s) => {
      const next = { ...s };
      list.forEach((f) => (next[f.id] = "loading"));
      return next;
    });

    await Promise.all(
      list.map(async (f) => {
        try {
          const parsed = await loadFeed(f.url, ctrl.signal);
          if (ctrl.signal.aborted) return;

          setArticles((a) => ({
            ...a,
            [f.id]: parsed.articles.map((x) => ({ ...x, feedId: f.id })),
          }));
          setStatus((s) => ({ ...s, [f.id]: "ok" }));
        } catch (e) {
          if (ctrl.signal.aborted) return;
          setStatus((s) => ({ ...s, [f.id]: "error" }));
          console.warn(`[Feeds] Refresh failed for ${f.url}`, e);
        }
      })
    );

    if (!ctrl.signal.aborted) setLastRefresh(Date.now());
  }, []);

  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;

  useEffect(() => {
    void refresh(feedsRef.current);
    return () => abortRef.current?.abort();
  }, [refresh]);

  const addFeed = async () => {
    const raw = url.trim();
    if (!raw || adding) return;

    let normalized: string;
    try {
      normalized = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString();
    } catch {
      setError("This doesn't look like a valid URL.");
      return;
    }
    if (feeds.some((f) => f.url === normalized)) {
      setError("This feed is already added.");
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const parsed = await loadFeed(normalized);
      const siteUrl = parsed.siteUrl || new URL(normalized).origin;
      const feed: Feed = {
        id: normalized,
        url: normalized,
        title: parsed.title || hostOf(siteUrl) || normalized,
        siteUrl,
      };
      setFeeds((prev) => [...prev, feed]);
      setArticles((a) => ({
        ...a,
        [feed.id]: parsed.articles.map((x) => ({ ...x, feedId: feed.id })),
      }));
      setStatus((s) => ({ ...s, [feed.id]: "ok" }));
      setUrl("");
      setSelected(feed.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[Feeds] Échec de l'ajout du flux :", {
        url: normalized,
        error: e,
        name: e instanceof Error ? e.name : undefined,
        message,
        feedEndpoint: FEED_ENDPOINT,
      });
      setError(
        `Could not load this feed (${message}). If this keeps happening:\n` +
          `• disable ad-blockers / privacy extensions for this page\n` +
          `• check that the URL is a real RSS/Atom feed\n` +
          (FEED_ENDPOINT
            ? `• try again in a moment`
            : `• set VITE_FEED_ENDPOINT (e.g. https://your-api.example.com/api/feed) so the request goes through your own server`)
      );
    } finally {
      setAdding(false);
    }
  };

  const removeFeed = (id: string) => {
    setFeeds((prev) => prev.filter((f) => f.id !== id));
    setArticles((a) => {
      const { [id]: _removed, ...rest } = a;
      return rest;
    });
    setStatus((s) => {
      const { [id]: _removed, ...rest } = s;
      return rest;
    });
    if (selected === id) setSelected(ALL);
  };

  const feedById = useMemo(() => new Map(feeds.map((f) => [f.id, f])), [feeds]);

  const visible = useMemo(() => {
    const pool =
      selected === ALL
        ? feeds.flatMap((f) => articles[f.id] ?? [])
        : articles[selected] ?? [];
    const sorted = [...pool].sort((a, b) => b.date - a.date);
    return selected === ALL ? sorted.slice(0, MAX_ALL) : sorted;
  }, [articles, feeds, selected]);

  const currentFeeds = selected === ALL ? feeds : feeds.filter((f) => f.id === selected);
  const refreshing = currentFeeds.some((f) => status[f.id] === "loading");
  const failed = currentFeeds.filter((f) => status[f.id] === "error");
  const initialLoading = refreshing && visible.length === 0;
  const selectedFeed = selected === ALL ? null : feedById.get(selected);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex flex-col pb-[120px]">
        {/* SOURCES */}
        <section className="shrink-0">
          <div className="mb-3">
            <p
              className={[
                "text-[11px] font-semibold",
                isDark ? "text-neutral-500" : "text-neutral-400",
              ].join(" ")}
            >
              Sources
            </p>
            <p
              className={[
                "mt-0.5 text-[11px]",
                isDark ? "text-neutral-400" : "text-neutral-500",
              ].join(" ")}
            >
              Follow blogs and read their latest posts in one place
            </p>
          </div>

          <div
            className={[
              "flex flex-col gap-3 rounded-2xl border p-4",
              panelSurfaceClass(isDark),
            ].join(" ")}
          >
            {/* Ajout d'un flux */}
            <div>
              <div
                className={[
                  "flex max-w-[620px] items-center gap-1 rounded-xl border pl-3 pr-1.5",
                  error
                    ? isDark
                      ? "border-rose-400/60"
                      : "border-rose-500/60"
                    : isDark
                      ? "border-white/[0.10] bg-[#141416]"
                      : "border-black/[0.08] bg-white",
                ].join(" ")}
              >
                <Rss className={["h-3.5 w-3.5 shrink-0", mutedClass(isDark)].join(" ")} />
                <input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addFeed();
                    }
                  }}
                  placeholder="Paste a blog feed URL (RSS / Atom)…"
                  aria-label="Feed URL"
                  aria-invalid={!!error}
                  inputMode="url"
                  className={[
                    "min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[12px] outline-none",
                    strongClass(isDark),
                    isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400",
                  ].join(" ")}
                />
                <button
                  type="button"
                  onClick={() => void addFeed()}
                  disabled={!url.trim() || adding}
                  className={[
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                    "disabled:cursor-default disabled:opacity-30",
                    focusRingClass(isDark),
                    isDark ? "bg-white text-black" : "bg-neutral-900 text-white",
                  ].join(" ")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {adding ? "Adding…" : "Add feed"}
                </button>
              </div>
              {error && (
                <p
                  role="alert"
                  className={[
                    "mt-1.5 whitespace-pre-line px-1 text-[11px] leading-relaxed",
                    isDark ? "text-rose-400" : "text-rose-600",
                  ].join(" ")}
                >
                  {error}
                </p>
              )}
            </div>

            {/* Sélecteur de blog */}
            <div
              role="group"
              aria-label="Filter by blog"
              className="-mb-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <FeedPill isDark={isDark} active={selected === ALL} onClick={() => setSelected(ALL)}>
                <Rss className="h-3.5 w-3.5" />
                All feeds
                <span
                  className={[
                    "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                    selected === ALL
                      ? isDark
                        ? "bg-black/10"
                        : "bg-white/20"
                      : isDark
                        ? "bg-white/[0.06]"
                        : "bg-black/[0.05]",
                  ].join(" ")}
                >
                  {feeds.length}
                </span>
              </FeedPill>

              {feeds.map((f) => (
                <FeedPill
                  key={f.id}
                  isDark={isDark}
                  active={selected === f.id}
                  onClick={() => setSelected(f.id)}
                  onRemove={() => removeFeed(f.id)}
                  removeLabel={`Remove ${f.title}`}
                  hasError={status[f.id] === "error"}
                >
                  <Logo feed={f} isDark={isDark} size={16} />
                  <span className="max-w-[150px] truncate">{f.title}</span>
                </FeedPill>
              ))}
            </div>
          </div>
        </section>

        {/* ARTICLES */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p
              className={[
                "min-w-0 truncate text-[12px] font-semibold",
                isDark ? "text-neutral-300" : "text-neutral-700",
              ].join(" ")}
            >
              {selectedFeed ? selectedFeed.title : "Latest articles"}
              <span className={["ml-1.5 font-normal", mutedClass(isDark)].join(" ")}>
                · {visible.length} {visible.length === 1 ? "article" : "articles"}
                {lastRefresh && !refreshing ? ` · updated ${timeAgo(lastRefresh)}` : ""}
              </span>
            </p>

            <button
              type="button"
              onClick={() => void refresh(currentFeeds)}
              disabled={refreshing || currentFeeds.length === 0}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-md text-[11px] font-semibold transition",
                focusRingClass(isDark),
                "disabled:cursor-default disabled:opacity-40",
                isDark
                  ? "text-neutral-400 enabled:hover:text-white"
                  : "text-neutral-500 enabled:hover:text-neutral-900",
              ].join(" ")}
            >
              <RefreshCw
                className={["h-3.5 w-3.5", refreshing ? "animate-spin" : ""].join(" ")}
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {failed.length > 0 && (
            <p
              role="status"
              className={[
                "mb-3 rounded-xl border px-3.5 py-2.5 text-[11px] font-medium",
                isDark
                  ? "border-rose-400/25 bg-rose-400/[0.06] text-rose-300"
                  : "border-rose-500/20 bg-rose-50 text-rose-700",
              ].join(" ")}
            >
              Couldn't load {failed.map((f) => f.title).join(", ")}. Try again with Refresh.
            </p>
          )}

          {feeds.length === 0 ? (
            <EmptyState
              isDark={isDark}
              line1="No feeds yet."
              line2="Paste the RSS URL of a blog above, for example https://techcrunch.com/feed/"
            />
          ) : initialLoading ? (
            <div
              aria-busy="true"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={[
                    "h-[270px] animate-pulse rounded-2xl border motion-reduce:animate-none",
                    cardClass(isDark),
                  ].join(" ")}
                />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              isDark={isDark}
              line1="No articles to show."
              line2="Try refreshing, or check that this feed still publishes posts."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visible.map((a) => (
                <ArticleCard
                  key={`${a.feedId}:${a.id}`}
                  isDark={isDark}
                  article={a}
                  feed={feedById.get(a.feedId)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}