import { ArrowRight, ArrowUpRight } from "lucide-react";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

const PRODUCT_LINKS = [
  { label: "Fonctionnalités", id: "fonctionnalites" },
  { label: "Réseaux sociaux", id: "reseaux" },
  { label: "Insights", id: "indicateurs" },
];

export default function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-cta">
          <div>
            <span className="lp-footer-kicker">À vous de jouer</span>
            <h2>Votre prochain post<br /><em>commence ici.</em></h2>
            <p>Organisez vos contenus et gardez le contrôle de votre présence sociale avec Stone.</p>
          </div>
          <a href="/signup" className="lp-footer-button">Commencer gratuitement <ArrowRight size={17} /></a>
        </div>
        <div className="lp-footer-main">
          <div className="lp-footer-brand">
            <a href="/" aria-label="Stone — accueil" className="lp-brand lp-footer-logo">
              <img src="/images/icon.png" alt="" width={38} height={38} />
              <span>stone<span className="lp-brand-dot">.</span></span>
            </a>
            <p>Le studio social pour créer, programmer et analyser vos contenus au même endroit.</p>
          </div>
          <div className="lp-footer-column">
            <h3>Produit</h3>
            {PRODUCT_LINKS.map((link) => (
              <a key={link.id} href={"#" + link.id} onClick={(event) => {
                event.preventDefault();
                scrollToSection(link.id);
              }}>{link.label}</a>
            ))}
          </div>
          <div className="lp-footer-column">
            <h3>Compte</h3>
            <a href="/signup">Créer un compte</a>
            <a href="/signin">Se connecter</a>
            <a href="/faq">Questions fréquentes</a>
          </div>
          <div className="lp-footer-column">
            <h3>Informations</h3>
            <a href="/privacy">Confidentialité</a>
            <a href="/tos">Conditions d’utilisation</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Stone. Tous droits réservés.</span>
          <span>Conçu pour une présence sociale plus claire.</span>
          <a href="#accueil" onClick={(event) => {
            event.preventDefault();
            scrollToSection("accueil");
          }}>Retour en haut <ArrowUpRight size={14} /></a>
        </div>
      </div>
    </footer>
  );
}
