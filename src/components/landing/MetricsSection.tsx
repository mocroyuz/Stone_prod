import Reveal from "./Reveal";
import { cn } from "../../utils/cn";

/* Valeurs FICTIVES, uniquement pour illustrer les indicateurs suivis dans la
   page Insights. Chaque carte porte la mention « Exemple ». */
const METRICS = [
  {
    value: "24",
    label: "Posts publiés",
    text: "Le rythme de publication sur la période choisie.",
    delta: "+4 vs période précédente",
    points: [4, 6, 5, 8, 7, 10, 12],
    tall: true,
  },
  {
    value: "1 280",
    label: "Réactions",
    text: "Likes et autres réactions reçues sur vos posts.",
    delta: "+12 % vs période précédente",
    points: [9, 8, 10, 9, 12, 11, 14],
    tall: false,
  },
  {
    value: "4,8 %",
    label: "Taux d’engagement",
    text: "La part des vues transformées en like ou en commentaire.",
    delta: "+0,6 pt vs période précédente",
    points: [6, 7, 6, 8, 9, 8, 11],
    tall: true,
  },
  {
    value: "12,4 k",
    label: "Vues vidéo",
    text: "Combien de fois vos vidéos ont été vues.",
    delta: "+9 % vs période précédente",
    points: [5, 7, 6, 9, 8, 12, 13],
    tall: false,
  },
] as const;

function Sparkline({ points }: { points: readonly number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = 100 / (points.length - 1);
  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = 28 - ((point - min) / (max - min || 1)) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function MetricsSection() {
  return (
    <section id="indicateurs" className="scroll-mt-6 px-5 pt-24 sm:px-8 sm:pt-32">
      <div className="mx-auto w-full max-w-[1200px]">
        <Reveal className="mx-auto max-w-[680px] text-center">
          <h2 className="font-display text-[clamp(30px,4.4vw,52px)] font-bold leading-[1.06] tracking-[-0.04em]">
            Des indicateurs clairs pour décider du prochain post.
          </h2>
          <p className="mt-4 text-[clamp(15px,1.4vw,17px)] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Voici le type d&rsquo;indicateurs que vous pouvez suivre dans Insights, avec une comparaison à la période
            précédente.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:items-end">
          {METRICS.map((metric, index) => (
            <Reveal key={metric.label} delay={index * 70}>
              <article
                className={cn(
                  "flex flex-col justify-between rounded-[26px] border p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 sm:p-6",
                  metric.tall ? "min-h-[290px]" : "min-h-[250px]",
                  index % 2 === 0
                    ? "border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_34px_-22px_rgba(0,0,0,0.22)] hover:shadow-[0_26px_44px_-24px_rgba(0,0,0,0.3)] dark:border-white/[0.08] dark:bg-[#111113] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:shadow-[0_28px_48px_-26px_rgba(0,0,0,1)]"
                    : "border-black/[0.05] bg-[#f3f1ed] hover:shadow-[0_22px_40px_-26px_rgba(0,0,0,0.28)] dark:border-white/[0.06] dark:bg-[#0b0b0c] dark:hover:shadow-[0_26px_44px_-26px_rgba(0,0,0,1)]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-[clamp(36px,4.4vw,52px)] font-bold leading-none tracking-[-0.05em]">
                    {metric.value}
                  </p>
                  <span className="rounded-full border border-black/[0.12] px-2 py-0.5 text-[10.5px] font-medium text-neutral-500 dark:border-white/[0.16] dark:text-neutral-400">
                    Exemple
                  </span>
                </div>

                <div className="mt-8">
                  <div className="text-neutral-900 dark:text-white">
                    <Sparkline points={metric.points} />
                  </div>
                  <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em]">{metric.label}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {metric.text}
                  </p>
                  <p className="mt-3 text-[11.5px] font-medium text-neutral-500 dark:text-neutral-400">
                    {metric.delta}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-center text-[12px] text-neutral-500">
          Valeurs fictives, données de démonstration : elles ne reflètent aucun résultat réel de Stone ni de ses
          utilisateurs.
        </p>
      </div>
    </section>
  );
}
