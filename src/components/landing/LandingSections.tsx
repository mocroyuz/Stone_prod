import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChartNoAxesCombined,
  MessageCircle,
  PanelsTopLeft,
} from "lucide-react";
import AppPreview from "./AppPreview";
import { InsightsPreview, MediaPreview, StatusPreview } from "./FeaturePreviews";
import Reveal from "./Reveal";

const TRUST_ITEMS = [
  { icon: CalendarDays, title: "Calendrier éditorial", note: "Une vue de vos publications" },
  { icon: PanelsTopLeft, title: "Publication multi-réseaux", note: "Un espace de création" },
  { icon: ChartNoAxesCombined, title: "Suivi des performances", note: "Insights disponibles" },
  { icon: MessageCircle, title: "Gestion des échanges", note: "Commentaires YouTube" },
];

export function TrustStrip() {
  return (
    <section className="lp-trust-strip" aria-label="Fonctionnalités principales de Stone">
      <div className="lp-container lp-trust-grid">
        {TRUST_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div className="lp-trust-item" key={item.title}>
              <span className="lp-trust-icon"><Icon size={17} /></span>
              <span><strong>{item.title}</strong><small>{item.note}</small></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ShowcaseRow({
  eyebrow,
  title,
  description,
  points,
  preview,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  preview: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={reverse ? "lp-showcase-row lp-showcase-reverse" : "lp-showcase-row"}>
      <Reveal className="lp-showcase-copy">
        <span className="lp-eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
        <ul>
          {points.map((point) => (
            <li key={point}><span><Check size={13} /></span>{point}</li>
          ))}
        </ul>
        <a href="/signup" className="lp-text-link">Essayer Stone <ArrowUpRight size={15} /></a>
      </Reveal>
      <Reveal className="lp-showcase-visual">
        <div className="lp-showcase-visual-inner">{preview}</div>
      </Reveal>
    </div>
  );
}

export function ProductShowcaseSection() {
  return (
    <section id="produit" className="lp-section lp-product-section">
      <div className="lp-container">
        <Reveal className="lp-section-heading lp-product-heading">
          <span className="lp-eyebrow">Une expérience conçue pour rester simple</span>
          <h2>Voyez l’ensemble.<br /><em>Gardez le contrôle.</em></h2>
          <p>Les écrans et les outils essentiels sont réunis dans une seule expérience de travail.</p>
        </Reveal>

        <ShowcaseRow
          eyebrow="Votre espace de planification"
          title="Votre calendrier devient votre point de repère."
          description="Prenez de la hauteur sur votre organisation et retrouvez les publications prévues dans une seule vue."
          points={[
            "Vue calendrier des contenus à venir",
            "Statuts des publications clairement identifiés",
            "Accès rapide à la création de contenu",
          ]}
          preview={<AppPreview />}
        />

        <ShowcaseRow
          eyebrow="Vos outils de contenu"
          title="De la création au suivi, sans perdre le fil."
          description="Préparez vos médias, vérifiez vos publications et consultez les indicateurs disponibles dans Stone."
          points={[
            "Import de médias depuis vos outils connectés",
            "Suivi des performances YouTube",
            "Lecture et gestion des commentaires YouTube",
          ]}
          preview={
            <div className="lp-showcase-stack">
              <div className="lp-showcase-preview-card"><MediaPreview /></div>
              <div className="lp-showcase-preview-card lp-showcase-preview-small"><StatusPreview /></div>
            </div>
          }
          reverse
        />
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Starter",
    price: "19",
    description: "Pour structurer votre présence sociale.",
    features: ["Jusqu’à 3 canaux", "10 publications par canal", "Insights de base", "Calendrier de contenu", "100 idées et 50 tags maximum"],
  },
  {
    name: "Pro",
    price: "49",
    description: "Pour publier sans freiner votre croissance.",
    featured: true,
    features: ["Tous les canaux", "Publications illimitées", "Insights avancés", "Idées illimitées", "Jusqu’à 250 tags"],
  },
  {
    name: "Enterprise",
    price: "99",
    description: "Pour les équipes avec des besoins avancés.",
    features: ["Tout ce qui est inclus dans Pro", "Limites de canaux personnalisées", "Idées et tags illimités", "Support prioritaire", "Accompagnement dédié"],
  },
] as const;

export function PricingOverviewSection() {
  return (
    <section id="tarifs" className="lp-section lp-pricing-section">
      <div className="lp-container">
        <Reveal className="lp-section-heading lp-pricing-heading">
          <span className="lp-eyebrow">Des offres qui suivent votre rythme</span>
          <h2>Simple à choisir.<br /><em>Facile à faire évoluer.</em></h2>
          <p>Retrouvez les principales différences entre les offres Stone. Les options et la facturation détaillées sont sur la page Tarifs.</p>
        </Reveal>

        <div className="lp-pricing-grid">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 70}>
              <article className={plan.featured ? "lp-plan-card lp-plan-featured" : "lp-plan-card"}>
                {plan.featured && <span className="lp-plan-popular">Le plus choisi</span>}
                <div className="lp-plan-head">
                  <span className="lp-plan-name">{plan.name}</span>
                  <p>{plan.description}</p>
                </div>
                <div className="lp-plan-price">
                  <strong>{plan.price} €</strong><span>/ mois</span>
                </div>
                <span className="lp-plan-period">Facturation mensuelle</span>
                <a href="/pricing" className="lp-plan-button">
                  Découvrir l’offre <ArrowRight size={15} />
                </a>
                <div className="lp-plan-divider" />
                <span className="lp-plan-includes">Inclus dans l’offre</span>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}><Check size={14} />{feature}</li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="lp-pricing-note">Tarifs mensuels affichés. Les tarifs annuels et les conditions complètes sont consultables sur la page Tarifs.</p>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    question: "Qu’est-ce que Stone ?",
    answer: "Stone est un espace de gestion des réseaux sociaux qui permet de préparer, programmer et suivre vos publications depuis un calendrier centralisé.",
  },
  {
    question: "Quels réseaux puis-je connecter ?",
    answer: "Stone propose actuellement des connexions pour Instagram, Threads et YouTube. TikTok et Pinterest sont présents en mode sandbox : les possibilités de publication peuvent être limitées selon l’état de validation des applications.",
  },
  {
    question: "Puis-je adapter une publication selon le réseau ?",
    answer: "Oui. Depuis la création d’une publication, vous pouvez sélectionner les réseaux et adapter le contenu et les médias en fonction de chaque destination.",
  },
  {
    question: "Quelles données sont disponibles dans Insights ?",
    answer: "Les indicateurs détaillés affichés dans Stone concernent actuellement YouTube. Les données accessibles dépendent des autorisations accordées par la plateforme.",
  },
  {
    question: "Puis-je gérer les commentaires depuis Stone ?",
    answer: "La lecture et la gestion des commentaires sont actuellement disponibles pour les vidéos YouTube connectées.",
  },
] as const;

export function FAQSection() {
  const [active, setActive] = useState<number | null>(0);

  return (
    <section id="faq" className="lp-section lp-faq-section">
      <div className="lp-container lp-faq-layout">
        <Reveal className="lp-faq-intro">
          <span className="lp-eyebrow">Besoin de précisions ?</span>
          <h2>Quelques réponses<br />pour <em>commencer.</em></h2>
          <p>Tout ce qu’il faut savoir sur les fonctions actuellement disponibles dans Stone.</p>
          <a href="/faq" className="lp-text-link">Consulter le centre d’aide <ArrowUpRight size={15} /></a>
        </Reveal>

        <div className="lp-faq-list">
          {FAQ_ITEMS.map((item, index) => {
            const open = active === index;
            const panelId = "lp-faq-panel-" + index;
            return (
              <Reveal key={item.question} delay={index * 45}>
                <article className={open ? "lp-faq-item is-open" : "lp-faq-item"}>
                  <button
                    type="button"
                    className="lp-faq-question"
                    onClick={() => setActive(open ? null : index)}
                    aria-expanded={open}
                    aria-controls={panelId}
                  >
                    <span><i>{String(index + 1).padStart(2, "0")}</i>{item.question}</span>
                    <ChevronDown size={17} aria-hidden="true" />
                  </button>
                  {open && <div id={panelId} className="lp-faq-answer">{item.answer}</div>}
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
