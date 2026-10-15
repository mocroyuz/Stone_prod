import { useEffect, useRef, useState, useCallback } from "react";

type StoneBootProps = {
  onComplete: () => void;
};

const FILL_DURATION = 8000; // durée du remplissage
const HOLD_AFTER_FILL = 500; // pause une fois le logo plein
const FADE_OUT = 600; // fondu final
const WAVE_AMPLITUDE = 3; // hauteur de la vague (en % de la hauteur)

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="/images/icon_nav.png"
        alt=""
        draggable={false}
        className="h-52 w-auto select-none object-contain sm:h-72 md:h-80"
      />
    </div>
  );
}

export default function StoneBoot({ onComplete }: StoneBootProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    window.setTimeout(() => onCompleteRef.current(), FADE_OUT);
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const duration = reduceMotion ? 1500 : FILL_DURATION;
    const start = performance.now();
    let raf = 0;
    let holdTimer = 0;

    const frame = (now: number) => {
      const elapsed = now - start;
      const p = easeInOut(Math.min(elapsed / duration, 1));

      // Niveau du liquide : de 100 % (vide) à 0 % (plein), de bas en haut
      const level = (1 - p) * (100 + 2 * WAVE_AMPLITUDE) - WAVE_AMPLITUDE;
      const phase = elapsed * 0.004;
      const amp = reduceMotion ? 0 : WAVE_AMPLITUDE;

      const points: string[] = [];
      for (let x = 0; x <= 100; x += 2.5) {
        const y = level + amp * Math.sin(x * 0.12 + phase);
        points.push(`${x}% ${y.toFixed(2)}%`);
      }
      points.push("100% 100%", "0% 100%");

      if (fillRef.current) {
        fillRef.current.style.clipPath = `polygon(${points.join(",")})`;
      }

      if (elapsed < duration) {
        raf = requestAnimationFrame(frame);
      } else {
        holdTimer = window.setTimeout(
          finish,
          reduceMotion ? 200 : HOLD_AFTER_FILL
        );
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(holdTimer);
    };
  }, [finish]);

  return (
    <div
      role="status"
      aria-label="Chargement de Stone"
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-[#050505]"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_OUT}ms ease`,
        pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <div className="relative">
        {/* Fond : version terne (le « vide ») */}
        <Brand className="opacity-[0.12]" />

        {/* Remplissage liquide de bas en haut */}
        <div
          ref={fillRef}
          className="absolute inset-0"
          style={{ clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)" }}
        >
          <Brand />
        </div>
      </div>
    </div>
  );
}