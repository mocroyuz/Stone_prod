// src/components/insights/BestTimeCard.tsx
// « Meilleur moment pour publier » — graphique vertical : heures à gauche,
// jours en bas. Chaque jour est une colonne (piste de chaleur par heure) ;
// la fenêtre la plus active est une pilule en relief, la meilleure est en
// accent. Survol/touch = heure précise, clic = programmer à ce créneau.

import { useRef, useState } from "react";
import { CalendarPlus, ChevronRight } from "lucide-react";
import type { Copy } from "./copy";
import { hourLabel, type BestTimes } from "./data";
import { CARD, CARD_TITLE, type Ink } from "./theme";

const FIRST_HOUR = 6;
const LAST_HOUR = 24; // exclu : la dernière cellule est 23:00
const HOURS = LAST_HOUR - FIRST_HOUR;
const MAX_WINDOW = 4;
const MIN_PILL = 44;
const TICKS = [6, 9, 12, 15, 18, 21, 24];

type Slot = { day: number; hour: number };

/** Meilleure heure visible d'un jour + fenêtre contiguë ≥ 80 % du pic. */
function bestWindow(row: { norm: number }[]) {
  let peak = FIRST_HOUR;
  for (let h = FIRST_HOUR; h < LAST_HOUR; h++) {
    if (row[h].norm > row[peak].norm) peak = h;
  }
  const floor = row[peak].norm * 0.8;
  let from = peak;
  let to = peak;
  while (to - from + 1 < MAX_WINDOW) {
    const left = from - 1 >= FIRST_HOUR && row[from - 1].norm >= floor ? row[from - 1].norm : -1;
    const right = to + 1 < LAST_HOUR && row[to + 1].norm >= floor ? row[to + 1].norm : -1;
    if (left < 0 && right < 0) break;
    if (right >= left) to += 1;
    else from -= 1;
  }
  return { peak, from, to, norm: row[peak].norm };
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
  const plot = isMobile ? 208 : 248;
  const cell = plot / HOURS;
  const [hover, setHover] = useState<Slot | null>(null);
  const cols = useRef<(HTMLDivElement | null)[]>([]);

  const windows = c.days.map((_, d) => bestWindow(heatmap.grid[d]));
  const overall = windows.reduce((m, w, d) => (w.norm > windows[m].norm ? d : m), 0);
  const best: Slot = { day: overall, hour: windows[overall].peak };
  const bestDayLong = c.daysLong[best.day];

  const hourAt = (e: { clientY: number }, day: number) => {
    const el = cols.current[day];
    if (!el) return FIRST_HOUR;
    const r = el.getBoundingClientRect();
    const rel = (e.clientY - r.top) / r.height;
    return Math.max(FIRST_HOUR, Math.min(LAST_HOUR - 1, FIRST_HOUR + Math.floor(rel * HOURS)));
  };

  const heat = (norm: number) =>
    isDark ? `rgba(255,255,255,${0.03 + 0.24 * norm})` : `rgba(0,0,0,${0.03 + 0.2 * norm})`;

  const level = (norm: number) =>
    norm >= 0.66 ? c.bestTime.high : norm <= 0.25 ? c.bestTime.low : "";

  const hoverCell = hover ? heatmap.grid[hover.day][hover.hour] : null;

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
          <p className="text-right">
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
        {/* Graphique */}
        <div>
          <div className="flex">
            {/* axe des heures */}
            <div
              className="relative w-11 shrink-0"
              style={{ height: plot }}
              aria-hidden="true"
            >
              {TICKS.map((h) => (
                <span
                  key={h}
                  className={`absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums ${ink.muted}`}
                  style={{ top: (h - FIRST_HOUR) * cell }}
                >
                  {hourLabel(h % 24)}
                </span>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              {/* lignes repères */}
              {TICKS.map((h) => (
                <span
                  key={h}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed"
                  style={{ top: (h - FIRST_HOUR) * cell, borderColor: ink.grid }}
                />
              ))}

              <div
                className="relative grid grid-cols-7 gap-1.5 sm:gap-3"
                style={{ height: plot }}
                onPointerLeave={() => setHover(null)}
              >
                {c.days.map((day, d) => {
                  const w = windows[d];
                  const isBest = d === overall;
                  const top = (w.from - FIRST_HOUR) * cell;
                  const rawH = (w.to - w.from + 1) * cell;
                  const h = Math.max(MIN_PILL, rawH);
                  const pillTop = Math.max(0, Math.min(plot - h, top - (h - rawH) / 2));
                  const active = hover?.day === d;
                  return (
                    <div
                      key={day}
                      ref={(el) => {
                        cols.current[d] = el;
                      }}
                      className="relative mx-auto h-full w-full max-w-[44px] cursor-pointer overflow-hidden rounded-full"
                      onPointerMove={(e) => setHover({ day: d, hour: hourAt(e, d) })}
                      onClick={(e) => onSchedule({ day: d, hour: hourAt(e, d) })}
                    >
                      {/* piste de chaleur */}
                      <div className="absolute inset-0 flex flex-col">
                        {Array.from({ length: HOURS }, (_, i) => (
                          <span
                            key={i}
                            className="block flex-1"
                            style={{ background: heat(heatmap.grid[d][FIRST_HOUR + i].norm) }}
                          />
                        ))}
                      </div>

                      {/* pilule : meilleure fenêtre */}
                      <button
                        type="button"
                        aria-label={c.bestTime.scheduleAria(
                          c.daysLong[d],
                          hourLabel(w.peak)
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSchedule({ day: d, hour: w.peak });
                        }}
                        className={`absolute inset-x-0 rounded-full transition-[filter,opacity] duration-200 motion-reduce:transition-none ${ink.focus} ${
                          active ? "brightness-110" : ""
                        }`}
                        style={{
                          top: pillTop,
                          height: h,
                          background: isBest
                            ? ink.accent
                            : isDark
                              ? "#fff"
                              : "#171717",
                          opacity: isBest ? 1 : 0.28 + 0.5 * w.norm,
                          boxShadow: isBest
                            ? "0 6px 18px -6px " + ink.accent
                            : "none",
                        }}
                      />
                    </div>
                  );
                })}

                {/* repère horaire + infobulle */}
                {hover && hoverCell && (
                  <>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 border-t"
                      style={{
                        top: (hover.hour - FIRST_HOUR + 0.5) * cell,
                        borderColor: ink.inkSoft,
                      }}
                    />
                    <div
                      className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[12px] ${ink.float}`}
                      style={{
                        top: (hover.hour - FIRST_HOUR + 0.5) * cell,
                        left: `${((hover.day + 0.5) / 7) * 100}%`,
                        transform: `translate(${hover.day > 4 ? "-108%" : "8%"}, ${
                          hover.hour - FIRST_HOUR > HOURS - 3 ? "-110%" : "-10%"
                        })`,
                      }}
                    >
                      <span className={`font-semibold ${ink.strong}`}>
                        {c.daysLong[hover.day]} · {hourLabel(hover.hour)}
                      </span>
                      {level(hoverCell.norm) && (
                        <span className={`ml-2 ${ink.muted}`}>{level(hoverCell.norm)}</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* axe des jours */}
              <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-3">
                {c.days.map((day, d) => (
                  <span
                    key={day}
                    className={`text-center text-[11.5px] font-medium ${
                      d === overall ? ink.strong : ink.muted
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className={`mt-3 pl-11 text-[11.5px] ${ink.muted}`}>{c.bestTime.pickHour}</p>
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
                        ? "text-white"
                        : `${isDark ? "bg-white/[0.07]" : "bg-black/[0.05]"} ${ink.soft}`
                    }`}
                    style={i === 0 ? { background: ink.accent } : undefined}
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
