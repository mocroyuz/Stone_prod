import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Sparkles } from "lucide-react";
import AppPreview from "./AppPreview";
import LandingNav from "./LandingNav";
import "./landing-reference.css";

function scrollToProduct() {
  document.getElementById("produit")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

export default function LandingHero() {
  return (
    <section className="lp-hero-shell lp-reference-hero" id="accueil">
      <div className="lp-hero-grain" aria-hidden="true" />
      <LandingNav />
      <div className="lp-reference-hero-content">
        <div className="lp-eyebrow lp-hero-eyebrow"><span className="lp-eyebrow-icon"><Sparkles size={13} /></span>Le studio social tout-en-un</div>
        <h1 className="lp-reference-title">Your social presence,<br /><em>beautifully organised.</em></h1>
        <p className="lp-reference-description">Planifiez, créez et publiez sur tous vos réseaux depuis un espace simple. Faites moins de gestion, et plus de contenu.</p>
        <div className="lp-hero-actions lp-reference-actions">
          <a href="/signup" className="lp-button-primary">Commencer gratuitement <ArrowRight size={17} /></a>
          <button type="button" className="lp-button-secondary" onClick={scrollToProduct}>Découvrir Stone <ArrowUpRight size={16} /></button>
        </div>
        <div className="lp-reference-stage">
          <div className="lp-reference-preview"><div className="lp-preview-topline"><span className="lp-preview-live"><i /> STONE WORKSPACE</span><span className="lp-preview-caption">Calendrier éditorial</span></div><AppPreview /></div>
          <div className="lp-reference-float lp-reference-float-one"><CalendarDays size={16}/><span><strong>Tout planifier</strong><small>Une vue, tous vos canaux</small></span></div>
          <div className="lp-reference-float lp-reference-float-two"><ChartNoAxesCombined size={17}/><span><strong>Suivre vos résultats</strong><small>Insights au même endroit</small></span></div>
        </div>
        <div className="lp-reference-proof"><span>Créer</span><b>·</b><span>Planifier</span><b>·</b><span>Publier</span><b>·</b><span>Analyser</span></div>
      </div>
    </section>
  );
}
