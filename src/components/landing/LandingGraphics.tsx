import type { CSSProperties } from "react";

/* ------------------------------------------------------------------
   Marque + pictogrammes de la landing page.
   Tout est en SVG inline : net à toutes les densités, aucun fichier
   supplémentaire à charger.
------------------------------------------------------------------ */

type IconProps = { className?: string };

/** Logo « soleil » : rayons courts et longs en alternance. */
export function MedicoMark({ className }: IconProps) {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * 360) / 16;
    const long = i % 2 === 0;
    return { angle, r1: 5.2, r2: long ? 11 : 9.6 };
  });

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {rays.map(({ angle, r1, r2 }) => (
        <line
          key={angle}
          x1="12"
          y1={12 - r1}
          x2="12"
          y2={12 - r2}
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** Grande fleur à pétales (cellule centrale sous le bandeau de logos). */
export function PetalSpinner({ className }: IconProps) {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g fill="currentColor">
        {petals.map((angle) => (
          <ellipse
            key={angle}
            cx="24"
            cy="8.5"
            rx="2.3"
            ry="6.2"
            transform={`rotate(${angle} 24 24)`}
          />
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------
   Logos partenaires (bandeau « Trusted by »)
------------------------------------------------------------------ */

export function LogoOrbit({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="currentColor" />
      <path
        d="M16 6.5c.9 5.1 3.4 7.6 9.5 9.5-6.1 1.9-8.6 4.4-9.5 9.5-.9-5.1-3.4-7.6-9.5-9.5 6.1-1.9 8.6-4.4 9.5-9.5Z"
        fill="#fff"
      />
    </svg>
  );
}

export function LogoInvert({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M12 3a9 9 0 0 0 0 18c-3.5-1.8-5.4-5.2-5.4-9S8.5 4.8 12 3Z" fill="#fff" opacity=".92" />
    </svg>
  );
}

export function LogoBurst({ className }: IconProps) {
  const rays = Array.from({ length: 40 }, (_, i) => (i * 360) / 40);
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {rays.map((angle, i) => (
        <line
          key={angle}
          x1="20"
          y1={i % 2 === 0 ? 3 : 5.5}
          x2="20"
          y2="12"
          transform={`rotate(${angle} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LogoHues({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="currentColor">
        <circle cx="6.5" cy="7" r="3.3" />
        <path d="M11.4 4.2a3.3 3.3 0 0 1 4.6 4.8l-3.3 3.1-4.6-4.8 3.3-3.1Z" />
        <circle cx="9.5" cy="16.2" r="3.3" />
        <path d="M13.4 14.1h6.2a2.6 2.6 0 0 1 0 5.2h-6.2v-5.2Z" />
      </g>
    </svg>
  );
}

export function LogoWaves({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="2.5" fill="currentColor" />
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M5 11c3-3 6 3 9 0s6-3 9 0 3 1 4 0" />
        <path d="M5 17c3-3 6 3 9 0s6-3 9 0 3 1 4 0" />
        <path d="M5 23c3-3 6 3 9 0s6-3 9 0 3 1 4 0" />
      </g>
    </svg>
  );
}

export function LogoPollinate({ className }: IconProps) {
  const dots: Array<[number, number]> = [
    [12, 4.5],
    [18.5, 8.2],
    [18.5, 15.8],
    [12, 19.5],
    [5.5, 15.8],
    [5.5, 8.2],
  ];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="currentColor">
        {dots.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" />
        ))}
        <circle cx="12" cy="12" r="2.8" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------
   Texture de points (grille pointillée très discrète)
------------------------------------------------------------------ */

type DotFieldProps = {
  className?: string;
  /** Opacité des points (0 → 1). */
  strength?: number;
  /** Masque qui estompe la texture vers les bords. */
  mask?: string;
};

export function DotField({
  className = "",
  strength = 0.16,
  mask = "radial-gradient(closest-side, #000 25%, transparent 100%)",
}: DotFieldProps) {
  const style: CSSProperties = {
    backgroundImage: `radial-gradient(circle, rgba(0,0,0,${strength}) 0.8px, transparent 1.2px)`,
    backgroundSize: "9px 9px",
    maskImage: mask,
    WebkitMaskImage: mask,
  };
  return (
    <div
      aria-hidden="true"
      className={["pointer-events-none absolute", className].join(" ")}
      style={style}
    />
  );
}
