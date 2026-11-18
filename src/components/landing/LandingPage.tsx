import Footer from "../Footer";
import FeaturesSection from "./FeaturesSection";
import LandingHero from "./LandingHero";
import MetricsSection from "./MetricsSection";
import NetworksSection from "./NetworksSection";
import StepsSection from "./StepsSection";
import "./landing.css";

/**
 * Landing page de Stone (route « / »).
 * Le thème clair/sombre vient du ThemeProvider existant (classe `dark`).
 * Le footer est celui du projet, inchangé.
 */
export default function LandingPage() {
  return (
    <main className="relative z-10 w-full font-sans text-neutral-900 dark:text-white">
      <LandingHero />
      <NetworksSection />
      <FeaturesSection />
      <StepsSection />
      <MetricsSection />

      <div className="pt-24 sm:pt-32">
        <Footer />
      </div>
    </main>
  );
}
