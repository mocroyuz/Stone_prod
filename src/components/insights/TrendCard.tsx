// src/components/insights/TrendCard.tsx
// Carte « Tendances » : onglets de métriques, bascule de comparaison, courbe.

import LineChart, { type ChartPoint } from "./LineChart";
import Segmented from "./Segmented";
import { CARD, CARD_TITLE, type Ink } from "./theme";

export default function TrendCard<T extends string>({
  title,
  subtitle,
  metrics,
  metric,
  onMetric,
  metricAria,
  compare,
  onCompare,
  compareLabel,
  data,
  seriesLabel,
  prevLabel,
  ink,
  isDark,
  locale,
}: {
  title: string;
  subtitle: string;
  metrics: { key: T; label: string }[];
  metric: T;
  onMetric: (k: T) => void;
  metricAria: string;
  compare: boolean;
  onCompare: (v: boolean) => void;
  compareLabel: string;
  data: ChartPoint[];
  seriesLabel: string;
  prevLabel: string;
  ink: Ink;
  isDark: boolean;
  locale: string;
}) {
  return (
    <section className={`min-w-0 p-4 md:p-5 ${CARD} ${ink.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className={`${CARD_TITLE} ${ink.strong}`}>{title}</h2>
          <p className={`mt-0.5 text-[12px] ${ink.muted}`}>{subtitle}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={compare}
          onClick={() => onCompare(!compare)}
          className={`flex h-8 items-center gap-2 rounded-lg px-1 text-[12px] font-medium ${ink.focus} ${ink.soft}`}
        >
          <span
            aria-hidden="true"
            className={`relative h-[18px] w-8 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
              compare
                ? isDark
                  ? "bg-white"
                  : "bg-neutral-900"
                : isDark
                  ? "bg-white/[0.14]"
                  : "bg-black/[0.14]"
            }`}
          >
            <span
              className={`absolute top-[2px] h-[14px] w-[14px] rounded-full shadow-sm transition-[left] duration-200 motion-reduce:transition-none ${
                compare
                  ? isDark
                    ? "left-[16px] bg-neutral-900"
                    : "left-[16px] bg-white"
                  : "left-[2px] bg-white"
              }`}
            />
          </span>
          {compareLabel}
        </button>
      </div>

      <div className="mt-4">
        <Segmented
          value={metric}
          options={metrics}
          onChange={onMetric}
          ink={ink}
          isDark={isDark}
          label={metricAria}
        />
      </div>

      <div className="mt-4">
        <LineChart
          data={data}
          showPrev={compare}
          seriesLabel={seriesLabel}
          prevLabel={prevLabel}
          ink={ink}
          isDark={isDark}
          locale={locale}
        />
      </div>
    </section>
  );
}
