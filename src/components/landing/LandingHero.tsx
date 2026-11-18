import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Sparkles } from "lucide-react";
import AppPreview from "./AppPreview";
import LandingNav from "./LandingNav";

function scrollToProduct() {
  document.getElementById("produit")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

export default function LandingHero() {
  return (
    <section className="lp-hero-shell" id="accueil">
      <div className="lp-hero-grain" aria-hidden="true" />
      <LandingNav />

      <div className="lp-container lp-hero-grid">
        <div className="lp-hero-copy">
          <div className="lp-eyebrow lp-hero-eyebrow">
            <span className="lp-eyebrow-icon"><Sparkles size={13} /></span>
            Le studio social tout-en-un
          </div>

          <h1 className="lp-hero-title">
            Votre présence sociale,
            <span>enfin <em>maîtrisée.</em></span>
          </h1>

          <p className="lp-hero-description">
            Créez, planifiez et suivez vos publications depuis un seul espace.
            Stone vous aide à garder une communication cohérente sans multiplier les outils.
          </p>

          <div className="lp-hero-actions">
            <a href="/signup" className="lp-button-primary">
              Commencer gratuitement <ArrowRight size={17} aria-hidden="true" />
            </a>
            <button type="button" className="lp-button-secondary" onClick={scrollToProduct}>
              Découvrir le produit <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="lp-hero-proof">
            <span className="lp-proof-icon"><CalendarDays size={15} /></span>
            <span>Un calendrier centralisé</span>
            <i />
            <span className="lp-proof-icon"><ChartNoAxesCombined size={15} /></span>
            <span>Des insights au même endroit</span>
          </div>
        </div>

        <div className="lp-hero-visual" aria-label="Aperçu du calendrier éditorial Stone">
          <div className="lp-hero-visual-backdrop" aria-hidden="true" />
          <div className="lp-preview-window">
            <div className="lp-preview-topline">
              <span className="lp-preview-live"><i /> STONE WORKSPACE</span>
              <span className="lp-preview-caption">Calendrier éditorial</span>
            </div>
            <AppPreview />
          </div>
          <div className="lp-float-card lp-float-card-publish">
            <span className="lp-float-icon"><CalendarDays size={17} /></span>
            <span><strong>Publication planifiée</strong><small>Tout votre contenu, au même endroit</small></span>
            <span className="lp-float-check">✓</span>
          </div>
          <div className="lp-float-card lp-float-card-insights">
            <span className="lp-float-chart"><ChartNoAxesCombined size={19} /></span>
            <span><strong>Vue d’ensemble</strong><small>Suivez vos performances</small></span>
          </div>
        </div>
      </div>

      <div className="lp-hero-bottom">
        <div className="lp-container lp-hero-bottom-inner">
          <span>Un seul espace pour toute votre communication.</span>
          <div className="lp-hero-capabilities">
            <span>Créer</span><b>·</b><span>Planifier</span><b>·</b><span>Publier</span><b>·</b><span>Analyser</span>
          </div>
        </div>
      </div>
    </section>
  );
}
