import type { CSSProperties } from "react";

/**
 * Panneau gauche des pages de connexion / inscription.
 * Fond sombre avec halo blanc diffus en haut, logo, titre, sous-titre puis
 * la liste des étapes (étape active = carte blanche, les autres = cartes sombres).
 * Volontairement sombre dans les deux thèmes : c'est un objet posé sur la page.
 */

type Props = {
  title: string;
  subtitle: string;
  steps: string[];
  activeStep?: number;
};

/* Grain fin (SVG feTurbulence) : casse les bandes du halo, donne une vraie matière. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export default function AuthSidePanel({
  title,
  subtitle,
  steps,
  activeStep = 0,
}: Props) {
  const rise = (i: number): CSSProperties =>
    ({ "--i": i }) as CSSProperties;

  return (
    <div className="hidden p-[clamp(12px,1.4vw,22px)] md:block">
      <div className="relative flex h-full min-h-[560px] flex-col items-center justify-end overflow-hidden rounded-[clamp(18px,2vw,28px)] bg-[#09090a] px-[clamp(20px,3vw,48px)] pb-[clamp(28px,6vh,72px)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        {/* Halo : grande tache claire en haut qui s'éteint avant le milieu */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[78%]"
          style={{
            background:
              "radial-gradient(78% 74% at 50% 0%, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.8) 14%, rgba(250,250,252,0.58) 30%, rgba(236,236,240,0.36) 46%, rgba(200,200,208,0.18) 62%, rgba(150,150,158,0.07) 80%, rgba(9,9,10,0) 100%)",
            filter: "blur(18px)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[40%] opacity-70"
          style={{
            background:
              "radial-gradient(46% 70% at 50% 0%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)",
            filter: "blur(30px)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px" }}
        />

        <div className="relative flex w-full max-w-[340px] flex-col items-center text-center">
          <div
            style={rise(0)}
            className="auth-rise flex items-center gap-2.5 text-[#fff]"
          >
            <img
              src="/images/landing/stone-mark.png"
              alt=""
              aria-hidden="true"
              width={20}
              height={26}
              decoding="async"
              className="h-[22px] w-auto brightness-0 invert"
            />
            <span className="font-display text-[19px] font-medium tracking-[-0.03em]">
              Stone
            </span>
          </div>

          <h1
            style={rise(1)}
            className="auth-rise mt-[clamp(18px,3vh,30px)] font-display text-[clamp(28px,2.6vw,38px)] leading-[1.1] font-medium tracking-[-0.035em] text-[#fff]"
          >
            {title}
          </h1>
          <div
            style={rise(2)}
            className="auth-rise mt-3 max-w-[280px] text-[clamp(13px,1vw,14.5px)] leading-[1.5] text-[rgba(255,255,255,0.6)]"
          >
            {subtitle}
          </div>

          <ol className="mt-[clamp(22px,4vh,40px)] flex w-full flex-col gap-2.5">
            {steps.map((label, i) => {
              const active = i === activeStep;
              return (
                <li
                  key={label}
                  style={rise(3 + i)}
                  aria-current={active ? "step" : undefined}
                  className={[
                    "auth-rise flex h-[clamp(44px,5.4vh,52px)] items-center gap-3 rounded-[14px] px-3.5 text-left text-[14px] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow] duration-500",
                    active
                      ? "bg-[#fff] text-[#0c0c0d] shadow-[0_14px_30px_-14px_rgba(0,0,0,0.7)]"
                      : "bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.6)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                      active
                        ? "bg-[#0c0c0d] text-[#fff]"
                        : "bg-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.7)]",
                    ].join(" ")}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate">{label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
