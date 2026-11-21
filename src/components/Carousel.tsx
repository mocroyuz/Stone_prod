import { useCallback, useEffect, useState } from "react";
import { caseStudies } from "../data/caseStudies";
import CaseCard from "./CaseCard";

function wrapOffset(raw: number, len: number) {
  const half = Math.floor(len / 2);
  let o = raw;
  while (o > half) o -= len;
  while (o < -half) o += len;
  return o;
}

export default function Carousel() {
  const len = caseStudies.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (dir: number) => setActive((a) => (a + dir + len) % len),
    [len],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => go(1), 6000);
    return () => window.clearInterval(id);
  }, [go, paused, active]);

  return (
    <div
      className="relative mt-[clamp(28px,4vw,56px)] w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* stage */}
      <div className="relative mx-auto w-full px-[2%] py-[clamp(14px,2vw,26px)]">
        {/* spacer defines height */}
        <div className="invisible mx-auto aspect-[820/340] w-[86%] md:w-[74%]" />

        {caseStudies.map((study, i) => {
          const offset = wrapOffset(i - active, len);
          const abs = Math.abs(offset);
          const isActive = offset === 0;
          const translate = abs === 0 ? 0 : offset > 0 ? 22.4 : -22.4;
          const scale = abs === 0 ? 1 : abs === 1 ? 0.86 : 0.74;
          const opacity = abs === 0 ? 1 : abs === 1 ? 1 : 0;

          return (
            <div
              key={study.id}
              aria-hidden={!isActive}
              className="absolute top-1/2 left-1/2 aspect-[820/340] w-[86%] md:w-[74%] transition-all duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translate(calc(-50% + ${translate}%), -50%) scale(${scale})`,
                zIndex: 20 - abs,
                opacity,
                filter: isActive ? "none" : "saturate(0.9)",
              }}
            >
              <CaseCard study={study} active={isActive} />
            </div>
          );
        })}

        {/* arrows */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous case study"
          className="absolute top-1/2 left-[1%] z-30 flex h-[clamp(26px,2.8vw,38px)] w-[clamp(26px,2.8vw,38px)] -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900 text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition hover:scale-105 active:scale-95 dark:bg-white dark:text-neutral-900"
        >
          <svg viewBox="0 0 24 24" className="h-[42%] w-[42%]" fill="none">
            <path
              d="M15 5 8 12l7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next case study"
          className="absolute top-1/2 right-[1%] z-30 flex h-[clamp(26px,2.8vw,38px)] w-[clamp(26px,2.8vw,38px)] -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900 text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition hover:scale-105 active:scale-95 dark:bg-white dark:text-neutral-900"
        >
          <svg viewBox="0 0 24 24" className="h-[42%] w-[42%]" fill="none">
            <path
              d="m9 5 7 7-7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* pagination */}
      <div className="mt-[clamp(18px,2.6vw,34px)] flex items-center justify-center gap-[7px]">
        <svg viewBox="0 0 24 24" className="mr-1 h-2.5 w-2.5 text-neutral-300 dark:text-white/25" fill="none">
          <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        {caseStudies.map((s, i) => {
          const isActive = i === active;
          return (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to case study ${i + 1}`}
              onClick={() => setActive(i)}
              className="group flex h-3 items-center"
            >
              <span
                className={[
                  "block rounded-full transition-all duration-500",
                  isActive
                    ? "h-[6px] w-[34px] bg-neutral-900 dark:bg-white"
                    : "h-[5px] w-[5px] bg-neutral-300 group-hover:bg-neutral-500 dark:bg-white/25 dark:group-hover:bg-white/50",
                ].join(" ")}
              />
            </button>
          );
        })}
        <svg viewBox="0 0 24 24" className="ml-1 h-2.5 w-2.5 text-neutral-300 dark:text-white/25" fill="none">
          <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
