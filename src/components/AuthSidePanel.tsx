import type { CSSProperties } from "react";

import BloomField from "./BloomField";

/**
 * Panneau gauche des pages de connexion / inscription.
 * Fond « Black Gradient » animé (BloomField), logo, titre, sous-titre puis
 * la liste des étapes (étape active = carte blanche, les autres = cartes sombres).
 * Volontairement sombre dans les deux thèmes : c'est un objet posé sur la page.
 */

type Props = {
  title: string;
  subtitle: string;
  steps: string[];
  activeStep?: number;
};

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
        <BloomField />

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
            className="auth-rise mt-3 max-w-[280px] text-[clamp(13px,1vw,14.5px)] leading-[1.5] text-[rgba(255,255,255,0.78)]"
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
                      : "bg-[rgba(17,17,17,0.55)] text-[rgba(255,255,255,0.82)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                      active
                        ? "bg-[#0c0c0d] text-[#fff]"
                        : "bg-[rgba(255,255,255,0.18)] text-[rgba(255,255,255,0.85)]",
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
