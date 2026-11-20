import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import LandingNav from "./LandingNav";
import NetworkLogo, {
  NETWORK_LABELS,
  type LandingNetwork,
} from "./NetworkLogo";
import {
  ComposerPreview,
  MonthPreview,
  InsightsPreview,
  CommentsPreview,
  MediaPreview,
} from "./FeaturePreviews";
import Reveal from "./Reveal";
import "./landing.css";
import "./stone-reference.css";

const networks: {
  id: LandingNetwork;
  status: string;
  state: "available" | "sandbox" | "unavailable";
}[] = [
  { id: "instagram", status: "Connexion disponible", state: "available" },
  { id: "threads", status: "Connexion disponible", state: "available" },
  { id: "youtube", status: "Connexion disponible", state: "available" },
  { id: "tiktok", status: "Sandbox", state: "sandbox" },
  { id: "pinterest", status: "Sandbox", state: "sandbox" },
  {
    id: "facebook",
    status: "Non disponible pour le moment",
    state: "unavailable",
  },
];

const stats = [
  {
    value: "1",
    label: "espace de travail",
    note: "Vos contenus et vos comptes réunis",
  },
  {
    value: "6",
    label: "réseaux répertoriés",
    note: "Disponibilité indiquée pour chaque plateforme",
  },
  {
    value: "3",
    label: "connexions disponibles",
    note: "Instagram, Threads et YouTube",
  },
  {
    value: "1",
    label: "calendrier centralisé",
    note: "Une vue claire de vos publications",
  },
];

