import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Sparkles } from "lucide-react";
import AppPreview from "./AppPreview";
import LandingNav from "./LandingNav";

function scrollToFeatures() {
  document.getElementById("fonctionnalites")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

export default function LandingHero() {
  return (
    <section className="lp-hero-shell" id="accueil">
      <div className="lp-hero-glow lp-hero-glow-one" aria-hidden="true" />
      <div className="lp-hero-glow lp-hero-glow-two" aria-hidden="true" />
      <LandingNav />
      <div className="lp-container lp-hero-grid">
        <div className="lp-hero-copy">
          <div className="lp-eyebrow lp-hero-eyebrow">
            <span className="lp-eyebrow-icon"><Sparkles size={13} /></span>
            Le studio social des équipes ambitieuses
          </div>
          <h1 className="lp-hero-title">
            Faites grandir votre présence
            <span>sociale. <em>Simplement.</em></span>
          </h1>
          <p className="lp-hero-description">
            Planifiez vos contenus, publiez sur vos réseaux et suivez vos performances depuis un seul espace.
            Moins d’allers-retours. Plus de cohérence dans votre communication.
          </p>
          <div className="lp-hero-actions">
            <a href="/signup" className="lp-button-primary">
              Commencer gratuitement <ArrowRight size={17} aria-hidden="true" />
            </a>
            <button type="button" className="lp-button-secondary" onClick={scrollToFeatures}>
              Découvrir Stone <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="lp-hero-proof">
            <span className="lp-proof-icon"><CalendarDays size={15} /></span>
            <span>Calendrier éditorial</span><i />
            <span className="lp-proof-icon"><ChartNoAxesCombined size={15} /></span>
            <span>Insights centralisés</span>
          </div>
        </div>

        <div className="lp-hero-visual" aria-label="Aperçu du calendrier éditorial Stone">
          <div className="lp-visual-orbit lp-orbit-a" aria-hidden="true" />
          <div className="lp-visual-orbit lp-orbit-b" aria-hidden="true" />
          <div className="lp-preview-window">
            <div className="lp-preview-topline">
              <span className="lp-preview-live"><i /> Aperçu de Stone</span>
              <span className="lp-preview-caption">Calendrier éditorial</span>
            </div>
            <AppPreview />
          </div>
          <div className="lp-float-card lp-float-card-publish">
            <span className="lp-float-icon"><CalendarDays size={17} /></span>
            <span><strong>Publication programmée</strong><small>Jeudi · 18:30</small></span>
            <span className="lp-float-check">✓</span>
          </div>
          <div className="lp-float-card lp-float-card-insights">
            <span className="lp-float-chart"><ChartNoAxesCombined size={19} /></span>
            <span><strong>Vos performances</strong><small>Suivi au même endroit</small></span>
          </div>
        </div>
      </div>
      <div className="lp-hero-bottom">
        <div className="lp-container lp-hero-bottom-inner">
          <span>Tout votre workflow social, réuni.</span>
          <div className="lp-hero-capabilities">
            <span>Créer</span><b>·</b><span>Programmer</span><b>·</b><span>Publier</span><b>·</b><span>Analyser</span>
          </div>
        </div>
      </div>
    </section>
  );
}
