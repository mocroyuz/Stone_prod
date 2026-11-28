// src/components/insights/PostsCard.tsx
// Tableau des posts : recherche, période, tri par colonne, « tout afficher ».
// Desktop : grille 6 colonnes. Mobile : lignes empilées avec chiffres en ligne.

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Search } from "lucide-react";
import type { Copy as CopyT, Lang, PostRow, PostsPeriod, SortKey } from "./copy";
import { fmtFull, nf } from "./data";
import { PostThumb } from "./PostRow";
import Segmented from "./Segmented";
import { CARD, CARD_TITLE, type Ink } from "./theme";

const GRID = "md:grid-cols-[minmax(0,2.6fr)_repeat(4,minmax(0,1fr))_36px]";
const SORT_KEYS: SortKey[] = ["reactions", "comments", "engRate", "videoViews"];

export default function PostsCard({
  posts,
  previousPosts,
  hiddenScheduled,
  loading,
  c,
  lang,
  ink,
  isDark,
  onDuplicate,
  onShowLast30,
}: {
  posts: PostRow[];
  previousPosts: PostRow[];
  hiddenScheduled: number;
  loading: boolean;
  c: CopyT;
  lang: Lang;
  ink: Ink;
  isDark: boolean;
  onDuplicate: (p: PostRow) => void;
  onShowLast30: () => void;
}) {
  const [period, setPeriod] = useState<PostsPeriod>("this");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [all, setAll] = useState(false);

  const rows = useMemo(() => {
    const base = period === "this" ? posts : previousPosts;
    const q = query.trim().toLowerCase();
    const filtered = q ? base.filter((p) => p.label.toLowerCase().includes(q)) : base;
    if (!sort) return filtered;
    return [...filtered].sort((a, b) =>
      sort.dir === "desc" ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]
    );
  }, [period, posts, previousPosts, query, sort]);

  const visible = all ? rows : rows.slice(0, 6);
  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s?.key === key ? (s.dir === "desc" ? { key, dir: "asc" } : null) : { key, dir: "desc" }
    );

  const divide = isDark ? "divide-white/[0.07]" : "divide-black/[0.06]";
  const num = `text-right text-[12.5px] tabular-nums ${ink.strong}`;

  return (
    <section className={`min-w-0 overflow-hidden ${CARD} ${ink.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:px-5 md:pb-4 md:pt-5">
        <div className="min-w-0">
          <h2 className={`${CARD_TITLE} ${ink.strong}`}>{c.performance.title}</h2>
          <p className={`mt-0.5 text-[12px] ${ink.muted}`}>
            {c.performance.postsCount(rows.length)}
            {hiddenScheduled > 0 && ` · ${c.performance.hiddenScheduled(hiddenScheduled)}`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="relative w-full min-w-0 sm:w-[210px]">
            <Search
              className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${ink.muted}`}
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.performance.title}
              aria-label={c.performance.title}
              className={`h-9 w-full rounded-xl border pl-8 pr-3 text-[12.5px] outline-none transition-shadow ${ink.well} ${ink.strong} ${
                isDark
                  ? "placeholder:text-neutral-600 focus:ring-2 focus:ring-white/25"
                  : "placeholder:text-neutral-500 focus:ring-2 focus:ring-black/20"
              }`}
            />
          </label>
          <Segmented
            value={period}
            onChange={setPeriod}
            ink={ink}
            isDark={isDark}
            label={c.performance.periodAria}
            options={[
              { key: "this", label: c.performance.periodThis },
              { key: "previous", label: c.performance.periodPrevious },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={`border-t px-5 py-12 text-center ${ink.hairline}`}>
          <p className={`text-[13px] ${ink.muted}`}>
            {loading
              ? c.performance.emptyLoading
              : query
                ? c.performance.emptyNoMatch
                : c.performance.emptyNoPost}
          </p>
          {!query && !loading && (
            <button
              type="button"
              onClick={onShowLast30}
              className={`mt-3 h-9 rounded-xl border px-3.5 text-[12.5px] font-semibold ${ink.focus} ${ink.well} ${ink.hover} ${ink.strong}`}
            >
              {c.performance.showLast30Days}
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className={`hidden border-y px-5 text-[11px] font-medium md:grid ${GRID} ${ink.hairline} ${ink.muted}`}
          >
            <span className="py-2.5">Post</span>
            {SORT_KEYS.map((k) => {
              const on = sort?.key === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleSort(k)}
                  aria-label={c.performance.sortBy(c.performance.columns[k])}
                  className={`flex items-center justify-end gap-1 py-2.5 text-right transition-colors ${ink.focus} ${
                    on ? ink.strong : isDark ? "hover:text-neutral-300" : "hover:text-neutral-700"
                  }`}
                >
                  {c.performance.columns[k]}
                  {on &&
                    (sort.dir === "desc" ? (
                      <ArrowDown className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ArrowUp className="h-3 w-3" aria-hidden="true" />
                    ))}
                </button>
              );
            })}
            <span />
          </div>

          <ul className={`divide-y border-t md:border-t-0 ${divide} ${ink.hairline}`}>
            {visible.map((p, i) => {
              const top = i === 0 && !sort && period === "this";
              return (
                <li key={p.id}>
                  <div className={`relative grid items-center gap-x-3 px-4 py-3 max-md:pr-14 md:px-5 ${GRID}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <PostThumb post={p} ink={ink} size={40} />
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center gap-2">
                          <span className={`truncate text-[13px] font-semibold ${ink.strong}`}>
                            {p.label}
                          </span>
                          {top && (
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                isDark ? "bg-white/[0.10] text-white" : "bg-neutral-900 text-white"
                              }`}
                            >
                              {c.performance.top}
                            </span>
                          )}
                        </p>
                        <p className={`text-[11.5px] ${ink.muted}`}>{fmtFull(p.date, lang)}</p>
                      </div>
                    </div>

                    {/* mobile : chiffres en ligne sous le titre */}
                    <dl
                      className={`col-span-full mt-2 grid grid-cols-4 gap-2 md:hidden`}
                    >
                      {SORT_KEYS.map((k) => (
                        <div key={k} className="min-w-0">
                          <dt className={`truncate text-[10.5px] ${ink.muted}`}>
                            {c.performance.columns[k]}
                          </dt>
                          <dd className={`text-[12.5px] font-semibold tabular-nums ${ink.strong}`}>
                            {k === "engRate" ? `${p.engRate}%` : nf(p[k], lang)}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <span className={`hidden md:block ${num}`}>{nf(p.reactions, lang)}</span>
                    <span className={`hidden md:block ${num}`}>{nf(p.comments, lang)}</span>
                    <span className={`hidden md:block ${num}`}>{p.engRate}%</span>
                    <span className={`hidden md:block ${num}`}>{nf(p.videoViews, lang)}</span>

                    <div className="absolute right-4 top-3 md:static md:flex md:justify-end">
                      {p.platform === "youtube" ? (
                        <a
                          href={`https://youtube.com/watch?v=${encodeURIComponent(p.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={c.performance.openYouTube}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${ink.focus} ${ink.hover} ${ink.soft}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDuplicate(p)}
                          aria-label={c.performance.duplicatePost}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${ink.focus} ${ink.hover} ${ink.soft}`}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {rows.length > 6 && (
            <div className={`border-t p-3 text-center ${ink.hairline}`}>
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className={`h-9 rounded-lg px-3 text-[12.5px] font-semibold ${ink.focus} ${ink.hover} ${ink.strong}`}
              >
                {all ? c.performance.showLess : c.performance.showMore(rows.length)}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
