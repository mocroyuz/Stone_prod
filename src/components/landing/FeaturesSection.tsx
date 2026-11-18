import type { ReactNode } from "react";
import {
  AccountsPreview,
  CommentsPreview,
  ComposerPreview,
  InsightsPreview,
  MediaPreview,
  MonthPreview,
  StatusPreview,
} from "./FeaturePreviews";
import Reveal from "./Reveal";
import { cn } from "../../utils/cn";

type CardProps = {
  title: string;
  description: string;
  badge?: string;
  preview: ReactNode;
  className?: string;
  /** Texte à gauche et aperçu à droite à partir de md. */
  split?: boolean;
  delay?: number;
};

function FeatureCard({ title, description, badge, preview, className, split = false, delay = 0 }: CardProps) {
  return (
    <Reveal delay={delay} className={className}>
      <article
        className={cn(
          "group flex h-full gap-5 rounded-[26px] border border-black/[0.07] bg-white p-5 transition-[transform,box-shadow] duration-300 ease-out",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_34px_-22px_rgba(0,0,0,0.22)]",
          "hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_26px_44px_-24px_rgba(0,0,0,0.3)]",
          "dark:border-white/[0.08] dark:bg-[#111113] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_20px_40px_-26px_rgba(0,0,0,0.95)]",
          "dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_50px_-26px_rgba(0,0,0,1)]",
          "sm:p-6",
          split ? "flex-col md:flex-row md:items-center" : "flex-col"
        )}
      >
        <div className={cn(split && "md:w-[38%] md:shrink-0")}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[19px] font-bold leading-tight tracking-[-0.03em]">{title}</h3>
            {badge && (
              <span className="rounded-full border border-black/[0.1] px-2 py-0.5 text-[10.5px] font-medium text-neutral-500 dark:border-white/[0.14] dark:text-neutral-400">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">{description}</p>
        </div>

        <div className={cn("min-w-0", split ? "md:flex-1" : "mt-auto")}>{preview}</div>
      </article>
    </Reveal>
  );
}

export default function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="scroll-mt-6 px-5 pt-24 sm:px-8 sm:pt-32">
      <div className="mx-auto w-full max-w-[1200px]">
        <Reveal className="mx-auto max-w-[680px] text-center">
          <h2 className="font-display text-[clamp(30px,4.4vw,52px)] font-bold leading-[1.06] tracking-[-0.04em]">
            Tout ce qu&rsquo;il faut pour piloter votre présence sociale.
          </h2>
          <p className="mt-4 text-[clamp(15px,1.4vw,17px)] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Du premier brouillon à l&rsquo;analyse des résultats, chaque étape se fait dans le même espace de travail.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-12">
          <FeatureCard
            className="md:col-span-7"
            title="Programmation multi-réseaux"
            description="Rédigez une fois, adaptez le texte et les médias réseau par réseau, puis publiez ou programmez à la date voulue."
            preview={<ComposerPreview />}
          />
          <FeatureCard
            className="md:col-span-5"
            delay={80}
            title="Calendrier éditorial"
            description="Visualisez vos publications sur 3 jours, la semaine ou le mois, et déplacez-les d’un glisser-déposer."
            preview={<MonthPreview />}
          />

          <FeatureCard
            className="md:col-span-4"
            title="Gestion des publications"
            description="Gardez le contrôle de chaque post : programmé, publié, brouillon ou en échec."
            preview={<StatusPreview />}
          />
          <FeatureCard
            className="md:col-span-4"
            delay={80}
            title="Insights"
            badge="YouTube"
            description="Suivez abonnés, réactions et engagement, et repérez le meilleur moment pour publier."
            preview={<InsightsPreview />}
          />
          <FeatureCard
            className="md:col-span-4"
            delay={160}
            title="Gestion des commentaires"
            badge="YouTube"
            description="Lisez les commentaires de vos vidéos, répondez-y et marquez-les comme lus."
            preview={<CommentsPreview />}
          />

          <FeatureCard
            className="md:col-span-7"
            split
            title="Médias et création"
            description="Recadrez vos visuels, appliquez un filtre et importez-les depuis Canva, Dropbox, Google Drive ou Google Photos."
            preview={<MediaPreview />}
          />
          <FeatureCard
            className="md:col-span-5"
            delay={80}
            title="Comptes sociaux"
            description="Connectez vos comptes en quelques clics et retrouvez-les dans la barre latérale, avec leurs commentaires non lus."
            preview={<AccountsPreview />}
          />
        </div>

        <p className="mt-6 text-center text-[12px] text-neutral-500 dark:text-neutral-500">
          Aperçus illustratifs avec du contenu d&rsquo;exemple. Les commentaires et les Insights détaillés
          sont aujourd&rsquo;hui disponibles pour YouTube.
        </p>
      </div>
    </section>
  );
}