const plans = [
  {
    name: "Starter",
    price: "19",
    description: "Pour structurer votre présence.",
    features: [
      "Jusqu'à 3 canaux",
      "10 publications par canal",
      "Statistiques de base",
      "Calendrier de contenu",
      "Jusqu'à 100 idées",
      "Jusqu'à 50 tags",
      "Extension web incluse",
    ],
  },
  {
    name: "Pro",
    price: "49",
    description: "Pour publier sans limite.",
    features: [
      "Tous les canaux",
      "Publications illimitées",
      "Statistiques avancées",
      "Calendrier de contenu",
      "Idées illimitées",
      "Jusqu'à 250 tags",
      "Extension web incluse",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "99",
    description: "Pour les équipes ambitieuses.",
    features: [
      "Tout ce qui est inclus dans Pro",
      "Limites de canaux personnalisées",
      "Publications illimitées",
      "Statistiques avancées",
      "Calendrier de contenu",
      "Idées et tags illimités",
      "Support prioritaire",
      "Accompagnement dédié",
    ],
  },
];

const faq = [
  {
    q: "Qu’est-ce que Stone ?",
    a: "Stone centralise la création, la programmation et le suivi de vos contenus sociaux dans un seul espace.",
  },
  {
    q: "Quels réseaux sont pris en charge ?",
    a: "Instagram, Threads et YouTube disposent de connexions disponibles. TikTok et Pinterest sont actuellement en mode sandbox. La connexion des Pages Facebook n'est pas encore disponible.",
  },
  {
    q: "Puis-je adapter un post à chaque plateforme ?",
    a: "Oui, le contenu peut être adapté selon les réseaux sélectionnés depuis le composer.",
  },
  {
    q: "Quelles données sont disponibles ?",
    a: "Les indicateurs et commentaires accessibles dépendent des plateformes et autorisations. Les Insights et commentaires sont actuellement principalement disponibles pour YouTube.",
  },
];

const spotlightPosts: {
  network: LandingNetwork;
  title: string;
  schedule: string;
  state: string;
}[] = [
  {
    network: "instagram",
    title: "Nouvelle collection",
    schedule: "Aujourd’hui · 10:30",
    state: "Prêt",
  },
  {
    network: "youtube",
    title: "Short du mercredi",
    schedule: "Demain · 12:00",
    state: "Programmé",
  },
  {
    network: "threads",
    title: "Question à la communauté",
    schedule: "Jeudi · 17:45",
    state: "Brouillon",
  },
];

const steps = [
  {
    number: "01",
    title: "Connect",
    description: "Reliez vos comptes sociaux à votre espace Stone.",
  },
  {
    number: "02",
    title: "Create & Schedule",
    description: "Préparez vos contenus et organisez leur publication.",
  },
  {
    number: "03",
    title: "Analyze & Grow",
    description: "Consultez les résultats disponibles et ajustez votre rythme.",
  },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

function SectionTitle({
  tag,
  title,
  description,
}: {
  tag: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <Reveal className="stone-ref-heading">
      <span className="stone-ref-tag">{tag}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </Reveal>
  );
}

function SpotlightPreview() {
  return (
    <div
      className="stone-ref-main-preview stone-ref-device"
      role="img"
      aria-label="Aperçu de Stone : calendrier des publications, comptes sociaux et statuts"
    >
      <div className="stone-ref-device-topbar">
        <div className="stone-ref-device-brand">
          <img src="/images/icon.png" alt="" />
          <span>STONE WORKSPACE</span>
        </div>
        <span className="stone-ref-device-live">
          <i />
          LIVE
        </span>
      </div>

      <div className="stone-ref-device-content">
        <span className="stone-ref-device-eyebrow">VOTRE ESPACE SOCIAL</span>
        <h3>Cette semaine</h3>
        <p className="stone-ref-device-date">18 — 24 novembre</p>

        <div className="stone-ref-device-days">
          {[
            { day: "LUN", date: "18" },
            { day: "MAR", date: "19", active: true },
            { day: "MER", date: "20" },
            { day: "JEU", date: "21" },
          ].map((item) => (
            <div
              key={item.day}
              className={item.active ? "is-active" : undefined}
            >
              <span>{item.day}</span>
              <b>{item.date}</b>
            </div>
          ))}
        </div>

        <div className="stone-ref-device-posts">
          {spotlightPosts.map((post) => (
            <div className="stone-ref-device-post" key={post.title}>
              <NetworkLogo network={post.network} size={27} />
              <div className="stone-ref-device-post-copy">
                <strong>{post.title}</strong>
                <span>{post.schedule}</span>
              </div>
              <span className="stone-ref-device-post-state">{post.state}</span>
            </div>
          ))}
        </div>

        <div className="stone-ref-device-footer">
          <span>
            <CalendarDays size={13} />
            Votre calendrier, au même endroit
          </span>
          <Check size={15} />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="stone-ref-page">
      <div className="stone-ref-frame">
        <LandingNav />

        <section className="stone-ref-hero" id="accueil">
          <Reveal className="stone-ref-hero-copy">
            <span className="stone-ref-pill">
              <Sparkles size={12} />
              Social media workspace
            </span>
            <h1>
              Your social presence.
              <br />
              <em>Beautifully organised.</em>
            </h1>
            <p>
              Planifiez, créez et suivez vos contenus sur les réseaux connectés,
              depuis un espace pensé pour simplifier votre quotidien.
            </p>
            <div className="stone-ref-actions">
              <a className="stone-ref-primary" href="/signup">
                Commencer gratuitement <ArrowRight size={16} />
              </a>
              <button
                className="stone-ref-secondary"
                type="button"
                onClick={() => scrollToSection("produit")}
              >
                Découvrir Stone <ArrowUpRight size={15} />
              </button>
            </div>
          </Reveal>

          <div
            className="stone-ref-mockup"
            role="group"
            aria-label="Aperçus visuels du workspace Stone"
          >
            <div
              className="stone-ref-collage stone-ref-collage-left"
              aria-hidden="true"
            >
              <ComposerPreview />
            </div>
            <div
              className="stone-ref-collage stone-ref-collage-right"
              aria-hidden="true"
            >
              <MonthPreview />
            </div>
            <SpotlightPreview />
            <div className="stone-ref-floating stone-ref-floating-top">
              <CalendarDays size={16} />
              <span>
                <b>Publication planifiée</b>
                <small>Votre calendrier centralisé</small>
              </span>
              <Check size={14} />
            </div>
            <div className="stone-ref-floating stone-ref-floating-bottom">
              <ChartNoAxesCombined size={17} />
              <span>
                <b>Vos performances</b>
                <small>Les résultats en un coup d’œil</small>
              </span>
            </div>
          </div>

          <div className="stone-ref-slogan" aria-label="Créer, planifier, publier, analyser">
            <span>Créer</span>
            <i>·</i>
            <span>Planifier</span>
            <i>·</i>
            <span>Publier</span>
            <i>·</i>
            <span>Analyser</span>
          </div>
        </section>

        <section className="stone-ref-stats">
          <Reveal className="stone-ref-about">
            <span className="stone-ref-tag">Pourquoi Stone</span>
            <h2>
              Tout votre social.
              <br />
              <em>Au même endroit.</em>
            </h2>
            <p>
              Un espace de travail qui vous laisse vous concentrer sur vos
              idées, plutôt que sur les outils et les allers-retours.
            </p>
            <a href="/signup">
              Découvrir Stone <ArrowUpRight size={15} />
            </a>
          </Reveal>

          <div className="stone-ref-stat-grid">
            {stats.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 65}>
                <article>
                  <strong>{stat.value}</strong>
                  <b>{stat.label}</b>
                  <p>{stat.note}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-projects" id="produit">
          <SectionTitle
            tag="Le workspace"
            title={
              <>
                Everything you need.
                <br />
                <em>Nothing in the way.</em>
              </>
            }
            description="Les outils essentiels réunis dans une interface lisible et calme."
          />

          <div className="stone-ref-project-grid">
            <Reveal className="stone-ref-project-card stone-ref-project-wide">
              <span className="stone-ref-tag">01 · Composer</span>
              <h3>Préparez votre contenu en un seul endroit.</h3>
              <p>
                Écrivez, ajoutez vos médias et adaptez vos posts aux réseaux
                sélectionnés.
              </p>
              <ComposerPreview />
            </Reveal>

            <Reveal className="stone-ref-project-card">
              <span className="stone-ref-tag">02 · Calendar</span>
              <h3>Gardez le cap.</h3>
              <p>Une vue claire de vos publications à venir.</p>
              <MonthPreview />
            </Reveal>

            <Reveal className="stone-ref-project-card">
              <span className="stone-ref-tag">03 · Insights</span>
              <h3>Comprenez ce qui fonctionne.</h3>
              <p>Suivez les indicateurs disponibles pour vos comptes.</p>
              <InsightsPreview />
            </Reveal>

            <Reveal className="stone-ref-project-card stone-ref-project-wide">
              <span className="stone-ref-tag">04 · Media library</span>
              <h3>Vos ressources, sans friction.</h3>
              <p>
                Importez et préparez vos médias pour vos prochaines
                publications.
              </p>
              <MediaPreview />
            </Reveal>

            <Reveal className="stone-ref-project-card stone-ref-project-wide">
              <span className="stone-ref-tag">05 · Community</span>
              <h3>Ne perdez pas le fil.</h3>
              <p>
                Retrouvez les conversations et commentaires accessibles depuis
                vos comptes.
              </p>
              <CommentsPreview />
            </Reveal>
          </div>
        </section>

        <section className="stone-ref-networks" id="reseaux">
          <SectionTitle
            tag="Connect your channels"
            title={
              <>
                One calendar.
                <br />
                <em>Multiple platforms.</em>
              </>
            }
            description="Connectez vos comptes et gérez votre contenu dans un même workflow."
          />

          <div className="stone-ref-network-grid">
            {networks.map((network, index) => (
              <Reveal key={network.id} delay={index * 45}>
                <article>
                  <NetworkLogo network={network.id} size={38} />
                  <strong>{NETWORK_LABELS[network.id]}</strong>
                  <span
                    className={`stone-ref-network-status is-${network.state}`}
                  >
                    {network.status}
                  </span>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-how" id="fonctionnalites">
          <SectionTitle
            tag="Workflow"
            title={
              <>
                Three steps.
                <br />
                <em>More time to create.</em>
              </>
            }
            description="Un parcours simple pour passer de l’idée à la publication."
          />

          <div className="stone-ref-how-grid">
            {steps.map((step, index) => (
              <Reveal key={step.number} delay={index * 80}>
                <article>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-pricing" id="tarifs">
          <SectionTitle
            tag="Pricing"
            title={
              <>
                A plan for your
                <br />
                <em>next chapter.</em>
              </>
            }
            description="Choisissez l’espace qui correspond à votre rythme."
          />

          <div className="stone-ref-price-grid">
            {plans.map((plan, index) => (
              <Reveal key={plan.name} delay={index * 70}>
                <article className={plan.featured ? "is-featured" : ""}>
                  <span className="stone-ref-plan-name">{plan.name}</span>
                  <p>{plan.description}</p>
                  <div className="stone-ref-price">
                    <strong>{plan.price}€</strong>
                    <small>/ mois</small>
                  </div>
                  <a href="/pricing">
                    Voir l’offre <ArrowRight size={14} />
                  </a>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={14} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-faq" id="faq">
          <Reveal>
            <span className="stone-ref-tag">FAQ</span>
            <h2>
              Questions,
              <br />
              <em>answered.</em>
            </h2>
          </Reveal>
          <div className="stone-ref-faq-list">
            {faq.map((item, index) => (
              <Reveal key={item.q}>
                <details open={index === 0}>
                  <summary>
                    {item.q}
                    <span>+</span>
                  </summary>
                  <p>{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-cta">
          <span className="stone-ref-tag">STONE WORKSPACE</span>
          <h2>
            Less managing.
            <br />
            <em>More creating.</em>
          </h2>
          <p>Commencez à organiser votre présence sociale.</p>
          <a className="stone-ref-primary" href="/signup">
            Commencer gratuitement <ArrowRight size={16} />
          </a>
        </section>

        <footer className="stone-ref-footer">
          <a href="/" className="stone-ref-logo">
            <img src="/images/icon.png" alt="" />
            stone.
          </a>
          <span>Votre présence sociale, simplifiée.</span>
          <nav aria-label="Navigation de pied de page">
            <a href="/pricing">Tarifs</a>
            <a href="/faq">FAQ</a>
            <a href="/privacy">Confidentialité</a>
            <a href="/tos">Conditions</a>
          </nav>
          <small>© Stone</small>
        </footer>
      </div>
    </main>
  );
}
