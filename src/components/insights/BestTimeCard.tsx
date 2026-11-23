// src/components/insights/BestTimeCard.tsx
// « Meilleur moment pour publier » — graphique vertical : heures à gauche,
// jours en bas. Chaque jour est une colonne (piste de chaleur par heure) ;
// la fenêtre la plus active est une pilule en relief, la meilleure est en
// rose pâle. Survol/touch = heure précise, clic = programmer à ce créneau.

import { useState } from "react";
import { CalendarPlus, ChevronRight } from "lucide-react";
import type { Copy } from "./copy";
import { hourLabel, type BestTimes } from "./data";
import HourCurve from "./HourCurve";
import Segmented from "./Segmented";
import { CARD, CARD_TITLE, type Ink } from "./theme";

type Slot = { day: number; hour: number };

/** Heure la plus active d'un jour. */
function peakHour(row: { norm: number }[]) {
  let peak = 0;
  row.forEach((v, h) => {
    if (v.norm > row[peak].norm) peak = h;
  });
  return peak;
}

export default function BestTimeCard({
  heatmap,
  c,
  note,
  ink,
  isDark,
  isMobile,
  onSchedule,
}: {
  heatmap: BestTimes;
  c: Copy;
  note: string;
  ink: Ink;
  isDark: boolean;
  isMobile: boolean;
  onSchedule: (slot: Slot) => void;
}) {
  const peaks = c.days.map((_, d) => peakHour(heatmap.grid[d]));
  const overall = peaks.reduce(
    (m, h, d) => (heatmap.grid[d][h].norm > heatmap.grid[m][peaks[m]].norm ? d : m),
    0
  );
  const [sel, setSel] = useState<number | null>(null);
  const day = sel ?? overall;
  const best: Slot = { day: overall, hour: peaks[overall] };
  const bestDayLong = c.daysLong[best.day];

  return (
    <section className={`p-4 md:p-5 ${CARD} ${ink.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h2 className={`${CARD_TITLE} ${ink.strong}`}>{c.bestTime.title}</h2>
          <p className={`mt-0.5 max-w-[46ch] text-[12px] ${ink.muted}`}>
            {c.bestTime.answerSubline}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-left sm:text-right">
            <span
              className={`block text-[26px] font-semibold leading-none tracking-[-0.04em] ${ink.strong}`}
            >
              {bestDayLong} · {hourLabel(best.hour)}
            </span>
            <span className={`mt-1 block text-[11.5px] ${ink.muted}`}>{note}</span>
          </p>
          <button
            type="button"
            onClick={() => onSchedule(best)}
            aria-label={c.bestTime.scheduleAria(bestDayLong, hourLabel(best.hour))}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors md:h-9 md:text-[12.5px] ${ink.focus} ${ink.solid}`}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            {c.bestTime.scheduleCta(c.days[best.day], hourLabel(best.hour))}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Courbe + jours */}
        <div className="min-w-0">
          <HourCurve
            norms={Array.from({ length: 24 }, (_, h) => heatmap.grid[day][h].norm)}
            dayLabel={c.daysLong[day]}
            low={c.bestTime.low}
            high={c.bestTime.high}
            scheduleAria={c.bestTime.scheduleAria}
            height={isMobile ? 190 : 232}
            ink={ink}
            isDark={isDark}
            onSchedule={(hour) => onSchedule({ day, hour })}
          />
          <div className="mt-3">
            <Segmented
              stretch
              value={String(day)}
              onChange={(k) => setSel(Number(k))}
              ink={ink}
              isDark={isDark}
              label={c.bestTime.activityByDay}
              options={c.days.map((d, i) => ({
                key: String(i),
                label: d,
                ariaLabel: c.daysLong[i],
              }))}
            />
          </div>
          <p className={`mt-3 text-[11.5px] ${ink.muted}`}>{c.bestTime.pickHour}</p>
        </div>

        {/* Meilleurs créneaux */}
        <div className="min-w-0">
          <h3 className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${ink.muted}`}>
            {c.bestTime.bestOfDay}
          </h3>
          <ul className={`mt-2 divide-y ${isDark ? "divide-white/[0.07]" : "divide-black/[0.06]"}`}>
            {heatmap.recommendations.map((r, i) => (
              <li key={`${r.day}-${r.hour}`}>
                <button
                  type="button"
                  onClick={() => onSchedule({ day: r.day, hour: r.hour })}
                  aria-label={c.bestTime.scheduleAria(c.daysLong[r.day], hourLabel(r.hour))}
                  className={`group flex min-h-12 w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors ${ink.focus} ${ink.hover}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                      i === 0
                        ? ""
                        : `${isDark ? "bg-white/[0.07]" : "bg-black/[0.05]"} ${ink.soft}`
                    }`}
                    style={i === 0 ? { background: ink.accent, color: ink.accentInk } : undefined}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] font-semibold ${ink.strong}`}>
                      {c.daysLong[r.day]}
                    </span>
                    <span className={`block text-[12px] tabular-nums ${ink.muted}`}>
                      {hourLabel(r.hour)}
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${ink.muted}`}
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
