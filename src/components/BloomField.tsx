import { useEffect, useRef } from "react";

/**
 * « Black Gradient » (21st.dev) — mesh « Bloom Field ».
 * Un blob radial par couleur, ancré à son propre point, empilés sur un fond
 * plein (#111). Animé par une boucle rAF : chaque blob dérive autour de son
 * ancre avec une phase STATIQUE (dérivée de la seed), et chaque modulation
 * vaut exactement 0 à t = 0 (sin(x + p) − sin(p)) : aucun saut au démarrage.
 * Aucune valeur animée n'est arrondie.
 */

const SEED = 452026671;
const SPEED = 0.24; // speed 24
const AMOUNT = 0.27; // motionAmount 27
const DIR = 1; // motionReverse: false
const WAVE = 14;
const BACKDROP = "#111111";

type Blob = {
  x: number; // % (ancre)
  y: number; // %
  radius: number; // % de la longueur du rayon
  rgb: string;
};

/* Ordre = ordre du CSS d'origine (le premier est dessiné au-dessus). */
const BLOBS: Blob[] = [
  { x: 72.39, y: 58.91, radius: 77.5, rgb: "17, 17, 17" }, // Ink
  { x: 37.53, y: 79.97, radius: 53, rgb: "92, 92, 92" }, // Slate
  { x: 41.45, y: 25.53, radius: 68.4, rgb: "167, 167, 167" }, // Ash
  { x: 72.25, y: 83.19, radius: 42.5, rgb: "242, 242, 242" }, // Paper
];

/* Phases statiques par blob : mulberry32(seed) — déterministe, continue. */
function phases(seed: number, count: number) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    p: rand() * Math.PI * 2,
    p2: rand() * Math.PI * 2,
  }));
}
const PHASES = phases(SEED, BLOBS.length);

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.075'/></svg>\")";

const VIGNETTE =
  "radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 52%, rgba(0, 0, 0, 0.024) 100%)";

function blobLayer(b: Blob, x: number, y: number) {
  const r = b.radius;
  const c = (a: number) => `rgba(${b.rgb}, ${a})`;
  return (
    `radial-gradient(circle at ${x}% ${y}%, ` +
    `${c(1)} 0%, ${c(0.844)} ${r * 0.25}%, ${c(0.5)} ${r * 0.5}%, ` +
    `${c(0.156)} ${r * 0.75}%, ${c(0)} ${r}%)`
  );
}

/** Fond complet pour la phase `ph` (ph = 0 → CSS d'origine exact). */
function buildBackground(ph: number) {
  const layers = BLOBS.map((b, i) => {
    const { p, p2 } = PHASES[i];
    const spin = ph * DIR;
    const x = b.x + (Math.sin(spin * 0.55 + p) - Math.sin(p)) * WAVE * AMOUNT;
    const y = b.y + (Math.sin(spin * 0.43 + p2) - Math.sin(p2)) * WAVE * AMOUNT;
    return blobLayer(b, x, y);
  });
  return [GRAIN, VIGNETTE, ...layers].join(", ");
}

const SIZE = "120px 120px, auto, auto, auto, auto, auto";
const BLEND = "overlay, normal, normal, normal, normal, normal";

export default function BloomField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Mouvement très lent et de faible amplitude : on le garde, mais 2× plus
    // calme quand le système demande de réduire les animations.
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.5 : 1;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = ((now - start) / 1000) * calm;
      el.style.backgroundImage = buildBackground(t * SPEED);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={["pointer-events-none absolute inset-0", className].join(" ")}
      style={{
        backgroundColor: BACKDROP,
        backgroundImage: buildBackground(0),
        backgroundSize: SIZE,
        backgroundBlendMode: BLEND,
      }}
    />
  );
}
