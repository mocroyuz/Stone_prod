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
          <span className="lp-eyebrow">Un espace. Tout le workflow.</span>
          <h2>Du premier brouillon<br />au <em>post publié.</em></h2>
          <p>Les outils essentiels pour organiser votre communication et garder une vision claire de vos contenus.</p>
        </Reveal>
        <div className="lp-feature-grid">
          <FeatureCard className="lp-feature-span-7 lp-feature-card-main" label="01 · Publication"
            title="Publiez sans vous disperser."
            description="Préparez un contenu, sélectionnez vos réseaux et adaptez votre publication à chaque plateforme."
            preview={<ComposerPreview />}
          />
          <FeatureCard className="lp-feature-span-5" delay={70} label="02 · Planification"
            title="Une vue claire sur votre calendrier."
            description="Visualisez votre rythme de publication à la semaine ou au mois."
            preview={<MonthPreview />}
          />
          <FeatureCard className="lp-feature-span-4" label="03 · Organisation"
            title="Gardez le fil de chaque post."
            description="Retrouvez les brouillons, publications programmées, contenus publiés et statuts."
            preview={<StatusPreview />}
          />
          <FeatureCard className="lp-feature-span-4" delay={70} label="04 · Analyse"
            title="Comprenez ce qui fonctionne."
            description="Consultez vos indicateurs YouTube et suivez l’évolution de vos contenus."
            preview={<InsightsPreview />}
          />
          <FeatureCard className="lp-feature-span-4" delay={140} label="05 · Communauté"
            title="Ne perdez pas le fil des échanges."
            description="Centralisez la lecture et la gestion des commentaires YouTube."
            preview={<CommentsPreview />}
          />
          <FeatureCard className="lp-feature-span-7" delay={70} label="06 · Création"
            title="Vos médias, au bon format."
            description="Préparez vos visuels et importez vos fichiers depuis Canva, Dropbox, Google Drive ou Google Photos."
            preview={<MediaPreview />}
          />
          <FeatureCard className="lp-feature-span-5" delay={140} label="07 · Connexions"
            title="Tous vos comptes au même endroit."
            description="Visualisez vos comptes sociaux et leur état de connexion depuis Stone."
            preview={<AccountsPreview />}
          />
        </div>
        <p className="lp-feature-footnote">
          Aperçus illustratifs avec du contenu de démonstration. Les commentaires et les Insights détaillés présentés
          ici concernent actuellement YouTube.
        </p>
      </div>
    </section>
  );
}
