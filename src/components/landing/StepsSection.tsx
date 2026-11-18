import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AccountsPreview, ComposerPreview, InsightsPreview } from "./FeaturePreviews";
import { WindowFrame } from "./AppPreview";
import Reveal from "./Reveal";

const STEPS = [
  {
    title: "Connectez vos comptes",
    text: "Reliez vos profils sociaux pris en charge depuis l’espace Canaux. Vous gardez une vue claire sur chaque connexion.",
    screen: "Vos comptes",
    preview: <AccountsPreview />,
  },
  {
    title: "Préparez vos publications",
    text: "Rédigez votre contenu, ajoutez vos médias, choisissez vos réseaux et programmez votre calendrier.",
    screen: "Nouvelle publication",
    preview: <ComposerPreview />,
  },
  {
    title: "Suivez vos résultats",
    text: "Consultez les indicateurs disponibles, gérez vos commentaires YouTube et ajustez votre rythme de publication.",
    screen: "Vos Insights",
    preview: <InsightsPreview />,
  },
] as const;

export default function StepsSection() {
  const [active, setActive] = useState(0);
  const current = STEPS[active];

  return (
    <section id="fonctionnement" className="lp-section lp-steps-section">
      <div className="lp-container">
        <Reveal className="lp-section-heading lp-section-heading-compact">
          <span className="lp-eyebrow">Un flux de travail naturel</span>
          <h2>Prêt à publier en<br /><em>trois étapes.</em></h2>
        </Reveal>
        <div className="lp-steps-layout">
          <ol className="lp-step-list">
            {STEPS.map((step, index) => {
              const selected = index === active;
              return (
                <li key={step.title}>
                  <Reveal delay={index * 70}>
                    <button
                      type="button"
                      className={selected ? "lp-step is-active" : "lp-step"}
                      onClick={() => setActive(index)}
                      aria-pressed={selected}
                    >
                      <span className="lp-step-number">{selected ? <Check size={17} /> : "0" + (index + 1)}</span>
                      <span className="lp-step-text">
                        <strong>{step.title}</strong>
                        <span>{step.text}</span>
                      </span>
                      <ArrowRight size={17} className="lp-step-arrow" aria-hidden="true" />
                    </button>
                  </Reveal>
                </li>
              );
            })}
          </ol>
          <Reveal className="lp-step-visual">
            <div className="lp-step-visual-head">
              <span>STONE WORKSPACE</span>
              <span>{current.screen}</span>
            </div>
            <div key={active} className="lp-step-visual-content lp-pop">
              <WindowFrame label="Aperçu · démonstration">
                <div className="p-3 sm:p-4">{current.preview}</div>
              </WindowFrame>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
