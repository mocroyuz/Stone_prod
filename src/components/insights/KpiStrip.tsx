// src/components/insights/KpiStrip.tsx
// Bandeau d'indicateurs : UNE carte, cellules séparées par des filets fins
// (pas six tuiles identiques avec icône). Valeur en chiffres tabulaires,
// variation en texte seul.

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CARD, type Ink } from "./theme";

export type Kpi = {
  key: string;
  label: string;
  value: string;
  info: string;
  delta?: number | null;
};

export default function KpiStrip({
  items,
  ink,
  isDark,
  versus,
}: {
  items: Kpi[];
  ink: Ink;
  isDark: boolean;
  versus: string;
}) {
  const cell = isDark ? "bg-[#0f0f11]" : "bg-white";
  const rule = isDark ? "bg-white/[0.07]" : "bg-black/[0.06]";

  return (
    <section
      aria-label="KPI"
      className={`overflow-hidden ${CARD} ${ink.card}`}
    >
      <dl className={`grid grid-cols-2 gap-px md:grid-cols-3 xl:grid-cols-6 ${rule}`}>
        {items.map((k) => {
          const d = k.delta;
          const tone = d == null || d === 0 ? ink.muted : d > 0 ? ink.up : ink.down;
          return (
            <div
              key={k.key}
              title={k.info}
              className={`flex min-w-0 flex-col gap-1.5 px-4 py-4 md:px-5 md:py-[18px] ${cell}`}
            >
              <dt className={`truncate text-[12px] font-medium ${ink.soft}`}>
                {k.label}
              </dt>
              <dd
                className={`text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums md:text-[28px] ${ink.strong}`}
              >
                {k.value}
              </dd>
              <p className={`flex min-h-[16px] items-center gap-1 text-[11.5px] ${ink.muted}`}>
                {d == null ? (
                  <span aria-hidden="true">—</span>
                ) : (
                  <>
                    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${tone}`}>
                      {d > 0 ? (
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      ) : d < 0 ? (
                        <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                      ) : null}
                      {d > 0 ? "+" : ""}
                      {d}%
                    </span>
                    <span className="hidden truncate min-[480px]:inline">{versus}</span>
                  </>
                )}
              </p>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
