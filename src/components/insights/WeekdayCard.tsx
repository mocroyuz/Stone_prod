// src/components/insights/WeekdayCard.tsx
// Activité par jour de la semaine : colonnes jumelées (réactions / commentaires),
// le jour le plus actif est en relief, les autres s'effacent.

import { useState } from "react";
import { CARD, CARD_TITLE, type Ink } from "./theme";

export type WeekdayRow = { day: string; a: number; b: number };

export default function WeekdayCard({
  title,
  subtitle,
  labelA,
  labelB,
  data,
  ink,
  locale,
}: {
  title: string;
  subtitle: string;
  labelA: string;
  labelB: string;
  data: WeekdayRow[];
  ink: Ink;
  locale: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const top = data.reduce((m, d, i) => (d.a + d.b > data[m].a + data[m].b ? i : m), 0);
  const focus = hover ?? top;
  const f = data[focus];
  const HEIGHT = 112;

  return (
    <section className={`p-4 md:p-5 ${CARD} ${ink.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={`${CARD_TITLE} ${ink.strong}`}>{title}</h2>
          <p className={`mt-0.5 text-[12px] ${ink.muted}`}>{subtitle}</p>
        </div>
        <div className={`flex shrink-0 flex-col items-end gap-1 text-[11px] ${ink.soft}`}>
          <span className="flex items-center gap-1.5">
            {labelA}
            <span className="h-2 w-2 rounded-[3px]" style={{ background: ink.ink }} />
          </span>
          <span className="flex items-center gap-1.5">
            {labelB}
            <span className="h-2 w-2 rounded-[3px]" style={{ background: ink.inkSoft }} />
          </span>
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-7 gap-1.5"
        onPointerLeave={() => setHover(null)}
      >
        {data.map((d, i) => {
          const on = i === focus;
          return (
            <div
              key={d.day}
              onPointerEnter={() => setHover(i)}
              className="flex flex-col items-center gap-2"
            >
              <div
                className="flex w-full items-end justify-center gap-[3px]"
                style={{ height: HEIGHT }}
                aria-label={`${d.day}: ${labelA} ${d.a}, ${labelB} ${d.b}`}
                role="img"
              >
                <span
                  className="w-full max-w-[14px] rounded-t-[5px] transition-opacity duration-200 motion-reduce:transition-none"
                  style={{
                    height: Math.max(3, (d.a / max) * HEIGHT),
                    background: ink.ink,
                    opacity: on ? 1 : 0.35,
                  }}
                />
                <span
                  className="w-full max-w-[14px] rounded-t-[5px] transition-opacity duration-200 motion-reduce:transition-none"
                  style={{
                    height: Math.max(3, (d.b / max) * HEIGHT),
                    background: ink.inkSoft,
                    opacity: on ? 1 : 0.6,
                  }}
                />
              </div>
              <span
                className={`text-[11px] font-medium ${on ? ink.strong : ink.muted}`}
              >
                {d.day}
              </span>
            </div>
          );
        })}
      </div>

      <p
        className={`mt-3 flex items-center justify-between gap-2 border-t pt-3 text-[12px] ${ink.hairline} ${ink.soft}`}
      >
        <span className={`font-semibold ${ink.strong}`}>{f.day}</span>
        <span className="tabular-nums">
          {labelA} {f.a.toLocaleString(locale)} · {labelB} {f.b.toLocaleString(locale)}
        </span>
      </p>
    </section>
  );
}
