import type { CaseStudy } from "../data/caseStudies";
import BrandMark from "./BrandMark";

type Props = {
  study: CaseStudy;
  active: boolean;
};

export default function CaseCard({ study, active }: Props) {
  return (
    <div className="@container relative h-full w-full">
      {/* card body */}
      <div className="absolute inset-0 tint rounded-[4cqi] bg-[#f3f3f3] dark:bg-[#1a1a1c] shadow-[0_2cqi_6cqi_-3cqi_rgba(0,0,0,0.25)]" />

      {/* content column */}
      <div className="absolute inset-y-0 left-[43.5%] right-0 flex flex-col">
        <div className="flex flex-1 flex-col justify-center pr-[5.5cqi] pt-[3cqi]">
          <BrandMark name={study.brand} />

          <h3 className="mt-[2.6cqi] max-w-[40cqi] font-display text-[3.25cqi] font-semibold leading-[1.18] tracking-[-0.025em] tint text-neutral-900 dark:text-white">
            {study.title}
          </h3>

          <p className="mt-[1.6cqi] max-w-[33cqi] text-[1.5cqi] leading-[1.55] tint text-neutral-500 dark:text-neutral-400">
            {study.description}
          </p>

          <button
            type="button"
            tabIndex={active ? 0 : -1}
            className="group mt-[2.4cqi] flex w-fit items-center gap-[1cqi] text-left"
          >
            <span className="text-[1.5cqi] font-medium text-neutral-900 underline decoration-neutral-900/60 dark:text-white dark:decoration-white/60 underline-offset-[0.45cqi]">
              Read More
            </span>
            <span className="flex h-[2.1cqi] w-[2.1cqi] items-center justify-center rounded-full bg-neutral-900 text-white transition-transform dark:bg-white dark:text-neutral-900 duration-300 group-hover:translate-x-[0.4cqi]">
              <svg viewBox="0 0 12 12" className="h-[1.1cqi] w-[1.1cqi]" fill="none">
                <path
                  d="M3 9 9 3M4.2 3H9v4.8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>

        {/* stats */}
        <div className="flex items-start gap-[6.5cqi] tint border-t border-black/10 dark:border-white/10 py-[2.6cqi] pr-[5cqi]">
          {study.stats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-[2.4cqi] font-semibold tracking-[-0.02em] tint text-neutral-900 dark:text-white">
                {s.value}
              </div>
              <div className="mt-[0.5cqi] text-[1.15cqi] font-medium tint text-neutral-500 dark:text-neutral-400">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* floating visual */}
      <div
        className={[
          "absolute top-1/2 left-[-6%] aspect-square h-[110%] -translate-y-1/2 overflow-hidden rounded-[6cqi]",
          "shadow-[0_4cqi_9cqi_-3cqi_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:ring-white/10",
        ].join(" ")}
      >
        <img
          src={study.image}
          alt={study.title}
          className="h-full w-full scale-105 object-cover"
          draggable={false}
        />
      </div>
    </div>
  );
}
