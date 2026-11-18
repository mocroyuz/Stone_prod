import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import AppPreview from "./AppPreview";
import LandingNav from "./LandingNav";
import NetworkLogo, { NETWORK_LABELS, type LandingNetwork } from "./NetworkLogo";
import { cn } from "../../utils/cn";

const FLOATING: {
  network: LandingNetwork;
  className: string;
  delay: number;
}[] = [
  { network: "instagram", className: "left-[-104px] top-[14%]", delay: 0 },
  { network: "tiktok", className: "right-[-104px] top-[8%]", delay: 900 },
  { network: "pinterest", className: "left-[-104px] top-[52%]", delay: 1800 },
  { network: "youtube", className: "right-[-104px] top-[46%]", delay: 2700 },
];

/** Hero : navigation statique, slogan, appels à l'action, grande capture. */
export default function LandingHero() {
  return (
    <section
      id="accueil"
      className="relative w-full overflow-hidden rounded-b-[36px] border-b border-black/[0.06] bg-[#f3f1ed] dark:border-white/[0.06] dark:bg-[#0b0b0c] sm:rounded-b-[48px]"
    >
      <LandingNav />

      <div className="mx-auto w-full max-w-[1200px] px-5 pt-12 sm:px-8 sm:pt-16 lg:pt-20">
        <div className="mx-auto flex max-w-[980px] flex-col items-center text-center">
          <p className="hero-rise inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-[12px] font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-neutral-300 dark:shadow-none">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-white" aria-hidden="true" />
            Programmation, publication et Insights
          </p>

          <h1
            className="hero-rise mt-5 font-display text-[clamp(36px,5.6vw,70px)] font-bold leading-[1.03] tracking-[-0.045em] text-neutral-900 dark:text-white"
            style={{ animationDelay: "80ms" }}
          >
            Tout votre contenu social,
            <br className="hidden sm:block" />{" "}
            dans un seul calendrier.
          </h1>

          <p
            className="hero-rise mt-5 max-w-[620px] text-[clamp(15px,1.5vw,18px)] leading-relaxed text-neutral-600 dark:text-neutral-400"
            style={{ animationDelay: "160ms" }}
          >
            Stone réunit votre calendrier éditorial, la programmation de vos publications sur
            plusieurs réseaux et le suivi de vos performances, au même endroit.
          </p>

          <div
            className="hero-rise mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center"
            style={{ animationDelay: "240ms" }}
          >
            <a
              href="/signup"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-neutral-900 px-7 text-[14.5px] font-medium text-white shadow-[0_14px_26px_-14px_rgba(0,0,0,0.7)] transition hover:-translate-y-0.5 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:shadow-none dark:hover:bg-neutral-200"
            >
              Commencer gratuitement
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </a>

            <a
              href="#fonctionnalites"
              onClick={(event) => {
                // Le routeur remet la page en haut sur « hashchange » :
                // on défile nous-mêmes vers la section.
                event.preventDefault();
                document.getElementById("fonctionnalites")?.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                  block: "start",
                });
              }}
              className="inline-flex h-12 items-center justify-center rounded-full border border-black/[0.12] bg-white px-7 text-[14.5px] font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:bg-neutral-50 dark:border-white/[0.14] dark:bg-white/[0.05] dark:text-white dark:shadow-none dark:hover:bg-white/[0.09]"
            >
              Découvrir le produit
            </a>
          </div>
        </div>

        {/* Grande capture, coupée en bas comme sur la référence. */}
        <div
          className="hero-rise relative mx-auto mt-12 max-w-[1040px] sm:mt-16"
          style={{ animationDelay: "340ms" }}
        >
          {FLOATING.map((item) => (
            <span
              key={item.network}
              className={cn(
                "lp-float absolute z-10 hidden items-center gap-2 rounded-full border border-black/[0.08] bg-white py-1.5 pl-1.5 pr-3.5 text-[12px] font-medium shadow-[0_10px_24px_-12px_rgba(0,0,0,0.35)] dark:border-white/[0.1] dark:bg-[#1a1a1d] dark:shadow-[0_14px_28px_-12px_rgba(0,0,0,0.9)] xl:inline-flex",
                item.className
              )}
              style={{ "--lp-delay": `${item.delay}ms` } as CSSProperties}
              aria-hidden="true"
            >
              <NetworkLogo network={item.network} size={24} />
              {NETWORK_LABELS[item.network]}
            </span>
          ))}

          <div className="relative max-h-[430px] overflow-hidden rounded-t-[22px] sm:max-h-[470px]">
            <AppPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
