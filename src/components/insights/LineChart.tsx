// src/components/insights/LineChart.tsx
// Courbe SVG sur mesure (pas de librairie) : trait fin net, grille en
// pointillés très discrète, curseur vertical + infobulle au survol/touch,
// navigation clavier. Série précédente en pointillés.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Ink } from "./theme";

export type ChartPoint = {
  label: string; // axe
  full: string; // infobulle
  value: number;
  prev?: number;
};

const H = 232;
const PAD = { t: 14, r: 12, b: 26, l: 40 };

function niceMax(v: number) {
  if (v <= 0) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const short = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Courbe lissée monotone (Catmull-Rom → Bézier) sans dépassement. */
function path(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) * t));
    const c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) * t));
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function LineChart({
  data,
  showPrev,
  seriesLabel,
  prevLabel,
  ink,
  isDark,
  locale,
}: {
  data: ChartPoint[];
  showPrev: boolean;
  seriesLabel: string;
  prevLabel: string;
  ink: Ink;
  isDark: boolean;
  locale: string;
}) {
  const uid = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const innerW = w - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const max = useMemo(() => {
    const vals = data.flatMap((d) => (showPrev ? [d.value, d.prev ?? 0] : [d.value]));
    return niceMax(Math.max(0, ...vals));
  }, [data, showPrev]);

  const x = (i: number) => PAD.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;

  const main = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const prev = data.map((d, i) => [x(i), y(d.prev ?? 0)] as [number, number]);
  const line = path(main);
  const area = n > 1 ? `${line} L${x(n - 1)},${PAD.t + innerH} L${x(0)},${PAD.t + innerH} Z` : "";

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 84))));

  const move = (clientX: number) => {
    const el = wrap.current;
    if (!el || n === 0) return;
    const r = el.getBoundingClientRect();
    const rel = (clientX - r.left - PAD.l) / innerW;
    setActive(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  const a = active != null ? data[active] : null;
  const tipLeft = active != null ? x(active) : 0;
  const flip = tipLeft > w * 0.62;

  return (
    <div
      ref={wrap}
      className="relative select-none"
      style={{ height: H }}
      onPointerMove={(e) => move(e.clientX)}
      onPointerDown={(e) => move(e.clientX)}
      onPointerLeave={() => setActive(null)}
    >
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={seriesLabel}
        className="block touch-pan-y"
      >
        <defs>
          <linearGradient id={`fade-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={ink.ink} stopOpacity={isDark ? 0.1 : 0.07} />
            <stop offset="1" stopColor={ink.ink} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tv, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={w - PAD.r}
              y1={y(tv)}
              y2={y(tv)}
              stroke={ink.grid}
              strokeDasharray={i === 0 ? undefined : "2 4"}
            />
            <text
              x={PAD.l - 10}
              y={y(tv) + 3.5}
              textAnchor="end"
              fontSize="10.5"
              fill={isDark ? "#737373" : "#a3a3a3"}
              className="tabular-nums"
            >
              {short(tv, locale)}
            </text>
          </g>
        ))}

        {data.map((d, i) =>
          i % every === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize="10.5"
              fill={isDark ? "#737373" : "#a3a3a3"}
            >
              {d.label}
            </text>
          ) : null
        )}

        {area && <path d={area} fill={`url(#fade-${uid})`} />}

        {showPrev && (
          <path
            d={path(prev)}
            fill="none"
            stroke={ink.inkSoft}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        )}

        <path
          d={line}
          fill="none"
          stroke={ink.ink}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {active != null && (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.t}
              y2={PAD.t + innerH}
              stroke={ink.inkSoft}
            />
            <circle
              cx={x(active)}
              cy={y(data[active].value)}
              r="4.5"
              fill={isDark ? "#0f0f11" : "#fff"}
              stroke={ink.ink}
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Zone clavier : flèches pour parcourir les jours */}
      <div
        tabIndex={0}
        role="group"
        aria-label={seriesLabel}
        onFocus={() => setActive((v) => v ?? n - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setActive((v) => Math.min(n - 1, (v ?? -1) + 1));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setActive((v) => Math.max(0, (v ?? n) - 1));
          }
        }}
        className={`absolute inset-0 rounded-xl ${ink.focus}`}
      />

      {a && (
        <div
          className={`pointer-events-none absolute z-10 min-w-[132px] rounded-xl border px-3 py-2 text-[12px] ${ink.float}`}
          style={{
            top: Math.max(0, y(a.value) - 58),
            left: flip ? undefined : tipLeft + 12,
            right: flip ? w - tipLeft + 12 : undefined,
          }}
        >
          <p className={`mb-1 text-[11px] ${ink.muted}`}>{a.full}</p>
          <p className={`flex items-center justify-between gap-4 ${ink.strong}`}>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3 rounded-full" style={{ background: ink.ink }} />
              {seriesLabel}
            </span>
            <span className="font-semibold tabular-nums">
              {a.value.toLocaleString(locale)}
            </span>
          </p>
          {showPrev && (
            <p className={`mt-0.5 flex items-center justify-between gap-4 ${ink.soft}`}>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-0 w-3 border-t-2 border-dashed"
                  style={{ borderColor: ink.inkSoft }}
                />
                {prevLabel}
              </span>
              <span className="tabular-nums">{(a.prev ?? 0).toLocaleString(locale)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
