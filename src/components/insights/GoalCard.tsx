// src/components/insights/GoalCard.tsx
// Objectif de publication de la semaine : anneau identique à celui de home.

import { CARD, CARD_TITLE, type Ink } from "./theme";

export default function GoalCard({
  title,
  done,
  goal,
  caption,
  aria,
  ink,
  isDark,
}: {
  title: string;
  done: number;
  goal: number;
  caption: string;
  aria: string;
  ink: Ink;
  isDark: boolean;
}) {
  const pct = goal > 0 ? Math.min(1, done / goal) : 0;
  const size = 72;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <section className={`flex items-center gap-4 p-4 md:p-5 ${CARD} ${ink.card}`}>
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={done}
        aria-label={aria}
      >
        <div
          className={`absolute rounded-full ${isDark ? "bg-white/[0.06]" : "bg-white shadow-sm"}`}
          style={{ inset: stroke }}
        />
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className={isDark ? "stroke-white/[0.14]" : "stroke-black/[0.10]"}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            className={`${isDark ? "stroke-white" : "stroke-neutral-900"} transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none`}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums tracking-[-0.02em] ${ink.strong}`}
        >
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="min-w-0">
        <h2 className={`${CARD_TITLE} ${ink.strong}`}>{title}</h2>
        <p className={`mt-1 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${ink.strong}`}>
          {done}
          <span className={`text-[14px] font-medium ${ink.muted}`}> / {goal}</span>
        </p>
        <p className={`mt-1.5 text-[12px] ${ink.muted}`}>{caption}</p>
      </div>
    </section>
  );
}
