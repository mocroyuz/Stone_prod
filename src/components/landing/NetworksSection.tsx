import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import NetworkLogo, { NETWORK_LABELS, type LandingNetwork } from "./NetworkLogo";
import Reveal from "./Reveal";

const NETWORKS: { id: LandingNetwork; state: "connect" | "sandbox"; note: string }[] = [
  { id: "instagram", state: "connect", note: "Compte professionnel" },
  { id: "threads", state: "connect", note: "Profil Threads" },
  { id: "youtube", state: "connect", note: "YouTube Shorts" },
  { id: "tiktok", state: "sandbox", note: "Environnement sandbox" },
  { id: "pinterest", state: "sandbox", note: "Environnement sandbox" },
];

export default function NetworksSection() {
  return (
    <section id="reseaux" className="lp-section lp-networks-section">
      <div className="lp-container">
        <Reveal className="lp-networks-intro">
          <div>
            <span className="lp-eyebrow">Votre écosystème</span>
            <h2>Vos réseaux.<br /><em>Un seul espace.</em></h2>
          </div>
          <p>
            Retrouvez les connexions sociales prises en charge par Stone.
            L’accès à la publication dépend des autorisations accordées par chaque plateforme.
          </p>
        </Reveal>
        <div className="lp-network-grid">
          {NETWORKS.map((network, index) => (
            <Reveal key={network.id} delay={index * 55}>
              <article className="lp-network-card">
                <div className="lp-network-top">
                  <NetworkLogo network={network.id} size={44} />
                  {network.state === "connect" ? (
                    <span className="lp-network-state"><CheckCircle2 size={13} /> Connexion</span>
                  ) : (
                    <span className="lp-network-state lp-network-state-sandbox">Sandbox</span>
                  )}
                </div>
                <strong>{NETWORK_LABELS[network.id]}</strong>
                <span className="lp-network-note">{network.note}</span>
                <ArrowUpRight className="lp-network-arrow" size={17} aria-hidden="true" />
              </article>
            </Reveal>
          ))}
        </div>
        <p className="lp-network-disclaimer">
          TikTok et Pinterest sont actuellement en environnement sandbox : certaines publications peuvent rester
          en brouillon ou nécessiter une validation dans l’application du réseau.
        </p>
      </div>
    </section>
  );
}
