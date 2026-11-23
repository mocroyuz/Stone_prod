// src/components/insights/HourCurve.tsx
// Courbe d'activité sur 24 h pour un jour donné : heures en bas, niveau
// d'activité en hauteur. La plage la plus active est surlignée, le pic porte
// un repère. Survol/touch = heure précise, clic ou Entrée = programmer.

import { useEffect, useMemo, useRef, useState } from "react";
import { path } from "./LineChart";
import { hourLabel } from "./data";
import type { Ink } from "./theme";

const PAD = { t: 30, r: 14, b: 26, l: 14 };
const TICKS_WIDE = [0, 3, 6, 9, 12, 15, 18, 21];
const TICKS_NARROW = [0, 6, 12, 18];

/** Plage contiguë autour du pic, ≥ 80 % du pic, 6 h max. */
function peakWindow(norms: number[]) {
  let peak = 0;
  norms.forEach((v, h) => {
    if (v > norms[peak]) peak = h;
  });
  const floor = norms[peak] * 0.8;
  let from = peak;
  let to = peak;
  while (from > 0 && norms[from - 1] >= floor && to - from < 5) from -= 1;
  while (to < 23 && norms[to + 1] >= floor && to - from < 5) to += 1;
  return { peak, from, to };
}

export default function HourCurve({
  norms,
  dayLabel,
  low,
  high,
  scheduleAria,
  height,
  ink,
  isDark,
  onSchedule,
}: {
  norms: number[]; // 24 valeurs 0..1
  dayLabel: string;
  low: string;
  high: string;
  scheduleAria: (day: string, hour: string) => string;
  height: number;
  ink: Ink;
  isDark: boolean;
  onSchedule: (hour: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const innerW = w - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;
  const x = (h: number) => PAD.l + ((h + 0.5) / 24) * innerW;
  const y = (v: number) => PAD.t + innerH - Math.max(0.02, Math.min(1, v)) * innerH;

  const win = useMemo(() => peakWindow(norms), [norms]);
  const pts = norms.map((v, h) => [x(h), y(v)] as [number, number]);
  const line = path(pts);
  const area = `${line} L${x(23)},${PAD.t + innerH} L${x(0)},${PAD.t + innerH} Z`;

  const hourFrom = (clientX: number) => {
    const el = wrap.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const rel = (clientX - r.left - PAD.l) / innerW;
    return Math.max(0, Math.min(23, Math.floor(rel * 24)));
  };

  const active = hover ?? win.peak;
  const showTip = hover != null;
  const peakX = x(win.peak);
  const tipX = x(active);
  const flip = tipX > w * 0.7;
  const muted = isDark ? "#737373" : "#a3a3a3";

  return (
    <div
      ref={wrap}
      className="relative select-none"
      style={{ height }}
      onPointerMove={(e) => setHover(hourFrom(e.clientX))}
      onPointerDown={(e) => setHover(hourFrom(e.clientX))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => onSchedule(hourFrom(e.clientX))}
    >
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block" aria-hidden="true">
        <defs>
          <linearGradient id="hc-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={ink.ink} stopOpacity={isDark ? 0.12 : 0.08} />
            <stop offset="1" stopColor={ink.ink} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* repères de niveau */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.l}
            x2={w - PAD.r}
            y1={y(f)}
            y2={y(f)}
            stroke={ink.grid}
            strokeDasharray={f === 0 ? undefined : "2 4"}
          />
        ))}

        {/* plage la plus active */}
        <rect
          x={x(win.from) - innerW / 48}
          y={PAD.t - 6}
          width={((win.to - win.from + 1) / 24) * innerW}
          height={innerH + 6}
          rx="10"
          fill={ink.accent}
          opacity={isDark ? 0.14 : 0.12}
        />

        <path d={area} fill="url(#hc-fade)" />
        <path d={line} fill="none" stroke={ink.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* heures */}
        {(w < 520 ? TICKS_NARROW : TICKS_WIDE).map((h) => (
          <text key={h} x={x(h) - innerW / 48} y={height - 6} fontSize="10.5" fill={muted} className="tabular-nums" textAnchor={h === 0 ? "start" : "middle"}>
            {hourLabel(h)}
          </text>
        ))}

        {/* niveaux */}
        <text x={PAD.l} y={PAD.t - 12} fontSize="10.5" fill={muted}>{high}</text>
        <text x={w - PAD.r} y={PAD.t + innerH - 6} fontSize="10.5" fill={muted} textAnchor="end">{low}</text>

        {/* pic */}
        <line x1={peakX} x2={peakX} y1={y(norms[win.peak])} y2={PAD.t + innerH} stroke={ink.accent} strokeDasharray="3 3" />
        <circle cx={peakX} cy={y(norms[win.peak])} r="5.5" fill={ink.accent} stroke={isDark ? "#0f0f11" : "#fff"} strokeWidth="2.5" />

        {showTip && (
          <g>
            <line x1={tipX} x2={tipX} y1={PAD.t - 6} y2={PAD.t + innerH} stroke={ink.inkSoft} />
            <circle cx={tipX} cy={y(norms[active])} r="4.5" fill={isDark ? "#0f0f11" : "#fff"} stroke={ink.ink} strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* étiquette du pic */}
      {!showTip && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg px-2 py-1 text-[11.5px] font-semibold tabular-nums text-white"
          style={{ left: peakX, top: Math.max(0, y(norms[win.peak]) - 34), background: ink.accent }}
        >
          {hourLabel(win.peak)}
        </span>
      )}

      {showTip && (
        <div
          className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[12px] font-semibold tabular-nums ${ink.float} ${ink.strong}`}
          style={{
            top: Math.max(0, y(norms[active]) - 40),
            left: flip ? undefined : tipX + 10,
            right: flip ? w - tipX + 10 : undefined,
          }}
        >
          {dayLabel} · {hourLabel(active)}
        </div>
      )}

      <button
        type="button"
        aria-label={scheduleAria(dayLabel, hourLabel(active))}
        onClick={(e) => {
          e.stopPropagation();
          onSchedule(active);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setHover(Math.min(23, (hover ?? win.peak) + 1));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setHover(Math.max(0, (hover ?? win.peak) - 1));
          }
        }}
        onBlur={() => setHover(null)}
        className={`absolute inset-0 rounded-xl opacity-0 focus-visible:opacity-100 ${ink.focus}`}
        tabIndex={0}
      />
    </div>
  );
}
