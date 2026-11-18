import { CheckCircle2 } from "lucide-react";
import NetworkLogo, { NETWORK_LABELS, type LandingNetwork } from "./NetworkLogo";
import Reveal from "./Reveal";

const NETWORKS: { id: LandingNetwork; state: "available" | "sandbox"; note: string }[] = [
  { id: "instagram", state: "available", note: "Compte professionnel" },
  { id: "threads", state: "available", note: "Profil Threads" },
  { id: "youtube", state: "available", note: "Chaîne YouTube" },
  { id: "tiktok", state: "sandbox", note: "Mode sandbox" },
  { id: "pinterest", state: "sandbox", note: "Mode sandbox" },
];

export default function NetworksSection() {
  return (
    <section id="reseaux" className="lp-networks-section">
      <div className="lp-container">
        <Reveal className="lp-networks-intro">
          <div>
            <span className="lp-eyebrow">Vos plateformes, réunies</span>
            <h2>Votre contenu circule.<br /><em>Votre travail reste centralisé.</em></h2>
          </div>
          <p>
            Connectez les comptes pris en charge et retrouvez votre calendrier, vos publications et vos outils
            de suivi dans le même espace.
          </p>
        </Reveal>

        <div className="lp-network-grid">
          {NETWORKS.map((network, index) => (
            <Reveal key={network.id} delay={index * 50}>
              <article className="lp-network-card">
                <div className="lp-network-top">
                  <NetworkLogo network={network.id} size={42} />
                  {network.state === "available" ? (
                    <span className="lp-network-state"><CheckCircle2 size={12} /> Connexion</span>
                  ) : (
                    <span className="lp-network-state lp-network-state-sandbox">Sandbox</span>
                  )}
                </div>
                <strong>{NETWORK_LABELS[network.id]}</strong>
                <span className="lp-network-note">{network.note}</span>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="lp-network-disclaimer">
          TikTok et Pinterest fonctionnent actuellement en environnement sandbox : selon les autorisations,
          certaines publications peuvent être enregistrées en brouillon dans l’application concernée.
        </p>
      </div>
    </section>
  );
}
