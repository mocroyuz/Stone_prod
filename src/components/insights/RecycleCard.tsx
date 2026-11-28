// src/components/insights/RecycleCard.tsx
// Posts à refaire : liste numérotée (vignette, titre, chiffres, action).

import { Copy } from "lucide-react";
import type { Copy as CopyT, Lang, PostRow } from "./copy";
import { fmtFull, nf } from "./data";
import { PostThumb } from "./PostRow";
import { CARD, CARD_TITLE, type Ink } from "./theme";

export default function RecycleCard({
  posts,
  c,
  lang,
  ink,
  isDark,
  onDuplicate,
}: {
  posts: PostRow[];
  c: CopyT;
  lang: Lang;
  ink: Ink;
  isDark: boolean;
  onDuplicate: (p: PostRow) => void;
}) {
  return (
    <section className={`flex min-w-0 flex-col p-4 md:p-5 ${CARD} ${ink.card}`}>
      <h2 className={`${CARD_TITLE} ${ink.strong}`}>{c.recycle.title}</h2>
      <p className={`mt-0.5 text-[12px] ${ink.muted}`}>{c.recycle.subtitle}</p>

      {posts.length === 0 ? (
        <p
          className={`mt-4 rounded-xl border border-dashed px-4 py-8 text-center text-[12.5px] ${ink.hairline} ${ink.muted}`}
        >
          {c.recycle.emptyHint}
        </p>
      ) : (
        <ol className={`mt-3 divide-y ${isDark ? "divide-white/[0.07]" : "divide-black/[0.06]"}`}>
          {posts.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <span className={`w-5 shrink-0 text-[12px] font-semibold tabular-nums ${ink.muted}`}>
                {i + 1}
              </span>
              <PostThumb post={p} ink={ink} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13px] font-semibold ${ink.strong}`}>{p.label}</p>
                <p className={`truncate text-[11.5px] tabular-nums ${ink.muted}`}>
                  {c.recycle.engagement(p.reactions, String(p.engRate))} · {fmtFull(p.date, lang)}
                  {p.videoViews > 0 ? ` · ${nf(p.videoViews, lang)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDuplicate(p)}
                aria-label={c.performance.duplicatePost}
                title={c.recycle.duplicate.replace(/\s*→\s*$/, "")}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${ink.focus} ${ink.well} ${ink.hover} ${ink.soft}`}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
