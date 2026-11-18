import type { ReactNode } from "react";
import {
  CommentsPreview,
  ComposerPreview,
  InsightsPreview,
  MonthPreview,
} from "./FeaturePreviews";
import Reveal from "./Reveal";

type CardProps = {
  title: string;
  description: string;
  label: string;
  preview: ReactNode;
  className: string;
  delay?: number;
};

function FeatureCard({ title, description, label, preview, className, delay = 0 }: CardProps) {
  return (
    <Reveal className={className} delay={delay}>
      <article className="lp-feature-card">
        <div className="lp-feature-copy">
          <span className="lp-feature-label">{label}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="lp-feature-preview">{preview}</div>
      </article>
    </Reveal>
  );
}

export default function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="lp-section lp-features-section">
      <div className="lp-container">
        <Reveal className="lp-section-heading">
          <span className="lp-eyebrow">Tout ce qu’il faut. Rien de superflu.</span>
          <h2>Un workflow social<br />pensé pour <em>avancer.</em></h2>
          <p>
            De la préparation de vos contenus à leur suivi, chaque outil trouve sa place dans une interface claire.
          </p>
        </Reveal>

        <div className="lp-feature-grid">
          <FeatureCard
            className="lp-feature-span-7 lp-feature-card-main"
            label="01 · Création"
            title="Préparez vos contenus au même endroit."
            description="Rédigez vos publications, ajoutez vos médias et adaptez chaque contenu aux réseaux sélectionnés."
            preview={<ComposerPreview />}
          />
          <FeatureCard
            className="lp-feature-span-5"
            label="02 · Calendrier"
            delay={70}
            title="Gardez une vue claire sur la suite."
            description="Visualisez les publications à venir et organisez votre rythme éditorial."
            preview={<MonthPreview />}
          />
          <FeatureCard
            className="lp-feature-span-5"
            label="03 · Insights"
            delay={100}
            title="Comprenez vos performances."
            description="Retrouvez les indicateurs disponibles pour vos contenus YouTube."
            preview={<InsightsPreview />}
          />
          <FeatureCard
            className="lp-feature-span-7"
            label="04 · Commentaires"
            delay={160}
            title="Gardez le lien avec votre communauté."
            description="Consultez et gérez les commentaires de vos vidéos YouTube depuis Stone."
            preview={<CommentsPreview />}
          />
        </div>

        <p className="lp-feature-footnote">
          Les aperçus sont illustratifs. Les fonctionnalités avancées de commentaires et d’Insights présentées ici
          sont actuellement disponibles pour YouTube.
        </p>
      </div>
    </section>
  );
}
