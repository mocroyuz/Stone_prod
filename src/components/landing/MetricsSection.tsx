import { BarChart3, Eye, Heart, MessageCircle, TrendingUp } from "lucide-react";
import Reveal from "./Reveal";

const METRICS = [
  { value: "12,4 k", label: "Vues vidéo", detail: "Exemple de portée sur une période sélectionnée", icon: Eye, bars: [30,48,38,62,50,72,58,88,66,96,78,100] },
  { value: "1 280", label: "Interactions", detail: "Exemple de réactions et d’échanges", icon: Heart, bars: [24,38,33,52,46,64,57,78,69,88,80,100] },
  { value: "4,8 %", label: "Engagement", detail: "Exemple de taux d’engagement", icon: MessageCircle, bars: [34,42,39,56,48,70,62,74,68,90,82,100] },
] as const;

export default function MetricsSection() {
  return (
    <section id="indicateurs" className="lp-section lp-metrics-section">
      <div className="lp-container">
        <Reveal className="lp-metrics-heading">
          <div>
            <span className="lp-eyebrow">La donnée, sans le bruit</span>
            <h2>Décidez avec une<br /><em>meilleure visibilité.</em></h2>
          </div>
          <p>Un aperçu des indicateurs que vous pouvez retrouver dans Insights pour mieux comprendre vos contenus.</p>
        </Reveal>
        <div className="lp-metrics-grid">
          {METRICS.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Reveal key={metric.label} delay={index * 75}>
                <article className={"lp-metric-card lp-metric-card-" + (index + 1)}>
                  <div className="lp-metric-top">
                    <span className="lp-metric-icon"><Icon size={18} /></span>
                    <span className="lp-metric-example">Exemple</span>
                  </div>
                  <div className="lp-metric-value">{metric.value}</div>
                  <div className="lp-metric-label">{metric.label}</div>
                  <p>{metric.detail}</p>
                  <div className="lp-metric-chart" aria-hidden="true">
                    {metric.bars.map((height, barIndex) => (
                      <span key={barIndex} style={{ height: height + "%" }} />
                    ))}
                  </div>
                  <div className="lp-metric-footer">
                    <span><BarChart3 size={13} /> Visualisation Insights</span>
                    <TrendingUp size={16} />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
        <p className="lp-metrics-disclaimer">
          Toutes les valeurs affichées sont fictives et servent uniquement à illustrer les possibilités de suivi.
          Elles ne représentent pas les résultats de Stone ni ceux de ses utilisateurs.
        </p>
      </div>
    </section>
  );
}
