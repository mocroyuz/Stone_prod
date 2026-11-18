import { useState } from "react";
import { AccountsPreview, ComposerPreview, InsightsPreview } from "./FeaturePreviews";
import { WindowFrame } from "./AppPreview";
import Reveal from "./Reveal";
import { cn } from "../../utils/cn";

const STEPS = [
  {
    title: "Connectez vos réseaux sociaux",
    text: "Reliez vos comptes Instagram, Threads, YouTube Shorts, TikTok ou Pinterest depuis la page Canaux.",
    screen: "Canaux",
    preview: <AccountsPreview />,
  },
  {
    title: "Créez et programmez vos publications",
    text: "Rédigez votre post, ajoutez vos médias, choisissez les réseaux, puis publiez-le ou placez-le dans le calendrier.",
    screen: "Nouvelle publication",
    preview: <ComposerPreview />,
  },
  {
    title: "Analysez et gérez votre présence",
    text: "Consultez vos Insights, répondez aux commentaires YouTube et ajustez votre calendrier selon ce qui fonctionne.",
    screen: "Insights",
    preview: <InsightsPreview />,
  },
] as const;

export default function StepsSection() {
  const [active, setActive] = useState(0);
  const current = STEPS[active];

  return (
    <section id="fonctionnement" className="scroll-mt-6 px-5 pt-24 sm:px-8 sm:pt-32">
      <div className="mx-auto w-full max-w-[1200px]">
        <Reveal className="mx-auto max-w-[620px] text-center">
          <h2 className="font-display text-[clamp(30px,4.4vw,52px)] font-bold leading-[1.06] tracking-[-0.04em]">
            Prenez en main Stone en 3 étapes.
          </h2>
          <p className="mt-4 text-[clamp(15px,1.4vw,17px)] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Connectez, créez, analysez : un parcours simple, du premier compte à la première analyse.
          </p>
        </Reveal>

        <div className="mt-12 grid items-stretch gap-4 sm:mt-14 sm:gap-5 lg:grid-cols-[1.05fr_1fr]">
          <Reveal className="order-2 lg:order-1">
            <div className="flex h-full min-h-[420px] items-center rounded-[26px] border border-black/[0.07] bg-[#f3f1ed] p-4 dark:border-white/[0.08] dark:bg-[#0b0b0c] sm:p-8">
              <div key={active} className="lp-pop w-full">
                <WindowFrame>
                  <div className="p-4 sm:p-5">
                    <p className="mb-3 font-display text-[15px] font-bold tracking-[-0.02em]" aria-hidden="true">
                      {current.screen}
                    </p>
                    {current.preview}
                  </div>
                </WindowFrame>
              </div>
            </div>
          </Reveal>

          <ol className="order-1 flex flex-col gap-3 lg:order-2">
            {STEPS.map((step, index) => {
              const open = index === active;
              return (
                <li key={step.title}>
                  <Reveal delay={index * 80}>
                    <button
                      type="button"
                      onClick={() => setActive(index)}
                      aria-expanded={open}
                      className={cn(
                        "w-full rounded-[22px] border p-4 text-left transition-[background-color,border-color,box-shadow] duration-300 sm:p-5",
                        open
                          ? "border-black/[0.1] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_36px_-22px_rgba(0,0,0,0.3)] dark:border-white/[0.12] dark:bg-[#141416] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                          : "border-black/[0.07] bg-white/60 hover:bg-white dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                      )}
                    >
                      <span className="flex items-center gap-3.5">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors duration-300",
                            open
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                              : "border border-black/[0.14] text-neutral-600 dark:border-white/[0.18] dark:text-neutral-300"
                          )}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="font-display text-[17px] font-bold leading-snug tracking-[-0.025em]">
                          {step.title}
                        </span>
                      </span>

                      <span
                        className={cn(
                          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        )}
                      >
                        <span className="overflow-hidden">
                          <span className="block pb-0.5 pl-[50px] pt-3 text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                            {step.text}
                          </span>
                        </span>
                      </span>
                    </button>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
